import React, { useMemo, useState } from 'react';
import { UserPlus, Pencil, Trash2, Mail, Phone, MapPin, FilePlus, Search, X } from 'lucide-react';
import { Client } from '../types/contract';
import { getStoredContracts } from '../utils/storage';
import { formatCurrency } from '../utils/numberToWordsCs';
import { getContractTotal } from '../utils/invoiceMath';
import { Dialog } from './Dialog';

interface ClientsPageProps {
  clients: Client[];
  onOpenNewClientDialog: () => void;
  onEditClient: (client: Client) => void;
  onDeleteClient: (id: string) => void;
  onCreateContractForClient: (client: Client) => void;
}

const outlineButton =
  'min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors';
const primaryButton =
  'min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold cursor-pointer transition-colors';
const smallAction =
  'min-h-11 min-w-11 px-3 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors';
const contactLink =
  'min-h-11 inline-flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-300 underline underline-offset-2 break-all';

export const ClientsPage: React.FC<ClientsPageProps> = ({
  clients,
  onOpenNewClientDialog,
  onEditClient,
  onDeleteClient,
  onCreateContractForClient,
}) => {
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Počet zakázek a jejich objem u každého klienta
  const statsByClient = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    getStoredContracts().forEach((c) => {
      const id = c.client?.id;
      if (!id) return;
      if (!map[id]) map[id] = { count: 0, total: 0 };
      map[id].count += 1;
      map[id].total += getContractTotal(c);
    });
    return map;
  }, [clients]);

  const q = searchTerm.trim().toLowerCase();
  const filteredClients = clients.filter(
    (c) => !q || [c.name, c.address, c.email, c.phone, c.ico || ''].some((v) => (v || '').toLowerCase().includes(q)),
  );

  const jobsWord = (n: number) => (n === 1 ? 'zakázka' : n >= 2 && n <= 4 ? 'zakázky' : 'zakázek');
  const clientsWord = (n: number) => (n === 1 ? 'klient' : n >= 2 && n <= 4 ? 'klienti' : 'klientů');

  return (
    <div className="max-w-[1180px] mx-auto pb-16 space-y-7 text-[15px] leading-snug">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-[44px] font-bold leading-[1.05] text-slate-900 dark:text-white">Klienti</h1>
          <div className="mt-1 text-slate-600 dark:text-slate-400">
            {clients.length === 0
              ? 'Adresář zákazníků pro smlouvy, nabídky a faktury.'
              : `${clients.length} ${clientsWord(clients.length)} v adresáři.`}
          </div>
        </div>
        <button type="button" onClick={onOpenNewClientDialog} className={`${primaryButton} w-full sm:w-auto`}>
          <UserPlus className="w-[18px] h-[18px]" />
          <span>Nový klient</span>
        </button>
      </header>

      {clients.length > 1 && (
        <div className="relative w-full sm:max-w-sm">
          <label htmlFor="klienti-hledat" className="sr-only">
            Hledat klienta
          </label>
          <Search className="w-[18px] h-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400 pointer-events-none" />
          <input
            id="klienti-hledat"
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Hledat jméno, IČO, adresu, telefon"
            className="w-full min-h-11 pl-10 pr-11 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-white [&::-webkit-search-cancel-button]:hidden"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="Vymazat hledání"
              className="absolute right-0 top-0 w-11 h-11 inline-flex items-center justify-center text-slate-900 dark:text-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      <section
        aria-label="Seznam klientů"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md divide-y divide-slate-100 dark:divide-slate-800"
      >
        {clients.length === 0 && (
          <div className="px-5 py-5 text-slate-600 dark:text-slate-300">
            Zatím tu není žádný klient. Přidat ho můžete tady nebo přímo při psaní smlouvy.
          </div>
        )}
        {clients.length > 0 && filteredClients.length === 0 && (
          <div className="px-5 py-5 text-slate-600 dark:text-slate-300">Hledání neodpovídá žádný klient.</div>
        )}
        {filteredClients.map((client) => {
          const stats = statsByClient[client.id];
          return (
            <div key={client.id} className="px-5 py-[18px] space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <span className="text-[17px] font-semibold text-slate-900 dark:text-white">{client.name}</span>
                  {client.ico && <span className="text-slate-600 dark:text-slate-400">, IČO {client.ico}</span>}
                  {client.dic && <span className="text-slate-600 dark:text-slate-400">, DIČ {client.dic}</span>}
                </div>
                <div className="text-slate-600 dark:text-slate-400">
                  {stats ? (
                    <>
                      {stats.count} {jobsWord(stats.count)},{' '}
                      <span className="font-display font-semibold tabular-nums text-[19px] text-slate-900 dark:text-white">
                        {formatCurrency(stats.total)}
                      </span>
                    </>
                  ) : (
                    'zatím bez zakázky'
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
                <div className="flex flex-wrap items-center gap-x-5 min-w-0">
                  {client.address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={contactLink}
                    >
                      <MapPin className="w-4 h-4 shrink-0" />
                      <span>{client.address}</span>
                    </a>
                  )}
                  {client.phone && (
                    <a href={`tel:${client.phone.replace(/\s+/g, '')}`} className={`${contactLink} tabular-nums`}>
                      <Phone className="w-4 h-4 shrink-0" />
                      <span>{client.phone}</span>
                    </a>
                  )}
                  {client.email && (
                    <a href={`mailto:${client.email}`} className={contactLink}>
                      <Mail className="w-4 h-4 shrink-0" />
                      <span>{client.email}</span>
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <button type="button" onClick={() => onCreateContractForClient(client)} className={`${smallAction} !border-slate-900 dark:!border-slate-400 font-semibold`}>
                    <FilePlus className="w-4 h-4" />
                    <span>Nová smlouva</span>
                  </button>
                  <button type="button" onClick={() => onEditClient(client)} className={smallAction} aria-label={`Upravit klienta ${client.name}`} title="Upravit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => setClientToDelete(client)} className={smallAction} aria-label={`Smazat klienta ${client.name}`} title="Smazat">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {clientToDelete && (
        <Dialog title="Smazat klienta?" onClose={() => setClientToDelete(null)}>
          <div className="space-y-5">
            <p className="text-slate-900 dark:text-slate-100">
              Klient <span className="font-semibold">{clientToDelete.name}</span> zmizí z adresáře. Jeho dosavadní smlouvy a
              faktury zůstanou. Smazání nejde vrátit.
            </p>
            <div className="flex flex-wrap justify-end gap-2.5">
              <button type="button" onClick={() => setClientToDelete(null)} className={outlineButton}>
                Ponechat
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteClient(clientToDelete.id);
                  setClientToDelete(null);
                }}
                className="min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-rose-700 bg-rose-700 hover:bg-rose-800 text-white font-semibold cursor-pointer transition-colors"
              >
                <Trash2 className="w-[18px] h-[18px]" />
                <span>Smazat klienta</span>
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
