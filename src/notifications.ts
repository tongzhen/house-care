import * as Notifications from 'expo-notifications';
import type { ActionConfiguration, MaintenanceAction } from './types';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });

export async function requestNotificationPermission() {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}

export async function cancelScheduledNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function rescheduleNotifications(configurations: ActionConfiguration[], actions: MaintenanceAction[], enabled: boolean, language: 'en' | 'da' = 'en') {
  await cancelScheduledNotifications();
  if (!enabled) return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;
  await Promise.all(configurations.filter((config) => config.enabled && config.notificationsEnabled && config.nextDueAt).map(async (config) => {
    const action = actions.find((candidate) => candidate.id === config.actionId);
    const date = config.snoozedUntil ?? config.nextDueAt;
    if (!action || !date || action.trigger.kind === 'habit') return;
    const trigger = new Date(date);
    trigger.setHours(9, 0, 0, 0);
    if (trigger <= new Date()) return;
    const copy = language === 'da' && action.content.da ? action.content.da : action.content.en;
    await Notifications.scheduleNotificationAsync({ content: { title: 'House Care', body: copy.title, data: { actionId: action.id } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger } });
  }));
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
