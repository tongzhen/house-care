/* eslint-disable import/first */

jest.mock('expo-notifications', () => ({
  getAllScheduledNotificationsAsync: jest.fn(async () => []), cancelScheduledNotificationAsync: jest.fn(),
  setNotificationHandler: jest.fn(), scheduleNotificationAsync: jest.fn(), cancelAllScheduledNotificationsAsync: jest.fn(), getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn(), addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })), getLastNotificationResponseAsync: jest.fn(async () => null),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

jest.mock('../db', () => ({ loadConfigurations: jest.fn(async () => []), saveReminderLedger: jest.fn(async () => undefined) }));

import * as NativeNotifications from 'expo-notifications';
import { defaultNotificationSchedule } from '../notificationSchedule';
import { requestNotificationPermission, rescheduleNotifications, subscribeToNotificationResponses } from '../notifications';

const mockScheduleNotificationAsync = jest.mocked(NativeNotifications.scheduleNotificationAsync);
const mockGetPermissionsAsync = jest.mocked(NativeNotifications.getPermissionsAsync);
const mockRequestPermissionsAsync = jest.mocked(NativeNotifications.requestPermissionsAsync);
const mockAddNotificationResponseReceivedListener = jest.mocked(NativeNotifications.addNotificationResponseReceivedListener);
const denied = { granted: false, status: 'denied', expires: 'never', canAskAgain: true } as NativeNotifications.NotificationPermissionsStatus;
const granted = { granted: true, status: 'granted', expires: 'never', canAskAgain: true } as NativeNotifications.NotificationPermissionsStatus;
const action = { id: 'dishwasher-filter-clean', trigger: { kind: 'recurring' }, content: { en: { title: 'Clean filter' } } } as never;

beforeEach(() => { jest.clearAllMocks(); });

describe('local notifications', () => {
  it('does not schedule reminders when permission is denied', async () => {
    mockGetPermissionsAsync.mockResolvedValue(denied);
    await rescheduleNotifications([{ actionId: 'dishwasher-filter-clean', enabled: true, notificationsEnabled: true, nextDueAt: '2099-08-20T09:00:00.000Z' }], [action], true);
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('schedules future recurring actions when permitted', async () => {
    mockGetPermissionsAsync.mockResolvedValue(granted);
    await rescheduleNotifications([{ actionId: 'dishwasher-filter-clean', enabled: true, notificationsEnabled: true, nextDueAt: '2099-08-20T09:00:00.000Z' }], [action], true);
    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({ content: expect.objectContaining({ body: 'Clean filter' }) }));
  });

  it('moves a reminder into the configured weekday window', async () => {
    mockGetPermissionsAsync.mockResolvedValue(granted);
    const base = new Date(2099, 7, 20, 9, 0, 0, 0);
    const schedule = defaultNotificationSchedule();
    schedule[base.getDay() as keyof typeof schedule] = { enabled: true, startTime: '18:00', endTime: '19:00' };
    await rescheduleNotifications([{ actionId: 'dishwasher-filter-clean', enabled: true, notificationsEnabled: true, nextDueAt: base.toISOString() }], [action], true, 'en', schedule);
    const call = mockScheduleNotificationAsync.mock.calls[0]?.[0] as { trigger: { date: Date } };
    expect(call.trigger.date.getHours()).toBe(18);
    expect(call.trigger.date.getMinutes()).toBe(0);
  });

  it('coalesces overlapping reconciliations so only the latest state is scheduled', async () => {
    mockGetPermissionsAsync.mockResolvedValue(granted);
    const staleAction = { id: 'dishwasher-filter-clean', trigger: { kind: 'recurring' }, content: { en: { title: 'Stale title' } } } as never;
    const latestAction = { id: 'dishwasher-filter-clean', trigger: { kind: 'recurring' }, content: { en: { title: 'Latest title' } } } as never;
    const first = rescheduleNotifications([{ actionId: 'dishwasher-filter-clean', enabled: true, notificationsEnabled: true, nextDueAt: '2099-08-20T09:00:00.000Z' }], [staleAction], true);
    const latest = rescheduleNotifications([{ actionId: 'dishwasher-filter-clean', enabled: true, notificationsEnabled: true, nextDueAt: '2099-08-20T09:00:00.000Z' }], [latestAction], true);

    await Promise.all([first, latest]);

    expect(NativeNotifications.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({ content: expect.objectContaining({ body: 'Latest title' }) }));
  });

  it('requests permission only when it is not already granted', async () => {
    mockGetPermissionsAsync.mockResolvedValue(denied); mockRequestPermissionsAsync.mockResolvedValue(granted);
    await expect(requestNotificationPermission()).resolves.toBe(true);
    expect(mockRequestPermissionsAsync).toHaveBeenCalled();
  });

  it('passes a tapped notification action ID to the app router', () => {
    let listener: ((response: NativeNotifications.NotificationResponse) => void) | undefined;
    mockAddNotificationResponseReceivedListener.mockImplementation((callback) => { listener = callback; return { remove: jest.fn() }; });
    const onActionId = jest.fn();
    subscribeToNotificationResponses(onActionId);
    listener?.({ notification: { request: { content: { data: { actionId: 'dishwasher-filter-clean' } } } } } as never);
    expect(onActionId).toHaveBeenCalledWith('dishwasher-filter-clean');
  });
});
