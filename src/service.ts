import { actionApplies, actions, getAction } from './catalog';
import { clearData, importBackup, removeIssue, removeIssuePhoto } from './backup';
import { atNineAM, nextDueDate } from './date';
import * as repository from './db';
import { cancelScheduledNotifications, rescheduleNotifications } from './notifications';
import { validateNotificationSchedule } from './notificationSchedule';
import type { ActionConfiguration, AppSettings, Frequency, OutcomeType, Profile, TaskOutcome } from './types';

export interface AppState { profile: Profile | null; configurations: ActionConfiguration[]; outcomes: TaskOutcome[]; settings: AppSettings; }

const id = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export async function loadAppState(): Promise<AppState> {
  await repository.initialiseDatabase();
  const [profile, configurations, outcomes, settings] = await Promise.all([repository.loadProfile(), repository.loadConfigurations(), repository.loadOutcomes(), repository.getSettings()]);
  return { profile, configurations, outcomes, settings };
}

function initialConfiguration(actionId: string, position: number): ActionConfiguration {
  const action = getAction(actionId)!;
  if (action.trigger.kind === 'habit') return { actionId, enabled: true, notificationsEnabled: false };
  const due = new Date();
  due.setDate(due.getDate() + position * 3);
  return { actionId, enabled: true, notificationsEnabled: true, nextDueAt: atNineAM(due).toISOString() };
}

export async function saveHomeProfile(profile: Omit<Profile, 'id'>): Promise<AppState> {
  await repository.saveProfile(profile);
  const existing = await repository.loadConfigurations();
  const existingById = new Map(existing.map((config) => [config.actionId, config]));
  const applicable = actions.filter((action) => actionApplies(action, profile));
  const applicableIds = new Set(applicable.map((action) => action.id));
  await Promise.all(existing.filter((config) => !applicableIds.has(config.actionId)).map((config) => repository.deleteConfiguration(config.actionId)));
  const ordered = applicable.sort((a, b) => {
    if (a.id === 'dishwasher-filter-clean') return -1;
    if (b.id === 'dishwasher-filter-clean') return 1;
    return a.id.localeCompare(b.id);
  });
  for (const [position, action] of ordered.entries()) {
    await repository.upsertConfiguration(existingById.get(action.id) ?? initialConfiguration(action.id, position));
  }
  const state = await loadAppState();
  await rescheduleNotifications(state.configurations, actions, state.settings.notificationsEnabled, state.settings.language, state.settings.notificationSchedule);
  return state;
}

export async function recordOutcome(actionId: string, type: OutcomeType, options: { note?: string; photoUri?: string; snoozeDays?: number; snoozedUntil?: string } = {}) {
  const state = await loadAppState();
  const action = getAction(actionId);
  const current = state.configurations.find((config) => config.actionId === actionId);
  if (!action || !current) throw new Error('Action is not configured');
  const now = new Date();
  let snoozedUntil: string | undefined;
  if (type === 'snoozed') {
    const requested = options.snoozedUntil ? new Date(options.snoozedUntil) : new Date(now.getTime() + (options.snoozeDays ?? 1) * 86400000);
    if (Number.isNaN(requested.getTime()) || requested <= now) throw new Error('Snooze time must be in the future.');
    snoozedUntil = options.snoozedUntil ?? atNineAM(requested).toISOString();
  }
  const outcome: TaskOutcome = { id: id(), actionId, type, occurredAt: now.toISOString(), note: options.note, photoUri: options.photoUri };
  await repository.addOutcome(outcome);
  const frequency = current.frequencyOverride ?? action.trigger.defaultFrequency;
  const next: ActionConfiguration = { ...current, snoozedUntil: undefined };
  if (type === 'done' && frequency) next.nextDueAt = atNineAM(nextDueDate(now, frequency)).toISOString();
  if (type === 'snoozed') next.snoozedUntil = snoozedUntil;
  if (type === 'not_relevant') next.enabled = false;
  await repository.upsertConfiguration(next);
  const nextState = await loadAppState();
  await rescheduleNotifications(nextState.configurations, actions, nextState.settings.notificationsEnabled, nextState.settings.language, nextState.settings.notificationSchedule);
  return nextState;
}

export async function recordIssue(title: string, options: { actionId?: string; note?: string; photoUri?: string } = {}) {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) throw new Error('Issue title is required');
  await repository.addOutcome({ id: id(), actionId: options.actionId ?? 'general-issue', type: 'issue_reported', occurredAt: new Date().toISOString(), title: trimmedTitle, note: options.note?.trim() || undefined, photoUri: options.photoUri });
  return loadAppState();
}

export async function updateFrequency(actionId: string, frequency?: Frequency) {
  const state = await loadAppState();
  const action = getAction(actionId);
  const config = state.configurations.find((candidate) => candidate.actionId === actionId);
  if (!action || !config) throw new Error('Action is not configured');
  if (frequency) validateFrequency(frequency);
  const reference = new Date();
  const effectiveFrequency = frequency ?? action.trigger.defaultFrequency;
  const nextDueAt = effectiveFrequency ? atNineAM(nextDueDate(reference, effectiveFrequency)).toISOString() : config.nextDueAt;
  await repository.upsertConfiguration({ ...config, frequencyOverride: frequency, nextDueAt, snoozedUntil: undefined });
  const nextState = await loadAppState();
  await rescheduleNotifications(nextState.configurations, actions, nextState.settings.notificationsEnabled, nextState.settings.language, nextState.settings.notificationSchedule);
  return nextState;
}

export async function setActionEnabled(actionId: string, enabled: boolean) {
  const state = await loadAppState(); const config = state.configurations.find((candidate) => candidate.actionId === actionId);
  if (!config) throw new Error('Action is not configured');
  await repository.upsertConfiguration({ ...config, enabled, snoozedUntil: enabled ? undefined : config.snoozedUntil });
  const nextState = await loadAppState();
  await rescheduleNotifications(nextState.configurations, actions, nextState.settings.notificationsEnabled, nextState.settings.language, nextState.settings.notificationSchedule);
  return nextState;
}

export async function updateSettings(settings: AppSettings) {
  validateNotificationSchedule(settings.notificationSchedule);
  await repository.saveSettings(settings);
  const state = await loadAppState();
  await rescheduleNotifications(state.configurations, actions, settings.notificationsEnabled, settings.language, settings.notificationSchedule);
  return state;
}

export async function importLocalBackup() {
  if (!(await importBackup())) return null;
  const state = await loadAppState();
  await rescheduleNotifications(state.configurations, actions, state.settings.notificationsEnabled, state.settings.language, state.settings.notificationSchedule);
  return state;
}

export function validateFrequency(frequency: Frequency) {
  const limits: Record<Frequency['unit'], number> = { day: 365, week: 52, month: 24, year: 10 };
  if (!Number.isInteger(frequency.interval) || frequency.interval < 1 || frequency.interval > limits[frequency.unit]) throw new Error('Frequency interval is outside the allowed range.');
  return frequency;
}

export async function resetAppData() {
  await cancelScheduledNotifications();
  await clearData();
  return loadAppState();
}

export async function deleteIssuePhoto(outcome: TaskOutcome) {
  await removeIssuePhoto(outcome);
  return loadAppState();
}

export async function deleteIssueRecord(outcome: TaskOutcome) {
  await removeIssue(outcome);
  return loadAppState();
}
