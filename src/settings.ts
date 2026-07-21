/**
 * Registration and typed resolution of every module setting.
 *
 * All settings live under the module namespace. `registerSettings()` runs once
 * during `init`. `getSettings()` returns a fully-resolved, typed snapshot used
 * throughout the codebase so no other file ever calls `game.settings.get`
 * directly with a stringly-typed key.
 */

import {
  CameraMode,
  CrossSceneBehaviour,
  MODULE_ID,
  PERMISSION_MODE_LABELS,
  PermissionMode,
  SETTINGS
} from "./constants.js";
import type { ResolvedSettings } from "./types/index.js";
import { log } from "./util/logger.js";

const L = (key: string): string => `dynamic-spectator.settings.${key}`;

export function registerSettings(): void {
  // No setting needs live re-application: permissions are consulted per action
  // and the camera config is read fresh at the start of each spectate session.
  // ---- Permissions ---------------------------------------------------------
  game.settings.register(MODULE_ID, SETTINGS.permissionMode, {
    name: L("permissionMode.name"),
    hint: L("permissionMode.hint"),
    scope: "world",
    config: true,
    type: String,
    default: PermissionMode.AnyPlayerToken,
    choices: { ...PERMISSION_MODE_LABELS }
  });

  // Per-player overrides: { [userId]: PermissionMode }. Managed via the dashboard.
  game.settings.register(MODULE_ID, SETTINGS.perPlayerPermissions, {
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  // Whether NPC (non-player-owned) tokens may be spectated at all. Off by default
  // so players only ever see each other's perspectives unless the GM opts in.
  // A per-token flag (TOKEN_FLAGS.npcSpectatable) can override this either way.
  game.settings.register(MODULE_ID, SETTINGS.allowNpcSpectate, {
    name: L("allowNpcSpectate.name"),
    hint: L("allowNpcSpectate.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  // ---- Camera behaviour ----------------------------------------------------
  game.settings.register(MODULE_ID, SETTINGS.cameraMode, {
    name: L("cameraMode.name"),
    hint: L("cameraMode.hint"),
    scope: "client",
    config: true,
    type: String,
    default: CameraMode.Smooth,
    choices: {
      [CameraMode.Smooth]: L("cameraMode.smooth"),
      [CameraMode.Snap]: L("cameraMode.snap"),
      [CameraMode.Interpolate]: L("cameraMode.interpolate"),
      [CameraMode.DeadZone]: L("cameraMode.deadZone")
    }
  });

  game.settings.register(MODULE_ID, SETTINGS.followSpeed, {
    name: L("followSpeed.name"),
    hint: L("followSpeed.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 0.05, max: 1, step: 0.05 },
    default: 0.6
  });

  game.settings.register(MODULE_ID, SETTINGS.deadZone, {
    name: L("deadZone.name"),
    hint: L("deadZone.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 0, max: 0.9, step: 0.05 },
    default: 0.2
  });

  game.settings.register(MODULE_ID, SETTINGS.zoomMemory, {
    name: L("zoomMemory.name"),
    hint: L("zoomMemory.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  // ---- Multi-scene ---------------------------------------------------------
  game.settings.register(MODULE_ID, SETTINGS.crossSceneBehaviour, {
    name: L("crossSceneBehaviour.name"),
    hint: L("crossSceneBehaviour.hint"),
    scope: "client",
    config: true,
    type: String,
    default: CrossSceneBehaviour.Prompt,
    choices: {
      [CrossSceneBehaviour.Prompt]: L("crossSceneBehaviour.prompt"),
      [CrossSceneBehaviour.Follow]: L("crossSceneBehaviour.follow"),
      [CrossSceneBehaviour.Drop]: L("crossSceneBehaviour.drop")
    }
  });

  // ---- Diagnostics ---------------------------------------------------------
  game.settings.register(MODULE_ID, SETTINGS.debugLogging, {
    name: L("debugLogging.name"),
    hint: L("debugLogging.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });

  log.debug("settings registered");
}

/** Read a setting defensively (returns the provided fallback on any error). */
function read<T>(key: string, fallback: T): T {
  try {
    const v = game.settings.get(MODULE_ID, key);
    return (v === undefined || v === null ? fallback : v) as T;
  } catch {
    return fallback;
  }
}

/** Resolve every setting into a single typed object. Cheap enough to call per open. */
export function getSettings(): ResolvedSettings {
  return {
    permissionMode: read<PermissionMode>(SETTINGS.permissionMode, PermissionMode.AnyPlayerToken),
    allowNpcSpectate: read<boolean>(SETTINGS.allowNpcSpectate, false),
    camera: {
      mode: read<CameraMode>(SETTINGS.cameraMode, CameraMode.Smooth),
      followSpeed: read<number>(SETTINGS.followSpeed, 0.6),
      deadZone: read<number>(SETTINGS.deadZone, 0.2),
      zoomMemory: read<boolean>(SETTINGS.zoomMemory, true),
      followRotation: false
    },
    crossSceneBehaviour: read<string>(SETTINGS.crossSceneBehaviour, CrossSceneBehaviour.Prompt),
    debugLogging: read<boolean>(SETTINGS.debugLogging, false)
  };
}
