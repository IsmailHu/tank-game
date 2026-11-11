import { describe, expect, it } from 'vitest';
import { CELL, ROUND_END_DELAY, TICK_RATE } from '../src/game/constants';
import { DEFAULT_SETTINGS } from '../src/game/settings';
import { createGame, NO_INPUT, step, type TankInput } from '../src/game/sim';
import { applySnapshot, makeSnapshot } from '../src/game/snapshot';
import { decodeInput, encodeInput, FireLatch } from '../src/input/keyboard';

const players = [
  { id: 1, name: 'A', color: '#0a0' },
  { id: 2, name: 'B', color: '#a00' },
];

const run = (s: ReturnType<typeof createGame>, ticks: number, input: Partial<TankInput> = {}) => {
  for (let i = 0; i < ticks; i++) step(s, new Map([[1, { ...NO_INPUT, ...input }]]));
};

function selfShot(selfDamage: boolean, pointsToWin = 5) {
  const s = createGame(players, 7, { ...DEFAULT_SETTINGS, selfDamage, pointsToWin });
  const t = s.tanks[0];
  t.x = t.prevX = CELL / 2;
  t.y = t.prevY = CELL / 2;
  t.angle = Math.PI;
  run(s, 1);
  run(s, 1, { fire: true });
  run(s, TICK_RATE);
  return s;
}

describe('match settings', () => {
  it('self-damage off: your own bullets pass through you', () => {
    expect(selfShot(false).tanks[0].alive).toBe(true);
    expect(selfShot(true).tanks[0].alive).toBe(false);
  });

  it('reaching points-to-win ends the match', () => {
    const s = selfShot(true, 1);
    run(s, Math.ceil(ROUND_END_DELAY * TICK_RATE) + 2);
    expect(s.phase).toBe('matchOver');
    expect(s.matchWinner).toBe(2);
  });
});

describe('snapshots', () => {
  it('a guest copy follows the host across rounds', () => {
    const host = createGame(players, 99);
    const guest = createGame(players, 99);
    run(host, 30, { up: true, right: true });
    applySnapshot(guest, makeSnapshot(host, []));
    expect(guest.tanks[0].x).toBeCloseTo(host.tanks[0].x, 1);

    // Force a new round on the host; the guest must rebuild the same maze.
    host.tanks[1].alive = false;
    run(host, Math.ceil(ROUND_END_DELAY * TICK_RATE) + 3);
    expect(host.round).toBe(2);
    applySnapshot(guest, makeSnapshot(host, []));
    expect(guest.round).toBe(2);
    expect(guest.maze.walls).toEqual(host.maze.walls);
    expect(guest.tanks[0].score).toBe(1);
  });
});

describe('input encoding', () => {
  it('round-trips a bitmask', () => {
    const i = { up: true, down: false, left: true, right: false, fire: true };
    expect(decodeInput(encodeInput(i))).toEqual(i);
  });

  it('a quick tap between ticks still fires once', () => {
    const latch = new FireLatch();
    const held = { ...NO_INPUT };
    expect(latch.apply({ held, firePresses: 0 }).fire).toBe(false);
    expect(latch.apply({ held, firePresses: 1 }).fire).toBe(true); // tapped and released already
    expect(latch.apply({ held, firePresses: 1 }).fire).toBe(false);
  });
});
