/* eslint-disable import/first */
jest.mock('../db', () => ({}));
jest.mock('../notifications', () => ({ rescheduleNotifications: jest.fn(async () => undefined), cancelScheduledNotifications: jest.fn(async () => undefined) }));
jest.mock('../media', () => ({}));
import { loadAppStateFrom, recordOutcome, type RecordOutcomeDependencies } from '../service';
import { defaultNotificationSchedule } from '../notificationSchedule';
import type { ActionConfiguration, TaskOutcome } from '../types';
import type { HomeRepository } from '../ports';

let configs: ActionConfiguration[];
let outcomes: TaskOutcome[];
const now = new Date(2026, 9, 13, 12);
const repository: HomeRepository = {
  initialiseDatabase: async () => undefined,
  loadProfile: async () => ({ id: 'home', features: ['gutters'], appliances: [], variants: {} }),
  loadConfigurations: async () => configs,
  loadOutcomes: async () => outcomes,
  getSettings: async () => ({ language: 'en', notificationsEnabled: false, notificationSchedule: defaultNotificationSchedule() }),
  upsertConfiguration: async (config) => { configs = configs.map((c) => c.actionId === config.actionId ? config : c); },
  addOutcome: async (outcome) => { outcomes = [...outcomes, outcome]; },
  transaction: async (work) => work({ saveProfile: async () => undefined, deleteConfiguration: async () => undefined, addOutcome: repository.addOutcome, upsertConfiguration: repository.upsertConfiguration }),
};
let dependencies: RecordOutcomeDependencies;
beforeEach(() => {
  configs = [{ actionId: 'gutters-ground-check', enabled: true, notificationsEnabled: false, nextDueAt: '2026-10-17T09:00:00.000Z' }]; outcomes = [];
  dependencies = { repository, clock: { now: () => now }, idGenerator: { next: () => 'outcome' }, notificationScheduler: { reconcile: jest.fn(async () => undefined) } };
});
it('migrates once, then advances completed seasonal tasks without clearing the due date', async () => {
  const initial = await loadAppStateFrom(repository, now);
  expect(initial.configurations[0].seasonalDueDate).toBe('2026-09-01');
  const completed = await recordOutcome('gutters-ground-check', 'done', {}, dependencies);
  expect(completed.configurations[0].seasonalDueDate).toBe('2027-03-01');
  expect(completed.outcomes[0].type).toBe('done');
  expect((await loadAppStateFrom(repository, new Date(2026, 10, 1))).configurations[0].seasonalDueDate).toBe('2027-03-01');
});
it('snoozes and reports issues without completing or moving the seasonal calendar', async () => {
  const snoozed = await recordOutcome('gutters-ground-check', 'snoozed', { snoozeDays: 7 }, dependencies);
  expect(snoozed.configurations[0].seasonalDueDate).toBe('2026-09-01');
  expect(new Date(snoozed.configurations[0].snoozedUntil!).getDate()).toBe(20);
  const issue = await recordOutcome('gutters-ground-check', 'issue_reported', { note: 'Loose joint' }, dependencies);
  expect(issue.configurations[0].seasonalDueDate).toBe('2026-09-01');
  expect(issue.outcomes[1]).toMatchObject({ type: 'issue_reported', note: 'Loose joint' });
});
it('preserves completion history, disabled state and a custom interval during upgrade', async () => {
  configs[0] = { ...configs[0], enabled: false, frequencyOverride: { interval: 2, unit: 'month' } };
  outcomes = [{ id: 'prior', actionId: 'gutters-ground-check', type: 'done', occurredAt: new Date(2026, 8, 20).toISOString() }];
  const state = await loadAppStateFrom(repository, now);
  expect(state.configurations[0]).toEqual(configs[0]);
  expect(state.outcomes).toEqual(outcomes);
});
