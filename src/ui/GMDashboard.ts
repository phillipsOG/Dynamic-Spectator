/**
 * GMDashboard — a GM control centre for the module.
 *
 * Provides a per-player list for quickly spectating a single player's character
 * plus per-player permission overrides, so a GM can retune who may watch whom
 * without opening the settings sheet.
 *
 * ApplicationV2 + Handlebars. GM only (registered as such by controls.ts).
 */

import {
  MODULE_ID,
  PERMISSION_DEFAULT,
  PERMISSION_MODE_LABELS,
  PermissionMode,
  SETTINGS
} from "../constants.js";
import { PermissionManager } from "../permissions/PermissionManager.js";
import { state } from "../state.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** One `<option>` in a player's permission dropdown. */
interface PermissionOption {
  value: string;
  label: string;
  selected: boolean;
}

export class GMDashboard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-dashboard`,
    tag: "div",
    classes: [`${MODULE_ID}-app`, `${MODULE_ID}-dashboard`],
    window: {
      title: "dynamic-spectator.dashboard.title",
      icon: "fa-solid fa-video",
      resizable: true
    },
    // Wide enough that the permission labels ("Players: any player-owned
    // token") read without truncating.
    position: { width: 440, height: "auto" as number | "auto" },
    actions: {
      spectatePlayer: GMDashboard.onSpectatePlayer
    }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/gm-dashboard.hbs` }
  };

  /**
   * The open dashboard, if any. ApplicationV2 instances are not registered in
   * `ui.windows` (that is the V1 registry), so we keep our own handle rather
   * than searching one that will never contain us.
   */
  private static instance: GMDashboard | null = null;

  async _prepareContext(): Promise<Record<string, unknown>> {
    const overrides =
      (game.settings.get(MODULE_ID, SETTINGS.perPlayerPermissions) as Record<string, string>) ?? {};
    const players = game.users
      .filter((u) => !u.isGM)
      .map((u) => ({
        id: u.id,
        name: u.name,
        active: u.active,
        color: typeof u.color === "string" ? u.color : (u.color as any)?.css ?? "#888",
        character: u.character?.name ?? game.i18n.localize("dynamic-spectator.dashboard.noCharacter"),
        hasToken: Boolean(this.playerToken(u)),
        permissionOptions: this.permissionOptions(overrides[u.id])
      }));

    return {
      players,
      hasPlayers: players.length > 0
    };
  }

  /**
   * The dropdown options for one player, with their stored override marked
   * `selected`. An override that no longer maps to a known mode (a value left
   * behind by an older version) falls back to "default" rather than leaving the
   * `<select>` showing an arbitrary first option.
   */
  private permissionOptions(current: string | undefined): PermissionOption[] {
    const modes = Object.values(PermissionMode);
    const known = modes.some((m) => m === current);
    return [
      {
        value: PERMISSION_DEFAULT,
        label: game.i18n.localize("dynamic-spectator.dashboard.default"),
        selected: !known
      },
      ...modes.map((mode) => ({
        value: mode,
        label: game.i18n.localize(PERMISSION_MODE_LABELS[mode]),
        selected: mode === current
      }))
    ];
  }

  private playerToken(user: FoundryUser): FoundryToken | undefined {
    const charId = user.character?.id;
    return (canvas?.tokens?.placeables ?? []).find(
      (t) => t.actor?.id && (t.actor.id === charId || t.document.testUserPermission(user, "OWNER"))
    );
  }

  _onRender(_context: unknown, _options: unknown): void {
    const root = (this as any).element as HTMLElement;
    // Wired manually rather than through the action map: a <select> reports its
    // new value on `change`, whereas the action map dispatches on `click` —
    // which fires as the dropdown *opens*, so it would read the stale value.
    root.querySelectorAll<HTMLSelectElement>("[data-ds-permission]").forEach((select) => {
      select.addEventListener("change", () => void this.setPermission(select));
    });
  }

  /** Persist (or clear) the per-player override behind one dropdown. */
  private async setPermission(select: HTMLSelectElement): Promise<void> {
    const userId = select.closest<HTMLElement>("[data-user-id]")?.dataset.userId;
    if (!userId) return;
    const mode = select.value === PERMISSION_DEFAULT ? null : (select.value as PermissionMode);
    await PermissionManager.setPlayerOverride(userId, mode);
    this.render();
  }

  // -- actions ---------------------------------------------------------------

  static onSpectatePlayer(this: GMDashboard, _event: Event, target: HTMLElement): void {
    const userId = target.closest<HTMLElement>("[data-user-id]")?.dataset.userId;
    if (!userId) return;
    const user = game.users.get(userId);
    if (!user) return;
    const token = this.playerToken(user);
    if (token) state().spectator.start(token.id);
    else ui.notifications.warn(game.i18n.localize("dynamic-spectator.notify.noPlayerToken"));
  }

  static show(): void {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("dynamic-spectator.notify.gmOnly"));
      return;
    }
    const existing = GMDashboard.instance;
    if (existing?.rendered) {
      existing.bringToFront?.();
      return;
    }
    const app = new GMDashboard();
    GMDashboard.instance = app;
    app.render(true);
  }

  _onClose(options: unknown): void {
    super._onClose(options);
    if (GMDashboard.instance === this) GMDashboard.instance = null;
  }
}
