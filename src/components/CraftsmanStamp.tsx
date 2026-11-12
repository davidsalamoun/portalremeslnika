import React from 'react';
import { ContractorProfile } from '../types/contract';

interface CraftsmanStampProps {
  contractor: ContractorProfile;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const CraftsmanStamp: React.FC<CraftsmanStampProps> = ({
  contractor,
  className = '',
  size = 'md',
}) => {
  if (!contractor || !contractor.name || !contractor.ico) {
    return null;
  }

  const sizeClasses = {
    sm: 'w-36 h-24 text-[9px]',
    md: 'w-48 h-32 text-[10px]',
    lg: 'w-56 h-36 text-[11px]',
  }[size];

  return (
    <div
      className={`relative select-none pointer-events-none transform -rotate-2 ${className}`}
      title={`Úřední otisk razítka: ${contractor.name}`}
    >
      <div
        className={`${sizeClasses} rounded-[48px] border-2 border-blue-900/80 p-2 flex flex-col items-center justify-between text-center font-sans tracking-tight text-blue-900/90 bg-blue-50/25 shadow-2xs backdrop-blur-[0.5px]`}
        style={{
          boxShadow: 'inset 0 0 0 1px rgba(30, 58, 138, 0.4)',
        }}
      >
        {/* Horní oblouk / Hlavička razítka */}
        <div className="w-full flex items-center justify-center border-b border-blue-900/30 pb-0.5">
          <span className="font-extrabold uppercase tracking-widest text-[8px] text-blue-950 opacity-90">
            • ŽIVNOSTENSKÉ OPRÁVNĚNÍ •
          </span>
        </div>

        {/* Střed razítka: Jméno a sídlo */}
        <div className="my-auto px-1 py-0.5 leading-tight">
          <div className="font-black uppercase tracking-tight text-blue-950 text-xs sm:text-[13px] line-clamp-1">
            {contractor.name}
          </div>
          <div className="text-[9px] text-blue-900/80 line-clamp-1 mt-0.5">
            {contractor.address}
          </div>
        </div>

        {/* Spodní řádek: IČO a DIČ */}
        <div className="w-full border-t border-blue-900/30 pt-0.5 flex items-center justify-center gap-1 font-mono font-bold text-[9px] text-blue-950">
          <span>IČO: {contractor.ico}</span>
          {contractor.dic && <span>· DIČ: {contractor.dic}</span>}
        </div>
      </div>
    </div>
  );
};
