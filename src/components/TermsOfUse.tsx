import React, { useEffect, useState } from 'react';
import { Dialog } from './Dialog';
import { OPERATOR, PRIVACY_HASH, TERMS_HASH, TERMS_VERSION } from '../config/operator';
import { formatDateCs } from '../utils/numberToWordsCs';
import { supabase } from '../utils/supabase';

/**
 * Podmínky používání aplikace včetně smlouvy o zpracování osobních údajů (čl. 28 GDPR). Text musí odpovídat
 * skutečnému chování aplikace. Při změně znění posunout TERMS_VERSION v config/operator.ts – stávající uživatelé
 * je pak po přihlášení potvrdí znovu.
 */
const h = 'font-display font-semibold text-xl text-slate-900 dark:text-white mt-6 mb-2';
const p = 'mb-2.5';
const ol = 'list-[lower-alpha] pl-6 space-y-1.5 mb-2.5';
const link = 'text-blue-600 dark:text-blue-300 underline underline-offset-2';

export const TermsOfUseText: React.FC = () => (
  <div className="text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">
    <p className={`${p} text-slate-600 dark:text-slate-400`}>Účinné od {formatDateCs(TERMS_VERSION)}.</p>

    <h3 className={h}>1. Úvodní ustanovení</h3>
    <p className={p}>
      Tyto podmínky používání (dále jen „podmínky“) upravují práva a povinnosti mezi provozovatelem webové aplikace
      Řemeslník PRO, kterým je <strong>{OPERATOR.name}</strong>
      {OPERATOR.ico ? `, IČO ${OPERATOR.ico}` : ''}
      {OPERATOR.address ? `, se sídlem ${OPERATOR.address}` : ''}, kontaktní e-mail{' '}
      <a className={link} href={`mailto:${OPERATOR.email}`}>
        {OPERATOR.email}
      </a>{' '}
      (dále jen „provozovatel“), a uživatelem aplikace (dále jen „uživatel“).
    </p>
    <p className={p}>
      Aplikace je určena podnikatelům, zejména osobám samostatně výdělečně činným, k vedení zakázek a vyhotovování
      souvisejících dokumentů. Uživatel registrací potvrzuje, že aplikaci užívá v rámci své podnikatelské činnosti.
      Smluvní vztah se proto neřídí ustanoveními o spotřebitelských smlouvách.
    </p>
    <p className={p}>
      Smlouva o užívání aplikace (dále jen „smlouva“) je uzavřena okamžikem dokončení registrace, při níž uživatel
      vysloví souhlas s těmito podmínkami. Smlouva se uzavírá na dobu neurčitou a v českém jazyce.
    </p>

    <h3 className={h}>2. Popis služby a cena</h3>
    <p className={p}>
      Aplikace umožňuje zejména evidenci klientů a zakázek, vyhotovení smluv o dílo, cenových nabídek, faktur,
      předávacích protokolů a dalších dokumentů, jejich podpis a odeslání, vedení kalendáře a nákladů a synchronizaci
      dat mezi zařízeními uživatele (dále jen „služba“).
    </p>
    <p className={p}>
      Služba je v současné době poskytována bezplatně. Zavede-li provozovatel placenou verzi služby, oznámí to
      uživateli v aplikaci předem; placené funkce budou uživateli zpřístupněny až po jeho výslovném rozhodnutí
      o jejich objednání a zaplacení.
    </p>

    <h3 className={h}>3. Uživatelský účet</h3>
    <ol className={ol}>
      <li>Uživatel je povinen uvádět v aplikaci pravdivé, úplné a aktuální údaje.</li>
      <li>
        Uživatel je povinen chránit své přihlašovací údaje před zneužitím a bez zbytečného odkladu informovat
        provozovatele o podezření na neoprávněný přístup k účtu. Za činnost provedenou prostřednictvím jeho účtu
        odpovídá uživatel.
      </li>
      <li>
        Uživatel nesmí aplikaci užívat v rozporu s právními předpisy, narušovat její provoz ani se pokoušet o přístup
        k datům jiných uživatelů.
      </li>
    </ol>

    <h3 className={h}>4. Dokumenty a odpovědnost uživatele</h3>
    <p className={p}>
      Vzory smluv a dalších dokumentů jsou pomůckou k jejich vyhotovení a nenahrazují právní, daňové ani účetní
      poradenství. Uživatel odpovídá za obsah dokumentů, které v aplikaci vyhotoví, podepíše nebo odešle, za jejich
      soulad s právními předpisy a s jeho skutečnými poměry, jakož i za splnění svých daňových, účetních
      a archivačních povinností. Údaje o hranicích obratu a daňových pásmech mají orientační povahu.
    </p>

    <h3 className={h}>5. Dostupnost služby a zálohování</h3>
    <p className={p}>
      Provozovatel vynakládá přiměřené úsilí k nepřetržitému provozu aplikace, avšak její nepřetržitou dostupnost
      nezaručuje. Provoz může být přerušen zejména z důvodu údržby, aktualizace nebo výpadku služeb třetích osob.
      Data uložená v zařízení uživatele jsou dostupná i bez připojení k internetu.
    </p>
    <p className={p}>
      Uživateli se doporučuje pravidelně pořizovat zálohu dat (Nastavení → Záloha) a důležité dokumenty si ukládat
      ve formátu PDF nebo ISDOC.
    </p>

    <h3 className={h}>6. Omezení odpovědnosti</h3>
    <p className={p}>
      Provozovatel neodpovídá za obsah dokumentů vyhotovených uživatelem, za rozhodnutí učiněná na základě údajů
      zobrazených v aplikaci ani za škodu vzniklou přerušením provozu aplikace nebo ztrátou dat, k níž by nedošlo,
      pokud by uživatel postupoval podle čl. 5. Celková odpovědnost provozovatele za škodu je omezena částkou, kterou
      uživatel za službu zaplatil v posledních dvanácti měsících. Tato omezení se nevztahují na újmu způsobenou
      úmyslně nebo z hrubé nedbalosti ani na jiné případy, v nichž právní předpisy omezení odpovědnosti nepřipouštějí.
    </p>

    <h3 className={h}>7. Práva k aplikaci a k datům</h3>
    <p className={p}>
      Provozovatel uděluje uživateli po dobu trvání smlouvy nevýhradní oprávnění aplikaci užívat v souladu s těmito
      podmínkami. Data, která uživatel do aplikace vloží, náležejí uživateli; provozovatel je užívá výhradně
      k poskytování služby.
    </p>

    <h3 className={h}>8. Ukončení smlouvy</h3>
    <ol className={ol}>
      <li>
        Uživatel může smlouvu kdykoli ukončit zrušením účtu v aplikaci (Účet → Smazat účet). Zrušením účtu se
        nevratně vymažou veškerá data uživatele.
      </li>
      <li>Provozovatel může smlouvu vypovědět s výpovědní dobou 30 dnů, a to oznámením na e-mailovou adresu účtu.</li>
      <li>
        Provozovatel může účet zrušit nebo zablokovat bez výpovědní doby, porušuje-li uživatel tyto podmínky
        podstatným způsobem.
      </li>
      <li>
        Před ukončením smlouvy ze strany provozovatele bude uživateli umožněno stáhnout zálohu svých dat.
      </li>
    </ol>

    <h3 className={h}>9. Zpracování osobních údajů zákazníků uživatele</h3>
    <p className={p}>
      Tento článek tvoří smlouvu o zpracování osobních údajů podle čl. 28 nařízení Evropského parlamentu a Rady (EU)
      2016/679 (dále jen „GDPR“). Uživatel je ve vztahu k osobním údajům svých zákazníků správcem a provozovatel
      jejich zpracovatelem.
    </p>
    <ol className={ol}>
      <li>
        <strong>Předmět a doba zpracování.</strong> Provozovatel zpracovává osobní údaje, které uživatel vloží do
        aplikace, po dobu trvání smlouvy.
      </li>
      <li>
        <strong>Povaha a účel zpracování.</strong> Uložení, synchronizace mezi zařízeními uživatele, zobrazení a vytvoření
        dokumentů a zpřístupnění smlouvy zákazníkovi k elektronickému podpisu, a to výhradně za účelem poskytování
        služby.
      </li>
      <li>
        <strong>Typ osobních údajů.</strong> Jméno a příjmení, adresa, adresa místa plnění, telefon, e-mail, IČO a DIČ,
        podpis, údaje o zakázkách, cenách a platbách a fotografie pořízené uživatelem.
      </li>
      <li>
        <strong>Kategorie subjektů údajů.</strong> Zákazníci a obchodní partneři uživatele a jejich zástupci.
      </li>
    </ol>
    <p className={p}>Provozovatel se zavazuje:</p>
    <ol className={ol}>
      <li>zpracovávat osobní údaje pouze na základě pokynů uživatele, které jsou dány jeho užíváním aplikace;</li>
      <li>zajistit, aby osoby oprávněné zpracovávat osobní údaje byly zavázány k mlčenlivosti;</li>
      <li>přijmout technická a organizační opatření k zabezpečení osobních údajů podle čl. 32 GDPR;</li>
      <li>
        zapojit další zpracovatele jen na základě tohoto obecného povolení; dalšími zpracovateli jsou Supabase Inc.
        (přihlašování, databáze a úložiště souborů; data uložena v Evropské unii) a Vercel Inc. (hosting aplikace).
        O zamýšlené změně dalších zpracovatelů provozovatel uživatele předem informuje; uživatel může proti změně
        vznést námitku a smlouvu ukončit. Další zpracovatele provozovatel zavazuje ke stejným povinnostem;
      </li>
      <li>
        být uživateli nápomocen při plnění jeho povinností vůči subjektům údajů a povinností podle čl. 32 až 36 GDPR,
        s ohledem na povahu zpracování a informace, jež má k dispozici;
      </li>
      <li>ohlásit uživateli bez zbytečného odkladu porušení zabezpečení osobních údajů, které zjistí;</li>
      <li>
        po ukončení smlouvy osobní údaje vymazat; vrácení údajů uživatel zajistí stažením zálohy dat před zrušením
        účtu;
      </li>
      <li>
        poskytnout uživateli informace potřebné k doložení splnění těchto povinností a umožnit audit v přiměřeném
        rozsahu po předchozí dohodě.
      </li>
    </ol>
    <p className={p}>
      Pro zobrazení předpovědi počasí u zakázky se službě Open-Meteo předává pouze název obce z adresy stavby, bez
      dalších údajů o zákazníkovi. Uživatel odpovídá za to, že má ke zpracování osobních údajů svých zákazníků právní
      základ, a za splnění informační povinnosti vůči nim. Zpracování osobních údajů uživatele samotného popisují{' '}
      <a className={link} href={PRIVACY_HASH}>
        zásady ochrany osobních údajů
      </a>
      .
    </p>

    <h3 className={h}>10. Změny podmínek</h3>
    <p className={p}>
      Provozovatel je oprávněn tyto podmínky přiměřeně měnit, zejména v návaznosti na vývoj aplikace nebo změnu
      právních předpisů. Změnu oznámí uživateli v aplikaci nejméně 14 dnů před její účinností. Nesouhlasí-li uživatel
      se změnou, je oprávněn smlouvu ukončit zrušením účtu.
    </p>

    <h3 className={h}>11. Závěrečná ustanovení</h3>
    <p className={p}>
      Smlouva se řídí právním řádem České republiky, zejména zákonem č. 89/2012 Sb., občanský zákoník. Spory ze
      smlouvy rozhodují obecné soudy České republiky. Písemnosti se uživateli doručují na e-mailovou adresu jeho účtu
      nebo prostřednictvím aplikace. Je-li některé ustanovení podmínek neplatné, nedotýká se to platnosti ostatních
      ustanovení.
    </p>
  </div>
);

/** Podmínky jako okno nad čímkoli – otevře je odkaz s `#podminky-pouzivani` (úvodní stránka, registrace, aplikace). */
export const TermsOfUseHost: React.FC = () => {
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && window.location.hash === TERMS_HASH);
  useEffect(() => {
    const onHash = () => setOpen(window.location.hash === TERMS_HASH);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  if (!open) return null;
  const close = () => {
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setOpen(false);
  };
  return (
    <Dialog title="Podmínky používání" size="3xl" onClose={close}>
      <TermsOfUseText />
    </Dialog>
  );
};

/** Odkaz na podmínky (otevře okno s podmínkami). */
export const TermsLink: React.FC<{ className?: string; children?: React.ReactNode }> = ({ className, children }) => (
  <a href={TERMS_HASH} className={className ?? 'underline underline-offset-2 cursor-pointer'}>
    {children ?? 'Podmínky používání'}
  </a>
);

/** Údaje o souhlasu s podmínkami, které se ukládají k účtu (user_metadata v Supabase). */
export const termsAcceptance = () => ({ terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() });

/**
 * Pruh nad aplikací pro účet, který aktuální znění podmínek ještě nepotvrdil (účty založené před jejich vydáním
 * nebo před poslední změnou). Bez signálu se neukazuje – souhlas se ukládá do účtu.
 */
export const TermsUpdateBanner: React.FC = () => {
  const [state, setState] = useState<'hidden' | 'new' | 'updated'>('hidden');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.onLine) return;
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        const meta = data.session?.user?.user_metadata as { terms_version?: string } | undefined;
        if (!active || !data.session) return;
        if (meta?.terms_version === TERMS_VERSION) return;
        setState(meta?.terms_version ? 'updated' : 'new');
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (state === 'hidden') return null;

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.updateUser({ data: termsAcceptance() });
      if (err) throw err;
      setState('hidden');
    } catch {
      setError('Souhlas se nepodařilo uložit. Zkontrolujte připojení k internetu a zkuste to znovu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="no-print lg:pl-60 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="flex-1 text-[15px] text-slate-700 dark:text-slate-200">
          <strong className="font-semibold text-slate-900 dark:text-white">
            {state === 'updated' ? 'Aktualizovali jsme podmínky používání.' : 'Vydali jsme podmínky používání aplikace.'}
          </strong>{' '}
          Prosíme o jejich potvrzení.
          {error && (
            <span role="alert" className="block mt-1 text-rose-700 dark:text-rose-300">
              {error}
            </span>
          )}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <TermsLink className="min-h-11 inline-flex items-center px-4 rounded-md border-[1.5px] border-slate-300 dark:border-slate-600 text-[15px] font-semibold text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800">
            Přečíst
          </TermsLink>
          <button
            type="button"
            onClick={accept}
            disabled={busy}
            className="min-h-11 px-4 rounded-md bg-amber-400 hover:bg-amber-300 text-slate-900 text-[15px] font-semibold border-[1.5px] border-slate-900 cursor-pointer disabled:opacity-60"
          >
            {busy ? 'Ukládám…' : 'Souhlasím'}
          </button>
        </div>
      </div>
    </div>
  );
};
