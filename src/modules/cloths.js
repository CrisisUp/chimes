/**
 * Dynamic cloth factories for the carousel destinations and the contributions
 * name cloth. Both share the cloth-common building blocks and the shared
 * CONFIG-style settings, differ in geometry/clime behaviour.
 */
import * as K from "./constants.js";
import { Vec2, sizeCanvas } from "../physics.js";
import { chimes } from "../chimes.js";
import { smoothstep } from "../utils.js";
import {
  SERIF_FONT,
  rasterizeChars,
  buildHangingGrid,
  clearAndDrawCloth,
  clothLocalPoint
} from "./cloth-common.js";

/** Common shape parameters for the carousel and contributions cloths. */
export const CLOTH_COMMON = {
  vCompress: K.VERTICAL_COMPRESS_FACTOR,
  vStretch: K.VERTICAL_STRETCH_FACTOR,
  iterations: K.SOLVE_ITERATIONS,
  preSettle: K.PRE_SETTLE_FRAMES,
  preSettleDt: K.PRE_SETTLE_DT,
  preSettleIterations: K.PRE_SETTLE_ITERATIONS
};

const DEFAULT_DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

/** Live cloth under a carousel roof — settles once, then reacts to hover. */
export function createCarouselCloth(host, country, config, dpr = DEFAULT_DPR) {
  if (!host || !country) return null;

  const gridW = country.gridW ?? K.DEFAULT_GRID_W;
  const gridH = country.gridH ?? K.DEFAULT_GRID_H;
  const width = K.AREA_W;
  const height = K.AREA_H;
  const cellWidth = width / (gridW - 1);
  const cellHeight = height / (gridH - 1);
  const pad = K.STRINGS_PAD;
  const canvasW = K.AREA_W + pad * 2;
  const canvasH = K.AREA_H + pad * 2;
  const fontSize = Math.max(
    K.FONT_SIZE_MIN,
    Math.min(K.FONT_SIZE_MAX, cellHeight * K.CELL_TO_FONT_FACTOR)
  );
  const roofClearance = Math.ceil(fontSize * K.ROOF_OFFSET_FACTOR);
  const originX = pad + (K.AREA_W - width) / 2;
  const originY = pad + roofClearance;
  const fullCode = country.cloth || "";
  const writing = country.writing || "horizontal";
  const font = country.font || SERIF_FONT;

  const charCanvases = rasterizeChars(fullCode, font, fontSize, dpr);

  const { particles, constraints } = buildHangingGrid({
    gridW,
    gridH,
    width,
    height,
    fullCode,
    writing,
    config,
    vCompress: CLOTH_COMMON.vCompress,
    vStretch: CLOTH_COMMON.vStretch
  });

  // Pre-settle so cloths hang before first paint
  for (let f = 0; f < CLOTH_COMMON.preSettle; f++) {
    particles.forEach((p) => p.update(CLOTH_COMMON.preSettleDt));
    for (let i = 0; i < CLOTH_COMMON.preSettleIterations; i++) {
      for (let j = 0; j < constraints.length; j++) constraints[j].solve();
    }
  }

  const canvas = document.createElement("canvas");
  sizeCanvas(canvas, canvasW, canvasH, dpr);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  host.innerHTML = "";
  host.appendChild(canvas);

  const mousePos = new Vec2();
  const chimeRadiusSq = K.CHIME_RADIUS_SQ;
  let active = true;

  function draw() {
    clearAndDrawCloth(
      ctx,
      particles,
      charCanvases,
      originX,
      originY,
      canvasW,
      canvasH,
      dpr
    );
  }

  function tick(dt) {
    if (!active) return;
    particles.forEach((p) => p.update(dt));
    for (let i = 0; i < CLOTH_COMMON.iterations; i++) {
      for (let j = 0; j < constraints.length; j++) constraints[j].solve();
    }
    draw();
  }

  function localPoint(clientX, clientY) {
    return clothLocalPoint(
      canvas,
      clientX,
      clientY,
      canvasW,
      canvasH,
      originX,
      originY
    );
  }

  function brush(clientX, clientY, { chime = true } = {}) {
    if (!active) return;
    const pt = localPoint(clientX, clientY);
    if (!pt) return;
    mousePos.reset(pt.x, pt.y);
    let nearest = null;
    let nearestLs = Infinity;
    for (const p of particles) {
      const diff = mousePos.subtractNew(p.pos);
      const ls = diff.lengthSquared;
      if (ls < config.mouseSize) {
        const a = diff.angle - Math.PI;
        const strength =
          (smoothstep(config.mouseSize, K.MOUSE_SMOOTH_END, ls) *
            config.mouseStrength) /
          K.MOUSE_FORCE_DIVISOR;
        p.applyForce(new Vec2(Math.cos(a) * strength, Math.sin(a) * strength));
      }
      if (chime && ls < chimeRadiusSq && ls < nearestLs) {
        nearest = p;
        nearestLs = ls;
      }
    }
    if (chime && nearest) {
      const closeness = 1 - nearestLs / chimeRadiusSq;
      chimes.setCountry(country.id);
      chimes.strike({
        x: pt.x,
        y: pt.y,
        particle: nearest,
        gridW,
        intensity: K.CHIME_CLOSENESS_MIN + closeness * K.CHIME_CLOSENESS_SPAN
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

  draw();

  return {
    countryId: country.id,
    canvas,
    tick,
    brush,
    containsPoint,
    setActive(v) {
      active = v;
    }
  };
}

/**
 * Contributions cloth — each submitted country name is a horizontal hanging row.
 * Stage fills modal width; letter columns stay dense (~12px). Canvas pad matches
 * main .strings so sway isn't cropped at the edges.
 */
export function createContributionsCloth(
  host,
  names,
  cssW,
  cssH,
  gridFn,
  config,
  dpr = DEFAULT_DPR
) {
  if (!host || !names?.length) return null;

  const width = Math.max(K.CONTRIB_MIN_SIZE, cssW);
  const height = Math.max(K.CONTRIB_MIN_SIZE, cssH);
  const pad = K.CONTRIB_PAD;
  const canvasW = width + pad * 2;
  const canvasH = height + pad * 2;
  const grid = gridFn(names, width);
  const gridW = grid.gridW;
  const gridH = grid.gridH;
  const cellWidth = width / Math.max(1, gridW - 1);
  const cellHeight = height / Math.max(1, gridH - 1);
  const fontSize = Math.max(
    K.FONT_SIZE_MIN,
    Math.min(
      K.FONT_SIZE_MAX,
      Math.min(
        cellWidth * K.CELL_TO_FONT_FACTOR,
        cellHeight * K.CONTRIB_CELL_HEIGHT_FACTOR
      )
    )
  );
  const originX = pad;
  const originY = pad + Math.ceil(fontSize * K.CONTRIB_ROOF_OFFSET_FACTOR);
  const fullCode = grid.cloth;
  const writing = grid.writing || "horizontal";
  const font = grid.font;

  const charCanvases = rasterizeChars(fullCode, font, fontSize, dpr);

  const { particles, constraints } = buildHangingGrid({
    gridW,
    gridH,
    width,
    height,
    fullCode,
    writing,
    config,
    vCompress: CLOTH_COMMON.vCompress,
    vStretch: CLOTH_COMMON.vStretch
  });

  for (let f = 0; f < CLOTH_COMMON.preSettle; f++) {
    particles.forEach((p) => p.update(CLOTH_COMMON.preSettleDt));
    for (let i = 0; i < CLOTH_COMMON.preSettleIterations; i++) {
      for (let j = 0; j < constraints.length; j++) constraints[j].solve();
    }
  }

  const canvas = document.createElement("canvas");
  sizeCanvas(canvas, canvasW, canvasH, dpr);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  host.innerHTML = "";
  host.appendChild(canvas);

  const mousePos = new Vec2();
  let destroyed = false;

  function draw() {
    if (destroyed) return;
    clearAndDrawCloth(
      ctx,
      particles,
      charCanvases,
      originX,
      originY,
      canvasW,
      canvasH,
      dpr
    );
  }

  function tick(dt) {
    if (destroyed) return;
    particles.forEach((p) => p.update(dt));
    for (let i = 0; i < CLOTH_COMMON.iterations; i++) {
      for (let j = 0; j < constraints.length; j++) constraints[j].solve();
    }
    draw();
  }

  function localPoint(clientX, clientY) {
    return clothLocalPoint(
      canvas,
      clientX,
      clientY,
      canvasW,
      canvasH,
      originX,
      originY
    );
  }

  function brush(clientX, clientY) {
    if (destroyed) return;
    const pt = localPoint(clientX, clientY);
    if (!pt) return;
    mousePos.reset(pt.x, pt.y);
    for (const p of particles) {
      const diff = mousePos.subtractNew(p.pos);
      const ls = diff.lengthSquared;
      if (ls < config.mouseSize) {
        const a = diff.angle - Math.PI;
        const strength =
          (smoothstep(config.mouseSize, K.MOUSE_SMOOTH_END, ls) *
            config.mouseStrength) /
          K.MOUSE_FORCE_DIVISOR;
        p.applyForce(new Vec2(Math.cos(a) * strength, Math.sin(a) * strength));
      }
    }
  }

  function onPointerMove(e) {
    brush(e.clientX, e.clientY);
  }

  canvas.addEventListener("pointermove", onPointerMove);

  draw();

  return {
    canvas,
    tick,
    brush,
    destroy() {
      destroyed = true;
      canvas.removeEventListener("pointermove", onPointerMove);
      host.innerHTML = "";
    }
  };
}