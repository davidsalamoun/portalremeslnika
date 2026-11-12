# Portál živnostníka

Webová aplikace pro české řemeslníky a OSVČ: smlouvy o dílo, cenové nabídky, faktury s QR platbou,
předávací protokoly, kalendář, klienti, náklady a daňový přehled. Původně vygenerováno v Google AI Studiu,
dál se vyvíjí mimo něj.

## Závazná pravidla

1. **Veškeré UI je v češtině.** Texty, hlášky, toasty, popisky i chybové stavy. Komentáře v kódu mohou být česky.
2. **Zachovat současný vzhled.** Neměnit layout, barvy, typografii, Tailwind třídy ani animace, pokud to
   úkol výslovně nevyžaduje. Refaktoring nesmí změnit vykreslený výsledek (světlý i tmavý režim, mobil i desktop, tisk).
3. **Právní texty šablon neměnit bez výslovného pokynu.** Týká se znění smluv, dodatků, protokolů, záručních
   listů, faktur a dokladů v `src/components/ContractPreview.tsx`, `AmendmentView.tsx`, `HandoverProtocolView.tsx`,
   `WarrantyCertificateView.tsx`, `InvoiceView.tsx`, `CashReceiptView.tsx`, `PriceQuoteView.tsx`,
   `TechnicalProtocolsModal.tsx`, `src/utils/exportDocx.ts` a `src/data/craftTemplates.ts`.
   Náhled (HTML/PDF) a export do Wordu obsahují tentýž text dvakrát – při schválené změně upravit obě místa.
4. **Žádná tajemství v prohlížeči ani v repozitáři.** `STRIPE_SECRET_KEY` jen na serveru.
   Proměnné s prefixem `VITE_` jsou veřejné. `.env*` se necommituje (kromě `.env.example`).
5. **Neměnit klíče a tvar dat v localStorage bez migrace** – stejný tvar se ukládá i do databáze (sloupec `data`)
   a čtou ho i starší verze aplikace na jiných zařízeních.
6. **Zápisy dat jen přes `src/utils/storage.ts`** – jinak se změna nedostane do účtu uživatele.

## Příkazy

```bash
npm install
npm run dev                      # Express + Vite middleware na http://localhost:3000 (PORT lze změnit)
npm run build                    # produkční build frontendu do dist/
npm run lint                     # tsc --noEmit
npm test                         # testy synchronizace (tests/*.test.ts, node:test přes tsx)
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

## Technologie

React 19, TypeScript, Vite 8, Tailwind CSS 4 (`@tailwindcss/vite`), `motion`, `lucide-react`,
Express 4 (`api/index.ts`, `server.ts`), Supabase (přihlášení + Postgres), Firebase Firestore (jen online podpis), Stripe, `docx`, `jspdf` + `html2canvas`, `qrcode`.

## Struktura

```
api/index.ts                  Express aplikace: /api/stripe/* (na Vercelu běží jako funkce)
server.ts                     lokální spuštění: api/index.ts + Vite middleware (dev) nebo dist/ (produkce)
vercel.json                   konfigurace nasazení na Vercel
index.html, vite.config.ts    vstup a konfigurace Vite (alias @ = kořen repozitáře)
supabase/schema.sql           databázové schéma a zabezpečení (spouští se ručně v Supabase SQL Editoru)
tests/                        testy (synchronizace)
firebase-applet-config.json   veřejná konfigurace Firebase projektu z AI Studia
firestore.rules               bezpečnostní pravidla Firestore (popis v security_spec.md)
firebase-blueprint.json       popis datového modelu Firestore
src/
  main.tsx, App.tsx           main.tsx obalí aplikaci přihlášením (AuthGate); App.tsx drží veškerý stav,
                              přepíná záložky (bez routeru) a otevírá modály
  index.css                   Tailwind + tiskové styly
  types/contract.ts           všechny datové typy (Contract, Client, ContractorProfile, ...)
  data/craftTemplates.ts      šablony zakázek podle řemesla
  components/                 stránky (*Page.tsx), dokumenty (*View.tsx), modály (*Modal.tsx)
  utils/
    storage.ts                čtení/zápis localStorage (jediné místo zápisu dat)
    supabase.ts               klient Supabase, české hlášky chyb přihlášení
    syncEngine.ts             logika synchronizace localStorage ↔ databáze (bez závislosti na prohlížeči)
    cloudSync.ts              napojení synchronizace na Supabase a prohlížeč, odhlášení
    firebase.ts               online podpis (public_shares); ostatní funkce v souboru se už nepoužívají
    backup.ts                 export/import zálohy JSON
    subscription.ts           tarif PRO, zkušební doba, QR platba předplatného
    spayd.ts                  QR platba (SPAYD), převod čísla účtu na IBAN
    ares.ts                   dohledání firmy podle IČO v ARES
    exportDocx.ts, exportPdf.ts   export dokumentů
    numberToWordsCs.ts, vocativeCs.ts   částka slovy, 5. pád jmen
```

Záložky (`TabType` v `components/Navbar.tsx`): `dashboard`, `kalendar`, `pipeline`, `faktury`,
`nova-smlouva`, `klienti`, `historie`, `finance`, `nastaveni`. Parametr `?sign=<id>` v URL zobrazí místo
aplikace portál pro online podpis klientem (`RemoteSigningPortal.tsx`).

## Přihlášení a data

- **Přihlášení** e-mailem a heslem přes Supabase Auth. `components/AuthGate.tsx` pustí do aplikace jen přihlášeného
  uživatele (`AuthScreen.tsx`: přihlášení, registrace, obnova hesla). Výjimka: portál online podpisu `?sign=…`.
- **Aplikace čte a zapisuje do localStorage** (funguje i bez připojení): klíče `zhotovitel`, `klienti`, `smlouvy`,
  `remeslnik_cenik`, `remeslnik_kalendar`, `theme`. Faktury, náklady, dodatky, fotky, podpisy, deník, kniha jízd
  i protokoly jsou vnořené v objektu `Contract` v klíči `smlouvy` (fotky jako base64).
- **Synchronizace s účtem**: `storage.ts` po každém zápisu ohlásí změnu, `syncEngine.ts` ji zařadí do fronty
  (klíč `cloud_sync_state`), odešle do Supabase a stahuje změny z jiných zařízení. Tabulky `profiles`, `clients`,
  `contracts`, `calendar_events`, `price_list_items` mají stejný tvar (`user_id`, `id`, `data` jsonb, `updated_at`,
  `deleted_at`); smazání je značka `deleted_at`. Řádky chrání RLS – každý vidí jen své.
- **První přihlášení v prohlížeči** nahraje do účtu data, která v něm vznikla dříve. **Odhlášení** data účtu
  z prohlížeče smaže (zůstávají v účtu). Při konfliktu vyhrává poslední zápis celého záznamu.
- Změna schématu = úprava `supabase/schema.sql` (musí jít spustit opakovaně) a ruční spuštění v Supabase.
- **Online podpis** zatím používá veřejnou Firestore kolekci `public_shares/{id smlouvy}`.

## AI

Aplikace žádné AI funkce neobsahuje – AI rozpočet, sken účtenek, checker smluv i AI rádce byly na pokyn vlastníka
odstraněny včetně serverových endpointů a závislosti na Gemini. Nepřidávat je zpět bez výslovného pokynu.

## Známé limity (stav po převzetí z AI Studia)

- Předplatné PRO se aktivuje jen v prohlížeči (simulovaná platba, parametr `?stripe_success=true`); neověřuje se na serveru.
- Testy pokrývají jen synchronizaci; přihlášení a UI se ověřují ručně.
- Fotky jsou uložené jako base64 uvnitř smluv (velké řádky v databázi, limit localStorage ~5 MB).
- Online podpis běží přes Firebase s uhodnutelným ID a bez přihlášení.
