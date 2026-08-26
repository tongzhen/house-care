import { Redirect, router } from 'expo-router';
import { ActionList } from '../index';
import { configurationMap, orderedActiveActions } from '../../src/actionViews';
import { useAppState } from '../../src/appState';

export default function ActionsRoute() {
  const { state } = useAppState();
  if (!state) return null;
  if (!state.profile) return <Redirect href="/setup" />;
  const configurations = configurationMap(state);
  return <ActionList actions={orderedActiveActions(state, configurations)} configurations={configurations} language={state.settings.language} onOpen={(actionId) => router.push({ pathname: '/actions/[actionId]', params: { actionId, returnTo: '/actions' } })} />;
}
