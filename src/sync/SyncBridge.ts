/**
 * SyncBridge - the single place that binds Foundry's document/canvas lifecycle
 * hooks to the SpectatorManager, so a spectated POV stays synchronised in real
 * time with:
 *   move · teleport · elevation change · scene change · death · deletion ·
 *   polymorph · hide · vision change · ownership change.
 *
 * All handlers are registered once and are idempotent.
 */

import { CrossSceneBehaviour } from "../constants.js";
import { PermissionManager } from "../permissions/PermissionManager.js";
import { getSettings } from "../settings.js";
import { state } from "../state.js";
import { log } from "../util/logger.js";

/** Fields whose change should refresh a spectated POV / camera. */
const POV_FIELDS = ["x", "y", "elevation", "rotation", "hidden", "sight", "vision", "light"];

export function registerSyncHooks(): void {
  // ---- Token movement / vision / elevation / hide -------------------------
  Hooks.on("updateToken", (doc: FoundryTokenDocument, changes: Record<string, unknown>) => {
    const touched = POV_FIELDS.some((f) => f in changes);
    if (!touched) return;
    state().spectator.onTokenUpdate(doc.id);
  });

  // A token finishing its movement animation - ensure the POV settles exactly.
  Hooks.on("refreshToken", (token: FoundryToken) => {
    const s = state();
    if (s.spectator.tokenId === token.id) s.spectator.onTokenUpdate(token.id);
  });

  // ---- Deletion / death / polymorph ---------------------------------------
  Hooks.on("deleteToken", (doc: FoundryTokenDocument) => {
    state().spectator.onTokenGone(doc.id);
  });

  // Ownership changes can revoke a spectator's permission mid-session.
  Hooks.on("updateToken", (doc: FoundryTokenDocument, changes: Record<string, unknown>) => {
    if (!("ownership" in changes) && !("actorId" in changes)) return;
    revalidatePermissions(doc.id);
  });

  // Actor-level changes (HP → death, polymorph, effects) refresh overlays/POV.
  Hooks.on("updateActor", (actor: FoundryActor) => {
    const s = state();
    // If the spectated/tracked token's actor hit 0 HP we keep spectating (the
    // player may want to watch the aftermath); overlays update automatically.
    const token = (canvas?.tokens?.placeables ?? []).find((t) => t.actor?.id === actor.id);
    if (token && s.spectator.tokenId === token.id) s.spectator.onTokenUpdate(token.id);
  });

  // ---- Scene change (cross-scene follow) ----------------------------------
  Hooks.on("canvasReady", () => {
    handleSceneChange();
  });

  // ---- Combat: auto-spectate whoever's turn it is --------------------------
  // `combatStart` covers round 1/turn 0, which does not otherwise fire
  // `combatTurn`; every advance after that does.
  Hooks.on("combatTurn", (combat: FoundryCombat) => autoSpectateCombatant(combat));
  Hooks.on("combatStart", (combat: FoundryCombat) => autoSpectateCombatant(combat));

  log.debug("sync hooks registered");
}

/**
 * If enabled, retarget this client's spectated POV to whoever's turn it
 * currently is - GM included, same as any player, since the setting is now a
 * per-client preference rather than a player-only feature. Anything that is
 * not a valid target for this user right now (off the viewed scene, opted
 * out, permission mode disallows it, etc.) is skipped silently rather than
 * warned about, since this fires on every turn and a manual spectate attempt
 * already surfaces that warning.
 */
function autoSpectateCombatant(combat: FoundryCombat): void {
  if (!getSettings().autoSpectateCombatTurn) return;

  let s: ReturnType<typeof state>;
  try {
    s = state();
  } catch {
    return;
  }

  const tokenId = combat?.combatant?.tokenId;
  if (!tokenId || s.spectator.tokenId === tokenId) return;

  const token = canvas?.tokens?.get(tokenId);
  if (!token || !PermissionManager.allowed(game.user, token)) return;

  s.spectator.start(tokenId);
}

function revalidatePermissions(tokenId: string): void {
  // Deferred import-free check: if the spectator can no longer see this token,
  // stop spectating it. (PermissionManager is consulted inside start(); here we
  // just re-trigger by stopping if it became invalid.)
  const s = state();
  if (s.spectator.tokenId !== tokenId) return;
  const token = canvas?.tokens?.get(tokenId);
  if (!token) return;
  // Re-run start() which performs the permission check; if denied it no-ops the
  // change and we stop to avoid showing a now-forbidden POV.
  import("../permissions/PermissionManager.js").then(({ PermissionManager }) => {
    if (!PermissionManager.allowed(game.user, token)) {
      log.info("permission revoked for spectated token; stopping");
      s.spectator.stop();
    }
  });
}

function handleSceneChange(): void {
  let s: ReturnType<typeof state>;
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

function applyCrossScene(behaviour: string, follow: () => boolean, drop: () => void): void {
  if (behaviour === CrossSceneBehaviour.Follow) {
    if (!follow()) drop();
  } else if (behaviour === CrossSceneBehaviour.Drop) {
    drop();
  } else {
    promptCrossScene(() => {
      if (!follow()) drop();
    }, drop);
  }
}

/** Minimal confirm dialog using DialogV2 with a graceful fallback. */
function promptCrossScene(onFollow: () => void, onDrop: () => void): void {
  const title = game.i18n.localize("dynamic-spectator.crossScene.title");
  const content = `<p>${game.i18n.localize("dynamic-spectator.crossScene.body")}</p>`;
  const DialogV2 = foundry?.applications?.api?.DialogV2;
  if (DialogV2?.confirm) {
    DialogV2.confirm({
      window: { title },
      content,
      yes: { label: game.i18n.localize("dynamic-spectator.crossScene.follow") },
      no: { label: game.i18n.localize("dynamic-spectator.crossScene.drop") }
    })
      .then((ok: boolean) => (ok ? onFollow() : onDrop()))
      .catch(onDrop);
  } else {
    // Fallback: follow by default.
    onFollow();
  }
}
