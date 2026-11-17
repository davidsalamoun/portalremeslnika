import React from 'react';
import { Contract } from '../types/contract';
import { formatCurrency, formatContractPriceWithWords, formatDateCs, formatSignedCurrency } from '../utils/numberToWordsCs';

interface ContractBodyProps {
  /** Smlouva tak, jak byla otevřena */
  contract: Contract;
  /** Aktuální stav smlouvy (po úpravách v náhledu); bez něj platí `contract` */
  currentContract?: Contract;
  /** Ovládání zobrazené jen na obrazovce pod článkem III (v náhledu zakázky) */
  actions?: React.ReactNode;
}

/**
 * Znění smlouvy o dílo: hlavička, smluvní strany a články I–IX. Používá ho náhled zakázky i portál online podpisu,
 * aby zákazník podepisoval tentýž text, který vidí zhotovitel. Právní text – neměnit bez výslovného pokynu.
 */
export const ContractBody: React.FC<ContractBodyProps> = ({ contract, currentContract = contract, actions }) => {
  const formattedPrice = formatContractPriceWithWords(currentContract.price);
  const formattedDelivery = formatDateCs(currentContract.deliveryDate);

  return (
    <>
              {/* Header & Title */}
              <div className="text-center mb-8 pb-4 border-b border-slate-200">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-normal uppercase text-black mb-1">
                  SMLOUVA O DÍLO
                </h1>
                <p className="text-xs sm:text-sm text-slate-700 italic">
                  uzavřená podle § 2586 a násl. zákona č. 89/2012 Sb., občanský zákoník
                </p>
                <p className="text-xs font-sans font-bold text-slate-500 mt-1">
                  Evidenční číslo: {contract.contractNumber}
                </p>
              </div>

              {/* Smluvní strany */}
              <div className="mb-8 space-y-4">
                <h2 className="text-base font-bold uppercase tracking-wide text-black">
                  Smluvní strany:
                </h2>

                {/* Objednatel */}
                <div className="pl-4 border-l-2 border-slate-400">
                  <p className="font-bold text-black mb-1">1. Objednatel:</p>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr>
                        <td className="w-44 font-semibold text-slate-800 py-0.5">Jméno a příjmení / Firma:</td>
                        <td className="font-bold text-black">{contract.client.name}</td>
                      </tr>
                      <tr>
                        <td className="font-semibold text-slate-800 py-0.5">Bydliště / Sídlo:</td>
                        <td>{contract.client.address}</td>
                      </tr>
                      {contract.client.ico && (
                        <tr>
                          <td className="font-semibold text-slate-800 py-0.5">IČO:</td>
                          <td>{contract.client.ico}</td>
                        </tr>
                      )}
                      <tr>
                        <td className="font-semibold text-slate-800 py-0.5">Telefon:</td>
                        <td>{contract.client.phone}</td>
                      </tr>
                      <tr>
                        <td className="font-semibold text-slate-800 py-0.5">E-mail:</td>
                        <td>{contract.client.email}</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-xs italic text-slate-600 mt-1">
                    (dále jen jako „Objednatel“)
                  </p>
                </div>

                <p className="text-center font-semibold italic text-slate-700 py-1">a</p>

                {/* Zhotovitel */}
                <div className="pl-4 border-l-2 border-slate-400">
                  <p className="font-bold text-black mb-1">2. Zhotovitel:</p>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr>
                        <td className="w-44 font-semibold text-slate-800 py-0.5">Obchodní jméno / Jméno:</td>
                        <td className="font-bold text-black">{contract.contractor.name}</td>
                      </tr>
                      <tr>
                        <td className="font-semibold text-slate-800 py-0.5">Sídlo / Místo podnikání:</td>
                        <td>{contract.contractor.address}</td>
                      </tr>
                      <tr>
                        <td className="font-semibold text-slate-800 py-0.5">IČO:</td>
                        <td>
                          {contract.contractor.ico}
                          {contract.contractor.dic ? ` · DIČ: ${contract.contractor.dic}` : ' (není plátce DPH)'}
                        </td>
                      </tr>
                      <tr>
                        <td className="font-semibold text-slate-800 py-0.5">Bankovní účet:</td>
                        <td className="font-bold text-black">{contract.contractor.bankAccount}</td>
                      </tr>
                      <tr>
                        <td className="font-semibold text-slate-800 py-0.5">Telefon a E-mail:</td>
                        <td>{contract.contractor.phone} · {contract.contractor.email}</td>
                      </tr>
                      <tr>
                        <td className="font-semibold text-slate-800 py-0.5">Zápis v evidenci:</td>
                        <td className="italic text-xs text-slate-700">fyzická osoba podnikající zapsaná v živnostenském rejstříku</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-xs italic text-slate-600 mt-1">
                    (dále jen jako „Zhotovitel“)
                  </p>
                </div>
              </div>

              <p className="text-sm italic text-slate-700 mb-6">
                uzavírají níže uvedeného dne, měsíce a roku tuto smlouvu o dílo:
              </p>

              {/* Články smlouvy */}
              <div className="space-y-6 text-justify">
                {/* Čl. I */}
                <div>
                  <h3 className="font-bold text-black mb-2 uppercase text-sm border-b border-slate-200 pb-1">
                    Článek I – Předmět smlouvy
                  </h3>
                  <p className="mb-2">
                    <strong>1.1</strong> Zhotovitel se zavazuje provést pro objednatele na svůj náklad a nebezpečí dílo, kterým je:
                  </p>
                  <div className="bg-slate-50/80 p-3 rounded-sm border border-slate-200 font-sans text-sm my-2 text-slate-900 leading-relaxed whitespace-pre-line">
                    {contract.workDescription}
                  </div>
                  <p>
                    <strong>1.2</strong> Objednatel se zavazuje řádně a včas provedené dílo převzít a zaplatit zhotoviteli sjednanou cenu za jeho provedení způsobem a ve lhůtě dohodnuté v této smlouvě.
                  </p>
                </div>

                {/* Čl. II */}
                <div>
                  <h3 className="font-bold text-black mb-2 uppercase text-sm border-b border-slate-200 pb-1">
                    Článek II – Místo a doba plnění
                  </h3>
                  <p className="mb-2">
                    <strong>2.1</strong> Místem provedení díla je adresa objednatele uvedená v záhlaví této smlouvy, nedohodnou-li se smluvní strany výslovně písemně jinak.
                  </p>
                  <p>
                    <strong>2.2</strong> Zhotovitel se zavazuje zahájit provádění díla bez zbytečného odkladu a celé dílo dokončit a předat objednateli nejpozději do: <strong>{formattedDelivery}</strong>.
                  </p>
                </div>

                {/* Čl. III */}
                <div>
                  <h3 className="font-bold text-black mb-2 uppercase text-sm border-b border-slate-200 pb-1">
                    Článek III – Cena a platební podmínky
                  </h3>
                  <p className="mb-2">
                    <strong>3.1</strong> Celková cena za provedení díla byla stanovena dohodou smluvních stran a činí:{' '}
                    <strong>{formattedPrice}</strong>.{' '}
                    {contract.contractor.dic ? 'Uvedená cena je včetně DPH.' : 'Zhotovitel není plátcem DPH.'}
                  </p>

                  {currentContract.items && currentContract.items.length > 0 && (
                    <div className="my-2.5 p-2 bg-slate-50 border border-slate-200 rounded-sm font-sans text-xs">
                      <div className="font-bold text-[11px] uppercase tracking-wider text-slate-700 mb-1">
                        Položkový soupis prací a materiálu tvořící součást ceny díla:
                      </div>
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 font-bold">
                            <th className="py-1">Položka</th>
                            <th className="py-1 text-right">Množství</th>
                            <th className="py-1 text-right">Cena / jedn.</th>
                            <th className="py-1 text-right">Celkem</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {currentContract.items.map((it) => (
                            <tr key={it.id}>
                              <td className="py-1 font-medium">{it.title}</td>
                              <td className="py-1 text-right">{it.quantity} {it.unit}</td>
                              <td className="py-1 text-right">{formatCurrency(it.unitPrice)}</td>
                              <td className="py-1 text-right font-bold">{formatCurrency(it.totalPrice)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {currentContract.amendments && currentContract.amendments.length > 0 && (
                    <div className="my-2 p-2 bg-amber-50/60 border border-amber-200 rounded-sm font-sans text-xs text-amber-900">
                      <strong>Upozornění o dodatcích:</strong> K této smlouvě byly sjednány{' '}
                      <strong>{currentContract.amendments.length} písemné dodatky</strong> na vícepráce v celkové výši{' '}
                      <strong>
                        {formatSignedCurrency(
                          currentContract.amendments.reduce((s, a) => s + (a.priceDifference || 0), 0)
                        )}
                      </strong>.
                    </div>
                  )}

                  {contract.advanceAmount && contract.advanceAmount > 0 ? (
                    <p className="mb-2">
                      <strong>3.2</strong> Smluvní strany sjednávají zálohu na materiál a přípravné práce ve výši{' '}
                      <strong>{formatContractPriceWithWords(contract.advanceAmount)}</strong>, splatnou před zahájením prací na základě zálohové faktury. Doplatek ceny ve výši{' '}
                      <strong>{formatContractPriceWithWords(contract.price - contract.advanceAmount)}</strong> je splatný po protokolárním předání a převzetí díla se splatností 14 dnů.
                    </p>
                  ) : (
                    <p className="mb-2">
                      <strong>3.2</strong> Cena za dílo je splatná na základě konečné faktury vystavené zhotovitelem po protokolárním předání a převzetí díla, se splatností <strong>14 kalendářních dnů</strong> ode dne jejího vystavení, a to bezhotovostním převodem na bankovní účet zhotovitele č. <strong>{contract.contractor.bankAccount}</strong>.
                    </p>
                  )}
                  <p className="mb-2">
                    <strong>3.3 Výhrada vlastnického práva k materiálu:</strong> Zhotovitel zůstává výlučným vlastníkem veškerého dodaného a zabudovaného stavebního materiálu, dílů, komponent a zařízení až do okamžiku úplného zaplacení dohodnuté ceny díla objednatelem (výhrada vlastnictví dle § 2132 ve spojení s § 2599 občanského zákoníku č. 89/2012 Sb.). Nebezpečí škody na zhotovované věci přechází na objednatele okamžikem převzetí díla či staveniště.
                  </p>
                  <p className="mb-2">
                    <strong>3.4 Pravidla pro vícepráce a změny díla:</strong> Jakékoliv práce nad rámec položkového rozpočtu či zadání této smlouvy (vícepráce), stejně jako záměny materiálů nebo redukce prací (méněpráce), vyžadují předchozí prokazatelné písemné odsouhlasení obou smluvních stran (formou číslovaného dodatku k této smlouvě nebo zápisem v montážním/stavebním deníku) včetně výslovného určení vlivu na cenu díla a termín dokončení. Bez předchozího písemného odsouhlasení nevzniká zhotoviteli povinnost vícepráce provést ani objednateli povinnost je uhradit.
                  </p>
                  <p>
                    <strong>3.5</strong> Zhotovitel je po vzájemné dohodě oprávněn požadovat přiměřenou zálohu na nákup materiálu a vybavení před zahájením prací.
                  </p>

                  {actions}
                </div>

                {/* Čl. IV */}
                <div>
                  <h3 className="font-bold text-black mb-2 uppercase text-sm border-b border-slate-200 pb-1">
                    Článek IV – Práva a povinnosti zhotovitele
                  </h3>
                  <p className="mb-2">
                    <strong>4.1</strong> Zhotovitel se zavazuje provést dílo s odbornou péčí, řádně, včas a v souladu s příslušnými technickými normami (ČSN), technologickými předpisy výrobců materiálů a právními předpisy.
                  </p>
                  <p className="mb-2">
                    <strong>4.2</strong> Zhotovitel postupuje při provádění díla samostatně, je však vázán případnými oprávněnými pokyny objednatele týkajícími se způsobu realizace. Na nevhodnost pokynů je zhotovitel povinen objednatele bezodkladně upozornit.
                  </p>
                  <p className="mb-2">
                    <strong>4.3</strong> Zhotovitel je povinen udržovat na staveništi přiměřený pořádek a čistotu, dodržovat platné předpisy BOZP a požární ochrany. Po dokončení denních prací zabezpečí staveniště a po dokončení díla zajistí hrubý úklid pracoviště a soustředění stavebního odpadu na určené místo.
                  </p>
                  <p className="mb-2">
                    <strong>4.4</strong> Zhotovitel prověří stavební připravenost podkladu před zahájením montážních prací a bez zbytečného odkladu upozorní objednatele na zjevné vady či skryté překážky zjištěné při provádění díla.
                  </p>
                </div>

                {/* Čl. V */}
                <div>
                  <h3 className="font-bold text-black mb-2 uppercase text-sm border-b border-slate-200 pb-1">
                    Článek V – Práva a povinnosti objednatele a součinnost
                  </h3>
                  <p className="mb-2">
                    <strong>5.1</strong> Objednatel se zavazuje předat zhotoviteli staveniště/místo plnění ve stavu plně způsobilém k řádnému provádění prací (vyklizené a zabezpečené) nejpozději v den zahájení realizace.
                  </p>
                  <p className="mb-2">
                    <strong>5.2</strong> Objednatel se zavazuje poskytnout zhotoviteli veškerou nezbytnou součinnost potřebnou k řádnému provedení díla, zejména zajistit bezpečný přístup na místo plnění, bezplatný odběr vody a elektrické energie po celou dobu provádění díla a uzamykatelné místo pro uložení nářadí a materiálu zhotovitele.
                  </p>
                  <p className="mb-2">
                    <strong>5.3</strong> Objednatel je povinen dokončené dílo bez zbytečného odkladu prohlédnout, protokolárně převzít a uhradit dohodnutou cenu za podmínek stanovených touto smlouvou.
                  </p>
                  <p className="mb-2">
                    <strong>5.4</strong> V případě prodlení objednatele s předáním staveniště, poskytnutím součinnosti či úhradou sjednané zálohy se termín dokončení díla automaticky prodlužuje o dobu trvání tohoto prodlení a zhotovitel není po tuto dobu v prodlení.
                  </p>
                </div>

                {/* Čl. VI */}
                <div>
                  <h3 className="font-bold text-black mb-2 uppercase text-sm border-b border-slate-200 pb-1">
                    Článek VI – Předání a převzetí díla
                  </h3>
                  <p className="mb-2">
                    <strong>6.1</strong> O předání a převzetí díla sepíší smluvní strany písemný <strong>předávací protokol</strong>, který bude obsahovat zhodnocení jakosti provedeného díla a případný soupis drobných ojedinělých vad či nedodělků, které samy o sobě nebrání užívání díla, včetně závazného termínu jejich odstranění.
                  </p>
                  <p className="mb-2">
                    <strong>6.2</strong> Dílo se považuje za řádně dokončené a předané okamžikem podpisu předávacího protokolu oběma smluvními stranami.
                  </p>
                </div>

                {/* Čl. VII */}
                <div>
                  <h3 className="font-bold text-black mb-2 uppercase text-sm border-b border-slate-200 pb-1">
                    Článek VII – Odpovědnost za vady a záruka
                  </h3>
                  <p className="mb-2">
                    <strong>7.1</strong> Zhotovitel poskytuje objednateli na provedené dílo záruku za jakost v délce <strong>24 měsíců</strong>. Záruční doba počíná běžet dnem protokolárního předání a převzetí díla.
                  </p>
                  <p className="mb-2">
                    <strong>7.2</strong> Objednatel je povinen zjištěné vady uplatnit u zhotovitele písemně (případně prokazatelně elektronickou poštou) bez zbytečného odkladu po jejich zjištění. Zhotovitel se zavazuje započít s odstraňováním oprávněně reklamované vady do 10 pracovních dnů od doručení reklamace.
                  </p>
                </div>

                {/* Čl. VIII */}
                <div>
                  <h3 className="font-bold text-black mb-2 uppercase text-sm border-b border-slate-200 pb-1">
                    Článek VIII – Smluvní pokuta
                  </h3>
                  <p className="mb-2">
                    <strong>8.1</strong> V případě prodlení zhotovitele s dokončením a předáním díla v dohodnutém termínu má objednatel právo požadovat smluvní pokutu ve výši <strong>0,05 %</strong> z celkové ceny díla za každý i započatý den prodlení.
                  </p>
                  <p className="mb-2">
                    <strong>8.2</strong> V případě prodlení objednatele s úhradou ceny díla je zhotovitel oprávněn požadovat po objednateli smluvní pokutu ve výši <strong>0,05 %</strong> z dlužné částky za každý den prodlení.
                  </p>
                </div>

                {/* Čl. IX */}
                <div>
                  <h3 className="font-bold text-black mb-2 uppercase text-sm border-b border-slate-200 pb-1">
                    Článek IX – Závěrečná ustanovení
                  </h3>
                  <p className="mb-2">
                    <strong>9.1</strong> Veškeré změny, doplňky a odchylky od této smlouvy lze sjednat výhradně písemnou formou, a to číslovanými dodatky podepsanými oběma smluvními stranami.
                  </p>
                  <p className="mb-2">
                    <strong>9.2</strong> Práva a povinnosti touto smlouvou výslovně neupravené se řídí příslušnými ustanoveními zákona č. 89/2012 Sb., občanský zákoník, ve znění pozdějších předpisů.
                  </p>
                  <p className="mb-2">
                    <strong>9.3</strong> Tato smlouva je vyhotovena ve dvou stejnopisech s platností originálu, přičemž každá smluvní strana obdrží po jednom vyhotovení.
                  </p>
                  <p>
                    <strong>9.4</strong> Smluvní strany shodně prohlašují, že si tuto smlouvu před jejím podpisem řádně přečetly, jejímu obsahu porozuměly a s tímto obsahem bez výhrad souhlasí, což stvrzují svými vlastnoručními podpisy.
                  </p>
                </div>
              </div>
    </>
  );
};
