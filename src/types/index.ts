/**
 * Internal (module-owned) types. These describe our own data structures — the
 * things we control — as opposed to Foundry's runtime shapes which live in
 * `foundry-shim.d.ts`.
 */

import type { CameraMode, PermissionMode } from "../constants.js";

/** A camera framing in canvas (world) coordinates. */
export interface CameraState {
  /** Focus point in world coordinates (token centre we follow). */
  x: number;
  y: number;
  /** Canvas scale (zoom). */
  scale: number;
  /** Stage rotation in radians (0 unless rotation-follow is enabled). */
  rotation: number;
}

/** Camera tuning for the spectator lock, resolved from settings. */
export interface CameraConfig {
  mode: CameraMode;
  /** 0..1 lerp factor per frame for smooth/interpolate modes. */
  followSpeed: number;
  /** Fraction of the screen (0..1) the token may drift before the dead-zone camera reacts. */
  deadZone: number;
  /** Keep the user's current zoom while locked rather than re-framing. */
  zoomMemory: boolean;
  /** Follow token rotation when the system exposes it. */
  followRotation: boolean;
}

/** Resolved permission decision for a (user, token) pair. */
export interface PermissionDecision {
  allowed: boolean;
  reason: string;
}

/** Global module settings, resolved and typed. */
export interface ResolvedSettings {
  permissionMode: PermissionMode;
  /** Whether NPC (non-player-owned) tokens may be spectated by non-GM users. */
  allowNpcSpectate: boolean;
  camera: CameraConfig;
  crossSceneBehaviour: string;
  debugLogging: boolean;
}

/** Socket payloads exchanged between clients (mostly GM-driven "spectate for player"). */
export type SocketMessage =
  | { type: "forceSpectate"; userId: string; tokenId: string; sceneId: string }
  | { type: "stopSpectate"; userId: string };
