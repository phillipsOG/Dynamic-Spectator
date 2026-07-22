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
  HOOKS,
  INDICATOR_DEFAULTS,
  MODULE_ID,
  PERMISSION_MODE_LABELS,
  PermissionMode,
  SETTINGS
} from "./constants.js";
import { DS } from "./state.js";
import type { IndicatorConfig, ResolvedSettings, TokenIndicatorOverride } from "./types/index.js";
import { log } from "./util/logger.js";

const L = (key: string): string => `dynamic-spectator.settings.${key}`;

/**
 * Cleared whenever an indicator setting changes. The ring is redrawn on every
 * token refresh - which is every frame while a token is moving - so the config
 * is resolved once and reused rather than re-read per draw.
 */
let indicatorCache: IndicatorConfig | null = null;

/**
 * Invalidate the cache and repaint the live ring. Poking the token's render
 * flags fires `refreshToken`, which is what the indicator hook listens on.
 */
function onIndicatorChange(): void {
  indicatorCache = null;
  try {
    const token = DS.spectator?.tokenId ? canvas?.tokens?.get(DS.spectator.tokenId) : null;
    token?.renderFlags?.set?.({ refreshState: true });
  } catch {
    /* canvas not ready - the next draw picks up the new value anyway */
  }
}

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

  // ---- Spectating ring (per-user appearance) -------------------------------
  game.settings.register(MODULE_ID, SETTINGS.indicatorEnabled, {
    name: L("indicatorEnabled.name"),
    hint: L("indicatorEnabled.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: onIndicatorChange
  });

  // A ColorField renders a real swatch picker; where it is unavailable this
  // degrades to a plain text field taking the same "#rrggbb" string.
  const ColorField = (foundry as any).data?.fields?.ColorField;
  game.settings.register(MODULE_ID, SETTINGS.indicatorColor, {
    name: L("indicatorColor.name"),
    hint: L("indicatorColor.hint"),
    scope: "client",
    config: true,
    type: ColorField ? new ColorField({ nullable: false, initial: INDICATOR_DEFAULTS.color }) : String,
    default: INDICATOR_DEFAULTS.color,
    onChange: onIndicatorChange
  });

  game.settings.register(MODULE_ID, SETTINGS.indicatorOpacity, {
    name: L("indicatorOpacity.name"),
    hint: L("indicatorOpacity.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 0, max: 1, step: 0.05 },
    default: INDICATOR_DEFAULTS.opacity,
    onChange: onIndicatorChange
  });

  game.settings.register(MODULE_ID, SETTINGS.indicatorWidth, {
    name: L("indicatorWidth.name"),
    hint: L("indicatorWidth.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 1, max: 10, step: 1 },
    default: INDICATOR_DEFAULTS.width,
    onChange: onIndicatorChange
  });

  // Off by default: the colour/opacity/thickness above already cover "one
  // ring style for every token I spectate". This only unlocks the ability to
  // override that style per token from the spectator picker.
  game.settings.register(MODULE_ID, SETTINGS.indicatorPerToken, {
    name: L("indicatorPerToken.name"),
    hint: L("indicatorPerToken.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => {
      onIndicatorChange();
      // The picker's palette button depends on this setting; fired here
      // rather than left to `updateSetting` (see HOOKS.indicatorRingUiChanged).
      Hooks.callAll(HOOKS.indicatorRingUiChanged);
    }
  });

  // Off by default (the button is always visible - see v2.1.4). On, it goes
  // back to only appearing on row hover, like the GM-only opt-out/NPC buttons.
  game.settings.register(MODULE_ID, SETTINGS.indicatorRingHoverOnly, {
    name: L("indicatorRingHoverOnly.name"),
    hint: L("indicatorRingHoverOnly.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => Hooks.callAll(HOOKS.indicatorRingUiChanged)
  });

  // Not exposed on the config sheet - edited via the picker's per-row dialog.
  game.settings.register(MODULE_ID, SETTINGS.indicatorTokenOverrides, {
    scope: "client",
    config: false,
    type: Object,
    default: {},
    onChange: onIndicatorChange
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

/**
 * "#rrggbb" → 0xrrggbb for PIXI. Also accepts a Color instance, since that is
 * what a ColorField hands back; its `toString()` is the same hex form.
 */
function hexToInt(value: unknown, fallback: number): number {
  const hex = String(value ?? "").trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return fallback;
  const n = Number.parseInt(hex, 16);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Appearance of the spectating ring, optionally for a specific token. Base
 * values are cached (see {@link indicatorCache}) because this is read on every
 * token refresh; a per-token override, when enabled, is layered on top of the
 * cached base rather than invalidating it.
 */
export function getIndicatorConfig(tokenId?: string): IndicatorConfig {
  indicatorCache ??= {
    enabled: read<boolean>(SETTINGS.indicatorEnabled, true),
    color: hexToInt(read<unknown>(SETTINGS.indicatorColor, INDICATOR_DEFAULTS.color), INDICATOR_DEFAULTS.colorInt),
    opacity: read<number>(SETTINGS.indicatorOpacity, INDICATOR_DEFAULTS.opacity),
    width: read<number>(SETTINGS.indicatorWidth, INDICATOR_DEFAULTS.width)
  };
  if (!tokenId || !read<boolean>(SETTINGS.indicatorPerToken, false)) return indicatorCache;

  const override = getTokenIndicatorOverride(tokenId);
  if (!override) return indicatorCache;

  return {
    enabled: indicatorCache.enabled,
    color: override.color !== undefined ? hexToInt(override.color, indicatorCache.color) : indicatorCache.color,
    opacity: override.opacity ?? indicatorCache.opacity,
    width: override.width ?? indicatorCache.width
  };
}

/** All per-token ring overrides, keyed by token id. */
function allTokenIndicatorOverrides(): Record<string, TokenIndicatorOverride> {
  return read<Record<string, TokenIndicatorOverride>>(SETTINGS.indicatorTokenOverrides, {});
}

/** This token's stored override, if any. */
export function getTokenIndicatorOverride(tokenId: string): TokenIndicatorOverride | undefined {
  return allTokenIndicatorOverrides()[tokenId];
}

/** Persist (merge) a per-token override. */
export async function setTokenIndicatorOverride(tokenId: string, patch: TokenIndicatorOverride): Promise<void> {
  const all = { ...allTokenIndicatorOverrides() };
  all[tokenId] = { ...all[tokenId], ...patch };
  await game.settings.set(MODULE_ID, SETTINGS.indicatorTokenOverrides, all);
}

/** Remove this token's override entirely, falling back to the global ring style. */
export async function clearTokenIndicatorOverride(tokenId: string): Promise<void> {
  const all = { ...allTokenIndicatorOverrides() };
  if (!(tokenId in all)) return;
  delete all[tokenId];
  await game.settings.set(MODULE_ID, SETTINGS.indicatorTokenOverrides, all);
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
    indicator: getIndicatorConfig(),
    indicatorPerToken: read<boolean>(SETTINGS.indicatorPerToken, false),
    indicatorRingHoverOnly: read<boolean>(SETTINGS.indicatorRingHoverOnly, false),
    crossSceneBehaviour: read<string>(SETTINGS.crossSceneBehaviour, CrossSceneBehaviour.Prompt),
    debugLogging: read<boolean>(SETTINGS.debugLogging, false)
  };
}
