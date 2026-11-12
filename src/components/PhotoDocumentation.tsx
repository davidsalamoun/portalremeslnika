import React, { useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2, Tag, Loader2, ZoomIn, X, Check } from 'lucide-react';
import { ContractPhoto } from '../types/contract';
import { compressImageFile } from '../utils/imageCompression';

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
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Kategorie nové fotky:
            </span>
            <div className="inline-flex rounded-lg bg-slate-200 dark:bg-slate-800 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setNewCategory('before')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  newCategory === 'before'
                    ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Před zahájením
              </button>
              <button
                type="button"
                onClick={() => setNewCategory('progress')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  newCategory === 'progress'
                    ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                V průběhu
              </button>
              <button
                type="button"
                onClick={() => setNewCategory('after')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  newCategory === 'after'
                    ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
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
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              title="Vyfotit fotoaparátem v mobilu"
            >
              <Camera className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Vyfotit</span>
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1E3A78] dark:bg-blue-600 hover:bg-[#162c5c] dark:hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Vybrat fotku z galerie mobilu nebo disku"
            >
              {isProcessing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <ImagePlus className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>Z galerie ({photos.length}/8)</span>
            </button>
          </div>
        </div>
      )}

      {/* Galerie fotografií */}
      {photos.length === 0 ? (
        <div className="no-print p-6 text-center border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
          <Camera className="w-8 h-8 mx-auto text-slate-400 mb-2" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Zatím nebyla přidána žádná fotodokumentace
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            Můžete vyfotit stav díla před realizací a po dokončení jako právní přílohu protokolu.
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
                className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="relative aspect-4/3 bg-slate-100 dark:bg-slate-950 overflow-hidden">
                  <img
                    src={photo.dataUrl}
                    alt={photo.caption}
                    className="w-full h-full object-cover transition-transform group-hover:scale-102"
                  />

                  {/* Štítek kategorie */}
                  <span
                    className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-md border shadow-xs ${badge.bg}`}
                  >
                    {badge.label}
                  </span>

                  {/* Akce v hoveru */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                    <button
                      type="button"
                      onClick={() => setActivePhotoZoom(photo)}
                      className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white transition-colors"
                      title="Zvětšit fotku"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    {!readonly && (
                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(photo.id)}
                        className="p-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-700 text-white transition-colors"
                        title="Smazat fotku"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Popisek */}
                <div className="p-2.5 flex-1 flex flex-col justify-between text-xs">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={tempCaption}
                        onChange={(e) => setTempCaption(e.target.value)}
                        className="w-full px-2 py-1 text-xs border rounded-md dark:bg-slate-950 dark:border-slate-700"
                        placeholder="Popis fotografie..."
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveCaption(photo.id)}
                        className="p-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
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

                  <div className="mt-2 pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                    <span>{new Date(photo.createdAt).toLocaleDateString('cs-CZ')}</span>
                    {!readonly && !isEditing && (
                      <button
                        type="button"
                        onClick={() => handleStartEditCaption(photo)}
                        className="text-blue-600 hover:underline no-print"
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

      {/* Modal pro zvětšení fotky */}
      {activePhotoZoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs no-print">
          <div className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setActivePhotoZoom(null)}
              className="absolute -top-10 right-0 p-1.5 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={activePhotoZoom.dataUrl}
              alt={activePhotoZoom.caption}
              className="max-h-[80vh] w-auto object-contain rounded-lg shadow-2xl"
            />
            <p className="mt-3 text-white text-sm font-medium text-center">
              {activePhotoZoom.caption}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
