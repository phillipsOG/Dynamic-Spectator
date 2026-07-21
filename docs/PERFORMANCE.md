# Performance notes

MultiView's cost is dominated by **off-screen scene captures** (a full scene
render + a synchronous vision recompute per capture). Everything in the design
exists to keep the number of captures per frame bounded and prioritised.

## Targets

- **60 FPS with 4 active cameras** on mid-range hardware.
- **Graceful degradation beyond 4**: secondaries slow their cadence first; the
  primary is protected.

## The levers

| Lever | Setting | Effect |
| --- | --- | --- |
| Max simultaneous cameras | `maxCameras` | Cameras beyond this paginate rather than render at once. |
| Frame-rate cap | `frameRateCap` | Gates the whole capture pass; camera easing still runs every frame. |
| Secondary cadence | `secondaryCadence` | Recapture secondaries every *N* capture frames. |
| Performance mode | `performanceMode` | Presets the per-frame secondary budget and capture resolution. |
| Render scale | `renderScale` | Off-screen texture resolution multiplier. |

### Performance mode presets

| Mode | Secondary budget / frame | Capture scale bias |
| --- | --- | --- |
| Quality | 4 | full |
| Balanced | 2 | full |
| Performance | 1 | ≤ 0.75 |
| Battery | 1 | ≤ 0.60 |

## Adaptive scheduling

`RenderScheduler` measures the rolling frame interval (via `profiler`). When the
measured frame time exceeds ~1.35× the target it **sheds** a unit of secondary
budget; when it drops below ~0.85× it **recovers** one, back up to the preset
base. The primary/pinned viewport always captures on eligible frames. This gives
smooth self-tuning rather than a hard cliff as viewport count grows.

## Why it stays bounded

- Camera advance (matrix easing) is O(viewports) and cheap → every frame.
- Captures are O(budget), not O(viewports) → **fixed** cost per frame regardless
  of how many viewports exist; extra viewports simply refresh less often or
  paginate.
- The live scene is hidden while MultiView is up, so the main render only draws
  lightweight sprites except during the budgeted captures.

## Memory

- One `RenderTexture` per viewport, resized in place (no per-resize allocation
  churn).
- `Viewport.destroy()` and `MultiViewManager.close()` destroy sprites and
  textures; `canvasTearDown` forces teardown on scene change so nothing leaks.
- The vision wrapper is removed on teardown; no dangling prototype patches.

## Measuring

Enable **Profiling** in settings. The MultiView control bar then shows live FPS
and the current capture budget. From the console:

```js
game.modules.get("dynamic-spectator").api.profiler.report();
// → { "capture.render": { avgMs, maxMs, lastMs, count }, "capture.vision": {…} }
```

Use `avgMs` for `capture.render` and `capture.vision` to see where a heavy scene
is spending time. If `capture.vision` dominates, raise `secondaryCadence` or drop
to Performance mode; if `capture.render` dominates, lower `renderScale`.

## Practical guidance

- 1–4 cameras: Balanced/Quality is comfortable on most GPUs.
- 5–9: expect secondaries to update a few times per second on Balanced; bump to
  Quality only if you have headroom.
- 10+: pagination keeps only `maxCameras` live; page through groups instead of
  trying to render everything at once.
- Ultrawide/4K: `renderScale` has the biggest single impact — 0.75 is usually
  indistinguishable in a tiled viewport and much cheaper.
