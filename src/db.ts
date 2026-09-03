import * as SQLite from 'expo-sqlite';
import { defaultNotificationSchedule, validateNotificationSchedule } from './notificationSchedule';
import { defaultAppLanguage } from './language';
import type { ActionConfiguration, AppSettings, FrequencyUnit, Profile, TaskOutcome } from './types';
import type { HomeRepositoryTransaction } from './ports';

let database: SQLite.SQLiteDatabase | undefined;
const profileId = 'primary-home';

async function db() {
  if (!database) database = await SQLite.openDatabaseAsync('house-care.db');
  return database;
}

type StatementRunner = Pick<SQLite.SQLiteDatabase, 'runAsync'>;

async function saveProfileWith(connection: StatementRunner, profile: Omit<Profile, 'id'>) {
  await connection.runAsync('INSERT OR REPLACE INTO home_profile (id, house_type, age_band, features_json, appliances_json, variants_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [profileId, profile.houseType ?? null, profile.ageBand ?? null, JSON.stringify(profile.features), JSON.stringify(profile.appliances), JSON.stringify(profile.variants), new Date().toISOString()]);
}

async function upsertConfigurationWith(connection: StatementRunner, configuration: ActionConfiguration) {
  await connection.runAsync('INSERT OR REPLACE INTO action_configurations (action_id, enabled, frequency_interval, frequency_unit, next_due_at, snoozed_until, notifications_enabled) VALUES (?, ?, ?, ?, ?, ?, ?)', [configuration.actionId, configuration.enabled ? 1 : 0, configuration.frequencyOverride?.interval ?? null, configuration.frequencyOverride?.unit ?? null, configuration.nextDueAt ?? null, configuration.snoozedUntil ?? null, configuration.notificationsEnabled ? 1 : 0]);
}

async function addOutcomeWith(connection: StatementRunner, outcome: TaskOutcome) {
  await connection.runAsync('INSERT INTO task_outcomes (id, action_id, outcome_type, occurred_at, title, note, photo_uri) VALUES (?, ?, ?, ?, ?, ?, ?)', [outcome.id, outcome.actionId, outcome.type, outcome.occurredAt, outcome.title ?? null, outcome.note ?? null, outcome.photoUri ?? null]);
}

export async function initialiseDatabase() {
  const connection = await db();
  await connection.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS home_profile (id TEXT PRIMARY KEY, house_type TEXT, age_band TEXT, features_json TEXT NOT NULL, appliances_json TEXT NOT NULL, variants_json TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS action_configurations (action_id TEXT PRIMARY KEY, enabled INTEGER NOT NULL, frequency_interval INTEGER, frequency_unit TEXT, next_due_at TEXT, snoozed_until TEXT, notifications_enabled INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS task_outcomes (id TEXT PRIMARY KEY, action_id TEXT NOT NULL, outcome_type TEXT NOT NULL, occurred_at TEXT NOT NULL, title TEXT, note TEXT, photo_uri TEXT);
    CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  const outcomeColumns = await connection.getAllAsync<{ name: string }>('PRAGMA table_info(task_outcomes)');
  if (!outcomeColumns.some((column) => column.name === 'title')) await connection.execAsync('ALTER TABLE task_outcomes ADD COLUMN title TEXT;');
  // Existing installations may predate per-action notification preferences.
  // Add the column before any profile/action write attempts to upsert it.
  const configurationColumns = await connection.getAllAsync<{ name: string }>('PRAGMA table_info(action_configurations)');
  if (!configurationColumns.some((column) => column.name === 'notifications_enabled')) {
    await connection.execAsync('ALTER TABLE action_configurations ADD COLUMN notifications_enabled INTEGER NOT NULL DEFAULT 1;');
  }
  await connection.runAsync('DELETE FROM task_outcomes WHERE outcome_type = ?', ['not_relevant']);
}

export async function loadProfile(): Promise<Profile | null> {
  const connection = await db();
  const row = await connection.getFirstAsync<{ id: string; house_type: Profile['houseType']; age_band: Profile['ageBand']; features_json: string; appliances_json: string; variants_json: string }>('SELECT * FROM home_profile WHERE id = ?', [profileId]);
  if (!row) return null;
  return { id: row.id, houseType: row.house_type, ageBand: row.age_band, features: JSON.parse(row.features_json), appliances: JSON.parse(row.appliances_json), variants: JSON.parse(row.variants_json) };
}

export async function saveProfile(profile: Omit<Profile, 'id'>) {
  await saveProfileWith(await db(), profile);
}

export async function loadConfigurations(): Promise<ActionConfiguration[]> {
  const connection = await db();
  const rows = await connection.getAllAsync<{ action_id: string; enabled: number; frequency_interval: number | null; frequency_unit: string | null; next_due_at: string | null; snoozed_until: string | null; notifications_enabled: number }>('SELECT * FROM action_configurations');
  return rows.map((row) => ({ actionId: row.action_id, enabled: row.enabled === 1, frequencyOverride: row.frequency_interval && row.frequency_unit ? { interval: row.frequency_interval, unit: row.frequency_unit as FrequencyUnit } : undefined, nextDueAt: row.next_due_at ?? undefined, snoozedUntil: row.snoozed_until ?? undefined, notificationsEnabled: row.notifications_enabled === 1 }));
}

export async function upsertConfiguration(configuration: ActionConfiguration) {
  await upsertConfigurationWith(await db(), configuration);
}

export async function deleteConfiguration(actionId: string) {
  const connection = await db();
  await connection.runAsync('DELETE FROM action_configurations WHERE action_id = ?', [actionId]);
}

export async function loadOutcomes(): Promise<TaskOutcome[]> {
  const connection = await db();
  return connection.getAllAsync<TaskOutcome>('SELECT id, action_id AS actionId, outcome_type AS type, occurred_at AS occurredAt, title, note, photo_uri AS photoUri FROM task_outcomes ORDER BY occurred_at DESC');
}

export async function addOutcome(outcome: TaskOutcome) {
  await addOutcomeWith(await db(), outcome);
}

export async function transaction<T>(work: (transaction: HomeRepositoryTransaction) => Promise<T>): Promise<T> {
  const connection = await db();
  let result: T | undefined;
  await connection.withExclusiveTransactionAsync(async (sql) => {
    const transactionRepository: HomeRepositoryTransaction = {
      saveProfile: (profile) => saveProfileWith(sql, profile),
      deleteConfiguration: (actionId) => sql.runAsync('DELETE FROM action_configurations WHERE action_id = ?', [actionId]).then(() => undefined),
      addOutcome: (outcome) => addOutcomeWith(sql, outcome),
      upsertConfiguration: (configuration) => upsertConfigurationWith(sql, configuration),
    };
    result = await work(transactionRepository);
  });
  return result as T;
}

export async function clearOutcomePhoto(outcomeId: string) {
  const connection = await db();
  await connection.runAsync('UPDATE task_outcomes SET photo_uri = NULL WHERE id = ?', [outcomeId]);
}

export async function deleteOutcome(outcomeId: string) {
  const connection = await db();
  await connection.runAsync('DELETE FROM task_outcomes WHERE id = ?', [outcomeId]);
}

export async function getSettings(): Promise<AppSettings> {
  const connection = await db();
  const rows = await connection.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM app_settings');
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  let notificationSchedule = defaultNotificationSchedule();
  if (values.notificationSchedule) {
    try { validateNotificationSchedule(notificationSchedule = { ...notificationSchedule, ...JSON.parse(values.notificationSchedule) }); } catch { notificationSchedule = defaultNotificationSchedule(); }
  }
  const language = values.language === 'da' || values.language === 'en' ? values.language : defaultAppLanguage();
  return { language, notificationsEnabled: values.notificationsEnabled !== 'false', notificationsPermissionRequested: values.notificationsPermissionRequested === 'true', notificationSchedule };
}

export async function saveSettings(settings: AppSettings) {
  const connection = await db();
  await connection.runAsync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', ['language', settings.language]);
  await connection.runAsync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', ['notificationsEnabled', String(settings.notificationsEnabled)]);
  await connection.runAsync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', ['notificationsPermissionRequested', String(settings.notificationsPermissionRequested ?? false)]);
  await connection.runAsync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', ['notificationSchedule', JSON.stringify(settings.notificationSchedule)]);
}

export async function resetLocalData() {
  const connection = await db();
  await connection.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.execAsync('DELETE FROM task_outcomes; DELETE FROM action_configurations; DELETE FROM home_profile; DELETE FROM app_settings;');
  });
}

export async function replaceLocalData(profile: Omit<Profile, 'id'>, configurations: ActionConfiguration[], outcomes: TaskOutcome[], settings: AppSettings) {
  const connection = await db();
  await connection.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.execAsync('DELETE FROM task_outcomes; DELETE FROM action_configurations; DELETE FROM home_profile; DELETE FROM app_settings;');
    await transaction.runAsync('INSERT INTO home_profile (id, house_type, age_band, features_json, appliances_json, variants_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [profileId, profile.houseType ?? null, profile.ageBand ?? null, JSON.stringify(profile.features), JSON.stringify(profile.appliances), JSON.stringify(profile.variants), new Date().toISOString()]);
    for (const configuration of configurations) {
      await transaction.runAsync('INSERT INTO action_configurations (action_id, enabled, frequency_interval, frequency_unit, next_due_at, snoozed_until, notifications_enabled) VALUES (?, ?, ?, ?, ?, ?, ?)', [configuration.actionId, configuration.enabled ? 1 : 0, configuration.frequencyOverride?.interval ?? null, configuration.frequencyOverride?.unit ?? null, configuration.nextDueAt ?? null, configuration.snoozedUntil ?? null, configuration.notificationsEnabled ? 1 : 0]);
    }
    for (const outcome of outcomes) {
      await transaction.runAsync('INSERT INTO task_outcomes (id, action_id, outcome_type, occurred_at, title, note, photo_uri) VALUES (?, ?, ?, ?, ?, ?, ?)', [outcome.id, outcome.actionId, outcome.type, outcome.occurredAt, outcome.title ?? null, outcome.note ?? null, outcome.photoUri ?? null]);
    }
    await transaction.runAsync('INSERT INTO app_settings (key, value) VALUES (?, ?)', ['language', settings.language]);
    await transaction.runAsync('INSERT INTO app_settings (key, value) VALUES (?, ?)', ['notificationsEnabled', String(settings.notificationsEnabled)]);
    await transaction.runAsync('INSERT INTO app_settings (key, value) VALUES (?, ?)', ['notificationsPermissionRequested', String(settings.notificationsPermissionRequested ?? false)]);
    await transaction.runAsync('INSERT INTO app_settings (key, value) VALUES (?, ?)', ['notificationSchedule', JSON.stringify(settings.notificationSchedule)]);
  });
}
