import React from 'react';
import { ContractorProfile } from '../types/contract';

interface CraftsmanStampProps {
  contractor: ContractorProfile;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

// Obyčejné firemní razítko: jméno, adresa, telefon a pod linkou IČO (u plátce i DIČ).
// Barvy a písmo jsou zadané přímo, protože razítko leží na papíře dokumentu, kde se vzhled aplikace nepoužívá.
const INK = '#1B3F8B';
const SIZES = {
  sm: { width: 172, name: 14, text: 9.5, ico: 12, padX: 10, padY: 6 },
  md: { width: 220, name: 17, text: 11, ico: 14, padX: 14, padY: 9 },
  lg: { width: 260, name: 20, text: 12.5, ico: 16, padX: 18, padY: 10 },
};

export const CraftsmanStamp: React.FC<CraftsmanStampProps> = ({ contractor, className = '', size = 'md' }) => {
  if (!contractor || !contractor.name || !contractor.ico) {
    return null;
  }
  const s = SIZES[size];
  // Rozměry se počítají ze šířky razítka: v úzkém sloupci (mobil) se zmenší celé, místo aby se text lámal
  const scaled = (px: number) => `min(${px}px, ${((px / s.width) * 100).toFixed(2)}cqw)`;

  return (
    <div
      className={`relative select-none pointer-events-none ${className}`}
      style={{ transform: 'rotate(-1.5deg)', width: s.width, maxWidth: '100%', containerType: 'inline-size' }}
      title={`Razítko: ${contractor.name}`}
    >
      <div
        style={{
          boxSizing: 'border-box',
          border: `2px solid ${INK}`,
          borderRadius: 3,
          padding: `${scaled(s.padY)} ${scaled(s.padX)}`,
          color: INK,
          opacity: 0.92,
          textAlign: 'center',
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
          lineHeight: 1.3,
        }}
      >
        <div
          style={{
            fontFamily: "'Barlow Semi Condensed', 'IBM Plex Sans', sans-serif",
            fontWeight: 700,
            fontSize: scaled(s.name),
            lineHeight: 1.1,
            overflowWrap: 'anywhere',
          }}
        >
          {contractor.name}
        </div>
        {contractor.address && <div style={{ fontSize: scaled(s.text), marginTop: 2 }}>{contractor.address}</div>}
        {contractor.phone && <div style={{ fontSize: scaled(s.text) }}>tel. {contractor.phone}</div>}
        <div
          style={{
            fontFamily: "'Barlow Semi Condensed', 'IBM Plex Sans', sans-serif",
            fontWeight: 600,
            fontSize: scaled(s.ico),
            letterSpacing: '0.03em',
            borderTop: `1.5px solid ${INK}`,
            marginTop: 4,
            paddingTop: 3,
          }}
        >
          IČO {contractor.ico}
          {contractor.dic ? ` · DIČ ${contractor.dic}` : ''}
        </div>
      </div>
    </div>
  );
};
