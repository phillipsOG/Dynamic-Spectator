/**
 * Resolves "may user U spectate token T?" against the configured permission
 * mode, per-player overrides, and per-token opt-out flags.
 *
 * The rule set (least → most permissive):
 *   gm-only          — only the GM may spectate anything.
 *   owned-only       — a player may spectate tokens they own.
 *   party-members    — owned tokens + tokens owned by any active player (the "party").
 *   any-player-token — any token that has a player owner.
 *   any-token        — anything on the scene (still POV-clamped so no cheating).
 *
 * Per-token opt-out (flag `noSpectate`) always wins for non-GM users, so a
 * sensitive NPC can be excluded regardless of mode. Per-player overrides let a
 * GM widen or narrow a single player's mode.
 */

import { FLAG_SCOPE, MODULE_ID, PermissionMode, SETTINGS } from "../constants.js";
import type { PermissionDecision } from "../types/index.js";

const ORDER: PermissionMode[] = [
  PermissionMode.GMOnly,
  PermissionMode.OwnedOnly,
  PermissionMode.PartyMembers,
  PermissionMode.AnyPlayerToken,
  PermissionMode.AnyToken
];

export class PermissionManager {
  /** The effective mode for a specific user (per-player override, else global). */
  static modeFor(user: FoundryUser): PermissionMode {
    const global = (game.settings.get(MODULE_ID, SETTINGS.permissionMode) as PermissionMode) ?? PermissionMode.OwnedOnly;
    const overrides = (game.settings.get(MODULE_ID, SETTINGS.perPlayerPermissions) as Record<string, PermissionMode>) ?? {};
    return overrides[user.id] ?? global;
  }

  /** True if `token` is owned by any currently-active non-GM player. */
  private static isPartyToken(token: FoundryToken): boolean {
    const actor = token.actor;
    if (!actor) return false;
    if (!actor.hasPlayerOwner) return false;
    return game.users.filter((u) => !u.isGM && u.active).some((u) => token.document.testUserPermission(u, "OWNER"));
  }

  private static hasPlayerOwner(token: FoundryToken): boolean {
    return Boolean(token.actor?.hasPlayerOwner);
  }

  /**
   * The central decision. Returns both the boolean and a machine-readable reason
   * so the UI can explain *why* a token is greyed out.
   */
  static canSpectate(user: FoundryUser, token: FoundryToken): PermissionDecision {
    if (!token?.document) return { allowed: false, reason: "no-token" };

    // The GM can always spectate; opt-out is a player-facing courtesy only.
    if (user.isGM) return { allowed: true, reason: "gm" };

    // Per-token opt-out blocks all non-GM spectating.
    const optedOut = Boolean(token.document.getFlag(FLAG_SCOPE, "noSpectate"));
    if (optedOut) return { allowed: false, reason: "opted-out" };

    const mode = this.modeFor(user);
    const owns = token.document.testUserPermission(user, "OWNER");

    switch (mode) {
      case PermissionMode.GMOnly:
        return { allowed: false, reason: "gm-only" };

      case PermissionMode.OwnedOnly:
        return owns
          ? { allowed: true, reason: "owned" }
          : { allowed: false, reason: "not-owned" };

      case PermissionMode.PartyMembers:
        if (owns) return { allowed: true, reason: "owned" };
        return this.isPartyToken(token)
          ? { allowed: true, reason: "party" }
          : { allowed: false, reason: "not-party" };

      case PermissionMode.AnyPlayerToken:
        if (owns) return { allowed: true, reason: "owned" };
        return this.hasPlayerOwner(token)
          ? { allowed: true, reason: "player-token" }
          : { allowed: false, reason: "npc" };

      case PermissionMode.AnyToken:
        return { allowed: true, reason: "any" };

      default:
        return { allowed: false, reason: "unknown-mode" };
    }
  }

  /** Convenience boolean form. */
  static allowed(user: FoundryUser, token: FoundryToken): boolean {
    return this.canSpectate(user, token).allowed;
  }

  /** Filter the scene's tokens down to those the user may spectate. */
  static spectatableTokens(user: FoundryUser): FoundryToken[] {
    const placeables: FoundryToken[] = canvas?.tokens?.placeables ?? [];
    return placeables.filter((t) => this.allowed(user, t));
  }

  /** Set / clear a token's per-token opt-out flag (GM or token owner only). */
  static async setOptOut(token: FoundryToken, optOut: boolean): Promise<void> {
    if (optOut) await token.document.setFlag(FLAG_SCOPE, "noSpectate", true);
    else await token.document.unsetFlag(FLAG_SCOPE, "noSpectate");
  }

  /** Persist a per-player override mode (GM only, world scope). */
  static async setPlayerOverride(userId: string, mode: PermissionMode | null): Promise<void> {
    const overrides = { ...(game.settings.get(MODULE_ID, SETTINGS.perPlayerPermissions) as Record<string, PermissionMode>) };
    if (mode === null) delete overrides[userId];
    else overrides[userId] = mode;
    await game.settings.set(MODULE_ID, SETTINGS.perPlayerPermissions, overrides);
  }

  /** Rank of a mode for comparison/UI sorting. */
  static rank(mode: PermissionMode): number {
    return ORDER.indexOf(mode);
  }
}
