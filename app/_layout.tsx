import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStateProvider } from '../src/appState';

export default function RootLayout() {
  return <SafeAreaProvider><AppStateProvider><Stack screenOptions={{ headerShown: false }}>
    {/* Editors handle edge swipes themselves so saving/cleanup finishes before exit. */}
    <Stack.Screen name="settings/profile" options={{ gestureEnabled: false }} />
    <Stack.Screen name="settings/notifications" options={{ gestureEnabled: false }} />
    <Stack.Screen name="issues/new" options={{ gestureEnabled: false }} />
    <Stack.Screen name="actions/[actionId]/frequency" options={{ gestureEnabled: false }} />
  </Stack><StatusBar style="dark" /></AppStateProvider></SafeAreaProvider>;
}
