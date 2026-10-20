/* Audio: built-in synthesized chime/alarm (Web Audio, no asset files) + custom MP3 playback from Blobs. */
const Audio_ = (() => {
  let ctx = null;
  const hooks = { blocked() {}, error() {} };
  const MAX = 8 * 1024 * 1024;
  function validate(f) {
    if (!f) return 'No file selected.';
    if (!(f.type === 'audio/mpeg' || /\.mp3$/i.test(f.name))) return 'Only MP3 files are supported.';
    if (!f.size) return 'The file is empty.';
    if (f.size > MAX) return 'File too large (max 8 MB).';
    return null;
  }
  function unlock() {
    try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); return ctx.resume().then(() => ctx.state === 'running'); }
    catch (e) { return Promise.resolve(false); }
  }
  const ready = () => !!ctx && ctx.state === 'running';
  function tone(f, t0, dur, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + t0;
    o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function beep(vol, n) { if (!ready()) { hooks.blocked(); return false; } for (let i = 0; i < n; i++) { tone(880, i * 0.3, 0.25, vol * 0.5); tone(1320, i * 0.3 + 0.12, 0.25, vol * 0.3); } return true; }
  /* play(blob|null, volume 0-1, loop) -> {stop()} or null if blocked/failed */
  async function play(blob, vol, loop) {
    if (!blob) {
      if (!beep(vol, loop ? 3 : 2)) return null;
      const iv = loop ? setInterval(() => beep(vol, 3), 2500) : 0;
      return { stop() { clearInterval(iv); } };
    }
    const url = URL.createObjectURL(blob), a = new Audio(url);
    a.volume = vol; a.loop = loop;
    try { await a.play(); } catch (e) { URL.revokeObjectURL(url); e.name === 'NotAllowedError' ? hooks.blocked() : hooks.error(e.name); return null; }
    a.onended = () => URL.revokeObjectURL(url);
    return { stop() { a.pause(); URL.revokeObjectURL(url); } };
  }
  return { hooks, validate, unlock, ready, play };
})();
