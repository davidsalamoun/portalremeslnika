import { Contract } from '../types/contract';

/**
 * Export do Wordu a PDF. Knihovny (docx, jspdf, html2canvas-pro) jsou velké, proto se stahují
 * až při prvním exportu – případně na pozadí po startu aplikace (viz preloadExportLibraries).
 */

const loadDocx = () => import('./exportDocx');
const loadPdf = () => import('./exportPdf');

export async function exportContractToDocx(contract: Contract): Promise<void> {
  const { exportContractToDocx: run } = await loadDocx();
  return run(contract);
}

export async function exportContractToPdf(
  contractElement: HTMLElement,
  contract: Contract,
  onProgress?: (status: string) => void,
  docName?: string
): Promise<void> {
  const { exportContractToPdf: run } = await loadPdf();
  return run(contractElement, contract, onProgress, docName);
}

/** Stáhne knihovny pro export předem, aby export fungoval i bez připojení. */
export function preloadExportLibraries(): Promise<unknown> {
  return Promise.all([loadDocx(), loadPdf()]);
}
