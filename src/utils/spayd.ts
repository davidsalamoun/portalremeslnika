import QRCode from 'qrcode';

function mod97(numericStr: string): number {
  // Velké číslo dělíme modulo 97 po blocích
  let remainder = 0;
  for (let i = 0; i < numericStr.length; i += 7) {
    const block = remainder.toString() + numericStr.substring(i, i + 7);
    remainder = parseInt(block, 10) % 97;
  }
  return remainder;
}

/**
 * Převede české číslo bankovního účtu na IBAN.
 * Formát účtu: [předčíslí-]číslo/kód_banky (např. 19-2345670237/0100 nebo 123456789/0800).
 * Mezery se ignorují. Přijme i přímo zadaný český IBAN. Při neplatném vstupu vrací prázdný řetězec.
 */
export function czAccountToIban(accountStr: string): string {
  const clean = (accountStr || '').replace(/\s+/g, '').toUpperCase();
  if (!clean) return '';

  // Přímo zadaný český IBAN: ověřit kontrolní číslice
  if (/^CZ\d{22}$/.test(clean)) {
    return mod97(`${clean.slice(4)}1235${clean.slice(2, 4)}`) === 1 ? clean : '';
  }

  const match = /^(?:(\d{1,6})-)?(\d{1,10})\/(\d{4})$/.exec(clean);
  if (!match) return '';

  const prefix = (match[1] || '').padStart(6, '0');
  const accountNumber = match[2].padStart(10, '0');
  const bankCode = match[3];

  // Pro výpočet kontrolních číslic dle MOD 97:
  // bbbbppppppccccccccccCZ00
  // CZ -> C=12, Z=35 => 123500
  const bban = `${bankCode}${prefix}${accountNumber}`;
  const checkDigits = (98 - mod97(`${bban}123500`)).toString().padStart(2, '0');
  return `CZ${checkDigits}${bban}`;
}

export interface SpaydPaymentOptions {
  account: string;      // číslo účtu (např. 123456789/0100)
  amount: number;       // částka v CZK
  vs?: string;          // variabilní symbol
  message?: string;     // zpráva pro příjemce
}

/**
 * Vytvoří řetězec SPAYD dle standardu České bankovní asociace (QR Platba)
 */
export function generateSpaydString(options: SpaydPaymentOptions): string {
  // SPAYD vyžaduje IBAN v parametru ACC; bez platného účtu ani částky QR platbu nevytváříme
  const iban = czAccountToIban(options.account);
  if (!iban || !Number.isFinite(options.amount) || options.amount < 0) return '';

  let spayd = `SPD*1.0*ACC:${iban}*AM:${options.amount.toFixed(2)}*CC:CZK`;

  if (options.vs) {
    const cleanVs = options.vs.replace(/\D/g, '').substring(0, 10);
    if (cleanVs) {
      spayd += `*X-VS:${cleanVs}`;
    }
  }

  if (options.message) {
    // Bez diakritiky (některé bankovní aplikace ji ve zprávě nečtou správně), bez hvězdiček, max 60 znaků
    const cleanMsg = options.message
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 60);
    if (cleanMsg) spayd += `*MSG:${cleanMsg}`;
  }

  spayd += '*';
  return spayd;
}

/**
 * Vygeneruje QR kód pro QR Platbu jako Data URL obrázek
 */
export async function generateQrPaymentDataUrl(options: SpaydPaymentOptions): Promise<string> {
  const spaydString = generateSpaydString(options);
  if (!spaydString) return '';
  try {
    const dataUrl = await QRCode.toDataURL(spaydString, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 220,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
    return dataUrl;
  } catch (err) {
    console.error('Chyba při generování QR Platby:', err);
    return '';
  }
}
