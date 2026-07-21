# Dynamic Spectator

A Foundry VTT module that lets any client **spectate any token** with that
token's true vision, lighting and fog — and adds a **dynamic multi-camera
(MultiView)** system that renders several player perspectives at once, CCTV /
NVR-style, with an adaptive layout engine and a streaming mode.

> Foundry v12 minimum, verified on **v13**. TypeScript, ES modules, bundled with
> esbuild.

---

## Features

### Universal Spectator Mode
- Spectate any token you are permitted to (configurable — see Permissions).
- Camera **locks and follows** the token; live updates on every move.
- Inherits the token's **vision, lighting, darkness, fog, elevation, vision mode,
  darkvision, and system-provided senses** (blindsight/truesight) — because the
  token becomes a real vision source, core computes all of this for you.
- **Exclusive POV clamp**: you never see more than that token legitimately could,
  even if you own other tokens. Spectating is not a cheat.
- Camera modes: Smooth, Snap, Interpolate, Dead-zone. Framerate-independent.
- Visual "spectating" ring on the active token.

### Dynamic MultiView
- Multiple independent viewports, each with its **own camera, zoom, follow mode,
  POV vision, and token tracking**.
- **Adaptive layout** (professional CCTV feel): full screen → split → featured →
  2×2 → adaptive grid → pagination. Aspect-aware for 16:9, 21:9 ultrawide and
  portrait monitors; re-tiles live on window resize.
- **Height awareness**: characters near the same elevation are grouped first, so
  "observe the ground floor" shows the Fighter + Rogue, not the upstairs Wizard.
- **Primary view**: largest tile, highest render priority, smoothest updates.
  Secondaries use adaptive cadence to protect performance.
- View management: primary, pin, collapse, **solo/fullscreen**, **drag-and-drop**
  reorder/swap, pagination.
- Per-viewport overlays (all optional): character name, player name, HP,
  conditions, elevation, distance, scene, and a movement **direction** arrow.
- **Streaming mode**: clean, borderless, minimal UI with soft transitions —
  built for OBS capture.

### GM Dashboard
- One-click observe presets: **Entire party**, **Combatants**, **NPCs**, and
  **this elevation** (uses your selected token's height).
- Per-player row: spectate their character, or set a per-player permission
  override.
- Live FPS / render-budget diagnostics.

---

## Installation

### From manifest (recommended)
In Foundry: **Add-on Modules → Install Module**, and paste:

```
https://raw.githubusercontent.com/phillipsOG/Dynamic-Spectator/main/module.json
```

### Manual / from source
```bash
git clone https://github.com/phillipsOG/Dynamic-Spectator.git
cd Dynamic-Spectator
npm install
npm run build          # type-checks then bundles to dist/dynamic-spectator.js
# link into your Foundry data dir for development:
FOUNDRY_DATA="C:/Users/you/AppData/Local/FoundryVTT/Data" npm run link
```

Then enable **Dynamic Spectator** in the module manager. **lib-wrapper** is
recommended but optional (the module falls back to a manual, fully-reversible
patch if it is absent).

---

## Usage

| Action | How |
| --- | --- |
| Quick spectate | Hover a token and press **V** (toggles) |
| Open the searchable picker | **Shift+V**, or the eye tool in the token controls |
| Stop spectating | **Escape** (or the Token HUD button) |
| Toggle MultiView | **Shift+M**, or the grid tool in the token controls |
| Open GM Dashboard | **Shift+D** (GM only), or the video tool |
| Spectate from a token | Right-click a token → the eye button in the Token HUD |

Inside MultiView: hover a viewport for its toolbar (primary ★, pin, solo,
zoom ±, collapse, remove), double-click to solo, drag one viewport onto another
to swap. The bottom control bar adds views, runs the observe presets, paginates,
and toggles streaming mode. All keybindings are rebindable in **Configure
Controls**.

---

## Permissions

Set **Who may spectate** in module settings:

| Mode | Meaning |
| --- | --- |
| GM only | Only the GM may spectate. |
| Owned only | Players spectate tokens they own. |
| Party members | Owned + any active player's owned tokens. |
| Any player token | Any token with a player owner **(default)**. |
| Any token | Anything on the scene, NPCs included (still POV-clamped). |

**NPC tokens** are a separate axis. They are only spectatable when **Allow
spectating NPC tokens** is enabled (off by default), so out of the box players
can spectate each other but not NPCs. Individual NPCs can be force-enabled or
force-disabled from the spectator picker (GM only), overriding the world
default either way.

Additional controls: **per-token opt-out** (GM sets a "no spectate" flag on
sensitive player tokens) and **per-player overrides** (Dashboard → Permission
column). The GM can always spectate.

Spectating is **height-aware**: overhead / roof tiles above the spectated token
are revealed so you see inside a building or on an upper floor rather than the
rooftop, following the token as it changes elevation.

---

## Settings (summary)

Permissions · Maximum simultaneous cameras · Automatic grouping · Elevation
threshold · Grouping distance · Viewport padding · Overlay fields · Streaming
mode · Camera mode / follow speed / dead-zone / zoom memory · Transition speed ·
Performance mode · Render scale · Frame-rate cap · Secondary camera cadence ·
Cross-scene behaviour · Debug logging · Profiling.

See [docs/DEVELOPER.md](docs/DEVELOPER.md) for the full list and defaults.

---

## Public API

```js
const ds = game.modules.get("dynamic-spectator").api;

ds.spectate(tokenId);          // spectate a token (exclusive POV by default)
ds.stopSpectate();
ds.toggleSpectate(tokenId);

ds.openPicker();
ds.openDashboard();            // GM only

ds.addView(tokenId);           // add a MultiView camera and open the overlay
ds.observeParty();             // auto-build the party view
ds.observeAuto();              // height-aware auto grouping
ds.toggleMultiView();

ds.managers.multiview;         // MultiViewManager, for power users
ds.profiler.report();          // timing samples (enable Profiling first)
```

Custom hooks: `dynamic-spectator.spectateStart`, `.spectateStop`,
`.multiViewOpen`, `.multiViewClose`, `.viewportsChanged`, `.ready`.

---

## Compatibility & limitations

- **No core files are modified.** All integration is via hooks and a single,
  reversible `Token#_isVisionSource` wrapper.
- MultiView renders the **real** scene per POV via time-multiplexed off-screen
  captures. Because Foundry keeps a *single* global fog/vision state, independent
  POVs are time-multiplexed, not truly parallel — the honest, correct approach on
  one GPU context. The primary viewport is live; secondaries update on an
  adaptive cadence. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- HP/condition overlays use system-agnostic resolvers with fallbacks (dnd5e,
  pf2e-style paths, generic `health`/`hp`). Unusual systems may need a small
  resolver addition — see the extension points in the docs.
- The per-capture vision-sync path is the most core-version-sensitive area; it is
  feature-detected and documented for maintainers.

---

## Development

```bash
npm run watch      # rebuild on change
npm run typecheck  # tsc --noEmit
npm run lint
```

Docs: [Architecture](docs/ARCHITECTURE.md) ·
[Performance](docs/PERFORMANCE.md) · [Testing](docs/TESTING.md) ·
[Developer guide](docs/DEVELOPER.md) · [Install](docs/INSTALL.md).

## License

MIT — see [LICENSE](LICENSE).
