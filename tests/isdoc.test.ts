import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateXML } from 'xmllint-wasm';
import { buildIsdoc, parseCzAddress, documentUuid, isdocFileName } from '../src/utils/isdoc';
import type { Contract } from '../src/types/contract';

// Oficiální schéma ISDOC 6.0.2 (tests/fixtures, šíří se s poznámkou o autorských právech)
const schema = readFileSync(new URL('./fixtures/isdoc-invoice-6.0.2.xsd', import.meta.url), 'utf8');

async function expectValid(xml: string) {
  const result = await validateXML({ xml: [{ fileName: 'faktura.isdoc', contents: xml }], schema: [{ fileName: 'isdoc.xsd', contents: schema }] });
  assert.equal(result.valid, true, result.errors.map((e) => e.rawMessage).join('\n'));
}

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1];

const base = (over: Partial<Contract> = {}): Contract =>
  ({
    id: 'contract_1',
    docKind: 'contract',
    contractNumber: 'SOD-2026-001',
    invoiceNumber: '2026007',
    numbering: 2,
    advanceInvoiceNumber: '2026003',
    variableSymbol: '2026001',
    contractor: { name: 'Jan Novák – obklady & rekonstrukce', ico: '12345678', address: 'Květinová 124/8, 140 00 Praha 4', bankAccount: '19-2000145399/0800', phone: '+420 777 123 456', email: 'jan@example.cz', defaultPlace: 'Praze' },
    client: { id: 'c1', name: 'Marek Dvořák', address: 'Slunečná 45, 252 28 Černošice', phone: '+420 608 987 654', email: '', createdAt: '' },
    workDescription: 'Rekonstrukce koupelny <včetně> obkladů',
    price: 27520,
    advanceAmount: 8000,
    deliveryDate: '2026-12-06',
    conclusionDate: '2026-11-06',
    executionPlace: 'Praze',
    hasVat: false,
    amendments: [
      { id: 'a1', amendmentNumber: 1, issueDate: '2026-11-11', title: 'Vícepráce – nika', priceDifference: 4502, createdAt: '' },
      { id: 'a2', amendmentNumber: 2, issueDate: '2026-11-13', title: 'Méněpráce – sokl', priceDifference: -1200, createdAt: '' },
    ],
    handoverData: { handoverDate: '2026-11-17', status: 'bez_vad' },
    createdAt: '2026-11-06T08:00:00.000Z',
    ...over,
  }) as unknown as Contract;

test('adresa se rozdělí na ulici, číslo, PSČ a obec', () => {
  assert.deepEqual(parseCzAddress('Květinová 124/8, 140 00 Praha 4'), { street: 'Květinová', building: '124/8', postalZone: '14000', city: 'Praha 4' });
  assert.deepEqual(parseCzAddress('Lhota 15, 25228 Černošice'), { street: 'Lhota', building: '15', postalZone: '25228', city: 'Černošice' });
  assert.deepEqual(parseCzAddress('Slunečná 45, Černošice'), { street: 'Slunečná', building: '45', postalZone: '', city: 'Černošice' });
  assert.equal(parseCzAddress('').street, '');
});

test('UUID je stálé a ve správném tvaru', () => {
  assert.equal(documentUuid('a'), documentUuid('a'));
  assert.notEqual(documentUuid('a'), documentUuid('b'));
  assert.match(documentUuid('x'), /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/);
});

test('konečná faktura neplátce: platná podle schématu, záloha odečtená', async () => {
  const xml = buildIsdoc(base());
  await expectValid(xml);
  assert.equal(tag(xml, 'ID'), 'FA-2026007');
  assert.equal(tag(xml, 'DocumentType'), '1');
  assert.equal(tag(xml, 'VATApplicable'), 'false');
  assert.equal(tag(xml, 'TaxInclusiveAmount'), '30822.00');
  assert.equal(tag(xml, 'PaidDepositsAmount'), '8000.00');
  assert.equal(tag(xml, 'PayableAmount'), '22822.00');
  assert.match(xml, /<NonTaxedDeposit><ID>ZAL-2026003<\/ID>/);
  assert.match(xml, /obklady &amp; rekonstrukce/);
  assert.match(xml, /&lt;včetně&gt;/);
  assert.equal(isdocFileName(base(), 'final'), 'FA-2026007.isdoc');
});

test('konečná faktura plátce 21 % a 12 %: základ a daň sedí na halíře', async () => {
  const payer = base({ hasVat: true, contractor: { ...base().contractor, dic: 'CZ8503120000' } } as Partial<Contract>);
  const xml21 = buildIsdoc(payer);
  await expectValid(xml21);
  const base21 = Number(xml21.match(/<LegalMonetaryTotal><TaxExclusiveAmount>([^<]*)/)![1]);
  const vat21 = Number(xml21.match(/<\/TaxSubTotal><TaxAmount>([^<]*)/)![1]);
  assert.equal(Math.round((base21 + vat21) * 100), 3082200);
  // Stejná daň jako na dokladu v aplikaci (shora z celkové ceny)
  assert.equal(vat21, 5349.27);
  const lineVat = [...xml21.matchAll(/<LineExtensionTaxAmount>([^<]*)/g)].reduce((sum, m) => sum + Number(m[1]), 0);
  assert.equal(Math.round(lineVat * 100), 534927);
  assert.match(xml21, /<CompanyID>CZ8503120000<\/CompanyID>/);
  const xml12 = buildIsdoc({ ...payer, vatRate: 12 });
  await expectValid(xml12);
  assert.match(xml12, /<Percent>12<\/Percent>/);
});

test('přenesení daňové povinnosti: bez DPH, kód 4 a DIČ odběratele, platné podle schématu', async () => {
  const payer = base({
    hasVat: true,
    reverseCharge: true,
    contractor: { ...base().contractor, dic: 'CZ8503120000' },
    client: { ...base().client, name: 'Stavby Novotný s.r.o.', ico: '27074358', dic: 'CZ27074358' },
  } as Partial<Contract>);
  const xml = buildIsdoc(payer);
  await expectValid(xml);
  // Celá cena díla je základem, daň je nulová, platí se cena bez DPH minus záloha
  assert.equal(xml.match(/<LegalMonetaryTotal><TaxExclusiveAmount>([^<]*)/)![1], '30822.00');
  assert.equal(xml.match(/<\/TaxSubTotal><TaxAmount>([^<]*)/)![1], '0.00');
  assert.equal(tag(xml, 'PayableAmount'), '22822.00');
  assert.equal([...xml.matchAll(/<LocalReverseChargeCode>4<\/LocalReverseChargeCode>/g)].length, 3);
  assert.match(xml, /<LocalReverseChargeFlag>true<\/LocalReverseChargeFlag>/);
  assert.match(xml, /<CompanyID>CZ27074358<\/CompanyID>/);
  // Bez plátcovství zhotovitele se přenesení neuplatní
  const nonPayer = buildIsdoc(base({ reverseCharge: true }));
  await expectValid(nonPayer);
  assert.doesNotMatch(nonPayer, /LocalReverseCharge/);
  // Zálohová faktura není daňový doklad – beze změny
  const adv = buildIsdoc(payer, 'advance');
  await expectValid(adv);
  assert.doesNotMatch(adv, /LocalReverseCharge/);
});

test('doklad k přijaté záloze (typ 5) a konečná faktura se zdaněnou zálohou: platné podle schématu', async () => {
  const payer = base({
    hasVat: true,
    contractor: { ...base().contractor, dic: 'CZ8503120000' },
    advancePaidDate: '2026-11-10',
    advancePaidMethod: 'transfer',
    advanceTaxDocNumber: '2026001',
    advanceTaxDocIssuedAt: '2026-11-11T09:00:00.000Z',
  } as Partial<Contract>);
  const dp = buildIsdoc(payer, 'advance_tax');
  await expectValid(dp);
  assert.equal(tag(dp, 'DocumentType'), '5');
  assert.equal(tag(dp, 'ID'), 'DP-2026001');
  assert.equal(tag(dp, 'TaxPointDate'), '2026-11-10');
  // 8 000 Kč s DPH 21 %: základ 6 611,57, daň 1 388,43; zaplaceno, k úhradě nic
  assert.equal(dp.match(/<LegalMonetaryTotal><TaxExclusiveAmount>([^<]*)/)![1], '6611.57');
  assert.equal(dp.match(/<\/TaxSubTotal><TaxAmount>([^<]*)/)![1], '1388.43');
  assert.equal(tag(dp, 'PayableAmount'), '0.00');
  assert.doesNotMatch(dp, /PaymentMeans/);
  assert.equal(isdocFileName(payer, 'advance_tax'), 'DP-2026001.isdoc');

  const fa = buildIsdoc(payer);
  await expectValid(fa);
  assert.match(fa, /<TaxedDeposits><TaxedDeposit><ID>DP-2026001<\/ID>/);
  assert.doesNotMatch(fa, /NonTaxedDeposits/);
  assert.equal(tag(fa, 'AlreadyClaimedTaxAmount'), '1388.43');
  // Daň celkem 5 349,27 − zdaněno zálohou 1 388,43 = 3 960,84; k úhradě doplatek 22 822
  assert.equal(fa.match(/<\/TaxSubTotal><TaxAmount>([^<]*)/)![1], '3960.84');
  assert.equal(tag(fa, 'PayableAmount'), '22822.00');

  // Při přenesení daňové povinnosti se doklad k záloze neuplatní – záloha zůstává nedaňová
  const rc = buildIsdoc({ ...payer, reverseCharge: true });
  await expectValid(rc);
  assert.doesNotMatch(rc, /<TaxedDeposits>/);
  assert.match(rc, /NonTaxedDeposits/);
});

test('zálohová faktura, faktura bez smlouvy a klient bez IČO jsou platné', async () => {
  const adv = buildIsdoc(base(), 'advance');
  await expectValid(adv);
  assert.equal(tag(adv, 'DocumentType'), '4');
  assert.equal(tag(adv, 'PayableAmount'), '8000.00');
  const only = buildIsdoc(base({ docKind: 'invoice', contractNumber: '', advanceAmount: undefined, amendments: [] }));
  await expectValid(only);
  assert.doesNotMatch(only, /ContractReferences/);
  assert.match(only, /Provedení prací/);
  // Neznámá banka a adresa bez PSČ nesmí vadit
  const odd = buildIsdoc(base({ contractor: { ...base().contractor, bankAccount: '123456789/9999', address: 'Praha' } } as Partial<Contract>));
  await expectValid(odd);
});

test('ZIP s fakturami: hlavičky, CRC a počet souborů', async () => {
  const { createZip, crc32 } = await import('../src/utils/zipStore');
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const zip = createZip([{ name: 'FA-2026007.isdoc', content: buildIsdoc(base()) }, { name: 'ZAL-2026003.isdoc', content: 'x' }]);
  const view = new DataView(zip.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(zip.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(zip.length - 22 + 10, true), 2);
});
