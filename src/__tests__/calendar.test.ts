/* eslint-disable import/first */

jest.mock('expo-calendar', () => ({
  EntityTypes: { EVENT: 'event' },
  isAvailableAsync: jest.fn(),
  getCalendarPermissionsAsync: jest.fn(),
  requestCalendarPermissionsAsync: jest.fn(),
  getCalendarsAsync: jest.fn(),
  createEventAsync: jest.fn(),
}));

import * as Calendar from 'expo-calendar';
import { addCalendarEvent, CalendarAccessError, getWritableCalendars } from '../calendar';

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(Calendar.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(Calendar.getCalendarPermissionsAsync).mockResolvedValue({ granted: true } as never);
  jest.mocked(Calendar.getCalendarsAsync).mockResolvedValue([] as never);
  jest.mocked(Calendar.createEventAsync).mockResolvedValue('event-1');
});

describe('personal calendar integration', () => {
  it('requests permission and returns writable event calendars only', async () => {
    jest.mocked(Calendar.getCalendarPermissionsAsync).mockResolvedValue({ granted: false } as never);
    jest.mocked(Calendar.requestCalendarPermissionsAsync).mockResolvedValue({ granted: true } as never);
    jest.mocked(Calendar.getCalendarsAsync).mockResolvedValue([
      { id: 'work', title: 'Work', allowsModifications: true },
      { id: 'read-only', title: 'Read only', allowsModifications: false },
    ] as never);

    await expect(getWritableCalendars()).resolves.toEqual([{ id: 'work', title: 'Work' }]);
    expect(Calendar.getCalendarsAsync).toHaveBeenCalledWith('event');
  });

  it('reports denied calendar access without creating an event', async () => {
    jest.mocked(Calendar.getCalendarPermissionsAsync).mockResolvedValue({ granted: false } as never);
    jest.mocked(Calendar.requestCalendarPermissionsAsync).mockResolvedValue({ granted: false } as never);

    await expect(getWritableCalendars()).rejects.toEqual(expect.objectContaining<Partial<CalendarAccessError>>({ code: 'permission-denied' }));
    expect(Calendar.createEventAsync).not.toHaveBeenCalled();
  });

  it('creates a timed snapshot event using the supplied snooze or due time', async () => {
    await addCalendarEvent('personal', { title: 'House Care: Clean filter', startAt: '2026-08-20T14:30:00.000Z', estimatedMinutes: 15, notes: 'Safe context' });

    expect(Calendar.createEventAsync).toHaveBeenCalledWith('personal', expect.objectContaining({
      title: 'House Care: Clean filter', notes: 'Safe context', allDay: false, alarms: [],
      startDate: new Date('2026-08-20T14:30:00.000Z'), endDate: new Date('2026-08-20T14:45:00.000Z'),
    }));
  });
});
