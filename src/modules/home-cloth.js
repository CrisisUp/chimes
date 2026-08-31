/**
 * Home cloth simulation — canvas setup, Verlet physics loop, and character
 * rendering for the main country view.  Exports `rerender` so Tweakpane
 * and navigation can restart the simulation.
 */
import * as K from "./constants.js";
import { COUNTRIES } from "../countries.js";
import {
  SERIF_FONT,
  rasterizeChars,
  buildHangingGrid,
  clearAndDrawCloth
} from "./cloth-common.js";
import { Vec2, Particle, Constraint, Input, sizeCanvas } from "../physics.js";
import { chimes } from "../chimes.js";

const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

/**
 * @param {{ config: object, isPaneEvent: (e: PointerEvent) => boolean }} deps
 */
export function initHomeCloth({ config, isPaneEvent }) {
  let rafID, input, c;

  function getCountry() {
    return COUNTRIES[config.country] || COUNTRIES["china"];
  }

  function main() {
    const country = getCountry();
    const width = config.width;
    const height = config.height;
    const { gridW, gridH, iterationsPerFrame, compressFactor, stretchFactor } =
      config;
    const root = document.getElementById("container");
    const pad = K.STRINGS_PAD;
    const canvasW = K.AREA_W + pad * 2;
    const canvasH = K.AREA_H + pad * 2;
    const cellHeight = height / (gridH - 1);
    const fontSize = Math.max(
      K.FONT_SIZE_MIN,
      Math.min(K.FONT_SIZE_MAX, cellHeight * K.CELL_TO_FONT_FACTOR)
    );
    const roofClearance = Math.ceil(fontSize * K.ROOF_OFFSET_FACTOR);
    const originX = pad + (K.AREA_W - width) / 2;
    const originY = pad + roofClearance;

    const fullCode = country.cloth;
    const writing = country.writing || "horizontal";
    const font = country.font || SERIF_FONT;
    const charCanvases = rasterizeChars(fullCode, font, fontSize, dpr);

    c = document.createElement("canvas");
    root.innerHTML = "";
    root.appendChild(c);
    sizeCanvas(c, canvasW, canvasH, dpr);
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const { particles, constraints } = buildHangingGrid({
      gridW,
      gridH,
      width,
      height,
      fullCode,
      writing,
      config,
      vCompress: compressFactor,
      vStretch: stretchFactor
    });

    input = new Input({
      c,
      particles,
      originX,
      originY,
      canvasW,
      canvasH,
      config,
      isPaneEvent,
      onStrike: (opts) => {
        if (opts) chimes.strike(opts);
        else chimes.lastParticleId = -1;
      }
    });

    let lastDelta = performance.now();
    function runloop(delta) {
      rafID = requestAnimationFrame(runloop);
      const dt = Math.min(K.DT_MAX, Math.max(K.DT_MIN, delta - lastDelta));
      lastDelta = delta;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvasW, canvasH);

      particles.forEach((p) => p.update(dt));
      for (let i = 0; i < iterationsPerFrame; i++) {
        for (let j = 0; j < constraints.length; j++) constraints[j].solve();
      }
      if (config.contain) particles.forEach((p) => p.contain());

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

    rafID = requestAnimationFrame(runloop);
  }

  function rerender() {
    if (input) input.unbind();
    cancelAnimationFrame(rafID);
    main();
  }

  /* ── Start the simulation immediately ── */
  main();

  return { rerender };
}
