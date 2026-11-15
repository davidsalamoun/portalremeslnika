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
 * „Metr“ – pruh s dílky jako na svinovacím metru. Žlutá část ukazuje, jak daleko je zakázka.
 * @param percent 0–100
 * @param animate výplň jednou plynule vyjede z nuly
 * @param onDark varianta na tmavém / modrém podkladu
 */
export const Metr: React.FC<{ percent: number; label: string; animate?: boolean; onDark?: boolean; className?: string }> = ({
  percent,
  label,
  animate = false,
  onDark = false,
  className = '',
}) => {
  const clamped = Math.max(0, Math.min(100, percent));
  const tick = (alpha: number, light: boolean) =>
    `repeating-linear-gradient(90deg, ${light ? `rgba(255,255,255,${alpha})` : `rgba(26,29,33,${alpha})`} 0 1px, transparent 1px 12px)`;
  return (
    <div
      role="img"
      aria-label={label}
      className={`relative h-4 rounded-sm overflow-hidden ${className}`}
      style={{
        border: `1px solid ${onDark ? '#FFFFFF' : '#1A1D21'}`,
        backgroundColor: onDark ? 'transparent' : '#FFFFFF',
        backgroundImage: tick(onDark ? 0.7 : 0.5, onDark),
      }}
    >
      <div
        className={animate ? 'animate-metr' : undefined}
        style={{
          position: 'absolute',
          inset: '0 auto 0 0',
          width: `${clamped}%`,
          backgroundColor: '#F5C400',
          backgroundImage: tick(0.75, false),
          borderRight: clamped > 0 && clamped < 100 ? '2px solid #1A1D21' : undefined,
        }}
      />
    </div>
  );
};
