# AGENTS.md

Single-page p5.js sketch ("pelota que rebota" / bouncing ball). No build, no package manager, no tests, no lint/format config.

## Files
- `index.html` — loads vendored `lib/p5.min.js` (and `lib/p5.sound.min.js` when served over http/https), then `sketch.js`. Runs by double-clicking (`file://`).
- `sketch.js` — the whole sketch (p5 global mode: `setup()`, `draw()`, `windowResized()`, `mousePressed()`).
- `lib/` — vendored p5.js 1.11.3 and p5.sound 1.11.3. Keep them local: the page must work offline and from `file://`.

## Hard constraints (do not "fix" these)
- **Stay on p5.js 1.x; do not upgrade to 2.x.** p5 2.x fetches the sketch source with `fetch()` for its friendly-error system, which fails under `file://` (CORS) so the sketch never runs.
- **Do not move the libraries back to a CDN.** Local files are what make `file://` and offline work.
- **p5.sound is only loaded over http/https** (conditional `document.write` in `index.html`). Its Tone.js audio graph uses AudioWorklets loaded from `blob:` URLs, which Chrome blocks on `file://` origins. On `file://`, `sketch.js` falls back to a native Web Audio beep. `sketch.js` picks the path via `PUEDE_P5SOUND` / `modoAudio` (`'p5sound'` or `'webaudio'`).

## Audio gotchas
- Audio is created lazily in `iniciarAudio()` on the first user gesture (`mousePressed` / `touchStarted`), never in `setup()`. Browsers block AudioContext until a gesture; this also avoids the "AudioContext was not allowed to start" warnings.
- `sonarRebote()` no-ops until `audioListo` is true. Do not remove the gesture gate.
- p5.sound path uses the **legacy** API: `env.connect(osc)` routes an envelope onto the oscillator's amplitude; `env.play(osc, 0, 0.02)` fires it. `setADSR`'s third argument is a sustain *percent* (0–1), not a duration.
- The Web Audio fallback (`beepWebAudio`) uses `exponentialRampToValueAtTime`, which requires strictly positive values.

## Layout
- `index.html` sets `html,body{margin:0;overflow:hidden}` and makes the `<h1>` `position:fixed`. Without this the heading pushes the `windowHeight` canvas down and its bottom edge (where the ball bounces) is off-screen.
- `p5.disableFriendlyErrors = true` is set before `sketch.js` to avoid FES and its CDN translation fetch.

## Gameplay / interaction
- The ball flees the cursor: `huirDelCursor()` is **edge-triggered** via `cursorCerca`, so it jumps once each time the pointer *enters* `RADIO_DETECCION` (not every frame). The impulse pushes away from the cursor with a strong upward bias: `vy += dy*fuerza - IMPULSO_ARRIBA` (tune `IMPULSO_ARRIBA` for jump height). `VEL_MAX` clamps the result, so it also caps the jump.
- Clicking/touching the ball within its radius sets `celebracion` and plays an ascending arpeggio (`sonarCelebracion()`). While `celebracion > 0` the physics are paused and `dibujarCelebracion()` draws rings + "¡la atrapaste!".
- `mousePressed`/`touchStarted` first call `iniciarAudio()` (unlock audio), then test the hit. Keep that order so the first click both unlocks audio and can count as a catch.
- Each wall bounce calls `emitirParticulas()` (a burst of 6–12). Particles use `millis()` ages, fade with `map(edad, 0, VIDA_PARTICULA, 255, 0)`, are capped at `MAX_PARTICULAS`, and are removed in `actualizarParticulas()` once older than `VIDA_PARTICULA` (20000 ms = 20 s).

## Conventions
- Physics are hand-rolled in `draw()` (gravity, random per-bounce restitution); no physics library.
- UI text and comments are in Spanish; match that if adding user-facing text.
- No automated checks exist. Verify visually in a browser and watch the console for errors.
