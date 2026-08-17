/* eslint-disable import/first */

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(), scheduleNotificationAsync: jest.fn(), cancelAllScheduledNotificationsAsync: jest.fn(), getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn(), addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })), getLastNotificationResponseAsync: jest.fn(async () => null),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

import * as NativeNotifications from 'expo-notifications';
import { requestNotificationPermission, rescheduleNotifications, subscribeToNotificationResponses } from '../notifications';

const mockScheduleNotificationAsync = jest.mocked(NativeNotifications.scheduleNotificationAsync);
const mockCancelAllScheduledNotificationsAsync = jest.mocked(NativeNotifications.cancelAllScheduledNotificationsAsync);
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
    expect(mockCancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('schedules future recurring actions when permitted', async () => {
    mockGetPermissionsAsync.mockResolvedValue(granted);
    await rescheduleNotifications([{ actionId: 'dishwasher-filter-clean', enabled: true, notificationsEnabled: true, nextDueAt: '2099-08-20T09:00:00.000Z' }], [action], true);
    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({ content: expect.objectContaining({ body: 'Clean filter' }) }));
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
