/**
 * Stage 02 — China cloth only (no country switchers, carousel, or Tweakpane).
 */
import {
  clampFontSize,
  clothConfigFor,
  makeChimeHandler
} from "./cloth.js";
import { COUNTRIES, DEFAULT_COUNTRY, FALLBACK_FONT } from "./countries.js";
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

const root = document.getElementById("container");
const pad = STRINGS_PAD;
const fontSize = clampFontSize(CONFIG.height / (CONFIG.gridH - 1) * 0.95);

// Reduced motion: settle the cloth instantly instead of driving gravity.
const reducedMotionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
const prefersReducedMotion = reducedMotionQuery?.matches ?? false;

const { cloth } = createCloth(
  clothConfigFor({
    host: root,
    country,
    area: { width: AREA_W, height: AREA_H },
    pad,
    fontSize,
    font: country.font || FALLBACK_FONT,
    dpr,
    config: CONFIG,
    reducedMotion: prefersReducedMotion,
    mode: "interact",
    chimeHandler: makeChimeHandler(chimes)
  })
);

chimes.setCountry(country.id);

let raf = 0;
let last = performance.now();
function loop(now) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min(32, Math.max(1, now - last));
  last = now;
  cloth.tick(dt);
}
raf = requestAnimationFrame(loop);