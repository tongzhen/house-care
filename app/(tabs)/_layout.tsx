import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { attentionCount } from '../../src/actionViews';
import { useAppState } from '../../src/appState';

export default function TabLayout() {
  const { t } = useTranslation();
  const { state } = useAppState();
  const badge = state ? attentionCount(state) : 0;
  return <Tabs screenOptions={{ headerShown: false }}>
    <Tabs.Screen name="home" options={{ title: t('home') }} />
    <Tabs.Screen name="actions" options={{ title: t('actions'), tabBarBadge: badge || undefined }} />
    <Tabs.Screen name="history" options={{ title: t('history') }} />
    <Tabs.Screen name="settings" options={{ title: t('settings') }} />
  </Tabs>;
}
