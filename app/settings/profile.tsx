import { Redirect, router } from 'expo-router';
import { Setup } from '../index';
import { useAppState } from '../../src/appState';
import { saveHomeProfile } from '../../src/service';

export default function ProfileRoute() {
  const { state, setState } = useAppState();
  if (!state) return null;
  if (!state.profile) return <Redirect href="/setup" />;
  return <Setup initial={state.profile} onBack={() => router.replace('/settings')} onCommit={async (profile) => { setState(await saveHomeProfile(profile)); }} />;
}
