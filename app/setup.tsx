import { Redirect, router } from 'expo-router';
import { Setup } from './index';
import { useAppState } from '../src/appState';
import { saveHomeProfile } from '../src/service';

export default function SetupRoute() {
  const { state, setState } = useAppState();
  if (!state) return null;
  if (state.profile) return <Redirect href="/home" />;
  return <Setup onSave={async (profile) => { setState(await saveHomeProfile(profile)); router.replace('/home'); }} />;
}
