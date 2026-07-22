/**
 * SpectatorPicker - a compact, searchable list of every token the current user
 * may spectate. Each row shows portrait, name, elevation and disposition, and
 * marks the currently-spectated token.
 *
 * The row *is* the spectate button - clicking anywhere on it starts (or stops)
 * spectating, which keeps the list narrow enough to sit beside the canvas. The
 * only per-row buttons are the GM's opt-out / NPC toggles, revealed on hover.
 *
 * Built on ApplicationV2 + HandlebarsApplicationMixin (the modern Foundry app
 * framework). Search filtering is done live in the rendered DOM for zero-latency
 * typing without re-rendering the whole list.
 *
 * The list is live: `registerRefreshHooks()` re-renders the open picker when the
 * scene's tokens change *or* when the GM changes who may spectate what, so
 * neither a new token nor a permission change needs the player to close and
 * reopen the window.
 */

import { MODULE_ID, TOKEN_FLAGS } from "../constants.js";
import { PermissionManager } from "../permissions/PermissionManager.js";
import {
  clearTokenIndicatorOverride,
  getSettings,
  getTokenIndicatorOverride,
  setTokenIndicatorOverride
} from "../settings.js";
import { state } from "../state.js";
import { log } from "../util/logger.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Token-document fields that change what a row *displays*. Movement (`x`/`y`)
 * is deliberately absent: dragging a token fires a burst of updates and none of
 * them alter the list, so re-rendering on them would be pure waste.
 */
const ROW_FIELDS = ["name", "texture", "elevation", "disposition", "hidden", "ownership", "actorId"];

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
  /** This token's ring override, resolved against the global defaults, for the per-token dialog. */
  ring: { color: string; opacity: number; width: number };
}

export class SpectatorPicker extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-picker`,
    tag: "div",
    classes: [`${MODULE_ID}-app`, `${MODULE_ID}-picker`],
    window: {
      title: "dynamic-spectator.picker.title",
      icon: "fa-solid fa-eye",
      resizable: true,
      controls: [
        {
          icon: "fa-solid fa-gear",
          label: "dynamic-spectator.picker.settings",
          action: "openSettings"
        }
      ]
    },
    position: { width: 264, height: 400 as number | "auto" },
    actions: {
      stop: SpectatorPicker.onStop,
      optOut: SpectatorPicker.onOptOut,
      toggleNpc: SpectatorPicker.onToggleNpc,
      openSettings: SpectatorPicker.onOpenSettings,
      ringSettings: SpectatorPicker.onRingSettings
    }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/spectator-picker.hbs` }
  };

  /**
   * The open picker, if any. ApplicationV2 instances are not registered in
   * `ui.windows` (that is the V1 registry), so we keep our own handle rather
   * than searching one that will never contain us.
   */
  private static instance: SpectatorPicker | null = null;

  /** Current search query (kept across re-renders). */
  private query = "";

  async _prepareContext(): Promise<Record<string, unknown>> {
    const s = state();
    const user = game.user;
    const placeables: FoundryToken[] = canvas?.tokens?.placeables ?? [];
    const settings = getSettings();

    const rows: Row[] = placeables
      .map((t) => {
        const decision = PermissionManager.canSpectate(user, t);
        const isNpc = PermissionManager.isNpc(t);
        const override = getTokenIndicatorOverride(t.id);
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
          ring: {
            color: override?.color ?? `#${settings.indicator.color.toString(16).padStart(6, "0")}`,
            opacity: override?.opacity ?? settings.indicator.opacity,
            width: override?.width ?? settings.indicator.width
          },
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
      query: this.query,
      perTokenEnabled: settings.indicatorPerToken,
      version: (game.modules.get(MODULE_ID) as any)?.version ?? ""
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

  static onOpenSettings(): void {
    game.settings.sheet?.render(true);
  }

  /** Open a small dialog to set (or reset) this token's ring colour/opacity/thickness. */
  static async onRingSettings(this: SpectatorPicker, _event: Event, target: HTMLElement): Promise<void> {
    const id = SpectatorPicker.tokenIdFrom(target);
    if (!id) return;
    const token = canvas?.tokens?.get(id);
    if (!token) return;

    const existing = getTokenIndicatorOverride(id);
    const settings = getSettings();
    const color = existing?.color ?? `#${settings.indicator.color.toString(16).padStart(6, "0")}`;
    const opacity = existing?.opacity ?? settings.indicator.opacity;
    const width = existing?.width ?? settings.indicator.width;

    const content = `
      <div class="ds-ring-dialog">
        <div class="form-group">
          <label>${game.i18n.localize("dynamic-spectator.settings.indicatorColor.name")}</label>
          <input type="color" name="color" value="${color}" />
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("dynamic-spectator.settings.indicatorOpacity.name")}</label>
          <input type="range" name="opacity" min="0" max="1" step="0.05" value="${opacity}" />
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("dynamic-spectator.settings.indicatorWidth.name")}</label>
          <input type="range" name="width" min="1" max="10" step="1" value="${width}" />
        </div>
      </div>`;

    const DialogV2 = (foundry as any).applications?.api?.DialogV2;
    if (!DialogV2) return;

    await DialogV2.wait({
      window: { title: `${game.i18n.localize("dynamic-spectator.picker.ringSettings")} - ${token.name}` },
      content,
      buttons: [
        {
          action: "save",
          label: game.i18n.localize("dynamic-spectator.picker.save"),
          default: true,
          callback: async (_ev: Event, button: any) => {
            const form = button.form as HTMLFormElement;
            await setTokenIndicatorOverride(id, {
              color: (form.elements.namedItem("color") as HTMLInputElement).value,
              opacity: Number((form.elements.namedItem("opacity") as HTMLInputElement).value),
              width: Number((form.elements.namedItem("width") as HTMLInputElement).value)
            });
          }
        },
        {
          action: "reset",
          label: game.i18n.localize("dynamic-spectator.picker.resetRing"),
          callback: async () => {
            await clearTokenIndicatorOverride(id);
          }
        },
        { action: "cancel", label: game.i18n.localize("Cancel") }
      ]
    });

    this.render();
  }

  /** Singleton open helper. */
  static show(): void {
    const existing = SpectatorPicker.instance;
    if (existing?.rendered) {
      existing.bringToFront?.();
      return;
    }
    const app = new SpectatorPicker();
    SpectatorPicker.instance = app;
    app.render(true);
  }

  _onClose(options: unknown): void {
    super._onClose(options);
    if (SpectatorPicker.instance === this) SpectatorPicker.instance = null;
  }

  /**
   * Re-render the list in place, preserving the search box's focus and caret so
   * a refresh landing mid-keystroke does not interrupt typing. The query itself
   * already survives via `this.query`.
   */
  private async refreshList(): Promise<void> {
    if (!this.rendered) return;
    const search = this.searchInput();
    const hadFocus = Boolean(search) && document.activeElement === search;
    const caret = search?.selectionStart ?? null;

    await this.render();

    if (!hadFocus) return;
    const next = this.searchInput();
    if (!next) return;
    next.focus();
    if (caret !== null) next.setSelectionRange(caret, caret);
  }

  private searchInput(): HTMLInputElement | null {
    const root = (this as any).element as HTMLElement | undefined;
    return root?.querySelector<HTMLInputElement>("[data-ds-search]") ?? null;
  }

  /**
   * Keep an open picker in step with the scene. Registered once at boot; every
   * handler is a no-op while the picker is closed.
   */
  static registerRefreshHooks(): void {
    // Debounced because a GM pasting several tokens fires one hook each.
    const refresh = foundry.utils.debounce(() => {
      void SpectatorPicker.instance?.refreshList();
    }, 100);

    Hooks.on("createToken", () => refresh());
    Hooks.on("deleteToken", () => refresh());
    Hooks.on("updateToken", (_doc: FoundryTokenDocument, changes: Record<string, unknown>) => {
      if (SpectatorPicker.touchesRow(changes)) refresh();
    });
    // Name, portrait and ownership can all change on the actor instead.
    Hooks.on("updateActor", () => refresh());
    // A different scene is an entirely different token list.
    Hooks.on("canvasReady", () => refresh());
    // Our world settings are all permission settings, and permissions decide
    // which rows a user may see at all - so any of ours is worth a refresh.
    // (Client-scoped settings live in localStorage and never reach this hook,
    // which is fine: none of them affect the list.)
    Hooks.on("updateSetting", (setting: { key?: string }) => {
      if (setting?.key?.startsWith(`${MODULE_ID}.`)) refresh();
    });

    log.debug("picker refresh hooks registered");
  }

  /** Does this token update change anything the list shows or gates on? */
  private static touchesRow(changes: Record<string, unknown>): boolean {
    if (ROW_FIELDS.some((f) => f in changes)) return true;
    // Our own per-token flags decide whether a row appears at all: `noSpectate`
    // (opt-out) and `npcSpectatable` (the GM's per-NPC override). Scoped to our
    // namespace so another module's flag churn does not re-render us.
    const flags = changes.flags as Record<string, unknown> | undefined;
    return Boolean(flags && MODULE_ID in flags);
  }
}
