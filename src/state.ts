/**
 * Shared module state. The managers are instantiated during `setup`/`ready`
 * (not at import time, because their construction reads settings and the canvas,
 * which are not available while modules are still importing). UI and sync code
 * import `DS` to reach the live managers.
 */

import type { MultiViewManager } from "./multiview/MultiViewManager.js";
import type { SpectatorManager } from "./spectator/SpectatorManager.js";
import type { MultiViewApp } from "./ui/MultiViewApp.js";

export interface ModuleState {
  spectator: SpectatorManager;
  multiview: MultiViewManager;
  multiviewApp: MultiViewApp;
  ready: boolean;
}

/** Populated during initialization; treat fields as possibly-undefined before ready. */
export const DS: Partial<ModuleState> = { ready: false };

/** Assert-and-return the fully initialized state (throws if used too early). */
export function state(): ModuleState {
  if (!DS.spectator || !DS.multiview || !DS.multiviewApp) {
    throw new Error("Dynamic Spectator accessed before initialization");
  }
  return DS as ModuleState;
}
