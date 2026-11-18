# Řemeslník PRO

Název aplikace je **Řemeslník PRO** (repozitář se z historických důvodů jmenuje `portalremeslnika`); jiné názvy
v UI nepoužívat. „Mistr PRO“ je název placeného tarifu, ne aplikace.

Webová aplikace pro české řemeslníky a OSVČ: smlouvy o dílo, cenové nabídky, faktury s QR platbou,
předávací protokoly, kalendář, klienti, náklady a daňový přehled. Původně vygenerováno v Google AI Studiu,
dál se vyvíjí mimo něj.

## Závazná pravidla

1. **Veškeré UI je v češtině.** Texty, hlášky, toasty, popisky i chybové stavy. Komentáře v kódu mohou být česky.
2. **Držet vzhled „Výkres a metr“** (viz oddíl Vzhled). Nové prvky stavět z jeho barev, písem a tvarů; nevracet
   stíny, zaoblené karty, barevné přechody, popisky verzálkami ani strojové písmo. Dokumenty (smlouva, faktura,
   protokol…) mají vlastní střízlivý papírový vzhled (viz Dokumenty) a neupravují se bez pokynu.
3. **Právní texty šablon neměnit bez výslovného pokynu.** Týká se znění smluv, dodatků, protokolů, záručních
   listů, faktur a dokladů v `src/components/ContractPreview.tsx`, `AmendmentView.tsx`, `HandoverProtocolView.tsx`,
   `WarrantyCertificateView.tsx`, `InvoiceView.tsx`, `AdvanceTaxDocView.tsx`, `CashReceiptView.tsx`, `PriceQuoteView.tsx`,
   `ContractBody.tsx` (znění smlouvy), `TechnicalProtocolsModal.tsx`, `src/utils/exportDocx.ts` a `src/data/craftTemplates.ts`.
   Náhled (HTML/PDF) a export do Wordu obsahují tentýž text dvakrát – při schválené změně upravit obě místa.
4. **Žádná tajemství v prohlížeči ani v repozitáři.** `STRIPE_SECRET_KEY` jen na serveru.
   Proměnné s prefixem `VITE_` jsou veřejné. `.env*` se necommituje (kromě `.env.example`).
5. **Neměnit klíče a tvar dat v localStorage bez migrace** – stejný tvar se ukládá i do databáze (sloupec `data`)
   a čtou ho i starší verze aplikace na jiných zařízeních.
6. **Čtení i zápisy dat jen přes `src/utils/storage.ts`** – jinak se změna nedostane do účtu uživatele a místo
   obrázků by se četly jen odkazy `@img:…`. Nikdy nečíst klíče dat přímo z localStorage.

## Příkazy

```bash
npm install
npm run dev                      # Express + Vite middleware na http://localhost:3000 (PORT lze změnit)
npm run build                    # produkční build frontendu do dist/
npm run lint                     # tsc --noEmit
npm test                         # testy (tests/*.test.ts, node:test přes tsx)
npm run e2e                      # průchody aplikací v prohlížeči (e2e/, Playwright, napodobený Supabase) + přístupnost
npm run size                     # po buildu: velikost úvodního balíku (gzip) proti rozpočtu ve scripts/check-bundle-size.mjs
NODE_ENV=production npm start    # lokální produkční běh: Express servíruje dist/ + /api
```

Proměnné prostředí: zkopírovat `.env.example` jako `.env` a případně doplnit
`STRIPE_SECRET_KEY`, `VITE_STRIPE_PAYMENT_LINK_MONTHLY`, `VITE_STRIPE_PAYMENT_LINK_YEARLY`, `PORT`. Bez nich aplikace běží.
Adresa a publishable klíč Supabase jsou veřejné a mají výchozí hodnoty v `src/utils/supabase.ts`
(lze přepsat přes `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`). Klíč `secret`/`service_role` do repozitáře ani do `VITE_` proměnných nikdy.
`server.ts` načítá `.env` přes `dotenv`.

## Nasazení (Vercel)

Konfigurace je ve `vercel.json`: frontend se staví příkazem `npm run build` do `dist/`, všechny cesty `/api/*`
obsluhuje jediná funkce `api/index.ts` (Express aplikace jako výchozí export). `server.ts` se na Vercelu nepoužívá.
Proměnné (případně `STRIPE_SECRET_KEY`) se nastavují v projektu na Vercelu, ne v repozitáři.
`api/index.ts` nesmí importovat nic z `src/` ani `vite` a musí zůstat jedním souborem bez relativních importů.

## Vzhled

Směr „Výkres a metr“ (návrh: https://claude.ai/artifact/BY3gLubMb8bWCaC2aA4MkA), zaveden po částech:
část 1 (hotovo) = barvy, písmo, rohy, navigace, přihlášení; část 2 (hotovo) = přehled, zakázky, faktury, formulář smlouvy s rozpočtem; část 3 = klienti, kalendář, finance, archiv, nastavení a mobilní nabídka „Více“ (hotovo), lišta náhledu dokumentů a lišty jednotlivých dokladů (hotovo); rámy a hlavičky všech oken (hotovo); obsah oken podpis, odeslání, výběr z ceníku, nový dodatek a nový pokladní doklad (hotovo); okna Náklady a zisk, Podklady pro účetní, Kniha jízd, Stavební deník a Kalkulačka jsou přestavěná podle vzoru Přehledu (souhrn v jednom rámečku s velkým číslem, formulář s popisky nad poli, seznam řádků, smazání potvrzené oknem); okno Účet má souhrn v jednom rámečku a tlačítka s obrysem; u ostatních oken (parťáci, půjčené nářadí, nákupní seznam, harmonogram, zkoušky a protokoly, fotodokumentace, odjezd ze stavby, rychlé zprávy klientovi) jsou sjednocené písmo, řezy, barvy, tlačítka a výška ovládacích prvků, rozvržení zůstává původní. Podpis zákazníka na zařízení (kiosk) má záměrně vlastní tmavý vzhled. Beze změny je jen Složka zakázky (tisková sestava) a okna placení (vypnuté).

- **Barvy** jsou v `src/index.css` v bloku `@theme` jako přemapované palety Tailwindu, takže stávající třídy platí dál:
  `slate-*` = grafit a papír (text `slate-900` #1A1D21, pozadí `slate-50` #F4F5F2), `blue-*` = razítková modrá
  (`blue-600` #1B3F8B: navigace, odkazy, podpisy), `amber-*` = žlutá z metru (`amber-400` #F5C400: jen hlavní akce
  a postup zakázky). Zelená = zaplaceno/hotovo, červená = po splatnosti/chyby. Nepřidávat další akcentní barvy.
- **Písmo:** IBM Plex Sans na texty (`font-sans`), Barlow Semi Condensed na nadpisy a velká čísla (`h1`–`h4` automaticky,
  jinak třída `font-display`). Třídy `uppercase` a `font-mono` jsou záměrně zneškodněné (i v dokumentech).
- **Tvary:** rohy 4 px (`rounded-md` až `rounded-3xl`), `rounded-full` jen pro odznaky. Plochy oddělují linky 1 px;
  stín mají jen okna nad obsahem (`shadow-xl`, `shadow-2xl`).
- **Značka a metr:** `components/Logo.tsx` (`LogoMark`, `Logo`, `Metr`). Metr má šest úseků, jeden na fázi: hotové fáze
  jsou žluté, aktuální je celá tmavá se žlutými ryskami; krátké rysky jsou jen uvnitř úseků, ne na jejich hranicích. Popisky pod
  metrem se sázejí do stejné mřížky (`grid-cols-6`). Animace `animate-metr` proběhne jednou. Razítko
  (`CraftsmanStamp.tsx`) je obyčejné firemní: rámeček, jméno, adresa, telefon, pod linkou IČO a DIČ. V dokladech má vlastní místo
  nad podpisem (na faktuře a nabídce vedle jména) – nepokládat ho absolutně přes podpis, jméno ani částku.
- **Fáze zakázky:** `utils/jobStage.ts` (`getJobStage`, `isActiveJob`) určuje fázi Poptávka → Nabídka → Smlouva →
  Realizace → Předáno → Zaplaceno, podíl na metru a větu „co dál“. Používat ji všude, kde se ukazuje postup zakázky.
  Posun mezi fázemi dělá `moveJobStage` (nastaví `leadStage` a `status`, při zaplacení i `paidDate`); `leadStage`
  má dál jen pět původních hodnot – `completed` znamená předáno, zaplaceno se pozná podle `isContractPaid`.
- **Zakázky** (`LeadsPipelinePage.tsx`): jeden seznam se záložkami fází (ne sloupce nástěnky), u každé zakázky metr,
  věta „co dál“ a tlačítko posunu pojmenované podle cílové fáze. Okno „Nová poptávka“ je vzor pro formuláře v oknech.
  Hledání prohledává všechny fáze (záložka se při něm neuplatní). Hledání v Zakázkách, Klientech a Archivu jde přes
  `matchesSearch` (`utils/search.ts`): bez ohledu na diakritiku a velikost písmen, čísla i bez mezer a pomlček.
- **Nová zakázka podle jiné** („Nová zakázka podle této“ v nabídce Další možnosti náhledu): formulář převezme druh
  dokumentu, popis, rozpočet (nová id položek), cenu bez dodatků, zálohu a DPH; ne klienta (vybírá se, nic se
  nepředvybere), termín, adresu stavby, podpisy, čísla ani fotky. Nahoře je pruh, ze které zakázky vychází.
  `formPreset` v `App.tsx` (také předvybraný klient z tlačítka „Nová smlouva“ v Klientech) platí jen pro jedno
  založení formuláře a zapomene se po odchodu ze záložky.
- **Úprava uložené zakázky** („Upravit“ v liště náhledu, na mobilu v nabídce Další možnosti): formulář smlouvy v režimu
  úprav (`formPreset.edit`) mění klienta, popis, cenu/rozpočet, zálohu, termín, adresu stavby a DPH; číslo, druh dokumentu
  a datum uzavření zůstávají. Jde jen, dokud ji nezamyká podpis klienta, vystavená faktura (i starší číslo od založení),
  předání ani dodatek (`getEditLock` v `utils/contractEdit.ts`) – potom se mění dodatkem. Nepodepsaný odkaz k online
  podpisu se při uložení úpravy zruší (`revokePendingSignShare`); když ho klient mezitím podepsal nebo není signál,
  úprava se neuloží.
- **Koncept formuláře smlouvy:** rozepsaný formulář (nová smlouva i úprava) se průběžně ukládá jen v zařízení (klíč
  `contract_form_draft` přes `storage.ts`, do účtu se neposílá) a obnoví se po přepnutí záložky i po návratu z náhledu
  s pruhem „Pokračujete v rozepsané smlouvě“ a volbou „Začít znovu“. Neobnoví se přes novější pokyn k otevření formuláře
  (`formPreset.key`: šablona, klient, podle jiné zakázky, kalkulačka). Maže se uložením zakázky, uložením nebo zrušením
  úpravy a odhlášením.
- **Nástroje stavby a záznamy** nesmí nic předstírat: zkušební protokoly (`TechnicalProtocolsModal.tsx`) nepředvyplňují
  parametry, naměřené hodnoty, výsledek ani popis průběhu (hodnota podle normy je jen nápověda v poli) a podpis zákazníka
  nepřebírají ze smlouvy; kniha jízd (`LogbookModal.tsx`) zapíše více dní najednou jen u dnů, které uživatel vybere,
  a nepředvyplňuje kilometry ani sazbu. Částka jízdy se v součtech bere přes `getTripCost` (`utils/tripCost.ts`).
  Stavební deník (`SiteLogbookModal.tsx`) nepředvyplňuje počasí, teplotu, počet lidí ani hodiny a počasí „nezjišťuje“
  (rychlé volby jen doplní slovo). Kalkulačka na obhlídce (`QuickEstimateCalculatorModal.tsx`) počítá jen z položek
  a cen uživatelova ceníku (`getStoredPriceList`) a množství, která zadá; rezerva 10 % k materiálu je samostatný řádek.
  „Převést do smlouvy“ předá rozpočet do formuláře přes `formPreset.estimate` (pruh „Rozpočet z kalkulačky na obhlídce“,
  klient se vybírá); „Upravit ceník“ otevře Nastavení na záložce Ceník.
  Položky s nezměněnou ukázkovou cenou výchozího ceníku (`isSamplePriceItem`) kalkulačka pod výsledkem vyjmenuje počtem. Názvy druhů výdajů jsou v `utils/expenseCategories.ts`.
  „Vyfotit účtenku“ na přehledu otevře výběr zakázky a její okno Náklady a zisk (`initialOpenExpenses` v náhledu).
- **Formuláře** (vzor `ContractForm.tsx`, `BudgetItemsEditor.tsx`): popisek nad polem, pole vysoké aspoň 44 px s linkou
  1,5 px, volby jako přepínací tlačítka (`aria-pressed`), chyba červeně pod polem (`role="alert"`) a zmizí po opravě;
  při odeslání s chybou se stránka posune na první chybné pole. Nepředvyplňovat vymyšlené částky.
- **Názvy:** v aplikaci se píše „klient“ (shodně s nabídkou Klienti) a „událost“ v kalendáři; ve zprávách odesílaných
  lidem „zákazník“. Nepoužívat „dispečink“, „výjezd“, „pracovní stůl“ ani znak & v nadpisech.
- **Finance** (`FinancialRadarPage.tsx`): obrat a zisk se počítají z cen smluv podle data uzavření (`getContractTotal`,
  jen `isInvoiceable`). Hranice DPH a pásma paušální daně jsou v `utils/taxLimits.ts` (stav 2025–2026: nad 2 mil. Kč
  plátce od 1. 1. dalšího roku, nad 2 536 500 Kč od následujícího dne; pásma podle výdajového paušálu
  `expenseFlatRate` v profilu, na který se ptá přímo tato stránka). Při změně zákona upravit tam i texty; vždy
  ponechat větu, že údaje jsou orientační a ověřují se u účetní. Částky měsíčních plateb paušální daně neuvádět. Graf: jedna řada, hodnota
  měsíce po najetí nebo fokusu, skrytá tabulka pro čtečky.
- **Adresa stavby:** nepovinné `contract.siteAddress` (formulář smlouvy, tlačítko „Adresa stavby“ v náhledu zakázky).
  Kde aplikace potřebuje místo práce (navigace, počasí, kalendář, kniha jízd, zprávy zákazníkovi), bere ho přes
  `getSiteAddress`, ne přímo z `client.address`. Ve smlouvě je v čl. 2.1 jako místo provedení díla (`ContractBody.tsx`
  i `exportDocx.ts`); bez ní platí původní věta o adrese objednatele. Jiné doklady ji neuvádějí.
- **E-mail klienta** je nepovinný: doklady řádek s e-mailem vynechají, když chybí.
- **Kalendář** (`CalendarPage.tsx`): měsíc s filtry druhů a vybraný den. Na úzké obrazovce je vybraný den nad
  měsícem (pod dneškem „Další dny“ s nejbližšími událostmi), filtry jsou v jednom posuvném řádku a výběr dne
  v měsíci posune stránku k přehledu dne.
- **Archiv** (`HistoryPage.tsx`): seznam všech dokumentů s hledáním; fáze se tu jen zobrazuje, mění se v Zakázkách.
- **Nastavení** (`SettingsPage.tsx`): záložky Vaše údaje (údaje zhotovitele, podpis, razítko), Ceník a Záloha dat. Potvrzení (smazání položky,
  obnova ceníku, obnova ze zálohy) jdou přes `Dialog`, ne přes `window.confirm`.
- **Náhled dokumentů** (`ContractPreview.tsx`): nahoře přilepená lišta (zpět, název, Odeslat, Uložit PDF, další možnosti,
  záložky dokumentů; na mobilu výběr), pod ní řádek zakázky (fáze přes `moveJobStage`, podpis, náklady, adresa stavby,
  nástroje stavby; pod šířkou `md` jen fáze a nabídka „Další“ s ostatním, aby dokument začínal výš).
  Na mobilu je lišta pod horní lištou aplikace (`top-[57px]`) a hlavní akce nad spodní nabídkou (`bottom-[75px]`) –
  při změně výšky těch lišt upravit i tyto hodnoty. Blok papíru se při úpravách lišty nemění.
- **Lišty dokladů** (faktura, dodatky, pokladní doklad, protokol, záruční list, nabídka) se skládají z `components/docBar.ts`.
  Tisk a PDF jsou jen v horní liště náhledu, v lištách dokladů se neopakují. Při úpravě lišty se text pod ní nemění –
  ověřit porovnáním části souboru od komentáře papíru dál s původní verzí.
- **Okna** nad obsahem stavět z `components/Dialog.tsx` (nadpis, křížek, Escape jen pro nejvyšší okno, na mobilu zdola).
  Malá okna: obsah jako `children` (okraj a posouvání řeší okno) – obsah pak nemá vlastní okraj. Velká okna: `bare` – jen když má obsah vlastní okraje,
  `flex-1 overflow-y-auto` a patičku; tlačítka do hlavičky přes `actions` (`dialogActionButton`). U oken s rozepsanými
  údaji `closeOnBackdrop={false}`. Nepsat vlastní `fixed inset-0` rám ani tmavou hlavičku; do hlaviček ani patiček
  nepsat odkazy na paragrafy a tvrzení typu „splňuje náležitosti zákona“.
- **Faktury** (`InvoicesOverviewPage.tsx`): souhrn v jednom rámečku, záložky stavů, seznam s odznakem splatnosti.
  Texty upomínek skládá `utils/invoiceReminder.ts`; faktura před splatností se jen připomíná, bez volby tónu.
  Ani nejostřejší tón nehrozí vymáháním – žádá úhradu do 7 dnů a nabízí domluvu.
- **Přehled** (`DashboardPage.tsx`) je vzor pro další obrazovky: nadpis sekce + odkaz vpravo, bílý rámeček s řádky
  oddělenými linkou, velká čísla písmem `font-display`, vedlejší akce jako tlačítka s obrysem, žádné dlaždice se statistikami.
- **Úvodní stránka** (`LandingPage.tsx`): co vidí nepřihlášený návštěvník (AuthGate). Kdo se na zařízení už přihlásil
  (klíč `remeslnik_returning_user`), dostane rovnou přihlášení; logo na přihlášení vede zpět na úvod. Živá ukázka
  zakázky je jen animace (bez animací hotový stav) s volbou řemesla (vymyšlené ukázkové zakázky v `CRAFTS`); na mobilu
  se pod úvodem přilepí tlačítko „Založit účet zdarma“, podpis na zkoušku se nikam neukládá, QR kód nese adresu webu.
  Snímky jsou v `public/landing/` z aplikace s testovacími daty – při změně vzhledu je přegenerovat. Texty o ceně
  a datech musí odpovídat skutečnosti.
- **Průvodce prvním spuštěním** (`components/GettingStarted.tsx`, kroky v `utils/gettingStarted.ts`): na přehledu, dokud
  nejsou hotové kroky (údaje, podpis, ceník, klient, první smlouva) nebo ho uživatel neskryje (klíč
  `getting_started_hidden` v localStorage, jen na tomto zařízení). Hotovost kroku se počítá z dat, neukládá se. Ceník je hotový, když v něm není jen ukázkový výchozí ceník
  (`isPriceListCustomized` v `data/defaultPriceList.ts`; přehled ho jen čte přes `hasCustomizedPriceList`, výchozí nezakládá).
- **Počasí** (`utils/weather.ts`, `components/JobWeather.tsx`): u zakázky ve fázi Smlouva a Realizace se ukáže řádek jen
  tehdy, když předpověď pro obec stavby hlásí do tří dnů chladno, srážky nebo silný vítr. Obec se bere z adresy
  stavby (`getSiteAddress`) a dohledává u Open-Meteo; když se nenajde, nezobrazí se nic (nikdy nedosazovat jiné místo). Texty jsou
  doporučení – neodkazovat v nich na normy (ČSN, BOZP) ani nepsat „zákaz“.
- **Navigace:** `Navbar.tsx` = boční nabídka od šířky `lg`, pod ní úzká horní lišta; `BottomNav.tsx` = spodní lišta
  pod `lg`. Kořen aplikace má `lg:pl-60`.
- **Režimy:** aplikace se řídí světlým/tmavým režimem zařízení; přepínačem si uživatel nastaví vlastní volbu
  (`utils/theme.ts`, klíč `theme_choice` v localStorage). Každá úprava musí fungovat v obou režimech.
- **Dokumenty** (`.contract-page`, `#amendment-printable-paper`, `#quote-printable-paper`, `.print-content`,
  `[data-pdf-paper]`) mají jeden vzhled daný pravidly v `index.css`: písmo aplikace (i smlouva, dřív patková), linky místo barevných
  ploch, rohy 2 px, žádné verzálky ani strojové písmo; barvu má jen částka k úhradě a razítko. Pravidla přebarvují
  stávající třídy (`bg-*`, `border-*`, `text-*`) uvnitř papíru – novou barevnou plochu do dokladu nepřidávat. Ovládání
  na papíře (jen na obrazovce) musí mít třídu `no-print` nebo být `button`/`a`, jinak mu pravidla vezmou barvy.
- Ovládací prvky mají výšku aspoň 44 px a viditelné označení při ovládání klávesnicí.

## Ikony a náhled odkazu

`public/`: `favicon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`,
`manifest.webmanifest` (přidání na plochu telefonu), `robots.txt` (odkazy `?sign=` se neindexují) a `og.png` (náhled odkazu ve zprávách, 1200 × 630). `og:image`
musí být celá adresa: `vite.config.ts` při buildu dosadí za `__SITE_URL__` v `index.html` adresu z proměnné `SITE_URL`,
jinak produkční adresu projektu na Vercelu (`VERCEL_PROJECT_PRODUCTION_URL`). Při změně značky přegenerovat všechny.
Písma jsou jen dvě (IBM Plex Sans, Barlow Semi Condensed) a jsou uložená v aplikaci (`src/fonts.css`, balíčky
`@fontsource`) – nenačítat nic z Google Fonts ani jiných cizích serverů (IP návštěvníka, práce bez signálu).

## Načítání aplikace

Úvodní balík obsahuje jen přihlášení, navigaci a přehled; jeho velikost hlídá `npm run size` (rozpočet JS 190 kB, CSS
20 kB po gzip; v CI po buildu). Texty zásad a podmínek (`PrivacyPolicyText.tsx`, `TermsOfUseText.tsx`) se načtou až při
otevření okna, okno klienta a účtu jsou v `lazyLoaders`. Ostatní stránky a modály jsou v `App.tsx` přes `React.lazy`
(seznam `lazyLoaders`) a knihovny pro Word a PDF se načítají přes `utils/lazyExports.ts`. Po startu je
`preloadLazyChunks` dotáhne všechny na pozadí, aby aplikace po načtení fungovala i bez připojení. Novou stránku nebo
modál přidávat do `lazyLoaders`, ne statickým importem; `exportDocx`/`exportPdf` nikdy neimportovat přímo z komponent.

## Práce bez signálu

`src/sw/serviceWorkerSource.ts` je zdroj service workeru; `vite.config.ts` (plugin `offlineServiceWorker`) z něj při
buildu vytvoří `dist/sw.js` se seznamem všech souborů aplikace a verzí. `main.tsx` ho registruje jen v produkčním buildu.
Soubory aplikace (včetně písem) se čtou z mezipaměti, stránka ze sítě (po 3 s bez odpovědi z mezipaměti); data (Supabase, `/api`) jdou vždy na síť. Nový soubor v `public/` se do seznamu dostane sám.
Bez signálu `AuthGate` nečeká na obnovu vypršelého přístupového klíče a pustí uživatele s uloženým přihlášením
(`getStoredSessionUser`) k datům v zařízení. Odhlášení s neodeslanými změnami se potvrzuje oknem (`signOutAndClear`
vrátí jejich počet, „Odhlásit a změny zahodit“ odhlásí i tak). Změny se zařadí do fronty a odešlou po návratu signálu; když první
pokus selže (Supabase po neúspěšné obnově klíče minutu čeká), synchronizace se zkouší znovu po 15, 30 a 60 s.
`vercel.json` posílá `sw.js`, `index.html` a manifest bez dlouhého ukládání v prohlížeči.

## Technologie

React 19, TypeScript, Vite 8, Tailwind CSS 4 (`@tailwindcss/vite`), `motion`, `lucide-react`,
Express 4 (`api/index.ts`, `server.ts`), Supabase (přihlášení + Postgres), Stripe, `docx`, `jspdf` + `html2canvas-pro`, `qrcode`.
`html2canvas-pro` nenahrazovat původním `html2canvas` – ten neumí barvy oklch/oklab z Tailwindu 4 a export PDF spadne.

## Struktura

```
api/index.ts                  Express aplikace: /api/stripe/* (na Vercelu běží jako funkce)
server.ts                     lokální spuštění: api/index.ts + Vite middleware (dev) nebo dist/ (produkce)
vercel.json                   konfigurace nasazení na Vercel
index.html, vite.config.ts    vstup a konfigurace Vite (alias @ = kořen repozitáře)
supabase/schema.sql           databázové schéma a zabezpečení (spouští se ručně v Supabase SQL Editoru)
tests/                        testy (synchronizace, obrázky, částky a data faktur, hranice DPH, adresa stavby, průvodce, čeština, IBAN a QR platba)
src/
  main.tsx, App.tsx           main.tsx obalí aplikaci přihlášením (AuthGate); App.tsx drží veškerý stav,
                              přepíná záložky (bez routeru) a otevírá modály
  index.css                   Tailwind + tiskové styly
  types/contract.ts           všechny datové typy (Contract, Client, ContractorProfile, ...)
  data/craftTemplates.ts      šablony zakázek podle řemesla
  components/                 stránky (*Page.tsx), dokumenty (*View.tsx), modály (*Modal.tsx)
  utils/
    storage.ts                čtení/zápis localStorage (jediné místo čtení a zápisu dat)
    imageRefs.ts              nahrazení obrázků odkazy `@img:<id>` při ukládání a zpět při čtení
    blobStore.ts              úložiště obrázků v prohlížeči (IndexedDB + paměť)
    imageCleanup.ts           pravidla úklidu nepoužívaných obrázků
    supabase.ts               klient Supabase, české hlášky chyb přihlášení
    syncEngine.ts             logika synchronizace localStorage ↔ databáze (bez závislosti na prohlížeči)
    cloudSync.ts              napojení synchronizace na Supabase a prohlížeč, odhlášení
    signShares.ts             online podpis zákazníkem: odkaz s tajným kódem, kontrola podpisu
    backup.ts                 export/import zálohy JSON
    subscription.ts           tarif PRO, zkušební doba, QR platba předplatného
    spayd.ts                  QR platba (SPAYD), převod čísla účtu na IBAN
    invoiceMath.ts            jednotná pravidla pro částky, data a splatnost faktur
    invoiceReminder.ts        texty upomínek k fakturám
    taxLimits.ts              hranice obratu pro DPH a pásma paušální daně
    invoiceNumbering.ts       čísla faktur, smluv a nabídek (přidělení při vystavení)
    isdoc.ts, zipStore.ts     faktura ve formátu ISDOC, ZIP bez komprese a stažení souboru
    jobStage.ts               fáze zakázky pro metr a posun mezi fázemi
    siteAddress.ts            adresa stavby zakázky (`contract.siteAddress`, jinak adresa klienta)
    ares.ts                   dohledání firmy podle IČO v ARES
    weather.ts                počasí na stavbě: obec z adresy, předpověď Open-Meteo, rizika pro venkovní práce
    exportDocx.ts, exportPdf.ts   export dokumentů (velké knihovny – importovat jen přes lazyExports.ts)
    lazyExports.ts, exportNames.ts  odložené načtení exportů, názvy exportovaných souborů
    numberToWordsCs.ts, vocativeCs.ts   částka slovy, 5. pád jmen
```

Záložky (`TabType` v `components/Navbar.tsx`): `dashboard`, `kalendar`, `pipeline`, `faktury`,
`nova-smlouva`, `klienti`, `historie`, `finance`, `nastaveni`. Parametr `?sign=<token>` v URL zobrazí místo
aplikace portál pro online podpis klientem (`RemoteSigningPortal.tsx`).

## Přihlášení a data

- **Přihlášení** e-mailem a heslem přes Supabase Auth. `components/AuthGate.tsx` pustí do aplikace jen přihlášeného
  uživatele (`AuthScreen.tsx`: přihlášení, registrace, obnova hesla). Výjimka: portál online podpisu `?sign=…`.
- **Aplikace čte a zapisuje do localStorage** (funguje i bez připojení): klíče `zhotovitel`, `klienti`, `smlouvy`,
  `remeslnik_cenik`, `remeslnik_kalendar`. Faktury, náklady, dodatky, deník, kniha jízd i protokoly jsou
  vnořené v objektu `Contract` v klíči `smlouvy`.
- **Obrázky** (fotky, účtenky, podpisy – data URL jpeg/png/webp od 2 kB) se neukládají do localStorage ani do
  řádků databáze. `storage.ts` je při zápisu nahradí odkazem `@img:<id>` (id z obsahu obrázku) a uloží do IndexedDB
  (`blobStore.ts`); při čtení je dosadí zpět, takže komponenty pracují s běžnými data URL. V účtu jsou soubory
  v soukromém bucketu `photos` na cestě `<user_id>/<id>`. Synchronizace nahrává obrázky před záznamy a chybějící
  stahuje; do té doby se zobrazí šedý zástupný obrázek (nese id, při uložení se odkaz neztratí). Data ze starší
  verze (obrázky přímo v localStorage) převádí `migrateInlineImages` po startu. Bez IndexedDB zůstávají obrázky
  v datech jako dřív.
- **Úklid nepoužívaných obrázků** (`cleanupUnusedImages` v `cloudSync.ts`, rozhodování v `imageCleanup.ts`): nejvýš
  jednou denně po úspěšné synchronizaci. Smaže se jen soubor starší 30 dnů, na který neodkazuje účet (databázová
  funkce `list_referenced_images`) ani data v zařízení. Odkazovaný obrázek, který v účtu chybí, se nahraje znovu.
  Nová tabulka, jejíž data mohou obsahovat obrázky, musí být přidána do `list_referenced_images` i do
  `IMAGE_BEARING_KEYS` ve `storage.ts` – jinak by úklid její obrázky po 30 dnech smazal.
- **Synchronizace s účtem**: `storage.ts` po každém zápisu ohlásí změnu, `syncEngine.ts` ji zařadí do fronty
  (klíč `cloud_sync_state`), odešle do Supabase a stahuje změny z jiných zařízení. Tabulky `profiles`, `clients`,
  `contracts`, `calendar_events`, `price_list_items` mají stejný tvar (`user_id`, `id`, `data` jsonb, `updated_at`,
  `deleted_at`); smazání je značka `deleted_at`. Řádky chrání RLS – každý vidí jen své.
- **První přihlášení v prohlížeči** nahraje do účtu data, která v něm vznikla dříve. **Odhlášení** data účtu
  z prohlížeče smaže (zůstávají v účtu). Při konfliktu vyhrává poslední zápis celého záznamu.
- **Smazání účtu** (`deleteAccount` v `cloudSync.ts`, tlačítko v modálu účtu): po ověření hesla smaže soubory uživatele
  v bucketu `photos`, pak zavolá databázovou funkci `delete_own_account` (smaže uživatele, řádky zmizí kaskádou)
  a vyčistí zařízení. Nová tabulka s daty uživatele proto musí mít `user_id … references auth.users on delete cascade`.
- **Informace o datech** jsou v modálu účtu („Kde jsou moje data?“) a v zásadách ochrany osobních údajů
  (`components/PrivacyPolicy.tsx`, okno otevře odkaz `#ochrana-osobnich-udaju` odkudkoli – úvodní stránka, registrace,
  patička aplikace, účet, portál podpisu; text je formální, členěný podle čl. 13 GDPR). Když se změní, kde nebo jak se data ukládají nebo komu se posílají, upravit
  oba texty a posunout `PRIVACY_POLICY_DATE` – nesmí slibovat nic, co neplatí. Údaje provozovatele jsou v
  `src/config/operator.ts` a jsou **zatím provizorní** (vymyšlený název, bez adresy a IČO) – před spuštěním pro skutečné
  uživatele je nahradit skutečnými.
- **Podmínky používání** (`components/TermsOfUse.tsx`, formální text včetně smlouvy o zpracování podle čl. 28 GDPR
  v čl. 9): okno otevře odkaz `#podminky-pouzivani` (patička úvodní stránky a aplikace, účet, registrace); v portálu
  podpisu nejsou. Registrace bez zaškrtnutí souhlasu nejde; souhlas se ukládá k účtu (`user_metadata`: `terms_version`,
  `terms_accepted_at`). Účet bez aktuální verze uvidí po přihlášení pruh `TermsUpdateBanner` (Přečíst / Souhlasím,
  jen se signálem). Při změně znění posunout `TERMS_VERSION` v `src/config/operator.ts` – všichni pak potvrdí znovu;
  text musí odpovídat skutečnosti (služba je zatím zdarma, další zpracovatelé Supabase a Vercel).
- Změna schématu = úprava `supabase/schema.sql` (musí jít spustit opakovaně) a její nasazení v Supabase.
- **Online podpis** (`utils/signShares.ts`, tabulka `sign_shares`): řemeslník založí odkaz `?sign=<token>` s náhodným
  tajným kódem (uložen u smlouvy jako `signToken`). Zákazník se nepřihlašuje a k tabulce přístup nemá – smlouvu čte
  a podepisuje jen přes databázové funkce `get_sign_share` / `submit_sign_share`. Do odkazu se ukládá jen výřez smlouvy
  (`toSharedContract`): souhrn a údaje, ze kterých se skládá celé znění smlouvy (`shareVersion: 2`) – ne náklady, fotky
  ani deník. Portál ukazuje souhrn a u smlouvy celé znění přes `components/ContractBody.tsx` (tentýž text jako náhled
  zakázky); starší odkazy bez `shareVersion` ukážou jen souhrn. V portálu nepsat „právně závazně“ ani odkazy na eIDAS a paragrafy. Podepsaný odkaz už nejde změnit ani podepsat znovu; nepodepsaný
  vyprší po 90 dnech. Aplikace se na podpis ptá pravidelně (jen u smluv se `signToken` bez podpisu).

## Faktury a částky

Částky, data a stav faktur se počítají jen v `utils/invoiceMath.ts` – používá je doklad faktury, přehled pohledávek,
úvodní stránka, počítadlo po splatnosti i export pro účetní. Nepočítat je znovu v komponentách.
- Cena díla = `contract.price` + dodatky (vícepráce i méněpráce); doplatek = cena − sjednaná záloha.
- **Čísla faktur** (`utils/invoiceNumbering.ts`): u zakázek s `numbering: 2` vzniká číslo až tlačítkem „Vystavit fakturu“
  (další = nejvyšší v roce + 1; FA- a ZAL- mají každá svou řadu). Do té doby je doklad „Návrh faktury“ bez čísla a nejde
  poslat. Starší zakázky mají číslo z doby založení a platí jako vystavené. Zakázku s vystavenou fakturou
  (`hasIssuedInvoice`) nejde smazat, jen stornovat (`invoiceCancelledAt`: storno na faktuře, mimo pohledávky a tržby).
  Pořadí smluv a nabídek (`nextDocumentSequence`) je taky nejvyšší + 1, ne počet zakázek.
- **ISDOC** (`utils/isdoc.ts`): vystavená faktura jde stáhnout jako `.isdoc` (tlačítko v liště faktury) a podklady pro
  účetní nabízejí všechny faktury období v ZIPu (`utils/zipStore.ts`, ZIP bez komprese). Konečná faktura zdaňuje celou
  cenu (daň shora z celku, haléřový rozdíl na největším řádku) a zálohu odečítá jako nedaňovou (`NonTaxedDeposits`);
  zálohová faktura je typ 4. Stejně počítá i rozpis DPH na faktuře v aplikaci. Platnost hlídá `tests/isdoc.test.ts`
  proti oficiálnímu schématu `tests/fixtures/isdoc-invoice-6.0.2.xsd` (`xmllint-wasm`). Banky (název, BIC) v `CZ_BANKS`.
- **Jen faktura** (`docKind: 'invoice'`): faktura bez smlouvy z formuláře Nová smlouva; náhled má jen fakturu a pokladní
  doklad, zakázka je rovnou ve fázi Předáno.
- Konečná faktura se vystavuje k předání díla (`handoverData.handoverDate`, jinak `deliveryDate`), DUZP je stejné,
  splatnost 14 dnů. Zálohová faktura se vystavuje k datu uzavření smlouvy a jen na zálohu sjednanou ve smlouvě
  (`advanceAmount`); bez ní se nenabízí a žádná částka se nedomýšlí.
- Cenová nabídka (`docKind: 'quote'`) a zakázka bez ceny nejsou pohledávkou ani tržbou.
- U plátců (profil má DIČ) jsou ceny včetně DPH. Sazbu zakázky určuje `getVatRate` (`contract.vatRate`, výchozí 21 %,
  volba 12 % v liště konečné faktury); konečná faktura plátce rozepisuje základ, sazbu a daň z celé ceny díla přes `getVatBreakdown`
  a stejnou sazbu používá export pro účetní. Zálohová faktura rozpis nemá.
- **Přenesení daňové povinnosti** (`contract.reverseCharge`, jen u plátce; `isReverseCharge`, `getContractVatBreakdown`,
  `contractPriceVatSentence`, `priceVatNote` v `invoiceMath.ts`): stavební a montážní práce pro jiného plátce (§ 92e).
  Cena zakázky je pak bez DPH a zákazník platí jen ji. Volba „Kdo odvede daň“ je ve formuláři smlouvy (vedle sazby)
  a v liště konečné faktury, dokud není vystavená; aplikace ji sama nezapíná, jen ji nabídne u klienta s DIČ.
  Faktura: DIČ odběratele, rozpis s „daň odvede zákazník“, věta o režimu podle § 92e, „Částka je bez DPH, daň odvede
  zákazník.“; smlouva čl. 3.1 má schválené znění (náhled i Word přes `contractPriceVatSentence`). ISDOC: daň 0,
  řádky s `LocalReverseChargeCode` 4, `LocalReverseChargeFlag`; podklady pro účetní: DPH 0 a „přenesení (kód 4)“.
- **Daňový doklad k přijaté platbě (záloze)** (`AdvanceTaxDocView.tsx`; `canHaveAdvanceTaxDoc`, `hasAdvanceTaxDoc`,
  `getAdvanceTaxBreakdown` v `invoiceMath.ts`; § 28 odst. 1 písm. d) a odst. 3): jen plátce se sjednanou zálohou, ne při
  přenesení daňové povinnosti. Tlačítko „Záloha zaplacena“ v liště zálohové faktury (okno: datum přijetí, nejpozději
  dnes; na účet / hotově, předvyplní se z pokladního dokladu na zálohu) vystaví doklad s vlastní řadou DP-
  (`nextAdvanceTaxDocNumber`; pole `advancePaidDate`, `advancePaidMethod`, `advanceTaxDocNumber`,
  `advanceTaxDocIssuedAt`). Doklad se už nemění a zakázku s ním nejde smazat (`hasIssuedInvoice`). Konečná faktura
  pak zálohu odečítá i s daní (řádky Celkem za dílo / Zdaněno zálohou DP- / Zbývá); ISDOC: doklad typ 5, konečná
  faktura `TaxedDeposits` a `AlreadyClaimed…`; podklady pro účetní: doklad jako samostatný řádek ke dni přijetí,
  konečná faktura jen se zbytkem. V náhledu je doklad jako třetí druh faktury („Doklad k záloze“).
- **DIČ klienta** (`client.dic`, nepovinné): okno klienta, doplní ho ARES; smlouva a faktura ho uvádějí, když je vyplněné.
- Částka slovy vždy přes `amountInWordsCzk` (rod a tvar měny), vícepráce/méněpráce přes `formatSignedCurrency`.
- Předání díla (`handoverData`) se ukládá podpisem předávacího protokolu; čte ho záruční list, faktura i složka zakázky.
- Pod náhledem dokumentů je upozornění, že vzory nenahrazují právní poradenství (jen na obrazovce, třída `no-print`).
- Export PDF (`exportPdf.ts`) vykresluje papír vždy v šířce A4 (794 px) v okně širokém 1280 px, takže PDF z mobilu
  je stejné jako z počítače. Doklad, který přesahuje jednu stranu nejvýš o 10 %, se nepatrně zmenší na jednu stranu
  (`MAX_SHRINK_TO_FIT`). Vynechává prvky s třídou `no-print`; tlačítko „Uložit PDF“ ukládá právě zobrazený dokument.

## AI

Aplikace žádné AI funkce neobsahuje – AI rozpočet, sken účtenek, checker smluv i AI rádce byly na pokyn vlastníka
odstraněny včetně serverových endpointů a závislosti na Gemini. Nepřidávat je zpět bez výslovného pokynu.

## Známé limity (stav po převzetí z AI Studia)

- **Placení je vypnuté** (`PAYMENTS_ENABLED = false` v `utils/subscription.ts`): všechny funkce jsou odemčené, tlačítka
  a bannery PRO, paywall i doklad k licenci se nezobrazují. Nezapínat, dokud platbu neověřuje server a v `PRO_CONFIG`
  nejsou skutečné údaje provozovatele – současné IČO a číslo účtu jsou vymyšlené, stejně jako platební formulář
  v `PaywallModal.tsx` (jen napodobuje Stripe). Aktivace PRO parametrem v adrese byla odstraněna.
- Testy (`tests/`) pokrývají synchronizaci, odkazy na obrázky, výpočty faktur a české pomocné funkce. Průchody aplikací
  (`e2e/`, Playwright) běží proti produkčnímu buildu s napodobeným Supabase (`e2e/support/mock.ts`, data v `seed.ts`)
  na počítači, mobilu a v tmavém režimu; každý test končí kontrolou, že v konzoli nejsou chyby. GitHub je spouští
  u každé změny (`.github/workflows/ci.yml`). Ostrý Supabase, ARES a počasí se tak neověřují – ty jen ručně.
  `e2e/pristupnost.spec.ts` kontroluje hlavní obrazovky, okno a doklady nástrojem axe (WCAG 2.1 A a AA) ve všech třech
  režimech; razítko (`data-stamp`) je vynechané, protože přes jeho natočení axe nedopočítá pozadí. Rychlost se měří
  ručně (Lighthouse proti `dist/` se serverem s kompresí, stav 11/2026: mobil 92, počítač 100, přístupnost, osvědčené
  postupy a SEO 100).
  Novou obrazovku nebo doklad přidat i do průchodů.
- PDF je obrázek stránky (nejde v něm hledat text). Strany se dělí v mezeře mezi řádky (`computePageSlices`
  v `exportPdf.ts`), ne podle odstavců nebo bloků – nadpis tak může zůstat na konci strany bez svého textu.
- DPH: doklad k přijaté záloze jde vystavit jen jeden na zakázku (na celou sjednanou zálohu) a nejde opravit
  (opravný daňový doklad aplikace nemá); sazba i přenesení daňové povinnosti platí pro celou zakázku (nejde kombinovat řádky v různém režimu). Zda jde o stavební práce podle CZ-CPA 41–43, posuzuje uživatel.
- Po startu se všechny obrázky účtu načtou do paměti; u tisíců fotek bude potřeba načítání na vyžádání.
