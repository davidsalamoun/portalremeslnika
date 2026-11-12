/**
 * Převod křestního jména do 5. pádu (vokativ - oslovení) v češtině.
 * 
 * Příklady:
 * "Jan" -> "Jane"
 * "David" -> "Davide"
 * "Petr" -> "Petře"
 * "Tomáš" -> "Tomáši"
 * "Pavel" -> "Pavle"
 * "Karel" -> "Karle"
 * "Marek" -> "Marku"
 * "Honza" -> "Honzo"
 * "Jiří" -> "Jiří"
 */

// Slovník nejčastějších nepravidelných nebo specifických českých jmen
const VOCATIVE_OVERRIDES: Record<string, string> = {
  // Mužská jména
  jan: 'Jane',
  petr: 'Petře',
  david: 'Davide',
  pavel: 'Pavle',
  karel: 'Karle',
  marek: 'Marku',
  radek: 'Radku',
  zdeněk: 'Zdeňku',
  zdenek: 'Zdeňku',
  františek: 'Františku',
  frantisek: 'Františku',
  tomáš: 'Tomáši',
  tomas: 'Tomáši',
  lukáš: 'Lukáši',
  lukas: 'Lukáši',
  jakub: 'Jakube',
  michal: 'Michale',
  martin: 'Martine',
  jiří: 'Jiří',
  jiri: 'Jiří',
  josef: 'Josefe',
  ondřej: 'Ondřeji',
  ondrej: 'Ondřeji',
  matěj: 'Matěji',
  matej: 'Matěji',
  filip: 'Filipe',
  vojtěch: 'Vojtěchu',
  vojtech: 'Vojtěchu',
  daniel: 'Danieli',
  adam: 'Adame',
  aleš: 'Aleši',
  ales: 'Aleši',
  roman: 'Romane',
  stanislav: 'Stanislave',
  milan: 'Milane',
  jaroslav: 'Jaroslave',
  václav: 'Václave',
  vaclav: 'Václave',
  vladimír: 'Vladimíre',
  vladimir: 'Vladimíre',
  miroslav: 'Miroslave',
  luďek: 'Luďku',
  ludek: 'Luďku',
  patrik: 'Patriku',
  robert: 'Roberte',
  richard: 'Richarde',
  šimon: 'Šimone',
  simon: 'Šimone',
  štěpán: 'Štěpáne',
  stepan: 'Štěpáne',
  vít: 'Víte',
  vit: 'Víte',
  vítek: 'Vítku',
  vitek: 'Vítku',
  robin: 'Robine',
  antonín: 'Antoníne',
  antonin: 'Antoníne',
  libor: 'Libore',
  alois: 'Aloisi',
  rené: 'René',
  rene: 'René',
  honza: 'Honzo',
  jirka: 'Jirko',
  péťa: 'Péťo',
  peta: 'Péťo',
  vláďa: 'Vláďo',
  vlada: 'Vláďo',
  míra: 'Míro',
  mira: 'Míro',
  dan: 'Dane',
  jára: 'Járo',
  jara: 'Járo',
  saša: 'Sašo',
  sasa: 'Sašo',
  dušan: 'Dušane',
  dusan: 'Dušane',
  bohumil: 'Bohumile',
  ladislav: 'Ladislave',
  rudolf: 'Rudolfe',
  alexandr: 'Alexandře',
  alex: 'Alexi',
  norbert: 'Norberte',
  igor: 'Igore',
  dominik: 'Dominiku',
  erik: 'Eriku',
  boris: 'Borisi',
  otto: 'Otto',
  oto: 'Oto',
  hynek: 'Hynku',

  // Ženská jména
  jana: 'Jano',
  petra: 'Petro',
  lucie: 'Lucie',
  eva: 'Evo',
  marie: 'Marie',
  lenka: 'Lenko',
  kateřina: 'Kateřino',
  katerina: 'Kateřino',
  michaela: 'Michaelo',
  alena: 'Aleno',
  veronika: 'Veroniko',
  tereza: 'Terezo',
  barbora: 'Barboro',
  bára: 'Báro',
  bara: 'Báro',
  monika: 'Moniko',
  markéta: 'Markéto',
  marketa: 'Markéto',
  martina: 'Martino',
  hana: 'Hano',
  zuzana: 'Zuzano',
  jitka: 'Jitko',
  dagmar: 'Dagmar',
  simona: 'Simono',
  klára: 'Kláro',
  klara: 'Kláro',
  radka: 'Radko',
  nikola: 'Nikolo',
  adéla: 'Adélo',
  adela: 'Adélo',
  eliška: 'Eliško',
  eliska: 'Eliško',
  ann: 'Anno',
  anna: 'Anno',
};

/**
 * Převede křestní jméno do 5. pádu (oslovení).
 */
export function getVocative(nameOrText?: string): string {
  if (!nameOrText || !nameOrText.trim()) return '';

  // Očistíme text: odstraníme tituly, firmu, pomlčky (např. "Jan Novák – Řemeslné práce" -> "Jan")
  const withoutTrades = nameOrText.split('–')[0].split('-')[0].trim();
  const tokens = withoutTrades.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '';

  // Vezmeme první slovo jako křestní jméno
  const firstName = tokens[0];
  const lower = firstName.toLowerCase();

  // 1. Přímá shoda v rychlém slovníku nejčastějších jmen
  if (VOCATIVE_OVERRIDES[lower]) {
    // Zachováme první velké písmeno
    return VOCATIVE_OVERRIDES[lower];
  }

  // 2. Pravidla pro skloňování neznámých jmen podle koncovky:
  // Jména končící na -a (Jana, Honza, Pepa, Lenka) -> -o (Jano, Honzo, Pepo, Lenko)
  if (lower.endsWith('a')) {
    return firstName.slice(0, -1) + 'o';
  }

  // Jména končící na -ek (např. Mirek, Vítek, Zdeněk, Luděk) -> -ku / -če
  if (lower.endsWith('ek')) {
    // Zjistíme předposlední souhlásku: Mirek -> Mirku, Marek -> Marku
    const stem = firstName.slice(0, -2);
    return stem + 'ku';
  }

  // Jména končící na -ík (Patrik, Dominik, Jindřík) -> -ku
  if (lower.endsWith('k') || lower.endsWith('g') || lower.endsWith('ch') || lower.endsWith('h')) {
    return firstName + 'u';
  }

  // Jména končící na -el s pohyblivým e (Karel -> Karle, Pavel -> Pavle)
  if (lower.endsWith('el')) {
    const stem = firstName.slice(0, -2);
    // Pokud před -el je souhláska (v, r, p...)
    if (stem.length >= 2 && !/[aeiouyáéíóúůý]/i.test(stem[stem.length - 1])) {
      return stem + 'le';
    }
    return firstName + 'i';
  }

  // Jména končící na měkké souhlásky: -š, -č, -ž, -c, -j, -ř, -ď, -ť, -ň -> -i
  if (/[ščžcjřďťň]$/i.test(lower)) {
    return firstName + 'i';
  }

  // Jména končící na -í, -e (Jiří, René) zůstávají stejná
  if (lower.endsWith('í') || lower.endsWith('i') || lower.endsWith('e') || lower.endsWith('é') || lower.endsWith('o')) {
    return firstName;
  }

  // Jména končící na tvrdé/obojetné souhlásky: -b, -d, -f, -l, -m, -n, -p, -r, -s, -t, -v, -z -> -e
  if (lower.endsWith('r')) {
    // Petr -> Petře, Alexandr -> Alexandře (pokud končí na tr/dr, změkčuje se na tře/dře)
    if (lower.endsWith('tr')) return firstName.slice(0, -2) + 'tře';
    if (lower.endsWith('dr')) return firstName.slice(0, -2) + 'dře';
    return firstName + 'e';
  }

  // Běžná koncovka -e pro tvrdé/obojetné souhlásky (Jan -> Jane, David -> Davide, Milan -> Milane)
  return firstName + 'e';
}
