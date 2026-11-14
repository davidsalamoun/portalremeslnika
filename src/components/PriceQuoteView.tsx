import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Calendar,
  Clock,
  ArrowRight,
  CheckCircle2,
  Share2,
  ShieldCheck,
  Building2,
  Phone,
  Mail,
  Coins,
  Send,
  MessageSquare,
  Copy,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { Contract, BudgetItem } from '../types/contract';
import {
  formatCurrency,
  formatDateCs,
  formatContractPriceWithWords,
  amountInWordsCzk,
} from '../utils/numberToWordsCs';
import { getWhatsAppShareUrl, getMailtoShareUrl } from '../utils/shareUtils';
import { CraftsmanStamp } from './CraftsmanStamp';

interface PriceQuoteViewProps {
  contract: Contract;
  onConvertToContract: (contract: Contract) => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const PriceQuoteView: React.FC<PriceQuoteViewProps> = ({
  contract,
  onConvertToContract,
  onToast,
}) => {
  const quoteNumber =
    contract.quoteNumber ||
    `CN-${contract.contractNumber.replace(/[^0-9]/g, '') || new Date().getFullYear()}-01`;

  // Quote validity: 30 days default
  const issueDate = contract.conclusionDate || new Date().toISOString().split('T')[0];
  const validUntil =
    contract.quoteValidUntil ||
    (() => {
      const d = new Date(issueDate);
      d.setDate(d.getDate() + 30);
      return d.toISOString().split('T')[0];
    })();

  const items = contract.items || [];
  const workItems = items.filter((it) => it.type === 'prace');
  const materialItems = items.filter((it) => it.type === 'material');
  const otherItems = items.filter((it) => it.type === 'ostatni');

  const workSum = workItems.reduce((s, it) => s + (it.totalPrice || 0), 0);
  const materialSum = materialItems.reduce((s, it) => s + (it.totalPrice || 0), 0);
  const otherSum = otherItems.reduce((s, it) => s + (it.totalPrice || 0), 0);

  const handleConvert = () => {
    const updated: Contract = {
      ...contract,
      docKind: 'contract',
      status: 'draft',
    };
    onConvertToContract(updated);
    onToast?.(
      'success',
      `Cenová nabídka byla úspěšně převedena na Smlouvu o dílo č. ${contract.contractNumber}!`
    );
  };

  const shareText = `Dobrý den, posílám cenovou nabídku č. ${quoteNumber} na realizaci: "${contract.workDescription.substring(0, 80)}...". Celková předpokládaná cena: ${formatCurrency(contract.price)}. Platnost nabídky do: ${formatDateCs(validUntil)}. V případě dotazů se na mě neváhejte obrátit. ${contract.contractor.name}, tel: ${contract.contractor.phone}`;

  const handleCopyShare = () => {
    navigator.clipboard.writeText(shareText);
    onToast?.('success', 'Text cenové nabídky byl zkopírován do schránky');
  };

  const whatsappShareUrl = `https://wa.me/${contract.client.phone.replace(/[^0-9+]/g, '')}?text=${encodeURIComponent(shareText)}`;

  const handleEmail = () => {
    const subj = `Cenová nabídka č. ${quoteNumber} - ${contract.contractor.name}`;
    const url = `mailto:${contract.client.email}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(shareText)}`;
    window.location.href = url;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Conversion to Contract */}
      <div className="no-print p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
            <span>Cenová nabídka / Kalkulace</span>
            <span aria-hidden="true">·</span>
            <span>Nezávazná nabídka pro klienta</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            Cenová nabídka č. {quoteNumber}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl">
            Klient si vyžádal kalkulaci? Nabídku můžete vytisknout, poslat přes WhatsApp nebo e-mail. Jakmile klient odsouhlasí podmínky, jedním kliknutím ji převedete na ostrou Smlouvu o dílo.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleConvert}
            className="h-10 px-4 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-xs inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-slate-950" />
            <span>Převést na Smlouvu o dílo</span>
          </button>
        </div>
      </div>

      {/* Share and Print bar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <Clock className="w-3.5 h-3.5 text-blue-500" />
          <span>Platnost nabídky: do <strong>{formatDateCs(validUntil)}</strong></span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {contract.client.phone && (
            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              WhatsApp
            </a>
          )}

          {contract.client.email && (
            <button
              type="button"
              onClick={handleEmail}
              className="h-9 px-3 text-xs font-semibold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5 text-blue-600" />
              E-mail
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyShare}
            className="h-9 px-3 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            Kopírovat
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="h-9 px-3.5 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-700 dark:hover:bg-slate-600 inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            Tisk / PDF
          </button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div
        id="quote-printable-paper"
        className="bg-white text-slate-900 p-8 sm:p-12 rounded-xl shadow-lg border border-slate-200 max-w-4xl mx-auto font-sans leading-relaxed text-sm"
      >
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-6 border-b-2 border-slate-900 gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-blue-600 mb-1">
              Položková kalkulace a nabídka
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-slate-900">
              CENOVÁ NABÍDKA
            </h1>
            <div className="text-sm font-bold text-slate-600 mt-1">
              číslo: {quoteNumber}
            </div>
          </div>

          <div className="text-left sm:text-right text-xs text-slate-600 space-y-1">
            <div>
              <span className="text-slate-400">Datum vystavení: </span>
              <strong className="text-slate-900">{formatDateCs(issueDate)}</strong>
            </div>
            <div>
              <span className="text-slate-400">Platnost nabídky do: </span>
              <strong className="text-blue-900">{formatDateCs(validUntil)}</strong>
            </div>
            <div>
              <span className="text-slate-400">Předpokládané dokončení: </span>
              <strong className="text-slate-900">{formatDateCs(contract.deliveryDate)}</strong>
            </div>
          </div>
        </div>

        {/* Contractor & Client info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Dodavatel:
            </div>
            <div className="font-bold text-base text-slate-900">{contract.contractor.name}</div>
            <div className="text-xs text-slate-600 mt-1">IČO: {contract.contractor.ico}</div>
            {contract.contractor.dic && (
              <div className="text-xs text-slate-600">DIČ: {contract.contractor.dic}</div>
            )}
            <div className="text-xs text-slate-600">{contract.contractor.address}</div>
            <div className="text-xs text-slate-600 mt-1">Tel: {contract.contractor.phone}</div>
            <div className="text-xs text-slate-600">E-mail: {contract.contractor.email}</div>
            <div className="text-xs text-slate-600 mt-1">
              Účet: <strong>{contract.contractor.bankAccount}</strong>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Odběratel (poptávající):
            </div>
            <div className="font-bold text-base text-slate-900">{contract.client.name}</div>
            {contract.client.ico && (
              <div className="text-xs text-slate-600 mt-1">IČO: {contract.client.ico}</div>
            )}
            <div className="text-xs text-slate-600">{contract.client.address}</div>
            <div className="text-xs text-slate-600 mt-1">Tel: {contract.client.phone}</div>
            <div className="text-xs text-slate-600">E-mail: {contract.client.email}</div>
          </div>
        </div>

        {/* Scope of Work */}
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-300 pb-1 mb-2">
            Předmět a rozsah nabízených prací
          </h2>
          <div className="p-3.5 bg-slate-50/70 rounded-lg border border-slate-200 text-sm text-slate-800 whitespace-pre-wrap">
            {contract.workDescription}
          </div>
        </div>

        {/* Itemized breakdown table if items exist */}
        {items.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-300 pb-1 mb-2">
              Položkový rozpočet díla
            </h2>
            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-2">Typ</th>
                    <th className="p-2">Popis položky</th>
                    <th className="p-2 text-right">Množství</th>
                    <th className="p-2 text-right">Cena / jedn.</th>
                    <th className="p-2 text-right">Celkem bez DPH</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it) => (
                    <tr key={it.id} className="hover:bg-slate-50/60">
                      <td className="p-2 font-medium text-slate-500">
                        {it.type === 'prace' ? 'Práce' : it.type === 'material' ? 'Materiál' : 'Ostatní'}
                      </td>
                      <td className="p-2 font-semibold text-slate-900">{it.title}</td>
                      <td className="p-2 text-right whitespace-nowrap">
                        {it.quantity} {it.unit}
                      </td>
                      <td className="p-2 text-right whitespace-nowrap">
                        {formatCurrency(it.unitPrice)}
                      </td>
                      <td className="p-2 text-right font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrency(it.totalPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary subrows */}
              <div className="bg-slate-50 p-2.5 border-t border-slate-200 flex flex-wrap justify-end gap-4 text-xs">
                {workSum > 0 && (
                  <span className="text-slate-600">
                    Práce celkem: <strong>{formatCurrency(workSum)}</strong>
                  </span>
                )}
                {materialSum > 0 && (
                  <span className="text-slate-600">
                    Materiál celkem: <strong>{formatCurrency(materialSum)}</strong>
                  </span>
                )}
                {otherSum > 0 && (
                  <span className="text-slate-600">
                    Ostatní: <strong>{formatCurrency(otherSum)}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Grand Total Card */}
        <div className="p-5 bg-slate-950 text-white rounded-lg border border-slate-800 my-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                Celková kalkulovaná cena {contract.hasVat ? 'včetně DPH' : 'k úhradě'}:
              </span>
              <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tabular-nums mt-0.5">
                {formatCurrency(contract.price)}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Slovy: {amountInWordsCzk(contract.price)}
              </div>
            </div>

            {contract.advanceAmount && contract.advanceAmount > 0 && (
              <div className="p-3 bg-white/80 rounded-lg border border-blue-200 text-xs text-slate-700">
                <div className="text-slate-500">Požadovaná záloha:</div>
                <div className="text-base font-bold text-slate-900">
                  {formatCurrency(contract.advanceAmount)}
                </div>
                <div className="text-[10px] text-slate-400">Na materiál a zahájení prací</div>
              </div>
            )}
          </div>
        </div>

        {/* Terms and notes */}
        <div className="mb-8 text-xs text-slate-600 space-y-1.5">
          <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-1">
            Podmínky a doplňující informace:
          </div>
          <div>• Tato cenová nabídka je platná do <strong>{formatDateCs(validUntil)}</strong>.</div>
          <div>• Předpokládaný termín realizace prací: <strong>{formatDateCs(contract.deliveryDate)}</strong>.</div>
          <div>• Záruční doba na provedené dílo: <strong>24 měsíců</strong> od protokolárního předání.</div>
          <div>• V případě odsouhlasení nabídky bude mezi stranami uzavřena řádná Smlouva o dílo.</div>
          {!contract.hasVat && (
            <div>• Zhotovitel není plátcem DPH. Ceny jsou konečné.</div>
          )}
        </div>

        {/* Footer with sign-off and stamp */}
        <div className="pt-6 border-t border-slate-300 flex items-end justify-between relative">
          <div className="text-xs text-slate-500">
            V {contract.executionPlace || contract.contractor.defaultPlace || 'místě plnění'} dne{' '}
            {formatDateCs(issueDate)}
          </div>

          <div className="text-right relative">
            <div className="absolute -top-12 -left-28 sm:-left-36 opacity-85 pointer-events-none">
              <CraftsmanStamp contractor={contract.contractor} size="sm" />
            </div>
            <div className="text-xs text-slate-500 uppercase font-bold mb-1">Vypracoval:</div>
            <div className="font-bold text-sm text-slate-900">{contract.contractor.name}</div>
            <div className="text-xs text-slate-600 font-mono">IČO: {contract.contractor.ico}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
