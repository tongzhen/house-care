import { loadWeatherCache, saveWeatherCache } from './db';
import { z } from 'zod';

export interface WeatherPlace { name: string; latitude: number; longitude: number }
export interface ForecastSummary { from: string; to: string; rainMm: number; minC: number; maxC: number; maxGustMs: number; hours: number }
export interface RainfallSummary { stationName: string; distanceKm: number; from: string; to: string; mm: number; coveredHours: number; traceHours: number }
export interface WeatherSnapshot { postalCode: string; place: WeatherPlace; fetchedAt: string; forecast: ForecastSummary | null; forecastSource?: 'dmi' | 'openMeteoDmi'; rainfall: RainfallSummary | null }
export interface WeatherResult { snapshot: WeatherSnapshot; cached: boolean }

const geocodingUrl = 'https://geocoding-api.open-meteo.com/v1/search';
const dmiForecastUrl = 'https://opendataapi.dmi.dk/v1/forecastedr/collections/harmonie_dini_sf/position';
const dmiObservationsUrl = 'https://opendataapi.dmi.dk/v2/metObs/collections';
const openMeteoForecastUrl = 'https://api.open-meteo.com/v1/forecast';
const hourMs = 60 * 60 * 1000;
const weatherSnapshotSchema = z.object({
  postalCode: z.string().regex(/^\d{4}$/),
  place: z.object({ name: z.string(), latitude: z.number().finite(), longitude: z.number().finite() }),
  fetchedAt: z.string().datetime(),
  forecast: z.object({ from: z.string().datetime(), to: z.string().datetime(), rainMm: z.number().finite(), minC: z.number().finite(), maxC: z.number().finite(), maxGustMs: z.number().finite(), hours: z.number().int() }).nullable(),
  forecastSource: z.enum(['dmi', 'openMeteoDmi']).optional(),
  rainfall: z.object({ stationName: z.string(), distanceKm: z.number().finite(), from: z.string().datetime(), to: z.string().datetime(), mm: z.number().finite(), coveredHours: z.number().int(), traceHours: z.number().int() }).nullable(),
});

async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Weather service returned ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timeout); }
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function features(value: unknown): Record<string, unknown>[] {
  const list = object(value)?.features;
  return Array.isArray(list) ? list.map(object).filter((item): item is Record<string, unknown> => item !== null) : [];
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function dateMs(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validatePostalCode(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/^\d{4}$/.test(trimmed)) throw new Error('postalCodeInvalid');
  return trimmed;
}

export async function resolvePostalCode(postalCode: string): Promise<WeatherPlace> {
  const code = validatePostalCode(postalCode);
  if (!code) throw new Error('postalCodeInvalid');
  const params = new URLSearchParams({ name: code, count: '10', countryCode: 'DK', language: 'da' });
  const data = object(await getJson(`${geocodingUrl}?${params}`));
  const results = Array.isArray(data?.results) ? data.results : [];
  const match = results.map(object).find((item) => item?.country_code === 'DK' && number(item.latitude) !== null && number(item.longitude) !== null && (item.name === code || (Array.isArray(item.postcodes) && item.postcodes.includes(code))));
  if (!match) throw new Error('postalCodeUnknown');
  return { name: typeof match.name === 'string' ? match.name : code, latitude: match.latitude as number, longitude: match.longitude as number };
}

export function parseForecast(value: unknown, now = Date.now()): ForecastSummary | null {
  const rows = features(value).map((feature) => object(feature.properties)).filter((item): item is Record<string, unknown> => item !== null)
    .map((properties) => ({ time: dateMs(properties.step), cumulativeRain: number(properties['total-precipitation']), temperatureK: number(properties['temperature-2m']), gustMs: number(properties['gust-wind-speed-10m']) }))
    .filter((row) => row.time !== null && row.cumulativeRain !== null && row.temperatureK !== null && row.gustMs !== null)
    .sort((a, b) => a.time! - b.time!);
  const selected = rows.filter((row) => row.time! >= now && row.time! <= now + 48 * hourMs);
  if (!selected.length) return null;
  const previous = [...rows].reverse().find((row) => row.time! < selected[0].time!);
  let priorRain = previous?.cumulativeRain ?? selected[0].cumulativeRain!;
  let rainMm = 0;
  for (const row of selected) {
    rainMm += Math.max(0, row.cumulativeRain! - priorRain);
    priorRain = row.cumulativeRain!;
  }
  return {
    from: new Date(selected[0].time!).toISOString(), to: new Date(selected[selected.length - 1].time!).toISOString(),
    rainMm, minC: Math.min(...selected.map((row) => row.temperatureK! - 273.15)),
    maxC: Math.max(...selected.map((row) => row.temperatureK! - 273.15)),
    maxGustMs: Math.max(...selected.map((row) => row.gustMs!)), hours: selected.length,
  };
}

export function parseOpenMeteoDmiForecast(value: unknown, now = Date.now()): ForecastSummary | null {
  const hourly = object(object(value)?.hourly);
  if (!hourly || !Array.isArray(hourly.time) || !Array.isArray(hourly.precipitation) || !Array.isArray(hourly.temperature_2m) || !Array.isArray(hourly.wind_gusts_10m)) return null;
  const precipitation = hourly.precipitation as unknown[];
  const temperature = hourly.temperature_2m as unknown[];
  const gusts = hourly.wind_gusts_10m as unknown[];
  const rows = hourly.time.map((time, index) => ({
    time: dateMs(typeof time === 'string' ? `${time}Z` : null),
    rain: number(precipitation[index]), temperature: number(temperature[index]), gust: number(gusts[index]),
  })).filter((row) => row.time !== null && row.time >= now && row.time < now + 48 * hourMs && row.rain !== null && row.temperature !== null && row.gust !== null);
  if (!rows.length) return null;
  return {
    from: new Date(rows[0].time!).toISOString(), to: new Date(rows[rows.length - 1].time!).toISOString(),
    rainMm: rows.reduce((sum, row) => sum + Math.max(0, row.rain!), 0),
    minC: Math.min(...rows.map((row) => row.temperature!)), maxC: Math.max(...rows.map((row) => row.temperature!)),
    maxGustMs: Math.max(...rows.map((row) => row.gust!)), hours: rows.length,
  };
}

function distanceKm(a: WeatherPlace, b: { latitude: number; longitude: number }): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function nearbyRainStations(value: unknown, place: WeatherPlace, now = Date.now()) {
  const stations = features(value).map((feature) => {
    const properties = object(feature.properties);
    const coordinates = object(feature.geometry)?.coordinates;
    if (!properties || !Array.isArray(coordinates)) return null;
    const longitude = number(coordinates[0]);
    const latitude = number(coordinates[1]);
    if (longitude === null || latitude === null || properties.status !== 'Active' || !Array.isArray(properties.parameterId) || !properties.parameterId.includes('precip_past1h')) return null;
    const validTo = dateMs(properties.validTo);
    const operationTo = dateMs(properties.operationTo);
    if ((validTo !== null && validTo < now) || (operationTo !== null && operationTo < now)) return null;
    const stationId = properties.stationId;
    if (typeof stationId !== 'string') return null;
    return { stationId, name: typeof properties.name === 'string' ? properties.name : stationId, distanceKm: distanceKm(place, { latitude, longitude }) };
  }).filter((station): station is { stationId: string; name: string; distanceKm: number } => station !== null && station.distanceKm <= 30)
    .sort((a, b) => a.distanceKm - b.distanceKm);
  return stations.filter((station, index) => stations.findIndex((candidate) => candidate.stationId === station.stationId) === index);
}

export function parseRainfall(value: unknown, station: { name: string; distanceKm: number }, now = Date.now()): RainfallSummary | null {
  const from = now - 48 * hourMs;
  const byHour = new Map<number, number>();
  for (const feature of features(value)) {
    const properties = object(feature.properties);
    if (!properties) continue;
    const observed = dateMs(properties.observed);
    const amount = number(properties.value);
    if (observed === null || amount === null || observed <= from || observed > now || amount < -0.1) continue;
    byHour.set(Math.floor(observed / hourMs), amount);
  }
  if (!byHour.size) return null;
  const amounts = [...byHour.values()];
  return { stationName: station.name, distanceKm: station.distanceKm, from: new Date(from).toISOString(), to: new Date(now).toISOString(),
    mm: amounts.reduce((sum, amount) => sum + Math.max(0, amount), 0), coveredHours: amounts.length, traceHours: amounts.filter((amount) => amount === -0.1).length };
}

async function fetchForecast(place: WeatherPlace, now: number) {
  const params = new URLSearchParams({ coords: `POINT(${place.longitude} ${place.latitude})`, crs: 'crs84', 'parameter-name': 'temperature-2m,total-precipitation,gust-wind-speed-10m', f: 'GeoJSON' });
  return parseForecast(await getJson(`${dmiForecastUrl}?${params}`), now);
}

async function fetchOpenMeteoDmiForecast(place: WeatherPlace, now: number) {
  const params = new URLSearchParams({ latitude: String(place.latitude), longitude: String(place.longitude), hourly: 'temperature_2m,precipitation,wind_gusts_10m', models: 'dmi_harmonie_arome_europe', wind_speed_unit: 'ms', timezone: 'GMT', forecast_hours: '49' });
  return parseOpenMeteoDmiForecast(await getJson(`${openMeteoForecastUrl}?${params}`), now);
}

async function fetchRainfall(place: WeatherPlace, now: number): Promise<RainfallSummary | null> {
  const latRadius = 0.3;
  const lonRadius = 0.55;
  const bbox = [place.longitude - lonRadius, place.latitude - latRadius, place.longitude + lonRadius, place.latitude + latRadius].join(',');
  const stationParams = new URLSearchParams({ status: 'Active', bbox, limit: '1000' });
  const stations = nearbyRainStations(await getJson(`${dmiObservationsUrl}/station/items?${stationParams}`), place, now).slice(0, 3);
  for (const station of stations) {
    const observationParams = new URLSearchParams({ stationId: station.stationId, parameterId: 'precip_past1h', datetime: `${new Date(now - 48 * hourMs).toISOString()}/${new Date(now).toISOString()}`, limit: '1000' });
    try {
      const summary = parseRainfall(await getJson(`${dmiObservationsUrl}/observation/items?${observationParams}`), station, now);
      if (summary) return summary;
    } catch { /* Another nearby station may still have observations. */ }
  }
  return null;
}

function cachedSnapshot(value: unknown, postalCode: string): WeatherSnapshot | null {
  const parsed = weatherSnapshotSchema.safeParse(value);
  return parsed.success && parsed.data.postalCode === postalCode ? parsed.data : null;
}

export async function loadWeather(postalCode: string, now = Date.now()): Promise<WeatherResult> {
  const code = validatePostalCode(postalCode);
  if (!code) throw new Error('postalCodeInvalid');
  const cached = cachedSnapshot(await loadWeatherCache(code), code);
  if (cached && now - Date.parse(cached.fetchedAt) < (cached.forecast ? hourMs : 10 * 60 * 1000)) return { snapshot: cached, cached: false };
  try {
    const place = await resolvePostalCode(code);
    const [forecastResult, rainfallResult] = await Promise.allSettled([fetchForecast(place, now), fetchRainfall(place, now)]);
    let forecast = forecastResult.status === 'fulfilled' ? forecastResult.value : null;
    let forecastSource: WeatherSnapshot['forecastSource'] = forecast ? 'dmi' : undefined;
    if (!forecast) {
      try {
        forecast = await fetchOpenMeteoDmiForecast(place, now);
        if (forecast) forecastSource = 'openMeteoDmi';
      } catch { /* Recent station rainfall can still be shown. */ }
    }
    const rainfall = rainfallResult.status === 'fulfilled' ? rainfallResult.value : null;
    if (!forecast && !rainfall) {
      if (forecastResult.status === 'rejected' && String(forecastResult.reason).includes('429')) throw new Error('forecastBusy');
      throw new Error('weatherUnavailable');
    }
    const snapshot: WeatherSnapshot = { postalCode: code, place, fetchedAt: new Date(now).toISOString(), forecast, forecastSource, rainfall };
    await saveWeatherCache(code, snapshot);
    return { snapshot, cached: false };
  } catch (error) {
    if (cached) return { snapshot: cached, cached: true };
    throw error;
  }
}
