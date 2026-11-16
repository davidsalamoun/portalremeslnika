import { Contract } from '../types/contract';
import { formatCurrency } from './numberToWordsCs';
import { isContractPaid } from './invoiceMath';

/**
 * Fáze zakázky pro „metr“: jedna stupnice od poptávky po zaplacení, odvozená z údajů, které už zakázka má
 * (druh dokumentu, stav, fáze v přehledu zakázek, podpis, předání, platba).
 */

export type JobStageKey = 'inquiry' | 'quote' | 'contract' | 'realization' | 'handover' | 'paid';

export const JOB_STAGE_LABELS: { key: JobStageKey; label: string }[] = [
  { key: 'inquiry', label: 'Poptávka' },
  { key: 'quote', label: 'Nabídka' },
  { key: 'contract', label: 'Smlouva' },
  { key: 'realization', label: 'Realizace' },
  { key: 'handover', label: 'Předáno' },
  { key: 'paid', label: 'Zaplaceno' },
];

export interface JobStage {
  key: JobStageKey;
  label: string;
  /** Pořadí fáze od nuly – úsek na metru */
  index: number;
  /** Poloha v procentech (0–100), slouží k řazení */
  percent: number;
  /** Co je potřeba udělat dál, jednou větou */
  next: string;
}

// Poloha odpovídá popiskům rozmístěným rovnoměrně pod metrem (první vlevo, poslední vpravo)
const STAGE_PERCENT: Record<JobStageKey, number> = {
  inquiry: 6,
  quote: 22,
  contract: 42,
  realization: 62,
  handover: 82,
  paid: 100,
};

function resolveKey(contract: Contract): JobStageKey {
  if (isContractPaid(contract)) return 'paid';
  // Fáze „completed“ ze starší nástěnky znamená předáno; zaplaceno je až podle stavu nebo data úhrady
  if (contract.status === 'handover_done' || contract.handoverData || contract.leadStage === 'completed') return 'handover';
  if (contract.status === 'in_progress' || contract.leadStage === 'realization') return 'realization';
  if (contract.leadStage === 'inquiry') return 'inquiry';
  if (contract.leadStage === 'quote') return 'quote';
  if (contract.leadStage === 'contract') return 'contract';
  return contract.docKind === 'quote' ? 'quote' : 'contract';
}

export function getJobStage(contract: Contract): JobStage {
  const key = resolveKey(contract);
  const label = JOB_STAGE_LABELS.find((s) => s.key === key)!.label;
  let next = '';

  switch (key) {
    case 'inquiry':
      next = contract.nextStepNote?.trim() || 'Obhlédnout a připravit nabídku';
      break;
    case 'quote':
      next = 'Čeká na potvrzení nabídky zákazníkem';
      break;
    case 'contract':
      if (!contract.clientSignature) next = 'Čeká na podpis zákazníka';
      else if (contract.advanceAmount && contract.advanceAmount > 0) {
        next = `Vystavit zálohovou fakturu na ${formatCurrency(contract.advanceAmount)}`;
      } else next = 'Podepsáno, zahájit práce';
      break;
    case 'realization':
      next = 'Po dokončení předat dílo protokolem';
      break;
    case 'handover':
      next = 'Čeká na zaplacení';
      break;
    case 'paid':
      next = 'Zaplaceno';
      break;
  }

  return { key, label, index: JOB_STAGE_LABELS.findIndex((s) => s.key === key), percent: STAGE_PERCENT[key], next };
}

/** Rozpracovaná zakázka = cokoli, co ještě není zaplacené. */
export function isActiveJob(contract: Contract): boolean {
  return getJobStage(contract).key !== 'paid';
}

const STAGE_ORDER: JobStageKey[] = JOB_STAGE_LABELS.map((s) => s.key);

/** Kam lze zakázku posunout. Zpět před předání nejde, pokud už existuje podepsaný předávací protokol. */
export function getStageMoves(contract: Contract): { back?: JobStageKey; forward?: JobStageKey } {
  const index = STAGE_ORDER.indexOf(getJobStage(contract).key);
  const back = index > 0 && !(STAGE_ORDER[index] === 'handover' && contract.handoverData) ? STAGE_ORDER[index - 1] : undefined;
  const forward = index < STAGE_ORDER.length - 1 ? STAGE_ORDER[index + 1] : undefined;
  return { back, forward };
}

/**
 * Přesune zakázku do dané fáze. Tvar dat se nemění: nastaví se `leadStage` (pět původních hodnot) a `status`;
 * zaplacení doplní datum úhrady, návrat ze zaplacených ho odebere.
 */
export function moveJobStage(contract: Contract, target: JobStageKey, today: string): Contract {
  const { paidDate, ...rest } = contract;
  switch (target) {
    case 'inquiry':
      return { ...rest, leadStage: 'inquiry', status: 'draft' };
    case 'quote':
      return { ...rest, leadStage: 'quote', status: 'draft' };
    case 'contract':
      return { ...rest, leadStage: 'contract', status: contract.clientSignature ? 'signed' : 'draft' };
    case 'realization':
      return { ...rest, leadStage: 'realization', status: 'in_progress' };
    case 'handover':
      return { ...rest, leadStage: 'completed', status: 'handover_done' };
    case 'paid':
      return { ...rest, leadStage: 'completed', status: 'paid', paidDate: paidDate || today };
  }
}
