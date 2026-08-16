import { describe, it, expect } from 'vitest';
import * as K from './constants.js';

describe('modules/constants.js', () => {
  describe('Area / grid constants', () => {
    it('defines correct area dimensions', () => {
      expect(K.AREA_W).toBe(492);
      expect(K.AREA_H).toBe(468);
    });

    it('defines grid defaults', () => {
      expect(K.DEFAULT_GRID_W).toBe(36);
      expect(K.DEFAULT_GRID_H).toBe(40);
    });

    it('defines canvas padding', () => {
      expect(K.STRINGS_PAD).toBe(420);
    });
  });

  describe('Vertical strand stiffness', () => {
    it('has reasonable compress/stretch factors', () => {
      expect(K.VERTICAL_COMPRESS_FACTOR).toBe(0.02);
      expect(K.VERTICAL_STRETCH_FACTOR).toBe(1.1);
    });
  });

  describe('Spacer stiffness', () => {
    it('has rigid horizontal spacer factors', () => {
      expect(K.SPACER_COMPRESS_FACTOR).toBe(0.6);
      expect(K.SPACER_STRETCH_FACTOR).toBe(4);
    });
  });

  describe('Simulation budget', () => {
    it('uses unified SOLVE_ITERATIONS = 4', () => {
      expect(K.SOLVE_ITERATIONS).toBe(4);
    });

    it('defines pre-settle parameters', () => {
      expect(K.PRE_SETTLE_FRAMES).toBe(70);
      expect(K.PRE_SETTLE_DT).toBe(16);
      expect(K.PRE_SETTLE_ITERATIONS).toBe(5);
    });

    it('defines delta time clamping', () => {
      expect(K.DT_MIN).toBe(1);
      expect(K.DT_MAX).toBe(32);
    });
  });

  describe('Character rendering', () => {
    it('defines font size bounds', () => {
      expect(K.FONT_SIZE_MIN).toBe(9);
      expect(K.FONT_SIZE_MAX).toBe(14);
    });

    it('defines scaling factors', () => {
      expect(K.CELL_TO_FONT_FACTOR).toBe(0.95);
      expect(K.CHAR_FACTOR).toBe(1.35);
      expect(K.ROOF_OFFSET_FACTOR).toBe(0.7);
    });
  });

  describe('Pointer interaction / chimes', () => {
    it('defines grab and chime radii', () => {
      expect(K.GRAB_RADIUS).toBe(24);
      expect(K.CHIME_RADIUS).toBe(55);
      expect(K.CHIME_RADIUS_SQ).toBe(K.CHIME_RADIUS * K.CHIME_RADIUS);
    });

    it('defines chime intensity range', () => {
      expect(K.CHIME_CLOSENESS_MIN).toBe(0.2);
      expect(K.CHIME_CLOSENESS_SPAN).toBe(0.7);
    });

    it('defines default chime volume', () => {
      expect(K.DEFAULT_CHIME_VOLUME).toBe(0.28);
    });
  });

  describe('DEFAULT_PHYSICS object', () => {
    it('seeds all live physics values', () => {
      expect(K.DEFAULT_PHYSICS).toEqual({
        gravity: 0.2,
        damping: 0.99,
        iterationsPerFrame: K.SOLVE_ITERATIONS,
        compressFactor: K.VERTICAL_COMPRESS_FACTOR,
        stretchFactor: K.VERTICAL_STRETCH_FACTOR,
        mouseSize: 5000,
        mouseStrength: 4,
      });
    });
  });
});