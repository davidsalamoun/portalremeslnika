import { Contract } from '../types/contract';

/**
 * Adresa, kde se zakázka provádí: vlastní adresa stavby, a když není vyplněná, adresa klienta.
 * Používá ji navigace, počasí, kalendář, kniha jízd a zprávy zákazníkovi. Do textu smlouvy se nepropisuje.
 */
export function getSiteAddress(contract: Pick<Contract, 'siteAddress' | 'client'>): string {
  return contract.siteAddress?.trim() || contract.client?.address || '';
}
