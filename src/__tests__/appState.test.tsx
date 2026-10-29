/* eslint-disable import/first */
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('../service', () => ({ loadAppState: jest.fn(), reconcileNotifications: jest.fn(async () => undefined), updateSettings: jest.fn() }));
jest.mock('../notifications', () => ({ requestNotificationPermission: jest.fn(), subscribeToNotificationResponses: jest.fn(() => jest.fn()) }));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { AppState as NativeAppState, Text, type AppStateStatus } from 'react-native';
import i18n from '../i18n';
import { AppStateProvider, useAppState } from '../appState';
import { loadAppState, reconcileNotifications, updateSettings, type AppState } from '../service';
import { requestNotificationPermission, subscribeToNotificationResponses } from '../notifications';
import { defaultNotificationSchedule } from '../notificationSchedule';

const mockRouter = { push: jest.fn(), replace: jest.fn() };
const data: AppState = { profile: null, configurations: [], outcomes: [], settings: { language: 'en', notificationsEnabled: false, notificationSchedule: defaultNotificationSchedule() } };
let context: ReturnType<typeof useAppState>;
let foreground: (status: AppStateStatus) => void;
function Consumer() {
  const value = useAppState();
  useEffect(() => { context = value; }, [value]);
  return <Text>{value.state ? `Ready: ${value.state.settings.language}` : 'Waiting'}</Text>;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(finish => { resolve = finish; });
  return { promise, resolve };
}
beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('en');
  jest.mocked(loadAppState).mockResolvedValue(data);
  jest.mocked(requestNotificationPermission).mockResolvedValue(true);
  jest.mocked(subscribeToNotificationResponses).mockImplementation(() => jest.fn());
  jest.spyOn(NativeAppState, 'addEventListener').mockImplementation((_event, listener) => {
    foreground = listener;
    return { remove: jest.fn() };
  });
});
afterEach(() => jest.restoreAllMocks());

it('shows loading until local data is ready', async () => {
  const first = deferred<AppState>();
  jest.mocked(loadAppState).mockReturnValueOnce(first.promise);
  await render(<AppStateProvider><Consumer /></AppStateProvider>);
  expect(screen.getByText('Opening House Care…')).toBeTruthy();
  await act(async () => first.resolve(data));
  expect(screen.getByText('Ready: en')).toBeTruthy();
  expect(screen.queryByText('Opening House Care…')).toBeNull();
});

it('recovers from a failed cold start without resetting user data', async () => {
  jest.mocked(loadAppState).mockRejectedValueOnce(new Error('Database unavailable'));
  await render(<AppStateProvider><Consumer /></AppStateProvider>);
  expect(screen.getByText('House Care could not open')).toBeTruthy();
  expect(requestNotificationPermission).not.toHaveBeenCalled();
  await act(async () => { fireEvent.press(screen.getByText('Try again')); });
  expect(screen.getByText('Ready: en')).toBeTruthy();
  expect(screen.queryByText('House Care could not open')).toBeNull();
});

it('shows local data while permission setup is pending', async () => {
  const permission = deferred<boolean>();
  jest.mocked(loadAppState).mockResolvedValue({ ...data, settings: { ...data.settings, notificationsEnabled: true } });
  jest.mocked(requestNotificationPermission).mockReturnValueOnce(permission.promise);
  await render(<AppStateProvider><Consumer /></AppStateProvider>);
  expect(screen.getByText('Ready: en')).toBeTruthy();
  expect(screen.queryByText('Opening House Care…')).toBeNull();
  expect(updateSettings).not.toHaveBeenCalled();
});

it.each(['permission', 'settings'] as const)('keeps local data usable when %s setup fails', async failure => {
  jest.mocked(loadAppState).mockResolvedValue({ ...data, settings: { ...data.settings, notificationsEnabled: true } });
  if (failure === 'permission') jest.mocked(requestNotificationPermission).mockRejectedValueOnce(new Error('Unavailable'));
  else jest.mocked(updateSettings).mockRejectedValueOnce(new Error('Save failed'));
  await render(<AppStateProvider><Consumer /></AppStateProvider>);
  expect(screen.getByText('Ready: en')).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByText('Notification settings')); });
  expect(mockRouter.push).toHaveBeenCalledWith('/settings/notifications');
});

it('persists denied permission without treating it as a startup failure', async () => {
  jest.mocked(loadAppState).mockResolvedValue({ ...data, settings: { ...data.settings, notificationsEnabled: true } });
  jest.mocked(requestNotificationPermission).mockResolvedValueOnce(false);
  jest.mocked(updateSettings).mockResolvedValueOnce({ ...data, settings: { ...data.settings, notificationsPermissionRequested: true } });
  await render(<AppStateProvider><Consumer /></AppStateProvider>);
  expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({ notificationsEnabled: false, notificationsPermissionRequested: true }));
  expect(screen.getByText('Ready: en')).toBeTruthy();
  expect(screen.queryByText('Notification settings')).toBeNull();
});

it('retains local data after failed foreground refresh and retries successfully', async () => {
  await render(<AppStateProvider><Consumer /></AppStateProvider>);
  jest.mocked(loadAppState).mockRejectedValueOnce(new Error('Read failed'));
  await act(async () => foreground('active'));
  expect(context.state).toBe(data);
  expect(screen.getByText('Ready: en')).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByText('Try again')); });
  expect(screen.queryByText('Try again')).toBeNull();
});

it('coalesces refreshes and does not overwrite a newer mutation', async () => {
  await render(<AppStateProvider><Consumer /></AppStateProvider>);
  const read = deferred<AppState>();
  jest.mocked(loadAppState).mockReturnValueOnce(read.promise);
  const newer = { ...data, profile: { id: 'home', appliances: [], features: [], variants: {} } };
  let first!: Promise<AppState | null>;
  await act(async () => {
    first = context.refresh();
    expect(context.refresh()).toBe(first);
    context.setState(newer);
  });
  await act(async () => { read.resolve(data); await first; });
  expect(context.state).toBe(newer);
  expect(reconcileNotifications).toHaveBeenCalledTimes(1);
});

it('survives an unavailable notification subscription', async () => {
  jest.mocked(subscribeToNotificationResponses).mockImplementationOnce(() => { throw new Error('Unavailable'); });
  await render(<AppStateProvider><Consumer /></AppStateProvider>);
  expect(screen.getByText('Ready: en')).toBeTruthy();
});

it('keeps a cold-launch destination queued through a failed load and retry', async () => {
  jest.mocked(loadAppState).mockRejectedValueOnce(new Error('Read failed'));
  await render(<AppStateProvider><Consumer /></AppStateProvider>);
  const onAction = jest.mocked(subscribeToNotificationResponses).mock.calls[0][0];
  await act(async () => onAction('dishwasher-filter-clean'));
  expect(mockRouter.push).not.toHaveBeenCalled();
  await act(async () => { fireEvent.press(screen.getByText('Try again')); });
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/actions/[actionId]', params: { actionId: 'dishwasher-filter-clean', returnTo: '/home' } });
});

it('ignores a startup result after unmount', async () => {
  const read = deferred<AppState>();
  jest.mocked(loadAppState).mockReturnValueOnce(read.promise);
  const view = await render(<AppStateProvider><Consumer /></AppStateProvider>);
  await view.unmount();
  await act(async () => read.resolve(data));
  expect(requestNotificationPermission).not.toHaveBeenCalled();
  expect(reconcileNotifications).not.toHaveBeenCalled();
});

it('localizes startup errors and retry in Danish', async () => {
  await i18n.changeLanguage('da');
  jest.mocked(loadAppState).mockRejectedValueOnce(new Error('Unavailable'));
  await render(<AppStateProvider><Consumer /></AppStateProvider>);
  expect(screen.getByText('House Care kunne ikke åbnes')).toBeTruthy();
  expect(screen.getByText('Prøv igen')).toBeTruthy();
});
