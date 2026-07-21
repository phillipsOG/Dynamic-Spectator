/**
 * MultiViewApp — the DOM overlay that renders MultiView's chrome and text
 * overlays on top of the PIXI viewport imagery.
 *
 * Architecture note: the scene imagery for each viewport is drawn by the main
 * PIXI renderer (see MultiViewManager / SceneCapture) into sprites on the canvas.
 * This class owns only the *DOM* layer above it — borders, name/HP/elevation
 * overlays, per-viewport toolbars, the global control bar, drag-and-drop
 * reordering, and streaming mode. Splitting imagery (GPU) from chrome (DOM) keeps
 * both fast: the overlay only updates at a throttled ~8Hz, never per frame.
 *
 * It is a plain controller rather than an ApplicationV2 window because MultiView
 * must be a fullscreen / borderless surface (OBS-friendly), not a draggable
 * dialog.
 */

import { DOM, MODULE_ID, SETTINGS } from "../constants.js";
import { getSettings } from "../settings.js";
import { state } from "../state.js";
import type { FrameEvent } from "../multiview/MultiViewManager.js";
import type { LayoutRect, OverlayData } from "../types/index.js";
import { SpectatorPicker } from "./SpectatorPicker.js";
import { log } from "../util/logger.js";

interface CellRefs {
  cell: HTMLElement;
  name: HTMLElement;
  player: HTMLElement;
  hpWrap: HTMLElement;
  hpBar: HTMLElement;
  hpText: HTMLElement;
  elev: HTMLElement;
  dist: HTMLElement;
  scene: HTMLElement;
  direction: HTMLElement;
  conditions: HTMLElement;
}

export class MultiViewApp {
  private root: HTMLElement | null = null;
  private grid: HTMLElement | null = null;
  private diag: HTMLElement | null = null;
  private pageLabel: HTMLElement | null = null;
  private readonly cells = new Map<string, CellRefs>();
  private active = false;

  get isActive(): boolean {
    return this.active;
  }

  // -- lifecycle -------------------------------------------------------------

  activate(): void {
    if (this.active) return;
    this.build();
    const mv = state().multiview;
    mv.setOnFrame((e) => this.onFrame(e));
    mv.open();
    this.applyStreamingClass();
    this.active = true;
    document.addEventListener("keydown", this.onKeyDown, true);
    log.debug("MultiViewApp activated");
  }

  deactivate(): void {
    if (!this.active) return;
    const mv = state().multiview;
    mv.setOnFrame(null);
    mv.close();
    document.removeEventListener("keydown", this.onKeyDown, true);
    this.root?.remove();
    this.root = this.grid = this.diag = this.pageLabel = null;
    this.cells.clear();
    this.active = false;
    log.debug("MultiViewApp deactivated");
  }

  toggle(): void {
    if (this.active) this.deactivate();
    else this.activate();
  }

  // -- DOM construction ------------------------------------------------------

  private build(): void {
    const root = document.createElement("div");
    root.id = DOM.multiViewRoot;
    root.className = DOM.multiViewRoot;

    const grid = document.createElement("div");
    grid.className = `${MODULE_ID}-grid`;
    root.appendChild(grid);

    root.appendChild(this.buildControlBar());

    (document.getElementById("interface") ?? document.body).appendChild(root);
    this.root = root;
    this.grid = grid;
  }

  private buildControlBar(): HTMLElement {
    const bar = document.createElement("div");
    bar.className = `${MODULE_ID}-controlbar`;

    const isGM = game.user.isGM;
    const btn = (action: string, icon: string, labelKey: string, gmOnly = false): string => {
      if (gmOnly && !isGM) return "";
      return `<button type="button" data-mv="${action}" title="${game.i18n.localize(labelKey)}">
        <i class="fa-solid ${icon}"></i><span>${game.i18n.localize(labelKey)}</span></button>`;
    };

    bar.innerHTML = `
      <div class="${MODULE_ID}-cb-group">
        ${btn("add", "fa-plus", "dynamic-spectator.mv.add")}
        ${btn("auto", "fa-wand-magic-sparkles", "dynamic-spectator.mv.auto")}
        ${btn("party", "fa-users", "dynamic-spectator.mv.party")}
        ${btn("combatants", "fa-swords", "dynamic-spectator.mv.combatants", true)}
        ${btn("npcs", "fa-ghost", "dynamic-spectator.mv.npcs", true)}
      </div>
      <div class="${MODULE_ID}-cb-group">
        <button type="button" data-mv="prevPage" title="${game.i18n.localize("dynamic-spectator.mv.prevPage")}"><i class="fa-solid fa-chevron-left"></i></button>
        <span class="${MODULE_ID}-page" data-mv-page>1 / 1</span>
        <button type="button" data-mv="nextPage" title="${game.i18n.localize("dynamic-spectator.mv.nextPage")}"><i class="fa-solid fa-chevron-right"></i></button>
      </div>
      <div class="${MODULE_ID}-cb-group">
        ${btn("streaming", "fa-clapperboard", "dynamic-spectator.mv.streaming")}
        <span class="${MODULE_ID}-diag" data-mv-diag></span>
        ${btn("close", "fa-xmark", "dynamic-spectator.mv.close")}
      </div>`;

    bar.addEventListener("click", (ev) => this.onControlClick(ev));
    this.diag = bar.querySelector("[data-mv-diag]");
    this.pageLabel = bar.querySelector("[data-mv-page]");
    return bar;
  }

  // -- per-frame reconcile ---------------------------------------------------

  private onFrame(e: FrameEvent): void {
    if (!this.grid) return;
    const seen = new Set<string>();
    const fields = getSettings().overlayFields;

    for (const rect of e.rects) {
      const overlay = e.overlays.find((o) => o.viewportId === rect.viewportId);
      const refs = this.ensureCell(rect.viewportId);
      seen.add(rect.viewportId);
      this.positionCell(refs.cell, rect);
      if (overlay) this.updateOverlay(refs, overlay, fields);
    }

    // Remove cells no longer present.
    for (const [id, refs] of this.cells) {
      if (!seen.has(id)) {
        refs.cell.remove();
        this.cells.delete(id);
      }
    }

    if (this.pageLabel) this.pageLabel.textContent = `${e.page + 1} / ${e.pageCount}`;
    if (this.diag) {
      this.diag.textContent = getSettings().profiling
        ? `${e.diagnostics.fps} fps · budget ${e.diagnostics.captureBudget}`
        : "";
    }
  }

  private positionCell(cell: HTMLElement, rect: LayoutRect): void {
    cell.style.left = `${rect.x}px`;
    cell.style.top = `${rect.y}px`;
    cell.style.width = `${rect.width}px`;
    cell.style.height = `${rect.height}px`;
    cell.classList.toggle("primary", rect.primary);
  }

  private updateOverlay(refs: CellRefs, o: OverlayData, fields: Record<string, boolean>): void {
    const set = (el: HTMLElement, on: boolean, text: string): void => {
      el.style.display = on ? "" : "none";
      if (on) el.textContent = text;
    };

    set(refs.name, fields.characterName && !!o.characterName, o.characterName ?? "");
    set(refs.player, fields.playerName && !!o.playerName, o.playerName ?? "");

    const hpOn = fields.hp && !!o.hp;
    refs.hpWrap.style.display = hpOn ? "" : "none";
    if (hpOn && o.hp) {
      const pct = o.hp.max > 0 ? Math.max(0, Math.min(1, o.hp.value / o.hp.max)) : 0;
      refs.hpBar.style.width = `${pct * 100}%`;
      refs.hpBar.style.background = pct > 0.5 ? "#4caf50" : pct > 0.25 ? "#ffb300" : "#e53935";
      refs.hpText.textContent = `${o.hp.value}/${o.hp.max}${o.hp.temp ? ` (+${o.hp.temp})` : ""}`;
    }

    set(refs.elev, fields.elevation && o.elevation !== undefined, `⛰ ${o.elevation}`);
    set(refs.dist, fields.distance && o.distance !== undefined, `↔ ${o.distance}`);
    set(refs.scene, fields.scene && !!o.scene, o.scene ?? "");

    const dirOn = fields.direction && o.direction !== undefined;
    refs.direction.style.display = dirOn ? "" : "none";
    if (dirOn && o.direction !== undefined) {
      refs.direction.style.transform = `rotate(${o.direction}deg)`;
    }

    const condOn = (fields.conditions || fields.statusEffects) && (o.conditions?.length ?? 0) > 0;
    refs.conditions.style.display = condOn ? "" : "none";
    if (condOn) {
      refs.conditions.textContent = (o.conditions ?? []).slice(0, 6).join(" · ");
    }
  }

  private ensureCell(viewportId: string): CellRefs {
    const existing = this.cells.get(viewportId);
    if (existing) return existing;

    const cell = document.createElement("div");
    cell.className = DOM.viewportClass;
    cell.dataset.viewportId = viewportId;
    cell.draggable = true;
    cell.innerHTML = `
      <div class="${MODULE_ID}-vp-frame"></div>
      <div class="${DOM.overlayClass} top">
        <span class="${MODULE_ID}-name"></span>
        <span class="${MODULE_ID}-player"></span>
      </div>
      <div class="${MODULE_ID}-direction"><i class="fa-solid fa-location-arrow"></i></div>
      <div class="${DOM.overlayClass} bottom">
        <div class="${MODULE_ID}-hp"><div class="${MODULE_ID}-hp-bar"></div><span class="${MODULE_ID}-hp-text"></span></div>
        <div class="${MODULE_ID}-meta">
          <span class="${MODULE_ID}-elev"></span>
          <span class="${MODULE_ID}-dist"></span>
          <span class="${MODULE_ID}-scene"></span>
        </div>
        <div class="${MODULE_ID}-conditions"></div>
      </div>
      <div class="${MODULE_ID}-vp-toolbar">
        <button data-vp="primary" title="${game.i18n.localize("dynamic-spectator.vp.primary")}"><i class="fa-solid fa-star"></i></button>
        <button data-vp="pin" title="${game.i18n.localize("dynamic-spectator.vp.pin")}"><i class="fa-solid fa-thumbtack"></i></button>
        <button data-vp="solo" title="${game.i18n.localize("dynamic-spectator.vp.solo")}"><i class="fa-solid fa-expand"></i></button>
        <button data-vp="zoomIn" title="${game.i18n.localize("dynamic-spectator.vp.zoomIn")}"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
        <button data-vp="zoomOut" title="${game.i18n.localize("dynamic-spectator.vp.zoomOut")}"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
        <button data-vp="collapse" title="${game.i18n.localize("dynamic-spectator.vp.collapse")}"><i class="fa-solid fa-window-minimize"></i></button>
        <button data-vp="close" title="${game.i18n.localize("dynamic-spectator.vp.close")}"><i class="fa-solid fa-xmark"></i></button>
      </div>`;

    cell.addEventListener("click", (ev) => this.onCellClick(viewportId, ev));
    cell.addEventListener("dblclick", () => state().multiview.toggleSolo(viewportId));
    this.wireDragDrop(cell, viewportId);
    this.grid!.appendChild(cell);

    const q = (sel: string): HTMLElement => cell.querySelector(sel) as HTMLElement;
    const refs: CellRefs = {
      cell,
      name: q(`.${MODULE_ID}-name`),
      player: q(`.${MODULE_ID}-player`),
      hpWrap: q(`.${MODULE_ID}-hp`),
      hpBar: q(`.${MODULE_ID}-hp-bar`),
      hpText: q(`.${MODULE_ID}-hp-text`),
      elev: q(`.${MODULE_ID}-elev`),
      dist: q(`.${MODULE_ID}-dist`),
      scene: q(`.${MODULE_ID}-scene`),
      direction: q(`.${MODULE_ID}-direction`),
      conditions: q(`.${MODULE_ID}-conditions`)
    };
    this.cells.set(viewportId, refs);
    return refs;
  }

  // -- interaction -----------------------------------------------------------

  private onCellClick(viewportId: string, ev: Event): void {
    const btn = (ev.target as HTMLElement).closest<HTMLElement>("[data-vp]");
    if (!btn) return;
    ev.stopPropagation();
    const mv = state().multiview;
    switch (btn.dataset.vp) {
      case "primary":
        mv.setPrimary(viewportId);
        break;
      case "pin":
        mv.togglePin(viewportId);
        break;
      case "solo":
        mv.toggleSolo(viewportId);
        break;
      case "collapse":
        mv.toggleCollapse(viewportId);
        break;
      case "close":
        mv.removeViewport(viewportId);
        break;
      case "zoomIn":
      case "zoomOut": {
        const desc = mv.descriptors.find((d) => d.id === viewportId);
        const cur = desc?.rememberedScale ?? 1;
        mv.setZoom(viewportId, btn.dataset.vp === "zoomIn" ? cur * 1.2 : cur / 1.2);
        break;
      }
    }
  }

  private onControlClick(ev: Event): void {
    const btn = (ev.target as HTMLElement).closest<HTMLElement>("[data-mv]");
    if (!btn) return;
    const mv = state().multiview;
    switch (btn.dataset.mv) {
      case "add":
        SpectatorPicker.show();
        break;
      case "auto":
        mv.observeAuto();
        break;
      case "party":
        mv.observeParty();
        break;
      case "combatants":
        mv.observeCombatants();
        break;
      case "npcs":
        mv.observeNpcs();
        break;
      case "prevPage":
        mv.prevPage();
        break;
      case "nextPage":
        mv.nextPage();
        break;
      case "streaming":
        void this.toggleStreaming();
        break;
      case "close":
        this.deactivate();
        break;
    }
  }

  private wireDragDrop(cell: HTMLElement, viewportId: string): void {
    cell.addEventListener("dragstart", (ev) => {
      ev.dataTransfer?.setData("text/ds-viewport", viewportId);
      cell.classList.add("dragging");
    });
    cell.addEventListener("dragend", () => cell.classList.remove("dragging"));
    cell.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      cell.classList.add("drop-target");
    });
    cell.addEventListener("dragleave", () => cell.classList.remove("drop-target"));
    cell.addEventListener("drop", (ev) => {
      ev.preventDefault();
      cell.classList.remove("drop-target");
      const from = ev.dataTransfer?.getData("text/ds-viewport");
      if (from && from !== viewportId) state().multiview.swap(from, viewportId);
    });
  }

  private onKeyDown = (ev: KeyboardEvent): void => {
    if (ev.key === "Escape" && this.active) {
      ev.preventDefault();
      ev.stopPropagation();
      this.deactivate();
    }
  };

  private async toggleStreaming(): Promise<void> {
    const cur = Boolean(game.settings.get(MODULE_ID, SETTINGS.streamingMode));
    await game.settings.set(MODULE_ID, SETTINGS.streamingMode, !cur);
    this.applyStreamingClass();
    state().multiview.applySettings();
  }

  private applyStreamingClass(): void {
    const on = Boolean(game.settings.get(MODULE_ID, SETTINGS.streamingMode));
    this.root?.classList.toggle("streaming", on);
  }
}
