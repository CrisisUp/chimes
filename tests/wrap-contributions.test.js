import { test } from "node:test";
import assert from "node:assert/strict";
import { wrapContributionNames, contributionsGrid } from "../src/contributions.js";

/**
 * Unit tests for the contributions wrapping logic — the pure functions that
 * pack country names into fixed-width rows. No DOM/localStorage involved.
 */
test("pads short words with spaces to the full width", () => {
  assert.deepEqual(wrapContributionNames(["France"], 8), ["France  ", "        "]);
});

test("packs words on the same row when they fit with a gap", () => {
  assert.deepEqual(wrapContributionNames(["USA", "UK"], 8), ["USA UK  ", "        "]);
});

test("wraps to a new row when the row would overflow", () => {
  assert.deepEqual(wrapContributionNames(["France", "Italy"], 12), [
    "France Italy",
    "            "
  ]);
});

test("exact-width word on an empty row fills it completely (no gap bug)", () => {
  // Word exactly the row width: the row is full, no stray-gap or double row.
  const rows = wrapContributionNames(["abcdef"], 6);
  assert.deepEqual(rows, ["abcdef", "      "]);
});

test("long word over the row width splits cleanly across rows", () => {
  const rows = wrapContributionNames(["abcdefghij", "xy"], 6);
  assert.deepEqual(rows, ["abcdef", "ghij  ", "xy    "]);
});

test("grid width clamps to at least 2", () => {
  const rows = wrapContributionNames(["a", "b"], 1);
  assert.deepEqual(rows, ["a ", "b "]);
});

test("empty input yields at least two empty rows", () => {
  const rows = wrapContributionNames([], 8);
  assert.ok(rows.length >= 2);
  assert.ok(rows.every((r) => r.length === 8));
});

test("contributionsGrid returns a horizontal writing grid with matching text", () => {
  const g = contributionsGrid(["France", "Italy"], 160);
  assert.equal(g.writing, "horizontal");
  const rows = wrapContributionNames(["France", "Italy"], g.gridW);
  assert.equal(g.cloth, rows.join(""));
});