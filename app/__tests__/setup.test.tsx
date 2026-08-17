/* eslint-disable import/first */

jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn(), addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })), getLastNotificationResponseAsync: jest.fn(async () => null) }));
jest.mock('../../src/db', () => ({}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import '../../src/i18n';
import { Home, IssueForm, Setup } from '../index';
import { getAction } from '../../src/catalog';

describe('setup flow', () => {
  it('saves a selected dishwasher profile', async () => {
    const onSave = jest.fn(async () => undefined);
    await render(<Setup initial={null} onSave={onSave} />);
    fireEvent.press(screen.getByText('Continue'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ appliances: ['dishwasher'], houseType: 'detached' }));
  });

  it('stores a selected appliance variant for catalogue eligibility', async () => {
    const onSave = jest.fn(async () => undefined);
    await render(<Setup initial={null} onSave={onSave} />);
    await act(async () => { fireEvent.press(screen.getByText('Tumble dryer')); });
    await act(async () => { fireEvent.press(await screen.findByText('Vented')); });
    fireEvent.press(screen.getByText('Continue'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ variants: { tumbleDryer: 'vented' } }));
  });

  it('shows a Settings back button and Save action when editing a profile', async () => {
    const onBack = jest.fn();
    await render(<Setup initial={{ id: 'primary-home', houseType: 'detached', appliances: ['dishwasher'], features: [], variants: {} }} onBack={onBack} onSave={jest.fn(async () => undefined)} />);
    fireEvent.press(screen.getByText('‹ Settings'));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Save')).toBeTruthy();
    expect(screen.queryByText('Continue')).toBeNull();
  });

  it('does not label an upcoming dishwasher task as due now', async () => {
    const action = getAction('dishwasher-filter-clean')!;
    const nextDueAt = new Date(Date.now() + 86400000).toISOString();
    await render(<Home actions={[action]} configurations={new Map([[action.id, { actionId: action.id, enabled: true, notificationsEnabled: true, nextDueAt }]])} language="en" now={Date.now()} onOpen={jest.fn()} onReportIssue={jest.fn()} />);
    expect(screen.getByText('Nothing needs your attention right now.')).toBeTruthy();
    expect(screen.queryByText('DUE NOW')).toBeNull();
    expect(screen.getByText('Clean the dishwasher filter')).toBeTruthy();
  });

  it('opens the Home-level report-issue entry point', async () => {
    const action = getAction('dishwasher-filter-clean')!;
    const onReportIssue = jest.fn();
    await render(<Home actions={[action]} configurations={new Map([[action.id, { actionId: action.id, enabled: true, notificationsEnabled: true, nextDueAt: new Date(Date.now() + 86400000).toISOString() }]])} language="en" now={Date.now()} onOpen={jest.fn()} onReportIssue={onReportIssue} />);
    fireEvent.press(screen.getByText('Report an issue'));
    expect(onReportIssue).toHaveBeenCalledTimes(1);
  });

  it('requires an issue title before saving', async () => {
    const onSubmit = jest.fn(async () => undefined);
    await render(<IssueForm title="" note="" actions={[]} language="en" onChooseAction={jest.fn()} onTitle={jest.fn()} onNote={jest.fn()} onPhoto={jest.fn()} onBack={jest.fn()} onSubmit={onSubmit} />);
    expect(screen.getByText('Related maintenance action')).toBeTruthy();
    expect(screen.getByText('None')).toBeTruthy();
    fireEvent.press(screen.getByText('Save issue'));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
