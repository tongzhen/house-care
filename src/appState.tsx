import './i18n';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState as NativeAppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { requestNotificationPermission, subscribeToNotificationResponses } from './notifications';
import { loadAppState, reconcileNotifications, updateSettings, type AppState } from './service';

interface AppStateContextValue {
  state: AppState | null;
  setState: (state: AppState) => void;
  refresh: () => Promise<AppState | null>;
  issueDraft: IssueDraft;
  setIssueDraft: (draft: IssueDraft) => void;
  resetIssueDraft: () => void;
}

export interface IssueDraft { title: string; note: string; photo?: string; actionId?: string; }
const emptyIssueDraft: IssueDraft = { title: '', note: '' };

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [state, setLoadedState] = useState<AppState | null>(null);
  const [startupStatus, setStartupStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [notificationsFailed, setNotificationsFailed] = useState(false);
  const mounted = useRef(true);
  const notificationAttempted = useRef(false);
  const loading = useRef<Promise<AppState | null> | null>(null);
  const [issueDraft, setIssueDraft] = useState<IssueDraft>(emptyIssueDraft);
  const stateRef = useRef<AppState | null>(null);
  const pendingActionId = useRef<string | null>(null);
  const pendingSeasonal = useRef(false);

  const setState = useCallback((next: AppState) => {
    if (!mounted.current) return;
    stateRef.current = next;
    setLoadedState(next);
    setStartupStatus('ready');
  }, []);

  const refresh = useCallback((): Promise<AppState | null> => {
    if (loading.current) return loading.current;
    if (!stateRef.current) setStartupStatus('loading');
    const previous = stateRef.current;
    const operation = (async () => {
      try {
        const nextState = await loadAppState();
        if (!mounted.current) return null;
        // A mutation may have published newer data while this read was pending.
        if (stateRef.current !== previous) return stateRef.current;
        setState(nextState);
        setRefreshFailed(false);
        void reconcileNotifications(nextState).catch(() => undefined);
        return nextState;
      } catch {
        if (mounted.current) {
          if (stateRef.current) setRefreshFailed(true);
          else setStartupStatus('error');
        }
        return stateRef.current;
      } finally { loading.current = null; }
    })();
    loading.current = operation;
    return operation;
  }, [setState]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => { mounted.current = false; };
  }, [refresh]);

  // Permission/device-service failures must not block access to local data.
  useEffect(() => {
    if (!state || notificationAttempted.current) return;
    notificationAttempted.current = true;
    if (!state.settings.notificationsEnabled || state.settings.notificationsPermissionRequested) return;
    void (async () => {
      try {
        const granted = await requestNotificationPermission();
        if (!mounted.current || !stateRef.current) return;
        const current = stateRef.current;
        if (!current.settings.notificationsEnabled || current.settings.notificationsPermissionRequested) return;
        const next = await updateSettings({ ...current.settings, notificationsEnabled: granted, notificationsPermissionRequested: true });
        if (!mounted.current) return;
        if (stateRef.current === current) setState(next);
        else await refresh();
      } catch {
        if (mounted.current) setNotificationsFailed(true);
      }
    })();
  }, [state, refresh, setState]);

  useEffect(() => {
    if (!state) return;
    if (pendingSeasonal.current) { router.replace('/seasonal'); pendingSeasonal.current = false; }
    else if (pendingActionId.current) router.replace({ pathname: '/actions/[actionId]', params: { actionId: pendingActionId.current, returnTo: '/home' } });
    pendingActionId.current = null;
  }, [state, router]);

  useEffect(() => { if (state) void i18n.changeLanguage(state.settings.language); }, [i18n, state]);
  useEffect(() => {
    try {
      return subscribeToNotificationResponses((actionId) => {
        if (!stateRef.current) { pendingActionId.current = actionId; return; }
        router.push({ pathname: '/actions/[actionId]', params: { actionId, returnTo: '/home' } });
      }, () => {
        if (!stateRef.current) { pendingSeasonal.current = true; return; }
        router.push('/seasonal');
      });
    } catch {
      // Report synchronous adapter failures after subscription setup completes.
      queueMicrotask(() => { if (mounted.current) setNotificationsFailed(true); });
    }
  }, [router]);
  useEffect(() => {
    const subscription = NativeAppState.addEventListener('change', (status) => { if (status === 'active') void refresh(); });
    return () => subscription.remove();
  }, [refresh]);

  const resetIssueDraft = useCallback(() => setIssueDraft(emptyIssueDraft), []);
  const value = useMemo(() => ({ state, setState, refresh, issueDraft, setIssueDraft, resetIssueDraft }), [state, setState, refresh, issueDraft, resetIssueDraft]);
  return <AppStateContext.Provider value={value}><View style={styles.container}>
    {state && refreshFailed && <View style={styles.banner}><Text accessibilityRole="alert">{t('startup.refreshFailed')}</Text><Pressable accessibilityRole="button" style={styles.button} onPress={() => { void refresh(); }}><Text>{t('startup.retry')}</Text></Pressable></View>}
    {state && notificationsFailed && <View style={styles.banner}><Text>{t('startup.notificationsFailed')}</Text><Pressable accessibilityRole="button" style={styles.button} onPress={() => { setNotificationsFailed(false); router.push('/settings/notifications'); }}><Text>{t('startup.notificationSettings')}</Text></Pressable></View>}
    <View style={styles.container} accessibilityElementsHidden={!state} importantForAccessibility={state ? 'auto' : 'no-hide-descendants'}>{children}</View>
    {!state && <View style={styles.startup}>{startupStatus === 'loading' ? <><ActivityIndicator color="#176B60" /><Text>{t('startup.loading')}</Text></> : <><Text accessibilityRole="alert" style={styles.title}>{t('startup.failedTitle')}</Text><Text>{t('startup.failedBody')}</Text><Pressable accessibilityRole="button" style={styles.button} onPress={() => { void refresh(); }}><Text>{t('startup.retry')}</Text></Pressable></>}</View>}
  </View></AppStateContext.Provider>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  startup: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#FAF8F2', justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  banner: { backgroundColor: '#FFF4D6', paddingHorizontal: 20, paddingTop: 48, paddingBottom: 8 },
  title: { color: '#20392D', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
});

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('useAppState must be used within AppStateProvider.');
  return value;
}
