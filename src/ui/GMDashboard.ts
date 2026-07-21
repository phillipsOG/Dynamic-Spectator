/**
 * GMDashboard — a GM control centre for the whole module.
 *
 * Provides one-click "observe" presets (Entire party / Combatants / NPCs), a
 * per-player list for quickly spectating or force-spectating a single player's
 * character, per-player permission overrides, a height-aware "observe this
 * elevation" action, and a live diagnostics readout.
 *
 * ApplicationV2 + Handlebars. GM only (registered as such by controls.ts).
 */

import { MODULE_ID, PermissionMode } from "../constants.js";
import { PermissionManager } from "../permissions/PermissionManager.js";
import { state } from "../state.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

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
    position: { width: 460, height: "auto" as number | "auto" },
    actions: {
      observeParty: GMDashboard.act((s) => s.multiview_observeParty()),
      observeCombatants: GMDashboard.act((s) => s.multiview_observeCombatants()),
      observeNpcs: GMDashboard.act((s) => s.multiview_observeNpcs()),
      observeElevation: GMDashboard.onObserveElevation,
      openMultiView: GMDashboard.onOpenMultiView,
      closeMultiView: GMDashboard.onCloseMultiView,
      spectatePlayer: GMDashboard.onSpectatePlayer,
      setPermission: GMDashboard.onSetPermission
    }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/gm-dashboard.hbs` }
  };

  /** Small helper: wrap a state mutation action + re-render + ensure overlay. */
  private static act(fn: (helpers: DashboardHelpers) => void) {
    return function (this: GMDashboard): void {
      fn(GMDashboard.helpers());
      GMDashboard.ensureOverlay();
      this.render();
    };
  }

  private static helpers(): DashboardHelpers {
    const s = state();
    return {
      multiview_observeParty: () => s.multiview.observeParty(),
      multiview_observeCombatants: () => s.multiview.observeCombatants(),
      multiview_observeNpcs: () => s.multiview.observeNpcs()
    };
  }

  private static ensureOverlay(): void {
    const s = state();
    if (!s.multiviewApp.isActive) s.multiviewApp.activate();
  }

  async _prepareContext(): Promise<Record<string, unknown>> {
    const s = state();
    const overrides = (game.settings.get(MODULE_ID, "perPlayerPermissions") as Record<string, string>) ?? {};
    const players = game.users
      .filter((u) => !u.isGM)
      .map((u) => ({
        id: u.id,
        name: u.name,
        active: u.active,
        color: typeof u.color === "string" ? u.color : (u.color as any)?.css ?? "#888",
        character: u.character?.name ?? game.i18n.localize("dynamic-spectator.dashboard.noCharacter"),
        hasToken: Boolean(this.playerToken(u)),
        permission: overrides[u.id] ?? game.i18n.localize("dynamic-spectator.dashboard.default")
      }));

    return {
      players,
      hasPlayers: players.length > 0,
      multiViewOpen: s.multiviewApp.isActive,
      viewportCount: s.multiview.count,
      permissionModes: Object.values(PermissionMode),
      diagnostics: (s.multiview as any).scheduler?.diagnostics ?? null
    };
  }

  private playerToken(user: FoundryUser): FoundryToken | undefined {
    const charId = user.character?.id;
    return (canvas?.tokens?.placeables ?? []).find(
      (t) => t.actor?.id && (t.actor.id === charId || t.document.testUserPermission(user, "OWNER"))
    );
  }

  // -- actions ---------------------------------------------------------------

  static onOpenMultiView(this: GMDashboard): void {
    GMDashboard.ensureOverlay();
    this.render();
  }

  static onCloseMultiView(this: GMDashboard): void {
    state().multiviewApp.deactivate();
    this.render();
  }

  static onObserveElevation(this: GMDashboard): void {
    // Observe the elevation of the GM's currently controlled token, else 0.
    const controlled = canvas?.tokens?.controlled?.[0];
    const elevation = controlled?.document.elevation ?? 0;
    state().multiview.observeGroupsAtElevation(elevation);
    GMDashboard.ensureOverlay();
    ui.notifications.info(
      game.i18n.format("dynamic-spectator.notify.observeElevation", { elevation })
    );
    this.render();
  }

  static onSpectatePlayer(this: GMDashboard, _event: Event, target: HTMLElement): void {
    const userId = target.closest<HTMLElement>("[data-user-id]")?.dataset.userId;
    if (!userId) return;
    const user = game.users.get(userId);
    if (!user) return;
    const token = this.playerToken(user);
    if (token) state().spectator.start(token.id);
    else ui.notifications.warn(game.i18n.localize("dynamic-spectator.notify.noPlayerToken"));
  }

  static async onSetPermission(this: GMDashboard, event: Event, target: HTMLElement): Promise<void> {
    const userId = target.closest<HTMLElement>("[data-user-id]")?.dataset.userId;
    if (!userId) return;
    const value = (event.target as HTMLSelectElement).value;
    const mode = value === "default" ? null : (value as PermissionMode);
    await PermissionManager.setPlayerOverride(userId, mode);
    this.render();
  }

  static show(): void {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("dynamic-spectator.notify.gmOnly"));
      return;
    }
    const existing = Object.values(ui.windows ?? {}).find(
      (w: any) => w?.id === `${MODULE_ID}-dashboard`
    ) as any;
    if (existing) {
      existing.bringToFront?.();
      return;
    }
    new GMDashboard().render(true);
  }
}

interface DashboardHelpers {
  multiview_observeParty: () => void;
  multiview_observeCombatants: () => void;
  multiview_observeNpcs: () => void;
}
