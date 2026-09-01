import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ActionDetail } from '../index';
import { configurationMap } from '../../src/actionViews';
import { useAppState } from '../../src/appState';
import { getAction } from '../../src/catalog';
import { recordOutcome, setActionEnabled, updateFrequency } from '../../src/service';

export default function ActionDetailRoute() {
  const { actionId, returnTo = '/home' } = useLocalSearchParams<{ actionId: string; returnTo?: '/home' | '/actions' | '/settings/actions' }>();
  const { state, setState } = useAppState();
  if (!state) return null;
  if (!state.profile) return <Redirect href="/setup" />;
  const action = getAction(actionId);
  const configuration = configurationMap(state).get(actionId);
  if (!action || !configuration) return <Redirect href="/actions" />;
  const complete = async (type: 'done' | 'snoozed', snoozeDays?: number, snoozedUntil?: string) => {
    setState(await recordOutcome(actionId, type, { snoozeDays, snoozedUntil }));
    router.replace(type === 'done' ? '/history' : returnTo);
  };
  return <ActionDetail action={action} configuration={configuration} language={state.settings.language} returnView={returnTo === '/actions' ? 'actions' : returnTo === '/settings/actions' ? 'actions-overview' : 'home'} onBack={() => router.replace(returnTo)} onDone={() => complete('done')} onSnooze={(days) => complete('snoozed', days)} onCustomSnooze={async (snoozedUntil) => { setState(await recordOutcome(actionId, 'snoozed', { snoozedUntil })); }} onIssue={() => router.push({ pathname: '/issues/new', params: { actionId, returnTo } })} onCustomFrequency={() => router.push({ pathname: '/actions/[actionId]/frequency', params: { actionId, returnTo } })} onFrequency={async (frequency) => { setState(await updateFrequency(actionId, frequency)); }} onEnabled={async (enabled) => { setState(await setActionEnabled(actionId, enabled)); }} />;
}
