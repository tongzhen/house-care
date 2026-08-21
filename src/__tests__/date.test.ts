import { getAction } from '../catalog';
import { actionNeedsAttention, nextDueAfterCompletion, nextDueDate } from '../date';

describe('nextDueDate', () => {
  it('uses the final valid day for monthly schedules', () => {
    expect(nextDueDate(new Date('2026-01-31T09:00:00Z'), { interval: 1, unit: 'month' }).toISOString()).toContain('2026-02-28');
  });

  it('supports weekly schedules', () => {
    expect(nextDueDate(new Date('2026-08-17T09:00:00Z'), { interval: 1, unit: 'week' }).toISOString()).toContain('2026-08-24');
  });

  it('bases the next due date on completion time', () => {
    const nextDue = new Date(nextDueAfterCompletion(new Date('2026-08-18T15:00:00Z'), { interval: 1, unit: 'month' })!);
    expect(nextDue.getDate()).toBe(18);
    expect(nextDue.getHours()).toBe(9);
    expect(nextDueAfterCompletion(new Date('2026-08-18T15:00:00Z'))).toBeUndefined();
  });

  it('counts only scheduled due actions as needing attention', () => {
    const scheduled = getAction('dishwasher-filter-clean')!;
    const habit = getAction('dryer-lint-filter')!;
    expect(actionNeedsAttention(scheduled, { actionId: scheduled.id, enabled: true, notificationsEnabled: true, nextDueAt: '2026-08-18T09:00:00.000Z' }, new Date('2026-08-18T10:00:00Z').getTime())).toBe(true);
    expect(actionNeedsAttention(habit, { actionId: habit.id, enabled: true, notificationsEnabled: false }, new Date('2026-08-18T10:00:00Z').getTime())).toBe(false);
  });
});
