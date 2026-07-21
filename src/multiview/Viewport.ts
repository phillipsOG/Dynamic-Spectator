/**
 * Viewport — a single MultiView camera: its descriptor, an independent
 * CameraController, its own SceneCapture (off-screen RenderTexture), the PIXI
 * Sprite that displays that texture in the overlay, and the derived overlay data
 * (name / HP / elevation / …).
 *
 * The sprite is a child of the manager's overlay container, which lives on the
 * main app stage, so its texture — produced by the main renderer — samples
 * correctly (same WebGL context). This is why we never spin up a second PIXI
 * Application per viewport, which would live in an isolated GL context and could
 * not share textures.
 */

import type { CameraConfig, LayoutRect, OverlayData, ViewportDescriptor } from "../types/index.js";
import type { VisionController } from "../spectator/VisionController.js";
import { CameraController } from "./CameraController.js";
import { SceneCapture } from "./SceneCapture.js";
import { dist, heading } from "../util/math.js";

export class Viewport {
  readonly descriptor: ViewportDescriptor;
  private readonly camera: CameraController;
  private readonly capture: SceneCapture;
  private sprite: PixiNS.Sprite | null = null;

  private lastCenter: { x: number; y: number } | null = null;
  private lastHeading: number | undefined;
  private lastCaptureAt = 0;
  private rect: LayoutRect | null = null;

  constructor(descriptor: ViewportDescriptor, renderScale: number) {
    this.descriptor = descriptor;
    this.camera = new CameraController(descriptor.camera, descriptor.rememberedScale ?? 1);
    this.capture = new SceneCapture(renderScale);
  }

  get id(): string {
    return this.descriptor.id;
  }

  get tokenId(): string {
    return this.descriptor.tokenId;
  }

  get token(): FoundryToken | undefined {
    return canvas?.tokens?.get(this.descriptor.tokenId);
  }

  get displaySprite(): PixiNS.Sprite | null {
    return this.sprite;
  }

  // -- lifecycle -------------------------------------------------------------

  attach(overlayRoot: PixiContainer): void {
    if (!this.sprite) this.sprite = new PIXI.Sprite();
    overlayRoot.addChild(this.sprite);
  }

  destroy(): void {
    this.sprite?.destroy({ children: true });
    this.sprite = null;
    this.capture.dispose();
  }

  setCameraConfig(config: CameraConfig): void {
    this.camera.setConfig(config);
  }

  setRenderScale(scale: number): void {
    this.capture.setRenderScale(scale);
  }

  setZoom(scale: number): void {
    this.camera.setZoom(scale);
    this.descriptor.rememberedScale = scale;
  }

  get zoom(): number {
    return this.camera.zoom;
  }

  // -- per-frame -------------------------------------------------------------

  /** Advance the camera toward the token. Cheap; runs every frame. */
  advanceCamera(dtMs: number): void {
    const token = this.token;
    if (!token) return;
    this.camera.follow(token);
    this.camera.advance(dtMs);

    // Track heading for the direction overlay.
    const c = token.center;
    if (this.lastCenter) {
      const h = heading(c.x - this.lastCenter.x, c.y - this.lastCenter.y);
      if (h !== undefined) this.lastHeading = h;
    }
    this.lastCenter = { x: c.x, y: c.y };
  }

  /** Force the camera onto the token instantly (teleport / scene change). */
  snapCamera(): void {
    const token = this.token;
    if (token) this.camera.follow(token);
    this.camera.snap();
  }

  /**
   * Capture the scene from this viewport's POV and update the display sprite.
   * Returns false if there was nothing to render (token gone / no rect).
   */
  renderFrame(vision: VisionController, applyVision: boolean, now: number): boolean {
    const token = this.token;
    if (!token || !this.rect || !this.sprite) return false;

    const tex = this.capture.capture(
      token,
      this.camera.framing,
      vision,
      this.rect.width,
      this.rect.height,
      applyVision
    );
    if (!tex) return false;

    this.sprite.texture = tex;
    this.applySpriteBounds();
    this.lastCaptureAt = now;
    return true;
  }

  get lastRenderedAt(): number {
    return this.lastCaptureAt;
  }

  // -- layout ----------------------------------------------------------------

  applyRect(rect: LayoutRect): void {
    this.rect = rect;
    this.descriptor.primary = rect.primary;
    this.applySpriteBounds();
  }

  get currentRect(): LayoutRect | null {
    return this.rect;
  }

  private applySpriteBounds(): void {
    if (!this.sprite || !this.rect) return;
    this.sprite.position.set(this.rect.x, this.rect.y);
    // Texture is rendered at renderScale; scale the sprite to fill the CSS rect.
    this.sprite.width = this.rect.width;
    this.sprite.height = this.rect.height;
    this.sprite.visible = !this.descriptor.collapsed;
  }

  // -- overlay data ----------------------------------------------------------

  /**
   * Resolve overlay data for this viewport. `reference` is an optional world
   * point (usually the primary token / party centroid) for the distance field.
   */
  computeOverlay(reference?: { x: number; y: number }): OverlayData {
    const token = this.token;
    const data: OverlayData = { viewportId: this.id, primary: this.descriptor.primary };
    if (!token) return data;

    const actor = token.actor;
    data.characterName = this.descriptor.label ?? actor?.name ?? token.name;
    data.playerName = this.owningPlayerName(token);
    data.hp = this.resolveHp(actor);
    data.conditions = this.resolveConditions(actor);
    data.statusEffects = data.conditions;
    data.elevation = token.document.elevation ?? 0;
    data.scene = canvas?.scene?.name;
    data.direction = this.lastHeading;

    if (reference) {
      const c = token.center;
      const gridSize = canvas?.grid?.size ?? 100;
      const gridDistance = (canvas?.scene as any)?.grid?.distance ?? 5;
      const px = dist(c.x, c.y, reference.x, reference.y);
      data.distance = Math.round((px / gridSize) * gridDistance);
    }
    return data;
  }

  private owningPlayerName(token: FoundryToken): string | undefined {
    const owner = game.users.find(
      (u) => !u.isGM && u.active && token.document.testUserPermission(u, "OWNER")
    );
    return owner?.name;
  }

  /** HP resolver with fallbacks across common systems. */
  private resolveHp(actor: FoundryActor | null): OverlayData["hp"] {
    if (!actor) return undefined;
    const sys = actor.system ?? {};
    const candidates = [
      sys?.attributes?.hp, // dnd5e, sw5e, a5e …
      sys?.health, // many systems
      sys?.hp, // simple worldbuilding, etc.
      sys?.resources?.health
    ];
    for (const hp of candidates) {
      if (hp && typeof hp.value === "number" && typeof hp.max === "number") {
        return { value: hp.value, max: hp.max, temp: typeof hp.temp === "number" ? hp.temp : undefined };
      }
    }
    return undefined;
  }

  /** Active conditions/status effects, system-agnostic. */
  private resolveConditions(actor: FoundryActor | null): string[] {
    if (!actor) return [];
    const out = new Set<string>();
    // v11+: actor.statuses is a Set of status ids.
    const statuses = (actor as unknown as { statuses?: Set<string> }).statuses;
    if (statuses && typeof statuses.forEach === "function") {
      statuses.forEach((s) => out.add(s));
    }
    // Also scan effects for readable labels.
    const effects = (actor as unknown as { effects?: Iterable<{ name?: string; label?: string; disabled?: boolean }> }).effects;
    if (effects) {
      for (const e of effects) {
        if (e?.disabled) continue;
        const name = e?.name ?? e?.label;
        if (name) out.add(name);
      }
    }
    return [...out];
  }
}
