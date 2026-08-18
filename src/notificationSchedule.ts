import type { NotificationDayPreference, NotificationSchedule, Weekday } from './types';

export const weekdays: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export function defaultNotificationSchedule(): NotificationSchedule {
  return Object.fromEntries(weekdays.map((weekday) => [weekday, { enabled: true, startTime: '00:00', endTime: '24:00' }])) as NotificationSchedule;
}

export function timeToMinutes(value: string) {
  if (value === '24:00') return 1440;
  const match = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(value);
  if (!match) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function validateNotificationDayPreference(preference: NotificationDayPreference) {
  const start = timeToMinutes(preference.startTime);
  const end = timeToMinutes(preference.endTime);
  if (start === null || end === null || end <= start) throw new Error('Notification end time must be after the start time.');
  return preference;
}

export function validateNotificationSchedule(schedule: NotificationSchedule) {
  for (const weekday of weekdays) validateNotificationDayPreference(schedule[weekday]);
  return schedule;
}
