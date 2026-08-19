import * as Calendar from 'expo-calendar/legacy';

export interface WritableCalendar {
  id: string;
  title: string;
}

export interface CalendarEventDraft {
  title: string;
  startAt: string;
  estimatedMinutes: number;
  notes: string;
}

export class CalendarAccessError extends Error {
  constructor(public readonly code: 'permission-denied' | 'unavailable') {
    super(code === 'permission-denied' ? 'Calendar permission was not granted.' : 'Calendar is not available on this device.');
  }
}

export async function getWritableCalendars(): Promise<WritableCalendar[]> {
  if (!(await Calendar.isAvailableAsync())) throw new CalendarAccessError('unavailable');
  let permission = await Calendar.getCalendarPermissionsAsync();
  if (!permission.granted) permission = await Calendar.requestCalendarPermissionsAsync();
  if (!permission.granted) throw new CalendarAccessError('permission-denied');

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return calendars
    .filter((calendar) => calendar.allowsModifications)
    .map((calendar) => ({ id: calendar.id, title: calendar.title }));
}

export async function addCalendarEvent(calendarId: string, draft: CalendarEventDraft) {
  const startDate = new Date(draft.startAt);
  if (!calendarId || Number.isNaN(startDate.getTime()) || !Number.isFinite(draft.estimatedMinutes) || draft.estimatedMinutes <= 0) throw new Error('Calendar event details are invalid.');
  const endDate = new Date(startDate.getTime() + draft.estimatedMinutes * 60_000);
  return Calendar.createEventAsync(calendarId, { title: draft.title, startDate, endDate, notes: draft.notes, allDay: false, alarms: [] });
}
