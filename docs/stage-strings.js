/**
 * Stage 02 — China cloth only (no country switchers, carousel, or Tweakpane).
 */
import { getPointID, smoothstep } from "./utils.js";
import { COUNTRIES, DEFAULT_COUNTRY, charForCell } from "./countries.js";
import { chimes } from "./chimes.js";

const AREA_W = 492;
const AREA_H = 468;
const STRINGS_PAD = 420;
const DEFAULT_GRID_W = 36;
const DEFAULT_GRID_H = 40;

const country = COUNTRIES[DEFAULT_COUNTRY] || COUNTRIES.china;

const CONFIG = {
  width: AREA_W,
  height: AREA_H,
  gridW: country.gridW ?? DEFAULT_GRID_W,
  gridH: country.gridH ?? DEFAULT_GRID_H,
  gravity: 0.2,
  damping: 0.99,
  iterationsPerFrame: 5,
  compressFactor: 0.02,
  stretchFactor: 1.1,
  mouseSize: 5000,
  mouseStrength: 4,
  contain: false
};

const dpr = Math.min(2, window.devicePixelRatio || 1);

function sizeCanvas(canvas, cssW, cssH) {
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
}

class Vec2 {
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
  contain() {
    if (this.pinned) return;
    const radius = 4;
    if (this.pos.x < radius) {
      this.pos.x = radius;
      this.oldPos.x = this.pos.x + Math.abs(this.oldPos.x - this.pos.x) * 0.8;
    } else if (this.pos.x > CONFIG.width - radius) {
      this.pos.x = CONFIG.width - radius;
      this.oldPos.x = this.pos.x - Math.abs(this.oldPos.x - this.pos.x) * 0.8;
    }
    if (this.pos.y < radius) {
      this.pos.y = radius;
      this.oldPos.y = this.pos.y + Math.abs(this.oldPos.y - this.pos.y) * 0.8;
    } else if (this.pos.y > CONFIG.height - radius) {
      this.pos.y = CONFIG.height - radius;
      this.oldPos.y = this.pos.y - Math.abs(this.oldPos.y - this.pos.y) * 0.8;
    }
  }
  update(delta) {
    if (this.pinned) {
      this.acceleration.zero();
      return;
    }
    this.velocity.reset(
      (this.pos.x - this.oldPos.x) * CONFIG.damping,
      (this.pos.y - this.oldPos.y) * CONFIG.damping
    );
    this.oldPos.reset(...this.pos);
    const dd = delta ** 2;
    this.gravityVec.reset(0, CONFIG.gravity / dd);
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
  constructor({
    p1,
    p2,
    length,
    id,
    compressFactor,
    stretchFactor,
    isSpacer = false
  }) {
    this.p1 = p1;
    this.p2 = p2;
    this.length = length;
    this.id = id;
    this.compressFactor = compressFactor;
    this.stretchFactor = stretchFactor;
    this.isSpacer = isSpacer;
    this.minLength = length * compressFactor;
    this.maxLength = length * stretchFactor;
  }
  solve() {
    const dx = this.p2.pos.x - this.p1.pos.x;
    const dy = this.p2.pos.y - this.p1.pos.y;
    const distance = Math.hypot(dx, dy) || 0.0001;
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

class Input {
  constructor({ c, particles, originX, originY, canvasW, canvasH }) {
    this.c = c;
    this.particles = particles;
    this.originX = originX;
    this.originY = originY;
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.mousePos = new Vec2();
    this.grabRadius = 24;
    this.chimeRadiusSq = 55 * 55;
    this.bind();
  }
  localPoint(e) {
    const rect = this.c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * this.canvasW - this.originX,
      y: ((e.clientY - rect.top) / rect.height) * this.canvasH - this.originY
    };
  }
  pointerdown(e) {
    const { x, y } = this.localPoint(e);
    this.mousePos.reset(x, y);
    for (const p of this.particles) {
      if (this.mousePos.subtractNew(p.pos).length < this.grabRadius) {
        this.grabbedParticle = p;
        this.grabbedParticle.originalPinnedState = this.grabbedParticle.pinned;
        this.grabbedParticle.pinned = true;
        chimes.strike({
          x,
          y,
          particle: p,
          gridW: CONFIG.gridW,
          intensity: 0.85,
          force: true
        });
        break;
      }
    }
  }
  pointerup() {
    if (this.grabbedParticle) {
      this.grabbedParticle.pinned = this.grabbedParticle.originalPinnedState;
      this.grabbedParticle = null;
    }
  }
  pointermove(e) {
    const { x, y } = this.localPoint(e);
    this.mousePos.reset(x, y);

    if (this.grabbedParticle) {
      this.grabbedParticle.pos.reset(x, y);
      this.grabbedParticle.oldPos.reset(x, y);
    }

    let nearest = null;
    let nearestLs = Infinity;

    for (const p of this.particles) {
      const diff = this.mousePos.subtractNew(p.pos);
      const ls = diff.lengthSquared;
      if (ls < CONFIG.mouseSize) {
        const a = diff.angle - Math.PI;
        const strength =
          (smoothstep(CONFIG.mouseSize, -2000, ls) * CONFIG.mouseStrength) /
          300;
        p.applyForce(new Vec2(Math.cos(a) * strength, Math.sin(a) * strength));
      }
      if (ls < this.chimeRadiusSq && ls < nearestLs) {
        nearest = p;
        nearestLs = ls;
      }
    }

    if (nearest) {
      const closeness = 1 - nearestLs / this.chimeRadiusSq;
      chimes.strike({
        x,
        y,
        particle: nearest,
        gridW: CONFIG.gridW,
        intensity: 0.2 + closeness * 0.7
      });
    } else {
      chimes.lastParticleId = -1;
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
}

function main() {
  const width = CONFIG.width;
  const height = CONFIG.height;
  const { gridW, gridH, iterationsPerFrame, compressFactor, stretchFactor } =
    CONFIG;
  const cellWidth = width / (gridW - 1);
  const cellHeight = height / (gridH - 1);
  const root = document.getElementById("container");
  const pad = STRINGS_PAD;
  const canvasW = AREA_W + pad * 2;
  const canvasH = AREA_H + pad * 2;
  const fontSize = Math.max(9, Math.min(14, cellHeight * 0.95));
  const roofClearance = Math.ceil(fontSize * 0.7);
  const originX = pad + (AREA_W - width) / 2;
  const originY = pad + roofClearance;

  const fullCode = country.cloth;
  const writing = country.writing || "horizontal";
  const charCanvases = {};
  for (const ch of new Set(fullCode)) {
    if (ch === " " || ch === "　") continue;
    const size = Math.ceil(fontSize * 1.35);
    const off = document.createElement("canvas");
    off.width = Math.ceil(size * dpr);
    off.height = Math.ceil(size * dpr);
    off._size = size;
    const octx = off.getContext("2d");
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.font = `${fontSize}px ${
      country.font ||
      '"Songti SC", "STSong", "Noto Serif SC", "Hiragino Mincho ProN", serif'
    }`;
    octx.textAlign = "center";
    octx.textBaseline = "middle";
    octx.fillStyle = "#2a2620";
    octx.fillText(ch, size / 2, size / 2);
    charCanvases[ch] = off;
  }

  const c = document.createElement("canvas");
  root.innerHTML = "";
  root.appendChild(c);
  sizeCanvas(c, canvasW, canvasH);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const particles = [];
  const constraints = [];
  // eslint-disable-next-line no-new
  new Input({ c, particles, originX, originY, canvasW, canvasH });

  for (let i = 0; i < gridW; i++) {
    for (let j = 0; j < gridH; j++) {
      const x = i * cellWidth;
      const y = j * cellHeight;
      const id = getPointID(j, i, gridH);
      const pinned = j === 0;
      const char = charForCell(fullCode, i, j, gridW, gridH, writing);
      particles.push(new Particle({ x, y, pinned, id, char }));
    }
  }

  for (let i = 0; i < gridW; i++) {
    for (let j = 0; j < gridH; j++) {
      const id = getPointID(j, i, gridH);
      const p = particles[id];

      if (j < gridH - 1) {
        const bottomP = particles[getPointID(j + 1, i, gridH)];
        const constraint = new Constraint({
          p1: p,
          p2: bottomP,
          length: cellHeight,
          id: id + gridW * gridH,
          compressFactor,
          stretchFactor
        });
        constraints.push(constraint);
        p.downConstraint = constraint;
      }

      if (i < gridW - 1) {
        const rightP = particles[getPointID(j, i + 1, gridH)];
        constraints.push(
          new Constraint({
            p1: p,
            p2: rightP,
            length: cellWidth,
            id: id + gridW * gridH * 2,
            compressFactor: 0.6,
            stretchFactor: 4,
            isSpacer: true
          })
        );
      }
    }
  }

  function drawCode() {
    particles.forEach((p) => {
      if (!p.char || p.char === " " || p.char === "　") return;
      const img = charCanvases[p.char];
      if (!img) return;

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
    });
  }

  let lastDelta = performance.now();
  function runloop(delta) {
    requestAnimationFrame(runloop);
    const dt = Math.min(32, Math.max(1, delta - lastDelta));
    lastDelta = delta;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvasW, canvasH);

    particles.forEach((p) => p.update(dt));
    for (let i = 0; i < iterationsPerFrame; i++) {
      for (let j = 0; j < constraints.length; j++) constraints[j].solve();
    }
    if (CONFIG.contain) particles.forEach((p) => p.contain());

    drawCode();
  }

  requestAnimationFrame(runloop);
}

chimes.setCountry(country.id);
main();
