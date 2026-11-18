import React, { useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2, Tag, Loader2, ZoomIn, X, Check } from 'lucide-react';
import { ContractPhoto } from '../types/contract';
import { compressImageFile } from '../utils/imageCompression';
import { Dialog } from './Dialog';

interface PhotoDocumentationProps {
  photos: ContractPhoto[];
  onChange: (photos: ContractPhoto[]) => void;
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void;
  readonly?: boolean;
}

export const PhotoDocumentation: React.FC<PhotoDocumentationProps> = ({
  photos,
  onChange,
  onToast,
  readonly = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activePhotoZoom, setActivePhotoZoom] = useState<ContractPhoto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContractPhoto | null>(null);
  const [newCategory, setNewCategory] = useState<'before' | 'progress' | 'after'>('after');
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [tempCaption, setTempCaption] = useState('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (photos.length + files.length > 8) {
      onToast?.('error', 'K zakázce lze nahrát maximálně 8 fotografií.');
      return;
    }

    try {
      setIsProcessing(true);
      const newPhotoList: ContractPhoto[] = [...photos];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressedBase64 = await compressImageFile(file, 960, 960, 0.65);
        
        const defaultCaption =
          newCategory === 'before'
            ? 'Původní stav před zahájením prací'
            : newCategory === 'progress'
            ? 'Průběh realizace'
            : 'Dokončené dílo / předání';

        newPhotoList.push({
          id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          dataUrl: compressedBase64,
          caption: defaultCaption,
          category: newCategory,
          createdAt: new Date().toISOString(),
        });
      }

      onChange(newPhotoList);
      onToast?.('success', `Fotografie byla úspěšně nahrána a optimalizována`);
    } catch (err) {
      console.error(err);
      onToast?.('error', 'Chyba při zpracování fotografie');
    } finally {
      setIsProcessing(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleDeletePhoto = (id: string) => {
    setDeleteTarget(null);
    const next = photos.filter((p) => p.id !== id);
    onChange(next);
    onToast?.('info', 'Fotografie byla odstraněna');
  };

  const handleStartEditCaption = (photo: ContractPhoto) => {
    setEditingCaptionId(photo.id);
    setTempCaption(photo.caption);
  };

  const handleSaveCaption = (id: string) => {
    const next = photos.map((p) => (p.id === id ? { ...p, caption: tempCaption.trim() } : p));
    onChange(next);
    setEditingCaptionId(null);
  };

  const getCategoryLabel = (cat: 'before' | 'progress' | 'after') => {
    switch (cat) {
      case 'before':
        return { label: 'Před pracemi', bg: 'bg-amber-100 text-amber-900 border-amber-300' };
      case 'progress':
        return { label: 'V průběhu', bg: 'bg-blue-100 text-blue-900 border-blue-300' };
      case 'after':
        return { label: 'Hotové dílo', bg: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
    }
  };

  return (
    <div className="space-y-4">
      {/* Ovládací panel nahrávání (skrytý při tisku) */}
      {!readonly && (
        <div className="no-print bg-slate-50 dark:bg-slate-900/80 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Kategorie nové fotky:
            </span>
            <div role="group" aria-label="Kategorie nové fotky" className="inline-flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setNewCategory('before')}
                aria-pressed={newCategory === 'before'}
                className={`min-h-11 inline-flex items-center justify-center px-3 rounded-md border font-medium transition-colors cursor-pointer ${
                  newCategory === 'before'
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                    : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Před zahájením
              </button>
              <button
                type="button"
                onClick={() => setNewCategory('progress')}
                aria-pressed={newCategory === 'progress'}
                className={`min-h-11 inline-flex items-center justify-center px-3 rounded-md border font-medium transition-colors cursor-pointer ${
                  newCategory === 'progress'
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                    : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                V průběhu
              </button>
              <button
                type="button"
                onClick={() => setNewCategory('after')}
                aria-pressed={newCategory === 'after'}
                className={`min-h-11 inline-flex items-center justify-center px-3 rounded-md border font-medium transition-colors cursor-pointer ${
                  newCategory === 'after'
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                    : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Hotové dílo
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Skryté vstupy */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => cameraInputRef.current?.click()}
              className="min-h-11 flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              title="Vyfotit fotoaparátem v mobilu"
            >
              <Camera className="w-[18px] h-[18px] shrink-0" />
              <span>Vyfotit</span>
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => fileInputRef.current?.click()}
              className="min-h-11 flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              title="Vybrat fotku z galerie mobilu nebo disku"
            >
              {isProcessing ? (
                <Loader2 className="w-[18px] h-[18px] animate-spin shrink-0" />
              ) : (
                <ImagePlus className="w-[18px] h-[18px] shrink-0" />
              )}
              <span>Z galerie ({photos.length}/8)</span>
            </button>
          </div>
        </div>
      )}

      {/* Galerie fotografií */}
      {photos.length === 0 ? (
        <div className="no-print px-5 py-5 border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-slate-900">
          <p className="font-semibold text-slate-900 dark:text-white">
            Zatím tu nejsou žádné fotky
          </p>
          <p className="text-slate-600 dark:text-slate-400 mt-0.5">
            Vyfoťte stav před zahájením a po dokončení – fotky se zobrazí u předávacího protokolu.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {photos.map((photo) => {
            const badge = getCategoryLabel(photo.category);
            const isEditing = editingCaptionId === photo.id;

            return (
              <div
                key={photo.id}
                className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden flex flex-col"
              >
                <div className="relative aspect-4/3 bg-slate-100 dark:bg-slate-950 overflow-hidden">
                  <img
                    src={photo.dataUrl}
                    alt={photo.caption}
                    className="w-full h-full object-cover transition-transform group-hover:scale-102"
                  />

                  {/* Štítek kategorie */}
                  <span
                    className={`absolute top-2 left-2 text-[13px] font-semibold px-2 py-0.5 rounded-md border ${badge.bg}`}
                  >
                    {badge.label}
                  </span>

                  {/* Akce v hoveru */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity no-print">
                    <button
                      type="button"
                      onClick={() => setActivePhotoZoom(photo)}
                      className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-md bg-slate-900/75 hover:bg-slate-900 text-white transition-colors cursor-pointer"
                      aria-label={`Zvětšit fotku ${photo.caption || ''}`.trim()}
                      title="Zvětšit fotku"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    {!readonly && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(photo)}
                        className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-md bg-slate-900/75 hover:bg-slate-900 text-white transition-colors cursor-pointer"
                        aria-label={`Smazat fotku ${photo.caption || ''}`.trim()}
                        title="Smazat fotku"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Popisek */}
                <div className="p-2.5 flex-1 flex flex-col justify-between text-sm">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={tempCaption}
                        onChange={(e) => setTempCaption(e.target.value)}
                        className="min-h-11 w-full px-2 py-1 text-sm border rounded-md dark:bg-slate-950 dark:border-slate-700"
                        placeholder="Popis fotografie..."
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveCaption(photo.id)}
                        className="min-h-11 min-w-11 inline-flex items-center justify-center p-1 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-900 border-[1.5px] border-slate-900"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p
                      onClick={() => !readonly && handleStartEditCaption(photo)}
                      className={`font-medium text-slate-800 dark:text-slate-200 line-clamp-2 ${
                        !readonly ? 'cursor-pointer hover:text-blue-600' : ''
                      }`}
                      title={!readonly ? 'Klikněte pro úpravu popisku' : undefined}
                    >
                      {photo.caption || 'Bez popisku'}
                    </p>
                  )}

                  <div className="mt-2 pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[13px] text-slate-600 dark:text-slate-400">
                    <span>{new Date(photo.createdAt).toLocaleDateString('cs-CZ')}</span>
                    {!readonly && !isEditing && (
                      <button
                        type="button"
                        onClick={() => handleStartEditCaption(photo)}
                        className="min-h-11 min-w-11 inline-flex items-center justify-center text-blue-600 hover:underline no-print"
                      >
                        Upravit popisek
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Zvětšená fotka */}
      {activePhotoZoom && (
        <Dialog title={activePhotoZoom.caption || 'Fotka'} size="3xl" onClose={() => setActivePhotoZoom(null)}>
          <img src={activePhotoZoom.dataUrl} alt={activePhotoZoom.caption || 'Fotka ze stavby'} className="max-h-[75vh] w-full object-contain" />
        </Dialog>
      )}

      {/* Potvrzení smazání */}
      {deleteTarget && (
        <Dialog title="Smazat fotku?" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-5 text-[15px]">
            <p>Fotka {deleteTarget.caption ? `„${deleteTarget.caption}“ ` : ''}se odstraní ze zakázky.</p>
            <div className="flex flex-wrap justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="min-h-11 px-4 inline-flex items-center justify-center rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Zpět
              </button>
              <button
                type="button"
                onClick={() => handleDeletePhoto(deleteTarget.id)}
                className="min-h-11 px-4 inline-flex items-center justify-center rounded-md border-[1.5px] border-rose-700 text-rose-700 dark:border-rose-400 dark:text-rose-300 font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
              >
                Smazat fotku
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
