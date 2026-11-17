import React from 'react';
import { OPERATOR, PRIVACY_POLICY_DATE } from '../config/operator';
import { formatDateCs } from '../utils/numberToWordsCs';

/**
 * Zásady ochrany osobních údajů. Text popisuje skutečné chování aplikace – při změně toho, kam a jak se data
 * ukládají nebo komu se posílají, upravit i tento text (a „Kde jsou moje data?“ v CloudAccountModal).
 */
const h = 'font-display font-semibold text-xl text-slate-900 dark:text-white mt-6 mb-2';
const p = 'mb-2.5';
const ul = 'list-disc pl-5 space-y-1.5 mb-2.5';

const ol = 'list-[lower-alpha] pl-6 space-y-1.5 mb-2.5';
const mail = 'text-blue-600 dark:text-blue-300 underline underline-offset-2';

export const PrivacyPolicyText: React.FC = () => (
  <div className="text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">
    <p className={`${p} text-slate-600 dark:text-slate-400`}>Účinné od {formatDateCs(PRIVACY_POLICY_DATE)}.</p>
    <p className={p}>
      Tyto zásady ochrany osobních údajů (dále jen „zásady“) informují v souladu s čl. 13 a 14 nařízení Evropského
      parlamentu a Rady (EU) 2016/679, obecného nařízení o ochraně osobních údajů (dále jen „GDPR“), o zpracování
      osobních údajů v souvislosti s provozem webové aplikace Řemeslník PRO (dále jen „aplikace“).
    </p>

    <h3 className={h}>1. Správce osobních údajů</h3>
    <p className={p}>
      Správcem osobních údajů uživatelů aplikace je <strong>{OPERATOR.name}</strong>
      {OPERATOR.ico ? `, IČO ${OPERATOR.ico}` : ''}
      {OPERATOR.address ? `, se sídlem ${OPERATOR.address}` : ''} (dále jen „správce“).
    </p>
    <p className={p}>
      Ve věcech ochrany osobních údajů lze správce kontaktovat na e-mailové adrese{' '}
      <a className={mail} href={`mailto:${OPERATOR.email}`}>
        {OPERATOR.email}
      </a>
      . Správce nejmenoval pověřence pro ochranu osobních údajů, neboť mu tato povinnost nevzniká.
    </p>

    <h3 className={h}>2. Rozsah, účel a právní základ zpracování</h3>
    <p className={p}>Správce zpracovává tyto kategorie osobních údajů:</p>
    <ol className={ol}>
      <li>
        <strong>Údaje o uživatelském účtu</strong> – e-mailová adresa, přihlašovací heslo a datum a verze souhlasu
        s podmínkami používání. Heslo je uloženo výhradně
        v jednosměrně zašifrované podobě a správce k němu nemá přístup. Účelem je zřízení a vedení uživatelského účtu;
        právním základem je plnění smlouvy (čl. 6 odst. 1 písm. b) GDPR).
      </li>
      <li>
        <strong>Údaje vložené uživatelem do aplikace</strong> – identifikační a kontaktní údaje uživatele (jméno nebo
        obchodní firma, IČO, DIČ, adresa, číslo bankovního účtu, telefon, e-mail, vlastnoruční podpis) a údaje o jeho
        činnosti (klienti, zakázky, smlouvy, cenové nabídky, faktury a jiné doklady, fotografie, náklady, kniha jízd,
        kalendář). Účelem je poskytování funkcí aplikace a synchronizace mezi zařízeními uživatele; právním základem
        je plnění smlouvy (čl. 6 odst. 1 písm. b) GDPR).
      </li>
      <li>
        <strong>Provozní údaje</strong> – IP adresa, datum a čas a druh požadavku, zaznamenávané poskytovateli hostingu
        a databáze. Účelem je zajištění bezpečnosti a provozu aplikace; právním základem je oprávněný zájem správce
        (čl. 6 odst. 1 písm. f) GDPR).
      </li>
    </ol>
    <p className={p}>
      Správce nepoužívá osobní údaje k marketingovým účelům, neprovádí měření návštěvnosti, nezpřístupňuje údaje
      reklamním sítím, údaje neprodává a neprovádí automatizované rozhodování ani profilování ve smyslu čl. 22 GDPR.
    </p>

    <h3 className={h}>3. Osobní údaje zákazníků uživatele</h3>
    <p className={p}>
      Osobní údaje zákazníků uživatele (zejména jméno, adresa, telefon, e-mail a podpis) vkládá do aplikace uživatel.
      Ve vztahu k těmto údajům je správcem uživatel a provozovatel aplikace je jejich zpracovatelem ve smyslu čl. 28
      GDPR; zpracovává je pouze v rozsahu nezbytném pro poskytování funkcí aplikace. Uživatel odpovídá za to, že má
      ke zpracování těchto údajů právní základ, a za splnění informační povinnosti vůči svým zákazníkům.
    </p>
    <p className={p}>
      <strong>Elektronický podpis smlouvy zákazníkem.</strong> Vytvoří-li uživatel odkaz k podpisu smlouvy, uloží se
      k odkazu obsah smlouvy (smluvní strany, předmět, cena, položky, termíny a úplné znění smlouvy); náklady,
      fotografie a stavební deník se k odkazu neukládají. Odkaz je chráněn náhodně vygenerovaným kódem a zákazník se
      do aplikace nepřihlašuje. Při podpisu se zaznamená jméno podepisující osoby, podpis a čas podpisu. Nepodepsaný
      odkaz pozbývá platnosti uplynutím 90 dnů od vytvoření. Údaje uložené k odkazu se vymažou současně se
      zrušením účtu uživatele.
    </p>

    <h3 className={h}>4. Příjemci osobních údajů</h3>
    <p className={p}>Osobní údaje jsou zpřístupněny těmto příjemcům, a to pouze v rozsahu nezbytném pro daný účel:</p>
    <ol className={ol}>
      <li>
        <strong>Supabase Inc.</strong> – poskytovatel služby přihlašování, databáze a úložiště souborů (zpracovatel);
        data jsou uložena na serverech v Evropské unii (Paříž, Francie);
      </li>
      <li>
        <strong>Vercel Inc.</strong> – poskytovatel hostingu webové aplikace (zpracovatel), který zpracovává provozní
        údaje;
      </li>
      <li>
        <strong>Ministerstvo financí ČR</strong>, registr ARES – při dohledání subjektu podle IČO je předáno pouze
        zadané IČO;
      </li>
      <li>
        <strong>služba Open-Meteo</strong> – pro zobrazení předpovědi počasí u rozpracované zakázky je předán název
        obce z adresy stavby (bez jména a ulice) a v rámci technického spojení IP adresa zařízení.
      </li>
    </ol>
    <p className={p}>
      Společnosti Supabase Inc. a Vercel Inc. mají sídlo ve Spojených státech amerických. Případné předání osobních
      údajů do třetí země se uskutečňuje na základě vhodných záruk podle čl. 45 a 46 GDPR, zejména rozhodnutí
      Evropské komise o odpovídající ochraně v rámci EU–USA (Data Privacy Framework) nebo standardních smluvních
      doložek přijatých Evropskou komisí.
    </p>
    <p className={p}>
      Odešle-li uživatel doklad prostřednictvím aplikace WhatsApp, SMS nebo e-mailu, činí tak prostřednictvím
      vlastního účtu u příslušné služby; na takové předání se vztahují podmínky dané služby.
    </p>

    <h3 className={h}>5. Doba uložení</h3>
    <ol className={ol}>
      <li>
        Údaje o účtu a údaje vložené uživatelem se uchovávají po dobu trvání uživatelského účtu. Uživatel může účet
        kdykoli zrušit v aplikaci; tím se vymažou veškeré údaje včetně fotografií a podpisů.
      </li>
      <li>Při odhlášení se údaje vymažou z daného zařízení; v uživatelském účtu zůstávají zachovány.</li>
      <li>Fotografie, na které již žádný záznam v aplikaci neodkazuje, se vymažou po uplynutí 30 dnů.</li>
      <li>Provozní údaje uchovávají poskytovatelé hostingu a databáze po dobu nezbytnou pro zajištění provozu a bezpečnosti.</li>
    </ol>
    <p className={p}>
      Povinnost archivovat účetní a daňové doklady podle příslušných právních předpisů nese uživatel. Před zrušením
      účtu doporučujeme pořídit zálohu dat (Nastavení → Záloha) nebo si doklady uložit ve formátu PDF či ISDOC.
    </p>

    <h3 className={h}>6. Soubory cookies a úložiště prohlížeče</h3>
    <p className={p}>
      Aplikace nepoužívá reklamní ani analytické soubory cookies. V úložišti prohlížeče uchovává pouze údaje nezbytné
      pro poskytování služby: údaje o přihlášení, data a fotografie uživatele (pro práci bez připojení k internetu),
      soubory aplikace a nastavení zobrazení. K tomuto ukládání se v souladu s § 89 odst. 3 zákona č. 127/2005 Sb.,
      o elektronických komunikacích, nevyžaduje souhlas.
    </p>

    <h3 className={h}>7. Zabezpečení</h3>
    <p className={p}>
      Komunikace mezi zařízením uživatele a servery je šifrována (HTTPS). Data v databázi jsou přístupná výhradně
      uživateli, kterému patří; soubory jsou uloženy v neveřejném úložišti. Správce přijal přiměřená technická
      a organizační opatření k ochraně osobních údajů.
    </p>

    <h3 className={h}>8. Práva subjektu údajů</h3>
    <p className={p}>Subjekt údajů má právo:</p>
    <ol className={ol}>
      <li>na přístup k osobním údajům (čl. 15 GDPR),</li>
      <li>na opravu nepřesných osobních údajů (čl. 16 GDPR),</li>
      <li>na výmaz osobních údajů (čl. 17 GDPR),</li>
      <li>na omezení zpracování (čl. 18 GDPR),</li>
      <li>na přenositelnost údajů (čl. 20 GDPR) – zálohu dat lze stáhnout v aplikaci ve strojově čitelném formátu JSON,</li>
      <li>vznést námitku proti zpracování založenému na oprávněném zájmu (čl. 21 GDPR),</li>
      <li>
        podat stížnost u dozorového úřadu, kterým je Úřad pro ochranu osobních údajů, Pplk. Sochora 27, 170 00 Praha 7,{' '}
        <a className={mail} href="https://uoou.gov.cz" target="_blank" rel="noopener noreferrer">
          uoou.gov.cz
        </a>
        .
      </li>
    </ol>
    <p className={p}>
      Žádost lze zaslat na adresu {OPERATOR.email}. Správce ji vyřídí bez zbytečného odkladu, nejpozději do jednoho
      měsíce od jejího obdržení. Zákazníci uživatele uplatňují svá práva primárně u uživatele jako správce jejich
      osobních údajů.
    </p>

    <h3 className={h}>9. Změny zásad</h3>
    <p className={p}>
      Správce je oprávněn tyto zásady měnit, zejména v návaznosti na změny aplikace nebo právních předpisů. Aktuální
      znění je vždy dostupné v aplikaci; o podstatných změnách správce uživatele informuje v aplikaci.
    </p>
  </div>
);
