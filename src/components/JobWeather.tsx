import React, { useEffect, useState } from 'react';
import { CloudRain, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { Contract } from '../types/contract';
import { todayIso } from '../utils/invoiceMath';
import { getDirectWhatsAppUrl } from '../utils/shareUtils';
import {
  WeatherOutlook,
  getWeatherOutlook,
  findWarning,
  assessDay,
  describeRisks,
  describeWeatherCode,
  dayName,
  buildDelayMessage,
  RISK_ADVICE,
} from '../utils/weather';

/**
 * Varování před počasím u zakázky. Zobrazí se jen tehdy, když předpověď pro obec stavby hlásí v nejbližších
 * třech dnech chladno, srážky nebo silný vítr; jinak (i když se místo nebo předpověď nepodaří zjistit) nic.
 */
export const JobWeather: React.FC<{ contract: Contract }> = ({ contract }) => {
  const address = contract.client?.address;
  const [outlook, setOutlook] = useState<WeatherOutlook | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setOutlook(null);
    getWeatherOutlook(address).then((result) => {
      if (!cancelled) setOutlook(result);
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (!outlook) return null;
  const today = todayIso();
  const warning = findWarning(outlook, today);
  if (!warning) return null;

  const advice = [...new Set(outlook.days.flatMap(assessDay))].map((risk) => RISK_ADVICE[risk]);
  const message = buildDelayMessage(contract.workDescription || 'zakázka', outlook.place, warning, today);

  return (
    <div className="border border-slate-900 dark:border-slate-500 rounded-md">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full min-h-11 px-3 py-2 flex items-center gap-2.5 text-left cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
      >
        <CloudRain className="w-[18px] h-[18px] shrink-0" />
        <span className="flex-1 min-w-0 text-slate-900 dark:text-slate-100">
          <span className="font-semibold">Počasí: </span>
          {warning.text}
        </span>
        {isOpen ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
      </button>

      {isOpen && (
        <div className="border-t border-slate-200 dark:border-slate-800">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {outlook.days.map((day) => {
              const risks = assessDay(day);
              return (
                <li key={day.date} className="px-3 py-2 flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
                  <span className={`w-24 shrink-0 ${risks.length ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                    {dayName(day.date, today)}
                  </span>
                  <span className="w-28 shrink-0 font-display font-semibold tabular-nums text-[17px] text-slate-900 dark:text-white">
                    {Math.round(day.tempMin)} až {Math.round(day.tempMax)} °C
                  </span>
                  <span className="flex-1 min-w-[10rem] text-slate-600 dark:text-slate-400">
                    {describeWeatherCode(day.weatherCode)}, srážky {Math.round(day.precipProb)} %, vítr {Math.round(day.windMax)} km/h
                    {risks.length > 0 && (
                      <span className="font-semibold text-slate-900 dark:text-white"> – {describeRisks(risks)}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="px-3 py-2.5 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
            {advice.map((line) => (
              <p key={line} className="text-slate-600 dark:text-slate-400">
                {line}
              </p>
            ))}
            <p className="text-[13px] text-slate-600 dark:text-slate-400">
              Předpověď pro {outlook.place} ze služby Open-Meteo. Je orientační, o postupu prací rozhodujete vy.
            </p>
            <a
              href={getDirectWhatsAppUrl(message, contract.client?.phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11 inline-flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-300 underline underline-offset-2"
            >
              <Send className="w-4 h-4" />
              <span>Napsat zákazníkovi o posunu prací</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
