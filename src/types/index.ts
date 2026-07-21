/**
 * Internal (module-owned) types. These describe our own data structures — the
 * things we control — as opposed to Foundry's runtime shapes which live in
 * `foundry-shim.d.ts`.
 */

import type { CameraMode, OverlayField, PermissionMode } from "../constants.js";

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

/** Per-viewport camera tuning, resolved from global settings + user overrides. */
export interface CameraConfig {
  mode: CameraMode;
  /** 0..1 lerp factor per frame for smooth/interpolate modes. */
  followSpeed: number;
  /** Fraction of the viewport (0..1) the token may drift before the dead-zone camera reacts. */
  deadZone: number;
  /** Persist zoom independently for this viewport. */
  zoomMemory: boolean;
  /** Follow token rotation when the system exposes it. */
  followRotation: boolean;
}

/** A single MultiView camera bound to one token. */
export interface ViewportDescriptor {
  id: string;
  tokenId: string;
  /** Actor backing the token, used to re-map the viewport across scenes. */
  actorId?: string;
  sceneId: string;
  /** User-assigned label, else derived from the token/actor name. */
  label?: string;
  primary: boolean;
  pinned: boolean;
  collapsed: boolean;
  /** Manual grid slot; -1 means "let the layout engine decide". */
  slot: number;
  camera: CameraConfig;
  /** Remembered per-viewport zoom (used when zoomMemory is on). */
  rememberedScale?: number;
}

/** A computed rectangle (in CSS pixels, relative to the MultiView root) for one viewport. */
export interface LayoutRect {
  viewportId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** True for the visually dominant tile (drives render priority). */
  primary: boolean;
}

/** The container geometry the layout engine solves against. */
export interface LayoutBounds {
  width: number;
  height: number;
  padding: number;
}

/** A group of tokens the grouping engine considers "together". */
export interface TokenGroup {
  key: string;
  /** Representative elevation band centre. */
  elevation: number;
  tokenIds: string[];
  /** Rough centroid in world coordinates, for distance grouping. */
  centroid: { x: number; y: number };
}

/** Snapshot of overlay data for one viewport, rendered each refresh. */
export interface OverlayData {
  viewportId: string;
  characterName?: string;
  playerName?: string;
  hp?: { value: number; max: number; temp?: number };
  conditions?: string[];
  statusEffects?: string[];
  elevation?: number;
  distance?: number;
  scene?: string;
  /** Compass heading in degrees for the direction indicator, or undefined if unknown. */
  direction?: number;
  primary: boolean;
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
  maxCameras: number;
  autoGrouping: boolean;
  elevationThreshold: number;
  groupingDistance: number;
  viewportPadding: number;
  overlayFields: Record<OverlayField, boolean>;
  streamingMode: boolean;
  camera: CameraConfig;
  transitionSpeed: number;
  performanceMode: string;
  renderScale: number;
  frameRateCap: number;
  secondaryCadence: number;
  crossSceneBehaviour: string;
  debugLogging: boolean;
  profiling: boolean;
}

/** Socket payloads exchanged between clients (mostly GM-driven "spectate for player"). */
export type SocketMessage =
  | { type: "forceSpectate"; userId: string; tokenId: string; sceneId: string }
  | { type: "stopSpectate"; userId: string }
  | { type: "requestMultiView"; userId: string; viewports: ViewportDescriptor[] };
