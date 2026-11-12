import React, { useState, useRef, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Pencil,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Building,
  FilePlus,
  Search,
  X,
  Briefcase,
  Coins,
} from 'lucide-react';
import { Client } from '../types/contract';
import { getStoredContracts } from '../utils/storage';
import { formatCurrency } from '../utils/numberToWordsCs';

interface ClientsPageProps {
  clients: Client[];
  onOpenNewClientDialog: () => void;
  onEditClient: (client: Client) => void;
  onDeleteClient: (id: string) => void;
  onCreateContractForClient: (client: Client) => void;
}

export const ClientsPage: React.FC<ClientsPageProps> = ({
  clients,
  onOpenNewClientDialog,
  onEditClient,
  onDeleteClient,
  onCreateContractForClient,
}) => {
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Map client revenue and contracts count
  const allContracts = useMemo(() => getStoredContracts(), []);

  const clientStatsMap = useMemo(() => {
    const map: Record<string, { count: number; totalVolume: number }> = {};
    allContracts.forEach((c) => {
      const cId = c.client?.id;
      if (!cId) return;
      if (!map[cId]) {
        map[cId] = { count: 0, totalVolume: 0 };
      }
      map[cId].count += 1;
      map[cId].totalVolume += c.price || 0;
    });
    return map;
  }, [allContracts]);

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.ico && c.ico.includes(searchTerm))
  );

  const confirmDelete = () => {
    if (clientToDelete) {
      onDeleteClient(clientToDelete.id);
      setClientToDelete(null);
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <span>Adresář objednatelů & zákazníků</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Centrální evidence klientů s historií zakázek, rychlým telefonováním a navigací na místo montáže.
          </p>
        </div>

        <button
          onClick={onOpenNewClientDialog}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-black shadow-xs transition-all self-start sm:self-auto cursor-pointer active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Přidat klienta</span>
        </button>
      </div>

      {/* Prázdný stav */}
      {clients.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-10 sm:p-14 border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-center shadow-xs">
          <div className="w-14 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center mb-4">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Zatím žádní uložený klienti</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6">
            Přidejte prvního zákazníka. Klienta lze přidat i kdykoli při vytváření nové smlouvy nebo nabídky.
          </p>
          <button
            onClick={onOpenNewClientDialog}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-black shadow-xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Přidat klienta</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Search bar */}
          {clients.length > 1 && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Hledat podle jména, IČO, adresy či telefonu..."
                className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-950 focus:border-slate-900 dark:focus:border-blue-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    searchInputRef.current?.blur();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                  title="Vymazat hledání"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Seznam karet klientů */}
          <div className="grid grid-cols-1 gap-3">
            {filteredClients.map((client) => {
              const stats = clientStatsMap[client.id] || { count: 0, totalVolume: 0 };
              return (
                <div
                  key={client.id}
                  className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 shadow-xs border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold text-slate-900 dark:text-white text-base truncate">{client.name}</h3>
                      {client.ico && (
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          IČO: {client.ico}
                        </span>
                      )}
                      {stats.count > 0 && (
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          {stats.count} {stats.count === 1 ? 'zakázka' : stats.count < 5 ? 'zakázky' : 'zakázek'} · {formatCurrency(stats.totalVolume)}
                        </span>
                      )}
                    </div>

                    {client.address && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors group"
                        title="Otevřít adresu v Google Maps / navigaci"
                      >
                        <MapPin className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 shrink-0" />
                        <span className="truncate underline decoration-slate-300 dark:decoration-slate-700 underline-offset-2">{client.address}</span>
                      </a>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                      {client.phone && (
                        <a
                          href={`tel:${client.phone}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono font-bold hover:bg-amber-100 dark:hover:bg-amber-950/60 hover:text-amber-900 dark:hover:text-amber-300 transition-colors border border-slate-200 dark:border-slate-700"
                          title="Zavolat klientovi z mobilu"
                        >
                          <Phone className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                          <span>{client.phone}</span>
                        </a>
                      )}
                      {client.email && (
                        <a
                          href={`mailto:${client.email}`}
                          className="inline-flex items-center gap-1 hover:text-blue-600 transition-colors font-mono"
                          title="Napsat e-mail"
                        >
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{client.email}</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 pt-3 sm:pt-0 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => onCreateContractForClient(client)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold transition-colors cursor-pointer"
                      title="Vytvořit novou smlouvu pro tohoto klienta"
                    >
                      <FilePlus className="w-3.5 h-3.5 text-amber-400" />
                      <span>Nová smlouva</span>
                    </button>

                    <button
                      onClick={() => onEditClient(client)}
                      className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                      title="Upravit klienta"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setClientToDelete(client)}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                      title="Smazat klienta"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal pro potvrzení smazání */}
      {clientToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-2">Smazat klienta?</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
              Opravdu chcete smazat klienta <strong>{clientToDelete.name}</strong>? Tuto akci nelze vrátit.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setClientToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Zrušit
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                Smazat klienta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
