# Testing strategy

The module mixes **pure logic** (trivially testable) with **Foundry-runtime
integration** (must be validated in a live world). This document describes both.

## 1. Pure unit tests (no Foundry required)

These modules are pure/deterministic and are the highest-value automated tests:

- `LayoutEngine.compute` — for N = 1…12 and each aspect class (portrait, square,
  wide, ultrawide), assert: rectangle count, no overlaps, padding respected,
  primary is the largest tile, featured/grid selection matches the spec.
- `GroupingEngine.group` — assert elevation banding respects the threshold,
  distance clustering respects `groupingDistance`, and `observedAtElevation`
  filters correctly (the "basement / ground / first floor" scenario).
- `math.ts` — `smoothingFactor` is framerate-independent (same convergence for
  equal elapsed time at different dt), `heading` returns expected compass values,
  `aspectClass` boundaries.
- `PermissionManager.canSpectate` — a decision table across all five modes ×
  {owned, party, player-token, npc} × {opt-out on/off} × {GM/player}.

### Suggested setup

These files import only from `constants.ts`, `types/`, and `util/math.ts`, so
they can be tested with **Vitest** by stubbing the few globals they read. Example
skeleton:

```ts
// layout.test.ts
import { describe, it, expect } from "vitest";
import { LayoutEngine } from "../src/multiview/LayoutEngine";

const views = (n: number, primary = 0) =>
  Array.from({ length: n }, (_, i) => ({
    id: `v${i}`, tokenId: `t${i}`, sceneId: "s", primary: i === primary,
    pinned: false, collapsed: false, slot: -1,
    camera: { mode: "smooth", followSpeed: 0.6, deadZone: 0.2, zoomMemory: true, followRotation: false } as any
  }));

describe("LayoutEngine", () => {
  it("fills the container for a single viewport", () => {
    const [r] = LayoutEngine.compute(views(1), { width: 1920, height: 1080, padding: 0 });
    expect(r.width).toBe(1920);
    expect(r.height).toBe(1080);
  });
  it("gives the primary the largest tile at 3 views", () => {
    const rects = LayoutEngine.compute(views(3), { width: 1920, height: 1080, padding: 6 });
    const primary = rects.find(r => r.primary)!;
    const area = (r: any) => r.width * r.height;
    expect(rects.every(r => r.primary || area(r) <= area(primary))).toBe(true);
  });
});
```

`GroupingEngine` and `math` need no globals. `PermissionManager` needs `game`,
`canvas` and `game.settings.get` stubbed — provide a small fake.

## 2. Integration checklist (live world)

Run these in a test world with a scene that has walls, lights and a
darkness-varying environment, and at least: two player-owned tokens at the same
elevation, one at a different elevation, and one NPC.

### Spectator
- [ ] Spectate an owned token → camera locks, follows on move, vision matches.
- [ ] Spectate a token in a dark/walled area → you see only what it can see.
- [ ] Exclusive POV: while owning token A, spectate token B in a different room —
      you must **not** see A's room.
- [ ] Stop spectating (Escape) → camera and vision fully restored.
- [ ] Per-token opt-out hides a token from a player's picker.
- [ ] Each permission mode gates the picker correctly.
- [ ] Cross-scene: move the followed token to another scene → prompt/follow/drop
      per setting.
- [ ] Token deleted while spectated → spectate stops cleanly.

### MultiView
- [ ] Add 2, 3, 4 views → layout matches split / featured / 2×2.
- [ ] Resize the window / rotate to portrait → re-tiles live.
- [ ] Each viewport shows its own token's POV (independent fog).
- [ ] Primary updates smoothly; secondaries update on cadence.
- [ ] Pin, collapse, solo (double-click), drag-to-swap, pagination all work.
- [ ] Overlays toggle per setting; HP/conditions resolve for your system.
- [ ] Streaming mode hides chrome; borders vanish.
- [ ] "Observe this elevation" with a selected ground-floor token shows only
      ground-floor characters.
- [ ] Close MultiView → live scene restored, no leftover overlay, FPS normal.

### Cleanup / leaks
- [ ] Open/close MultiView 20×; console has no growing warnings; memory stable.
- [ ] Change scenes with MultiView open → tears down (or follows) per setting.
- [ ] Disable the module → no residual prototype patch (spectate a token in
      another module afterwards behaves normally).

## 3. Cross-version / compatibility

- Verify on the lowest supported core (v12) and the verified core (v13) — focus on
  `VisionController.forceRecompute` (the version-sensitive seam), scene-control
  registration (array vs record), and Token HUD injection (jQuery vs HTMLElement).
- Test with and without **lib-wrapper** installed (both wrapper paths).
- Spot-check on dnd5e and one other system for HP/condition overlays.

## 4. Regression guard

Before release: `npm run typecheck && npm run build` must pass clean (they do in
CI-equivalent local runs), and the pure unit suite must be green.
