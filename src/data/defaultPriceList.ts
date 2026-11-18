import type { PriceListTemplateItem } from '../types/contract';

/** Výchozí (ukázkový) ceník nového účtu – ceny jsou ukázkové, uživatel si je má přepsat na své. */
export const DEFAULT_PRICE_LIST_ITEMS: Omit<PriceListTemplateItem, 'id'>[] = [
  // Práce
  { category: 'Hodinové sazby a doprava', type: 'prace', title: 'Hodinová sazba řemeslníka', unit: 'hod', unitPrice: 550, description: 'Běžné montážní a servisní práce' },
  { category: 'Hodinové sazby a doprava', type: 'prace', title: 'Havarijní zásah / víkendový příplatek', unit: 'hod', unitPrice: 850, description: 'Práce mimo běžnou pracovní dobu' },
  { category: 'Hodinové sazby a doprava', type: 'ostatni', title: 'Doprava na stavbu', unit: 'km', unitPrice: 12, description: 'Paušální sazba za km tam i zpět' },
  { category: 'Obklady a dlažby', type: 'prace', title: 'Pokládka keramického obkladu / dlažby', unit: 'm²', unitPrice: 650, description: 'Standardní formát do 60x60 cm' },
  { category: 'Obklady a dlažby', type: 'prace', title: 'Pokládka velkoformátové dlažby', unit: 'm²', unitPrice: 950, description: 'Formáty nad 60x120 cm včetně manipulace' },
  { category: 'Obklady a dlažby', type: 'prace', title: 'Penetrace podkladu', unit: 'm²', unitPrice: 40, description: 'Hloubková penetrace podlah a stěn' },
  { category: 'Obklady a dlažby', type: 'prace', title: 'Dvousložková hydroizolace včetně pásek', unit: 'm²', unitPrice: 140, description: '2x vrstva hydroizolační stěrky' },
  { category: 'Obklady a dlažby', type: 'prace', title: 'Spárování a silikonování koutů', unit: 'bm', unitPrice: 65, description: 'Elastické silikonování styčných spár' },
  { category: 'Sádrokartony', type: 'prace', title: 'Montáž SDK příčky (jednoduché opláštění)', unit: 'm²', unitPrice: 480, description: 'Konstrukce CW/UW včetně minerální izolace' },
  { category: 'Sádrokartony', type: 'prace', title: 'Montáž SDK podhledu', unit: 'm²', unitPrice: 520, description: 'Závěsný rošt CD/UD s deskou RB 12.5mm' },
  { category: 'Sádrokartony', type: 'prace', title: 'Tmelení a broušení spár (stupeň Q2-Q3)', unit: 'm²', unitPrice: 95, description: 'Tmelení s výztužnou páskou a přebroušení' },
  { category: 'Elektroinstalace', type: 'prace', title: 'Vysekání drážky ve zdivu pro kabel', unit: 'bm', unitPrice: 110, description: 'Drážkování ve vápennocementové omítce/cihle' },
  { category: 'Elektroinstalace', type: 'prace', title: 'Osazení a zapojení zásuvky / vypínače', unit: 'ks', unitPrice: 160, description: 'Kompletace v krabici KU68' },
  { category: 'Elektroinstalace', type: 'prace', title: 'Zapojení a kompletace rozvaděče', unit: 'kpl', unitPrice: 3500, description: 'Osazení jističů, chráničů a popis okruhů' },
  { category: 'Instalatérské práce', type: 'prace', title: 'Montáž a zapojení závěsného WC (Geberit)', unit: 'ks', unitPrice: 1800, description: 'Kotvení modulu a napojení na odpad DN100' },
  { category: 'Instalatérské práce', type: 'prace', title: 'Montáž umyvadlové / vanové baterie', unit: 'ks', unitPrice: 550, description: 'Osazení baterie a tlakové propojení roháčků' },
  { category: 'Instalatérské práce', type: 'prace', title: 'Rozvody vody v plastu (PPR) - 1 vývod', unit: 'ks', unitPrice: 750, description: 'Přivedení teplé a studené vody k zařizovacímu předmětu' },
  { category: 'Malířské práce', type: 'prace', title: 'Malování bílé 2x nátěr (např. Primalex Plus)', unit: 'm²', unitPrice: 65, description: 'Včetně zakrytí podlah a oken fólií' },
  { category: 'Malířské práce', type: 'prace', title: 'Škrábání staré nesoudržné malby', unit: 'm²', unitPrice: 45, description: 'Odstranění starých vrstev ze zdiva' },
  // Materiál
  { category: 'Stavební materiály', type: 'material', title: 'Flexibilní lepidlo C2TE S1 (25 kg)', unit: 'bal', unitPrice: 340, description: 'Vysoce flexibilní cementové lepidlo' },
  { category: 'Stavební materiály', type: 'material', title: 'Spárovací hmota vodoodpudivá (5 kg)', unit: 'bal', unitPrice: 280, description: 'Pro interiér i exteriér' },
  { category: 'Stavební materiály', type: 'material', title: 'Hloubkový penetrační nátěr (5 l)', unit: 'bal', unitPrice: 320, description: 'Sjednocení savosti podkladu' },
  { category: 'Stavební materiály', type: 'material', title: 'Sádrokartonová deska RB 12.5mm (2x1.25m)', unit: 'ks', unitPrice: 210, description: 'Běžná bílá stavební SDK deska' },
  { category: 'Stavební materiály', type: 'material', title: 'Kabel CYKY-J 3x1.5 (100m klubko)', unit: 'bal', unitPrice: 1450, description: 'Kabel pro světelné okruhy' },
  { category: 'Stavební materiály', type: 'material', title: 'Kabel CYKY-J 3x2.5 (100m klubko)', unit: 'bal', unitPrice: 2250, description: 'Kabel pro zásuvkové okruhy' },
];

/** Položka má beze změny ukázkovou cenu z výchozího ceníku (stejný název, jednotka a cena). */
export function isSamplePriceItem(item: Pick<PriceListTemplateItem, 'title' | 'unit' | 'unitPrice'>): boolean {
  return DEFAULT_PRICE_LIST_ITEMS.some((d) => d.title === item.title && d.unit === item.unit && d.unitPrice === item.unitPrice);
}

/** Uživatel si ceník upravil: aspoň jedna položka není beze změny ukázková (přepsaná cena nebo vlastní položka). */
export function isPriceListCustomized(items: Pick<PriceListTemplateItem, 'title' | 'unit' | 'unitPrice'>[]): boolean {
  return items.some((item) => !isSamplePriceItem(item));
}
