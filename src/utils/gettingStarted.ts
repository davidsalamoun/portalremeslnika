import { Contract, ContractorProfile } from '../types/contract';

/**
 * Průvodce prvním spuštěním na přehledu: čtyři kroky, které dělí nový účet od první smlouvy.
 * Krok je hotový podle skutečných dat, nic se zvlášť neukládá – jen volba „Skrýt“ na tomto zařízení.
 */
export type GettingStartedKey = 'profile' | 'signature' | 'client' | 'contract';

export interface GettingStartedStep {
  key: GettingStartedKey;
  title: string;
  hint: string;
  action: string;
  done: boolean;
}

export function getGettingStartedSteps(
  contractor: ContractorProfile | null | undefined,
  clientsCount: number,
  contracts: Pick<Contract, 'id'>[],
): GettingStartedStep[] {
  const profileDone = !!(contractor?.name?.trim() && contractor.ico?.trim() && contractor.address?.trim() && contractor.bankAccount?.trim());
  return [
    {
      key: 'profile',
      title: 'Vyplňte své údaje',
      hint: 'Stačí zadat IČO, jméno a sídlo se načtou z rejstříku ARES. Doplňte číslo účtu pro QR platbu na faktuře.',
      action: 'Otevřít Nastavení',
      done: profileDone,
    },
    {
      key: 'signature',
      title: 'Přidejte svůj podpis',
      hint: 'Podepíšete se jednou prstem nebo myší a podpis se vloží do každé smlouvy, protokolu i dokladu.',
      action: 'Přidat podpis',
      done: !!contractor?.signature,
    },
    {
      key: 'client',
      title: 'Zapište prvního klienta',
      hint: 'Jméno, adresa a telefon. Firmu dohledáte podle IČO.',
      action: 'Přidat klienta',
      done: clientsCount > 0 || contracts.length > 0,
    },
    {
      key: 'contract',
      title: 'Vytvořte první smlouvu nebo nabídku',
      hint: 'Vyberte šablonu podle řemesla, upravte cenu a termín. Faktura a předávací protokol vzniknou s ní.',
      action: 'Nová smlouva',
      done: contracts.length > 0,
    },
  ];
}

const HIDDEN_KEY = 'getting_started_hidden';

export function isGettingStartedHidden(): boolean {
  try {
    return localStorage.getItem(HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function hideGettingStarted(): void {
  try {
    localStorage.setItem(HIDDEN_KEY, '1');
  } catch {
    // bez přístupu k úložišti zůstane průvodce skrytý jen do zavření stránky
  }
}
