// Společné tvary lišt nad jednotlivými doklady (jen na obrazovce, třída no-print) ve vzhledu „Výkres a metr“.
// Tisk a PDF jsou v horní liště náhledu (ContractPreview) – v lištách dokladů se neopakují.

export const docBar =
  'no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-4 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 text-[15px] leading-snug';
export const docBarTitle = 'font-display font-semibold text-[20px] leading-tight text-slate-900 dark:text-white';
export const docBarNote = 'text-slate-600 dark:text-slate-400';
export const docBarActions = 'flex flex-wrap items-center gap-2';
export const docButton =
  'min-h-11 min-w-11 px-3 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors disabled:opacity-60';
export const docButtonStrong =
  'min-h-11 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-md border-[1.5px] border-slate-900 dark:border-slate-400 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors disabled:opacity-60';
export const docButtonPrimary =
  'min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold cursor-pointer transition-colors disabled:opacity-60';
export const docButtonDanger =
  'min-h-11 min-w-11 px-3 inline-flex items-center justify-center gap-1.5 rounded-md border border-rose-700 dark:border-rose-400 text-rose-700 dark:text-rose-400 font-medium hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors';
export const docChip = (active: boolean) =>
  `min-h-11 px-3 inline-flex items-center justify-center rounded-md border font-medium cursor-pointer transition-colors ${
    active
      ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
      : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
  }`;
