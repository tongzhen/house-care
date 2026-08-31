import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, type ColorValue } from 'react-native';
import { attentionCount } from '../../src/actionViews';
import { useAppState } from '../../src/appState';

const tabIcons = {
  home: '⌂',
  actions: '✓',
  history: '◷',
  settings: '⚙',
} as const;

export function TabIcon({ name, color }: { name: keyof typeof tabIcons; color: ColorValue }) {
  return <Text accessibilityElementsHidden style={{ color, fontSize: 23, fontWeight: '700', lineHeight: 26 }}>{tabIcons[name]}</Text>;
}

export default function TabLayout() {
  const { t } = useTranslation();
  const { state } = useAppState();
  const badge = state ? attentionCount(state) : 0;
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#1F5547', tabBarInactiveTintColor: '#687B72' }}>
    <Tabs.Screen name="home" options={{ title: t('home'), tabBarIcon: ({ color }) => <TabIcon name="home" color={color} /> }} />
    <Tabs.Screen name="actions" options={{ title: t('actions'), tabBarBadge: badge || undefined, tabBarIcon: ({ color }) => <TabIcon name="actions" color={color} /> }} />
    <Tabs.Screen name="history" options={{ title: t('history'), tabBarIcon: ({ color }) => <TabIcon name="history" color={color} /> }} />
    <Tabs.Screen name="settings" options={{ title: t('settings'), tabBarIcon: ({ color }) => <TabIcon name="settings" color={color} /> }} />
  </Tabs>;
}
