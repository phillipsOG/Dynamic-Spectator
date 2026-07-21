# Developer guide

## Prerequisites

- Node 18+ (developed on Node 25), npm.
- A Foundry VTT install (v12 or v13) for runtime testing.
- Optional: **lib-wrapper** module in your test world.

## Build & workflow

```bash
npm install
npm run build       # tsc --noEmit  +  esbuild bundle → dist/dynamic-spectator.js
npm run build:fast  # esbuild only (skip type-check)
npm run watch       # rebuild on change
npm run typecheck   # tsc --noEmit
npm run lint
npm run format
npm run link -- "C:/Users/you/AppData/Local/FoundryVTT/Data"   # symlink into Foundry
```

The manifest points `esmodules` at `dist/dynamic-spectator.js`, so you must build
before Foundry can load the module. Use `watch` + `link` for a fast loop (reload
Foundry with F5 after each rebuild).

## Type strategy

We deliberately do **not** depend on the community Foundry type packages. They
are large, version-sensitive, and often lag core. Instead
`src/types/foundry-shim.d.ts` declares only the slice of the runtime we touch,
loosely where core is sprawling. The goal is catching *our* mistakes, not
modelling all of Foundry. `tsconfig.json` uses `skipLibCheck` and `"types": []`
so nothing else leaks in.

If you use a core API not yet in the shim, add a minimal declaration there rather
than reaching for `any` at the call site — it keeps call sites honest.

## Boot sequence

- **init** — `registerSettings`, `registerAllControls` (keybindings, scene
  controls, Token HUD, indicator), preload templates.
- **setup** — construct `SpectatorManager`, `MultiViewManager`, `MultiViewApp`;
  publish the API onto `game.modules.get("dynamic-spectator").api` and
  `globalThis.DynamicSpectator`.
- **ready** — `registerSyncHooks`; fire `dynamic-spectator.ready`.

## Settings reference

| Key | Scope | Default | Notes |
| --- | --- | --- | --- |
| `permissionMode` | world | owned-only | Who may spectate. |
| `perPlayerPermissions` | world | `{}` | Managed via the dashboard. |
| `maxCameras` | client | 4 | Live viewports per page. |
| `autoGrouping` | client | true | Height/distance grouping on auto-observe. |
| `elevationThreshold` | world | 5 | "Same floor" band size. |
| `groupingDistance` | world | 60 | Grid units for distance clustering. |
| `viewportPadding` | client | 6 | Grid gap (0 in streaming). |
| `overlayFields` | client | name+hp+elev | Per-field visibility object. |
| `streamingMode` | client | false | Clean borderless output. |
| `cameraMode` | client | smooth | smooth/snap/interpolate/dead-zone. |
| `followSpeed` | client | 0.6 | Easing responsiveness. |
| `transitionSpeed` | client | 0.5 | Layout/transition speed. |
| `deadZone` | client | 0.2 | Dead-zone fraction. |
| `zoomMemory` | client | true | Independent per-viewport zoom. |
| `performanceMode` | client | balanced | quality/balanced/performance/battery. |
| `renderScale` | client | 1.0 | Capture resolution multiplier. |
| `frameRateCap` | client | 60 | Capture FPS ceiling. |
| `secondaryCadence` | client | 2 | Recapture secondaries every N frames. |
| `crossSceneBehaviour` | client | prompt | prompt/follow/drop. |
| `debugLogging` | client | false | Verbose console. |
| `profiling` | client | false | Timing + FPS readout. |

## Public API

See the README for the full surface. Everything routes through the managers in
`state.ts`; the API is a thin, stable wrapper so internal refactors don't break
consumers.

## Custom hooks

| Hook | Payload |
| --- | --- |
| `dynamic-spectator.spectateStart` | `{ tokenId, exclusive }` |
| `dynamic-spectator.spectateStop` | `{ tokenId }` |
| `dynamic-spectator.multiViewOpen` | `{ count }` |
| `dynamic-spectator.multiViewClose` | `{}` |
| `dynamic-spectator.viewportsChanged` | `{ count }` |
| `dynamic-spectator.ready` | the API object |

## Adding a feature — worked examples

**A new overlay field ("speed"):**
1. Add `"speed"` to `OVERLAY_FIELDS` in `constants.ts`.
2. Resolve it in `Viewport.computeOverlay` (read from `token.actor.system`).
3. Render it in `MultiViewApp.updateOverlay` behind `fields.speed`.
4. Add `overlay`/localization keys.

**Support a new system's HP:**
- Add its path to the `candidates` array in `Viewport.resolveHp`.

**A new layout for exactly 6 views:**
- Add a branch in `LayoutEngine.compute` and a unit test in `layout.test.ts`.

## Release

1. Bump `version` in `module.json`, `package.json`, and the API `version`.
2. Update `CHANGELOG.md`.
3. `npm run build`.
4. Zip `module.json`, `dist/`, `styles/`, `templates/`, `lang/`, `assets/` as
   `module.zip`; attach to a GitHub release matching the `download` URL.

## Future extension points

- Socket-driven "force spectate this player's screen" (the socket + payload types
  already exist in `types/index.ts`; wire a handler in a `SocketBridge`).
- Persisted per-token fog history for spectators (needs a per-token fog store;
  core only keeps per-user fog today).
- A parallel-renderer capture strategy if a future core exposes multiple render
  contexts — slot it into `SceneCapture` behind the same interface.
