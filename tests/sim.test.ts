import { describe, expect, it } from 'vitest';
import { CELL, ROUND_END_DELAY, TICK_RATE } from '../src/game/constants';
import { createGame, NO_INPUT, step, type TankInput } from '../src/game/sim';

const players = [
  { id: 1, name: 'A', color: '#0a0' },
  { id: 2, name: 'B', color: '#a00' },
];

function run(state: ReturnType<typeof createGame>, ticks: number, input: Partial<TankInput> = {}) {
  for (let i = 0; i < ticks; i++) step(state, new Map([[1, { ...NO_INPUT, ...input }]]));
}

describe('simulation', () => {
  it('W drives forward, A/D turn', () => {
    const s = createGame(players, 7);
    const t = s.tanks[0];
    const a0 = t.angle;
    run(s, 10, { right: true });
    expect(t.angle).toBeGreaterThan(a0);
    const [x0, y0] = [t.x, t.y];
    run(s, 20, { up: true });
    expect(Math.hypot(t.x - x0, t.y - y0)).toBeGreaterThan(5);
  });

  it('space fires one bullet per press', () => {
    const s = createGame(players, 7);
    run(s, 1);
    run(s, 10, { fire: true }); // held: still only one shot
    expect(s.bullets.length).toBe(1);
    run(s, 1);
    run(s, 1, { fire: true });
    expect(s.bullets.length).toBe(2);
  });

  it('shooting yourself point-blank against a wall kills you, and the other tank scores', () => {
    const s = createGame(players, 7);
    const t = s.tanks[0];
    // Put tank 1 in the top-left cell, facing the outer wall on its left.
    t.x = t.prevX = CELL / 2;
    t.y = t.prevY = CELL / 2;
    t.angle = Math.PI;
    run(s, 1);
    run(s, 1, { fire: true });
    run(s, TICK_RATE);
    expect(t.alive).toBe(false);
    expect(s.phase).toBe('roundOver');
    run(s, Math.ceil(ROUND_END_DELAY * TICK_RATE) + 2);
    expect(s.tanks[1].score).toBe(1);
    expect(s.round).toBe(2);
    expect(t.alive).toBe(true);
  });
});
