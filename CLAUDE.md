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
   protokol…) si drží vlastní papírový vzhled a neupravují se bez pokynu.
3. **Právní texty šablon neměnit bez výslovného pokynu.** Týká se znění smluv, dodatků, protokolů, záručních
   listů, faktur a dokladů v `src/components/ContractPreview.tsx`, `AmendmentView.tsx`, `HandoverProtocolView.tsx`,
   `WarrantyCertificateView.tsx`, `InvoiceView.tsx`, `CashReceiptView.tsx`, `PriceQuoteView.tsx`,
   `TechnicalProtocolsModal.tsx`, `src/utils/exportDocx.ts` a `src/data/craftTemplates.ts`.
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
část 1 (hotovo) = barvy, písmo, rohy, navigace, přihlášení; část 2 (hotovo) = přehled, zakázky, faktury, formulář smlouvy s rozpočtem; část 3 = klienti, kalendář, finance, archiv, nastavení a mobilní nabídka „Více“ (hotovo), lišta náhledu dokumentů a lišty jednotlivých dokladů (hotovo); rámy a hlavičky všech oken (hotovo); obsah oken podpis, odeslání, výběr z ceníku, nový dodatek a nový pokladní doklad (hotovo); u ostatních oken (nástroje stavby, náklady, podklady pro účetní, účet, kalkulačka, zkoušky a protokoly, fotodokumentace, podpis zákazníka na zařízení) jsou sjednocené písmo, řezy, barvy a výška ovládacích prvků, rozvržení zůstává původní. Beze změny je jen Složka zakázky (tisková sestava) a okna placení (vypnuté).

- **Barvy** jsou v `src/index.css` v bloku `@theme` jako přemapované palety Tailwindu, takže stávající třídy platí dál:
  `slate-*` = grafit a papír (text `slate-900` #1A1D21, pozadí `slate-50` #F4F5F2), `blue-*` = razítková modrá
  (`blue-600` #1B3F8B: navigace, odkazy, podpisy), `amber-*` = žlutá z metru (`amber-400` #F5C400: jen hlavní akce
  a postup zakázky). Zelená = zaplaceno/hotovo, červená = po splatnosti/chyby. Nepřidávat další akcentní barvy.
- **Písmo:** IBM Plex Sans na texty (`font-sans`), Barlow Semi Condensed na nadpisy a velká čísla (`h1`–`h4` automaticky,
  jinak třída `font-display`). Třídy `uppercase` a `font-mono` jsou mimo dokumenty záměrně zneškodněné.
- **Tvary:** rohy 4 px (`rounded-md` až `rounded-3xl`), `rounded-full` jen pro odznaky. Plochy oddělují linky 1 px;
  stín mají jen okna nad obsahem (`shadow-xl`, `shadow-2xl`).
- **Značka a metr:** `components/Logo.tsx` (`LogoMark`, `Logo`, `Metr`). Metr má šest úseků, jeden na fázi: hotové fáze
  jsou žluté, aktuální má dole tmavý pruh; krátké rysky jsou jen uvnitř úseků, ne na jejich hranicích. Popisky pod
  metrem se sázejí do stejné mřížky (`grid-cols-6`). Animace `animate-metr` proběhne jednou. Razítko
  (`CraftsmanStamp.tsx`) je obyčejné firemní: rámeček, jméno, adresa, telefon, pod linkou IČO a DIČ. V dokladech má vlastní místo
  nad podpisem (na faktuře a nabídce vedle jména) – nepokládat ho absolutně přes podpis, jméno ani částku.
- **Fáze zakázky:** `utils/jobStage.ts` (`getJobStage`, `isActiveJob`) určuje fázi Poptávka → Nabídka → Smlouva →
  Realizace → Předáno → Zaplaceno, podíl na metru a větu „co dál“. Používat ji všude, kde se ukazuje postup zakázky.
  Posun mezi fázemi dělá `moveJobStage` (nastaví `leadStage` a `status`, při zaplacení i `paidDate`); `leadStage`
  má dál jen pět původních hodnot – `completed` znamená předáno, zaplaceno se pozná podle `isContractPaid`.
- **Zakázky** (`LeadsPipelinePage.tsx`): jeden seznam se záložkami fází (ne sloupce nástěnky), u každé zakázky metr,
  věta „co dál“ a tlačítko posunu pojmenované podle cílové fáze. Okno „Nová poptávka“ je vzor pro formuláře v oknech.
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
  `getSiteAddress`, ne přímo z `client.address`. Do textu dokladů se adresa stavby nepropisuje.
- **Archiv** (`HistoryPage.tsx`): seznam všech dokumentů s hledáním; fáze se tu jen zobrazuje, mění se v Zakázkách.
- **Nastavení** (`SettingsPage.tsx`): údaje zhotovitele, podpis, razítko, ceník a záloha. Potvrzení (smazání položky,
  obnova ceníku, obnova ze zálohy) jdou přes `Dialog`, ne přes `window.confirm`.
- **Náhled dokumentů** (`ContractPreview.tsx`): nahoře přilepená lišta (zpět, název, Odeslat, Uložit PDF, další možnosti,
  záložky dokumentů; na mobilu výběr), pod ní řádek zakázky (fáze přes `moveJobStage`, podpis, náklady, nástroje stavby).
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
- **Přehled** (`DashboardPage.tsx`) je vzor pro další obrazovky: nadpis sekce + odkaz vpravo, bílý rámeček s řádky
  oddělenými linkou, velká čísla písmem `font-display`, vedlejší akce jako tlačítka s obrysem, žádné dlaždice se statistikami.
- **Počasí** (`utils/weather.ts`, `components/JobWeather.tsx`): u zakázky ve fázi Smlouva a Realizace se ukáže řádek jen
  tehdy, když předpověď pro obec stavby hlásí do tří dnů chladno, srážky nebo silný vítr. Obec se bere z adresy
  stavby (`getSiteAddress`) a dohledává u Open-Meteo; když se nenajde, nezobrazí se nic (nikdy nedosazovat jiné místo). Texty jsou
  doporučení – neodkazovat v nich na normy (ČSN, BOZP) ani nepsat „zákaz“.
- **Navigace:** `Navbar.tsx` = boční nabídka od šířky `lg`, pod ní úzká horní lišta; `BottomNav.tsx` = spodní lišta
  pod `lg`. Kořen aplikace má `lg:pl-60`.
- **Režimy:** aplikace se řídí světlým/tmavým režimem zařízení; přepínačem si uživatel nastaví vlastní volbu
  (`utils/theme.ts`, klíč `theme_choice` v localStorage). Každá úprava musí fungovat v obou režimech.
- **Dokumenty** (`.contract-page`, `#amendment-printable-paper`, `#quote-printable-paper`, `.print-content`,
  `[data-pdf-paper]`) mají v `index.css` vrácené původní barvy, rohy a písmo – vypadají jako papír, ne jako aplikace.
- Ovládací prvky mají výšku aspoň 44 px a viditelné označení při ovládání klávesnicí.

## Načítání aplikace

Úvodní balík obsahuje jen přihlášení, navigaci a přehled. Ostatní stránky a modály jsou v `App.tsx` přes `React.lazy`
(seznam `lazyLoaders`) a knihovny pro Word a PDF se načítají přes `utils/lazyExports.ts`. Po startu je
`preloadLazyChunks` dotáhne všechny na pozadí, aby aplikace po načtení fungovala i bez připojení. Novou stránku nebo
modál přidávat do `lazyLoaders`, ne statickým importem; `exportDocx`/`exportPdf` nikdy neimportovat přímo z komponent.

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
tests/                        testy (synchronizace, obrázky, částky a data faktur, hranice DPH, čeština, IBAN a QR platba)
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
- **Informace o datech** jsou v modálu účtu („Kde jsou moje data?“). Když se změní, kde nebo jak se data ukládají
  nebo komu se posílají, upravit i tento text – nesmí slibovat nic, co neplatí.
- Změna schématu = úprava `supabase/schema.sql` (musí jít spustit opakovaně) a její nasazení v Supabase.
- **Online podpis** (`utils/signShares.ts`, tabulka `sign_shares`): řemeslník založí odkaz `?sign=<token>` s náhodným
  tajným kódem (uložen u smlouvy jako `signToken`). Zákazník se nepřihlašuje a k tabulce přístup nemá – smlouvu čte
  a podepisuje jen přes databázové funkce `get_sign_share` / `submit_sign_share`. Do odkazu se ukládá jen výřez smlouvy
  (`toSharedContract`), ne náklady, fotky ani deník. Podepsaný odkaz už nejde změnit ani podepsat znovu; nepodepsaný
  vyprší po 90 dnech. Aplikace se na podpis ptá pravidelně (jen u smluv se `signToken` bez podpisu).

## Faktury a částky

Částky, data a stav faktur se počítají jen v `utils/invoiceMath.ts` – používá je doklad faktury, přehled pohledávek,
úvodní stránka, počítadlo po splatnosti i export pro účetní. Nepočítat je znovu v komponentách.
- Cena díla = `contract.price` + dodatky (vícepráce i méněpráce); doplatek = cena − sjednaná záloha.
- Konečná faktura se vystavuje k předání díla (`handoverData.handoverDate`, jinak `deliveryDate`), DUZP je stejné,
  splatnost 14 dnů. Zálohová faktura se vystavuje k datu uzavření smlouvy a jen na zálohu sjednanou ve smlouvě
  (`advanceAmount`); bez ní se nenabízí a žádná částka se nedomýšlí.
- Cenová nabídka (`docKind: 'quote'`) a zakázka bez ceny nejsou pohledávkou ani tržbou.
- U plátců (profil má DIČ) jsou ceny včetně DPH. Sazbu zakázky určuje `getVatRate` (`contract.vatRate`, výchozí 21 %,
  volba 12 % v liště konečné faktury); konečná faktura plátce rozepisuje základ, sazbu a daň přes `getVatBreakdown`
  a stejnou sazbu používá export pro účetní. Zálohová faktura rozpis nemá.
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
- Testy pokrývají synchronizaci, odkazy na obrázky, výpočty faktur a české pomocné funkce; přihlášení a UI se ověřují ručně.
- PDF je obrázek stránky (nejde v něm hledat text). Strany se dělí v mezeře mezi řádky (`computePageSlices`
  v `exportPdf.ts`), ne podle odstavců nebo bloků – nadpis tak může zůstat na konci strany bez svého textu.
- DPH: aplikace nevystavuje daňový doklad k přijaté záloze ani neřeší přenesení daňové povinnosti mezi plátci;
  sazba je jedna na celou zakázku (21 % nebo 12 %).
- Po startu se všechny obrázky účtu načtou do paměti; u tisíců fotek bude potřeba načítání na vyžádání.
