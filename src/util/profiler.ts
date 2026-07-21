/**
 * Lightweight performance profiler with a rolling FPS estimator and per-label
 * timing samples. Used by the render scheduler to make adaptive decisions
 * (drop cadence when we blow the frame budget) and exposed on the module API so
 * a GM can inspect live cost via `game.modules.get("dynamic-spectator").api.profiler`.
 *
 * Zero-overhead when profiling is disabled: `measure` short-circuits before
 * touching `performance.now()`.
 */

import { MODULE_ID, SETTINGS } from "../constants.js";

interface Sample {
  count: number;
  totalMs: number;
  maxMs: number;
  lastMs: number;
}

class Profiler {
  private samples = new Map<string, Sample>();

  // Rolling FPS estimate over the last N frame intervals.
  private frameTimes: number[] = [];
  private lastFrame = 0;
  private readonly window = 60;

  private enabled(): boolean {
    try {
      return Boolean(game?.settings?.get(MODULE_ID, SETTINGS.profiling));
    } catch {
      return false;
    }
  }

  /** Call once per rendered frame to feed the FPS estimator. */
  tickFrame(now = performance.now()): void {
    if (this.lastFrame > 0) {
      const dt = now - this.lastFrame;
      this.frameTimes.push(dt);
      if (this.frameTimes.length > this.window) this.frameTimes.shift();
    }
    this.lastFrame = now;
  }

  /** Current estimated frames-per-second over the rolling window. */
  get fps(): number {
    if (this.frameTimes.length === 0) return 0;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    return avg > 0 ? 1000 / avg : 0;
  }

  /** Average frame interval in ms (the frame budget we are actually hitting). */
  get frameMs(): number {
    if (this.frameTimes.length === 0) return 0;
    return this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
  }

  /** Wrap a synchronous unit of work and record its timing under `label`. */
  measure<T>(label: string, fn: () => T): T {
    if (!this.enabled()) return fn();
    const start = performance.now();
    try {
      return fn();
    } finally {
      this.record(label, performance.now() - start);
    }
  }

  private record(label: string, ms: number): void {
    const s = this.samples.get(label) ?? { count: 0, totalMs: 0, maxMs: 0, lastMs: 0 };
    s.count += 1;
    s.totalMs += ms;
    s.maxMs = Math.max(s.maxMs, ms);
    s.lastMs = ms;
    this.samples.set(label, s);
  }

  /** Snapshot of all recorded timings, for the dashboard / console. */
  report(): Record<string, { avgMs: number; maxMs: number; lastMs: number; count: number }> {
    const out: Record<string, { avgMs: number; maxMs: number; lastMs: number; count: number }> = {};
    for (const [label, s] of this.samples) {
      out[label] = {
        avgMs: s.count ? s.totalMs / s.count : 0,
        maxMs: s.maxMs,
        lastMs: s.lastMs,
        count: s.count
      };
    }
    return out;
  }

  reset(): void {
    this.samples.clear();
    this.frameTimes.length = 0;
    this.lastFrame = 0;
  }
}

export const profiler = new Profiler();
