import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage
const mockStorage = {};
global.localStorage = {
  getItem: vi.fn((key) => mockStorage[key] ?? null),
  setItem: vi.fn((key, value) => { mockStorage[key] = value; }),
  removeItem: vi.fn((key) => { delete mockStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
};

import {
  countryKey,
  resolveCountryName,
  loadContributions,
  saveContributions,
  normalizeContribution,
  addContribution,
  wrapContributionNames,
  contributionsClothText,
  contributionsGrid,
  SEED_CONTRIBUTIONS,
  MAX_NAME_LEN,
  MAX_ENTRIES,
  TARGET_CELL_PX,
} from './contributions.js';

describe('contributions.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
  });

  describe('countryKey', () => {
    it('normalizes accents and case', () => {
      expect(countryKey('Côte d\'Ivoire')).toBe('cote divoire');
      expect(countryKey('VIETNAM')).toBe('vietnam');
      expect(countryKey('U.S.A.')).toBe('usa');
    });

    it('removes punctuation and extra spaces', () => {
      expect(countryKey('  United   States  ')).toBe('united states');
      expect(countryKey('South-Korea')).toBe('south korea');
    });

    it('handles empty/null', () => {
      expect(countryKey('')).toBe('');
      expect(countryKey(null)).toBe('');
    });
  });

  describe('resolveCountryName', () => {
    it('resolves canonical names', () => {
      expect(resolveCountryName('Vietnam')).toBe('Vietnam');
      expect(resolveCountryName('china')).toBe('China');
      expect(resolveCountryName('JAPAN')).toBe('Japan');
    });

    it('resolves common aliases', () => {
      expect(resolveCountryName('usa')).toBe('USA');
      expect(resolveCountryName('us')).toBe('USA');
      expect(resolveCountryName('united states')).toBe('USA');
      expect(resolveCountryName('uk')).toBe('UK');
      expect(resolveCountryName('great britain')).toBe('UK');
      expect(resolveCountryName('russia')).toBe('Russia');
      expect(resolveCountryName('viet nam')).toBe('Vietnam');
    });

    it('returns null for unknown', () => {
      expect(resolveCountryName('Atlantis')).toBeNull();
      expect(resolveCountryName('')).toBeNull();
    });
  });

  describe('loadContributions', () => {
    it('returns seed contributions when empty', () => {
      const result = loadContributions();
      expect(result).toEqual(SEED_CONTRIBUTIONS);
    });

    it('merges stored with seed (no duplicates)', () => {
      mockStorage['budarina-contributions'] = JSON.stringify(['Vietnam', 'CustomLand']);
      const result = loadContributions();
      expect(result).toContain('Vietnam');
      expect(result).toContain('CustomLand');
      // Vietnam should appear only once
      expect(result.filter(c => c.toLowerCase() === 'vietnam')).toHaveLength(1);
    });

    it('handles corrupted localStorage gracefully', () => {
      mockStorage['budarina-contributions'] = 'not valid json';
      const result = loadContributions();
      expect(result).toEqual(SEED_CONTRIBUTIONS);
    });

    it('limits to MAX_ENTRIES', () => {
      const many = Array.from({ length: 100 }, (_, i) => `Country${i}`);
      mockStorage['budarina-contributions'] = JSON.stringify(many);
      const result = loadContributions();
      expect(result.length).toBeLessThanOrEqual(MAX_ENTRIES);
    });
  });

  describe('saveContributions', () => {
    it('saves to localStorage', () => {
      saveContributions(['Test1', 'Test2']);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'budarina-contributions',
        JSON.stringify(['Test1', 'Test2'])
      );
    });

    it('truncates to MAX_ENTRIES', () => {
      const many = Array.from({ length: 100 }, (_, i) => `C${i}`);
      saveContributions(many);
      const saved = JSON.parse(mockStorage['budarina-contributions']);
      expect(saved.length).toBe(MAX_ENTRIES);
    });
  });

  describe('normalizeContribution', () => {
    it('rejects empty', () => {
      expect(normalizeContribution('')).toEqual({ ok: false, error: 'empty' });
      expect(normalizeContribution('   ')).toEqual({ ok: false, error: 'empty' });
    });

    it('rejects too long', () => {
      const long = 'A'.repeat(MAX_NAME_LEN + 1);
      expect(normalizeContribution(long)).toEqual({ ok: false, error: 'too_long' });
    });

    it('accepts valid country names', () => {
      expect(normalizeContribution('vietnam')).toEqual({ ok: true, name: 'Vietnam' });
      expect(normalizeContribution('  USA  ')).toEqual({ ok: true, name: 'USA' });
      expect(normalizeContribution('uk')).toEqual({ ok: true, name: 'UK' });
    });

    it('rejects non-countries', () => {
      expect(normalizeContribution('NotACountry')).toEqual({ ok: false, error: 'not_a_country' });
    });
  });

  describe('addContribution', () => {
    it('adds valid contribution', () => {
      const result = addContribution('France');
      expect(result.ok).toBe(true);
      expect(result.name).toBe('France');
    });

    it('rejects invalid', () => {
      const result = addContribution('InvalidCountryName');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('not_a_country');
    });

    it('rejects when full', () => {
      // Fill up to MAX_ENTRIES with a valid list
      const many = Array.from({ length: MAX_ENTRIES }, (_, i) => SEED_CONTRIBUTIONS[i % SEED_CONTRIBUTIONS.length]);
      mockStorage['budarina-contributions'] = JSON.stringify(many);
      const result = addContribution('France');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('full');
    });
  });

  describe('wrapContributionNames', () => {
    it('packs names into rows of gridW width', () => {
      const rows = wrapContributionNames(['AB', 'CD'], 5);
      // AB CD (with space) = 5 chars
      expect(rows[0]).toBe('AB CD');
    });

    it('wraps long words', () => {
      const rows = wrapContributionNames(['ABCDEF'], 4);
      expect(rows[0]).toBe('ABCD');
      expect(rows[1]).toBe('EF  ');
    });

    it('ensures minimum 2 rows', () => {
      const rows = wrapContributionNames(['A'], 10);
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });

    it('pads rows to gridW', () => {
      const rows = wrapContributionNames(['Hi'], 10);
      expect(rows[0].length).toBe(10);
    });
  });

  describe('contributionsClothText', () => {
    it('joins wrapped rows', () => {
      const text = contributionsClothText(['AB', 'CD'], 5);
      // Row1 = 'AB CD' (5), Row2 = '     ' (5 spaces) → 10 chars total
      expect(text).toBe('AB CD     ');
    });
  });

  describe('contributionsGrid', () => {
    it('calculates gridW from stage width', () => {
      const grid = contributionsGrid(['Test'], 500); // 500/12 ≈ 41 + 1 = 42
      expect(grid.gridW).toBeGreaterThanOrEqual(16);
      expect(grid.gridW).toBeLessThanOrEqual(60);
    });

    it('uses minimum gridW of 16', () => {
      const grid = contributionsGrid(['Test'], 10); // tiny stage
      expect(grid.gridW).toBe(16);
    });

    it('returns horizontal writing with monospace font', () => {
      const grid = contributionsGrid(['Test'], 400);
      expect(grid.writing).toBe('horizontal');
      expect(grid.font).toContain('JetBrains Mono');
    });

    it('gridH matches number of wrapped rows', () => {
      const grid = contributionsGrid(['A', 'B', 'C', 'D', 'E', 'F'], 200);
      expect(grid.gridH).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Constants', () => {
    it('exports expected constants', () => {
      expect(MAX_NAME_LEN).toBe(40);
      expect(MAX_ENTRIES).toBe(64);
      expect(TARGET_CELL_PX).toBe(12);
    });

    it('SEED_CONTRIBUTIONS has 13 countries matching COUNTRY_ORDER', () => {
      expect(SEED_CONTRIBUTIONS).toHaveLength(13);
      // All seeds should be valid country names
      for (const name of SEED_CONTRIBUTIONS) {
        expect(resolveCountryName(name)).toBe(name);
      }
    });
  });
});