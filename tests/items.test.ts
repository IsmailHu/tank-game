import { describe, expect, it } from 'vitest';
import { CELL, TICK_RATE } from '../src/game/constants';
import { POWER_KINDS, POWERS, rollPower, SHARD_COUNT, type PowerKind } from '../src/game/items';
import { DEFAULT_SETTINGS } from '../src/game/settings';
import { createGame, NO_INPUT, step, type GameState, type TankInput } from '../src/game/sim';

const players = [
  { id: 1, name: 'A', color: '#0a0' },
  { id: 2, name: 'B', color: '#a00' },
];

function game(settings = {}): GameState {
  const s = createGame(players, 11, { ...DEFAULT_SETTINGS, items: false, ...settings });
  // Open arena: remove interior walls so tests don't depend on maze layout.
  s.maze.walls = s.maze.walls.filter((w) =>
    w.x <= 0 || w.y <= 0 || w.x + w.w >= s.maze.width || w.y + w.h >= s.maze.height);
  return s;
}

function place(s: GameState, id: number, cx: number, cy: number, angle = 0) {
  const t = s.tanks.find((t) => t.id === id)!;
  t.x = t.prevX = (cx + 0.5) * CELL;
  t.y = t.prevY = (cy + 0.5) * CELL;
  t.angle = t.prevAngle = angle;
  return t;
}

function give(s: GameState, id: number, power: PowerKind) {
  const t = s.tanks.find((t) => t.id === id)!;
  t.power = power;
  t.powerTime = POWERS[power].duration;
}

function run(s: GameState, ticks: number, p1: Partial<TankInput> = {}) {
  for (let i = 0; i < ticks; i++) step(s, new Map([[1, { ...NO_INPUT, ...p1 }]]));
}

const tap = (s: GameState) => {
  run(s, 1);
  run(s, 1, { fire: true });
  run(s, 1);
};

describe('spawn weights', () => {
  it('death ray is the rarest, speed the most common', () => {
    const counts = Object.fromEntries(POWER_KINDS.map((k) => [k, 0])) as Record<PowerKind, number>;
    for (let i = 0; i < 10000; i++) counts[rollPower(i / 10000)]++;
    expect(Math.min(...Object.values(counts))).toBe(counts.ray);
    expect(Math.max(...Object.values(counts))).toBe(counts.speed);
    expect(counts.ray / 10000).toBeCloseTo(0.05, 2);
  });

  it('every power lasts 5 seconds or less', () => {
    for (const k of POWER_KINDS) expect(POWERS[k].duration).toBeLessThanOrEqual(5);
  });
});

describe('pickups', () => {
  it('spawn when items are on and are collected by driving over them', () => {
    const s = game({ items: true });
    run(s, TICK_RATE * 5);
    expect(s.pickups.length).toBeGreaterThan(0);
    const p = s.pickups[0];
    const t = s.tanks[0];
    t.x = p.x;
    t.y = p.y;
    run(s, 1);
    expect(t.power).toBe(p.kind);
  });

  it('never spawn when items are off', () => {
    const s = game({ items: false });
    run(s, TICK_RATE * 20);
    expect(s.pickups.length).toBe(0);
  });

  it('powers wear off', () => {
    const s = game();
    give(s, 1, 'speed');
    run(s, Math.ceil(TICK_RATE * 5.1));
    expect(s.tanks[0].power).toBeNull();
  });
});

describe('powers', () => {
  it('speed makes you faster', () => {
    const a = game();
    const b = game();
    place(a, 1, 0, 0, 0);
    place(b, 1, 0, 0, 0);
    give(b, 1, 'speed');
    run(a, 20, { up: true });
    run(b, 20, { up: true });
    expect(b.tanks[0].x).toBeGreaterThan(a.tanks[0].x + 10);
  });

  it('shield blocks a hit', () => {
    const s = game();
    place(s, 1, 0, 0, 0);
    const victim = place(s, 2, 3, 0, 0);
    give(s, 2, 'shield');
    tap(s);
    run(s, TICK_RATE);
    expect(victim.alive).toBe(true);
  });

  it('rapid fire has no bullet limit', () => {
    const s = game({ selfDamage: false }); // shots bounce straight back in the open test arena
    place(s, 1, 0, 0, Math.PI / 2);
    give(s, 1, 'rapid');
    for (let i = 0; i < 10; i++) {
      run(s, 5);
      run(s, 1, { fire: true });
    }
    expect(s.bullets.filter((b) => b.kind === 'rapid').length).toBe(10);
  });

  it('minigun fires continuously while held', () => {
    const s = game();
    place(s, 1, 0, 0, Math.PI / 2);
    give(s, 1, 'minigun');
    run(s, 1);
    run(s, 30, { fire: true });
    expect(s.bullets.filter((b) => b.kind === 'mini').length).toBeGreaterThan(5);
  });

  it('death ray instantly destroys a tank in line', () => {
    const s = game();
    place(s, 1, 0, 0, 0);
    const victim = place(s, 2, 4, 0, 0);
    give(s, 1, 'ray');
    run(s, 1);
    run(s, 1, { fire: true });
    expect(victim.alive).toBe(false);
    expect(s.tanks[0].power).toBeNull();
  });

  it('frag bomb bursts into shards when fire is pressed again', () => {
    const s = game();
    place(s, 1, 0, 0, Math.PI / 2);
    give(s, 1, 'frag');
    tap(s);
    expect(s.bullets.filter((b) => b.kind === 'frag').length).toBe(1);
    run(s, 10);
    tap(s);
    expect(s.bullets.filter((b) => b.kind === 'frag').length).toBe(0);
    expect(s.bullets.filter((b) => b.kind === 'shard').length).toBe(SHARD_COUNT);
  });

  it('homing missile curves towards the enemy', () => {
    const s = game();
    place(s, 1, 0, 0, 0); // facing right
    const target = place(s, 2, 2, 2, 0); // below-right
    give(s, 1, 'homing');
    tap(s);
    run(s, TICK_RATE);
    const m = s.bullets.find((b) => b.kind === 'homing');
    expect(!m || m.vy > 0 || !target.alive).toBe(true);
  });
});
