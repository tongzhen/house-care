/* eslint-disable import/first */

jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn(), addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })), getLastNotificationResponseAsync: jest.fn(async () => null) }));
jest.mock('../../src/db', () => ({}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import '../../src/i18n';
import { ActionDetail, ActionList, ActionOverview, History, Home, IssueForm, Setup } from '../index';
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

  it('offers calendar export for scheduled actions but not habit actions', async () => {
    const action = getAction('dishwasher-filter-clean')!;
    const props = { configuration: { actionId: action.id, enabled: true, notificationsEnabled: true, nextDueAt: new Date(Date.now() + 86400000).toISOString() }, language: 'en' as const, onBack: jest.fn(), onDone: jest.fn(), onSnooze: jest.fn(), onCustomSnooze: jest.fn(async () => undefined), onNotRelevant: jest.fn(), onIssue: jest.fn(), onFrequency: jest.fn(async () => undefined), onEnabled: jest.fn(async () => undefined) };
    const view = await render(<ActionDetail action={action} {...props} />);
    expect(screen.getByText('Add to calendar')).toBeTruthy();

    await act(async () => { view.rerender(<ActionDetail action={{ ...action, trigger: { kind: 'habit' } }} {...props} />); });
    expect(screen.queryByText('Add to calendar')).toBeNull();
  });

  it('groups actions by category, filters status, and opens disabled details', async () => {
    const enabled = getAction('dishwasher-filter-clean')!;
    const disabled = getAction('dryer-lint-filter')!;
    const onOpen = jest.fn();
    await render(<ActionOverview actions={[enabled, disabled]} configurations={new Map([
      [enabled.id, { actionId: enabled.id, enabled: true, notificationsEnabled: true, nextDueAt: new Date(Date.now() + 86400000).toISOString() }],
      [disabled.id, { actionId: disabled.id, enabled: false, notificationsEnabled: true, nextDueAt: new Date(Date.now() + 86400000).toISOString() }],
    ])} profile={{ id: 'primary-home', appliances: ['dishwasher', 'tumble-dryer'], features: [], variants: {} }} language="en" onBack={jest.fn()} onOpen={onOpen} />);
    expect(screen.getAllByText('Appliance').length).toBeGreaterThan(0);
    expect(screen.getByText('Clean the tumble-dryer lint filter')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText('Disabled')); });
    await act(async () => { fireEvent.press(screen.getByText('Clean the tumble-dryer lint filter')); });
    expect(onOpen).toHaveBeenCalledWith(disabled.id);
    expect(screen.queryByText('Enable action')).toBeNull();
  });

  it('shows non-applicable actions without making them tappable', async () => {
    const action = getAction('dryer-lint-filter')!;
    const onOpen = jest.fn();
    await render(<ActionOverview actions={[action]} configurations={new Map()} profile={{ id: 'primary-home', appliances: ['dishwasher'], features: [], variants: {} }} language="en" onBack={jest.fn()} onOpen={onOpen} />);
    expect(screen.getByText(/Not available for this home/)).toBeTruthy();
    fireEvent.press(screen.getByText('Clean the tumble-dryer lint filter'));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('opens disabled action details with the enable control', async () => {
    const action = getAction('dryer-lint-filter')!;
    const onEnabled = jest.fn(async () => undefined);
    await render(<ActionDetail action={action} configuration={{ actionId: action.id, enabled: false, notificationsEnabled: true, nextDueAt: new Date(Date.now() + 86400000).toISOString() }} language="en" onBack={jest.fn()} onDone={jest.fn()} onSnooze={jest.fn()} onCustomSnooze={jest.fn(async () => undefined)} onNotRelevant={jest.fn()} onIssue={jest.fn()} onFrequency={jest.fn(async () => undefined)} onEnabled={onEnabled} />);
    await act(async () => { fireEvent.press(screen.getByText('Enable action')); });
    expect(onEnabled).toHaveBeenCalledWith(true);
  });

  it('filters history by action category', async () => {
    const dishwasher = getAction('dishwasher-filter-clean')!;
    const exterior = getAction('gutters-accessible-clean')!;
    await render(<History state={{ profile: null, configurations: [], settings: { language: 'en', notificationsEnabled: true, notificationSchedule: {} as never }, outcomes: [
      { id: 'done-dishwasher', actionId: dishwasher.id, type: 'done', occurredAt: new Date().toISOString() },
      { id: 'done-exterior', actionId: exterior.id, type: 'done', occurredAt: new Date().toISOString() },
    ] }} language="en" onOpenIssue={jest.fn()} />);
    expect(screen.getByText('Clean the dishwasher filter')).toBeTruthy();
    expect(screen.getByText('Clear accessible gutter debris')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText('Appliance')); });
    expect(screen.getByText('Clean the dishwasher filter')).toBeTruthy();
    expect(screen.queryByText('Clear accessible gutter debris')).toBeNull();
  });

  it('offers PDF export periods from history and reveals native-date-picker controls for custom dates', async () => {
    const dishwasher = getAction('dishwasher-filter-clean')!;
    await render(<History state={{ profile: { id: 'home', appliances: ['dishwasher'], features: [], variants: {} }, configurations: [], settings: { language: 'en', notificationsEnabled: true, notificationSchedule: {} as never }, outcomes: [
      { id: 'done-dishwasher', actionId: dishwasher.id, type: 'done', occurredAt: new Date().toISOString() },
    ] }} language="en" onOpenIssue={jest.fn()} />);
    expect(screen.getByText('Export PDF report')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText('Custom')); });
    expect(screen.getByText(/Start date:/)).toBeTruthy();
    expect(screen.getByText(/End date:/)).toBeTruthy();
  });

  it('filters the actions list by category', async () => {
    const appliance = getAction('dishwasher-filter-clean')!;
    const exterior = getAction('gutters-accessible-clean')!;
    await render(<ActionList actions={[appliance, exterior]} configurations={new Map()} language="en" onOpen={jest.fn()} />);
    expect(screen.getByText('Clean the dishwasher filter')).toBeTruthy();
    expect(screen.getByText('Clear accessible gutter debris')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText('Exterior')); });
    expect(screen.queryByText('Clean the dishwasher filter')).toBeNull();
    expect(screen.getByText('Clear accessible gutter debris')).toBeTruthy();
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
