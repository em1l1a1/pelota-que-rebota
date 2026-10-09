# AGENTS.md

## What this is
Single-page p5.js sketch ("Pelotita loca"): a ball with gravity that paints its path with pastel paint splats. Plain static files — **no package manager, build step, bundler, tests, lint, or CI**. Do not introduce tooling unless the user asks.

## Files
- `index.html` — page shell. Inline CSS reset (full-window, `canvas{display:block}`), Google Fonts **Fredoka 600** for the centered fixed `<h1>` title (purple + pink sticker shadow), and jsDelivr CDN scripts: p5.js 2.3.4 then p5.sound 0.4.1, then `sketch.js`. **Load order matters** (p5 first, then p5.sound; the sound build patches the global `p5`).
- `sketch.js` — all logic, in p5 global mode. Organized in sections: CONSTANTES, polyfill, ESTADO, SETUP, draw, FISICA, DIBUJO DE LA PELOTA, MANCHAS, color helper, SONIDO, ENTRADA.

## Running / verifying
- Open `index.html` in a browser, or serve the folder over HTTP (e.g. `python -m http.server`) and visit the printed URL.
- p5, p5.sound and the Fredoka font all load from CDNs; offline the sketch degrades. No test framework — verify by loading the page and watching the console.

## Tuning
- **All colors, sizes and physics values are in the `CONSTANTES` block at the top of `sketch.js`.** `PINTURAS` is the pastel palette, `COL_FONDO`/`COL_DETALLE`/`COL_REFLEJO` the background/text/glint. Ball speed = `GRAVEDAD`, `REBOTE_MIN/MAX`, `VEL_MAX_X/Y`, `ROZAMIENTO`, `IMPULSO_CLIC`; look = `RADIO`, squash `APLASTADO_MIN`/`ESTIRAMIENTO*`, shadow `SOMBRA_*`; paint = `MAX_MANCHAS`, `VIDA_MANCHA_*` (frames), `TRAZO_*`, `GOTAS_*`; audio = `VOLUMEN_REBOTE`, `FREC_*`.

## Gotchas
- p5 **2.x**, not the widely-known 1.x API. Check the 2.x reference before assuming 1.x behavior.
- Firefox lacks `AudioParam.cancelAndHoldAtTime`, which Tone.js (inside p5.sound) calls from `osc.freq()`; a polyfill at the top of `sketch.js` defines it if missing. Without it, `osc.freq()` throws and kills `draw()`.
- Audio is **gated by the browser autoplay policy**: `iniciarAudio()` (called from `mousePressed`/`touchStarted`) runs `userStartAudio()` + `osc.start()` once; do not start the oscillator before a user gesture. Chain is `p5.Oscillator -> p5.Envelope -> destination`; `osc.amp(VOLUMEN_REBOTE)` softens it and pitch rises with impact speed.
- Physics/state live as top-level `let`/`const` bindings in `sketch.js`. They are **not** properties of `window` (`window.posX` is `undefined`), but page-context devtools/eval can read them by bare name.
- Ball physics are split into `rebotarEnParedes`/`rebotarEnTecho`/`rebotarEnPiso`; every hit calls `alRebotar()` (recolor + sound). Restitution is always < 1, so the ball loses energy and eventually rests on the floor (`UMBRAL_REBOTE` stops the tiny bounces so it neither spam-splashes nor spams sound).
- Paint uses one `Mancha` class for trail blobs, floor/click splashes and flying droplets (`caida` > 0 makes a droplet fall). `agregarMancha()` enforces `MAX_MANCHAS`; dead stains are spliced out in `dibujarManchas()`. Lifetimes are **frame-based** (~60 fps assumed).
- `mousePressed`/`touchStarted` call `impulsarHaciaMouse()`: the ball is pushed toward the cursor and drops a big splash. `touchStarted` returns `false` to avoid a synthetic duplicate.
- p5 listens to `mousemove` (not only `pointermove`) for `mouseX`/`mouseY`; moving the cursor leaves fading pastel splashes.
- Code comments and UI text are in Spanish; keep new prose consistent with that.
