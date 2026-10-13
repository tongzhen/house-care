import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { IssueForm } from '../index';
import { orderedActiveActions } from '../../src/actionViews';
import { useAppState } from '../../src/appState';
import { recordIssue } from '../../src/service';
import { useEditorExit } from '../../src/editorExit';

export default function NewIssueRoute() {
  const { returnTo = '/home', actionId } = useLocalSearchParams<{ returnTo?: string; actionId?: string }>();
  const { state, setState, issueDraft, setIssueDraft, resetIssueDraft } = useAppState();
  const { registerExit, navigate } = useEditorExit();
  if (!state) return null;
  if (!state.profile) return <Redirect href="/setup" />;
  const draft = actionId && !issueDraft.actionId ? { ...issueDraft, actionId } : issueDraft;
  return <IssueForm registerExit={registerExit} title={draft.title} note={draft.note} photo={draft.photo} actions={orderedActiveActions(state)} language={state.settings.language} actionId={draft.actionId} onChooseAction={() => { if (actionId && !issueDraft.actionId) setIssueDraft(draft); router.push({ pathname: '/issues/select-action', params: { returnTo } }); }} onTitle={(title) => setIssueDraft({ ...draft, title })} onNote={(note) => setIssueDraft({ ...draft, note })} onPhoto={(photo) => setIssueDraft({ ...draft, photo })} onBack={() => { resetIssueDraft(); navigate(() => router.replace(returnTo)); }} onSubmit={async () => { setState(await recordIssue(draft.title, { actionId: draft.actionId, note: draft.note, photoUri: draft.photo })); resetIssueDraft(); navigate(() => router.replace(returnTo === '/seasonal' ? '/seasonal' : '/history')); }} />;
}
