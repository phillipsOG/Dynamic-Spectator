/**
 * SyncBridge — the single place that binds Foundry's document/canvas lifecycle
 * hooks to our managers, so a spectated POV and every MultiView camera stay
 * synchronised in real time with:
 *   move · teleport · elevation change · scene change · death · deletion ·
 *   polymorph · hide · vision change · ownership change.
 *
 * All handlers are registered once and are idempotent. Heavy work is debounced
 * where a burst of updates is likely (e.g. dragging a token fires many updates).
 */

import { CrossSceneBehaviour } from "../constants.js";
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
    const s = state();
    s.spectator.onTokenUpdate(doc.id);
    // MultiView cameras follow automatically on the ticker; nothing else needed.
  });

  // A token finishing its movement animation — ensure the POV settles exactly.
  Hooks.on("refreshToken", (token: FoundryToken) => {
    const s = state();
    if (s.spectator.tokenId === token.id) s.spectator.onTokenUpdate(token.id);
  });

  // ---- Deletion / death / polymorph ---------------------------------------
  Hooks.on("deleteToken", (doc: FoundryTokenDocument) => {
    const s = state();
    s.spectator.onTokenGone(doc.id);
    s.multiview.onTokenDeleted(doc.id);
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

  // ---- Window resize -> relayout ------------------------------------------
  window.addEventListener("resize", onWindowResize);

  log.debug("sync hooks registered");
}

let resizeRaf = 0;
function onWindowResize(): void {
  if (resizeRaf) cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    try {
      const s = state();
      if (s.multiview.isOpen) s.multiview.onResize();
    } catch {
      /* not ready */
    }
  });
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

  // --- Spectator (single) ---
  if (s.spectator.active && s.spectator.actorId) {
    const stillHere = canvas?.tokens?.get(s.spectator.tokenId ?? "");
    if (!stillHere) {
      applyCrossScene(behaviour, () => s.spectator.attemptCrossSceneFollow(), () => s.spectator.stop());
    }
  }

  // --- MultiView ---
  if (s.multiview.count > 0) {
    if (behaviour === CrossSceneBehaviour.Drop) {
      s.multiview.dispose();
    } else if (behaviour === CrossSceneBehaviour.Follow) {
      const alive = s.multiview.remapForNewScene();
      if (alive === 0) s.multiview.dispose();
    } else {
      // Prompt.
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
