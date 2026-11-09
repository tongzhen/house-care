/* eslint-disable import/first */
jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-application', () => ({
  nativeApplicationVersion: '0.1.0',
  nativeBuildVersion: '42',
}));
jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn() }));
jest.mock('../../src/db', () => ({}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';
import i18n from '../../src/i18n';
import { actions, getAction } from '../../src/catalog';
import { ActionDetail, ActionList, Home } from '../index';
import type { ActionConfiguration } from '../../src/types';

const action = getAction('gutters-ground-check')!;
const configuration: ActionConfiguration = {
  actionId: action.id,
  enabled: true,
  notificationsEnabled: true,
  nextDueAt: '2020-01-01T09:00:00Z',
};
function detail(language: 'en' | 'da', config = configuration) {
  return (
    <ActionDetail
      action={action}
      configuration={config}
      language={language}
      onBack={jest.fn()}
      onDone={jest.fn(async () => undefined)}
      onSnooze={jest.fn(async () => undefined)}
      onCustomSnooze={jest.fn(async () => undefined)}
      onIssue={jest.fn()}
      onFrequency={jest.fn(async () => undefined)}
      onEnabled={jest.fn(async () => undefined)}
    />
  );
}

afterEach(async () => {
  jest.restoreAllMocks();
  await i18n.changeLanguage('en');
});

describe('maintenance explanation in task details', () => {
  it.each(['en', 'da'] as const)(
    'shows complete guidance and source attribution in %s',
    async (language) => {
      await i18n.changeLanguage(language);
      await render(detail(language));
      const copy = action.content[language]!;
      expect(
        screen.getByText(i18n.t('maintenance.priority.high')),
      ).toBeTruthy();
      for (const text of [
        copy.priorityReason,
        copy.whyItMatters,
        copy.delayConsequences,
        copy.careGuidance,
        copy.manualNote,
        copy.escalationGuidance,
        ...copy.steps,
        ...copy.safetyRestrictions,
      ]) {
        expect(screen.getByText(text)).toBeTruthy();
      }
      for (const sign of copy.normalSigns)
        expect(screen.getByText(`• ${sign}`)).toBeTruthy();
      expect(screen.getByText(copy.concerningSigns.join(' '))).toBeTruthy();
      expect(
        screen.getByText(i18n.t('maintenance.manualPrecedence')),
      ).toBeTruthy();
      expect(
        screen.getByRole('link', {
          name: `${action.sources[0].title} · ${action.sources[0].publisher}`,
        }),
      ).toBeTruthy();
      expect(screen.getByText(i18n.t('done'))).toBeTruthy();
      expect(screen.getByText(i18n.t('issue'))).toBeTruthy();
    },
  );

  it('keeps curated priority when an overdue task is snoozed', async () => {
    const { rerender } = await render(detail('en'));
    expect(screen.getByText('High priority')).toBeTruthy();
    await rerender(
      detail('en', { ...configuration, snoozedUntil: '2099-01-01T09:00:00Z' }),
    );
    expect(screen.getByText('High priority')).toBeTruthy();
    expect(screen.getByText(action.content.en.priorityReason)).toBeTruthy();
  });

  it('opens the exact source URL only when the link is pressed', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await render(detail('en'));
    expect(open).not.toHaveBeenCalled();
    await act(async () => fireEvent.press(screen.getAllByRole('link')[0]));
    expect(open).toHaveBeenCalledWith(action.sources[0].url);
  });

  it.each(['en', 'da'] as const)(
    'handles a source-opening failure in %s without losing guidance',
    async (language) => {
      await i18n.changeLanguage(language);
      jest
        .spyOn(Linking, 'openURL')
        .mockRejectedValue(new Error('unavailable'));
      const alert = jest
        .spyOn(Alert, 'alert')
        .mockImplementation(() => undefined);
      await render(detail(language));
      await act(async () => fireEvent.press(screen.getAllByRole('link')[0]));
      expect(alert).toHaveBeenCalledWith(
        i18n.t('maintenance.sources'),
        i18n.t('maintenance.sourceFailed'),
      );
      expect(
        screen.getByText(action.content[language]!.delayConsequences),
      ).toBeTruthy();
      expect(screen.getByText(i18n.t('done'))).toBeTruthy();
    },
  );

  it('keeps priority out of Home and task cards', async () => {
    await render(
      <>
        <Home
          actions={[action]}
          configurations={new Map([[action.id, configuration]])}
          language="en"
          now={Date.now()}
          onOpen={jest.fn()}
          onReportIssue={jest.fn()}
        />
        <ActionList
          actions={actions}
          configurations={new Map([[action.id, configuration]])}
          language="en"
          onOpen={jest.fn()}
        />
      </>,
    );
    expect(screen.queryByText(/^(High|Medium|Low) priority$/)).toBeNull();
  });
});
