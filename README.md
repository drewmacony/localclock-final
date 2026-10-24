# Local Clock

Offline digital clock: main clock + 3 world clocks, hourly chime, multiple alarms, custom MP3 sounds, light/dark/system theme. Vanilla HTML/CSS/JS, no dependencies, no network use.

## Run
Double-click `index.html` (Chrome, Edge, Firefox, Safari). No server needed. If your browser restricts storage for `file://` pages, run `python -m http.server 8080 --bind 127.0.0.1` in this folder and open http://127.0.0.1:8080 (local only).
Click **Enable sound** once per session (browsers block audio until you interact).

## Structure
- `js/timers.js` stopwatch (laps) and countdown timer (alarm sound + dialog when finished).
- `js/tz.js` time zones (Intl), `js/scheduler.js` next-alarm maths, `js/audio.js` sounds, `js/store.js` persistence, `js/theme.js`, `js/app.js` UI, clocks, chime, alarm runtime.
- `tests/run.js` automated tests: `node tests/run.js`

## Storage
Settings and alarms: `localStorage`. Uploaded MP3s: IndexedDB (database `localclock`). Both are per-browser and per-origin (the `file://` page and the `127.0.0.1` page keep separate data) and can be cleared by the browser. Use **Settings → Export settings** to back up (includes MP3s) and **Import** to restore.

## Policies
- Time source is the OS clock; keep it synced (instructions in Settings). Manual mode shifts the app's time only.
- DST: alarms store wall-clock time + zone and are re-resolved each time. Nonexistent local time → shifted forward by the gap; ambiguous time → first occurrence.
- An alarm/chime missed by more than 2 min / 5 s (sleep, suspended tab) is skipped, never replayed. Repeating alarms move to the next occurrence.
- Built-in chime/alarm sounds are synthesized (no asset files). MP3 limit: 8 MB.

## Limitations
Alarms cannot fire while the browser/tab is closed or the PC is asleep, and background tabs may be throttled (the app tolerates this but cannot wake the computer). Reliable closed-app alarms need a native app using OS scheduling (Task Scheduler / launchd). Stopwatch and timer state is not saved across reloads. Not implemented: separate chime per clock.

## Checklist
Automated (`tests/run.js`): time-zone offsets, DST gap/overlap, next-occurrence for one-time/repeating alarms.
Implemented, to verify manually in your browser: clocks update; zone changes; chime once per hour; multiple alarms, snooze, dismiss; MP3 upload/preview/assign/restore; persistence after reload; light/dark; offline use; invalid-file and blocked-audio messages; export/import.
