# Changelog

All notable changes to Dynamic Spectator are documented here. This project
adheres to [Semantic Versioning](https://semver.org/).

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
