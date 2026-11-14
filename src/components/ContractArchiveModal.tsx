import React from 'react';
import {
  FolderArchive,
  X,
  Printer,
  Download,
  Share2,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Gauge,
  Camera,
  Banknote,
  Receipt,
  User,
  MapPin,
  Calendar,
  Building2,
} from 'lucide-react';
import { Contract } from '../types/contract';
import {
  formatCurrency,
  formatDateCs,
  formatSignedCurrency,
} from '../utils/numberToWordsCs';
import { getWhatsAppShareUrl } from '../utils/shareUtils';
import { triggerHaptic } from '../utils/haptics';

interface ContractArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const ContractArchiveModal: React.FC<ContractArchiveModalProps> = ({
  isOpen,
  onClose,
  contract,
  onToast,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    triggerHaptic('impact');
    window.print();
  };

  // Export self-contained offline HTML dossier
  const handleExportHtml = () => {
    try {
      const htmlContent = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <title>Složka zakázky ${contract.contractNumber} - ${contract.client.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #1e293b; max-width: 900px; margin: 40px auto; padding: 20px; }
    h1, h2, h3 { color: #0f172a; margin-top: 1.5em; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    .badge { display: inline-block; padding: 4px 10px; background: #e0e7ff; color: #3730a3; font-weight: bold; border-radius: 9999px; font-size: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
    .card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
    th { background: #f1f5f9; }
    .photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 15px 0; }
    .photo-item { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .photo-item img { width: 100%; height: 160px; object-fit: cover; }
    .footer { margin-top: 50px; font-size: 12px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; }
    @media print { body { margin: 0; padding: 15mm; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div style="display: flex; justify-content: space-between; align-items: center;">
    <div>
      <span class="badge">KOMPLETNÍ ARCHIVNÍ SLOŽKA ZAKÁZKY</span>
      <h1 style="border: none; margin: 8px 0 0 0;">Zakázka č. ${contract.contractNumber}</h1>
      <p style="color: #64748b; margin: 0;">Místo plnění: ${contract.executionPlace || 'Není specifikováno'} · Datum: ${formatDateCs(contract.conclusionDate || contract.createdAt)}</p>
    </div>
    <div style="text-align: right;">
      <h2 style="border: none; margin: 0; color: #1e3a78;">${formatCurrency(contract.price)}</h2>
      <span style="font-size: 12px; color: #64748b;">${contract.hasVat ? 'včetně DPH' : 'neplátce DPH'}</span>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <h3 style="margin-top: 0; border: none;">Zhotovitel</h3>
      <strong>${contract.contractor?.name}</strong><br>
      IČO: ${contract.contractor?.ico}<br>
      Sídlo: ${contract.contractor?.address}<br>
      Tel: ${contract.contractor?.phone} · E-mail: ${contract.contractor?.email}
    </div>
    <div class="card">
      <h3 style="margin-top: 0; border: none;">Objednatel</h3>
      <strong>${contract.client.name}</strong><br>
      ${contract.client.ico ? `IČO: ${contract.client.ico}<br>` : ''}
      Adresa: ${contract.client.address}<br>
      Tel: ${contract.client.phone || '-'} · E-mail: ${contract.client.email || '-'}
    </div>
  </div>

  <h2>1. Předmět díla & Rozpočet</h2>
  <p>${contract.workDescription}</p>

  ${contract.items && contract.items.length > 0 ? `
    <table>
      <thead>
        <tr><th>Položka</th><th>Množství</th><th>Jedn. cena</th><th>Celkem</th></tr>
      </thead>
      <tbody>
        ${contract.items.map(it => `<tr><td>${it.title}</td><td>${it.quantity} ${it.unit}</td><td>${formatCurrency(it.unitPrice)}</td><td>${formatCurrency(it.totalPrice)}</td></tr>`).join('')}
      </tbody>
    </table>
  ` : ''}

  ${contract.amendments && contract.amendments.length > 0 ? `
    <h2>2. Schválené dodatky a vícepráce</h2>
    <table>
      <thead><tr><th>Dodatek č.</th><th>Popis změny</th><th>Cena víceprací</th><th>Nový termín</th></tr></thead>
      <tbody>
        ${contract.amendments.map(a => `<tr><td>${a.amendmentNumber}</td><td>${a.description}</td><td>${formatCurrency(a.priceDifference)}</td><td>${a.newDeliveryDate ? formatDateCs(a.newDeliveryDate) : '-'}</td></tr>`).join('')}
      </tbody>
    </table>
  ` : ''}

  ${contract.handoverData ? `
    <h2>3. Předávací protokol</h2>
    <div class="card">
      <p><strong>Datum předání:</strong> ${formatDateCs(contract.handoverData.handoverDate || contract.deliveryDate)}</p>
      <p><strong>Stav předání:</strong> ${contract.handoverData.status === 's_vadami' ? 'Předáno s vadami a nedodělky' : 'Předáno řádně bez zjevných vad a nedodělků'}</p>
      ${contract.handoverData.defectsNotes ? `<p><strong>Soupis vad:</strong> ${contract.handoverData.defectsNotes}</p>` : ''}
    </div>
  ` : ''}

  ${contract.technicalProtocols && contract.technicalProtocols.length > 0 ? `
    <h2>4. Technické zkoušky a protokoly ČSN</h2>
    <table>
      <thead><tr><th>Typ zkoušky</th><th>ČSN norma</th><th>Datum</th><th>Výsledek</th></tr></thead>
      <tbody>
        ${contract.technicalProtocols.map(tp => `<tr><td>${tp.title}</td><td>${tp.standard}</td><td>${formatDateCs(tp.date)}</td><td><strong>${tp.result === 'vyhovuje' ? 'VYHOVUJE' : 'NEVYHOVUJE'}</strong></td></tr>`).join('')}
      </tbody>
    </table>
  ` : ''}

  ${contract.photos && contract.photos.length > 0 ? `
    <h2>5. Fotodokumentace (${contract.photos.length} fotografií)</h2>
    <div class="photo-grid">
      ${contract.photos.map(p => `
        <div class="photo-item">
          <img src="${p.dataUrl}" alt="${p.caption || 'Foto'}">
          <div style="padding: 6px; font-size: 11px; background: #fff;">
            <strong>${p.category === 'before' ? 'Před zahájením' : p.category === 'after' ? 'Po dokončení' : 'V průběhu'}</strong>: ${p.caption || ''}
          </div>
        </div>
      `).join('')}
    </div>
  ` : ''}

  <div class="footer">
    Vygenerováno v aplikaci Řemeslník PRO · Kompletní složka zakázky byla archivována dne ${new Date().toLocaleDateString('cs-CZ')}.
  </div>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Slozka_zakazky_${contract.contractNumber}_${contract.client.name.replace(/[^a-zA-Z0-9]/g, '_')}.html`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      triggerHaptic('success');
      if (onToast) onToast('success', 'Kompletní složka zakázky byla stažena jako samostatný HTML archiv.');
    } catch (e) {
      console.error(e);
      if (onToast) onToast('error', 'Nepodařilo se vygenerovat archiv zakázky.');
    }
  };

  const amendmentsCount = (contract.amendments || []).length;
  const protocolsCount = (contract.technicalProtocols || []).length;
  const photosCount = (contract.photos || []).length;
  const receiptsCount = (contract.cashReceipts || []).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-4xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header - Industrial Digital Dossier */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400 text-slate-950">
                  Digitální šanon
                </span>
                <span className="text-xs px-2 py-0.5 rounded font-mono font-semibold bg-slate-900 text-slate-300 border border-slate-800">
                  #{contract.contractNumber}
                </span>
              </div>
              <h3 className="font-black text-base sm:text-lg leading-tight text-white mt-0.5">
                Kompletní složka a archiv zakázky
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="h-9 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-all"
              title="Vytisknout celou složku do PDF"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Tisk do PDF</span>
            </button>
            <button
              onClick={handleExportHtml}
              className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
              title="Stáhnout jako offline HTML soubor"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Stáhnout složku</span>
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg hover:bg-white/10 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body - Printable Archival Dossier */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 text-slate-800 dark:text-slate-100 print:p-0">
          {/* Status banner */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-3xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                Souhrnná digitální složka díla
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {contract.workDescription.substring(0, 90)}...
              </h2>
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" />
                <span>{contract.executionPlace || 'Místo neuvedeno'}</span>
                <span>·</span>
                <Calendar className="w-3.5 h-3.5" />
                <span>Termín: {formatDateCs(contract.deliveryDate)}</span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-400 font-semibold block">Smluvní cena díla</span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {formatCurrency(contract.price)}
              </div>
              <span className="text-3xs font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                {contract.status === 'handover_done' || contract.status === 'paid' ? 'Dokončeno a archivováno' : 'V realizaci'}
              </span>
            </div>
          </div>

          {/* Smluvní strany */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1.5">
              <span className="text-3xs font-black uppercase tracking-wider text-slate-400 block">
                Zhotovitel
              </span>
              <div className="font-extrabold text-slate-900 dark:text-white text-base">
                {contract.contractor?.name}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
                <div>IČO: {contract.contractor?.ico} {contract.contractor?.dic ? `· DIČ: ${contract.contractor?.dic}` : ''}</div>
                <div>{contract.contractor?.address}</div>
                <div>Tel: {contract.contractor?.phone} · {contract.contractor?.email}</div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1.5">
              <span className="text-3xs font-black uppercase tracking-wider text-slate-400 block">
                Objednatel
              </span>
              <div className="font-extrabold text-slate-900 dark:text-white text-base">
                {contract.client.name}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
                {contract.client.ico && <div>IČO: {contract.client.ico}</div>}
                <div>{contract.client.address}</div>
                <div>Tel: {contract.client.phone || '-'} · {contract.client.email || '-'}</div>
              </div>
            </div>
          </div>

          {/* Obsah složky zakázky (Checklist složky) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2.5">
              Obsah kompletního spisu zakázky:
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Smlouva o dílo</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${contract.handoverData ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>Předávací protokol</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${protocolsCount > 0 ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>Zkoušky ČSN ({protocolsCount})</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${photosCount > 0 ? 'text-emerald-600' : 'text-slate-300'}`} />
                <span>Fotodokumentace ({photosCount})</span>
              </div>
            </div>
          </div>

          {/* 1. Položkový rozpočet */}
          {contract.items && contract.items.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Položkový rozpočet díla</span>
              </h3>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200">
                    <tr>
                      <th className="p-3">Položka / práce</th>
                      <th className="p-3 text-center">Množství</th>
                      <th className="p-3 text-right">Cena/jedn.</th>
                      <th className="p-3 text-right">Celkem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {contract.items.map((it) => (
                      <tr key={it.id}>
                        <td className="p-3 font-medium">{it.title}</td>
                        <td className="p-3 text-center">{it.quantity} {it.unit}</td>
                        <td className="p-3 text-right">{formatCurrency(it.unitPrice)}</td>
                        <td className="p-3 text-right font-bold">{formatCurrency(it.totalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 2. Schválené dodatky na vícepráce */}
          {contract.amendments && contract.amendments.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Schválené dodatky a vícepráce ({contract.amendments.length})</span>
              </h3>
              <div className="space-y-2">
                {contract.amendments.map((a) => (
                  <div key={a.id} className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        Dodatek č. {a.amendmentNumber}
                      </div>
                      <div className="text-slate-600 dark:text-slate-300">{a.description}</div>
                    </div>
                    <div className="text-right font-extrabold text-amber-700 dark:text-amber-300">
                      {formatSignedCurrency(a.priceDifference)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Technické protokoly ČSN */}
          {contract.technicalProtocols && contract.technicalProtocols.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Gauge className="w-4 h-4 text-sky-600" />
                <span>Protokoly odborných technických zkoušek ČSN</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {contract.technicalProtocols.map((tp) => (
                  <div key={tp.id} className="p-3.5 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/30 dark:bg-sky-950/20 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white">{tp.title}</span>
                      <span className="text-3xs font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider bg-emerald-600 text-white">
                        {tp.result === 'vyhovuje' ? 'VYHOVUJE' : 'NEVYHOVUJE'}
                      </span>
                    </div>
                    <div className="text-slate-500 font-mono text-2xs">{tp.standard} · {formatDateCs(tp.date)}</div>
                    {tp.testPressureBar && (
                      <div className="text-slate-700 dark:text-slate-300">
                        Zkušební tlak: <strong>{tp.testPressureBar} bar</strong> po dobu {tp.testDurationMinutes || 30} min
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Fotodokumentace */}
          {contract.photos && contract.photos.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Camera className="w-4 h-4 text-purple-600" />
                <span>Fotodokumentace ze stavby ({contract.photos.length} fotek)</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {contract.photos.map((p) => (
                  <div key={p.id} className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                    <img src={p.dataUrl} alt={p.caption || 'Foto'} className="w-full h-28 object-cover" />
                    <div className="p-2 text-2xs">
                      <span className="font-bold text-purple-600 uppercase block">
                        {p.category === 'before' ? 'Před' : p.category === 'after' ? 'Po dokončení' : 'V průběhu'}
                      </span>
                      <p className="text-slate-600 dark:text-slate-400 truncate">{p.caption || formatDateCs(p.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            Kompletní složka #{contract.contractNumber}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              Vytisknout
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-extrabold cursor-pointer transition-colors"
            >
              Zavřít
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
