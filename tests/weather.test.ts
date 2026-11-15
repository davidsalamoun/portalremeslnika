import test from 'node:test';
import assert from 'node:assert/strict';
import { dayName, extractPlaceName, assessDay, findWarning, relativeDayLabel, buildDelayMessage } from '../src/utils/weather.ts';

const day = (over: Record<string, unknown> = {}): any => ({ date: '2026-11-16', weatherCode: 1, tempMax: 12, tempMin: 6, precipProb: 10, windMax: 12, ...over });

test('obec se vybere z adresy stavby', () => {
  assert.equal(extractPlaceName('Slunečná 45, 252 28 Černošice'), 'Černošice');
  assert.equal(extractPlaceName('Květinová 124/8, 14000 Praha 4'), 'Praha');
  assert.equal(extractPlaceName('Dlouhá 3, Praha 4 - Nusle'), 'Praha');
  assert.equal(extractPlaceName('Nové Město na Moravě'), 'Nové Město na Moravě');
  assert.equal(extractPlaceName('Hlavní 12, 664 91 Ivančice, okres Brno-venkov'), 'Ivančice');
  assert.equal(extractPlaceName('Hlavní 12'), '');
  assert.equal(extractPlaceName(''), '');
  assert.equal(extractPlaceName(undefined), '');
});

test('rizika dne: chladno, déšť, sníh, vítr', () => {
  assert.deepEqual(assessDay(day()), []);
  assert.deepEqual(assessDay(day({ tempMax: 4.9 })), ['cold']);
  assert.deepEqual(assessDay(day({ tempMax: 5 })), []);
  assert.deepEqual(assessDay(day({ weatherCode: 63 })), ['rain']);
  assert.deepEqual(assessDay(day({ precipProb: 60 })), ['rain']);
  assert.deepEqual(assessDay(day({ weatherCode: 73, tempMax: -1 })), ['cold', 'snow']);
  assert.deepEqual(assessDay(day({ windMax: 36 })), ['wind']);
  assert.deepEqual(assessDay(day({ windMax: 35 })), []);
});

test('varování hlídá jen dnešek, zítřek a pozítří', () => {
  const today = '2026-11-15';
  const ok = { place: 'Černošice', days: [day({ date: '2026-11-15' }), day({ date: '2026-11-16' })] };
  assert.equal(findWarning(ok, today), null);
  const tomorrow = { place: 'Černošice', days: [day({ date: '2026-11-15' }), day({ date: '2026-11-16', tempMax: 3, weatherCode: 61 })] };
  const w = findWarning(tomorrow, today)!;
  assert.equal(w.text, 'Zítra 3 °C, chladno, déšť (Černošice). Venkovní práce raději naplánujte jinak.');
  const late = { place: 'Černošice', days: [day({ date: '2026-11-18', tempMax: 0 })] };
  assert.equal(findWarning(late, today), null);
  const past = { place: 'Černošice', days: [day({ date: '2026-11-14', tempMax: 0 })] };
  assert.equal(findWarning(past, today), null);
});

test('popis dne a zpráva zákazníkovi', () => {
  assert.equal(relativeDayLabel('2026-11-15', '2026-11-15'), 'dnes');
  assert.equal(relativeDayLabel('2026-11-17', '2026-11-15'), 'pozítří');
  assert.equal(relativeDayLabel('2026-11-18', '2026-11-15'), 've středu');
  assert.equal(dayName('2026-11-18', '2026-11-15'), 'středa');
  assert.equal(dayName('2026-11-16', '2026-11-15'), 'zítra');
  const w = findWarning({ place: 'Brno', days: [day({ date: '2026-11-15', windMax: 50 })] }, '2026-11-15')!;
  const msg = buildDelayMessage('Fasáda', 'Brno', w, '2026-11-15');
  assert.match(msg, /dnes silný vítr/);
  assert.doesNotMatch(msg, /ČSN|BOZP|zákaz/);
});
