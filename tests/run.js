// Run: node tests/run.js  (Node 18+, uses the same tz.js / scheduler.js as the browser)
const assert = require('assert'), TZ = require('../js/tz.js'), Sched = require('../js/scheduler.js');
let n = 0; const iso = ms => new Date(ms).toISOString();
const t = (name, f) => { try { f(); n++; console.log('ok   ' + name); } catch (e) { console.error('FAIL ' + name + ': ' + e.message); process.exitCode = 1; } };
const U = Date.UTC;
t('offsets (incl. half-hour and DST)', () => { const d = U(2026, 6, 1, 12);
  assert.equal(TZ.offset(d, 'Europe/London'), 60); assert.equal(TZ.offset(d, 'Asia/Tokyo'), 540); assert.equal(TZ.offset(d, 'Asia/Kolkata'), 330);
  assert.equal(TZ.offset(d, 'Africa/Accra'), 0); assert.equal(TZ.offset(d, 'America/New_York'), -240); assert.equal(TZ.offset(U(2026, 0, 1), 'America/New_York'), -300); });
t('wall-clock parts', () => assert.deepEqual(TZ.parts(U(2026, 6, 1, 16, 0, 5), 'Asia/Tokyo'), { y: 2026, mo: 7, d: 2, h: 1, mi: 0, s: 5 }));
t('DST gap -> shifted forward', () => assert.equal(iso(TZ.zonedToUtc(2026, 3, 8, 2, 30, 'America/New_York')), '2026-03-08T07:30:00.000Z'));
t('DST overlap -> first occurrence', () => assert.equal(iso(TZ.zonedToUtc(2026, 11, 1, 1, 30, 'America/New_York')), '2026-11-01T05:30:00.000Z'));
t('one-time alarm today / tomorrow', () => {
  const a = { time: '14:00', zone: 'Europe/London', days: [] };
  assert.equal(iso(Sched.nextOccurrence(a, U(2026, 6, 1, 12))), '2026-07-01T13:00:00.000Z');
  assert.equal(iso(Sched.nextOccurrence(a, U(2026, 6, 1, 13))), '2026-07-02T13:00:00.000Z'); });
t('weekday repeat skips weekend', () => assert.equal(iso(Sched.nextOccurrence({ time: '08:00', zone: 'Africa/Accra', days: [1, 2, 3, 4, 5] }, U(2026, 6, 3, 20))), '2026-07-06T08:00:00.000Z'));
t('daily alarm across spring-forward keeps wall time', () => assert.equal(iso(Sched.nextOccurrence({ time: '07:00', zone: 'America/New_York', days: [] }, U(2026, 2, 7, 13))), '2026-03-08T11:00:00.000Z'));
t('alarm zone date differs from UTC date', () => assert.equal(iso(Sched.nextOccurrence({ time: '00:30', zone: 'Asia/Tokyo', days: [] }, U(2026, 6, 1, 16))), '2026-07-02T15:30:00.000Z'));
t('never returns a time <= now', () => { const a = { time: '10:00', zone: 'Asia/Kolkata', days: [] }, now = Sched.nextOccurrence(a, U(2026, 0, 1)); assert.ok(Sched.nextOccurrence(a, now) > now); });
console.log(n + ' passed');
