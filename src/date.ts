import type { ActionConfiguration, Frequency, MaintenanceAction } from './types';

export function nextDueDate(from: Date, frequency: Frequency) {
  const next = new Date(from);
  if (frequency.unit === 'day') next.setDate(next.getDate() + frequency.interval);
  if (frequency.unit === 'week') next.setDate(next.getDate() + frequency.interval * 7);
  if (frequency.unit === 'year') next.setFullYear(next.getFullYear() + frequency.interval);
  if (frequency.unit === 'month') {
    const sourceDay = next.getDate(); next.setDate(1); next.setMonth(next.getMonth() + frequency.interval);
    next.setDate(Math.min(sourceDay, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
  }
  return next;
}

export function nextDueAfterCompletion(completedAt: Date, frequency?: Frequency) {
  return frequency ? atNineAM(nextDueDate(completedAt, frequency)).toISOString() : undefined;
}

export function actionNeedsAttention(action: MaintenanceAction, configuration: ActionConfiguration | undefined, now: number) {
  if (!configuration?.enabled || action.trigger.kind === 'habit') return false;
  const dueAt = configuration.snoozedUntil ?? configuration.nextDueAt;
  return Boolean(dueAt && new Date(dueAt).getTime() <= now);
}

export function atNineAM(date: Date) { const scheduled = new Date(date); scheduled.setHours(9, 0, 0, 0); return scheduled; }
export function formatDate(value?: string, locale = 'en') { return value ? new Intl.DateTimeFormat(locale === 'da' ? 'da-DK' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : ''; }
