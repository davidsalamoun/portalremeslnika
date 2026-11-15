import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Check, Phone, MapPin, FileText } from 'lucide-react';
import { Contract, CalendarEvent, CalendarEventType, Client } from '../types/contract';
import { formatDateCs } from '../utils/numberToWordsCs';
import { todayIso } from '../utils/invoiceMath';
import { getJobStage } from '../utils/jobStage';
import { Dialog } from './Dialog';

const TYPE_LABELS: Record<CalendarEventType, string> = {
  obhlidka: 'Obhlídka',
  realizace: 'Realizace',
  predani: 'Předání',
  material: 'Materiál',
  zaloha: 'Záloha',
  zaruka: 'Záruka',
  jine: 'Jiné',
};
const TYPE_OPTIONS: { key: CalendarEventType; label: string }[] = [
  { key: 'obhlidka', label: 'Obhlídka a zaměření' },
  { key: 'realizace', label: 'Práce na zakázce' },
  { key: 'predani', label: 'Předání díla' },
  { key: 'material', label: 'Nákup a závoz materiálu' },
  { key: 'zaloha', label: 'Splatnost zálohy nebo faktury' },
  { key: 'jine', label: 'Jiná schůzka nebo úkol' },
];
const WEEKDAYS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
// Události odvozené ze zakázek (termín předání, milník, záruční prohlídka) nejdou v kalendáři měnit
const isDerivedEvent = (id: string) => /^(contract_delivery_|milestone_|warranty_insp_)/.test(id);

const sectionTitle = 'text-2xl font-semibold text-slate-900 dark:text-white';
const fieldLabel = 'block font-semibold text-slate-900 dark:text-slate-100 mb-1.5';
const fieldInput =
  'w-full min-h-12 px-3.5 py-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 bg-white dark:bg-slate-950 text-slate-900 dark:text-white';
const optional = <span className="font-normal text-slate-600 dark:text-slate-400">(nepovinné)</span>;
const outlineButton =
  'min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 dark:border-slate-500 text-slate-900 dark:text-slate-100 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors';
const primaryButton =
  'min-h-11 px-4 inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-slate-900 bg-amber-400 hover:bg-amber-500 text-slate-900 font-semibold cursor-pointer transition-colors';
const smallAction =
  'min-h-11 min-w-11 px-3 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors';
const chip = (active: boolean) =>
  `min-h-11 px-3 inline-flex items-center justify-center rounded-md border font-medium cursor-pointer transition-colors ${
    active
      ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
      : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
  }`;

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
  const today = todayIso();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayIso());
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
      const stageKey = getJobStage(c).key;
      // Poptávka a nabídka ještě termín předání nemají sjednaný
      if (c.deliveryDate && stageKey !== 'inquiry' && stageKey !== 'quote') {
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
          done: stageKey === 'handover' || stageKey === 'paid',
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
            note: `Zakázka: ${c.client.name}, smlouva č. ${c.contractNumber}`,
            createdAt: c.createdAt,
            done: m.status === 'completed',
          });
        }
      });

      // Roční garanční servisní prohlídky ze záručních listů
      (c.warranty?.annualInspections || []).forEach((insp) => {
        list.push({
          id: `warranty_insp_${c.id}_${insp.id}`,
          title: `Záruční prohlídka: ${c.client.name}`,
          date: insp.scheduledDate,
          time: '10:00',
          type: 'zaruka',
          contractId: c.id,
          clientName: c.client.name,
          location: c.executionPlace || c.client.address,
          note: `Záruční prohlídka po ${insp.inspectionYear}. roce, smlouva č. ${c.contractNumber}`,
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
    setSelectedDateStr(todayIso());
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

  const openAddDialog = () => {
    setFormDate(selectedDateStr);
    setIsAddModalOpen(true);
  };

  const filterOptions: { id: string; label: string }[] = [
    { id: 'all', label: 'Vše' },
    ...(Object.keys(TYPE_LABELS) as CalendarEventType[]).map((key) => ({ id: key, label: TYPE_LABELS[key] })),
  ];

  return (
    <div className="max-w-[1180px] mx-auto pb-16 space-y-7 text-[15px] leading-snug">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-[44px] font-bold leading-[1.05] text-slate-900 dark:text-white">Kalendář</h1>
          <div className="mt-1 text-slate-600 dark:text-slate-400">
            Obhlídky, práce a závozy. Termíny předání a záruční prohlídky se doplňují ze zakázek.
          </div>
        </div>
        <button type="button" onClick={openAddDialog} className={`${primaryButton} w-full sm:w-auto`}>
          <Plus className="w-[18px] h-[18px]" />
          <span>Nová událost</span>
        </button>
      </header>

      {/* Měsíc a výběr druhu */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[30px] leading-tight font-semibold text-slate-900 dark:text-white">{monthName}</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handlePrevMonth} aria-label="Předchozí měsíc" className={smallAction}>
              <ChevronLeft className="w-[18px] h-[18px]" />
            </button>
            <button type="button" onClick={handleToday} className={smallAction}>
              Dnes
            </button>
            <button type="button" onClick={handleNextMonth} aria-label="Další měsíc" className={smallAction}>
              <ChevronRight className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
        <div role="group" aria-label="Druh událostí" className="flex flex-wrap gap-2">
          {filterOptions.map((f) => (
            <button key={f.id} type="button" aria-pressed={typeFilter === f.id} onClick={() => setTypeFilter(f.id)} className={chip(typeFilter === f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-7 items-start">
        {/* Mřížka měsíce */}
        <div className="lg:col-span-8 min-w-0">
          <div className="grid grid-cols-7 text-center text-slate-600 dark:text-slate-400 font-medium pb-1.5">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 bg-white dark:bg-slate-900 border-t border-l border-slate-300 dark:border-slate-700 rounded-md overflow-hidden">
            {daysMatrix.map((cell) => {
              const dayEvents = filteredEvents.filter((e) => e.date === cell.dateStr);
              const isSelected = cell.dateStr === selectedDateStr;
              const isToday = cell.dateStr === today;
              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => setSelectedDateStr(cell.dateStr)}
                  aria-pressed={isSelected}
                  aria-label={`${formatDateCs(cell.dateStr)}${dayEvents.length ? `, událostí: ${dayEvents.length}` : ''}`}
                  className={`relative min-h-[58px] sm:min-h-[92px] p-1.5 text-left align-top flex flex-col gap-1 border-r border-b border-slate-300 dark:border-slate-700 cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${
                    isSelected ? 'bg-slate-100 dark:bg-slate-800 shadow-[inset_0_0_0_2px_var(--color-slate-900)] dark:shadow-[inset_0_0_0_2px_#fff]' : ''
                  }`}
                >
                  <span
                    className={`font-display font-semibold tabular-nums text-[17px] leading-none min-w-7 h-7 px-1 inline-flex items-center justify-center rounded-sm self-start ${
                      isToday
                        ? 'bg-blue-600 text-white'
                        : cell.isCurrentMonth
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-400 dark:text-slate-600'
                    }`}
                  >
                    {cell.dayNum}
                  </span>
                  {/* Na úzké obrazovce jen značky, jinak názvy */}
                  <span className="sm:hidden flex gap-1 pl-1">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <span key={ev.id} className={`w-2 h-2 rounded-full ${ev.done ? 'bg-slate-400' : 'bg-slate-900 dark:bg-white'}`} />
                    ))}
                  </span>
                  <span className="hidden sm:flex flex-col gap-0.5 min-w-0 w-full">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <span
                        key={ev.id}
                        className={`block truncate text-[13px] leading-tight ${
                          ev.done ? 'text-slate-500 line-through' : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {ev.time ? `${ev.time} ` : ''}
                        {ev.title}
                      </span>
                    ))}
                    {dayEvents.length > 2 && (
                      <span className="text-[13px] leading-tight text-slate-600 dark:text-slate-400">a další {dayEvents.length - 2}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Vybraný den */}
        <section aria-labelledby="kalendar-den" className="lg:col-span-4 space-y-2.5 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="kalendar-den" className={sectionTitle}>
              {selectedDateStr === today ? 'Dnes' : formatDateCs(selectedDateStr)}
            </h2>
            <button
              type="button"
              onClick={openAddDialog}
              className="min-h-11 inline-flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-300 underline underline-offset-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Přidat</span>
            </button>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md divide-y divide-slate-100 dark:divide-slate-800">
            {selectedDayEvents.length === 0 && (
              <div className="px-5 py-5 text-slate-600 dark:text-slate-300">Na tento den není nic naplánováno.</div>
            )}
            {selectedDayEvents.map((event) => {
              const derived = isDerivedEvent(event.id);
              const linkedContract = contracts.find((c) => c.id === event.contractId);
              const clientPhone =
                linkedContract?.client?.phone?.trim() || clients.find((c) => c.name === event.clientName)?.phone?.trim();
              return (
                <div key={event.id} className={`px-5 py-4 space-y-2.5 ${event.done ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-3">
                    {derived ? (
                      <span className="w-6 h-6 mt-0.5 shrink-0 inline-flex items-center justify-center text-slate-600 dark:text-slate-400" title="Doplněno ze zakázky">
                        {event.done ? <Check className="w-5 h-5" strokeWidth={3} /> : <FileText className="w-[18px] h-[18px]" />}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onUpdateEvent({ ...event, done: !event.done })}
                        aria-pressed={!!event.done}
                        aria-label={event.done ? `Označit „${event.title}“ jako nehotové` : `Označit „${event.title}“ jako hotové`}
                        className="w-11 h-11 -m-2.5 mt-[-9px] shrink-0 inline-flex items-center justify-center cursor-pointer"
                      >
                        <span
                          className={`w-6 h-6 rounded-sm border-[1.5px] inline-flex items-center justify-center ${
                            event.done
                              ? 'bg-emerald-700 border-emerald-700 text-white'
                              : 'border-slate-900 dark:border-slate-400 bg-white dark:bg-slate-950'
                          }`}
                        >
                          {event.done && <Check className="w-4 h-4" strokeWidth={3} />}
                        </span>
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={`font-semibold text-slate-900 dark:text-white ${event.done ? 'line-through' : ''}`}>
                        {event.time && <span className="font-display tabular-nums text-[19px] mr-2">{event.time}</span>}
                        {event.title}
                      </div>
                      <div className="text-slate-600 dark:text-slate-400">
                        {[TYPE_LABELS[event.type], event.clientName, event.location].filter(Boolean).join(', ')}
                      </div>
                      {event.note && <div className="mt-1 text-slate-600 dark:text-slate-400">{event.note}</div>}
                    </div>
                    {!derived && (
                      <button
                        type="button"
                        onClick={() => onDeleteEvent(event.id)}
                        aria-label={`Smazat událost ${event.title}`}
                        title="Smazat"
                        className="w-11 h-11 -m-2.5 mt-[-9px] shrink-0 inline-flex items-center justify-center rounded-md text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {(clientPhone || event.location || linkedContract) && (
                    <div className="flex flex-wrap gap-2">
                      {clientPhone && (
                        <a href={`tel:${clientPhone.replace(/\s+/g, '')}`} className={smallAction}>
                          <Phone className="w-4 h-4" />
                          <span>Zavolat</span>
                        </a>
                      )}
                      {event.location && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={smallAction}
                        >
                          <MapPin className="w-4 h-4" />
                          <span>Navigovat</span>
                        </a>
                      )}
                      {linkedContract && (
                        <button type="button" onClick={() => onOpenContract(linkedContract)} className={smallAction}>
                          <FileText className="w-4 h-4" />
                          <span>Zakázka</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Nová událost */}
      {isAddModalOpen && (
        <Dialog title="Nová událost" onClose={() => setIsAddModalOpen(false)}>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <label htmlFor="udalost-nazev" className={fieldLabel}>
                Co se bude dít
              </label>
              <input
                id="udalost-nazev"
                type="text"
                required
                autoFocus
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="např. Zaměření obkladů"
                className={fieldInput}
              />
            </div>
            <div>
              <label htmlFor="udalost-druh" className={fieldLabel}>
                Druh
              </label>
              <select
                id="udalost-druh"
                value={formType}
                onChange={(e) => setFormType(e.target.value as CalendarEventType)}
                className={`${fieldInput} cursor-pointer`}
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="udalost-datum" className={fieldLabel}>
                  Datum
                </label>
                <input id="udalost-datum" type="date" required value={formDate} onChange={(e) => setFormDate(e.target.value)} className={fieldInput} />
              </div>
              <div>
                <label htmlFor="udalost-cas" className={fieldLabel}>
                  Čas
                </label>
                <input id="udalost-cas" type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} className={fieldInput} />
              </div>
            </div>
            <div>
              <label htmlFor="udalost-klient" className={fieldLabel}>
                Klient {optional}
              </label>
              <select id="udalost-klient" value={formClientId} onChange={(e) => setFormClientId(e.target.value)} className={`${fieldInput} cursor-pointer`}>
                <option value="">Bez klienta</option>
                {clients.map((cl) => (
                  <option key={cl.id} value={cl.id}>
                    {cl.name}
                    {cl.address ? `, ${cl.address}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="udalost-misto" className={fieldLabel}>
                Místo {optional}
              </label>
              <input
                id="udalost-misto"
                type="text"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                placeholder={formClientId ? 'Nevyplněné = adresa klienta' : 'např. Lipová 12, Praha 4'}
                className={fieldInput}
              />
            </div>
            <div>
              <label htmlFor="udalost-poznamka" className={fieldLabel}>
                Poznámka {optional}
              </label>
              <textarea
                id="udalost-poznamka"
                rows={2}
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder="např. vzít křížový laser a vzorník dekorů"
                className={fieldInput}
              />
            </div>
            <div className="pt-1 flex flex-wrap justify-end gap-2.5">
              <button type="button" onClick={() => setIsAddModalOpen(false)} className={outlineButton}>
                Zrušit
              </button>
              <button type="submit" className={primaryButton}>
                Uložit událost
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
};
