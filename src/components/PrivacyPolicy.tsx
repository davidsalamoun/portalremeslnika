import React, { useEffect, useState } from 'react';
import { Dialog } from './Dialog';
import { OPERATOR, PRIVACY_HASH, PRIVACY_POLICY_DATE } from '../config/operator';
import { formatDateCs } from '../utils/numberToWordsCs';

/**
 * Zásady ochrany osobních údajů. Text popisuje skutečné chování aplikace – při změně toho, kam a jak se data
 * ukládají nebo komu se posílají, upravit i tento text (a „Kde jsou moje data?“ v CloudAccountModal).
 */
const h = 'font-display font-semibold text-xl text-slate-900 dark:text-white mt-6 mb-2';
const p = 'mb-2.5';
const ul = 'list-disc pl-5 space-y-1.5 mb-2.5';

export const PrivacyPolicyText: React.FC = () => (
  <div className="text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">
    <p className={`${p} text-slate-600 dark:text-slate-400`}>Platí od {formatDateCs(PRIVACY_POLICY_DATE)}.</p>
    <p className={p}>
      Tady popisujeme, jaké osobní údaje aplikace Řemeslník PRO zpracovává, proč, komu je předává, jak dlouho je
      uchovává a jaká máte práva. Snažíme se psát srozumitelně a jen to, co aplikace opravdu dělá.
    </p>

    <h3 className={h}>1. Kdo údaje zpracovává</h3>
    <p className={p}>
      Správcem osobních údajů uživatelů aplikace je <strong>{OPERATOR.name}</strong>
      {OPERATOR.ico ? `, IČO ${OPERATOR.ico}` : ''}
      {OPERATOR.address ? `, ${OPERATOR.address}` : ''}
      {/* Za názvem končícím tečkou („s.r.o.“) už druhá tečka nepatří */}
      {OPERATOR.address || !OPERATOR.name.endsWith('.') ? '.' : ''} Kontakt pro všechny dotazy k osobním údajům:{' '}
      <a className="text-blue-600 dark:text-blue-300 underline underline-offset-2" href={`mailto:${OPERATOR.email}`}>
        {OPERATOR.email}
      </a>
      .
    </p>

    <h3 className={h}>2. Jaké údaje zpracováváme a proč</h3>
    <p className={p}>
      <strong>Účet.</strong> E-mail a heslo k přihlášení. Heslo neznáme – služba pro přihlášení ho ukládá jen v podobě,
      ze které nejde zpětně zjistit. Důvod: abyste mohli aplikaci používat (plnění smlouvy, čl. 6 odst. 1 písm. b GDPR).
    </p>
    <p className={p}>
      <strong>Údaje, které do aplikace zapíšete.</strong> Váš profil (jméno nebo název, IČO, DIČ, adresa, bankovní účet,
      telefon, e-mail, podpis), klienti, zakázky, smlouvy, nabídky, faktury a další doklady, fotky, náklady, kniha jízd
      a kalendář. Ukládají se ve vašem zařízení a ve vašem účtu, abyste je měli na všech svých zařízeních. Důvod: plnění
      smlouvy.
    </p>
    <p className={p}>
      <strong>Technické údaje.</strong> Při používání webu se u poskytovatelů hostingu a databáze krátkodobě zaznamenává IP
      adresa, čas a druh požadavku. Důvod: zabezpečení a provoz služby (oprávněný zájem, čl. 6 odst. 1 písm. f GDPR).
    </p>
    <p className={p}>
      Nepoužíváme reklamu ani nástroje na sledování návštěvnosti a údaje nikomu neprodáváme. O ničem nerozhodujeme
      automaticky a nevytváříme profily.
    </p>

    <h3 className={h}>3. Údaje vašich zákazníků</h3>
    <p className={p}>
      Údaje zákazníků (jména, adresy, telefony, e-maily, podpisy) do aplikace zapisuje řemeslník. Za ně je správcem on
      a my je pro něj jen ukládáme a zobrazujeme (jsme zpracovatel). Řemeslník odpovídá za to, že je smí zpracovávat,
      a zákazníka o tom informuje.
    </p>
    <p className={p}>
      <strong>Online podpis.</strong> Když řemeslník pošle zákazníkovi odkaz k podpisu, uloží se k odkazu smlouva (smluvní
      strany, předmět, cena, položky, termíny a celé znění) – ne náklady, fotky ani deník. Zákazník se nepřihlašuje; odkaz
      obsahuje náhodný tajný kód. Při podpisu se uloží jméno podepisujícího, podpis a čas. Nepodepsaný odkaz po 90 dnech
      přestane platit. Údaje z odkazu se smažou spolu s účtem řemeslníka.
    </p>

    <h3 className={h}>4. Komu údaje předáváme</h3>
    <ul className={ul}>
      <li>
        <strong>Supabase</strong> (Supabase Inc.) – přihlášení, databáze a úložiště fotek. Data jsou na serverech v EU
        (Paříž).
      </li>
      <li>
        <strong>Vercel</strong> (Vercel Inc.) – hosting webu; vidí technické údaje o přístupu.
      </li>
      <li>
        <strong>ARES</strong> (Ministerstvo financí ČR) – jen když dohledáváte firmu podle IČO; posílá se zadané IČO.
      </li>
      <li>
        <strong>Open-Meteo</strong> – kvůli předpovědi počasí u rozpracované zakázky se posílá název obce z adresy stavby
        (bez jména a ulice) a tím i IP adresa vašeho zařízení.
      </li>
    </ul>
    <p className={p}>
      Supabase a Vercel jsou americké společnosti. Pokud by se údaje dostaly mimo EU, děje se to na základě záruk podle
      GDPR (standardní smluvní doložky Evropské komise nebo rámec EU–USA pro ochranu osobních údajů).
    </p>
    <p className={p}>
      Když doklad pošlete přes WhatsApp, SMS nebo e-mail, posíláte ho svou aplikací a vaším účtem u dané služby – tam
      už platí její pravidla.
    </p>

    <h3 className={h}>5. Jak dlouho údaje uchováváme</h3>
    <ul className={ul}>
      <li>Údaje v aplikaci, dokud máte účet. Účet můžete kdykoli smazat v aplikaci (Účet → Smazat účet); smažou se i fotky a podpisy.</li>
      <li>Při odhlášení se data smažou z daného zařízení, ve vašem účtu zůstanou.</li>
      <li>Fotky, na které už nic v aplikaci neodkazuje, se mažou po 30 dnech.</li>
      <li>Technické záznamy uchovávají poskytovatelé jen po dobu nutnou pro provoz a bezpečnost.</li>
    </ul>
    <p className={p}>
      Účetní doklady musíte jako podnikatel archivovat po dobu stanovenou zákonem. Před smazáním účtu si proto stáhněte
      zálohu (Nastavení → Záloha) nebo doklady v PDF či ISDOC.
    </p>

    <h3 className={h}>6. Cookies a úložiště v prohlížeči</h3>
    <p className={p}>
      Aplikace nepoužívá reklamní ani analytické cookies. Do úložiště prohlížeče ukládá jen to, bez čeho nefunguje:
      přihlášení, vaše data a fotky (aby šlo pracovat i bez signálu), soubory aplikace pro práci bez signálu a drobná
      nastavení (světlý nebo tmavý režim, skrytí průvodce). K tomu souhlas není potřeba.
    </p>

    <h3 className={h}>7. Zabezpečení</h3>
    <p className={p}>
      Spojení je šifrované (HTTPS). Data v databázi jsou oddělená podle účtu – každý vidí jen svá. Fotky jsou v neveřejném
      úložišti. Heslo nikdo z nás nevidí.
    </p>

    <h3 className={h}>8. Vaše práva</h3>
    <ul className={ul}>
      <li>získat přístup k údajům a jejich kopii,</li>
      <li>opravit nepřesné údaje (většinu můžete sami přímo v aplikaci),</li>
      <li>výmaz (smazáním účtu nebo na požádání),</li>
      <li>omezení zpracování a vznést námitku proti zpracování z oprávněného zájmu,</li>
      <li>přenositelnost – zálohu všech dat si stáhnete v aplikaci jako soubor JSON,</li>
      <li>
        podat stížnost u Úřadu pro ochranu osobních údajů (Pplk. Sochora 27, 170 00 Praha 7,{' '}
        <a className="text-blue-600 dark:text-blue-300 underline underline-offset-2" href="https://uoou.gov.cz" target="_blank" rel="noopener noreferrer">
          uoou.gov.cz
        </a>
        ).
      </li>
    </ul>
    <p className={p}>
      Žádost pošlete na {OPERATOR.email}. Odpovíme bez zbytečného odkladu, nejpozději do jednoho měsíce. Zákazník
      řemeslníka se se žádostí obrací nejdřív na řemeslníka.
    </p>

    <h3 className={h}>9. Změny</h3>
    <p className={p}>
      Když se změní, jak s údaji zacházíme, upravíme tyto zásady a datum nahoře a podstatné změny oznámíme v aplikaci.
    </p>
  </div>
);

/** Zásady jako okno nad čímkoli – otevře je odkaz s `#ochrana-osobnich-udaju` (úvodní stránka, registrace, aplikace, portál). */
export const PrivacyPolicyHost: React.FC = () => {
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && window.location.hash === PRIVACY_HASH);
  useEffect(() => {
    const onHash = () => setOpen(window.location.hash === PRIVACY_HASH);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  if (!open) return null;
  const close = () => {
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setOpen(false);
  };
  return (
    <Dialog title="Ochrana osobních údajů" size="3xl" onClose={close}>
      <PrivacyPolicyText />
    </Dialog>
  );
};

/** Odkaz na zásady (otevře okno se zásadami). */
export const PrivacyLink: React.FC<{ className?: string; children?: React.ReactNode }> = ({ className, children }) => (
  <a href={PRIVACY_HASH} className={className ?? 'underline underline-offset-2 cursor-pointer'}>
    {children ?? 'Ochrana osobních údajů'}
  </a>
);
