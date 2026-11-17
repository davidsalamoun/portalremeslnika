import React from 'react';

/** Značka: kousek svinovacího metru s dílky a číslicemi. */
export const LogoMark: React.FC<{ size?: number; className?: string }> = ({ size = 30, className }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 30 30" className={className}>
    <rect width="30" height="30" rx="4" fill="#F5C400" />
    <path d="M5 0v11M10 0v5.5M15 0v8M20 0v5.5M25 0v11" stroke="#1A1D21" strokeWidth="1.7" fill="none" />
    <text x="6" y="25" textAnchor="middle" fontFamily="'Barlow Semi Condensed', sans-serif" fontWeight="700" fontSize="12" fill="#1A1D21">
      1
    </text>
    <text x="24" y="25" textAnchor="middle" fontFamily="'Barlow Semi Condensed', sans-serif" fontWeight="700" fontSize="12" fill="#1A1D21">
      2
    </text>
  </svg>
);

/** Značka s názvem aplikace. Barvu textu určuje okolí (currentColor). */
export const Logo: React.FC<{ size?: number; className?: string }> = ({ size = 30, className = '' }) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <LogoMark size={size} className="shrink-0" />
    <span className="font-display font-bold leading-none" style={{ fontSize: Math.round(size * 0.8) }}>
      Řemeslník PRO
    </span>
  </span>
);

/**
 * „Metr“ – pruh rozdělený na úseky, jeden na fázi zakázky. Hotové fáze jsou žluté, aktuální je celá tmavá.
 * @param animate úseky se jednou postupně vybarví
 * @param onDark varianta na tmavém / modrém podkladu
 */
export const Metr: React.FC<{
  /** Pořadí aktuální fáze od nuly (0 = první úsek) */
  step: number;
  /** Počet úseků; výchozí je šest fází zakázky */
  steps?: number;
  /** Vše hotovo: všechny úseky žluté, žádný není označen jako aktuální */
  done?: boolean;
  /** Označit aktuální úsek (celý tmavý se žlutými ryskami; výchozí); bez toho metr jen počítá hotové úseky */
  markCurrent?: boolean;
  label: string;
  animate?: boolean;
  onDark?: boolean;
  className?: string;
}> = ({ step, steps = 6, done = false, markCurrent = true, label, animate = false, onDark = false, className = '' }) => {
  const line = onDark ? '#FFFFFF' : '#1A1D21';
  // Tři krátké rysky uvnitř úseku (čtvrtiny); na hranicích úseků je jen dělicí čára
  const ticks = (color: string) => ({
    backgroundImage: [1, 2, 3].map(() => `linear-gradient(${color}, ${color})`).join(', '),
    backgroundSize: '1px 6px',
    backgroundPosition: '25% 100%, 50% 100%, 75% 100%',
    backgroundRepeat: 'no-repeat',
  });
  return (
    <div
      role="img"
      aria-label={label}
      // Rámeček: na tmavém pozadí aplikace světlý, jinak by tmavý aktuální úsek splynul s pozadím
      className={`grid h-[18px] rounded-sm overflow-hidden border ${onDark ? 'border-white' : 'border-slate-900 dark:border-slate-300'} ${className}`}
      style={{
        gridTemplateColumns: `repeat(${steps}, minmax(0, 1fr))`,
        backgroundColor: onDark ? 'transparent' : '#FFFFFF',
      }}
    >
      {Array.from({ length: steps }, (_, i) => {
        const filled = done || i <= step;
        const current = markCurrent && !done && i === step;
        return (
          <div
            key={i}
            className={animate && filled ? 'animate-metr' : undefined}
            style={{
              borderRight: i < steps - 1 ? `1.5px solid ${line}` : undefined,
              // Hotové fáze žluté, aktuální celá tmavá („tady jste“), zbylé prázdné
              backgroundColor: current ? '#1A1D21' : filled ? '#F5C400' : undefined,
              animationDelay: animate ? `${0.3 + i * 0.55}s` : undefined,
              ...ticks(current ? '#F5C400' : filled ? 'rgba(26,29,33,0.4)' : onDark ? 'rgba(255,255,255,0.55)' : 'rgba(26,29,33,0.22)'),
            }}
          />
        );
      })}
    </div>
  );
};
