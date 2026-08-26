import { router } from 'expo-router';
import { About } from './index';
import { useAppState } from '../src/appState';

export default function AboutRoute() {
  const { state } = useAppState();
  if (!state) return null;
  return <About language={state.settings.language} onBack={() => router.back()} onOpenDocument={(documentId) => router.push({ pathname: '/legal/[documentId]', params: { documentId } })} />;
}
