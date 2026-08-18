import * as Notifications from 'expo-notifications';
import { timeToMinutes } from './notificationSchedule';
import type { ActionConfiguration, MaintenanceAction, NotificationSchedule } from './types';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });

export async function requestNotificationPermission() {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}

export async function notificationPermissionGranted() {
  return (await Notifications.getPermissionsAsync()).granted;
}

export async function cancelScheduledNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

function scheduledDate(base: Date, schedule?: NotificationSchedule, preserveTime = false) {
  const date = new Date(base);
  if (!schedule) { date.setHours(9, 0, 0, 0); return date; }
  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = new Date(date);
    candidate.setDate(date.getDate() + offset);
    const preference = schedule[candidate.getDay() as keyof NotificationSchedule];
    if (!preference.enabled) continue;
    const start = timeToMinutes(preference.startTime)!;
    const end = timeToMinutes(preference.endTime)!;
    const normal = preserveTime ? date.getHours() * 60 + date.getMinutes() : 9 * 60;
    const minutes = normal >= start && normal < end ? normal : start;
    candidate.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return candidate;
  }
  return null;
}

export async function rescheduleNotifications(configurations: ActionConfiguration[], actions: MaintenanceAction[], enabled: boolean, language: 'en' | 'da' = 'en', schedule?: NotificationSchedule) {
  await cancelScheduledNotifications();
  if (!enabled) return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;
  await Promise.all(configurations.filter((config) => config.enabled && config.notificationsEnabled && config.nextDueAt).map(async (config) => {
    const action = actions.find((candidate) => candidate.id === config.actionId);
    const date = config.snoozedUntil ?? config.nextDueAt;
    if (!action || !date || action.trigger.kind === 'habit') return;
    const trigger = scheduledDate(new Date(date), schedule, Boolean(config.snoozedUntil));
    if (!trigger) return;
    if (trigger <= new Date()) return;
    const copy = language === 'da' && action.content.da ? action.content.da : action.content.en;
    await Notifications.scheduleNotificationAsync({ content: { title: 'House Care', body: copy.title, data: { actionId: action.id } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger } });
  }));
}

export async function sendTestNotification(delaySeconds = 5) {
  await Notifications.scheduleNotificationAsync({ content: { title: 'House Care test', body: 'Notifications are working on this device.' }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(Date.now() + delaySeconds * 1000) } });
}

export async function scheduledNotificationCount() {
  return (await Notifications.getAllScheduledNotificationsAsync()).length;
}

export function subscribeToNotificationResponses(onActionId: (actionId: string) => void) {
  const respond = (response: Notifications.NotificationResponse | null) => {
    const actionId = response?.notification.request.content.data?.actionId;
    if (typeof actionId === 'string') onActionId(actionId);
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(respond);
  void Notifications.getLastNotificationResponseAsync().then(respond);
  return () => subscription.remove();
}
