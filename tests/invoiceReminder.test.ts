import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReminderText, daysWordCs } from '../src/utils/invoiceReminder.ts';

const base = { invoiceNumber: '2026002', amount: 45000, dueDate: '2026-11-09', daysPastDue: 6, variableSymbol: '2026002', scope: 'Malování kanceláří', contractorName: 'Jan Novák', bankAccount: '123456789/0100' };

test('skloňování dnů', () => {
  assert.deepEqual([1, 2, 4, 5, 21].map(daysWordCs), ['den', 'dny', 'dny', 'dní', 'dní']);
});

test('upomínka po splatnosti uvádí prodlení, částku a platební údaje', () => {
  const t = buildReminderText(base, 'standard');
  assert.match(t, /6 dní po splatnosti/);
  assert.match(t, /termín byl 9\. 11\. 2026/);
  assert.match(t, /Číslo účtu: 123456789\/0100, VS: 2026002/);
  assert.match(t, /45\s000\sKč/);
  assert.match(buildReminderText({ ...base, daysPastDue: 1 }, 'urgent'), /1 den po splatnosti/);
});

test('faktura před splatností se jen připomíná, ať je tón jakýkoli', () => {
  for (const tone of ['friendly', 'standard', 'urgent'] as const) {
    const t = buildReminderText({ ...base, dueDate: '2026-11-29', daysPastDue: -14 }, tone);
    assert.match(t, /Splatnost je 29\. 11\. 2026/);
    assert.doesNotMatch(t, /po splatnosti|byla|neuhrazenou/);
  }
});

test('bez účtu a jména se použijí obecné údaje', () => {
  const t = buildReminderText({ ...base, contractorName: undefined, bankAccount: undefined }, 'friendly');
  assert.match(t, /Číslo účtu: dle faktury/);
  assert.match(t, /Váš dodavatel/);
});
