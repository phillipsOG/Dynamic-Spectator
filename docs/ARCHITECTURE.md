# Architecture

This document explains how Dynamic Spectator works and the layering of the code.

## Module map

```
src/
  module.ts              Boot sequence (init → setup → ready), public API.
  constants.ts           Ids, socket, flags, hook names, setting keys, enums.
  settings.ts            Registers every setting; getSettings() → typed snapshot.
  state.ts               Shared singleton holding the live manager.

  permissions/
    PermissionManager.ts  "May user U spectate token T?" + opt-out/overrides.

  spectator/
    VisionController.ts     The reversible Token#_isVisionSource wrapper (POV).
    OcclusionController.ts  Reversible TokenLayer#_getOccludableTokens wrapper
                            (reveals roofs above the spectated token; height-aware).
    CameraLock.ts           Main-canvas camera lock/follow.
    SpectatorManager.ts     Orchestrates permission + vision + occlusion + camera.

  ui/
    SpectatorPicker.ts    ApplicationV2 searchable token list.
    GMDashboard.ts        ApplicationV2 GM control centre.
    SpectateBar.ts        The "spectating X · Esc" pill shown during a session.
    controls.ts           Scene controls, Token HUD, keybindings, indicator.

  sync/
    SyncBridge.ts         Binds Foundry document/canvas hooks to the manager.

  util/
    logger.ts  math.ts
  types/
    foundry-shim.d.ts     Minimal ambient globals (we type only what we use).
    index.ts              Our own data types.
```

## Spectator vision - how POV actually works

Foundry builds the visibility mask each frame from the set of active **vision
sources**. A token becomes a vision source when `Token#_isVisionSource()` returns
true - normally only for tokens the current user owns/observes.

`VisionController` wraps that method (via lib-wrapper when available, else a
manual, fully-reversible prototype patch). While spectating token *T*:

- `T` always reports as a vision source → the client now sees from `T`.
- In **exclusive** mode every other token reports `false` → the view is exactly
  `T`'s POV, so a spectator who happens to own other tokens gains no extra
  information. This is the anti-cheat guarantee.

Everything downstream - lighting, darkness, darkvision, blindsight/truesight,
vision mode, fog - is derived by core from `T`'s own sight configuration once it
is a vision source. We deliberately do **not** reimplement any of it.

Teardown always restores the original method, so the client is never left in a
patched state.

## Why one token at a time

Foundry has one PIXI `Application` / WebGL context and **one** global
visibility/fog/lighting state, computed for "the current viewer" -
`canvas.effects`, `canvas.visibility` and `canvas.fog` are singletons. There is
therefore exactly one POV per client at any moment. `SpectatorManager.start()`
retargets a live session instead of stacking a second one, which is why
retargeting is flicker-free: `VisionController.setTarget` swaps the POV token
without tearing the wrapper down and back up.

## The one version-sensitive spot

Foundry's perception refresh is normally **debounced/async**.
`VisionController.forceRecompute()` calls the known synchronous entry points
(`canvas.visibility.refresh`, `canvas.effects.refreshVisibility`,
`refreshLighting`) with feature detection so a retarget lands immediately. If a
future core version renames these, the POV may be at most one frame stale -
visually negligible - and this is the first place a maintainer should look when
validating against a new core release. It is intentionally isolated to that one
method.

## Session flow

```
start(tokenId)
  ├─ PermissionManager.canSpectate(user, token)   → deny + notify, or continue
  ├─ VisionController.activate(token, exclusive)  → POV wrapper + recompute
  ├─ OcclusionController.activate(token)          → reveal roofs above the token
  ├─ CameraLock.lock / retarget(token)            → ticker-driven follow
  ├─ SpectateBar.show(name)                       → on-screen pill + Esc hint
  └─ Hooks.callAll("dynamic-spectator.spectateStart")

stop()
  └─ the exact inverse, in reverse order; camera pans back to where you were.
```

`SyncBridge` keeps that session honest against the world: token movement and
vision changes refresh the POV, deletion or a revoked permission stops it, and a
scene change prompts / follows / drops per `crossSceneBehaviour`.

## UI layering

All chrome is ordinary DOM:

- **SpectatorPicker** and **GMDashboard** are ApplicationV2 + Handlebars windows.
- **SpectateBar** is a fixed-position element on `<body>`; it measures `#hotbar`
  once at mount and parks itself just above it, so its placement never depends
  on how a given core version lays out `#ui-bottom`.
- The only PIXI we draw is the pulsing ring on the spectated token
  (`controls.ts`), added as a child of the token itself.

## Extension points

- **New permission rule** - `PermissionManager.canSpectate` is the single
  decision point and returns a machine-readable `reason` for the UI.
- **New camera behaviour** - add a `CameraMode` and a branch in
  `CameraLock.onTick`; `smoothingFactor` keeps it framerate-independent.
- **Socket-driven "force spectate"** - the payload types already exist in
  `types/index.ts`; wire a handler in a new `SocketBridge`.
