/**
 * Verlet cloth engine — single shared implementation for the home stage,
 * the destinations carousel, the contributions curtain, and the dev
 * stage-strings demo. All four formerly carried their own copy; every
 * behavioral difference between them (settle preamble, solve passes,
 * input mode, padding, chimes) is now a parameter.
 */

import { charForCell } from "./countries.js";
import { smoothstep } from "./utils.js";

export const CHAR_PAD = 420; // canvas pad around the grid so sway isn't clipped
export const CHAR_PAD_CONTRIB = 56; // narrower pad for the contributions stage

const SPACER_COMPRESS = 0.6;
const SPACER_STRETCH = 4;
const INK = "#2a2620";
const PARTICLE_RADIUS = 4;
const GLYPH_SCALE = 1.35;
const CHIME_RADIUS = 55;

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

class Particle {
  constructor({ x, y, pinned, id, char } = {}) {
    this.pos = new Vec2(x, y);
    this.oldPos = new Vec2(x, y);
    this.velocity = new Vec2();
    this.acceleration = new Vec2();
    this.pinned = pinned;
    this.id = id;
    this.char = char;
    this.gravityVec = new Vec2();
  }
  contain(limitW, limitH) {
    if (this.pinned) return;
    const radius = PARTICLE_RADIUS;
    if (this.pos.x < radius) {
      this.pos.x = radius;
      this.oldPos.x = this.pos.x + Math.abs(this.oldPos.x - this.pos.x) * 0.8;
    } else if (this.pos.x > limitW - radius) {
      this.pos.x = limitW - radius;
      this.oldPos.x = this.pos.x - Math.abs(this.oldPos.x - this.pos.x) * 0.8;
    }
    if (this.pos.y < radius) {
      this.pos.y = radius;
      this.oldPos.y = this.pos.y + Math.abs(this.oldPos.y - this.pos.y) * 0.8;
    } else if (this.pos.y > limitH - radius) {
      this.pos.y = limitH - radius;
      this.oldPos.y = this.pos.y - Math.abs(this.oldPos.y - this.pos.y) * 0.8;
    }
  }
  update(delta, gravity, damping) {
    if (this.pinned) {
      this.acceleration.zero();
      return;
    }
    this.velocity.reset(
      (this.pos.x - this.oldPos.x) * damping,
      (this.pos.y - this.oldPos.y) * damping
    );
    this.oldPos.reset(...this.pos);
    const dd = delta ** 2;
    this.gravityVec.reset(0, gravity / dd);
    this.applyForce(this.gravityVec);
    this.pos.x += this.velocity.x + this.acceleration.x * dd;
    this.pos.y += this.velocity.y + this.acceleration.y * dd;
    this.acceleration.reset();
  }
  applyForce(v) {
    this.acceleration.add(v);
  }
}

class Constraint {
  constructor({ p1, p2, length, compressFactor, stretchFactor, isSpacer = false }) {
    this.p1 = p1;
    this.p2 = p2;
    this.length = length;
    this.isSpacer = isSpacer;
    this.compressFactor = compressFactor;
    this.stretchFactor = stretchFactor;
    this.minLength = length * compressFactor;
    this.maxLength = length * stretchFactor;
  }
  /** Tweakpane "Motion & sound" sliders retarget every vertical constraint. */
  retarget(length, compressFactor, stretchFactor) {
    this.length = length;
    this.compressFactor = compressFactor;
    this.stretchFactor = stretchFactor;
    this.minLength = length * compressFactor;
    this.maxLength = length * stretchFactor;
  }
  solve() {
    const dx = this.p2.pos.x - this.p1.pos.x;
    const dy = this.p2.pos.y - this.p1.pos.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) return;

    let targetLength = this.length;
    if (distance < this.minLength) targetLength = this.minLength;
    else if (distance > this.maxLength) targetLength = this.maxLength;
    else return;

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

/**
 * Draw every particle's glyph, rotated by its vertical constraint angle.
 * @param {*} ctx
 * @param {Particle[]} particles
 * @param {HTMLCanvasElement[]} glyphs map char → offscreen canvas
 * @param {number} originX
 * @param {number} originY
 * @param {number} dpr
 */
function drawCode(ctx, particles, glyphs, originX, originY, dpr) {
  for (const p of particles) {
    if (!p.char || p.char === " " || p.char === "　") continue;
    const img = glyphs[p.char];
    if (!img) continue;

    let cos = 1;
    let sin = 0;
    const constraint = p.downConstraint;
    if (constraint) {
      const dx = constraint.p2.pos.x - constraint.p1.pos.x;
      const dy = constraint.p2.pos.y - constraint.p1.pos.y;
      const angle = Math.atan2(dy, dx) - Math.PI / 2;
      cos = Math.cos(angle);
      sin = Math.sin(angle);
    }

    const size = img._size;
    const half = size / 2;
    const x = p.pos.x + originX;
    const y = p.pos.y + originY;
    ctx.setTransform(
      cos * dpr,
      sin * dpr,
      -sin * dpr,
      cos * dpr,
      x * dpr,
      y * dpr
    );
    ctx.drawImage(img, -half, -half, size, size);
  }
}

function sizeCanvas(canvas, cssW, cssH, dpr) {
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
}

/**
 * Build a cloth.
 *
 * @param {object} o
 * @param {HTMLElement} o.host            parent to append the canvas to
 * @param {string}  o.text                glyph source (a country's cloth string)
 * @param {string}  [o.writing="horizontal"]
 * @param {number}  o.width  o.height     logical grid box (CSS px)
 * @param {number}  o.gridW  o.gridH      grid columns × rows
 * @param {number}  o.pad                 canvas padding around the grid
 * @param {number}  o.fontSize
 * @param {string}  o.font                CSS font stack for glyphs
 * @param {number}  o.dpr
 * @param {number}  [o.gravity=0.2]  [o.damping=0.99]
 * @param {number}  [o.iterations=5]      constraint solves per frame
 * @param {number}  [o.compressFactor=0.02] [o.stretchFactor=1.1]
 * @param {boolean} [o.contain=false]
 * @param {number}  [o.mouseSize=5000] [o.mouseStrength=4]
 * @param {string}  o.mode   'interact' (document pointer listeners + grab + chime,
 *                           used by the home stage and stage-strings demo) or
 *                           'simulate' (caller drives brush() — carousel, contributions)
 * @param {number}  [o.settleFrames=0]    pre-settle frames before first paint
 * @param {(p:{x:number,y:number,particle:Particle,gridW:number,intensity:number,force:boolean})=>void} [o.onChime]
 * @param {()=>void} [o.onPointerGuard]   optional guard for interact mode (isPaneEvent)
 * @returns {{
 *   canvas: HTMLCanvasElement,
 *   tick:(dt:number)=>void,
 *   brush:(cx:number,cy:number,opts?:{chime?:boolean})=>void,
 *   containsPoint:(cx:number,cy:number)=>boolean,
 *   setActive:(v:boolean)=>void,
 *   setPhysics:(p:{compressFactor:number,stretchFactor:number})=>void,
 *   destroy:()=>void
 * }}
 */
export function createCloth(o) {
  const {
    host, text, writing = "horizontal",
    width, height, gridW, gridH, pad,
    fontSize, font, dpr,
    gravity = 0.2, damping = 0.99, iterations = 5,
    compressFactor = 0.02, stretchFactor = 1.1,
    contain = false, mouseSize = 5000, mouseStrength = 4,
    mode = "simulate", settleFrames = 0,
    onChime, onPointerGuard
  } = o;

  const cellWidth = width / Math.max(1, gridW - 1);
  const cellHeight = height / Math.max(1, gridH - 1);
  // Grid origin in canvas space — callers pick the layout (centered vs padded).
  const originX = o.originX ?? pad;
  const originY = o.originY ?? pad + Math.ceil(fontSize * 0.7);
  const canvasW = width + pad * 2;
  const canvasH = height + pad * 2;

  // Pre-render each unique glyph once (char → offscreen canvas).
  const glyphs = {};
  for (const ch of new Set(text)) {
    if (ch === " " || ch === "　") continue;
    const size = Math.ceil(fontSize * GLYPH_SCALE);
    const off = document.createElement("canvas");
    off.width = Math.ceil(size * dpr);
    off.height = Math.ceil(size * dpr);
    off._size = size;
    const octx = off.getContext("2d");
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.font = `${fontSize}px ${font}`;
    octx.textAlign = "center";
    octx.textBaseline = "middle";
    octx.fillStyle = INK;
    octx.fillText(ch, size / 2, size / 2);
    glyphs[ch] = off;
  }

  // Build the Verlet grid. Row 0 is pinned to the top edge (the "curtain rod").
  const particles = [];
  const constraints = [];
  for (let i = 0; i < gridW; i++) {
    for (let j = 0; j < gridH; j++) {
      const x = i * cellWidth;
      const y = j * cellHeight;
      const pinned = j === 0;
      const char = charForCell(text, i, j, gridW, gridH, writing);
      particles.push(new Particle({ x, y, pinned, id: i * gridH + j, char }));
    }
  }
  for (let i = 0; i < gridW; i++) {
    for (let j = 0; j < gridH; j++) {
      const p = particles[i * gridH + j];
      if (j < gridH - 1) {
        const bottom = particles[i * gridH + (j + 1)];
        const c = new Constraint({
          p1: p, p2: bottom,
          length: cellHeight,
          compressFactor, stretchFactor
        });
        constraints.push(c);
        p.downConstraint = c;
      }
      if (i < gridW - 1) {
        constraints.push(
          new Constraint({
            p1: p, p2: particles[(i + 1) * gridH + j],
            length: cellWidth,
            compressFactor: SPACER_COMPRESS,
            stretchFactor: SPACER_STRETCH,
            isSpacer: true
          })
        );
      }
    }
  }

  // Pre-settle so cloths hang before first paint (carousel/contributions).
  for (let f = 0; f < settleFrames; f++) {
    particles.forEach((p) => p.update(16, gravity, damping));
    for (let k = 0; k < iterations; k++) {
      for (const c of constraints) c.solve();
    }
  }

  const canvas = document.createElement("canvas");
  sizeCanvas(canvas, canvasW, canvasH, dpr);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  host.innerHTML = "";
  host.appendChild(canvas);

  const mousePosition = new Vec2();
  const chimeRadiusSq = CHIME_RADIUS * CHIME_RADIUS;
  let active = true;
  let destroyed = false;
  let verticalConstraints = null; // lazily collected for setPhysics()

  function draw() {
    if (destroyed) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvasW, canvasH);
    drawCode(ctx, particles, glyphs, originX, originY, dpr);
  }

  function step(dt) {
    particles.forEach((p) => p.update(dt, gravity, damping));
    for (let k = 0; k < iterations; k++) {
      for (const c of constraints) c.solve();
    }
    if (contain) particles.forEach((p) => p.contain(width, height));
  }

  function tick(dt) {
    if (!active || destroyed) return;
    step(dt);
    draw();
  }

  function localPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * canvasW - originX,
      y: ((clientY - rect.top) / rect.height) * canvasH - originY
    };
  }

  function forceFor(particle) {
    const diff = mousePosition.subtractNew(particle.pos);
    const ls = diff.lengthSquared;
    if (ls >= mouseSize) return null;
    const a = diff.angle - Math.PI;
    const strength = (smoothstep(mouseSize, -2000, ls) * mouseStrength) / 300;
    return new Vec2(Math.cos(a) * strength, Math.sin(a) * strength);
  }

  function brush(clientX, clientY, { chime = true } = {}) {
    if (!active || destroyed) return;
    const pt = localPoint(clientX, clientY);
    if (!pt) return;
    mousePosition.reset(pt.x, pt.y);

    let nearest = null;
    let nearestLs = Infinity;
    for (const p of particles) {
      const f = forceFor(p);
      if (f) p.applyForce(f);
      if (chime && onChime) {
        const ls = mousePosition.subtractNew(p.pos).lengthSquared;
        if (ls < chimeRadiusSq && ls < nearestLs) {
          nearest = p;
          nearestLs = ls;
        }
      }
    }
    if (chime && onChime && nearest) {
      onChime({
        x: pt.x,
        y: pt.y,
        particle: nearest,
        gridW,
        intensity: 0.2 + (1 - nearestLs / chimeRadiusSq) * 0.7
      });
    }
  }

  function containsPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }

  function collectVerticalConstraints() {
    if (!verticalConstraints) {
      verticalConstraints = constraints.filter((c) => !c.isSpacer);
    }
    return verticalConstraints;
  }

  function setPhysics({ compressFactor: cf, stretchFactor: sf }) {
    for (const c of collectVerticalConstraints()) {
      c.retarget(c.length, cf, sf);
    }
  }

  function destroy() {
    destroyed = true;
    if (input) input.unbind();
    canvas.removeEventListener("pointermove", onPointerMove);
    host.innerHTML = "";
  }

  // ─── interact mode: document-level pointer listeners + grab + chime ───
  let input = null;
  let grabbedParticle = null;

  const onPointerDown = (e) => {
    if (onPointerGuard?.(e)) return;
    const pt = localPoint(e.clientX, e.clientY);
    if (!pt) return;
    mousePosition.reset(pt.x, pt.y);
    for (const p of particles) {
      if (mousePosition.subtractNew(p.pos).length < 24) {
        grabbedParticle = p;
        grabbedParticle.originalPinnedState = grabbedParticle.pinned;
        grabbedParticle.pinned = true;
        onChime?.({
          x: pt.x,
          y: pt.y,
          particle: p,
          gridW,
          intensity: 0.85,
          force: true
        });
        break;
      }
    }
  };
  const onPointerUp = (e) => {
    if (onPointerGuard?.(e) && !grabbedParticle) return;
    if (grabbedParticle) {
      grabbedParticle.pinned = grabbedParticle.originalPinnedState;
      grabbedParticle = null;
    }
  };
  const onPointerMove = (e) => {
    if (onPointerGuard?.(e) && !grabbedParticle) return;
    const pt = localPoint(e.clientX, e.clientY);
    if (!pt) return;
    mousePosition.reset(pt.x, pt.y);

    if (grabbedParticle) {
      grabbedParticle.pos.reset(pt.x, pt.y);
      grabbedParticle.oldPos.reset(pt.x, pt.y);
    }

    let nearest = null;
    let nearestLs = Infinity;
    for (const p of particles) {
      const f = forceFor(p);
      if (f) p.applyForce(f);
      if (onChime) {
        const ls = mousePosition.subtractNew(p.pos).lengthSquared;
        if (ls < chimeRadiusSq && ls < nearestLs) {
          nearest = p;
          nearestLs = ls;
        }
      }
    }
    if (onChime && nearest) {
      onChime({
        x: pt.x,
        y: pt.y,
        particle: nearest,
        gridW,
        intensity: 0.2 + (1 - nearestLs / chimeRadiusSq) * 0.7
      });
    } else if (onChime) {
      onChime({ x: pt.x, y: pt.y, reset: true });
    }
  };

  const onContextMenu = (e) => e.preventDefault();

  if (mode === "interact") {
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("contextmenu", onContextMenu);
    input = { unbind() {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("contextmenu", onContextMenu);
    } };
  } else {
    canvas.addEventListener("pointermove", onPointerMove);
  }

  draw();
  return {
    canvas,
    tick,
    brush,
    containsPoint,
    setActive(v) { active = v; },
    setPhysics,
    destroy
  };
}
