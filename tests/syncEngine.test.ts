import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyncEngine, SyncBackend, RemoteRow, SyncTable, KeyValueStore } from '../src/utils/syncEngine.ts';

/** Napodobenina databáze: řádky podle uživatele a tabulky, čas změny jako rostoucí počítadlo. */
class FakeDb {
  rows = new Map<string, RemoteRow>();
  upsertCalls: { table: string; count: number }[] = [];
  clock = 0;
  failing = false;
  backendFor(userId: string): SyncBackend {
    return {
      upsert: async (table, rows) => {
        if (this.failing) throw new Error('offline');
        this.upsertCalls.push({ table, count: rows.length });
        for (const r of rows) {
          this.clock += 1;
          this.rows.set(`${userId}/${table}/${r.id}`, {
            id: r.id,
            data: JSON.parse(JSON.stringify(r.data)),
            deleted_at: r.deleted_at,
            updated_at: String(this.clock).padStart(8, '0'),
          });
        }
      },
      pull: async (table, since) => {
        if (this.failing) throw new Error('offline');
        const prefix = `${userId}/${table}/`;
        return [...this.rows.entries()]
          .filter(([k, r]) => k.startsWith(prefix) && (!since || r.updated_at > since))
          .map(([, r]) => JSON.parse(JSON.stringify(r)) as RemoteRow)
          .sort((a, b) => a.updated_at.localeCompare(b.updated_at));
      },
    };
  }
  live(userId: string, table: SyncTable) {
    const prefix = `${userId}/${table}/`;
    return [...this.rows.entries()].filter(([k, r]) => k.startsWith(prefix) && !r.deleted_at).map(([, r]) => r);
  }
}

/** Napodobenina prohlížeče: localStorage + zápis přes storage.ts (který volá trackChange). */
class Device {
  store = new Map<string, string>();
  kv: KeyValueStore = {
    getItem: (k) => this.store.get(k) ?? null,
    setItem: (k, v) => void this.store.set(k, v),
    removeItem: (k) => void this.store.delete(k),
  };
  engine!: ReturnType<typeof createSyncEngine>;
  login(db: FakeDb, userId: string) {
    this.engine = createSyncEngine(this.kv, db.backendFor(userId));
    return this.engine.adopt(userId);
  }
  save(key: string, value: unknown) {
    const oldRaw = this.kv.getItem(key);
    const newRaw = JSON.stringify(value);
    this.kv.setItem(key, newRaw);
    this.engine?.trackChange(key, oldRaw, newRaw);
  }
  read<T = any>(key: string): T {
    return JSON.parse(this.kv.getItem(key) ?? 'null');
  }
  async sync() {
    await this.engine.push();
    return this.engine.pull();
  }
}

test('data vzniklá před přihlášením se po prvním přihlášení nahrají do účtu', async () => {
  const db = new FakeDb();
  const a = new Device();
  a.save('zhotovitel', { name: 'Jan Novák', ico: '12345678' });
  a.save('klienti', [{ id: 'c1', name: 'Dvořák' }]);
  a.save('smlouvy', [{ id: 's2', price: 200 }, { id: 's1', price: 100 }]);
  a.save('remeslnik_cenik', [{ id: 'p1', title: 'Hodinová sazba' }]);

  await a.login(db, 'user-A');
  assert.equal(a.engine.pendingCount(), 5);
  await a.sync();
  assert.equal(a.engine.pendingCount(), 0);
  assert.equal(db.live('user-A', 'contracts').length, 2);
  assert.deepEqual(db.live('user-A', 'profiles')[0].data, { name: 'Jan Novák', ico: '12345678' });
  // Lokální data zůstala beze změny tvaru
  assert.deepEqual(a.read('smlouvy'), [{ id: 's2', price: 200 }, { id: 's1', price: 100 }]);
});

test('druhé zařízení po přihlášení dostane data z účtu a nezaloží duplicitní ceník', async () => {
  const db = new FakeDb();
  const a = new Device();
  a.save('zhotovitel', { name: 'Jan Novák' });
  a.save('smlouvy', [{ id: 's1', price: 100 }]);
  a.save('remeslnik_cenik', [{ id: 'p1', title: 'Hodinová sazba' }]);
  await a.login(db, 'user-A');
  await a.sync();

  const b = new Device();
  b.save('remeslnik_cenik', [{ id: 'p-jine', title: 'Výchozí položka z nového prohlížeče' }]);
  const changed = await b.login(db, 'user-A');
  await b.sync();
  assert.equal(changed, true);
  assert.deepEqual(b.read('zhotovitel'), { name: 'Jan Novák' });
  assert.deepEqual(b.read('smlouvy'), [{ id: 's1', price: 100 }]);
  assert.deepEqual(b.read('remeslnik_cenik'), [{ id: 'p1', title: 'Hodinová sazba' }]);
  assert.equal(db.live('user-A', 'price_list_items').length, 1);
});

test('úprava, nový záznam a smazání se propíšou na druhé zařízení', async () => {
  const db = new FakeDb();
  const a = new Device();
  const b = new Device();
  await a.login(db, 'user-A');
  a.save('smlouvy', [{ id: 's1', price: 100 }]);
  a.save('klienti', [{ id: 'c1', name: 'Dvořák' }]);
  await a.sync();
  await b.login(db, 'user-A');
  await b.sync();

  a.save('smlouvy', [{ id: 's2', price: 300 }, { id: 's1', price: 150 }]);
  a.save('klienti', []);
  a.save('zhotovitel', { name: 'Jan Novák' });
  await a.sync();
  assert.equal(await b.sync(), true);
  assert.deepEqual(b.read('smlouvy'), [{ id: 's2', price: 300 }, { id: 's1', price: 150 }]);
  assert.deepEqual(b.read('klienti'), []);
  assert.deepEqual(b.read('zhotovitel'), { name: 'Jan Novák' });
  // Opakovaná synchronizace bez změn nic nemění
  assert.equal(await b.sync(), false);
  assert.equal(await a.sync(), false);
});

test('změny udělané bez připojení zůstanou ve frontě a odešlou se později', async () => {
  const db = new FakeDb();
  const a = new Device();
  await a.login(db, 'user-A');
  db.failing = true;
  a.save('smlouvy', [{ id: 's1', price: 100 }]);
  await assert.rejects(a.sync());
  assert.equal(a.engine.pendingCount(), 1);
  assert.deepEqual(a.read('smlouvy'), [{ id: 's1', price: 100 }]);
  db.failing = false;
  await a.sync();
  assert.equal(a.engine.pendingCount(), 0);
  assert.equal(db.live('user-A', 'contracts').length, 1);
});

test('lokální neodeslaná změna má přednost před starší verzí z cloudu', async () => {
  const db = new FakeDb();
  const a = new Device();
  const b = new Device();
  await a.login(db, 'user-A');
  a.save('smlouvy', [{ id: 's1', price: 100 }]);
  await a.sync();
  await b.login(db, 'user-A');

  a.save('smlouvy', [{ id: 's1', price: 111 }]);
  await a.sync();
  b.save('smlouvy', [{ id: 's1', price: 222 }]);
  await b.engine.pull(); // stažení před odesláním nesmí lokální změnu přepsat
  assert.deepEqual(b.read('smlouvy'), [{ id: 's1', price: 222 }]);
  await b.sync();
  await a.sync();
  assert.deepEqual(a.read('smlouvy'), [{ id: 's1', price: 222 }]);
});

test('jiný účet ve stejném prohlížeči neuvidí data předchozího účtu', async () => {
  const db = new FakeDb();
  const d = new Device();
  await d.login(db, 'user-A');
  d.save('smlouvy', [{ id: 's1', price: 100 }]);
  d.save('zhotovitel', { name: 'Jan Novák' });
  await d.sync();

  await d.login(db, 'user-B');
  await d.sync();
  assert.equal(d.read('smlouvy'), null);
  assert.equal(d.read('zhotovitel'), null);
  assert.equal(db.live('user-B', 'contracts').length, 0);
  assert.equal(db.live('user-A', 'contracts').length, 1);

  // Po odhlášení (smazání lokálních dat) a návratu účtu A se data stáhnou zpět
  d.engine.clearLocal();
  await d.login(db, 'user-A');
  assert.deepEqual(d.read('smlouvy'), [{ id: 's1', price: 100 }]);
});

test('bez přihlášení se nic neeviduje a opakované přihlášení téhož účtu nic nemění', async () => {
  const db = new FakeDb();
  const d = new Device();
  d.engine = createSyncEngine(d.kv, db.backendFor('nikdo'));
  d.save('smlouvy', [{ id: 's1' }]);
  assert.equal(d.engine.pendingCount(), 0);
  await d.login(db, 'user-A');
  await d.sync();
  assert.equal(await d.login(db, 'user-A'), false);
  assert.equal(d.engine.pendingCount(), 0);
});

test('ceník se odešle jednou dávkou, smlouvy po jedné', async () => {
  const db = new FakeDb();
  const d = new Device();
  d.save('remeslnik_cenik', Array.from({ length: 25 }, (_, i) => ({ id: `p${i}`, title: `Položka ${i}` })));
  d.save('smlouvy', [{ id: 's1' }, { id: 's2' }]);
  await d.login(db, 'user-A');
  await d.sync();
  assert.equal(d.engine.pendingCount(), 0);
  assert.deepEqual(db.upsertCalls.filter((c) => c.table === 'price_list_items'), [{ table: 'price_list_items', count: 25 }]);
  assert.equal(db.upsertCalls.filter((c) => c.table === 'contracts').length, 2);
  assert.equal(db.live('user-A', 'price_list_items').length, 25);
});
