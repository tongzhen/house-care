import { actionApplies, actions, getAction } from './catalog';
import { clearData, importBackup, removeIssue, removeIssuePhoto } from './backup';
import { atNineAM, nextDueDate } from './date';
import { configurationAfterCompletion, reconcileSeasonalConfiguration, usesSeasonalSchedule } from './seasonalScheduling';
import * as repository from './db';
import { deviceClock, expoNotificationScheduler, localIdGenerator, sqliteHomeRepository } from './deviceServices';
import { cancelScheduledNotifications, rescheduleNotifications } from './notifications';
import { validateNotificationSchedule } from './notificationSchedule';
import { finishIssuePhotoDraft, persistIssuePhoto, removePersistedIssuePhoto } from './media';
import type { Clock, HomeRepository, HomeRepositoryTransaction, IdGenerator, NotificationScheduler } from './ports';
import type { ActionConfiguration, AppSettings, Frequency, OutcomeType, Profile, TaskOutcome } from './types';

export interface AppState { profile: Profile | null; configurations: ActionConfiguration[]; outcomes: TaskOutcome[]; settings: AppSettings; }

const id = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const outcomeOperations = new Map<string, Promise<AppState>>();
const eventCheckOperations = new Map<string, Promise<AppState>>();

export interface RecordOutcomeDependencies {
  repository: HomeRepository;
  notificationScheduler: NotificationScheduler;
  clock: Clock;
  idGenerator: IdGenerator;
}

const recordOutcomeDependencies: RecordOutcomeDependencies = {
  repository: sqliteHomeRepository,
  notificationScheduler: expoNotificationScheduler,
  clock: deviceClock,
  idGenerator: localIdGenerator,
};

async function reconcileNotificationsAfterCommit(state: AppState) {
  await rescheduleNotifications(state.configurations, actions, state.settings.notificationsEnabled, state.settings.language, state.settings.notificationSchedule).catch(() => undefined);
  return state;
}

export async function loadAppStateFrom(source: HomeRepository, now = new Date()): Promise<AppState> {
  await source.initialiseDatabase();
  const [profile, configurations, outcomes, settings] = await Promise.all([source.loadProfile(), source.loadConfigurations(), source.loadOutcomes(), source.getSettings()]);
  const reconciled = configurations.map((config) => {
    const action = getAction(config.actionId);
    return action ? reconcileSeasonalConfiguration(action, config, outcomes, now) : config;
  });
  const changed = reconciled.filter((config, index) => config !== configurations[index]);
  if (changed.length) await source.transaction(async (transaction) => {
    for (const config of changed) await transaction.upsertConfiguration(config);
  });
  return { profile, configurations: reconciled, outcomes, settings };
}

export async function loadAppState(): Promise<AppState> {
  return loadAppStateFrom(sqliteHomeRepository);
}

function initialConfiguration(actionId: string, position: number): ActionConfiguration {
  const action = getAction(actionId)!;
  if (action.trigger.kind === 'habit') return { actionId, enabled: true, notificationsEnabled: false };
  const now = new Date();
  if (usesSeasonalSchedule(action)) return reconcileSeasonalConfiguration(action, { actionId, enabled: true, notificationsEnabled: true }, [], now);
  const due = new Date(now);
  due.setDate(due.getDate() + position * 3);
  return { actionId, enabled: true, notificationsEnabled: true, nextDueAt: atNineAM(due).toISOString() };
}

export async function saveHomeProfile(profile: Omit<Profile, 'id'>): Promise<AppState> {
  const previousProfile = await repository.loadProfile();
  const existing = await repository.loadConfigurations();
  const existingById = new Map(existing.map((config) => [config.actionId, config]));
  const applicable = actions.filter((action) => actionApplies(action, profile));
  const applicableIds = new Set(applicable.map((action) => action.id));
  const ordered = applicable.sort((a, b) => {
    if (a.id === 'dishwasher-filter-clean') return -1;
    if (b.id === 'dishwasher-filter-clean') return 1;
    return a.id.localeCompare(b.id);
  });
  await repository.transaction(async (transaction) => {
    await transaction.saveProfile(profile);
    await Promise.all(existing.filter((config) => !applicableIds.has(config.actionId)).map((config) => transaction.deleteConfiguration(config.actionId)));
    for (const [position, action] of ordered.entries()) {
      await transaction.upsertConfiguration(existingById.get(action.id) ?? initialConfiguration(action.id, position));
    }
  });
  if (previousProfile?.postalCode !== profile.postalCode) await repository.clearWeatherCache();
  const state = await loadAppState();
  return reconcileNotificationsAfterCommit(state);
}

type RecordOutcomeOptions = { note?: string; photoUri?: string; snoozeDays?: number; snoozedUntil?: string };

async function recordOutcomeOnce(actionId: string, type: OutcomeType, options: RecordOutcomeOptions, dependencies: RecordOutcomeDependencies) {
  const state = await loadAppStateFrom(dependencies.repository, dependencies.clock.now());
  const action = getAction(actionId);
  const current = state.configurations.find((config) => config.actionId === actionId);
  if (!action || !current) throw new Error('Action is not configured');
  const now = dependencies.clock.now();
  let snoozedUntil: string | undefined;
  if (type === 'snoozed') {
    const requested = options.snoozedUntil ? new Date(options.snoozedUntil) : new Date(now.getTime() + (options.snoozeDays ?? 1) * 86400000);
    if (Number.isNaN(requested.getTime()) || requested <= now) throw new Error('Snooze time must be in the future.');
    snoozedUntil = options.snoozedUntil ?? atNineAM(requested).toISOString();
  }
  const outcome: TaskOutcome = { id: dependencies.idGenerator.next(), actionId, type, occurredAt: now.toISOString(), note: options.note, photoUri: options.photoUri };
  let next: ActionConfiguration = { ...current };
  if (type === 'done') {
    next = configurationAfterCompletion(action, current, now);
  }
  if (type === 'snoozed') next.snoozedUntil = snoozedUntil;
  await dependencies.repository.transaction(async (transaction: HomeRepositoryTransaction) => {
    await transaction.addOutcome(outcome);
    await transaction.upsertConfiguration(next);
  });
  const nextState = await loadAppStateFrom(dependencies.repository, now);
  await reconcileNotifications(nextState, dependencies.notificationScheduler).catch(() => undefined);
  return nextState;
}

export function recordOutcome(actionId: string, type: OutcomeType, options: RecordOutcomeOptions = {}, dependencies: RecordOutcomeDependencies = recordOutcomeDependencies) {
  if (type === 'event_checked') throw new Error('Use recordWeatherCheck for weather events');
  const existing = outcomeOperations.get(actionId);
  if (existing) return existing;
  const operation = recordOutcomeOnce(actionId, type, options, dependencies);
  outcomeOperations.set(actionId, operation);
  const clear = () => { if (outcomeOperations.get(actionId) === operation) outcomeOperations.delete(actionId); };
  operation.then(clear, clear);
  return operation;
}

export function recordWeatherCheck(actionId: string, eventKey: 'heavy-rain', dependencies: RecordOutcomeDependencies = recordOutcomeDependencies) {
  const key = `${eventKey}:${actionId}`;
  const existing = eventCheckOperations.get(key);
  if (existing) return existing;
  const operation = (async () => {
    const state = await loadAppStateFrom(dependencies.repository);
    const action = getAction(actionId);
    const config = state.configurations.find((item) => item.actionId === actionId);
    if (!state.profile || !action || !config?.enabled || !actionApplies(action, state.profile) || !action.trigger.weatherEvents?.includes(eventKey)) {
      throw new Error('Weather check is not available for this home');
    }
    await dependencies.repository.addOutcome({ id: dependencies.idGenerator.next(), actionId, type: 'event_checked', eventKey, occurredAt: dependencies.clock.now().toISOString() });
    return loadAppStateFrom(dependencies.repository);
  })();
  eventCheckOperations.set(key, operation);
  const clear = () => { if (eventCheckOperations.get(key) === operation) eventCheckOperations.delete(key); };
  operation.then(clear, clear);
  return operation;
}

export async function reconcileNotifications(state?: AppState, notificationScheduler: NotificationScheduler = expoNotificationScheduler) {
  const currentState = state ?? await loadAppState();
  await notificationScheduler.reconcile(currentState.configurations, actions, currentState.settings);
  return currentState;
}

export async function recordIssue(title: string, options: { actionId?: string; note?: string; photoUri?: string } = {}) {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) throw new Error('Issue title is required');
  const outcomeId = id();
  const photoUri = await persistIssuePhoto(options.photoUri, outcomeId);
  try {
    await repository.addOutcome({ id: outcomeId, actionId: options.actionId ?? 'general-issue', type: 'issue_reported', occurredAt: new Date().toISOString(), title: trimmedTitle, note: options.note?.trim() || undefined, photoUri });
  } catch (error) {
    await removePersistedIssuePhoto(photoUri).catch(() => undefined);
    throw error;
  }
  await finishIssuePhotoDraft(options.photoUri).catch(() => undefined);
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
  let next: ActionConfiguration = { ...config, frequencyOverride: frequency, nextDueAt, snoozedUntil: undefined, seasonalDueDate: undefined, seasonalScheduleVersion: undefined };
  if (!frequency) next = reconcileSeasonalConfiguration(action, next, state.outcomes, reference);
  await repository.upsertConfiguration(next);
  const nextState = await loadAppState();
  return reconcileNotificationsAfterCommit(nextState);
}

export async function setActionEnabled(actionId: string, enabled: boolean) {
  const state = await loadAppState(); const config = state.configurations.find((candidate) => candidate.actionId === actionId);
  if (!config) throw new Error('Action is not configured');
  await repository.upsertConfiguration({ ...config, enabled, snoozedUntil: enabled ? undefined : config.snoozedUntil });
  const nextState = await loadAppState();
  return reconcileNotificationsAfterCommit(nextState);
}

export async function updateSettings(settings: AppSettings) {
  validateNotificationSchedule(settings.notificationSchedule);
  await repository.saveSettings(settings);
  const state = await loadAppState();
  // Notification APIs are device services, not a prerequisite for saving a
  // preference. In particular, they can be unavailable in Expo Go or on web.
  // Keep the setting change responsive and let reminder reconciliation fail
  // silently, just as it does when recording an outcome.
  void rescheduleNotifications(state.configurations, actions, settings.notificationsEnabled, settings.language, settings.notificationSchedule).catch(() => undefined);
  return state;
}

export async function importLocalBackup() {
  if (!(await importBackup())) return null;
  const state = await loadAppState();
  return reconcileNotificationsAfterCommit(state);
}

export function validateFrequency(frequency: Frequency) {
  const limits: Record<Frequency['unit'], number> = { day: 365, week: 52, month: 24, year: 10 };
  if (!Number.isInteger(frequency.interval) || frequency.interval < 1 || frequency.interval > limits[frequency.unit]) throw new Error('Frequency interval is outside the allowed range.');
  return frequency;
}

export async function resetAppData() {
  // Clearing local data must not depend on notification support being present.
  // Start cleanup when available, but always continue with the local reset.
  void cancelScheduledNotifications().catch(() => undefined);
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
