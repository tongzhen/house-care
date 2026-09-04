/* eslint-disable import/first */

jest.mock('../db', () => ({ resetLocalData: jest.fn(), replaceLocalData: jest.fn(), loadOutcomes: jest.fn(async () => []), clearOutcomePhoto: jest.fn(), deleteOutcome: jest.fn(), saveProfile: jest.fn(), saveSettings: jest.fn(), upsertConfiguration: jest.fn(), addOutcome: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///documents/', readAsStringAsync: jest.fn(), writeAsStringAsync: jest.fn(), deleteAsync: jest.fn(), EncodingType: { Base64: 'base64' } }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('jszip', () => jest.fn(() => ({ file: jest.fn(), generateAsync: jest.fn(async () => 'zip-data') })));
jest.mock('../media', () => ({ removePersistedIssuePhoto: jest.fn(async () => undefined) }));

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { clearData, exportBackup, removeIssue, removeIssuePhoto } from '../backup';
import * as db from '../db';
import { defaultNotificationSchedule } from '../notificationSchedule';
import { removePersistedIssuePhoto } from '../media';

beforeEach(() => { jest.clearAllMocks(); });

describe('local backup', () => {
  it('exports a versioned archive without mutating local data', async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
    await exportBackup({ profile: { id: 'primary-home', appliances: ['dishwasher'], features: [], variants: {} }, configurations: [], outcomes: [], settings: { language: 'en', notificationsEnabled: true, notificationSchedule: defaultNotificationSchedule() } });
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(expect.stringContaining('house-care-backup-'), 'zip-data', expect.anything());
    expect(Sharing.shareAsync).toHaveBeenCalled();
    expect(db.resetLocalData).not.toHaveBeenCalled();
  });

  it('clears data only through the reset repository operation', async () => {
    await clearData();
    expect(db.resetLocalData).toHaveBeenCalledTimes(1);
  });

  it('removes app-private issue photos before resetting their records', async () => {
    jest.mocked(db.loadOutcomes).mockResolvedValue([{ id: 'issue-1', actionId: 'dishwasher-filter-clean', type: 'issue_reported', occurredAt: '2026-08-17T09:00:00.000Z', photoUri: 'file:///documents/issue-1.jpg' }]);
    await clearData();
    expect(removePersistedIssuePhoto).toHaveBeenCalledWith('file:///documents/issue-1.jpg');
  });

  it('removes a photo or an entire issue record from local storage', async () => {
    const issue = { id: 'issue-1', actionId: 'dishwasher-filter-clean', type: 'issue_reported' as const, occurredAt: '2026-08-17T09:00:00.000Z', photoUri: 'file:///documents/issue-1.jpg' };
    await removeIssuePhoto(issue);
    await removeIssue(issue);
    expect(db.clearOutcomePhoto).toHaveBeenCalledWith('issue-1');
    expect(db.deleteOutcome).toHaveBeenCalledWith('issue-1');
    expect(removePersistedIssuePhoto).toHaveBeenCalledWith(issue.photoUri);
  });

  it('removes issue records even when stale photo cleanup fails', async () => {
    const issue = { id: 'issue-1', actionId: 'dishwasher-filter-clean', type: 'issue_reported' as const, occurredAt: '2026-08-17T09:00:00.000Z', photoUri: 'file:///documents/missing.jpg' };
    jest.mocked(removePersistedIssuePhoto).mockRejectedValueOnce(new Error('File is already missing'));

    await expect(removeIssue(issue)).resolves.toBeUndefined();

    expect(db.deleteOutcome).toHaveBeenCalledWith('issue-1');
  });
});
