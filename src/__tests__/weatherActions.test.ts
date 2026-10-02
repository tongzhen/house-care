import { actionsForWeatherEvent, lastWeatherCheck } from '../actionViews';
import { defaultNotificationSchedule } from '../notificationSchedule';
import type { AppState } from '../service';

const state: AppState = {
  profile: { id: 'primary-home', appliances: [], features: ['gutters', 'drainage-faskine', 'pump-well'], variants: {} },
  configurations: [
    { actionId: 'gutters-ground-check', enabled: true, notificationsEnabled: true },
    { actionId: 'faskine-inlet-check', enabled: true, notificationsEnabled: true },
    { actionId: 'pump-well-visual-check', enabled: false, notificationsEnabled: true },
  ],
  outcomes: [{ id: 'rain-check-1', actionId: 'gutters-ground-check', type: 'event_checked', eventKey: 'heavy-rain', occurredAt: '2026-10-02T10:00:00.000Z' }],
  settings: { language: 'en', notificationsEnabled: false, notificationSchedule: defaultNotificationSchedule() },
};

it('shows only applicable enabled actions linked to heavy rain', () => {
  expect(actionsForWeatherEvent(state, 'heavy-rain').map((action) => action.id)).toEqual(['gutters-ground-check', 'faskine-inlet-check']);
  expect(actionsForWeatherEvent({ ...state, profile: { ...state.profile!, features: [] } }, 'heavy-rain')).toEqual([]);
});

it('finds the latest check for each action and event', () => {
  expect(lastWeatherCheck(state, 'gutters-ground-check', 'heavy-rain')).toBe('2026-10-02T10:00:00.000Z');
  expect(lastWeatherCheck(state, 'faskine-inlet-check', 'heavy-rain')).toBeUndefined();
});
