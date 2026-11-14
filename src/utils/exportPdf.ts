import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { Contract } from '../types/contract';
import { generateContractFilename } from './exportNames';

/**
 * Vygeneruje a stáhne PDF soubor z HTML elementu smlouvy s podporou vícestránkového dělení
 * a českou diakritikou.
 */
export async function exportContractToPdf(
  contractElement: HTMLElement,
  contract: Contract,
  onProgress?: (status: string) => void,
  docName?: string
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
      // Ovládací prvky určené jen pro obrazovku (tlačítka na dokumentu) do PDF nepatří, stejně jako do tisku
      ignoreElements: (el) => el.classList?.contains('no-print') ?? false,
    });

    onProgress?.('Zpracovávám stránky...');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth(); // 210 mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // 297 mm
    const pxPerMm = canvas.width / pdfWidth;
    const pageHeightPx = Math.floor(pdfHeight * pxPerMm);
    // Strany se dělí v mezeře mezi řádky, ne uprostřed textu. Od druhé strany se nahoře i dole nechává okraj;
    // pokud by kvůli němu vyšla poslední strana skoro prázdná (jen patička), zkusí se menší okraj.
    let topMarginMm = 0;
    let slices: PageSlice[] = [];
    for (const marginMm of [12, 8, 4, 0]) {
      topMarginMm = marginMm;
      slices = computePageSlices(canvas, pageHeightPx, Math.round(marginMm * pxPerMm));
      const last = slices[slices.length - 1];
      if (slices.length === 1 || last.end - last.start >= pageHeightPx * 0.15) break;
    }

    slices.forEach((slice, index) => {
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = slice.end - slice.start;
      const ctx = pageCanvas.getContext('2d');
      if (!ctx) throw new Error('Nelze vytvořit stránku PDF');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(canvas, 0, slice.start, canvas.width, pageCanvas.height, 0, 0, canvas.width, pageCanvas.height);

      if (index > 0) pdf.addPage();
      pdf.addImage(
        pageCanvas.toDataURL('image/jpeg', 0.95),
        'JPEG',
        0,
        index === 0 ? 0 : topMarginMm,
        pdfWidth,
        pageCanvas.height / pxPerMm,
        undefined,
        'FAST'
      );
    });

    const filename = generateContractFilename(contract, 'pdf', docName);
    pdf.save(filename);
    onProgress?.('PDF úspěšně staženo');
  } catch (err) {
    console.error('Chyba při exportu PDF:', err);
    throw err;
  }
}

interface PageSlice {
  start: number;
  end: number;
}

/**
 * Rozdělí vykreslený dokument na strany. Místo řezu se hledá směrem nahoru od konce strany v řádku
 * pixelů bez textu (mezera mezi řádky nebo odstavci). Když se žádný nenajde (např. velký obrázek),
 * řeže se přesně na hraně strany.
 */
function computePageSlices(canvas: HTMLCanvasElement, pageHeightPx: number, topMarginPx: number): PageSlice[] {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const slices: PageSlice[] = [];
  let start = 0;

  while (start < canvas.height) {
    const available = slices.length === 0 ? pageHeightPx : pageHeightPx - topMarginPx;
    // Zbytek, který se na stranu vejde (s drobnou tolerancí na rámeček papíru), je poslední strana
    if (start + available + pageHeightPx * 0.02 >= canvas.height) {
      slices.push({ start, end: Math.min(canvas.height, start + available) });
      break;
    }
    // Dole se nechává okraj stejně jako nahoře
    const hardEnd = start + available - topMarginPx;
    const end = ctx ? findSafeBreak(ctx, canvas.width, hardEnd, Math.floor(available * 0.25)) ?? hardEnd : hardEnd;
    slices.push({ start, end });
    start = end;
  }

  // Poslední strana jen s prázdným okrajem papíru se nevytváří
  const last = slices[slices.length - 1];
  if (slices.length > 1 && ctx && isRegionBlank(ctx, canvas.width, last.start, last.end)) slices.pop();
  return slices;
}

/** Řádek pixelů je vhodný pro řez, pokud v něm není nic tmavého (text, čára podpisu, tmavý pruh). */
function rowHasInk(data: Uint8ClampedArray, width: number, row: number): boolean {
  const offset = row * width * 4;
  // Stačí vzorkovat každý druhý pixel
  for (let x = 0; x < width; x += 2) {
    const i = offset + x * 4;
    const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (luminance < 170) return true;
  }
  return false;
}

function findSafeBreak(
  ctx: CanvasRenderingContext2D,
  width: number,
  hardEnd: number,
  searchHeight: number
): number | null {
  const top = Math.max(0, hardEnd - searchHeight);
  const height = hardEnd - top;
  if (height <= 0) return null;
  const data = ctx.getImageData(0, top, width, height).data;
  const minGap = 4; // alespoň několik prázdných řádků pixelů za sebou

  let gapEnd = -1;
  for (let row = height - 1; row >= 0; row--) {
    if (!rowHasInk(data, width, row)) {
      if (gapEnd === -1) gapEnd = row;
      if (gapEnd - row + 1 >= minGap) {
        // Najít celý rozsah mezery a říznout v jejím středu
        let gapStart = row;
        while (gapStart > 0 && !rowHasInk(data, width, gapStart - 1)) gapStart--;
        return top + Math.round((gapStart + gapEnd) / 2);
      }
    } else {
      gapEnd = -1;
    }
  }
  return null;
}

function isRegionBlank(ctx: CanvasRenderingContext2D, width: number, start: number, end: number): boolean {
  const height = end - start;
  if (height <= 0) return true;
  const data = ctx.getImageData(0, start, width, height).data;
  for (let row = 0; row < height; row++) if (rowHasInk(data, width, row)) return false;
  return true;
}
