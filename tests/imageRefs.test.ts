import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stringifyWithRefs,
  parseWithImages,
  collectInlineImages,
  collectImageRefs,
  imageIdFor,
  placeholderFor,
  refFromPlaceholder,
} from '../src/utils/imageRefs.ts';

const photo = (seed: string) => 'data:image/jpeg;base64,' + seed.repeat(600);
const store = () => {
  const map = new Map<string, string>();
  return {
    map,
    put: (dataUrl: string) => {
      const id = imageIdFor(dataUrl);
      map.set(id, dataUrl);
      return id;
    },
    get: (id: string) => map.get(id),
  };
};

test('obrázky se při uložení nahradí odkazy a při čtení dosadí zpět beze změny dat', () => {
  const s = store();
  const contracts = [
    {
      id: 's1',
      price: 100,
      clientSignature: 'data:image/png;base64,' + 'QUJD'.repeat(900),
      photos: [{ id: 'p1', dataUrl: photo('AAAA'), caption: 'Před' }, { id: 'p2', dataUrl: photo('BBBB') }],
      expenses: [{ id: 'e1', receiptPhotoUrl: photo('CCCC') }, { id: 'e2' }],
      siteLogs: [{ id: 'l1', photos: [{ id: 'p3', dataUrl: photo('AAAA') }] }],
    },
  ];
  const raw = stringifyWithRefs(contracts, s.put);
  assert.equal(raw.includes('data:image/'), false);
  assert.ok(raw.length < 600);
  assert.equal(s.map.size, 4); // stejná fotka na dvou místech se uloží jednou
  assert.equal(collectImageRefs(raw).length, 4);
  assert.deepEqual(parseWithImages(raw, s.get), contracts);
});

test('krátké obrázky, cizí formáty a běžné texty zůstávají v datech', () => {
  const s = store();
  const value = { icon: 'data:image/png;base64,AAAA', svg: 'data:image/svg+xml;base64,' + 'A'.repeat(5000), note: '@email a data:image/ v textu' };
  const raw = stringifyWithRefs(value, s.put);
  assert.equal(s.map.size, 0);
  assert.deepEqual(parseWithImages(raw, s.get), value);
});

test('když úložiště obrázků není dostupné, obrázek zůstane v datech', () => {
  const value = [{ id: 's1', photos: [{ dataUrl: photo('AAAA') }] }];
  const raw = stringifyWithRefs(value, () => null);
  assert.deepEqual(JSON.parse(raw), value);
});

test('chybějící obrázek se zobrazí zástupným a při uložení se odkaz na něj neztratí', () => {
  const s = store();
  const original = [{ id: 's1', photos: [{ id: 'p1', dataUrl: photo('AAAA') }] }];
  const raw = stringifyWithRefs(original, s.put);

  // Jiné zařízení: obrázek ještě není stažený
  const missing: string[] = [];
  const onOtherDevice = parseWithImages(raw, () => undefined, (id) => missing.push(id));
  const shown = onOtherDevice[0].photos[0].dataUrl as string;
  assert.equal(missing.length, 1);
  assert.equal(refFromPlaceholder(shown), missing[0]);
  assert.ok(shown.startsWith('data:image/svg+xml,'));

  // Uživatel tam smlouvu upraví a uloží – odkaz zůstává stejný, zástupný obrázek se nikam neuloží
  onOtherDevice[0].price = 500;
  const other = store();
  const savedThere = stringifyWithRefs(onOtherDevice, other.put);
  assert.equal(other.map.size, 0);
  assert.deepEqual(collectImageRefs(savedThere), collectImageRefs(raw));

  // Po stažení obrázku se zobrazí původní fotka
  assert.equal(parseWithImages(savedThere, s.get)[0].photos[0].dataUrl, photo('AAAA'));
});

test('převod starších dat: najde obrázky uložené přímo v JSON', () => {
  const legacy = JSON.stringify([{ id: 's1', photos: [{ dataUrl: photo('AAAA') }, { dataUrl: photo('AAAA') }], sig: photo('DDDD') }]);
  assert.equal(collectInlineImages(legacy).length, 2);
  assert.equal(collectInlineImages(JSON.stringify([{ id: 's1' }])).length, 0);
  assert.equal(refFromPlaceholder(placeholderFor('img_abc_1')), 'img_abc_1');
  assert.equal(refFromPlaceholder(photo('AAAA')), null);
  assert.notEqual(imageIdFor(photo('AAAA')), imageIdFor(photo('AAAB')));
});
