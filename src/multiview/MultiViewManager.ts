/**
 * MultiViewManager — orchestrates the dynamic multi-camera system.
 *
 * Owns:
 *   • the PIXI overlay container (a child of the main app stage) that holds each
 *     viewport's display sprite — sharing the main renderer's GL context so the
 *     off-screen RenderTextures sample correctly;
 *   • a single shared VisionController that is cycled per capture to give each
 *     viewport an independent POV;
 *   • the RenderScheduler (frame budget / priority / adaptive cadence);
 *   • the ticker loop that advances cameras every frame and captures a budgeted
 *     subset;
 *   • all view-management operations (add / remove / primary / pin / collapse /
 *     swap / reorder / solo / paginate) and the auto-grouping helpers.
 *
 * The visual chrome and text overlays are rendered by the DOM layer
 * (MultiViewApp), which subscribes via `setOnFrame`. The manager stays free of
 * DOM concerns; the app stays free of rendering concerns.
 */

import { HOOKS, PerformanceMode } from "../constants.js";
import { PermissionManager } from "../permissions/PermissionManager.js";
import { getSettings } from "../settings.js";
import { VisionController } from "../spectator/VisionController.js";
import type { LayoutBounds, LayoutRect, OverlayData, ViewportDescriptor } from "../types/index.js";
import { log } from "../util/logger.js";
import { GroupingEngine } from "./GroupingEngine.js";
import { LayoutEngine } from "./LayoutEngine.js";
import { RenderScheduler } from "./RenderScheduler.js";
import { Viewport } from "./Viewport.js";

export interface FrameEvent {
  rects: LayoutRect[];
  overlays: OverlayData[];
  page: number;
  pageCount: number;
  diagnostics: { fps: number; captureBudget: number; frame: number };
}

type FrameListener = (e: FrameEvent) => void;

export class MultiViewManager {
  private viewports: Viewport[] = [];
  private overlayRoot: PixiContainer | null = null;
  private readonly vision = new VisionController();
  private scheduler: RenderScheduler;

  private opened = false;
  private readonly tick = (): void => this.onTick();
  private lastTime = 0;
  private lastOverlayEmit = 0;

  private soloId: string | null = null;
  private page = 0;

  private frameListener: FrameListener | null = null;

  constructor() {
    const s = getSettings();
    this.scheduler = new RenderScheduler({
      frameRateCap: s.frameRateCap,
      secondaryCadence: s.secondaryCadence,
      performanceMode: s.performanceMode,
      maxCameras: s.maxCameras
    });
  }

  // -- lifecycle -------------------------------------------------------------

  get isOpen(): boolean {
    return this.opened;
  }

  get count(): number {
    return this.viewports.length;
  }

  setOnFrame(listener: FrameListener | null): void {
    this.frameListener = listener;
  }

  open(): void {
    if (this.opened) return;
    if (!canvas?.ready || !canvas.app?.stage) {
      log.warn("MultiView cannot open: canvas not ready");
      return;
    }
    // Overlay container sits on top of the scene on the main app stage.
    // The overlay is a child of the root stage (which shares the renderer's GL
    // context, so our RenderTextures sample correctly). BUT the root stage is the
    // *panned* canvas stage, so (a) we counter-transform the overlay each frame to
    // pin it to screen space (see applyOverlayTransform), and (b) we hide it during
    // captures so the scene render never includes our own grid (no feedback).
    this.overlayRoot = new PIXI.Container();
    canvas.app.stage.addChild(this.overlayRoot);

    for (const vp of this.viewports) vp.attach(this.overlayRoot);

    this.applySettings();
    this.lastTime = performance.now();
    canvas.app.ticker.add(this.tick);
    this.opened = true;
    Hooks.callAll(HOOKS.multiViewOpen, { count: this.viewports.length });
    log.info(`MultiView opened with ${this.viewports.length} viewport(s)`);
  }

  close(): void {
    if (!this.opened) return;
    canvas?.app?.ticker?.remove(this.tick);

    for (const vp of this.viewports) vp.destroy();
    this.overlayRoot?.destroy({ children: true });
    this.overlayRoot = null;

    // Restore normal vision.
    this.vision.deactivate();

    this.opened = false;
    Hooks.callAll(HOOKS.multiViewClose, {});
    log.info("MultiView closed");
  }

  /** Tear down entirely (called on scene change / disable). */
  dispose(): void {
    this.close();
    this.viewports = [];
    this.soloId = null;
    this.page = 0;
  }

  // -- viewport management ---------------------------------------------------

  /** Add a viewport for a token if permitted and not already present. */
  addViewport(tokenId: string, opts?: Partial<ViewportDescriptor>): Viewport | null {
    const token = canvas?.tokens?.get(tokenId);
    if (!token) {
      log.warn(`addViewport: token ${tokenId} not found`);
      return null;
    }
    if (!PermissionManager.allowed(game.user, token)) {
      ui.notifications.warn(game.i18n.format("dynamic-spectator.notify.notAllowed", { name: token.name }));
      return null;
    }
    if (this.viewports.some((v) => v.tokenId === tokenId)) {
      return this.viewports.find((v) => v.tokenId === tokenId) ?? null;
    }

    const s = getSettings();
    const descriptor: ViewportDescriptor = {
      id: foundry.utils.randomID(12),
      tokenId,
      actorId: token.actor?.id,
      sceneId: canvas.scene?.id ?? "",
      primary: this.viewports.length === 0,
      pinned: false,
      collapsed: false,
      slot: -1,
      camera: { ...s.camera },
      ...opts
    };
    const vp = new Viewport(descriptor, this.effectiveRenderScale());
    this.viewports.push(vp);
    if (this.opened && this.overlayRoot) vp.attach(this.overlayRoot);
    vp.snapCamera();

    this.emitChanged();
    return vp;
  }

  removeViewport(viewportId: string): void {
    const idx = this.viewports.findIndex((v) => v.id === viewportId);
    if (idx < 0) return;
    const [removed] = this.viewports.splice(idx, 1);
    const wasPrimary = removed.descriptor.primary;
    removed.destroy();
    if (this.soloId === viewportId) this.soloId = null;
    // Reassign primary if we removed it.
    if (wasPrimary && this.viewports.length > 0) this.viewports[0].descriptor.primary = true;
    this.clampPage();
    this.emitChanged();
  }

  clear(): void {
    for (const vp of this.viewports) vp.destroy();
    this.viewports = [];
    this.soloId = null;
    this.page = 0;
    this.emitChanged();
  }

  setPrimary(viewportId: string): void {
    let found = false;
    for (const vp of this.viewports) {
      const isTarget = vp.id === viewportId;
      vp.descriptor.primary = isTarget;
      found ||= isTarget;
    }
    if (found) this.emitChanged();
  }

  togglePin(viewportId: string): void {
    const vp = this.get(viewportId);
    if (!vp) return;
    vp.descriptor.pinned = !vp.descriptor.pinned;
    this.emitChanged();
  }

  toggleCollapse(viewportId: string): void {
    const vp = this.get(viewportId);
    if (!vp) return;
    vp.descriptor.collapsed = !vp.descriptor.collapsed;
    this.emitChanged();
  }

  /** Temporary solo (fullscreen one viewport); pass null to return to grid. */
  solo(viewportId: string | null): void {
    this.soloId = viewportId && this.get(viewportId) ? viewportId : null;
    this.emitChanged();
  }

  toggleSolo(viewportId: string): void {
    this.solo(this.soloId === viewportId ? null : viewportId);
  }

  /** Swap two viewports' positions in the ordered list (drag-and-drop). */
  swap(aId: string, bId: string): void {
    const ai = this.viewports.findIndex((v) => v.id === aId);
    const bi = this.viewports.findIndex((v) => v.id === bId);
    if (ai < 0 || bi < 0) return;
    [this.viewports[ai], this.viewports[bi]] = [this.viewports[bi], this.viewports[ai]];
    this.emitChanged();
  }

  /** Reorder to an explicit list of viewport ids (drag-and-drop reflow). */
  reorder(order: string[]): void {
    const byId = new Map(this.viewports.map((v) => [v.id, v]));
    const next: Viewport[] = [];
    for (const id of order) {
      const vp = byId.get(id);
      if (vp) {
        next.push(vp);
        byId.delete(id);
      }
    }
    for (const leftover of byId.values()) next.push(leftover); // keep any unlisted
    this.viewports = next;
    this.emitChanged();
  }

  setZoom(viewportId: string, scale: number): void {
    this.get(viewportId)?.setZoom(scale);
  }

  private get(viewportId: string): Viewport | undefined {
    return this.viewports.find((v) => v.id === viewportId);
  }

  /** A token was deleted / left the scene: drop any viewport tracking it. */
  onTokenDeleted(tokenId: string): void {
    const affected = this.viewports.filter((v) => v.tokenId === tokenId).map((v) => v.id);
    for (const id of affected) this.removeViewport(id);
    if (this.opened && this.viewports.length === 0) this.close();
  }

  /**
   * Re-map viewports to the newly active scene by actor id (cross-scene follow).
   * Viewports whose actor has no token on the new scene are dropped. Returns the
   * number of viewports still alive afterward.
   */
  remapForNewScene(): number {
    const survivors: Viewport[] = [];
    for (const vp of this.viewports) {
      const actorId = vp.descriptor.actorId;
      const replacement = actorId
        ? (canvas?.tokens?.placeables ?? []).find((t) => t.actor?.id === actorId)
        : undefined;
      if (replacement) {
        vp.descriptor.tokenId = replacement.id;
        vp.descriptor.sceneId = canvas?.scene?.id ?? "";
        vp.snapCamera();
        survivors.push(vp);
      } else {
        vp.destroy();
      }
    }
    this.viewports = survivors;
    if (this.viewports.length && !this.viewports.some((v) => v.descriptor.primary)) {
      this.viewports[0].descriptor.primary = true;
    }
    this.clampPage();
    this.emitChanged();
    return this.viewports.length;
  }

  // -- pagination ------------------------------------------------------------

  get pageCount(): number {
    const per = Math.max(1, getSettings().maxCameras);
    return Math.max(1, Math.ceil(this.activeViewports().length / per));
  }

  nextPage(): void {
    this.page = (this.page + 1) % this.pageCount;
    this.emitChanged();
  }

  prevPage(): void {
    this.page = (this.page - 1 + this.pageCount) % this.pageCount;
    this.emitChanged();
  }

  private clampPage(): void {
    this.page = Math.min(this.page, this.pageCount - 1);
  }

  // -- auto grouping (GM dashboard "observe" helpers) ------------------------

  /** Replace viewports with one per token in the current party (player-owned). */
  observeParty(): void {
    const tokens = (canvas?.tokens?.placeables ?? []).filter(
      (t) => t.actor?.hasPlayerOwner && PermissionManager.allowed(game.user, t)
    );
    this.rebuildFrom(tokens);
  }

  /** One viewport per active combatant. */
  observeCombatants(): void {
    const combat = game.combat;
    const ids: string[] = combat?.combatants
      ? combat.combatants.map((c: any) => c.token?.id).filter(Boolean)
      : [];
    const tokens = ids
      .map((id: string) => canvas?.tokens?.get(id))
      .filter((t): t is FoundryToken => t !== undefined && PermissionManager.allowed(game.user, t));
    this.rebuildFrom(tokens);
  }

  /** One viewport per non-player token (GM oversight). */
  observeNpcs(): void {
    const tokens = (canvas?.tokens?.placeables ?? []).filter(
      (t) => !t.actor?.hasPlayerOwner && PermissionManager.allowed(game.user, t)
    );
    this.rebuildFrom(tokens);
  }

  /**
   * Height-aware auto grouping: build viewports only for groups within the
   * elevation threshold of `observerElevation`, one viewport per group leader
   * (the group's first token), grouping the rest behind it.
   */
  observeGroupsAtElevation(observerElevation: number): void {
    const s = getSettings();
    const tokens = PermissionManager.spectatableTokens(game.user);
    const groups = GroupingEngine.group(tokens, {
      elevationThreshold: s.elevationThreshold,
      groupingDistance: s.groupingDistance,
      gridSize: canvas?.grid?.size ?? 100
    });
    const observed = GroupingEngine.observedAtElevation(groups, observerElevation, s.elevationThreshold);
    const leaders = observed.map((g) => g.tokenIds[0]).filter(Boolean);
    this.rebuildFrom(leaders.map((id) => canvas!.tokens!.get(id)).filter((t): t is FoundryToken => Boolean(t)));
  }

  /** Auto-group all spectatable tokens and cap at maxCameras group leaders. */
  observeAuto(): void {
    const s = getSettings();
    const tokens = PermissionManager.spectatableTokens(game.user);
    if (!s.autoGrouping) {
      this.rebuildFrom(tokens.slice(0, s.maxCameras));
      return;
    }
    const groups = GroupingEngine.group(tokens, {
      elevationThreshold: s.elevationThreshold,
      groupingDistance: s.groupingDistance,
      gridSize: canvas?.grid?.size ?? 100
    });
    const leaders = groups
      .map((g) => g.tokenIds[0])
      .filter(Boolean)
      .map((id) => canvas!.tokens!.get(id))
      .filter((t): t is FoundryToken => Boolean(t));
    this.rebuildFrom(leaders);
  }

  /** Hard ceiling on total viewports so a huge scene can't spawn runaway cameras. */
  private static readonly MAX_TOTAL_VIEWPORTS = 32;

  private rebuildFrom(tokens: FoundryToken[]): void {
    this.clear();
    // Add all provided tokens (bounded); anything beyond `maxCameras` paginates.
    for (const t of tokens.slice(0, MultiViewManager.MAX_TOTAL_VIEWPORTS)) {
      this.addViewport(t.id);
    }
    if (this.viewports[0]) this.viewports[0].descriptor.primary = true;
    this.emitChanged();
  }

  // -- settings / resize -----------------------------------------------------

  applySettings(): void {
    const s = getSettings();
    this.scheduler.setConfig({
      frameRateCap: s.frameRateCap,
      secondaryCadence: s.secondaryCadence,
      performanceMode: s.performanceMode,
      maxCameras: s.maxCameras
    });
    const scale = this.effectiveRenderScale();
    for (const vp of this.viewports) {
      vp.setCameraConfig(s.camera);
      vp.setRenderScale(scale);
    }
    this.clampPage();
    this.emitChanged();
  }

  onResize(): void {
    // Layout recomputes from live window size each frame emit; nothing to cache.
    this.emitChanged();
  }

  private effectiveRenderScale(): number {
    const s = getSettings();
    // Streaming/quality favours crispness; performance/battery downscale captures.
    if (s.performanceMode === PerformanceMode.Performance) return Math.min(s.renderScale, 0.75);
    if (s.performanceMode === PerformanceMode.Battery) return Math.min(s.renderScale, 0.6);
    return s.renderScale;
  }

  // -- the loop --------------------------------------------------------------

  private activeViewports(): Viewport[] {
    if (this.soloId) {
      const vp = this.get(this.soloId);
      return vp ? [vp] : this.viewports;
    }
    return this.viewports;
  }

  /** Viewports visible on the current page (pagination + solo aware). */
  private visibleViewports(): Viewport[] {
    const active = this.activeViewports();
    if (this.soloId) return active;
    const per = Math.max(1, getSettings().maxCameras);
    const start = this.page * per;
    return active.slice(start, start + per);
  }

  private onTick(): void {
    if (!this.opened || !this.overlayRoot) return;
    const now = performance.now();
    const dt = Math.min(now - this.lastTime, 100);
    this.lastTime = now;

    const visible = this.visibleViewports();

    // Hide sprites for non-visible viewports (other pages).
    for (const vp of this.viewports) {
      const sprite = vp.displaySprite;
      if (sprite) sprite.visible = false;
    }

    const rects = this.computeLayout(visible);
    for (const vp of visible) {
      const rect = rects.find((r) => r.viewportId === vp.id);
      if (rect) vp.applyRect(rect);
    }

    const plan = this.scheduler.plan(visible, now);
    for (const vp of plan.advance) vp.advanceCamera(dt);

    // Captures render the shared canvas stage into off-screen textures. Because
    // our overlay is a child of that same stage, hide it for the duration so the
    // grid never renders itself into a viewport (feedback), then restore it.
    if (plan.capture.length > 0) {
      this.overlayRoot.visible = false;
      for (const vp of plan.capture) vp.renderFrame(this.vision, true, now);
      this.overlayRoot.visible = true;
    }

    // Pin the overlay to screen space against the live canvas pan/zoom.
    this.applyOverlayTransform();

    // Emit overlay/layout data to the DOM app at a throttled rate (~8Hz).
    if (now - this.lastOverlayEmit > 120) {
      this.lastOverlayEmit = now;
      this.emitFrame(rects, visible);
    }
  }

  /**
   * Counter-transform the overlay container so its children live in *screen*
   * pixels regardless of the canvas camera. The canvas maps world→screen as
   *   screen = stage.position + (world - stage.pivot) * stage.scale
   * so setting the overlay's inverse transform makes local == screen.
   */
  private applyOverlayTransform(): void {
    const stage = canvas?.stage;
    const root = this.overlayRoot;
    if (!stage || !root) return;
    const sx = stage.scale.x || 1;
    const sy = stage.scale.y || 1;
    root.scale.set(1 / sx, 1 / sy);
    root.pivot.set(0, 0);
    root.rotation = -stage.rotation;
    root.position.set(stage.pivot.x - stage.position.x / sx, stage.pivot.y - stage.position.y / sy);
  }

  private computeLayout(visible: Viewport[]): LayoutRect[] {
    const bounds: LayoutBounds = {
      width: window.innerWidth,
      height: window.innerHeight,
      padding: getSettings().streamingMode ? 0 : getSettings().viewportPadding
    };
    return LayoutEngine.compute(
      visible.map((v) => v.descriptor),
      bounds
    );
  }

  private emitFrame(rects: LayoutRect[], visible: Viewport[]): void {
    if (!this.frameListener) return;
    // Reference point for the distance overlay = primary token centre.
    const primary = visible.find((v) => v.descriptor.primary) ?? visible[0];
    const ref = primary?.token?.center;
    const overlays = visible.map((v) => v.computeOverlay(ref));
    this.frameListener({
      rects,
      overlays,
      page: this.page,
      pageCount: this.pageCount,
      diagnostics: this.scheduler.diagnostics
    });
  }

  /** Push a structural change (add/remove/primary/…) to listeners immediately. */
  private emitChanged(): void {
    Hooks.callAll(HOOKS.viewportsChanged, { count: this.viewports.length });
    if (this.opened) {
      const visible = this.visibleViewports();
      this.emitFrame(this.computeLayout(visible), visible);
    }
  }

  /** Snapshot for the UI / API. */
  get descriptors(): ViewportDescriptor[] {
    return this.viewports.map((v) => v.descriptor);
  }
}
