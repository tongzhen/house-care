/* eslint-disable import/first */

jest.mock('../db', () => ({ loadConfigurations: jest.fn(async () => []), resetLocalData: jest.fn(), replaceLocalData: jest.fn(), loadOutcomes: jest.fn(async () => []), clearOutcomePhoto: jest.fn(), deleteOutcome: jest.fn(), saveProfile: jest.fn(), saveSettings: jest.fn(), upsertConfiguration: jest.fn(), addOutcome: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({ documentDirectory: 'file:///documents/', readAsStringAsync: jest.fn(), writeAsStringAsync: jest.fn(), deleteAsync: jest.fn(), EncodingType: { Base64: 'base64' } }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('jszip', () => Object.assign(jest.fn(() => ({ file: jest.fn(), generateAsync: jest.fn(async () => 'zip-data') })), { loadAsync: jest.fn() }));
jest.mock('../media', () => ({ removePersistedIssuePhoto: jest.fn(async () => undefined) }));
jest.mock('../photoCleanup', () => ({ processPendingPhotoDeletions: jest.fn(async () => undefined) }));

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import JSZip from 'jszip';
import { clearData, exportBackup, importBackup, parseBackupManifest, removeIssue, removeIssuePhoto } from '../backup';
import { removePersistedIssuePhoto } from '../media';
import * as db from '../db';
import { defaultNotificationSchedule } from '../notificationSchedule';
import { processPendingPhotoDeletions } from '../photoCleanup';

beforeEach(() => { jest.clearAllMocks(); });

describe('local backup', () => {
  it('accepts existing version 3 backups and version 4 weather checks', () => {
    const base = { profile: { appliances: [], features: ['gutters'], variants: {} }, configurations: [], settings: { language: 'en', notificationsEnabled: false } };
    expect(parseBackupManifest({ ...base, version: 3, outcomes: [] }).version).toBe(3);
    const rainCheck = { id: 'rain-1', actionId: 'gutters-ground-check', type: 'event_checked', eventKey: 'heavy-rain', occurredAt: '2026-10-02T10:00:00.000Z' };
    expect(parseBackupManifest({ ...base, version: 4, outcomes: [rainCheck] }).outcomes).toEqual([rainCheck]);
    expect(parseBackupManifest({ ...base, profile: { ...base.profile, postalCode: '2750' }, version: 4, outcomes: [] }).profile.postalCode).toBe('2750');
    expect(() => parseBackupManifest({ ...base, profile: { ...base.profile, postalCode: '275' }, version: 4, outcomes: [] })).toThrow();
    expect(() => parseBackupManifest({ ...base, version: 4, outcomes: [{ ...rainCheck, eventKey: undefined }] })).toThrow();
  });
  it('round-trips seasonal configuration and attempt history in version 5', () => {
    const config = { actionId: 'outdoor-tap-winter-check', enabled: false, notificationsEnabled: false, seasonalScheduleVersion: 1, seasonalDueDate: '2026-10-01', nextDueAt: '2026-10-01T07:00:00.000Z', snoozedUntil: '2026-10-20T07:00:00.000Z', reminderLedger: [{ key: '2026-10-01', scheduledAt: '2026-10-13T10:01:00.000Z' }] };
    const manifest = { version: 5, profile: { appliances: [], features: ['outdoor-tap'], variants: {} }, configurations: [config], settings: { language: 'en', notificationsEnabled: false }, outcomes: [] };
    expect(parseBackupManifest(manifest).configurations).toEqual([config]);
  });

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

  it('starts photo cleanup only after the reset commits', async () => {
    await clearData();
    expect(jest.mocked(db.resetLocalData).mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(processPendingPhotoDeletions).mock.invocationCallOrder[0]);
  });

  it('removes a photo or an entire issue record from local storage', async () => {
    const issue = { id: 'issue-1', actionId: 'dishwasher-filter-clean', type: 'issue_reported' as const, occurredAt: '2026-08-17T09:00:00.000Z', photoUri: 'file:///documents/issue-1.jpg' };
    await removeIssuePhoto(issue);
    await removeIssue(issue);
    expect(db.clearOutcomePhoto).toHaveBeenCalledWith('issue-1');
    expect(db.deleteOutcome).toHaveBeenCalledWith('issue-1');
    expect(processPendingPhotoDeletions).toHaveBeenCalledTimes(2);
  });

  it('removes issue records even when stale photo cleanup fails', async () => {
    const issue = { id: 'issue-1', actionId: 'dishwasher-filter-clean', type: 'issue_reported' as const, occurredAt: '2026-08-17T09:00:00.000Z', photoUri: 'file:///documents/missing.jpg' };
    jest.mocked(processPendingPhotoDeletions).mockRejectedValueOnce(new Error('File cleanup unavailable'));

    await expect(removeIssue(issue)).resolves.toBeUndefined();

    expect(db.deleteOutcome).toHaveBeenCalledWith('issue-1');
  });

  it.each(['reset', 'photo', 'issue'] as const)('never starts cleanup when the %s transaction fails', async operation => {
    const issue = { id: 'issue-1', actionId: 'general-issue', type: 'issue_reported' as const, occurredAt: '2026-08-17T09:00:00.000Z', photoUri: 'file:///documents/issue-1.jpg' };
    const save = operation === 'reset' ? db.resetLocalData : operation === 'photo' ? db.clearOutcomePhoto : db.deleteOutcome;
    jest.mocked(save).mockRejectedValueOnce(new Error('Commit failed'));
    await expect(operation === 'reset' ? clearData() : operation === 'photo' ? removeIssuePhoto(issue) : removeIssue(issue)).rejects.toThrow('Commit failed');
    expect(processPendingPhotoDeletions).not.toHaveBeenCalled();
  });

  it.each([false, true])('preserves committed import photos and cleans staged photos only on rollback (commit failure: %s)', async fails => {
    const manifest = { version: 5, profile: { appliances: [], features: [], variants: {} }, configurations: [], settings: { language: 'en', notificationsEnabled: false }, outcomes: [{ id: '../untrusted-id', actionId: 'general-issue', type: 'issue_reported', occurredAt: '2026-10-29T10:00:00.000Z', photoUri: 'media/photo.jpg' }] };
    jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///cache/import.zip' }] } as never);
    jest.mocked(JSZip.loadAsync).mockResolvedValueOnce({ file: (name: string) => ({ async: async () => name === 'manifest.json' ? JSON.stringify(manifest) : 'photo-data' }) } as never);
    if (fails) jest.mocked(db.replaceLocalData).mockRejectedValueOnce(new Error('Transaction failed'));
    else jest.mocked(processPendingPhotoDeletions).mockRejectedValueOnce(new Error('Cleanup unavailable'));
    if (fails) await expect(importBackup()).rejects.toThrow('Transaction failed');
    else await expect(importBackup()).resolves.toBe(true);
    const imported = jest.mocked(db.replaceLocalData).mock.calls[0][2][0].photoUri!;
    expect(imported).toMatch(/^file:\/\/\/documents\/issue-import-[A-Za-z0-9_-]+\.jpg$/);
    expect(imported).not.toContain('untrusted-id');
    if (fails) {
      expect(removePersistedIssuePhoto).toHaveBeenCalledWith(imported);
      expect(processPendingPhotoDeletions).not.toHaveBeenCalled();
    } else expect(removePersistedIssuePhoto).not.toHaveBeenCalled();
  });
});
