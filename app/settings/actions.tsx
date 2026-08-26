import { Redirect, router } from 'expo-router';
import { ActionOverview } from '../index';
import { configurationMap } from '../../src/actionViews';
import { useAppState } from '../../src/appState';
import { actions } from '../../src/catalog';

export default function ActionsOverviewRoute() {
  const { state } = useAppState();
  if (!state) return null;
  if (!state.profile) return <Redirect href="/setup" />;
  return <ActionOverview actions={actions} configurations={configurationMap(state)} profile={state.profile} language={state.settings.language} onBack={() => router.back()} onOpen={(actionId) => router.push({ pathname: '/actions/[actionId]', params: { actionId, returnTo: '/settings/actions' } })} />;
}
