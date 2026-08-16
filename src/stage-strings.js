/**
 * Stage 02 — China cloth only (no country switchers, carousel, or Tweakpane).
 * Physics primitives live in physics.js; this file only wires the stand-alone
 * country as a still-pinned cloth that reacts to the pointer + chimes.
 */
import * as K from "./modules/constants.js";
import { getPointID } from "./utils.js";
import { COUNTRIES, DEFAULT_COUNTRY, charForCell } from "./countries.js";
import { chimes } from "./chimes.js";
import {
  Vec2,
  Particle,
  Constraint,
  Input,
  sizeCanvas
} from "./physics.js";

const AREA_W = K.AREA_W;
const AREA_H = K.AREA_H;
const STRINGS_PAD = K.STRINGS_PAD;
const DEFAULT_GRID_W = K.DEFAULT_GRID_W;
const DEFAULT_GRID_H = K.DEFAULT_GRID_H;

const country = COUNTRIES[DEFAULT_COUNTRY] || COUNTRIES.china;

const CONFIG = {
  ...K.DEFAULT_PHYSICS,
  width: AREA_W,
  height: AREA_H,
  gridW: country.gridW ?? DEFAULT_GRID_W,
  gridH: country.gridH ?? DEFAULT_GRID_H,
  contain: false
};

const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

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
  const fontSize = Math.max(
    K.FONT_SIZE_MIN,
    Math.min(K.FONT_SIZE_MAX, cellHeight * K.CELL_TO_FONT_FACTOR)
  );
  const roofClearance = Math.ceil(fontSize * K.ROOF_OFFSET_FACTOR);
  const originX = pad + (AREA_W - width) / 2;
  const originY = pad + roofClearance;

  const fullCode = country.cloth;
  const writing = country.writing || "horizontal";
  const charCanvases = {};
  for (const ch of new Set(fullCode)) {
    if (ch === " " || ch === "　") continue;
    const size = Math.ceil(fontSize * K.CHAR_FACTOR);
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
  sizeCanvas(c, canvasW, canvasH, dpr);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const particles = [];
  const constraints = [];
  // eslint-disable-next-line no-new
  new Input({
    c,
    particles,
    originX,
    originY,
    canvasW,
    canvasH,
    config: CONFIG,
    onStrike: (opts) => {
      if (opts) chimes.strike(opts);
      else chimes.lastParticleId = -1;
    }
  });

  for (let i = 0; i < gridW; i++) {
    for (let j = 0; j < gridH; j++) {
      const x = i * cellWidth;
      const y = j * cellHeight;
      const id = getPointID(j, i, gridH);
      const pinned = j === 0;
      const char = charForCell(fullCode, i, j, gridW, gridH, writing);
      particles.push(new Particle({ x, y, pinned, id, char, config: CONFIG }));
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
          stretchFactor,
          config: CONFIG
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
            compressFactor: K.SPACER_COMPRESS_FACTOR,
            stretchFactor: K.SPACER_STRETCH_FACTOR,
            isSpacer: true,
            config: CONFIG
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
    const dt = Math.min(K.DT_MAX, Math.max(K.DT_MIN, delta - lastDelta));
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