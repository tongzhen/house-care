import * as Notifications from 'expo-notifications';
import { loadConfigurations, saveReminderLedger } from './db';
import { timeToMinutes } from './notificationSchedule';
import { localDateKey, seasonalOccurrences, usesSeasonalSchedule } from './seasonalScheduling';
import type { ActionConfiguration, MaintenanceAction, NotificationSchedule, ReminderAttempt } from './types';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });

export async function requestNotificationPermission() {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}
export async function notificationPermissionGranted() { return (await Notifications.getPermissionsAsync()).granted; }

let notificationOperation = Promise.resolve();
let notificationGeneration = 0;
function enqueueNotificationOperation<T>(operation: () => Promise<T>) {
  const result = notificationOperation.catch(() => undefined).then(operation);
  notificationOperation = result.then(() => undefined, () => undefined);
  return result;
}

export async function cancelScheduledNotifications() {
  notificationGeneration += 1;
  await enqueueNotificationOperation(async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const now = new Date();
    for (const config of await loadConfigurations()) {
      await saveReminderLedger(config.actionId, (config.reminderLedger ?? []).filter((entry) => new Date(entry.scheduledAt) <= now));
    }
  });
}

export function scheduledDate(base: Date, schedule?: NotificationSchedule, preserveTime = false, after?: Date) {
  if (Number.isNaN(base.getTime())) return null;
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(base);
    candidate.setDate(base.getDate() + offset);
    const preference = schedule?.[candidate.getDay() as keyof NotificationSchedule];
    if (schedule && !preference?.enabled) continue;
    const start = preference ? timeToMinutes(preference.startTime)! : 0;
    const end = preference ? timeToMinutes(preference.endTime)! : 1440;
    const normal = preserveTime ? base.getHours() * 60 + base.getMinutes() : 9 * 60;
    let minutes = normal >= start && normal < end ? normal : start;
    if (after && candidate.toDateString() === after.toDateString()) minutes = Math.max(minutes, after.getHours() * 60 + after.getMinutes() + 1);
    if (minutes >= end) continue;
    candidate.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    if (!after || candidate > after) return candidate;
  }
  return null;
}

interface ReminderPlan {
  identifier: string;
  date: Date;
  body: string;
  data: { actionId?: string; destination?: 'seasonal'; reminderKeys?: string[]; scheduledAt: string };
  attempts: { actionId: string; key: string }[];
}

export function buildReminderPlans(configurations: ActionConfiguration[], actions: MaintenanceAction[], language: 'en' | 'da', schedule: NotificationSchedule | undefined, now: Date, ledgers: Map<string, ReminderAttempt[]>) {
  const plans: ReminderPlan[] = [];
  const groups = new Map<string, ReminderPlan>();
  const through = new Date(now); through.setFullYear(through.getFullYear() + 1);
  for (const config of configurations) {
    if (!config.enabled || !config.notificationsEnabled || !config.nextDueAt) continue;
    const action = actions.find((item) => item.id === config.actionId);
    if (!action || action.trigger.kind === 'habit') continue;
    if (!usesSeasonalSchedule(action, config)) {
      const date = scheduledDate(new Date(config.snoozedUntil ?? config.nextDueAt), schedule, Boolean(config.snoozedUntil));
      if (!date || date <= now) continue;
      const copy = language === 'da' && action.content.da ? action.content.da : action.content.en;
      plans.push({ identifier: `hc-action-${action.id}`, date, body: copy.title, data: { actionId: action.id, scheduledAt: date.toISOString() }, attempts: [] });
      continue;
    }
    const outstanding = new Date(config.nextDueAt);
    const dates = [outstanding, ...seasonalOccurrences(action, now, through)].filter((date, index, all) => date <= through && all.findIndex((other) => localDateKey(other) === localDateKey(date)) === index);
    for (const occurrence of dates) {
      const snooze = config.snoozedUntil ? new Date(config.snoozedUntil) : undefined;
      // A snooze postpones all checks for this action until the chosen time.
      if (snooze && occurrence > outstanding && occurrence <= snooze) continue;
      const isOutstanding = localDateKey(occurrence) === localDateKey(outstanding);
      const key = `${localDateKey(occurrence)}${isOutstanding && snooze ? `:snooze:${config.snoozedUntil}` : ''}`;
      const previous = ledgers.get(action.id)?.find((entry) => entry.key === key);
      if (previous && new Date(previous.scheduledAt) <= now) continue;
      const base = isOutstanding && snooze ? snooze : occurrence;
      const date = scheduledDate(base > now ? base : now, schedule, Boolean(isOutstanding && snooze), now);
      if (!date) continue;
      const scheduledAt = date.toISOString();
      let group = groups.get(scheduledAt);
      if (!group) {
        group = { identifier: `hc-seasonal-${scheduledAt}`, date, body: language === 'da' ? 'Dine sæsonopgaver er klar. Åbn din tjekliste.' : 'Your seasonal home checks are ready. Open your checklist.', data: { destination: 'seasonal', reminderKeys: [], scheduledAt }, attempts: [] };
        groups.set(scheduledAt, group);
      }
      group.attempts.push({ actionId: action.id, key });
      group.data.reminderKeys!.push(`${action.id}:${key}`);
    }
  }
  return [...plans, ...groups.values()].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 60);
}

export async function rescheduleNotifications(configurations: ActionConfiguration[], actions: MaintenanceAction[], enabled: boolean, language: 'en' | 'da' = 'en', schedule?: NotificationSchedule) {
  const generation = ++notificationGeneration;
  await enqueueNotificationOperation(async () => {
    if (generation !== notificationGeneration) return;
    const now = new Date();
    // Read the ledger fresh: task state held by the UI may predate reconciliation.
    const persisted = new Map((await loadConfigurations()).map((config) => [config.actionId, config.reminderLedger ?? []]));
    const ledgers = new Map(configurations.map((config) => [config.actionId, persisted.get(config.actionId) ?? config.reminderLedger ?? []]));
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    const granted = enabled && (await Notifications.getPermissionsAsync()).granted;
    const plans = granted ? buildReminderPlans(configurations, actions, language, schedule, now, ledgers) : [];
    const wanted = new Map(plans.map((plan) => [plan.identifier, plan]));
    const retained = new Set<string>();
    for (const notification of pending) {
      if (generation !== notificationGeneration) return;
      const data = notification.content.data;
      const owned = notification.identifier.startsWith('hc-') || typeof data?.actionId === 'string' || data?.destination === 'seasonal';
      if (!owned) continue;
      const plan = wanted.get(notification.identifier);
      if (plan && notification.content.body === plan.body && data?.scheduledAt === plan.data.scheduledAt && JSON.stringify(data?.reminderKeys) === JSON.stringify(plan.data.reminderKeys)) retained.add(plan.identifier);
      else await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
    // Preserve passed attempts; future attempts are rebuilt from successful plans.
    const nextLedgers = new Map(configurations.map((config) => [config.actionId, (ledgers.get(config.actionId) ?? []).filter((entry) => new Date(entry.scheduledAt) <= now)]));
    let schedulingFailure: unknown;
    try {
      for (const plan of plans) {
        if (generation !== notificationGeneration) return;
        if (!retained.has(plan.identifier)) {
          await Notifications.scheduleNotificationAsync({ identifier: plan.identifier, content: { title: 'House Care', body: plan.body, data: plan.data }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: plan.date } });
        }
        for (const attempt of plan.attempts) nextLedgers.get(attempt.actionId)!.push({ key: attempt.key, scheduledAt: plan.date.toISOString() });
      }
    } catch (error) {
      schedulingFailure = error;
    }
    for (const config of configurations) {
      if (generation !== notificationGeneration) return;
      if (usesSeasonalSchedule(actions.find((action) => action.id === config.actionId) ?? { trigger: { kind: 'habit' } } as MaintenanceAction, config) || config.reminderLedger?.length || persisted.get(config.actionId)?.length) {
        await saveReminderLedger(config.actionId, nextLedgers.get(config.actionId)!);
      }
    }
    if (schedulingFailure) throw schedulingFailure;
  });
}

export async function sendTestNotification(delaySeconds = 5) {
  await Notifications.scheduleNotificationAsync({ content: { title: 'House Care test', body: 'Notifications are working on this device.' }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(Date.now() + delaySeconds * 1000) } });
}
export async function scheduledNotificationCount() { return (await Notifications.getAllScheduledNotificationsAsync()).length; }

export function subscribeToNotificationResponses(onActionId: (actionId: string) => void, onSeasonal?: () => void) {
  const respond = (response: Notifications.NotificationResponse | null) => {
    const data = response?.notification.request.content.data;
    if (data?.destination === 'seasonal') { onSeasonal?.(); return; }
    if (typeof data?.actionId === 'string') onActionId(data.actionId);
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(respond);
  void Notifications.getLastNotificationResponseAsync().then(respond).catch(() => undefined);
  return () => subscription.remove();
}
