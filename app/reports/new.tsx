import { router } from 'expo-router';
import { ReportExport } from '../index';
import { useAppState } from '../../src/appState';

export default function ReportRoute() {
  const { state } = useAppState();
  if (!state) return null;
  return <ReportExport state={state} language={state.settings.language} onBack={() => router.back()} />;
}
