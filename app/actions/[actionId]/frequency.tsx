import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { CustomFrequency } from '../../index';
import { configurationMap } from '../../../src/actionViews';
import { useAppState } from '../../../src/appState';
import { getAction } from '../../../src/catalog';
import { updateFrequency } from '../../../src/service';

export default function CustomFrequencyRoute() {
  const { actionId, returnTo = '/home' } = useLocalSearchParams<{ actionId: string; returnTo?: string }>();
  const { state, setState } = useAppState();
  if (!state) return null;
  const action = getAction(actionId);
  const configuration = configurationMap(state).get(actionId);
  if (!state.profile || !action || !configuration) return <Redirect href="/home" />;
  const detailPath = { pathname: '/actions/[actionId]' as const, params: { actionId, returnTo } };
  return <CustomFrequency action={action} configuration={configuration} language={state.settings.language} onBack={() => router.replace(detailPath)} onSave={async (frequency) => { setState(await updateFrequency(actionId, frequency)); router.replace(detailPath); }} />;
}
