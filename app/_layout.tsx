import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStateProvider } from '../src/appState';

export default function RootLayout() {
  return <SafeAreaProvider><AppStateProvider><Stack screenOptions={{ headerShown: false }} /><StatusBar style="dark" /></AppStateProvider></SafeAreaProvider>;
}
