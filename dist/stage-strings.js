/**
 * Stage 02 — China cloth only (no country switchers, carousel, or Tweakpane).
 */
import { createCloth } from "./cloth.js";
import { COUNTRIES, DEFAULT_COUNTRY } from "./countries.js";
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
const fontSize = Math.max(9, Math.min(14, CONFIG.height / (CONFIG.gridH - 1) * 0.95));

const cloth = createCloth({
  host: root,
  text: country.cloth,
  writing: country.writing || "horizontal",
  width: CONFIG.width,
  height: CONFIG.height,
  gridW: CONFIG.gridW,
  gridH: CONFIG.gridH,
  pad,
  fontSize,
  originX: pad + (AREA_W - CONFIG.width) / 2,
  originY: pad + Math.ceil(fontSize * 0.7),
  font:
    country.font ||
    '"Songti SC", "STSong", "Noto Serif SC", "Hiragino Mincho ProN", serif',
  dpr,
  gravity: CONFIG.gravity,
  damping: CONFIG.damping,
  iterations: CONFIG.iterationsPerFrame,
  compressFactor: CONFIG.compressFactor,
  stretchFactor: CONFIG.stretchFactor,
  contain: CONFIG.contain,
  mouseSize: CONFIG.mouseSize,
  mouseStrength: CONFIG.mouseStrength,
  mode: "interact",
  settleFrames: 0,
  onChime: ({ x, y, particle, gridW: g, intensity, force, reset }) => {
    if (!reset) {
      chimes.strike({ x, y, particle, gridW: g, intensity, force });
    } else {
      chimes.lastParticleId = -1;
    }
  }
});

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