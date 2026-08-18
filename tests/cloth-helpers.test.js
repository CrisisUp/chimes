import { test } from "node:test";
import assert from "node:assert/strict";
import {
  physicsFor,
  clothConfigFor,
  clampFontSize,
  deriveFontSize
} from "../src/cloth.js";

test("physicsFor returns reduced-motion tuning when reduced", () => {
  assert.deepEqual(physicsFor(true), {
    gravity: 0,
    damping: 1,
    iterations: 1,
    settleFrames: 60
  });
});

test("physicsFor falls back to cloth defaults when nothing overridden", () => {
  assert.deepEqual(physicsFor(false), {
    gravity: 0.2,
    damping: 0.99,
    iterations: 5,
    settleFrames: 0
  });
});

test("physicsFor honors per-site overrides", () => {
  assert.deepEqual(physicsFor(false, { iterations: 4, settleFrames: 70 }), {
    gravity: 0.2,
    damping: 0.99,
    iterations: 4,
    settleFrames: 70
  });
});

test("clampFontSize keeps sizes inside the printable band", () => {
  assert.equal(clampFontSize(2), 9); // below floor
  assert.equal(clampFontSize(9), 9); // at floor
  assert.equal(clampFontSize(12), 12); // inside
  assert.equal(clampFontSize(99), 14); // above cap
});

test("deriveFontSize clamps to the printable band at both ends", () => {
  // Very large cells → clamped to the 14 cap.
  assert.equal(deriveFontSize(400, 400, 2, 2), 14);
  assert.equal(deriveFontSize(100, 200, 5, 5), 14);
  // Very small cells → clamped to the 9 floor.
  assert.equal(deriveFontSize(40, 40, 40, 40), 9);
  // Degenerate one-column grid doesn't divide by zero.
  assert.ok(deriveFontSize(100, 100, 1, 3) > 0);
});

test("deriveFontSize returns an in-band size for mid-range cells", () => {
  // 100x100 with 10×10 → cell 11.1 → 11.1*0.95 ≈ 10.5 → inside 9..14
  const size = deriveFontSize(100, 100, 10, 10);
  assert.ok(size >= 9 && size <= 14, `size ${size} should be within 9..14`);
});

test("clothConfigFor assembles createCloth options with derived physics", () => {
  const config = clothConfigFor({
    host: null,
    country: { cloth: "abc", writing: "horizontal" },
    area: { width: 200, height: 200 },
    pad: 10,
    font: "monospace",
    dpr: 2,
    config: { width: 200, height: 200, gridW: 6, gridH: 6 },
    reducedMotion: true,
    mode: "simulate",
    chimeHandler: () => {}
  });
  assert.equal(config.gravity, 0);
  assert.equal(config.iterations, 1);
  assert.equal(config.text, "abc");
  assert.equal(config.mode, "simulate");
  assert.equal(config.gridW, 6);
});