import { Redirect, router } from 'expo-router';
import { NotificationSettings } from '../index';
import { useAppState } from '../../src/appState';
import { updateSettings } from '../../src/service';

export default function NotificationSettingsRoute() {
  const { state, setState } = useAppState();
  if (!state) return null;
  if (!state.profile) return <Redirect href="/setup" />;
  return <NotificationSettings settings={state.settings} onBack={() => router.back()} onSettings={async (settings) => { setState(await updateSettings(settings)); }} />;
}
