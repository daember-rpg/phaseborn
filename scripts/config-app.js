const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const MODULE_ID = "phaseborn";

/**
 * Configuration window for an actor's faces.
 * Face 1 (Original) is never edited here: it always mirrors what the token
 * already is. This UI only configures the EXTRA faces (2 and up).
 */
export class PhasebornConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, options = {}) {
    if (!game.user.isGM) {
      throw new Error("Phaseborn configuration is GM-only.");
    }
    options.id = `phaseborn-config-${actor.id}`;
    super(options);
    this.actor = actor;
  }

  static DEFAULT_OPTIONS = {
    tag: "div",
    window: { title: "Phaseborn", icon: "fas fa-masks-theater", resizable: true },
    position: { width: 680, height: "auto" },
    actions: {
      addRow: PhasebornConfig.#onAddRow,
      removeRow: PhasebornConfig.#onRemoveRow,
      pickImage: PhasebornConfig.#onPickImage,
      previewRow: PhasebornConfig.#onPreviewRow,
      recaptureOriginal: PhasebornConfig.#onRecaptureOriginal,
      restoreOriginal: PhasebornConfig.#onRestoreOriginal,
      save: PhasebornConfig.#onSave,
    },
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/config.hbs` },
  };

  get title() {
    return `Phaseborn — ${this.actor.name}`;
  }

  async _prepareContext(_options) {
    const faces = this.actor.getFlag(MODULE_ID, "forms") ?? [];
    const original = await game.phaseborn.ensureOriginal(this.actor);
    return { faces, original };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    // Face 1 / Original panel (read-only)
    const originalImg = this.element.querySelector(".phaseborn-original img");
    const originalLabel = this.element.querySelector(".phaseborn-original .original-meta");
    if (originalImg) originalImg.src = context.original.img;
    if (originalLabel) {
      originalLabel.textContent = `Size: ${context.original.width}x${context.original.height} · Scale: ${context.original.scaleX}`;
    }

    const container = this.element.querySelector(".phaseborn-rows");
    container.innerHTML = "";
    for (const face of context.faces) container.appendChild(this.#buildRow(face));
  }

  #buildRow(data = {}) {
    const original = this.actor.getFlag(MODULE_ID, "original") ?? {};
    const row = document.createElement("div");
    row.className = "phaseborn-row";
    row.dataset.id = data.id ?? foundry.utils.randomID();

    row.innerHTML = `
      <div class="field">
        <label>Phase Name</label>
        <input type="text" class="f-label" placeholder="e.g. Exposed Core">
      </div>
      <div class="field small">
        <label>HP Trigger</label>
        <input type="number" class="f-threshold" min="0" step="1">
      </div>
      <div class="field grow">
        <label>Token Image</label>
        <div class="img-row">
          <input type="text" class="f-img" placeholder="path/to/image.webp">
          <button type="button" data-action="pickImage" title="Browse for file">
            <i class="fas fa-file-import"></i>
          </button>
        </div>
      </div>
      <div class="field tiny">
        <label>Real Scale</label>
        <input type="number" class="f-scale" min="0.1" max="5" step="0.05">
      </div>
      <div class="field tiny">
        <label>Size (squares)</label>
        <input type="number" class="f-size" min="0.5" max="20" step="0.5">
      </div>
      <div class="field">
        <label>Effect on Switch</label>
        <select class="f-fx"></select>
      </div>
      <div class="field checkbox">
        <label><input type="checkbox" class="f-chat"> Announce in chat</label>
      </div>
      <div class="row-actions">
        <button type="button" data-action="previewRow" title="Preview this phase on the token now">
          <i class="fas fa-eye"></i>
        </button>
        <button type="button" class="remove-row" data-action="removeRow" title="Remove phase">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;

    const fxSelect = row.querySelector(".f-fx");
    for (const [key, def] of Object.entries(game.phaseborn.EFFECTS)) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = def.label;
      fxSelect.appendChild(opt);
    }

    const hpMax = this.actor.system.attributes?.hp?.max ?? 100;
    row.querySelector(".f-label").value = data.label ?? "";
    row.querySelector(".f-threshold").value = data.threshold ?? Math.round(hpMax * 0.5);
    row.querySelector(".f-img").value = data.img ?? "";
    row.querySelector(".f-scale").value = data.scale ?? original.scaleX ?? 1;
    row.querySelector(".f-size").value = data.size ?? original.width ?? 1;
    fxSelect.value = data.fx ?? "flash";
    row.querySelector(".f-chat").checked = !!data.chatMessage;

    return row;
  }

  #readRow(row) {
    return {
      id: row.dataset.id,
      label: row.querySelector(".f-label").value.trim(),
      threshold: Number(row.querySelector(".f-threshold").value),
      img: row.querySelector(".f-img").value.trim(),
      scale: Number(row.querySelector(".f-scale").value) || 1,
      size: Number(row.querySelector(".f-size").value) || 1,
      fx: row.querySelector(".f-fx").value,
      chatMessage: row.querySelector(".f-chat").checked,
    };
  }

  static #onAddRow() {
    const container = this.element.querySelector(".phaseborn-rows");
    const count = container.children.length;
    const hpMax = this.actor.system.attributes?.hp?.max ?? 100;
    // Decreasing suggestion: 50%, 30%, 15%, 5% of max HP...
    const fractions = [0.5, 0.3, 0.15, 0.05];
    const suggested = Math.round(hpMax * (fractions[count] ?? 0.05));
    container.appendChild(this.#buildRow({ threshold: suggested }));
  }

  static #onRemoveRow(_event, target) {
    target.closest(".phaseborn-row").remove();
  }

  static #onPickImage(_event, target) {
    const input = target.closest(".field").querySelector(".f-img");
    const fp = new FilePicker({
      type: "imagevideo",
      current: input.value,
      callback: (path) => (input.value = path),
    });
    fp.render(true);
  }

  /** Applies this row's phase directly to the live token, preview-only (nothing is saved) */
  static async #onPreviewRow(_event, target) {
    const row = target.closest(".phaseborn-row");
    const data = this.#readRow(row);
    if (!data.img) {
      ui.notifications.warn("Fill in the image before previewing.");
      return;
    }
    const tokens = this.actor.getActiveTokens(true);
    if (!tokens.length) {
      ui.notifications.warn("This actor has no active token in the current scene.");
      return;
    }
    for (const token of tokens) {
      await game.phaseborn.applyVisual(
        token,
        { img: data.img, scaleX: data.scale, scaleY: data.scale, width: data.size, height: data.size, label: data.label },
        { fx: data.fx }
      );
    }
    ui.notifications.info(`Previewing "${data.label || "phase"}" on the token.`);
  }

  static async #onRecaptureOriginal() {
    const snapshot = await game.phaseborn.ensureOriginal(this.actor, { force: true });
    ui.notifications.info("Face 1 (Original) recaptured from the current token.");
    this.render();
  }

  static async #onRestoreOriginal() {
    const original = game.phaseborn.getOriginal(this.actor);
    const tokens = this.actor.getActiveTokens(true);
    for (const token of tokens) {
      await game.phaseborn.applyVisual(token, original, { fx: false });
    }
    ui.notifications.info("Token restored to Face 1 (Original).");
  }

  static async #onSave() {
    const rows = this.element.querySelectorAll(".phaseborn-row");
    const faces = [];

    for (const row of rows) {
      const data = this.#readRow(row);
      if (!data.img) {
        ui.notifications.error(`Missing image for phase "${data.label || "unnamed"}".`);
        return;
      }
      if (Number.isNaN(data.threshold) || data.threshold < 0) {
        ui.notifications.error(`Invalid HP trigger for phase "${data.label || "unnamed"}".`);
        return;
      }
      faces.push(data);
    }

    await this.actor.setFlag(MODULE_ID, "forms", faces);
    await this.actor.unsetFlag(MODULE_ID, "currentForm");
    ui.notifications.info(`Phaseborn: saved ${faces.length} extra phase(s) for ${this.actor.name}.`);
    this.close();
  }
}
