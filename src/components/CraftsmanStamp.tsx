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
  sm: { width: 172, name: 14, text: 9.5, ico: 12, padding: '6px 10px 5px' },
  md: { width: 220, name: 17, text: 11, ico: 14, padding: '9px 14px 8px' },
  lg: { width: 260, name: 20, text: 12.5, ico: 16, padding: '10px 18px 9px' },
};

export const CraftsmanStamp: React.FC<CraftsmanStampProps> = ({ contractor, className = '', size = 'md' }) => {
  if (!contractor || !contractor.name || !contractor.ico) {
    return null;
  }
  const s = SIZES[size];

  return (
    <div
      className={`relative select-none pointer-events-none ${className}`}
      style={{ transform: 'rotate(-2.5deg)' }}
      title={`Razítko: ${contractor.name}`}
    >
      <div
        style={{
          width: s.width,
          boxSizing: 'border-box',
          border: `2px solid ${INK}`,
          borderRadius: 3,
          padding: s.padding,
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
            fontSize: s.name,
            lineHeight: 1.1,
            overflowWrap: 'anywhere',
          }}
        >
          {contractor.name}
        </div>
        {contractor.address && <div style={{ fontSize: s.text, marginTop: 2 }}>{contractor.address}</div>}
        {contractor.phone && <div style={{ fontSize: s.text }}>tel. {contractor.phone}</div>}
        <div
          style={{
            fontFamily: "'Barlow Semi Condensed', 'IBM Plex Sans', sans-serif",
            fontWeight: 600,
            fontSize: s.ico,
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
