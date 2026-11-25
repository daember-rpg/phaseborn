# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] — Unreleased

### Added

- Automatic HP-driven face switching via `updateActor` hook, GM-gated.
- Face 1 / Original auto-capture from the live token (image, real scale,
  grid size) — no manual configuration required.
- Visual configuration window (`ApplicationV2`) with:
  - per-face name, HP trigger, image, real scale, grid size, effect, and
    chat announcement toggle;
  - live preview per face (image + size + effect) without affecting HP or
    combat state;
  - one-click restore to Face 1;
  - one-click recapture of Face 1 from the current token state.
- Entry points: actor sheet header button and token HUD icon.
- Built-in effects library (`scripts/effects.js`): None, Simple Flash,
  Black Explosion, Lightning Strike, Fire Burst, Void Implosion, Holy
  Light — built from composable PIXI/DOM primitives.
- Public API under `game.phaseborn`.
- Debug logging for HP-trigger evaluation to aid troubleshooting.

### Design notes

- HP triggers are absolute HP values, not percentages, by design — easier
  to reason about at the table without doing math mid-combat.
- Real Scale and Size fields store literal, absolute values per face
  (not multipliers) to avoid compounding drift across repeated
  transformations.
