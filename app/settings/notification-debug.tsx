import { router } from 'expo-router';
import { NotificationDebug } from '../index';
import { useAppState } from '../../src/appState';

export default function NotificationDebugRoute() {
  const { state, setState } = useAppState();
  if (!state) return null;
  return <NotificationDebug state={state} onBack={() => router.back()} onState={setState} />;
}
