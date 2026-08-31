import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as K from './modules/constants.js';

/* ──────────────────────────────────────────────────────────────
   country-config.js — per-country physics config store
   Tests focus on in-memory behavior; localStorage tested in integration.test.js
   ────────────────────────────────────────────────────────────── */

async function loadFreshModule() {
  vi.resetModules();
  const mod = await import('./modules/country-config.js');
  return mod.countryConfig;
}

describe('country-config.js', () => {
  let mockStorage;
  let origGetItem;
  let origSetItem;

  beforeEach(async () => {
    origGetItem = localStorage.getItem;
    origSetItem = localStorage.setItem;
    mockStorage = {};
    localStorage.getItem = (key) => mockStorage[key] ?? null;
    localStorage.setItem = (key, value) => { mockStorage[key] = value; };
  });

  afterEach(() => {
    localStorage.getItem = origGetItem;
    localStorage.setItem = origSetItem;
  });

  describe('snapshot(cfg, countryId)', () => {
    it('stores all PER_COUNTRY_KEYS in memory', async () => {
      const countryConfig = await loadFreshModule();
      const cfg = {
        gravity: 0.5,
        damping: 0.95,
        iterationsPerFrame: 6,
        compressFactor: 0.05,
        stretchFactor: 1.2,
        mouseSize: 6000,
        mouseStrength: 5
      };
      countryConfig.snapshot(cfg, 'china');
      // Verify via apply round-trip
      const cfg2 = { ...K.DEFAULT_PHYSICS };
      countryConfig.apply(cfg2, 'china');
      expect(cfg2.gravity).toBe(0.5);
      expect(cfg2.damping).toBe(0.95);
      expect(cfg2.iterationsPerFrame).toBe(6);
      expect(cfg2.compressFactor).toBe(0.05);
      expect(cfg2.stretchFactor).toBe(1.2);
      expect(cfg2.mouseSize).toBe(6000);
      expect(cfg2.mouseStrength).toBe(5);
    });

    it('overwrites previous snapshot for same country', async () => {
      const countryConfig = await loadFreshModule();
      const cfg1 = { ...K.DEFAULT_PHYSICS, gravity: 0.3 };
      const cfg2 = { ...K.DEFAULT_PHYSICS, gravity: 0.9 };
      countryConfig.snapshot(cfg1, 'china');
      countryConfig.snapshot(cfg2, 'china');

      const cfg = { ...K.DEFAULT_PHYSICS };
      countryConfig.apply(cfg, 'china');
      expect(cfg.gravity).toBe(0.9); // latest wins
    });
  });

  describe('apply(cfg, countryId)', () => {
    it('resets cfg to DEFAULT_PHYSICS when no overrides exist', async () => {
      const countryConfig = await loadFreshModule();
      const cfg = {
        gravity: 1.5,
        damping: 0.8,
        iterationsPerFrame: 10,
        compressFactor: 0.5,
        stretchFactor: 2.0,
        mouseSize: 10000,
        mouseStrength: 10
      };
      countryConfig.apply(cfg, 'japan'); // no saved config
      expect(cfg.gravity).toBe(K.DEFAULT_PHYSICS.gravity);
      expect(cfg.damping).toBe(K.DEFAULT_PHYSICS.damping);
      expect(cfg.iterationsPerFrame).toBe(K.DEFAULT_PHYSICS.iterationsPerFrame);
      expect(cfg.compressFactor).toBe(K.DEFAULT_PHYSICS.compressFactor);
      expect(cfg.stretchFactor).toBe(K.DEFAULT_PHYSICS.stretchFactor);
      expect(cfg.mouseSize).toBe(K.DEFAULT_PHYSICS.mouseSize);
      expect(cfg.mouseStrength).toBe(K.DEFAULT_PHYSICS.mouseStrength);
    });

    it('applies saved overrides on top of defaults', async () => {
      const countryConfig = await loadFreshModule();
      const cfg = {
        gravity: 1.5,
        damping: 0.8,
        iterationsPerFrame: 10,
        compressFactor: 0.5,
        stretchFactor: 2.0,
        mouseSize: 10000,
        mouseStrength: 10
      };
      // Save custom gravity for china
      countryConfig.snapshot({ ...K.DEFAULT_PHYSICS, gravity: 0.7 }, 'china');
      // Apply to cfg — should reset to defaults then apply china override
      countryConfig.apply(cfg, 'china');
      expect(cfg.gravity).toBe(0.7);
      expect(cfg.damping).toBe(K.DEFAULT_PHYSICS.damping); // not overridden
    });

    it('independent configs per country do not interfere', async () => {
      const countryConfig = await loadFreshModule();
      const cfg = { ...K.DEFAULT_PHYSICS };
      // China: custom gravity
      countryConfig.snapshot({ ...K.DEFAULT_PHYSICS, gravity: 0.5 }, 'china');
      // Japan: custom damping
      countryConfig.snapshot({ ...K.DEFAULT_PHYSICS, damping: 0.92 }, 'japan');

      // Apply china
      countryConfig.apply(cfg, 'china');
      expect(cfg.gravity).toBe(0.5);
      expect(cfg.damping).toBe(K.DEFAULT_PHYSICS.damping);

      // Apply japan
      countryConfig.apply(cfg, 'japan');
      expect(cfg.gravity).toBe(K.DEFAULT_PHYSICS.gravity); // reset
      expect(cfg.damping).toBe(0.92);
    });
  });

  describe('PER_COUNTRY_KEYS coverage', () => {
    it('all keys from DEFAULT_PHYSICS are handled', () => {
      const keys = Object.keys(K.DEFAULT_PHYSICS);
      expect(keys.sort()).toEqual([
        "compressFactor",
        "damping",
        "gravity",
        "iterationsPerFrame",
        "mouseSize",
        "mouseStrength",
        "stretchFactor"
      ].sort());
    });
  });
});