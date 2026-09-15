/* eslint-disable import/first */

jest.mock('expo-router', () => ({
  Redirect: () => null,
  router: { replace: jest.fn(), back: jest.fn() },
}));
jest.mock('../../src/appState', () => ({
  useAppState: () => ({
    state: { profile: { id: 'home', houseType: 'detached', appliances: ['dishwasher'], features: [], variants: {} }, settings: { language: 'en', notificationsEnabled: false, notificationSchedule: {} }, configurations: [], outcomes: [] },
    setState: jest.fn(),
  }),
}));
jest.mock('../../src/service', () => ({ saveHomeProfile: jest.fn(async (profile) => ({ profile, settings: { language: 'en', notificationsEnabled: false, notificationSchedule: {} }, configurations: [], outcomes: [] })) }));
jest.mock('../../src/db', () => ({}));
jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn(), addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })), getLastNotificationResponseAsync: jest.fn(async () => null) }));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import ProfileRoute from '../settings/profile';

describe('profile route navigation', () => {
  it('returns to the settings tab from the top-left back button', async () => {
    await render(<ProfileRoute />);
    await act(async () => { fireEvent.press(screen.getByTestId('profile-editor-back')); });
    expect(router.replace).toHaveBeenCalledWith('/settings');
    expect(router.back).not.toHaveBeenCalled();
  });
});
