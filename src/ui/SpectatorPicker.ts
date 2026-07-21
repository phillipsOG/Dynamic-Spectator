/**
 * SpectatorPicker — a polished, searchable list of every token the current user
 * may spectate. Each row shows portrait, name, elevation and disposition, marks
 * the currently-spectated token, and offers "Spectate" plus "Add to MultiView".
 *
 * Built on ApplicationV2 + HandlebarsApplicationMixin (the modern Foundry app
 * framework). Search filtering is done live in the rendered DOM for zero-latency
 * typing without re-rendering the whole list.
 */

import { MODULE_ID } from "../constants.js";
import { PermissionManager } from "../permissions/PermissionManager.js";
import { state } from "../state.js";
import { log } from "../util/logger.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

interface Row {
  tokenId: string;
  name: string;
  img: string;
  elevation: number;
  disposition: number;
  dispositionLabel: string;
  current: boolean;
  inMultiView: boolean;
  reason: string;
}

export class SpectatorPicker extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-picker`,
    tag: "div",
    classes: [`${MODULE_ID}-app`, `${MODULE_ID}-picker`],
    window: {
      title: "dynamic-spectator.picker.title",
      icon: "fa-solid fa-eye",
      resizable: true
    },
    position: { width: 380, height: 560 as number | "auto" },
    actions: {
      spectate: SpectatorPicker.onSpectate,
      addView: SpectatorPicker.onAddView,
      stop: SpectatorPicker.onStop,
      optOut: SpectatorPicker.onOptOut
    }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/spectator-picker.hbs` }
  };

  /** Current search query (kept across re-renders). */
  private query = "";

  async _prepareContext(): Promise<Record<string, unknown>> {
    const s = state();
    const user = game.user;
    const placeables: FoundryToken[] = canvas?.tokens?.placeables ?? [];
    const mvTokenIds = new Set(s.multiview.descriptors.map((d) => d.tokenId));

    const rows: Row[] = placeables
      .map((t) => {
        const decision = PermissionManager.canSpectate(user, t);
        return {
          tokenId: t.id,
          name: t.name,
          img: (t.document as any).texture?.src ?? t.actor?.img ?? "icons/svg/mystery-man.svg",
          elevation: t.document.elevation ?? 0,
          disposition: t.document.disposition ?? 0,
          dispositionLabel: this.dispositionLabel(t.document.disposition ?? 0),
          current: s.spectator.tokenId === t.id,
          inMultiView: mvTokenIds.has(t.id),
          reason: decision.reason,
          allowed: decision.allowed
        } as Row & { allowed: boolean };
      })
      .filter((r) => (r as any).allowed)
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      rows,
      hasRows: rows.length > 0,
      spectating: s.spectator.active,
      isGM: user.isGM,
      query: this.query
    };
  }

  _onRender(_context: unknown, _options: unknown): void {
    const root = (this as any).element as HTMLElement;
    const search = root.querySelector<HTMLInputElement>("[data-ds-search]");
    if (search) {
      search.value = this.query;
      search.addEventListener("input", () => {
        this.query = search.value.toLowerCase();
        this.filterRows(root);
      });
      this.filterRows(root);
    }
  }

  private filterRows(root: HTMLElement): void {
    const q = this.query.trim();
    root.querySelectorAll<HTMLElement>("[data-ds-row]").forEach((el) => {
      const name = (el.dataset.name ?? "").toLowerCase();
      el.style.display = !q || name.includes(q) ? "" : "none";
    });
  }

  private dispositionLabel(d: number): string {
    if (d > 0) return game.i18n.localize("dynamic-spectator.disposition.friendly");
    if (d < 0) return game.i18n.localize("dynamic-spectator.disposition.hostile");
    return game.i18n.localize("dynamic-spectator.disposition.neutral");
  }

  private static tokenIdFrom(target: HTMLElement): string | null {
    return target.closest<HTMLElement>("[data-token-id]")?.dataset.tokenId ?? null;
  }

  // -- actions ---------------------------------------------------------------

  static onSpectate(this: SpectatorPicker, _event: Event, target: HTMLElement): void {
    const id = SpectatorPicker.tokenIdFrom(target);
    if (!id) return;
    state().spectator.start(id);
    this.render();
  }

  static onAddView(this: SpectatorPicker, _event: Event, target: HTMLElement): void {
    const id = SpectatorPicker.tokenIdFrom(target);
    if (!id) return;
    const s = state();
    s.multiview.addViewport(id);
    if (!s.multiview.isOpen) s.multiview.open();
    this.render();
  }

  static onStop(this: SpectatorPicker): void {
    state().spectator.stop();
    this.render();
  }

  static async onOptOut(this: SpectatorPicker, _event: Event, target: HTMLElement): Promise<void> {
    const id = SpectatorPicker.tokenIdFrom(target);
    const token = id ? canvas?.tokens?.get(id) : null;
    if (!token) return;
    const current = Boolean(token.document.getFlag(MODULE_ID, "noSpectate"));
    await PermissionManager.setOptOut(token, !current);
    this.render();
    log.debug(`opt-out ${!current} for ${token.name}`);
  }

  /** Singleton open helper. */
  static show(): void {
    const existing = Object.values(ui.windows ?? {}).find(
      (w: any) => w?.id === `${MODULE_ID}-picker`
    ) as any;
    if (existing) {
      existing.bringToFront?.();
      return;
    }
    new SpectatorPicker().render(true);
  }
}
