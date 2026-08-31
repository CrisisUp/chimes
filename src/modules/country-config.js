/**
 * Per-country physics config store.
 * Isolated from UI — no Tweakpane dependency.
 * Used by tweakpane.js (panel) and navigation.js (country switching).
 */
import * as K from "./constants.js";

const STORAGE_KEY = "budarina-country-configs";
const countryConfigs = new Map(); // countryId → { gravity, damping, ... }

const PER_COUNTRY_KEYS = [
  "gravity",
  "damping",
  "iterationsPerFrame",
  "compressFactor",
  "stretchFactor",
  "mouseSize",
  "mouseStrength"
];

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      for (const [k, v] of Object.entries(obj)) countryConfigs.set(k, v);
    }
  } catch (_) {
    /* ignore */
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(countryConfigs)));
  } catch (_) {
    /* ignore */
  }
}

function snapshot(cfg, countryId) {
  const snap = {};
  for (const key of PER_COUNTRY_KEYS) snap[key] = cfg[key];
  countryConfigs.set(countryId, snap);
  persist();
}

function resetToDefaults(cfg) {
  for (const key of PER_COUNTRY_KEYS) {
    cfg[key] = K.DEFAULT_PHYSICS[key];
  }
}

function apply(cfg, countryId) {
  resetToDefaults(cfg);
  const overrides = countryConfigs.get(countryId) || {};
  for (const key of PER_COUNTRY_KEYS) {
    if (key in overrides) cfg[key] = overrides[key];
  }
}

load();

export const countryConfig = { snapshot, apply };