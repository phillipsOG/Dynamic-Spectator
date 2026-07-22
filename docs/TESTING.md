# Testing strategy

The module mixes **pure logic** (trivially testable) with **Foundry-runtime
integration** (must be validated in a live world). This document describes both.

## 1. Pure unit tests (no Foundry required)

These modules are pure/deterministic and are the highest-value automated tests:

- `PermissionManager.canSpectate` — a decision table across all five modes ×
  {owned, party, player-token, npc} × {opt-out on/off} × {npc override
  on/off/unset} × {GM/player}.
- `math.ts` — `smoothingFactor` is framerate-independent (same convergence for
  equal elapsed time at different dt).

### Suggested setup

These files import only from `constants.ts`, `types/`, and `util/math.ts`, so
they can be tested with **Vitest** by stubbing the few globals they read.
`math` needs no globals. `PermissionManager` needs `game`, `canvas` and
`game.settings.get` stubbed — provide a small fake.

```ts
// math.test.ts
import { describe, it, expect } from "vitest";
import { smoothingFactor } from "../src/util/math";

describe("smoothingFactor", () => {
  it("converges the same amount per unit of wall-clock time", () => {
    const oneStep = smoothingFactor(0.6, 32);
    const twoSteps = 1 - (1 - smoothingFactor(0.6, 16)) ** 2;
    expect(twoSteps).toBeCloseTo(oneStep, 6);
  });
});
```

## 2. Integration checklist (live world)

Run these in a test world with a scene that has walls, lights, a roofed building
and a darkness-varying environment, and at least: two player-owned tokens at the
same elevation, one at a different elevation, and one NPC.

### Spectating
- [ ] Spectate an owned token → camera locks, follows on move, vision matches.
- [ ] Spectate a token in a dark/walled area → you see only what it can see.
- [ ] Exclusive POV: while owning token A, spectate token B in a different room —
      you must **not** see A's room.
- [ ] Spectate a token under a roof → the roof is revealed; walk it outside and
      back in and the reveal keeps up.
- [ ] Spectate a second token while already spectating → retargets without a
      flash of your own vision, and the bar renames.
- [ ] Scroll-wheel zoom while spectating → zoom changes and *stays* changed as
      the token moves; the camera keeps following at the new zoom.
- [ ] Turn off "Keep my zoom level", then spectate → re-frames to 100% once, and
      wheel zoom still works freely afterwards.
- [ ] Change ring colour / opacity / thickness while spectating → the ring
      updates live, without restarting the session.
- [ ] Turn the ring off → it disappears; turn it back on → it returns.
- [ ] Token deleted while spectated → spectate stops cleanly.
- [ ] Cross-scene: move the followed token to another scene → prompt/follow/drop
      per setting.

### Stopping
- [ ] **Escape** while spectating → stops, camera and vision fully restored.
- [ ] **Escape** while *not* spectating → normal core behaviour (closes the open
      window / deselects tokens); we must not swallow it.
- [ ] Clicking the spectating bar stops the session; the bar disappears.
- [ ] Token HUD eye button and the picker's current row both stop it too.
- [ ] Change scenes while spectating → `canvasTearDown` stops it, no stuck POV.

### Permissions
- [ ] Each permission mode gates the picker correctly.
- [ ] Per-token opt-out hides a token from a player's picker.
- [ ] NPC toggle in the picker force-enables/disables one NPC against the world
      default.
- [ ] Revoking ownership mid-session stops that player's spectate.

### Cleanup / leaks
- [ ] Start/stop spectating 20×; console has no growing warnings; memory stable.
- [ ] Disable the module → no residual prototype patch (spectate a token in
      another module afterwards behaves normally).
- [ ] No leftover `#dynamic-spectator-bar` in the DOM after stopping.

## 3. Cross-version / compatibility

- Verify on the lowest supported core (v12) and the verified core (v13) — focus on
  `VisionController.forceRecompute` (the version-sensitive seam), scene-control
  registration (array vs record), Token HUD injection (jQuery vs HTMLElement),
  the `#ui-bottom` mount point for the bar, and `CONST.KEYBINDING_PRECEDENCE`.
- Test with and without **lib-wrapper** installed (both wrapper paths).

## 4. Regression guard

Before release: `npm run typecheck && npm run build` must pass clean (they do in
CI-equivalent local runs), and the pure unit suite must be green.
