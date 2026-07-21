/**
 * SpectatorManager — the single-token spectator feature.
 *
 * Wires together the three concerns of "spectate this token":
 *   1. PermissionManager — may this user do it at all?
 *   2. VisionController  — present the token's true POV (vision/light/fog).
 *   3. CameraLock        — lock and follow the camera.
 *
 * It also owns the on-canvas "you are spectating" indicator and emits the public
 * `spectateStart` / `spectateStop` hooks so other modules can react.
 *
 * Exactly one token is spectated at a time on a given client. Starting a new
 * spectate transparently retargets the existing session (no flicker).
 */

import { FLAG_SCOPE, HOOKS } from "../constants.js";
import { PermissionManager } from "../permissions/PermissionManager.js";
import { getSettings } from "../settings.js";
import type { CameraConfig } from "../types/index.js";
import { log } from "../util/logger.js";
import { CameraLock } from "./CameraLock.js";
import { OcclusionController } from "./OcclusionController.js";
import { VisionController } from "./VisionController.js";

export class SpectatorManager {
  private readonly vision = new VisionController();
  private readonly occlusion = new OcclusionController();
  private readonly camera = new CameraLock();
  private currentTokenId: string | null = null;
  /** Actor behind the spectated token, for cross-scene re-follow. */
  private currentActorId: string | null = null;

  /** Id of the token currently being spectated, or null. */
  get tokenId(): string | null {
    return this.currentTokenId;
  }

  get active(): boolean {
    return this.currentTokenId !== null;
  }

  /** Resolve the effective camera config from settings. */
  private cameraConfig(): CameraConfig {
    return getSettings().camera;
  }

  /**
   * Start (or retarget) spectating a token by id. Returns true on success.
   * `exclusivePov` clamps the view to strictly the token's POV (no info leak).
   */
  start(tokenId: string, exclusivePov = true): boolean {
    const token = canvas?.tokens?.get(tokenId);
    if (!token) {
      log.warn(`spectate: token ${tokenId} not found on this scene`);
      return false;
    }

    const decision = PermissionManager.canSpectate(game.user, token);
    if (!decision.allowed) {
      ui.notifications.warn(
        game.i18n.format("dynamic-spectator.notify.notAllowed", { name: token.name })
      );
      log.debug(`spectate denied for ${token.name}: ${decision.reason}`);
      return false;
    }

    const retarget = this.active;

    this.vision.activate(token, exclusivePov);
    // Reveal the roofs / overhead tiles this token is under so we see inside
    // buildings and on upper floors rather than the rooftop (height-aware).
    this.occlusion.activate(token, exclusivePov);
    if (retarget) this.camera.retarget(token);
    else this.camera.lock(token, this.cameraConfig());

    this.setIndicator(this.currentTokenId, false);
    this.currentTokenId = token.id;
    this.currentActorId = token.actor?.id ?? null;
    this.setIndicator(token.id, true);

    Hooks.callAll(HOOKS.spectateStart, { tokenId: token.id, exclusive: exclusivePov });
    ui.notifications.info(
      game.i18n.format("dynamic-spectator.notify.spectating", { name: token.name })
    );
    log.info(`Spectating "${token.name}"`);
    return true;
  }

  /** Stop spectating and restore normal vision + camera. */
  stop(): void {
    if (!this.active) return;
    const prev = this.currentTokenId;
    this.setIndicator(prev, false);
    this.vision.deactivate();
    this.occlusion.deactivate();
    this.camera.release();
    this.currentTokenId = null;
    this.currentActorId = null;
    Hooks.callAll(HOOKS.spectateStop, { tokenId: prev });
    log.info("Stopped spectating");
  }

  /** The actor currently being spectated (for cross-scene re-follow). */
  get actorId(): string | null {
    return this.currentActorId;
  }

  /**
   * After a scene change, try to keep spectating the same *character* by finding
   * a token for the same actor on the new scene. Returns true if re-followed.
   */
  attemptCrossSceneFollow(): boolean {
    if (!this.currentActorId) return false;
    const replacement = (canvas?.tokens?.placeables ?? []).find(
      (t) => t.actor?.id === this.currentActorId
    );
    if (!replacement) return false;
    return this.start(replacement.id);
  }

  /** Toggle spectating a token: start if not this token, else stop. */
  toggle(tokenId: string): void {
    if (this.currentTokenId === tokenId) this.stop();
    else this.start(tokenId);
  }

  /**
   * React to a change on the spectated token. Called by the SyncBridge on
   * movement / vision / elevation updates so the POV stays live.
   */
  onTokenUpdate(tokenId: string): void {
    if (this.currentTokenId !== tokenId) return;
    this.vision.refresh();
    // Keep roof reveal in step as the token moves between/into structures.
    this.occlusion.refresh();
  }

  /** The spectated token was removed / left the scene — tear down cleanly. */
  onTokenGone(tokenId: string): void {
    if (this.currentTokenId !== tokenId) return;
    log.debug("spectated token gone; stopping");
    this.stop();
  }

  // -- indicator -------------------------------------------------------------

  /** Toggle a subtle pulsing ring on the token being spectated (local only). */
  private setIndicator(tokenId: string | null, on: boolean): void {
    if (!tokenId) return;
    const token = canvas?.tokens?.get(tokenId);
    if (!token) return;
    try {
      // Store on a private field the ViewportOverlay / token HUD can read; the
      // actual ring is drawn by refreshToken (see controls.ts hook).
      (token as unknown as Record<string, unknown>)[`${FLAG_SCOPE}-spectating`] = on;
      token.renderFlags?.set?.({ refreshState: true });
    } catch (err) {
      log.debug("indicator toggle failed", err);
    }
  }
}
