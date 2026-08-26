import { Redirect, router } from 'expo-router';
import { History } from '../index';
import { useAppState } from '../../src/appState';

export default function HistoryRoute() {
  const { state } = useAppState();
  if (!state) return null;
  if (!state.profile) return <Redirect href="/setup" />;
  return <History state={state} language={state.settings.language} onOpenReport={() => router.push('/reports/new')} onOpenIssue={(outcome) => router.push({ pathname: '/issues/[outcomeId]', params: { outcomeId: outcome.id } })} />;
}
