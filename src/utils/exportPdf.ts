import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Contract } from '../types/contract';
import { generateContractFilename } from './exportDocx';

/**
 * Vygeneruje a stáhne PDF soubor z HTML elementu smlouvy s podporou vícestránkového dělení
 * a českou diakritikou.
 */
export async function exportContractToPdf(
  contractElement: HTMLElement,
  contract: Contract,
  onProgress?: (status: string) => void
): Promise<void> {
  onProgress?.('Připravuji PDF dokument...');

  try {
    // Vytvoříme canvas s vysokým rozlišením (scale: 2 pro ostrost textu a menší zátěž paměti)
    const canvas = await html2canvas(contractElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: contractElement.scrollWidth,
    });

    onProgress?.('Zpracovávám stránky...');

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth(); // 210 mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // 297 mm

    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    // První stránka
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pdfHeight;

    // Další stránky, pokud je dokument delší než 1 stránka A4
    while (heightLeft > 0) {
      position = position - pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;
    }

    const filename = generateContractFilename(contract, 'pdf');
    pdf.save(filename);
    onProgress?.('PDF úspěšně staženo');
  } catch (err) {
    console.error('Chyba při exportu PDF:', err);
    throw err;
  }
}
