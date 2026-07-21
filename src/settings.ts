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
  OVERLAY_FIELDS,
  PerformanceMode,
  PermissionMode,
  SETTINGS
} from "./constants.js";
import type { OverlayField } from "./constants.js";
import type { ResolvedSettings } from "./types/index.js";
import { log } from "./util/logger.js";

const L = (key: string): string => `dynamic-spectator.settings.${key}`;

/** Default "all off except a sensible core set" overlay configuration. */
function defaultOverlayFields(): Record<OverlayField, boolean> {
  const base = {} as Record<OverlayField, boolean>;
  for (const f of OVERLAY_FIELDS) base[f] = false;
  base.characterName = true;
  base.hp = true;
  base.elevation = true;
  return base;
}

export function registerSettings(onChange?: () => void): void {
  const change = () => {
    try {
      onChange?.();
    } catch (err) {
      log.error("settings onChange handler failed", err);
    }
  };

  // ---- Permissions ---------------------------------------------------------
  game.settings.register(MODULE_ID, SETTINGS.permissionMode, {
    name: L("permissionMode.name"),
    hint: L("permissionMode.hint"),
    scope: "world",
    config: true,
    type: String,
    default: PermissionMode.OwnedOnly,
    choices: {
      [PermissionMode.GMOnly]: L("permissionMode.gmOnly"),
      [PermissionMode.OwnedOnly]: L("permissionMode.ownedOnly"),
      [PermissionMode.PartyMembers]: L("permissionMode.partyMembers"),
      [PermissionMode.AnyPlayerToken]: L("permissionMode.anyPlayerToken"),
      [PermissionMode.AnyToken]: L("permissionMode.anyToken")
    },
    onChange: change
  });

  // Per-player overrides: { [userId]: PermissionMode }. Managed via the dashboard.
  game.settings.register(MODULE_ID, SETTINGS.perPlayerPermissions, {
    scope: "world",
    config: false,
    type: Object,
    default: {},
    onChange: change
  });

  // ---- MultiView core ------------------------------------------------------
  game.settings.register(MODULE_ID, SETTINGS.maxCameras, {
    name: L("maxCameras.name"),
    hint: L("maxCameras.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 1, max: 16, step: 1 },
    default: 4,
    onChange: change
  });

  game.settings.register(MODULE_ID, SETTINGS.autoGrouping, {
    name: L("autoGrouping.name"),
    hint: L("autoGrouping.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: change
  });

  game.settings.register(MODULE_ID, SETTINGS.elevationThreshold, {
    name: L("elevationThreshold.name"),
    hint: L("elevationThreshold.hint"),
    scope: "world",
    config: true,
    type: Number,
    range: { min: 0, max: 100, step: 1 },
    default: 5,
    onChange: change
  });

  game.settings.register(MODULE_ID, SETTINGS.groupingDistance, {
    name: L("groupingDistance.name"),
    hint: L("groupingDistance.hint"),
    scope: "world",
    config: true,
    type: Number,
    range: { min: 0, max: 200, step: 5 },
    default: 60,
    onChange: change
  });

  // ---- Layout / overlay ----------------------------------------------------
  game.settings.register(MODULE_ID, SETTINGS.viewportPadding, {
    name: L("viewportPadding.name"),
    hint: L("viewportPadding.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 0, max: 32, step: 1 },
    default: 6,
    onChange: change
  });

  game.settings.register(MODULE_ID, SETTINGS.overlayFields, {
    scope: "client",
    config: false,
    type: Object,
    default: defaultOverlayFields(),
    onChange: change
  });

  game.settings.register(MODULE_ID, SETTINGS.streamingMode, {
    name: L("streamingMode.name"),
    hint: L("streamingMode.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: change
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
    },
    onChange: change
  });

  game.settings.register(MODULE_ID, SETTINGS.followSpeed, {
    name: L("followSpeed.name"),
    hint: L("followSpeed.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 0.05, max: 1, step: 0.05 },
    default: 0.6,
    onChange: change
  });

  game.settings.register(MODULE_ID, SETTINGS.transitionSpeed, {
    name: L("transitionSpeed.name"),
    hint: L("transitionSpeed.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 0.05, max: 1, step: 0.05 },
    default: 0.5,
    onChange: change
  });

  game.settings.register(MODULE_ID, SETTINGS.deadZone, {
    name: L("deadZone.name"),
    hint: L("deadZone.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 0, max: 0.9, step: 0.05 },
    default: 0.2,
    onChange: change
  });

  game.settings.register(MODULE_ID, SETTINGS.zoomMemory, {
    name: L("zoomMemory.name"),
    hint: L("zoomMemory.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: change
  });

  // ---- Performance / rendering --------------------------------------------
  game.settings.register(MODULE_ID, SETTINGS.performanceMode, {
    name: L("performanceMode.name"),
    hint: L("performanceMode.hint"),
    scope: "client",
    config: true,
    type: String,
    default: PerformanceMode.Balanced,
    choices: {
      [PerformanceMode.Quality]: L("performanceMode.quality"),
      [PerformanceMode.Balanced]: L("performanceMode.balanced"),
      [PerformanceMode.Performance]: L("performanceMode.performance"),
      [PerformanceMode.Battery]: L("performanceMode.battery")
    },
    onChange: change
  });

  game.settings.register(MODULE_ID, SETTINGS.renderScale, {
    name: L("renderScale.name"),
    hint: L("renderScale.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 0.25, max: 1, step: 0.05 },
    default: 1,
    onChange: change
  });

  game.settings.register(MODULE_ID, SETTINGS.frameRateCap, {
    name: L("frameRateCap.name"),
    hint: L("frameRateCap.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 15, max: 144, step: 1 },
    default: 60,
    onChange: change
  });

  game.settings.register(MODULE_ID, SETTINGS.secondaryCadence, {
    name: L("secondaryCadence.name"),
    hint: L("secondaryCadence.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 1, max: 6, step: 1 },
    default: 2,
    onChange: change
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
    },
    onChange: change
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

  game.settings.register(MODULE_ID, SETTINGS.profiling, {
    name: L("profiling.name"),
    hint: L("profiling.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: change
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
  const overlayFields = read<Record<OverlayField, boolean>>(
    SETTINGS.overlayFields,
    defaultOverlayFields()
  );

  return {
    permissionMode: read<PermissionMode>(SETTINGS.permissionMode, PermissionMode.OwnedOnly),
    maxCameras: read<number>(SETTINGS.maxCameras, 4),
    autoGrouping: read<boolean>(SETTINGS.autoGrouping, true),
    elevationThreshold: read<number>(SETTINGS.elevationThreshold, 5),
    groupingDistance: read<number>(SETTINGS.groupingDistance, 60),
    viewportPadding: read<number>(SETTINGS.viewportPadding, 6),
    overlayFields: { ...defaultOverlayFields(), ...overlayFields } as Record<OverlayField, boolean>,
    streamingMode: read<boolean>(SETTINGS.streamingMode, false),
    camera: {
      mode: read<CameraMode>(SETTINGS.cameraMode, CameraMode.Smooth),
      followSpeed: read<number>(SETTINGS.followSpeed, 0.6),
      deadZone: read<number>(SETTINGS.deadZone, 0.2),
      zoomMemory: read<boolean>(SETTINGS.zoomMemory, true),
      followRotation: false
    },
    transitionSpeed: read<number>(SETTINGS.transitionSpeed, 0.5),
    performanceMode: read<string>(SETTINGS.performanceMode, PerformanceMode.Balanced),
    renderScale: read<number>(SETTINGS.renderScale, 1),
    frameRateCap: read<number>(SETTINGS.frameRateCap, 60),
    secondaryCadence: read<number>(SETTINGS.secondaryCadence, 2),
    crossSceneBehaviour: read<string>(SETTINGS.crossSceneBehaviour, CrossSceneBehaviour.Prompt),
    debugLogging: read<boolean>(SETTINGS.debugLogging, false),
    profiling: read<boolean>(SETTINGS.profiling, false)
  };
}
