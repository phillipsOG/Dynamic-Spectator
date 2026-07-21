# Architecture

This document explains how Dynamic Spectator works, the layering of the code,
and — importantly — the **honest engineering trade-offs** behind MultiView.

## Module map

```
src/
  module.ts              Boot sequence (init → setup → ready), public API.
  constants.ts           Ids, socket, flags, hook names, setting keys, enums.
  settings.ts            Registers every setting; getSettings() → typed snapshot.
  state.ts               Shared singleton holding the live managers.

  permissions/
    PermissionManager.ts  "May user U spectate token T?" + opt-out/overrides.

  spectator/
    VisionController.ts     The reversible Token#_isVisionSource wrapper (POV).
    OcclusionController.ts  Reversible TokenLayer#_getOccludableTokens wrapper
                            (reveals roofs above the spectated token; height-aware).
    CameraLock.ts           Main-canvas camera lock/follow (single spectate).
    SpectatorManager.ts     Orchestrates permission + vision + occlusion + camera.

  multiview/
    LayoutEngine.ts       Pure adaptive CCTV tiler (aspect aware).
    GroupingEngine.ts     Elevation bands + distance clustering.
    CameraController.ts    Per-viewport off-screen camera (never moves canvas).
    SceneCapture.ts       Off-screen RenderTexture capture of the real scene.
    RenderScheduler.ts    Frame budget, render priority, adaptive cadence.
    Viewport.ts           One camera: descriptor + capture + sprite + overlay.
    MultiViewManager.ts   Orchestrates viewports, ticker loop, view management.

  ui/
    SpectatorPicker.ts    ApplicationV2 searchable token list.
    MultiViewApp.ts       DOM overlay: chrome, text overlays, drag-drop.
    GMDashboard.ts        ApplicationV2 GM control centre.
    controls.ts           Scene controls, Token HUD, keybindings, indicator.

  sync/
    SyncBridge.ts         Binds Foundry document/canvas hooks to the managers.

  util/
    logger.ts  profiler.ts  math.ts
  types/
    foundry-shim.d.ts     Minimal ambient globals (we type only what we use).
    index.ts              Our own data types.
```

## Spectator vision — how POV actually works

Foundry builds the visibility mask each frame from the set of active **vision
sources**. A token becomes a vision source when `Token#_isVisionSource()` returns
true — normally only for tokens the current user owns/observes.

`VisionController` wraps that method (via lib-wrapper when available, else a
manual, fully-reversible prototype patch). While spectating token *T*:

- `T` always reports as a vision source → the client now sees from `T`.
- In **exclusive** mode every other token reports `false` → the view is exactly
  `T`'s POV, so a spectator who happens to own other tokens gains no extra
  information. This is the anti-cheat guarantee.

Everything downstream — lighting, darkness, darkvision, blindsight/truesight,
vision mode, fog — is derived by core from `T`'s own sight configuration once it
is a vision source. We deliberately do **not** reimplement any of it.

Teardown always restores the original method, so the client is never left in a
patched state.

## MultiView — the honest trade-off

The specification asks for many viewports, each with *independent* fog, lighting
and line-of-sight, rendered *simultaneously* and *for real* (no fakery).

The architectural reality of Foundry is:

1. There is **one** PIXI `Application` / WebGL context.
2. There is **one** global visibility/fog/lighting state, computed for "the
   current viewer". `canvas.effects`, `canvas.visibility` and `canvas.fog` are
   singletons.

Truly parallel, independent fog for N viewports would require N independent
renderers each with a full copy of the scene graph and its own vision/lighting
pipeline — effectively forking Foundry's renderer. That is not something a module
can do without replacing core, and doing it badly (duplicating sprites, faking
screenshots) is exactly what the spec forbids.

### What we do instead: time-multiplexed true rendering

For each viewport we render the **real** `canvas.stage` — the actual lit, fogged,
occluded scene — into an **off-screen `RenderTexture`**, having transiently:

1. set the shared vision to that token's POV (`VisionController.setTarget`),
2. transformed the stage so the token's framing maps to the texture,

then we **restore** the stage synchronously within the same tick (before PIXI's
own render listener runs), so the main canvas is never disturbed. The texture is
shown by a sprite on the main app stage, which shares the renderer's GL context —
which is why we never spin up a second PIXI Application (isolated contexts cannot
share textures).

This is genuine rendering of the genuine scene from each POV. It is
**time-multiplexed** rather than truly parallel: the `RenderScheduler` renders
the primary viewport every eligible frame and cycles secondaries on an adaptive
cadence. Between captures a viewport shows its last real render (cached
visibility reuse), which is imperceptible while following.

This is the correct, honest answer to "independent POV per viewport on one GPU
context with one global scene state". The alternative approaches are either
impossible (parallel renderers) or forbidden (fakery).

### The one version-sensitive spot

Foundry's perception refresh is normally **debounced/async**, but an off-screen
capture needs vision recomputed **synchronously** before it renders.
`VisionController.forceRecompute()` calls the known synchronous entry points
(`canvas.visibility.refresh`, `canvas.effects.refreshVisibility`,
`refreshLighting`) with feature detection. If a future core version renames these,
a capture may show vision that is at most one frame stale — visually negligible —
and this is the first place a maintainer should look when validating against a new
core release. It is intentionally isolated to that one method.

### Efficiency choices

- The live scene is hidden (`canvas.stage.visible = false`) while MultiView owns
  the screen; the scene is only drawn during controlled captures. Captures force
  it visible transiently and restore.
- `RenderTexture`s are resized in place, not reallocated, on window drag.
- Capture resolution scales with performance mode (`renderScale`).
- Camera advance (cheap) runs for every viewport every frame; capture
  (expensive) is budgeted.

## Rendering data flow (per frame)

```
ticker → MultiViewManager.onTick
  ├─ visibleViewports()                 (page + solo aware)
  ├─ LayoutEngine.compute(...)          → rects, applied to sprites
  ├─ RenderScheduler.plan(...)          → { advance[], capture[] }
  ├─ for advance: Viewport.advanceCamera(dt)   (CameraController easing)
  ├─ for capture: Viewport.renderFrame()
  │      └─ SceneCapture.capture()
  │            ├─ VisionController.setTarget(token)   (POV)
  │            ├─ transform stage → render to RenderTexture
  │            └─ restore stage
  └─ throttled → emitFrame() → MultiViewApp DOM overlay update (~8 Hz)
```

## UI layering

MultiView splits imagery (GPU) from chrome (DOM):

- **PIXI sprites** on the main app stage carry the scene imagery.
- A **DOM overlay** (`MultiViewApp`) sits above the canvas and renders borders,
  text overlays, per-viewport toolbars, the control bar, and handles
  drag-and-drop. It updates at ~8 Hz, never per frame.

This keeps both fast and lets us use ordinary HTML/CSS for interaction and
accessibility while the GPU does the heavy pixels.

## Extension points

- **New overlay field** — add to `OVERLAY_FIELDS`, resolve it in
  `Viewport.computeOverlay`, render it in `MultiViewApp.updateOverlay`, and add a
  localization key.
- **New system HP/condition path** — extend the candidate lists in
  `Viewport.resolveHp` / `resolveConditions`.
- **New layout** — `LayoutEngine` is pure; add a branch and unit-test it.
- **New observe preset** — add a method to `MultiViewManager` and a button in the
  dashboard/control bar.
- **Alternative capture strategy** — `SceneCapture` is the single seam; a future
  core that exposes parallel renderers could be slotted in here without touching
  the rest.
