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
than reaching for `any` at the call site - it keeps call sites honest.

## Boot sequence

- **init** - `registerSettings`, `registerAllControls` (keybindings, scene
  controls, Token HUD, indicator), preload templates.
- **setup** - construct `SpectatorManager`; publish the API onto
  `game.modules.get("dynamic-spectator").api` and `globalThis.DynamicSpectator`.
- **ready** - `registerSyncHooks`; fire `dynamic-spectator.ready`.

## Settings reference

| Key | Scope | Default | Notes |
| --- | --- | --- | --- |
| `permissionMode` | world | any-player-token | Who may spectate. |
| `perPlayerPermissions` | world | `{}` | Managed via the dashboard. |
| `allowNpcSpectate` | world | false | World default for the NPC axis. |
| `cameraMode` | client | smooth | smooth/snap/interpolate/dead-zone. |
| `followSpeed` | client | 0.6 | Easing responsiveness. |
| `deadZone` | client | 0.2 | Dead-zone fraction. |
| `zoomMemory` | client | true | Start at your current zoom; off re-frames to 100%. |
| `indicatorEnabled` | client | true | Draw the spectating ring at all. |
| `indicatorColor` | client | `#8ab4ff` | ColorField where available, else a hex string. |
| `indicatorOpacity` | client | 0.9 | Ring alpha, 0-1. |
| `indicatorWidth` | client | 3 | Ring stroke width in px. |
| `crossSceneBehaviour` | client | prompt | prompt/follow/drop. |
| `debugLogging` | client | false | Verbose console. |

## Keybindings

| Action | Default | Notes |
| --- | --- | --- |
| `quickSpectate` | **V** | Hovered → controlled → targeted token, else picker. |
| `openPicker` | **Shift+V** | |
| `stopSpectate` | **Escape** | Registered at `KEYBINDING_PRECEDENCE.PRIORITY` so it beats core's Escape, but returns `false` when no session is live so core's behaviour is untouched the rest of the time. |
| `openDashboard` | **Shift+D** | `restricted: true` (GM only). |

## Public API

See the README for the full surface. Everything routes through the manager in
`state.ts`; the API is a thin, stable wrapper so internal refactors don't break
consumers.

## Custom hooks

| Hook | Payload |
| --- | --- |
| `dynamic-spectator.spectateStart` | `{ tokenId, exclusive }` |
| `dynamic-spectator.spectateStop` | `{ tokenId }` |
| `dynamic-spectator.ready` | the API object |

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
