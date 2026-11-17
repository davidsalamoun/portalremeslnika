import React from 'react';
import { FileCode2 } from 'lucide-react';
import { Contract } from '../types/contract';
import { docBar, docBarTitle, docBarNote, docBarActions, docButton, docChip } from './docBar';
import { CraftsmanStamp } from './CraftsmanStamp';
import { formatCurrency, formatDateCs } from '../utils/numberToWordsCs';
import { getAdvanceTaxBreakdown } from '../utils/invoiceMath';
import { getAdvanceInvoiceNumber } from '../utils/invoiceNumbering';
import { buildIsdoc, isdocFileName } from '../utils/isdoc';
import { downloadFile } from '../utils/zipStore';

const formatHalere = (amount: number) =>
  `${new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} Kč`;

interface AdvanceTaxDocViewProps {
  contract: Contract;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
  onChangeInvoiceType?: (type: 'final' | 'advance' | 'advance_tax') => void;
}

/**
 * Daňový doklad k přijaté platbě (záloze) – § 28 odst. 1 písm. d) zákona o DPH. Vzniká tlačítkem „Záloha zaplacena“
 * v liště zálohové faktury (jen plátce, ne při přenesení daňové povinnosti) a už se nemění. Doklad nevyzývá k platbě.
 */
export const AdvanceTaxDocView: React.FC<AdvanceTaxDocViewProps> = ({ contract, onToast, onChangeInvoiceType }) => {
  const number = `DP-${contract.advanceTaxDocNumber}`;
  const advanceInvoice = getAdvanceInvoiceNumber(contract);
  const issueDate = (contract.advanceTaxDocIssuedAt || new Date().toISOString()).slice(0, 10);
  const paidDate = contract.advancePaidDate || issueDate;
  const vat = getAdvanceTaxBreakdown(contract);
  const isInvoiceOnly = contract.docKind === 'invoice';

  return (
    <div className="space-y-4">
      {/* Lišta dokladu (jen na obrazovce) */}
      <div className={docBar}>
        <div className="min-w-0">
          <div className={docBarTitle}>Daňový doklad k přijaté platbě</div>
          <div className={docBarNote}>
            č. {number}, záloha přijata {formatDateCs(paidDate)}
          </div>
        </div>
        <div className={docBarActions}>
          {onChangeInvoiceType && (
            <div role="group" aria-label="Druh faktury" className="flex gap-2">
              <button type="button" aria-pressed={false} onClick={() => onChangeInvoiceType('final')} className={docChip(false)}>
                Konečná
              </button>
              <button type="button" aria-pressed={false} onClick={() => onChangeInvoiceType('advance')} className={docChip(false)}>
                Zálohová
              </button>
              <button type="button" aria-pressed className={docChip(true)}>
                Doklad k záloze
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              downloadFile(isdocFileName(contract, 'advance_tax'), buildIsdoc(contract, 'advance_tax'), 'application/xml');
              onToast?.('success', 'Doklad je stažený ve formátu ISDOC pro účetní program.');
            }}
            className={docButton}
            title="Elektronický doklad, který načtou účetní programy (Pohoda, Money, ABRA…)"
          >
            <FileCode2 className="w-4 h-4" />
            <span>ISDOC</span>
          </button>
        </div>
      </div>

      {/* Papír dokladu (A4 rozložení) */}
      <div
        className="contract-page bg-white shadow-xl rounded-sm p-8 sm:p-12 border border-slate-200 text-slate-900 font-sans text-xs leading-normal select-text"
        style={{ minHeight: '297mm', width: '100%', maxWidth: '210mm', margin: '0 auto', boxSizing: 'border-box' }}
      >
        {/* Hlavička */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
          <div>
            <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500 block mb-0.5">
              DAŇOVÝ DOKLAD K PŘIJATÉ PLATBĚ
            </span>
            <h1 className="text-2xl font-black text-slate-950 tracking-tight">{number}</h1>
            <p className="text-xs text-slate-500 mt-1">
              {advanceInvoice && (
                <>
                  K zálohové faktuře: <strong>ZAL-{advanceInvoice}</strong>
                </>
              )}
              {advanceInvoice && !isInvoiceOnly && contract.contractNumber && ' · '}
              {!isInvoiceOnly && contract.contractNumber && (
                <>
                  K smlouvě o dílo: <strong>{contract.contractNumber}</strong>
                </>
              )}
            </p>
          </div>
          <div className="text-right">
            <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-800">
              Plátce DPH
            </span>
          </div>
        </div>

        {/* Dodavatel a odběratel */}
        <div className="grid grid-cols-2 gap-8 mb-8 pb-6 border-b border-slate-200">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">DODAVATEL:</span>
            <h3 className="font-bold text-sm text-slate-900">{contract.contractor.name}</h3>
            <p className="text-slate-600">{contract.contractor.address}</p>
            <div className="pt-2 text-slate-700 space-y-0.5">
              <p>
                <strong>IČO:</strong> {contract.contractor.ico} · <strong>DIČ:</strong> {contract.contractor.dic}
              </p>
              <p className="text-[10px] text-slate-500 italic">Fyzická osoba zapsaná v živnostenském rejstříku.</p>
              <p className="text-[11px] pt-1">
                Tel: {contract.contractor.phone} · E-mail: {contract.contractor.email}
              </p>
            </div>
          </div>
          <div className="space-y-1 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">ODBĚRATEL:</span>
            <h3 className="font-bold text-sm text-slate-900">{contract.client.name}</h3>
            <p className="text-slate-600">{contract.client.address}</p>
            <div className="pt-2 text-slate-700 space-y-0.5">
              {(contract.client.ico || contract.client.dic) && (
                <p>
                  {contract.client.ico && (
                    <>
                      <strong>IČO:</strong> {contract.client.ico}
                    </>
                  )}
                  {contract.client.ico && contract.client.dic && ' · '}
                  {contract.client.dic && (
                    <>
                      <strong>DIČ:</strong> {contract.client.dic}
                    </>
                  )}
                </p>
              )}
              <p className="text-[11px]">Tel: {contract.client.phone}</p>
              {contract.client.email && <p className="text-[11px]">E-mail: {contract.client.email}</p>}
            </div>
          </div>
        </div>

        {/* Data */}
        <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-8">
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase block">Datum vystavení</span>
            <span className="font-bold text-slate-900 text-xs">{formatDateCs(issueDate)}</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase block">Datum přijetí platby</span>
            <span className="font-bold text-slate-900 text-xs">{formatDateCs(paidDate)}</span>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase block">Způsob úhrady</span>
            <span className="font-bold text-slate-900 text-xs">{contract.advancePaidMethod === 'cash' ? 'Hotově' : 'Bankovní převod'}</span>
          </div>
        </div>

        {/* Položka */}
        <div className="mb-8 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Položka</th>
                <th className="py-2.5 px-3 text-right">Částka</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-3 px-3">
                  <strong className="block text-xs text-slate-900">
                    Přijatá záloha na provedení díla{!isInvoiceOnly && contract.contractNumber ? ` dle smlouvy ${contract.contractNumber}` : ''}
                  </strong>
                  <span className="text-slate-500 text-[11px] block mt-0.5">{contract.workDescription}</span>
                </td>
                <td className="py-3 px-3 text-right font-bold text-slate-900">{formatCurrency(vat.gross)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Rozpis DPH */}
        <div className="mb-8 ml-auto w-full sm:w-2/3 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-2 px-3 text-left">Sazba DPH</th>
                <th className="py-2 px-3 text-right">Základ daně</th>
                <th className="py-2 px-3 text-right">DPH</th>
                <th className="py-2 px-3 text-right">Celkem s DPH</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2.5 px-3 font-medium">{vat.rate} %</td>
                <td className="py-2.5 px-3 text-right font-medium">{formatHalere(vat.base)}</td>
                <td className="py-2.5 px-3 text-right font-medium">{formatHalere(vat.vat)}</td>
                <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatHalere(vat.gross)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Spodní blok */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t-2 border-slate-900 items-end">
          <p className="text-[11px] text-slate-600">
            Doklad potvrzuje přijetí zálohy, nejde o výzvu k platbě. Záloha bude odečtena v konečné faktuře.
          </p>
          <div className="space-y-2 text-right">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">PŘIJATO:</span>
              <span className="text-2xl font-black text-[#1E3A78] tracking-tight block">{formatCurrency(vat.gross)}</span>
              <p className="text-[10px] text-slate-500 italic mt-0.5">Částka je uvedena včetně DPH.</p>
            </div>
            <div className="relative flex flex-wrap items-end justify-end gap-x-3 gap-y-2">
              <div className="max-w-full opacity-85 pointer-events-none">
                <CraftsmanStamp contractor={contract.contractor} size="sm" />
              </div>
              <div className="border-t-2 border-dotted border-slate-400 w-36 pt-1.5 text-center relative z-10">
                <span className="text-xs font-bold text-slate-900 block">{contract.contractor.name}</span>
                <span className="text-[10px] text-slate-500 font-sans tracking-wide block">(vystavil, podpis a razítko)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
