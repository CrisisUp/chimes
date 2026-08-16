import { describe, it, expect } from 'vitest';
import { smoothstep, getPointID } from './utils.js';

describe('utils.js', () => {
  describe('smoothstep', () => {
    it('returns 0 when x <= edge0', () => {
      expect(smoothstep(0, 10, -5)).toBe(0);
      expect(smoothstep(0, 10, 0)).toBe(0);
    });

    it('returns 1 when x >= edge1', () => {
      expect(smoothstep(0, 10, 15)).toBe(1);
      expect(smoothstep(0, 10, 10)).toBe(1);
    });

    it('interpolates smoothly between 0 and 1', () => {
      expect(smoothstep(0, 10, 5)).toBe(0.5);
      expect(smoothstep(0, 10, 2.5)).toBeCloseTo(0.15625);
      expect(smoothstep(0, 10, 7.5)).toBeCloseTo(0.84375);
    });

    it('handles negative ranges', () => {
      expect(smoothstep(-10, 0, -5)).toBe(0.5);
    });
  });

  describe('getPointID', () => {
    it('calculates correct ID for grid positions', () => {
      // gridH = 40, row (j), col (i)
      expect(getPointID(0, 0, 40)).toBe(0);   // top-left
      expect(getPointID(39, 0, 40)).toBe(39); // bottom-left
      expect(getPointID(0, 1, 40)).toBe(40);  // top of col 1
      expect(getPointID(39, 35, 40)).toBe(35 * 40 + 39); // bottom-right of 36x40 grid
    });

    it('works with different grid heights', () => {
      expect(getPointID(0, 0, 10)).toBe(0);
      expect(getPointID(9, 0, 10)).toBe(9);
      expect(getPointID(0, 1, 10)).toBe(10);
    });
  });
});