/**
 * Small, dependency-free math helpers for camera interpolation and layout.
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

/** 2D vector distance. */
export const dist = (ax: number, ay: number, bx: number, by: number): number =>
  Math.hypot(bx - ax, by - ay);

/** Compass heading (degrees, 0 = up/north, clockwise) from a movement delta. */
export function heading(dx: number, dy: number): number | undefined {
  if (dx === 0 && dy === 0) return undefined;
  // Screen space: +y is down, so invert for a natural compass.
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Greatest-common-divisor based aspect ratio classification for layout. */
export function aspectClass(width: number, height: number): "portrait" | "square" | "wide" | "ultrawide" {
  if (height <= 0) return "wide";
  const r = width / height;
  if (r < 0.9) return "portrait";
  if (r < 1.3) return "square";
  if (r < 2.2) return "wide";
  return "ultrawide";
}
