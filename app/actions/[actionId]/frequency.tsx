import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { CustomFrequency } from '../../index';
import { configurationMap } from '../../../src/actionViews';
import { useAppState } from '../../../src/appState';
import { getAction } from '../../../src/catalog';
import { updateFrequency } from '../../../src/service';
import { useEditorExit } from '../../../src/editorExit';

export default function CustomFrequencyRoute() {
  const { actionId, returnTo = '/home' } = useLocalSearchParams<{ actionId: string; returnTo?: string }>();
  const { state, setState } = useAppState();
  const { registerExit, navigate } = useEditorExit();
  if (!state) return null;
  const action = getAction(actionId);
  const configuration = configurationMap(state).get(actionId);
  if (!state.profile || !action || !configuration) return <Redirect href="/home" />;
  const detailPath = { pathname: '/actions/[actionId]' as const, params: { actionId, returnTo } };
  return <CustomFrequency registerExit={registerExit} action={action} configuration={configuration} language={state.settings.language} onBack={() => navigate(() => router.replace(detailPath))} onSave={async (frequency) => { setState(await updateFrequency(actionId, frequency)); navigate(() => router.replace(detailPath)); }} />;
}
