import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { IssueDetail } from '../index';
import { useAppState } from '../../src/appState';
import { deleteIssuePhoto, deleteIssueRecord } from '../../src/service';

export default function IssueDetailRoute() {
  const { outcomeId } = useLocalSearchParams<{ outcomeId: string }>();
  const { state, setState } = useAppState();
  if (!state) return null;
  const outcome = state.outcomes.find((candidate) => candidate.id === outcomeId);
  if (!outcome) return <Redirect href="/history" />;
  return <IssueDetail outcome={outcome} language={state.settings.language} onBack={() => router.back()} onDeletePhoto={async () => { setState(await deleteIssuePhoto(outcome)); }} onDeleteIssue={async () => { setState(await deleteIssueRecord(outcome)); router.replace('/history'); }} />;
}
