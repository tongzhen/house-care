import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { loadWeather, type WeatherResult } from './weather';

function localTime(value: string, language: 'en' | 'da') {
  return new Date(value).toLocaleString(language === 'da' ? 'da-DK' : 'en-GB', { timeZone: 'Europe/Copenhagen', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function mm(value: number) { return `${value.toFixed(1)} mm`; }

export function WeatherPanel({ postalCode, language, detailed = false }: { postalCode: string; language: 'en' | 'da'; detailed?: boolean }) {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState<{ postalCode: string; result: WeatherResult | null; error: string | null; checkedAt: number } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void loadWeather(postalCode).then((next) => { if (active) setLoaded({ postalCode, result: next, error: null, checkedAt: Date.now() }); }).catch((failure) => { if (active) setLoaded({ postalCode, result: null, error: failure instanceof Error ? failure.message : 'weatherUnavailable', checkedAt: Date.now() }); });
    return () => { active = false; };
  }, [postalCode, retry]);
  const result = loaded?.postalCode === postalCode ? loaded.result : null;
  const error = loaded?.postalCode === postalCode && loaded.error;
  const snapshot = result?.snapshot;
  const stale = result?.cached || (snapshot && loaded && loaded.checkedAt - Date.parse(snapshot.fetchedAt) >= 3 * 60 * 60 * 1000);
  return <View style={styles.card} accessibilityRole="summary">
    <Text style={styles.title}>{t('weather.localWeather')}{snapshot ? ` · ${postalCode} ${snapshot.place.name}` : ''}</Text>
    {!result && !error && <ActivityIndicator accessibilityLabel={t('weather.loading')} color="#1F5547" />}
    {error && <><Text style={styles.body}>{t(error === 'forecastBusy' ? 'weather.forecastBusy' : 'weather.unavailable')}</Text><Pressable accessibilityRole="button" onPress={() => { setLoaded(null); setRetry((value) => value + 1); }}><Text style={styles.retry}>{t('weather.tryAgain')}</Text></Pressable></>}
    {snapshot && <>
      {stale && <Text style={styles.stale}>{t('weather.cached')} · {localTime(snapshot.fetchedAt, language)}</Text>}
      {snapshot.forecast && <>
        <Text style={styles.section}>{t('weather.next48')}</Text>
        <Text style={styles.body}>{t('weather.forecastSummary', { rain: mm(snapshot.forecast.rainMm), low: Math.round(snapshot.forecast.minC), high: Math.round(snapshot.forecast.maxC), wind: Math.round(snapshot.forecast.maxGustMs) })}</Text>
        {detailed && <Text style={styles.note}>{localTime(snapshot.forecast.from, language)} – {localTime(snapshot.forecast.to, language)} · {t(snapshot.forecastSource === 'openMeteoDmi' ? 'weather.openMeteoDmiSource' : 'weather.dmiSource')}</Text>}
      </>}
      {!snapshot.forecast && <Text style={styles.note}>{t('weather.forecastUnavailable')}</Text>}
      <Text style={styles.section}>{t('weather.past48')}</Text>
      {snapshot.rainfall ? <>
        <Text style={styles.body}>{mm(snapshot.rainfall.mm)}{snapshot.rainfall.traceHours ? ` ${t('weather.plusTrace')}` : ''}</Text>
        <Text style={styles.note}>{t('weather.station', { name: snapshot.rainfall.stationName, distance: Math.round(snapshot.rainfall.distanceKm) })}</Text>
        {detailed && <Text style={styles.note}>{localTime(snapshot.rainfall.from, language)} – {localTime(snapshot.rainfall.to, language)} · {t('weather.coverage', { count: snapshot.rainfall.coveredHours })}{snapshot.rainfall.coveredHours < 48 ? ` · ${t('weather.partial')}` : ''}</Text>}
      </> : <Text style={styles.note}>{t('weather.noObservations')}</Text>}
      <Text style={styles.source}>{t(snapshot.forecastSource === 'openMeteoDmi' ? 'weather.fallbackSource' : 'weather.source')}</Text>
    </>}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#E8F0E7', borderRadius: 16, padding: 16, gap: 5 },
  title: { color: '#20392D', fontWeight: '700', fontSize: 16 },
  section: { color: '#284A3B', fontWeight: '700', fontSize: 13, marginTop: 7 },
  body: { color: '#20392D', fontSize: 15, lineHeight: 21 },
  note: { color: '#50655B', fontSize: 12, lineHeight: 17 },
  stale: { color: '#795B20', fontSize: 12, fontWeight: '600' },
  source: { color: '#63776B', fontSize: 11, marginTop: 6 },
  retry: { color: '#1F5547', fontSize: 14, fontWeight: '700', marginTop: 6 },
});
