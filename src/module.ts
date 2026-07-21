/**
 * Dynamic Spectator — module entry point.
 *
 * Boot sequence:
 *   init   → register settings, keybindings, scene controls, Token HUD, indicator,
 *            and preload Handlebars templates.
 *   setup  → construct the managers and publish the public API.
 *   ready  → wire the document/canvas sync hooks and mark the module live.
 *
 * The public API is exposed on the module entry (`game.modules.get(
 * "dynamic-spectator").api`) so macros and other modules can drive spectating and
 * MultiView programmatically.
 */

import { HOOKS, MODULE_ID, MODULE_TITLE } from "./constants.js";
import { MultiViewManager } from "./multiview/MultiViewManager.js";
import { getSettings, registerSettings } from "./settings.js";
import { SpectatorManager } from "./spectator/SpectatorManager.js";
import { DS } from "./state.js";
import { registerSyncHooks } from "./sync/SyncBridge.js";
import { registerAllControls } from "./ui/controls.js";
import { GMDashboard } from "./ui/GMDashboard.js";
import { MultiViewApp } from "./ui/MultiViewApp.js";
import { SpectatorPicker } from "./ui/SpectatorPicker.js";
import { log } from "./util/logger.js";
import { profiler } from "./util/profiler.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

const TEMPLATES = [
  `modules/${MODULE_ID}/templates/spectator-picker.hbs`,
  `modules/${MODULE_ID}/templates/gm-dashboard.hbs`
];

/** Build the public API object once the managers exist. */
function buildApi() {
  return {
    version: "1.0.1",
    /** Spectate a token by id. */
    spectate: (tokenId: string, exclusive = true) => DS.spectator?.start(tokenId, exclusive),
    stopSpectate: () => DS.spectator?.stop(),
    toggleSpectate: (tokenId: string) => DS.spectator?.toggle(tokenId),
    /** Open UIs. */
    openPicker: () => SpectatorPicker.show(),
    openDashboard: () => GMDashboard.show(),
    openMultiView: () => DS.multiviewApp?.activate(),
    closeMultiView: () => DS.multiviewApp?.deactivate(),
    toggleMultiView: () => DS.multiviewApp?.toggle(),
    /** Add / remove MultiView cameras programmatically. */
    addView: (tokenId: string) => {
      DS.multiview?.addViewport(tokenId);
      if (!DS.multiviewApp?.isActive) DS.multiviewApp?.activate();
    },
    observeParty: () => {
      DS.multiview?.observeParty();
      DS.multiviewApp?.activate();
    },
    observeAuto: () => {
      DS.multiview?.observeAuto();
      DS.multiviewApp?.activate();
    },
    /** Direct manager access for power users. */
    managers: {
      get spectator() {
        return DS.spectator;
      },
      get multiview() {
        return DS.multiview;
      },
      get multiviewApp() {
        return DS.multiviewApp;
      }
    },
    profiler,
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
  log.info(`Initializing ${MODULE_TITLE} v1.0.1 (user "${game?.user?.name}", GM=${game?.user?.isGM})`);
  bootPhase("settings", () =>
    registerSettings(() => {
      // Live-apply setting changes to an open MultiView session.
      try {
        if (DS.multiview?.isOpen) DS.multiview.applySettings();
      } catch {
        /* not ready */
      }
    })
  );
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
    DS.multiview = new MultiViewManager();
    DS.multiviewApp = new MultiViewApp();

    const api = buildApi();
    const mod = game.modules.get(MODULE_ID) as any;
    if (mod) mod.api = api;
    (globalThis as any).DynamicSpectator = api;
    log.debug("managers constructed; API published");
  });
});

Hooks.once("ready", () => {
  bootPhase("sync", () => registerSyncHooks());
  DS.ready = true;
  Hooks.callAll(`${MODULE_ID}.ready`, buildApi());
  log.info(`${MODULE_TITLE} ready for "${game?.user?.name}"`);
});

// When switching scenes / disabling, ensure any open MultiView tears down its
// PIXI overlay so we never leak GPU resources or leave the stage hidden.
Hooks.on("canvasTearDown", () => {
  try {
    if (DS.multiviewApp?.isActive) DS.multiviewApp.deactivate();
    DS.spectator?.stop();
  } catch (err) {
    log.debug("teardown cleanup skipped", err);
  }
});
