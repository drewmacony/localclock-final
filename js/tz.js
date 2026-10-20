/* Time-zone helpers: all conversion uses the browser's IANA database via Intl (no fixed offsets). */
(function (root) {
  const FALLBACK = ['UTC','Africa/Accra','Africa/Cairo','Africa/Johannesburg','Africa/Lagos','Africa/Nairobi','America/Chicago','America/Los_Angeles','America/New_York','America/Sao_Paulo','Asia/Dubai','Asia/Kolkata','Asia/Shanghai','Asia/Singapore','Asia/Tokyo','Australia/Sydney','Europe/Berlin','Europe/London','Europe/Paris','Pacific/Auckland'];
  const cache = {};
  function dtf(zone, opts) {
    const k = zone + JSON.stringify(opts);
    return cache[k] || (cache[k] = new Intl.DateTimeFormat('en-US', Object.assign({ timeZone: zone }, opts)));
  }
  function allZones() {
    let z = [];
    try { z = Intl.supportedValuesOf('timeZone'); } catch (e) {}
    if (!z.length) z = FALLBACK.slice();
    return z.includes('UTC') ? z : ['UTC'].concat(z);
  }
  function isValid(zone) { if (typeof zone !== 'string' || !zone) return false; try { dtf(zone, {}); return true; } catch (e) { return false; } }
  function label(zone) { return zone === 'UTC' ? 'UTC' : zone.split('/').pop().replace(/_/g, ' '); }
  /* Wall-clock fields of an instant in a zone. */
  function parts(ms, zone) {
    const p = {};
    for (const x of dtf(zone, { hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(ms)) p[x.type] = x.value;
    return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second };
  }
  /* UTC offset in minutes at an instant (DST-aware). */
  function offset(ms, zone) {
    const p = parts(ms, zone);
    return (Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000) / 60000;
  }
  function abbr(ms, zone) {
    const x = dtf(zone, { timeZoneName: 'short' }).formatToParts(ms).find(p => p.type === 'timeZoneName');
    return x ? x.value : zone;
  }
  function fmtOffset(min) {
    const s = min < 0 ? '-' : '+', a = Math.abs(min), h = Math.floor(a / 60), m = a % 60;
    return 'UTC' + s + h + (m ? ':' + String(m).padStart(2, '0') : '');
  }
  /* Wall-clock time in a zone -> UTC ms.
     DST POLICY: ambiguous time (clocks go back) -> the FIRST occurrence;
     nonexistent time (clocks go forward) -> shifted forward by the gap (02:30 becomes 03:30). */
  function zonedToUtc(y, mo, d, h, mi, zone) {
    const naive = Date.UTC(y, mo - 1, d, h, mi, 0);
    const o1 = offset(naive - 864e5, zone), o2 = offset(naive + 864e5, zone);
    const ok = [o1, o2].map(o => naive - o * 6e4).filter(c => offset(c, zone) === (naive - c) / 6e4);
    return ok.length ? Math.min.apply(null, ok) : naive - o1 * 6e4;
  }
  const TZ = { allZones, isValid, label, parts, offset, abbr, fmtOffset, zonedToUtc };
  if (typeof module !== 'undefined') module.exports = TZ; else root.TZ = TZ;
})(this);
