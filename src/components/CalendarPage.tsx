import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  CheckCircle2,
  Trash2,
  X,
  ExternalLink,
  Briefcase,
  AlertCircle,
  Filter,
  Phone,
  Navigation,
} from 'lucide-react';
import { Contract, CalendarEvent, CalendarEventType, Client } from '../types/contract';
import { formatDateCs } from '../utils/numberToWordsCs';

interface CalendarPageProps {
  contracts: Contract[];
  clients: Client[];
  events: CalendarEvent[];
  onAddEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt'>) => void;
  onUpdateEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (id: string) => void;
  onOpenContract: (contract: Contract) => void;
  onNewContract: () => void;
}

export const CalendarPage: React.FC<CalendarPageProps> = ({
  contracts,
  clients,
  events,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onOpenContract,
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Form state pro novou událost
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(selectedDateStr);
  const [formTime, setFormTime] = useState('09:00');
  const [formType, setFormType] = useState<CalendarEventType>('obhlidka');
  const [formClientId, setFormClientId] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formNote, setFormNote] = useState('');

  // Propojení událostí z kalendáře + automatické termíny ze smluv
  const allEvents = useMemo(() => {
    const list: CalendarEvent[] = [...events];

    // Automaticky vytvořit události pro termíny dokončení smluv
    contracts.forEach((c) => {
      if (c.deliveryDate) {
        list.push({
          id: `contract_delivery_${c.id}`,
          title: `Předání díla: ${c.client.name}`,
          date: c.deliveryDate,
          time: '14:00',
          type: 'predani',
          contractId: c.id,
          clientName: c.client.name,
          location: c.client.address,
          note: `Termín předání dle smlouvy č. ${c.contractNumber}`,
          createdAt: c.createdAt,
          done: c.status === 'handover_done' || c.status === 'paid',
        });
      }

      // Milníky z harmonogramu
      (c.schedule || []).forEach((m) => {
        if (m.endDate) {
          list.push({
            id: `milestone_${m.id}`,
            title: `Milník: ${m.title}`,
            date: m.endDate,
            time: '12:00',
            type: 'realizace',
            contractId: c.id,
            clientName: c.client.name,
            location: c.client.address,
            note: `Zakázka: ${c.client.name} (#${c.contractNumber})`,
            createdAt: c.createdAt,
            done: m.status === 'completed',
          });
        }
      });

      // Roční garanční servisní prohlídky ze záručních listů
      (c.warranty?.annualInspections || []).forEach((insp) => {
        list.push({
          id: `warranty_insp_${c.id}_${insp.id}`,
          title: `Roční garanční servis: ${c.client.name}`,
          date: insp.scheduledDate,
          time: '10:00',
          type: 'zaruka',
          contractId: c.id,
          clientName: c.client.name,
          location: c.executionPlace || c.client.address,
          note: `Garanční prohlídka po ${insp.inspectionYear}. roce (Smlouva #${c.contractNumber}). Kontrola spár a silikonů.`,
          createdAt: c.createdAt,
          done: insp.status === 'completed',
        });
      });
    });

    return list;
  }, [events, contracts]);

  const filteredEvents = useMemo(() => {
    if (typeFilter === 'all') return allEvents;
    return allEvents.filter((e) => e.type === typeFilter);
  }, [allEvents, typeFilter]);

  // Kalendářní matice pro vybraný měsíc
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = useMemo(() => {
    const months = [
      'Leden',
      'Únor',
      'Březen',
      'Duben',
      'Květen',
      'Červen',
      'Červenec',
      'Srpen',
      'Září',
      'Říjen',
      'Listopad',
      'Prosinec',
    ];
    return `${months[month]} ${year}`;
  }, [month, year]);

  const daysMatrix = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    // Posun na pondělí = 0
    const startOffset = (firstDayIndex + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Předchozí měsíc dny
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ dateStr: dStr, dayNum: d, isCurrentMonth: false });
    }

    // Aktuální měsíc dny
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ dateStr: dStr, dayNum: d, isCurrentMonth: true });
    }

    // Doplnění do násobku 7
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const dStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ dateStr: dStr, dayNum: d, isCurrentMonth: false });
    }

    return cells;
  }, [year, month]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateStr(today.toISOString().split('T')[0]);
  };

  // Události pro vybraný den
  const selectedDayEvents = useMemo(() => {
    return filteredEvents
      .filter((e) => e.date === selectedDateStr)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }, [filteredEvents, selectedDateStr]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    let clientName = '';
    let location = formLocation;
    if (formClientId) {
      const c = clients.find((cl) => cl.id === formClientId);
      if (c) {
        clientName = c.name;
        if (!location) location = c.address;
      }
    }

    onAddEvent({
      title: formTitle.trim(),
      date: formDate,
      time: formTime,
      type: formType,
      clientName: clientName || undefined,
      location: location || undefined,
      note: formNote.trim() || undefined,
      done: false,
    });

    setFormTitle('');
    setFormNote('');
    setIsAddModalOpen(false);
  };

  const getTypeBadge = (type: CalendarEventType) => {
    switch (type) {
      case 'obhlidka':
        return { label: 'Obhlídka & Zaměření', bg: 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800' };
      case 'realizace':
        return { label: 'Montáž / Stavba', bg: 'bg-slate-900 dark:bg-slate-800 text-amber-400 border-slate-700' };
      case 'predani':
        return { label: 'Předání díla', bg: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800' };
      case 'material':
        return { label: 'Závoz materiálu', bg: 'bg-blue-100 dark:bg-blue-950/80 text-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-800' };
      case 'zaloha':
        return { label: 'Splatnost zálohy', bg: 'bg-teal-100 dark:bg-teal-950/80 text-teal-900 dark:text-teal-200 border-teal-300 dark:border-teal-800' };
      case 'zaruka':
        return { label: 'Garanční revize', bg: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800' };
      default:
        return { label: 'Ostatní výjezd', bg: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700' };
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto pb-16 space-y-6">
      {/* Hlavička dispečinku */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-slate-900 text-amber-400 border border-slate-800">
              Dispečink zakázek
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Synchronizováno s aktivními SOD
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-xs">
              <CalendarIcon className="w-5 h-5" />
            </div>
            Stavební dispečink & Harmonogram výjezdů
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Přehled obhlídek, montáží, závozů materiálu a garančních servisů v terénu.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setFormDate(selectedDateStr);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Nový výjezd na stavbu</span>
          </button>
        </div>
      </div>

      {/* Ovládací lišta měsíce & filtry */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-black text-slate-900 dark:text-white min-w-44 capitalize font-mono tracking-tight">
            {monthName}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200 dark:border-slate-800"
              title="Předchozí měsíc"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1.5 rounded-lg text-xs font-black text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer font-mono"
            >
              DNES
            </button>
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200 dark:border-slate-800"
              title="Další měsíc"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filtr typů událostí */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-400 font-bold mr-1 flex items-center gap-1 font-mono uppercase text-[11px]">
            <Filter className="w-3.5 h-3.5" /> Filtr:
          </span>
          {[
            { id: 'all', label: 'Vše' },
            { id: 'obhlidka', label: 'Obhlídky' },
            { id: 'realizace', label: 'Montáže' },
            { id: 'predani', label: 'Předání' },
            { id: 'material', label: 'Materiál' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id)}
              className={`px-3 py-1 rounded-md font-bold text-xs transition-colors cursor-pointer ${
                typeFilter === tab.id
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mřížka kalendáře + Detail dne vedle sebe */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kalendářní mřížka (8/12) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
          {/* Názvy dnů v týdnu */}
          <div className="grid grid-cols-7 gap-1 text-center font-black font-mono text-[11px] uppercase tracking-wider text-slate-400 mb-2">
            <span>Po</span>
            <span>Út</span>
            <span>St</span>
            <span>Čt</span>
            <span>Pá</span>
            <span className="text-amber-600 dark:text-amber-400">So</span>
            <span className="text-amber-600 dark:text-amber-400">Ne</span>
          </div>

          {/* Dny */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {daysMatrix.map((cell, idx) => {
              const dayEvents = filteredEvents.filter((e) => e.date === cell.dateStr);
              const isSelected = cell.dateStr === selectedDateStr;
              const isToday = cell.dateStr === new Date().toISOString().split('T')[0];

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDateStr(cell.dateStr)}
                  className={`min-h-20 sm:min-h-24 p-1.5 sm:p-2 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'ring-2 ring-slate-900 dark:ring-amber-400 border-slate-900 dark:border-amber-400 bg-slate-50 dark:bg-slate-800/80 shadow-xs'
                      : isToday
                      ? 'border-amber-500 ring-2 ring-amber-500/40 bg-amber-50/20 dark:bg-amber-950/20'
                      : cell.isCurrentMonth
                      ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-600'
                      : 'border-transparent bg-slate-50/40 dark:bg-slate-950/30 opacity-35'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-mono font-bold w-6 h-6 rounded flex items-center justify-center ${
                        isToday
                          ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                          : isSelected
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-black'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {cell.dayNum}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-mono font-bold px-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Události v políčku */}
                  <div className="space-y-1 mt-1 overflow-hidden">
                    {dayEvents.slice(0, 2).map((ev) => {
                      const badge = getTypeBadge(ev.type);
                      return (
                        <div
                          key={ev.id}
                          className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded truncate font-medium border ${badge.bg}`}
                          title={`${ev.time ? `${ev.time} ` : ''}${ev.title}`}
                        >
                          {ev.time ? `${ev.time} ` : ''}{ev.title}
                        </div>
                      );
                    })}
                    {dayEvents.length > 2 && (
                      <span className="text-[9px] text-slate-500 font-mono font-bold block text-center">
                        +{dayEvents.length - 2} další
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail vybraného dne (4/12) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
            <div>
              <span className="text-[10px] uppercase font-black font-mono tracking-wider text-amber-600 dark:text-amber-400">
                Denní dispečink výjezdů
              </span>
              <h3 className="text-base font-black font-mono text-slate-900 dark:text-white mt-0.5">
                {formatDateCs(selectedDateStr)}
              </h3>
            </div>
            <button
              onClick={() => {
                setFormDate(selectedDateStr);
                setIsAddModalOpen(true);
              }}
              className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500 text-amber-700 dark:text-amber-400 hover:text-slate-950 transition-colors cursor-pointer border border-amber-500/30"
              title="Přidat událost k tomuto dni"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {selectedDayEvents.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-3 my-auto">
              <CalendarIcon className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-xs font-medium">Na tento den nemáte naplánovaný žádný výjezd na stavbu.</p>
              <button
                onClick={() => {
                  setFormDate(selectedDateStr);
                  setIsAddModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold cursor-pointer transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Naplánovat výjezd či montáž</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[540px] pr-1">
              {selectedDayEvents.map((event) => {
                const badge = getTypeBadge(event.type);
                const isAutoContractEvent = event.id.startsWith('contract_') || event.id.startsWith('milestone_');
                const linkedContract = contracts.find((c) => c.id === event.contractId);
                const clientPhone =
                  linkedContract?.client?.phone?.trim() ||
                  clients.find((c) => c.name === event.clientName)?.phone?.trim();

                return (
                  <div
                    key={event.id}
                    className={`p-3.5 rounded-lg border transition-all space-y-3 ${
                      event.done
                        ? 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-400 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase border ${badge.bg}`}>
                            {badge.label}
                          </span>
                          {event.time && (
                            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                              <Clock className="w-3 h-3 text-slate-500" />
                              {event.time}
                            </span>
                          )}
                        </div>
                        <h4 className={`text-sm font-bold tracking-tight ${event.done ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                          {event.title}
                        </h4>
                      </div>

                      {!isAutoContractEvent && (
                        <button
                          type="button"
                          onClick={() => onDeleteEvent(event.id)}
                          className="p-1 rounded text-slate-300 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Smazat událost"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {event.clientName && (
                      <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                        <div className="truncate">
                          <span className="text-[10px] font-mono uppercase text-slate-400 block">Zákazník</span>
                          <span className="font-bold text-slate-900 dark:text-white truncate block">{event.clientName}</span>
                        </div>
                        {clientPhone && (
                          <a
                            href={`tel:${clientPhone}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0 shadow-xs transition-colors"
                            title="Zavolat zákazníkovi"
                          >
                            <Phone className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Zavolat</span>
                          </a>
                        )}
                      </div>
                    )}

                    {event.location && (
                      <div className="flex items-center justify-between gap-2 p-2 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs">
                        <div className="truncate">
                          <span className="text-[10px] font-mono uppercase text-slate-400 block">Místo stavby</span>
                          <span className="text-slate-700 dark:text-slate-300 truncate block">{event.location}</span>
                        </div>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-900 dark:bg-white hover:bg-slate-800 text-white dark:text-slate-950 font-bold text-xs shrink-0 shadow-xs transition-colors"
                          title="Spustit GPS navigaci na stavbu"
                        >
                          <Navigation className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Navigovat</span>
                        </a>
                      </div>
                    )}

                    {event.note && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 italic bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 p-2 rounded">
                        {event.note}
                      </p>
                    )}

                    {linkedContract && (
                      <button
                        onClick={() => onOpenContract(linkedContract)}
                        className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-bold hover:text-amber-500 dark:hover:text-amber-400 pt-0.5 cursor-pointer font-mono"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Smlouva o dílo #{linkedContract.contractNumber} &rarr;</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal pro nový výjezd na stavbu */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight">Nový výjezd do dispečinku</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Harmonogram zakázek & stavby</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-7 h-7 rounded hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase font-mono mb-1">
                  Typ výjezdu / události
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as CalendarEventType)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold focus:ring-2 focus:ring-amber-500"
                >
                  <option value="obhlidka">Obhlídka a zaměření na místě</option>
                  <option value="realizace">Montáž a provádění prací</option>
                  <option value="predani">Předání hotového díla</option>
                  <option value="material">Nákup a závoz stavebního materiálu</option>
                  <option value="zaloha">Splatnost zálohy / faktury</option>
                  <option value="jine">Ostatní schůzka či úkol</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase font-mono mb-1">
                  Popis výjezdu / název zakázky *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="např. Zaměření obkladů, Montáž sádrokartonů"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase font-mono mb-1">
                    Datum *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase font-mono mb-1">
                    Čas srazu
                  </label>
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase font-mono mb-1">
                  Přiřadit ke klientovi (auto-vyplní telefon a adresu)
                </label>
                <select
                  value={formClientId}
                  onChange={(e) => setFormClientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">-- Bez vazby na klienta --</option>
                  {clients.map((cl) => (
                    <option key={cl.id} value={cl.id}>
                      {cl.name} ({cl.address})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase font-mono mb-1">
                  Místo stavby / GPS navigace
                </label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="např. Lipová 12, Praha 4"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase font-mono mb-1">
                  Poznámka / Vybavení s sebou
                </label>
                <textarea
                  rows={2}
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="např. vzít křížový laser, velkou příklepovou vrtačku a vzorník dekorů"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-xs transition-colors cursor-pointer"
                >
                  Uložit výjezd
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
