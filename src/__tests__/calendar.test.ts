/* eslint-disable import/first */

jest.mock('expo-intent-launcher', () => ({ startActivityAsync: jest.fn() }));

import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import { CalendarComposerError, calendarEventTimes, openCalendarEventEditor } from '../calendar';

describe('calendar event composer', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    jest.clearAllMocks();
  });

  it('uses the scheduled date and current duration as editable defaults', () => {
    expect(calendarEventTimes({ title: 'House Care: Clean filter', startAt: '2026-08-20T14:30:00.000Z', estimatedMinutes: 15, notes: 'Safe context' })).toEqual({
      startAtMilliseconds: new Date('2026-08-20T14:30:00.000Z').getTime(),
      endAtMilliseconds: new Date('2026-08-20T14:45:00.000Z').getTime(),
    });
  });

  it('opens Android’s editable calendar intent without writing an event itself', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    jest.mocked(IntentLauncher.startActivityAsync).mockResolvedValue({ resultCode: 0 } as never);

    await openCalendarEventEditor({ title: 'House Care: Clean filter', startAt: '2026-08-20T14:30:00.000Z', estimatedMinutes: 15, notes: 'Safe context' });

    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith('android.intent.action.INSERT', {
      data: 'content://com.android.calendar/events',
      type: 'vnd.android.cursor.dir/event',
      extra: expect.objectContaining({
        title: 'House Care: Clean filter', description: 'Safe context',
        beginTime: new Date('2026-08-20T14:30:00.000Z').getTime(), endTime: new Date('2026-08-20T14:45:00.000Z').getTime(), allDay: false,
      }),
    });
  });

  it('rejects invalid draft values before launching a calendar app', async () => {
    await expect(openCalendarEventEditor({ title: '', startAt: 'not-a-date', estimatedMinutes: 0, notes: '' })).rejects.toEqual(expect.objectContaining<Partial<CalendarComposerError>>({ code: 'invalid-draft' }));
    expect(IntentLauncher.startActivityAsync).not.toHaveBeenCalled();
  });
});
