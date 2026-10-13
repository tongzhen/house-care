/* eslint-disable import/first */
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(), scheduleNotificationAsync: jest.fn(), cancelScheduledNotificationAsync: jest.fn(), cancelAllScheduledNotificationsAsync: jest.fn(), getAllScheduledNotificationsAsync: jest.fn(), getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn(), addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })), getLastNotificationResponseAsync: jest.fn(async () => null), SchedulableTriggerInputTypes: { DATE: 'date' },
}));
jest.mock('../db', () => ({ loadConfigurations: jest.fn(), saveReminderLedger: jest.fn() }));
import * as Notifications from 'expo-notifications';
import * as db from '../db';
import { actions, getAction } from '../catalog';
import { buildReminderPlans, rescheduleNotifications, scheduledDate, subscribeToNotificationResponses } from '../notifications';
import { defaultNotificationSchedule } from '../notificationSchedule';
import { reconcileSeasonalConfiguration } from '../seasonalScheduling';
import type { ActionConfiguration } from '../types';

const now = new Date(2026, 9, 13, 12);
const config = (id: string): ActionConfiguration => reconcileSeasonalConfiguration(getAction(id)!, { actionId: id, enabled: true, notificationsEnabled: true }, [], now);
let saved: ActionConfiguration[];
let pending: Notifications.NotificationRequest[];
beforeEach(() => {
  jest.clearAllMocks(); jest.useFakeTimers(); jest.setSystemTime(now);
  saved = [config('gutters-ground-check'), config('underfloor-heating-visual-check'), config('outdoor-tap-winter-check'), config('gutters-accessible-clean')]; pending = [];
  jest.mocked(db.loadConfigurations).mockImplementation(async () => saved);
  jest.mocked(db.saveReminderLedger).mockImplementation(async (id, ledger) => { saved = saved.map((c) => c.actionId === id ? { ...c, reminderLedger: ledger } : c); });
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: true } as never);
  jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockImplementation(async () => pending);
  jest.mocked(Notifications.scheduleNotificationAsync).mockImplementation(async (request) => { pending.push(request as unknown as Notifications.NotificationRequest); return request.identifier!; });
  jest.mocked(Notifications.cancelScheduledNotificationAsync).mockImplementation(async (id) => { pending = pending.filter((p) => p.identifier !== id); });
});
afterEach(() => jest.useRealTimers());

it('groups overdue checks into one catch-up and queues all future seasonal dates for twelve months', () => {
  const plans = buildReminderPlans(saved, actions, 'en', defaultNotificationSchedule(), now, new Map());
  expect(plans[0].attempts).toHaveLength(3);
  expect(plans[0].data.destination).toBe('seasonal');
  expect(plans[0].date > now).toBe(true);
  expect(plans.find((p) => p.date.getMonth() === 2)?.attempts).toHaveLength(2);
  expect(plans.find((p) => p.date.getFullYear() === 2027 && p.date.getMonth() === 8)?.attempts).toHaveLength(2);
  expect(plans.every((p) => p.date <= new Date(2027, 9, 13, 12))).toBe(true);
});
it('moves catch-up to a permitted future window, including after the window has closed', () => {
  const schedule = defaultNotificationSchedule();
  Object.values(schedule).forEach((day) => { day.enabled = false; });
  schedule[now.getDay() as keyof typeof schedule] = { enabled: true, startTime: '09:00', endTime: '10:00' };
  const date = scheduledDate(now, schedule, false, now)!;
  expect(date.getDate()).toBe(20);
  expect(date.getHours()).toBe(9);
  Object.values(schedule).forEach((day) => { day.enabled = false; });
  expect(scheduledDate(now, schedule, false, now)).toBeNull();
});
it('preserves pending reminders on repeated reconciliation and never repeats passed catch-up attempts', async () => {
  await rescheduleNotifications(saved, actions, true);
  const count = pending.length;
  await rescheduleNotifications(saved, actions, true);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(count);
  expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  jest.setSystemTime(new Date(2026, 9, 13, 13));
  pending = pending.filter((p) => !(p.identifier.includes('2026-10-13')));
  await rescheduleNotifications(saved, actions, true);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(count);
});
it('snoozes an already attempted occurrence once without shifting later seasons', async () => {
  await rescheduleNotifications(saved, actions, true);
  jest.setSystemTime(new Date(2026, 9, 14, 12));
  const until = new Date(2026, 9, 21, 9).toISOString();
  saved = saved.map((c) => c.actionId === 'gutters-ground-check' ? { ...c, snoozedUntil: until } : c);
  await rescheduleNotifications(saved, actions, true);
  const moved = pending.find((p) => p.content.data?.scheduledAt === until);
  expect(moved?.content.data?.reminderKeys).toEqual([`gutters-ground-check:2026-09-01:snooze:${until}`]);
  expect(saved.find((c) => c.actionId === 'gutters-ground-check')?.seasonalDueDate).toBe('2026-09-01');
});
it('cancels disabled actions and suppresses scheduling without permission', async () => {
  await rescheduleNotifications(saved, actions, true);
  saved = saved.map((c) => ({ ...c, enabled: false }));
  await rescheduleNotifications(saved, actions, true);
  expect(pending).toHaveLength(0);
  const calls = jest.mocked(Notifications.scheduleNotificationAsync).mock.calls.length;
  saved = saved.map((c) => ({ ...c, enabled: true }));
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: false } as never);
  await rescheduleNotifications(saved, actions, true);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(calls);
});
it('respects per-action notification preferences and keeps custom intervals individual', () => {
  const plans = buildReminderPlans([{ ...config('gutters-ground-check'), notificationsEnabled: false }, { ...config('outdoor-tap-winter-check'), frequencyOverride: { interval: 1, unit: 'month' }, nextDueAt: new Date(2026, 10, 13, 9).toISOString() }], actions, 'en', undefined, now, new Map());
  expect(plans).toHaveLength(1);
  expect(plans[0].data.actionId).toBe('outdoor-tap-winter-check');
});
it('localizes reminders and routes seasonal notification taps separately', async () => {
  await rescheduleNotifications(saved, actions, true, 'da');
  expect(pending[0].content.body).toContain('sæsonopgaver');
  const onSeasonal = jest.fn(); const onAction = jest.fn();
  subscribeToNotificationResponses(onAction, onSeasonal);
  const listener = jest.mocked(Notifications.addNotificationResponseReceivedListener).mock.calls[0][0];
  listener({ notification: { request: { content: { data: { destination: 'seasonal' } } } } } as never);
  expect(onSeasonal).toHaveBeenCalledTimes(1); expect(onAction).not.toHaveBeenCalled();
});
it('rebuilds missing future notifications from a restored ledger', async () => {
  await rescheduleNotifications(saved, actions, true);
  const count = pending.length;
  pending = [];
  await rescheduleNotifications(saved, actions, true);
  expect(pending).toHaveLength(count);
});
it('does not record failed scheduling as an attempted reminder', async () => {
  jest.mocked(Notifications.scheduleNotificationAsync).mockRejectedValueOnce(new Error('OS unavailable'));
  await expect(rescheduleNotifications(saved, actions, true)).rejects.toThrow('OS unavailable');
  expect(saved.every((config) => !config.reminderLedger?.length)).toBe(true);
  await rescheduleNotifications(saved, actions, true);
  expect(pending.length).toBeGreaterThan(0);
});

it('persists successful attempts even when a later notification fails', async () => {
  const schedule = jest.mocked(Notifications.scheduleNotificationAsync);
  schedule.mockImplementationOnce(async (request) => { pending.push(request as unknown as Notifications.NotificationRequest); return request.identifier!; });
  schedule.mockRejectedValueOnce(new Error('Second notification failed'));
  await expect(rescheduleNotifications(saved, actions, true)).rejects.toThrow('Second notification failed');
  expect(saved.find((c) => c.actionId === 'gutters-ground-check')?.reminderLedger?.[0].key).toBe('2026-09-01');
  jest.setSystemTime(new Date(2026, 9, 13, 13));
  pending = [];
  await rescheduleNotifications(saved, actions, true);
  expect(pending.every((p) => !p.identifier.includes('2026-10-13'))).toBe(true);
});
