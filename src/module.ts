/**
 * Dynamic Spectator - module entry point.
 *
 * Boot sequence:
 *   init   → register settings, keybindings, scene controls, Token HUD, indicator,
 *            and preload Handlebars templates.
 *   setup  → construct the manager and publish the public API.
 *   ready  → wire the document/canvas sync hooks and mark the module live.
 *
 * The public API is exposed on the module entry (`game.modules.get(
 * "dynamic-spectator").api`) so macros and other modules can drive spectating
 * programmatically.
 */

import { HOOKS, MODULE_ID, MODULE_TITLE } from "./constants.js";
import { getSettings, registerSettings } from "./settings.js";
import { SpectatorManager } from "./spectator/SpectatorManager.js";
import { DS } from "./state.js";
import { registerSyncHooks } from "./sync/SyncBridge.js";
import { registerAllControls } from "./ui/controls.js";
import { GMDashboard } from "./ui/GMDashboard.js";
import { SpectatorPicker } from "./ui/SpectatorPicker.js";
import { log } from "./util/logger.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

const TEMPLATES = [
  `modules/${MODULE_ID}/templates/spectator-picker.hbs`,
  `modules/${MODULE_ID}/templates/gm-dashboard.hbs`
];

/** Build the public API object once the manager exists. */
function buildApi() {
  return {
    version: "2.1.7",
    /** Spectate a token by id. */
    spectate: (tokenId: string, exclusive = true) => DS.spectator?.start(tokenId, exclusive),
    stopSpectate: () => DS.spectator?.stop(),
    toggleSpectate: (tokenId: string) => DS.spectator?.toggle(tokenId),
    /** Open UIs. */
    openPicker: () => SpectatorPicker.show(),
    openDashboard: () => GMDashboard.show(),
    /** Direct manager access for power users. */
    managers: {
      get spectator() {
        return DS.spectator;
      }
    },
    settings: () => getSettings(),
    HOOKS
  };
}

/**
 * Run a boot phase with a guard so one failure is clearly labeled in the console
 * and can never silently kill the module for a given user (GM *or* player). This
 * is the key safety net: everything a player needs (settings, controls, managers,
 * sync) is registered for all roles, and if any step throws it is surfaced,
 * isolated, and the rest still runs.
 */
function bootPhase(phase: string, fn: () => void): void {
  try {
    fn();
  } catch (err) {
    log.error(`boot phase "${phase}" failed (isGM=${game?.user?.isGM})`, err);
  }
}

Hooks.once("init", () => {
  log.info(`Initializing ${MODULE_TITLE} v2.1.7 (user "${game?.user?.name}", GM=${game?.user?.isGM})`);
  bootPhase("settings", () => registerSettings());
  bootPhase("controls", () => registerAllControls());

  // Preload templates (API path varies across versions).
  bootPhase("templates", () => {
    const loader =
      (foundry as any).applications?.handlebars?.loadTemplates ?? (globalThis as any).loadTemplates;
    if (typeof loader === "function") {
      loader(TEMPLATES).catch((err: unknown) => log.warn("template preload failed", err));
    }
  });
});

Hooks.once("setup", () => {
  bootPhase("managers", () => {
    DS.spectator = new SpectatorManager();

    const api = buildApi();
    const mod = game.modules.get(MODULE_ID) as any;
    if (mod) mod.api = api;
    (globalThis as any).DynamicSpectator = api;
    log.debug("manager constructed; API published");
  });
});

Hooks.once("ready", () => {
  bootPhase("sync", () => registerSyncHooks());
  DS.ready = true;
  Hooks.callAll(`${MODULE_ID}.ready`, buildApi());
  log.info(`${MODULE_TITLE} ready for "${game?.user?.name}"`);
});

// When switching scenes / disabling, release the camera lock and vision patch so
// we never strand the user in a spectated POV on a scene that no longer exists.
Hooks.on("canvasTearDown", () => {
  try {
    DS.spectator?.stop();
  } catch (err) {
    log.debug("teardown cleanup skipped", err);
  }
});
