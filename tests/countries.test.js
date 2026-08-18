import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COUNTRIES,
  COUNTRY_MAP,
  COUNTRY_ORDER,
  DEFAULT_COUNTRY,
  neighborsOf,
  charForCell
} from "../src/countries.js";

test("COUNTRY_ORDER covers every country exactly once", () => {
  const keys = Object.keys(COUNTRIES);
  assert.equal(COUNTRY_ORDER.length, keys.length);
  assert.deepEqual([...new Set(COUNTRY_ORDER)].sort(), keys.sort());
});

test("COUNTRY_MAP derives id from the key and joins cloth into a string", () => {
  for (const id of COUNTRY_ORDER) {
    const c = COUNTRY_MAP[id];
    assert.equal(c.id, id, `id should equal key for ${id}`);
    assert.equal(typeof c.cloth, "string", `cloth should be a string for ${id}`);
    assert.ok(c.cloth.length > 0, `cloth should be non-empty for ${id}`);
    assert.equal(COUNTRIES[id].id, undefined, "raw data keeps no duplicate id");
  }
});

test("neighborsOf wraps around the ring", () => {
  // russia → left kazakhstan, right france
  assert.deepEqual(neighborsOf("russia"), { left: "kazakhstan", right: "france" });
  // iran (last) → right wraps to vietnam (first)
  assert.deepEqual(neighborsOf("iran"), { left: "brazil", right: "vietnam" });
  // unknown id → fallback neighbors
  assert.deepEqual(neighborsOf("unknown"), { left: "vietnam", right: "japan" });
});

test("charForCell maps horizontal writing row-major", () => {
  const text = "ABCDEF";
  assert.equal(charForCell(text, 0, 0, 3, 2, "horizontal"), "A");
  assert.equal(charForCell(text, 1, 0, 3, 2, "horizontal"), "B");
  assert.equal(charForCell(text, 2, 1, 3, 2, "horizontal"), "F");
});

test("charForCell maps vertical writing right-to-left columns", () => {
  const text = "ABCDEF";
  // vertical: colFromRight = gridW-1-i; index = colFromRight*gridH + j
  assert.equal(charForCell(text, 2, 0, 3, 2, "vertical"), "A");
  assert.equal(charForCell(text, 0, 0, 3, 2, "vertical"), "E");
  assert.equal(charForCell(text, 0, 1, 3, 2, "vertical"), "F");
});

test("charForCell defaults to horizontal and tolerates empty text", () => {
  assert.equal(charForCell("AB", 1, 0, 2, 1), "B");
  assert.equal(charForCell("", 0, 0, 2, 2), " ");
});

test("DEFAULT_COUNTRY exists in the map", () => {
  assert.ok(COUNTRY_MAP[DEFAULT_COUNTRY]);
});