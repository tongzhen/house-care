/* eslint-disable import/first */

jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('expo-image-picker', () => ({}));
jest.mock('../../src/media', () => ({ selectIssuePhoto: jest.fn(async (uri?: string) => uri), discardIssuePhoto: jest.fn(async () => undefined) }));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '0.1.0', nativeBuildVersion: '42' }));
jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn(), addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })), getLastNotificationResponseAsync: jest.fn(async () => null) }));
jest.mock('../../src/db', () => ({}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import i18n from '../../src/i18n';
import { ActionDetail, ActionList, ActionOverview, CustomFrequency, History, Home, IssueActionSelect, IssueForm, NotificationSettings, ReportExport, Setup, isSwipeBackGesture } from '../index';
import { getAction } from '../../src/catalog';
import { defaultNotificationSchedule } from '../../src/notificationSchedule';
import { discardIssuePhoto } from '../../src/media';

describe('setup flow', () => {
  it('provides Danish translations for all shared Index screen copy', async () => {
    await i18n.changeLanguage('da');
    try {
      ['homeHeadline', 'minutesShort', 'resetAppData', 'resetConfirmTitle', 'resetConfirmBody', 'notificationPermissionDenied', 'development', 'languages.english', 'languages.danish', 'frequencyUnits.day.one', 'frequencyUnits.day.other', 'frequencyUnits.week.one', 'frequencyUnits.week.other', 'frequencyUnits.month.one', 'frequencyUnits.month.other', 'frequencyUnits.year.one', 'frequencyUnits.year.other', 'accessibility.dishwasherFilterIcon', 'accessibility.actionIcon', 'backup.export', 'backup.import', 'backup.exportFailedTitle', 'backup.exportFailed', 'backup.importFailedTitle', 'backup.importFailed', 'permissionStates.unknown', 'permissionStates.granted', 'permissionStates.denied', 'legal.copyrightFallback'].forEach((key) => expect(i18n.t(key)).not.toBe(key));
    } finally {
      await i18n.changeLanguage('en');
    }
  });

  it('localizes every Home Profile label and option in Danish', async () => {
    await i18n.changeLanguage('da');
    const view = await render(<Setup initial={null} onSave={jest.fn(async () => undefined)} />);

    try {
      ['Boligtype', 'Fritstående hus', 'Rækkehus', 'Apparater', 'Boligens funktioner', 'Tagrender', 'Faskine', 'Pumpebrønd', 'Udendørs vandhane', 'Ventilation', 'Gulvvarme', 'Trægulve', 'Gulvafløb'].forEach((label) => expect(screen.getByText(label)).toBeTruthy());
      await act(async () => { fireEvent.press(screen.getByText('Tørretumbler')); });
      expect(await screen.findByText('Type af tørretumbler')).toBeTruthy();
      expect(screen.getByText('Med aftræk')).toBeTruthy();
      await act(async () => { fireEvent.press(screen.getByText('Emhætte')); });
      expect(await screen.findByText('Type af emhætte')).toBeTruthy();
      expect(screen.getByText('Recirkulerende')).toBeTruthy();
      expect(screen.getByText('Med aftræk til det fri')).toBeTruthy();
    } finally {
      view.unmount();
      await i18n.changeLanguage('en');
    }
  });

  it('saves a selected dishwasher profile', async () => {
    const onSave = jest.fn(async () => undefined);
    await render(<Setup initial={null} onSave={onSave} />);
    fireEvent.press(screen.getByText('Continue'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ appliances: ['dishwasher'], houseType: 'detached' }));
  });

  it('explains missing required profile details instead of silently disabling setup', async () => {
    const onSave = jest.fn(async () => undefined);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<Setup initial={null} onSave={onSave} />);
    await act(async () => { fireEvent.press(screen.getByText('Dishwasher')); });
    await act(async () => { fireEvent.press(screen.getByText('Continue')); });
    expect(alert).toHaveBeenCalledWith('Make care fit your home.', 'Choose at least one appliance to continue.');
    expect(onSave).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('stores a selected appliance variant for catalogue eligibility', async () => {
    const onSave = jest.fn(async () => undefined);
    await render(<Setup initial={null} onSave={onSave} />);
    await act(async () => { fireEvent.press(screen.getByText('Tumble dryer')); });
    await act(async () => { fireEvent.press(await screen.findByText('Vented')); });
    fireEvent.press(screen.getByText('Continue'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ variants: { tumbleDryer: 'vented' } }));
  });

  it('commits an edited profile only when leaving Settings', async () => {
    const onBack = jest.fn();
    const onCommit = jest.fn(async () => undefined);
    await render(<Setup initial={{ id: 'primary-home', houseType: 'detached', appliances: ['dishwasher'], features: [], variants: {} }} onBack={onBack} onCommit={onCommit} />);
    await act(async () => { fireEvent.press(screen.getByText('Washing machine')); });
    expect(onCommit).not.toHaveBeenCalled();
    await act(async () => { fireEvent.press(screen.getByText('‹ Settings')); });
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({ appliances: ['dishwasher', 'washing-machine'] }));
    expect(screen.queryByText('Save')).toBeNull();
    expect(screen.queryByText('Continue')).toBeNull();
  });

  it('commits notification settings only when leaving', async () => {
    const onSettings = jest.fn(async () => undefined);
    const onBack = jest.fn();
    const settings = { language: 'en' as const, notificationsEnabled: true, notificationSchedule: defaultNotificationSchedule() };
    await render(<NotificationSettings settings={settings} onSettings={onSettings} onBack={onBack} />);
    expect(onSettings).not.toHaveBeenCalled();
    await act(async () => { fireEvent.press(screen.getByText('‹ Settings')); });
    expect(onSettings).toHaveBeenCalledWith(settings);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('recognizes only deliberate edge swipe-back gestures', () => {
    expect(isSwipeBackGesture(10, 90, 5)).toBe(true);
    expect(isSwipeBackGesture(40, 90, 5)).toBe(false);
    expect(isSwipeBackGesture(10, 90, 100)).toBe(false);
  });

  it('does not label an upcoming dishwasher task as due now', async () => {
    const action = getAction('dishwasher-filter-clean')!;
    const nextDueAt = new Date(Date.now() + 86400000).toISOString();
    await render(<Home actions={[action]} configurations={new Map([[action.id, { actionId: action.id, enabled: true, notificationsEnabled: true, nextDueAt }]])} language="en" now={Date.now()} onOpen={jest.fn()} onReportIssue={jest.fn()} />);
    expect(screen.getByText('Nothing needs your attention right now.')).toBeTruthy();
    expect(screen.queryByText('DUE NOW')).toBeNull();
    expect(screen.getByText('Clean the dishwasher filter')).toBeTruthy();
  });

  it('shows after-use actions separately from scheduled attention', async () => {
    const scheduled = getAction('dishwasher-filter-clean')!;
    const habit = getAction('dryer-lint-filter')!;
    await render(<Home actions={[scheduled, habit]} configurations={new Map([
      [scheduled.id, { actionId: scheduled.id, enabled: true, notificationsEnabled: true, nextDueAt: new Date(Date.now() + 86400000).toISOString() }],
      [habit.id, { actionId: habit.id, enabled: true, notificationsEnabled: false }],
    ])} language="en" now={Date.now()} onOpen={jest.fn()} onReportIssue={jest.fn()} />);
    expect(screen.getByText('After each use')).toBeTruthy();
    expect(screen.getByText('Clean the tumble-dryer lint filter')).toBeTruthy();
    expect(screen.queryByText('DUE NOW')).toBeNull();
  });

  it('opens the Home-level report-issue entry point', async () => {
    const action = getAction('dishwasher-filter-clean')!;
    const onReportIssue = jest.fn();
    await render(<Home actions={[action]} configurations={new Map([[action.id, { actionId: action.id, enabled: true, notificationsEnabled: true, nextDueAt: new Date(Date.now() + 86400000).toISOString() }]])} language="en" now={Date.now()} onOpen={jest.fn()} onReportIssue={onReportIssue} />);
    fireEvent.press(screen.getByText('Report an issue'));
    expect(onReportIssue).toHaveBeenCalledTimes(1);
  });

  it('opens the calendar editor for scheduled actions but not habit actions', async () => {
    const action = getAction('dishwasher-filter-clean')!;
    const props = { configuration: { actionId: action.id, enabled: true, notificationsEnabled: true, nextDueAt: new Date(Date.now() + 86400000).toISOString() }, language: 'en' as const, onBack: jest.fn(), onDone: jest.fn(), onSnooze: jest.fn(), onCustomSnooze: jest.fn(async () => undefined), onIssue: jest.fn(), onFrequency: jest.fn(async () => undefined), onEnabled: jest.fn(async () => undefined) };
    const view = await render(<ActionDetail action={action} {...props} />);
    expect(screen.getByText('Open in calendar')).toBeTruthy();
    expect(screen.queryByText('Not relevant')).toBeNull();

    await act(async () => { view.rerender(<ActionDetail action={{ ...action, trigger: { kind: 'habit' } }} {...props} />); });
    expect(screen.queryByText('Open in calendar')).toBeNull();
  });

  it('uses the Actions return destination when an action detail was opened from the Actions tab', async () => {
    const action = getAction('dishwasher-filter-clean')!;
    await render(<ActionDetail action={action} configuration={{ actionId: action.id, enabled: true, notificationsEnabled: true, nextDueAt: new Date(Date.now() + 86400000).toISOString() }} language="en" returnView="actions" onBack={jest.fn()} onDone={jest.fn()} onSnooze={jest.fn()} onCustomSnooze={jest.fn(async () => undefined)} onIssue={jest.fn()} onFrequency={jest.fn(async () => undefined)} onEnabled={jest.fn(async () => undefined)} />);
    expect(screen.getByText('‹ Actions')).toBeTruthy();
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
    await render(<ActionDetail action={action} configuration={{ actionId: action.id, enabled: false, notificationsEnabled: true, nextDueAt: new Date(Date.now() + 86400000).toISOString() }} language="en" onBack={jest.fn()} onDone={jest.fn()} onSnooze={jest.fn()} onCustomSnooze={jest.fn(async () => undefined)} onIssue={jest.fn()} onFrequency={jest.fn(async () => undefined)} onEnabled={onEnabled} />);
    await act(async () => { fireEvent.press(screen.getByText('Enable action')); });
    expect(onEnabled).toHaveBeenCalledWith(true);
  });

  it('filters history by action category', async () => {
    const dishwasher = getAction('dishwasher-filter-clean')!;
    const exterior = getAction('gutters-accessible-clean')!;
    await render(<History state={{ profile: null, configurations: [], settings: { language: 'en', notificationsEnabled: true, notificationSchedule: {} as never }, outcomes: [
      { id: 'done-dishwasher', actionId: dishwasher.id, type: 'done', occurredAt: new Date().toISOString() },
      { id: 'done-exterior', actionId: exterior.id, type: 'done', occurredAt: new Date().toISOString() },
    ] }} language="en" onOpenReport={jest.fn()} onOpenIssue={jest.fn()} />);
    expect(screen.getByText('Clean the dishwasher filter')).toBeTruthy();
    expect(screen.getByText('Clear accessible gutter debris')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText('Appliance')); });
    expect(screen.getByText('Clean the dishwasher filter')).toBeTruthy();
    expect(screen.queryByText('Clear accessible gutter debris')).toBeNull();
  });

  it('opens the compact maintenance-report entry from history', async () => {
    const dishwasher = getAction('dishwasher-filter-clean')!;
    const onOpenReport = jest.fn();
    await render(<History state={{ profile: { id: 'home', appliances: ['dishwasher'], features: [], variants: {} }, configurations: [], settings: { language: 'en', notificationsEnabled: true, notificationSchedule: {} as never }, outcomes: [
      { id: 'done-dishwasher', actionId: dishwasher.id, type: 'done', occurredAt: new Date().toISOString() },
    ] }} language="en" onOpenReport={onOpenReport} onOpenIssue={jest.fn()} />);
    fireEvent.press(screen.getByText('Export maintenance report'));
    expect(onOpenReport).toHaveBeenCalledTimes(1);
  });

  it('shows compact report periods and custom native-date-picker controls', async () => {
    const dishwasher = getAction('dishwasher-filter-clean')!;
    await render(<ReportExport state={{ profile: { id: 'home', appliances: ['dishwasher'], features: [], variants: {} }, configurations: [], settings: { language: 'en', notificationsEnabled: true, notificationSchedule: {} as never }, outcomes: [
      { id: 'done-dishwasher', actionId: dishwasher.id, type: 'done', occurredAt: new Date().toISOString() },
    ] }} language="en" onBack={jest.fn()} />);
    expect(screen.getByText('Report period')).toBeTruthy();
    expect(screen.getByText('Export PDF report')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByText('Custom')); });
    expect(screen.getByText(/Start date:/)).toBeTruthy();
    expect(screen.getByText(/End date:/)).toBeTruthy();
  });

  it('shows empty-period feedback and returns to history from report export', async () => {
    const onBack = jest.fn();
    await render(<ReportExport state={{ profile: { id: 'home', appliances: ['dishwasher'], features: [], variants: {} }, configurations: [], settings: { language: 'en', notificationsEnabled: true, notificationSchedule: {} as never }, outcomes: [] }} language="en" onBack={onBack} />);
    expect(screen.getByText(/No completed maintenance or reported issues were found in this period/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export PDF report' }).props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(screen.getByText('‹ History'));
    expect(onBack).toHaveBeenCalledTimes(1);
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

  it('deletes a draft photo when issue entry is cancelled', async () => {
    const onBack = jest.fn();
    const onPhoto = jest.fn();
    await render(<IssueForm title="Leak" note="" photo="file:///documents/issue-draft.jpg" actions={[]} language="en" onChooseAction={jest.fn()} onTitle={jest.fn()} onNote={jest.fn()} onPhoto={onPhoto} onBack={onBack} onSubmit={jest.fn(async () => undefined)} />);

    await act(async () => { fireEvent.press(screen.getByText('‹ Cancel')); });

    expect(discardIssuePhoto).toHaveBeenCalledWith('file:///documents/issue-draft.jpg');
    expect(onPhoto).toHaveBeenCalledWith(undefined);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders custom frequency defaults', async () => {
    const action = getAction('dishwasher-filter-clean')!;
    await render(<CustomFrequency action={action} configuration={{ actionId: action.id, enabled: true, notificationsEnabled: true, nextDueAt: new Date().toISOString() }} language="en" onBack={jest.fn()} onSave={jest.fn(async () => undefined)} />);
    expect(screen.getByText('Custom frequency')).toBeTruthy();
    expect(screen.getByText(/Next reminder:/)).toBeTruthy();
  });

  it('renders related-action choices', async () => {
    const action = getAction('dishwasher-filter-clean')!;
    await render(<IssueActionSelect actions={[action]} language="en" onBack={jest.fn()} onSelect={jest.fn()} />);
    expect(screen.getByText('None')).toBeTruthy();
    expect(screen.getByText('Clean the dishwasher filter')).toBeTruthy();
  });

});
