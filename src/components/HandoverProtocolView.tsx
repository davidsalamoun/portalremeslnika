import React, { useRef, useState } from 'react';
import {
  FileCheck2,
  CheckCircle,
  AlertCircle,
  Calendar,
  PenTool,
  Camera,
  Image as ImageIcon,
} from 'lucide-react';
import { Contract, ContractPhoto } from '../types/contract';
import { formatDateCs, formatCurrency, formatPlaceWithPreposition } from '../utils/numberToWordsCs';
import { SignatureModal } from './SignatureModal';
import { PhotoDocumentation } from './PhotoDocumentation';
import { getContractorProfile, saveContractorProfile } from '../utils/storage';
import { triggerHaptic } from '../utils/haptics';
import { CraftsmanStamp } from './CraftsmanStamp';

interface HandoverProtocolViewProps {
  contract: Contract;
  onUpdateContract?: (updated: Contract) => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const HandoverProtocolView: React.FC<HandoverProtocolViewProps> = ({
  contract,
  onUpdateContract,
  onToast,
}) => {
  const paperRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'protokol' | 'fotky'>('protokol');
  // Stav protokolu se načte z uloženého předání (handoverData), pokud už dílo předáno bylo
  const [hasDefects, setHasDefectsState] = useState(contract.handoverData?.status === 's_vadami');
  const [defectsText, setDefectsText] = useState(
    contract.handoverData?.defectsNotes || 'Drobné zapravení silikonu kolem lišty (nebrání užívání).'
  );
  const [resolutionDate, setResolutionDateState] = useState(
    contract.handoverData?.resolutionTerm || contract.deliveryDate || new Date().toISOString().split('T')[0]
  );

  const buildHandoverData = (
    over: { hasDefects?: boolean; defectsText?: string; resolutionDate?: string; handoverDate?: string } = {}
  ): NonNullable<Contract['handoverData']> => {
    const withDefects = over.hasDefects ?? hasDefects;
    return {
      handoverDate:
        over.handoverDate || contract.handoverData?.handoverDate || new Date().toISOString().split('T')[0],
      status: withDefects ? 's_vadami' : 'bez_vad',
      defectsNotes: withDefects ? (over.defectsText ?? defectsText).trim() || undefined : undefined,
      resolutionTerm: withDefects ? over.resolutionDate ?? resolutionDate : undefined,
    };
  };

  // Úpravy po podpisu protokolu se ukládají hned; před podpisem je protokol jen rozpracovaný
  const persistIfHandedOver = (over: Parameters<typeof buildHandoverData>[0]) => {
    if (!contract.handoverData) return;
    onUpdateContract?.({ ...contract, handoverData: buildHandoverData(over) });
  };

  const setHasDefects = (value: boolean) => {
    setHasDefectsState(value);
    if (value !== hasDefects) persistIfHandedOver({ hasDefects: value });
  };

  const setResolutionDate = (value: string) => {
    setResolutionDateState(value);
    if (value !== resolutionDate) persistIfHandedOver({ resolutionDate: value });
  };
  const [signatureModalRole, setSignatureModalRole] = useState<'contractor' | 'client' | null>(null);

  const DEFECT_PRESETS = [
    'Drobné zapravení silikonu kolem lišty (nebrání užívání)',
    'Začištění přechodových lišt a tmelení rohových spár',
    'Lokální retuš malby po montáži osvětlení a krytek',
    'Finální úklid staveniště a likvidace zbytkových obalů',
  ];

  const handleApplyDefectPreset = (preset: string) => {
    setDefectsText(preset);
    persistIfHandedOver({ defectsText: preset });
    triggerHaptic('selection');
    onToast?.('info', 'Vložen popis vady');
  };

  const handleSetResolutionDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setResolutionDate(d.toISOString().split('T')[0]);
    triggerHaptic('selection');
  };

  const handoverDate =
    contract.handoverData?.handoverDate || contract.deliveryDate || new Date().toISOString().split('T')[0];
  const place = contract.executionPlace || contract.contractor.defaultPlace || 'v místě plnění';
  const photos = contract.photos || [];

  const handlePhotosChange = (updatedPhotos: ContractPhoto[]) => {
    const updated: Contract = {
      ...contract,
      photos: updatedPhotos,
    };
    onUpdateContract?.(updated);
  };

  const handleSaveSignature = (signatureDataUrl: string, saveAsDefaultContractor?: boolean) => {
    const today = new Date().toISOString().split('T')[0];
    const isContr = signatureModalRole === 'contractor';
    const updated: Contract = {
      ...contract,
      ...(isContr
        ? {
            contractorSignature: signatureDataUrl,
            contractorSignatureDate: today,
          }
        : {
            clientSignature: signatureDataUrl,
            clientSignatureDate: today,
          }),
      status: 'handover_done',
      // Podpisem se předání uloží (datum, stav, vady) – čte ho záruční list i složka zakázky
      handoverData: buildHandoverData({ handoverDate: contract.handoverData?.handoverDate || today }),
    };

    onUpdateContract?.(updated);
    onToast?.(
      'success',
      `Podpis ${isContr ? 'zhotovitele' : 'objednatele'} byl úspěšně zaznamenán do protokolu`
    );

    if (saveAsDefaultContractor && isContr) {
      const prof = getContractorProfile();
      if (prof) {
        saveContractorProfile({ ...prof, signature: signatureDataUrl });
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Ovládací lišta protokolu */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs no-print transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
            <FileCheck2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Předávací protokol k dílu</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Právní doklad o převzetí zakázky a zahájení běhu 24měsíční záruky
            </p>
          </div>
        </div>

        {/* Přepínač Protokol / Fotodokumentace */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setActiveTab('protokol')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                activeTab === 'protokol'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Dokument A4</span>
            </button>
            <button
              onClick={() => setActiveTab('fotky')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                activeTab === 'fotky'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Fotodokumentace ({photos.length})</span>
            </button>
          </div>

          {activeTab === 'protokol' && (
            <div className="flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setHasDefects(false)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  !hasDefects ? 'bg-white dark:bg-slate-900 shadow-xs text-emerald-800 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Bez vad
              </button>
              <button
                type="button"
                onClick={() => setHasDefects(true)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  hasDefects ? 'bg-white dark:bg-slate-900 shadow-xs text-amber-800 dark:text-amber-300' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                S vadami
              </button>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'fotky' ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#1E3A78] dark:text-blue-400" />
                <span>Fotodokumentace díla (Příloha k předávacímu protokolu)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Vyfoťte stav před započetím a po dokončení prací. Fotografie se automaticky uloží k zakázce.
              </p>
            </div>
          </div>
          <PhotoDocumentation
            photos={photos}
            onChange={handlePhotosChange}
            onToast={onToast}
          />
        </div>
      ) : (
        /* A4 list protokolu */
        <div
          ref={paperRef}
          className="contract-page bg-white shadow-xl rounded-sm p-8 sm:p-14 border border-slate-200 text-slate-900 font-serif-contract text-sm leading-relaxed select-text"
          style={{
            minHeight: '297mm',
            width: '100%',
            maxWidth: '210mm',
            margin: '0 auto',
            boxSizing: 'border-box',
          }}
        >
          {/* Nadpis */}
          <div className="text-center pb-6 mb-6 border-b border-slate-300">
            <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-wider text-black">
              PŘEDÁVACÍ PROTOKOL K DÍLU
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              k Smlouvě o dílo č. <strong>{contract.contractNumber}</strong> ze dne {formatDateCs(contract.conclusionDate)}
            </p>
          </div>

          {/* Smluvní strany zkráceně */}
          <div className="grid grid-cols-2 gap-6 pb-6 mb-6 border-b border-slate-200 text-xs">
            <div>
              <p className="font-bold text-black uppercase mb-1">Zhotovitel:</p>
              <p className="font-semibold text-slate-900">{contract.contractor.name}</p>
              <p className="text-slate-700">{contract.contractor.address}</p>
              <p className="text-slate-700">IČO: {contract.contractor.ico}</p>
            </div>
            <div>
              <p className="font-bold text-black uppercase mb-1">Objednatel:</p>
              <p className="font-semibold text-slate-900">{contract.client.name}</p>
              <p className="text-slate-700">{contract.client.address}</p>
              {contract.client.ico && <p className="text-slate-700">IČO: {contract.client.ico}</p>}
            </div>
          </div>

          {/* Obsah protokolu */}
          <div className="space-y-6 text-xs text-slate-900">
            {/* 1. Předmět předání */}
            <div>
              <h3 className="font-bold text-black uppercase text-xs mb-1">1. Předmět předání díla</h3>
              <p className="text-slate-800 leading-normal">
                Zhotovitel dnešního dne předává a objednatel přejímá dokončené dílo sjednané ve smlouvě o dílo:
              </p>
              <div className="bg-slate-50 p-3 rounded-sm border border-slate-200 my-2 italic text-slate-800">
                {contract.workDescription}
              </div>
            </div>

            {/* 2. Stav díla a vady */}
            <div>
              <h3 className="font-bold text-black uppercase text-xs mb-1">2. Stav díla a kontrola jakosti</h3>
              <div className="space-y-2 mt-1">
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-xs border border-slate-400 flex items-center justify-center shrink-0 mt-0.5">
                    {!hasDefects && <span className="text-black font-bold text-xs">✓</span>}
                  </div>
                  <div>
                    <span className="font-semibold text-black">
                      Dílo je provedeno řádně, kvalitně a bez zjevných vad a nedodělků.
                    </span>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Objednatel prohlašuje, že si dílo řádně prohlédl a přejímá jej bez výhrad.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-xs border border-slate-400 flex items-center justify-center shrink-0 mt-0.5">
                    {hasDefects && <span className="text-black font-bold text-xs">✓</span>}
                  </div>
                  <div>
                    <span className="font-semibold text-black">
                      Dílo se přejímá s následujícími drobnými vadami a nedodělky nebránícími užívání:
                    </span>
                    {hasDefects && (
                      <div className="mt-1.5 p-2 bg-amber-50/70 border border-amber-200 rounded-sm">
                        {/* 1-klik rychlé předvolby vad */}
                        <div className="flex flex-wrap items-center gap-1 mb-1.5 no-print">
                          <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider mr-1">Rychlý vzor:</span>
                          {DEFECT_PRESETS.map((p, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleApplyDefectPreset(p)}
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 transition-colors cursor-pointer"
                              title={p}
                            >
                              {p.split(' ')[0]} {p.split(' ')[1]}…
                            </button>
                          ))}
                        </div>

                        <textarea
                          value={defectsText}
                          onChange={(e) => setDefectsText(e.target.value)}
                          onBlur={() => {
                            if ((contract.handoverData?.defectsNotes || '') !== defectsText.trim()) {
                              persistIfHandedOver({ defectsText });
                            }
                          }}
                          className="w-full text-xs bg-transparent border-0 focus:outline-hidden p-0 resize-none font-serif-contract"
                          rows={2}
                        />

                        <div className="text-[11px] text-amber-900 mt-1 flex flex-wrap items-center gap-1.5">
                          <span>Termín odstranění vad zhotovitelem do: </span>
                          <input
                            type="date"
                            value={resolutionDate}
                            onChange={(e) => setResolutionDate(e.target.value)}
                            className="text-xs bg-white border border-amber-300 rounded px-1 py-0.5"
                          />
                          <div className="flex items-center gap-1 no-print ml-1">
                            <button
                              type="button"
                              onClick={() => handleSetResolutionDays(3)}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 transition-colors cursor-pointer"
                            >
                              +3 dny
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetResolutionDays(7)}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 transition-colors cursor-pointer"
                            >
                              +1 týden
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetResolutionDays(14)}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 transition-colors cursor-pointer"
                            >
                              +14 dní
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Záruční doba */}
            <div>
              <h3 className="font-bold text-black uppercase text-xs mb-1">3. Záruka za jakost</h3>
              <p className="text-xs">
                Dnem podpisu tohoto protokolu oběma smluvními stranami začíná běžet sjednaná záruční doba v délce{' '}
                <strong>24 měsíců</strong>. Zhotovitel předal objednateli případné návody k obsluze a údržbě použitých materiálů.
              </p>
            </div>

            {/* 4. Finanční vypořádání */}
            <div>
              <h3 className="font-bold text-black uppercase text-xs mb-1">4. Finanční ujednání</h3>
              <p className="text-xs">
                Sjednaná konečná cena za dílo činí <strong>{formatCurrency(contract.price)}</strong>{' '}
                ({contract.contractor.dic ? 'včetně DPH' : 'zhotovitel není plátcem DPH'}).
                Objednatel se zavazuje uhradit konečnou fakturu vystavenou zhotovitelem ve sjednané lhůtě splatnosti 14 dnů.
              </p>
            </div>

            {/* Fotodokumentace náhled v protokolu */}
            {photos.length > 0 && (
              <div className="pt-2">
                <h3 className="font-bold text-black uppercase text-xs mb-2">
                  5. Příloha: Fotodokumentace díla ({photos.length} foto)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {photos.slice(0, 4).map((p) => (
                    <div key={p.id} className="border border-slate-200 rounded-sm overflow-hidden bg-slate-50 p-1">
                      <img src={p.dataUrl} alt={p.caption} className="w-full h-20 object-cover" />
                      <p className="text-[9px] text-slate-700 truncate mt-1">{p.caption}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Datum a Podpisy */}
          <div className="mt-10 pt-4 border-t border-slate-200">
            <p className="font-semibold text-xs text-black mb-6">
              {formatPlaceWithPreposition(place)} dne {formatDateCs(handoverDate)}
            </p>

            <div className="grid grid-cols-2 gap-8 text-center pt-2">
              {/* Zhotovitel */}
              <div className="flex flex-col items-center relative">
                <p className="font-bold text-xs text-black mb-2">Dílo předal (Zhotovitel):</p>
                <div className="relative flex flex-col items-center justify-end min-h-16 mb-2 w-full">
                  <div className="absolute -top-6 -right-2 sm:-right-6 opacity-85 pointer-events-none">
                    <CraftsmanStamp contractor={contract.contractor} size="sm" />
                  </div>
                  {contract.contractorSignature ? (
                    <div className="flex flex-col items-center justify-end h-16 z-10">
                      <img
                        src={contract.contractorSignature}
                        alt="Podpis zhotovitele"
                        className="max-h-12 max-w-40 object-contain"
                      />
                      <span className="text-[9px] text-slate-500 font-sans">
                        ✓ Podepsáno digitálně
                      </span>
                    </div>
                  ) : (
                    <div className="h-16 flex items-center justify-center z-10">
                      <button
                        type="button"
                        onClick={() => setSignatureModalRole('contractor')}
                        className="no-print inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-[#1E3A78] text-[11px] font-semibold border border-blue-200 transition-colors cursor-pointer"
                      >
                        <PenTool className="w-3 h-3" />
                        <span>Podepsat předání</span>
                      </button>
                    </div>
                  )}
                </div>
                <div className="border-t-2 border-dotted border-slate-400 w-44 mx-auto pt-1.5 z-10">
                  <p className="text-xs font-bold text-slate-900">{contract.contractor.name}</p>
                  <p className="text-[10px] text-slate-500 font-sans tracking-wide">(podpis zhotovitele)</p>
                </div>
              </div>

              {/* Objednatel */}
              <div className="flex flex-col items-center">
                <p className="font-bold text-xs text-black mb-2">Dílo převzal (Objednatel):</p>
                {contract.clientSignature ? (
                  <div className="flex flex-col items-center justify-end h-16 mb-2">
                    <img
                      src={contract.clientSignature}
                      alt="Podpis objednatele"
                      className="max-h-12 max-w-40 object-contain"
                    />
                    <span className="text-[9px] text-slate-500 font-sans">
                      ✓ Podepsáno digitálně
                    </span>
                  </div>
                ) : (
                  <div className="h-16 flex items-center justify-center mb-2">
                    <button
                      type="button"
                      onClick={() => setSignatureModalRole('client')}
                      className="no-print inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-[#1E3A78] text-[11px] font-semibold border border-blue-200 transition-colors cursor-pointer"
                    >
                      <PenTool className="w-3 h-3" />
                      <span>Podepsat převzetí</span>
                    </button>
                  </div>
                )}
                <div className="border-t-2 border-dotted border-slate-400 w-44 mx-auto pt-1.5">
                  <p className="text-xs font-bold text-slate-900">{contract.client.name}</p>
                  <p className="text-[10px] text-slate-500 font-sans tracking-wide">(podpis objednatele)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      <SignatureModal
        isOpen={signatureModalRole !== null}
        title={
          signatureModalRole === 'contractor'
            ? 'Podpis předání díla (Zhotovitel)'
            : 'Podpis převzetí díla (Objednatel)'
        }
        signerName={
          signatureModalRole === 'contractor'
            ? contract.contractor.name
            : contract.client.name
        }
        role={signatureModalRole || 'client'}
        initialSignature={
          signatureModalRole === 'contractor'
            ? contract.contractorSignature
            : contract.clientSignature
        }
        savedContractorSignature={getContractorProfile()?.signature}
        onSave={handleSaveSignature}
        onClose={() => setSignatureModalRole(null)}
      />
    </div>
  );
};
