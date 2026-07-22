/**
 * Resolves "may user U spectate token T?" against the configured permission
 * mode, per-player overrides, and per-token opt-out flags.
 *
 * The rule set (least → most permissive):
 *   gm-only          - only the GM may spectate anything.
 *   owned-only       - a player may spectate tokens they own.
 *   party-members    - owned tokens + tokens owned by any active player (the "party").
 *   any-player-token - any token that has a player owner (the default).
 *   any-token        - anything on the scene (still POV-clamped so no cheating).
 *
 * NPC tokens (no player owner) are a separate axis: they are only spectatable
 * when the world setting `allowNpcSpectate` is on, or when a per-token opt-in
 * flag says so - off by default so players only see each other by default. The
 * `any-token` mode is the explicit "everything, NPCs included" power mode and
 * ignores that gate.
 *
 * Per-token opt-out (flag `noSpectate`) always wins for non-GM users, so a
 * sensitive token can be excluded regardless of mode. Per-player overrides let a
 * GM widen or narrow a single player's mode.
 */

import { FLAG_SCOPE, MODULE_ID, PermissionMode, SETTINGS, TOKEN_FLAGS } from "../constants.js";
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
    const global = (game.settings.get(MODULE_ID, SETTINGS.permissionMode) as PermissionMode) ?? PermissionMode.AnyPlayerToken;
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

  /** True if `token` is an NPC - i.e. it has no player owner. */
  static isNpc(token: FoundryToken): boolean {
    return !this.hasPlayerOwner(token);
  }

  /** The per-token NPC override: true (force on), false (force off), or undefined. */
  private static npcOverride(token: FoundryToken): boolean | undefined {
    const v = token.document?.getFlag(FLAG_SCOPE, TOKEN_FLAGS.npcSpectatable);
    return v === true ? true : v === false ? false : undefined;
  }

  /**
   * Whether NPC tokens may be spectated for this token. The per-token override
   * wins in either direction; otherwise the world `allowNpcSpectate` default
   * applies. (Only meaningful for NPC tokens; player tokens ignore it.)
   */
  static npcSpectatable(token: FoundryToken): boolean {
    const override = this.npcOverride(token);
    if (override !== undefined) return override;
    return Boolean(game.settings.get(MODULE_ID, SETTINGS.allowNpcSpectate));
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
    const optedOut = Boolean(token.document.getFlag(FLAG_SCOPE, TOKEN_FLAGS.noSpectate));
    if (optedOut) return { allowed: false, reason: "opted-out" };

    const mode = this.modeFor(user);
    if (mode === PermissionMode.GMOnly) return { allowed: false, reason: "gm-only" };

    // A user may always spectate a token they own, whatever kind it is.
    const owns = token.document.testUserPermission(user, "OWNER");
    if (owns) return { allowed: true, reason: "owned" };

    // NPC tokens are gated by the NPC axis, independent of the mode ladder. An
    // explicit per-token override always wins; then AnyToken (the "everything"
    // mode) allows; otherwise the world `allowNpcSpectate` default decides.
    if (this.isNpc(token)) {
      const override = this.npcOverride(token);
      if (override === true) return { allowed: true, reason: "npc-allowed" };
      if (override === false) return { allowed: false, reason: "npc-blocked" };
      if (mode === PermissionMode.AnyToken) return { allowed: true, reason: "any" };
      return Boolean(game.settings.get(MODULE_ID, SETTINGS.allowNpcSpectate))
        ? { allowed: true, reason: "npc-allowed" }
        : { allowed: false, reason: "npc" };
    }

    // Player-owned token that this user does not personally own.
    switch (mode) {
      case PermissionMode.OwnedOnly:
        return { allowed: false, reason: "not-owned" };

      case PermissionMode.PartyMembers:
        return this.isPartyToken(token)
          ? { allowed: true, reason: "party" }
          : { allowed: false, reason: "not-party" };

      case PermissionMode.AnyPlayerToken:
      case PermissionMode.AnyToken:
        return { allowed: true, reason: "player-token" };

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
    if (optOut) await token.document.setFlag(FLAG_SCOPE, TOKEN_FLAGS.noSpectate, true);
    else await token.document.unsetFlag(FLAG_SCOPE, TOKEN_FLAGS.noSpectate);
  }

  /**
   * Set / clear a token's per-token NPC opt-in override (GM only). `true` forces
   * the NPC spectatable, `false` forces it off, `null` clears the override so the
   * world `allowNpcSpectate` default applies again.
   */
  static async setNpcSpectatable(token: FoundryToken, value: boolean | null): Promise<void> {
    if (value === null) await token.document.unsetFlag(FLAG_SCOPE, TOKEN_FLAGS.npcSpectatable);
    else await token.document.setFlag(FLAG_SCOPE, TOKEN_FLAGS.npcSpectatable, value);
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
