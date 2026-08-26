import { Redirect, router } from 'expo-router';
import { Settings } from '../index';
import { useAppState } from '../../src/appState';
import { resetAppData } from '../../src/service';

export default function SettingsRoute() {
  const { state, setState } = useAppState();
  if (!state) return null;
  if (!state.profile) return <Redirect href="/setup" />;
  return <Settings state={state} onState={setState} onEditProfile={() => router.push('/settings/profile')} onOpenActions={() => router.push('/settings/actions')} onOpenNotifications={() => router.push('/settings/notifications')} onOpenAbout={() => router.push('/about')} onOpenDebug={() => router.push('/settings/notification-debug')} onReset={async () => { setState(await resetAppData()); router.replace('/setup'); }} />;
}
