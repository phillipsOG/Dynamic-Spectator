# Changelog

All notable changes to Dynamic Spectator are documented here. This project
adheres to [Semantic Versioning](https://semver.org/).

## [2.1.6] - 2026-07-22

### Fixed

- The per-token ring button ignored "Only show ring options on hover" for
  whichever row was currently being spectated, always showing on that one row
  regardless of hover. Visibility now depends solely on the hover state, never
  on whether the token happens to be the one you are watching.

### Changed

- Reordered the picker row so the GM-only opt-out/NPC button sits to the left
  of the ring button, rather than between it and the trailing eye icon.
- Renamed the "Only show ring button on hover" setting to "Only show ring
  options on hover".

## [2.1.5] - 2026-07-22

### Added

- **"Only show ring button on hover"** - a new client setting, off by default,
  that reverts the per-token ring button (made always-visible in v2.1.4) back
  to appearing only on row hover, the same as the GM-only opt-out/NPC buttons.

## [2.1.4] - 2026-07-22

### Changed

- The picker's per-token ring button is now always visible, like the trailing
  eye state icon - it no longer needs a row hover to appear. Only the GM-only
  opt-out/NPC toggle buttons remain hover-revealed, since those are a much
  more occasional action.

## [2.1.3] - 2026-07-22

### Fixed

- The picker's settings button no longer sits behind an ellipsis dropdown -
  it is now a plain gear icon in the header, beside the close button, matching
  how it actually looks in Foundry's ApplicationV2 header rather than the
  collapsed `window.controls` menu.
- Clicking that button now opens Settings already scrolled to the Dynamic
  Spectator category, instead of leaving the player to find it themselves.
- Toggling "Customise ring per token" now shows/hides the picker's palette
  button immediately, without needing to close and reopen the picker. Client-
  scoped settings never reach the `updateSetting` hook the rest of the list's
  live-refresh relies on, so this fires from the setting's own `onChange`
  instead.

## [2.1.2] - 2026-07-22

### Added

- **Per-token ring customisation.** A new "Customise ring per token" setting
  (off by default) lets each user override the spectating ring's colour,
  opacity and thickness for individual tokens from the spectator picker,
  instead of only the global default.
- A settings shortcut (gear icon) in the spectator picker's window header,
  jumping straight to the module's configuration.
- A footer in the picker showing the installed module version.

### Changed

- The spectator picker's window title now reads "Dynamic Spectator" instead
  of "Spectate a Token".

## [2.1.1] - 2026-07-22

### Changed

- **Plain hyphens everywhere.** Replaced all 107 em and en dashes across the
  module with standard hyphens - source comments, docs, this changelog, the
  localization strings, and the manifest description shown on the module card
  in Foundry.

## [2.1.0] - 2026-07-22

### Added

- **The spectating ring is now yours to style.** Four new client-scoped
  settings - **Show the spectating ring**, **Ring colour**, **Ring opacity** and
  **Ring thickness** - replace what were hardcoded values. Colour uses a real
  swatch picker where core exposes `ColorField`, falling back to a `#rrggbb`
  text field otherwise. Changes repaint the live ring immediately rather than
  waiting for the next spectate. The ring was always local to each client, and
  still is, so these settings never affect what anyone else sees.

### Fixed

- **You can now zoom while spectating.** The camera lock was passing the scale
  back to `canvas.pan()` on every tick, so a wheel zoom was overwritten within a
  frame and the view snapped back. The lock now owns *position only* and omits
  scale entirely, leaving zoom to the user for the whole session.
- **"Keep my zoom level" did nothing.** Both branches of its ternary returned
  the same value, so the setting had no effect whichever way it was set. It now
  does what it says: on (the default) starts the session at the zoom you were
  already using; off re-frames once to 100%. Either way zoom is free once
  spectating - the setting only decides the starting framing.

## [2.0.2] - 2026-07-21

### Fixed

- **Permission changes now refresh an open picker.** A GM changing the
  permission mode, a per-player override, or the "Allow spectating NPC tokens"
  world setting left every player's open picker showing the old list. It now
  refreshes on `updateSetting` for any setting in the module's namespace -
  those are all permission settings, and permissions decide which rows a user
  may see at all.
- **Per-token opt-out and NPC overrides now refresh it too.** Both are stored as
  token flags, and flag updates were not in the set of changes that triggered a
  re-render - so a GM toggling one changed nothing on a player's screen until
  they reopened the window. The check is scoped to the module's own flag
  namespace, so another module's flag churn does not re-render us.

## [2.0.1] - 2026-07-21

### Fixed

- **The spectator picker's token list is now live.** Tokens the GM added (or
  removed) after the picker was opened did not appear until it was closed and
  reopened. It now re-renders on `createToken` / `deleteToken`, on `updateToken`
  for the fields a row actually displays (name, portrait, elevation,
  disposition, hidden, ownership), on `updateActor`, and on scene change.
  Updates are debounced, and token *movement* is deliberately excluded - it
  fires constantly and changes nothing in the list. A refresh landing while you
  type preserves the search box's focus and caret.
- **The picker and dashboard could each open twice.** Their "already open?"
  check searched `ui.windows`, which is the ApplicationV1 registry -
  ApplicationV2 windows are never in it, so the check always missed and a second
  instance was created with a duplicate DOM id. Each app now keeps its own
  instance handle, cleared on close.

## [2.0.0] - 2026-07-21

### Removed

- **MultiView.** The dynamic multi-camera system is gone: the viewport grid, the
  layout and grouping engines, off-screen scene capture, the render scheduler,
  the streaming mode, the per-viewport overlays, and the observe presets. It was
  the most expensive and most core-version-fragile part of the module, and
  spectating a single token is what the module is actually for. Removing it cuts
  the bundle roughly in half and drops every GPU-side moving part.
- With it go the settings `maxCameras`, `autoGrouping`, `elevationThreshold`,
  `groupingDistance`, `viewportPadding`, `overlayFields`, `streamingMode`,
  `transitionSpeed`, `performanceMode`, `renderScale`, `frameRateCap`,
  `secondaryCadence` and `profiling`; the **Shift+M** keybinding and the grid
  scene-control tool; the dashboard's observe presets and diagnostics readout;
  the API methods `openMultiView`, `closeMultiView`, `toggleMultiView`,
  `addView`, `observeParty`, `observeAuto`, `managers.multiview`,
  `managers.multiviewApp` and `profiler`; and the hooks `multiViewOpen`,
  `multiViewClose` and `viewportsChanged`. Stale settings are simply ignored by
  core, so no migration is needed.

### Added

- **Spectating bar.** A small pill above the hotbar names the token you are
  watching and shows the `Esc` affordance; clicking it stops spectating. It
  replaces the per-spectate toast notification, which fired on every retarget.

### Changed

- **Escape now reliably stops spectating.** The keybinding registers at
  `KEYBINDING_PRECEDENCE.PRIORITY` so it beats core's own Escape handler, and it
  only consumes the key while a session is actually live - Escape still closes
  windows and deselects tokens the rest of the time.
- **Slimmer spectator picker.** Narrower (264px) with compact rows: the row
  itself is the spectate/stop target, the "Add to MultiView" button is gone, and
  the GM's opt-out / NPC buttons only appear on hover. Rows are keyboard
  operable (Tab, then Enter or Space).
- **Slimmer GM dashboard**, now just the player list and permission overrides.

### Fixed

- **The dashboard's per-player permission dropdown showed the wrong value.** It
  never marked an option `selected`, so a stored override always displayed as
  "default" and a GM had no way to see which players had one. The selected
  option is now resolved in `_prepareContext` (core ships no `eq` Handlebars
  helper), and an override left behind by an older version that no longer maps
  to a known mode falls back to "default" instead of showing an arbitrary
  option.
- **The dropdown listed raw enum values** ("gm-only", "owned-only", …) rather
  than the localized labels that already existed for the world setting. Both now
  read from one `PERMISSION_MODE_LABELS` map so they cannot drift.
- **Changing the dropdown could save a stale value.** It was dispatched through
  ApplicationV2's action map, which fires on `click` - i.e. as the dropdown
  opens, before a new option is picked. It now listens for `change`.

## [1.1.0] - 2026-07-21

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
  NPC rows), overriding the world default either way - handy for a familiar,
  companion, or a plot NPC the party is meant to follow. NPC rows are badged.

### Fixed / Changed

- **Height-aware roof reveal while spectating.** Spectating a token that is
  inside a building or on an upper floor now reveals the overhead / roof tiles
  above it instead of showing the rooftop. Implemented with a reversible
  `TokenLayer#_getOccludableTokens` wrapper (lib-wrapper when present, manual
  fallback otherwise) that adds the spectated token to core's occlusion subject
  set - so FADE, RADIAL and VISION occlusion modes all reveal correctly, the
  reveal follows the token up and down floors, and in exclusive POV mode only
  the spectated token drives occlusion (no information leak). Occlusion is
  restored exactly on stop.

## [1.0.1] - 2026-07-21

### Fixed / Changed

- Player-level users: made the scene-control tools (Spectator picker, MultiView)
  render reliably for non-GM users, with explicit `visible:true`, distinct tool
  `order` values, and v12-array / v13-record handling. Only the extra GM
  dashboard tool is role-gated; the base tools are available to everyone.
- Hardened the boot sequence: each phase (settings, controls, managers, sync) and
  each control registration now runs in an isolated guard, so a failure in one -
  or a core API change on a given Foundry build - is clearly logged (with the
  user's GM flag) and can never silently take the whole module down for a user.
  Keybindings and the Token HUD button remain available even if scene controls
  ever fail.
- Startup logging now reports the user name and GM flag to make role-specific
  issues diagnosable from the browser console.

### Packaging

- `download` now points at the `v1.0.1` tag archive.

## [1.0.0] - 2026-07-21

Initial release.

### Added

- **Universal Spectator Mode** - spectate any token you are permitted to, with
  its true vision, lighting, darkness, fog, elevation and vision mode, via a
  reversible `Token#_isVisionSource` wrapper (lib-wrapper when present, manual
  fallback otherwise). Exclusive POV clamp prevents information leaks.
- Camera lock + follow with Smooth / Snap / Interpolate / Dead-zone modes,
  framerate-independent smoothing, and camera restore on release.
- **Dynamic MultiView** - multiple simultaneous token perspectives rendered via
  time-multiplexed off-screen `RenderTexture` captures of the real scene, with a
  primary/secondary render-priority scheduler and adaptive degradation.
- Adaptive CCTV-style layout engine (1 / 2 / 3 / 4 / 5-9 / paginated), aspect
  aware (16:9, 21:9 ultrawide, portrait), live window-resize handling.
- Height-aware grouping engine (elevation bands + distance clustering) powering
  auto view creation and "observe this elevation".
- Per-viewport overlays: character/player name, HP, conditions, elevation,
  distance, scene, and a movement direction indicator - all configurable.
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
