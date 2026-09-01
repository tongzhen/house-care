import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path, Line } from 'react-native-svg';
import { type ColorValue } from 'react-native';
import { attentionCount } from '../../src/actionViews';
import { useAppState } from '../../src/appState';

type TabIconName = 'home' | 'actions' | 'history' | 'settings';

export function TabIcon({ name, color }: { name: TabIconName; color: ColorValue }) {
  const stroke = color as string;
  const common = { stroke, strokeWidth: 2.1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return <Svg accessibilityElementsHidden width={24} height={24} viewBox="0 0 24 24">
    {name === 'home' && <Path {...common} d="M3 10.8 12 3l9 7.8M5.5 9.5V21h13V9.5M9.5 21v-5h5v5" />}
    {name === 'actions' && <>
      <Circle {...common} cx="5" cy="6" r="1" /><Line {...common} x1="10" y1="6" x2="20" y2="6" />
      <Circle {...common} cx="5" cy="12" r="1" /><Line {...common} x1="10" y1="12" x2="20" y2="12" />
      <Circle {...common} cx="5" cy="18" r="1" /><Line {...common} x1="10" y1="18" x2="20" y2="18" />
    </>}
    {name === 'history' && <><Circle {...common} cx="12" cy="12" r="9" /><Path {...common} d="M12 7v5l3.5 2" /></>}
    {name === 'settings' && <><Path {...common} d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.09a2 2 0 0 1 1 1.74v.5a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" /><Circle {...common} cx="12" cy="12" r="3" /></>}
  </Svg>;
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
