/**
 * Shared Verlet string-cloth engine used by the full experience (script.js),
 * the carousel/contributions cloths, and the standalone China stage.
 * Kept in one place so behaviour can't drift between copies.
 *
 * Tuning constants come from ./constants.js (single source of truth).
 *
 * Configuration is passed per instance:
 *  - `config`  supplies live physics values (gravity, damping, mouse size /
 *    strength, grid columns and clamp factors). The main app passes its
 *    CONFIG object so Tweakpane sliders apply live; standalone stages pass a
 *    fixed object.
 *  - `isPaneEvent` (Input) — optional guard so pointer events on the "Play"
 *    panel don't yank the cloth. Defaults to "not a pane event".
 *  - `onStrike`   (Input) — called with the chime options when a particle is
 *    grabbed / brushed, or with `null` when the pointer leaves the chime ring.
 */
import * as K from "./modules/constants.js";

export function sizeCanvas(canvas, cssW, cssH, dpr) {
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  // Display size is controlled by CSS (width/height: 100% in style.css).
  // Do NOT set inline style.width/height — it overrides the stylesheet
  // and forces !important to compensate.
}

export class Vec2 {
  constructor(x = 0, y = 0) {
    this.reset(x, y);
  }
  zero() {
    this.reset(0, 0);
  }
  reset(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  clone() {
    return new Vec2(this.x, this.y);
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }
  subtract(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }
  subtractNew(v) {
    return this.clone().subtract(v);
  }
  scale(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }
  get lengthSquared() {
    return this.x ** 2 + this.y ** 2;
  }
  get length() {
    return Math.hypot(this.x, this.y);
  }
  get angle() {
    return Math.atan2(this.y, this.x);
  }
  [Symbol.iterator]() {
    const values = [this.x, this.y];
    let i = 0;
    return {
      next() {
        if (i < values.length) return { value: values[i++], done: false };
        return { done: true };
      }
    };
  }
}

export class Particle {
  constructor({ x, y, pinned, id, char, config } = {}) {
    this.pos = new Vec2(x, y);
    this.oldPos = new Vec2(x, y);
    this.velocity = new Vec2();
    this.acceleration = new Vec2();
    this.pinned = pinned;
    this.id = id;
    this.char = char;
    this.gravityVec = new Vec2();
    this.config = config;
  }
  contain() {
    if (this.pinned) return;
    const config = this.config;
    const radius = K.CONTAIN_BOUND_RADIUS;
    const restitution = K.CONTAIN_EDGE_RESTITUTION;
    if (this.pos.x < radius) {
      this.pos.x = radius;
      this.oldPos.x =
        this.pos.x + Math.abs(this.oldPos.x - this.pos.x) * restitution;
    } else if (this.pos.x > config.width - radius) {
      this.pos.x = config.width - radius;
      this.oldPos.x =
        this.pos.x - Math.abs(this.oldPos.x - this.pos.x) * restitution;
    }
    if (this.pos.y < radius) {
      this.pos.y = radius;
      this.oldPos.y =
        this.pos.y + Math.abs(this.oldPos.y - this.pos.y) * restitution;
    } else if (this.pos.y > config.height - radius) {
      this.pos.y = config.height - radius;
      this.oldPos.y =
        this.pos.y - Math.abs(this.oldPos.y - this.pos.y) * restitution;
    }
  }
  update(delta) {
    if (this.pinned) {
      this.acceleration.zero();
      return;
    }
    const config = this.config;
    this.velocity.reset(
      (this.pos.x - this.oldPos.x) * config.damping,
      (this.pos.y - this.oldPos.y) * config.damping
    );
    this.oldPos.reset(...this.pos);
    const dd = delta ** 2;
    this.gravityVec.reset(0, config.gravity / dd);
    this.applyForce(this.gravityVec);
    this.pos.x += this.velocity.x + this.acceleration.x * dd;
    this.pos.y += this.velocity.y + this.acceleration.y * dd;
    this.acceleration.reset();
  }
  applyForce(v) {
    this.acceleration.add(v);
  }
}

export class Constraint {
  constructor({
    p1,
    p2,
    length,
    id,
    compressFactor,
    stretchFactor,
    isSpacer = false,
    config = null
  }) {
    this.p1 = p1;
    this.p2 = p2;
    this.length = length;
    this.id = id;
    this.isSpacer = isSpacer;
    this.config = config;
    this.compressFactor = compressFactor;
    this.stretchFactor = stretchFactor;
    // Spacers hold a rigid clamp at construction; vertical strands track
    // config.compressFactor / stretchFactor live.
    this.minLength = this.isSpacer ? length * compressFactor : 0;
    this.maxLength = this.isSpacer ? length * stretchFactor : 0;
  }
  solve() {
    const dx = this.p2.pos.x - this.p1.pos.x;
    const dy = this.p2.pos.y - this.p1.pos.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) return;

    let targetLength = this.length;
    if (this.isSpacer) {
      if (distance < this.minLength) targetLength = this.minLength;
      else if (distance > this.maxLength) targetLength = this.maxLength;
      else return;
    } else {
      const config = this.config || {
        compressFactor: this.compressFactor,
        stretchFactor: this.stretchFactor
      };
      const minLength = this.length * config.compressFactor;
      const maxLength = this.length * config.stretchFactor;
      if (distance < minLength) targetLength = minLength;
      else if (distance > maxLength) targetLength = maxLength;
      else return;
    }

    const percent = (targetLength - distance) / distance / 2;
    const offsetX = dx * percent;
    const offsetY = dy * percent;

    if (!this.p1.pinned) {
      this.p1.pos.x -= offsetX;
      this.p1.pos.y -= offsetY;
    }
    if (!this.p2.pinned) {
      this.p2.pos.x += offsetX;
      this.p2.pos.y += offsetY;
    }
  }
}

export class Input {
  constructor({
    c,
    particles,
    originX,
    originY,
    canvasW,
    canvasH,
    config,
    isPaneEvent = () => false,
    onStrike = () => {}
  }) {
    this.c = c;
    this.particles = particles;
    this.originX = originX;
    this.originY = originY;
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.config = config;
    this.isPaneEvent = isPaneEvent;
    this.onStrike = onStrike;
    this.mousePos = new Vec2();
    this.grabRadius = K.GRAB_RADIUS;
    this.chimeRadiusSq = K.CHIME_RADIUS_SQ;
    this.bind();
  }
  localPoint(e) {
    const rect = this.c.getBoundingClientRect();
    return {
      x:
        ((e.clientX - rect.left) / rect.width) * this.canvasW - this.originX,
      y:
        ((e.clientY - rect.top) / rect.height) * this.canvasH - this.originY
    };
  }
  pointerdown(e) {
    if (this.isPaneEvent(e)) return;
    const { x, y } = this.localPoint(e);
    this.mousePos.reset(x, y);
    for (const p of this.particles) {
      if (this.mousePos.subtractNew(p.pos).length < this.grabRadius) {
        this.grabbedParticle = p;
        this.grabbedParticle.originalPinnedState = this.grabbedParticle.pinned;
        this.grabbedParticle.pinned = true;
        this.onStrike({
          x,
          y,
          particle: p,
          gridW: this.config.gridW,
          intensity: K.STRIKE_POP_INTENSITY,
          force: true
        });
        break;
      }
    }
  }
  pointerup(e) {
    if (this.isPaneEvent(e) && !this.grabbedParticle) return;
    if (this.grabbedParticle) {
      this.grabbedParticle.pinned = this.grabbedParticle.originalPinnedState;
      this.grabbedParticle = null;
    }
  }
  pointermove(e) {
    if (this.isPaneEvent(e) && !this.grabbedParticle) return;
    const { x, y } = this.localPoint(e);
    this.mousePos.reset(x, y);

    if (this.grabbedParticle) {
      this.grabbedParticle.pos.reset(x, y);
      this.grabbedParticle.oldPos.reset(x, y);
    }

    const config = this.config;
    let nearest = null;
    let nearestLs = Infinity;

    for (const p of this.particles) {
      const diff = this.mousePos.subtractNew(p.pos);
      const ls = diff.lengthSquared;
      if (ls < config.mouseSize) {
        const a = diff.angle - Math.PI;
        const strength =
          (smoothstep(config.mouseSize, K.MOUSE_SMOOTH_END, ls) *
            config.mouseStrength) /
          K.MOUSE_FORCE_DIVISOR;
        p.applyForce(new Vec2(Math.cos(a) * strength, Math.sin(a) * strength));
      }
      if (ls < this.chimeRadiusSq && ls < nearestLs) {
        nearest = p;
        nearestLs = ls;
      }
    }

    if (nearest) {
      const closeness = 1 - nearestLs / this.chimeRadiusSq;
      this.onStrike({
        x,
        y,
        particle: nearest,
        gridW: config.gridW,
        intensity:
          K.CHIME_CLOSENESS_MIN + closeness * K.CHIME_CLOSENESS_SPAN
      });
    } else {
      this.onStrike(null);
    }
  }
  contextmenu(e) {
    e.preventDefault();
  }
  bind() {
    this.pointerdown = this.pointerdown.bind(this);
    this.pointerup = this.pointerup.bind(this);
    this.pointermove = this.pointermove.bind(this);
    this.contextmenu = this.contextmenu.bind(this);
    document.addEventListener("pointerdown", this.pointerdown);
    document.addEventListener("pointerup", this.pointerup);
    document.addEventListener("pointermove", this.pointermove);
    document.addEventListener("contextmenu", this.contextmenu);
  }
  unbind() {
    document.removeEventListener("pointerdown", this.pointerdown);
    document.removeEventListener("pointerup", this.pointerup);
    document.removeEventListener("pointermove", this.pointermove);
    document.removeEventListener("contextmenu", this.contextmenu);
  }
}

// smoothstep lives here (used by Input) and is re-exported for the callers.
import { smoothstep } from "./utils.js";
export { smoothstep };