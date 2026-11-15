// Počasí na stavbě: dohledání obce z adresy zakázky, předpověď (Open-Meteo) a posouzení rizik pro venkovní práce.
// Prahy jsou praktická doporučení, ne citace norem – texty proto na žádnou normu neodkazují.

export interface WeatherDay {
  date: string; // YYYY-MM-DD
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipProb: number; // %
  windMax: number; // km/h
}

export type WeatherRisk = 'cold' | 'rain' | 'snow' | 'wind';

export interface PlaceCoords {
  name: string;
  lat: number;
  lon: number;
}

export interface WeatherOutlook {
  place: string;
  days: WeatherDay[];
}

export const COLD_LIMIT_C = 5;
export const RAIN_PROBABILITY_LIMIT = 60;
export const WIND_LIMIT_KMH = 35;
/** Kolik dnů dopředu se hlídá varování u zakázky (dnes, zítra, pozítří). */
export const WARNING_DAYS = 3;

const RAIN_CODES = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];
const SNOW_CODES = [71, 73, 75, 77, 85, 86];

/** Z adresy „Slunečná 45, 252 28 Černošice“ vybere obec („Černošice“). Bez rozpoznatelné obce vrací prázdný text. */
export function extractPlaceName(address?: string): string {
  if (!address) return '';
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^(okres|okr\.|kraj|česká republika|čr)(\s|$)/i.test(parts[i])) continue;
    let place = parts[i]
      .replace(/\b\d{3}\s?\d{2}\b/g, ' ') // PSČ
      .replace(/\s+[-–]\s+.*$/, '') // „Praha 4 - Nusle“ → „Praha 4“
      .replace(/\s+/g, ' ')
      .trim();
    // „Praha 4“ → „Praha“; v první části adresy je číslo číslem popisným („Hlavní 12“), ne městskou částí
    if (i > 0) place = place.replace(/\s+\d{1,2}$/, '');
    if (place.length >= 2 && !/\d/.test(place)) return place;
  }
  return '';
}

export function describeWeatherCode(code: number): string {
  if (code === 0) return 'jasno';
  if (code === 1 || code === 2) return 'polojasno';
  if (code === 3) return 'zataženo';
  if (code === 45 || code === 48) return 'mlha';
  if ([95, 96, 99].includes(code)) return 'bouřky';
  if (RAIN_CODES.includes(code)) return 'déšť';
  if (SNOW_CODES.includes(code)) return 'sněžení';
  return 'proměnlivo';
}

/** Rizika dne pro venkovní práce. */
export function assessDay(day: WeatherDay): WeatherRisk[] {
  const risks: WeatherRisk[] = [];
  if (day.tempMax < COLD_LIMIT_C) risks.push('cold');
  if (SNOW_CODES.includes(day.weatherCode)) risks.push('snow');
  else if (RAIN_CODES.includes(day.weatherCode) || day.precipProb >= RAIN_PROBABILITY_LIMIT) risks.push('rain');
  if (day.windMax > WIND_LIMIT_KMH) risks.push('wind');
  return risks;
}

const RISK_WORD: Record<WeatherRisk, string> = { cold: 'chladno', rain: 'déšť', snow: 'sněžení', wind: 'silný vítr' };

export const RISK_ADVICE: Record<WeatherRisk, string> = {
  cold: `Pod ${COLD_LIMIT_C} °C nemusí lepidla, omítky a nátěry správně vyzrát.`,
  rain: 'Za deště počítejte s odkladem fasády, střechy a venkovních nátěrů.',
  snow: 'Při sněžení počítejte s odkladem venkovních prací.',
  wind: `Při větru nad ${WIND_LIMIT_KMH} km/h pozor na lešení a práci ve výškách.`,
};

const WEEKDAYS = ['v neděli', 'v pondělí', 'v úterý', 've středu', 've čtvrtek', 'v pátek', 'v sobotu'];

function dayDiff(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86400000);
}

/** „dnes“, „zítra“, „pozítří“, jinak den v týdnu. */
export function relativeDayLabel(dateIso: string, todayIso: string): string {
  const diff = dayDiff(todayIso, dateIso);
  if (diff === 0) return 'dnes';
  if (diff === 1) return 'zítra';
  if (diff === 2) return 'pozítří';
  return WEEKDAYS[new Date(`${dateIso}T00:00:00Z`).getUTCDay()];
}

const WEEKDAY_NAMES = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];

/** Název dne do seznamu výhledu: „dnes“, „zítra“, „pozítří“, jinak „středa“. */
export function dayName(dateIso: string, todayIso: string): string {
  const diff = dayDiff(todayIso, dateIso);
  if (diff >= 0 && diff <= 2) return relativeDayLabel(dateIso, todayIso);
  return WEEKDAY_NAMES[new Date(`${dateIso}T00:00:00Z`).getUTCDay()];
}

export function describeRisks(risks: WeatherRisk[]): string {
  return risks.map((r) => RISK_WORD[r]).join(', ');
}

export interface WeatherWarning {
  day: WeatherDay;
  risks: WeatherRisk[];
  text: string;
}

/** První rizikový den v nejbližších dnech; bez rizika vrací null (pak se u zakázky nic neukazuje). */
export function findWarning(outlook: WeatherOutlook, todayIso: string): WeatherWarning | null {
  for (const day of outlook.days) {
    const diff = dayDiff(todayIso, day.date);
    if (diff < 0 || diff >= WARNING_DAYS) continue;
    const risks = assessDay(day);
    if (risks.length === 0) continue;
    const label = relativeDayLabel(day.date, todayIso);
    const text = `${label.charAt(0).toUpperCase()}${label.slice(1)} ${Math.round(day.tempMax)} °C, ${describeRisks(risks)} (${outlook.place}). Venkovní práce raději naplánujte jinak.`;
    return { day, risks, text };
  }
  return null;
}

/** Zpráva zákazníkovi o posunu venkovních prací kvůli počasí. */
export function buildDelayMessage(jobTitle: string, place: string, warning: WeatherWarning, todayIso: string): string {
  const when = relativeDayLabel(warning.day.date, todayIso);
  return (
    `Dobrý den, předpověď počasí pro ${place} hlásí ${when} ${describeRisks(warning.risks)} ` +
    `(nejvýše ${Math.round(warning.day.tempMax)} °C). Venkovní práce na zakázce „${jobTitle}“ proto musíme posunout, ` +
    `aby neutrpěla kvalita díla. Ozvu se, jakmile to počasí dovolí. Děkuji za pochopení.`
  );
}

// ---------- Načítání (Open-Meteo, bez klíče) ----------

const CACHE_MS = 60 * 60 * 1000;
const placeCache = new Map<string, Promise<PlaceCoords | null>>();
const outlookCache = new Map<string, { at: number; promise: Promise<WeatherOutlook | null> }>();

async function geocodePlace(name: string): Promise<PlaceCoords | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=cs&format=json&countryCode=CZ`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`geocoding ${res.status}`);
  const data = await res.json();
  const results: any[] = Array.isArray(data?.results) ? data.results : [];
  const hit = results.find((r) => r?.country_code === 'CZ');
  if (!hit || typeof hit.latitude !== 'number' || typeof hit.longitude !== 'number') return null;
  return { name: hit.name || name, lat: hit.latitude, lon: hit.longitude };
}

async function fetchDays(coords: PlaceCoords): Promise<WeatherDay[]> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat.toFixed(2)}&longitude=${coords.lon.toFixed(2)}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max` +
    `&forecast_days=5&timezone=Europe%2FPrague`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`forecast ${res.status}`);
  const d = (await res.json())?.daily;
  if (!d || !Array.isArray(d.time)) return [];
  return d.time.map((date: string, i: number) => ({
    date,
    weatherCode: Number(d.weather_code?.[i] ?? 0),
    tempMax: Number(d.temperature_2m_max?.[i] ?? 0),
    tempMin: Number(d.temperature_2m_min?.[i] ?? 0),
    precipProb: Number(d.precipitation_probability_max?.[i] ?? 0),
    windMax: Number(d.wind_speed_10m_max?.[i] ?? 0),
  }));
}

/**
 * Výhled počasí pro adresu stavby. Vrací null, když se obec nepodaří rozpoznat nebo dohledat, nebo když služba
 * neodpoví – volající pak nic nezobrazuje (nikdy se nedosazuje jiné místo).
 */
export function getWeatherOutlook(address?: string): Promise<WeatherOutlook | null> {
  const place = extractPlaceName(address);
  if (!place) return Promise.resolve(null);
  const key = place.toLowerCase();
  const cached = outlookCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.promise;

  const promise = (async () => {
    try {
      let coordsPromise = placeCache.get(key);
      if (!coordsPromise) {
        coordsPromise = geocodePlace(place);
        placeCache.set(key, coordsPromise);
      }
      const coords = await coordsPromise;
      if (!coords) return null;
      const days = await fetchDays(coords);
      return days.length ? { place: coords.name, days } : null;
    } catch {
      // Bez připojení nebo při chybě služby: příště zkusit znovu
      placeCache.delete(key);
      outlookCache.delete(key);
      return null;
    }
  })();
  outlookCache.set(key, { at: Date.now(), promise });
  return promise;
}
