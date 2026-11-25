# Phaseborn — Boss Phase Shifter

Automatic, HP-driven token phase transitions for Foundry VTT — the "Dark
Souls boss phase" effect, built in. Give any actor multiple *faces*, each
tied to an HP threshold, and Phaseborn swaps the token's image, size, and
scale automatically as the fight unfolds — with a full library of built-in
transformation effects (explosions, lightning, holy light, and more).

![Foundry Version](https://img.shields.io/badge/Foundry-v13%20%7C%20v14-informational)
![Status](https://img.shields.io/badge/status-stable-brightgreen)

---

## Features

- **Automatic phase switching** — define an HP threshold per face; the token
  updates the moment the actor's HP crosses it, no macros or manual clicks
  during combat.
- **Face 1 is always your original token** — captured automatically, never
  edited by hand. You only configure phases 2 and up.
- **Real size awareness** — each face carries its own grid size (in squares)
  and texture scale, so Small/Medium/Large/Huge tokens keep their correct
  footprint instead of rendering oversized or undersized.
- **Built-in visual effects library** — six ready-made transformation effects
  (particles, shockwave rings, screen shake, full-screen flash, lightning
  bolts) built entirely in PIXI/DOM, no external asset packs required.
- **Live preview** — test any face's image, scale, size, and effect directly
  on the live token from the configuration window, before combat even
  starts.
- **Two entry points** — a header button on the actor sheet, and an icon on
  the token HUD (right-click the token), so the GM always has quick access.
- **GM-only** — all triggers and configuration are gated to the GM; players
  never see the configuration UI.

## Requirements

- Foundry VTT **v13+** (verified on v14)
- Any game system exposing `system.attributes.hp.value` / `.max` (tested
  with Pathfinder 2e; should work unmodified with dnd5e, SWADE, and similar
  systems using the same attribute path)

## Installation

**Manifest URL** (recommended once hosted):

```
https://github.com/daember-rpg/phaseborn/releases/latest/download/module.json
```

**Manual installation:**

1. Download the latest release `.zip`.
2. Extract it into your Foundry `Data/modules/` folder. You should end up
   with `Data/modules/phaseborn/module.json`.
3. Restart Foundry, open your world, and enable **Phaseborn** under
   *Game Settings → Manage Modules*.

## Quick Start

1. Select the actor's token on the canvas.
2. Open Phaseborn either from:
   - the actor sheet header button (**Phaseborn**), or
   - right-clicking the token to open the Token HUD, then clicking the
     mask icon.
3. The **Face 1 — Original** panel at the top is filled in automatically
   from the token as it currently exists. You never need to edit it.
4. Click **+ Add Face** to create Phase 2. Fill in:
   - a name,
   - the HP value at which it should trigger,
   - the token image,
   - scale and grid size (both default to match Face 1),
   - a transformation effect.
5. Click the **eye icon** on the row to preview it live on the token —
   image, size, and effect together — without touching HP or combat.
6. Click **Restore Now** to snap the token back to Face 1 while you keep
   testing.
7. Repeat for additional phases, then **Save**.
8. During combat, edit the actor's HP as normal. Phaseborn watches for HP
   changes and switches faces automatically, in either direction (it will
   revert to a lower-numbered phase if the actor is healed back above a
   threshold).

## Configuration Reference

| Field | Description |
|---|---|
| **Name** | Display label for the phase. Also becomes the token's name in the scene while that phase is active. |
| **HP Trigger** | Absolute HP value (not a percentage). The face applies whenever the actor's current HP is at or below this value, and no lower-threshold face also qualifies. |
| **Token Image** | Path to the image used for this phase. Use the folder icon to browse, or the crosshair icon to copy the image currently on the live token. |
| **Real Scale** | The literal `texture.scale` value applied to this phase — not a multiplier. Defaults to Face 1's scale. Adjust if the new artwork has different padding/framing than the original. |
| **Size (squares)** | Grid footprint in squares (e.g. `1` = Medium, `2` = Large, in most size-linear systems). Defaults to Face 1's size, so phases never resize by accident unless you explicitly change this. |
| **Effect on Switch** | Which built-in transformation effect plays when this face activates. See [Effects Library](#effects-library) below. |
| **Announce in Chat** | Posts a chat message naming the new phase when it activates. |

### How threshold resolution works

Among all configured extra faces whose HP Trigger is **greater than or
equal to** the actor's current HP, Phaseborn picks the one with the
**lowest** threshold (the most "advanced" phase that still applies). If no
extra face qualifies, the token uses Face 1 (Original). This means healing
an actor back above a threshold automatically reverts the token — phase
transitions are not one-way.

## Effects Library

| Effect | Description |
|---|---|
| **None** | No visual effect, silent swap. |
| **Simple Flash** | Quick color pulse + a single expanding ring. |
| **Black Explosion** | Dark/purple particle burst, layered shockwave rings, camera shake, full-screen flash. |
| **Lightning Strike** | Six jagged bolts (procedurally generated, never identical twice) converging on the token, double screen flash, camera shake. |
| **Fire Burst** | Orange/red particle explosion with a heat-tinted flash and shockwave. |
| **Void Implosion** | Particles pulled inward and vanish, followed by a delayed dark outward burst — good for aberration/void-themed reveals. |
| **Holy Light** | Warm gold particles rising, soft white-gold screen flash, layered rings. |

All effects are implemented in `scripts/effects.js` as composable
primitives (`pulseTint`, `expandingRing`, `shockwaveBurst`,
`spawnParticles`, `lightningBolts`, `screenShake`, `screenFlash`). Adding a
new effect is a matter of registering a new entry in the `EFFECTS` object —
no changes needed elsewhere in the codebase.

## API (for macros / other modules)

Exposed at `game.phaseborn` once the `ready` hook fires:

```js
game.phaseborn.openConfig(actor);      // Opens the config window for an actor
game.phaseborn.forceCheck(actor?);     // Re-evaluates and applies the correct
                                        // face for the actor's current HP
                                        // (defaults to the selected token's actor)
game.phaseborn.pickFace(faces, hp);    // Pure function: which face applies at this HP
game.phaseborn.applyVisual(token, visual, { fx }); // Low-level visual apply
game.phaseborn.getOriginal(actor);     // Returns the stored Face 1 snapshot
game.phaseborn.ensureOriginal(actor, { force }); // (Re)captures Face 1 from the live token
game.phaseborn.EFFECTS;                // The effects registry
```

## Troubleshooting

**The token doesn't switch when HP changes.**
Open the browser console (F12). Phaseborn logs a debug line on every HP
update showing the computed HP, the currently active face, and the face it
calculated — this will show you exactly why a switch did or didn't happen.

**The token is the wrong size after switching.**
Check the **Size (squares)** and **Real Scale** fields on that phase — they
default to Face 1's values, but if a phase's artwork has different padding
around the subject, you'll need to tune these by eye using the preview
(eye icon) button.

**Only one phase seems to ever apply.**
Make sure you've actually saved more than one extra face. With a single
face configured, Phaseborn has nothing to fall back to and will always show
that one face regardless of HP — the Save dialog warns you if this happens.

## Roadmap Ideas

- Per-face sound cue
- Optional "away from keyboard" delay/animation queueing for simultaneous
  multi-token updates
- Support for non-square grid footprints (separate width/height)
- Combat-only trigger toggle (currently fires on any HP-affecting update)

## Before You Publish

- [ ] Add real screenshots/GIFs of the configuration UI and an in-combat
      phase switch to this README.
- [ ] Decide and finalize your license (see `LICENSE.md`).
- [ ] Publish a GitHub Release for each version, attaching both
      `module.json` and `phaseborn.zip` (the manifest/download URLs in
      `module.json` point at `releases/latest`).
- [ ] Test against at least one other system besides PF2e if you plan to
      market it system-agnostically.
- [ ] Consider submitting to the official
      [Foundry Package Registry](https://foundryvtt.com/packages/) once the
      above is done.

## Credits

Created by Fernando de Melo (Hello Melo Design).

## License

See [LICENSE.md](LICENSE.md).
