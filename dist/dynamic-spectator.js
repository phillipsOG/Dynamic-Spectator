/* Dynamic Spectator - bundled by esbuild. Source: https://github.com/phillipsOG/Dynamic-Spectator */
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/constants.ts
var MODULE_ID, MODULE_TITLE, SOCKET, FLAG_SCOPE, TOKEN_FLAGS, HOOKS, SETTINGS, PermissionMode, PERMISSION_MODE_LABELS, PERMISSION_DEFAULT, INDICATOR_DEFAULTS, DOM;
var init_constants = __esm({
  "src/constants.ts"() {
    "use strict";
    MODULE_ID = "dynamic-spectator";
    MODULE_TITLE = "Dynamic Spectator";
    SOCKET = `module.${MODULE_ID}`;
    FLAG_SCOPE = MODULE_ID;
    TOKEN_FLAGS = {
      /** When true, non-GM users may never spectate this token. */
      noSpectate: "noSpectate",
      /**
       * Per-token override for the "may NPCs be spectated" question. `true` forces
       * this NPC spectatable and `false` blocks it, each regardless of the world
       * {@link SETTINGS.allowNpcSpectate} default. Absent = follow the world default.
       */
      npcSpectatable: "npcSpectatable"
    };
    HOOKS = {
      spectateStart: `${MODULE_ID}.spectateStart`,
      spectateStop: `${MODULE_ID}.spectateStop`,
      /**
       * Fired from the `indicatorPerToken` setting's own `onChange` rather than
       * relying on core's `updateSetting` hook, which client-scoped settings never
       * reach (they are stored in `localStorage`, not a world `Setting` document).
       */
      indicatorPerTokenChanged: `${MODULE_ID}.indicatorPerTokenChanged`
    };
    SETTINGS = {
      // Permissions
      permissionMode: "permissionMode",
      perPlayerPermissions: "perPlayerPermissions",
      allowNpcSpectate: "allowNpcSpectate",
      // Camera behaviour
      cameraMode: "cameraMode",
      followSpeed: "followSpeed",
      deadZone: "deadZone",
      zoomMemory: "zoomMemory",
      // Spectating ring appearance (per-user)
      indicatorEnabled: "indicatorEnabled",
      indicatorColor: "indicatorColor",
      indicatorOpacity: "indicatorOpacity",
      indicatorWidth: "indicatorWidth",
      /** Whether the user may override colour/opacity/thickness per spectated token. */
      indicatorPerToken: "indicatorPerToken",
      /** Per-token overrides: { [tokenId]: { color?, opacity?, width? } }. Client-scoped. */
      indicatorTokenOverrides: "indicatorTokenOverrides",
      // Multi-scene
      crossSceneBehaviour: "crossSceneBehaviour",
      // Diagnostics
      debugLogging: "debugLogging"
    };
    PermissionMode = /* @__PURE__ */ ((PermissionMode2) => {
      PermissionMode2["GMOnly"] = "gm-only";
      PermissionMode2["OwnedOnly"] = "owned-only";
      PermissionMode2["PartyMembers"] = "party-members";
      PermissionMode2["AnyPlayerToken"] = "any-player-token";
      PermissionMode2["AnyToken"] = "any-token";
      return PermissionMode2;
    })(PermissionMode || {});
    PERMISSION_MODE_LABELS = {
      ["gm-only" /* GMOnly */]: `${MODULE_ID}.settings.permissionMode.gmOnly`,
      ["owned-only" /* OwnedOnly */]: `${MODULE_ID}.settings.permissionMode.ownedOnly`,
      ["party-members" /* PartyMembers */]: `${MODULE_ID}.settings.permissionMode.partyMembers`,
      ["any-player-token" /* AnyPlayerToken */]: `${MODULE_ID}.settings.permissionMode.anyPlayerToken`,
      ["any-token" /* AnyToken */]: `${MODULE_ID}.settings.permissionMode.anyToken`
    };
    PERMISSION_DEFAULT = "default";
    INDICATOR_DEFAULTS = {
      color: "#8ab4ff",
      /** Parsed form of {@link INDICATOR_DEFAULTS.color}, for PIXI. */
      colorInt: 9090303,
      opacity: 0.9,
      width: 3
    };
    DOM = {
      /** The compact "you are spectating X" pill anchored above the hotbar. */
      spectateBar: `${MODULE_ID}-bar`
    };
  }
});

// src/permissions/PermissionManager.ts
var PermissionManager_exports = {};
__export(PermissionManager_exports, {
  PermissionManager: () => PermissionManager
});
var ORDER, PermissionManager;
var init_PermissionManager = __esm({
  "src/permissions/PermissionManager.ts"() {
    "use strict";
    init_constants();
    ORDER = [
      "gm-only" /* GMOnly */,
      "owned-only" /* OwnedOnly */,
      "party-members" /* PartyMembers */,
      "any-player-token" /* AnyPlayerToken */,
      "any-token" /* AnyToken */
    ];
    PermissionManager = class {
      /** The effective mode for a specific user (per-player override, else global). */
      static modeFor(user) {
        const global = game.settings.get(MODULE_ID, SETTINGS.permissionMode) ?? "any-player-token" /* AnyPlayerToken */;
        const overrides = game.settings.get(MODULE_ID, SETTINGS.perPlayerPermissions) ?? {};
        return overrides[user.id] ?? global;
      }
      /** True if `token` is owned by any currently-active non-GM player. */
      static isPartyToken(token) {
        const actor = token.actor;
        if (!actor) return false;
        if (!actor.hasPlayerOwner) return false;
        return game.users.filter((u) => !u.isGM && u.active).some((u) => token.document.testUserPermission(u, "OWNER"));
      }
      static hasPlayerOwner(token) {
        return Boolean(token.actor?.hasPlayerOwner);
      }
      /** True if `token` is an NPC - i.e. it has no player owner. */
      static isNpc(token) {
        return !this.hasPlayerOwner(token);
      }
      /** The per-token NPC override: true (force on), false (force off), or undefined. */
      static npcOverride(token) {
        const v = token.document?.getFlag(FLAG_SCOPE, TOKEN_FLAGS.npcSpectatable);
        return v === true ? true : v === false ? false : void 0;
      }
      /**
       * Whether NPC tokens may be spectated for this token. The per-token override
       * wins in either direction; otherwise the world `allowNpcSpectate` default
       * applies. (Only meaningful for NPC tokens; player tokens ignore it.)
       */
      static npcSpectatable(token) {
        const override = this.npcOverride(token);
        if (override !== void 0) return override;
        return Boolean(game.settings.get(MODULE_ID, SETTINGS.allowNpcSpectate));
      }
      /**
       * The central decision. Returns both the boolean and a machine-readable reason
       * so the UI can explain *why* a token is greyed out.
       */
      static canSpectate(user, token) {
        if (!token?.document) return { allowed: false, reason: "no-token" };
        if (user.isGM) return { allowed: true, reason: "gm" };
        const optedOut = Boolean(token.document.getFlag(FLAG_SCOPE, TOKEN_FLAGS.noSpectate));
        if (optedOut) return { allowed: false, reason: "opted-out" };
        const mode = this.modeFor(user);
        if (mode === "gm-only" /* GMOnly */) return { allowed: false, reason: "gm-only" };
        const owns = token.document.testUserPermission(user, "OWNER");
        if (owns) return { allowed: true, reason: "owned" };
        if (this.isNpc(token)) {
          const override = this.npcOverride(token);
          if (override === true) return { allowed: true, reason: "npc-allowed" };
          if (override === false) return { allowed: false, reason: "npc-blocked" };
          if (mode === "any-token" /* AnyToken */) return { allowed: true, reason: "any" };
          return Boolean(game.settings.get(MODULE_ID, SETTINGS.allowNpcSpectate)) ? { allowed: true, reason: "npc-allowed" } : { allowed: false, reason: "npc" };
        }
        switch (mode) {
          case "owned-only" /* OwnedOnly */:
            return { allowed: false, reason: "not-owned" };
          case "party-members" /* PartyMembers */:
            return this.isPartyToken(token) ? { allowed: true, reason: "party" } : { allowed: false, reason: "not-party" };
          case "any-player-token" /* AnyPlayerToken */:
          case "any-token" /* AnyToken */:
            return { allowed: true, reason: "player-token" };
          default:
            return { allowed: false, reason: "unknown-mode" };
        }
      }
      /** Convenience boolean form. */
      static allowed(user, token) {
        return this.canSpectate(user, token).allowed;
      }
      /** Filter the scene's tokens down to those the user may spectate. */
      static spectatableTokens(user) {
        const placeables = canvas?.tokens?.placeables ?? [];
        return placeables.filter((t) => this.allowed(user, t));
      }
      /** Set / clear a token's per-token opt-out flag (GM or token owner only). */
      static async setOptOut(token, optOut) {
        if (optOut) await token.document.setFlag(FLAG_SCOPE, TOKEN_FLAGS.noSpectate, true);
        else await token.document.unsetFlag(FLAG_SCOPE, TOKEN_FLAGS.noSpectate);
      }
      /**
       * Set / clear a token's per-token NPC opt-in override (GM only). `true` forces
       * the NPC spectatable, `false` forces it off, `null` clears the override so the
       * world `allowNpcSpectate` default applies again.
       */
      static async setNpcSpectatable(token, value) {
        if (value === null) await token.document.unsetFlag(FLAG_SCOPE, TOKEN_FLAGS.npcSpectatable);
        else await token.document.setFlag(FLAG_SCOPE, TOKEN_FLAGS.npcSpectatable, value);
      }
      /** Persist a per-player override mode (GM only, world scope). */
      static async setPlayerOverride(userId, mode) {
        const overrides = { ...game.settings.get(MODULE_ID, SETTINGS.perPlayerPermissions) };
        if (mode === null) delete overrides[userId];
        else overrides[userId] = mode;
        await game.settings.set(MODULE_ID, SETTINGS.perPlayerPermissions, overrides);
      }
      /** Rank of a mode for comparison/UI sorting. */
      static rank(mode) {
        return ORDER.indexOf(mode);
      }
    };
  }
});

// src/module.ts
init_constants();

// src/settings.ts
init_constants();

// src/state.ts
var DS = { ready: false };
function state() {
  if (!DS.spectator) {
    throw new Error("Dynamic Spectator accessed before initialization");
  }
  return DS;
}

// src/util/logger.ts
init_constants();
var PREFIX = `%c${MODULE_TITLE}`;
var STYLE = "color:#8ab4ff;font-weight:bold";
function debugEnabled() {
  try {
    return Boolean(game?.settings?.get(MODULE_ID, SETTINGS.debugLogging));
  } catch {
    return false;
  }
}
var log = {
  debug(...args) {
    if (debugEnabled()) console.debug(PREFIX, STYLE, "|", ...args);
  },
  info(...args) {
    console.log(PREFIX, STYLE, "|", ...args);
  },
  warn(...args) {
    console.warn(PREFIX, STYLE, "|", ...args);
  },
  error(...args) {
    console.error(PREFIX, STYLE, "|", ...args);
  },
  /** Structured error that also surfaces a user notification. */
  fail(userMessage, err) {
    console.error(PREFIX, STYLE, "|", userMessage, err ?? "");
    try {
      ui?.notifications?.error(`${MODULE_TITLE}: ${userMessage}`);
    } catch {
    }
  }
};

// src/settings.ts
var L = (key) => `dynamic-spectator.settings.${key}`;
var indicatorCache = null;
function onIndicatorChange() {
  indicatorCache = null;
  try {
    const token = DS.spectator?.tokenId ? canvas?.tokens?.get(DS.spectator.tokenId) : null;
    token?.renderFlags?.set?.({ refreshState: true });
  } catch {
  }
}
function registerSettings() {
  game.settings.register(MODULE_ID, SETTINGS.permissionMode, {
    name: L("permissionMode.name"),
    hint: L("permissionMode.hint"),
    scope: "world",
    config: true,
    type: String,
    default: "any-player-token" /* AnyPlayerToken */,
    choices: { ...PERMISSION_MODE_LABELS }
  });
  game.settings.register(MODULE_ID, SETTINGS.perPlayerPermissions, {
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });
  game.settings.register(MODULE_ID, SETTINGS.allowNpcSpectate, {
    name: L("allowNpcSpectate.name"),
    hint: L("allowNpcSpectate.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
  game.settings.register(MODULE_ID, SETTINGS.cameraMode, {
    name: L("cameraMode.name"),
    hint: L("cameraMode.hint"),
    scope: "client",
    config: true,
    type: String,
    default: "smooth" /* Smooth */,
    choices: {
      ["smooth" /* Smooth */]: L("cameraMode.smooth"),
      ["snap" /* Snap */]: L("cameraMode.snap"),
      ["interpolate" /* Interpolate */]: L("cameraMode.interpolate"),
      ["dead-zone" /* DeadZone */]: L("cameraMode.deadZone")
    }
  });
  game.settings.register(MODULE_ID, SETTINGS.followSpeed, {
    name: L("followSpeed.name"),
    hint: L("followSpeed.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 0.05, max: 1, step: 0.05 },
    default: 0.6
  });
  game.settings.register(MODULE_ID, SETTINGS.deadZone, {
    name: L("deadZone.name"),
    hint: L("deadZone.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 0, max: 0.9, step: 0.05 },
    default: 0.2
  });
  game.settings.register(MODULE_ID, SETTINGS.zoomMemory, {
    name: L("zoomMemory.name"),
    hint: L("zoomMemory.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(MODULE_ID, SETTINGS.indicatorEnabled, {
    name: L("indicatorEnabled.name"),
    hint: L("indicatorEnabled.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: onIndicatorChange
  });
  const ColorField = foundry.data?.fields?.ColorField;
  game.settings.register(MODULE_ID, SETTINGS.indicatorColor, {
    name: L("indicatorColor.name"),
    hint: L("indicatorColor.hint"),
    scope: "client",
    config: true,
    type: ColorField ? new ColorField({ nullable: false, initial: INDICATOR_DEFAULTS.color }) : String,
    default: INDICATOR_DEFAULTS.color,
    onChange: onIndicatorChange
  });
  game.settings.register(MODULE_ID, SETTINGS.indicatorOpacity, {
    name: L("indicatorOpacity.name"),
    hint: L("indicatorOpacity.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 0, max: 1, step: 0.05 },
    default: INDICATOR_DEFAULTS.opacity,
    onChange: onIndicatorChange
  });
  game.settings.register(MODULE_ID, SETTINGS.indicatorWidth, {
    name: L("indicatorWidth.name"),
    hint: L("indicatorWidth.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 1, max: 10, step: 1 },
    default: INDICATOR_DEFAULTS.width,
    onChange: onIndicatorChange
  });
  game.settings.register(MODULE_ID, SETTINGS.indicatorPerToken, {
    name: L("indicatorPerToken.name"),
    hint: L("indicatorPerToken.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => {
      onIndicatorChange();
      Hooks.callAll(HOOKS.indicatorPerTokenChanged);
    }
  });
  game.settings.register(MODULE_ID, SETTINGS.indicatorTokenOverrides, {
    scope: "client",
    config: false,
    type: Object,
    default: {},
    onChange: onIndicatorChange
  });
  game.settings.register(MODULE_ID, SETTINGS.crossSceneBehaviour, {
    name: L("crossSceneBehaviour.name"),
    hint: L("crossSceneBehaviour.hint"),
    scope: "client",
    config: true,
    type: String,
    default: "prompt" /* Prompt */,
    choices: {
      ["prompt" /* Prompt */]: L("crossSceneBehaviour.prompt"),
      ["follow" /* Follow */]: L("crossSceneBehaviour.follow"),
      ["drop" /* Drop */]: L("crossSceneBehaviour.drop")
    }
  });
  game.settings.register(MODULE_ID, SETTINGS.debugLogging, {
    name: L("debugLogging.name"),
    hint: L("debugLogging.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });
  log.debug("settings registered");
}
function read(key, fallback) {
  try {
    const v = game.settings.get(MODULE_ID, key);
    return v === void 0 || v === null ? fallback : v;
  } catch {
    return fallback;
  }
}
function hexToInt(value, fallback) {
  const hex = String(value ?? "").trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return fallback;
  const n = Number.parseInt(hex, 16);
  return Number.isFinite(n) ? n : fallback;
}
function getIndicatorConfig(tokenId) {
  indicatorCache ??= {
    enabled: read(SETTINGS.indicatorEnabled, true),
    color: hexToInt(read(SETTINGS.indicatorColor, INDICATOR_DEFAULTS.color), INDICATOR_DEFAULTS.colorInt),
    opacity: read(SETTINGS.indicatorOpacity, INDICATOR_DEFAULTS.opacity),
    width: read(SETTINGS.indicatorWidth, INDICATOR_DEFAULTS.width)
  };
  if (!tokenId || !read(SETTINGS.indicatorPerToken, false)) return indicatorCache;
  const override = getTokenIndicatorOverride(tokenId);
  if (!override) return indicatorCache;
  return {
    enabled: indicatorCache.enabled,
    color: override.color !== void 0 ? hexToInt(override.color, indicatorCache.color) : indicatorCache.color,
    opacity: override.opacity ?? indicatorCache.opacity,
    width: override.width ?? indicatorCache.width
  };
}
function allTokenIndicatorOverrides() {
  return read(SETTINGS.indicatorTokenOverrides, {});
}
function getTokenIndicatorOverride(tokenId) {
  return allTokenIndicatorOverrides()[tokenId];
}
async function setTokenIndicatorOverride(tokenId, patch) {
  const all = { ...allTokenIndicatorOverrides() };
  all[tokenId] = { ...all[tokenId], ...patch };
  await game.settings.set(MODULE_ID, SETTINGS.indicatorTokenOverrides, all);
}
async function clearTokenIndicatorOverride(tokenId) {
  const all = { ...allTokenIndicatorOverrides() };
  if (!(tokenId in all)) return;
  delete all[tokenId];
  await game.settings.set(MODULE_ID, SETTINGS.indicatorTokenOverrides, all);
}
function getSettings() {
  return {
    permissionMode: read(SETTINGS.permissionMode, "any-player-token" /* AnyPlayerToken */),
    allowNpcSpectate: read(SETTINGS.allowNpcSpectate, false),
    camera: {
      mode: read(SETTINGS.cameraMode, "smooth" /* Smooth */),
      followSpeed: read(SETTINGS.followSpeed, 0.6),
      deadZone: read(SETTINGS.deadZone, 0.2),
      zoomMemory: read(SETTINGS.zoomMemory, true),
      followRotation: false
    },
    indicator: getIndicatorConfig(),
    indicatorPerToken: read(SETTINGS.indicatorPerToken, false),
    crossSceneBehaviour: read(SETTINGS.crossSceneBehaviour, "prompt" /* Prompt */),
    debugLogging: read(SETTINGS.debugLogging, false)
  };
}

// src/spectator/SpectatorManager.ts
init_constants();
init_PermissionManager();

// src/ui/SpectateBar.ts
init_constants();
var FALLBACK_BOTTOM = 92;
var SpectateBar = class {
  el = null;
  /** Show the bar for `name`, or update it in place if already visible. */
  show(name, onStop) {
    try {
      const el = this.el ?? this.mount(onStop);
      if (!el) return;
      const label = el.querySelector(".ds-bar-name");
      if (label) label.textContent = name;
    } catch (err) {
      log.debug("spectate bar show failed", err);
    }
  }
  /** Remove the bar. Safe to call when it is not showing. */
  hide() {
    this.el?.remove();
    this.el = null;
  }
  mount(onStop) {
    const el = document.createElement("div");
    el.id = DOM.spectateBar;
    el.style.bottom = `${this.clearanceAboveHotbar()}px`;
    el.innerHTML = `
      <i class="fa-solid fa-eye ds-bar-icon"></i>
      <span class="ds-bar-name"></span>
      <button type="button" class="ds-bar-stop" title="${game.i18n.localize(
      "dynamic-spectator.controls.stop"
    )}"><kbd>Esc</kbd></button>`;
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      onStop();
    });
    document.body.appendChild(el);
    this.el = el;
    return el;
  }
  /** Distance from the viewport bottom that clears the hotbar, plus a gap. */
  clearanceAboveHotbar() {
    const hotbar = document.getElementById("hotbar");
    if (!hotbar) return FALLBACK_BOTTOM;
    const rect = hotbar.getBoundingClientRect();
    if (rect.height === 0) return FALLBACK_BOTTOM;
    return Math.round(window.innerHeight - rect.top) + 8;
  }
};

// src/spectator/CameraLock.ts
init_constants();

// src/util/math.ts
var clamp = (v, min, max) => Math.min(Math.max(v, min), max);
var lerp = (a, b, t) => a + (b - a) * t;
function smoothingFactor(speed, dtMs) {
  const s = clamp(speed, 1e-3, 1);
  const halfLife = lerp(600, 20, s);
  return 1 - Math.pow(2, -dtMs / halfLife);
}

// src/spectator/CameraLock.ts
var DEFAULT_SPECTATE_SCALE = 1;
var CameraLock = class {
  token = null;
  config = null;
  ticker = false;
  tick = () => this.onTick();
  lastTime = 0;
  /** Camera to restore when we release. */
  restore = null;
  get active() {
    return this.token !== null;
  }
  lock(token, config) {
    if (!token) return;
    this.captureRestore();
    this.token = token;
    this.config = config;
    const c = token.center;
    this.applyCamera(c.x, c.y, config.zoomMemory ? void 0 : DEFAULT_SPECTATE_SCALE);
    this.startTicker();
    log.debug(`CameraLock engaged on "${token.name}" mode=${config.mode}`);
  }
  release() {
    if (!this.active) return;
    this.stopTicker();
    const r = this.restore;
    this.token = null;
    this.config = null;
    if (r) {
      try {
        canvas?.animatePan?.({ x: r.x, y: r.y, scale: r.scale, duration: 250 });
      } catch {
      }
    }
    this.restore = null;
    log.debug("CameraLock released; camera restored");
  }
  /** Swap the followed token without releasing (e.g. spectate a different token). */
  retarget(token) {
    if (!this.active || !token) return;
    this.token = token;
  }
  // -- ticker ----------------------------------------------------------------
  startTicker() {
    if (this.ticker) return;
    this.lastTime = performance.now();
    canvas?.app?.ticker?.add(this.tick);
    this.ticker = true;
  }
  stopTicker() {
    if (!this.ticker) return;
    canvas?.app?.ticker?.remove(this.tick);
    this.ticker = false;
  }
  onTick() {
    if (!this.token || !this.config) return;
    const now = performance.now();
    const dt = Math.min(now - this.lastTime, 100);
    this.lastTime = now;
    const target = this.token.center;
    const cur = this.currentCenter();
    if (!cur) return;
    switch (this.config.mode) {
      case "snap" /* Snap */: {
        this.applyCamera(target.x, target.y);
        break;
      }
      case "dead-zone" /* DeadZone */: {
        this.followDeadZone(cur, target);
        break;
      }
      case "interpolate" /* Interpolate */:
      case "smooth" /* Smooth */:
      default: {
        const f = smoothingFactor(this.config.followSpeed, dt);
        const x = cur.x + (target.x - cur.x) * f;
        const y = cur.y + (target.y - cur.y) * f;
        this.applyCamera(x, y);
        break;
      }
    }
  }
  /** Dead-zone: only chase once the token drifts outside a central box. */
  followDeadZone(cur, target) {
    const scale = this.currentScale();
    const halfW = window.innerWidth * 0.5 * this.config.deadZone / scale;
    const halfH = window.innerHeight * 0.5 * this.config.deadZone / scale;
    let nx = cur.x;
    let ny = cur.y;
    const dx = target.x - cur.x;
    const dy = target.y - cur.y;
    if (Math.abs(dx) > halfW) nx = cur.x + (dx - Math.sign(dx) * halfW);
    if (Math.abs(dy) > halfH) ny = cur.y + (dy - Math.sign(dy) * halfH);
    if (nx !== cur.x || ny !== cur.y) this.applyCamera(nx, ny);
  }
  // -- camera helpers --------------------------------------------------------
  /**
   * Pan to a world point. `scale` is omitted unless we explicitly mean to
   * re-frame - passing the current scale back every tick is what previously
   * cancelled the user's zoom the moment they scrolled.
   */
  applyCamera(x, y, scale) {
    try {
      canvas?.pan?.(scale === void 0 ? { x, y } : { x, y, scale });
    } catch (err) {
      log.debug("pan failed", err);
    }
  }
  currentScale() {
    return canvas?.stage?.scale?.x ?? 1;
  }
  currentCenter() {
    const stage = canvas?.stage;
    if (!stage) return null;
    return { x: stage.pivot.x, y: stage.pivot.y };
  }
  captureRestore() {
    const c = this.currentCenter();
    if (c) this.restore = { x: c.x, y: c.y, scale: this.currentScale() };
  }
};

// src/spectator/OcclusionController.ts
init_constants();
var OcclusionController = class _OcclusionController {
  /** The token whose roofs we are currently revealing, or null when inactive. */
  spectated = null;
  /** When true, only the spectated token drives occlusion (POV clamp). */
  exclusive = true;
  /** Saved original method for manual-wrapper teardown. */
  original = null;
  /** lib-wrapper registration handle / flag. */
  wrapperInstalled = false;
  /** The TokenLayer class whose prototype we patched (cached for teardown). */
  layerClass = null;
  /** lib-wrapper target - resolved from CONFIG so it is version-stable. */
  static TARGET = "CONFIG.Canvas.layers.tokens.layerClass.prototype._getOccludableTokens";
  get active() {
    return this.spectated !== null;
  }
  /** Begin revealing the roofs `token` is under on this client. */
  activate(token, exclusive = true) {
    if (!token?.document) {
      log.warn("OcclusionController.activate called with an invalid token");
      return;
    }
    this.spectated = token;
    this.exclusive = exclusive;
    this.installWrapper();
    this.refreshOcclusion();
    log.debug(`OcclusionController active on "${token.name}" (exclusive=${exclusive})`);
  }
  /** Stop revealing roofs and restore normal occlusion. */
  deactivate() {
    if (!this.active) return;
    this.spectated = null;
    this.removeWrapper();
    this.refreshOcclusion();
    log.debug("OcclusionController deactivated; occlusion restored");
  }
  /** Swap the target token without reinstalling the wrapper (retarget). */
  setTarget(token, exclusive = true) {
    if (!token?.document) return;
    this.spectated = token;
    this.exclusive = exclusive;
    this.installWrapper();
    this.refreshOcclusion();
  }
  /** Recompute occlusion for the current target (e.g. after it moved). */
  refresh() {
    if (!this.active) return;
    this.refreshOcclusion();
  }
  // -- internals -------------------------------------------------------------
  /** The occludable-token set installed while spectating. */
  predicate(original, self) {
    const target = this.spectated;
    if (!target) return original.call(self);
    if (this.exclusive) return [target];
    const base = original.call(self) ?? [];
    return base.includes(target) ? base : [...base, target];
  }
  resolveLayerClass() {
    const fromConfig = CONFIG?.Canvas?.layers?.tokens?.layerClass;
    if (fromConfig?.prototype) return fromConfig;
    const layer = canvas?.tokens;
    return layer?.constructor ?? null;
  }
  installWrapper() {
    if (this.wrapperInstalled) return;
    if (typeof libWrapper !== "undefined" && libWrapper?.register) {
      const self2 = this;
      libWrapper.register(
        MODULE_ID,
        _OcclusionController.TARGET,
        function(wrapped) {
          return self2.predicate(wrapped, this);
        },
        "MIXED"
      );
      this.wrapperInstalled = true;
      log.debug("Installed _getOccludableTokens wrapper via lib-wrapper");
      return;
    }
    const cls = this.resolveLayerClass();
    if (!cls?.prototype?._getOccludableTokens) {
      log.debug("TokenLayer#_getOccludableTokens not available; roof reveal skipped");
      return;
    }
    this.layerClass = cls;
    this.original = cls.prototype._getOccludableTokens;
    const original = this.original;
    const self = this;
    cls.prototype._getOccludableTokens = function() {
      return self.predicate(original, this);
    };
    this.wrapperInstalled = true;
    log.debug("Installed _getOccludableTokens wrapper via manual prototype patch");
  }
  removeWrapper() {
    if (!this.wrapperInstalled) return;
    if (typeof libWrapper !== "undefined" && libWrapper?.unregister) {
      try {
        libWrapper.unregister(MODULE_ID, _OcclusionController.TARGET);
      } catch (err) {
        log.warn("lib-wrapper unregister failed (already removed?)", err);
      }
    } else if (this.layerClass && this.original) {
      this.layerClass.prototype._getOccludableTokens = this.original;
    }
    this.original = null;
    this.layerClass = null;
    this.wrapperInstalled = false;
  }
  /** Ask core to recompute overhead-tile occlusion under the new subject set. */
  refreshOcclusion() {
    try {
      canvas?.perception?.update({ refreshOcclusion: true }, true);
    } catch {
      try {
        canvas?.perception?.update({ refreshOcclusion: true });
      } catch (err) {
        log.debug("occlusion refresh failed", err);
      }
    }
  }
};

// src/spectator/VisionController.ts
init_constants();
var VisionController = class {
  /** The token whose POV we are currently presenting, or null when inactive. */
  spectated = null;
  /** When true, only the spectated token contributes vision (true POV clamp). */
  exclusive = true;
  /** Saved original method for manual-wrapper teardown. */
  originalIsVisionSource = null;
  /** lib-wrapper registration handle / flag. */
  wrapperInstalled = false;
  /** The Token class whose prototype we patched (cached for teardown). */
  tokenClass = null;
  get active() {
    return this.spectated !== null;
  }
  get token() {
    return this.spectated;
  }
  /**
   * Begin presenting `token`'s POV on this client.
   * @param exclusive Suppress the client's own tokens so the view is a pure POV.
   */
  activate(token, exclusive = true) {
    if (!token?.document) {
      log.warn("VisionController.activate called with an invalid token");
      return;
    }
    this.spectated = token;
    this.exclusive = exclusive;
    this.installWrapper();
    if (token.document.sight?.enabled === false) {
      log.debug(
        `Spectated token "${token.name}" has sight disabled; POV will reflect ambient/scene illumination only.`
      );
    }
    this.reinitializeVision();
    this.refreshPerception();
    log.debug(`VisionController active on "${token.name}" (exclusive=${exclusive})`);
  }
  /** Stop presenting a POV and fully restore normal client vision. */
  deactivate() {
    if (!this.active) return;
    this.spectated = null;
    this.removeWrapper();
    this.reinitializeVision();
    this.refreshPerception();
    log.debug("VisionController deactivated; client vision restored");
  }
  /** Re-run vision when the spectated token changes (movement, vision update, …). */
  refresh() {
    if (!this.active) return;
    this.reinitializeVision();
    this.refreshPerception();
  }
  /**
   * Swap the POV token *without* tearing the wrapper down and back up, so
   * retargeting an active session never flashes the user's own vision.
   */
  setTarget(token, exclusive = true) {
    this.spectated = token;
    this.exclusive = exclusive;
    this.installWrapper();
    this.reinitializeVision();
    this.forceRecompute();
  }
  /**
   * Best-effort *synchronous* visibility recompute, for off-screen capture where
   * we cannot wait for Foundry's debounced perception tick. Tries the known
   * synchronous entry points across core versions; if none are synchronous the
   * capture simply renders with vision that is at most one frame stale (which is
   * imperceptible while following) - documented in ARCHITECTURE.md.
   */
  forceRecompute() {
    const c = canvas;
    try {
      if (typeof c.visibility?.refresh === "function") c.visibility.refresh();
      if (typeof c.effects?.refreshVisibility === "function") c.effects.refreshVisibility();
      if (typeof c.effects?.refreshLighting === "function") c.effects.refreshLighting();
    } catch (err) {
      log.debug("forceRecompute partial failure (non-fatal)", err);
    }
    this.refreshPerception();
  }
  // -- internals -------------------------------------------------------------
  /** The predicate installed in place of Token#_isVisionSource while spectating. */
  predicate(original, self) {
    const target = this.spectated;
    if (!target) return original.call(self);
    if (self.id === target.id) return true;
    if (this.exclusive) return false;
    return original.call(self);
  }
  resolveTokenClass() {
    const cls = CONFIG?.Token?.objectClass ?? globalThis.Token;
    return cls ?? null;
  }
  installWrapper() {
    if (this.wrapperInstalled) return;
    const target = "CONFIG.Token.objectClass.prototype._isVisionSource";
    if (typeof libWrapper !== "undefined" && libWrapper?.register) {
      const self2 = this;
      libWrapper.register(
        MODULE_ID,
        target,
        function(wrapped) {
          return self2.predicate(wrapped, this);
        },
        "MIXED"
      );
      this.wrapperInstalled = true;
      log.debug("Installed _isVisionSource wrapper via lib-wrapper");
      return;
    }
    const cls = this.resolveTokenClass();
    if (!cls?.prototype) {
      log.error("Could not resolve the Token class to install a vision wrapper");
      return;
    }
    this.tokenClass = cls;
    this.originalIsVisionSource = cls.prototype._isVisionSource;
    const original = this.originalIsVisionSource;
    const self = this;
    cls.prototype._isVisionSource = function() {
      return self.predicate(original, this);
    };
    this.wrapperInstalled = true;
    log.debug("Installed _isVisionSource wrapper via manual prototype patch");
  }
  removeWrapper() {
    if (!this.wrapperInstalled) return;
    if (typeof libWrapper !== "undefined" && libWrapper?.unregister) {
      try {
        libWrapper.unregister(MODULE_ID, "CONFIG.Token.objectClass.prototype._isVisionSource");
      } catch (err) {
        log.warn("lib-wrapper unregister failed (already removed?)", err);
      }
    } else if (this.tokenClass && this.originalIsVisionSource) {
      this.tokenClass.prototype._isVisionSource = this.originalIsVisionSource;
    }
    this.originalIsVisionSource = null;
    this.tokenClass = null;
    this.wrapperInstalled = false;
  }
  /** Ask every token to (re)build its vision source under the new predicate. */
  reinitializeVision() {
    const placeables = canvas?.tokens?.placeables ?? [];
    for (const t of placeables) {
      try {
        if (typeof t.initializeVisionSource === "function") t.initializeVisionSource({ deleted: false });
        else if (typeof t.updateVisionSource === "function") t.updateVisionSource();
      } catch (err) {
        log.debug(`vision reinit skipped for ${t.name}`, err);
      }
    }
  }
  /**
   * Trigger a full perception refresh. Foundry's perception flags have changed
   * names across versions, so we pass the superset and let core ignore unknowns.
   */
  refreshPerception() {
    try {
      canvas?.perception?.update(
        {
          initializeVision: true,
          refreshVision: true,
          refreshLighting: true,
          refreshOcclusion: true,
          refreshFog: true,
          forceUpdateFog: true
        },
        true
      );
    } catch (err) {
      try {
        canvas?.perception?.update({ refreshVision: true, refreshLighting: true });
      } catch (err2) {
        log.warn("perception refresh failed", err ?? err2);
      }
    }
  }
};

// src/spectator/SpectatorManager.ts
var SpectatorManager = class {
  vision = new VisionController();
  occlusion = new OcclusionController();
  camera = new CameraLock();
  bar = new SpectateBar();
  currentTokenId = null;
  /** Actor behind the spectated token, for cross-scene re-follow. */
  currentActorId = null;
  /** Id of the token currently being spectated, or null. */
  get tokenId() {
    return this.currentTokenId;
  }
  get active() {
    return this.currentTokenId !== null;
  }
  /** Resolve the effective camera config from settings. */
  cameraConfig() {
    return getSettings().camera;
  }
  /**
   * Start (or retarget) spectating a token by id. Returns true on success.
   * `exclusivePov` clamps the view to strictly the token's POV (no info leak).
   */
  start(tokenId, exclusivePov = true) {
    const token = canvas?.tokens?.get(tokenId);
    if (!token) {
      log.warn(`spectate: token ${tokenId} not found on this scene`);
      return false;
    }
    const decision = PermissionManager.canSpectate(game.user, token);
    if (!decision.allowed) {
      ui.notifications.warn(
        game.i18n.format("dynamic-spectator.notify.notAllowed", { name: token.name })
      );
      log.debug(`spectate denied for ${token.name}: ${decision.reason}`);
      return false;
    }
    const retarget = this.active;
    this.vision.activate(token, exclusivePov);
    this.occlusion.activate(token, exclusivePov);
    if (retarget) this.camera.retarget(token);
    else this.camera.lock(token, this.cameraConfig());
    this.setIndicator(this.currentTokenId, false);
    this.currentTokenId = token.id;
    this.currentActorId = token.actor?.id ?? null;
    this.setIndicator(token.id, true);
    this.bar.show(token.name, () => this.stop());
    Hooks.callAll(HOOKS.spectateStart, { tokenId: token.id, exclusive: exclusivePov });
    log.info(`Spectating "${token.name}"`);
    return true;
  }
  /** Stop spectating and restore normal vision + camera. */
  stop() {
    if (!this.active) return;
    const prev = this.currentTokenId;
    this.setIndicator(prev, false);
    this.bar.hide();
    this.vision.deactivate();
    this.occlusion.deactivate();
    this.camera.release();
    this.currentTokenId = null;
    this.currentActorId = null;
    Hooks.callAll(HOOKS.spectateStop, { tokenId: prev });
    log.info("Stopped spectating");
  }
  /** The actor currently being spectated (for cross-scene re-follow). */
  get actorId() {
    return this.currentActorId;
  }
  /**
   * After a scene change, try to keep spectating the same *character* by finding
   * a token for the same actor on the new scene. Returns true if re-followed.
   */
  attemptCrossSceneFollow() {
    if (!this.currentActorId) return false;
    const replacement = (canvas?.tokens?.placeables ?? []).find(
      (t) => t.actor?.id === this.currentActorId
    );
    if (!replacement) return false;
    return this.start(replacement.id);
  }
  /** Toggle spectating a token: start if not this token, else stop. */
  toggle(tokenId) {
    if (this.currentTokenId === tokenId) this.stop();
    else this.start(tokenId);
  }
  /**
   * React to a change on the spectated token. Called by the SyncBridge on
   * movement / vision / elevation updates so the POV stays live.
   */
  onTokenUpdate(tokenId) {
    if (this.currentTokenId !== tokenId) return;
    this.vision.refresh();
    this.occlusion.refresh();
  }
  /** The spectated token was removed / left the scene - tear down cleanly. */
  onTokenGone(tokenId) {
    if (this.currentTokenId !== tokenId) return;
    log.debug("spectated token gone; stopping");
    this.stop();
  }
  // -- indicator -------------------------------------------------------------
  /** Toggle a subtle pulsing ring on the token being spectated (local only). */
  setIndicator(tokenId, on) {
    if (!tokenId) return;
    const token = canvas?.tokens?.get(tokenId);
    if (!token) return;
    try {
      token[`${FLAG_SCOPE}-spectating`] = on;
      token.renderFlags?.set?.({ refreshState: true });
    } catch (err) {
      log.debug("indicator toggle failed", err);
    }
  }
};

// src/sync/SyncBridge.ts
init_constants();
var POV_FIELDS = ["x", "y", "elevation", "rotation", "hidden", "sight", "vision", "light"];
function registerSyncHooks() {
  Hooks.on("updateToken", (doc, changes) => {
    const touched = POV_FIELDS.some((f) => f in changes);
    if (!touched) return;
    state().spectator.onTokenUpdate(doc.id);
  });
  Hooks.on("refreshToken", (token) => {
    const s = state();
    if (s.spectator.tokenId === token.id) s.spectator.onTokenUpdate(token.id);
  });
  Hooks.on("deleteToken", (doc) => {
    state().spectator.onTokenGone(doc.id);
  });
  Hooks.on("updateToken", (doc, changes) => {
    if (!("ownership" in changes) && !("actorId" in changes)) return;
    revalidatePermissions(doc.id);
  });
  Hooks.on("updateActor", (actor) => {
    const s = state();
    const token = (canvas?.tokens?.placeables ?? []).find((t) => t.actor?.id === actor.id);
    if (token && s.spectator.tokenId === token.id) s.spectator.onTokenUpdate(token.id);
  });
  Hooks.on("canvasReady", () => {
    handleSceneChange();
  });
  log.debug("sync hooks registered");
}
function revalidatePermissions(tokenId) {
  const s = state();
  if (s.spectator.tokenId !== tokenId) return;
  const token = canvas?.tokens?.get(tokenId);
  if (!token) return;
  Promise.resolve().then(() => (init_PermissionManager(), PermissionManager_exports)).then(({ PermissionManager: PermissionManager2 }) => {
    if (!PermissionManager2.allowed(game.user, token)) {
      log.info("permission revoked for spectated token; stopping");
      s.spectator.stop();
    }
  });
}
function handleSceneChange() {
  let s;
  try {
    s = state();
  } catch {
    return;
  }
  const behaviour = getSettings().crossSceneBehaviour;
  if (s.spectator.active && s.spectator.actorId) {
    const stillHere = canvas?.tokens?.get(s.spectator.tokenId ?? "");
    if (!stillHere) {
      applyCrossScene(behaviour, () => s.spectator.attemptCrossSceneFollow(), () => s.spectator.stop());
    }
  }
}
function applyCrossScene(behaviour, follow, drop) {
  if (behaviour === "follow" /* Follow */) {
    if (!follow()) drop();
  } else if (behaviour === "drop" /* Drop */) {
    drop();
  } else {
    promptCrossScene(() => {
      if (!follow()) drop();
    }, drop);
  }
}
function promptCrossScene(onFollow, onDrop) {
  const title = game.i18n.localize("dynamic-spectator.crossScene.title");
  const content = `<p>${game.i18n.localize("dynamic-spectator.crossScene.body")}</p>`;
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (DialogV2?.confirm) {
    DialogV2.confirm({
      window: { title },
      content,
      yes: { label: game.i18n.localize("dynamic-spectator.crossScene.follow") },
      no: { label: game.i18n.localize("dynamic-spectator.crossScene.drop") }
    }).then((ok) => ok ? onFollow() : onDrop()).catch(onDrop);
  } else {
    onFollow();
  }
}

// src/ui/controls.ts
init_constants();
init_PermissionManager();

// src/ui/GMDashboard.ts
init_constants();
init_PermissionManager();
var { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
var GMDashboard = class _GMDashboard extends HandlebarsApplicationMixin(ApplicationV2) {
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
    position: { width: 440, height: "auto" },
    actions: {
      spectatePlayer: _GMDashboard.onSpectatePlayer
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
  static instance = null;
  async _prepareContext() {
    const overrides = game.settings.get(MODULE_ID, SETTINGS.perPlayerPermissions) ?? {};
    const players = game.users.filter((u) => !u.isGM).map((u) => ({
      id: u.id,
      name: u.name,
      active: u.active,
      color: typeof u.color === "string" ? u.color : u.color?.css ?? "#888",
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
  permissionOptions(current) {
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
  playerToken(user) {
    const charId = user.character?.id;
    return (canvas?.tokens?.placeables ?? []).find(
      (t) => t.actor?.id && (t.actor.id === charId || t.document.testUserPermission(user, "OWNER"))
    );
  }
  _onRender(_context, _options) {
    const root = this.element;
    root.querySelectorAll("[data-ds-permission]").forEach((select) => {
      select.addEventListener("change", () => void this.setPermission(select));
    });
  }
  /** Persist (or clear) the per-player override behind one dropdown. */
  async setPermission(select) {
    const userId = select.closest("[data-user-id]")?.dataset.userId;
    if (!userId) return;
    const mode = select.value === PERMISSION_DEFAULT ? null : select.value;
    await PermissionManager.setPlayerOverride(userId, mode);
    this.render();
  }
  // -- actions ---------------------------------------------------------------
  static onSpectatePlayer(_event, target) {
    const userId = target.closest("[data-user-id]")?.dataset.userId;
    if (!userId) return;
    const user = game.users.get(userId);
    if (!user) return;
    const token = this.playerToken(user);
    if (token) state().spectator.start(token.id);
    else ui.notifications.warn(game.i18n.localize("dynamic-spectator.notify.noPlayerToken"));
  }
  static show() {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("dynamic-spectator.notify.gmOnly"));
      return;
    }
    const existing = _GMDashboard.instance;
    if (existing?.rendered) {
      existing.bringToFront?.();
      return;
    }
    const app = new _GMDashboard();
    _GMDashboard.instance = app;
    app.render(true);
  }
  _onClose(options) {
    super._onClose(options);
    if (_GMDashboard.instance === this) _GMDashboard.instance = null;
  }
};

// src/ui/SpectatorPicker.ts
init_constants();
init_PermissionManager();
var { ApplicationV2: ApplicationV22, HandlebarsApplicationMixin: HandlebarsApplicationMixin2 } = foundry.applications.api;
var ROW_FIELDS = ["name", "texture", "elevation", "disposition", "hidden", "ownership", "actorId"];
var SpectatorPicker = class _SpectatorPicker extends HandlebarsApplicationMixin2(ApplicationV22) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-picker`,
    tag: "div",
    classes: [`${MODULE_ID}-app`, `${MODULE_ID}-picker`],
    window: {
      title: "dynamic-spectator.picker.title",
      icon: "fa-solid fa-eye",
      resizable: true
      // No `controls` entry here: ApplicationV2 always collapses those behind
      // an ellipsis toggle. The settings button is a plain header icon instead,
      // injected by hand in `_onRender` - see `injectSettingsButton`.
    },
    position: { width: 264, height: 400 },
    actions: {
      stop: _SpectatorPicker.onStop,
      optOut: _SpectatorPicker.onOptOut,
      toggleNpc: _SpectatorPicker.onToggleNpc,
      openSettings: _SpectatorPicker.onOpenSettings,
      ringSettings: _SpectatorPicker.onRingSettings
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
  static instance = null;
  /** Current search query (kept across re-renders). */
  query = "";
  async _prepareContext() {
    const s = state();
    const user = game.user;
    const placeables = canvas?.tokens?.placeables ?? [];
    const settings = getSettings();
    const rows = placeables.map((t) => {
      const decision = PermissionManager.canSpectate(user, t);
      const isNpc = PermissionManager.isNpc(t);
      const override = getTokenIndicatorOverride(t.id);
      return {
        tokenId: t.id,
        name: t.name,
        img: t.document.texture?.src ?? t.actor?.img ?? "icons/svg/mystery-man.svg",
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
      };
    }).filter((r) => r.allowed).sort((a, b) => a.name.localeCompare(b.name));
    return {
      rows,
      hasRows: rows.length > 0,
      spectating: s.spectator.active,
      isGM: user.isGM,
      query: this.query,
      perTokenEnabled: settings.indicatorPerToken,
      version: game.modules.get(MODULE_ID)?.version ?? ""
    };
  }
  _onRender(_context, _options) {
    const root = this.element;
    this.injectSettingsButton(root);
    const search = root.querySelector("[data-ds-search]");
    if (search) {
      search.value = this.query;
      search.addEventListener("input", () => {
        this.query = search.value.toLowerCase();
        this.filterRows(root);
      });
      this.filterRows(root);
    }
    root.querySelectorAll("[data-ds-row]").forEach((row) => {
      const activate = () => {
        const id = row.dataset.tokenId;
        if (!id) return;
        state().spectator.toggle(id);
        this.render();
      };
      row.addEventListener("click", (ev) => {
        if (ev.target.closest("[data-action]")) return;
        activate();
      });
      row.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        ev.preventDefault();
        activate();
      });
    });
  }
  /**
   * A single gear icon in the header, beside the close button - not the
   * dropdown ApplicationV2's `window.controls` would otherwise force. Runs on
   * every render but bails out if already present, since `_onRender` fires on
   * every re-render and the header markup is rebuilt each time.
   */
  injectSettingsButton(root) {
    const header = root.querySelector(".window-header");
    if (!header || header.querySelector("[data-action='openSettings']")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "header-control icon fa-solid fa-gear";
    button.dataset.action = "openSettings";
    button.dataset.tooltip = game.i18n.localize("dynamic-spectator.picker.settings");
    const close = header.querySelector("[data-action='close']");
    if (close) close.before(button);
    else header.appendChild(button);
  }
  filterRows(root) {
    const q = this.query.trim();
    root.querySelectorAll("[data-ds-row]").forEach((el) => {
      const name = (el.dataset.name ?? "").toLowerCase();
      el.style.display = !q || name.includes(q) ? "" : "none";
    });
  }
  dispositionLabel(d) {
    if (d > 0) return game.i18n.localize("dynamic-spectator.disposition.friendly");
    if (d < 0) return game.i18n.localize("dynamic-spectator.disposition.hostile");
    return game.i18n.localize("dynamic-spectator.disposition.neutral");
  }
  static tokenIdFrom(target) {
    return target.closest("[data-token-id]")?.dataset.tokenId ?? null;
  }
  // -- actions ---------------------------------------------------------------
  static onStop() {
    state().spectator.stop();
    this.render();
  }
  static async onOptOut(_event, target) {
    const id = _SpectatorPicker.tokenIdFrom(target);
    const token = id ? canvas?.tokens?.get(id) : null;
    if (!token) return;
    const current = Boolean(token.document.getFlag(MODULE_ID, TOKEN_FLAGS.noSpectate));
    await PermissionManager.setOptOut(token, !current);
    this.render();
    log.debug(`opt-out ${!current} for ${token.name}`);
  }
  /** GM-only: toggle whether players may spectate this specific NPC token. */
  static async onToggleNpc(_event, target) {
    const id = _SpectatorPicker.tokenIdFrom(target);
    const token = id ? canvas?.tokens?.get(id) : null;
    if (!token) return;
    const current = PermissionManager.npcSpectatable(token);
    await PermissionManager.setNpcSpectatable(token, !current);
    this.render();
    log.debug(`npc-spectatable ${!current} for ${token.name}`);
  }
  /**
   * Open the core Settings config, landing directly on our category rather
   * than whatever it last had selected. The category sidebar has no public
   * API for this, so once it renders we find and click our own entry -
   * matched by id first, falling back to matching the visible title text in
   * case the category markup changes shape across versions.
   */
  static onOpenSettings() {
    const sheet = game.settings.sheet;
    if (!sheet) return;
    Hooks.once("renderSettingsConfig", (_app, htmlOrElement) => {
      const root = htmlOrElement instanceof HTMLElement ? htmlOrElement : htmlOrElement?.[0] ?? htmlOrElement?.element ?? null;
      if (!root) return;
      const byId = root.querySelector(
        `[data-category="${MODULE_ID}"], [data-tab="${MODULE_ID}"]`
      );
      if (byId) {
        byId.click();
        return;
      }
      const candidates = Array.from(root.querySelectorAll("li, a, button"));
      candidates.find((el) => el.textContent?.trim().startsWith(MODULE_TITLE))?.click();
    });
    sheet.render(true);
  }
  /** Open a small dialog to set (or reset) this token's ring colour/opacity/thickness. */
  static async onRingSettings(_event, target) {
    const id = _SpectatorPicker.tokenIdFrom(target);
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
    const DialogV2 = foundry.applications?.api?.DialogV2;
    if (!DialogV2) return;
    await DialogV2.wait({
      window: { title: `${game.i18n.localize("dynamic-spectator.picker.ringSettings")} - ${token.name}` },
      content,
      buttons: [
        {
          action: "save",
          label: game.i18n.localize("dynamic-spectator.picker.save"),
          default: true,
          callback: async (_ev, button) => {
            const form = button.form;
            await setTokenIndicatorOverride(id, {
              color: form.elements.namedItem("color").value,
              opacity: Number(form.elements.namedItem("opacity").value),
              width: Number(form.elements.namedItem("width").value)
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
  static show() {
    const existing = _SpectatorPicker.instance;
    if (existing?.rendered) {
      existing.bringToFront?.();
      return;
    }
    const app = new _SpectatorPicker();
    _SpectatorPicker.instance = app;
    app.render(true);
  }
  _onClose(options) {
    super._onClose(options);
    if (_SpectatorPicker.instance === this) _SpectatorPicker.instance = null;
  }
  /**
   * Re-render the list in place, preserving the search box's focus and caret so
   * a refresh landing mid-keystroke does not interrupt typing. The query itself
   * already survives via `this.query`.
   */
  async refreshList() {
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
  searchInput() {
    const root = this.element;
    return root?.querySelector("[data-ds-search]") ?? null;
  }
  /**
   * Keep an open picker in step with the scene. Registered once at boot; every
   * handler is a no-op while the picker is closed.
   */
  static registerRefreshHooks() {
    const refresh = foundry.utils.debounce(() => {
      void _SpectatorPicker.instance?.refreshList();
    }, 100);
    Hooks.on("createToken", () => refresh());
    Hooks.on("deleteToken", () => refresh());
    Hooks.on("updateToken", (_doc, changes) => {
      if (_SpectatorPicker.touchesRow(changes)) refresh();
    });
    Hooks.on("updateActor", () => refresh());
    Hooks.on("canvasReady", () => refresh());
    Hooks.on("updateSetting", (setting) => {
      if (setting?.key?.startsWith(`${MODULE_ID}.`)) refresh();
    });
    Hooks.on(HOOKS.indicatorPerTokenChanged, () => refresh());
    log.debug("picker refresh hooks registered");
  }
  /** Does this token update change anything the list shows or gates on? */
  static touchesRow(changes) {
    if (ROW_FIELDS.some((f) => f in changes)) return true;
    const flags = changes.flags;
    return Boolean(flags && MODULE_ID in flags);
  }
};

// src/ui/controls.ts
function quickSpectate() {
  const s = state();
  const hovered = canvas?.tokens?.hover ?? null;
  const controlled = canvas?.tokens?.controlled?.[0];
  const targeted = game.user?.targets?.first?.();
  const candidate = hovered ?? controlled ?? targeted;
  if (candidate && PermissionManager.allowed(game.user, candidate)) {
    s.spectator.toggle(candidate.id);
  } else {
    SpectatorPicker.show();
  }
}
function registerKeybindings() {
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
  kb.register(MODULE_ID, "stopSpectate", {
    name: "dynamic-spectator.keys.stopSpectate.name",
    hint: "dynamic-spectator.keys.stopSpectate.hint",
    editable: [{ key: "Escape", modifiers: [] }],
    precedence: CONST?.KEYBINDING_PRECEDENCE?.PRIORITY ?? 0,
    onDown: () => {
      const s = state();
      if (!s.spectator.active) return false;
      s.spectator.stop();
      return true;
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
function registerSceneControls() {
  Hooks.on("getSceneControlButtons", (controls) => {
    try {
      const tools = [
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
      if (!Array.isArray(controls)) {
        const tokenControl2 = controls.tokens ?? controls.token;
        if (tokenControl2) {
          tokenControl2.tools ??= {};
          for (const t of tools) tokenControl2.tools[t.name] = t;
        }
        return;
      }
      const tokenControl = controls.find((c) => c.name === "token" || c.name === "tokens");
      if (tokenControl?.tools) tokenControl.tools.push(...tools);
    } catch (err) {
      log.error("scene control registration failed", err);
    }
  });
}
function registerTokenHud() {
  Hooks.on("renderTokenHUD", (hud, html) => {
    const token = hud?.object;
    if (!token) return;
    if (!PermissionManager.allowed(game.user, token)) return;
    const root = html?.[0] ?? (html instanceof HTMLElement ? html : null);
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
function registerTokenIndicator() {
  const draw = (token) => {
    try {
      const on = Boolean(token[`${FLAG_SCOPE}-spectating`]) && getIndicatorConfig(token.id).enabled;
      const existing = token._dsIndicator;
      if (on && !existing) {
        const g = new PIXI.Graphics();
        token._dsIndicator = g;
        token.addChild?.(g);
        redraw(token, g);
      } else if (!on && existing) {
        existing.destroy?.();
        token._dsIndicator = null;
      } else if (on && existing) {
        redraw(token, existing);
      }
    } catch (err) {
      log.debug("indicator draw failed", err);
    }
  };
  const redraw = (token, g) => {
    const { color, opacity, width } = getIndicatorConfig(token.id);
    const w = token.w ?? 100;
    const h = token.h ?? 100;
    const r = Math.max(w, h) / 2 + 6;
    g.clear();
    if (typeof g.circle === "function" && typeof g.stroke === "function") {
      g.circle(w / 2, h / 2, r).stroke({ width, color, alpha: opacity });
    } else {
      g.lineStyle(width, color, opacity);
      g.drawCircle(w / 2, h / 2, r);
      g.lineStyle(0);
    }
  };
  Hooks.on("refreshToken", (token) => draw(token));
  Hooks.on("drawToken", (token) => draw(token));
}
function registerAllControls() {
  const safe = (label, fn) => {
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

// src/module.ts
var TEMPLATES = [
  `modules/${MODULE_ID}/templates/spectator-picker.hbs`,
  `modules/${MODULE_ID}/templates/gm-dashboard.hbs`
];
function buildApi() {
  return {
    version: "2.1.4",
    /** Spectate a token by id. */
    spectate: (tokenId, exclusive = true) => DS.spectator?.start(tokenId, exclusive),
    stopSpectate: () => DS.spectator?.stop(),
    toggleSpectate: (tokenId) => DS.spectator?.toggle(tokenId),
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
function bootPhase(phase, fn) {
  try {
    fn();
  } catch (err) {
    log.error(`boot phase "${phase}" failed (isGM=${game?.user?.isGM})`, err);
  }
}
Hooks.once("init", () => {
  log.info(`Initializing ${MODULE_TITLE} v2.1.4 (user "${game?.user?.name}", GM=${game?.user?.isGM})`);
  bootPhase("settings", () => registerSettings());
  bootPhase("controls", () => registerAllControls());
  bootPhase("templates", () => {
    const loader = foundry.applications?.handlebars?.loadTemplates ?? globalThis.loadTemplates;
    if (typeof loader === "function") {
      loader(TEMPLATES).catch((err) => log.warn("template preload failed", err));
    }
  });
});
Hooks.once("setup", () => {
  bootPhase("managers", () => {
    DS.spectator = new SpectatorManager();
    const api = buildApi();
    const mod = game.modules.get(MODULE_ID);
    if (mod) mod.api = api;
    globalThis.DynamicSpectator = api;
    log.debug("manager constructed; API published");
  });
});
Hooks.once("ready", () => {
  bootPhase("sync", () => registerSyncHooks());
  DS.ready = true;
  Hooks.callAll(`${MODULE_ID}.ready`, buildApi());
  log.info(`${MODULE_TITLE} ready for "${game?.user?.name}"`);
});
Hooks.on("canvasTearDown", () => {
  try {
    DS.spectator?.stop();
  } catch (err) {
    log.debug("teardown cleanup skipped", err);
  }
});
//# sourceMappingURL=dynamic-spectator.js.map
