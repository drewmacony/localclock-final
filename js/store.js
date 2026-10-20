/* Persistence: settings + alarms in localStorage; MP3 blobs in IndexedDB. Nothing leaves the browser. */
const Store = (() => {
  const KEY = 'localclock.v1';
  const sysZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } };
  const defaults = () => ({ theme: 'system', h12: false, showDate: true, mute: false, manual: false, offset: 0,
    zones: [sysZone(), 'Europe/London', 'America/New_York', 'Asia/Tokyo'],
    chime: { on: true, follow: 0, vol: 0.7, custom: false, name: '' }, alarms: [] });
  function clean(o) {
    o = o || {};
    const d = defaults(), dz = d.zones, dc = d.chime, s = Object.assign(d, o);
    s.chime = Object.assign(dc, o.chime);
    s.zones = dz.map((z, i) => (o.zones && TZ.isValid(o.zones[i])) ? o.zones[i] : z);
    s.alarms = (Array.isArray(o.alarms) ? o.alarms : []).filter(a => a && a.id && /^\d\d:\d\d$/.test(a.time) && TZ.isValid(a.zone))
      .map(a => Object.assign({ name: 'Alarm', days: [], vol: 0.8, snooze_min: 5, enabled: false, done: false, next: null, snooze: null, hasSound: false }, a));
    return s;
  }
  function load() { try { return clean(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return clean(); } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage full/blocked */ } }
  let dbp;
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('localclock', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('sounds');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => {
    const t = d.transaction('sounds', mode), rq = fn(t.objectStore('sounds'));
    t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error); }); };
  const getSound = id => tx('readonly', s => s.get(id)).catch(() => null);
  const putSound = (id, b) => tx('readwrite', s => s.put(b, id));
  const delSound = id => tx('readwrite', s => s.delete(id)).catch(() => null);
  const toURL = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
  async function exportAll(s) {
    const sounds = {};
    for (const k of await tx('readonly', st => st.getAllKeys())) { const b = await getSound(k); if (b) sounds[k] = await toURL(b); }
    return { app: 'localclock', version: 1, settings: s, sounds };
  }
  async function importAll(data) {
    if (!data || data.app !== 'localclock' || !data.settings) throw new Error('Not a Local Clock backup file.');
    await tx('readwrite', s => s.clear());
    for (const [k, u] of Object.entries(data.sounds || {})) await putSound(k, await (await fetch(u)).blob());
    const s = clean(data.settings); save(s); return s;
  }
  async function reset() { localStorage.removeItem(KEY); await tx('readwrite', s => s.clear()).catch(() => 0); }
  return { load, save, getSound, putSound, delSound, exportAll, importAll, reset };
})();
