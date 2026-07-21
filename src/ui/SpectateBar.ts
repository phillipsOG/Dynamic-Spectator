/**
 * SpectateBar — the compact "you are spectating X" pill shown while a spectate
 * session is live.
 *
 * It is deliberately tiny: an eye, the token name, and the Escape affordance
 * (which is also a click target). It is a fixed-position element on `<body>`
 * rather than a child of core's `#ui-bottom`, so its placement never depends on
 * how a given core version lays that container out; it simply measures the
 * hotbar once and parks itself just above it.
 *
 * Purely local chrome — nothing here is persisted or broadcast.
 */

import { DOM } from "../constants.js";
import { log } from "../util/logger.js";

/** Fallback distance from the bottom of the viewport when no hotbar is found. */
const FALLBACK_BOTTOM = 92;

export class SpectateBar {
  private el: HTMLElement | null = null;

  /** Show the bar for `name`, or update it in place if already visible. */
  show(name: string, onStop: () => void): void {
    try {
      const el = this.el ?? this.mount(onStop);
      if (!el) return;
      const label = el.querySelector<HTMLElement>(".ds-bar-name");
      if (label) label.textContent = name;
    } catch (err) {
      log.debug("spectate bar show failed", err);
    }
  }

  /** Remove the bar. Safe to call when it is not showing. */
  hide(): void {
    this.el?.remove();
    this.el = null;
  }

  private mount(onStop: () => void): HTMLElement {
    const el = document.createElement("div");
    el.id = DOM.spectateBar;
    el.style.bottom = `${this.clearanceAboveHotbar()}px`;
    el.innerHTML = `
      <i class="fa-solid fa-eye ds-bar-icon"></i>
      <span class="ds-bar-name"></span>
      <button type="button" class="ds-bar-stop" title="${game.i18n.localize(
        "dynamic-spectator.controls.stop"
      )}"><kbd>Esc</kbd></button>`;

    // Clicking anywhere on the pill stops spectating — the whole thing is the
    // affordance, so the Esc key and the pill teach each other.
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      onStop();
    });

    document.body.appendChild(el);
    this.el = el;
    return el;
  }

  /** Distance from the viewport bottom that clears the hotbar, plus a gap. */
  private clearanceAboveHotbar(): number {
    const hotbar = document.getElementById("hotbar");
    if (!hotbar) return FALLBACK_BOTTOM;
    const rect = hotbar.getBoundingClientRect();
    if (rect.height === 0) return FALLBACK_BOTTOM; // collapsed / hidden
    return Math.round(window.innerHeight - rect.top) + 8;
  }
}
