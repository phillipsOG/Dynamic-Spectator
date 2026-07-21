/**
 * SpectatorPicker — a compact, searchable list of every token the current user
 * may spectate. Each row shows portrait, name, elevation and disposition, and
 * marks the currently-spectated token.
 *
 * The row *is* the spectate button — clicking anywhere on it starts (or stops)
 * spectating, which keeps the list narrow enough to sit beside the canvas. The
 * only per-row buttons are the GM's opt-out / NPC toggles, revealed on hover.
 *
 * Built on ApplicationV2 + HandlebarsApplicationMixin (the modern Foundry app
 * framework). Search filtering is done live in the rendered DOM for zero-latency
 * typing without re-rendering the whole list.
 */

import { MODULE_ID, TOKEN_FLAGS } from "../constants.js";
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
  reason: string;
  /** True when the token has no player owner (an NPC). */
  isNpc: boolean;
  /** Effective "NPCs may be spectated" state for this token (for the GM toggle). */
  npcOptIn: boolean;
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
    position: { width: 264, height: 400 as number | "auto" },
    actions: {
      stop: SpectatorPicker.onStop,
      optOut: SpectatorPicker.onOptOut,
      toggleNpc: SpectatorPicker.onToggleNpc
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

    const rows: Row[] = placeables
      .map((t) => {
        const decision = PermissionManager.canSpectate(user, t);
        const isNpc = PermissionManager.isNpc(t);
        return {
          tokenId: t.id,
          name: t.name,
          img: (t.document as any).texture?.src ?? t.actor?.img ?? "icons/svg/mystery-man.svg",
          elevation: t.document.elevation ?? 0,
          disposition: t.document.disposition ?? 0,
          dispositionLabel: this.dispositionLabel(t.document.disposition ?? 0),
          current: s.spectator.tokenId === t.id,
          reason: decision.reason,
          isNpc,
          npcOptIn: isNpc && PermissionManager.npcSpectatable(t),
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

    // The whole row is the spectate target. Wired here rather than via
    // [data-action] so a click on a nested GM button is not also counted as a
    // row click (which would toggle spectate straight back off).
    root.querySelectorAll<HTMLElement>("[data-ds-row]").forEach((row) => {
      const activate = (): void => {
        const id = row.dataset.tokenId;
        if (!id) return;
        state().spectator.toggle(id);
        this.render();
      };
      row.addEventListener("click", (ev) => {
        if ((ev.target as HTMLElement).closest("[data-action]")) return;
        activate();
      });
      row.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        ev.preventDefault();
        activate();
      });
    });
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

  static onStop(this: SpectatorPicker): void {
    state().spectator.stop();
    this.render();
  }

  static async onOptOut(this: SpectatorPicker, _event: Event, target: HTMLElement): Promise<void> {
    const id = SpectatorPicker.tokenIdFrom(target);
    const token = id ? canvas?.tokens?.get(id) : null;
    if (!token) return;
    const current = Boolean(token.document.getFlag(MODULE_ID, TOKEN_FLAGS.noSpectate));
    await PermissionManager.setOptOut(token, !current);
    this.render();
    log.debug(`opt-out ${!current} for ${token.name}`);
  }

  /** GM-only: toggle whether players may spectate this specific NPC token. */
  static async onToggleNpc(this: SpectatorPicker, _event: Event, target: HTMLElement): Promise<void> {
    const id = SpectatorPicker.tokenIdFrom(target);
    const token = id ? canvas?.tokens?.get(id) : null;
    if (!token) return;
    const current = PermissionManager.npcSpectatable(token);
    await PermissionManager.setNpcSpectatable(token, !current);
    this.render();
    log.debug(`npc-spectatable ${!current} for ${token.name}`);
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
