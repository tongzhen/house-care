import '../src/i18n';
import { Redirect } from 'expo-router';
import DateTimePicker, { type DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import * as Application from 'expo-application';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, AppState as NativeAppState, Image, Linking, Modal, PanResponder, Platform, Pressable, ScrollView as NativeScrollView, StyleSheet, Switch, Text, TextInput, type ScrollViewProps, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { actionApplies, actions, getAction } from '../src/catalog';
import { CalendarComposerError, openCalendarEventEditor } from '../src/calendar';
import { actionNeedsAttention, atNineAM, formatDate, nextDueDate } from '../src/date';
import { exportBackup } from '../src/backup';
import { exportMaintenanceReport, hasReportableOutcomes, isValidReportPeriod, type ReportPeriod, type ReportStrings } from '../src/report';
import { cancelScheduledNotifications, notificationPermissionGranted, requestNotificationPermission, scheduledNotificationCount, sendTestNotification, subscribeToNotificationResponses } from '../src/notifications';
import { defaultNotificationSchedule, weekdays } from '../src/notificationSchedule';
import { legalDocuments, type LegalDocumentId } from '../src/legal';
import { discardIssuePhoto, selectIssuePhoto } from '../src/media';
import { thirdPartyNotices } from '../src/generated/thirdPartyNotices';
import { resolvePostalCode, validatePostalCode } from '../src/weather';
import { WeatherPanel } from '../src/weatherView';
import { deleteIssuePhoto, deleteIssueRecord, importLocalBackup, loadAppState, recordIssue, recordOutcome, resetAppData, saveHomeProfile, setActionEnabled, updateFrequency, updateSettings, type AppState } from '../src/service';
import type { ActionConfiguration, Frequency, MaintenanceAction, NotificationSchedule, Profile, TaskOutcome, Weekday } from '../src/types';

type Tab = 'home' | 'actions' | 'history' | 'settings';
type ViewName = Tab | 'detail' | 'setup' | 'issue' | 'issue-select' | 'issue-detail' | 'actions-overview' | 'notification-timing' | 'notification-debug' | 'report-export' | 'about' | 'legal-document' | 'custom-frequency';

const applianceChoices = [
  ['dishwasher', 'dishwasher'], ['washing-machine', 'washingMachine'], ['tumble-dryer', 'tumbleDryer'], ['cooker-hood', 'cookerHood'],
] as const;
const featureChoices = ['gutters', 'drainage-faskine', 'pump-well', 'outdoor-tap', 'ventilation', 'underfloor-heating', 'wood-floors', 'floor-drains'];
const presets: Frequency[] = [{ interval: 1, unit: 'week' }, { interval: 1, unit: 'month' }, { interval: 3, unit: 'month' }, { interval: 6, unit: 'month' }, { interval: 1, unit: 'year' }];

function formatFrequency(frequency: Frequency, t: (key: string) => string) { return `${frequency.interval} ${t(`frequencyUnits.${frequency.unit}.${frequency.interval === 1 ? 'one' : 'other'}`)}`; }
function formatMinutes(minutes: number, t: (key: string) => string) { return `${minutes} ${t('minutesShort')}`; }

const swipeBackEdgeWidth = 32;
const swipeBackDistance = 80;

function ScrollView({ contentContainerStyle, ...props }: ScrollViewProps) {
  return <SafeAreaView edges={['top']} style={styles.flex}><NativeScrollView {...props} contentContainerStyle={contentContainerStyle} /></SafeAreaView>;
}

export function isSwipeBackGesture(startX: number, distanceX: number, distanceY: number) {
  return startX <= swipeBackEdgeWidth && distanceX >= swipeBackDistance && Math.abs(distanceX) > Math.abs(distanceY);
}

function SwipeBack({ onBack, children }: { onBack?: () => void | Promise<void>; children: ReactNode }) {
  const responder = PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => gesture.x0 <= swipeBackEdgeWidth && gesture.dx > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderRelease: (_event, gesture) => {
      if (isSwipeBackGesture(gesture.x0, gesture.dx, gesture.dy)) void onBack?.();
    },
  });
  return <View style={styles.flex} {...responder.panHandlers}>{children}</View>;
}

export default function Index() {
  return <Redirect href="/home" />;
}

export function LegacyAppController() {
  const { i18n } = useTranslation();
  const [state, setState] = useState<AppState | null>(null);
  const [view, setView] = useState<ViewName>('home');
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [detailReturnView, setDetailReturnView] = useState<ViewName>('home');
  const [issueTitle, setIssueTitle] = useState('');
  const [issueNote, setIssueNote] = useState('');
  const [issuePhoto, setIssuePhoto] = useState<string | undefined>();
  const [issueActionId, setIssueActionId] = useState<string | undefined>();
  const [issueReturnView, setIssueReturnView] = useState<ViewName>('home');
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(null);
  const [legalDocumentId, setLegalDocumentId] = useState<LegalDocumentId>('privacy');
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const stateRef = useRef<AppState | null>(null);
  const pendingNotificationActionId = useRef<string | null>(null);
  const openNotificationAction = useCallback((actionId: string) => {
    const currentState = stateRef.current;
    if (!currentState || !currentState.configurations.some((config) => config.actionId === actionId && config.enabled)) {
      pendingNotificationActionId.current = actionId;
      return;
    }
    setSelectedActionId(actionId);
    setView('detail');
    pendingNotificationActionId.current = null;
  }, []);

  useEffect(() => {
    let active = true;
    loadAppState().then(async (nextState) => {
      let hydratedState = nextState;
      if (nextState.settings.notificationsEnabled && !nextState.settings.notificationsPermissionRequested) {
        const granted = await requestNotificationPermission();
        hydratedState = await updateSettings({ ...nextState.settings, notificationsEnabled: granted, notificationsPermissionRequested: true });
      }
      stateRef.current = hydratedState;
      if (active) {
        setState(hydratedState);
        if (pendingNotificationActionId.current) openNotificationAction(pendingNotificationActionId.current);
      }
    });
    return () => { active = false; };
  }, [openNotificationAction]);
  useEffect(() => { if (state) void i18n.changeLanguage(state.settings.language); }, [i18n, state]);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => subscribeToNotificationResponses(openNotificationAction), [openNotificationAction]);
  useEffect(() => { const timer = setInterval(() => setCurrentTime(Date.now()), 60000); return () => clearInterval(timer); }, []);

  const refreshHome = useCallback(async () => {
    setCurrentTime(Date.now());
    setState(await loadAppState());
  }, []);
  useEffect(() => {
    const subscription = NativeAppState.addEventListener('change', (nextStatus) => {
      if (nextStatus === 'active') void refreshHome();
    });
    return () => subscription.remove();
  }, [refreshHome]);

  const configurations = useMemo(() => new Map(state?.configurations.map((config) => [config.actionId, config]) ?? []), [state]);
  const profile = state?.profile;
  const activeActions = useMemo(() => profile ? actions.filter((action) => configurations.get(action.id)?.enabled && actionApplies(action, profile)) : [], [configurations, profile]);
  const orderedActions = useMemo(() => [...activeActions].sort((a, b) => dueFor(a, configurations.get(a.id)) - dueFor(b, configurations.get(b.id))), [activeActions, configurations]);
  const attentionCount = useMemo(() => activeActions.filter((action) => actionNeedsAttention(action, configurations.get(action.id), currentTime)).length, [activeActions, configurations, currentTime]);
  const selected = selectedActionId ? getAction(selectedActionId) : undefined;
  const selectedOutcome = selectedOutcomeId ? state?.outcomes.find((outcome) => outcome.id === selectedOutcomeId) : undefined;

  if (!state) return <SafeAreaView style={styles.loading}><ActivityIndicator color={colors.green} /></SafeAreaView>;
  if (!state.profile) return <Setup onSave={async (profile) => { const nextState = await saveHomeProfile(profile); setState(nextState); setView('home'); }} />;
  if (view === 'setup') return <ProfileEditor initial={state.profile} onBack={() => setView('settings')} onCommit={async (profile) => { setState(await saveHomeProfile(profile)); }} />;

  const openAction = (actionId: string, returnView: ViewName = 'home') => { setSelectedActionId(actionId); setDetailReturnView(returnView); setView('detail'); };
  const outcome = async (type: 'done' | 'snoozed', snoozeDays?: number, snoozedUntil?: string) => {
    if (!selectedActionId) return;
    setState(await recordOutcome(selectedActionId, type, { snoozeDays, snoozedUntil }));
    setView(detailReturnView === 'actions-overview' ? 'actions-overview' : type === 'done' ? 'history' : 'home');
  };
  const customSnooze = async (snoozedUntil: string) => {
    if (!selectedActionId) return;
    setState(await recordOutcome(selectedActionId, 'snoozed', { snoozedUntil }));
  };

  return (
    <SafeAreaView style={styles.safe}>
      {view === 'home' && <Home actions={orderedActions} configurations={configurations} language={state.settings.language} now={currentTime} onOpen={openAction} onReportIssue={() => { setIssueActionId(undefined); setIssueReturnView('home'); setView('issue'); }} />}
      {view === 'actions' && <ActionList actions={orderedActions} configurations={configurations} language={state.settings.language} onOpen={(actionId) => openAction(actionId, 'actions')} />}
      {view === 'history' && <History state={state} language={state.settings.language} onOpenReport={() => setView('report-export')} onOpenIssue={(outcome) => { setSelectedOutcomeId(outcome.id); setView('issue-detail'); }} />}
      {view === 'report-export' && <SwipeBack onBack={() => setView('history')}><ReportExport state={state} language={state.settings.language} onBack={() => setView('history')} /></SwipeBack>}
      {view === 'settings' && <Settings state={state} onState={setState} onEditProfile={() => setView('setup')} onOpenActions={() => setView('actions-overview')} onOpenNotifications={() => setView('notification-timing')} onOpenAbout={() => setView('about')} onOpenDebug={() => setView('notification-debug')} onReset={async () => { setState(await resetAppData()); setView('setup'); }} />}
      {view === 'about' && <SwipeBack onBack={() => setView('settings')}><About language={state.settings.language} onBack={() => setView('settings')} onOpenDocument={(id) => { setLegalDocumentId(id); setView('legal-document'); }} /></SwipeBack>}
      {view === 'legal-document' && <SwipeBack onBack={() => setView('about')}><LegalDocumentView language={state.settings.language} documentId={legalDocumentId} onBack={() => setView('about')} /></SwipeBack>}
      {view === 'actions-overview' && <SwipeBack onBack={() => setView('settings')}><ActionOverview actions={actions} configurations={configurations} profile={profile ?? null} language={state.settings.language} onBack={() => setView('settings')} onOpen={(actionId) => openAction(actionId, 'actions-overview')} /></SwipeBack>}
      {view === 'notification-timing' && <NotificationSettings settings={state.settings} onBack={() => setView('settings')} onSettings={async (settings) => setState(await updateSettings(settings))} />}
      {view === 'notification-debug' && <SwipeBack onBack={() => setView('settings')}><NotificationDebug state={state} onBack={() => setView('settings')} onState={setState} /></SwipeBack>}
      {view === 'detail' && selected && configurations.get(selected.id) && <SwipeBack onBack={() => setView(detailReturnView)}><ActionDetail action={selected} configuration={configurations.get(selected.id)!} language={state.settings.language} returnView={detailReturnView === 'actions' || detailReturnView === 'actions-overview' ? detailReturnView : 'home'} onBack={() => setView(detailReturnView)} onDone={() => outcome('done')} onSnooze={(days) => outcome('snoozed', days)} onCustomSnooze={customSnooze} onIssue={() => { setIssueActionId(selected.id); setIssueReturnView('detail'); setView('issue'); }} onCustomFrequency={() => setView('custom-frequency')} onFrequency={async (frequency) => setState(await updateFrequency(selected.id, frequency))} onEnabled={async (enabled) => setState(await setActionEnabled(selected.id, enabled))} /></SwipeBack>}
      {view === 'custom-frequency' && selected && configurations.get(selected.id) && <SwipeBack onBack={() => setView('detail')}><CustomFrequency action={selected} configuration={configurations.get(selected.id)!} language={state.settings.language} onBack={() => setView('detail')} onSave={async (frequency) => { setState(await updateFrequency(selected.id, frequency)); setView('detail'); }} /></SwipeBack>}
      {view === 'issue' && <SwipeBack onBack={() => setView(issueReturnView)}><IssueForm title={issueTitle} note={issueNote} photo={issuePhoto} actions={orderedActions} language={state.settings.language} actionId={issueActionId} onChooseAction={() => setView('issue-select')} onTitle={setIssueTitle} onNote={setIssueNote} onPhoto={setIssuePhoto} onBack={() => setView(issueReturnView)} onSubmit={async () => { setState(await recordIssue(issueTitle, { actionId: issueActionId, note: issueNote, photoUri: issuePhoto })); setIssueTitle(''); setIssueNote(''); setIssuePhoto(undefined); setIssueActionId(undefined); setView('history'); }} /></SwipeBack>}
      {view === 'issue-select' && <SwipeBack onBack={() => setView('issue')}><IssueActionSelect actions={orderedActions} language={state.settings.language} onBack={() => setView('issue')} onSelect={(actionId) => { setIssueActionId(actionId); setView('issue'); }} /></SwipeBack>}
      {view === 'issue-detail' && selectedOutcome && <SwipeBack onBack={() => setView('history')}><IssueDetail outcome={selectedOutcome} language={state.settings.language} onBack={() => setView('history')} onDeletePhoto={async () => setState(await deleteIssuePhoto(selectedOutcome))} onDeleteIssue={async () => { setState(await deleteIssueRecord(selectedOutcome)); setSelectedOutcomeId(null); setView('history'); }} /></SwipeBack>}
      {['home', 'actions', 'history', 'settings'].includes(view) && <TabBar active={view as Tab} attentionCount={attentionCount} onChange={(tab) => { setView(tab); if (tab === 'home') void refreshHome(); }} />}
    </SafeAreaView>
  );
}

function useProfileDraft(initial?: Profile) {
  const { t } = useTranslation();
  const [appliances, setAppliances] = useState<string[]>(initial?.appliances ?? ['dishwasher']);
  const [features, setFeatures] = useState<string[]>(initial?.features ?? []);
  const [houseType, setHouseType] = useState<Profile['houseType']>(initial?.houseType ?? 'detached');
  const [ageBand, setAgeBand] = useState<NonNullable<Profile['ageBand']>>(initial?.ageBand ?? 'new-build');
  const [postalCode, setPostalCode] = useState(initial?.postalCode ?? '');
  const [dryerVariant, setDryerVariant] = useState<string | undefined>(initial?.variants.tumbleDryer);
  const [hoodVariant, setHoodVariant] = useState<string | undefined>(initial?.variants.cookerHood);
  const toggle = (value: string, values: string[], setter: (items: string[]) => void) => setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  const profile = (): Omit<Profile, 'id'> => ({ houseType, ageBand, postalCode: postalCode.trim() || undefined, appliances, features, variants: { ...(appliances.includes('tumble-dryer') && dryerVariant ? { tumbleDryer: dryerVariant } : {}), ...(appliances.includes('cooker-hood') && hoodVariant ? { cookerHood: hoodVariant } : {}) } });
  const validationMessage = () => {
    if (appliances.length === 0) return t('profileApplianceRequired');
    if (appliances.includes('tumble-dryer') && !dryerVariant) return t('profileDryerTypeRequired');
    if (appliances.includes('cooker-hood') && !hoodVariant) return t('profileHoodTypeRequired');
    try { validatePostalCode(postalCode); } catch { return t('weather.postalCodeInvalid'); }
    return undefined;
  };
  const ensurePostalCode = async () => {
    const code = validatePostalCode(postalCode);
    if (code && code !== initial?.postalCode) await resolvePostalCode(code);
  };
  const toggleAppliance = (id: string) => { toggle(id, appliances, setAppliances); if (id === 'tumble-dryer' && appliances.includes(id)) setDryerVariant(undefined); if (id === 'cooker-hood' && appliances.includes(id)) setHoodVariant(undefined); };
  return { appliances, features, houseType, ageBand, postalCode, dryerVariant, hoodVariant, profile, validationMessage, ensurePostalCode, setHouseType, setAgeBand, setPostalCode, setDryerVariant, setHoodVariant, toggleAppliance, toggleFeature: (id: string) => toggle(id, features, setFeatures) };
}

function PostalCodeField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  return <View style={postalStyles.field}><Text style={styles.label}>{t('weather.postalCodeLabel')}</Text><Text style={postalStyles.hint}>{t('weather.postalCodeHint')}</Text><TextInput accessibilityLabel={t('weather.postalCodeLabel')} keyboardType="number-pad" maxLength={4} value={value} onChangeText={onChange} placeholder="1234" style={postalStyles.input} /></View>;
}

const postalStyles = StyleSheet.create({ field: { gap: 7, marginTop: 8 }, hint: { color: '#50655B', fontSize: 13, lineHeight: 19 }, input: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#D6E1D7', paddingHorizontal: 14, backgroundColor: '#FFFFFF', color: '#20392D', fontSize: 16 } });

function postalCodeError(error: unknown, t: (key: string) => string) {
  return error instanceof Error && error.message === 'postalCodeUnknown' ? t('weather.postalCodeUnknown') : t('weather.postalCodeLookupFailed');
}

export function Setup({ onSave }: { onSave: (profile: Omit<Profile, 'id'>) => Promise<void> }) {
  const { t } = useTranslation();
  const draft = useProfileDraft();
  const [step, setStep] = useState<'welcome' | 'home' | 'appliances' | 'features'>('welcome');
  const [saving, setSaving] = useState(false);
  const nextFromAppliances = () => {
    const message = draft.validationMessage();
    if (message) { Alert.alert(t('profileAppliances'), message); return; }
    setStep('features');
  };
  const save = async () => {
    const message = draft.validationMessage();
    if (message) { Alert.alert(t('profileFeatures'), message); return; }
    setSaving(true);
    try {
      if (draft.postalCode.trim()) {
        try { await draft.ensurePostalCode(); } catch (error) { Alert.alert(t('welcome'), postalCodeError(error, t)); return; }
      }
      await onSave(draft.profile());
    } catch { Alert.alert(t('welcome'), t('profileSaveFailed')); } finally { setSaving(false); }
  };
  const goBack = () => {
    if (step === 'features') { setStep('appliances'); return; }
    if (step === 'appliances') { setStep('home'); return; }
    if (step === 'home') setStep('welcome');
  };
  const actionCount = actions.filter((action) => actionApplies(action, draft.profile())).length;
  const progress = step === 'home' ? 1 : step === 'appliances' ? 2 : 3;
  return <SwipeBack onBack={goBack}><ScrollView contentContainerStyle={[styles.page, styles.setupPage]}>
    {step === 'welcome' && <View style={styles.setupWelcome}><Text style={styles.setupMark}>⌂</Text><Text style={styles.kicker}>{t('onboarding.brand')}</Text><Text style={styles.setupTitle}>{t('onboarding.welcomeTitle')}</Text><Text style={styles.setupIntro}>{t('onboarding.welcomeBody')}</Text><View style={styles.setupIllustration}><Text style={styles.setupIllustrationText}>⌂</Text><Text style={styles.setupSparkle}>✦</Text></View><Pressable accessibilityRole="button" style={styles.primary} onPress={() => setStep('home')}><Text style={styles.primaryText}>{t('onboarding.setupHome')}</Text></Pressable><Text style={styles.setupReassurance}>{t('onboarding.localOnly')}</Text></View>}
    {step !== 'welcome' && <><View style={styles.setupProgress}><Pressable accessibilityRole="button" accessibilityLabel={t('onboarding.back')} onPress={goBack}><Text style={styles.setupBack}>‹</Text></Pressable><View style={styles.setupProgressCopy}><Text style={styles.setupProgressText}>{t('onboarding.progress', { current: progress, total: 3 })}</Text><View style={styles.setupProgressBars}>{[1, 2, 3].map((item) => <View key={item} style={[styles.setupProgressBar, item <= progress && styles.setupProgressBarActive]} />)}</View></View></View>
      {step === 'home' && <><Text style={styles.setupTitle}>{t('onboarding.homeTitle')}</Text><View style={styles.setupHomeCards}>{(['detached', 'terraced'] as const).map((item) => <ProfileCard key={item} glyph={item === 'detached' ? '⌂' : '⌂⌂'} label={t(`profileHouseTypes.${item}`)} selected={draft.houseType === item} onPress={() => draft.setHouseType(item)} />)}</View><Text style={styles.label}>{t('onboarding.homeAge')}</Text><View style={styles.setupAgeGrid}>{([['new-build', 'ageNew'], ['0-2', 'ageTwo'], ['3-10', 'ageTen'], ['10+', 'ageOlder']] as const).map(([value, label]) => <Choice key={value} label={t(`onboarding.${label}`)} selected={draft.ageBand === value} onPress={() => draft.setAgeBand(value)} />)}</View><PostalCodeField value={draft.postalCode} onChange={draft.setPostalCode} /><SetupActions onBack={goBack} onNext={() => setStep('appliances')} /></>}
      {step === 'appliances' && <><Text style={styles.setupTitle}>{t('onboarding.appliancesTitle')}</Text><Text style={styles.setupIntro}>{t('onboarding.appliancesHint')}</Text><View style={styles.setupOptionGrid}>{applianceChoices.map(([id, label]) => <ProfileCard key={id} glyph={id === 'dishwasher' ? '▤' : id === 'washing-machine' ? '◉' : id === 'tumble-dryer' ? '◌' : '⌑'} label={t(label)} selected={draft.appliances.includes(id)} onPress={() => draft.toggleAppliance(id)} />)}</View>{draft.appliances.includes('tumble-dryer') && <><Text style={styles.label}>{t('profileDryerType')}</Text><View style={styles.choiceRow}><Choice label={t('profileDryerTypes.vented')} selected={draft.dryerVariant === 'vented'} onPress={() => draft.setDryerVariant('vented')} /><Choice label={t('profileDryerTypes.condenser')} selected={draft.dryerVariant === 'condenser'} onPress={() => draft.setDryerVariant('condenser')} /></View></>}{draft.appliances.includes('cooker-hood') && <><Text style={styles.label}>{t('profileHoodType')}</Text><View style={styles.choiceRow}><Choice label={t('profileHoodTypes.recirculating')} selected={draft.hoodVariant === 'recirculating'} onPress={() => draft.setHoodVariant('recirculating')} /><Choice label={t('profileHoodTypes.ventedOutside')} selected={draft.hoodVariant === 'vented-outside'} onPress={() => draft.setHoodVariant('vented-outside')} /></View></>}<SetupActions onBack={goBack} onNext={nextFromAppliances} /></>}
      {step === 'features' && <><Text style={styles.setupTitle}>{t('onboarding.featuresTitle')}</Text><Text style={styles.setupIntro}>{t('onboarding.featuresHint')}</Text><View style={styles.choiceGrid}>{featureChoices.map((id) => <Choice key={id} label={t(`profileFeaturesList.${id}`)} selected={draft.features.includes(id)} onPress={() => draft.toggleFeature(id)} />)}</View><View style={styles.setupPlan}><View style={styles.setupPlanIcon}><Text style={styles.setupPlanIconText}>✓</Text></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{t('onboarding.planTitle')}</Text><Text style={styles.rowSub}>{t('onboarding.planCount', { count: actionCount })}</Text></View></View><SetupActions onBack={goBack} onNext={() => { void save(); }} nextLabel={saving ? '…' : t('onboarding.createPlan')} disabled={saving} /></>}</>}
  </ScrollView></SwipeBack>;
}

export function ProfileEditor({ initial, onBack, onCommit }: { initial: Profile; onBack: () => void; onCommit: (profile: Omit<Profile, 'id'>) => Promise<void> }) {
  const { t } = useTranslation();
  const draft = useProfileDraft(initial);
  const [saving, setSaving] = useState(false);
  const leave = async () => {
    const message = draft.validationMessage();
    if (message) { Alert.alert(t('editHome'), message); return; }
    setSaving(true);
    try {
      if (draft.postalCode.trim()) {
        try { await draft.ensurePostalCode(); } catch (error) { Alert.alert(t('editHome'), postalCodeError(error, t)); return; }
      }
      await onCommit(draft.profile()); onBack();
    } catch { Alert.alert(t('editHome'), t('profileSaveFailed')); } finally { setSaving(false); }
  };
  return <SwipeBack onBack={leave}><ScrollView contentContainerStyle={styles.page}><Pressable testID="profile-editor-back" accessibilityRole="button" disabled={saving} onPress={() => { void leave(); }}><Text style={styles.back}>‹ {t('settings')}</Text></Pressable><Text style={styles.h1}>{t('editHome')}</Text><Text style={styles.sub}>{t('profileEditorHint')}</Text><Text style={styles.label}>{t('profileHouseType')}</Text><View style={styles.choiceRow}>{(['detached', 'terraced'] as const).map((item) => <Choice key={item} label={t(`profileHouseTypes.${item}`)} selected={draft.houseType === item} onPress={() => draft.setHouseType(item)} />)}</View><Text style={styles.label}>{t('profileAge')}</Text><View style={styles.choiceGrid}>{([['new-build', 'ageNew'], ['0-2', 'ageTwo'], ['3-10', 'ageTen'], ['10+', 'ageOlder']] as const).map(([value, label]) => <Choice key={value} label={t(`onboarding.${label}`)} selected={draft.ageBand === value} onPress={() => draft.setAgeBand(value)} />)}</View><PostalCodeField value={draft.postalCode} onChange={draft.setPostalCode} /><Text style={styles.label}>{t('profileAppliances')}</Text><View style={styles.choiceGrid}>{applianceChoices.map(([id, label]) => <Choice key={id} label={t(label)} selected={draft.appliances.includes(id)} onPress={() => draft.toggleAppliance(id)} />)}</View>{draft.appliances.includes('tumble-dryer') && <><Text style={styles.label}>{t('profileDryerType')}</Text><View style={styles.choiceRow}><Choice label={t('profileDryerTypes.vented')} selected={draft.dryerVariant === 'vented'} onPress={() => draft.setDryerVariant('vented')} /><Choice label={t('profileDryerTypes.condenser')} selected={draft.dryerVariant === 'condenser'} onPress={() => draft.setDryerVariant('condenser')} /></View></>}{draft.appliances.includes('cooker-hood') && <><Text style={styles.label}>{t('profileHoodType')}</Text><View style={styles.choiceRow}><Choice label={t('profileHoodTypes.recirculating')} selected={draft.hoodVariant === 'recirculating'} onPress={() => draft.setHoodVariant('recirculating')} /><Choice label={t('profileHoodTypes.ventedOutside')} selected={draft.hoodVariant === 'vented-outside'} onPress={() => draft.setHoodVariant('vented-outside')} /></View></>}<Text style={styles.label}>{t('profileFeatures')}</Text><View style={styles.choiceGrid}>{featureChoices.map((id) => <Choice key={id} label={t(`profileFeaturesList.${id}`)} selected={draft.features.includes(id)} onPress={() => draft.toggleFeature(id)} />)}</View></ScrollView></SwipeBack>;
}

export function Home({ actions: items, configurations, language, now, onOpen, onReportIssue }: { actions: MaintenanceAction[]; configurations: Map<string, ActionConfiguration>; language: 'en' | 'da'; now: number; onOpen: (id: string) => void; onReportIssue: () => void }) {
  const { t } = useTranslation(); const habits = items.filter((action) => action.trigger.kind === 'habit'); const scheduled = items.filter((action) => action.trigger.kind !== 'habit'); const due = scheduled.filter((action) => actionNeedsAttention(action, configurations.get(action.id), now)); const current = due[0]; const upcoming = scheduled.filter((action) => !due.includes(action)).slice(0, 2);
  return <ScrollView contentContainerStyle={styles.page}><Text style={styles.kicker}>{t('whatMatters')}</Text><Text style={styles.h1}>{t('homeHeadline')}</Text>
    {current ? <Pressable style={styles.hero} onPress={() => onOpen(current.id)}><Text style={styles.heroEyebrow}>{t('dueNow').toUpperCase()} · {current.estimatedMinutes} MIN</Text><Text style={styles.heroTitle}>{content(current, language).title}</Text><Text style={styles.heroText}>{content(current, language).whyItMatters}</Text><Text style={styles.heroButton}>{t('viewSteps')} →</Text></Pressable> : <Text style={styles.empty}>{t('noTasks')}</Text>}
    <Pressable style={styles.issueEntry} onPress={onReportIssue}><View style={styles.issueIcon}><Text style={styles.issueIconText}>!</Text></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{t('reportIssueHome')}</Text><Text style={styles.rowSub}>{t('reportIssueHint')}</Text></View><Text style={styles.issueChevron}>›</Text></Pressable>
    <Text style={styles.sectionTitle}>{t('upcoming')}</Text>{upcoming.map((action) => <ActionRow key={action.id} action={action} configuration={configurations.get(action.id)} language={language} onPress={() => onOpen(action.id)} />)}
    {habits.length > 0 && <><Text style={styles.sectionTitle}>{t('afterUse')}</Text><View style={styles.afterUseCard}>{habits.map((action) => <Pressable key={action.id} style={styles.afterUseRow} onPress={() => onOpen(action.id)}><ActionIcon actionId={action.id} /><View style={styles.rowCopy}><Text style={styles.rowTitle}>{content(action, language).title}</Text><Text style={styles.rowSub}>{t('afterUseHint')}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}</View></>}
  </ScrollView>;
}

export function ActionList({ actions: items, configurations, language, postalCode, onOpen, onOpenWeather }: { actions: MaintenanceAction[]; configurations: Map<string, ActionConfiguration>; language: 'en' | 'da'; postalCode?: string; onOpen: (id: string) => void; onOpenWeather?: () => void }) {
  const { t } = useTranslation(); const [category, setCategory] = useState('all'); const categories = Array.from(new Set(items.map((action) => action.category))).sort(); const categoryLabel = (item: string) => item === 'all' ? t('all') : t(`actionCategories.${item}`); const filtered = items.filter((action) => category === 'all' || action.category === category);
  return <ScrollView contentContainerStyle={styles.page}><Text style={styles.h1}>{t('actions')}</Text>{postalCode && <WeatherPanel postalCode={postalCode} language={language} />}{onOpenWeather && <Pressable accessibilityRole="button" accessibilityLabel={`${t('weather.heavyRain')}. ${t('weather.entryHint')}`} style={styles.issueEntry} onPress={onOpenWeather}><View style={styles.issueIcon}><Text style={styles.issueIconText}>☂</Text></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{t('weather.heavyRain')}</Text><Text style={styles.rowSub}>{t('weather.entryHint')}</Text></View><Text style={styles.issueChevron}>›</Text></Pressable>}<Text style={styles.label}>{t('category')}</Text><View style={styles.filterRow}><Choice label={categoryLabel('all')} selected={category === 'all'} onPress={() => setCategory('all')} />{categories.map((item) => <Choice key={item} label={categoryLabel(item)} selected={category === item} onPress={() => setCategory(item)} />)}</View>{filtered.map((action) => <ActionRow key={action.id} action={action} configuration={configurations.get(action.id)} language={language} onPress={() => onOpen(action.id)} />)}</ScrollView>;
}

type OverviewStatus = 'enabled' | 'disabled' | 'unavailable';

export function ActionOverview({ actions: items, configurations, profile, language, onBack, onOpen }: { actions: MaintenanceAction[]; configurations: Map<string, ActionConfiguration>; profile: Profile | null; language: 'en' | 'da'; onBack: () => void; onOpen: (id: string) => void }) {
  const { t } = useTranslation();
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState<'all' | Exclude<OverviewStatus, 'unavailable'>>('all');
  const categories = Array.from(new Set(items.map((action) => action.category))).sort();
  const getStatus = (action: MaintenanceAction): OverviewStatus => {
    const configuration = configurations.get(action.id);
    if (!profile || !actionApplies(action, profile) || !configuration) return 'unavailable';
    return configuration.enabled ? 'enabled' : 'disabled';
  };
  const visible = items.filter((action) => {
    const actionStatus = getStatus(action);
    return (category === 'all' || action.category === category) && (status === 'all' || actionStatus === status);
  });
  const grouped = categories.map((item) => ({ category: item, actions: visible.filter((action) => action.category === item) })).filter((group) => group.actions.length > 0);
  const categoryLabel = (item: string) => item === 'all' ? t('all') : t(`actionCategories.${item}`);
  return <ScrollView contentContainerStyle={styles.page}><Pressable onPress={onBack}><Text style={styles.back}>‹ {t('settings')}</Text></Pressable><Text style={styles.h1}>{t('actionsOverview')}</Text><Text style={styles.sub}>{t('actionsOverviewHint')}</Text><Text style={styles.label}>{t('category')}</Text><View style={styles.filterRow}><Choice label={categoryLabel('all')} selected={category === 'all'} onPress={() => setCategory('all')} />{categories.map((item) => <Choice key={item} label={categoryLabel(item)} selected={category === item} onPress={() => setCategory(item)} />)}</View><Text style={styles.label}>{t('actionStatus')}</Text><View style={styles.filterRow}>{(['all', 'enabled', 'disabled'] as const).map((item) => <Choice key={item} label={t(`actionStatuses.${item}`)} selected={status === item} onPress={() => setStatus(item)} />)}</View>{grouped.length === 0 ? <Text style={styles.empty}>{t('noActionsMatch')}</Text> : grouped.map((group) => <View key={group.category}><View style={styles.overviewCategory}><Text style={styles.sectionTitle}>{categoryLabel(group.category)}</Text><Text style={styles.rowSub}>{group.actions.length}</Text></View>{group.actions.map((action) => { const actionStatus = getStatus(action); const tappable = actionStatus !== 'unavailable'; return <Pressable key={action.id} disabled={!tappable} style={[styles.row, !tappable && styles.dim]} onPress={() => onOpen(action.id)}><ActionIcon actionId={action.id} /><View style={styles.rowCopy}><Text style={styles.rowTitle}>{content(action, language).title}</Text><Text style={styles.rowSub}>{actionStatus === 'unavailable' ? t('actionUnavailable') : t(`actionStatuses.${actionStatus}`)} · {formatMinutes(action.estimatedMinutes, t)}</Text></View>{tappable && <Text style={styles.chevron}>›</Text>}</Pressable>; })}</View>)}</ScrollView>;
}

function ActionRow({ action, configuration, language, onPress, showSchedule = true }: { action: MaintenanceAction; configuration?: ActionConfiguration; language: 'en' | 'da'; onPress: () => void; showSchedule?: boolean }) {
  const { t } = useTranslation();
  const schedule = configuration?.nextDueAt ? formatDate(configuration.snoozedUntil ?? configuration.nextDueAt, language) : action.trigger.kind === 'habit' ? t('afterUse') : undefined;
  return <Pressable style={styles.row} onPress={onPress}><ActionIcon actionId={action.id} /><View style={styles.rowCopy}><Text style={styles.rowTitle}>{content(action, language).title}</Text><Text style={styles.rowSub}>{showSchedule && schedule ? `${schedule} · ` : ''}{formatMinutes(action.estimatedMinutes, t)}</Text></View><Text style={styles.chevron}>›</Text></Pressable>;
}

function ActionIcon({ actionId }: { actionId: string }) {
  const { t } = useTranslation();
  if (actionId === 'dishwasher-filter-clean') {
    return <View style={styles.actionIcon} accessibilityLabel={t('accessibility.dishwasherFilterIcon')}><View style={styles.filterRing}><View style={[styles.filterLine, styles.filterLineOne]} /><View style={[styles.filterLine, styles.filterLineTwo]} /><View style={[styles.filterLine, styles.filterLineThree]} /><View style={[styles.filterLine, styles.filterLineVerticalOne]} /><View style={[styles.filterLine, styles.filterLineVerticalTwo]} /></View><Text style={styles.filterSparkle}>✦</Text></View>;
  }
  return <View style={styles.actionIcon} accessibilityLabel={t('accessibility.actionIcon')}><Text style={styles.actionGlyph}>{actionGlyphs[actionId] ?? '•'}</Text></View>;
}

const actionGlyphs: Record<string, string> = {
  'dishwasher-filter-check': '◉',
  'washing-machine-drawer-seal': '▱',
  'washing-machine-maintenance-wash': '✦',
  'washing-machine-pump-filter': '≋',
  'dryer-lint-filter': '✣',
  'dryer-condenser-filter': '▦',
  'dryer-external-vent': '↗',
  'cooker-hood-grease-filter': '▤',
  'cooker-hood-carbon-filter': '●',
  'gutters-ground-check': '⌒',
  'gutters-accessible-clean': '✦',
  'faskine-inlet-check': '▽',
  'pump-well-visual-check': '◉',
  'outdoor-tap-winter-check': '❄',
  'ventilation-grilles': '▤',
  'ventilation-filters': '▦',
  'floor-drain-clean': '◌',
  'underfloor-heating-visual-check': '⌁',
  'wood-floor-routine-clean': '▰',
  'wood-floor-care-review': '✎',
};

export function ActionDetail({ action, configuration, language, returnView = 'home', onBack, onDone, onSnooze, onCustomSnooze, onWeatherCheck, onIssue, onCustomFrequency = () => undefined, onFrequency, onEnabled }: { action: MaintenanceAction; configuration: ActionConfiguration; language: 'en' | 'da'; returnView?: 'home' | 'actions' | 'actions-overview' | 'weather'; onBack: () => void; onDone: () => Promise<void>; onSnooze: (days: number) => Promise<void>; onCustomSnooze: (snoozedUntil: string) => Promise<void>; onWeatherCheck?: () => Promise<void>; onIssue: () => void; onCustomFrequency?: () => void; onFrequency: (frequency?: Frequency) => Promise<void>; onEnabled: (enabled: boolean) => Promise<void> }) {
  const { t } = useTranslation(); const copy = content(action, language); const current = configuration.frequencyOverride ?? action.trigger.defaultFrequency;
  const [snoozePickerOpen, setSnoozePickerOpen] = useState(false); const [snoozeDate, setSnoozeDate] = useState(() => { const date = new Date(); date.setDate(date.getDate() + 1); date.setHours(0, 0, 0, 0); return date; });
  const [outcomePending, setOutcomePending] = useState(false); const outcomePendingRef = useRef(false);
  const isPresetFrequency = presets.some((preset) => preset.interval === current?.interval && preset.unit === current?.unit);
  const scheduledAt = configuration.snoozedUntil ?? configuration.nextDueAt;
  const runOutcome = async (operation: () => Promise<void>) => { if (outcomePendingRef.current) return; outcomePendingRef.current = true; setOutcomePending(true); try { await operation(); } catch { Alert.alert(t('actionUpdateFailed')); } finally { outcomePendingRef.current = false; setOutcomePending(false); } };
  const saveCustomSnooze = async (date = snoozeDate) => { const parsed = atNineAM(date); if (Number.isNaN(parsed.getTime()) || parsed <= new Date()) { Alert.alert(t('snooze'), t('snoozeFutureDateRequired')); return; } await runOutcome(() => onCustomSnooze(parsed.toISOString())); setSnoozePickerOpen(false); };
  const onSnoozeDateChange = (_event: DateTimePickerChangeEvent, value?: Date) => { if (!value) { setSnoozePickerOpen(false); return; } setSnoozeDate(value); if (Platform.OS === 'android') void saveCustomSnooze(value); };
  const openCalendarEditor = async () => { if (!scheduledAt) return; try { const safetyNote = copy.safetyRestrictions[0] ?? copy.manualNote; const notes = `${t('calendar.duration')}: ${formatMinutes(action.estimatedMinutes, t)}\n\n${t('why')}: ${copy.whyItMatters}\n\n${t('calendar.safety')}: ${safetyNote}\n\n${t('calendar.openApp')}`; await openCalendarEventEditor({ title: `House Care: ${copy.title}`, startAt: scheduledAt, estimatedMinutes: action.estimatedMinutes, notes }); } catch (error) { Alert.alert(t('calendar.open'), error instanceof CalendarComposerError && error.code === 'unavailable' ? t('calendar.unavailable') : t('calendar.openFailed')); } };
  const backLabel = returnView === 'weather' ? t('weather.heavyRain') : returnView === 'actions-overview' ? t('actionsOverview') : t(returnView);
  return <ScrollView contentContainerStyle={styles.page}><Pressable onPress={onBack}><Text style={styles.back}>‹ {backLabel}</Text></Pressable><Text style={styles.h1}>{copy.title}</Text><Text style={styles.sub}>{current ? formatFrequency(current, t) : t('afterUse')} · {formatMinutes(action.estimatedMinutes, t)}</Text>
    <Callout title={t('why')} body={copy.whyItMatters} /><Text style={styles.sectionTitle}>{t('safeSteps')}</Text>{copy.steps.map((step, index) => <View style={styles.step} key={step}><Text style={styles.stepNumber}>{index + 1}</Text><Text style={styles.stepText}>{step}</Text></View>)}
    <Text style={styles.sectionTitle}>{t('normal')}</Text>{copy.normalSigns.map((item) => <Text style={styles.bullet} key={item}>• {item}</Text>)}
    <View style={styles.warning}><Text style={styles.warningTitle}>{t('stop')}</Text><Text style={styles.warningText}>{copy.concerningSigns.join(' ')}</Text><Text style={styles.warningText}>{copy.escalationGuidance}</Text></View>
    {returnView === 'weather' && onWeatherCheck ? <><Pressable accessibilityRole="button" disabled={outcomePending} style={[styles.primary, outcomePending && styles.dim]} onPress={() => { void runOutcome(onWeatherCheck); }}><Text style={styles.primaryText}>{t('weather.checked')}</Text></Pressable><SmallButton disabled={outcomePending} label={t('issue')} onPress={onIssue} /></> : <><Pressable disabled={outcomePending} style={[styles.primary, outcomePending && styles.dim]} onPress={() => { void runOutcome(onDone); }}><Text style={styles.primaryText}>{t('done')}</Text></Pressable><View style={styles.actionGrid}><SmallButton disabled={outcomePending} label={t('tomorrow')} onPress={() => { void runOutcome(() => onSnooze(1)); }} /><SmallButton disabled={outcomePending} label={t('oneWeek')} onPress={() => { void runOutcome(() => onSnooze(7)); }} /><SmallButton disabled={outcomePending} label={t('chooseDate')} onPress={() => setSnoozePickerOpen(true)} /><SmallButton disabled={outcomePending} label={t('issue')} onPress={onIssue} /></View>{scheduledAt && action.trigger.kind !== 'habit' && Platform.OS !== 'web' && <Pressable accessibilityRole="button" style={styles.calendarButton} onPress={() => { void openCalendarEditor(); }}><Text style={styles.calendarButtonText}>{t('calendar.open')}</Text></Pressable>}</>}
    {snoozePickerOpen && (Platform.OS === 'ios' ? <Modal transparent animationType="slide" visible onRequestClose={() => setSnoozePickerOpen(false)}><View style={formStyles.pickerOverlay}><View style={formStyles.pickerCard}><DateTimePicker value={snoozeDate} mode="date" display="spinner" onChange={onSnoozeDateChange} /><Pressable style={styles.primary} onPress={() => { void saveCustomSnooze(); }}><Text style={styles.primaryText}>{t('save')}</Text></Pressable></View></View></Modal> : <DateTimePicker value={snoozeDate} mode="date" display="default" onChange={onSnoozeDateChange} />)}
    {returnView !== 'weather' && <><Text style={styles.sectionTitle}>{t('frequency')}</Text><View style={styles.presetGrid}>{presets.map((preset) => <Choice key={`${preset.interval}-${preset.unit}`} label={formatFrequency(preset, t)} selected={current?.interval === preset.interval && current?.unit === preset.unit} onPress={() => { void runOutcome(() => onFrequency(preset)); }} />)}<Choice label={t('custom')} selected={!isPresetFrequency && current !== undefined} onPress={onCustomFrequency} /></View><SmallButton disabled={outcomePending} label={t('reset')} onPress={() => { void runOutcome(() => onFrequency(undefined)); }} /><SmallButton disabled={outcomePending} label={configuration.enabled ? t('disable') : t('enable')} onPress={() => { void runOutcome(() => onEnabled(!configuration.enabled)); }} /></>}
  </ScrollView>;
}

export function CustomFrequency({ action, configuration, language, onBack, onSave }: { action: MaintenanceAction; configuration: ActionConfiguration; language: 'en' | 'da'; onBack: () => void; onSave: (frequency: Frequency) => Promise<void> }) {
  const { t } = useTranslation();
  const current = configuration.frequencyOverride ?? action.trigger.defaultFrequency;
  const [interval, setIntervalValue] = useState(String(current?.interval ?? 1));
  const [unit, setUnit] = useState<Frequency['unit']>(current?.unit ?? 'month');
  const [saving, setSaving] = useState(false);
  const numericInterval = Number(interval);
  const preview = Number.isInteger(numericInterval) && numericInterval > 0 ? formatDate(nextDueDate(new Date(), { interval: numericInterval, unit }).toISOString(), language) : '—';
  const save = async () => {
    if (!Number.isInteger(numericInterval) || numericInterval < 1) { Alert.alert(t('frequency'), t('customFrequencyInvalid')); return; }
    setSaving(true);
    try { await onSave({ interval: numericInterval, unit }); } catch (error) { Alert.alert(t('frequency'), error instanceof Error ? error.message : t('customFrequencyInvalid')); } finally { setSaving(false); }
  };
  return <ScrollView contentContainerStyle={styles.page}><Pressable onPress={onBack}><Text style={styles.back}>‹ {content(action, language).title}</Text></Pressable><Text style={styles.h1}>{t('customFrequency')}</Text><Text style={styles.sub}>{content(action, language).title}</Text><View style={formStyles.formCard}><Text style={styles.label}>{t('interval')}</Text><TextInput value={interval} onChangeText={setIntervalValue} keyboardType="number-pad" placeholder={t('interval')} style={styles.titleInput} /><Text style={styles.label}>{t('unit')}</Text><View style={styles.choiceGrid}>{(['day', 'week', 'month', 'year'] as Frequency['unit'][]).map((candidate) => <Choice key={candidate} label={t(`frequencyUnits.${candidate}.one`)} selected={unit === candidate} onPress={() => setUnit(candidate)} />)}</View><Text style={styles.rowSub}>{t('nextReminder')}: {preview}</Text></View><Pressable accessibilityRole="button" disabled={saving} style={[styles.primary, saving && styles.dim]} onPress={() => { void save(); }}><Text style={styles.primaryText}>{t('saveFrequency')}</Text></Pressable></ScrollView>;
}

export function IssueActionSelect({ actions: items, language, onBack, onSelect }: { actions: MaintenanceAction[]; language: 'en' | 'da'; onBack: () => void; onSelect: (actionId?: string) => void }) {
  const { t } = useTranslation(); return <ScrollView contentContainerStyle={styles.page}><Pressable onPress={onBack}><Text style={styles.back}>‹ {t('cancel')}</Text></Pressable><Text style={styles.h1}>{t('relatedAction')}</Text><Text style={styles.sub}>{t('issueHint')}</Text><SmallButton label={t('none')} onPress={() => onSelect(undefined)} />{items.map((action) => <ActionRow key={action.id} action={action} language={language} showSchedule={false} onPress={() => onSelect(action.id)} />)}</ScrollView>;
}

export function IssueForm({ title, note, photo, actions: items, language, actionId, onChooseAction, onTitle, onNote, onPhoto, onBack, onSubmit }: { title: string; note: string; photo?: string; actions: MaintenanceAction[]; language: 'en' | 'da'; actionId?: string; onChooseAction: () => void; onTitle: (title: string) => void; onNote: (note: string) => void; onPhoto: (photo?: string) => void; onBack: () => void; onSubmit: () => Promise<void> }) {
  const { t } = useTranslation(); const [saving, setSaving] = useState(false);
  const choosePhoto = async () => { try { onPhoto(await selectIssuePhoto(photo)); } catch { Alert.alert(t('issuePhotoFailed')); } };
  const removePhoto = async () => { try { await discardIssuePhoto(photo); onPhoto(undefined); } catch { Alert.alert(t('issuePhotoFailed')); } };
  const cancel = async () => { await discardIssuePhoto(photo).catch(() => undefined); onPhoto(undefined); onBack(); };
  const submit = async () => { setSaving(true); try { await onSubmit(); } catch { Alert.alert(t('issueSaveFailed')); } finally { setSaving(false); } };
  const relatedAction = actionId ? items.find((action) => action.id === actionId) : undefined;
  return <SwipeBack onBack={cancel}><ScrollView contentContainerStyle={styles.page}><Pressable disabled={saving} onPress={() => { void cancel(); }}><Text style={styles.back}>‹ {t('cancel')}</Text></Pressable><Text style={styles.h1}>{t('issueTitle')}</Text><Text style={styles.sub}>{t('issueHint')}</Text><Text style={styles.label}>{t('relatedAction')}</Text><Pressable testID="issue-related-action" style={styles.selector} onPress={onChooseAction}><Text style={styles.selectorText}>{relatedAction ? content(relatedAction, language).title : t('none')}</Text><Text style={styles.selectorChevron}>›</Text></Pressable><Text style={styles.label}>{t('title')} *</Text><TextInput testID="issue-title" value={title} onChangeText={onTitle} placeholder={t('titlePlaceholder')} autoFocus style={styles.titleInput} /><TextInput value={note} onChangeText={onNote} placeholder={t('note')} multiline style={styles.input} />{photo && <Image source={{ uri: photo }} style={styles.photo} />}<SmallButton disabled={saving} label={photo ? t('replacePhoto') : t('addPhoto')} onPress={() => { void choosePhoto(); }} />{photo && <SmallButton disabled={saving} label={t('removePhoto')} onPress={() => { void removePhoto(); }} />}<Callout title={t('stop')} body={relatedAction ? content(relatedAction, language).escalationGuidance : t('generalSafety')} /><Pressable testID="issue-save" style={[styles.primary, (saving || !title.trim()) && styles.dim]} disabled={saving || !title.trim()} onPress={() => { void submit(); }}><Text style={styles.primaryText}>{t('submit')}</Text></Pressable></ScrollView></SwipeBack>;
}

export function History({ state, language, onOpenReport, onOpenIssue }: { state: AppState; language: 'en' | 'da'; onOpenReport: () => void; onOpenIssue: (outcome: TaskOutcome) => void }) {
  const { t } = useTranslation(); const [filter, setFilter] = useState<'all' | TaskOutcome['type']>('all'); const [category, setCategory] = useState('all');
  const categories = Array.from(new Set(state.outcomes.map((outcome) => getAction(outcome.actionId)?.category).filter((item): item is string => Boolean(item)))).sort(); const filtered = state.outcomes.filter((outcome) => { const action = getAction(outcome.actionId); return (filter === 'all' || outcome.type === filter) && (category === 'all' || action?.category === category); });
  const filters: { id: 'all' | TaskOutcome['type']; label: string }[] = [{ id: 'all', label: t('all') }, { id: 'done', label: t('completed') }, { id: 'event_checked', label: t('weather.historyFilter') }, { id: 'snoozed', label: t('snoozed') }, { id: 'issue_reported', label: t('issues') }];
  const categoryLabel = (item: string) => item === 'all' ? t('all') : t(`actionCategories.${item}`);
  return <ScrollView contentContainerStyle={styles.page}><Text style={styles.h1}>{t('history')}</Text><Pressable accessibilityRole="button" style={styles.reportEntry} onPress={onOpenReport}><View style={styles.reportEntryIcon}><Text style={styles.reportEntryIconText}>⇩</Text></View><Text style={styles.rowTitle}>{t('report.open')}</Text><Text style={styles.chevron}>›</Text></Pressable><View style={styles.filterRow}>{filters.map((item) => <Choice key={item.id} label={item.label} selected={filter === item.id} onPress={() => setFilter(item.id)} />)}</View><Text style={styles.label}>{t('category')}</Text><View style={styles.filterRow}><Choice label={categoryLabel('all')} selected={category === 'all'} onPress={() => setCategory('all')} />{categories.map((item) => <Choice key={item} label={categoryLabel(item)} selected={category === item} onPress={() => setCategory(item)} />)}</View>{filtered.length === 0 ? <Text style={styles.empty}>{filter === 'issue_reported' ? t('noIssues') : t('noHistory')}</Text> : filtered.map((outcome) => { const action = getAction(outcome.actionId); const isIssue = outcome.type === 'issue_reported'; return <Pressable style={styles.row} key={outcome.id} disabled={!isIssue} onPress={() => onOpenIssue(outcome)}>{outcome.photoUri ? <View style={styles.historyPhoto}><Image source={{ uri: outcome.photoUri }} style={styles.historyPhotoImage} /></View> : action ? <ActionIcon actionId={action.id} /> : <View style={styles.dot} />}<View style={styles.rowCopy}><Text style={styles.rowTitle}>{outcome.title ?? (action ? content(action, language).title : outcome.actionId)}</Text><Text style={styles.rowSub}>{outcomeLabel(outcome.type, t)} · {formatDate(outcome.occurredAt, language)}</Text>{outcome.note ? <Text style={styles.rowSub} numberOfLines={1}>{outcome.note}</Text> : null}</View>{isIssue && <Text style={styles.chevron}>›</Text>}</Pressable>; })}</ScrollView>;
}

export function ReportExport({ state, language, onBack }: { state: AppState; language: 'en' | 'da'; onBack: () => void }) {
  const { t } = useTranslation(); const [periodMode, setPeriodMode] = useState<'month' | 'threeMonths' | 'year' | 'custom'>('month'); const [customStart, setCustomStart] = useState(() => { const date = new Date(); date.setDate(1); date.setHours(0, 0, 0, 0); return date; }); const [customEnd, setCustomEnd] = useState(() => new Date()); const [picker, setPicker] = useState<'start' | 'end' | null>(null); const [exporting, setExporting] = useState(false);
  const categoryLabel = (item: string) => t(`actionCategories.${item}`);
  const selectedPeriod = (() : ReportPeriod => { const now = new Date(); if (periodMode === 'custom') return { start: customStart, end: customEnd }; if (periodMode === 'year') return { start: new Date(now.getFullYear(), 0, 1), end: now }; if (periodMode === 'threeMonths') return { start: new Date(now.getFullYear(), now.getMonth() - 2, 1), end: now }; return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now }; })();
  const canExport = isValidReportPeriod(selectedPeriod) && hasReportableOutcomes(state.outcomes, selectedPeriod);
  const strings: ReportStrings = { title: t('report.title'), generated: t('report.generated'), home: t('report.home'), completed: t('report.completedCount'), issues: t('report.issueCount'), estimatedTime: t('report.estimatedTime'), completedMaintenance: t('report.completedMaintenance'), reportedIssues: t('report.reportedIssues'), date: t('report.date'), action: t('report.action'), duration: t('report.duration'), relatedAction: t('relatedAction'), note: t('note'), noNote: t('report.noNote'), profileSummary: (profile) => profile ? `${profile.houseType === 'terraced' ? t('report.terracedHome') : t('report.detachedHome')} · ${profile.appliances.length} ${t('report.appliances')} · ${profile.features.length} ${t('report.features')}` : t('report.noHomeProfile'), category: categoryLabel, hours: (minutes) => `${minutes} ${t('report.minutes')}` };
  const updatePicker = (_event: DateTimePickerChangeEvent, date?: Date) => { if (date && picker === 'start') setCustomStart(date); if (date && picker === 'end') setCustomEnd(date); if (Platform.OS === 'android') setPicker(null); };
  const exportPdf = async () => { if (!isValidReportPeriod(selectedPeriod)) { Alert.alert(t('report.title'), t('report.invalidPeriod')); return; } setExporting(true); try { const result = await exportMaintenanceReport(state, selectedPeriod, language, strings); Alert.alert(t('report.title'), result.status === 'shared' ? t('report.exported') : t('report.noActivity')); } catch { Alert.alert(t('report.title'), t('report.exportFailed')); } finally { setExporting(false); } };
  const periodLabel = periodMode === 'month' ? t('report.thisMonth') : periodMode === 'threeMonths' ? t('report.lastThreeMonths') : periodMode === 'year' ? t('report.thisYear') : `${customStart.toLocaleDateString(language === 'da' ? 'da-DK' : 'en-GB')} - ${customEnd.toLocaleDateString(language === 'da' ? 'da-DK' : 'en-GB')}`;
  return <ScrollView contentContainerStyle={styles.page}><Pressable onPress={onBack}><Text style={styles.back}>‹ {t('history')}</Text></Pressable><Text style={styles.h1}>{t('report.title')}</Text><Text style={styles.sub}>{t('report.hint')}</Text><View style={styles.reportPeriodCard}><Text style={styles.rowTitle}>{t('report.period')}</Text><View style={styles.reportPeriodGrid}><Choice label={t('report.thisMonth')} selected={periodMode === 'month'} onPress={() => setPeriodMode('month')} /><Choice label={t('report.lastThreeMonths')} selected={periodMode === 'threeMonths'} onPress={() => setPeriodMode('threeMonths')} /><Choice label={t('report.thisYear')} selected={periodMode === 'year'} onPress={() => setPeriodMode('year')} /><Choice label={t('custom')} selected={periodMode === 'custom'} onPress={() => setPeriodMode('custom')} /></View>{periodMode === 'custom' && <><Pressable style={styles.selector} onPress={() => setPicker('start')}><Text style={styles.selectorText}>{t('report.startDate')}: {customStart.toLocaleDateString(language === 'da' ? 'da-DK' : 'en-GB')}</Text><Text style={styles.selectorChevron}>›</Text></Pressable><Pressable style={styles.selector} onPress={() => setPicker('end')}><Text style={styles.selectorText}>{t('report.endDate')}: {customEnd.toLocaleDateString(language === 'da' ? 'da-DK' : 'en-GB')}</Text><Text style={styles.selectorChevron}>›</Text></Pressable></>}</View><Text style={styles.rowSub}>{isValidReportPeriod(selectedPeriod) ? `${periodLabel} · ${canExport ? t('report.ready') : t('report.noActivity')}` : t('report.invalidPeriod')}</Text><Pressable accessibilityRole="button" disabled={exporting || !canExport} style={[styles.primary, (exporting || !canExport) && styles.dim]} onPress={() => { void exportPdf(); }}><Text style={styles.primaryText}>{exporting ? t('report.exporting') : t('report.export')}</Text></Pressable>{picker && (Platform.OS === 'ios' ? <Modal transparent animationType="slide" visible onRequestClose={() => setPicker(null)}><View style={formStyles.pickerOverlay}><View style={formStyles.pickerCard}><DateTimePicker value={picker === 'start' ? customStart : customEnd} mode="date" display="spinner" onChange={updatePicker} /><Pressable style={styles.primary} onPress={() => setPicker(null)}><Text style={styles.primaryText}>{t('save')}</Text></Pressable></View></View></Modal> : <DateTimePicker value={picker === 'start' ? customStart : customEnd} mode="date" display="default" onChange={updatePicker} />)}</ScrollView>;
}

export function IssueDetail({ outcome, language, onBack, onDeletePhoto, onDeleteIssue }: { outcome: TaskOutcome; language: 'en' | 'da'; onBack: () => void; onDeletePhoto: () => Promise<void>; onDeleteIssue: () => Promise<void> }) {
  const { t } = useTranslation(); const action = getAction(outcome.actionId); const copy = action ? content(action, language) : undefined;
  return <ScrollView contentContainerStyle={styles.page}><Pressable onPress={onBack}><Text style={styles.back}>‹ {t('history')}</Text></Pressable><Text style={styles.kicker}>{t('issueReported').toUpperCase()} · {formatDate(outcome.occurredAt, language)}</Text><Text style={styles.h1}>{outcome.title ?? (action ? copy!.title : outcome.actionId)}</Text>{outcome.photoUri && <Image source={{ uri: outcome.photoUri }} style={styles.photo} />}{outcome.note && <><Text style={styles.sectionTitle}>{t('yourNote')}</Text><Text style={styles.sub}>{outcome.note}</Text></>}{copy && <View style={styles.warning}><Text style={styles.warningTitle}>{t('stop')}</Text><Text style={styles.warningText}>{copy.escalationGuidance}</Text></View>}{outcome.photoUri && <SmallButton label={t('deletePhoto')} onPress={() => Alert.alert(t('deletePhoto'), t('deleteIssueConfirm'), [{ text: t('cancel'), style: 'cancel' }, { text: t('deletePhoto'), style: 'destructive', onPress: () => { void onDeletePhoto(); } }])} />}<SmallButton label={t('deleteIssue')} onPress={() => Alert.alert(t('deleteIssue'), t('deleteIssueConfirm'), [{ text: t('cancel'), style: 'cancel' }, { text: t('deleteIssue'), style: 'destructive', onPress: () => { void onDeleteIssue(); } }])} /></ScrollView>;
}

export function Settings({ state, onState, onEditProfile, onOpenActions, onOpenNotifications, onOpenAbout, onOpenDebug, onReset }: { state: AppState; onState: (state: AppState) => void; onEditProfile: () => void; onOpenActions: () => void; onOpenNotifications: () => void; onOpenAbout: () => void; onOpenDebug: () => void; onReset: () => Promise<void> }) { const { t } = useTranslation(); return <ScrollView contentContainerStyle={styles.page}><Text style={styles.h1}>{t('settings')}</Text><SmallButton label={t('editHome')} onPress={onEditProfile} /><SmallButton label={t('actionsOverview')} onPress={onOpenActions} /><SmallButton label={t('notificationSettings')} onPress={onOpenNotifications} /><View style={styles.setting}><Text style={styles.rowTitle}>{t('language')}</Text><View style={styles.choiceRow}><Choice label={t('languages.english')} selected={state.settings.language === 'en'} onPress={async () => onState(await updateSettings({ ...state.settings, language: 'en' }))} /><Choice label={t('languages.danish')} selected={state.settings.language === 'da'} onPress={async () => onState(await updateSettings({ ...state.settings, language: 'da' }))} /></View></View>{__DEV__ && <><SmallButton label={t('backup.export')} onPress={async () => { try { await exportBackup(state); } catch { Alert.alert(t('backup.exportFailedTitle'), t('backup.exportFailed')); } }} /><SmallButton label={t('backup.import')} onPress={async () => { try { const nextState = await importLocalBackup(); if (nextState) onState(nextState); } catch (error) { Alert.alert(t('backup.importFailedTitle'), error instanceof Error ? error.message : t('backup.importFailed')); } }} /></>}<SmallButton label={t('resetAppData')} onPress={() => Alert.alert(t('resetConfirmTitle'), t('resetConfirmBody'), [{ text: t('cancel'), style: 'cancel' }, { text: t('reset'), style: 'destructive', onPress: () => { void onReset(); } }])} /><SmallButton label={t('legal.about')} onPress={onOpenAbout} />{__DEV__ && <SmallButton label={t('debugNotifications')} onPress={onOpenDebug} />}</ScrollView>; }

export function About({ language, onBack, onOpenDocument }: { language: 'en' | 'da'; onBack: () => void; onOpenDocument: (id: LegalDocumentId) => void }) {
  const { t } = useTranslation();
  const version = Application.nativeApplicationVersion ?? '0.1.0';
  const build = Application.nativeBuildVersion ?? '1';
  const links: LegalDocumentId[] = ['privacy', 'terms', 'acknowledgements', 'permissions'];
  return <ScrollView contentContainerStyle={styles.page}><Pressable onPress={onBack}><Text style={styles.back}>‹ {t('settings')}</Text></Pressable><Text style={styles.h1}>{t('legal.title')}</Text><Text style={styles.sub}>House Care</Text><View style={styles.legalCard}><Text style={styles.rowTitle}>{t('legal.version')}</Text><Text style={styles.rowSub}>{version}</Text><Text style={styles.rowTitle}>{t('legal.build')}</Text><Text style={styles.rowSub}>{build}</Text><Text style={styles.rowTitle}>{t('legal.support')}</Text><Text style={styles.rowSub}>support@housecare.example</Text></View>{links.map((id) => <SmallButton key={id} label={legalDocuments[language][id].title} onPress={() => onOpenDocument(id)} />)}</ScrollView>;
}

export function LegalDocumentView({ language, documentId, onBack }: { language: 'en' | 'da'; documentId: LegalDocumentId; onBack: () => void }) {
  const { t } = useTranslation();
  const document = legalDocuments[language][documentId];
  return <ScrollView contentContainerStyle={styles.page}><Pressable onPress={onBack}><Text style={styles.back}>‹ {t('legal.about')}</Text></Pressable><Text style={styles.h1}>{document.title}</Text><Text style={styles.sub}>{document.summary}</Text><Text style={styles.rowSub}>{t('legal.policyVersion')}: {document.version} · {t('legal.lastUpdated')}: {document.updated}</Text>{document.sections.map((section) => <View key={section.heading} style={styles.legalCard}><Text style={styles.sectionTitle}>{section.heading}</Text>{section.paragraphs.map((paragraph) => <Text key={paragraph} style={styles.rowSub}>{paragraph}</Text>)}{section.bullets?.map((bullet) => <Text key={bullet} style={styles.rowSub}>• {bullet}</Text>)}</View>)}{documentId === 'acknowledgements' && thirdPartyNotices.map((notice) => <View key={`${notice.name}-${notice.version}`} style={styles.legalCard}><Text style={styles.rowTitle}>{notice.name} {notice.version}</Text><Text style={styles.rowSub}>{notice.copyright ?? t('legal.copyrightFallback')}</Text><Text style={styles.rowSub}>{notice.license}</Text><Text style={styles.rowSub}>{notice.licenseText}</Text></View>)}<Pressable style={styles.secondary} onPress={() => { void Linking.openURL(document.url); }}><Text style={styles.secondaryText}>{t('legal.viewOnline')}</Text></Pressable></ScrollView>;
}

export function NotificationSettings({ settings, onBack, onSettings }: { settings: AppState['settings']; onBack: () => void; onSettings: (settings: AppState['settings']) => Promise<void> }) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState<AppState['settings']>(() => ({ ...settings, notificationSchedule: { ...defaultNotificationSchedule(), ...settings.notificationSchedule } }));
  const [picker, setPicker] = useState<{ weekday: Weekday; field: 'startTime' | 'endTime' } | null>(null);
  const [saving, setSaving] = useState(false);
  const enabled = draft.notificationsEnabled;
  const weekdayName = (weekday: Weekday) => new Intl.DateTimeFormat(i18n.language === 'da' ? 'da-DK' : 'en-US', { weekday: 'long' }).format(new Date(2021, 0, 3 + weekday));
  const updateDay = (weekday: Weekday, patch: Partial<NotificationSchedule[Weekday]>) => setDraft((current) => ({ ...current, notificationSchedule: { ...current.notificationSchedule, [weekday]: { ...current.notificationSchedule[weekday], ...patch } } }));
  const pickerValue = () => { const value = picker ? draft.notificationSchedule[picker.weekday][picker.field] : '00:00'; const [hours, minutes] = (value === '24:00' ? '23:59' : value).split(':').map(Number); const date = new Date(); date.setHours(hours, minutes, 0, 0); return date; };
  const changeTime = (_event: DateTimePickerChangeEvent, value: Date) => { if (picker) updateDay(picker.weekday, { [picker.field]: `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}` }); if (Platform.OS === 'android') setPicker(null); };
  const toggleNotifications = async (nextEnabled: boolean) => { if (!nextEnabled) { setDraft((current) => ({ ...current, notificationsEnabled: false })); return; } const granted = await requestNotificationPermission(); if (!granted) { Alert.alert(t('notificationPermissionDenied')); return; } setDraft((current) => ({ ...current, notificationsEnabled: true, notificationsPermissionRequested: true })); };
  const leave = async () => { setSaving(true); try { await onSettings(draft); onBack(); } catch (error) { Alert.alert(t('notificationTiming'), error instanceof Error ? error.message : t('timingInvalid')); } finally { setSaving(false); } };
  return <SwipeBack onBack={leave}><ScrollView contentContainerStyle={styles.page}><Pressable disabled={saving} onPress={() => { void leave(); }}><Text style={styles.back}>‹ {t('settings')}</Text></Pressable><Text style={styles.h1}>{t('notificationSettings')}</Text><View style={styles.setting}><Text style={styles.rowTitle}>{t('notifications')}</Text><Switch value={enabled} onValueChange={(nextEnabled) => { void toggleNotifications(nextEnabled); }} /></View><View pointerEvents={enabled ? 'auto' : 'none'} style={!enabled && styles.dim}><Text style={styles.sectionTitle}>{t('notificationTiming')}</Text><Text style={styles.sub}>{t('notificationTimingHint')}</Text>{weekdays.map((weekday) => { const preference = draft.notificationSchedule[weekday]; return <View style={styles.setting} key={weekday}><View style={formStyles.daySetting}><Text style={styles.rowTitle}>{weekdayName(weekday)}</Text><View style={formStyles.timeRow}><Pressable style={formStyles.timeSelector} onPress={() => setPicker({ weekday, field: 'startTime' })}><Text style={formStyles.timeText}>{preference.startTime}</Text></Pressable><Text style={formStyles.rangeDash}>–</Text><Pressable style={formStyles.timeSelector} onPress={() => setPicker({ weekday, field: 'endTime' })}><Text style={formStyles.timeText}>{preference.endTime}</Text></Pressable></View></View><Switch value={preference.enabled} onValueChange={(dayEnabled) => updateDay(weekday, { enabled: dayEnabled })} /></View>; })}</View>{picker && (Platform.OS === 'ios' ? <Modal transparent animationType="slide" visible onRequestClose={() => setPicker(null)}><View style={formStyles.pickerOverlay}><View style={formStyles.pickerCard}><DateTimePicker value={pickerValue()} mode="time" display="spinner" onValueChange={changeTime} onDismiss={() => setPicker(null)} /><Pressable style={styles.primary} onPress={() => setPicker(null)}><Text style={styles.primaryText}>{t('pickerDone')}</Text></Pressable></View></View></Modal> : <DateTimePicker value={pickerValue()} mode="time" display="default" onValueChange={changeTime} onDismiss={() => setPicker(null)} />)}</ScrollView></SwipeBack>;
}

export function NotificationDebug({ state, onBack, onState }: { state: AppState; onBack: () => void; onState: (state: AppState) => void }) {
  const { t } = useTranslation(); const [count, setCount] = useState<number | null>(null); const [permission, setPermission] = useState('unknown');
  const refresh = async () => { const nextCount = await scheduledNotificationCount(); setCount(nextCount); const granted = await notificationPermissionGranted(); setPermission(granted ? 'granted' : 'denied'); };
  return <ScrollView contentContainerStyle={styles.page}><Pressable onPress={onBack}><Text style={styles.back}>‹ {t('settings')}</Text></Pressable><Text style={styles.kicker}>{t('development')}</Text><Text style={styles.h1}>{t('debugNotifications')}</Text><View style={styles.setting}><Text style={styles.rowTitle}>{t('permission')}</Text><Text style={styles.rowSub}>{t(`permissionStates.${permission}`)}</Text></View><View style={styles.setting}><Text style={styles.rowTitle}>{t('scheduled')}</Text><Text style={styles.rowSub}>{count ?? '…'}</Text></View><View style={styles.setting}><Text style={styles.rowTitle}>{t('timezone')}</Text><Text style={styles.rowSub}>{Intl.DateTimeFormat().resolvedOptions().timeZone}</Text></View><SmallButton label={t('sendTest')} onPress={async () => { await sendTestNotification(); Alert.alert(t('debugNotifications'), t('testSent')); }} /><SmallButton label={t('cancelAll')} onPress={async () => { await cancelScheduledNotifications(); await refresh(); }} /><SmallButton label={t('refresh')} onPress={async () => { onState(await updateSettings(state.settings)); await refresh(); }} /></ScrollView>;
}

function TabBar({ active, attentionCount, onChange }: { active: Tab; attentionCount: number; onChange: (tab: Tab) => void }) { const { t } = useTranslation(); return <View style={styles.tabs}>{(['home', 'actions', 'history', 'settings'] as Tab[]).map((tab) => <Pressable key={tab} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: active === tab }} onPress={() => onChange(tab)}><NavIcon tab={tab} active={active === tab} badgeCount={tab === 'actions' ? attentionCount : 0} /><Text style={[styles.tabText, active === tab && styles.tabActive]}>{t(tab)}</Text></Pressable>)}</View>; }
function NavIcon({ tab, active, badgeCount }: { tab: Tab; active: boolean; badgeCount: number }) { const glyphs: Record<Tab, string> = { home: '⌂', actions: '☷', history: '◷', settings: '⚙︎' }; return <View style={styles.navIconWrap} accessibilityElementsHidden><Text style={[styles.navIcon, { width: 28, height: 28, lineHeight: 28, textAlign: 'center', includeFontPadding: false }, active && styles.navIconActive]}>{glyphs[tab]}</Text>{badgeCount > 0 && <View style={styles.attentionBadge}><Text style={styles.attentionBadgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text></View>}</View>; }
function ProfileCard({ glyph, label, selected, onPress }: { glyph: string; label: string; selected: boolean; onPress: () => void }) { return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} style={[styles.setupOptionCard, selected && styles.setupOptionCardSelected]} onPress={onPress}><Text style={styles.setupOptionGlyph}>{glyph}</Text>{selected && <View style={styles.setupCheck}><Text style={styles.setupCheckText}>✓</Text></View>}<Text style={styles.setupOptionLabel}>{label}</Text></Pressable>; }
function SetupActions({ onBack, onNext, nextLabel, disabled = false }: { onBack: () => void; onNext: () => void; nextLabel?: string; disabled?: boolean }) { const { t } = useTranslation(); return <View style={styles.setupActions}><Pressable accessibilityRole="button" style={styles.setupSecondary} onPress={onBack}><Text style={styles.setupSecondaryText}>{t('onboarding.back')}</Text></Pressable><Pressable accessibilityRole="button" disabled={disabled} style={[styles.setupPrimary, disabled && styles.dim]} onPress={onNext}><Text style={styles.primaryText}>{nextLabel ?? t('continue')}</Text></Pressable></View>; }
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} style={[styles.choice, selected && styles.choiceSelected]} onPress={onPress}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>; }
function SmallButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) { return <Pressable disabled={disabled} style={[styles.smallButton, disabled && styles.dim]} onPress={onPress}><Text style={styles.smallButtonText}>{label}</Text></Pressable>; }
function Callout({ title, body }: { title: string; body: string }) { return <View style={styles.callout}><Text style={styles.calloutTitle}>{title}</Text><Text style={styles.calloutText}>{body}</Text></View>; }
function content(action: MaintenanceAction, language: 'en' | 'da') { return language === 'da' && action.content.da ? action.content.da : action.content.en; }
function dueFor(action: MaintenanceAction, configuration?: ActionConfiguration) { return new Date(configuration?.snoozedUntil ?? configuration?.nextDueAt ?? (action.trigger.kind === 'habit' ? '9999-01-01' : new Date().toISOString())).getTime(); }
function outcomeLabel(type: TaskOutcome['type'], t: (key: string) => string) { return type === 'event_checked' ? t('weather.historyLabel') : type === 'issue_reported' ? t('issueReported') : type === 'done' ? t('completed') : t('snoozed'); }

const colors = { ink: '#17352C', muted: '#687B72', green: '#2F7563', deep: '#1F5547', sage: '#DCEEE4', line: '#DCE7DF', yellow: '#F6EAD0', warning: '#B65145', background: '#F5F8F5' };
const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.background }, loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }, page: { padding: 22, paddingBottom: 96, gap: 12 }, reportEntry: { backgroundColor: '#fff', borderColor: colors.line, borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, reportEntryIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' }, reportEntryIconText: { color: colors.deep, fontWeight: '800', fontSize: 17 }, reportPeriodCard: { backgroundColor: '#fff', borderColor: colors.line, borderWidth: 1, borderRadius: 13, padding: 12, gap: 10 }, reportPeriodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kicker: { color: colors.green, fontWeight: '800', letterSpacing: 1.5, fontSize: 11, marginTop: 8 }, h1: { color: colors.ink, fontSize: 30, lineHeight: 34, fontWeight: '800', marginTop: 4 }, sub: { color: colors.muted, fontSize: 14, lineHeight: 20 }, label: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 12 },
  setupPage: { flexGrow: 1, justifyContent: 'space-between', paddingBottom: 32 }, setupWelcome: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 28 }, setupMark: { color: colors.green, fontSize: 30, lineHeight: 36 }, setupTitle: { color: colors.ink, fontSize: 30, lineHeight: 35, fontWeight: '800', marginTop: 12 }, setupIntro: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8 }, setupWelcomeTitle: { textAlign: 'center' }, setupWelcomeIntro: { textAlign: 'center' }, setupIllustration: { width: '100%', height: 220, borderRadius: 24, marginVertical: 28, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, setupIllustrationText: { color: colors.deep, fontSize: 118, lineHeight: 130 }, setupSparkle: { position: 'absolute', right: 46, top: 38, color: '#D8A33C', fontSize: 28 }, setupReassurance: { color: colors.muted, fontSize: 12, marginTop: 17 }, setupProgress: { flexDirection: 'row', alignItems: 'center', gap: 12 }, setupBack: { color: colors.deep, fontSize: 34, lineHeight: 34, width: 30 }, setupProgressCopy: { flex: 1, alignItems: 'center', gap: 8 }, setupProgressText: { color: colors.ink, fontWeight: '800', fontSize: 13 }, setupProgressBars: { flexDirection: 'row', gap: 4, width: 120 }, setupProgressBar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.line }, setupProgressBarActive: { backgroundColor: colors.deep }, setupHomeCards: { flexDirection: 'row', gap: 10, marginTop: 20 }, setupOptionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 }, setupOptionCard: { flexGrow: 1, flexBasis: '44%', minHeight: 126, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', borderRadius: 16, padding: 14, justifyContent: 'space-between', position: 'relative' }, setupOptionCardSelected: { borderColor: colors.green, backgroundColor: colors.sage }, setupOptionGlyph: { color: colors.deep, fontSize: 38, lineHeight: 42 }, setupOptionLabel: { color: colors.ink, fontSize: 15, fontWeight: '700', paddingRight: 18 }, setupCheck: { position: 'absolute', top: 12, right: 12, width: 23, height: 23, borderRadius: 12, backgroundColor: colors.deep, alignItems: 'center', justifyContent: 'center' }, setupCheckText: { color: '#fff', fontSize: 13, fontWeight: '800' }, setupAgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, setupActions: { flexDirection: 'row', gap: 10, marginTop: 'auto', paddingTop: 24 }, setupSecondary: { flex: 1, borderWidth: 1, borderColor: colors.green, padding: 15, borderRadius: 12, alignItems: 'center' }, setupSecondaryText: { color: colors.deep, fontSize: 15, fontWeight: '800' }, setupPrimary: { flex: 1.25, backgroundColor: colors.deep, padding: 15, borderRadius: 12, alignItems: 'center' }, setupPlan: { marginTop: 22, borderRadius: 14, backgroundColor: colors.sage, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, setupPlanIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#C7E4D4', alignItems: 'center', justifyContent: 'center' }, setupPlanIconText: { color: colors.deep, fontSize: 19, fontWeight: '800' },
  selector: { borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', padding: 13, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, selectorText: { color: colors.ink, fontSize: 15 }, selectorChevron: { color: colors.green, fontSize: 22 }, choiceRow: { flexDirection: 'row', gap: 8 }, choiceGrid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, choice: { borderWidth: 1, borderColor: colors.line, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 11, backgroundColor: '#fff' }, choiceSelected: { backgroundColor: colors.sage, borderColor: colors.green }, choiceText: { color: colors.ink, textTransform: 'capitalize', fontSize: 13 }, choiceTextSelected: { color: colors.deep, fontWeight: '800' },
  primary: { backgroundColor: colors.deep, padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 }, primaryText: { color: 'white', fontSize: 15, fontWeight: '800' }, secondary: { borderWidth: 1, borderColor: colors.green, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 10 }, secondaryText: { color: colors.deep, fontSize: 15, fontWeight: '800' }, calendarButton: { backgroundColor: colors.green, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16, borderWidth: 1, borderColor: colors.deep }, calendarButtonText: { color: 'white', fontSize: 16, fontWeight: '800' }, dim: { opacity: 0.55 }, hero: { backgroundColor: colors.green, borderRadius: 18, padding: 18, marginTop: 10 }, heroEyebrow: { color: '#D8EEE3', fontSize: 11, fontWeight: '800' }, heroTitle: { color: 'white', fontSize: 21, fontWeight: '800', marginTop: 8 }, heroText: { color: '#EAF6EF', fontSize: 14, lineHeight: 20, marginTop: 8 }, heroButton: { color: colors.deep, backgroundColor: 'white', padding: 11, borderRadius: 10, textAlign: 'center', fontWeight: '800', marginTop: 16 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 16 }, overviewCategory: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderColor: colors.line }, afterUseCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12 }, afterUseRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 }, rowCopy: { flex: 1, gap: 3 }, rowTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' }, rowSub: { color: colors.muted, fontSize: 12, lineHeight: 17 }, dot: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.sage }, actionIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.sage, justifyContent: 'center', alignItems: 'center' }, actionGlyph: { color: colors.green, fontSize: 17 }, filterRing: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.green, overflow: 'hidden', position: 'relative' }, filterLine: { position: 'absolute', backgroundColor: colors.green, opacity: 0.65 }, filterLineOne: { height: 1, left: 1, right: 1, top: 5 }, filterLineTwo: { height: 1, left: 1, right: 1, top: 9 }, filterLineThree: { height: 1, left: 1, right: 1, top: 13 }, filterLineVerticalOne: { width: 1, top: 1, bottom: 1, left: 5 }, filterLineVerticalTwo: { width: 1, top: 1, bottom: 1, left: 11 }, filterSparkle: { position: 'absolute', right: 1, top: -5, color: colors.deep, fontSize: 13, fontWeight: '800' }, chevron: { color: colors.green, fontSize: 24 }, empty: { color: colors.muted, fontSize: 15, marginTop: 24, lineHeight: 22 }, back: { color: colors.green, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  callout: { backgroundColor: colors.yellow, padding: 14, borderRadius: 13, gap: 5, marginTop: 8 }, calloutTitle: { color: '#755C25', fontSize: 13, fontWeight: '800' }, calloutText: { color: '#755C25', lineHeight: 19, fontSize: 13 }, step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, stepNumber: { backgroundColor: colors.sage, color: colors.deep, width: 24, height: 24, textAlign: 'center', paddingTop: 3, borderRadius: 12, fontWeight: '800' }, stepText: { flex: 1, color: colors.ink, lineHeight: 20, fontSize: 14 }, bullet: { color: colors.ink, fontSize: 14, lineHeight: 21 }, warning: { borderLeftWidth: 4, borderColor: colors.warning, paddingLeft: 12, gap: 4, marginTop: 8 }, warningTitle: { color: colors.warning, fontWeight: '800' }, warningText: { color: '#704E48', fontSize: 13, lineHeight: 19 }, actionGrid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, smallButton: { borderColor: colors.line, borderWidth: 1, backgroundColor: '#fff', padding: 11, borderRadius: 10, marginTop: 6 }, smallButtonText: { color: colors.deep, fontWeight: '700', fontSize: 13 }, presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, titleInput: { minHeight: 48, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, color: colors.ink }, input: { minHeight: 110, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, padding: 12, textAlignVertical: 'top', color: colors.ink }, photo: { width: '100%', height: 210, borderRadius: 12 }, setting: { backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: colors.line, gap: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, legalCard: { backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: colors.line, gap: 8 }, tabs: { flexDirection: 'row', borderTopWidth: 1, borderColor: colors.line, backgroundColor: '#fff', paddingTop: 10, paddingBottom: 14 }, tab: { flex: 1, alignItems: 'center' }, tabText: { color: colors.muted, fontSize: 11 }, tabActive: { color: colors.deep, fontWeight: '800' }, navIconWrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', position: 'relative' }, navIcon: { color: colors.muted, fontSize: 24, height: 28 }, navIconActive: { color: colors.deep }, attentionBadge: { position: 'absolute', top: -5, right: -8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.warning, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }, attentionBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' }, issueEntry: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#ECC8C1', backgroundColor: '#FFF8F6', marginTop: 12 }, issueIcon: { width: 35, height: 35, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5DDD8' }, issueIconText: { color: '#A64035', fontWeight: '800', fontSize: 18 }, issueChevron: { color: '#A64035', fontSize: 24 }, filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }, historyPhoto: { width: 38, height: 38, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.sage }, historyPhotoImage: { width: '100%', height: '100%' } });
const formStyles = StyleSheet.create({ formCard: { backgroundColor: colors.sage, borderRadius: 12, padding: 12, gap: 8 }, daySetting: { flex: 1, gap: 8 }, timeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, timeInput: { flex: 1, minHeight: 38, borderRadius: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 7, color: colors.ink, fontSize: 12 }, timeSelector: { flex: 1, minHeight: 38, borderRadius: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.line, justifyContent: 'center', paddingHorizontal: 9 }, timeText: { color: colors.ink, fontSize: 13 }, rangeDash: { color: colors.muted }, pickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' }, pickerCard: { backgroundColor: colors.background, padding: 18, borderTopLeftRadius: 18, borderTopRightRadius: 18 } });
