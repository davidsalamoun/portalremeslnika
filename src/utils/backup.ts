import { AppBackupData, ContractorProfile, Client, Contract } from '../types/contract';
import {
  getContractorProfile,
  getStoredClients,
  getStoredContracts,
  saveContractorProfile,
  saveStoredClients,
  saveStoredContracts,
} from './storage';

/**
 * Vygeneruje kompletní JSON zálohu všech dat a nabídne její stažení.
 */
export function exportAppBackup(): void {
  const contractor = getContractorProfile();
  const clients = getStoredClients();
  const contracts = getStoredContracts();

  const backupData: AppBackupData = {
    version: '1.2.0',
    exportedAt: new Date().toISOString(),
    contractor,
    clients,
    contracts,
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().split('T')[0];
  const a = document.createElement('a');
  a.href = url;
  a.download = `smlouvy-remeslnik-zaloha-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Ověří a načte data ze záložního JSON textu.
 */
export function parseBackupFile(jsonString: string): AppBackupData {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Soubor není platný formát JSON.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Neplatná struktura dat v záložním souboru.');
  }

  if (!Array.isArray(parsed.clients) || !Array.isArray(parsed.contracts)) {
    throw new Error('Záložní soubor neobsahuje platný seznam klientů nebo smluv.');
  }

  return {
    version: parsed.version || '1.0.0',
    exportedAt: parsed.exportedAt || new Date().toISOString(),
    contractor: parsed.contractor || null,
    clients: parsed.clients || [],
    contracts: parsed.contracts || [],
  };
}

/**
 * Aplikuje zálohu do localStorage.
 * @param mode 'replace' (přepíše vše) nebo 'merge' (sloučí unikátní klienty a smlouvy)
 */
export function applyBackup(
  backup: AppBackupData,
  mode: 'replace' | 'merge' = 'replace'
): {
  contractor: ContractorProfile | null;
  clients: Client[];
  contracts: Contract[];
} {
  if (mode === 'replace') {
    if (backup.contractor) {
      saveContractorProfile(backup.contractor);
    }
    saveStoredClients(backup.clients);
    saveStoredContracts(backup.contracts);

    return {
      contractor: backup.contractor || getContractorProfile(),
      clients: backup.clients,
      contracts: backup.contracts,
    };
  }

  // Sloučení (merge)
  const currentContractor = getContractorProfile();
  const nextContractor = backup.contractor || currentContractor;
  if (nextContractor) {
    saveContractorProfile(nextContractor);
  }

  const existingClients = getStoredClients();
  const clientIds = new Set(existingClients.map((c) => c.id));
  const mergedClients = [...existingClients];
  for (const client of backup.clients) {
    if (!clientIds.has(client.id)) {
      mergedClients.push(client);
      clientIds.add(client.id);
    }
  }
  saveStoredClients(mergedClients);

  const existingContracts = getStoredContracts();
  const contractIds = new Set(existingContracts.map((c) => c.id));
  const mergedContracts = [...existingContracts];
  for (const contract of backup.contracts) {
    if (!contractIds.has(contract.id)) {
      mergedContracts.push(contract);
      contractIds.add(contract.id);
    }
  }
  saveStoredContracts(mergedContracts);

  return {
    contractor: nextContractor,
    clients: mergedClients,
    contracts: mergedContracts,
  };
}
