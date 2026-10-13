import { act, fireEvent, render, screen } from '@testing-library/react-native';
import i18n from '../i18n';
import { actions } from '../catalog';
import { defaultNotificationSchedule } from '../notificationSchedule';
import { configurationAfterCompletion, reconcileSeasonalConfiguration } from '../seasonalScheduling';
import { SeasonalChecklist } from '../seasonalView';
import type { AppState } from '../service';
const now = new Date(2026, 9, 13, 12);
const state: AppState = {
  profile: { id: 'home', features: ['gutters', 'underfloor-heating', 'outdoor-tap'], appliances: [], variants: {} },
  configurations: actions.filter((a) => a.trigger.kind === 'seasonal').map((a) => reconcileSeasonalConfiguration(a, { actionId: a.id, enabled: true, notificationsEnabled: true }, [], now)),
  outcomes: [], settings: { language: 'en', notificationsEnabled: false, notificationSchedule: defaultNotificationSchedule() },
};
beforeEach(async () => { await i18n.changeLanguage('en'); });
it('shows due and upcoming checks offline even with notifications disabled', async () => {
  const onOpen = jest.fn();
  await render(<SeasonalChecklist state={state} now={now.getTime()} onBack={jest.fn()} onOpen={onOpen} />);
  expect(screen.getByText('Autumn care')).toBeTruthy();
  expect(screen.getByText('3 checks need attention')).toBeTruthy();
  expect(screen.getByText('Clear accessible gutter debris')).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByText('Prepare the outdoor tap for frost')));
  expect(onOpen).toHaveBeenCalledWith('outdoor-tap-winter-check');
  await act(async () => fireEvent.press(screen.getByRole('tab', { name: 'Summer' })));
  expect(screen.getByText('No seasonal checks scheduled')).toBeTruthy();
});
it('shows completed tasks and their next seasonal dates', async () => {
  const action = actions.find((a) => a.id === 'outdoor-tap-winter-check')!;
  const completed: AppState = { ...state, configurations: state.configurations.map((c) => c.actionId === action.id ? configurationAfterCompletion(action, c, now) : c), outcomes: [{ id: 'done', actionId: action.id, type: 'done', occurredAt: now.toISOString() }] };
  await render(<SeasonalChecklist state={completed} now={now.getTime()} onBack={jest.fn()} onOpen={jest.fn()} />);
  expect(screen.getByText('2 checks need attention')).toBeTruthy();
  expect(screen.getByText(/Last completed:/)).toBeTruthy();
  expect(screen.getAllByText('Completed')).toHaveLength(2);
});
it('keeps overdue spring checks visible in the current summer view', async () => {
  const summer = new Date(2027, 6, 13);
  const spring = { ...state, configurations: state.configurations.filter((c) => c.actionId === 'gutters-ground-check').map((c) => ({ ...c, seasonalDueDate: '2027-03-01', nextDueAt: new Date(2027, 2, 1, 9).toISOString() })) };
  await render(<SeasonalChecklist state={spring} now={summer.getTime()} onBack={jest.fn()} onOpen={jest.fn()} />);
  expect(screen.getByText('Summer care')).toBeTruthy();
  expect(screen.getByText('Overdue')).toBeTruthy();
});
it('filters disabled and custom-interval actions and localizes Danish labels', async () => {
  await i18n.changeLanguage('da');
  const customized: AppState = { ...state, settings: { ...state.settings, language: 'da' }, configurations: state.configurations.map((c) => c.actionId === 'outdoor-tap-winter-check' ? { ...c, enabled: false } : c.actionId === 'underfloor-heating-visual-check' ? { ...c, frequencyOverride: { interval: 1, unit: 'month' } } : c) };
  await render(<SeasonalChecklist state={customized} now={now.getTime()} onBack={jest.fn()} onOpen={jest.fn()} />);
  expect(screen.getByText('Efterårsopgaver')).toBeTruthy();
  expect(screen.getByText('1 tjek kræver opmærksomhed')).toBeTruthy();
  expect(screen.queryByText('Gør den udvendige vandhane klar til frost')).toBeNull();
});
