/**
 * Shared cloth building blocks used by every cloth factory (main, carousel,
 * contributions). All coordinates are device-independent CSS pixels; the dpr
 * scaling lives here so callers only pass the already-resolved `dpr`.
 */
import * as K from "./constants.js";
import { getPointID } from "./utils.js";
import { charForCell } from "./countries.js";
import { Particle, Constraint } from "./physics.js";

export const SERIF_FONT =
  '"Songti SC", "STSong", "Noto Serif SC", "Hiragino Mincho ProN", serif';

/**
 * Pre-render each distinct character of `fullCode` to an offscreen canvas.
 * Font string is fully resolved before calling (country.font || SERIF_FONT
 * for the main/carousel cloths, grid.font for the contributions cloth).
 */
export function rasterizeChars(fullCode, font, fontSize, dpr) {
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
    octx.font = `${fontSize}px ${font}`;
    octx.textAlign = "center";
    octx.textBaseline = "middle";
    octx.fillStyle = "#2a2620";
    octx.fillText(ch, size / 2, size / 2);
    charCanvases[ch] = off;
  }
  return charCanvases;
}

/**
 * Build the pinned-top particle grid: vertical strands (hanging) plus
 * horizontal spacers (rigid bounds). Positions derive from width/height and
 * gridW/gridH exactly as each original factory computed them.
 */
export function buildHangingGrid({
  gridW,
  gridH,
  width,
  height,
  fullCode,
  writing,
  config,
  vCompress,
  vStretch
}) {
  const cellWidth = width / Math.max(1, gridW - 1);
  const cellHeight = height / Math.max(1, gridH - 1);
  const particles = [];
  const constraints = [];

  for (let i = 0; i < gridW; i++) {
    for (let j = 0; j < gridH; j++) {
      const x = i * cellWidth;
      const y = j * cellHeight;
      const id = getPointID(j, i, gridH);
      const pinned = j === 0;
      const char = charForCell(fullCode, i, j, gridW, gridH, writing);
      particles.push(new Particle({ x, y, pinned, id, char, config }));
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
          compressFactor: vCompress,
          stretchFactor: vStretch,
          config
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
            config
          })
        );
      }
    }
  }

  return { particles, constraints };
}

/** Clear the canvas and draw every character rotated along its strand. */
export function clearAndDrawCloth(
  ctx,
  particles,
  charCanvases,
  originX,
  originY,
  canvasW,
  canvasH,
  dpr
) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvasW, canvasH);
  for (const p of particles) {
    if (!p.char || p.char === " " || p.char === "　") continue;
    const img = charCanvases[p.char];
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

/** Map a pointer position to cloth-local coordinates (carousel + contributions). */
export function clothLocalPoint(
  canvas,
  clientX,
  clientY,
  canvasW,
  canvasH,
  originX,
  originY
) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  return {
    x: ((clientX - rect.left) / rect.width) * canvasW - originX,
    y: ((clientY - rect.top) / rect.height) * canvasH - originY
  };
}