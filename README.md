# Dynamic Spectator

A Foundry VTT module that lets any client **spectate any token** with that
token's true vision, lighting and fog.

> Foundry v12 minimum, verified on **v13**. TypeScript, ES modules, bundled with
> esbuild.

---

## Features

- Spectate any token you are permitted to (configurable — see Permissions).
- Camera **locks and follows** the token; live updates on every move.
- Inherits the token's **vision, lighting, darkness, fog, elevation, vision mode,
  darkvision, and system-provided senses** (blindsight/truesight) — because the
  token becomes a real vision source, core computes all of this for you.
- **Exclusive POV clamp**: you never see more than that token legitimately could,
  even if you own other tokens. Spectating is not a cheat.
- **Height-aware**: roofs and overhead tiles above the spectated token are
  revealed, so you see inside the building or on the upper floor rather than the
  rooftop — and it keeps up as the token changes elevation.
- Camera modes: Smooth, Snap, Interpolate, Dead-zone. Framerate-independent.
- A compact **spectating bar** above the hotbar names who you are watching and
  carries the way out; **Escape** (or clicking the bar) ends the session.
- Visual "spectating" ring on the active token.

### GM Dashboard

Per-player row: spectate that player's character, or set a per-player permission
override without opening the settings sheet.

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
npm run link -- "C:/Users/you/AppData/Local/FoundryVTT/Data"
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
| Stop spectating | **Escape**, click the spectating bar, or the Token HUD button |
| Open GM Dashboard | **Shift+D** (GM only), or the video tool |
| Spectate from a token | Right-click a token → the eye button in the Token HUD |

In the picker, click a row to start spectating it; click the current row (or hit
Escape) to stop. Escape only takes over while a session is live, so it still
closes windows and deselects tokens the rest of the time. All keybindings are
rebindable in **Configure Controls**.

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

---

## Settings (summary)

Who may spectate · Allow spectating NPC tokens · Camera mode / follow speed /
dead-zone / keep my zoom · Cross-scene behaviour · Debug logging.

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

ds.managers.spectator;         // SpectatorManager, for power users
ds.settings();                 // resolved, typed settings snapshot
```

Custom hooks: `dynamic-spectator.spectateStart`, `.spectateStop`, `.ready`.

---

## Compatibility & limitations

- **No core files are modified.** All integration is via hooks and two single,
  reversible prototype wrappers (`Token#_isVisionSource` for POV and the token
  occlusion path for roof reveal).
- Foundry keeps a *single* global fog/vision state, so exactly one token is
  spectated at a time on a given client. Starting a new spectate retargets the
  existing session rather than opening a second one.
- The vision-recompute path is the most core-version-sensitive area; it is
  feature-detected and documented for maintainers. See
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Development

```bash
npm run watch      # rebuild on change
npm run typecheck  # tsc --noEmit
npm run lint
```

Docs: [Architecture](docs/ARCHITECTURE.md) · [Testing](docs/TESTING.md) ·
[Developer guide](docs/DEVELOPER.md) · [Install](docs/INSTALL.md).

## License

MIT — see [LICENSE](LICENSE).
