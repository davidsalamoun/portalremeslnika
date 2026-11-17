import React, { useState, useEffect, useRef } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { getPublicSignShare, submitRemoteClientSignature } from '../utils/signShares';
import { Contract } from '../types/contract';
import { formatCurrency, formatDateCs } from '../utils/numberToWordsCs';
import { getStoredContracts, addStoredContract } from '../utils/storage';
import { Dialog } from './Dialog';
import { ContractBody } from './ContractBody';
import { PrivacyLink } from './PrivacyPolicy';

interface RemoteSigningPortalProps {
  shareId: string;
  onBackToApp?: () => void;
}

export const RemoteSigningPortal: React.FC<RemoteSigningPortalProps> = ({
  shareId,
  onBackToApp,
}) => {
  const [contract, setContract] = useState<Contract | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Signature pad
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isTextOpen, setIsTextOpen] = useState(false);
  const [areItemsOpen, setAreItemsOpen] = useState(false);
  // Odkaz načtený z tohoto zařízení (zhotovitel si ho otevřel sám) nese celou smlouvu vždy
  const [isLocalCopy, setIsLocalCopy] = useState(false);

  useEffect(() => {
    async function loadShare() {
      setIsLoading(true);
      setError(null);
      try {
        const share = await getPublicSignShare(shareId);
        if (!share) {
          // Zkusit načíst z lokálního úložiště (pokud byl odkaz otevřen na zařízení řemeslníka)
          const localList = getStoredContracts();
          const found = localList.find((c) => c.signToken === shareId);
          if (found) {
            setContract(found);
            setIsLocalCopy(true);
            setSignerName(found.client?.name || '');
            if (found.clientSignature) {
              setIsSuccess(true);
            }
            setIsLoading(false);
            return;
          }
          throw new Error('Smlouva k podpisu nebyla nalezena nebo odkaz vypršel.');
        }

        if (share.status === 'signed') {
          setIsSuccess(true);
        }
        setContract(share.contract);
        setSignerName(share.contract.client?.name || share.signerName || '');
      } catch (err: any) {
        console.error(err);
        setError(
          typeof err?.message === 'string' && err.message.startsWith('Smlouva k podpisu')
            ? err.message
            : 'Nepodařilo se načíst smlouvu. Zkontrolujte připojení k internetu a zkuste to znovu.'
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadShare();
  }, [shareId]);

  // Canvas drawing handlers (mouse & touch)
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(((clientX - rect.left) * canvas.width) / rect.width, ((clientY - rect.top) * canvas.height) / rect.height);
    setIsDrawing(true);
    setFormError(null);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(((clientX - rect.left) * canvas.width) / rect.width, ((clientY - rect.top) * canvas.height) / rect.height);
    ctx.strokeStyle = '#1E3A78';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSubmitSignature = async () => {
    setFormError(null);
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) {
      setFormError('Prosím podepište se do rámečku.');
      return;
    }
    if (!signerName.trim()) {
      setFormError('Zadejte prosím své jméno a příjmení.');
      return;
    }

    setIsSubmitting(true);
    try {
      const signatureDataUrl = canvas.toDataURL('image/png');
      const result = await submitRemoteClientSignature(shareId, signatureDataUrl, signerName);
      if (result === 'already_signed') {
        setIsSuccess(true);
        return;
      }
      if (result !== 'signed') {
        setFormError(
          result === 'invalid'
            ? 'Podpis se nepodařilo zpracovat. Zkuste se prosím podepsat znovu.'
            : 'Smlouva k podpisu nebyla nalezena nebo odkaz vypršel. Požádejte prosím o nový odkaz.'
        );
        return;
      }

      const signDate = new Date().toISOString().split('T')[0];

      // Aktualizovat i v lokálním úložišti zhotovitele (pokud je na stejném zařízení)
      const localList = getStoredContracts();
      const existing = localList.find((c) => c.signToken === shareId);
      if (existing) {
        const updated: Contract = {
          ...existing,
          clientSignature: signatureDataUrl,
          clientSignatureDate: signDate,
          status: 'signed' as const,
        };
        addStoredContract(updated);
      }

      // Aktualizovat stav i v tomto okně
      setContract((prev) =>
        prev
          ? {
              ...prev,
              clientSignature: signatureDataUrl,
              clientSignatureDate: signDate,
              status: 'signed' as const,
            }
          : prev
      );

      // Notifikovat ostatní otevřené záložky v prohlížeči
      try {
        window.dispatchEvent(
          new CustomEvent('contract-signed-locally', {
            detail: { id: existing?.id || contract?.id || shareId, signature: signatureDataUrl, date: signDate, signerName },
          })
        );
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        console.warn('Dispatch failed', e);
      }

      setIsSuccess(true);
    } catch (err: any) {
      console.error(err);
      setFormError('Podpis se nepodařilo odeslat. Zkontrolujte připojení k internetu a zkuste to prosím znovu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const page = 'min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-[15px] leading-snug';
  const card = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md';
  const muted = 'text-slate-600 dark:text-slate-400';
  const link = 'min-h-11 inline-flex items-center font-medium text-blue-600 dark:text-blue-300 underline underline-offset-2 cursor-pointer';

  if (isLoading) {
    return (
      <div className={`${page} flex items-center justify-center p-6`} role="status">
        <p className={muted}>Načítám dokument k podpisu…</p>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className={`${page} flex items-center justify-center p-4`}>
        <div className={`${card} max-w-md w-full p-6 space-y-3`}>
          <h1 className="text-2xl font-semibold">Odkaz nejde otevřít</h1>
          <p className={muted}>{error || 'Tento dokument už není dostupný.'}</p>
          <p className={muted}>Požádejte prosím zhotovitele o nový odkaz.</p>
          {onBackToApp && (
            <button type="button" onClick={onBackToApp} className={link}>
              Jsem zhotovitel, přejít do aplikace
            </button>
          )}
        </div>
      </div>
    );
  }

  const isQuote = contract.docKind === 'quote';
  const docName = isQuote ? 'Cenová nabídka' : 'Smlouva o dílo';
  const docNumber = isQuote ? contract.quoteNumber || contract.contractNumber : contract.contractNumber;
  // Celé znění jde ukázat jen u smlouvy a jen když odkaz nese všechny údaje, které text smlouvy potřebuje
  const hasFullText = !isQuote && (isLocalCopy || (contract as { shareVersion?: number }).shareVersion === 2);
  const items = contract.items || [];
  const rows: { label: string; value: string }[] = [
    ...(contract.advanceAmount ? [{ label: 'Záloha', value: formatCurrency(contract.advanceAmount) }] : []),
    ...(contract.deliveryDate ? [{ label: 'Dokončení', value: formatDateCs(contract.deliveryDate) }] : []),
    { label: 'Zhotovitel', value: [contract.contractor?.name, contract.contractor?.ico ? `IČO ${contract.contractor.ico}` : ''].filter(Boolean).join(', ') },
    { label: 'Objednatel', value: contract.client?.name || '' },
  ];

  return (
    <div className={page}>
      <header className="bg-blue-600 text-white">
        <div className="max-w-xl mx-auto px-4 py-5">
          <p className="text-blue-100">{contract.contractor?.name} vám posílá k podpisu</p>
          <h1 className="font-display font-bold text-3xl leading-tight mt-0.5 text-white">{docName}</h1>
          <p className="mt-1.5">
            č. {docNumber}
            {contract.workDescription ? ` · ${contract.workDescription}` : ''}
          </p>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-5 space-y-4">
        <div className={card}>
          <div className="px-4 py-4 border-b-[1.5px] border-slate-900 dark:border-slate-500">
            <div className="font-display font-bold text-[38px] leading-none tabular-nums">{formatCurrency(contract.price)}</div>
            <div className={`mt-1.5 ${muted}`}>
              {isQuote ? 'nabízená cena' : 'cena díla'}, {contract.hasVat ? 'včetně DPH' : 'zhotovitel není plátce DPH'}
            </div>
          </div>
          <dl className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row) => (
              <div key={row.label} className="px-4 py-3 flex items-baseline justify-between gap-4">
                <dt className={muted}>{row.label}</dt>
                <dd className="font-semibold text-right">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {(items.length > 0 || hasFullText) && (
          <div className={`${card} divide-y divide-slate-100 dark:divide-slate-800`}>
            {items.length > 0 && (
              <div>
                <div className="px-4 py-1.5 flex items-center justify-between gap-4">
                  <span>Položky rozpočtu ({items.length})</span>
                  <button type="button" aria-expanded={areItemsOpen} onClick={() => setAreItemsOpen(!areItemsOpen)} className={link}>
                    {areItemsOpen ? 'Skrýt' : 'Zobrazit'}
                  </button>
                </div>
                {areItemsOpen && (
                  <ul className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((it) => (
                      <li key={it.id} className="px-4 py-2.5 flex items-baseline justify-between gap-4">
                        <span>
                          {it.title} <span className={muted}>({it.quantity} {it.unit})</span>
                        </span>
                        <span className="font-semibold tabular-nums whitespace-nowrap">{formatCurrency(it.totalPrice)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {hasFullText && (
              <div className="px-4 py-1.5 flex items-center justify-between gap-4">
                <span className="font-semibold">Celé znění smlouvy</span>
                <button type="button" onClick={() => setIsTextOpen(true)} className={link}>
                  Přečíst
                </button>
              </div>
            )}
          </div>
        )}

        {isSuccess ? (
          <div className={`${card} p-5 flex items-start gap-4`} role="status">
            <span className="w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-full bg-emerald-700 text-white">
              <Check className="w-5 h-5" />
            </span>
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">Podepsáno</h2>
              <p className={muted}>
                Děkujeme, váš podpis má zhotovitel k dispozici. O kopii podepsaného dokumentu požádejte jeho.
              </p>
            </div>
          </div>
        ) : (
          <section aria-labelledby="podpis-nadpis" className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="podpis-nadpis" className="text-2xl font-semibold">
                Váš podpis
              </h2>
              {hasSignature && (
                <button type="button" onClick={clearSignature} className={`${link} gap-1.5`}>
                  <RotateCcw className="w-4 h-4" />
                  <span>Smazat a začít znovu</span>
                </button>
              )}
            </div>

            <div className="relative touch-none rounded-md border-[1.5px] border-slate-900 dark:border-slate-400 bg-white overflow-hidden">
              <canvas
                ref={canvasRef}
                width={1000}
                height={320}
                aria-label="Plocha pro podpis"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-40 cursor-crosshair block"
              />
              <div className="absolute left-4 right-4 bottom-9 border-b-[1.5px] border-dotted border-slate-400 pointer-events-none" />
              {!hasSignature && (
                <div className="absolute left-4 bottom-2.5 text-slate-600 text-[13px] pointer-events-none">Podepište se prstem nebo myší</div>
              )}
            </div>

            <div>
              <label htmlFor="podpis-jmeno" className="block font-semibold mb-1.5">
                Jméno a příjmení
              </label>
              <input
                id="podpis-jmeno"
                type="text"
                autoComplete="name"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                className="w-full min-h-12 px-3 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            {formError && (
              <p role="alert" className="font-medium text-rose-700 dark:text-rose-400">
                {formError}
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmitSignature}
              disabled={isSubmitting}
              className="w-full min-h-[52px] px-4 inline-flex items-center justify-center rounded-md border-[1.5px] border-slate-900 bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold text-base cursor-pointer transition-colors disabled:opacity-60"
            >
              {isSubmitting ? 'Odesílám podpis…' : isQuote ? 'Podepsat nabídku' : 'Podepsat smlouvu'}
            </button>

            <p className={`text-[13px] ${muted}`}>
              {hasFullText
                ? 'Podpisem potvrzujete, že jste se seznámili s celým zněním smlouvy a souhlasíte s ním.'
                : 'Podpisem potvrzujete, že souhlasíte s rozsahem prací, cenou a termínem uvedenými výše.'}
            </p>
          </section>
        )}

        <p className={`text-[13px] ${muted}`}>
          Jak se zachází s vašimi údaji:{' '}
          <PrivacyLink className="text-blue-600 dark:text-blue-300 underline underline-offset-2">ochrana osobních údajů</PrivacyLink>
        </p>

        {onBackToApp && (
          <p className="pt-2">
            <button type="button" onClick={onBackToApp} className={`${link} text-[13px]`}>
              Jsem zhotovitel, přejít do aplikace
            </button>
          </p>
        )}
      </main>

      {isTextOpen && (
        <Dialog title="Znění smlouvy" size="2xl" onClose={() => setIsTextOpen(false)}>
          <div className="contract-page font-serif-contract bg-white text-slate-900 leading-relaxed text-[15px] p-4 sm:p-8 border border-slate-200">
            <ContractBody contract={contract} />
          </div>
        </Dialog>
      )}
    </div>
  );
};
