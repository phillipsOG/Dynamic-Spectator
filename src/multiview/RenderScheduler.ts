/**
 * RenderScheduler — decides, each frame, which viewports get an expensive
 * off-screen recapture and which merely advance their (cheap) camera.
 *
 * Strategy:
 *   • Camera advance is cheap → every viewport, every frame (smooth follow).
 *   • Capture is expensive (a full scene render + vision recompute) → budgeted.
 *   • The primary viewport captures every eligible frame at the highest priority.
 *   • Secondary viewports recapture on a round-robin at `secondaryCadence` (so
 *     e.g. cadence 2 = every other frame), bounded by a per-frame capture cap.
 *   • Frame-rate cap gates the whole capture pass so we never render faster than
 *     the user asked for, saving GPU/battery.
 *   • Adaptive degradation: when the measured frame time blows the budget, the
 *     per-frame capture cap is reduced (secondaries slow down first; the primary
 *     is protected), and recovers when headroom returns.
 *
 * This is what lets "60 FPS with 4 cameras, graceful degradation beyond" hold:
 * only a bounded number of heavy captures happen per frame regardless of how
 * many viewports exist.
 */

import { PerformanceMode } from "../constants.js";
import type { Viewport } from "./Viewport.js";
import { profiler } from "../util/profiler.js";

export interface SchedulerConfig {
  frameRateCap: number;
  secondaryCadence: number;
  performanceMode: string;
  maxCameras: number;
}

export interface FramePlan {
  /** Every active viewport (camera smoothing runs for all). */
  advance: Viewport[];
  /** The subset to recapture this frame, in render-priority order. */
  capture: Viewport[];
  /** Whether the whole capture pass runs (false when frame-capped this tick). */
  captureThisFrame: boolean;
}

export class RenderScheduler {
  private config: SchedulerConfig;
  private frame = 0;
  private cursor = 0; // round-robin index into secondaries
  private lastCaptureAt = 0;

  /** Current per-frame secondary-capture budget (adapts to load). */
  private captureBudget: number;

  constructor(config: SchedulerConfig) {
    this.config = config;
    this.captureBudget = this.baseBudget();
  }

  setConfig(config: SchedulerConfig): void {
    this.config = config;
    this.captureBudget = Math.min(this.captureBudget, this.baseBudget());
  }

  /** Static per-frame secondary budget by performance preset. */
  private baseBudget(): number {
    switch (this.config.performanceMode) {
      case PerformanceMode.Quality:
        return 4;
      case PerformanceMode.Performance:
        return 1;
      case PerformanceMode.Battery:
        return 1;
      case PerformanceMode.Balanced:
      default:
        return 2;
    }
  }

  /** Build the plan for this frame. */
  plan(viewports: Viewport[], now: number): FramePlan {
    this.frame += 1;
    profiler.tickFrame(now);
    this.adapt();

    const advance = viewports;
    const minInterval = 1000 / Math.max(1, this.config.frameRateCap);
    const captureThisFrame = now - this.lastCaptureAt >= minInterval;

    if (!captureThisFrame || viewports.length === 0) {
      return { advance, capture: [], captureThisFrame: false };
    }
    this.lastCaptureAt = now;

    const primaries = viewports.filter((v) => v.descriptor.primary && !v.descriptor.collapsed);
    const secondaries = viewports.filter((v) => !v.descriptor.primary && !v.descriptor.collapsed);

    const capture: Viewport[] = [];
    // Highest priority: the primary/pinned viewport(s) render every capture frame.
    capture.push(...primaries);

    // Secondaries: round-robin up to the adaptive budget, respecting cadence.
    const budget = Math.max(0, this.captureBudget);
    if (secondaries.length > 0 && budget > 0) {
      const cadence = Math.max(1, this.config.secondaryCadence);
      let picked = 0;
      for (let i = 0; i < secondaries.length && picked < budget; i++) {
        const idx = (this.cursor + i) % secondaries.length;
        const vp = secondaries[idx];
        // Stagger by cadence using the frame counter so each recaptures ~every
        // `cadence` capture-frames rather than all at once.
        if ((this.frame + idx) % cadence === 0) {
          capture.push(vp);
          picked++;
        }
      }
      this.cursor = (this.cursor + Math.max(1, budget)) % secondaries.length;
    }

    return { advance, capture, captureThisFrame: true };
  }

  /** Adapt the secondary budget to sustained frame-time pressure. */
  private adapt(): void {
    const targetMs = 1000 / Math.max(1, this.config.frameRateCap);
    const measured = profiler.frameMs;
    if (measured <= 0) return;

    if (measured > targetMs * 1.35 && this.captureBudget > 0) {
      this.captureBudget = Math.max(0, this.captureBudget - 1); // shed load
    } else if (measured < targetMs * 0.85 && this.captureBudget < this.baseBudget()) {
      this.captureBudget = Math.min(this.baseBudget(), this.captureBudget + 1); // recover
    }
  }

  get diagnostics(): { fps: number; captureBudget: number; frame: number } {
    return { fps: Math.round(profiler.fps), captureBudget: this.captureBudget, frame: this.frame };
  }
}
