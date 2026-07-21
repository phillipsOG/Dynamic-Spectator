/**
 * VisionController — the mechanism that makes the local client compute visibility,
 * lighting, and fog *as the spectated token would perceive them*.
 *
 * How Foundry vision actually works (and therefore how we hook it):
 *   Foundry builds the visibility mask each frame from the set of active
 *   "vision sources". A token becomes a vision source when
 *   `Token#_isVisionSource()` returns true — normally true only for tokens the
 *   current user owns/observes (plus the GM's global sight). By wrapping that
 *   method we can make an *arbitrary* token contribute vision to *our* client,
 *   which is exactly "see what that token sees".
 *
 *   In EXCLUSIVE mode we additionally suppress the client's own tokens as vision
 *   sources, so the resulting view is precisely the spectated token's POV and
 *   never leaks information from tokens the spectator happens to own. This is the
 *   guard that stops spectating from becoming an information cheat.
 *
 * Lighting, darkness, darkvision, blindsight/truesight and vision-mode are all
 * derived by core from the token's own `sight` configuration once it is an active
 * vision source, so they come along for free — we do not, and must not,
 * re-implement them.
 *
 * Patching strategy: prefer lib-wrapper (clean, conflict-aware). If it is not
 * installed we fall back to a manual, fully-reversible prototype wrapper. Only
 * one wrapper is ever installed at a time and `deactivate()` always restores the
 * original, so we never leave the client in a modified state.
 */

import { MODULE_ID } from "../constants.js";
import { log } from "../util/logger.js";

type VisionSourcePredicate = (this: FoundryToken) => boolean;

export class VisionController {
  /** The token whose POV we are currently presenting, or null when inactive. */
  private spectated: FoundryToken | null = null;

  /** When true, only the spectated token contributes vision (true POV clamp). */
  private exclusive = true;

  /** Saved original method for manual-wrapper teardown. */
  private originalIsVisionSource: VisionSourcePredicate | null = null;

  /** lib-wrapper registration handle / flag. */
  private wrapperInstalled = false;

  /** The Token class whose prototype we patched (cached for teardown). */
  private tokenClass: { prototype: FoundryToken } | null = null;

  get active(): boolean {
    return this.spectated !== null;
  }

  get token(): FoundryToken | null {
    return this.spectated;
  }

  /**
   * Begin presenting `token`'s POV on this client.
   * @param exclusive Suppress the client's own tokens so the view is a pure POV.
   */
  activate(token: FoundryToken, exclusive = true): void {
    if (!token?.document) {
      log.warn("VisionController.activate called with an invalid token");
      return;
    }

    this.spectated = token;
    this.exclusive = exclusive;
    this.installWrapper();

    if (token.document.sight?.enabled === false) {
      log.debug(
        `Spectated token "${token.name}" has sight disabled; POV will reflect ambient/scene illumination only.`
      );
    }

    this.reinitializeVision();
    this.refreshPerception();
    log.debug(`VisionController active on "${token.name}" (exclusive=${exclusive})`);
  }

  /** Stop presenting a POV and fully restore normal client vision. */
  deactivate(): void {
    if (!this.active) return;
    this.spectated = null;
    this.removeWrapper();
    this.reinitializeVision();
    this.refreshPerception();
    log.debug("VisionController deactivated; client vision restored");
  }

  /** Re-run vision when the spectated token changes (movement, vision update, …). */
  refresh(): void {
    if (!this.active) return;
    this.reinitializeVision();
    this.refreshPerception();
  }

  /**
   * Swap the POV token *without* tearing the wrapper down and back up, so
   * retargeting an active session never flashes the user's own vision.
   */
  setTarget(token: FoundryToken, exclusive = true): void {
    this.spectated = token;
    this.exclusive = exclusive;
    this.installWrapper(); // idempotent
    this.reinitializeVision();
    this.forceRecompute();
  }

  /**
   * Best-effort *synchronous* visibility recompute, for off-screen capture where
   * we cannot wait for Foundry's debounced perception tick. Tries the known
   * synchronous entry points across core versions; if none are synchronous the
   * capture simply renders with vision that is at most one frame stale (which is
   * imperceptible while following) — documented in ARCHITECTURE.md.
   */
  forceRecompute(): void {
    const c = canvas as unknown as Record<string, any>;
    try {
      // v11–v13: CanvasVisibility exposes a synchronous refresh.
      if (typeof c.visibility?.refresh === "function") c.visibility.refresh();
      // Effects layer refreshVisibility (present in several versions).
      if (typeof c.effects?.refreshVisibility === "function") c.effects.refreshVisibility();
      // Lighting refresh for darkness / illumination.
      if (typeof c.effects?.refreshLighting === "function") c.effects.refreshLighting();
    } catch (err) {
      log.debug("forceRecompute partial failure (non-fatal)", err);
    }
    // Also schedule the normal debounced refresh so the async path stays correct.
    this.refreshPerception();
  }

  // -- internals -------------------------------------------------------------

  /** The predicate installed in place of Token#_isVisionSource while spectating. */
  private predicate(original: VisionSourcePredicate, self: FoundryToken): boolean {
    const target = this.spectated;
    if (!target) return original.call(self);

    // The spectated token always contributes vision.
    if (self.id === target.id) return true;

    // In exclusive mode nothing else does — this is the anti-cheat POV clamp.
    if (this.exclusive) return false;

    // Non-exclusive: keep the client's normal vision sources too.
    return original.call(self);
  }

  private resolveTokenClass(): { prototype: FoundryToken } | null {
    // The concrete Token class is exposed via CONFIG in modern Foundry.
    const cls = CONFIG?.Token?.objectClass ?? (globalThis as Record<string, unknown>).Token;
    return (cls as { prototype: FoundryToken }) ?? null;
  }

  private installWrapper(): void {
    if (this.wrapperInstalled) return;
    const target = "CONFIG.Token.objectClass.prototype._isVisionSource";

    if (typeof libWrapper !== "undefined" && libWrapper?.register) {
      const self = this;
      libWrapper.register(
        MODULE_ID,
        target,
        function (this: any, wrapped: (...a: any[]) => any) {
          return self.predicate(wrapped as VisionSourcePredicate, this as FoundryToken);
        },
        "MIXED"
      );
      this.wrapperInstalled = true;
      log.debug("Installed _isVisionSource wrapper via lib-wrapper");
      return;
    }

    // Manual fallback: patch the prototype directly, remembering the original.
    const cls = this.resolveTokenClass();
    if (!cls?.prototype) {
      log.error("Could not resolve the Token class to install a vision wrapper");
      return;
    }
    this.tokenClass = cls;
    this.originalIsVisionSource = cls.prototype._isVisionSource as VisionSourcePredicate;
    const original = this.originalIsVisionSource;
    const self = this;
    cls.prototype._isVisionSource = function (this: FoundryToken): boolean {
      return self.predicate(original, this);
    };
    this.wrapperInstalled = true;
    log.debug("Installed _isVisionSource wrapper via manual prototype patch");
  }

  private removeWrapper(): void {
    if (!this.wrapperInstalled) return;

    if (typeof libWrapper !== "undefined" && libWrapper?.unregister) {
      try {
        libWrapper.unregister(MODULE_ID, "CONFIG.Token.objectClass.prototype._isVisionSource");
      } catch (err) {
        log.warn("lib-wrapper unregister failed (already removed?)", err);
      }
    } else if (this.tokenClass && this.originalIsVisionSource) {
      this.tokenClass.prototype._isVisionSource = this.originalIsVisionSource;
    }

    this.originalIsVisionSource = null;
    this.tokenClass = null;
    this.wrapperInstalled = false;
  }

  /** Ask every token to (re)build its vision source under the new predicate. */
  private reinitializeVision(): void {
    const placeables: FoundryToken[] = canvas?.tokens?.placeables ?? [];
    for (const t of placeables) {
      try {
        // Method name has shifted across core versions; call whichever exists.
        if (typeof t.initializeVisionSource === "function") t.initializeVisionSource({ deleted: false });
        else if (typeof t.updateVisionSource === "function") t.updateVisionSource();
      } catch (err) {
        log.debug(`vision reinit skipped for ${t.name}`, err);
      }
    }
  }

  /**
   * Trigger a full perception refresh. Foundry's perception flags have changed
   * names across versions, so we pass the superset and let core ignore unknowns.
   */
  private refreshPerception(): void {
    try {
      canvas?.perception?.update(
        {
          initializeVision: true,
          refreshVision: true,
          refreshLighting: true,
          refreshOcclusion: true,
          refreshFog: true,
          forceUpdateFog: true
        },
        true
      );
    } catch (err) {
      // Older signature (no v2 flag) — retry without it.
      try {
        canvas?.perception?.update({ refreshVision: true, refreshLighting: true });
      } catch (err2) {
        log.warn("perception refresh failed", err ?? err2);
      }
    }
  }
}
