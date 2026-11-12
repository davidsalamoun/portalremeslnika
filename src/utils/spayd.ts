import QRCode from 'qrcode';

/**
 * Převede české číslo bankovního účtu na IBAN.
 * Formát účtu: [předčíslí-]číslo/kód_banky (např. 19-2345670237/0100 nebo 123456789/0800)
 */
export function czAccountToIban(accountStr: string): string {
  try {
    const clean = accountStr.trim();
    const parts = clean.split('/');
    if (parts.length !== 2) return '';

    const bankCode = parts[1].padStart(4, '0');
    const accParts = parts[0].split('-');

    let prefix = '000000';
    let accountNumber = '';

    if (accParts.length === 2) {
      prefix = accParts[0].padStart(6, '0');
      accountNumber = accParts[1].padStart(10, '0');
    } else {
      accountNumber = accParts[0].padStart(10, '0');
    }

    // Pro výpočet kontrolních číslic dle MOD 97:
    // bbbbppppppccccccccccCZ00
    // CZ -> C=12, Z=35 => 123500
    const bban = `${bankCode}${prefix}${accountNumber}`;
    const numericStr = `${bban}123500`;

    // Velké číslo dělíme modulo 97 po blocích
    let remainder = 0;
    for (let i = 0; i < numericStr.length; i += 7) {
      const block = remainder.toString() + numericStr.substring(i, i + 7);
      remainder = parseInt(block, 10) % 97;
    }

    const checkDigits = (98 - remainder).toString().padStart(2, '0');
    return `CZ${checkDigits}${bban}`;
  } catch (e) {
    console.error('Chyba při výpočtu IBAN:', e);
    return '';
  }
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
  const iban = czAccountToIban(options.account);
  // SPAYD vyžaduje IBAN v parametru ACC
  const accParam = iban ? iban : options.account.replace(/[^0-9/-]/g, '');

  let spayd = `SPD*1.0*ACC:${accParam}*AM:${options.amount.toFixed(2)}*CC:CZK`;

  if (options.vs) {
    const cleanVs = options.vs.replace(/\D/g, '').substring(0, 10);
    if (cleanVs) {
      spayd += `*X-VS:${cleanVs}`;
    }
  }

  if (options.message) {
    // Odstranění hvězdiček a oříznutí na max 60 znaků
    const cleanMsg = options.message.replace(/\*/g, ' ').substring(0, 60);
    spayd += `*MSG:${cleanMsg}`;
  }

  spayd += '*';
  return spayd;
}

/**
 * Vygeneruje QR kód pro QR Platbu jako Data URL obrázek
 */
export async function generateQrPaymentDataUrl(options: SpaydPaymentOptions): Promise<string> {
  const spaydString = generateSpaydString(options);
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
