/**
 * CameraController — the camera for a *single* MultiView viewport.
 *
 * Unlike CameraLock (which drives the shared main canvas for single-token
 * spectate), this never moves the real canvas. It only maintains an abstract
 * framing (world focus point + zoom + rotation) that SceneCapture uses to
 * position the stage while rendering that viewport's off-screen texture, then
 * restores the stage afterward.
 *
 * Each viewport therefore has a fully independent camera, zoom, follow speed,
 * dead-zone, and (optionally) rotation — exactly as the spec requires — without
 * any viewport being able to disturb another.
 */

import { CameraMode } from "../constants.js";
import type { CameraConfig, CameraState } from "../types/index.js";
import { clamp, smoothingFactor } from "../util/math.js";

export class CameraController {
  private state: CameraState;
  private target: CameraState;
  private config: CameraConfig;
  private initialized = false;

  constructor(config: CameraConfig, initialScale = 1) {
    this.config = config;
    this.state = { x: 0, y: 0, scale: initialScale, rotation: 0 };
    this.target = { x: 0, y: 0, scale: initialScale, rotation: 0 };
  }

  get framing(): Readonly<CameraState> {
    return this.state;
  }

  setConfig(config: CameraConfig): void {
    this.config = config;
  }

  /** User zoom for this viewport (persisted by the manager when zoomMemory is on). */
  setZoom(scale: number): void {
    this.target.scale = clamp(scale, 0.05, 5);
    if (!this.config.zoomMemory) this.state.scale = this.target.scale;
  }

  get zoom(): number {
    return this.target.scale;
  }

  /**
   * Point the camera at a token. Sets the target; `advance()` moves the actual
   * framing toward it according to the camera mode.
   */
  follow(token: FoundryToken): void {
    const c = token.center;
    this.target.x = c.x;
    this.target.y = c.y;
    if (this.config.followRotation && typeof token.document.rotation === "number") {
      this.target.rotation = (token.document.rotation * Math.PI) / 180;
    }
    if (!this.initialized) {
      // First frame: snap so we don't sweep in from (0,0).
      this.state.x = this.target.x;
      this.state.y = this.target.y;
      this.state.rotation = this.target.rotation;
      this.initialized = true;
    }
  }

  /** Advance the framing one frame. `dtMs` is the wall-clock delta. */
  advance(dtMs: number): void {
    switch (this.config.mode) {
      case CameraMode.Snap:
        this.state.x = this.target.x;
        this.state.y = this.target.y;
        break;
      case CameraMode.DeadZone:
        this.advanceDeadZone();
        break;
      default: {
        const f = smoothingFactor(this.config.followSpeed, dtMs);
        this.state.x += (this.target.x - this.state.x) * f;
        this.state.y += (this.target.y - this.state.y) * f;
        break;
      }
    }
    // Zoom + rotation always ease (feels better than snapping).
    const zf = smoothingFactor(0.5, dtMs);
    this.state.scale += (this.target.scale - this.state.scale) * zf;
    this.state.rotation += (this.target.rotation - this.state.rotation) * zf;
  }

  private advanceDeadZone(): void {
    // Dead-zone expressed as a world-space radius derived from zoom.
    const radius = (150 * this.config.deadZone) / this.state.scale;
    const dx = this.target.x - this.state.x;
    const dy = this.target.y - this.state.y;
    const d = Math.hypot(dx, dy);
    if (d > radius) {
      const move = d - radius;
      this.state.x += (dx / d) * move;
      this.state.y += (dy / d) * move;
    }
  }

  /** Force the framing to the current target immediately (e.g. teleport). */
  snap(): void {
    this.state.x = this.target.x;
    this.state.y = this.target.y;
    this.state.scale = this.target.scale;
    this.state.rotation = this.target.rotation;
  }
}
