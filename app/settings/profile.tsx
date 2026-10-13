import { Redirect, router } from 'expo-router';
import { ProfileEditor } from '../index';
import { useAppState } from '../../src/appState';
import { saveHomeProfile } from '../../src/service';
import { useEditorExit } from '../../src/editorExit';

export default function ProfileRoute() {
  const { state, setState } = useAppState();
  const { registerExit, navigate } = useEditorExit();
  if (!state) return null;
  if (!state.profile) return <Redirect href="/setup" />;
  return <ProfileEditor initial={state.profile} registerExit={registerExit} onBack={() => navigate(() => router.replace('/settings'))} onCommit={async (profile) => { setState(await saveHomeProfile(profile)); }} />;
}
