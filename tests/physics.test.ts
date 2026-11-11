import { describe, expect, it } from 'vitest';
import { moveBouncing, resolveWalls } from '../src/game/physics';

describe('bullet bounces', () => {
  const wall = { x: 100, y: -50, w: 4, h: 100 }; // vertical wall at x=100

  it('reflects off a wall head-on', () => {
    const b = { x: 90, y: 0, vx: 200, vy: 0 };
    const bounces = moveBouncing(b, 3, 0.1, [wall]);
    expect(bounces).toBe(1);
    expect(b.vx).toBeLessThan(0);
    expect(b.x).toBeLessThan(100 - 3 + 1e-6);
  });

  it('keeps tangential speed on an angled hit', () => {
    const b = { x: 90, y: 0, vx: 150, vy: 80 };
    moveBouncing(b, 3, 0.1, [wall]);
    expect(b.vx).toBeCloseTo(-150);
    expect(b.vy).toBeCloseTo(80);
  });

  it('does not tunnel through a thin wall at high speed', () => {
    const b = { x: 50, y: 0, vx: 3000, vy: 0 };
    moveBouncing(b, 3, 1 / 60, [wall]);
    expect(b.x).toBeLessThan(100);
  });
});

describe('tank vs walls', () => {
  it('pushes a tank out of a wall', () => {
    const t = { x: 95, y: 0 };
    resolveWalls(t, 13, [{ x: 100, y: -50, w: 4, h: 100 }]);
    expect(t.x).toBeCloseTo(87);
  });
});
