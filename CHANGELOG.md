# Changelog

All notable changes to Dynamic Spectator are documented here. This project
adheres to [Semantic Versioning](https://semver.org/).

## [1.1.0] — 2026-07-21

### Added

- **Spectate any player token by default.** The default permission mode is now
  "any player-owned token", so players can spectate each other's characters out
  of the box rather than only tokens they personally own. GMs can still tighten
  this (owned only / party / GM only) or widen it (any token) in settings, and
  per-player overrides still apply.
- **NPC spectate toggle.** A new world setting, **Allow spectating NPC tokens**
  (off by default), governs whether NPC (non-player-owned) tokens may be
  spectated at all. NPCs are a separate axis from the mode ladder, so enabling
  player-token spectating never exposes NPC perspectives unless you opt in.
- **Per-token NPC override.** From the spectator picker a GM can force a single
  NPC spectatable or non-spectatable (a `user-check` / `user-slash` toggle on
  NPC rows), overriding the world default either way — handy for a familiar,
  companion, or a plot NPC the party is meant to follow. NPC rows are badged.

### Fixed / Changed

- **Height-aware roof reveal while spectating.** Spectating a token that is
  inside a building or on an upper floor now reveals the overhead / roof tiles
  above it instead of showing the rooftop. Implemented with a reversible
  `TokenLayer#_getOccludableTokens` wrapper (lib-wrapper when present, manual
  fallback otherwise) that adds the spectated token to core's occlusion subject
  set — so FADE, RADIAL and VISION occlusion modes all reveal correctly, the
  reveal follows the token up and down floors, and in exclusive POV mode only
  the spectated token drives occlusion (no information leak). Occlusion is
  restored exactly on stop.

## [1.0.1] — 2026-07-21

### Fixed / Changed

- Player-level users: made the scene-control tools (Spectator picker, MultiView)
  render reliably for non-GM users, with explicit `visible:true`, distinct tool
  `order` values, and v12-array / v13-record handling. Only the extra GM
  dashboard tool is role-gated; the base tools are available to everyone.
- Hardened the boot sequence: each phase (settings, controls, managers, sync) and
  each control registration now runs in an isolated guard, so a failure in one —
  or a core API change on a given Foundry build — is clearly logged (with the
  user's GM flag) and can never silently take the whole module down for a user.
  Keybindings and the Token HUD button remain available even if scene controls
  ever fail.
- Startup logging now reports the user name and GM flag to make role-specific
  issues diagnosable from the browser console.

### Packaging

- `download` now points at the `v1.0.1` tag archive.

## [1.0.0] — 2026-07-21

Initial release.

### Added

- **Universal Spectator Mode** — spectate any token you are permitted to, with
  its true vision, lighting, darkness, fog, elevation and vision mode, via a
  reversible `Token#_isVisionSource` wrapper (lib-wrapper when present, manual
  fallback otherwise). Exclusive POV clamp prevents information leaks.
- Camera lock + follow with Smooth / Snap / Interpolate / Dead-zone modes,
  framerate-independent smoothing, and camera restore on release.
- **Dynamic MultiView** — multiple simultaneous token perspectives rendered via
  time-multiplexed off-screen `RenderTexture` captures of the real scene, with a
  primary/secondary render-priority scheduler and adaptive degradation.
- Adaptive CCTV-style layout engine (1 / 2 / 3 / 4 / 5–9 / paginated), aspect
  aware (16:9, 21:9 ultrawide, portrait), live window-resize handling.
- Height-aware grouping engine (elevation bands + distance clustering) powering
  auto view creation and "observe this elevation".
- Per-viewport overlays: character/player name, HP, conditions, elevation,
  distance, scene, and a movement direction indicator — all configurable.
- View management: primary, pin, collapse, solo/fullscreen, drag-and-drop
  reorder/swap, pagination.
- Streaming mode (clean, borderless, minimal UI) for OBS capture.
- GM Dashboard with observe presets, per-player spectate and permission
  overrides, and a live diagnostics readout.
- Searchable spectator picker, Token HUD button, scene-control tools, and
  keybindings (quick spectate, open picker, toggle MultiView, stop, dashboard).
- Cross-scene follow (prompt / follow / drop) by actor identity.
- Configurable permission model (GM only → owned → party → any player → any),
  per-token opt-out and per-player overrides.
- Public API on `game.modules.get("dynamic-spectator").api` and custom hooks.
- Performance profiler with rolling FPS and per-label timing, gated behind a
  setting.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design and its honest
trade-offs.
