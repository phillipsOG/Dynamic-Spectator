/**
 * OcclusionController - makes overhead/roof tiles reveal what the *spectated*
 * token is standing under, so spectating a character inside a building shows the
 * interior instead of the building's roof.
 *
 * How Foundry roof occlusion actually works (and therefore how we hook it):
 *   Overhead tiles (occlusion mode FADE / RADIAL / VISION) are only revealed for
 *   the set of "occludable subject" tokens returned by
 *   `TokenLayer#_getOccludableTokens()`. By default that set is *only the tokens
 *   the current user controls or owns* - so a spectated token (which the
 *   spectator neither controls nor owns) never punches through the roof, and the
 *   spectator is left staring at the rooftop. By wrapping that method to include
 *   the spectated token we make core reveal exactly the tiles that token is
 *   under, using core's own occlusion maths.
 *
 *   This is height-aware for free: core only occludes a tile for a token when the
 *   token is below the tile's elevation, so revealing follows the token up and
 *   down floors without us re-implementing any geometry. VISION-mode roofs also
 *   work because the spectated token is simultaneously made a vision source (see
 *   VisionController), so its vision polygon drives the reveal.
 *
 *   In EXCLUSIVE mode only the spectated token drives occlusion, so roofs over
 *   the spectator's *own* tokens elsewhere are not revealed - matching the POV
 *   clamp that stops spectating from leaking information.
 *
 * Patching strategy mirrors VisionController: prefer lib-wrapper, fall back to a
 * fully-reversible manual prototype wrapper, and only ever install one at a time.
 */

import { MODULE_ID } from "../constants.js";
import { log } from "../util/logger.js";

type OccludableGetter = (this: FoundryTokenLayer) => FoundryToken[];

/** Minimal shape of the TokenLayer prototype we patch. */
interface FoundryTokenLayer {
  _getOccludableTokens?: OccludableGetter;
}

export class OcclusionController {
  /** The token whose roofs we are currently revealing, or null when inactive. */
  private spectated: FoundryToken | null = null;

  /** When true, only the spectated token drives occlusion (POV clamp). */
  private exclusive = true;

  /** Saved original method for manual-wrapper teardown. */
  private original: OccludableGetter | null = null;

  /** lib-wrapper registration handle / flag. */
  private wrapperInstalled = false;

  /** The TokenLayer class whose prototype we patched (cached for teardown). */
  private layerClass: { prototype: FoundryTokenLayer } | null = null;

  /** lib-wrapper target - resolved from CONFIG so it is version-stable. */
  private static readonly TARGET =
    "CONFIG.Canvas.layers.tokens.layerClass.prototype._getOccludableTokens";

  get active(): boolean {
    return this.spectated !== null;
  }

  /** Begin revealing the roofs `token` is under on this client. */
  activate(token: FoundryToken, exclusive = true): void {
    if (!token?.document) {
      log.warn("OcclusionController.activate called with an invalid token");
      return;
    }
    this.spectated = token;
    this.exclusive = exclusive;
    this.installWrapper();
    this.refreshOcclusion();
    log.debug(`OcclusionController active on "${token.name}" (exclusive=${exclusive})`);
  }

  /** Stop revealing roofs and restore normal occlusion. */
  deactivate(): void {
    if (!this.active) return;
    this.spectated = null;
    this.removeWrapper();
    this.refreshOcclusion();
    log.debug("OcclusionController deactivated; occlusion restored");
  }

  /** Swap the target token without reinstalling the wrapper (retarget). */
  setTarget(token: FoundryToken, exclusive = true): void {
    if (!token?.document) return;
    this.spectated = token;
    this.exclusive = exclusive;
    this.installWrapper(); // idempotent
    this.refreshOcclusion();
  }

  /** Recompute occlusion for the current target (e.g. after it moved). */
  refresh(): void {
    if (!this.active) return;
    this.refreshOcclusion();
  }

  // -- internals -------------------------------------------------------------

  /** The occludable-token set installed while spectating. */
  private predicate(original: OccludableGetter, self: FoundryTokenLayer): FoundryToken[] {
    const target = this.spectated;
    if (!target) return original.call(self);

    // Exclusive: only the spectated token reveals roofs (POV clamp).
    if (this.exclusive) return [target];

    // Non-exclusive: keep the user's own occludable tokens and add the target.
    const base = original.call(self) ?? [];
    return base.includes(target) ? base : [...base, target];
  }

  private resolveLayerClass(): { prototype: FoundryTokenLayer } | null {
    const fromConfig = CONFIG?.Canvas?.layers?.tokens?.layerClass as
      | { prototype: FoundryTokenLayer }
      | undefined;
    if (fromConfig?.prototype) return fromConfig;
    // Fall back to the live TokenLayer instance's own class.
    const layer = canvas?.tokens as unknown as
      | { constructor?: { prototype: FoundryTokenLayer } }
      | undefined;
    return layer?.constructor ?? null;
  }

  private installWrapper(): void {
    if (this.wrapperInstalled) return;

    if (typeof libWrapper !== "undefined" && libWrapper?.register) {
      const self = this;
      libWrapper.register(
        MODULE_ID,
        OcclusionController.TARGET,
        function (this: any, wrapped: (...a: any[]) => any) {
          return self.predicate(wrapped as OccludableGetter, this as FoundryTokenLayer);
        },
        "MIXED"
      );
      this.wrapperInstalled = true;
      log.debug("Installed _getOccludableTokens wrapper via lib-wrapper");
      return;
    }

    // Manual fallback: patch the prototype directly, remembering the original.
    const cls = this.resolveLayerClass();
    if (!cls?.prototype?._getOccludableTokens) {
      // Older cores without this method simply cannot reveal roofs for a
      // non-controlled token; degrade gracefully (vision still redirects).
      log.debug("TokenLayer#_getOccludableTokens not available; roof reveal skipped");
      return;
    }
    this.layerClass = cls;
    this.original = cls.prototype._getOccludableTokens as OccludableGetter;
    const original = this.original;
    const self = this;
    cls.prototype._getOccludableTokens = function (this: FoundryTokenLayer): FoundryToken[] {
      return self.predicate(original, this);
    };
    this.wrapperInstalled = true;
    log.debug("Installed _getOccludableTokens wrapper via manual prototype patch");
  }

  private removeWrapper(): void {
    if (!this.wrapperInstalled) return;

    if (typeof libWrapper !== "undefined" && libWrapper?.unregister) {
      try {
        libWrapper.unregister(MODULE_ID, OcclusionController.TARGET);
      } catch (err) {
        log.warn("lib-wrapper unregister failed (already removed?)", err);
      }
    } else if (this.layerClass && this.original) {
      this.layerClass.prototype._getOccludableTokens = this.original;
    }

    this.original = null;
    this.layerClass = null;
    this.wrapperInstalled = false;
  }

  /** Ask core to recompute overhead-tile occlusion under the new subject set. */
  private refreshOcclusion(): void {
    try {
      canvas?.perception?.update({ refreshOcclusion: true }, true);
    } catch {
      try {
        canvas?.perception?.update({ refreshOcclusion: true });
      } catch (err) {
        log.debug("occlusion refresh failed", err);
      }
    }
  }
}
