import React, { useRef } from 'react';
import { X, Printer, Download, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { ContractorProfile } from '../types/contract';
import { PRO_CONFIG, getSubscriptionInfo } from '../utils/subscription';
import { formatCurrency } from '../utils/numberToWordsCs';

interface SubscriptionInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractor: ContractorProfile | null;
}

export const SubscriptionInvoiceModal: React.FC<SubscriptionInvoiceModalProps> = ({
  isOpen,
  onClose,
  contractor,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  if (!isOpen || !contractor) return null;

  const subInfo = getSubscriptionInfo(contractor);
  const isYearly = contractor.subscriptionPlan === 'pro_yearly';
  const totalPrice = isYearly ? PRO_CONFIG.yearlyPrice : PRO_CONFIG.monthlyPrice;
  // Výpočet DPH 21 %
  const basePrice = Math.round((totalPrice / 1.21) * 100) / 100;
  const vatAmount = Math.round((totalPrice - basePrice) * 100) / 100;

  const todayStr = new Date().toLocaleDateString('cs-CZ');
  const invoiceNumber = contractor.subscriptionInvoiceNumber || `PRO-2026-${contractor.ico ? contractor.ico.substring(0, 5) : '8421'}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden my-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Controls Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Daňový doklad k licenci
            </span>
            <span className="text-3xs px-2 py-0.5 rounded-md font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              Uhrazeno
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Tisknout / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Sheet */}
        <div ref={printRef} className="p-6 sm:p-8 bg-white text-slate-900 text-xs font-sans space-y-6">
          {/* Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-5">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-blue-900">
                FAKTURA – DAŇOVÝ DOKLAD
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">
                č. {invoiceNumber}
              </div>
              <div className="text-3xs text-slate-500 mt-0.5">
                Variabilní symbol: {contractor.ico || '12345678'}
              </div>
            </div>

            <div className="text-right text-3xs space-y-1">
              <div>
                <span className="text-slate-500">Datum vystavení: </span>
                <strong>{todayStr}</strong>
              </div>
              <div>
                <span className="text-slate-500">Datum uskutečnění zdan. plnění: </span>
                <strong>{todayStr}</strong>
              </div>
              <div>
                <span className="text-slate-500">Způsob úhrady: </span>
                <strong>Bankovní převod / Karta (Uhrazeno)</strong>
              </div>
            </div>
          </div>

          {/* Supplier & Customer */}
          <div className="grid grid-cols-2 gap-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <div className="text-3xs font-black uppercase text-slate-400 mb-1">
                DODAVATEL
              </div>
              <div className="font-bold text-slate-900">{PRO_CONFIG.operatorName}</div>
              <div className="text-3xs text-slate-600 mt-0.5">{PRO_CONFIG.operatorAddress}</div>
              <div className="text-3xs text-slate-600 mt-1">
                IČO: <strong>{PRO_CONFIG.operatorIco}</strong>, DIČ: <strong>{PRO_CONFIG.operatorDic}</strong>
              </div>
              <div className="text-3xs text-slate-600">
                Účet: <strong>{PRO_CONFIG.operatorAccount}</strong> (Fio banka)
              </div>
            </div>

            <div>
              <div className="text-3xs font-black uppercase text-slate-400 mb-1">
                ODBĚRATEL (ŽIVNOSTNÍK)
              </div>
              <div className="font-bold text-slate-900">{contractor.name || 'Živnostník'}</div>
              <div className="text-3xs text-slate-600 mt-0.5">{contractor.address || 'Česká republika'}</div>
              <div className="text-3xs text-slate-600 mt-1">
                IČO: <strong>{contractor.ico || '---'}</strong>
                {contractor.dic && (
                  <>, DIČ: <strong>{contractor.dic}</strong></>
                )}
              </div>
              <div className="text-3xs text-slate-600">
                E-mail: {contractor.email || '---'}
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-3xs font-bold text-slate-600">
                <tr>
                  <th className="py-2.5 px-3">Předmět plnění</th>
                  <th className="py-2.5 px-3 text-center">Množství</th>
                  <th className="py-2.5 px-3 text-right">Základ DPH</th>
                  <th className="py-2.5 px-3 text-right">Sazba DPH</th>
                  <th className="py-2.5 px-3 text-right">Celkem s DPH</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3 px-3">
                    <strong className="text-slate-900 block">
                      Licence aplikace Řemeslník PRO ({isYearly ? 'Roční přístup' : 'Měsíční přístup'})
                    </strong>
                    <span className="text-3xs text-slate-500">
                      Elektronická softwarová služba pro správu smluv o dílo, zakázek a fakturace.
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">1 ks</td>
                  <td className="py-3 px-3 text-right">{formatCurrency(basePrice)}</td>
                  <td className="py-3 px-3 text-right">21 %</td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900">
                    {formatCurrency(totalPrice)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals Breakdown */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Základ daně (21 %):</span>
                <span>{formatCurrency(basePrice)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>DPH 21 %:</span>
                <span>{formatCurrency(vatAmount)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 font-black text-sm text-slate-900">
                <span>Celkem k úhradě:</span>
                <span className="text-blue-900">{formatCurrency(totalPrice)}</span>
              </div>
              <div className="text-right text-3xs text-emerald-700 font-bold pt-1">
                ✓ Uhrazeno v plné výši
              </div>
            </div>
          </div>

          {/* Legal Note */}
          <div className="pt-4 border-t border-slate-200 text-3xs text-slate-400 space-y-1">
            <p>
              Tento doklad je daňově uznatelným nákladem pro uplatnění výdajů v daňové evidenci nebo
              účetnictví podnikatele.
            </p>
            <p>Vystaveno elektronicky v systému Řemeslník PRO dne {todayStr}.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
