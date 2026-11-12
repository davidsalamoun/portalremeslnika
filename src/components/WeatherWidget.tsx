import React, { useState, useEffect } from 'react';
import {
  CloudSun,
  CloudRain,
  Sun,
  Snowflake,
  Wind,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  MapPin,
  Calendar,
  Share2,
  ChevronDown,
  ChevronUp,
  X,
  Info,
  Droplets,
} from 'lucide-react';
import { Contract } from '../types/contract';
import { triggerHaptic } from '../utils/haptics';

interface WeatherWidgetProps {
  contract?: Contract;
  city?: string;
  className?: string;
  compact?: boolean;
}

interface CurrentWeather {
  temperature: number;
  humidity: number;
  precipitation: number;
  weatherCode: number;
  windSpeed: number;
}

interface DailyForecast {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipProb: number;
  windSpeedMax: number;
}

const CZECH_CITIES_COORDS: Record<string, { lat: number; lon: number; name: string }> = {
  praha: { lat: 50.08, lon: 14.43, name: 'Praha' },
  brno: { lat: 49.19, lon: 16.61, name: 'Brno' },
  ostrava: { lat: 49.83, lon: 18.28, name: 'Ostrava' },
  plzen: { lat: 49.74, lon: 13.38, name: 'Plzeň' },
  liberec: { lat: 50.76, lon: 15.05, name: 'Liberec' },
  olomouc: { lat: 49.59, lon: 17.25, name: 'Olomouc' },
  budejovice: { lat: 48.97, lon: 14.47, name: 'České Budějovice' },
  hradec: { lat: 50.21, lon: 15.83, name: 'Hradec Králové' },
  pardubice: { lat: 50.04, lon: 15.78, name: 'Pardubice' },
  usti: { lat: 50.66, lon: 14.03, name: 'Ústí nad Labem' },
  vary: { lat: 50.23, lon: 12.87, name: 'Karlovy Vary' },
  jihlava: { lat: 49.40, lon: 15.59, name: 'Jihlava' },
  zlin: { lat: 49.22, lon: 17.67, name: 'Zlín' },
  tabor: { lat: 49.41, lon: 14.66, name: 'Tábor' },
  kladno: { lat: 50.14, lon: 14.10, name: 'Kladno' },
  boleslav: { lat: 50.41, lon: 14.90, name: 'Mladá Boleslav' },
};

function resolveCoords(addressOrCity?: string): { lat: number; lon: number; name: string } {
  if (!addressOrCity) return CZECH_CITIES_COORDS.praha;
  const normalized = addressOrCity
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  for (const [key, val] of Object.entries(CZECH_CITIES_COORDS)) {
    if (normalized.includes(key)) {
      return val;
    }
  }
  return { ...CZECH_CITIES_COORDS.praha, name: addressOrCity.split(',')[0].trim() || 'ČR' };
}

function getWeatherDescription(code: number): { label: string; isRain: boolean; isSnow: boolean } {
  if (code === 0) return { label: 'Jasno', isRain: false, isSnow: false };
  if (code === 1 || code === 2) return { label: 'Polojasno', isRain: false, isSnow: false };
  if (code === 3) return { label: 'Oblačno', isRain: false, isSnow: false };
  if (code === 45 || code === 48) return { label: 'Mlha', isRain: false, isSnow: false };
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return { label: 'Déšť / přeháňky', isRain: true, isSnow: false };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Sněžení', isRain: false, isSnow: true };
  if ([95, 96, 99].includes(code)) return { label: 'Bouřky', isRain: true, isSnow: false };
  return { label: 'Proměnlivo', isRain: false, isSnow: false };
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({
  contract,
  city,
  className = '',
  compact = false,
}) => {
  const initialLocation = city || (contract ? contract.executionPlace || contract.client.address : undefined);
  const [coords, setCoords] = useState(() => resolveCoords(initialLocation));
  const [current, setCurrent] = useState<CurrentWeather | null>(null);
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  const fetchWeather = async (targetLat: number, targetLon: number) => {
    setLoading(true);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${targetLat}&longitude=${targetLon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=Europe%2FPrague`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Chyba při načítání počasí');
      const data = await res.json();

      if (data.current) {
        setCurrent({
          temperature: Math.round(data.current.temperature_2m),
          humidity: Math.round(data.current.relative_humidity_2m),
          precipitation: data.current.precipitation,
          weatherCode: data.current.weather_code,
          windSpeed: Math.round(data.current.wind_speed_10m),
        });
      }

      if (data.daily && data.daily.time) {
        const days: DailyForecast[] = data.daily.time.slice(0, 4).map((dateStr: string, idx: number) => ({
          date: dateStr,
          weatherCode: data.daily.weather_code[idx],
          tempMax: Math.round(data.daily.temperature_2m_max[idx]),
          tempMin: Math.round(data.daily.temperature_2m_min[idx]),
          precipProb: data.daily.precipitation_probability_max ? data.daily.precipitation_probability_max[idx] : 0,
          windSpeedMax: Math.round(data.daily.wind_speed_10m_max[idx] || 0),
        }));
        setForecast(days);
      }
    } catch (e) {
      console.warn('Weather fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather(coords.lat, coords.lon);
  }, [coords.lat, coords.lon]);

  const handleUseGps = () => {
    if (!navigator.geolocation) return;
    triggerHaptic('selection');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGpsActive(true);
        setCoords({
          lat: parseFloat(pos.coords.latitude.toFixed(2)),
          lon: parseFloat(pos.coords.longitude.toFixed(2)),
          name: 'Moje poloha na stavbě (GPS)',
        });
      },
      (err) => {
        console.warn('Geolocation error:', err);
      }
    );
  };

  // Construction Norms & Safety evaluation (ČSN)
  const isColdRisk = current !== null && current.temperature < 5;
  const isRainRisk = current !== null && (current.precipitation > 0 || getWeatherDescription(current.weatherCode).isRain);
  const isWindRisk = current !== null && current.windSpeed > 35;
  const hasRisk = isColdRisk || isRainRisk || isWindRisk;

  // Format WhatsApp message to client if weather halts work
  const handleShareWeatherDelay = () => {
    triggerHaptic('success');
    const reason = isColdRisk
      ? 'teplot pod +5 °C (riziko degradace stavebních lepidel a omítek dle ČSN)'
      : isRainRisk
      ? 'deštivého počasí (zákaz venkovních fasádních a pokrývačských prací)'
      : 'silného nárazového větru (bezpečnost BOZP na lešení)';

    const text =
      `*OZNÁMENÍ O PŘERUŠENÍ VENKOVNÍCH PRACÍ*\n` +
      `Zakázka: ${contract ? `#${contract.contractNumber} (${contract.workDescription})` : 'Realizace'}\n` +
      `Místo: ${coords.name}\n\n` +
      `Dobrý den, z důvodu nepříznivých povětrnostních podmínek – ${reason} – musíme dnes dočasně přerušit venkovní technologické procesy, aby nedošlo k porušení technologických norem a ztrátě záruky.\n\n` +
      `Jakmile to počasí dovolí, budeme ihned pokračovat. Děkujeme za pochopení.`;

    const encoded = encodeURIComponent(text);
    const phone = contract?.client.phone?.replace(/[^0-9+]/g, '') || '';
    const url = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  if (!current && loading) {
    return (
      <div className={`p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500 ${className}`}>
        <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
        <span>Načítám počasí pro stavbu...</span>
      </div>
    );
  }

  if (!current) return null;

  const desc = getWeatherDescription(current.weatherCode);

  return (
    <>
      {/* Mobilní režim (sm:hidden): kompaktní 1-řádková lišta s možností rozbalení */}
      <div className="sm:hidden">
        {!isMobileExpanded ? (
          <div
            className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 shadow-2xs select-none ${
              hasRisk
                ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
                : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800'
            } ${className}`}
          >
            <div
              onClick={() => {
                triggerHaptic('selection');
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isColdRisk
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/60 dark:text-blue-300'
                    : isRainRisk
                    ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/60 dark:text-indigo-300'
                    : isWindRisk
                    ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/60 dark:text-purple-300'
                    : 'bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-300'
                }`}
              >
                {isColdRisk ? (
                  <Snowflake className="w-4 h-4 animate-pulse" />
                ) : isRainRisk ? (
                  <CloudRain className="w-4 h-4" />
                ) : isWindRisk ? (
                  <Wind className="w-4 h-4" />
                ) : current.temperature > 15 ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <CloudSun className="w-4 h-4" />
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white truncate">
                <span>{current.temperature} °C</span>
                <span className="text-slate-400 font-normal">·</span>
                <span className="text-slate-600 dark:text-slate-300 truncate">{coords.name}</span>
                <span className="text-slate-400 font-normal">·</span>
                {hasRisk ? (
                  <span className="text-rose-600 dark:text-rose-400 font-bold truncate">ČSN pozor</span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium truncate">ČSN OK</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setIsModalOpen(true);
                }}
                className="text-3xs font-extrabold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Předpověď
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMobileExpanded(true);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Rozbalit podrobnosti počasí"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`p-3 rounded-xl border transition-all shadow-2xs select-none ${
              hasRisk
                ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/80'
                : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800'
            } ${className}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div
                onClick={() => {
                  triggerHaptic('selection');
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isColdRisk
                      ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300'
                      : isRainRisk
                      ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300'
                      : isWindRisk
                      ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300'
                      : 'bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300'
                  }`}
                >
                  {isColdRisk ? (
                    <Snowflake className="w-5 h-5 animate-pulse" />
                  ) : isRainRisk ? (
                    <CloudRain className="w-5 h-5" />
                  ) : isWindRisk ? (
                    <Wind className="w-5 h-5" />
                  ) : current.temperature > 15 ? (
                    <Sun className="w-5 h-5" />
                  ) : (
                    <CloudSun className="w-5 h-5" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
                    <span>{current.temperature} °C</span>
                    <span className="text-slate-400 font-normal">·</span>
                    <span className="truncate">{desc.label}</span>
                    <span className="text-3xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-0.5 truncate">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      {coords.name}
                    </span>
                  </div>

                  <div className="text-2xs font-bold truncate mt-0.5">
                    {isColdRisk ? (
                      <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        ČSN: Teplota pod +5 °C! Nelze lepit ani štukovat.
                      </span>
                    ) : isRainRisk ? (
                      <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <CloudRain className="w-3 h-3 shrink-0" />
                        Srážky: Pozor na fasády, střechy a venkovní omítky.
                      </span>
                    ) : isWindRisk ? (
                      <span className="text-purple-600 dark:text-purple-400 flex items-center gap-1">
                        <Wind className="w-3 h-3 shrink-0" />
                        Vítr &gt; 35 km/h: Pozor na lešení a desky.
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        Podmínky příznivé pro stavební práce
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setIsModalOpen(true);
                  }}
                  className="text-3xs font-extrabold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Předpověď ➔
                </button>
                <button
                  type="button"
                  onClick={() => setIsMobileExpanded(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  title="Sbalit lištu počasí"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop / Tablet: Plné zobrazení */}
      <div
        onClick={() => {
          triggerHaptic('selection');
          setIsModalOpen(true);
        }}
        className={`hidden sm:block p-3 rounded-xl border transition-all cursor-pointer shadow-2xs select-none active:scale-99 ${
          hasRisk
            ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/80 hover:bg-amber-100/60'
            : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-800 hover:border-blue-400'
        } ${className}`}
        title="Klikněte pro 3denní předpověď a limity ČSN pro stavbu"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isColdRisk
                  ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300'
                  : isRainRisk
                  ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300'
                  : isWindRisk
                  ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300'
                  : 'bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300'
              }`}
            >
              {isColdRisk ? (
                <Snowflake className="w-5 h-5 animate-pulse" />
              ) : isRainRisk ? (
                <CloudRain className="w-5 h-5" />
              ) : isWindRisk ? (
                <Wind className="w-5 h-5" />
              ) : current.temperature > 15 ? (
                <Sun className="w-5 h-5" />
              ) : (
                <CloudSun className="w-5 h-5" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
                <span>{current.temperature} °C</span>
                <span className="text-slate-400 font-normal">·</span>
                <span className="truncate">{desc.label}</span>
                <span className="text-3xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-0.5 truncate">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                  {coords.name}
                </span>
              </div>

              <div className="text-2xs font-bold truncate mt-0.5">
                {isColdRisk ? (
                  <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    ČSN: Teplota pod +5 °C! Nelze lepit ani štukovat.
                  </span>
                ) : isRainRisk ? (
                  <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <CloudRain className="w-3 h-3 shrink-0" />
                    Srážky: Pozor na fasády, střechy a venkovní omítky.
                  </span>
                ) : isWindRisk ? (
                  <span className="text-purple-600 dark:text-purple-400 flex items-center gap-1">
                    <Wind className="w-3 h-3 shrink-0" />
                    Vítr &gt; 35 km/h: Pozor na lešení a manipulaci s deskami.
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    Podmínky příznivé pro stavební práce
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-3xs font-extrabold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              Předpověď ➔
            </span>
          </div>
        </div>
      </div>

      {/* Detailed Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header - Industrial Site Weather Station */}
            <div className="p-4 sm:p-5 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
                  <CloudSun className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400 text-slate-950">
                      Meteo radar
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      ČHMÚ & ECMWF
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white mt-0.5 flex items-center gap-1.5">
                    <span>Hlídač počasí na stavbě</span>
                    <span className="text-xs font-semibold text-slate-400">({coords.name})</span>
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-mono font-bold text-slate-400 hover:text-white cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">ESC</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Location Changer & GPS Button */}
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                  <select
                    value={coords.name}
                    onChange={(e) => {
                      const found = Object.values(CZECH_CITIES_COORDS).find((c) => c.name === e.target.value);
                      if (found) {
                        setCoords(found);
                        setIsGpsActive(false);
                      }
                    }}
                    className="text-xs font-bold px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    {Object.values(CZECH_CITIES_COORDS).map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleUseGps}
                  className="px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/60 hover:bg-blue-200 text-blue-800 dark:text-blue-200 font-extrabold text-2xs flex items-center gap-1 cursor-pointer"
                  title="Zaměřit přesné souřadnice stavby z GPS telefonu"
                >
                  <MapPin className="w-3 h-3" />
                  <span>{isGpsActive ? '✓ GPS aktivní' : 'GPS poloha'}</span>
                </button>
              </div>

              {/* Current Overview Card */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-3xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                    {current.temperature} °C
                  </div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                    {desc.label}
                  </div>
                  <div className="text-2xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-3 font-mono">
                    <span className="inline-flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-blue-500" /> Vlhkost: {current.humidity} %
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Wind className="w-3 h-3 text-cyan-500" /> Vítr: {current.windSpeed} km/h
                    </span>
                  </div>
                </div>

                <div className="w-12 h-12 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-center text-blue-600">
                  {isColdRisk ? (
                    <Snowflake className="w-8 h-8 text-blue-500 animate-pulse" />
                  ) : isRainRisk ? (
                    <CloudRain className="w-8 h-8 text-indigo-500" />
                  ) : (
                    <CloudSun className="w-8 h-8 text-amber-500" />
                  )}
                </div>
              </div>

              {/* Construction Norms Alert (ČSN) */}
              <div
                className={`p-4 rounded-xl border ${
                  hasRisk
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900/70'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-900/70'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {hasRisk ? (
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <h4
                      className={`text-xs font-black uppercase tracking-wider ${
                        hasRisk ? 'text-rose-900 dark:text-rose-300' : 'text-emerald-900 dark:text-emerald-300'
                      }`}
                    >
                      {hasRisk ? 'Varování stavebních norem (ČSN & BOZP)' : 'Podmínky odpovídají ČSN'}
                    </h4>

                    {isColdRisk && (
                      <p className="text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-start gap-1.5">
                        <Snowflake className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                        <span><strong>Teplota pod +5 °C:</strong> Dle ČSN 73 2577 a technických listů výrobců (Ceresit, Baumit, Knauf) je zakázáno lepení obkladů, aplikace tenkovrstvých omítek a stěrek bez nemrznoucích přísad.</span>
                      </p>
                    )}

                    {isRainRisk && (
                      <p className="text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-start gap-1.5">
                        <CloudRain className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                        <span><strong>Riziko srážek:</strong> Nevhodné pro venkovní fasádní nátěry, pokrývačské práce a nechráněné betonáže.</span>
                      </p>
                    )}

                    {isWindRisk && (
                      <p className="text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-start gap-1.5">
                        <Wind className="w-3.5 h-3.5 text-cyan-500 shrink-0 mt-0.5" />
                        <span><strong>Vítr nad 35 km/h:</strong> Zákaz montáže a manipulace na lešení dle zásad bezpečnosti práce (BOZP).</span>
                      </p>
                    )}

                    {!hasRisk && (
                      <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                        Všechny sledované parametry (teplota &gt; +5 °C, bez srážek, mírný vítr) umožňují plnohodnotné zdění, betonáž, omítky i fasádní práce bez rizika technologických vad.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 3-Day Forecast */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Výhled na další dny
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {forecast.map((f, idx) => {
                    const fDesc = getWeatherDescription(f.weatherCode);
                    const isCold = f.tempMin < 5;
                    const isWet = f.precipProb > 50;
                    return (
                      <div
                        key={f.date}
                        className={`p-3 rounded-xl border text-center space-y-1 ${
                          isCold || isWet
                            ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40'
                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <span className="text-2xs font-extrabold text-slate-500 uppercase block">
                          {idx === 0 ? 'Dnes' : idx === 1 ? 'Zítra' : f.date.split('-').slice(1).reverse().join('.')}
                        </span>
                        <div className="text-sm font-black text-slate-900 dark:text-white">
                          {f.tempMax}° / <span className="text-slate-400 font-semibold">{f.tempMin}°</span>
                        </div>
                        <div className="text-3xs font-bold text-slate-600 dark:text-slate-300 truncate">
                          {fDesc.label}
                        </div>
                        {f.precipProb > 0 && (
                          <div className="text-3xs font-extrabold text-blue-600 dark:text-blue-400 flex items-center justify-center gap-1">
                            <Droplets className="w-2.5 h-2.5" />
                            <span>{f.precipProb} %</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer with Client Alert */}
            <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-3">
              {hasRisk ? (
                <button
                  type="button"
                  onClick={handleShareWeatherDelay}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-sm cursor-pointer active:scale-95 transition-all"
                  title="Odeslat klientovi zprávu o odložení venkovních prací z důvodu počasí"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Upozornit klienta na počasí (WhatsApp)</span>
                </button>
              ) : (
                <div className="text-xs text-slate-500 font-medium">
                  Podmínky jsou ideální pro realizaci.
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold text-xs sm:text-sm cursor-pointer"
              >
                Zavřít
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
