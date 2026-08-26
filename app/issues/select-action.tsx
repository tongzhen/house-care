import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { IssueActionSelect } from '../index';
import { orderedActiveActions } from '../../src/actionViews';
import { useAppState } from '../../src/appState';

export default function SelectIssueActionRoute() {
  const { returnTo = '/home' } = useLocalSearchParams<{ returnTo?: string }>();
  const { state, issueDraft, setIssueDraft } = useAppState();
  if (!state) return null;
  if (!state.profile) return <Redirect href="/setup" />;
  return <IssueActionSelect actions={orderedActiveActions(state)} language={state.settings.language} onBack={() => router.back()} onSelect={(actionId) => { setIssueDraft({ ...issueDraft, actionId }); router.replace({ pathname: '/issues/new', params: { returnTo } }); }} />;
}
