import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { actionsForWeatherEvent, lastWeatherCheck } from '../../src/actionViews';
import { useAppState } from '../../src/appState';
import { formatDate } from '../../src/date';
import { WeatherPanel } from '../../src/weatherView';

export default function HeavyRainChecklistRoute() {
  const { t } = useTranslation();
  const { state } = useAppState();
  if (!state) return null;
  if (!state.profile) return <Redirect href="/setup" />;
  const items = actionsForWeatherEvent(state, 'heavy-rain');
  return <SafeAreaView style={styles.safe} edges={['top']}><ScrollView contentContainerStyle={styles.page}>
    <Pressable accessibilityRole="button" onPress={() => router.replace('/actions')}><Text style={styles.back}>‹ {t('actions')}</Text></Pressable>
    <Text style={styles.kicker}>{t('weather.eventChecklist')}</Text>
    <Text style={styles.title}>{t('weather.heavyRain')}</Text>
    <Text style={styles.intro}>{t('weather.heavyRainIntro')}</Text>
    {state.profile.postalCode && <WeatherPanel postalCode={state.profile.postalCode} language={state.settings.language} detailed />}
    <View style={styles.notice}><Text style={styles.noticeText}>{t('weather.safety')}</Text></View>
    {items.length === 0 ? <Text style={styles.empty}>{t('weather.noApplicableActions')}</Text> : items.map((action) => {
      const checkedAt = lastWeatherCheck(state, action.id, 'heavy-rain');
      const copy = state.settings.language === 'da' && action.content.da ? action.content.da : action.content.en;
      return <Pressable key={action.id} accessibilityRole="button" accessibilityLabel={`${copy.title}. ${checkedAt ? t('weather.lastChecked', { date: formatDate(checkedAt, state.settings.language) }) : t('weather.viewSteps')}`} style={styles.row} onPress={() => router.push({ pathname: '/actions/[actionId]', params: { actionId: action.id, returnTo: '/weather/heavy-rain' } })}>
        <View style={styles.rowText}><Text style={styles.rowTitle}>{copy.title}</Text><Text style={styles.rowSub}>{checkedAt ? t('weather.lastChecked', { date: formatDate(checkedAt, state.settings.language) }) : t('weather.viewSteps')}</Text></View><Text style={styles.arrow}>›</Text>
      </Pressable>;
    })}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F8F1' },
  page: { padding: 24, paddingBottom: 48, gap: 14 },
  back: { color: '#1F5547', fontSize: 16, paddingVertical: 8 },
  kicker: { color: '#4B7869', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 12 },
  title: { color: '#1D332B', fontSize: 30, fontWeight: '700' },
  intro: { color: '#50655B', fontSize: 16, lineHeight: 23 },
  notice: { backgroundColor: '#E8F0E7', borderRadius: 14, padding: 16, marginVertical: 8 },
  noticeText: { color: '#284A3B', fontSize: 14, lineHeight: 21 },
  empty: { color: '#50655B', fontSize: 16, lineHeight: 23, paddingVertical: 22 },
  row: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, minHeight: 78, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5EBE3' },
  rowText: { flex: 1, gap: 5 },
  rowTitle: { color: '#20392D', fontSize: 16, fontWeight: '600' },
  rowSub: { color: '#63776B', fontSize: 13 },
  arrow: { color: '#1F5547', fontSize: 25, paddingLeft: 12 },
});
