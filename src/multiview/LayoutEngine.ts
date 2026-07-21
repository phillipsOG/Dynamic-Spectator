/**
 * LayoutEngine — an adaptive viewport tiler modelled on professional multi-camera
 * (CCTV / NVR) layouts.
 *
 * Pure and side-effect free: given a list of viewports (one optionally flagged
 * primary), the container geometry, and a padding, it returns pixel rectangles.
 * Because it is pure it is trivially unit-testable and re-runs cheaply on every
 * window resize.
 *
 * Layout rules (matching the spec):
 *   1        → full screen
 *   2        → split along the short axis (columns on wide monitors, rows on tall)
 *   3        → featured: one large primary + the rest tiled
 *   4        → 2×2 grid (or featured, if a primary is explicitly pinned)
 *   5–9      → adaptive near-square grid; primary spans an extra cell when set
 *   10+      → the caller paginates; this engine lays out the current page only
 *
 * Aspect handling covers 16:9, 21:9 ultrawide, and portrait monitors by choosing
 * split direction and grid proportions from the container's aspect class.
 */

import type { LayoutBounds, LayoutRect, ViewportDescriptor } from "../types/index.js";
import { aspectClass } from "../util/math.js";

export class LayoutEngine {
  /**
   * Compute rectangles for the given viewports. Rectangles are returned in the
   * same order as `views` and reference each viewport by id.
   */
  static compute(views: ViewportDescriptor[], bounds: LayoutBounds): LayoutRect[] {
    const n = views.length;
    if (n === 0) return [];

    const primaryIdx = views.findIndex((v) => v.primary);
    const aspect = aspectClass(bounds.width, bounds.height);

    if (n === 1) return [this.rect(views[0], 0, 0, bounds.width, bounds.height, bounds, true)];

    if (n === 2) return this.twoUp(views, bounds, aspect);

    // Featured layout: a pinned primary among 3+, or any 3 (spec: "3 → featured").
    if (primaryIdx >= 0 && (n === 3 || n >= 5 || (n === 4 && views[primaryIdx].pinned))) {
      return this.featured(views, bounds, aspect, primaryIdx);
    }
    if (n === 3) return this.featured(views, bounds, aspect, primaryIdx >= 0 ? primaryIdx : 0);

    // Everything else: adaptive grid.
    return this.grid(views, bounds, aspect, primaryIdx);
  }

  private static twoUp(
    views: ViewportDescriptor[],
    bounds: LayoutBounds,
    aspect: ReturnType<typeof aspectClass>
  ): LayoutRect[] {
    const vertical = aspect === "portrait"; // stack rows on portrait, else columns
    if (vertical) {
      const h = bounds.height / 2;
      return [
        this.rect(views[0], 0, 0, bounds.width, h, bounds, views[0].primary),
        this.rect(views[1], 0, h, bounds.width, h, bounds, views[1].primary)
      ];
    }
    const w = bounds.width / 2;
    return [
      this.rect(views[0], 0, 0, w, bounds.height, bounds, views[0].primary),
      this.rect(views[1], w, 0, w, bounds.height, bounds, views[1].primary)
    ];
  }

  /** One dominant tile plus a strip of the rest. */
  private static featured(
    views: ViewportDescriptor[],
    bounds: LayoutBounds,
    aspect: ReturnType<typeof aspectClass>,
    primaryIdx: number
  ): LayoutRect[] {
    const primary = views[primaryIdx];
    const others = views.filter((_, i) => i !== primaryIdx);
    const rects: LayoutRect[] = [];

    const stackVertically = aspect === "portrait"; // primary on top, strip below
    const featureRatio = aspect === "ultrawide" ? 0.7 : 0.66;

    if (stackVertically) {
      const ph = bounds.height * featureRatio;
      rects.push(this.rect(primary, 0, 0, bounds.width, ph, bounds, true));
      const sw = bounds.width / others.length;
      others.forEach((v, i) => {
        rects.push(this.rect(v, i * sw, ph, sw, bounds.height - ph, bounds, false));
      });
    } else {
      const pw = bounds.width * featureRatio;
      rects.push(this.rect(primary, 0, 0, pw, bounds.height, bounds, true));
      const sh = bounds.height / others.length;
      const sx = pw;
      const sw = bounds.width - pw;
      others.forEach((v, i) => {
        rects.push(this.rect(v, sx, i * sh, sw, sh, bounds, false));
      });
    }

    // Restore original view order for stable DOM / z-order.
    return this.reorder(views, rects);
  }

  /** Near-square adaptive grid; the primary (if any) spans a second column. */
  private static grid(
    views: ViewportDescriptor[],
    bounds: LayoutBounds,
    aspect: ReturnType<typeof aspectClass>,
    primaryIdx: number
  ): LayoutRect[] {
    const n = views.length;
    let cols = Math.ceil(Math.sqrt(n));
    // Bias columns for wide displays, rows for portrait.
    if (aspect === "ultrawide") cols = Math.min(n, cols + 1);
    if (aspect === "portrait") cols = Math.max(1, cols - 1);
    const rows = Math.ceil(n / cols);

    const cw = bounds.width / cols;
    const ch = bounds.height / rows;

    const rects: LayoutRect[] = [];
    views.forEach((v, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const isPrimary = i === primaryIdx;
      // The primary spans a second horizontal cell when room allows (5–9 case).
      const span = isPrimary && n >= 5 && c + 1 < cols ? 2 : 1;
      rects.push(this.rect(v, c * cw, r * ch, cw * span, ch, bounds, isPrimary));
    });
    return rects;
  }

  /** Reorder computed rects back into the input order by viewport id. */
  private static reorder(views: ViewportDescriptor[], rects: LayoutRect[]): LayoutRect[] {
    const byId = new Map(rects.map((r) => [r.viewportId, r]));
    return views.map((v) => byId.get(v.id)).filter((r): r is LayoutRect => Boolean(r));
  }

  /** Build a single padded rectangle. */
  private static rect(
    v: ViewportDescriptor,
    x: number,
    y: number,
    w: number,
    h: number,
    bounds: LayoutBounds,
    primary: boolean
  ): LayoutRect {
    const p = bounds.padding;
    return {
      viewportId: v.id,
      x: x + p,
      y: y + p,
      width: Math.max(0, w - p * 2),
      height: Math.max(0, h - p * 2),
      primary
    };
  }
}
