import React, { useState, useEffect, useRef } from 'react';
import { Check, Search, Loader2 } from 'lucide-react';
import { Dialog } from './Dialog';
import { Client } from '../types/contract';
import { fetchCompanyByIco } from '../utils/ares';

interface ClientDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (clientData: Omit<Client, 'id' | 'createdAt'>, existingId?: string) => void;
  clientToEdit?: Client | null;
}

const fieldLabel = 'block font-semibold text-slate-900 dark:text-slate-100 mb-1.5';
const fieldBase = 'w-full min-h-12 px-3.5 py-2 rounded-md border-[1.5px] bg-white dark:bg-slate-950 text-slate-900 dark:text-white';
const fieldOk = 'border-slate-900 dark:border-slate-500';
const fieldBad = 'border-rose-700 dark:border-rose-400';
const errorText = 'mt-1.5 font-medium text-rose-700 dark:text-rose-400';
const optional = <span className="font-normal text-slate-600 dark:text-slate-400">(nepovinné)</span>;

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
      setErrors((prev) => ({ ...prev, ico: 'IČO má 8 číslic.' }));
      return;
    }

    try {
      setIsAresLoading(true);
      setAresMessage(null);
      const data = await fetchCompanyByIco(icoToQuery);
      if (data.name) setName(data.name);
      if (data.address) setAddress(data.address);
      setAresMessage(`Načteno z ARES: ${data.name}`);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.ico;
        delete next.name;
        delete next.address;
        return next;
      });
    } catch (err: any) {
      setAresMessage(err.message || 'Údaje se z ARES nepodařilo načíst.');
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
      newErrors.ico = 'IČO má 8 číslic.';
    }

    if (!address.trim()) {
      newErrors.address = 'Zadejte adresu bydliště nebo sídla.';
    }

    // E-mail je nepovinný; když je vyplněný, musí mít správný tvar
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'E-mail nemá správný tvar, například klient@email.cz.';
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

  const field = (
    id: string,
    label: React.ReactNode,
    value: string,
    onChange: (v: string) => void,
    error: string | undefined,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div>
      <label htmlFor={id} className={fieldLabel}>
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className={`${fieldBase} ${error ? fieldBad : fieldOk}`}
        {...props}
      />
      {error && (
        <p role="alert" className={errorText}>
          {error}
        </p>
      )}
    </div>
  );

  return (
    <Dialog
      title={clientToEdit ? 'Upravit klienta' : 'Nový klient'}
      subtitle="Údaje se použijí ve smlouvě i na faktuře."
      size="lg"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="klient-ico" className={fieldLabel}>
            IČO {optional}
          </label>
          <div className="flex gap-2">
            <input
              id="klient-ico"
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
                  if (ico.length === 8) handleAresLookup(ico);
                }
              }}
              placeholder="8 číslic"
              aria-invalid={!!errors.ico}
              className={`${fieldBase} flex-1 min-w-0 tabular-nums ${errors.ico ? fieldBad : fieldOk}`}
            />
            <button
              type="button"
              onClick={() => handleAresLookup()}
              disabled={isAresLoading || ico.length !== 8}
              className="min-h-12 px-4 shrink-0 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-default"
            >
              {isAresLoading ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Search className="w-[18px] h-[18px]" />}
              <span>Načíst z ARES</span>
            </button>
          </div>
          {errors.ico && (
            <p role="alert" className={errorText}>
              {errors.ico}
            </p>
          )}
          {aresMessage && !errors.ico && (
            <p role="status" className="mt-1.5 text-slate-600 dark:text-slate-400">
              {aresMessage}
            </p>
          )}
        </div>

        {field('klient-jmeno', 'Jméno a příjmení nebo firma', name, setName, errors.name, {
          type: 'text',
          placeholder: 'např. Petr Svoboda nebo Nova Real s.r.o.',
          autoFocus: !clientToEdit,
        })}
        {field('klient-adresa', 'Adresa bydliště nebo sídla', address, setAddress, errors.address, {
          type: 'text',
          placeholder: 'např. Hlavní 420, 250 01 Brandýs nad Labem',
        })}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field('klient-email', <>E-mail <span className="font-normal text-slate-600 dark:text-slate-400">(nepovinné)</span></>, email, setEmail, errors.email, { type: 'email', placeholder: 'petr.svoboda@email.cz' })}
          {field('klient-telefon', 'Telefon', phone, setPhone, errors.phone, {
            type: 'tel',
            inputMode: 'tel',
            placeholder: '+420 777 000 111',
          })}
        </div>

        <div className="pt-1 flex flex-wrap justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 px-4 inline-flex items-center justify-center rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            Zrušit
          </button>
          <button
            type="submit"
            className="min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold cursor-pointer transition-colors"
          >
            <Check className="w-[18px] h-[18px]" />
            <span>{clientToEdit ? 'Uložit změny' : 'Přidat klienta'}</span>
          </button>
        </div>
      </form>
    </Dialog>
  );
};
