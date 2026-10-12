/* eslint-disable import/first */
jest.mock('../db', () => ({ loadWeatherCache: jest.fn(async () => null), saveWeatherCache: jest.fn(async () => undefined) }));

import { loadWeatherCache, saveWeatherCache } from '../db';
import { loadWeather, nearbyRainStations, parseForecast, parseOpenMeteoDmiForecast, parseRainfall, resolvePostalCode, validatePostalCode } from '../weather';

const now = Date.parse('2026-10-08T12:30:00.000Z');
const hour = 60 * 60 * 1000;
const point = { name: 'Ballerup', latitude: 55.73, longitude: 12.36 };

function forecastStep(offset: number, rain: number, kelvin: number, gust: number) {
  return { properties: { step: new Date(now + offset * hour).toISOString(), 'total-precipitation': rain, 'temperature-2m': kelvin, 'gust-wind-speed-10m': gust } };
}

function observation(offset: number, value: number) {
  return { properties: { observed: new Date(now - offset * hour).toISOString(), value } };
}

beforeEach(() => { jest.clearAllMocks(); });

it('accepts an empty optional postal code and rejects malformed codes', () => {
  expect(validatePostalCode('')).toBeUndefined();
  expect(validatePostalCode(' 2750 ')).toBe('2750');
  expect(() => validatePostalCode('275')).toThrow('postalCodeInvalid');
});

it('resolves only a matching Danish postcode', async () => {
  const fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({ results: [
    { name: 'Ballerup', country_code: 'DK', postcodes: ['2750'], latitude: 55.73, longitude: 12.36 },
  ] }) })) as unknown as typeof fetch;
  const previousFetch = global.fetch;
  global.fetch = fetchMock;
  try {
    await expect(resolvePostalCode('2750')).resolves.toEqual(point);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('countryCode=DK'), expect.anything());
    await expect(resolvePostalCode('2751')).rejects.toThrow('postalCodeUnknown');
  } finally { global.fetch = previousFetch; }
});

it('normalizes DMI cumulative rainfall, Kelvin, and wind gusts for the next 48 hours', () => {
  const parsed = parseForecast({ features: [forecastStep(-1, 2, 280, 4), forecastStep(1, 3, 281, 6), forecastStep(2, 5, 279, 8), forecastStep(49, 9, 290, 12)] }, now);
  expect(parsed).toEqual(expect.objectContaining({ rainMm: 3, hours: 2, maxGustMs: 8 }));
  expect(parsed?.minC).toBeCloseTo(5.85);
  expect(parsed?.maxC).toBeCloseTo(7.85);
});

it('parses hourly rain, Celsius, and metre-per-second gusts from the DMI model fallback', () => {
  const parsed = parseOpenMeteoDmiForecast({ hourly: {
    time: ['2026-10-08T12:00', '2026-10-08T13:00', '2026-10-08T14:00'],
    temperature_2m: [9, 11, 10], precipitation: [0.5, 1.2, 0], wind_gusts_10m: [3, 8, 6],
  } }, now);
  expect(parsed).toEqual(expect.objectContaining({ rainMm: 1.2, minC: 10, maxC: 11, maxGustMs: 8, hours: 2 }));
});

it('selects nearby active rainfall stations and labels incomplete, trace readings', () => {
  const stations = nearbyRainStations({ features: [
    { geometry: { coordinates: [12.36, 55.73] }, properties: { stationId: 'OLD', name: 'Old station', status: 'Active', validTo: '2006-08-18T00:00:00Z', parameterId: ['precip_past1h'] } },
    { geometry: { coordinates: [12.36, 55.73] }, properties: { stationId: 'A', name: 'Ballerup', status: 'Active', parameterId: ['precip_past1h'] } },
    { geometry: { coordinates: [12.37, 55.74] }, properties: { stationId: 'B', name: 'Other', status: 'Active', parameterId: ['temp_dry'] } },
  ] }, point, now);
  expect(stations.map((station) => station.stationId)).toEqual(['A']);
  const rainfall = parseRainfall({ features: [observation(1, 2), observation(2, -0.1), observation(3, 1), observation(49, 5)] }, stations[0], now);
  expect(rainfall).toEqual(expect.objectContaining({ mm: 3, coveredHours: 3, traceHours: 1, stationName: 'Ballerup' }));
});

it('does not request weather without a postal code and reuses a recent cache', async () => {
  await expect(loadWeather('')).rejects.toThrow('postalCodeInvalid');
  expect(loadWeatherCache).not.toHaveBeenCalled();
  const cached = { postalCode: '2750', place: point, fetchedAt: new Date(now - 5 * 60 * 1000).toISOString(), forecast: null, rainfall: null };
  jest.mocked(loadWeatherCache).mockResolvedValueOnce(cached);
  await expect(loadWeather('2750', now)).resolves.toEqual({ snapshot: cached, cached: false });
  expect(saveWeatherCache).not.toHaveBeenCalled();
});

it('shows older cached data when the weather service is offline', async () => {
  const cached = { postalCode: '2750', place: point, fetchedAt: new Date(now - 4 * hour).toISOString(), forecast: null, rainfall: null };
  jest.mocked(loadWeatherCache).mockResolvedValueOnce(cached);
  const previousFetch = global.fetch;
  global.fetch = jest.fn(async () => { throw new Error('Offline'); }) as unknown as typeof fetch;
  try {
    await expect(loadWeather('2750', now)).resolves.toEqual({ snapshot: cached, cached: true });
  } finally { global.fetch = previousFetch; }
});

it('loads a DMI forecast and nearby station observations for a saved code', async () => {
  const previousFetch = global.fetch;
  global.fetch = jest.fn(async (url) => {
    const path = String(url);
    const payload = path.includes('geocoding-api') ? { results: [{ ...point, country_code: 'DK', postcodes: ['2750'] }] }
      : path.includes('forecastedr') ? { features: [forecastStep(1, 0, 280, 4), forecastStep(2, 2, 282, 7)] }
        : path.includes('/station/items') ? { features: [{ geometry: { coordinates: [point.longitude, point.latitude] }, properties: { stationId: '123', name: 'Ballerup station', status: 'Active', parameterId: ['precip_past1h'] } }] }
          : { features: [observation(1, 1.5), observation(2, -0.1)] };
    return { ok: true, json: async () => payload };
  }) as unknown as typeof fetch;
  try {
    const result = await loadWeather('2750', now);
    expect(result.cached).toBe(false);
    expect(result.snapshot.forecast?.rainMm).toBe(2);
    expect(result.snapshot.rainfall).toEqual(expect.objectContaining({ mm: 1.5, traceHours: 1, coveredHours: 2 }));
    expect(saveWeatherCache).toHaveBeenCalledWith('2750', result.snapshot);
  } finally { global.fetch = previousFetch; }
});

it('shows measured rainfall when DMI says its forecast server is busy', async () => {
  const previousFetch = global.fetch;
  global.fetch = jest.fn(async (url) => {
    const path = String(url);
    if (path.includes('forecastedr')) return { ok: false, status: 429 };
    const payload = path.includes('geocoding-api') ? { results: [{ ...point, country_code: 'DK', postcodes: ['2750'] }] }
      : path.includes('/station/items') ? { features: [
        { geometry: { coordinates: [point.longitude, point.latitude] }, properties: { stationId: 'old', name: 'Old', status: 'Active', validTo: '2006-08-18T00:00:00Z', parameterId: ['precip_past1h'] } },
        { geometry: { coordinates: [point.longitude, point.latitude] }, properties: { stationId: 'current', name: 'Current', status: 'Active', validTo: null, parameterId: ['precip_past1h'] } },
      ] } : { features: [observation(1, 1.5)] };
    return { ok: true, json: async () => payload };
  }) as unknown as typeof fetch;
  try {
    const result = await loadWeather('2750', now);
    expect(result.snapshot.forecast).toBeNull();
    expect(result.snapshot.rainfall).toEqual(expect.objectContaining({ stationName: 'Current', mm: 1.5 }));
  } finally { global.fetch = previousFetch; }
});

it('uses the DMI model fallback when the direct forecast server is busy', async () => {
  const previousFetch = global.fetch;
  const fetchMock = jest.fn(async (url) => {
    const path = String(url);
    if (path.includes('forecastedr')) return { ok: false, status: 429 };
    const payload = path.includes('geocoding-api') ? { results: [{ ...point, country_code: 'DK', postcodes: ['2750'] }] }
      : path.includes('api.open-meteo.com') ? { hourly: {
        time: ['2026-10-08T13:00', '2026-10-08T14:00'], temperature_2m: [11, 12], precipitation: [1, 2], wind_gusts_10m: [6, 7],
      } } : path.includes('/station/items') ? { features: [] } : { features: [] };
    return { ok: true, json: async () => payload };
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  try {
    const result = await loadWeather('2750', now);
    expect(result.snapshot.forecastSource).toBe('openMeteoDmi');
    expect(result.snapshot.forecast).toEqual(expect.objectContaining({ rainMm: 3, maxGustMs: 7 }));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('models=dmi_harmonie_arome_europe'), expect.anything());
  } finally { global.fetch = previousFetch; }
});
