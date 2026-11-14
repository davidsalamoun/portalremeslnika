import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Packer,
  convertInchesToTwip,
} from 'docx';
import { Contract } from '../types/contract';
import { generateContractFilename } from './exportNames';
import { formatContractPriceWithWords, formatDateCs, formatPlaceWithPreposition } from './numberToWordsCs';

export async function exportContractToDocx(contract: Contract): Promise<void> {
  const formattedPrice = formatContractPriceWithWords(contract.price);
  const formattedDelivery = formatDateCs(contract.deliveryDate);
  const formattedConclusion = formatDateCs(contract.conclusionDate);
  const place = contract.executionPlace || contract.contractor.defaultPlace || 'v místě plnění';

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Times New Roman',
            size: 24, // 24 half-points = 12 pt
            color: '000000',
          },
          paragraph: {
            spacing: {
              line: 276, // 1.15 line spacing
              after: 120, // 6pt after
            },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1), // ~2.54 cm
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
          },
        },
        children: [
          // Nadpis
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: 'SMLOUVA O DÍLO',
                bold: true,
                size: 32, // 16 pt
              }),
            ],
          }),
          // Podnadpis
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 360 },
            children: [
              new TextRun({
                text: 'uzavřená podle § 2586 a násl. zákona č. 89/2012 Sb., občanský zákoník',
                italics: true,
                size: 22,
                color: '333333',
              }),
            ],
          }),

          // Smluvní strany - Úvod
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: 'Smluvní strany:',
                bold: true,
              }),
            ],
          }),

          // Objednatel
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({ text: '1. Objednatel:\n', bold: true }),
              new TextRun({ text: `Jméno a příjmení / Firma: `, bold: true }),
              new TextRun({ text: `${contract.client.name}\n` }),
              new TextRun({ text: `Bydliště / Sídlo: `, bold: true }),
              new TextRun({ text: `${contract.client.address}\n` }),
              ...(contract.client.ico ? [
                new TextRun({ text: `IČO: `, bold: true }),
                new TextRun({ text: `${contract.client.ico}\n` }),
              ] : []),
              new TextRun({ text: `Telefon: `, bold: true }),
              new TextRun({ text: `${contract.client.phone} | ` }),
              new TextRun({ text: `E-mail: `, bold: true }),
              new TextRun({ text: `${contract.client.email}\n` }),
              new TextRun({ text: '(dále jen „Objednatel“)', italics: true }),
            ],
          }),

          new Paragraph({
            children: [new TextRun({ text: 'a', italics: true })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 80, before: 80 },
          }),

          // Zhotovitel
          new Paragraph({
            spacing: { after: 280 },
            children: [
              new TextRun({ text: '2. Zhotovitel:\n', bold: true }),
              new TextRun({ text: `Jméno a příjmení / Obchodní firma: `, bold: true }),
              new TextRun({ text: `${contract.contractor.name}\n` }),
              new TextRun({ text: `Sídlo / Místo podnikání: `, bold: true }),
              new TextRun({ text: `${contract.contractor.address}\n` }),
              new TextRun({ text: `IČO: `, bold: true }),
              new TextRun({ text: `${contract.contractor.ico}` }),
              new TextRun({ text: contract.contractor.dic ? ` · DIČ: ${contract.contractor.dic}\n` : ' (není plátce DPH)\n' }),
              new TextRun({ text: `Bankovní účet: `, bold: true }),
              new TextRun({ text: `${contract.contractor.bankAccount}\n` }),
              new TextRun({ text: `Telefon: `, bold: true }),
              new TextRun({ text: `${contract.contractor.phone} | ` }),
              new TextRun({ text: `E-mail: `, bold: true }),
              new TextRun({ text: `${contract.contractor.email}\n` }),
              new TextRun({ text: 'fyzická osoba podnikající zapsaná v živnostenském rejstříku\n', italics: true }),
              new TextRun({ text: '(dále jen „Zhotovitel“)', italics: true }),
            ],
          }),

          // Čl. I
          new Paragraph({
            spacing: { before: 180, after: 80 },
            children: [new TextRun({ text: 'Článek I – Předmět smlouvy', bold: true })],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: `1.1 Zhotovitel se zavazuje provést pro objednatele na svůj náklad a na své nebezpečí dílo specifikované takto:\n${contract.workDescription}`,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: '1.2 Objednatel se zavazuje řádně a včas provedené dílo převzít a zaplatit zhotoviteli sjednanou cenu za jeho provedení způsobem a ve lhůtě sjednané v této smlouvě.',
              }),
            ],
          }),

          // Čl. II
          new Paragraph({
            spacing: { before: 180, after: 80 },
            children: [new TextRun({ text: 'Článek II – Místo a doba plnění', bold: true })],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: `2.1 Místem provedení díla je adresa objednatele uvedená v záhlaví této smlouvy, nedohodnou-li se smluvní strany výslovně písemně jinak.`,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: `2.2 Zhotovitel se zavazuje zahájit práce bez zbytečného odkladu a dílo dokončit a předat objednateli nejpozději do: ${formattedDelivery}.`,
              }),
            ],
          }),

          // Čl. III
          new Paragraph({
            spacing: { before: 180, after: 80 },
            children: [new TextRun({ text: 'Článek III – Cena a platební podmínky', bold: true })],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: `3.1 Celková cena za provedení díla byla stanovena dohodou smluvních stran a činí: ${formattedPrice}. ${contract.contractor.dic ? 'Uvedená cena je včetně DPH.' : 'Zhotovitel není plátcem DPH.'}`,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: `3.2 Cena za provedení díla je splatná na základě faktury vystavené zhotovitelem po předání díla se splatností 14 dnů ode dne jejího vystavení, a to bezhotovostním převodem na bankovní účet zhotovitele č. ${contract.contractor.bankAccount}.`,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: '3.3 Výhrada vlastnického práva k materiálu: Zhotovitel zůstává výlučným vlastníkem veškerého dodaného a zabudovaného stavebního materiálu, dílů a zařízení až do úplného zaplacení dohodnuté ceny díla objednatelem (§ 2132 ve spojení s § 2599 občanského zákoníku). Nebezpečí škody na zhotovované věci přechází na objednatele okamžikem převzetí díla či staveniště.',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: '3.4 Pravidla pro vícepráce a změny díla: Jakékoliv práce nad rámec této smlouvy nebo položkového rozpočtu (vícepráce), stejně jako záměny materiálů nebo redukce prací (méněpráce), vyžadují předchozí prokazatelné písemné odsouhlasení obou smluvních stran (formou číslovaného dodatku ke smlouvě nebo zápisem ve stavebním deníku) včetně stanovení vlivu na cenu díla a termín dokončení.',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: '3.5 Zhotovitel je po vzájemné dohodě s objednatelem oprávněn požadovat přiměřenou zálohu na nákup materiálu a vybavení před zahájením prací.',
              }),
            ],
          }),

          // Čl. IV
          new Paragraph({
            spacing: { before: 180, after: 80 },
            children: [new TextRun({ text: 'Článek IV – Práva a povinnosti zhotovitele', bold: true })],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: '4.1 Zhotovitel je povinen provést dílo s odbornou péčí, v dohodnutém termínu a v souladu s příslušnými technickými normami, technologickými postupy a právními předpisy.',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: '4.2 Zhotovitel postupuje při provádění díla samostatně, je však vázán případnými pokyny objednatele týkajícími se způsobu provádění díla. Upozorní objednatele bez zbytečného odkladu na nevhodnost jeho pokynů.',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: '4.3 Zhotovitel je povinen udržovat na staveništi přiměřený pořádek a čistotu, dodržovat platné předpisy BOZP a požární ochrany. Po dokončení díla zajistí hrubý úklid pracoviště a soustředění stavebního odpadu na určené místo.',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: '4.4 Zhotovitel prověří stavební připravenost podkladu před zahájením montážních prací a bez zbytečného odkladu upozorní objednatele na zjevné vady či skryté překážky zjištěné při provádění díla.',
              }),
            ],
          }),

          // Čl. V
          new Paragraph({
            spacing: { before: 180, after: 80 },
            children: [new TextRun({ text: 'Článek V – Práva a povinnosti objednatele a součinnost', bold: true })],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: '5.1 Objednatel se zavazuje předat zhotoviteli staveniště/místo plnění ve stavu plně způsobilém k řádnému provádění prací (vyklizené a zabezpečené) nejpozději v den zahájení realizace.',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: '5.2 Objednatel se zavazuje poskytnout zhotoviteli veškerou nezbytnou součinnost potřebnou k řádnému provedení díla, zejména zajistit bezpečný a včasný přístup na místo plnění, bezplatný odběr vody a elektrické energie po celou dobu realizace a prostor pro uložení nářadí a materiálu.',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: '5.3 Objednatel je povinen dokončené dílo bez zbytečného odkladu zkontrolovat, protokolárně převzít a uhradit dohodnutou cenu podle platebních podmínek.',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: '5.4 V případě prodlení objednatele s předáním staveniště, poskytnutím součinnosti či úhradou sjednané zálohy se termín dokončení díla automaticky prodlužuje o dobu trvání tohoto prodlení a zhotovitel není po tuto dobu v prodlení.',
              }),
            ],
          }),

          // Čl. VI
          new Paragraph({
            spacing: { before: 180, after: 80 },
            children: [new TextRun({ text: 'Článek VI – Předání a převzetí díla', bold: true })],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: '6.1 O předání a převzetí díla sepíší obě smluvní strany písemný předávací protokol, který bude obsahovat zhodnocení jakosti díla a případný soupis drobných vad a nedodělků nebránících užívání, včetně termínu jejich odstranění.',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: '6.2 Dílo se považuje za řádně dokončené a předané podpisem předávacího protokolu oběma smluvními stranami.',
              }),
            ],
          }),

          // Čl. VII
          new Paragraph({
            spacing: { before: 180, after: 80 },
            children: [new TextRun({ text: 'Článek VII – Odpovědnost za vady a záruka', bold: true })],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: '7.1 Zhotovitel poskytuje objednateli na provedené dílo záruku za jakost v délce 24 měsíců. Záruční doba počíná běžet dnem protokolárního předání a převzetí díla.',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: '7.2 Objednatel je povinen zjištěné vady uplatnit u zhotovitele písemně (případně elektronickou poštou) bez zbytečného odkladu po jejich zjištění.',
              }),
            ],
          }),

          // Čl. VIII
          new Paragraph({
            spacing: { before: 180, after: 80 },
            children: [new TextRun({ text: 'Článek VIII – Smluvní pokuta', bold: true })],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: '8.1 V případě prodlení zhotovitele s dokončením a předáním díla má objednatel právo na smluvní pokutu ve výši 0,05 % ze sjednané ceny díla za každý i započatý den prodlení.',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: '8.2 V případě prodlení objednatele s úhradou ceny díla je zhotovitel oprávněn požadovat po objednateli smluvní pokutu ve výši 0,05 % z dlužné částky za každý den prodlení.',
              }),
            ],
          }),

          // Čl. IX
          new Paragraph({
            spacing: { before: 180, after: 80 },
            children: [new TextRun({ text: 'Článek IX – Závěrečná ustanovení', bold: true })],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: '9.1 Veškeré změny a doplňky této smlouvy lze činit pouze písemnou formou ve formě číslovaných dodatků podepsaných oběma smluvními stranami.',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: '9.2 Práva a povinnosti touto smlouvou výslovně neupravené se řídí příslušnými ustanoveními zákona č. 89/2012 Sb., občanský zákoník, v platném znění.',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: '9.3 Tato smlouva je vyhotovena ve dvou stejnopisech s platností originálu, z nichž každá smluvní strana obdrží po jednom vyhotovení.',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: '9.4 Smluvní strany prohlašují, že si tuto smlouvu před jejím podpisem řádně přečetly, s jejím obsahem souhlasí a na důkaz svobodné a vážné vůle připojují své vlastnoruční podpisy.',
              }),
            ],
          }),

          // Místo a datum uzavření
          new Paragraph({
            spacing: { before: 200, after: 360 },
            children: [
              new TextRun({
                text: `${formatPlaceWithPreposition(place)} dne ${formattedConclusion}`,
                bold: true,
              }),
            ],
          }),

          // Podpisová tabulka se 2 sloupci bez ohraničení
          new Table({
            width: {
              size: 100,
              type: WidthType.PERCENTAGE,
            },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        spacing: { after: 40 },
                        children: [new TextRun({ text: 'Objednatel:', bold: true })],
                      }),
                      new Paragraph({
                        spacing: { before: 500, after: 40 },
                        children: [new TextRun({ text: '..........................................................' })],
                      }),
                      new Paragraph({
                        children: [new TextRun({ text: contract.client.name, italics: true })],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        spacing: { after: 40 },
                        children: [new TextRun({ text: 'Zhotovitel:', bold: true })],
                      }),
                      new Paragraph({
                        spacing: { before: 500, after: 40 },
                        children: [new TextRun({ text: '..........................................................' })],
                      }),
                      new Paragraph({
                        children: [new TextRun({ text: contract.contractor.name, italics: true })],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filename = generateContractFilename(contract, 'docx');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
