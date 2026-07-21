/**
 * Small, dependency-free math helpers for camera interpolation.
 * Framerate-independent lerp is used so follow smoothing feels the same at
 * 30fps and 144fps.
 */

export const clamp = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Framerate-independent exponential smoothing.
 * `speed` is a 0..1 "responsiveness" knob; `dtMs` is the frame delta.
 * Returns the interpolation factor to apply this frame.
 */
export function smoothingFactor(speed: number, dtMs: number): number {
  // Map speed → a time constant. speed=1 is near-instant, speed→0 is very slow.
  const s = clamp(speed, 0.001, 1);
  // Half-life in ms: fast speed → short half-life.
  const halfLife = lerp(600, 20, s);
  return 1 - Math.pow(2, -dtMs / halfLife);
}
