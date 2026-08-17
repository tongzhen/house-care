import { nextDueDate } from '../date';

describe('nextDueDate', () => {
  it('uses the final valid day for monthly schedules', () => {
    expect(nextDueDate(new Date('2026-01-31T09:00:00Z'), { interval: 1, unit: 'month' }).toISOString()).toContain('2026-02-28');
  });

  it('supports weekly schedules', () => {
    expect(nextDueDate(new Date('2026-08-17T09:00:00Z'), { interval: 1, unit: 'week' }).toISOString()).toContain('2026-08-24');
  });
});
