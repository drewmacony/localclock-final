/* Stopwatch and countdown timer. Both use absolute timestamps (Date.now), so throttled tabs never cause drift. */
(() => {
'use strict';
const $ = s => document.querySelector(s), pad = n => String(n).padStart(2, '0');
const muted = () => window.AppState && window.AppState.muted();

/* ---- stopwatch ---- */
let swStart = 0, swAcc = 0, swRun = false, swIv = 0, laps = [], lastLap = 0;
const swMs = () => swAcc + (swRun ? Date.now() - swStart : 0);
function fmt(ms) {
  const t = Math.floor(ms / 10), c = t % 100, s = Math.floor(t / 100) % 60, m = Math.floor(t / 6000) % 60, h = Math.floor(t / 360000);
  return (h ? h + ':' : '') + pad(m) + ':' + pad(s) + '.' + pad(c);
}
function swDraw() {
  $('#swt').textContent = fmt(swMs());
  $('#swgo').textContent = swRun ? 'Stop' : (swAcc ? 'Resume' : 'Start');
  $('#swlap').disabled = !swRun;
  $('#swlaps').innerHTML = laps.map((l, i) => `<li><span>Lap ${laps.length - i}</span><span>${fmt(l.split)}</span><span class="mut">${fmt(l.total)}</span></li>`).join('');
}
$('#swgo').onclick = () => {
  if (swRun) { swAcc += Date.now() - swStart; swRun = false; clearInterval(swIv); }
  else { swStart = Date.now(); swRun = true; swIv = setInterval(() => { $('#swt').textContent = fmt(swMs()); }, 40); }
  swDraw();
};
$('#swlap').onclick = () => { const t = swMs(); laps.unshift({ split: t - lastLap, total: t }); lastLap = t; swDraw(); };
$('#swrst').onclick = () => { clearInterval(swIv); swRun = false; swAcc = 0; laps = []; lastLap = 0; swDraw(); };

/* ---- countdown timer ---- */
let end = 0, rem = 0, run = false, tIv = 0, alarmH = null;
const field = id => Math.max(0, Math.min(+$(id).max, Math.floor(+$(id).value) || 0));
const readInputs = () => (field('#th') * 3600 + field('#tm') * 60 + field('#ts')) * 1000;
function tDraw() {
  const idle = !run && rem === 0, secs = Math.ceil((run ? end - Date.now() : rem) / 1000);
  $('#tin').hidden = !idle; $('#tdisp').hidden = idle;
  $('#tdisp').textContent = pad(Math.floor(secs / 3600)) + ':' + pad(Math.floor(secs / 60) % 60) + ':' + pad(secs % 60);
  $('#tgo').textContent = run ? 'Pause' : (rem ? 'Resume' : 'Start');
}
function tStop() { clearInterval(tIv); run = false; }
$('#tgo').onclick = () => {
  if (run) { rem = Math.max(0, end - Date.now()); tStop(); }
  else {
    if (!rem) rem = readInputs();
    if (!rem) return;
    end = Date.now() + rem; run = true; tIv = setInterval(tTick, 100);
  }
  tDraw();
};
$('#trst').onclick = () => { tStop(); rem = 0; tDraw(); };
document.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => {
  if (run || rem) return; const m = +b.dataset.preset; $('#th').value = Math.floor(m / 60); $('#tm').value = m % 60; $('#ts').value = 0;
});
function tTick() { if (end - Date.now() <= 0) tDone(); else tDraw(); }
async function tDone() {
  tStop(); rem = 0; tDraw(); $('#tdlg').showModal();
  const h = muted() ? null : await Audio_.play(null, 0.8, true);
  if ($('#tdlg').open) alarmH = h; else if (h) h.stop();
}
$('#tdis').onclick = () => { if (alarmH) alarmH.stop(); alarmH = null; $('#tdlg').close(); };
$('#tdlg').addEventListener('cancel', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (run) tTick(); if (swRun) swDraw(); });
swDraw(); tDraw();
})();
