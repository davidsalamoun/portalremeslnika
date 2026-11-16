import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Metr } from './Logo';
import { GettingStartedKey, GettingStartedStep, hideGettingStarted, isGettingStartedHidden } from '../utils/gettingStarted';

/**
 * Průvodce prvním spuštěním: seznam kroků k první smlouvě. Zobrazuje se na přehledu, dokud nejsou všechny
 * kroky hotové nebo ho uživatel neskryje.
 */
export const GettingStarted: React.FC<{ steps: GettingStartedStep[]; onStep: (key: GettingStartedKey) => void }> = ({ steps, onStep }) => {
  const [hidden, setHidden] = useState(isGettingStartedHidden);
  const doneCount = steps.filter((s) => s.done).length;
  if (hidden || doneCount === steps.length) return null;
  const nextKey = steps.find((s) => !s.done)?.key;

  return (
    <section aria-labelledby="prehled-zaciname" className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="prehled-zaciname" className="text-2xl font-semibold text-slate-900 dark:text-white">
          Začínáme
        </h2>
        <button
          type="button"
          onClick={() => {
            hideGettingStarted();
            setHidden(true);
          }}
          className="min-h-11 inline-flex items-center font-medium text-blue-600 dark:text-blue-300 underline underline-offset-2 cursor-pointer"
        >
          Skrýt průvodce
        </button>
      </div>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md">
        <div className="px-5 py-4 space-y-2">
          <div className="text-slate-600 dark:text-slate-400">
            Hotovo {doneCount} ze {steps.length} kroků k první smlouvě
          </div>
          <Metr step={doneCount - 1} steps={steps.length} markCurrent={false} label={`Hotovo ${doneCount} ze ${steps.length} kroků`} />
        </div>
        <ol className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
          {steps.map((step, index) => (
            <li key={step.key} className="px-5 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-2.5">
              <span
                aria-hidden="true"
                className={`w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-full font-display font-semibold ${
                  step.done
                    ? 'bg-emerald-700 text-white'
                    : 'border-[1.5px] border-slate-900 dark:border-slate-400 text-slate-900 dark:text-slate-100'
                }`}
              >
                {step.done ? <Check className="w-[18px] h-[18px]" /> : index + 1}
              </span>
              <div className="flex-1 min-w-[200px]">
                <div className={`font-semibold ${step.done ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                  {step.title}
                  {step.done && <span className="font-normal">, hotovo</span>}
                </div>
                {!step.done && <div className="text-slate-600 dark:text-slate-400">{step.hint}</div>}
              </div>
              {!step.done && (
                <button
                  type="button"
                  onClick={() => onStep(step.key)}
                  className={`w-full sm:w-auto min-h-11 px-4 inline-flex items-center justify-center rounded-md border-[1.5px] border-slate-900 font-semibold cursor-pointer transition-colors ${
                    step.key === nextKey
                      ? 'bg-amber-400 hover:bg-amber-500 text-slate-900'
                      : 'dark:border-slate-500 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {step.action}
                </button>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};
