import { PhasebornConfig } from "./config-app.js";
import { EFFECTS, playEffect } from "./effects.js";

const MODULE_ID = "phaseborn";
const ORIGINAL_ID = "__original__";

function log(...args) {
  console.log(`Phaseborn |`, ...args);
}

/**
 * "Face 1 / Original" is never configured by hand: it's a snapshot of what
 * the token already had (image, real scale, and grid size) before any
 * switch. It's captured automatically the first time Phaseborn is opened
 * for that actor.
 */
function captureOriginal(actor) {
  const activeToken = actor.getActiveTokens(true)[0];
  const doc = activeToken?.document ?? actor.prototypeToken;
  return {
    img: doc?.texture?.src ?? "",
    scaleX: doc?.texture?.scaleX ?? 1,
    scaleY: doc?.texture?.scaleY ?? 1,
    width: doc?.width ?? 1,
    height: doc?.height ?? 1,
  };
}

function getOriginal(actor) {
  return actor.getFlag(MODULE_ID, "original") ?? captureOriginal(actor);
}

async function ensureOriginal(actor, { force = false } = {}) {
  if (force || !actor.getFlag(MODULE_ID, "original")) {
    const snapshot = captureOriginal(actor);
    await actor.setFlag(MODULE_ID, "original", snapshot);
    return snapshot;
  }
  return actor.getFlag(MODULE_ID, "original");
}

/**
 * Picks the right face for the current HP (absolute value, not %) among the
 * EXTRA faces (2 and up). Returns null if none applies -> "Face 1 / Original".
 */
function pickFace(faces, hpValue) {
  const eligible = faces.filter((f) => hpValue <= f.threshold);
  if (!eligible.length) return null;
  return eligible.reduce((a, b) => (a.threshold < b.threshold ? a : b));
}

/**
 * Visually applies a face to a token (image, real scale, grid size).
 * Used both by the automatic HP-driven switch and by the manual preview
 * in the configuration window.
 */
async function applyVisual(token, visual, { fx = null } = {}) {
  const doc = token.document;
  const updateData = {
    "texture.src": visual.img,
    "texture.scaleX": visual.scaleX ?? 1,
    "texture.scaleY": visual.scaleY ?? 1,
    width: visual.width ?? doc.width,
    height: visual.height ?? doc.height,
  };
  if (visual.label) updateData.name = visual.label;
  await doc.update(updateData);
  if (fx) playEffect(token, fx);
}

/** Automatic switch (called by the HP hook) */
async function applyFace(actor, face) {
  const targetId = face?.id ?? ORIGINAL_ID;
  await actor.setFlag(MODULE_ID, "currentForm", targetId);

  const visual = face
    ? { img: face.img, scaleX: face.scale ?? 1, scaleY: face.scale ?? 1, width: face.size, height: face.size, label: face.label }
    : getOriginal(actor);
  const fxKey = face?.fx ?? "flash";

  const tokens = actor.getActiveTokens(true);
  for (const token of tokens) {
    await applyVisual(token, visual, { fx: fxKey });
  }

  if (face?.chatMessage) {
    ChatMessage.create({
      content: `<p><strong>${actor.name}</strong> shifts form: <em>${face.label ?? face.id}</em>!</p>`,
      speaker: ChatMessage.getSpeaker({ actor }),
    });
  }

  log(`${actor.name} -> ${face ? `face "${face.id}"` : "Original (Face 1)"}`);
}

function openConfig(actor) {
  if (!game.user.isGM) {
    ui.notifications.warn("Phaseborn is only available to the GM.");
    return;
  }
  if (!actor) {
    ui.notifications.warn("No actor found.");
    return;
  }
  new PhasebornConfig(actor).render(true);
}

async function forceCheck(actor) {
  if (!game.user.isGM) {
    ui.notifications.warn("Phaseborn is only available to the GM.");
    return;
  }
  actor ??= canvas.tokens.controlled[0]?.actor;
  if (!actor) {
    ui.notifications.warn("Select a token with an actor first.");
    return;
  }
  const faces = actor.getFlag(MODULE_ID, "forms") ?? [];
  const hp = actor.system.attributes?.hp;
  if (!hp?.max) return;
  await applyFace(actor, pickFace(faces, hp.value));
}

Hooks.once("init", () => {
  log("Initializing module");
});

/** Automatic face switching when HP changes in combat */
Hooks.on("updateActor", async (actor, changes, options, userId) => {
  if (game.user.id !== userId || !game.user.isGM) return;

  const faces = actor.getFlag(MODULE_ID, "forms");
  if (!faces?.length) return;

  const hpChanged = foundry.utils.hasProperty(changes, "system.attributes.hp.value");
  if (!hpChanged) return;

  const hp = actor.system.attributes?.hp;
  if (!hp?.max) return;

  const target = pickFace(faces, hp.value);
  const targetId = target?.id ?? ORIGINAL_ID;
  const current = actor.getFlag(MODULE_ID, "currentForm") ?? ORIGINAL_ID;

  log(
    `debug hook -> actor: ${actor.name} | hp: ${hp.value}/${hp.max} | ` +
      `current face: ${current} | calculated face: ${targetId}`
  );

  if (current === targetId) return;

  await applyFace(actor, target);
});

/** "Phaseborn" button on the actor sheet header */
Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
  if (!sheet.actor || !game.user.isGM) return;
  buttons.unshift({
    label: "Phaseborn",
    class: "phaseborn-open",
    icon: "fas fa-masks-theater",
    onclick: () => openConfig(sheet.actor),
  });
});

/** Icon on the token HUD (appears when right-clicking the token) */
Hooks.on("renderTokenHUD", (hud, html) => {
  if (!game.user.isGM) return;

  const actor = hud.object?.actor ?? hud.document?.actor;
  if (!actor) return;

  const el = html instanceof HTMLElement ? html : html[0];

  const btn = document.createElement("div");
  btn.classList.add("control-icon", "phaseborn-hud-button");
  btn.title = "Phaseborn";
  btn.innerHTML = `<i class="fas fa-masks-theater"></i>`;
  btn.addEventListener("click", () => openConfig(actor));

  const col = el.querySelector(".col.right") ?? el.querySelector(".col") ?? el;
  col.appendChild(btn);
});

Hooks.once("ready", () => {
  game.phaseborn = {
    openConfig,
    forceCheck,
    pickFace,
    applyVisual,
    getOriginal,
    ensureOriginal,
    captureOriginal,
    EFFECTS,
  };
  log("Ready.");
});
