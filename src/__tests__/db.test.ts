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

import { initialiseDatabase, loadProfile, replaceLocalData, resetLocalData, saveProfile, transaction } from '../db';
import { defaultNotificationSchedule } from '../notificationSchedule';
import * as SQLite from 'expo-sqlite';

beforeEach(() => { jest.clearAllMocks(); mockGetAllAsync.mockResolvedValue([{ name: 'title' }]); });

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
      .mockResolvedValueOnce([{ name: 'title' }])
      .mockResolvedValueOnce([{ name: 'action_id' }, { name: 'enabled' }]);

    await initialiseDatabase();

    expect(mockExecAsync).toHaveBeenCalledWith('ALTER TABLE action_configurations ADD COLUMN notifications_enabled INTEGER NOT NULL DEFAULT 1;');
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
