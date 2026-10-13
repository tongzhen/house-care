import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useAppState } from '../src/appState';
import { SeasonalChecklist } from '../src/seasonalView';

export default function SeasonalRoute() {
  const { state, refresh } = useAppState();
  const [now, setNow] = useState(Date.now);
  useFocusEffect(useCallback(() => { setNow(Date.now()); void refresh(); }, [refresh]));
  if (!state) return null;
  if (!state.profile) return <Redirect href="/setup" />;
  return <SeasonalChecklist state={state} now={now} onBack={() => router.replace('/actions')} onOpen={(actionId) => router.push({ pathname: '/actions/[actionId]', params: { actionId, returnTo: '/seasonal' } })} />;
}
