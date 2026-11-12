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
   `TechnicalProtocolsModal.tsx`, `src/utils/exportDocx.ts`, `src/data/craftTemplates.ts` a AI promptů v `server.ts`.
   Náhled (HTML/PDF) a export do Wordu obsahují tentýž text dvakrát – při schválené změně upravit obě místa.
4. **Žádná tajemství v prohlížeči ani v repozitáři.** `GEMINI_API_KEY` a `STRIPE_SECRET_KEY` jen na serveru.
   Proměnné s prefixem `VITE_` jsou veřejné. `.env*` se necommituje (kromě `.env.example`).
5. **Neměnit klíče a tvar dat v localStorage bez migrace** – uživatelé mají data jen ve svém prohlížeči.

## Příkazy

```bash
npm install --legacy-peer-deps   # --legacy-peer-deps je nutné, dokud je v package.json esbuild ^0.25 (Vite 8 chce ^0.27 || ^0.28)
npm run dev                      # Express + Vite middleware na http://localhost:3000 (PORT lze změnit)
npm run build                    # produkční build frontendu do dist/
npm run lint                     # tsc --noEmit (jediná kontrola, testy v projektu nejsou)
NODE_ENV=production npm start    # Express servíruje dist/ + /api
```

Proměnné prostředí (viz `.env.example`): `GEMINI_API_KEY`, `STRIPE_SECRET_KEY`, `APP_URL`,
`VITE_STRIPE_PAYMENT_LINK_MONTHLY`, `VITE_STRIPE_PAYMENT_LINK_YEARLY`.
Pozor: `server.ts` soubor `.env` sám nenačítá (balíček `dotenv` je nainstalovaný, ale neimportuje se) –
proměnné je třeba předat v shellu nebo spustit `npx tsx --env-file=.env server.ts`.

## Technologie

React 19, TypeScript, Vite 8, Tailwind CSS 4 (`@tailwindcss/vite`), `motion`, `lucide-react`,
Express 4 (`server.ts`), `@google/genai`, Firebase (Auth + Firestore), Stripe, `docx`, `jspdf` + `html2canvas`, `qrcode`.

## Struktura

```
server.ts                     Express: /api/ai/*, /api/stripe/*, v dev Vite middleware, v produkci dist/
index.html, vite.config.ts    vstup a konfigurace Vite (alias @ = kořen repozitáře)
firebase-applet-config.json   veřejná konfigurace Firebase projektu z AI Studia
firestore.rules               bezpečnostní pravidla Firestore (popis v security_spec.md)
firebase-blueprint.json       popis datového modelu Firestore
src/
  main.tsx, App.tsx           App.tsx drží veškerý stav, přepíná záložky (bez routeru) a otevírá modály
  index.css                   Tailwind + tiskové styly
  types/contract.ts           všechny datové typy (Contract, Client, ContractorProfile, ...)
  data/craftTemplates.ts      šablony zakázek podle řemesla
  components/                 stránky (*Page.tsx), dokumenty (*View.tsx), modály (*Modal.tsx)
  utils/
    storage.ts                čtení/zápis localStorage
    firebase.ts               přihlášení Googlem, synchronizace, online podpis (public_shares)
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

## Data

- **Hlavní úložiště je localStorage**: klíče `zhotovitel`, `klienti`, `smlouvy`, `remeslnik_cenik`,
  `remeslnik_kalendar`, `theme`, `last_cloud_sync`. Faktury, náklady, dodatky, fotky, podpisy, deník,
  kniha jízd i protokoly jsou vnořené v objektu `Contract` v klíči `smlouvy` (fotky jako base64).
- **Firestore je jen volitelná záloha** po přihlášení Googlem (`CloudAccountModal.tsx`): profil, klienti
  a smlouvy (celá smlouva jako JSON řetězec `dataJson`, limit 900 kB). Kalendář a ceník se nesynchronizují.
- **Online podpis** používá veřejnou kolekci `public_shares/{id smlouvy}`.

## AI (Gemini)

Volá se pouze ze serveru (`server.ts`), klíč z `process.env.GEMINI_API_KEY`:
`POST /api/ai/budget-from-input` (rozpočet z textu/fotky), `POST /api/ai/extract-receipt` (vytěžení účtenky),
`POST /api/ai/legal-check` a `POST /api/ai/craftsman-chat` (zatím bez napojení v UI).
Při chybě AI endpointy vrací předpřipravená ukázková data se stavem 200 – při úpravách na to myslet.

## Známé limity (stav po převzetí z AI Studia)

- Předplatné PRO se aktivuje jen v prohlížeči (simulovaná platba, parametr `?stripe_success=true`); neověřuje se na serveru.
- `/api/*` nemá přihlášení ani omezení počtu požadavků.
- Projekt nemá testy ani lockfile pro npm (`bun.lock` zůstal z AI Studia).
