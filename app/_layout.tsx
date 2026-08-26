import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppStateProvider } from '../src/appState';

export default function RootLayout() {
  return <AppStateProvider><Stack screenOptions={{ headerShown: false }} /><StatusBar style="dark" /></AppStateProvider>;
}
