/* UI + clock rendering, hourly chime, alarm runtime. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
let azone = '', S = Store.load(), lastSec = -1, lastMin = -1, lastKey = null, queue = [], cur = null, curH = null, prev = null, pending = null, removeSnd = false, editing = null;
const now = () => Date.now() + (S.manual ? S.offset : 0);   // system clock (+ optional manual offset)
const save = () => Store.save(S);
function msg(t) { const m = $('#msg'); m.textContent = t; m.className = 'show'; clearTimeout(msg.t); msg.t = setTimeout(() => m.className = '', 4000); }
Audio_.hooks.blocked = () => msg('Sound is blocked by the browser. Click “Enable sound”.');
Audio_.hooks.error = n => msg('Could not play this audio file (' + n + ').');

/* ---- time zones ---- */
const ZONES = TZ.allZones();
const zt = z => `${TZ.label(z)} · ${z} ▾`;
const zrows = ZONES.map(z => ({ z, txt: (TZ.label(z) + ' ' + z).toLowerCase() }));
let zcb = null;
/* Searchable picker listing EVERY time zone the browser supports; calls cb(zone) on choice. */
function pickZone(cur, cb) { zcb = cb; $('#zq').value = ''; fillZones('', cur); $('#zdlg').showModal(); $('#zq').focus(); }
function fillZones(q, cur) {
  q = q.trim().toLowerCase(); const t = Date.now(), list = $('#zlist'); list.innerHTML = '';
  const hits = zrows.filter(r => r.txt.includes(q));
  if (!hits.length) { list.innerHTML = '<li class="empty">No matching time zone.</li>'; return; }
  hits.forEach(r => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.textContent = `${TZ.label(r.z)} — ${r.z} (${TZ.fmtOffset(TZ.offset(t, r.z))})`;
    if (r.z === cur) b.className = 'pri';
    b.onclick = () => { $('#zdlg').close(); if (zcb) zcb(r.z); };
    li.appendChild(b); list.appendChild(li);
  });
}
$('#zq').oninput = e => fillZones(e.target.value);
$('#zq').onkeydown = e => { if (e.key === 'Enter') { const b = $('#zlist button'); if (b) b.click(); } };
$('#zcancel').onclick = () => $('#zdlg').close();

/* ---- clocks ---- */
const clocks = [];
function mkClock(i, host) {
  const el = document.createElement('article');
  el.className = 'clock ' + (i ? 'small' : 'big');
  el.innerHTML = `<button type="button" class="zin" aria-label="Change time zone for ${i ? 'clock ' + i : 'main clock'}"></button><div class="time"></div><div class="sub"></div>`;
  host.appendChild(el);
  const inp = el.querySelector('.zin'); inp.textContent = zt(S.zones[i]);
  inp.addEventListener('click', () => pickZone(S.zones[i], z => {
    S.zones[i] = z; inp.textContent = zt(z); lastKey = null; save(); fillFollow(); lastSec = -1; tick();
  }));
  clocks.push({ inp, time: el.querySelector('.time'), sub: el.querySelector('.sub') });
}
function render(t) {
  clocks.forEach((c, i) => {
    const z = S.zones[i], p = TZ.parts(t, z); let h = p.h, ap = '';
    if (S.h12) { ap = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12; }
    c.time.innerHTML = `${S.h12 ? h : pad(h)}:${pad(p.mi)}:${pad(p.s)}${ap ? '<small>' + ap + '</small>' : ''}`;
    const date = S.showDate ? '<br>' + new Date(Date.UTC(p.y, p.mo - 1, p.d)).toLocaleDateString(undefined, i ? { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' } : { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '';
    c.sub.innerHTML = `${esc(TZ.label(z))} · ${esc(TZ.abbr(t, z))} · ${TZ.fmtOffset(TZ.offset(t, z))}${date}`;
  });
}
function fillFollow() {
  $('#follow').innerHTML = S.zones.map((z, i) => `<option value="${i}">${i ? 'Clock ' + i : 'Main clock'} – ${esc(TZ.label(z))}</option>`).join('');
  $('#follow').value = S.chime.follow;
}
function pills() {
  $('#soundState').textContent = S.mute ? 'Muted' : Audio_.ready() ? 'Sound enabled' : 'Sound not enabled';
  $('#soundBtn').hidden = Audio_.ready(); $('#manPill').hidden = !S.manual;
  $('#muteBtn').textContent = S.mute ? 'Unmute' : 'Mute'; $('#muteBtn').setAttribute('aria-pressed', S.mute);
}

/* ---- hourly chime: compares wall-clock hour keys, so no backlog after tab suspension ---- */
async function playChime() { return Audio_.play(S.chime.custom ? await Store.getSound('chime') : null, S.chime.vol, false); }
function checkChime(t) {
  const z = S.zones[S.chime.follow] || S.zones[0], p = TZ.parts(t, z), key = Math.floor((t + TZ.offset(t, z) * 6e4) / 36e5);
  if (key === lastKey) return;
  const first = lastKey === null; lastKey = key;
  if (first || !S.chime.on || S.mute || p.mi !== 0 || p.s > 4) return;   // only chime if we are within 5 s of the top of the hour
  playChime();
}

/* ---- alarms ---- */
function checkAlarms(t) {
  let ch = false;
  for (const a of S.alarms) {
    if (a.snooze && t >= a.snooze) { a.snooze = null; ch = true; ring(a); }
    if (!a.enabled || !a.next || t < a.next) continue;
    const late = t - a.next; ch = true;
    if (a.days.length) a.next = Sched.nextOccurrence(a, t); else { a.enabled = false; a.done = true; a.next = null; }  // advance first => never fires twice
    if (late <= 120000) ring(a);  // missed by >2 min (sleep/suspension) => skipped, not replayed
  }
  if (ch) { save(); renderAlarms(); }
}
function ring(a) { queue.push(a.id); if (!cur) showRing(); }
async function showRing() {
  const a = S.alarms.find(x => x.id === queue.shift());
  if (!a) { cur = null; return; }
  cur = a; $('#rname').textContent = a.name; $('#rtime').textContent = `Scheduled ${a.time} · ${TZ.label(a.zone)}`;
  $('#rsnz').textContent = `Snooze ${a.snooze_min} min`; $('#rdlg').showModal();
  const h = S.mute ? null : await Audio_.play(a.hasSound ? await Store.getSound('alarm:' + a.id) : null, a.vol, true);
  if (cur === a) curH = h; else if (h) h.stop();
}
function endRing(snooze) {
  if (curH) curH.stop(); curH = null;
  if (snooze && cur) { cur.snooze = now() + cur.snooze_min * 6e4; save(); renderAlarms(); }
  $('#rdlg').close(); cur = null; if (queue.length) showRing();
}
$('#rsnz').onclick = () => endRing(true); $('#rdis').onclick = () => endRing(false);
$('#rdlg').addEventListener('cancel', e => e.preventDefault());

const daysText = a => !a.days.length ? 'Once' : a.days.length === 7 ? 'Every day' : a.days.map(d => DAYS[d]).join(', ');
function nextText(a) {
  if (a.snooze) return 'Snoozed until ' + new Date(a.snooze).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (a.done) return 'Completed'; if (!a.enabled || !a.next) return 'Disabled';
  const m = Math.max(0, Math.round((a.next - now()) / 6e4)), r = m >= 1440 ? Math.floor(m / 1440) + 'd ' + Math.floor(m % 1440 / 60) + 'h' : m >= 60 ? Math.floor(m / 60) + 'h ' + m % 60 + 'm' : m + 'm';
  return 'Next: ' + new Intl.DateTimeFormat(undefined, { timeZone: a.zone, weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(a.next) + ` (${TZ.label(a.zone)}) · in ${r}`;
}
function renderAlarms() {
  const ul = $('#alist'); ul.innerHTML = '';
  if (!S.alarms.length) { ul.innerHTML = '<li class="empty">No alarms yet. Choose “New alarm” to add one.</li>'; return; }
  [...S.alarms].sort((a, b) => (b.enabled - a.enabled) || ((a.next || 1e18) - (b.next || 1e18))).forEach(a => {
    const li = document.createElement('li'); li.className = 'al' + (a.enabled ? '' : ' off');
    li.innerHTML = `<label class="sw"><input type="checkbox" ${a.enabled ? 'checked' : ''} aria-label="Enable ${esc(a.name)}"><span></span></label><div class="ai"><b>${esc(a.name)}</b> <span class="mut">${a.time} · ${esc(TZ.label(a.zone))} · ${daysText(a)}</span><div class="mut">${esc(nextText(a))}</div></div><button class="e">Edit</button><button class="d">Delete</button>`;
    li.querySelector('input').onchange = e => { a.enabled = e.target.checked; a.done = false; a.snooze = null; a.next = a.enabled ? Sched.nextOccurrence(a, now()) : null; save(); renderAlarms(); };
    li.querySelector('.e').onclick = () => openAlarm(a);
    li.querySelector('.d').onclick = async () => { if (!confirm(`Delete alarm “${a.name}”?`)) return; await Store.delSound('alarm:' + a.id); S.alarms = S.alarms.filter(x => x !== a); save(); renderAlarms(); };
    ul.appendChild(li);
  });
}
$('#adays').innerHTML = DAYS.map((d, i) => `<label><input type="checkbox" value="${i}"> ${d}</label>`).join('');
const stopPrev = () => { if (prev) prev.stop(); prev = null; };
function openAlarm(a) {
  editing = a || null; pending = null; removeSnd = false;
  const d = a || { name: '', time: '07:00', zone: S.zones[0], days: [], vol: 0.8, snooze_min: 5 };
  $('#an').value = d.name; $('#at').value = d.time; azone = d.zone; $('#az').textContent = zt(azone); $('#av').value = d.vol; $('#as').value = d.snooze_min;
  document.querySelectorAll('#adays input').forEach(c => c.checked = d.days.includes(+c.value));
  $('#asnd').textContent = a && a.hasSound ? 'Custom MP3 saved' : 'Default sound'; $('#aerr').textContent = ''; $('#afile').value = '';
  $('#adlg').showModal();
}
$('#az').onclick = () => pickZone(azone, z => { azone = z; $('#az').textContent = zt(z); });
$('#addAlarm').onclick = () => openAlarm(null);
$('#acancel').onclick = () => $('#adlg').close();
$('#adlg').addEventListener('close', stopPrev);
$('#afile').onchange = e => { const f = e.target.files[0], er = Audio_.validate(f); if (er) { $('#aerr').textContent = er; e.target.value = ''; return; } pending = f; removeSnd = false; $('#aerr').textContent = ''; $('#asnd').textContent = 'Selected: ' + f.name; };
$('#arm').onclick = () => { pending = null; removeSnd = true; $('#afile').value = ''; $('#asnd').textContent = 'Default sound'; };
$('#aprev').onclick = async () => { await Audio_.unlock(); stopPrev(); const b = pending || (!removeSnd && editing && editing.hasSound ? await Store.getSound('alarm:' + editing.id) : null); prev = await Audio_.play(b, +$('#av').value, false); };
$('#asave').onclick = async () => {
  const err = t => { $('#aerr').textContent = t; };
  const zone = azone; if (!TZ.isValid(zone)) return err('Choose a valid time zone.');
  const time = $('#at').value; if (!/^\d\d:\d\d$/.test(time)) return err('Pick a time.');
  const days = [...document.querySelectorAll('#adays input:checked')].map(c => +c.value);
  const a = editing || { id: uid(), hasSound: false };
  Object.assign(a, { name: $('#an').value.trim() || 'Alarm', time, zone, days, vol: +$('#av').value, snooze_min: +$('#as').value, enabled: true, done: false, snooze: null });
  try { if (pending) { await Store.putSound('alarm:' + a.id, pending); a.hasSound = true; } else if (removeSnd) { await Store.delSound('alarm:' + a.id); a.hasSound = false; } }
  catch (e) { return err('Could not store the sound (browser storage unavailable).'); }
  a.next = Sched.nextOccurrence(a, now()); if (!editing) S.alarms.push(a);
  save(); renderAlarms(); $('#adlg').close();
};

/* ---- settings ---- */
const on = (id, ev, fn) => $(id).addEventListener(ev, fn);
function openSettings() {
  $('#theme').value = S.theme; $('#fmt').value = S.h12 ? '12' : '24'; $('#sd').checked = S.showDate; $('#con').checked = S.chime.on; $('#cvol').value = S.chime.vol;
  fillFollow(); $('#cname').textContent = S.chime.custom ? (S.chime.name || 'Custom MP3') : 'Built-in chime'; $('#tmode').value = S.manual ? 'manual' : 'auto'; $('#sdlg').showModal();
}
on('#theme', 'change', e => { S.theme = e.target.value; Theme.apply(S.theme); save(); });
on('#fmt', 'change', e => { S.h12 = e.target.value === '12'; save(); lastSec = -1; tick(); });
on('#sd', 'change', e => { S.showDate = e.target.checked; save(); lastSec = -1; tick(); });
on('#con', 'change', e => { S.chime.on = e.target.checked; save(); });
on('#follow', 'change', e => { S.chime.follow = +e.target.value; lastKey = null; save(); });
on('#cvol', 'input', e => { S.chime.vol = +e.target.value; save(); });
on('#cprev', 'click', async () => { await Audio_.unlock(); pills(); stopPrev(); prev = await playChime(); });
on('#cfile', 'change', async e => {
  const f = e.target.files[0], er = Audio_.validate(f); e.target.value = '';
  if (er) return msg(er);
  try { await Store.putSound('chime', f); S.chime.custom = true; S.chime.name = f.name; save(); $('#cname').textContent = f.name; } catch (x) { msg('Could not store the sound (browser storage unavailable).'); }
});
on('#crest', 'click', async () => { await Store.delSound('chime'); S.chime.custom = false; S.chime.name = ''; save(); $('#cname').textContent = 'Built-in chime'; });
on('#tapply', 'click', () => {
  if ($('#tmode').value === 'manual') { const v = $('#mtime').value; if (!v) return msg('Pick a date and time first.'); S.offset = new Date(v).getTime() - Date.now(); S.manual = true; } else S.manual = false;
  lastKey = null; lastSec = -1; save(); pills(); tick();
});
on('#exp', 'click', async () => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(await Store.exportAll(S))], { type: 'application/json' }));
  a.download = 'localclock-backup-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
});
on('#imp', 'change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { S = await Store.importAll(JSON.parse(await f.text())); refresh(); msg('Settings imported.'); } catch (x) { msg('Import failed: ' + x.message); }
});
on('#reset', 'click', async () => { if (!confirm('Reset all settings, alarms and saved sounds?')) return; await Store.reset(); S = Store.load(); refresh(); $('#sdlg').close(); });
on('#sclose', 'click', () => { stopPrev(); $('#sdlg').close(); });
on('#setBtn', 'click', openSettings);
on('#muteBtn', 'click', () => { S.mute = !S.mute; save(); pills(); });
on('#soundBtn', 'click', async () => { const ok = await Audio_.unlock(); if (ok) Audio_.play(null, 0.4, false); pills(); });

/* ---- main loop: re-reads the clock every 250 ms and compares real time, so throttling never causes drift/duplicates ---- */
function tick() {
  const t = now(), sec = Math.floor(t / 1000);
  if (sec !== lastSec) { lastSec = sec; render(t); checkChime(t); checkAlarms(t); }
  const m = Math.floor(t / 6e4); if (m !== lastMin) { lastMin = m; renderAlarms(); pills(); }
}
function refresh() { Theme.apply(S.theme); clocks.forEach((c, i) => c.inp.textContent = zt(S.zones[i])); fillFollow(); lastSec = lastMin = -1; lastKey = null; pills(); tick(); }
mkClock(0, $('#main')); for (let i = 1; i < 4; i++) mkClock(i, $('#world'));
Theme.apply(S.theme); fillFollow(); tick(); pills();
setInterval(tick, 250);
document.addEventListener('visibilitychange', tick);
['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => Audio_.unlock().then(pills), { once: true }));
window.AppState = { muted: () => S.mute };
})();
