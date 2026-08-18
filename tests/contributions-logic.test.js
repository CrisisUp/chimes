import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countryKey,
  resolveCountryName,
  normalizeContribution,
  MAX_NAME_LEN
} from "../src/contributions.js";

test("countryKey folds accents, punctuation and case", () => {
  assert.equal(countryKey("U.S.A."), "usa");
  assert.equal(countryKey("Côte d'Ivoire"), "cote divoire");
  assert.equal(countryKey("United States"), "united states");
  assert.equal(countryKey(null), "");
  assert.equal(countryKey(undefined), "");
});

test("resolveCountryName maps aliases to canonical names", () => {
  assert.equal(resolveCountryName("usa"), "USA");
  assert.equal(resolveCountryName("U.S.A."), "USA");
  assert.equal(resolveCountryName("turkiye"), "Turkey");
  assert.equal(resolveCountryName("czech republic"), "Czechia");
  assert.equal(resolveCountryName("atlantis"), null);
});

test("normalizeContribution accepts a known country", () => {
  assert.deepEqual(normalizeContribution("argentina"), { ok: true, name: "Argentina" });
  assert.deepEqual(normalizeContribution("uk"), { ok: true, name: "UK" });
});

test("normalizeContribution rejects empty / over-long / unknown input", () => {
  assert.deepEqual(normalizeContribution(""), { ok: false, error: "empty" });
  assert.deepEqual(normalizeContribution(null), { ok: false, error: "empty" });
  assert.deepEqual(normalizeContribution("   "), { ok: false, error: "empty" });
  assert.deepEqual(normalizeContribution("X".repeat(MAX_NAME_LEN + 1)), {
    ok: false,
    error: "too_long"
  });
  assert.deepEqual(normalizeContribution("Atlantis"), {
    ok: false,
    error: "not_a_country"
  });
});