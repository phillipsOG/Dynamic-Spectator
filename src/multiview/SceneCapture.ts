/**
 * SceneCapture — renders the *real* Foundry scene graph from an arbitrary POV /
 * framing into an off-screen PIXI RenderTexture.
 *
 * This is the heart of the "do NOT fake multiple views" requirement. We never
 * screenshot the DOM or duplicate sprites; we render `canvas.stage` — the actual
 * lit, fogged, occluded scene — into a texture with the stage transiently
 * transformed to the viewport's camera, then restore the stage. The main canvas
 * is untouched because every capture saves and restores the stage transform
 * synchronously within the same tick, before PIXI's own render listener runs.
 *
 * Independent vision per viewport is achieved by cycling the shared
 * VisionController's POV target immediately before each capture (see
 * `applyVision`). Because Foundry keeps a *single* global visibility/fog state,
 * this is necessarily time-multiplexed rather than truly parallel — the honest,
 * architecturally-correct approach given one GPU context and one scene state.
 * The RenderScheduler decides how often each viewport is recaptured.
 */

import type { CameraState } from "../types/index.js";
import type { VisionController } from "../spectator/VisionController.js";
import { profiler } from "../util/profiler.js";
import { log } from "../util/logger.js";

interface StageTransform {
  pivotX: number;
  pivotY: number;
  posX: number;
  posY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  visible: boolean;
}

export class SceneCapture {
  private texture: PixiNS.RenderTexture | null = null;
  private texWidth = 0;
  private texHeight = 0;
  private renderScale: number;

  constructor(renderScale = 1) {
    this.renderScale = renderScale;
  }

  get renderTexture(): PixiNS.RenderTexture | null {
    return this.texture;
  }

  setRenderScale(scale: number): void {
    this.renderScale = scale;
  }

  /** Ensure the backing texture matches the requested CSS pixel size. */
  ensureTexture(cssWidth: number, cssHeight: number): PixiNS.RenderTexture {
    const w = Math.max(1, Math.round(cssWidth * this.renderScale));
    const h = Math.max(1, Math.round(cssHeight * this.renderScale));
    if (this.texture && this.texWidth === w && this.texHeight === h) return this.texture;

    if (this.texture) {
      // Resize in place to avoid churning GPU allocations on every window drag.
      try {
        this.texture.resize(w, h);
      } catch {
        this.texture.destroy(true);
        this.texture = null;
      }
    }
    if (!this.texture) {
      this.texture = PIXI.RenderTexture.create({ width: w, height: h, resolution: 1 });
    }
    this.texWidth = w;
    this.texHeight = h;
    return this.texture;
  }

  /**
   * Capture the scene for `token` at `framing` into this viewport's texture.
   *
   * @param vision  Shared vision controller; when `applyVision` is true its POV
   *                is switched to `token` before rendering.
   * @param cssWidth/cssHeight  Viewport size in CSS pixels.
   * @param applyVision  Present the token's true POV (vision/light/fog). When
   *                false the current global vision is used (useful for a GM
   *                streaming full-reveal, and much cheaper).
   */
  capture(
    token: FoundryToken,
    framing: Readonly<CameraState>,
    vision: VisionController,
    cssWidth: number,
    cssHeight: number,
    applyVision: boolean
  ): PixiNS.RenderTexture | null {
    const renderer = canvas?.app?.renderer;
    const stage = canvas?.stage;
    if (!renderer || !stage) return null;

    const tex = this.ensureTexture(cssWidth, cssHeight);
    const saved = this.saveTransform(stage);

    try {
      if (applyVision) {
        profiler.measure("capture.vision", () => vision.setTarget(token, true));
      }

      // Rendering requires the stage visible; force it on as a safety in case
      // something left it hidden, and restore afterwards.
      stage.visible = true;

      // Transform the stage so `framing` maps to the texture centre.
      // Mirrors canvas.pan math but targets the texture, not the window.
      const scale = framing.scale * this.renderScale;
      stage.pivot.set(framing.x, framing.y);
      stage.position.set(this.texWidth / 2, this.texHeight / 2);
      stage.scale.set(scale, scale);
      stage.rotation = framing.rotation;

      profiler.measure("capture.render", () => {
        renderer.render(stage as unknown as PixiNS.Container, { renderTexture: tex, clear: true });
      });
    } catch (err) {
      log.debug("scene capture failed", err);
      return null;
    } finally {
      this.restoreTransform(stage, saved);
    }
    return tex;
  }

  dispose(): void {
    if (this.texture) {
      try {
        this.texture.destroy(true);
      } catch {
        /* already gone */
      }
      this.texture = null;
    }
    this.texWidth = this.texHeight = 0;
  }

  // -- transform save/restore ------------------------------------------------

  private saveTransform(stage: PixiContainer): StageTransform {
    return {
      pivotX: stage.pivot.x,
      pivotY: stage.pivot.y,
      posX: stage.position.x,
      posY: stage.position.y,
      scaleX: stage.scale.x,
      scaleY: stage.scale.y,
      rotation: stage.rotation,
      visible: stage.visible
    };
  }

  private restoreTransform(stage: PixiContainer, t: StageTransform): void {
    stage.pivot.set(t.pivotX, t.pivotY);
    stage.position.set(t.posX, t.posY);
    stage.scale.set(t.scaleX, t.scaleY);
    stage.rotation = t.rotation;
    stage.visible = t.visible;
  }
}
