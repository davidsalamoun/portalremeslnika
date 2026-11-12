import React, { useState, useEffect, useRef } from 'react';
import { X, UserPlus, Check, UserCheck, Search, Loader2 } from 'lucide-react';
import { Client } from '../types/contract';
import { fetchCompanyByIco } from '../utils/ares';

interface ClientDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (clientData: Omit<Client, 'id' | 'createdAt'>, existingId?: string) => void;
  clientToEdit?: Client | null;
}

export const ClientDialog: React.FC<ClientDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  clientToEdit,
}) => {
  const [name, setName] = useState('');
  const [ico, setIco] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isAresLoading, setIsAresLoading] = useState(false);
  const [aresMessage, setAresMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const lastAutoIco = useRef('');

  useEffect(() => {
    if (clientToEdit) {
      setName(clientToEdit.name);
      setIco(clientToEdit.ico || '');
      setAddress(clientToEdit.address);
      setEmail(clientToEdit.email);
      setPhone(clientToEdit.phone);
    } else {
      setName('');
      setIco('');
      setAddress('');
      setEmail('');
      setPhone('');
    }
    setAresMessage(null);
    setErrors({});
  }, [clientToEdit, isOpen]);

  if (!isOpen) return null;

  const handleAresLookup = async (targetIco?: string) => {
    const icoToQuery = (typeof targetIco === 'string' ? targetIco : ico).trim();
    if (!icoToQuery || icoToQuery.length !== 8) {
      setErrors((prev) => ({ ...prev, ico: 'Zadejte platné 8místné IČO pro vyhledání v ARES.' }));
      return;
    }

    try {
      setIsAresLoading(true);
      setAresMessage(null);
      const data = await fetchCompanyByIco(icoToQuery);
      if (data.name) setName(data.name);
      if (data.address) setAddress(data.address);
      setAresMessage(`Údaje načteny z ARES: ${data.name}`);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.ico;
        delete next.name;
        delete next.address;
        return next;
      });
    } catch (err: any) {
      setAresMessage(err.message || 'Nepodařilo se načíst z ARES');
    } finally {
      setIsAresLoading(false);
    }
  };

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Zadejte jméno klienta nebo název firmy.';
    }

    if (ico.trim() && !/^\d{8}$/.test(ico.trim())) {
      newErrors.ico = 'IČO musí mít přesně 8 číslic (pokud je vyplněno).';
    }

    if (!address.trim()) {
      newErrors.address = 'Zadejte adresu bydliště nebo sídla.';
    }

    if (!email.trim()) {
      newErrors.email = 'Zadejte kontaktní e-mail.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Zadejte e-mail v platném formátu (např. klient@email.cz).';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Zadejte telefonní číslo.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSave(
      {
        name: name.trim(),
        ico: ico.trim() || undefined,
        address: address.trim(),
        email: email.trim(),
        phone: phone.trim(),
      },
      clientToEdit?.id
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-[#1E3A78] dark:text-blue-300 flex items-center justify-center">
              {clientToEdit ? <UserCheck className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                {clientToEdit ? 'Upravit klienta' : 'Nový klient (objednatel)'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Údaje budou použity ve smlouvě i na faktuře
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* IČO s ARES tlačítkem */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">IČO</label>
              <span className="text-xs text-slate-400 dark:text-slate-500">Nepovinné pro fyzické osoby</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={ico}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                  setIco(val);
                  if (val.length === 8 && val !== lastAutoIco.current) {
                    lastAutoIco.current = val;
                    handleAresLookup(val);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (ico.length === 8) {
                      handleAresLookup(ico);
                    }
                  }
                }}
                placeholder="8 číslic (např. 12345678)"
                className={`flex-1 px-3.5 py-2.5 rounded-xl border text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all focus:outline-hidden focus:ring-2 ${
                  errors.ico
                    ? 'border-rose-300 ring-rose-200 bg-rose-50/30'
                    : 'border-slate-300 dark:border-slate-700 focus:border-[#1E3A78] dark:focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-950'
                }`}
              />
              <button
                type="button"
                onClick={() => handleAresLookup()}
                disabled={isAresLoading || ico.length !== 8}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
                title="Doplnit název firmy a adresu ze státního registru ARES (nebo stiskněte Enter)"
              >
                {isAresLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                <span>Načíst z ARES</span>
              </button>
            </div>
            {aresMessage && (
              <p className="text-xs text-blue-800 dark:text-blue-300 mt-1 bg-blue-50 dark:bg-blue-950/60 p-1.5 rounded-md">{aresMessage}</p>
            )}
            {errors.ico && <p className="text-xs text-rose-600 mt-1">{errors.ico}</p>}
          </div>

          {/* Jméno / Firma */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
              Jméno a příjmení / Firma <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="např. Ing. Petr Svoboda nebo Nova Real s.r.o."
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all focus:outline-hidden focus:ring-2 ${
                errors.name
                  ? 'border-rose-300 ring-rose-200 bg-rose-50/30'
                  : 'border-slate-300 dark:border-slate-700 focus:border-[#1E3A78] dark:focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-950'
              }`}
            />
            {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name}</p>}
          </div>

          {/* Adresa */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
              Adresa bydliště / sídla <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="např. Hlavní 420, 250 01 Brandýs nad Labem"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all focus:outline-hidden focus:ring-2 ${
                errors.address
                  ? 'border-rose-300 ring-rose-200 bg-rose-50/30'
                  : 'border-slate-300 dark:border-slate-700 focus:border-[#1E3A78] dark:focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-950'
              }`}
            />
            {errors.address && <p className="text-xs text-rose-600 mt-1">{errors.address}</p>}
          </div>

          {/* E-mail a Telefon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                E-mail <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="petr.svoboda@email.cz"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all focus:outline-hidden focus:ring-2 ${
                  errors.email
                    ? 'border-rose-300 ring-rose-200 bg-rose-50/30'
                    : 'border-slate-300 dark:border-slate-700 focus:border-[#1E3A78] dark:focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-950'
                }`}
              />
              {errors.email && <p className="text-xs text-rose-600 mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Telefon <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+420 777 000 111"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all focus:outline-hidden focus:ring-2 ${
                  errors.phone
                    ? 'border-rose-300 ring-rose-200 bg-rose-50/30'
                    : 'border-slate-300 dark:border-slate-700 focus:border-[#1E3A78] dark:focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-950'
                }`}
              />
              {errors.phone && <p className="text-xs text-rose-600 mt-1">{errors.phone}</p>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Zrušit
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1E3A78] dark:bg-blue-600 text-white text-sm font-semibold hover:bg-[#162c5c] dark:hover:bg-blue-500 shadow-md shadow-blue-900/10 transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{clientToEdit ? 'Uložit změny' : 'Přidat klienta'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
