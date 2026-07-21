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

/** Per-token flag keys (all stored under {@link FLAG_SCOPE}). */
export const TOKEN_FLAGS = {
  /** When true, non-GM users may never spectate this token. */
  noSpectate: "noSpectate",
  /**
   * Per-token override for the "may NPCs be spectated" question. `true` forces
   * this NPC spectatable and `false` blocks it, each regardless of the world
   * {@link SETTINGS.allowNpcSpectate} default. Absent = follow the world default.
   */
  npcSpectatable: "npcSpectatable"
} as const;

/** Custom hooks other modules / macros can listen to. */
export const HOOKS = {
  spectateStart: `${MODULE_ID}.spectateStart`,
  spectateStop: `${MODULE_ID}.spectateStop`
} as const;

/** Every registered setting key. */
export const SETTINGS = {
  // Permissions
  permissionMode: "permissionMode",
  perPlayerPermissions: "perPlayerPermissions",
  allowNpcSpectate: "allowNpcSpectate",

  // Camera behaviour
  cameraMode: "cameraMode",
  followSpeed: "followSpeed",
  deadZone: "deadZone",
  zoomMemory: "zoomMemory",

  // Multi-scene
  crossSceneBehaviour: "crossSceneBehaviour",

  // Diagnostics
  debugLogging: "debugLogging"
} as const;

/** Permission modes for who may spectate what. */
export enum PermissionMode {
  GMOnly = "gm-only",
  OwnedOnly = "owned-only",
  PartyMembers = "party-members",
  AnyPlayerToken = "any-player-token",
  AnyToken = "any-token"
}

/**
 * Localization key for each mode's label. Single source of truth shared by the
 * settings `choices` map and the dashboard's per-player override dropdown, so
 * the two can never drift or fall back to showing raw enum values.
 */
export const PERMISSION_MODE_LABELS: Record<PermissionMode, string> = {
  [PermissionMode.GMOnly]: `${MODULE_ID}.settings.permissionMode.gmOnly`,
  [PermissionMode.OwnedOnly]: `${MODULE_ID}.settings.permissionMode.ownedOnly`,
  [PermissionMode.PartyMembers]: `${MODULE_ID}.settings.permissionMode.partyMembers`,
  [PermissionMode.AnyPlayerToken]: `${MODULE_ID}.settings.permissionMode.anyPlayerToken`,
  [PermissionMode.AnyToken]: `${MODULE_ID}.settings.permissionMode.anyToken`
};

/**
 * Sentinel `<option>` value meaning "no per-player override — follow the world
 * mode". Not a PermissionMode: it maps to deleting the override entirely.
 */
export const PERMISSION_DEFAULT = "default" as const;

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

/** CSS + DOM ids used by the UI layer. */
export const DOM = {
  /** The compact "you are spectating X" pill anchored above the hotbar. */
  spectateBar: `${MODULE_ID}-bar`
} as const;
