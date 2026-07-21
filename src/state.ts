/**
 * Shared module state. The manager is instantiated during `setup`/`ready` (not at
 * import time, because its construction reads settings and the canvas, which are
 * not available while modules are still importing). UI and sync code import `DS`
 * to reach the live manager.
 */

import type { SpectatorManager } from "./spectator/SpectatorManager.js";

export interface ModuleState {
  spectator: SpectatorManager;
  ready: boolean;
}

/** Populated during initialization; treat fields as possibly-undefined before ready. */
export const DS: Partial<ModuleState> = { ready: false };

/** Assert-and-return the fully initialized state (throws if used too early). */
export function state(): ModuleState {
  if (!DS.spectator) {
    throw new Error("Dynamic Spectator accessed before initialization");
  }
  return DS as ModuleState;
}
