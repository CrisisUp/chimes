import { describe, it, expect, vi } from 'vitest';
import {
  Vec2,
  Particle,
  Constraint,
  Input,
  sizeCanvas,
} from './physics.js';
import * as K from './modules/constants.js';

describe('physics.js', () => {
  describe('Vec2', () => {
    it('initializes at origin', () => {
      const v = new Vec2();
      expect(v.x).toBe(0);
      expect(v.y).toBe(0);
    });

    it('initializes with values', () => {
      const v = new Vec2(3, 4);
      expect(v.x).toBe(3);
      expect(v.y).toBe(4);
    });

    it('reset updates values', () => {
      const v = new Vec2(1, 2);
      v.reset(5, 6);
      expect(v.x).toBe(5);
      expect(v.y).toBe(6);
    });

    it('add/subtract modifies in place', () => {
      const a = new Vec2(1, 2);
      const b = new Vec2(3, 4);
      a.add(b);
      expect(a.x).toBe(4);
      expect(a.y).toBe(6);
      a.subtract(b);
      expect(a.x).toBe(1);
      expect(a.y).toBe(2);
    });

    it('subtractNew returns a new vector', () => {
      const a = new Vec2(10, 10);
      const b = new Vec2(3, 4);
      const c = a.subtractNew(b);
      expect(c).not.toBe(a);
      expect(c.x).toBe(7);
      expect(c.y).toBe(6);
      // a unchanged
      expect(a.x).toBe(10);
    });

    it('computes length and lengthSquared', () => {
      const v = new Vec2(3, 4);
      expect(v.lengthSquared).toBe(25);
      expect(v.length).toBe(5);
    });

    it('computes angle', () => {
      const v = new Vec2(1, 0);
      expect(v.angle).toBeCloseTo(0);
      const v2 = new Vec2(0, 1);
      expect(v2.angle).toBeCloseTo(Math.PI / 2);
      const v3 = new Vec2(-1, 0);
      expect(v3.angle).toBeCloseTo(Math.PI);
    });

    it('is iterable', () => {
      const v = new Vec2(1, 2);
      const [x, y] = v;
      expect(x).toBe(1);
      expect(y).toBe(2);
    });
  });

  describe('Particle', () => {
    it('initializes with position and pinned state', () => {
      const p = new Particle({ x: 5, y: 10, pinned: true, id: 3, char: 'A', config: {} });
      expect(p.pos.x).toBe(5);
      expect(p.pos.y).toBe(10);
      expect(p.pinned).toBe(true);
      expect(p.id).toBe(3);
      expect(p.char).toBe('A');
    });

    it('update does nothing for pinned particles', () => {
      const p = new Particle({
        x: 5, y: 10, pinned: true, id: 0, char: ' ', config: K.DEFAULT_PHYSICS
      });
      p.update(16);
      expect(p.pos.x).toBe(5);
      expect(p.pos.y).toBe(10);
      expect(p.velocity.x).toBe(0);
    });

    it('update applies gravity to free particles', () => {
      const p = new Particle({
        x: 0, y: 0, pinned: false, id: 0, char: ' ', config: K.DEFAULT_PHYSICS
      });
      p.update(16);
      // Unpinned free particle should fall under gravity
      expect(p.pos.y).toBeGreaterThan(0);
    });

    it('contain keeps particles within bounds', () => {
      const config = { ...K.DEFAULT_PHYSICS, width: 100, height: 100 };
      const p = new Particle({
        x: -5, y: 50, pinned: false, id: 0, char: ' ', config
      });
      p.contain();
      expect(p.pos.x).toBeGreaterThanOrEqual(K.CONTAIN_BOUND_RADIUS);
    });

    it('applyForce accumulates acceleration', () => {
      const p = new Particle({
        x: 0, y: 0, pinned: false, id: 0, char: ' ', config: K.DEFAULT_PHYSICS
      });
      p.applyForce(new Vec2(3, 4));
      expect(p.acceleration.x).toBe(3);
      expect(p.acceleration.y).toBe(4);
    });
  });

  describe('Constraint', () => {
    it('keeps endpoints within stretch limits', () => {
      const config = {
        ...K.DEFAULT_PHYSICS,
        compressFactor: 0.02,
        stretchFactor: 1.1,
      };
      const p1 = new Particle({ x: 0, y: 0, id: 0, config });
      const p2 = new Particle({ x: 100, y: 0, id: 1, config });
      const c = new Constraint({ p1, p2, length: 10, id: 5, config });

      // Solve pulls endpoints toward each other when distance > maxLength
      c.solve();
      const dist = Math.hypot(p2.pos.x - p1.pos.x, p2.pos.y - p1.pos.y);
      expect(dist).toBeLessThanOrEqual(10 * config.stretchFactor + 0.001);
    });

    it('does nothing when within bounds', () => {
      const config = {
        ...K.DEFAULT_PHYSICS,
        compressFactor: 0.02,
        stretchFactor: 1.1,
      };
      const p1 = new Particle({ x: 0, y: 0, pinned: true, id: 0, config });
      const p2 = new Particle({ x: 10, y: 0, id: 1, config });
      const c = new Constraint({ p1, p2, length: 10, id: 5, config });

      const before1 = p1.pos.clone();
      const before2 = p2.pos.clone();
      c.solve();
      expect(p1.pos.x).toBe(before1.x);
      expect(p2.pos.x).toBe(before2.x);
    });
  });

  describe('sizeCanvas', () => {
    it('sets canvas dimensions and style', () => {
      const canvas = document.createElement('canvas');
      sizeCanvas(canvas, 100, 200, 2);
      expect(canvas.width).toBe(200);
      expect(canvas.height).toBe(400);
      expect(canvas.style.width).toBe('100px');
      expect(canvas.style.height).toBe('200px');
    });

    it('applies dpr scaling', () => {
      const canvas = document.createElement('canvas');
      sizeCanvas(canvas, 100, 200, 1);
      expect(canvas.width).toBe(100);
      expect(canvas.height).toBe(200);
    });
  });

  describe('Input', () => {
    it('binds document listeners', () => {
      const bindSpy = vi.spyOn(document, 'addEventListener');
      // eslint-disable-next-line no-new
      new Input({
        c: document.createElement('canvas'),
        particles: [],
        originX: 0,
        originY: 0,
        canvasW: 100,
        canvasH: 100,
        config: K.DEFAULT_PHYSICS,
      });
      expect(bindSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
      expect(bindSpy).toHaveBeenCalledWith('pointerup', expect.any(Function));
      expect(bindSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));
      expect(bindSpy).toHaveBeenCalledWith('contextmenu', expect.any(Function));
      bindSpy.mockRestore();
    });

    it('can bind and unbind without throwing', () => {
      const input = new Input({
        c: document.createElement('canvas'),
        particles: [],
        originX: 0,
        originY: 0,
        canvasW: 100,
        canvasH: 100,
        config: K.DEFAULT_PHYSICS,
      });
      expect(() => input.unbind()).not.toThrow();
    });
  });
});