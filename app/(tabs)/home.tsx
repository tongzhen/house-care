import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Home } from '../index';
import { configurationMap, orderedActiveActions } from '../../src/actionViews';
import { useAppState } from '../../src/appState';

export default function HomeRoute() {
  const { state, refresh } = useAppState();
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(useCallback(() => { setNow(Date.now()); void refresh(); }, [refresh]));
  if (!state) return null;
  if (!state.profile) return <Redirect href="/setup" />;
  const configurations = configurationMap(state);
  return <Home actions={orderedActiveActions(state, configurations)} configurations={configurations} language={state.settings.language} now={now} onOpen={(actionId) => router.push({ pathname: '/actions/[actionId]', params: { actionId, returnTo: '/home' } })} onOpenSeasonal={() => router.push('/seasonal')} onReportIssue={() => router.push({ pathname: '/issues/new', params: { returnTo: '/home' } })} />;
}
