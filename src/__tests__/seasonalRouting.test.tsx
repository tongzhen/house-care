/* eslint-disable import/first */
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('../service', () => ({ loadAppState: jest.fn(), reconcileNotifications: jest.fn(async () => undefined), updateSettings: jest.fn() }));
jest.mock('../notifications', () => ({ requestNotificationPermission: jest.fn(), subscribeToNotificationResponses: jest.fn((_onAction, onSeasonal) => { mockSeasonalTap = onSeasonal; return jest.fn(); }) }));
import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import '../i18n';
import { AppStateProvider } from '../appState';
import { loadAppState } from '../service';
import { defaultNotificationSchedule } from '../notificationSchedule';
import type { AppState } from '../service';
const mockRouter = { push: jest.fn(), replace: jest.fn() };
let mockSeasonalTap: () => void;
const state: AppState = { profile: { id: 'home', features: [], appliances: [], variants: {} }, configurations: [], outcomes: [], settings: { language: 'en', notificationsEnabled: false, notificationSchedule: defaultNotificationSchedule() } };
beforeEach(() => jest.clearAllMocks());
it('opens the seasonal checklist from a notification while the app is running', async () => {
  jest.mocked(loadAppState).mockResolvedValue(state);
  await render(<AppStateProvider><Text>App</Text></AppStateProvider>);
  await act(async () => mockSeasonalTap());
  expect(mockRouter.push).toHaveBeenCalledWith('/seasonal');
});
it('waits for hydration before routing a seasonal notification on cold launch', async () => {
  let resolve!: (state: AppState) => void;
  jest.mocked(loadAppState).mockImplementationOnce(() => new Promise((finish) => { resolve = finish; }));
  await render(<AppStateProvider><Text>App</Text></AppStateProvider>);
  await act(async () => mockSeasonalTap());
  expect(mockRouter.push).not.toHaveBeenCalled();
  await act(async () => resolve(state));
  expect(mockRouter.replace).toHaveBeenCalledWith('/seasonal');
});
