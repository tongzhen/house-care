import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { activeActions, configurationMap, dueFor } from './actionViews';
import { actionNeedsAttention, formatDate } from './date';
import { seasonFor, seasons, usesSeasonalSchedule } from './seasonalScheduling';
import type { AppState } from './service';
import type { MaintenanceAction, Season } from './types';

export function SeasonalChecklist({ state, now, onBack, onOpen }: { state: AppState; now: number; onBack: () => void; onOpen: (actionId: string) => void }) {
  const { t } = useTranslation();
  const currentSeason = seasonFor(new Date(now));
  const [selection, setSelection] = useState<{ season: Season; current: Season }>();
  const season = selection?.current === currentSeason ? selection.season : currentSeason;
  const configs = configurationMap(state);
  const all = activeActions(state, configs).filter((action) => usesSeasonalSchedule(action, configs.get(action.id)));
  const items = all.filter((action) => action.trigger.seasons?.includes(season) || (season === currentSeason && actionNeedsAttention(action, configs.get(action.id), now)));
  const pending = items.filter((action) => actionNeedsAttention(action, configs.get(action.id), now)).sort((a, b) => dueFor(a, configs.get(a.id)) - dueFor(b, configs.get(b.id)));
  const lastDone = (action: MaintenanceAction) => state.outcomes.filter((outcome) => outcome.actionId === action.id && outcome.type === 'done').sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
  const completed = items.filter((action) => {
    const done = lastDone(action);
    if (!done || pending.includes(action) || configs.get(action.id)?.snoozedUntil) return false;
    const date = new Date(done.occurredAt);
    const start = new Date(now); start.setMonth(start.getMonth() - ((start.getMonth() + 10) % 3), 1); start.setHours(0, 0, 0, 0);
    return season === currentSeason && date >= start && date.getTime() <= now;
  });
  const later = items.filter((action) => !pending.includes(action) && !completed.includes(action)).sort((a, b) => dueFor(a, configs.get(a.id)) - dueFor(b, configs.get(b.id)));
  const row = (action: MaintenanceAction) => {
    const config = configs.get(action.id)!;
    const date = config.snoozedUntil ?? config.nextDueAt;
    const isPending = pending.includes(action);
    const due = new Date(date ?? now);
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const status = completed.includes(action) ? 'completed' : config.snoozedUntil && new Date(config.snoozedUntil).getTime() > now ? 'snoozed' : isPending ? due < today ? 'seasonal.overdue' : 'dueNow' : 'upcoming';
    const copy = state.settings.language === 'da' && action.content.da ? action.content.da : action.content.en;
    const done = lastDone(action);
    const issue = state.outcomes.some((outcome) => outcome.actionId === action.id && outcome.type === 'issue_reported');
    return <Pressable key={action.id} accessibilityRole="button" accessibilityLabel={`${copy.title}. ${t(status)}. ${date ? formatDate(date, state.settings.language) : ''}${done && !isPending ? `. ${t('seasonal.lastDone', { date: formatDate(done.occurredAt, state.settings.language) })}` : ''}${issue ? `. ${t('issueReported')}` : ''}`} style={styles.row} onPress={() => onOpen(action.id)}>
      <View style={styles.icon}><Text style={styles.glyph}>{action.id === 'outdoor-tap-winter-check' ? '❄' : action.id === 'underfloor-heating-visual-check' ? '⌁' : '⌒'}</Text></View>
      <View style={styles.copy}><Text style={styles.rowTitle}>{copy.title}</Text><View style={styles.meta}><Text style={[styles.badge, status === 'seasonal.overdue' && styles.overdue]}>{t(status)}</Text><Text style={styles.small}>{completed.includes(action) ? `${t('nextDue')}: ` : ''}{date ? formatDate(date, state.settings.language) : ''} · {action.estimatedMinutes} {t('minutesShort')}</Text></View>
        {done && !isPending && <Text style={styles.small}>{t('seasonal.lastDone', { date: formatDate(done.occurredAt, state.settings.language) })}</Text>}
        {issue && <Text style={styles.small}>{t('issueReported')}</Text>}
      </View><Text style={styles.arrow}>›</Text>
    </Pressable>;
  };
  return <SafeAreaView style={styles.safe} edges={['top']}><ScrollView contentContainerStyle={styles.page}>
    <Pressable accessibilityRole="button" onPress={onBack}><Text style={styles.back}>‹ {t('actions')}</Text></Pressable>
    <Text style={styles.title}>{t(`seasonal.care.${season}`)}</Text><Text style={styles.intro}>{t(`seasonal.months.${season}`)}</Text>
    <View style={styles.tabs} accessibilityRole="tablist">{seasons.map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: item === season }} style={[styles.tab, item === season && styles.selected]} onPress={() => setSelection({ season: item, current: currentSeason })}><Text style={[styles.tabText, item === season && styles.selectedText]}>{t(`seasonal.labels.${item}`)}</Text></Pressable>)}</View>
    {items.length ? <><View style={styles.summary}><Text style={styles.summaryTitle}>{t('seasonal.attention', { count: pending.length })}</Text><Text style={styles.summaryText}>{t('seasonal.summary')}</Text></View>
      {pending.length > 0 && <><Text style={styles.section}>{t('seasonal.toDo')}</Text>{pending.map(row)}</>}
      {later.length > 0 && <><Text style={styles.section}>{t('upcoming')}</Text>{later.map(row)}</>}
      {completed.length > 0 && <><Text style={styles.section}>{t('completed')}</Text>{completed.map(row)}</>}
    </> : <View style={styles.empty}><Text style={styles.summaryTitle}>{t('seasonal.empty')}</Text><Text style={styles.intro}>{t('seasonal.emptyHint')}</Text></View>}
    <Text style={styles.footer}>{t('seasonal.calendarHint')}</Text>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F8F1' }, page: { padding: 24, paddingBottom: 48 },
  back: { color: '#1F5547', fontSize: 16, paddingVertical: 10, marginBottom: 16 }, title: { color: '#1D332B', fontSize: 30, fontWeight: '600' }, intro: { color: '#63776B', fontSize: 15, lineHeight: 22, marginTop: 6 },
  tabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', padding: 4, borderRadius: 14, marginVertical: 22 }, tab: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 11 }, selected: { backgroundColor: '#1F5547' }, tabText: { fontSize: 12, color: '#63776B' }, selectedText: { color: '#FFFFFF', fontWeight: '600' },
  summary: { backgroundColor: '#E8F0E7', borderRadius: 16, padding: 18, marginBottom: 8 }, summaryTitle: { color: '#20392D', fontSize: 16, fontWeight: '600' }, summaryText: { color: '#50655B', fontSize: 14, lineHeight: 21, marginTop: 5 }, section: { color: '#63776B', fontSize: 13, fontWeight: '600', marginTop: 20, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: '#E5EBE3' }, icon: { width: 30, alignItems: 'center' }, glyph: { fontSize: 23, color: '#1F5547' }, copy: { flex: 1, gap: 6 }, rowTitle: { color: '#20392D', fontSize: 15, fontWeight: '600', lineHeight: 21 }, meta: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', alignItems: 'center' }, badge: { color: '#1F5547', backgroundColor: '#E8F0E7', fontSize: 11, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6 }, overdue: { color: '#875C29', backgroundColor: '#F4EADB' }, small: { color: '#63776B', fontSize: 12 }, arrow: { color: '#1F5547', fontSize: 25 }, empty: { paddingVertical: 32, gap: 9 }, footer: { color: '#63776B', fontSize: 13, lineHeight: 20, marginTop: 20 },
});
