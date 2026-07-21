/**
 * controls.ts — the entry points a user actually clicks / presses:
 *   • a scene-control toggle group (Spectator picker, GM dashboard);
 *   • a Spectate button injected into the Token HUD (right-click a token);
 *   • keybindings (quick-spectate hovered token, open picker, stop spectating,
 *     open dashboard);
 *   • the on-canvas pulsing ring drawn on the token currently being spectated;
 *   • the hooks that keep an open picker's token list live.
 *
 * Every hook is registered defensively so the same code path works across the
 * v12→v13 changes to scene-control and HUD shapes (array vs record, jQuery vs
 * HTMLElement).
 */

import { FLAG_SCOPE, MODULE_ID } from "../constants.js";
import { PermissionManager } from "../permissions/PermissionManager.js";
import { state } from "../state.js";
import { GMDashboard } from "./GMDashboard.js";
import { SpectatorPicker } from "./SpectatorPicker.js";
import { log } from "../util/logger.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Spectate the most contextually-relevant token, else open the picker. */
function quickSpectate(): void {
  const s = state();
  const hovered: FoundryToken | null = (canvas?.tokens as any)?.hover ?? null;
  const controlled: FoundryToken | undefined = canvas?.tokens?.controlled?.[0];
  const targeted: FoundryToken | undefined = (game.user as any)?.targets?.first?.();
  const candidate = hovered ?? controlled ?? targeted;

  if (candidate && PermissionManager.allowed(game.user, candidate)) {
    s.spectator.toggle(candidate.id);
  } else {
    SpectatorPicker.show();
  }
}

export function registerKeybindings(): void {
  const kb = game.keybindings;
  kb.register(MODULE_ID, "quickSpectate", {
    name: "dynamic-spectator.keys.quickSpectate.name",
    hint: "dynamic-spectator.keys.quickSpectate.hint",
    editable: [{ key: "KeyV", modifiers: [] }],
    onDown: () => {
      quickSpectate();
      return true;
    }
  });

  kb.register(MODULE_ID, "openPicker", {
    name: "dynamic-spectator.keys.openPicker.name",
    hint: "dynamic-spectator.keys.openPicker.hint",
    editable: [{ key: "KeyV", modifiers: ["Shift"] }],
    onDown: () => {
      SpectatorPicker.show();
      return true;
    }
  });

  // Escape must beat core's own Escape handler (which closes windows / releases
  // tokens / opens the game menu), so it registers at PRIORITY precedence and
  // consumes the event only while a spectate session is actually live.
  kb.register(MODULE_ID, "stopSpectate", {
    name: "dynamic-spectator.keys.stopSpectate.name",
    hint: "dynamic-spectator.keys.stopSpectate.hint",
    editable: [{ key: "Escape", modifiers: [] }],
    precedence: CONST?.KEYBINDING_PRECEDENCE?.PRIORITY ?? 0,
    onDown: () => {
      const s = state();
      if (!s.spectator.active) return false; // let Escape do its normal thing
      s.spectator.stop();
      return true; // consume
    }
  });

  kb.register(MODULE_ID, "openDashboard", {
    name: "dynamic-spectator.keys.openDashboard.name",
    hint: "dynamic-spectator.keys.openDashboard.hint",
    editable: [{ key: "KeyD", modifiers: ["Shift"] }],
    restricted: true,
    onDown: () => {
      GMDashboard.show();
      return true;
    }
  });
}

/**
 * Add our tools to the token scene-control group. These render for EVERY user
 * (players included) — only the extra GM dashboard tool is role-gated, which
 * never affects the base spectate tool. Distinct `order` values and explicit
 * `visible:true` avoid v13 tool-record quirks, and the whole thing is wrapped so
 * a control-framework change can never take the module down.
 */
export function registerSceneControls(): void {
  Hooks.on("getSceneControlButtons", (controls: any) => {
    try {
      const tools: any[] = [
        {
          name: "ds-spectate",
          title: game.i18n.localize("dynamic-spectator.controls.spectate"),
          icon: "fa-solid fa-eye",
          button: true,
          visible: true,
          order: 90,
          onClick: () => SpectatorPicker.show(),
          onChange: () => SpectatorPicker.show()
        }
      ];
      if (game.user.isGM) {
        tools.push({
          name: "ds-dashboard",
          title: game.i18n.localize("dynamic-spectator.controls.dashboard"),
          icon: "fa-solid fa-video",
          button: true,
          visible: true,
          order: 91,
          onClick: () => GMDashboard.show(),
          onChange: () => GMDashboard.show()
        });
      }

      // v13+: `controls` is a Record keyed by control name; `.tools` is a Record.
      if (!Array.isArray(controls)) {
        const tokenControl = controls.tokens ?? controls.token;
        if (tokenControl) {
          tokenControl.tools ??= {};
          for (const t of tools) tokenControl.tools[t.name] = t;
        }
        return;
      }
      // v12: `controls` is an array; `.tools` is an array.
      const tokenControl = controls.find((c: any) => c.name === "token" || c.name === "tokens");
      if (tokenControl?.tools) tokenControl.tools.push(...tools);
    } catch (err) {
      log.error("scene control registration failed", err);
    }
  });
}

/** Inject a "Spectate" button into the Token HUD. */
export function registerTokenHud(): void {
  Hooks.on("renderTokenHUD", (hud: any, html: any) => {
    const token: FoundryToken | undefined = hud?.object;
    if (!token) return;
    if (!PermissionManager.allowed(game.user, token)) return;

    const root: HTMLElement | null = html?.[0] ?? (html instanceof HTMLElement ? html : null);
    if (!root) return;

    const active = state().spectator.tokenId === token.id;
    const btn = document.createElement("div");
    btn.className = "control-icon ds-hud-spectate" + (active ? " active" : "");
    btn.dataset.action = "ds-spectate";
    btn.title = game.i18n.localize(active ? "dynamic-spectator.controls.stop" : "dynamic-spectator.controls.spectate");
    btn.innerHTML = `<i class="fa-solid ${active ? "fa-eye-slash" : "fa-eye"}"></i>`;
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      state().spectator.toggle(token.id);
      hud.render();
    });

    const col = root.querySelector(".col.left") ?? root.querySelector(".control-icons") ?? root;
    col.appendChild(btn);
  });
}

/** Draw / clear a pulsing ring on the token currently being spectated. */
export function registerTokenIndicator(): void {
  const draw = (token: FoundryToken): void => {
    try {
      const on = Boolean((token as any)[`${FLAG_SCOPE}-spectating`]);
      const existing = (token as any)._dsIndicator;
      if (on && !existing) {
        const g = new (PIXI as any).Graphics();
        (token as any)._dsIndicator = g;
        token.addChild?.(g);
        redraw(token, g);
      } else if (!on && existing) {
        existing.destroy?.();
        (token as any)._dsIndicator = null;
      } else if (on && existing) {
        redraw(token, existing);
      }
    } catch (err) {
      log.debug("indicator draw failed", err);
    }
  };

  const redraw = (token: FoundryToken, g: any): void => {
    const w = token.w ?? 100;
    const h = token.h ?? 100;
    const r = Math.max(w, h) / 2 + 6;
    g.clear();
    // PIXI v8 API (circle + stroke); fall back to v7 (lineStyle + drawCircle).
    if (typeof g.circle === "function" && typeof g.stroke === "function") {
      g.circle(w / 2, h / 2, r).stroke({ width: 3, color: 0x8ab4ff, alpha: 0.9 });
    } else {
      g.lineStyle(3, 0x8ab4ff, 0.9);
      g.drawCircle(w / 2, h / 2, r);
      g.lineStyle(0);
    }
  };

  Hooks.on("refreshToken", (token: FoundryToken) => draw(token));
  Hooks.on("drawToken", (token: FoundryToken) => draw(token));
}

export function registerAllControls(): void {
  // Register each entry point independently so one failing (e.g. a core API
  // change on a given version) can never prevent the others from loading. This
  // is important for players: if scene controls hiccup, keybindings + Token HUD
  // still give them access.
  const safe = (label: string, fn: () => void): void => {
    try {
      fn();
    } catch (err) {
      log.error(`control registration failed: ${label}`, err);
    }
  };
  safe("keybindings", registerKeybindings);
  safe("sceneControls", registerSceneControls);
  safe("tokenHud", registerTokenHud);
  safe("tokenIndicator", registerTokenIndicator);
  safe("pickerRefresh", () => SpectatorPicker.registerRefreshHooks());
}
