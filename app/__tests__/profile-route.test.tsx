/* eslint-disable import/first */

jest.mock('expo-router', () => ({
  Redirect: () => null,
  router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() },
  useNavigation: () => mockNavigation,
  useLocalSearchParams: () => ({ actionId: 'dishwasher-filter-clean' }),
}));
jest.mock('../../src/appState', () => ({ useAppState: () => ({
  state: {
    profile: { id: 'home', houseType: 'detached', appliances: ['dishwasher'], features: [], variants: {} },
    settings: { language: 'en', notificationsEnabled: true, notificationSchedule: mockDefaultSchedule() },
    configurations: [{ actionId: 'dishwasher-filter-clean', enabled: true, notificationsEnabled: true }], outcomes: [],
  }, setState: jest.fn(), issueDraft: { title: 'Draft', note: '', photo: 'draft-photo.jpg' }, setIssueDraft: jest.fn(), resetIssueDraft: mockResetDraft,
}) }));
jest.mock('../../src/service', () => ({ saveHomeProfile: jest.fn(async (profile) => ({ profile })), updateSettings: jest.fn(async (settings) => ({ settings })), updateFrequency: jest.fn(async () => ({})), recordIssue: jest.fn(async () => ({})) }));
jest.mock('../../src/media', () => ({ discardIssuePhoto: jest.fn(async () => undefined), selectIssuePhoto: jest.fn() }));
jest.mock('../../src/db', () => ({}));
jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn(), addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })), getLastNotificationResponseAsync: jest.fn(async () => null) }));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, PanResponder } from 'react-native';
import { router } from 'expo-router';
import { saveHomeProfile, updateSettings, updateFrequency, recordIssue } from '../../src/service';
import { discardIssuePhoto } from '../../src/media';
import { defaultNotificationSchedule as mockDefaultSchedule } from '../../src/notificationSchedule';
import ProfileRoute from '../settings/profile';
import NotificationRoute from '../settings/notifications';
import NewIssueRoute from '../issues/new';
import FrequencyRoute from '../actions/[actionId]/frequency';

const mockNavigation = { addListener: jest.fn() };
const mockResetDraft = jest.fn();
let beforeRemove: (event: { preventDefault: () => void }) => void;
function systemBack() { const preventDefault = jest.fn(); beforeRemove({ preventDefault }); return preventDefault; }
function swipeBack() { fireEvent(screen.getByTestId('swipe-back'), 'swipeBack', {}, { x0: 10, dx: 120, dy: 0 }); }

beforeEach(() => {
  jest.clearAllMocks();
  mockNavigation.addListener.mockImplementation((_event, listener) => { beforeRemove = listener; return jest.fn(); });
  jest.spyOn(PanResponder, 'create').mockImplementation((config) => ({ panHandlers: { onSwipeBack: config.onPanResponderRelease } }) as ReturnType<typeof PanResponder.create>);
});
afterEach(() => { jest.restoreAllMocks(); });

it('saves the profile and returns to Settings from the back button', async () => {
  await render(<ProfileRoute />);
  await act(async () => { fireEvent.press(screen.getByTestId('profile-editor-back')); });
  expect(router.replace).toHaveBeenCalledWith('/settings');
  expect(router.back).not.toHaveBeenCalled();
});

it('saves the latest profile draft on an edge swipe before leaving', async () => {
  await render(<ProfileRoute />);
  await act(async () => { fireEvent.press(screen.getByText('Washing machine')); });
  await act(async () => { swipeBack(); });
  expect(saveHomeProfile).toHaveBeenCalledWith(expect.objectContaining({ appliances: ['dishwasher', 'washing-machine'] }));
  expect(router.replace).toHaveBeenCalledWith('/settings');
  expect(systemBack()).not.toHaveBeenCalled(); // Successful save permits the removal.
});

it('waits for a system-back save and ignores duplicate exit attempts', async () => {
  let finish!: () => void;
  jest.mocked(saveHomeProfile).mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve({} as Awaited<ReturnType<typeof saveHomeProfile>>); }));
  await render(<ProfileRoute />);
  await act(async () => { fireEvent.press(screen.getByText('10+ years')); });
  await act(async () => { expect(systemBack()).toHaveBeenCalled(); systemBack(); swipeBack(); });
  expect(saveHomeProfile).toHaveBeenCalledTimes(1);
  expect(saveHomeProfile).toHaveBeenCalledWith(expect.objectContaining({ ageBand: '10+' }));
  expect(router.replace).not.toHaveBeenCalled();
  await act(async () => { finish(); });
  expect(router.replace).toHaveBeenCalledWith('/settings');
});

it('keeps a failed or invalid profile save open for correction and retry', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.mocked(saveHomeProfile).mockRejectedValueOnce(new Error('Storage unavailable'));
  await render(<ProfileRoute />);
  await act(async () => { systemBack(); });
  expect(alert).toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
  await act(async () => { fireEvent.press(screen.getByText('Dishwasher')); });
  await act(async () => { systemBack(); });
  expect(saveHomeProfile).toHaveBeenCalledTimes(1);
  await act(async () => { fireEvent.press(screen.getByText('Dishwasher')); });
  await act(async () => { systemBack(); });
  expect(saveHomeProfile).toHaveBeenCalledTimes(2);
  expect(router.replace).toHaveBeenCalledWith('/settings');
});

it('saves notification timing changes on an edge swipe', async () => {
  await render(<NotificationRoute />);
  const switches = screen.getAllByRole('switch');
  await act(async () => { fireEvent(switches[1], 'valueChange', false); }); // Monday
  await act(async () => { swipeBack(); });
  expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({ notificationSchedule: expect.objectContaining({ 1: expect.objectContaining({ enabled: false }) }) }));
  expect(router.back).toHaveBeenCalledTimes(1);
});

it('keeps notification settings open when a system-back save fails', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.mocked(updateSettings).mockRejectedValueOnce(new Error('Storage unavailable'));
  await render(<NotificationRoute />);
  await act(async () => { expect(systemBack()).toHaveBeenCalled(); });
  expect(updateSettings).toHaveBeenCalledTimes(1);
  expect(router.back).not.toHaveBeenCalled();
});

it('cleans up the issue photo and draft before a system-back exit', async () => {
  await render(<NewIssueRoute />);
  await act(async () => { expect(systemBack()).toHaveBeenCalled(); });
  expect(discardIssuePhoto).toHaveBeenCalledWith('draft-photo.jpg');
  expect(mockResetDraft).toHaveBeenCalledTimes(1);
  expect(router.replace).toHaveBeenCalledWith('/home');
});

it('prevents an issue swipe from cancelling a pending save', async () => {
  let finish!: () => void;
  jest.mocked(recordIssue).mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve({} as Awaited<ReturnType<typeof recordIssue>>); }));
  await render(<NewIssueRoute />);
  await act(async () => { fireEvent.press(screen.getByTestId('issue-save')); });
  await act(async () => { swipeBack(); systemBack(); });
  expect(discardIssuePhoto).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
  await act(async () => { finish(); });
  expect(router.replace).toHaveBeenCalledWith('/history');
});

it('prevents custom-frequency exit during save and cancels an unsaved draft', async () => {
  let finish!: () => void;
  jest.mocked(updateFrequency).mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve({} as Awaited<ReturnType<typeof updateFrequency>>); }));
  await render(<FrequencyRoute />);
  await act(async () => { fireEvent.press(screen.getByText('Save frequency')); });
  await act(async () => { systemBack(); swipeBack(); });
  expect(router.replace).not.toHaveBeenCalled();
  await act(async () => { finish(); });
  expect(router.replace).toHaveBeenCalledTimes(1);
  await render(<FrequencyRoute />);
  await act(async () => { swipeBack(); });
  expect(updateFrequency).toHaveBeenCalledTimes(1);
  expect(router.replace).toHaveBeenCalledTimes(2);
});
