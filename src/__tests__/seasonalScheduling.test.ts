import { getAction } from '../catalog';
import { actionNeedsAttention } from '../date';
import { configurationAfterCompletion, initialSeasonalDate, localDateKey, nextSeasonalDate, reconcileSeasonalConfiguration, seasonFor, seasonalOccurrences } from '../seasonalScheduling';
import type { ActionConfiguration, TaskOutcome } from '../types';

const gutters = getAction('gutters-ground-check')!;
const tap = getAction('outdoor-tap-winter-check')!;
const config: ActionConfiguration = { actionId: gutters.id, enabled: true, notificationsEnabled: true };
const done = (at: Date): TaskOutcome => ({ id: 'done', actionId: gutters.id, type: 'done', occurredAt: at.toISOString() });

describe('seasonal calendar', () => {
  it.each([[1, 'winter'], [2, 'winter'], [3, 'spring'], [5, 'spring'], [6, 'summer'], [8, 'summer'], [9, 'autumn'], [11, 'autumn'], [12, 'winter']])('labels month %s as %s', (month, season) => {
    expect(seasonFor(new Date(2026, Number(month) - 1, 15))).toBe(season);
  });
  it('starts mid-season at the latest due occurrence, without an older backlog', () => {
    expect(localDateKey(initialSeasonalDate(gutters, new Date(2026, 9, 13)))).toBe('2026-09-01');
    expect(localDateKey(initialSeasonalDate(gutters, new Date(2026, 6, 13)))).toBe('2026-09-01');
    expect(localDateKey(initialSeasonalDate(tap, new Date(2026, 8, 15)))).toBe('2026-10-01');
    expect(localDateKey(initialSeasonalDate(tap, new Date(2027, 0, 15)))).toBe('2027-10-01');
  });
  it('includes the same-day occurrence and schedules the next one after completion', () => {
    const now = new Date(2026, 8, 1, 10);
    const initial = reconcileSeasonalConfiguration(gutters, config, [], now);
    expect(initial.seasonalDueDate).toBe('2026-09-01');
    expect(configurationAfterCompletion(gutters, initial, now).seasonalDueDate).toBe('2027-03-01');
  });
  it('keeps an unfinished spring task overdue into winter', () => {
    const spring = reconcileSeasonalConfiguration(gutters, config, [], new Date(2026, 3, 1));
    const winter = reconcileSeasonalConfiguration(gutters, spring, [], new Date(2026, 11, 10));
    expect(winter).toBe(spring);
    expect(actionNeedsAttention(gutters, winter, new Date(2026, 11, 10).getTime())).toBe(true);
    expect(configurationAfterCompletion(gutters, winter, new Date(2026, 11, 10)).seasonalDueDate).toBe('2027-03-01');
  });
  it('uses fixed calendar dates after late and early completion', () => {
    const initial = reconcileSeasonalConfiguration(gutters, config, [], new Date(2026, 3, 15));
    expect(configurationAfterCompletion(gutters, initial, new Date(2026, 9, 20)).seasonalDueDate).toBe('2027-03-01');
    const upcoming = reconcileSeasonalConfiguration(gutters, config, [], new Date(2026, 7, 20));
    expect(configurationAfterCompletion(gutters, upcoming, new Date(2026, 7, 20)).seasonalDueDate).toBe('2027-03-01');
  });
  it('migrates legacy dates without reopening completed autumn checks', () => {
    const legacy = { ...config, enabled: false, notificationsEnabled: false, nextDueAt: '2026-10-20T09:00:00.000Z', snoozedUntil: '2026-11-20T09:00:00.000Z' };
    const migrated = reconcileSeasonalConfiguration(gutters, legacy, [done(new Date(2026, 8, 20))], new Date(2026, 9, 13));
    expect(migrated).toMatchObject({ enabled: false, notificationsEnabled: false, seasonalDueDate: '2027-03-01', snoozedUntil: legacy.snoozedUntil });
  });
  it('preserves custom intervals and uses their completion-based schedule', () => {
    const custom = { ...config, frequencyOverride: { interval: 1, unit: 'month' as const } };
    expect(reconcileSeasonalConfiguration(gutters, custom, [], new Date(2026, 9, 13))).toBe(custom);
    expect(localDateKey(new Date(configurationAfterCompletion(gutters, custom, new Date(2026, 9, 13)).nextDueAt!))).toBe('2026-11-13');
  });
  it('reconstructs the outstanding local date after a timezone change without losing snooze', () => {
    const original = { ...config, seasonalScheduleVersion: 1 as const, seasonalDueDate: '2026-09-01', nextDueAt: '2026-09-01T04:00:00.000Z', snoozedUntil: '2026-10-20T12:00:00.000Z' };
    const updated = reconcileSeasonalConfiguration(gutters, original, [], new Date(2026, 9, 13));
    expect(new Date(updated.nextDueAt!).getHours()).toBe(9);
    expect(updated.seasonalDueDate).toBe('2026-09-01');
    expect(updated.snoozedUntil).toBe(original.snoozedUntil);
  });
  it('handles the year rollover and leap years', () => {
    expect(localDateKey(nextSeasonalDate(gutters, new Date(2027, 11, 31)))).toBe('2028-03-01');
    expect(seasonalOccurrences(gutters, new Date(2028, 0, 1), new Date(2028, 11, 31)).map(localDateKey)).toEqual(['2028-03-01', '2028-09-01']);
  });
});
