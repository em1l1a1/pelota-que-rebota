# AGENTS.md

## What this is
Single-page p5.js sketch ("pelota que rebota" / bouncing ball). Plain static files — **no package manager, build step, bundler, tests, lint, or CI**. Do not introduce tooling unless the user asks.

## Files
- `index.html` — page shell with an inline CSS reset (`margin:0`, full-window, `canvas{display:block}`) and a centered fixed `<h1>` title. Loads p5.js 2.3.4 and p5.sound 0.4.1 from jsDelivr CDN, then `sketch.js`. **Load order matters** (p5 first, then p5.sound; the sound build patches the global `p5`).
- `sketch.js` — all logic, using the p5 global-mode lifecycle (`setup()` / `draw()`). This is the file to edit.

## Running / verifying
- Open `index.html` in a browser, or serve the folder over HTTP (e.g. `python -m http.server`) and visit the printed URL.
- Both CDN scripts require network access; offline neither the canvas nor sound works.
- No test framework. Verify by loading the page and watching the console for errors.

## Gotchas
- p5 **2.x**, not the widely-known 1.x API. Check the 2.x reference before assuming 1.x behavior.
- Audio is **gated by the browser autoplay policy**: p5.sound stays silent until a user gesture. `iniciarAudio()` (called from `mousePressed`/`touchStarted`) runs `userStartAudio()` and `osc.start()` exactly once; do not start the oscillator before that.
- Sound chain is `p5.Oscillator -> p5.Envelope -> destination` (`osc.disconnect()` then `osc.connect(env)`). Call `env.play()` to fire a bounce blip; `osc.freq()` sets pitch.
- Physics/state live as top-level `let` bindings in `sketch.js`. They are **not** properties of `window` (`window.posX` is `undefined`), but page-context devtools/eval can still read them by bare name.
- Bounce physics live inline in `actualizarFisica()`: gravity, `rebote()` (random restitution per hit), wall reflections, and velocity clamps. Tune constants (`RADIO`, `GRAVEDAD`) at the top.
- Hover-stop is positional: while `dist(mouseX, mouseY, posX, posY) <= RADIO`, velocities are zeroed in `draw()`.
- Click/tap boost: `cursorSobrePelota()` + `impulsarPelota()` raise a top-level `multiplicador` by ×1.2 per hit (capped at `VELOCIDAD_MAX`), and a `setTimeout` resets it to `1` after `DURACION_IMPULSO` ms. `multiplicador` scales position integration in `actualizarFisica()` (not the raw velocities), so the reset is smooth. `touchStarted()` returns `false` to avoid a synthetic `mousePressed` double-boost.
- Particles: the `Particula` class spawns circles/squares/triangles from the mouse in `emitirParticulas()` (capped at `MAX_PARTICULAS`), fade/shrink by `vida / vidaMax`, and are spliced out when `viva` is false. Emission is skipped while `mouseX`/`mouseY` are `0,0` (p5's pre-move default).
- Look: background is pastel pink `background(255, 209, 220)`. The ball's fill is `colorPelota`, advanced through `PALETA` by `cambiarColorPelota()` on every wall collision. p5 listens to `mousemove` (not only `pointermove`) for `mouseX`/`mouseY`.
- Code comments and UI text are in Spanish; keep new prose consistent with that.
