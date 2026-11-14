import { Contract } from '../types/contract';

// Názvy exportovaných souborů. Samostatně, aby se kvůli nim nenačítaly knihovny pro Word a PDF.

function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');
}

export function getClientSurnameOrName(clientName: string): string {
  const parts = clientName.trim().split(/\s+/);
  // Pokud je to "Jméno Příjmení", vezmeme poslední slovo (Příjmení)
  const surname = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  return sanitizeFilename(surname || 'klient');
}

export function generateContractFilename(
  contract: Contract,
  extension: 'docx' | 'pdf',
  docName = 'Smlouva_o_dilo'
): string {
  const surname = getClientSurnameOrName(contract.client.name);
  const dateFormatted = contract.conclusionDate || new Date().toISOString().split('T')[0];
  return `${docName}_${surname}_${dateFormatted}.${extension}`;
}
