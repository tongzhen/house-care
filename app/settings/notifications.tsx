import { Redirect, router } from 'expo-router';
import { NotificationSettings } from '../index';
import { useAppState } from '../../src/appState';
import { updateSettings } from '../../src/service';
import { useEditorExit } from '../../src/editorExit';

export default function NotificationSettingsRoute() {
  const { state, setState } = useAppState();
  const { registerExit, navigate } = useEditorExit();
  if (!state) return null;
  if (!state.profile) return <Redirect href="/setup" />;
  return <NotificationSettings settings={state.settings} registerExit={registerExit} onBack={() => navigate(() => router.back())} onSettings={async (settings) => { setState(await updateSettings(settings)); }} />;
}
