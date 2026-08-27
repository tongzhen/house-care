import * as IntentLauncher from 'expo-intent-launcher';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export interface CalendarEventDraft {
  title: string;
  startAt: string;
  estimatedMinutes: number;
  notes: string;
}

interface CalendarEventComposerModule {
  presentAsync(title: string, startAtMilliseconds: number, endAtMilliseconds: number, notes: string): Promise<void>;
}

const nativeCalendarComposer = requireOptionalNativeModule<CalendarEventComposerModule>('CalendarEventComposer');

export class CalendarComposerError extends Error {
  constructor(public readonly code: 'invalid-draft' | 'unavailable') {
    super(code === 'invalid-draft' ? 'Calendar event details are invalid.' : 'Calendar event editing is not available on this device.');
  }
}

export function calendarEventTimes(draft: CalendarEventDraft) {
  const startAtMilliseconds = new Date(draft.startAt).getTime();
  if (!draft.title.trim() || Number.isNaN(startAtMilliseconds) || !Number.isFinite(draft.estimatedMinutes) || draft.estimatedMinutes <= 0) {
    throw new CalendarComposerError('invalid-draft');
  }
  return { startAtMilliseconds, endAtMilliseconds: startAtMilliseconds + draft.estimatedMinutes * 60_000 };
}

/** Opens a system-owned event editor. The user, not House Care, decides whether to save. */
export async function openCalendarEventEditor(draft: CalendarEventDraft): Promise<void> {
  const { startAtMilliseconds, endAtMilliseconds } = calendarEventTimes(draft);

  if (Platform.OS === 'android') {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.INSERT', {
        data: 'content://com.android.calendar/events',
        type: 'vnd.android.cursor.dir/event',
        extra: { title: draft.title, description: draft.notes, beginTime: startAtMilliseconds, endTime: endAtMilliseconds, allDay: false },
      });
      return;
    } catch {
      throw new CalendarComposerError('unavailable');
    }
  }

  if (Platform.OS === 'ios' && nativeCalendarComposer) {
    await nativeCalendarComposer.presentAsync(draft.title, startAtMilliseconds, endAtMilliseconds, draft.notes);
    return;
  }

  throw new CalendarComposerError('unavailable');
}
