/* eslint-disable import/first */
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn(async () => mockAdapter) }));
jest.mock('../language', () => ({ defaultAppLanguage: () => 'en' }));

import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addOutcome, clearOutcomePhoto, completePhotoDeletion, deleteOutcome, initialiseDatabase, isPhotoReferenced, loadOutcomes, loadPendingPhotoDeletions, replaceLocalData, resetLocalData } from '../db';
import { defaultNotificationSchedule } from '../notificationSchedule';

let mockSql: DatabaseSync;
let mockFailOn = '';
let directory: string;
const mockStatements = {
  execAsync: async (sql: string) => {
    if (mockFailOn && sql.includes(mockFailOn)) throw new Error('Injected write failure');
    mockSql.exec(sql);
  },
  runAsync: async (sql: string, params: SQLInputValue[] = []) => {
    if (mockFailOn && sql.includes(mockFailOn)) throw new Error('Injected write failure');
    return mockSql.prepare(sql).run(...params);
  },
  getAllAsync: async (sql: string, params: SQLInputValue[] = []) => mockSql.prepare(sql).all(...params),
  getFirstAsync: async (sql: string, params: SQLInputValue[] = []) => mockSql.prepare(sql).get(...params) ?? null,
};
const mockAdapter = {
  ...mockStatements,
  withExclusiveTransactionAsync: async (work: (adapter: typeof mockStatements) => Promise<void>) => {
    mockSql.exec('BEGIN IMMEDIATE');
    try {
      await work(mockStatements);
      mockSql.exec('COMMIT');
    } catch (error) {
      mockSql.exec('ROLLBACK');
      throw error;
    }
  },
};
const uri = 'file:///documents/issue-one.jpg';
const settings = { language: 'en' as const, notificationsEnabled: false, notificationSchedule: defaultNotificationSchedule() };
beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), 'housecare-photo-test-'));
  mockSql = new DatabaseSync(join(directory, 'test.db'));
  mockFailOn = '';
  // Start with an old installation's outcomes table to exercise additive migration.
  mockSql.exec('CREATE TABLE task_outcomes (id TEXT PRIMARY KEY, action_id TEXT NOT NULL, outcome_type TEXT NOT NULL, occurred_at TEXT NOT NULL, note TEXT, photo_uri TEXT)');
  await initialiseDatabase();
  await addOutcome({ id: 'one', actionId: 'general-issue', type: 'issue_reported', occurredAt: '2026-10-29T10:00:00.000Z', photoUri: uri });
});
afterEach(() => {
  mockSql.close();
  rmSync(directory, { recursive: true });
});

it('migrates an existing database without losing photos', async () => {
  expect((await loadOutcomes())[0].photoUri).toBe(uri);
  expect(await loadPendingPhotoDeletions()).toEqual([]);
});

it('atomically clears the reference and queues the persisted photo', async () => {
  await clearOutcomePhoto('one');
  expect((await loadOutcomes())[0].photoUri).toBeUndefined();
  expect(await loadPendingPhotoDeletions()).toEqual([uri]);
  expect(await isPhotoReferenced(uri)).toBe(false);
});

it.each(['photo', 'issue', 'reset', 'import'] as const)('rolls back both records and queue when %s fails', async operation => {
  mockFailOn = operation === 'photo' ? 'UPDATE task_outcomes' : operation === 'import' ? 'INSERT INTO home_profile' : 'DELETE FROM task_outcomes';
  const work = operation === 'photo' ? clearOutcomePhoto('one') : operation === 'issue' ? deleteOutcome('one') : operation === 'reset' ? resetLocalData() : replaceLocalData({ appliances: [], features: [], variants: {} }, [], [], settings);
  await expect(work).rejects.toThrow('Injected write failure');
  expect((await loadOutcomes())[0].photoUri).toBe(uri);
  expect(await loadPendingPhotoDeletions()).toEqual([]);
});

it('retains cleanup work across reset and database reopen', async () => {
  await deleteOutcome('one');
  await resetLocalData();
  mockSql.close();
  mockSql = new DatabaseSync(join(directory, 'test.db'));
  await initialiseDatabase();
  expect(await loadOutcomes()).toEqual([]);
  expect(await loadPendingPhotoDeletions()).toEqual([uri]);
  await completePhotoDeletion(uri);
  expect(await loadPendingPhotoDeletions()).toEqual([]);
});

it('queues replaced photos but retains imported photos and earlier pending work', async () => {
  await clearOutcomePhoto('one');
  await addOutcome({ id: 'two', actionId: 'general-issue', type: 'issue_reported', occurredAt: '2026-10-29T10:00:00.000Z', photoUri: 'file:///documents/issue-two.jpg' });
  await replaceLocalData({ appliances: [], features: [], variants: {} }, [], [{ id: 'three', actionId: 'general-issue', type: 'issue_reported', occurredAt: '2026-10-29T10:00:00.000Z', photoUri: 'file:///documents/issue-three.jpg' }], settings);
  expect((await loadPendingPhotoDeletions()).sort()).toEqual([uri, 'file:///documents/issue-two.jpg'].sort());
  expect(await isPhotoReferenced('file:///documents/issue-three.jpg')).toBe(true);
});

it('does not delete a shared photo until its final reference is removed', async () => {
  await addOutcome({ id: 'two', actionId: 'general-issue', type: 'issue_reported', occurredAt: '2026-10-29T10:00:00.000Z', photoUri: uri });
  await deleteOutcome('one');
  expect(await isPhotoReferenced(uri)).toBe(true);
  await deleteOutcome('two');
  expect(await isPhotoReferenced(uri)).toBe(false);
  expect(await loadPendingPhotoDeletions()).toEqual([uri]);
});
