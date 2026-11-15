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
  /** Poloha na metru v procentech (0–100) */
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
  if (isContractPaid(contract) || contract.leadStage === 'completed') return 'paid';
  if (contract.status === 'handover_done' || contract.handoverData) return 'handover';
  if (contract.status === 'in_progress' || contract.leadStage === 'realization') return 'realization';
  if (contract.leadStage === 'inquiry') return 'inquiry';
  if (contract.docKind === 'quote' || contract.leadStage === 'quote') return 'quote';
  return 'contract';
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
      next = 'Předáno, čeká na zaplacení';
      break;
    case 'paid':
      next = 'Zaplaceno';
      break;
  }

  return { key, label, percent: STAGE_PERCENT[key], next };
}

/** Rozpracovaná zakázka = cokoli, co ještě není zaplacené. */
export function isActiveJob(contract: Contract): boolean {
  return getJobStage(contract).key !== 'paid';
}
