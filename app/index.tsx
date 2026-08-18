import '../src/i18n';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { actionApplies, actions, getAction } from '../src/catalog';
import { formatDate, nextDueDate } from '../src/date';
import { exportBackup } from '../src/backup';
import { cancelScheduledNotifications, notificationPermissionGranted, requestNotificationPermission, scheduledNotificationCount, sendTestNotification, subscribeToNotificationResponses } from '../src/notifications';
import { defaultNotificationSchedule, weekdays } from '../src/notificationSchedule';
import { deleteIssuePhoto, deleteIssueRecord, importLocalBackup, loadAppState, recordIssue, recordOutcome, resetAppData, saveHomeProfile, setActionEnabled, updateFrequency, updateSettings, type AppState } from '../src/service';
import type { ActionConfiguration, Frequency, MaintenanceAction, NotificationSchedule, Profile, TaskOutcome, Weekday } from '../src/types';

type Tab = 'home' | 'actions' | 'history' | 'settings';
type ViewName = Tab | 'detail' | 'setup' | 'issue' | 'issue-select' | 'issue-detail' | 'notification-timing' | 'notification-debug';

const applianceChoices = [
  ['dishwasher', 'dishwasher'], ['washing-machine', 'washingMachine'], ['tumble-dryer', 'tumbleDryer'], ['cooker-hood', 'cookerHood'],
] as const;
const featureChoices = ['gutters', 'drainage-faskine', 'pump-well', 'outdoor-tap', 'ventilation', 'underfloor-heating', 'wood-floors', 'floor-drains'];
const presets: Frequency[] = [{ interval: 1, unit: 'week' }, { interval: 1, unit: 'month' }, { interval: 3, unit: 'month' }, { interval: 6, unit: 'month' }, { interval: 1, unit: 'year' }];

export default function Index() {
  const { i18n } = useTranslation();
  const [state, setState] = useState<AppState | null>(null);
  const [view, setView] = useState<ViewName>('home');
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [issueTitle, setIssueTitle] = useState('');
  const [issueNote, setIssueNote] = useState('');
  const [issuePhoto, setIssuePhoto] = useState<string | undefined>();
  const [issueActionId, setIssueActionId] = useState<string | undefined>();
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(null);
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
    loadAppState().then((nextState) => {
      stateRef.current = nextState;
      if (active) {
        setState(nextState);
        if (pendingNotificationActionId.current) openNotificationAction(pendingNotificationActionId.current);
      }
    });
    return () => { active = false; };
  }, [openNotificationAction]);
  useEffect(() => { if (state) void i18n.changeLanguage(state.settings.language); }, [i18n, state]);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => subscribeToNotificationResponses(openNotificationAction), [openNotificationAction]);
  useEffect(() => { const timer = setInterval(() => setCurrentTime(Date.now()), 60000); return () => clearInterval(timer); }, []);

  const configurations = useMemo(() => new Map(state?.configurations.map((config) => [config.actionId, config]) ?? []), [state]);
  const profile = state?.profile;
  const activeActions = useMemo(() => profile ? actions.filter((action) => configurations.get(action.id)?.enabled && actionApplies(action, profile)) : [], [configurations, profile]);
  const orderedActions = useMemo(() => [...activeActions].sort((a, b) => dueFor(a, configurations.get(a.id)) - dueFor(b, configurations.get(b.id))), [activeActions, configurations]);
  const selected = selectedActionId ? getAction(selectedActionId) : undefined;
  const selectedOutcome = selectedOutcomeId ? state?.outcomes.find((outcome) => outcome.id === selectedOutcomeId) : undefined;

  if (!state) return <SafeAreaView style={styles.loading}><ActivityIndicator color={colors.green} /></SafeAreaView>;
  if (!state.profile || view === 'setup') return <Setup initial={state.profile} onBack={state.profile ? () => setView('settings') : undefined} onSave={async (profile) => { setState(await saveHomeProfile(profile)); setView(state.profile ? 'settings' : 'home'); }} />;

  const openAction = (actionId: string) => { setSelectedActionId(actionId); setView('detail'); };
  const outcome = async (type: 'done' | 'snoozed' | 'not_relevant', snoozeDays?: number, snoozedUntil?: string) => {
    if (!selectedActionId) return;
    setState(await recordOutcome(selectedActionId, type, { snoozeDays, snoozedUntil }));
    setView(type === 'done' ? 'history' : 'home');
  };

  return (
    <SafeAreaView style={styles.safe}>
      {view === 'home' && <Home actions={orderedActions} configurations={configurations} language={state.settings.language} now={currentTime} onOpen={openAction} onReportIssue={() => setView('issue')} />}
      {view === 'actions' && <ActionList actions={orderedActions} configurations={configurations} language={state.settings.language} onOpen={openAction} />}
      {view === 'history' && <History state={state} language={state.settings.language} onOpenIssue={(outcome) => { setSelectedOutcomeId(outcome.id); setView('issue-detail'); }} />}
      {view === 'settings' && <Settings state={state} onState={setState} onEditProfile={() => setView('setup')} onOpenTiming={() => setView('notification-timing')} onOpenDebug={() => setView('notification-debug')} onReset={async () => { setState(await resetAppData()); setView('setup'); }} />}
      {view === 'notification-timing' && <NotificationTiming schedule={state.settings.notificationSchedule} onBack={() => setView('settings')} onSave={async (notificationSchedule) => { setState(await updateSettings({ ...state.settings, notificationSchedule })); setView('settings'); }} />}
      {view === 'notification-debug' && <NotificationDebug state={state} onBack={() => setView('settings')} onState={setState} />}
      {view === 'detail' && selected && <ActionDetail action={selected} configuration={configurations.get(selected.id)!} language={state.settings.language} onBack={() => setView('home')} onDone={() => outcome('done')} onSnooze={(days) => outcome('snoozed', days)} onCustomSnooze={(snoozedUntil) => outcome('snoozed', undefined, snoozedUntil)} onNotRelevant={() => outcome('not_relevant')} onIssue={() => setView('issue')} onFrequency={async (frequency) => setState(await updateFrequency(selected.id, frequency))} onEnabled={async (enabled) => setState(await setActionEnabled(selected.id, enabled))} />}
      {view === 'issue' && <IssueForm title={issueTitle} note={issueNote} photo={issuePhoto} actions={orderedActions} language={state.settings.language} actionId={issueActionId} onChooseAction={() => setView('issue-select')} onTitle={setIssueTitle} onNote={setIssueNote} onPhoto={setIssuePhoto} onBack={() => setView('home')} onSubmit={async () => { setState(await recordIssue(issueTitle, { actionId: issueActionId, note: issueNote, photoUri: issuePhoto })); setIssueTitle(''); setIssueNote(''); setIssuePhoto(undefined); setIssueActionId(undefined); setView('history'); }} />}
      {view === 'issue-select' && <IssueActionSelect actions={orderedActions} language={state.settings.language} onBack={() => setView('issue')} onSelect={(actionId) => { setIssueActionId(actionId); setView('issue'); }} />}
      {view === 'issue-detail' && selectedOutcome && <IssueDetail outcome={selectedOutcome} language={state.settings.language} onBack={() => setView('history')} onDeletePhoto={async () => setState(await deleteIssuePhoto(selectedOutcome))} onDeleteIssue={async () => { setState(await deleteIssueRecord(selectedOutcome)); setSelectedOutcomeId(null); setView('history'); }} />}
      {['home', 'actions', 'history', 'settings'].includes(view) && <TabBar active={view as Tab} onChange={setView} />}
    </SafeAreaView>
  );
}

export function Setup({ initial, onBack, onSave }: { initial: Profile | null; onBack?: () => void; onSave: (profile: Omit<Profile, 'id'>) => Promise<void> }) {
  const { t } = useTranslation();
  const [appliances, setAppliances] = useState<string[]>(initial?.appliances ?? ['dishwasher']);
  const [features, setFeatures] = useState<string[]>(initial?.features ?? []);
  const [houseType, setHouseType] = useState<Profile['houseType']>(initial?.houseType ?? 'detached');
  const [dryerVariant, setDryerVariant] = useState<string | undefined>(initial?.variants.tumbleDryer);
  const [hoodVariant, setHoodVariant] = useState<string | undefined>(initial?.variants.cookerHood);
  const [saving, setSaving] = useState(false);
  const toggle = (value: string, values: string[], setter: (items: string[]) => void) => setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}>
    {onBack && <Pressable onPress={onBack}><Text style={styles.back}>‹ {t('settings')}</Text></Pressable>}
    <Text style={styles.kicker}>HOUSE CARE</Text><Text style={styles.h1}>{t('welcome')}</Text><Text style={styles.sub}>{t('setupHint')}</Text>
    <Text style={styles.label}>House type</Text><View style={styles.choiceRow}>{(['detached', 'terraced'] as const).map((item) => <Choice key={item} label={item === 'detached' ? 'Detached' : 'Terraced'} selected={houseType === item} onPress={() => setHouseType(item)} />)}</View>
    <Text style={styles.label}>Appliances</Text><View style={styles.choiceGrid}>{applianceChoices.map(([id, label]) => <Choice key={id} label={t(label)} selected={appliances.includes(id)} onPress={() => toggle(id, appliances, setAppliances)} />)}</View>
    {appliances.includes('tumble-dryer') && <><Text style={styles.label}>Tumble dryer type</Text><View style={styles.choiceRow}><Choice label="Vented" selected={dryerVariant === 'vented'} onPress={() => setDryerVariant('vented')} /><Choice label="Condenser / heat pump" selected={dryerVariant === 'condenser'} onPress={() => setDryerVariant('condenser')} /></View></>}
    {appliances.includes('cooker-hood') && <><Text style={styles.label}>Cooker hood type</Text><View style={styles.choiceRow}><Choice label="Recirculating" selected={hoodVariant === 'recirculating'} onPress={() => setHoodVariant('recirculating')} /><Choice label="Vented outside" selected={hoodVariant === 'vented-outside'} onPress={() => setHoodVariant('vented-outside')} /></View></>}
    <Text style={styles.label}>Home features</Text><View style={styles.choiceGrid}>{featureChoices.map((id) => <Choice key={id} label={id.replaceAll('-', ' ')} selected={features.includes(id)} onPress={() => toggle(id, features, setFeatures)} />)}</View>
    <Pressable style={[styles.primary, saving && styles.dim]} disabled={saving || appliances.length === 0 || (appliances.includes('tumble-dryer') && !dryerVariant) || (appliances.includes('cooker-hood') && !hoodVariant)} onPress={async () => { setSaving(true); await onSave({ houseType, ageBand: 'new-build', appliances, features, variants: { ...(appliances.includes('tumble-dryer') && dryerVariant ? { tumbleDryer: dryerVariant } : {}), ...(appliances.includes('cooker-hood') && hoodVariant ? { cookerHood: hoodVariant } : {}) } }); setSaving(false); }}><Text style={styles.primaryText}>{saving ? '…' : t(onBack ? 'save' : 'continue')}</Text></Pressable>
  </ScrollView></SafeAreaView>;
}

export function Home({ actions: items, configurations, language, now, onOpen, onReportIssue }: { actions: MaintenanceAction[]; configurations: Map<string, ActionConfiguration>; language: 'en' | 'da'; now: number; onOpen: (id: string) => void; onReportIssue: () => void }) {
  const { t } = useTranslation(); const due = items.filter((action) => dueFor(action, configurations.get(action.id)) <= now); const current = due[0]; const upcoming = items.filter((action) => !due.includes(action)).slice(0, 2);
  return <ScrollView contentContainerStyle={styles.page}><Text style={styles.kicker}>{t('whatMatters')}</Text><Text style={styles.h1}>One small check{`\n`}for a calmer home.</Text>
    {current ? <Pressable style={styles.hero} onPress={() => onOpen(current.id)}><Text style={styles.heroEyebrow}>{t('dueNow').toUpperCase()} · {current.estimatedMinutes} MIN</Text><Text style={styles.heroTitle}>{content(current, language).title}</Text><Text style={styles.heroText}>{content(current, language).whyItMatters}</Text><Text style={styles.heroButton}>{t('viewSteps')} →</Text></Pressable> : <Text style={styles.empty}>{t('noTasks')}</Text>}
    <Pressable style={styles.issueEntry} onPress={onReportIssue}><View style={styles.issueIcon}><Text style={styles.issueIconText}>!</Text></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{t('reportIssueHome')}</Text><Text style={styles.rowSub}>{t('reportIssueHint')}</Text></View><Text style={styles.issueChevron}>›</Text></Pressable>
    <Text style={styles.sectionTitle}>{t('upcoming')}</Text>{upcoming.map((action) => <ActionRow key={action.id} action={action} configuration={configurations.get(action.id)} language={language} onPress={() => onOpen(action.id)} />)}
  </ScrollView>;
}

function ActionList({ actions: items, configurations, language, onOpen }: { actions: MaintenanceAction[]; configurations: Map<string, ActionConfiguration>; language: 'en' | 'da'; onOpen: (id: string) => void }) {
  const { t } = useTranslation(); return <ScrollView contentContainerStyle={styles.page}><Text style={styles.h1}>{t('actions')}</Text>{items.map((action) => <ActionRow key={action.id} action={action} configuration={configurations.get(action.id)} language={language} onPress={() => onOpen(action.id)} />)}</ScrollView>;
}

function ActionRow({ action, configuration, language, onPress }: { action: MaintenanceAction; configuration?: ActionConfiguration; language: 'en' | 'da'; onPress: () => void }) {
  return <Pressable style={styles.row} onPress={onPress}><ActionIcon actionId={action.id} /><View style={styles.rowCopy}><Text style={styles.rowTitle}>{content(action, language).title}</Text><Text style={styles.rowSub}>{configuration?.nextDueAt ? formatDate(configuration.snoozedUntil ?? configuration.nextDueAt, language) : 'After use'} · {action.estimatedMinutes} min</Text></View><Text style={styles.chevron}>›</Text></Pressable>;
}

function ActionIcon({ actionId }: { actionId: string }) {
  if (actionId === 'dishwasher-filter-clean') {
    return <View style={styles.actionIcon} accessibilityLabel="Dishwasher filter icon"><View style={styles.filterRing}><View style={[styles.filterLine, styles.filterLineOne]} /><View style={[styles.filterLine, styles.filterLineTwo]} /><View style={[styles.filterLine, styles.filterLineThree]} /><View style={[styles.filterLine, styles.filterLineVerticalOne]} /><View style={[styles.filterLine, styles.filterLineVerticalTwo]} /></View><Text style={styles.filterSparkle}>✦</Text></View>;
  }
  return <View style={styles.actionIcon} accessibilityLabel={`${actionId} icon`}><Text style={styles.actionGlyph}>{actionGlyphs[actionId] ?? '•'}</Text></View>;
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

function ActionDetail({ action, configuration, language, onBack, onDone, onSnooze, onCustomSnooze, onNotRelevant, onIssue, onFrequency, onEnabled }: { action: MaintenanceAction; configuration: ActionConfiguration; language: 'en' | 'da'; onBack: () => void; onDone: () => void; onSnooze: (days: number) => void; onCustomSnooze: (snoozedUntil: string) => void; onNotRelevant: () => void; onIssue: () => void; onFrequency: (frequency?: Frequency) => Promise<void>; onEnabled: (enabled: boolean) => Promise<void> }) {
  const { t } = useTranslation(); const copy = content(action, language); const current = configuration.frequencyOverride ?? action.trigger.defaultFrequency;
  const [customSnoozeOpen, setCustomSnoozeOpen] = useState(false); const [snoozeDate, setSnoozeDate] = useState(() => { const date = new Date(); date.setDate(date.getDate() + 1); date.setHours(0, 0, 0, 0); return date; }); const [snoozeTime, setSnoozeTime] = useState(() => { const date = new Date(); date.setHours(9, 0, 0, 0); return date; }); const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [customFrequencyOpen, setCustomFrequencyOpen] = useState(false); const [customFrequency, setCustomFrequency] = useState(String(current?.interval ?? 1)); const [customUnit, setCustomUnit] = useState<Frequency['unit']>(current?.unit ?? 'month');
  const customPreview = Number.isInteger(Number(customFrequency)) && Number(customFrequency) > 0 ? formatDate(nextDueDate(new Date(), { interval: Number(customFrequency), unit: customUnit }).toISOString(), language) : '—';
  const saveCustomSnooze = () => { const parsed = new Date(snoozeDate); parsed.setHours(snoozeTime.getHours(), snoozeTime.getMinutes(), 0, 0); if (Number.isNaN(parsed.getTime()) || parsed <= new Date()) { Alert.alert(t('snooze'), 'Choose a future date and time.'); return; } onCustomSnooze(parsed.toISOString()); };
  const onPickerChange = (event: DateTimePickerEvent, value?: Date) => { if (event.type === 'dismissed') { setPickerMode(null); return; } if (value) { if (pickerMode === 'date') setSnoozeDate(value); else setSnoozeTime(value); } if (Platform.OS === 'android') setPickerMode(null); };
  const saveCustomFrequency = async () => { const interval = Number(customFrequency); if (!Number.isInteger(interval) || interval < 1) { Alert.alert(t('frequency'), t('customFrequencyInvalid')); return; } try { await onFrequency({ interval, unit: customUnit }); setCustomFrequencyOpen(false); } catch (error) { Alert.alert(t('frequency'), error instanceof Error ? error.message : t('customFrequencyInvalid')); } };
  return <ScrollView contentContainerStyle={styles.page}><Pressable onPress={onBack}><Text style={styles.back}>‹ {t('home')}</Text></Pressable><Text style={styles.h1}>{copy.title}</Text><Text style={styles.sub}>{current ? `${current.interval} ${current.unit}${current.interval > 1 ? 's' : ''}` : 'After use'} · {action.estimatedMinutes} min</Text>
    <Callout title={t('why')} body={copy.whyItMatters} /><Text style={styles.sectionTitle}>{t('safeSteps')}</Text>{copy.steps.map((step, index) => <View style={styles.step} key={step}><Text style={styles.stepNumber}>{index + 1}</Text><Text style={styles.stepText}>{step}</Text></View>)}
    <Text style={styles.sectionTitle}>{t('normal')}</Text>{copy.normalSigns.map((item) => <Text style={styles.bullet} key={item}>• {item}</Text>)}
    <View style={styles.warning}><Text style={styles.warningTitle}>{t('stop')}</Text><Text style={styles.warningText}>{copy.concerningSigns.join(' ')}</Text><Text style={styles.warningText}>{copy.escalationGuidance}</Text></View>
    <Pressable style={styles.primary} onPress={onDone}><Text style={styles.primaryText}>{t('done')}</Text></Pressable><View style={styles.actionGrid}><SmallButton label={t('tomorrow')} onPress={() => onSnooze(1)} /><SmallButton label={t('oneWeek')} onPress={() => onSnooze(7)} /><SmallButton label={t('chooseDate')} onPress={() => setCustomSnoozeOpen((open) => !open)} /><SmallButton label={t('notRelevant')} onPress={onNotRelevant} /><SmallButton label={t('issue')} onPress={onIssue} /></View>
    {customSnoozeOpen && <View style={formStyles.formCard}><Text style={styles.label}>{t('snoozeUntil')}</Text><Pressable style={styles.selector} onPress={() => setPickerMode('date')}><Text style={styles.selectorText}>{snoozeDate.toLocaleDateString()}</Text><Text style={styles.selectorChevron}>›</Text></Pressable><Pressable style={styles.selector} onPress={() => setPickerMode('time')}><Text style={styles.selectorText}>{snoozeTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text><Text style={styles.selectorChevron}>›</Text></Pressable><Pressable style={styles.primary} onPress={saveCustomSnooze}><Text style={styles.primaryText}>{t('snoozeReminder')}</Text></Pressable></View>}
    {pickerMode && (Platform.OS === 'ios' ? <Modal transparent animationType="slide" visible onRequestClose={() => setPickerMode(null)}><View style={formStyles.pickerOverlay}><View style={formStyles.pickerCard}><DateTimePicker value={pickerMode === 'date' ? snoozeDate : snoozeTime} mode={pickerMode} display="spinner" onChange={onPickerChange} /><Pressable style={styles.primary} onPress={() => setPickerMode(null)}><Text style={styles.primaryText}>{t('save')}</Text></Pressable></View></View></Modal> : <DateTimePicker value={pickerMode === 'date' ? snoozeDate : snoozeTime} mode={pickerMode} display="default" onChange={onPickerChange} />)}
    <Text style={styles.sectionTitle}>{t('frequency')}</Text><View style={styles.presetGrid}>{presets.map((preset) => <Choice key={`${preset.interval}-${preset.unit}`} label={`${preset.interval} ${preset.unit}${preset.interval > 1 ? 's' : ''}`} selected={current?.interval === preset.interval && current?.unit === preset.unit} onPress={() => { void onFrequency(preset); }} />)}</View><SmallButton label={t('customFrequency')} onPress={() => setCustomFrequencyOpen((open) => !open)} />{customFrequencyOpen && <View style={formStyles.formCard}><Text style={styles.label}>{t('customFrequency')}</Text><TextInput value={customFrequency} onChangeText={setCustomFrequency} keyboardType="number-pad" placeholder={t('interval')} style={styles.titleInput} /><View style={styles.choiceGrid}>{(['day', 'week', 'month', 'year'] as Frequency['unit'][]).map((unit) => <Choice key={unit} label={unit} selected={customUnit === unit} onPress={() => setCustomUnit(unit)} />)}</View><Text style={styles.rowSub}>{t('nextReminder')}: {customPreview}</Text><Pressable style={styles.primary} onPress={() => { void saveCustomFrequency(); }}><Text style={styles.primaryText}>{t('saveFrequency')}</Text></Pressable></View>}<SmallButton label={t('reset')} onPress={() => { void onFrequency(undefined); }} /><SmallButton label={configuration.enabled ? t('disable') : t('enable')} onPress={() => { void onEnabled(!configuration.enabled); }} />
  </ScrollView>;
}

function IssueActionSelect({ actions: items, language, onBack, onSelect }: { actions: MaintenanceAction[]; language: 'en' | 'da'; onBack: () => void; onSelect: (actionId?: string) => void }) {
  const { t } = useTranslation(); return <ScrollView contentContainerStyle={styles.page}><Pressable onPress={onBack}><Text style={styles.back}>‹ {t('cancel')}</Text></Pressable><Text style={styles.h1}>{t('relatedAction')}</Text><Text style={styles.sub}>{t('issueHint')}</Text><SmallButton label={t('none')} onPress={() => onSelect(undefined)} />{items.map((action) => <ActionRow key={action.id} action={action} language={language} onPress={() => onSelect(action.id)} />)}</ScrollView>;
}

export function IssueForm({ title, note, photo, actions: items, language, actionId, onChooseAction, onTitle, onNote, onPhoto, onBack, onSubmit }: { title: string; note: string; photo?: string; actions: MaintenanceAction[]; language: 'en' | 'da'; actionId?: string; onChooseAction: () => void; onTitle: (title: string) => void; onNote: (note: string) => void; onPhoto: (photo?: string) => void; onBack: () => void; onSubmit: () => Promise<void> }) {
  const { t } = useTranslation(); const [saving, setSaving] = useState(false);
  const choosePhoto = async () => { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, exif: false }); if (!result.canceled) { if (photo) await FileSystem.deleteAsync(photo, { idempotent: true }); const asset = result.assets[0]; const destination = `${FileSystem.documentDirectory}issue-${Date.now()}.jpg`; await FileSystem.copyAsync({ from: asset.uri, to: destination }); onPhoto(destination); } };
  const removePhoto = async () => { if (photo) await FileSystem.deleteAsync(photo, { idempotent: true }); onPhoto(undefined); };
  const relatedAction = actionId ? items.find((action) => action.id === actionId) : undefined;
  return <ScrollView contentContainerStyle={styles.page}><Pressable onPress={onBack}><Text style={styles.back}>‹ {t('cancel')}</Text></Pressable><Text style={styles.h1}>{t('issueTitle')}</Text><Text style={styles.sub}>{t('issueHint')}</Text><Text style={styles.label}>{t('relatedAction')}</Text><Pressable style={styles.selector} onPress={onChooseAction}><Text style={styles.selectorText}>{relatedAction ? content(relatedAction, language).title : t('none')}</Text><Text style={styles.selectorChevron}>›</Text></Pressable><Text style={styles.label}>{t('title')} *</Text><TextInput value={title} onChangeText={onTitle} placeholder={t('titlePlaceholder')} autoFocus style={styles.titleInput} /><TextInput value={note} onChangeText={onNote} placeholder={t('note')} multiline style={styles.input} />{photo && <Image source={{ uri: photo }} style={styles.photo} />}<SmallButton label={photo ? t('replacePhoto') : t('addPhoto')} onPress={choosePhoto} />{photo && <SmallButton label={t('removePhoto')} onPress={() => { void removePhoto(); }} />}<Callout title={t('stop')} body={relatedAction ? content(relatedAction, language).escalationGuidance : t('generalSafety')} /><Pressable style={[styles.primary, (saving || !title.trim()) && styles.dim]} disabled={saving || !title.trim()} onPress={async () => { setSaving(true); await onSubmit(); }}><Text style={styles.primaryText}>{t('submit')}</Text></Pressable></ScrollView>;
}

function History({ state, language, onOpenIssue }: { state: AppState; language: 'en' | 'da'; onOpenIssue: (outcome: TaskOutcome) => void }) {
  const { t } = useTranslation(); const [filter, setFilter] = useState<'all' | TaskOutcome['type']>('all'); const filtered = state.outcomes.filter((outcome) => filter === 'all' || outcome.type === filter);
  const filters: { id: 'all' | TaskOutcome['type']; label: string }[] = [{ id: 'all', label: t('all') }, { id: 'done', label: t('completed') }, { id: 'snoozed', label: t('snoozed') }, { id: 'not_relevant', label: t('notRelevant') }, { id: 'issue_reported', label: t('issues') }];
  return <ScrollView contentContainerStyle={styles.page}><Text style={styles.h1}>{t('history')}</Text><View style={styles.filterRow}>{filters.map((item) => <Choice key={item.id} label={item.label} selected={filter === item.id} onPress={() => setFilter(item.id)} />)}</View>{filtered.length === 0 ? <Text style={styles.empty}>{filter === 'issue_reported' ? t('noIssues') : t('noHistory')}</Text> : filtered.map((outcome) => { const action = getAction(outcome.actionId); const isIssue = outcome.type === 'issue_reported'; return <Pressable style={styles.row} key={outcome.id} disabled={!isIssue} onPress={() => onOpenIssue(outcome)}>{outcome.photoUri ? <View style={styles.historyPhoto}><Image source={{ uri: outcome.photoUri }} style={styles.historyPhotoImage} /></View> : action ? <ActionIcon actionId={action.id} /> : <View style={styles.dot} />}<View style={styles.rowCopy}><Text style={styles.rowTitle}>{outcome.title ?? (action ? content(action, language).title : outcome.actionId)}</Text><Text style={styles.rowSub}>{outcomeLabel(outcome.type, t)} · {formatDate(outcome.occurredAt, language)}</Text>{outcome.note ? <Text style={styles.rowSub} numberOfLines={1}>{outcome.note}</Text> : null}</View>{isIssue && <Text style={styles.chevron}>›</Text>}</Pressable>; })}</ScrollView>;
}

function IssueDetail({ outcome, language, onBack, onDeletePhoto, onDeleteIssue }: { outcome: TaskOutcome; language: 'en' | 'da'; onBack: () => void; onDeletePhoto: () => Promise<void>; onDeleteIssue: () => Promise<void> }) {
  const { t } = useTranslation(); const action = getAction(outcome.actionId); const copy = action ? content(action, language) : undefined;
  return <ScrollView contentContainerStyle={styles.page}><Pressable onPress={onBack}><Text style={styles.back}>‹ {t('history')}</Text></Pressable><Text style={styles.kicker}>{t('issueReported').toUpperCase()} · {formatDate(outcome.occurredAt, language)}</Text><Text style={styles.h1}>{outcome.title ?? (action ? copy!.title : outcome.actionId)}</Text>{outcome.photoUri && <Image source={{ uri: outcome.photoUri }} style={styles.photo} />}{outcome.note && <><Text style={styles.sectionTitle}>{t('yourNote')}</Text><Text style={styles.sub}>{outcome.note}</Text></>}{copy && <View style={styles.warning}><Text style={styles.warningTitle}>{t('stop')}</Text><Text style={styles.warningText}>{copy.escalationGuidance}</Text></View>}{outcome.photoUri && <SmallButton label={t('deletePhoto')} onPress={() => Alert.alert(t('deletePhoto'), t('deleteIssueConfirm'), [{ text: t('cancel'), style: 'cancel' }, { text: t('deletePhoto'), style: 'destructive', onPress: () => { void onDeletePhoto(); } }])} />}<SmallButton label={t('deleteIssue')} onPress={() => Alert.alert(t('deleteIssue'), t('deleteIssueConfirm'), [{ text: t('cancel'), style: 'cancel' }, { text: 'Delete issue', style: 'destructive', onPress: () => { void onDeleteIssue(); } }])} /></ScrollView>;
}

function Settings({ state, onState, onEditProfile, onOpenTiming, onOpenDebug, onReset }: { state: AppState; onState: (state: AppState) => void; onEditProfile: () => void; onOpenTiming: () => void; onOpenDebug: () => void; onReset: () => Promise<void> }) { const { t } = useTranslation(); return <ScrollView contentContainerStyle={styles.page}><Text style={styles.h1}>{t('settings')}</Text><View style={styles.setting}><Text style={styles.rowTitle}>{t('language')}</Text><View style={styles.choiceRow}><Choice label="English" selected={state.settings.language === 'en'} onPress={async () => onState(await updateSettings({ ...state.settings, language: 'en' }))} /><Choice label="Dansk" selected={state.settings.language === 'da'} onPress={async () => onState(await updateSettings({ ...state.settings, language: 'da' }))} /></View></View><View style={styles.setting}><Text style={styles.rowTitle}>{t('notifications')}</Text><Switch value={state.settings.notificationsEnabled} onValueChange={async (enabled) => { if (enabled && !(await requestNotificationPermission())) { Alert.alert('Notifications are disabled in system settings.'); return; } onState(await updateSettings({ ...state.settings, notificationsEnabled: enabled })); }} /></View><SmallButton label={t('notificationTiming')} onPress={onOpenTiming} />{__DEV__ && <SmallButton label={t('debugNotifications')} onPress={onOpenDebug} />}<SmallButton label={t('editHome')} onPress={onEditProfile} /><SmallButton label="Export local backup" onPress={async () => { try { await exportBackup(state); } catch { Alert.alert('Export failed', 'Your data was not changed.'); } }} /><SmallButton label="Import local backup" onPress={async () => { try { const nextState = await importLocalBackup(); if (nextState) onState(nextState); } catch (error) { Alert.alert('Import failed', error instanceof Error ? error.message : 'Your data was not changed.'); } }} /><SmallButton label="Reset app data" onPress={() => Alert.alert('Reset House Care?', 'This removes local profile, history, and issue records from this device.', [{ text: t('cancel'), style: 'cancel' }, { text: 'Reset', style: 'destructive', onPress: () => { void onReset(); } }])} /></ScrollView>; }

function NotificationTiming({ schedule, onBack, onSave }: { schedule: NotificationSchedule; onBack: () => void; onSave: (schedule: NotificationSchedule) => Promise<void> }) {
  const { t, i18n } = useTranslation(); const [draft, setDraft] = useState<NotificationSchedule>(() => ({ ...defaultNotificationSchedule(), ...schedule })); const weekdayName = (weekday: Weekday) => new Intl.DateTimeFormat(i18n.language === 'da' ? 'da-DK' : 'en-US', { weekday: 'long' }).format(new Date(2021, 0, 3 + weekday));
  const updateDay = (weekday: Weekday, patch: Partial<NotificationSchedule[Weekday]>) => setDraft((current) => ({ ...current, [weekday]: { ...current[weekday], ...patch } }));
  return <ScrollView contentContainerStyle={styles.page}><Pressable onPress={onBack}><Text style={styles.back}>‹ {t('settings')}</Text></Pressable><Text style={styles.h1}>{t('notificationTiming')}</Text><Text style={styles.sub}>{t('notificationTimingHint')}</Text>{weekdays.map((weekday) => { const preference = draft[weekday]; return <View style={styles.setting} key={weekday}><View style={formStyles.daySetting}><Text style={styles.rowTitle}>{weekdayName(weekday)}</Text><View style={formStyles.timeRow}><TextInput value={preference.startTime} onChangeText={(startTime) => updateDay(weekday, { startTime })} placeholder="00:00" style={formStyles.timeInput} /><Text style={formStyles.rangeDash}>–</Text><TextInput value={preference.endTime} onChangeText={(endTime) => updateDay(weekday, { endTime })} placeholder="24:00" style={formStyles.timeInput} /></View></View><Switch value={preference.enabled} onValueChange={(enabled) => updateDay(weekday, { enabled })} /></View>; })}<Pressable style={styles.primary} onPress={async () => { try { await onSave(draft); } catch (error) { Alert.alert(t('notificationTiming'), error instanceof Error ? error.message : t('timingInvalid')); } }}><Text style={styles.primaryText}>{t('saveTiming')}</Text></Pressable></ScrollView>;
}

function NotificationDebug({ state, onBack, onState }: { state: AppState; onBack: () => void; onState: (state: AppState) => void }) {
  const { t } = useTranslation(); const [count, setCount] = useState<number | null>(null); const [permission, setPermission] = useState('unknown');
  const refresh = async () => { const nextCount = await scheduledNotificationCount(); setCount(nextCount); const granted = await notificationPermissionGranted(); setPermission(granted ? 'granted' : 'denied'); };
  return <ScrollView contentContainerStyle={styles.page}><Pressable onPress={onBack}><Text style={styles.back}>‹ {t('settings')}</Text></Pressable><Text style={styles.kicker}>DEVELOPMENT</Text><Text style={styles.h1}>{t('debugNotifications')}</Text><View style={styles.setting}><Text style={styles.rowTitle}>{t('permission')}</Text><Text style={styles.rowSub}>{permission}</Text></View><View style={styles.setting}><Text style={styles.rowTitle}>{t('scheduled')}</Text><Text style={styles.rowSub}>{count ?? '…'}</Text></View><View style={styles.setting}><Text style={styles.rowTitle}>{t('timezone')}</Text><Text style={styles.rowSub}>{Intl.DateTimeFormat().resolvedOptions().timeZone}</Text></View><SmallButton label={t('sendTest')} onPress={async () => { await sendTestNotification(); Alert.alert(t('debugNotifications'), t('testSent')); }} /><SmallButton label={t('cancelAll')} onPress={async () => { await cancelScheduledNotifications(); await refresh(); }} /><SmallButton label={t('refresh')} onPress={async () => { onState(await updateSettings(state.settings)); await refresh(); }} /></ScrollView>;
}

function TabBar({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) { const { t } = useTranslation(); return <View style={styles.tabs}>{(['home', 'actions', 'history', 'settings'] as Tab[]).map((tab) => <Pressable key={tab} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: active === tab }} onPress={() => onChange(tab)}><NavIcon tab={tab} active={active === tab} /><Text style={[styles.tabText, active === tab && styles.tabActive]}>{t(tab)}</Text></Pressable>)}</View>; }
function NavIcon({ tab, active }: { tab: Tab; active: boolean }) { const glyphs: Record<Tab, string> = { home: '⌂', actions: '☷', history: '◷', settings: '⚙' }; return <Text style={[styles.navIcon, active && styles.navIconActive]} accessibilityElementsHidden>{glyphs[tab]}</Text>; }
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable style={[styles.choice, selected && styles.choiceSelected]} onPress={onPress}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>; }
function SmallButton({ label, onPress }: { label: string; onPress: () => void }) { return <Pressable style={styles.smallButton} onPress={onPress}><Text style={styles.smallButtonText}>{label}</Text></Pressable>; }
function Callout({ title, body }: { title: string; body: string }) { return <View style={styles.callout}><Text style={styles.calloutTitle}>{title}</Text><Text style={styles.calloutText}>{body}</Text></View>; }
function content(action: MaintenanceAction, language: 'en' | 'da') { return language === 'da' && action.content.da ? action.content.da : action.content.en; }
function dueFor(action: MaintenanceAction, configuration?: ActionConfiguration) { return new Date(configuration?.snoozedUntil ?? configuration?.nextDueAt ?? (action.trigger.kind === 'habit' ? '9999-01-01' : new Date().toISOString())).getTime(); }
function outcomeLabel(type: TaskOutcome['type'], t: (key: string) => string) { return type === 'issue_reported' ? t('issueReported') : type === 'done' ? t('completed') : type === 'snoozed' ? t('snoozed') : t('notRelevant'); }

const colors = { ink: '#17352C', muted: '#687B72', green: '#2F7563', deep: '#1F5547', sage: '#DCEEE4', line: '#DCE7DF', yellow: '#F6EAD0', warning: '#B65145', background: '#F5F8F5' };
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }, page: { padding: 22, paddingBottom: 96, gap: 12 },
  kicker: { color: colors.green, fontWeight: '800', letterSpacing: 1.5, fontSize: 11, marginTop: 8 }, h1: { color: colors.ink, fontSize: 30, lineHeight: 34, fontWeight: '800', marginTop: 4 }, sub: { color: colors.muted, fontSize: 14, lineHeight: 20 }, label: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 12 },
  selector: { borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', padding: 13, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, selectorText: { color: colors.ink, fontSize: 15 }, selectorChevron: { color: colors.green, fontSize: 22 }, choiceRow: { flexDirection: 'row', gap: 8 }, choiceGrid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, choice: { borderWidth: 1, borderColor: colors.line, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 11, backgroundColor: '#fff' }, choiceSelected: { backgroundColor: colors.sage, borderColor: colors.green }, choiceText: { color: colors.ink, textTransform: 'capitalize', fontSize: 13 }, choiceTextSelected: { color: colors.deep, fontWeight: '800' },
  primary: { backgroundColor: colors.deep, padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 }, primaryText: { color: 'white', fontSize: 15, fontWeight: '800' }, dim: { opacity: 0.55 }, hero: { backgroundColor: colors.green, borderRadius: 18, padding: 18, marginTop: 10 }, heroEyebrow: { color: '#D8EEE3', fontSize: 11, fontWeight: '800' }, heroTitle: { color: 'white', fontSize: 21, fontWeight: '800', marginTop: 8 }, heroText: { color: '#EAF6EF', fontSize: 14, lineHeight: 20, marginTop: 8 }, heroButton: { color: colors.deep, backgroundColor: 'white', padding: 11, borderRadius: 10, textAlign: 'center', fontWeight: '800', marginTop: 16 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginTop: 16 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderColor: colors.line }, rowCopy: { flex: 1, gap: 3 }, rowTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' }, rowSub: { color: colors.muted, fontSize: 12, lineHeight: 17 }, dot: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.sage }, actionIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.sage, justifyContent: 'center', alignItems: 'center' }, actionGlyph: { color: colors.green, fontSize: 17 }, filterRing: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.green, overflow: 'hidden', position: 'relative' }, filterLine: { position: 'absolute', backgroundColor: colors.green, opacity: 0.65 }, filterLineOne: { height: 1, left: 1, right: 1, top: 5 }, filterLineTwo: { height: 1, left: 1, right: 1, top: 9 }, filterLineThree: { height: 1, left: 1, right: 1, top: 13 }, filterLineVerticalOne: { width: 1, top: 1, bottom: 1, left: 5 }, filterLineVerticalTwo: { width: 1, top: 1, bottom: 1, left: 11 }, filterSparkle: { position: 'absolute', right: 1, top: -5, color: colors.deep, fontSize: 13, fontWeight: '800' }, chevron: { color: colors.green, fontSize: 24 }, empty: { color: colors.muted, fontSize: 15, marginTop: 24, lineHeight: 22 }, back: { color: colors.green, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  callout: { backgroundColor: colors.yellow, padding: 14, borderRadius: 13, gap: 5, marginTop: 8 }, calloutTitle: { color: '#755C25', fontSize: 13, fontWeight: '800' }, calloutText: { color: '#755C25', lineHeight: 19, fontSize: 13 }, step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, stepNumber: { backgroundColor: colors.sage, color: colors.deep, width: 24, height: 24, textAlign: 'center', paddingTop: 3, borderRadius: 12, fontWeight: '800' }, stepText: { flex: 1, color: colors.ink, lineHeight: 20, fontSize: 14 }, bullet: { color: colors.ink, fontSize: 14, lineHeight: 21 }, warning: { borderLeftWidth: 4, borderColor: colors.warning, paddingLeft: 12, gap: 4, marginTop: 8 }, warningTitle: { color: colors.warning, fontWeight: '800' }, warningText: { color: '#704E48', fontSize: 13, lineHeight: 19 }, actionGrid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, smallButton: { borderColor: colors.line, borderWidth: 1, backgroundColor: '#fff', padding: 11, borderRadius: 10, marginTop: 6 }, smallButtonText: { color: colors.deep, fontWeight: '700', fontSize: 13 }, presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, titleInput: { minHeight: 48, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, color: colors.ink }, input: { minHeight: 110, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, padding: 12, textAlignVertical: 'top', color: colors.ink }, photo: { width: '100%', height: 210, borderRadius: 12 }, setting: { backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: colors.line, gap: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, tabs: { flexDirection: 'row', borderTopWidth: 1, borderColor: colors.line, backgroundColor: '#fff', paddingTop: 10, paddingBottom: 14 }, tab: { flex: 1, alignItems: 'center' }, tabText: { color: colors.muted, fontSize: 11 }, tabActive: { color: colors.deep, fontWeight: '800' }, navIcon: { color: colors.muted, fontSize: 24, height: 28 }, navIconActive: { color: colors.deep }, issueEntry: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#ECC8C1', backgroundColor: '#FFF8F6', marginTop: 12 }, issueIcon: { width: 35, height: 35, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5DDD8' }, issueIconText: { color: '#A64035', fontWeight: '800', fontSize: 18 }, issueChevron: { color: '#A64035', fontSize: 24 }, filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }, historyPhoto: { width: 38, height: 38, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.sage }, historyPhotoImage: { width: '100%', height: '100%' } });
const formStyles = StyleSheet.create({ formCard: { backgroundColor: colors.sage, borderRadius: 12, padding: 12, gap: 8 }, daySetting: { flex: 1, gap: 8 }, timeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, timeInput: { flex: 1, minHeight: 38, borderRadius: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 7, color: colors.ink, fontSize: 12 }, rangeDash: { color: colors.muted }, pickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' }, pickerCard: { backgroundColor: colors.background, padding: 18, borderTopLeftRadius: 18, borderTopRightRadius: 18 } });
