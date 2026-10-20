/* Alarm scheduling: pure functions, no DOM. alarm = {time:'HH:MM', zone, days:[0-6] ([] = one-time)} */
(function (root) {
  const TZ = typeof module !== 'undefined' ? require('./tz.js') : root.TZ;
  function addDays(y, mo, d, n) {
    const t = new Date(Date.UTC(y, mo - 1, d + n));
    return { y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate(), wd: t.getUTCDay() };
  }
  /* Next occurrence strictly after `now` (ms), or null. Wall time is re-resolved each time, so DST is respected. */
  function nextOccurrence(a, now) {
    const [h, mi] = a.time.split(':').map(Number), p = TZ.parts(now, a.zone), days = a.days || [];
    for (let i = 0; i <= 8; i++) {
      const c = addDays(p.y, p.mo, p.d, i);
      if (days.length && !days.includes(c.wd)) continue;
      const t = TZ.zonedToUtc(c.y, c.mo, c.d, h, mi, a.zone);
      if (t > now) return t;
    }
    return null;
  }
  const Sched = { nextOccurrence };
  if (typeof module !== 'undefined') module.exports = Sched; else root.Sched = Sched;
})(this);
