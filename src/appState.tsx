import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState as NativeAppState } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { requestNotificationPermission, subscribeToNotificationResponses } from './notifications';
import { loadAppState, reconcileNotifications, updateSettings, type AppState } from './service';

interface AppStateContextValue {
  state: AppState | null;
  setState: (state: AppState) => void;
  refresh: () => Promise<AppState>;
  issueDraft: IssueDraft;
  setIssueDraft: (draft: IssueDraft) => void;
  resetIssueDraft: () => void;
}

export interface IssueDraft { title: string; note: string; photo?: string; actionId?: string; }
const emptyIssueDraft: IssueDraft = { title: '', note: '' };

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { i18n } = useTranslation();
  const [state, setState] = useState<AppState | null>(null);
  const [issueDraft, setIssueDraft] = useState<IssueDraft>(emptyIssueDraft);
  const stateRef = useRef<AppState | null>(null);
  const pendingActionId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const nextState = await loadAppState();
    void reconcileNotifications(nextState).catch(() => undefined);
    stateRef.current = nextState;
    setState(nextState);
    return nextState;
  }, []);

  useEffect(() => {
    let active = true;
    void loadAppState().then(async (nextState) => {
      let hydratedState = nextState;
      if (nextState.settings.notificationsEnabled && !nextState.settings.notificationsPermissionRequested) {
        const granted = await requestNotificationPermission();
        hydratedState = await updateSettings({ ...nextState.settings, notificationsEnabled: granted, notificationsPermissionRequested: true });
      }
      stateRef.current = hydratedState;
      if (!active) return;
      setState(hydratedState);
      void reconcileNotifications(hydratedState).catch(() => undefined);
      if (pendingActionId.current) router.replace({ pathname: '/actions/[actionId]', params: { actionId: pendingActionId.current, returnTo: '/home' } });
      pendingActionId.current = null;
    });
    return () => { active = false; };
  }, [router]);

  useEffect(() => { if (state) void i18n.changeLanguage(state.settings.language); }, [i18n, state]);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => subscribeToNotificationResponses((actionId) => {
    if (!stateRef.current) { pendingActionId.current = actionId; return; }
    router.push({ pathname: '/actions/[actionId]', params: { actionId, returnTo: '/home' } });
  }), [router]);
  useEffect(() => {
    const subscription = NativeAppState.addEventListener('change', (status) => { if (status === 'active') void refresh(); });
    return () => subscription.remove();
  }, [refresh]);

  const resetIssueDraft = useCallback(() => setIssueDraft(emptyIssueDraft), []);
  const value = useMemo(() => ({ state, setState, refresh, issueDraft, setIssueDraft, resetIssueDraft }), [state, refresh, issueDraft, resetIssueDraft]);
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('useAppState must be used within AppStateProvider.');
  return value;
}
