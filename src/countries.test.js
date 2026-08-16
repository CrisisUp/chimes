import { describe, it, expect } from 'vitest';
import {
  COUNTRIES,
  COUNTRY_ORDER,
  DEFAULT_COUNTRY,
  neighborsOf,
  charForCell,
} from './countries.js';

describe('countries.js', () => {
  describe('COUNTRIES object', () => {
    it('has all 13 countries', () => {
      expect(Object.keys(COUNTRIES)).toHaveLength(13);
    });

    it('each country has required properties', () => {
      for (const [id, country] of Object.entries(COUNTRIES)) {
        expect(country.id).toBe(id);
        expect(typeof country.name).toBe('string');
        expect(typeof country.roof).toBe('string');
        expect(country.roof).toMatch(/^\.\/roof-.+\.webp$/);
        expect(typeof country.buttonIcon).toBe('string');
        expect(country.buttonIcon).toMatch(/^\.\/selector-.+\.png$/);
        expect(['horizontal', 'vertical']).toContain(country.writing);
        expect(typeof country.title).toBe('string');
        expect(typeof country.aside).toBe('string');
        expect(typeof country.cloth).toBe('string');
        expect(country.cloth.length).toBeGreaterThan(0);
      }
    });

    it('vertical writing countries have gridW defined (vietnam explicit, china/japan use default)', () => {
      // Only vietnam has explicit gridW; china/japan use DEFAULT_GRID_W
      expect(COUNTRIES.vietnam.gridW).toBe(62);
      expect(COUNTRIES.china.gridW).toBeUndefined();
      expect(COUNTRIES.japan.gridW).toBeUndefined();
    });

    it('horizontal writing countries have gridW defined', () => {
      const horizontalCountries = [
        'kazakhstan', 'russia', 'france', 'india', 'uk',
        'norway', 'italy', 'usa', 'brazil', 'iran'
      ];
      for (const id of horizontalCountries) {
        expect(COUNTRIES[id].gridW).toBeDefined();
        expect(typeof COUNTRIES[id].gridW).toBe('number');
      }
    });

    it('all countries have eyebrow copy', () => {
      for (const country of Object.values(COUNTRIES)) {
        expect(country.eyebrow).toBeDefined();
        expect(typeof country.eyebrow).toBe('string');
      }
    });
  });

  describe('COUNTRY_ORDER', () => {
    it('has 13 countries in correct order', () => {
      expect(COUNTRY_ORDER).toHaveLength(13);
      expect(COUNTRY_ORDER[0]).toBe('vietnam');
      expect(COUNTRY_ORDER[12]).toBe('iran');
    });

    it('matches COUNTRIES keys', () => {
      // Use spread to avoid mutating the exported COUNTRY_ORDER array
      expect([...COUNTRY_ORDER].sort()).toEqual(Object.keys(COUNTRIES).sort());
    });
  });

  describe('DEFAULT_COUNTRY', () => {
    it('is china', () => {
      expect(DEFAULT_COUNTRY).toBe('china');
      expect(COUNTRIES[DEFAULT_COUNTRY]).toBeDefined();
    });
  });

  describe('neighborsOf', () => {
    it('returns correct neighbors for middle country (japan)', () => {
      const { left, right } = neighborsOf('japan');
      // COUNTRY_ORDER: vietnam, china, japan, kazakhstan, ...
      expect(left).toBe('china');
      expect(right).toBe('kazakhstan');
    });

    it('wraps around for first country (vietnam)', () => {
      const { left, right } = neighborsOf('vietnam');
      expect(left).toBe('iran');
      expect(right).toBe('china');
    });

    it('wraps around for last country (iran)', () => {
      const { left, right } = neighborsOf('iran');
      expect(left).toBe('brazil');
      expect(right).toBe('vietnam');
    });

    it('falls back for unknown country', () => {
      const { left, right } = neighborsOf('unknown');
      expect(left).toBe('vietnam');
      expect(right).toBe('japan');
    });
  });

  describe('charForCell', () => {
    it('maps horizontal writing left-to-right, top-to-bottom', () => {
      const text = 'ABCDEFGHIJ'; // 10 chars
      const gridW = 5;
      const gridH = 2;

      // Row 0: A B C D E
      expect(charForCell(text, 0, 0, gridW, gridH, 'horizontal')).toBe('A');
      expect(charForCell(text, 4, 0, gridW, gridH, 'horizontal')).toBe('E');
      // Row 1: F G H I J
      expect(charForCell(text, 0, 1, gridW, gridH, 'horizontal')).toBe('F');
      expect(charForCell(text, 4, 1, gridW, gridH, 'horizontal')).toBe('J');
    });

    it('maps vertical writing right-to-left columns, top-to-bottom', () => {
      const text = 'ABCDEFGHIJ'; // 10 chars
      const gridW = 5;
      const gridH = 2;

      // i=col (left→right), j=row (top→bottom)
      // vertical: colFromRight = gridW - 1 - i
      // Col 4 (rightmost, i=4): colFromRight=0 → indices 0,1 → A,B
      expect(charForCell(text, 4, 0, gridW, gridH, 'vertical')).toBe('A');
      expect(charForCell(text, 4, 1, gridW, gridH, 'vertical')).toBe('B');
      // Col 3 (i=3): colFromRight=1 → indices 2,3 → C,D
      expect(charForCell(text, 3, 0, gridW, gridH, 'vertical')).toBe('C');
      expect(charForCell(text, 3, 1, gridW, gridH, 'vertical')).toBe('D');
    });

    it('wraps text when longer than grid', () => {
      const text = 'AB';
      const gridW = 5;
      const gridH = 2;

      expect(charForCell(text, 0, 0, gridW, gridH, 'horizontal')).toBe('A');
      expect(charForCell(text, 1, 0, gridW, gridH, 'horizontal')).toBe('B');
      expect(charForCell(text, 2, 0, gridW, gridH, 'horizontal')).toBe('A'); // wraps
    });

    it('returns space for empty text', () => {
      expect(charForCell('', 0, 0, 10, 10, 'horizontal')).toBe(' ');
      expect(charForCell(null, 0, 0, 10, 10, 'horizontal')).toBe(' ');
    });

    it('defaults to horizontal writing', () => {
      const text = 'ABCD';
      expect(charForCell(text, 1, 0, 4, 1)).toBe('B'); // horizontal default
    });
  });
});