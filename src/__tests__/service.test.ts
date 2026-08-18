/* eslint-disable import/first */

jest.mock('../db', () => ({
  initialiseDatabase: jest.fn(), loadProfile: jest.fn(), loadConfigurations: jest.fn(), loadOutcomes: jest.fn(), getSettings: jest.fn(), saveProfile: jest.fn(), upsertConfiguration: jest.fn(), deleteConfiguration: jest.fn(), addOutcome: jest.fn(), saveSettings: jest.fn(),
}));
jest.mock('../notifications', () => ({ rescheduleNotifications: jest.fn() }));
jest.mock('../catalog', () => ({
  actions: [
    { id: 'dishwasher-filter-clean', trigger: { kind: 'recurring', defaultFrequency: { interval: 1, unit: 'month' } }, profileConditions: { appliances: ['dishwasher'] } },
    { id: 'floor-drain-clean', trigger: { kind: 'recurring', defaultFrequency: { interval: 1, unit: 'month' } }, profileConditions: { features: ['floor-drains'] } },
  ],
  getAction: (id: string) => ({
    'dishwasher-filter-clean': { id, trigger: { kind: 'recurring', defaultFrequency: { interval: 1, unit: 'month' } } },
    'floor-drain-clean': { id, trigger: { kind: 'recurring', defaultFrequency: { interval: 1, unit: 'month' } } },
  })[id],
  actionApplies: (action: { profileConditions: { appliances?: string[]; features?: string[] } }, profile: { appliances: string[]; features: string[] }) =>
    (!action.profileConditions.appliances || action.profileConditions.appliances.some((item) => profile.appliances.includes(item))) &&
    (!action.profileConditions.features || action.profileConditions.features.some((item) => profile.features.includes(item))),
}));

import * as db from '../db';
import { rescheduleNotifications } from '../notifications';
import { recordIssue, recordOutcome, saveHomeProfile, setActionEnabled, updateFrequency } from '../service';
import { defaultNotificationSchedule } from '../notificationSchedule';

const settings = { language: 'en' as const, notificationsEnabled: true, notificationSchedule: defaultNotificationSchedule() };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(db.initialiseDatabase).mockResolvedValue();
  jest.mocked(db.loadProfile).mockResolvedValue({ id: 'primary-home', appliances: ['dishwasher'], features: [], variants: {} });
  jest.mocked(db.loadConfigurations).mockResolvedValue([{ actionId: 'dishwasher-filter-clean', enabled: true, notificationsEnabled: true, nextDueAt: '2026-08-17T09:00:00.000Z' }]);
  jest.mocked(db.loadOutcomes).mockResolvedValue([]);
  jest.mocked(db.getSettings).mockResolvedValue(settings);
  jest.mocked(db.saveProfile).mockResolvedValue();
  jest.mocked(db.upsertConfiguration).mockResolvedValue();
  jest.mocked(db.deleteConfiguration).mockResolvedValue();
  jest.mocked(db.addOutcome).mockResolvedValue();
  jest.mocked(db.saveSettings).mockResolvedValue();
  jest.mocked(rescheduleNotifications).mockResolvedValue();
});

describe('maintenance service', () => {
  it('creates configurations only for applicable profile actions', async () => {
    await saveHomeProfile({ appliances: ['dishwasher'], features: [], variants: {} });

    expect(db.saveProfile).toHaveBeenCalledWith({ appliances: ['dishwasher'], features: [], variants: {} });
    expect(db.upsertConfiguration).toHaveBeenCalledTimes(1);
    expect(db.upsertConfiguration).toHaveBeenCalledWith(expect.objectContaining({ actionId: 'dishwasher-filter-clean', enabled: true }));
  });

  it('records completion and schedules the next due date', async () => {
    await recordOutcome('dishwasher-filter-clean', 'done');

    expect(db.addOutcome).toHaveBeenCalledWith(expect.objectContaining({ actionId: 'dishwasher-filter-clean', type: 'done' }));
    expect(db.upsertConfiguration).toHaveBeenCalledWith(expect.objectContaining({ actionId: 'dishwasher-filter-clean', nextDueAt: expect.any(String), snoozedUntil: undefined }));
    expect(rescheduleNotifications).toHaveBeenCalled();
  });

  it('disables an action marked not relevant', async () => {
    await recordOutcome('dishwasher-filter-clean', 'not_relevant');
    expect(db.upsertConfiguration).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it('records a standalone issue with a required trimmed title', async () => {
    await recordIssue('  Water under dishwasher  ', { note: 'After a cycle' });

    expect(db.addOutcome).toHaveBeenCalledWith(expect.objectContaining({ actionId: 'general-issue', type: 'issue_reported', title: 'Water under dishwasher', note: 'After a cycle' }));
    expect(db.upsertConfiguration).not.toHaveBeenCalled();
  });

  it('associates an issue with an action only when one is selected', async () => {
    await recordIssue('Dishwasher leak', { actionId: 'dishwasher-filter-clean' });
    expect(db.addOutcome).toHaveBeenCalledWith(expect.objectContaining({ actionId: 'dishwasher-filter-clean', title: 'Dishwasher leak' }));
  });

  it('rejects a standalone issue without a title', async () => {
    await expect(recordIssue('   ')).rejects.toThrow('Issue title is required');
    expect(db.addOutcome).not.toHaveBeenCalled();
  });

  it('removes configurations that are no longer applicable after editing the profile', async () => {
    jest.mocked(db.loadConfigurations).mockResolvedValue([
      { actionId: 'dishwasher-filter-clean', enabled: true, notificationsEnabled: true, nextDueAt: '2026-08-17T09:00:00.000Z' },
      { actionId: 'floor-drain-clean', enabled: true, notificationsEnabled: true, nextDueAt: '2026-08-18T09:00:00.000Z' },
    ]);
    await saveHomeProfile({ appliances: ['dishwasher'], features: [], variants: {} });
    expect(db.deleteConfiguration).toHaveBeenCalledWith('floor-drain-clean');
  });

  it('reschedules reminders after changing frequency or enablement', async () => {
    await updateFrequency('dishwasher-filter-clean', { interval: 3, unit: 'month' });
    await setActionEnabled('dishwasher-filter-clean', false);
    expect(rescheduleNotifications).toHaveBeenCalledTimes(2);
  });

  it('rejects an invalid custom frequency before persistence', async () => {
    await expect(updateFrequency('dishwasher-filter-clean', { interval: 25, unit: 'year' })).rejects.toThrow();
    expect(db.upsertConfiguration).not.toHaveBeenCalled();
  });

  it('persists a custom snooze datetime without changing the frequency', async () => {
    const snoozedUntil = '2099-08-20T14:30:00.000Z';
    await recordOutcome('dishwasher-filter-clean', 'snoozed', { snoozedUntil });
    expect(db.upsertConfiguration).toHaveBeenCalledWith(expect.objectContaining({ snoozedUntil }));
  });

  it('clears a previous snooze when frequency changes so the new due date is visible', async () => {
    jest.mocked(db.loadConfigurations).mockResolvedValue([{ actionId: 'dishwasher-filter-clean', enabled: true, notificationsEnabled: true, nextDueAt: '2026-08-17T09:00:00.000Z', snoozedUntil: '2099-08-20T14:30:00.000Z' }]);
    await updateFrequency('dishwasher-filter-clean', { interval: 3, unit: 'month' });
    expect(db.upsertConfiguration).toHaveBeenCalledWith(expect.objectContaining({ frequencyOverride: { interval: 3, unit: 'month' }, snoozedUntil: undefined, nextDueAt: expect.any(String) }));
  });
});
