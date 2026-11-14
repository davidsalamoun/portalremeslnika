import test from 'node:test';
import assert from 'node:assert/strict';
import { planImageCleanup } from '../src/utils/imageCleanup.ts';

const now = new Date('2026-12-31T12:00:00Z');
const old = '2026-10-01T10:00:00Z'; // 91 dní
const fresh = '2026-12-20T10:00:00Z'; // 11 dní

test('smaže se jen starý obrázek, na který nic neodkazuje', () => {
  const plan = planImageCleanup({
    referenced: ['pouzity_stary', 'pouzity_novy'],
    remote: [
      { id: 'pouzity_stary', createdAt: old },
      { id: 'pouzity_novy', createdAt: fresh },
      { id: 'sirotek_stary', createdAt: old },
      { id: 'sirotek_novy', createdAt: fresh },
    ],
    localUploaded: [
      { id: 'pouzity_stary', createdAt: old },
      { id: 'sirotek_stary', createdAt: old },
      { id: 'sirotek_novy', createdAt: fresh },
    ],
    localIds: ['pouzity_stary', 'pouzity_novy', 'sirotek_stary', 'sirotek_novy'],
    now,
  });
  assert.deepEqual(plan.deleteRemote, ['sirotek_stary']);
  assert.deepEqual(plan.deleteLocal, ['sirotek_stary']);
  assert.deepEqual(plan.reupload, []);
});

test('čerstvý osiřelý obrázek se nemaže – může ho právě nahrávat jiné zařízení', () => {
  const plan = planImageCleanup({
    referenced: [],
    remote: [{ id: 'na_ceste', createdAt: fresh }],
    localUploaded: [],
    localIds: [],
    now,
  });
  assert.deepEqual(plan, { deleteRemote: [], deleteLocal: [], reupload: [] });
});

test('obrázek, který v účtu chybí a zařízení ho má, se nahraje znovu', () => {
  const plan = planImageCleanup({
    referenced: ['chybi_mam', 'chybi_nemam', 'v_poradku'],
    remote: [{ id: 'v_poradku', createdAt: old }],
    localUploaded: [{ id: 'chybi_mam', createdAt: old }],
    localIds: ['chybi_mam', 'v_poradku'],
    now,
  });
  assert.deepEqual(plan.reupload, ['chybi_mam']);
  assert.deepEqual(plan.deleteLocal, []); // odkazovaný obrázek se ze zařízení nikdy nemaže
  assert.deepEqual(plan.deleteRemote, []);
});

test('obrázek s neznámým stářím se nemaže', () => {
  const plan = planImageCleanup({
    referenced: [],
    remote: [{ id: 'bez_data', createdAt: '' }, { id: 'nesmysl', createdAt: 'včera' }],
    localUploaded: [{ id: 'bez_data', createdAt: '' }],
    localIds: ['bez_data'],
    now,
  });
  assert.deepEqual(plan.deleteRemote, []);
  assert.deepEqual(plan.deleteLocal, []);
});

test('hranice stáří: přesně 30 dní ještě ne, déle ano', () => {
  const at = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  const plan = planImageCleanup({
    referenced: [],
    remote: [{ id: 'd30', createdAt: at(30) }, { id: 'd31', createdAt: at(31) }],
    localUploaded: [],
    localIds: [],
    now,
  });
  assert.deepEqual(plan.deleteRemote, ['d31']);
});
