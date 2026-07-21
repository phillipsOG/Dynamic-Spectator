/**
 * CameraLock — locks the *main* canvas camera onto a token and follows it every
 * frame using the configured behaviour (smooth / snap / interpolate / dead-zone).
 *
 * Runs on the PIXI ticker but uses a wall-clock delta so smoothing feels
 * identical at 30fps and 144fps. The previous camera position is captured on
 * lock and restored on release, so spectating never strands the user's view.
 */

import { CameraMode } from "../constants.js";
import type { CameraConfig } from "../types/index.js";
import { clamp, smoothingFactor } from "../util/math.js";
import { log } from "../util/logger.js";

export class CameraLock {
  private token: FoundryToken | null = null;
  private config: CameraConfig | null = null;

  private ticker = false;
  private readonly tick = (): void => this.onTick();
  private lastTime = 0;

  /** Camera to restore when we release. */
  private restore: { x: number; y: number; scale: number } | null = null;

  /** Target zoom while locked (kept stable unless the user zooms). */
  private targetScale = 1;

  get active(): boolean {
    return this.token !== null;
  }

  lock(token: FoundryToken, config: CameraConfig): void {
    if (!token) return;
    this.captureRestore();

    this.token = token;
    this.config = config;
    this.targetScale = config.zoomMemory && config.mode ? this.currentScale() : this.currentScale();

    // Snap immediately to the token so there's no lurch on the first frame.
    const c = token.center;
    this.applyCamera(c.x, c.y, this.targetScale);

    this.startTicker();
    log.debug(`CameraLock engaged on "${token.name}" mode=${config.mode}`);
  }

  release(): void {
    if (!this.active) return;
    this.stopTicker();
    const r = this.restore;
    this.token = null;
    this.config = null;
    if (r) {
      try {
        canvas?.animatePan?.({ x: r.x, y: r.y, scale: r.scale, duration: 250 });
      } catch {
        /* canvas gone */
      }
    }
    this.restore = null;
    log.debug("CameraLock released; camera restored");
  }

  /** Swap the followed token without releasing (e.g. spectate a different token). */
  retarget(token: FoundryToken): void {
    if (!this.active || !token) return;
    this.token = token;
  }

  /** Let the user's manual zoom override the locked zoom. */
  setZoom(scale: number): void {
    this.targetScale = clamp(scale, 0.05, 5);
  }

  // -- ticker ----------------------------------------------------------------

  private startTicker(): void {
    if (this.ticker) return;
    this.lastTime = performance.now();
    canvas?.app?.ticker?.add(this.tick);
    this.ticker = true;
  }

  private stopTicker(): void {
    if (!this.ticker) return;
    canvas?.app?.ticker?.remove(this.tick);
    this.ticker = false;
  }

  private onTick(): void {
    if (!this.token || !this.config) return;
    const now = performance.now();
    const dt = Math.min(now - this.lastTime, 100); // clamp large stalls
    this.lastTime = now;

    const target = this.token.center;
    const cur = this.currentCenter();
    if (!cur) return;

    switch (this.config.mode) {
      case CameraMode.Snap: {
        this.applyCamera(target.x, target.y, this.targetScale);
        break;
      }
      case CameraMode.DeadZone: {
        this.followDeadZone(cur, target);
        break;
      }
      case CameraMode.Interpolate:
      case CameraMode.Smooth:
      default: {
        const f = smoothingFactor(this.config.followSpeed, dt);
        const x = cur.x + (target.x - cur.x) * f;
        const y = cur.y + (target.y - cur.y) * f;
        this.applyCamera(x, y, this.targetScale);
        break;
      }
    }
  }

  /** Dead-zone: only chase once the token drifts outside a central box. */
  private followDeadZone(cur: { x: number; y: number }, target: { x: number; y: number }): void {
    const scale = this.currentScale();
    const halfW = (window.innerWidth * 0.5 * this.config!.deadZone) / scale;
    const halfH = (window.innerHeight * 0.5 * this.config!.deadZone) / scale;

    let nx = cur.x;
    let ny = cur.y;
    const dx = target.x - cur.x;
    const dy = target.y - cur.y;
    if (Math.abs(dx) > halfW) nx = cur.x + (dx - Math.sign(dx) * halfW);
    if (Math.abs(dy) > halfH) ny = cur.y + (dy - Math.sign(dy) * halfH);

    if (nx !== cur.x || ny !== cur.y) this.applyCamera(nx, ny, this.targetScale);
  }

  // -- camera helpers --------------------------------------------------------

  private applyCamera(x: number, y: number, scale: number): void {
    try {
      canvas?.pan?.({ x, y, scale });
    } catch (err) {
      log.debug("pan failed", err);
    }
  }

  private currentScale(): number {
    return canvas?.stage?.scale?.x ?? 1;
  }

  private currentCenter(): { x: number; y: number } | null {
    const stage = canvas?.stage;
    if (!stage) return null;
    // stage.pivot is the world point currently centred in the viewport.
    return { x: stage.pivot.x, y: stage.pivot.y };
  }

  private captureRestore(): void {
    const c = this.currentCenter();
    if (c) this.restore = { x: c.x, y: c.y, scale: this.currentScale() };
  }
}
