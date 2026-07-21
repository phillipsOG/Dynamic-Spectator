/* Dynamic Spectator — bundled by esbuild. Source: https://github.com/phillipsOG/Dynamic-Spectator */
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
var MODULE_ID, MODULE_TITLE, SOCKET, FLAG_SCOPE, HOOKS, SETTINGS, PermissionMode, OVERLAY_FIELDS, DOM;
var init_constants = __esm({
  "src/constants.ts"() {
    "use strict";
    MODULE_ID = "dynamic-spectator";
    MODULE_TITLE = "Dynamic Spectator";
    SOCKET = `module.${MODULE_ID}`;
    FLAG_SCOPE = MODULE_ID;
    HOOKS = {
      spectateStart: `${MODULE_ID}.spectateStart`,
      spectateStop: `${MODULE_ID}.spectateStop`,
      multiViewOpen: `${MODULE_ID}.multiViewOpen`,
      multiViewClose: `${MODULE_ID}.multiViewClose`,
      viewportsChanged: `${MODULE_ID}.viewportsChanged`
    };
    SETTINGS = {
      // Permissions
      permissionMode: "permissionMode",
      perPlayerPermissions: "perPlayerPermissions",
      // MultiView core
      maxCameras: "maxCameras",
      autoGrouping: "autoGrouping",
      elevationThreshold: "elevationThreshold",
      groupingDistance: "groupingDistance",
      // Layout / overlay
      viewportPadding: "viewportPadding",
      overlayFields: "overlayFields",
      streamingMode: "streamingMode",
      // Camera behaviour
      cameraMode: "cameraMode",
      followSpeed: "followSpeed",
      transitionSpeed: "transitionSpeed",
      deadZone: "deadZone",
      zoomMemory: "zoomMemory",
      // Performance / rendering
      performanceMode: "performanceMode",
      renderScale: "renderScale",
      frameRateCap: "frameRateCap",
      secondaryCadence: "secondaryCadence",
      // Multi-scene
      crossSceneBehaviour: "crossSceneBehaviour",
      // Diagnostics
      debugLogging: "debugLogging",
      profiling: "profiling"
    };
    PermissionMode = /* @__PURE__ */ ((PermissionMode2) => {
      PermissionMode2["GMOnly"] = "gm-only";
      PermissionMode2["OwnedOnly"] = "owned-only";
      PermissionMode2["PartyMembers"] = "party-members";
      PermissionMode2["AnyPlayerToken"] = "any-player-token";
      PermissionMode2["AnyToken"] = "any-token";
      return PermissionMode2;
    })(PermissionMode || {});
    OVERLAY_FIELDS = [
      "characterName",
      "playerName",
      "hp",
      "conditions",
      "elevation",
      "distance",
      "statusEffects",
      "scene",
      "direction"
    ];
    DOM = {
      multiViewRoot: `${MODULE_ID}-multiview`,
      viewportClass: `${MODULE_ID}-viewport`,
      overlayClass: `${MODULE_ID}-overlay`,
      spectateIndicator: `${MODULE_ID}-spectating`
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
        const global = game.settings.get(MODULE_ID, SETTINGS.permissionMode) ?? "owned-only" /* OwnedOnly */;
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
      /**
       * The central decision. Returns both the boolean and a machine-readable reason
       * so the UI can explain *why* a token is greyed out.
       */
      static canSpectate(user, token) {
        if (!token?.document) return { allowed: false, reason: "no-token" };
        if (user.isGM) return { allowed: true, reason: "gm" };
        const optedOut = Boolean(token.document.getFlag(FLAG_SCOPE, "noSpectate"));
        if (optedOut) return { allowed: false, reason: "opted-out" };
        const mode = this.modeFor(user);
        const owns = token.document.testUserPermission(user, "OWNER");
        switch (mode) {
          case "gm-only" /* GMOnly */:
            return { allowed: false, reason: "gm-only" };
          case "owned-only" /* OwnedOnly */:
            return owns ? { allowed: true, reason: "owned" } : { allowed: false, reason: "not-owned" };
          case "party-members" /* PartyMembers */:
            if (owns) return { allowed: true, reason: "owned" };
            return this.isPartyToken(token) ? { allowed: true, reason: "party" } : { allowed: false, reason: "not-party" };
          case "any-player-token" /* AnyPlayerToken */:
            if (owns) return { allowed: true, reason: "owned" };
            return this.hasPlayerOwner(token) ? { allowed: true, reason: "player-token" } : { allowed: false, reason: "npc" };
          case "any-token" /* AnyToken */:
            return { allowed: true, reason: "any" };
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
        if (optOut) await token.document.setFlag(FLAG_SCOPE, "noSpectate", true);
        else await token.document.unsetFlag(FLAG_SCOPE, "noSpectate");
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

// src/multiview/MultiViewManager.ts
init_constants();
init_PermissionManager();

// src/settings.ts
init_constants();

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
function defaultOverlayFields() {
  const base = {};
  for (const f of OVERLAY_FIELDS) base[f] = false;
  base.characterName = true;
  base.hp = true;
  base.elevation = true;
  return base;
}
function registerSettings(onChange) {
  const change = () => {
    try {
      onChange?.();
    } catch (err) {
      log.error("settings onChange handler failed", err);
    }
  };
  game.settings.register(MODULE_ID, SETTINGS.permissionMode, {
    name: L("permissionMode.name"),
    hint: L("permissionMode.hint"),
    scope: "world",
    config: true,
    type: String,
    default: "owned-only" /* OwnedOnly */,
    choices: {
      ["gm-only" /* GMOnly */]: L("permissionMode.gmOnly"),
      ["owned-only" /* OwnedOnly */]: L("permissionMode.ownedOnly"),
      ["party-members" /* PartyMembers */]: L("permissionMode.partyMembers"),
      ["any-player-token" /* AnyPlayerToken */]: L("permissionMode.anyPlayerToken"),
      ["any-token" /* AnyToken */]: L("permissionMode.anyToken")
    },
    onChange: change
  });
  game.settings.register(MODULE_ID, SETTINGS.perPlayerPermissions, {
    scope: "world",
    config: false,
    type: Object,
    default: {},
    onChange: change
  });
  game.settings.register(MODULE_ID, SETTINGS.maxCameras, {
    name: L("maxCameras.name"),
    hint: L("maxCameras.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 1, max: 16, step: 1 },
    default: 4,
    onChange: change
  });
  game.settings.register(MODULE_ID, SETTINGS.autoGrouping, {
    name: L("autoGrouping.name"),
    hint: L("autoGrouping.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: change
  });
  game.settings.register(MODULE_ID, SETTINGS.elevationThreshold, {
    name: L("elevationThreshold.name"),
    hint: L("elevationThreshold.hint"),
    scope: "world",
    config: true,
    type: Number,
    range: { min: 0, max: 100, step: 1 },
    default: 5,
    onChange: change
  });
  game.settings.register(MODULE_ID, SETTINGS.groupingDistance, {
    name: L("groupingDistance.name"),
    hint: L("groupingDistance.hint"),
    scope: "world",
    config: true,
    type: Number,
    range: { min: 0, max: 200, step: 5 },
    default: 60,
    onChange: change
  });
  game.settings.register(MODULE_ID, SETTINGS.viewportPadding, {
    name: L("viewportPadding.name"),
    hint: L("viewportPadding.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 0, max: 32, step: 1 },
    default: 6,
    onChange: change
  });
  game.settings.register(MODULE_ID, SETTINGS.overlayFields, {
    scope: "client",
    config: false,
    type: Object,
    default: defaultOverlayFields(),
    onChange: change
  });
  game.settings.register(MODULE_ID, SETTINGS.streamingMode, {
    name: L("streamingMode.name"),
    hint: L("streamingMode.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: change
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
    },
    onChange: change
  });
  game.settings.register(MODULE_ID, SETTINGS.followSpeed, {
    name: L("followSpeed.name"),
    hint: L("followSpeed.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 0.05, max: 1, step: 0.05 },
    default: 0.6,
    onChange: change
  });
  game.settings.register(MODULE_ID, SETTINGS.transitionSpeed, {
    name: L("transitionSpeed.name"),
    hint: L("transitionSpeed.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 0.05, max: 1, step: 0.05 },
    default: 0.5,
    onChange: change
  });
  game.settings.register(MODULE_ID, SETTINGS.deadZone, {
    name: L("deadZone.name"),
    hint: L("deadZone.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 0, max: 0.9, step: 0.05 },
    default: 0.2,
    onChange: change
  });
  game.settings.register(MODULE_ID, SETTINGS.zoomMemory, {
    name: L("zoomMemory.name"),
    hint: L("zoomMemory.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    onChange: change
  });
  game.settings.register(MODULE_ID, SETTINGS.performanceMode, {
    name: L("performanceMode.name"),
    hint: L("performanceMode.hint"),
    scope: "client",
    config: true,
    type: String,
    default: "balanced" /* Balanced */,
    choices: {
      ["quality" /* Quality */]: L("performanceMode.quality"),
      ["balanced" /* Balanced */]: L("performanceMode.balanced"),
      ["performance" /* Performance */]: L("performanceMode.performance"),
      ["battery" /* Battery */]: L("performanceMode.battery")
    },
    onChange: change
  });
  game.settings.register(MODULE_ID, SETTINGS.renderScale, {
    name: L("renderScale.name"),
    hint: L("renderScale.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 0.25, max: 1, step: 0.05 },
    default: 1,
    onChange: change
  });
  game.settings.register(MODULE_ID, SETTINGS.frameRateCap, {
    name: L("frameRateCap.name"),
    hint: L("frameRateCap.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 15, max: 144, step: 1 },
    default: 60,
    onChange: change
  });
  game.settings.register(MODULE_ID, SETTINGS.secondaryCadence, {
    name: L("secondaryCadence.name"),
    hint: L("secondaryCadence.hint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 1, max: 6, step: 1 },
    default: 2,
    onChange: change
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
    },
    onChange: change
  });
  game.settings.register(MODULE_ID, SETTINGS.debugLogging, {
    name: L("debugLogging.name"),
    hint: L("debugLogging.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });
  game.settings.register(MODULE_ID, SETTINGS.profiling, {
    name: L("profiling.name"),
    hint: L("profiling.hint"),
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: change
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
function getSettings() {
  const overlayFields = read(
    SETTINGS.overlayFields,
    defaultOverlayFields()
  );
  return {
    permissionMode: read(SETTINGS.permissionMode, "owned-only" /* OwnedOnly */),
    maxCameras: read(SETTINGS.maxCameras, 4),
    autoGrouping: read(SETTINGS.autoGrouping, true),
    elevationThreshold: read(SETTINGS.elevationThreshold, 5),
    groupingDistance: read(SETTINGS.groupingDistance, 60),
    viewportPadding: read(SETTINGS.viewportPadding, 6),
    overlayFields: { ...defaultOverlayFields(), ...overlayFields },
    streamingMode: read(SETTINGS.streamingMode, false),
    camera: {
      mode: read(SETTINGS.cameraMode, "smooth" /* Smooth */),
      followSpeed: read(SETTINGS.followSpeed, 0.6),
      deadZone: read(SETTINGS.deadZone, 0.2),
      zoomMemory: read(SETTINGS.zoomMemory, true),
      followRotation: false
    },
    transitionSpeed: read(SETTINGS.transitionSpeed, 0.5),
    performanceMode: read(SETTINGS.performanceMode, "balanced" /* Balanced */),
    renderScale: read(SETTINGS.renderScale, 1),
    frameRateCap: read(SETTINGS.frameRateCap, 60),
    secondaryCadence: read(SETTINGS.secondaryCadence, 2),
    crossSceneBehaviour: read(SETTINGS.crossSceneBehaviour, "prompt" /* Prompt */),
    debugLogging: read(SETTINGS.debugLogging, false),
    profiling: read(SETTINGS.profiling, false)
  };
}

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
   * Swap the POV token *without* reinstalling the wrapper. Used by MultiView to
   * rapidly cycle POV per off-screen capture while keeping a single wrapper
   * installed for the whole session.
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
   * imperceptible while following) — documented in ARCHITECTURE.md.
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

// src/util/math.ts
var clamp = (v, min, max) => Math.min(Math.max(v, min), max);
var lerp = (a, b, t) => a + (b - a) * t;
function smoothingFactor(speed, dtMs) {
  const s = clamp(speed, 1e-3, 1);
  const halfLife = lerp(600, 20, s);
  return 1 - Math.pow(2, -dtMs / halfLife);
}
var dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
function heading(dx, dy) {
  if (dx === 0 && dy === 0) return void 0;
  const deg = Math.atan2(dx, -dy) * 180 / Math.PI;
  return (deg + 360) % 360;
}
function aspectClass(width, height) {
  if (height <= 0) return "wide";
  const r = width / height;
  if (r < 0.9) return "portrait";
  if (r < 1.3) return "square";
  if (r < 2.2) return "wide";
  return "ultrawide";
}

// src/multiview/GroupingEngine.ts
var GroupingEngine = class {
  /**
   * Partition tokens into elevation-then-distance groups.
   */
  static group(tokens, opts) {
    if (tokens.length === 0) return [];
    const bands = this.elevationBands(tokens, opts.elevationThreshold);
    const distancePx = opts.groupingDistance * opts.gridSize;
    const groups = [];
    for (const band of bands) {
      const clusters = this.distanceClusters(band.tokens, distancePx);
      clusters.forEach((cluster, i) => {
        const centroid = this.centroid(cluster);
        groups.push({
          key: `e${Math.round(band.centre)}-c${i}`,
          elevation: band.centre,
          tokenIds: cluster.map((t) => t.id),
          centroid
        });
      });
    }
    return groups;
  }
  /** Only groups within `threshold` of the observer's elevation. */
  static observedAtElevation(groups, observerElevation, threshold) {
    return groups.filter((g) => Math.abs(g.elevation - observerElevation) <= threshold);
  }
  // -- elevation -------------------------------------------------------------
  static elevationBands(tokens, threshold) {
    const sorted = [...tokens].sort(
      (a, b) => (a.document.elevation ?? 0) - (b.document.elevation ?? 0)
    );
    const bands = [];
    for (const t of sorted) {
      const e = t.document.elevation ?? 0;
      const last = bands[bands.length - 1];
      if (last && Math.abs(e - last.centre) <= Math.max(threshold, 1e-4) && threshold >= 0) {
        last.tokens.push(t);
        last.centre = last.tokens.reduce((s, x) => s + (x.document.elevation ?? 0), 0) / last.tokens.length;
      } else {
        bands.push({ centre: e, tokens: [t] });
      }
    }
    return bands;
  }
  // -- distance --------------------------------------------------------------
  static distanceClusters(tokens, distancePx) {
    if (distancePx <= 0) return tokens.map((t) => [t]);
    const clusters = [];
    for (const t of tokens) {
      const c = t.center;
      let joined = false;
      for (const cluster of clusters) {
        const centroid = this.centroid(cluster);
        if (dist(c.x, c.y, centroid.x, centroid.y) <= distancePx) {
          cluster.push(t);
          joined = true;
          break;
        }
      }
      if (!joined) clusters.push([t]);
    }
    return clusters;
  }
  static centroid(tokens) {
    if (tokens.length === 0) return { x: 0, y: 0 };
    let x = 0;
    let y = 0;
    for (const t of tokens) {
      x += t.center.x;
      y += t.center.y;
    }
    return { x: x / tokens.length, y: y / tokens.length };
  }
};

// src/multiview/LayoutEngine.ts
var LayoutEngine = class {
  /**
   * Compute rectangles for the given viewports. Rectangles are returned in the
   * same order as `views` and reference each viewport by id.
   */
  static compute(views, bounds) {
    const n = views.length;
    if (n === 0) return [];
    const primaryIdx = views.findIndex((v) => v.primary);
    const aspect = aspectClass(bounds.width, bounds.height);
    if (n === 1) return [this.rect(views[0], 0, 0, bounds.width, bounds.height, bounds, true)];
    if (n === 2) return this.twoUp(views, bounds, aspect);
    if (primaryIdx >= 0 && (n === 3 || n >= 5 || n === 4 && views[primaryIdx].pinned)) {
      return this.featured(views, bounds, aspect, primaryIdx);
    }
    if (n === 3) return this.featured(views, bounds, aspect, primaryIdx >= 0 ? primaryIdx : 0);
    return this.grid(views, bounds, aspect, primaryIdx);
  }
  static twoUp(views, bounds, aspect) {
    const vertical = aspect === "portrait";
    if (vertical) {
      const h = bounds.height / 2;
      return [
        this.rect(views[0], 0, 0, bounds.width, h, bounds, views[0].primary),
        this.rect(views[1], 0, h, bounds.width, h, bounds, views[1].primary)
      ];
    }
    const w = bounds.width / 2;
    return [
      this.rect(views[0], 0, 0, w, bounds.height, bounds, views[0].primary),
      this.rect(views[1], w, 0, w, bounds.height, bounds, views[1].primary)
    ];
  }
  /** One dominant tile plus a strip of the rest. */
  static featured(views, bounds, aspect, primaryIdx) {
    const primary = views[primaryIdx];
    const others = views.filter((_, i) => i !== primaryIdx);
    const rects = [];
    const stackVertically = aspect === "portrait";
    const featureRatio = aspect === "ultrawide" ? 0.7 : 0.66;
    if (stackVertically) {
      const ph = bounds.height * featureRatio;
      rects.push(this.rect(primary, 0, 0, bounds.width, ph, bounds, true));
      const sw = bounds.width / others.length;
      others.forEach((v, i) => {
        rects.push(this.rect(v, i * sw, ph, sw, bounds.height - ph, bounds, false));
      });
    } else {
      const pw = bounds.width * featureRatio;
      rects.push(this.rect(primary, 0, 0, pw, bounds.height, bounds, true));
      const sh = bounds.height / others.length;
      const sx = pw;
      const sw = bounds.width - pw;
      others.forEach((v, i) => {
        rects.push(this.rect(v, sx, i * sh, sw, sh, bounds, false));
      });
    }
    return this.reorder(views, rects);
  }
  /** Near-square adaptive grid; the primary (if any) spans a second column. */
  static grid(views, bounds, aspect, primaryIdx) {
    const n = views.length;
    let cols = Math.ceil(Math.sqrt(n));
    if (aspect === "ultrawide") cols = Math.min(n, cols + 1);
    if (aspect === "portrait") cols = Math.max(1, cols - 1);
    const rows = Math.ceil(n / cols);
    const cw = bounds.width / cols;
    const ch = bounds.height / rows;
    const rects = [];
    views.forEach((v, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const isPrimary = i === primaryIdx;
      const span = isPrimary && n >= 5 && c + 1 < cols ? 2 : 1;
      rects.push(this.rect(v, c * cw, r * ch, cw * span, ch, bounds, isPrimary));
    });
    return rects;
  }
  /** Reorder computed rects back into the input order by viewport id. */
  static reorder(views, rects) {
    const byId = new Map(rects.map((r) => [r.viewportId, r]));
    return views.map((v) => byId.get(v.id)).filter((r) => Boolean(r));
  }
  /** Build a single padded rectangle. */
  static rect(v, x, y, w, h, bounds, primary) {
    const p = bounds.padding;
    return {
      viewportId: v.id,
      x: x + p,
      y: y + p,
      width: Math.max(0, w - p * 2),
      height: Math.max(0, h - p * 2),
      primary
    };
  }
};

// src/multiview/RenderScheduler.ts
init_constants();

// src/util/profiler.ts
init_constants();
var Profiler = class {
  samples = /* @__PURE__ */ new Map();
  // Rolling FPS estimate over the last N frame intervals.
  frameTimes = [];
  lastFrame = 0;
  window = 60;
  enabled() {
    try {
      return Boolean(game?.settings?.get(MODULE_ID, SETTINGS.profiling));
    } catch {
      return false;
    }
  }
  /** Call once per rendered frame to feed the FPS estimator. */
  tickFrame(now = performance.now()) {
    if (this.lastFrame > 0) {
      const dt = now - this.lastFrame;
      this.frameTimes.push(dt);
      if (this.frameTimes.length > this.window) this.frameTimes.shift();
    }
    this.lastFrame = now;
  }
  /** Current estimated frames-per-second over the rolling window. */
  get fps() {
    if (this.frameTimes.length === 0) return 0;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    return avg > 0 ? 1e3 / avg : 0;
  }
  /** Average frame interval in ms (the frame budget we are actually hitting). */
  get frameMs() {
    if (this.frameTimes.length === 0) return 0;
    return this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
  }
  /** Wrap a synchronous unit of work and record its timing under `label`. */
  measure(label, fn) {
    if (!this.enabled()) return fn();
    const start = performance.now();
    try {
      return fn();
    } finally {
      this.record(label, performance.now() - start);
    }
  }
  record(label, ms) {
    const s = this.samples.get(label) ?? { count: 0, totalMs: 0, maxMs: 0, lastMs: 0 };
    s.count += 1;
    s.totalMs += ms;
    s.maxMs = Math.max(s.maxMs, ms);
    s.lastMs = ms;
    this.samples.set(label, s);
  }
  /** Snapshot of all recorded timings, for the dashboard / console. */
  report() {
    const out = {};
    for (const [label, s] of this.samples) {
      out[label] = {
        avgMs: s.count ? s.totalMs / s.count : 0,
        maxMs: s.maxMs,
        lastMs: s.lastMs,
        count: s.count
      };
    }
    return out;
  }
  reset() {
    this.samples.clear();
    this.frameTimes.length = 0;
    this.lastFrame = 0;
  }
};
var profiler = new Profiler();

// src/multiview/RenderScheduler.ts
var RenderScheduler = class {
  config;
  frame = 0;
  cursor = 0;
  // round-robin index into secondaries
  lastCaptureAt = 0;
  /** Current per-frame secondary-capture budget (adapts to load). */
  captureBudget;
  constructor(config) {
    this.config = config;
    this.captureBudget = this.baseBudget();
  }
  setConfig(config) {
    this.config = config;
    this.captureBudget = Math.min(this.captureBudget, this.baseBudget());
  }
  /** Static per-frame secondary budget by performance preset. */
  baseBudget() {
    switch (this.config.performanceMode) {
      case "quality" /* Quality */:
        return 4;
      case "performance" /* Performance */:
        return 1;
      case "battery" /* Battery */:
        return 1;
      case "balanced" /* Balanced */:
      default:
        return 2;
    }
  }
  /** Build the plan for this frame. */
  plan(viewports, now) {
    this.frame += 1;
    profiler.tickFrame(now);
    this.adapt();
    const advance = viewports;
    const minInterval = 1e3 / Math.max(1, this.config.frameRateCap);
    const captureThisFrame = now - this.lastCaptureAt >= minInterval;
    if (!captureThisFrame || viewports.length === 0) {
      return { advance, capture: [], captureThisFrame: false };
    }
    this.lastCaptureAt = now;
    const primaries = viewports.filter((v) => v.descriptor.primary && !v.descriptor.collapsed);
    const secondaries = viewports.filter((v) => !v.descriptor.primary && !v.descriptor.collapsed);
    const capture = [];
    capture.push(...primaries);
    const budget = Math.max(0, this.captureBudget);
    if (secondaries.length > 0 && budget > 0) {
      const cadence = Math.max(1, this.config.secondaryCadence);
      let picked = 0;
      for (let i = 0; i < secondaries.length && picked < budget; i++) {
        const idx = (this.cursor + i) % secondaries.length;
        const vp = secondaries[idx];
        if ((this.frame + idx) % cadence === 0) {
          capture.push(vp);
          picked++;
        }
      }
      this.cursor = (this.cursor + Math.max(1, budget)) % secondaries.length;
    }
    return { advance, capture, captureThisFrame: true };
  }
  /** Adapt the secondary budget to sustained frame-time pressure. */
  adapt() {
    const targetMs = 1e3 / Math.max(1, this.config.frameRateCap);
    const measured = profiler.frameMs;
    if (measured <= 0) return;
    if (measured > targetMs * 1.35 && this.captureBudget > 0) {
      this.captureBudget = Math.max(0, this.captureBudget - 1);
    } else if (measured < targetMs * 0.85 && this.captureBudget < this.baseBudget()) {
      this.captureBudget = Math.min(this.baseBudget(), this.captureBudget + 1);
    }
  }
  get diagnostics() {
    return { fps: Math.round(profiler.fps), captureBudget: this.captureBudget, frame: this.frame };
  }
};

// src/multiview/CameraController.ts
init_constants();
var CameraController = class {
  state;
  target;
  config;
  initialized = false;
  constructor(config, initialScale = 1) {
    this.config = config;
    this.state = { x: 0, y: 0, scale: initialScale, rotation: 0 };
    this.target = { x: 0, y: 0, scale: initialScale, rotation: 0 };
  }
  get framing() {
    return this.state;
  }
  setConfig(config) {
    this.config = config;
  }
  /** User zoom for this viewport (persisted by the manager when zoomMemory is on). */
  setZoom(scale) {
    this.target.scale = clamp(scale, 0.05, 5);
    if (!this.config.zoomMemory) this.state.scale = this.target.scale;
  }
  get zoom() {
    return this.target.scale;
  }
  /**
   * Point the camera at a token. Sets the target; `advance()` moves the actual
   * framing toward it according to the camera mode.
   */
  follow(token) {
    const c = token.center;
    this.target.x = c.x;
    this.target.y = c.y;
    if (this.config.followRotation && typeof token.document.rotation === "number") {
      this.target.rotation = token.document.rotation * Math.PI / 180;
    }
    if (!this.initialized) {
      this.state.x = this.target.x;
      this.state.y = this.target.y;
      this.state.rotation = this.target.rotation;
      this.initialized = true;
    }
  }
  /** Advance the framing one frame. `dtMs` is the wall-clock delta. */
  advance(dtMs) {
    switch (this.config.mode) {
      case "snap" /* Snap */:
        this.state.x = this.target.x;
        this.state.y = this.target.y;
        break;
      case "dead-zone" /* DeadZone */:
        this.advanceDeadZone();
        break;
      default: {
        const f = smoothingFactor(this.config.followSpeed, dtMs);
        this.state.x += (this.target.x - this.state.x) * f;
        this.state.y += (this.target.y - this.state.y) * f;
        break;
      }
    }
    const zf = smoothingFactor(0.5, dtMs);
    this.state.scale += (this.target.scale - this.state.scale) * zf;
    this.state.rotation += (this.target.rotation - this.state.rotation) * zf;
  }
  advanceDeadZone() {
    const radius = 150 * this.config.deadZone / this.state.scale;
    const dx = this.target.x - this.state.x;
    const dy = this.target.y - this.state.y;
    const d = Math.hypot(dx, dy);
    if (d > radius) {
      const move = d - radius;
      this.state.x += dx / d * move;
      this.state.y += dy / d * move;
    }
  }
  /** Force the framing to the current target immediately (e.g. teleport). */
  snap() {
    this.state.x = this.target.x;
    this.state.y = this.target.y;
    this.state.scale = this.target.scale;
    this.state.rotation = this.target.rotation;
  }
};

// src/multiview/SceneCapture.ts
var SceneCapture = class {
  texture = null;
  texWidth = 0;
  texHeight = 0;
  renderScale;
  constructor(renderScale = 1) {
    this.renderScale = renderScale;
  }
  get renderTexture() {
    return this.texture;
  }
  setRenderScale(scale) {
    this.renderScale = scale;
  }
  /** Ensure the backing texture matches the requested CSS pixel size. */
  ensureTexture(cssWidth, cssHeight) {
    const w = Math.max(1, Math.round(cssWidth * this.renderScale));
    const h = Math.max(1, Math.round(cssHeight * this.renderScale));
    if (this.texture && this.texWidth === w && this.texHeight === h) return this.texture;
    if (this.texture) {
      try {
        this.texture.resize(w, h);
      } catch {
        this.texture.destroy(true);
        this.texture = null;
      }
    }
    if (!this.texture) {
      this.texture = PIXI.RenderTexture.create({ width: w, height: h, resolution: 1 });
    }
    this.texWidth = w;
    this.texHeight = h;
    return this.texture;
  }
  /**
   * Capture the scene for `token` at `framing` into this viewport's texture.
   *
   * @param vision  Shared vision controller; when `applyVision` is true its POV
   *                is switched to `token` before rendering.
   * @param cssWidth/cssHeight  Viewport size in CSS pixels.
   * @param applyVision  Present the token's true POV (vision/light/fog). When
   *                false the current global vision is used (useful for a GM
   *                streaming full-reveal, and much cheaper).
   */
  capture(token, framing, vision, cssWidth, cssHeight, applyVision) {
    const renderer = canvas?.app?.renderer;
    const stage = canvas?.stage;
    if (!renderer || !stage) return null;
    const tex = this.ensureTexture(cssWidth, cssHeight);
    const saved = this.saveTransform(stage);
    try {
      if (applyVision) {
        profiler.measure("capture.vision", () => vision.setTarget(token, true));
      }
      stage.visible = true;
      const scale = framing.scale * this.renderScale;
      stage.pivot.set(framing.x, framing.y);
      stage.position.set(this.texWidth / 2, this.texHeight / 2);
      stage.scale.set(scale, scale);
      stage.rotation = framing.rotation;
      profiler.measure("capture.render", () => {
        renderer.render(stage, { renderTexture: tex, clear: true });
      });
    } catch (err) {
      log.debug("scene capture failed", err);
      return null;
    } finally {
      this.restoreTransform(stage, saved);
    }
    return tex;
  }
  dispose() {
    if (this.texture) {
      try {
        this.texture.destroy(true);
      } catch {
      }
      this.texture = null;
    }
    this.texWidth = this.texHeight = 0;
  }
  // -- transform save/restore ------------------------------------------------
  saveTransform(stage) {
    return {
      pivotX: stage.pivot.x,
      pivotY: stage.pivot.y,
      posX: stage.position.x,
      posY: stage.position.y,
      scaleX: stage.scale.x,
      scaleY: stage.scale.y,
      rotation: stage.rotation,
      visible: stage.visible
    };
  }
  restoreTransform(stage, t) {
    stage.pivot.set(t.pivotX, t.pivotY);
    stage.position.set(t.posX, t.posY);
    stage.scale.set(t.scaleX, t.scaleY);
    stage.rotation = t.rotation;
    stage.visible = t.visible;
  }
};

// src/multiview/Viewport.ts
var Viewport = class {
  descriptor;
  camera;
  capture;
  sprite = null;
  lastCenter = null;
  lastHeading;
  lastCaptureAt = 0;
  rect = null;
  constructor(descriptor, renderScale) {
    this.descriptor = descriptor;
    this.camera = new CameraController(descriptor.camera, descriptor.rememberedScale ?? 1);
    this.capture = new SceneCapture(renderScale);
  }
  get id() {
    return this.descriptor.id;
  }
  get tokenId() {
    return this.descriptor.tokenId;
  }
  get token() {
    return canvas?.tokens?.get(this.descriptor.tokenId);
  }
  get displaySprite() {
    return this.sprite;
  }
  // -- lifecycle -------------------------------------------------------------
  attach(overlayRoot) {
    if (!this.sprite) this.sprite = new PIXI.Sprite();
    overlayRoot.addChild(this.sprite);
  }
  destroy() {
    this.sprite?.destroy({ children: true });
    this.sprite = null;
    this.capture.dispose();
  }
  setCameraConfig(config) {
    this.camera.setConfig(config);
  }
  setRenderScale(scale) {
    this.capture.setRenderScale(scale);
  }
  setZoom(scale) {
    this.camera.setZoom(scale);
    this.descriptor.rememberedScale = scale;
  }
  get zoom() {
    return this.camera.zoom;
  }
  // -- per-frame -------------------------------------------------------------
  /** Advance the camera toward the token. Cheap; runs every frame. */
  advanceCamera(dtMs) {
    const token = this.token;
    if (!token) return;
    this.camera.follow(token);
    this.camera.advance(dtMs);
    const c = token.center;
    if (this.lastCenter) {
      const h = heading(c.x - this.lastCenter.x, c.y - this.lastCenter.y);
      if (h !== void 0) this.lastHeading = h;
    }
    this.lastCenter = { x: c.x, y: c.y };
  }
  /** Force the camera onto the token instantly (teleport / scene change). */
  snapCamera() {
    const token = this.token;
    if (token) this.camera.follow(token);
    this.camera.snap();
  }
  /**
   * Capture the scene from this viewport's POV and update the display sprite.
   * Returns false if there was nothing to render (token gone / no rect).
   */
  renderFrame(vision, applyVision, now) {
    const token = this.token;
    if (!token || !this.rect || !this.sprite) return false;
    const tex = this.capture.capture(
      token,
      this.camera.framing,
      vision,
      this.rect.width,
      this.rect.height,
      applyVision
    );
    if (!tex) return false;
    this.sprite.texture = tex;
    this.applySpriteBounds();
    this.lastCaptureAt = now;
    return true;
  }
  get lastRenderedAt() {
    return this.lastCaptureAt;
  }
  // -- layout ----------------------------------------------------------------
  applyRect(rect) {
    this.rect = rect;
    this.descriptor.primary = rect.primary;
    this.applySpriteBounds();
  }
  get currentRect() {
    return this.rect;
  }
  applySpriteBounds() {
    if (!this.sprite || !this.rect) return;
    this.sprite.position.set(this.rect.x, this.rect.y);
    this.sprite.width = this.rect.width;
    this.sprite.height = this.rect.height;
    this.sprite.visible = !this.descriptor.collapsed;
  }
  // -- overlay data ----------------------------------------------------------
  /**
   * Resolve overlay data for this viewport. `reference` is an optional world
   * point (usually the primary token / party centroid) for the distance field.
   */
  computeOverlay(reference) {
    const token = this.token;
    const data = { viewportId: this.id, primary: this.descriptor.primary };
    if (!token) return data;
    const actor = token.actor;
    data.characterName = this.descriptor.label ?? actor?.name ?? token.name;
    data.playerName = this.owningPlayerName(token);
    data.hp = this.resolveHp(actor);
    data.conditions = this.resolveConditions(actor);
    data.statusEffects = data.conditions;
    data.elevation = token.document.elevation ?? 0;
    data.scene = canvas?.scene?.name;
    data.direction = this.lastHeading;
    if (reference) {
      const c = token.center;
      const gridSize = canvas?.grid?.size ?? 100;
      const gridDistance = canvas?.scene?.grid?.distance ?? 5;
      const px = dist(c.x, c.y, reference.x, reference.y);
      data.distance = Math.round(px / gridSize * gridDistance);
    }
    return data;
  }
  owningPlayerName(token) {
    const owner = game.users.find(
      (u) => !u.isGM && u.active && token.document.testUserPermission(u, "OWNER")
    );
    return owner?.name;
  }
  /** HP resolver with fallbacks across common systems. */
  resolveHp(actor) {
    if (!actor) return void 0;
    const sys = actor.system ?? {};
    const candidates = [
      sys?.attributes?.hp,
      // dnd5e, sw5e, a5e …
      sys?.health,
      // many systems
      sys?.hp,
      // simple worldbuilding, etc.
      sys?.resources?.health
    ];
    for (const hp of candidates) {
      if (hp && typeof hp.value === "number" && typeof hp.max === "number") {
        return { value: hp.value, max: hp.max, temp: typeof hp.temp === "number" ? hp.temp : void 0 };
      }
    }
    return void 0;
  }
  /** Active conditions/status effects, system-agnostic. */
  resolveConditions(actor) {
    if (!actor) return [];
    const out = /* @__PURE__ */ new Set();
    const statuses = actor.statuses;
    if (statuses && typeof statuses.forEach === "function") {
      statuses.forEach((s) => out.add(s));
    }
    const effects = actor.effects;
    if (effects) {
      for (const e of effects) {
        if (e?.disabled) continue;
        const name = e?.name ?? e?.label;
        if (name) out.add(name);
      }
    }
    return [...out];
  }
};

// src/multiview/MultiViewManager.ts
var MultiViewManager = class _MultiViewManager {
  viewports = [];
  overlayRoot = null;
  vision = new VisionController();
  scheduler;
  opened = false;
  tick = () => this.onTick();
  lastTime = 0;
  lastOverlayEmit = 0;
  soloId = null;
  page = 0;
  frameListener = null;
  constructor() {
    const s = getSettings();
    this.scheduler = new RenderScheduler({
      frameRateCap: s.frameRateCap,
      secondaryCadence: s.secondaryCadence,
      performanceMode: s.performanceMode,
      maxCameras: s.maxCameras
    });
  }
  // -- lifecycle -------------------------------------------------------------
  get isOpen() {
    return this.opened;
  }
  get count() {
    return this.viewports.length;
  }
  setOnFrame(listener) {
    this.frameListener = listener;
  }
  open() {
    if (this.opened) return;
    if (!canvas?.ready || !canvas.app?.stage) {
      log.warn("MultiView cannot open: canvas not ready");
      return;
    }
    this.overlayRoot = new PIXI.Container();
    canvas.app.stage.addChild(this.overlayRoot);
    for (const vp of this.viewports) vp.attach(this.overlayRoot);
    this.applySettings();
    this.lastTime = performance.now();
    canvas.app.ticker.add(this.tick);
    this.opened = true;
    Hooks.callAll(HOOKS.multiViewOpen, { count: this.viewports.length });
    log.info(`MultiView opened with ${this.viewports.length} viewport(s)`);
  }
  close() {
    if (!this.opened) return;
    canvas?.app?.ticker?.remove(this.tick);
    for (const vp of this.viewports) vp.destroy();
    this.overlayRoot?.destroy({ children: true });
    this.overlayRoot = null;
    this.vision.deactivate();
    this.opened = false;
    Hooks.callAll(HOOKS.multiViewClose, {});
    log.info("MultiView closed");
  }
  /** Tear down entirely (called on scene change / disable). */
  dispose() {
    this.close();
    this.viewports = [];
    this.soloId = null;
    this.page = 0;
  }
  // -- viewport management ---------------------------------------------------
  /** Add a viewport for a token if permitted and not already present. */
  addViewport(tokenId, opts) {
    const token = canvas?.tokens?.get(tokenId);
    if (!token) {
      log.warn(`addViewport: token ${tokenId} not found`);
      return null;
    }
    if (!PermissionManager.allowed(game.user, token)) {
      ui.notifications.warn(game.i18n.format("dynamic-spectator.notify.notAllowed", { name: token.name }));
      return null;
    }
    if (this.viewports.some((v) => v.tokenId === tokenId)) {
      return this.viewports.find((v) => v.tokenId === tokenId) ?? null;
    }
    const s = getSettings();
    const descriptor = {
      id: foundry.utils.randomID(12),
      tokenId,
      actorId: token.actor?.id,
      sceneId: canvas.scene?.id ?? "",
      primary: this.viewports.length === 0,
      pinned: false,
      collapsed: false,
      slot: -1,
      camera: { ...s.camera },
      ...opts
    };
    const vp = new Viewport(descriptor, this.effectiveRenderScale());
    this.viewports.push(vp);
    if (this.opened && this.overlayRoot) vp.attach(this.overlayRoot);
    vp.snapCamera();
    this.emitChanged();
    return vp;
  }
  removeViewport(viewportId) {
    const idx = this.viewports.findIndex((v) => v.id === viewportId);
    if (idx < 0) return;
    const [removed] = this.viewports.splice(idx, 1);
    const wasPrimary = removed.descriptor.primary;
    removed.destroy();
    if (this.soloId === viewportId) this.soloId = null;
    if (wasPrimary && this.viewports.length > 0) this.viewports[0].descriptor.primary = true;
    this.clampPage();
    this.emitChanged();
  }
  clear() {
    for (const vp of this.viewports) vp.destroy();
    this.viewports = [];
    this.soloId = null;
    this.page = 0;
    this.emitChanged();
  }
  setPrimary(viewportId) {
    let found = false;
    for (const vp of this.viewports) {
      const isTarget = vp.id === viewportId;
      vp.descriptor.primary = isTarget;
      found ||= isTarget;
    }
    if (found) this.emitChanged();
  }
  togglePin(viewportId) {
    const vp = this.get(viewportId);
    if (!vp) return;
    vp.descriptor.pinned = !vp.descriptor.pinned;
    this.emitChanged();
  }
  toggleCollapse(viewportId) {
    const vp = this.get(viewportId);
    if (!vp) return;
    vp.descriptor.collapsed = !vp.descriptor.collapsed;
    this.emitChanged();
  }
  /** Temporary solo (fullscreen one viewport); pass null to return to grid. */
  solo(viewportId) {
    this.soloId = viewportId && this.get(viewportId) ? viewportId : null;
    this.emitChanged();
  }
  toggleSolo(viewportId) {
    this.solo(this.soloId === viewportId ? null : viewportId);
  }
  /** Swap two viewports' positions in the ordered list (drag-and-drop). */
  swap(aId, bId) {
    const ai = this.viewports.findIndex((v) => v.id === aId);
    const bi = this.viewports.findIndex((v) => v.id === bId);
    if (ai < 0 || bi < 0) return;
    [this.viewports[ai], this.viewports[bi]] = [this.viewports[bi], this.viewports[ai]];
    this.emitChanged();
  }
  /** Reorder to an explicit list of viewport ids (drag-and-drop reflow). */
  reorder(order) {
    const byId = new Map(this.viewports.map((v) => [v.id, v]));
    const next = [];
    for (const id of order) {
      const vp = byId.get(id);
      if (vp) {
        next.push(vp);
        byId.delete(id);
      }
    }
    for (const leftover of byId.values()) next.push(leftover);
    this.viewports = next;
    this.emitChanged();
  }
  setZoom(viewportId, scale) {
    this.get(viewportId)?.setZoom(scale);
  }
  get(viewportId) {
    return this.viewports.find((v) => v.id === viewportId);
  }
  /** A token was deleted / left the scene: drop any viewport tracking it. */
  onTokenDeleted(tokenId) {
    const affected = this.viewports.filter((v) => v.tokenId === tokenId).map((v) => v.id);
    for (const id of affected) this.removeViewport(id);
    if (this.opened && this.viewports.length === 0) this.close();
  }
  /**
   * Re-map viewports to the newly active scene by actor id (cross-scene follow).
   * Viewports whose actor has no token on the new scene are dropped. Returns the
   * number of viewports still alive afterward.
   */
  remapForNewScene() {
    const survivors = [];
    for (const vp of this.viewports) {
      const actorId = vp.descriptor.actorId;
      const replacement = actorId ? (canvas?.tokens?.placeables ?? []).find((t) => t.actor?.id === actorId) : void 0;
      if (replacement) {
        vp.descriptor.tokenId = replacement.id;
        vp.descriptor.sceneId = canvas?.scene?.id ?? "";
        vp.snapCamera();
        survivors.push(vp);
      } else {
        vp.destroy();
      }
    }
    this.viewports = survivors;
    if (this.viewports.length && !this.viewports.some((v) => v.descriptor.primary)) {
      this.viewports[0].descriptor.primary = true;
    }
    this.clampPage();
    this.emitChanged();
    return this.viewports.length;
  }
  // -- pagination ------------------------------------------------------------
  get pageCount() {
    const per = Math.max(1, getSettings().maxCameras);
    return Math.max(1, Math.ceil(this.activeViewports().length / per));
  }
  nextPage() {
    this.page = (this.page + 1) % this.pageCount;
    this.emitChanged();
  }
  prevPage() {
    this.page = (this.page - 1 + this.pageCount) % this.pageCount;
    this.emitChanged();
  }
  clampPage() {
    this.page = Math.min(this.page, this.pageCount - 1);
  }
  // -- auto grouping (GM dashboard "observe" helpers) ------------------------
  /** Replace viewports with one per token in the current party (player-owned). */
  observeParty() {
    const tokens = (canvas?.tokens?.placeables ?? []).filter(
      (t) => t.actor?.hasPlayerOwner && PermissionManager.allowed(game.user, t)
    );
    this.rebuildFrom(tokens);
  }
  /** One viewport per active combatant. */
  observeCombatants() {
    const combat = game.combat;
    const ids = combat?.combatants ? combat.combatants.map((c) => c.token?.id).filter(Boolean) : [];
    const tokens = ids.map((id) => canvas?.tokens?.get(id)).filter((t) => t !== void 0 && PermissionManager.allowed(game.user, t));
    this.rebuildFrom(tokens);
  }
  /** One viewport per non-player token (GM oversight). */
  observeNpcs() {
    const tokens = (canvas?.tokens?.placeables ?? []).filter(
      (t) => !t.actor?.hasPlayerOwner && PermissionManager.allowed(game.user, t)
    );
    this.rebuildFrom(tokens);
  }
  /**
   * Height-aware auto grouping: build viewports only for groups within the
   * elevation threshold of `observerElevation`, one viewport per group leader
   * (the group's first token), grouping the rest behind it.
   */
  observeGroupsAtElevation(observerElevation) {
    const s = getSettings();
    const tokens = PermissionManager.spectatableTokens(game.user);
    const groups = GroupingEngine.group(tokens, {
      elevationThreshold: s.elevationThreshold,
      groupingDistance: s.groupingDistance,
      gridSize: canvas?.grid?.size ?? 100
    });
    const observed = GroupingEngine.observedAtElevation(groups, observerElevation, s.elevationThreshold);
    const leaders = observed.map((g) => g.tokenIds[0]).filter(Boolean);
    this.rebuildFrom(leaders.map((id) => canvas.tokens.get(id)).filter((t) => Boolean(t)));
  }
  /** Auto-group all spectatable tokens and cap at maxCameras group leaders. */
  observeAuto() {
    const s = getSettings();
    const tokens = PermissionManager.spectatableTokens(game.user);
    if (!s.autoGrouping) {
      this.rebuildFrom(tokens.slice(0, s.maxCameras));
      return;
    }
    const groups = GroupingEngine.group(tokens, {
      elevationThreshold: s.elevationThreshold,
      groupingDistance: s.groupingDistance,
      gridSize: canvas?.grid?.size ?? 100
    });
    const leaders = groups.map((g) => g.tokenIds[0]).filter(Boolean).map((id) => canvas.tokens.get(id)).filter((t) => Boolean(t));
    this.rebuildFrom(leaders);
  }
  /** Hard ceiling on total viewports so a huge scene can't spawn runaway cameras. */
  static MAX_TOTAL_VIEWPORTS = 32;
  rebuildFrom(tokens) {
    this.clear();
    for (const t of tokens.slice(0, _MultiViewManager.MAX_TOTAL_VIEWPORTS)) {
      this.addViewport(t.id);
    }
    if (this.viewports[0]) this.viewports[0].descriptor.primary = true;
    this.emitChanged();
  }
  // -- settings / resize -----------------------------------------------------
  applySettings() {
    const s = getSettings();
    this.scheduler.setConfig({
      frameRateCap: s.frameRateCap,
      secondaryCadence: s.secondaryCadence,
      performanceMode: s.performanceMode,
      maxCameras: s.maxCameras
    });
    const scale = this.effectiveRenderScale();
    for (const vp of this.viewports) {
      vp.setCameraConfig(s.camera);
      vp.setRenderScale(scale);
    }
    this.clampPage();
    this.emitChanged();
  }
  onResize() {
    this.emitChanged();
  }
  effectiveRenderScale() {
    const s = getSettings();
    if (s.performanceMode === "performance" /* Performance */) return Math.min(s.renderScale, 0.75);
    if (s.performanceMode === "battery" /* Battery */) return Math.min(s.renderScale, 0.6);
    return s.renderScale;
  }
  // -- the loop --------------------------------------------------------------
  activeViewports() {
    if (this.soloId) {
      const vp = this.get(this.soloId);
      return vp ? [vp] : this.viewports;
    }
    return this.viewports;
  }
  /** Viewports visible on the current page (pagination + solo aware). */
  visibleViewports() {
    const active = this.activeViewports();
    if (this.soloId) return active;
    const per = Math.max(1, getSettings().maxCameras);
    const start = this.page * per;
    return active.slice(start, start + per);
  }
  onTick() {
    if (!this.opened || !this.overlayRoot) return;
    const now = performance.now();
    const dt = Math.min(now - this.lastTime, 100);
    this.lastTime = now;
    const visible = this.visibleViewports();
    for (const vp of this.viewports) {
      const sprite = vp.displaySprite;
      if (sprite) sprite.visible = false;
    }
    const rects = this.computeLayout(visible);
    for (const vp of visible) {
      const rect = rects.find((r) => r.viewportId === vp.id);
      if (rect) vp.applyRect(rect);
    }
    const plan = this.scheduler.plan(visible, now);
    for (const vp of plan.advance) vp.advanceCamera(dt);
    if (plan.capture.length > 0) {
      this.overlayRoot.visible = false;
      for (const vp of plan.capture) vp.renderFrame(this.vision, true, now);
      this.overlayRoot.visible = true;
    }
    this.applyOverlayTransform();
    if (now - this.lastOverlayEmit > 120) {
      this.lastOverlayEmit = now;
      this.emitFrame(rects, visible);
    }
  }
  /**
   * Counter-transform the overlay container so its children live in *screen*
   * pixels regardless of the canvas camera. The canvas maps world→screen as
   *   screen = stage.position + (world - stage.pivot) * stage.scale
   * so setting the overlay's inverse transform makes local == screen.
   */
  applyOverlayTransform() {
    const stage = canvas?.stage;
    const root = this.overlayRoot;
    if (!stage || !root) return;
    const sx = stage.scale.x || 1;
    const sy = stage.scale.y || 1;
    root.scale.set(1 / sx, 1 / sy);
    root.pivot.set(0, 0);
    root.rotation = -stage.rotation;
    root.position.set(stage.pivot.x - stage.position.x / sx, stage.pivot.y - stage.position.y / sy);
  }
  computeLayout(visible) {
    const bounds = {
      width: window.innerWidth,
      height: window.innerHeight,
      padding: getSettings().streamingMode ? 0 : getSettings().viewportPadding
    };
    return LayoutEngine.compute(
      visible.map((v) => v.descriptor),
      bounds
    );
  }
  emitFrame(rects, visible) {
    if (!this.frameListener) return;
    const primary = visible.find((v) => v.descriptor.primary) ?? visible[0];
    const ref = primary?.token?.center;
    const overlays = visible.map((v) => v.computeOverlay(ref));
    this.frameListener({
      rects,
      overlays,
      page: this.page,
      pageCount: this.pageCount,
      diagnostics: this.scheduler.diagnostics
    });
  }
  /** Push a structural change (add/remove/primary/…) to listeners immediately. */
  emitChanged() {
    Hooks.callAll(HOOKS.viewportsChanged, { count: this.viewports.length });
    if (this.opened) {
      const visible = this.visibleViewports();
      this.emitFrame(this.computeLayout(visible), visible);
    }
  }
  /** Snapshot for the UI / API. */
  get descriptors() {
    return this.viewports.map((v) => v.descriptor);
  }
};

// src/spectator/SpectatorManager.ts
init_constants();
init_PermissionManager();

// src/spectator/CameraLock.ts
init_constants();
var CameraLock = class {
  token = null;
  config = null;
  ticker = false;
  tick = () => this.onTick();
  lastTime = 0;
  /** Camera to restore when we release. */
  restore = null;
  /** Target zoom while locked (kept stable unless the user zooms). */
  targetScale = 1;
  get active() {
    return this.token !== null;
  }
  lock(token, config) {
    if (!token) return;
    this.captureRestore();
    this.token = token;
    this.config = config;
    this.targetScale = config.zoomMemory && config.mode ? this.currentScale() : this.currentScale();
    const c = token.center;
    this.applyCamera(c.x, c.y, this.targetScale);
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
  /** Let the user's manual zoom override the locked zoom. */
  setZoom(scale) {
    this.targetScale = clamp(scale, 0.05, 5);
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
        this.applyCamera(target.x, target.y, this.targetScale);
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
        this.applyCamera(x, y, this.targetScale);
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
    if (nx !== cur.x || ny !== cur.y) this.applyCamera(nx, ny, this.targetScale);
  }
  // -- camera helpers --------------------------------------------------------
  applyCamera(x, y, scale) {
    try {
      canvas?.pan?.({ x, y, scale });
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

// src/spectator/SpectatorManager.ts
var SpectatorManager = class {
  vision = new VisionController();
  camera = new CameraLock();
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
    if (retarget) this.camera.retarget(token);
    else this.camera.lock(token, this.cameraConfig());
    this.setIndicator(this.currentTokenId, false);
    this.currentTokenId = token.id;
    this.currentActorId = token.actor?.id ?? null;
    this.setIndicator(token.id, true);
    Hooks.callAll(HOOKS.spectateStart, { tokenId: token.id, exclusive: exclusivePov });
    ui.notifications.info(
      game.i18n.format("dynamic-spectator.notify.spectating", { name: token.name })
    );
    log.info(`Spectating "${token.name}"`);
    return true;
  }
  /** Stop spectating and restore normal vision + camera. */
  stop() {
    if (!this.active) return;
    const prev = this.currentTokenId;
    this.setIndicator(prev, false);
    this.vision.deactivate();
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
  }
  /** The spectated token was removed / left the scene — tear down cleanly. */
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

// src/state.ts
var DS = { ready: false };
function state() {
  if (!DS.spectator || !DS.multiview || !DS.multiviewApp) {
    throw new Error("Dynamic Spectator accessed before initialization");
  }
  return DS;
}

// src/sync/SyncBridge.ts
init_constants();
var POV_FIELDS = ["x", "y", "elevation", "rotation", "hidden", "sight", "vision", "light"];
function registerSyncHooks() {
  Hooks.on("updateToken", (doc, changes) => {
    const touched = POV_FIELDS.some((f) => f in changes);
    if (!touched) return;
    const s = state();
    s.spectator.onTokenUpdate(doc.id);
  });
  Hooks.on("refreshToken", (token) => {
    const s = state();
    if (s.spectator.tokenId === token.id) s.spectator.onTokenUpdate(token.id);
  });
  Hooks.on("deleteToken", (doc) => {
    const s = state();
    s.spectator.onTokenGone(doc.id);
    s.multiview.onTokenDeleted(doc.id);
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
  window.addEventListener("resize", onWindowResize);
  log.debug("sync hooks registered");
}
var resizeRaf = 0;
function onWindowResize() {
  if (resizeRaf) cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    try {
      const s = state();
      if (s.multiview.isOpen) s.multiview.onResize();
    } catch {
    }
  });
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
  if (s.multiview.count > 0) {
    if (behaviour === "drop" /* Drop */) {
      s.multiview.dispose();
    } else if (behaviour === "follow" /* Follow */) {
      const alive = s.multiview.remapForNewScene();
      if (alive === 0) s.multiview.dispose();
    } else {
      promptCrossScene(
        () => {
          const alive = s.multiview.remapForNewScene();
          if (alive === 0) s.multiview.dispose();
        },
        () => s.multiview.dispose()
      );
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
    position: { width: 460, height: "auto" },
    actions: {
      observeParty: _GMDashboard.act((s) => s.multiview_observeParty()),
      observeCombatants: _GMDashboard.act((s) => s.multiview_observeCombatants()),
      observeNpcs: _GMDashboard.act((s) => s.multiview_observeNpcs()),
      observeElevation: _GMDashboard.onObserveElevation,
      openMultiView: _GMDashboard.onOpenMultiView,
      closeMultiView: _GMDashboard.onCloseMultiView,
      spectatePlayer: _GMDashboard.onSpectatePlayer,
      setPermission: _GMDashboard.onSetPermission
    }
  };
  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/gm-dashboard.hbs` }
  };
  /** Small helper: wrap a state mutation action + re-render + ensure overlay. */
  static act(fn) {
    return function() {
      fn(_GMDashboard.helpers());
      _GMDashboard.ensureOverlay();
      this.render();
    };
  }
  static helpers() {
    const s = state();
    return {
      multiview_observeParty: () => s.multiview.observeParty(),
      multiview_observeCombatants: () => s.multiview.observeCombatants(),
      multiview_observeNpcs: () => s.multiview.observeNpcs()
    };
  }
  static ensureOverlay() {
    const s = state();
    if (!s.multiviewApp.isActive) s.multiviewApp.activate();
  }
  async _prepareContext() {
    const s = state();
    const overrides = game.settings.get(MODULE_ID, "perPlayerPermissions") ?? {};
    const players = game.users.filter((u) => !u.isGM).map((u) => ({
      id: u.id,
      name: u.name,
      active: u.active,
      color: typeof u.color === "string" ? u.color : u.color?.css ?? "#888",
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
      diagnostics: s.multiview.scheduler?.diagnostics ?? null
    };
  }
  playerToken(user) {
    const charId = user.character?.id;
    return (canvas?.tokens?.placeables ?? []).find(
      (t) => t.actor?.id && (t.actor.id === charId || t.document.testUserPermission(user, "OWNER"))
    );
  }
  // -- actions ---------------------------------------------------------------
  static onOpenMultiView() {
    _GMDashboard.ensureOverlay();
    this.render();
  }
  static onCloseMultiView() {
    state().multiviewApp.deactivate();
    this.render();
  }
  static onObserveElevation() {
    const controlled = canvas?.tokens?.controlled?.[0];
    const elevation = controlled?.document.elevation ?? 0;
    state().multiview.observeGroupsAtElevation(elevation);
    _GMDashboard.ensureOverlay();
    ui.notifications.info(
      game.i18n.format("dynamic-spectator.notify.observeElevation", { elevation })
    );
    this.render();
  }
  static onSpectatePlayer(_event, target) {
    const userId = target.closest("[data-user-id]")?.dataset.userId;
    if (!userId) return;
    const user = game.users.get(userId);
    if (!user) return;
    const token = this.playerToken(user);
    if (token) state().spectator.start(token.id);
    else ui.notifications.warn(game.i18n.localize("dynamic-spectator.notify.noPlayerToken"));
  }
  static async onSetPermission(event, target) {
    const userId = target.closest("[data-user-id]")?.dataset.userId;
    if (!userId) return;
    const value = event.target.value;
    const mode = value === "default" ? null : value;
    await PermissionManager.setPlayerOverride(userId, mode);
    this.render();
  }
  static show() {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("dynamic-spectator.notify.gmOnly"));
      return;
    }
    const existing = Object.values(ui.windows ?? {}).find(
      (w) => w?.id === `${MODULE_ID}-dashboard`
    );
    if (existing) {
      existing.bringToFront?.();
      return;
    }
    new _GMDashboard().render(true);
  }
};

// src/ui/SpectatorPicker.ts
init_constants();
init_PermissionManager();
var { ApplicationV2: ApplicationV22, HandlebarsApplicationMixin: HandlebarsApplicationMixin2 } = foundry.applications.api;
var SpectatorPicker = class _SpectatorPicker extends HandlebarsApplicationMixin2(ApplicationV22) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-picker`,
    tag: "div",
    classes: [`${MODULE_ID}-app`, `${MODULE_ID}-picker`],
    window: {
      title: "dynamic-spectator.picker.title",
      icon: "fa-solid fa-eye",
      resizable: true
    },
    position: { width: 380, height: 560 },
    actions: {
      spectate: _SpectatorPicker.onSpectate,
      addView: _SpectatorPicker.onAddView,
      stop: _SpectatorPicker.onStop,
      optOut: _SpectatorPicker.onOptOut
    }
  };
  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/spectator-picker.hbs` }
  };
  /** Current search query (kept across re-renders). */
  query = "";
  async _prepareContext() {
    const s = state();
    const user = game.user;
    const placeables = canvas?.tokens?.placeables ?? [];
    const mvTokenIds = new Set(s.multiview.descriptors.map((d) => d.tokenId));
    const rows = placeables.map((t) => {
      const decision = PermissionManager.canSpectate(user, t);
      return {
        tokenId: t.id,
        name: t.name,
        img: t.document.texture?.src ?? t.actor?.img ?? "icons/svg/mystery-man.svg",
        elevation: t.document.elevation ?? 0,
        disposition: t.document.disposition ?? 0,
        dispositionLabel: this.dispositionLabel(t.document.disposition ?? 0),
        current: s.spectator.tokenId === t.id,
        inMultiView: mvTokenIds.has(t.id),
        reason: decision.reason,
        allowed: decision.allowed
      };
    }).filter((r) => r.allowed).sort((a, b) => a.name.localeCompare(b.name));
    return {
      rows,
      hasRows: rows.length > 0,
      spectating: s.spectator.active,
      isGM: user.isGM,
      query: this.query
    };
  }
  _onRender(_context, _options) {
    const root = this.element;
    const search = root.querySelector("[data-ds-search]");
    if (search) {
      search.value = this.query;
      search.addEventListener("input", () => {
        this.query = search.value.toLowerCase();
        this.filterRows(root);
      });
      this.filterRows(root);
    }
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
  static onSpectate(_event, target) {
    const id = _SpectatorPicker.tokenIdFrom(target);
    if (!id) return;
    state().spectator.start(id);
    this.render();
  }
  static onAddView(_event, target) {
    const id = _SpectatorPicker.tokenIdFrom(target);
    if (!id) return;
    const s = state();
    s.multiview.addViewport(id);
    if (!s.multiview.isOpen) s.multiview.open();
    this.render();
  }
  static onStop() {
    state().spectator.stop();
    this.render();
  }
  static async onOptOut(_event, target) {
    const id = _SpectatorPicker.tokenIdFrom(target);
    const token = id ? canvas?.tokens?.get(id) : null;
    if (!token) return;
    const current = Boolean(token.document.getFlag(MODULE_ID, "noSpectate"));
    await PermissionManager.setOptOut(token, !current);
    this.render();
    log.debug(`opt-out ${!current} for ${token.name}`);
  }
  /** Singleton open helper. */
  static show() {
    const existing = Object.values(ui.windows ?? {}).find(
      (w) => w?.id === `${MODULE_ID}-picker`
    );
    if (existing) {
      existing.bringToFront?.();
      return;
    }
    new _SpectatorPicker().render(true);
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
  kb.register(MODULE_ID, "toggleMultiView", {
    name: "dynamic-spectator.keys.toggleMultiView.name",
    hint: "dynamic-spectator.keys.toggleMultiView.hint",
    editable: [{ key: "KeyM", modifiers: ["Shift"] }],
    onDown: () => {
      state().multiviewApp.toggle();
      return true;
    }
  });
  kb.register(MODULE_ID, "stopSpectate", {
    name: "dynamic-spectator.keys.stopSpectate.name",
    hint: "dynamic-spectator.keys.stopSpectate.hint",
    editable: [{ key: "Escape", modifiers: [] }],
    onDown: () => {
      const s = state();
      if (s.spectator.active) {
        s.spectator.stop();
        return true;
      }
      return false;
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
        },
        {
          name: "ds-multiview",
          title: game.i18n.localize("dynamic-spectator.controls.multiview"),
          icon: "fa-solid fa-table-cells-large",
          button: true,
          visible: true,
          order: 91,
          onClick: () => state().multiviewApp.toggle(),
          onChange: () => state().multiviewApp.toggle()
        }
      ];
      if (game.user.isGM) {
        tools.push({
          name: "ds-dashboard",
          title: game.i18n.localize("dynamic-spectator.controls.dashboard"),
          icon: "fa-solid fa-video",
          button: true,
          visible: true,
          order: 92,
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
      const on = Boolean(token[`${FLAG_SCOPE}-spectating`]);
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
    const w = token.w ?? 100;
    const h = token.h ?? 100;
    const r = Math.max(w, h) / 2 + 6;
    g.clear();
    if (typeof g.circle === "function" && typeof g.stroke === "function") {
      g.circle(w / 2, h / 2, r).stroke({ width: 3, color: 9090303, alpha: 0.9 });
    } else {
      g.lineStyle(3, 9090303, 0.9);
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
}

// src/ui/MultiViewApp.ts
init_constants();
var MultiViewApp = class {
  root = null;
  grid = null;
  diag = null;
  pageLabel = null;
  cells = /* @__PURE__ */ new Map();
  active = false;
  get isActive() {
    return this.active;
  }
  // -- lifecycle -------------------------------------------------------------
  activate() {
    if (this.active) return;
    this.build();
    const mv = state().multiview;
    mv.setOnFrame((e) => this.onFrame(e));
    mv.open();
    this.applyStreamingClass();
    this.active = true;
    document.addEventListener("keydown", this.onKeyDown, true);
    log.debug("MultiViewApp activated");
  }
  deactivate() {
    if (!this.active) return;
    const mv = state().multiview;
    mv.setOnFrame(null);
    mv.close();
    document.removeEventListener("keydown", this.onKeyDown, true);
    this.root?.remove();
    this.root = this.grid = this.diag = this.pageLabel = null;
    this.cells.clear();
    this.active = false;
    log.debug("MultiViewApp deactivated");
  }
  toggle() {
    if (this.active) this.deactivate();
    else this.activate();
  }
  // -- DOM construction ------------------------------------------------------
  build() {
    const root = document.createElement("div");
    root.id = DOM.multiViewRoot;
    root.className = DOM.multiViewRoot;
    const grid = document.createElement("div");
    grid.className = `${MODULE_ID}-grid`;
    root.appendChild(grid);
    root.appendChild(this.buildControlBar());
    (document.getElementById("interface") ?? document.body).appendChild(root);
    this.root = root;
    this.grid = grid;
  }
  buildControlBar() {
    const bar = document.createElement("div");
    bar.className = `${MODULE_ID}-controlbar`;
    const isGM = game.user.isGM;
    const btn = (action, icon, labelKey, gmOnly = false) => {
      if (gmOnly && !isGM) return "";
      return `<button type="button" data-mv="${action}" title="${game.i18n.localize(labelKey)}">
        <i class="fa-solid ${icon}"></i><span>${game.i18n.localize(labelKey)}</span></button>`;
    };
    bar.innerHTML = `
      <div class="${MODULE_ID}-cb-group">
        ${btn("add", "fa-plus", "dynamic-spectator.mv.add")}
        ${btn("auto", "fa-wand-magic-sparkles", "dynamic-spectator.mv.auto")}
        ${btn("party", "fa-users", "dynamic-spectator.mv.party")}
        ${btn("combatants", "fa-swords", "dynamic-spectator.mv.combatants", true)}
        ${btn("npcs", "fa-ghost", "dynamic-spectator.mv.npcs", true)}
      </div>
      <div class="${MODULE_ID}-cb-group">
        <button type="button" data-mv="prevPage" title="${game.i18n.localize("dynamic-spectator.mv.prevPage")}"><i class="fa-solid fa-chevron-left"></i></button>
        <span class="${MODULE_ID}-page" data-mv-page>1 / 1</span>
        <button type="button" data-mv="nextPage" title="${game.i18n.localize("dynamic-spectator.mv.nextPage")}"><i class="fa-solid fa-chevron-right"></i></button>
      </div>
      <div class="${MODULE_ID}-cb-group">
        ${btn("streaming", "fa-clapperboard", "dynamic-spectator.mv.streaming")}
        <span class="${MODULE_ID}-diag" data-mv-diag></span>
        ${btn("close", "fa-xmark", "dynamic-spectator.mv.close")}
      </div>`;
    bar.addEventListener("click", (ev) => this.onControlClick(ev));
    this.diag = bar.querySelector("[data-mv-diag]");
    this.pageLabel = bar.querySelector("[data-mv-page]");
    return bar;
  }
  // -- per-frame reconcile ---------------------------------------------------
  onFrame(e) {
    if (!this.grid) return;
    const seen = /* @__PURE__ */ new Set();
    const fields = getSettings().overlayFields;
    for (const rect of e.rects) {
      const overlay = e.overlays.find((o) => o.viewportId === rect.viewportId);
      const refs = this.ensureCell(rect.viewportId);
      seen.add(rect.viewportId);
      this.positionCell(refs.cell, rect);
      if (overlay) this.updateOverlay(refs, overlay, fields);
    }
    for (const [id, refs] of this.cells) {
      if (!seen.has(id)) {
        refs.cell.remove();
        this.cells.delete(id);
      }
    }
    if (this.pageLabel) this.pageLabel.textContent = `${e.page + 1} / ${e.pageCount}`;
    if (this.diag) {
      this.diag.textContent = getSettings().profiling ? `${e.diagnostics.fps} fps \xB7 budget ${e.diagnostics.captureBudget}` : "";
    }
  }
  positionCell(cell, rect) {
    cell.style.left = `${rect.x}px`;
    cell.style.top = `${rect.y}px`;
    cell.style.width = `${rect.width}px`;
    cell.style.height = `${rect.height}px`;
    cell.classList.toggle("primary", rect.primary);
  }
  updateOverlay(refs, o, fields) {
    const set = (el, on, text) => {
      el.style.display = on ? "" : "none";
      if (on) el.textContent = text;
    };
    set(refs.name, fields.characterName && !!o.characterName, o.characterName ?? "");
    set(refs.player, fields.playerName && !!o.playerName, o.playerName ?? "");
    const hpOn = fields.hp && !!o.hp;
    refs.hpWrap.style.display = hpOn ? "" : "none";
    if (hpOn && o.hp) {
      const pct = o.hp.max > 0 ? Math.max(0, Math.min(1, o.hp.value / o.hp.max)) : 0;
      refs.hpBar.style.width = `${pct * 100}%`;
      refs.hpBar.style.background = pct > 0.5 ? "#4caf50" : pct > 0.25 ? "#ffb300" : "#e53935";
      refs.hpText.textContent = `${o.hp.value}/${o.hp.max}${o.hp.temp ? ` (+${o.hp.temp})` : ""}`;
    }
    set(refs.elev, fields.elevation && o.elevation !== void 0, `\u26F0 ${o.elevation}`);
    set(refs.dist, fields.distance && o.distance !== void 0, `\u2194 ${o.distance}`);
    set(refs.scene, fields.scene && !!o.scene, o.scene ?? "");
    const dirOn = fields.direction && o.direction !== void 0;
    refs.direction.style.display = dirOn ? "" : "none";
    if (dirOn && o.direction !== void 0) {
      refs.direction.style.transform = `rotate(${o.direction}deg)`;
    }
    const condOn = (fields.conditions || fields.statusEffects) && (o.conditions?.length ?? 0) > 0;
    refs.conditions.style.display = condOn ? "" : "none";
    if (condOn) {
      refs.conditions.textContent = (o.conditions ?? []).slice(0, 6).join(" \xB7 ");
    }
  }
  ensureCell(viewportId) {
    const existing = this.cells.get(viewportId);
    if (existing) return existing;
    const cell = document.createElement("div");
    cell.className = DOM.viewportClass;
    cell.dataset.viewportId = viewportId;
    cell.draggable = true;
    cell.innerHTML = `
      <div class="${MODULE_ID}-vp-frame"></div>
      <div class="${DOM.overlayClass} top">
        <span class="${MODULE_ID}-name"></span>
        <span class="${MODULE_ID}-player"></span>
      </div>
      <div class="${MODULE_ID}-direction"><i class="fa-solid fa-location-arrow"></i></div>
      <div class="${DOM.overlayClass} bottom">
        <div class="${MODULE_ID}-hp"><div class="${MODULE_ID}-hp-bar"></div><span class="${MODULE_ID}-hp-text"></span></div>
        <div class="${MODULE_ID}-meta">
          <span class="${MODULE_ID}-elev"></span>
          <span class="${MODULE_ID}-dist"></span>
          <span class="${MODULE_ID}-scene"></span>
        </div>
        <div class="${MODULE_ID}-conditions"></div>
      </div>
      <div class="${MODULE_ID}-vp-toolbar">
        <button data-vp="primary" title="${game.i18n.localize("dynamic-spectator.vp.primary")}"><i class="fa-solid fa-star"></i></button>
        <button data-vp="pin" title="${game.i18n.localize("dynamic-spectator.vp.pin")}"><i class="fa-solid fa-thumbtack"></i></button>
        <button data-vp="solo" title="${game.i18n.localize("dynamic-spectator.vp.solo")}"><i class="fa-solid fa-expand"></i></button>
        <button data-vp="zoomIn" title="${game.i18n.localize("dynamic-spectator.vp.zoomIn")}"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
        <button data-vp="zoomOut" title="${game.i18n.localize("dynamic-spectator.vp.zoomOut")}"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
        <button data-vp="collapse" title="${game.i18n.localize("dynamic-spectator.vp.collapse")}"><i class="fa-solid fa-window-minimize"></i></button>
        <button data-vp="close" title="${game.i18n.localize("dynamic-spectator.vp.close")}"><i class="fa-solid fa-xmark"></i></button>
      </div>`;
    cell.addEventListener("click", (ev) => this.onCellClick(viewportId, ev));
    cell.addEventListener("dblclick", () => state().multiview.toggleSolo(viewportId));
    this.wireDragDrop(cell, viewportId);
    this.grid.appendChild(cell);
    const q = (sel) => cell.querySelector(sel);
    const refs = {
      cell,
      name: q(`.${MODULE_ID}-name`),
      player: q(`.${MODULE_ID}-player`),
      hpWrap: q(`.${MODULE_ID}-hp`),
      hpBar: q(`.${MODULE_ID}-hp-bar`),
      hpText: q(`.${MODULE_ID}-hp-text`),
      elev: q(`.${MODULE_ID}-elev`),
      dist: q(`.${MODULE_ID}-dist`),
      scene: q(`.${MODULE_ID}-scene`),
      direction: q(`.${MODULE_ID}-direction`),
      conditions: q(`.${MODULE_ID}-conditions`)
    };
    this.cells.set(viewportId, refs);
    return refs;
  }
  // -- interaction -----------------------------------------------------------
  onCellClick(viewportId, ev) {
    const btn = ev.target.closest("[data-vp]");
    if (!btn) return;
    ev.stopPropagation();
    const mv = state().multiview;
    switch (btn.dataset.vp) {
      case "primary":
        mv.setPrimary(viewportId);
        break;
      case "pin":
        mv.togglePin(viewportId);
        break;
      case "solo":
        mv.toggleSolo(viewportId);
        break;
      case "collapse":
        mv.toggleCollapse(viewportId);
        break;
      case "close":
        mv.removeViewport(viewportId);
        break;
      case "zoomIn":
      case "zoomOut": {
        const desc = mv.descriptors.find((d) => d.id === viewportId);
        const cur = desc?.rememberedScale ?? 1;
        mv.setZoom(viewportId, btn.dataset.vp === "zoomIn" ? cur * 1.2 : cur / 1.2);
        break;
      }
    }
  }
  onControlClick(ev) {
    const btn = ev.target.closest("[data-mv]");
    if (!btn) return;
    const mv = state().multiview;
    switch (btn.dataset.mv) {
      case "add":
        SpectatorPicker.show();
        break;
      case "auto":
        mv.observeAuto();
        break;
      case "party":
        mv.observeParty();
        break;
      case "combatants":
        mv.observeCombatants();
        break;
      case "npcs":
        mv.observeNpcs();
        break;
      case "prevPage":
        mv.prevPage();
        break;
      case "nextPage":
        mv.nextPage();
        break;
      case "streaming":
        void this.toggleStreaming();
        break;
      case "close":
        this.deactivate();
        break;
    }
  }
  wireDragDrop(cell, viewportId) {
    cell.addEventListener("dragstart", (ev) => {
      ev.dataTransfer?.setData("text/ds-viewport", viewportId);
      cell.classList.add("dragging");
    });
    cell.addEventListener("dragend", () => cell.classList.remove("dragging"));
    cell.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      cell.classList.add("drop-target");
    });
    cell.addEventListener("dragleave", () => cell.classList.remove("drop-target"));
    cell.addEventListener("drop", (ev) => {
      ev.preventDefault();
      cell.classList.remove("drop-target");
      const from = ev.dataTransfer?.getData("text/ds-viewport");
      if (from && from !== viewportId) state().multiview.swap(from, viewportId);
    });
  }
  onKeyDown = (ev) => {
    if (ev.key === "Escape" && this.active) {
      ev.preventDefault();
      ev.stopPropagation();
      this.deactivate();
    }
  };
  async toggleStreaming() {
    const cur = Boolean(game.settings.get(MODULE_ID, SETTINGS.streamingMode));
    await game.settings.set(MODULE_ID, SETTINGS.streamingMode, !cur);
    this.applyStreamingClass();
    state().multiview.applySettings();
  }
  applyStreamingClass() {
    const on = Boolean(game.settings.get(MODULE_ID, SETTINGS.streamingMode));
    this.root?.classList.toggle("streaming", on);
  }
};

// src/module.ts
var TEMPLATES = [
  `modules/${MODULE_ID}/templates/spectator-picker.hbs`,
  `modules/${MODULE_ID}/templates/gm-dashboard.hbs`
];
function buildApi() {
  return {
    version: "1.0.1",
    /** Spectate a token by id. */
    spectate: (tokenId, exclusive = true) => DS.spectator?.start(tokenId, exclusive),
    stopSpectate: () => DS.spectator?.stop(),
    toggleSpectate: (tokenId) => DS.spectator?.toggle(tokenId),
    /** Open UIs. */
    openPicker: () => SpectatorPicker.show(),
    openDashboard: () => GMDashboard.show(),
    openMultiView: () => DS.multiviewApp?.activate(),
    closeMultiView: () => DS.multiviewApp?.deactivate(),
    toggleMultiView: () => DS.multiviewApp?.toggle(),
    /** Add / remove MultiView cameras programmatically. */
    addView: (tokenId) => {
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
function bootPhase(phase, fn) {
  try {
    fn();
  } catch (err) {
    log.error(`boot phase "${phase}" failed (isGM=${game?.user?.isGM})`, err);
  }
}
Hooks.once("init", () => {
  log.info(`Initializing ${MODULE_TITLE} v1.0.1 (user "${game?.user?.name}", GM=${game?.user?.isGM})`);
  bootPhase(
    "settings",
    () => registerSettings(() => {
      try {
        if (DS.multiview?.isOpen) DS.multiview.applySettings();
      } catch {
      }
    })
  );
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
    DS.multiview = new MultiViewManager();
    DS.multiviewApp = new MultiViewApp();
    const api = buildApi();
    const mod = game.modules.get(MODULE_ID);
    if (mod) mod.api = api;
    globalThis.DynamicSpectator = api;
    log.debug("managers constructed; API published");
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
    if (DS.multiviewApp?.isActive) DS.multiviewApp.deactivate();
    DS.spectator?.stop();
  } catch (err) {
    log.debug("teardown cleanup skipped", err);
  }
});
//# sourceMappingURL=dynamic-spectator.js.map
