import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  /** Šířka okna na větších obrazovkách */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  /** Tlačítka v hlavičce vedle křížku (tisk, stažení…) */
  actions?: React.ReactNode;
  /**
   * Obsah bez vnitřního okraje: okno je sloupec s pevnou hlavičkou a obsah si sám řeší okraje, posouvání
   * (`flex-1 overflow-y-auto`) a případnou patičku. Pro velká okna s vlastním rozvržením.
   */
  bare?: boolean;
  /** Kliknutí mimo okno ho zavře (výchozí). U oken s rozepsanými údaji vypnout. */
  closeOnBackdrop?: boolean;
  children: React.ReactNode;
}

const WIDTH = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  '2xl': 'max-w-3xl',
  '3xl': 'max-w-4xl',
};

// Otevřená okna v pořadí otevření – na Escape reaguje jen to nejvyšší
const openDialogs: symbol[] = [];

/**
 * Okno nad obsahem ve vzhledu „Výkres a metr“: na mobilu vyjede zdola přes celou šířku, jinak je uprostřed.
 * Zavírá se křížkem, klávesou Escape a (pokud není vypnuto) kliknutím mimo okno.
 */
export const Dialog: React.FC<DialogProps> = ({
  title,
  subtitle,
  onClose,
  size = 'md',
  actions,
  bare = false,
  closeOnBackdrop = true,
  children,
}) => {
  const titleId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const token = Symbol('dialog');
    openDialogs.push(token);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openDialogs[openDialogs.length - 1] === token) {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    // Fokus do okna, pokud ho už nemá některé pole uvnitř (autoFocus)
    if (boxRef.current && !boxRef.current.contains(document.activeElement)) boxRef.current.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      const idx = openDialogs.indexOf(token);
      if (idx >= 0) openDialogs.splice(idx, 1);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 flex items-end sm:items-center justify-center sm:p-4"
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`bg-white dark:bg-slate-900 border border-slate-900 dark:border-slate-600 rounded-t-md sm:rounded-md w-full ${WIDTH[size]} max-h-[92vh] shadow-2xl text-[15px] leading-snug outline-none ${
          bare ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'
        }`}
      >
        <div className={`px-5 pt-5 flex items-start justify-between gap-3 shrink-0 ${bare ? 'pb-4 border-b border-slate-200 dark:border-slate-800' : ''}`}>
          <div className="min-w-0">
            <h2 id={titleId} className="text-[28px] font-bold leading-tight text-slate-900 dark:text-white">
              {title}
            </h2>
            {subtitle && <div className="mt-0.5 text-slate-600 dark:text-slate-400">{subtitle}</div>}
          </div>
          <div className="flex items-center gap-2 shrink-0 -mr-2 -mt-1.5">
            {actions}
            <button
              type="button"
              onClick={onClose}
              aria-label="Zavřít"
              className="w-11 h-11 inline-flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-slate-900 dark:text-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        {bare ? children : <div className="p-5">{children}</div>}
      </div>
    </div>
  );
};

/** Tlačítko do hlavičky okna (prop `actions`). */
export const dialogActionButton =
  'min-h-11 px-3 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors';
