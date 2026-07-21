/**
 * Module-wide constants: the module id, socket channel, flag scopes, hook names
 * this module emits, and the canonical list of setting keys.
 *
 * Keeping every string literal in one place avoids the classic "typo in a
 * settings key" bug and makes the settings surface auditable at a glance.
 */

export const MODULE_ID = "dynamic-spectator" as const;
export const MODULE_TITLE = "Dynamic Spectator" as const;
export const SOCKET = `module.${MODULE_ID}` as const;

/** Flag scope used for per-token / per-user persisted data. */
export const FLAG_SCOPE = MODULE_ID;

/** Custom hooks other modules / macros can listen to. */
export const HOOKS = {
  spectateStart: `${MODULE_ID}.spectateStart`,
  spectateStop: `${MODULE_ID}.spectateStop`,
  multiViewOpen: `${MODULE_ID}.multiViewOpen`,
  multiViewClose: `${MODULE_ID}.multiViewClose`,
  viewportsChanged: `${MODULE_ID}.viewportsChanged`
} as const;

/** Every registered setting key. */
export const SETTINGS = {
  // Permissions
  permissionMode: "permissionMode",
  perPlayerPermissions: "perPlayerPermissions",

  // MultiView core
  maxCameras: "maxCameras",
  autoGrouping: "autoGrouping",
  elevationThreshold: "elevationThreshold",
  groupingDistance: "groupingDistance",

  // Layout / overlay
  viewportPadding: "viewportPadding",
  overlayFields: "overlayFields",
  streamingMode: "streamingMode",

  // Camera behaviour
  cameraMode: "cameraMode",
  followSpeed: "followSpeed",
  transitionSpeed: "transitionSpeed",
  deadZone: "deadZone",
  zoomMemory: "zoomMemory",

  // Performance / rendering
  performanceMode: "performanceMode",
  renderScale: "renderScale",
  frameRateCap: "frameRateCap",
  secondaryCadence: "secondaryCadence",

  // Multi-scene
  crossSceneBehaviour: "crossSceneBehaviour",

  // Diagnostics
  debugLogging: "debugLogging",
  profiling: "profiling"
} as const;

/** Permission modes for who may spectate what. */
export enum PermissionMode {
  GMOnly = "gm-only",
  OwnedOnly = "owned-only",
  PartyMembers = "party-members",
  AnyPlayerToken = "any-player-token",
  AnyToken = "any-token"
}

/** Camera follow behaviour. */
export enum CameraMode {
  Smooth = "smooth",
  Snap = "snap",
  Interpolate = "interpolate",
  DeadZone = "dead-zone"
}

/** What to do when a tracked token leaves the current scene. */
export enum CrossSceneBehaviour {
  Prompt = "prompt",
  Follow = "follow",
  Drop = "drop"
}

/** Performance presets that scale render cadence / quality. */
export enum PerformanceMode {
  Quality = "quality",
  Balanced = "balanced",
  Performance = "performance",
  Battery = "battery"
}

/** Optional overlay fields keyed by id (see OverlayField). */
export const OVERLAY_FIELDS = [
  "characterName",
  "playerName",
  "hp",
  "conditions",
  "elevation",
  "distance",
  "statusEffects",
  "scene",
  "direction"
] as const;

export type OverlayField = (typeof OVERLAY_FIELDS)[number];

/** CSS + DOM ids used by the UI layer. */
export const DOM = {
  multiViewRoot: `${MODULE_ID}-multiview`,
  viewportClass: `${MODULE_ID}-viewport`,
  overlayClass: `${MODULE_ID}-overlay`,
  spectateIndicator: `${MODULE_ID}-spectating`
} as const;
