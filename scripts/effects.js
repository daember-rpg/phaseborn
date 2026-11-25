/**
 * Phaseborn's visual effects library.
 *
 * Token-anchored effects (particles, bolts, rings) use PIXI as children of
 * the Token itself, so they follow zoom/pan/movement for free.
 *
 * Full-screen effects (flash, camera shake) use DOM/CSS and the canvas
 * pivot respectively — the right tool for something that needs to cover
 * the whole viewport, not just the token's area.
 */

/** Flashes the token a solid color for a brief moment */
function pulseTint(token, { color = 0xffffff, duration = 220 } = {}) {
  const mesh = token.mesh;
  if (!mesh) return;
  const originalTint = mesh.tint ?? 0xffffff;
  mesh.tint = color;
  window.setTimeout(() => {
    if (!token.destroyed && mesh && !mesh.destroyed) mesh.tint = originalTint;
  }, duration);
}

/** Ring expanding and fading, centered on the token. maxRadiusMult > 1 bursts beyond the token. */
function expandingRing(token, { color = 0xffffff, thickness = 5, duration = 550, maxRadiusMult = 0.75 } = {}) {
  const ring = new PIXI.Graphics();
  ring.x = token.w / 2;
  ring.y = token.h / 2;
  token.addChild(ring);

  const maxRadius = Math.max(token.w, token.h) * maxRadiusMult;
  const start = performance.now();

  const ticker = () => {
    const t = (performance.now() - start) / duration;
    if (t >= 1 || ring.destroyed) {
      if (!ring.destroyed) ring.destroy();
      canvas.app.ticker.remove(ticker);
      return;
    }
    const radius = 10 + t * maxRadius;
    ring.clear();
    ring.lineStyle(thickness, color, 1 - t);
    ring.drawCircle(0, 0, radius);
  };
  canvas.app.ticker.add(ticker);
}

/** Several layered shockwaves, staggered with a small delay between them */
function shockwaveBurst(token, { color = 0xffffff, layers = 3, thickness = 6, maxRadiusMult = 2.2, duration = 750, stagger = 90 } = {}) {
  for (let i = 0; i < layers; i++) {
    window.setTimeout(
      () => expandingRing(token, { color, thickness: thickness - i, duration, maxRadiusMult: maxRadiusMult + i * 0.3 }),
      i * stagger
    );
  }
}

/**
 * Particles moving outward or pulled toward the center (inward).
 * maxRadiusMult controls how far from the token they reach.
 */
function spawnParticles(
  token,
  {
    count = 40,
    colors = [0xffffff],
    minSpeed = 100,
    maxSpeed = 260,
    minSize = 3,
    maxSize = 8,
    duration = 900,
    direction = "outward",
    maxRadiusMult = 1.2,
  } = {}
) {
  const cx = token.w / 2;
  const cy = token.h / 2;
  const maxRadius = Math.max(token.w, token.h) * maxRadiusMult;
  const particles = [];

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (minSpeed + Math.random() * (maxSpeed - minSpeed)) / 1000; // px/ms
    const size = minSize + Math.random() * (maxSize - minSize);
    const color = colors[(Math.random() * colors.length) | 0];

    const g = new PIXI.Graphics();
    g.beginFill(color);
    g.drawCircle(0, 0, size);
    g.endFill();

    const startRadius = direction === "inward" ? maxRadius : 2;
    g.x = cx + Math.cos(angle) * startRadius;
    g.y = cy + Math.sin(angle) * startRadius;
    token.addChild(g);

    particles.push({ g, angle, speed, radius: startRadius });
  }

  const start = performance.now();
  const ticker = () => {
    const elapsedMs = canvas.app.ticker.deltaMS;
    const t = (performance.now() - start) / duration;
    if (t >= 1) {
      for (const p of particles) if (!p.g.destroyed) p.g.destroy();
      canvas.app.ticker.remove(ticker);
      return;
    }
    const dir = direction === "inward" ? -1 : 1;
    for (const p of particles) {
      if (p.g.destroyed) continue;
      p.radius += dir * p.speed * elapsedMs;
      p.g.x = cx + Math.cos(p.angle) * p.radius;
      p.g.y = cy + Math.sin(p.angle) * p.radius;
      p.g.alpha = 1 - t;
    }
  };
  canvas.app.ticker.add(ticker);
}

/** Generates jagged bolt points via midpoint displacement */
function generateBoltPoints(x1, y1, x2, y2, displace, detail) {
  if (detail <= 0) return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
  const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * displace;
  const midY = (y1 + y2) / 2 + (Math.random() - 0.5) * displace;
  const left = generateBoltPoints(x1, y1, midX, midY, displace / 2, detail - 1);
  const right = generateBoltPoints(midX, midY, x2, y2, displace / 2, detail - 1);
  return [...left.slice(0, -1), ...right];
}

/** Jagged bolts converging on the token's center, coming from outside its area */
function lightningBolts(token, { color = 0xbfffff, glowColor = 0x3399ff, boltCount = 5, duration = 320 } = {}) {
  const cx = token.w / 2;
  const cy = token.h / 2;
  const reach = Math.max(token.w, token.h) * 1.7;
  const graphics = [];

  for (let i = 0; i < boltCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const startX = cx + Math.cos(angle) * reach;
    const startY = cy + Math.sin(angle) * reach - token.h * 0.5;
    const points = generateBoltPoints(startX, startY, cx, cy, 45, 5);

    const g = new PIXI.Graphics();
    // thicker, translucent "glow" layer underneath
    g.lineStyle(9, glowColor, 0.35);
    g.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) g.lineTo(p.x, p.y);
    // thin, bright core on top
    g.lineStyle(3, color, 1);
    g.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) g.lineTo(p.x, p.y);

    token.addChild(g);
    graphics.push(g);
  }

  pulseTint(token, { color: 0xffffff, duration: 150 });
  window.setTimeout(() => pulseTint(token, { color: 0xdff6ff, duration: 150 }), 160);
  window.setTimeout(() => {
    for (const g of graphics) if (!g.destroyed) g.destroy();
  }, duration);
}

/** Quick camera shake, felt across the whole screen */
function screenShake({ duration = 350, intensity = 12 } = {}) {
  if (!canvas?.stage) return;
  const stage = canvas.stage;
  const originalX = stage.pivot.x;
  const originalY = stage.pivot.y;
  const start = performance.now();

  const ticker = () => {
    const t = (performance.now() - start) / duration;
    if (t >= 1) {
      stage.pivot.set(originalX, originalY);
      canvas.app.ticker.remove(ticker);
      return;
    }
    const falloff = 1 - t;
    stage.pivot.set(
      originalX + (Math.random() - 0.5) * intensity * falloff,
      originalY + (Math.random() - 0.5) * intensity * falloff
    );
  };
  canvas.app.ticker.add(ticker);
}

/** Full-screen flash (DOM/CSS - the right tool for this) */
function screenFlash({ color = "#ffffff", opacity = 0.4, duration = 220 } = {}) {
  const el = document.createElement("div");
  Object.assign(el.style, {
    position: "fixed",
    inset: "0",
    background: color,
    opacity: String(opacity),
    pointerEvents: "none",
    zIndex: "9999",
    transition: `opacity ${duration}ms ease-out`,
  });
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = "0";
  });
  window.setTimeout(() => el.remove(), duration + 60);
}

/**
 * Public effects registry. `label` is what shows up in the UI selector.
 * `run(token)` fires the effect (fire-and-forget, cleans up after itself).
 */
export const EFFECTS = {
  none: {
    label: "None",
    run: () => {},
  },
  flash: {
    label: "Simple Flash",
    run: (token) => {
      pulseTint(token, { color: 0xffffff, duration: 200 });
      expandingRing(token, { color: 0xffffff, maxRadiusMult: 0.9 });
    },
  },
  blackExplosion: {
    label: "Black Explosion",
    run: (token) => {
      screenShake({ duration: 450, intensity: 14 });
      screenFlash({ color: "#160022", opacity: 0.55, duration: 260 });
      pulseTint(token, { color: 0x110022, duration: 320 });
      spawnParticles(token, {
        count: 70,
        colors: [0x000000, 0x1a0033, 0x330033, 0x550066],
        minSpeed: 180,
        maxSpeed: 420,
        minSize: 4,
        maxSize: 12,
        duration: 1100,
        direction: "outward",
        maxRadiusMult: 2.6,
      });
      shockwaveBurst(token, { color: 0x330033, layers: 3, thickness: 8, maxRadiusMult: 2.2, duration: 850 });
    },
  },
  lightning: {
    label: "Lightning Strike",
    run: (token) => {
      screenShake({ duration: 350, intensity: 16 });
      screenFlash({ color: "#eaffff", opacity: 0.55, duration: 160 });
      window.setTimeout(() => screenFlash({ color: "#ffffff", opacity: 0.3, duration: 130 }), 170);
      lightningBolts(token, { color: 0xbfffff, glowColor: 0x3399ff, boltCount: 6, duration: 340 });
      shockwaveBurst(token, { color: 0xaaeeff, layers: 2, thickness: 4, maxRadiusMult: 1.8, duration: 500, stagger: 60 });
    },
  },
  fireBurst: {
    label: "Fire Burst",
    run: (token) => {
      screenShake({ duration: 400, intensity: 12 });
      screenFlash({ color: "#5a1a00", opacity: 0.5, duration: 220 });
      pulseTint(token, { color: 0xff6600, duration: 260 });
      spawnParticles(token, {
        count: 60,
        colors: [0xff4400, 0xff8800, 0xffcc00, 0x881100],
        minSpeed: 120,
        maxSpeed: 320,
        minSize: 3,
        maxSize: 9,
        duration: 950,
        direction: "outward",
        maxRadiusMult: 2.2,
      });
      shockwaveBurst(token, { color: 0xff7700, layers: 2, thickness: 6, maxRadiusMult: 2, duration: 650 });
    },
  },
  voidImplosion: {
    label: "Void Implosion",
    run: (token) => {
      spawnParticles(token, {
        count: 45,
        colors: [0x220044, 0x000000, 0x440066],
        minSpeed: 200,
        maxSpeed: 420,
        minSize: 3,
        maxSize: 8,
        duration: 480,
        direction: "inward",
        maxRadiusMult: 2.4,
      });
      window.setTimeout(() => {
        screenShake({ duration: 400, intensity: 14 });
        screenFlash({ color: "#0a0014", opacity: 0.6, duration: 240 });
        pulseTint(token, { color: 0x000000, duration: 220 });
        spawnParticles(token, {
          count: 40,
          colors: [0x9900ff, 0x220044, 0x000000],
          minSpeed: 150,
          maxSpeed: 350,
          minSize: 3,
          maxSize: 9,
          duration: 800,
          direction: "outward",
          maxRadiusMult: 2.2,
        });
        shockwaveBurst(token, { color: 0x9900ff, layers: 3, thickness: 7, maxRadiusMult: 2.4, duration: 750 });
      }, 460);
    },
  },
  holyLight: {
    label: "Holy Light",
    run: (token) => {
      screenFlash({ color: "#fff3cf", opacity: 0.45, duration: 260 });
      pulseTint(token, { color: 0xfff4cc, duration: 320 });
      spawnParticles(token, {
        count: 45,
        colors: [0xffe680, 0xffffff, 0xffd24d],
        minSpeed: 60,
        maxSpeed: 160,
        minSize: 2,
        maxSize: 6,
        duration: 1200,
        direction: "outward",
        maxRadiusMult: 1.8,
      });
      shockwaveBurst(token, { color: 0xffe680, layers: 3, thickness: 5, maxRadiusMult: 2, duration: 900, stagger: 110 });
    },
  },
};

export function playEffect(token, key) {
  if (!token?.mesh || !canvas.ready) return;
  const effect = EFFECTS[key] ?? EFFECTS.flash;
  effect.run(token);
}
