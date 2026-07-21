/**
 * Tiny leveled logger. All module output is prefixed so it is greppable in the
 * browser console and never mistaken for core Foundry logging.
 *
 * Debug output is gated behind the `debugLogging` setting, read lazily so it can
 * be toggled at runtime without a reload.
 */

import { MODULE_ID, MODULE_TITLE, SETTINGS } from "../constants.js";

const PREFIX = `%c${MODULE_TITLE}`;
const STYLE = "color:#8ab4ff;font-weight:bold";

function debugEnabled(): boolean {
  try {
    return Boolean(game?.settings?.get(MODULE_ID, SETTINGS.debugLogging));
  } catch {
    return false;
  }
}

export const log = {
  debug(...args: unknown[]): void {
    if (debugEnabled()) console.debug(PREFIX, STYLE, "|", ...args);
  },
  info(...args: unknown[]): void {
    console.log(PREFIX, STYLE, "|", ...args);
  },
  warn(...args: unknown[]): void {
    console.warn(PREFIX, STYLE, "|", ...args);
  },
  error(...args: unknown[]): void {
    console.error(PREFIX, STYLE, "|", ...args);
  },
  /** Structured error that also surfaces a user notification. */
  fail(userMessage: string, err?: unknown): void {
    console.error(PREFIX, STYLE, "|", userMessage, err ?? "");
    try {
      ui?.notifications?.error(`${MODULE_TITLE}: ${userMessage}`);
    } catch {
      /* notifications not ready yet */
    }
  }
};
