/* eslint-disable import/first */

const mockExecAsync = jest.fn();
const mockRunAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockGetAllAsync = jest.fn();
const mockWithTransactionAsync = jest.fn(async (callback) => callback());
const mockTransaction = { execAsync: mockExecAsync, runAsync: mockRunAsync };
const mockWithExclusiveTransactionAsync = jest.fn(async (callback) => callback(mockTransaction));
const mockDatabase = { execAsync: mockExecAsync, runAsync: mockRunAsync, getFirstAsync: mockGetFirstAsync, getAllAsync: mockGetAllAsync, withTransactionAsync: mockWithTransactionAsync, withExclusiveTransactionAsync: mockWithExclusiveTransactionAsync };

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn(async () => mockDatabase) }));

import { initialiseDatabase, loadOutcomes, loadProfile, replaceLocalData, resetLocalData, saveProfile, saveReminderLedger, loadConfigurations, transaction } from '../db';
import { defaultNotificationSchedule } from '../notificationSchedule';
import * as SQLite from 'expo-sqlite';

beforeEach(() => { jest.clearAllMocks(); mockGetAllAsync.mockResolvedValue([{ name: 'postal_code' }, { name: 'title' }, { name: 'event_key' }, { name: 'notifications_enabled' }]); });

describe('SQLite repository', () => {
  it('initialises all local persistence tables', async () => {
    await initialiseDatabase();
    expect(SQLite.openDatabaseAsync).toHaveBeenCalledWith('house-care.db', { useNewConnection: true });
    expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS home_profile'));
    expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS task_outcomes'));
    expect(mockExecAsync).not.toHaveBeenCalledWith(expect.stringContaining('ALTER TABLE task_outcomes'));
    expect(mockRunAsync).toHaveBeenCalledWith('DELETE FROM task_outcomes WHERE outcome_type = ?', ['not_relevant']);
  });

  it('migrates action configurations created before notification preferences', async () => {
    mockGetAllAsync
      .mockResolvedValueOnce([{ name: 'postal_code' }])
      .mockResolvedValueOnce([{ name: 'title', }, { name: 'event_key' }])
      .mockResolvedValueOnce([{ name: 'action_id' }, { name: 'enabled' }]);

    await initialiseDatabase();

    expect(mockExecAsync).toHaveBeenCalledWith('ALTER TABLE action_configurations ADD COLUMN notifications_enabled INTEGER NOT NULL DEFAULT 1;');
  });

  it('adds seasonal persistence fields without changing existing records', async () => {
    await initialiseDatabase();
    expect(mockExecAsync).toHaveBeenCalledWith('ALTER TABLE action_configurations ADD COLUMN seasonal_schedule_version INTEGER;');
    expect(mockExecAsync).toHaveBeenCalledWith('ALTER TABLE action_configurations ADD COLUMN seasonal_due_date TEXT;');
    expect(mockExecAsync).toHaveBeenCalledWith('ALTER TABLE action_configurations ADD COLUMN reminder_ledger TEXT;');
  });

  it('loads seasonal state and updates only the reminder ledger', async () => {
    const ledger = [{ key: '2026-10-01', scheduledAt: '2026-10-13T10:01:00.000Z' }];
    mockGetAllAsync.mockResolvedValueOnce([{ action_id: 'outdoor-tap-winter-check', enabled: 1, notifications_enabled: 1, seasonal_schedule_version: 1, seasonal_due_date: '2026-10-01', reminder_ledger: JSON.stringify(ledger) }]);
    expect((await loadConfigurations())[0]).toMatchObject({ seasonalScheduleVersion: 1, seasonalDueDate: '2026-10-01', reminderLedger: ledger });
    await saveReminderLedger('outdoor-tap-winter-check', ledger);
    expect(mockRunAsync).toHaveBeenCalledWith('UPDATE action_configurations SET reminder_ledger = ? WHERE action_id = ?', [JSON.stringify(ledger), 'outdoor-tap-winter-check']);
  });

  it('adds an optional postal code to an existing home profile', async () => {
    mockGetAllAsync.mockResolvedValueOnce([{ name: 'id' }]);
    await initialiseDatabase();
    expect(mockExecAsync).toHaveBeenCalledWith('ALTER TABLE home_profile ADD COLUMN postal_code TEXT;');
  });

  it('adds event keys to existing outcome tables', async () => {
    mockGetAllAsync.mockResolvedValueOnce([{ name: 'postal_code' }]).mockResolvedValueOnce([{ name: 'title' }]);
    await initialiseDatabase();
    expect(mockExecAsync).toHaveBeenCalledWith('ALTER TABLE task_outcomes ADD COLUMN event_key TEXT;');
  });

  it('normalises empty outcome fields for backup validation', async () => {
    mockGetAllAsync.mockResolvedValueOnce([{ id: 'done-1', actionId: 'gutters-ground-check', type: 'done', occurredAt: '2026-10-02T10:00:00.000Z', eventKey: null, title: null, note: null, photoUri: null }]);
    await expect(loadOutcomes()).resolves.toEqual([{ id: 'done-1', actionId: 'gutters-ground-check', type: 'done', occurredAt: '2026-10-02T10:00:00.000Z', eventKey: undefined, title: undefined, note: undefined, photoUri: undefined }]);
  });

  it('serialises a profile before writing it', async () => {
    await saveProfile({ appliances: ['dishwasher'], features: ['floor-drains'], variants: {} });
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT OR REPLACE INTO home_profile'), expect.arrayContaining([JSON.stringify(['floor-drains']), JSON.stringify(['dishwasher'])]));
  });

  it('returns null when no profile exists and clears local tables transactionally', async () => {
    mockGetFirstAsync.mockResolvedValue(null);
    await expect(loadProfile()).resolves.toBeNull();
    await resetLocalData();
    expect(mockWithExclusiveTransactionAsync).toHaveBeenCalled();
    expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM task_outcomes'));
  });

  it('replaces imported records within one exclusive transaction', async () => {
    await replaceLocalData({ appliances: ['dishwasher'], features: [], variants: {} }, [{ actionId: 'dishwasher-filter-clean', enabled: true, notificationsEnabled: true }], [], { language: 'en', notificationsEnabled: true, notificationSchedule: defaultNotificationSchedule() });
    expect(mockWithExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM task_outcomes'));
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO home_profile'), expect.anything());
  });

  it('provides transactional profile, outcome, and configuration writes', async () => {
    await transaction(async (repository) => {
      await repository.saveProfile({ appliances: ['dishwasher'], features: [], variants: {} });
      await repository.addOutcome({ id: 'outcome-1', actionId: 'dishwasher-filter-clean', type: 'done', occurredAt: '2026-08-27T09:00:00.000Z' });
      await repository.upsertConfiguration({ actionId: 'dishwasher-filter-clean', enabled: true, notificationsEnabled: true });
    });

    expect(mockWithExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT OR REPLACE INTO home_profile'), expect.anything());
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO task_outcomes'), expect.anything());
    expect(mockRunAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT OR REPLACE INTO action_configurations'), expect.anything());
  });
});
