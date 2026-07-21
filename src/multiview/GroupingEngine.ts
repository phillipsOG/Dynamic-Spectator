/**
 * GroupingEngine — decides which tokens belong "together" so MultiView can
 * intelligently allocate viewports instead of blindly opening one per token.
 *
 * Two dimensions of grouping, in order:
 *   1. Elevation bands. Characters at roughly the same height are grouped first
 *      (configurable `elevationThreshold`). This is the "basement / ground /
 *      first floor" case in the spec: observing the ground floor should show the
 *      Fighter + Rogue and not waste viewports on the upstairs Wizard.
 *   2. Distance clustering within a band. Tokens closer than `groupingDistance`
 *      (grid units) merge, so a party split across a map yields one group per
 *      cluster.
 *
 * Pure and deterministic given its inputs; the manager feeds it the current
 * placeables and settings.
 */

import type { TokenGroup } from "../types/index.js";
import { dist } from "../util/math.js";

interface GroupingOptions {
  elevationThreshold: number;
  /** Distance in grid units; converted to pixels internally. */
  groupingDistance: number;
  gridSize: number;
}

export class GroupingEngine {
  /**
   * Partition tokens into elevation-then-distance groups.
   */
  static group(tokens: FoundryToken[], opts: GroupingOptions): TokenGroup[] {
    if (tokens.length === 0) return [];

    const bands = this.elevationBands(tokens, opts.elevationThreshold);
    const distancePx = opts.groupingDistance * opts.gridSize;

    const groups: TokenGroup[] = [];
    for (const band of bands) {
      const clusters = this.distanceClusters(band.tokens, distancePx);
      clusters.forEach((cluster, i) => {
        const centroid = this.centroid(cluster);
        groups.push({
          key: `e${Math.round(band.centre)}-c${i}`,
          elevation: band.centre,
          tokenIds: cluster.map((t) => t.id),
          centroid
        });
      });
    }
    return groups;
  }

  /** Only groups within `threshold` of the observer's elevation. */
  static observedAtElevation(groups: TokenGroup[], observerElevation: number, threshold: number): TokenGroup[] {
    return groups.filter((g) => Math.abs(g.elevation - observerElevation) <= threshold);
  }

  // -- elevation -------------------------------------------------------------

  private static elevationBands(
    tokens: FoundryToken[],
    threshold: number
  ): { centre: number; tokens: FoundryToken[] }[] {
    const sorted = [...tokens].sort(
      (a, b) => (a.document.elevation ?? 0) - (b.document.elevation ?? 0)
    );
    const bands: { centre: number; tokens: FoundryToken[] }[] = [];

    for (const t of sorted) {
      const e = t.document.elevation ?? 0;
      const last = bands[bands.length - 1];
      // Threshold 0 means "exact elevation only".
      if (last && Math.abs(e - last.centre) <= Math.max(threshold, 0.0001) && threshold >= 0) {
        last.tokens.push(t);
        // Running mean keeps the band centre stable.
        last.centre = last.tokens.reduce((s, x) => s + (x.document.elevation ?? 0), 0) / last.tokens.length;
      } else {
        bands.push({ centre: e, tokens: [t] });
      }
    }
    return bands;
  }

  // -- distance --------------------------------------------------------------

  private static distanceClusters(tokens: FoundryToken[], distancePx: number): FoundryToken[][] {
    if (distancePx <= 0) return tokens.map((t) => [t]); // grouping disabled → each alone
    const clusters: FoundryToken[][] = [];

    for (const t of tokens) {
      const c = t.center;
      let joined = false;
      for (const cluster of clusters) {
        const centroid = this.centroid(cluster);
        if (dist(c.x, c.y, centroid.x, centroid.y) <= distancePx) {
          cluster.push(t);
          joined = true;
          break;
        }
      }
      if (!joined) clusters.push([t]);
    }
    return clusters;
  }

  private static centroid(tokens: FoundryToken[]): { x: number; y: number } {
    if (tokens.length === 0) return { x: 0, y: 0 };
    let x = 0;
    let y = 0;
    for (const t of tokens) {
      x += t.center.x;
      y += t.center.y;
    }
    return { x: x / tokens.length, y: y / tokens.length };
  }
}
