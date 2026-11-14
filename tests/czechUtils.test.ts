import test from 'node:test';
import assert from 'node:assert/strict';
import {
  numberToWordsCs,
  amountInWordsCzk,
  formatContractPriceWithWords,
  formatPlaceWithPreposition,
  formatContractConclusionLine,
  formatDateCs,
  cleanPlaceName,
} from '../src/utils/numberToWordsCs.ts';
import { czAccountToIban, generateSpaydString } from '../src/utils/spayd.ts';
import { getVocative } from '../src/utils/vocativeCs.ts';

test('číslo slovy', () => {
  const cases: [number, string][] = [
    [0, 'nula'],
    [11, 'jedenáct'],
    [100, 'jednosto'],
    [1111, 'jedentisícjednostojedenáct'],
    [2000, 'dvatisíce'],
    [5000, 'pěttisíc'],
    [85000, 'osmdesátpěttisíc'],
    [1000000, 'jedenmilion'],
    [2500000, 'dvamilionypětsettisíc'],
    [1234567, 'jedenmiliondvěstětřicetčtyřitisícpětsetšedesátsedm'],
    [1000000000, 'jednamiliarda'],
  ];
  for (const [n, words] of cases) assert.equal(numberToWordsCs(n), words, String(n));
  assert.equal(numberToWordsCs(1111, false), 'jeden tisíc jedno sto jedenáct');
  assert.equal(numberToWordsCs(NaN), 'nula');
});

test('částka slovy má měnu ve správném tvaru a rodě', () => {
  const cases: [number, string][] = [
    [0, 'nula korun českých'],
    [1, 'jedna koruna česká'],
    [2, 'dvě koruny české'],
    [4, 'čtyři koruny české'],
    [5, 'pět korun českých'],
    [11, 'jedenáct korun českých'],
    [12, 'dvanáct korun českých'],
    [21, 'dvacetjedna koruna česká'],
    [22, 'dvacetdvě koruny české'],
    [112, 'jednostodvanáct korun českých'],
    [2002, 'dvatisícedvě koruny české'],
    [85000, 'osmdesátpěttisíc korun českých'],
    [-300, 'minus třista korun českých'],
  ];
  for (const [n, words] of cases) assert.equal(amountInWordsCzk(n), words, String(n));
  assert.equal(formatContractPriceWithWords(85000).replace(/\s/g, ' '), '85 000 Kč, slovy osmdesátpěttisíc korun českých');
});

test('místo a datum uzavření smlouvy', () => {
  assert.equal(formatPlaceWithPreposition('Praze'), 'V Praze');
  assert.equal(formatPlaceWithPreposition('v Praze'), 'V Praze');
  assert.equal(formatPlaceWithPreposition('Vsetíně'), 'Ve Vsetíně');
  assert.equal(formatPlaceWithPreposition(''), 'V místě plnění');
  assert.equal(cleanPlaceName(' „ve Frýdku" '), 'Frýdku');
  assert.equal(formatDateCs('2026-01-05'), '5. 1. 2026');
  assert.equal(formatContractConclusionLine('Brně', '2026-11-13'), 'V Brně dne 13. 11. 2026');
});

test('IBAN z českého čísla účtu', () => {
  // Veřejně známý vzorový účet: 19-2000145399/0800
  assert.equal(czAccountToIban('19-2000145399/0800'), 'CZ6508000000192000145399');
  assert.equal(czAccountToIban('123456789/0800'), 'CZ7508000000000123456789');
  assert.equal(czAccountToIban(' 123 456 789 / 0800 '), 'CZ7508000000000123456789');
  assert.equal(czAccountToIban('CZ65 0800 0000 1920 0014 5399'), 'CZ6508000000192000145399');
  for (const bad of ['', 'abc', '123/1', '123456789', '123456789/08000', 'CZ6608000000192000145399', '12345678901/0800'])
    assert.equal(czAccountToIban(bad), '', bad);
});

test('QR platba (SPAYD)', () => {
  assert.equal(
    generateSpaydString({ account: '19-2000145399/0800', amount: 85000, vs: 'VS 2026-001', message: 'Faktura FA-2026001 Marek Dvořák*' }),
    'SPD*1.0*ACC:CZ6508000000192000145399*AM:85000.00*CC:CZK*X-VS:2026001*MSG:Faktura FA-2026001 Marek Dvorak*'
  );
  assert.equal(generateSpaydString({ account: '123456789/0800', amount: 1234.5 }), 'SPD*1.0*ACC:CZ7508000000000123456789*AM:1234.50*CC:CZK*');
  // Bez platného účtu se QR platba nevytváří (dřív vznikl kód s prázdným účtem)
  assert.equal(generateSpaydString({ account: 'nesmysl', amount: 100 }), '');
  assert.equal(generateSpaydString({ account: '123456789/0800', amount: NaN }), '');
});

test('oslovení v 5. pádu', () => {
  const cases: [string, string][] = [
    ['Jan Novák', 'Jane'],
    ['Petr Svoboda', 'Petře'],
    ['Marek Dvořák', 'Marku'],
    ['Jana Nováková', 'Jano'],
    ['Tomáš Kučera', 'Tomáši'],
    ['Karel Němec', 'Karle'],
    ['Jiří Dvořák', 'Jiří'],
    ['Jan Novák – Řemeslné a obkladačské práce', 'Jane'],
    ['Ing. Petr Svoboda', 'Petře'],
    ['Mgr. Jana Nováková', 'Jano'],
    ['Nova Real s.r.o.', ''],
    ['Stavby Novák a.s.', ''],
    ['', ''],
  ];
  for (const [name, voc] of cases) assert.equal(getVocative(name), voc, name);
});
