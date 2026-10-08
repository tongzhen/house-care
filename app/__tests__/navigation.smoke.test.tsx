/* eslint-disable import/first */

jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '0.1.0', nativeBuildVersion: '42' }));
jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn(), addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })), getLastNotificationResponseAsync: jest.fn(async () => null) }));
jest.mock('../../src/db', () => ({}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { getAction } from '../../src/catalog';
import { ActionDetail, ActionList, Home } from '../index';

describe('navigation smoke flows', () => {
  it('opens an actionable Home row through its callback', async () => {
    const action = getAction('dishwasher-filter-clean')!;
    const onOpen = jest.fn();
    await render(<Home actions={[action]} configurations={new Map([[action.id, { actionId: action.id, enabled: true, notificationsEnabled: true, nextDueAt: new Date(Date.now() + 86400000).toISOString() }]])} language="en" now={Date.now()} onOpen={onOpen} onReportIssue={jest.fn()} />);
    await act(async () => { fireEvent.press(screen.getByText('Check and clean the dishwasher filter system')); });
    expect(onOpen).toHaveBeenCalledWith(action.id);
  });

  it('keeps action detail back and issue actions available', async () => {
    const action = getAction('dishwasher-filter-clean')!;
    const onBack = jest.fn();
    const onIssue = jest.fn();
    await render(<ActionDetail action={action} configuration={{ actionId: action.id, enabled: true, notificationsEnabled: true, nextDueAt: new Date(Date.now() + 86400000).toISOString() }} language="en" returnView="home" onBack={onBack} onDone={jest.fn()} onSnooze={jest.fn()} onCustomSnooze={jest.fn(async () => undefined)} onIssue={onIssue} onFrequency={jest.fn(async () => undefined)} onEnabled={jest.fn(async () => undefined)} />);
    await act(async () => { fireEvent.press(screen.getByText('‹ Home')); });
    await act(async () => { fireEvent.press(screen.getByText('I noticed an issue')); });
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onIssue).toHaveBeenCalledTimes(1);
  });

  it('opens the after-rain checklist from Actions', async () => {
    const onOpenWeather = jest.fn();
    await render(<ActionList actions={[]} configurations={new Map()} language="en" onOpen={jest.fn()} onOpenWeather={onOpenWeather} />);
    await act(async () => { fireEvent.press(screen.getByText('After heavy rain')); });
    expect(onOpenWeather).toHaveBeenCalledTimes(1);
  });

  it('offers an event check after safe steps without routine completion controls', async () => {
    const action = getAction('gutters-ground-check')!;
    const onWeatherCheck = jest.fn(async () => undefined);
    await render(<ActionDetail action={action} configuration={{ actionId: action.id, enabled: true, notificationsEnabled: true }} language="en" returnView="weather" onBack={jest.fn()} onDone={jest.fn()} onSnooze={jest.fn()} onCustomSnooze={jest.fn(async () => undefined)} onWeatherCheck={onWeatherCheck} onIssue={jest.fn()} onFrequency={jest.fn(async () => undefined)} onEnabled={jest.fn(async () => undefined)} />);
    expect(screen.queryByText('Mark as done')).toBeNull();
    await act(async () => { fireEvent.press(screen.getByText('Checked after rain')); });
    expect(onWeatherCheck).toHaveBeenCalledTimes(1);
  });
});
