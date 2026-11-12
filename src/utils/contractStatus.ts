import { ContractStatus } from '../types/contract';

export interface StatusMeta {
  key: ContractStatus;
  label: string;
  shortLabel: string;
  description: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
}

export const CONTRACT_STATUS_MAP: Record<ContractStatus, StatusMeta> = {
  draft: {
    key: 'draft',
    label: 'Návrh smlouvy',
    shortLabel: 'Návrh',
    description: 'Smlouva je vytvořena, zatím nepodepsána.',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-700 dark:text-slate-300',
    badgeBorder: 'border-slate-200 dark:border-slate-700',
    dotColor: 'bg-slate-400',
  },
  signed: {
    key: 'signed',
    label: 'Podepsáno',
    shortLabel: 'Podepsáno',
    description: 'Smlouva byla podepsána oběma stranami.',
    badgeBg: 'bg-blue-50 dark:bg-blue-950/80',
    badgeText: 'text-blue-700 dark:text-blue-300',
    badgeBorder: 'border-blue-200 dark:border-blue-800',
    dotColor: 'bg-blue-500',
  },
  in_progress: {
    key: 'in_progress',
    label: 'Probíhá realizace',
    shortLabel: 'V realizaci',
    description: 'Práce na díle probíhají na stavbě/zakázce.',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/80',
    badgeText: 'text-amber-800 dark:text-amber-300',
    badgeBorder: 'border-amber-200 dark:border-amber-800',
    dotColor: 'bg-amber-500',
  },
  handover_done: {
    key: 'handover_done',
    label: 'Dílo předáno',
    shortLabel: 'Předáno',
    description: 'Byl podepsán předávací protokol k dílu.',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/80',
    badgeText: 'text-purple-700 dark:text-purple-300',
    badgeBorder: 'border-purple-200 dark:border-purple-800',
    dotColor: 'bg-purple-500',
  },
  paid: {
    key: 'paid',
    label: 'Zaplaceno a dokončeno',
    shortLabel: 'Zaplaceno',
    description: 'Konečná faktura byla v plné výši uhrazena.',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/80',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    badgeBorder: 'border-emerald-200 dark:border-emerald-800',
    dotColor: 'bg-emerald-500',
  },
};

export const ALL_STATUSES: ContractStatus[] = [
  'draft',
  'signed',
  'in_progress',
  'handover_done',
  'paid',
];

export function getStatusMeta(status?: ContractStatus): StatusMeta {
  return CONTRACT_STATUS_MAP[status || 'draft'];
}
