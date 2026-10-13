import { nextDueAfterCompletion } from './date';
import type { ActionConfiguration, MaintenanceAction, Season, TaskOutcome } from './types';

export const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter'];
export function seasonFor(date: Date): Season {
  const month = date.getMonth() + 1;
  return month >= 3 && month <= 5 ? 'spring' : month >= 6 && month <= 8 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter';
}
export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function dateFromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 9);
}
export function usesSeasonalSchedule(action: MaintenanceAction, configuration?: ActionConfiguration) {
  return action.trigger.kind === 'seasonal' && Boolean(action.trigger.seasonalDates?.length) && !configuration?.frequencyOverride;
}
export function seasonalOccurrences(action: MaintenanceAction, from: Date, through: Date) {
  const dates: Date[] = [];
  for (let year = from.getFullYear() - 1; year <= through.getFullYear() + 1; year += 1) {
    for (const slot of action.trigger.seasonalDates ?? []) {
      const date = new Date(year, slot.month - 1, slot.day, 9);
      if (date >= from && date <= through) dates.push(date);
    }
  }
  return dates.sort((a, b) => a.getTime() - b.getTime());
}
export function nextSeasonalDate(action: MaintenanceAction, after: Date) {
  const end = new Date(after); end.setFullYear(end.getFullYear() + 2);
  return seasonalOccurrences(action, after, end).find((date) => date > after)!;
}
export function initialSeasonalDate(action: MaintenanceAction, now: Date) {
  // Meteorological seasons start in March, June, September and December.
  const start = new Date(now.getFullYear(), now.getMonth() - ((now.getMonth() + 10) % 3), 1);
  const due = seasonalOccurrences(action, start, now);
  return due.at(-1) ?? nextSeasonalDate(action, now);
}
export function reconcileSeasonalConfiguration(action: MaintenanceAction, config: ActionConfiguration, outcomes: TaskOutcome[], now: Date): ActionConfiguration {
  if (!usesSeasonalSchedule(action, config)) return config;
  let due: Date;
  if (config.seasonalScheduleVersion === 1 && config.seasonalDueDate) {
    due = dateFromKey(config.seasonalDueDate);
  } else {
    due = initialSeasonalDate(action, now);
    const latestDone = outcomes.filter((item) => item.actionId === action.id && item.type === 'done').reduce<Date | undefined>((latest, item) => {
      const date = new Date(item.occurredAt);
      return !latest || date > latest ? date : latest;
    }, undefined);
    if (latestDone && latestDone >= due) due = nextSeasonalDate(action, latestDone);
  }
  const next = { ...config, seasonalScheduleVersion: 1 as const, seasonalDueDate: localDateKey(due), nextDueAt: due.toISOString() };
  return config.seasonalScheduleVersion === next.seasonalScheduleVersion && config.seasonalDueDate === next.seasonalDueDate && config.nextDueAt === next.nextDueAt ? config : next;
}
export function configurationAfterCompletion(action: MaintenanceAction, config: ActionConfiguration, now: Date): ActionConfiguration {
  if (!usesSeasonalSchedule(action, config)) return { ...config, snoozedUntil: undefined, nextDueAt: nextDueAfterCompletion(now, config.frequencyOverride ?? action.trigger.defaultFrequency) };
  // An early completion satisfies the displayed occurrence; a late one catches up
  // all elapsed occurrences, without shifting the next calendar date.
  const currentDue = config.seasonalDueDate ? dateFromKey(config.seasonalDueDate) : new Date(config.nextDueAt ?? now);
  const due = nextSeasonalDate(action, currentDue > now ? currentDue : now);
  return { ...config, seasonalScheduleVersion: 1, seasonalDueDate: localDateKey(due), nextDueAt: due.toISOString(), snoozedUntil: undefined };
}
export function seasonalScheduleLabel(action: MaintenanceAction, language: 'en' | 'da') {
  return (action.trigger.seasonalDates ?? []).map(({ month, day }) => new Intl.DateTimeFormat(language === 'da' ? 'da-DK' : 'en-GB', { day: 'numeric', month: 'short' }).format(new Date(2025, month - 1, day))).join(language === 'da' ? ' og ' : ' and ');
}
