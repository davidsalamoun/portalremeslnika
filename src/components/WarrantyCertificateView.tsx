import React, { useState } from 'react';
import { docBar, docBarTitle, docBarNote, docBarActions, docButton, docChip } from './docBar';
import {
  Printer,
  Download,
  Share2,
  Send,
  ShieldCheck,
  Calendar,
  PenTool,
  Clock,
  CheckCircle,
  FileText,
  AlertCircle,
  Phone,
  Mail,
  Building2,
} from 'lucide-react';
import { Contract, WarrantyCertificateData } from '../types/contract';
import { formatDateCs, formatCurrency } from '../utils/numberToWordsCs';
import { triggerHaptic } from '../utils/haptics';
import { safeOpenExternalUrl } from '../utils/shareUtils';
import { SignatureModal } from './SignatureModal';
import { ShareModal } from './ShareModal';
import { CraftsmanStamp } from './CraftsmanStamp';

interface WarrantyCertificateViewProps {
  contract: Contract;
  onUpdateContract: (updated: Contract) => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const WarrantyCertificateView: React.FC<WarrantyCertificateViewProps> = ({
  contract,
  onUpdateContract,
  onToast,
}) => {
  // Inicializace výchozích dat záruky
  const handoverDate =
    contract.handoverData?.handoverDate ||
    contract.deliveryDate ||
    new Date().toISOString().split('T')[0];

  const defaultMonths = contract.warranty?.warrantyPeriodMonths || 24;

  const calculateValidUntil = (startDateStr: string, months: number): string => {
    try {
      const d = new Date(startDateStr);
      d.setMonth(d.getMonth() + months);
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const [warrantyNumber, setWarrantyNumber] = useState(
    contract.warranty?.warrantyNumber || `ZL-${contract.contractNumber.replace(/\D/g, '') || '2026-001'}`
  );
  const [issueDate, setIssueDate] = useState(
    contract.warranty?.issueDate || handoverDate
  );
  const [months, setMonths] = useState<number>(defaultMonths);
  const [validUntil, setValidUntil] = useState(
    contract.warranty?.warrantyValidUntil || calculateValidUntil(issueDate, defaultMonths)
  );
  const [scope, setScope] = useState(
    contract.warranty?.scopeOfWarranty ||
      `Zhotovitel poskytuje záruku na provedené řemeslné a montážní práce v rozsahu: ${contract.workDescription.substring(0, 200)}... a na dodaný materiál v souladu se zárukami výrobců.`
  );
  const [conditions, setConditions] = useState(
    contract.warranty?.conditions ||
      'Záruka se vztahuje na vady způsobené vadným provedením prací zhotovitele nebo vadou jím dodaného materiálu. Záruka se nevztahuje na běžné opotřebení, mechanické poškození uživatelem, zásahy třetích osob, živelní události a nedodržení obvyklých zásad údržby a větrání.'
  );
  const [serviceContact, setServiceContact] = useState(
    contract.warranty?.serviceContact ||
      `Tel: ${contract.contractor.phone}, E-mail: ${contract.contractor.email}`
  );
  const [resolutionDays, setResolutionDays] = useState<number>(
    contract.warranty?.resolutionPeriodDays || 14
  );

  // Garanční roční prohlídky (výpočet ročních termínů z issueDate)
  const totalYears = Math.floor(months / 12);
  const [inspections, setInspections] = useState(() => {
    if (contract.warranty?.annualInspections && contract.warranty.annualInspections.length > 0) {
      return contract.warranty.annualInspections;
    }
    // Vygenerovat výchozí roční termíny
    const list = [];
    for (let y = 1; y <= totalYears; y++) {
      try {
        const d = new Date(issueDate);
        d.setFullYear(d.getFullYear() + y);
        list.push({
          id: `insp_${y}`,
          inspectionYear: y,
          scheduledDate: d.toISOString().split('T')[0],
          status: 'planned' as const,
          findings: '',
          performedBy: contract.contractor.name,
        });
      } catch {}
    }
    return list;
  });

  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [signingParty, setSigningParty] = useState<'contractor' | 'client'>('contractor');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const handleMonthsChange = (newMonths: number) => {
    setMonths(newMonths);
    const newUntil = calculateValidUntil(issueDate, newMonths);
    setValidUntil(newUntil);

    // Přepočítat roční prohlídky
    const newYears = Math.floor(newMonths / 12);
    const updatedInsps = [];
    for (let y = 1; y <= newYears; y++) {
      const existing = inspections.find((i) => i.inspectionYear === y);
      if (existing) {
        updatedInsps.push(existing);
      } else {
        const d = new Date(issueDate);
        d.setFullYear(d.getFullYear() + y);
        updatedInsps.push({
          id: `insp_${y}`,
          inspectionYear: y,
          scheduledDate: d.toISOString().split('T')[0],
          status: 'planned' as const,
          findings: '',
          performedBy: contract.contractor.name,
        });
      }
    }
    setInspections(updatedInsps);
    saveWarrantyData({
      warrantyPeriodMonths: newMonths,
      warrantyValidUntil: newUntil,
      annualInspections: updatedInsps,
    });
  };

  const handleToggleInspectionDone = (year: number) => {
    triggerHaptic('success');
    const updated = inspections.map((i) => {
      if (i.inspectionYear === year) {
        const nextStatus = i.status === 'completed' ? 'planned' : 'completed';
        return {
          ...i,
          status: nextStatus as 'planned' | 'completed',
          completedDate: nextStatus === 'completed' ? new Date().toISOString().split('T')[0] : undefined,
          findings: nextStatus === 'completed' ? 'Provedena vizuální a funkční kontrola spár, těsnění a rozvodů bez zjištění vad.' : '',
        };
      }
      return i;
    });
    setInspections(updated);
    saveWarrantyData({ annualInspections: updated });
    if (onToast) onToast('success', `Garanční prohlídka za ${year}. rok byla aktualizována.`);
  };

  const handleSendInspectionWhatsApp = (inspYear: number, dateStr: string) => {
    triggerHaptic('success');
    const clientName = contract.client.name;
    const workDesc = contract.workDescription;
    const siteAddr = contract.executionPlace || contract.client.address || '';

    const text =
      `*PŘIPOMÍNKA ROČNÍHO GARANČNÍHO SERVISU*\n` +
      `Smlouva: #${contract.contractNumber} (${workDesc})\n` +
      `Místo: ${siteAddr}\n\n` +
      `Dobrý den, ${clientName},\n` +
      `před rokem jsme u vás dokončili realizaci díla. V rámci záručních podmínek a garance kvality (Záruční list č. ${warrantyNumber}) vám nabízíme bezplatnou roční servisní kontrolu (revize silikonových spár, těsnění a funkčnosti).\n\n` +
      `Plánovaný termín: cca ${formatDateCs(dateStr)}.\n` +
      `Kdy by se vám hodil termín v příštím týdnu, abych se krátce zastavil na kontrolu?\n\n` +
      `S pozdravem,\n` +
      `${contract.contractor.name}\n` +
      `Tel: ${contract.contractor.phone}`;

    const encoded = encodeURIComponent(text);
    const phone = contract.client.phone?.replace(/[^0-9+]/g, '') || '';
    const url = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    safeOpenExternalUrl(url);
  };

  const handleIssueDateChange = (newDate: string) => {
    setIssueDate(newDate);
    const newUntil = calculateValidUntil(newDate, months);
    setValidUntil(newUntil);
    saveWarrantyData({ issueDate: newDate, warrantyValidUntil: newUntil });
  };

  const saveWarrantyData = (patch: Partial<WarrantyCertificateData>) => {
    const updatedData: WarrantyCertificateData = {
      warrantyNumber,
      issueDate,
      warrantyPeriodMonths: months,
      warrantyValidUntil: validUntil,
      scopeOfWarranty: scope,
      conditions,
      serviceContact,
      resolutionPeriodDays: resolutionDays,
      annualInspections: inspections,
      ...patch,
    };

    const updatedContract: Contract = {
      ...contract,
      warranty: updatedData,
    };
    onUpdateContract(updatedContract);
  };

  const handleSaveSignature = (dataUrl: string) => {
    const updated = { ...contract };
    const dateStr = new Date().toISOString().split('T')[0];
    if (signingParty === 'contractor') {
      updated.contractorSignature = dataUrl;
      updated.contractorSignatureDate = dateStr;
    } else {
      updated.clientSignature = dataUrl;
      updated.clientSignatureDate = dateStr;
    }
    onUpdateContract(updated);
    if (onToast) onToast('success', 'Podpis byl úspěšně zaznamenán.');
  };

  return (
    <div className="space-y-6">
      {/* Lišta záručního listu (jen na obrazovce) */}
      <div className={docBar}>
        <div className="min-w-0">
          <div className={docBarTitle}>Záruční list</div>
          <div className={docBarNote}>
            Záruka od {formatDateCs(issueDate)} do {formatDateCs(validUntil)}.
          </div>
        </div>
        <div className={docBarActions}>
          <div role="group" aria-label="Délka záruky" className="flex flex-wrap gap-2">
            {[24, 36, 60].map((m) => (
              <button key={m} type="button" aria-pressed={months === m} onClick={() => handleMonthsChange(m)} className={docChip(months === m)}>
                {m} měsíců
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setIsShareModalOpen(true)} className={docButton}>
            <Send className="w-4 h-4" />
            <span>Odeslat</span>
          </button>
        </div>
      </div>

      {/* Záruční prohlídky (jen na obrazovce) */}
      {inspections.length > 0 && (
        <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md divide-y divide-slate-100 dark:divide-slate-800 text-[15px] leading-snug">
          <div className="px-4 py-3">
            <div className="font-semibold text-slate-900 dark:text-white">Záruční prohlídky</div>
            <div className={docBarNote}>Jednou ročně se připomenou v kalendáři. Zákazníkovi můžete poslat pozvánku.</div>
          </div>
          {inspections.map((insp) => {
            const done = insp.status === 'completed';
            return (
              <div key={insp.id} className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <span className="font-semibold text-slate-900 dark:text-white">Po {insp.inspectionYear}. roce</span>
                  <span className={docBarNote}>
                    , {formatDateCs(insp.scheduledDate)}, {done ? 'provedeno' : 'plánováno'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => handleSendInspectionWhatsApp(insp.inspectionYear, insp.scheduledDate)} className={docButton}>
                    <Send className="w-4 h-4" />
                    <span>Pozvat zákazníka</span>
                  </button>
                  <button type="button" aria-pressed={done} onClick={() => handleToggleInspectionDone(insp.inspectionYear)} className={docChip(done)}>
                    {done ? 'Provedeno' : 'Označit jako provedenou'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Papír Záručního listu pro tisk (standardní A4 layout) */}
      <div className="print-content bg-white text-slate-900 rounded-xl shadow-xl p-8 sm:p-12 border border-slate-200 max-w-4xl mx-auto font-sans relative">
        {/* Dekorační bezpečnostní lem */}
        <div className="border-4 border-double border-slate-800 p-6 sm:p-8 rounded-xl relative">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5 mb-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900 text-white text-xs font-bold uppercase tracking-widest rounded mb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Garanční certifikát</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 uppercase">
                Záruční list
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                ke Smlouvě o dílo č. <strong>{contract.contractNumber}</strong>
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs font-bold text-slate-400 block uppercase">Číslo dokladu</span>
              <span className="text-lg font-black text-slate-900">{warrantyNumber}</span>
              <span className="text-xs text-slate-500 block mt-1">
                Datum vystavení: {formatDateCs(issueDate)}
              </span>
            </div>
          </div>

          {/* Smluvní strany */}
          <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs mb-6">
            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Zhotovitel (poskytovatel záruky):
              </span>
              <div className="font-bold text-sm text-slate-900">{contract.contractor.name}</div>
              <div>IČO: {contract.contractor.ico}</div>
              {contract.contractor.dic && <div>DIČ: {contract.contractor.dic}</div>}
              <div>{contract.contractor.address}</div>
              <div className="mt-1 text-slate-600 font-medium">
                {contract.contractor.phone} · {contract.contractor.email}
              </div>
            </div>

            <div>
              <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Objednatel (oprávněný ze záruky):
              </span>
              <div className="font-bold text-sm text-slate-900">{contract.client.name}</div>
              {contract.client.ico && <div>IČO: {contract.client.ico}</div>}
              <div>{contract.client.address}</div>
              <div className="mt-1 text-slate-600 font-medium">
                {contract.client.phone} · {contract.client.email}
              </div>
            </div>
          </div>

          {/* Doba trvání záruky - Velký vizuální blok */}
          <div className="p-5 rounded-xl bg-linear-to-r from-emerald-50 via-teal-50 to-blue-50 border-2 border-emerald-300 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div>
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block mb-0.5">
                Doba trvání záruky za jakost
              </span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-950">
                {months} měsíců ({months / 12} {months === 24 ? 'roky' : 'let'})
              </div>
              <p className="text-xs text-emerald-700 mt-1">
                Záruční doba počíná běžet dnem protokolárního předání a převzetí díla.
              </p>
            </div>

            <div className="p-3 bg-white rounded-lg border border-emerald-200 text-xs text-right shrink-0 shadow-2xs">
              <div className="text-slate-500">Záruka platná od:</div>
              <div className="font-bold text-slate-900">{formatDateCs(issueDate)}</div>
              <div className="text-slate-500 mt-1">Záruka končí dnem:</div>
              <div className="font-bold text-emerald-700 text-sm">{formatDateCs(validUntil)}</div>
            </div>
          </div>

          {/* Předmět a rozsah díla */}
          <div className="space-y-4 text-xs leading-relaxed mb-6">
            <div>
              <h4 className="font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1 mb-1.5">
                1. Předmět záruky a rozsah plnění
              </h4>
              <p className="text-slate-700">
                {scope}
              </p>
              <p className="text-slate-500 italic mt-1">
                Místo realizace díla: {contract.client.address}
              </p>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1 mb-1.5">
                2. Podmínky platnosti záruky
              </h4>
              <p className="text-slate-700">
                {conditions}
              </p>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1 mb-1.5">
                3. Postup uplatnění a vyřízení reklamace
              </h4>
              <p className="text-slate-700">
                Objednatel je povinen zjištěnou vadu oznámit zhotoviteli bez zbytečného odkladu písemně nebo e-mailem na kontakt: <strong>{serviceContact}</strong>.
              </p>
              <p className="text-slate-700 mt-1">
                Zhotovitel se zavazuje zahájit šetření a odstranění oprávněné vady nejpozději do <strong>{resolutionDays} kalendářních dnů</strong> od nahlášení, nebude-li s ohledem na technologické postupy a klimatické podmínky dohodnuto jinak.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1 mb-1.5">
                4. Záznamy o provedení pravidelných garančních servisních kontrol
              </h4>
              <p className="text-slate-700 mb-2">
                Pro zachování prodloužené garance kvality se doporučuje roční odborná kontrola těsnění a dilatačních spár zhotovitelem.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {inspections.map((insp) => (
                  <div key={insp.id} className="p-2 rounded-lg border border-slate-200 bg-slate-50 text-2xs">
                    <span className="font-bold block text-slate-900">{insp.inspectionYear}. roční prohlídka ({formatDateCs(insp.scheduledDate)})</span>
                    <span className="text-3xs text-slate-600 block">
                      Stav: {insp.status === 'completed' ? '✓ Provedeno bez závad' : 'Předepsaná garanční kontrola'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Podpisy */}
          <div className="pt-6 border-t-2 border-slate-900 grid grid-cols-2 gap-8 text-xs">
            {/* Zhotovitel */}
            <div className="flex flex-col items-center text-center relative">
              <span className="font-semibold text-slate-500 mb-2">
                Za zhotovitele vystavil a podepsal:
              </span>
              <div className="relative flex flex-col items-center justify-end min-h-16 w-full">
                <div className="mb-1.5 max-w-full opacity-85 pointer-events-none">
                  <CraftsmanStamp contractor={contract.contractor} size="sm" />
                </div>
                {contract.contractorSignature ? (
                  <div className="h-16 flex items-center justify-center z-10">
                    <img
                      src={contract.contractorSignature}
                      alt="Podpis zhotovitele"
                      className="max-h-14 max-w-44 object-contain"
                    />
                  </div>
                ) : (
                  <div className="h-16 flex items-center justify-center z-10">
                    <button
                      type="button"
                      onClick={() => {
                        setSigningParty('contractor');
                        setIsSignModalOpen(true);
                      }}
                      className="no-print text-xs text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span>Podepsat prstem</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="w-48 border-b border-slate-400 mt-1 mb-1 z-10"></div>
              <span className="font-bold text-slate-900 z-10">{contract.contractor.name}</span>
              <span className="text-[11px] text-slate-400 z-10">
                v {contract.executionPlace || 'místě stavby'}, dne {formatDateCs(contract.contractorSignatureDate || issueDate)}
              </span>
            </div>

            {/* Objednatel */}
            <div className="flex flex-col items-center text-center">
              <span className="font-semibold text-slate-500 mb-2">
                Objednatel převzal záruční list:
              </span>
              <div className="h-16 flex items-center justify-center">
                {contract.clientSignature ? (
                  <img
                    src={contract.clientSignature}
                    alt="Podpis objednatele"
                    className="max-h-14 max-w-44 object-contain"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSigningParty('client');
                      setIsSignModalOpen(true);
                    }}
                    className="no-print text-xs text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>Podepsat prstem</span>
                  </button>
                )}
              </div>
              <div className="w-48 border-b border-slate-400 mt-1 mb-1"></div>
              <span className="font-bold text-slate-900">{contract.client.name}</span>
              <span className="text-[11px] text-slate-400">
                v {contract.executionPlace || 'místě stavby'}, dne {formatDateCs(contract.clientSignatureDate || issueDate)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Modal */}
      {isSignModalOpen && (
        <SignatureModal
          isOpen={isSignModalOpen}
          onClose={() => setIsSignModalOpen(false)}
          onSave={handleSaveSignature}
          title={signingParty === 'contractor' ? 'Podpis zhotovitele na Záruční list' : 'Podpis objednatele (převzetí)'}
          signerName={signingParty === 'contractor' ? contract.contractor.name : contract.client.name}
          role={signingParty}
          initialSignature={signingParty === 'contractor' ? contract.contractorSignature : contract.clientSignature}
        />
      )}

      {/* Share Modal */}
      {isShareModalOpen && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          contract={contract}
          activeDocType="zaruka"
          onToast={onToast}
          onSignTokenCreated={(token) => {
            if (!contract.signToken) onUpdateContract({ ...contract, signToken: token });
          }}
        />
      )}
    </div>
  );
};
