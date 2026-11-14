import { Contract } from '../types/contract';
import {
  formatCurrency,
  formatDateCs,
  formatSignedCurrency,
} from './numberToWordsCs';

export type ShareDocType =
  | 'smlouva'
  | 'protokol'
  | 'faktura'
  | 'zaloha'
  | 'nabidka'
  | 'dodatek'
  | 'pokladni_doklad'
  | 'zaruka';

/**
 * Vygeneruje text zprávy pro klienta (vhodný do WhatsAppu, SMS i e-mailu).
 */
export function buildShareMessage(contract: Contract, docType: ShareDocType): {
  subject: string;
  body: string;
  shortSummary: string;
} {
  const contractorName = contract.contractor.name;
  const contractorPhone = contract.contractor.phone;
  const clientName = contract.client.name;
  const vs = (contract.variableSymbol || contract.invoiceNumber || '2026001').replace(/\D/g, '');
  const bankAccount = contract.contractor.bankAccount;

  if (docType === 'nabidka') {
    const quoteNum = contract.quoteNumber || `CN-${contract.contractNumber.replace(/[^0-9]/g, '') || '01'}`;
    const subject = `Cenová nabídka ${quoteNum} – ${contractorName}`;
    const body = `Dobrý den, ${clientName},

zasílám vypracovanou cenovou nabídku a kalkulaci na realizaci zakázky:
"${contract.workDescription}"

• Celková kalkulovaná cena: ${formatCurrency(contract.price)}
• Předpokládaný termín dokončení: ${formatDateCs(contract.deliveryDate)}
• Záruční doba: 24 měsíců

Detailní položkový rozpis i podmínky naleznete v příloze. V případě zájmu o realizaci nabídku obratem potvrdíme a převedeme do smlouvy o dílo.

Máte-li jakékoliv dotazy, neváhejte mi zavolat na tel. ${contractorPhone}.

S pozdravem,
${contractorName}`;

    return {
      subject,
      body,
      shortSummary: `Cenová nabídka ${quoteNum} (${formatCurrency(contract.price)})`,
    };
  }

  if (docType === 'dodatek') {
    const lastAmend = contract.amendments && contract.amendments.length > 0
      ? contract.amendments[contract.amendments.length - 1]
      : null;
    const amendNum = lastAmend ? lastAmend.amendmentNumber : 1;
    const amendPrice = lastAmend ? lastAmend.priceDifference : 0;
    const subject = `Dodatek č. ${amendNum} ke smlouvě o dílo ${contract.contractNumber} – ${contractorName}`;
    const body = `Dobrý den, ${clientName},

v návaznosti na naši dohodu ohledně víceprací na stavbě zasílám Dodatek č. ${amendNum} ke Smlouvě o dílo č. ${contract.contractNumber}:
"${lastAmend?.title || 'Vícepráce a úprava rozsahu díla'}"

• Cena víceprací: ${formatSignedCurrency(amendPrice)}
${lastAmend?.newDeliveryDate ? `• Nový termín dokončení: ${formatDateCs(lastAmend.newDeliveryDate)}\n` : ''}
Dodatek si můžete prohlédnout a podepsat v přiloženém dokumentu.

S pozdravem,
${contractorName}
Tel.: ${contractorPhone}`;

    return {
      subject,
      body,
      shortSummary: `Dodatek č. ${amendNum} (${formatSignedCurrency(amendPrice)}) ke smlouvě ${contract.contractNumber}`,
    };
  }

  if (docType === 'pokladni_doklad') {
    const lastReceipt = contract.cashReceipts && contract.cashReceipts.length > 0
      ? contract.cashReceipts[contract.cashReceipts.length - 1]
      : null;
    const recNum = lastReceipt ? lastReceipt.receiptNumber : 'PPD';
    const recAmount = lastReceipt ? lastReceipt.amount : (contract.advanceAmount || contract.price);
    const subject = `Příjmový pokladní doklad ${recNum} – ${contractorName}`;
    const body = `Dobrý den, ${clientName},

potvrzuji přijetí platby v hotovosti ke smlouvě o dílo č. ${contract.contractNumber}:

• Přijatá částka: ${formatCurrency(recAmount)}
• Účel: ${lastReceipt?.purposeDescription || 'Úhrada díla / zálohy'}
• Datum převzetí: ${lastReceipt ? formatDateCs(lastReceipt.issueDate) : formatDateCs(new Date().toISOString().split('T')[0])}

Oficiální Příjmový pokladní doklad ${recNum} naleznete v příloze.

Děkuji,
${contractorName}
Tel.: ${contractorPhone}`;

    return {
      subject,
      body,
      shortSummary: `Pokladní doklad ${recNum} na ${formatCurrency(recAmount)}`,
    };
  }

  if (docType === 'zaloha') {
    const advance = contract.advanceAmount || Math.round(contract.price * 0.4);
    const subject = `Zálohová faktura ZAL-${contract.invoiceNumber} – ${contractorName}`;
    const body = `Dobrý den, ${clientName},

zasílám podklady k úhradě sjednané zálohy na zakázku:
"${contract.workDescription}"

• Částka k úhradě: ${formatCurrency(advance)}
• Číslo účtu: ${bankAccount}
• Variabilní symbol: ${vs}
• Termín dokončení prací: ${formatDateCs(contract.deliveryDate)}

Po připsání zálohy zahajujeme práce dle sjednané smlouvy o dílo ${contract.contractNumber}.
Fakturu i QR platbu najdete v příloze.

V případě dotazů mě neváhejte kontaktovat na tel. ${contractorPhone}.

S pozdravem,
${contractorName}`;

    return {
      subject,
      body,
      shortSummary: `Záloha ${formatCurrency(advance)} na účet ${bankAccount} (VS ${vs})`,
    };
  }

  if (docType === 'faktura') {
    const subject = `Konečná faktura FA-${contract.invoiceNumber} – ${contractorName}`;
    const body = `Dobrý den, ${clientName},

dílo bylo úspěšně dokončeno a předáno. Zasílám konečnou fakturu za provedené práce:
"${contract.workDescription}"

• Celková částka k úhradě: ${formatCurrency(contract.price)}
• Číslo účtu: ${bankAccount}
• Variabilní symbol: ${vs}
• Splatnost: 14 dní

Fakturu s QR kódem pro snadnou platbu v mobilním bankovnictví naleznete v příloze.

Děkuji za skvělou spolupráci a důvěru.

S pozdravem,
${contractorName}
Tel.: ${contractorPhone}`;

    return {
      subject,
      body,
      shortSummary: `Faktura ${formatCurrency(contract.price)} na účet ${bankAccount} (VS ${vs})`,
    };
  }

  if (docType === 'protokol') {
    const subject = `Předávací protokol k dílu – ${contract.contractNumber} – ${contractorName}`;
    const body = `Dobrý den, ${clientName},

v návaznosti na dokončení zakázky "${contract.workDescription}" zasílám k nahlédnutí Předávací protokol k dílu č. ${contract.contractNumber}.

Dnem podpisu protokolu začíná běžet sjednaná záruční doba v délce 24 měsíců.
Dokument si můžete zkontrolovat v příloze.

S pozdravem,
${contractorName}
Tel.: ${contractorPhone}`;

    return {
      subject,
      body,
      shortSummary: `Předávací protokol k dílu ${contract.contractNumber}`,
    };
  }

  if (docType === 'zaruka') {
    const warrantyNum = contract.warranty?.warrantyNumber || `ZL-${contract.contractNumber.replace(/\D/g, '') || '01'}`;
    const months = contract.warranty?.warrantyPeriodMonths || 24;
    const subject = `Záruční list ${warrantyNum} – ${contractorName}`;
    const body = `Dobrý den, ${clientName},

zasílám vystavený Záruční list (Garanční certifikát) k dokončenému dílu:
"${contract.workDescription}"

• Délka záruční doby: ${months} měsíců
• Platnost záruky do: ${formatDateCs(contract.warranty?.warrantyValidUntil || contract.deliveryDate)}
• Servisní kontakt: ${contractorPhone}

Kompletní záruční list s garancí a podmínkami péče si můžete zkontrolovat v příloze. Děkuji za spolupráci a důvěru!

S pozdravem,
${contractorName}
Tel.: ${contractorPhone}`;

    return {
      subject,
      body,
      shortSummary: `Záruční list ${warrantyNum} (${months} měsíců záruka)`,
    };
  }

  // Výchozí: Smlouva o dílo
  const subject = `Smlouva o dílo č. ${contract.contractNumber} – ${contractorName}`;
  const advanceText = contract.advanceAmount
    ? `\n• Sjednaná záloha: ${formatCurrency(contract.advanceAmount)}`
    : '';

  const body = `Dobrý den, ${clientName},

zasílám připravenou Smlouvu o dílo č. ${contract.contractNumber} na realizaci:
"${contract.workDescription}"

• Celková sjednaná cena: ${formatCurrency(contract.price)}${advanceText}
• Termín předání díla: ${formatDateCs(contract.deliveryDate)}
• Sjednaná záruka: 24 měsíců

Smlouvu si prosím prohlédněte v příloze (PDF/Word). Lze ji podepsat i přímo digitálně na mobilu nebo tabletu.

V případě jakýchkoliv dotazů jsem vám plně k dispozici.

S pozdravem,
${contractorName}
Tel.: ${contractorPhone}`;

  return {
    subject,
    body,
    shortSummary: `Smlouva o dílo ${contract.contractNumber} (${formatCurrency(contract.price)})`,
  };
}

/**
 * Očistí telefonní číslo a připraví mezinárodní formát pro WhatsApp
 */
export function sanitizePhoneForWhatsApp(phone: string): string {
  // Odstranění mezer, pomlček, závorek
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }
  // Pokud začíná devíti číslicemi bez předvolby (např. 777123456), přidáme českou předvolbu +420
  if (/^[1-9]\d{8}$/.test(cleaned)) {
    cleaned = '+420' + cleaned;
  }
  // WhatsApp vyžaduje číslo bez znaku +
  return cleaned.replace('+', '');
}

/**
 * Vygeneruje přímý odkaz pro WhatsApp Web / aplikaci
 */
export function getDirectWhatsAppUrl(messageText: string, rawPhone?: string): string {
  const encodedText = encodeURIComponent(messageText);
  if (rawPhone) {
    const phone = sanitizePhoneForWhatsApp(rawPhone);
    if (phone) {
      return `https://wa.me/${phone}?text=${encodedText}`;
    }
  }
  return `https://wa.me/?text=${encodedText}`;
}

/**
 * Vygeneruje přímý odkaz pro WhatsApp Web / aplikaci
 */
export function getWhatsAppShareUrl(contract: Contract, docType: ShareDocType): string {
  const { body } = buildShareMessage(contract, docType);
  const rawPhone = contract.client.phone || '';
  const phone = sanitizePhoneForWhatsApp(rawPhone);
  const encodedText = encodeURIComponent(body);

  if (phone) {
    return `https://wa.me/${phone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}

/**
 * Vygeneruje mailto odkaz pro otevření e-mailového klienta
 */
export function getMailtoShareUrl(contract: Contract, docType: ShareDocType): string {
  const { subject, body } = buildShareMessage(contract, docType);
  const clientEmail = contract.client.email || '';
  return `mailto:${encodeURIComponent(clientEmail)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}

/**
 * Bezpečně otevře externí odkaz (např. WhatsApp, telefon, e-mail) i v sandboxovaném iframe
 * bez vyvolání blokace vyskakovacích oken.
 */
export function safeOpenExternalUrl(url: string): boolean {
  try {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch (err) {
    console.warn('safeOpenExternalUrl error:', err);
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
      return true;
    } catch {
      return false;
    }
  }
}
