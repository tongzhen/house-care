import { defaultNotificationSchedule, timeToMinutes, validateNotificationDayPreference, weekdays } from '../notificationSchedule';

describe('notification schedule rules', () => {
  it('defaults every weekday to enabled all-day timing', () => {
    const schedule = defaultNotificationSchedule();
    expect(Object.values(schedule)).toHaveLength(7);
    expect(Object.values(schedule).every((day) => day.enabled && day.startTime === '00:00' && day.endTime === '24:00')).toBe(true);
  });

  it('orders notification timing Monday through Sunday', () => {
    expect(weekdays).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it('accepts 24:00 as the end of a full-day window', () => {
    expect(timeToMinutes('24:00')).toBe(1440);
    expect(validateNotificationDayPreference({ enabled: true, startTime: '00:00', endTime: '24:00' })).toEqual({ enabled: true, startTime: '00:00', endTime: '24:00' });
  });

  it('rejects an end time before or equal to the start time', () => {
    expect(() => validateNotificationDayPreference({ enabled: true, startTime: '10:00', endTime: '10:00' })).toThrow();
    expect(() => validateNotificationDayPreference({ enabled: true, startTime: '18:00', endTime: '08:00' })).toThrow();
  });
});
