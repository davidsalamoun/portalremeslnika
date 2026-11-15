import test from 'node:test';
import assert from 'node:assert/strict';
import { getJobStage, isActiveJob } from '../src/utils/jobStage.ts';

const c = (over: Record<string, unknown> = {}): any => ({ id: 'c1', docKind: 'contract', price: 10000, status: 'draft', ...over });

test('fáze zakázky se odvodí z jejích údajů', () => {
  assert.equal(getJobStage(c({ leadStage: 'inquiry', price: 0 })).key, 'inquiry');
  assert.equal(getJobStage(c({ docKind: 'quote' })).key, 'quote');
  assert.equal(getJobStage(c()).key, 'contract');
  assert.equal(getJobStage(c({ status: 'signed', clientSignature: 'x' })).key, 'contract');
  assert.equal(getJobStage(c({ status: 'in_progress' })).key, 'realization');
  assert.equal(getJobStage(c({ leadStage: 'realization' })).key, 'realization');
  assert.equal(getJobStage(c({ status: 'handover_done' })).key, 'handover');
  assert.equal(getJobStage(c({ status: 'in_progress', handoverData: { handoverDate: '2026-11-13', status: 'bez_vad' } })).key, 'handover');
  assert.equal(getJobStage(c({ status: 'paid' })).key, 'paid');
  assert.equal(getJobStage(c({ status: 'in_progress', paidDate: '2026-11-13' })).key, 'paid');
});

test('metr postupuje s fází a končí na 100 %', () => {
  const order = [
    c({ leadStage: 'inquiry' }),
    c({ docKind: 'quote' }),
    c(),
    c({ status: 'in_progress' }),
    c({ status: 'handover_done' }),
    c({ status: 'paid' }),
  ].map((x) => getJobStage(x).percent);
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.equal(order[order.length - 1], 100);
  assert.ok(order[0] > 0);
});

test('další krok říká, co udělat', () => {
  assert.equal(getJobStage(c({ leadStage: 'inquiry', nextStepNote: ' Zavolat v pondělí ' })).next, 'Zavolat v pondělí');
  assert.equal(getJobStage(c()).next, 'Čeká na podpis zákazníka');
  assert.match(getJobStage(c({ clientSignature: 'x', advanceAmount: 14550 })).next, /^Vystavit zálohovou fakturu na 14.550 Kč$/);
  assert.equal(getJobStage(c({ clientSignature: 'x' })).next, 'Podepsáno, zahájit práce');
});

test('rozpracovaná je každá zakázka, která není zaplacená', () => {
  assert.equal(isActiveJob(c({ status: 'handover_done' })), true);
  assert.equal(isActiveJob(c({ status: 'paid' })), false);
  assert.equal(isActiveJob(c({ leadStage: 'completed' })), false);
});
