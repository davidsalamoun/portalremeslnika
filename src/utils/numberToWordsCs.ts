/**
 * Převod celého čísla na slova v češtině.
 * Podporuje standardní české číslovky od 0 do 999 999 999 999.
 *
 * Příklad:
 * 1111 => "jedentisícjednostojedenáct" (při compact: true)
 *         "jeden tisíc jedno sto jedenáct" (při compact: false)
 */

const ONES = ['', 'jeden', 'dva', 'tři', 'čtyři', 'pět', 'šest', 'sedm', 'osm', 'devět'];
const TEENS = [
  'deset',
  'jedenáct',
  'dvanáct',
  'třináct',
  'čtrnáct',
  'patnáct',
  'šestnáct',
  'sedmnáct',
  'osmnáct',
  'devatenáct',
];
const TENS = ['', 'deset', 'dvacet', 'třicet', 'čtyřicet', 'padesát', 'šedesát', 'sedmdesát', 'osmdesát', 'devadesát'];
const HUNDREDS = [
  '',
  'jedno sto',
  'dvě stě',
  'tři sta',
  'čtyři sta',
  'pět set',
  'šest set',
  'sedm set',
  'osm set',
  'devět set',
];

const HUNDREDS_COMPACT = [
  '',
  'jednosto',
  'dvěstě',
  'třista',
  'čtyřista',
  'pětset',
  'šestset',
  'sedmset',
  'osmset',
  'devětset',
];

function convertGroupOfThree(num: number, compact: boolean): string[] {
  const parts: string[] = [];
  const h = Math.floor(num / 100);
  const remainder = num % 100;

  if (h > 0) {
    parts.push(compact ? HUNDREDS_COMPACT[h] : HUNDREDS[h]);
  }

  if (remainder >= 10 && remainder <= 19) {
    parts.push(TEENS[remainder - 10]);
  } else {
    const t = Math.floor(remainder / 10);
    const o = remainder % 10;
    if (t > 0) parts.push(TENS[t]);
    if (o > 0) parts.push(ONES[o]);
  }

  return parts;
}

/**
 * @param feminine true pro počítání podstatných jmen ženského rodu (koruna): „jedna“, „dvě“ místo „jeden“, „dva“
 */
export function numberToWordsCs(amount: number, compact = true, feminine = false): string {
  if (!Number.isFinite(amount)) return 'nula';
  const n = Math.floor(Math.abs(amount));
  if (n === 0) return 'nula';

  const billions = Math.floor(n / 1_000_000_000) % 1000;
  const millions = Math.floor(n / 1_000_000) % 1000;
  const thousands = Math.floor(n / 1_000) % 1000;
  const units = n % 1000;

  const resultParts: string[] = [];
  const sep = compact ? '' : ' ';

  // Miliardy (ženský rod: jedna miliarda, dvě miliardy)
  if (billions > 0) {
    const bParts = convertGroupOfThree(billions, compact);
    applyFeminine(bParts, billions);
    let bSuffix = 'miliard';
    if (billions === 1) bSuffix = 'miliarda';
    else if (billions >= 2 && billions <= 4) bSuffix = 'miliardy';
    resultParts.push(`${bParts.join(sep)}${sep}${bSuffix}`);
  }

  // Miliony
  if (millions > 0) {
    const mWords = convertGroupOfThree(millions, compact).join(sep);
    let mSuffix = 'milionů';
    if (millions === 1) mSuffix = 'milion';
    else if (millions >= 2 && millions <= 4) mSuffix = 'miliony';

    resultParts.push(`${mWords}${sep}${mSuffix}`);
  }

  // Tisíce
  if (thousands > 0) {
    let tSuffix = 'tisíc';
    if (thousands === 1) {
      resultParts.push(compact ? 'jedentisíc' : 'jeden tisíc');
    } else {
      const tWords = convertGroupOfThree(thousands, compact).join(sep);
      if (thousands >= 2 && thousands <= 4) {
        tSuffix = 'tisíce';
      }
      resultParts.push(`${tWords}${sep}${tSuffix}`);
    }
  }

  // Jednotky (stovky, desítky, jednotky)
  if (units > 0) {
    const uParts = convertGroupOfThree(units, compact);
    if (feminine) applyFeminine(uParts, units);
    resultParts.push(uParts.join(sep));
  }

  return resultParts.join(sep);
}

// Poslední číslovku skupiny převede do ženského rodu (jeden → jedna, dva → dvě), mimo 11–19
function applyFeminine(parts: string[], group: number): void {
  const lastTwo = group % 100;
  if (lastTwo >= 10 && lastTwo <= 19) return;
  const last = parts.length - 1;
  if (group % 10 === 1) parts[last] = 'jedna';
  else if (group % 10 === 2) parts[last] = 'dvě';
}

/**
 * Částka slovy včetně měny ve správném tvaru: „jedna koruna česká“, „dvě koruny české“,
 * „osmdesátpěttisíc korun českých“. Záporná částka (méněpráce) začíná slovem „minus“.
 */
export function amountInWordsCzk(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const whole = Math.floor(Math.abs(safe));
  const words = numberToWordsCs(whole, true, true);

  let currencyDeclension = 'korun českých';
  const lastTwo = whole % 100;
  const lastOne = whole % 10;
  if (whole > 0 && (lastTwo < 10 || lastTwo > 20)) {
    if (lastOne === 1) {
      currencyDeclension = 'koruna česká';
    } else if (lastOne >= 2 && lastOne <= 4) {
      currencyDeclension = 'koruny české';
    }
  }

  return `${safe < 0 && whole > 0 ? 'minus ' : ''}${words} ${currencyDeclension}`;
}

/**
 * Zformátuje cenu včetně slovního vyjádření dle českých právních zvyklostí.
 * Příklad: "1 111 Kč, slovy jedentisícjednostojedenáct korun českých"
 */
export function formatContractPriceWithWords(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const formattedNumber = new Intl.NumberFormat('cs-CZ').format(safe);
  return `${formattedNumber} Kč, slovy ${amountInWordsCzk(safe)}`;
}

/**
 * Standardní české formátování částky (např. 15 000 Kč)
 */
export function formatCurrency(amount: number): string {
  return `${new Intl.NumberFormat('cs-CZ').format(amount)} Kč`;
}

/**
 * Částka se znaménkem pro vícepráce a méněpráce: „+4 502 Kč“, „−1 200 Kč“.
 */
export function formatSignedCurrency(amount: number): string {
  const abs = formatCurrency(Math.abs(amount));
  return amount < 0 ? `−${abs}` : `+${abs}`;
}

/**
 * České formátování data (např. 13. 10. 2026)
 */
export function formatDateCs(dateString?: string): string {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  if (!year || !month || !day) return dateString;
  return `${parseInt(day, 10)}. ${parseInt(month, 10)}. ${year}`;
}

/**
 * Odstraní případnou předložku "v" nebo "ve", uvozovky a přebytečné mezery z názvu místa.
 * Zajišťuje, že v proměnné zůstane pouze čistý název města v 6. pádě (např. "Praze", "Brně").
 */
export function cleanPlaceName(rawPlace?: string): string {
  if (!rawPlace) return '';
  return rawPlace
    .trim()
    .replace(/^["'„“\s]*(v|ve)\s+/i, '')
    .replace(/["'”\s]+$/, '')
    .trim();
}

/**
 * Správně naformátuje místo uzavření smlouvy s českou předložkou V / Ve.
 * Zabraňuje zdvojení "V v Praze" i chybějící předložce.
 *
 * Příklady:
 * "Praze" => "V Praze"
 * "v Praze" nebo "V Praze" => "V Praze"
 * "ve Vsetíně" nebo "Vsetíně" => "Ve Vsetíně"
 * "Brně" => "V Brně"
 * "" => "V místě plnění"
 */
export function formatPlaceWithPreposition(rawPlace?: string): string {
  const cleaned = cleanPlaceName(rawPlace);
  if (!cleaned) {
    return 'V místě plnění';
  }

  // Vokalizace předložky: před V a F používá čeština "Ve" (např. Ve Vsetíně, Ve Frýdku)
  const needsVe = /^[vf]/i.test(cleaned);
  const prep = needsVe ? 'Ve' : 'V';

  return `${prep} ${cleaned}`;
}

/**
 * Zformátuje celou závěrečnou datovací formulku smlouvy či protokolu:
 * např. "V Praze dne 13. 10. 2026" nebo "Ve Vsetíně dne 13. 10. 2026"
 */
export function formatContractConclusionLine(rawPlace?: string, dateString?: string): string {
  const placeWithPrep = formatPlaceWithPreposition(rawPlace);
  const dateFormatted = formatDateCs(dateString);
  return dateFormatted ? `${placeWithPrep} dne ${dateFormatted}` : `${placeWithPrep} dne ____________`;
}

