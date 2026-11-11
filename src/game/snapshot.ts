// Compact per-tick state the host sends to guests.

import { BULLET_KINDS, POWER_KINDS } from './items';
import { mazeForRound, type GameEvent, type GameState, type Phase } from './sim';

export interface Snapshot {
  t: 'snap';
  k: number; // tick
  r: number; // round
  n: number; // players the maze was built for
  ph: Phase;
  pt: number; // phase timer
  w: number | null; // match winner
  /** [id, x, y, angle, alive, score, power index (-1 none), power seconds left, charges] */
  tk: [number, number, number, number, 0 | 1, number, number, number, number][];
  /** [id, x, y, kind index] */
  b: [number, number, number, number][];
  /** [id, kind index, x, y] */
  pk: [number, number, number, number][];
  ev: GameEvent[];
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function makeSnapshot(state: GameState, events: GameEvent[]): Snapshot {
  return {
    t: 'snap',
    k: state.tick,
    r: state.round,
    n: state.mazePlayers,
    ph: state.phase,
    pt: r2(state.phaseTimer),
    w: state.matchWinner,
    tk: state.tanks.map((t) => [
      t.id, r2(t.x), r2(t.y), Math.round(t.angle * 1000) / 1000, t.alive ? 1 : 0, t.score,
      t.power ? POWER_KINDS.indexOf(t.power) : -1, Math.round(t.powerTime * 10) / 10, t.charges,
    ]),
    b: state.bullets.map((b) => [b.id, r2(b.x), r2(b.y), BULLET_KINDS.indexOf(b.kind)]),
    pk: state.pickups.map((p) => [p.id, POWER_KINDS.indexOf(p.kind), p.x, p.y]),
    ev: events,
  };
}

/** Apply a host snapshot to a guest's local copy of the game. */
export function applySnapshot(state: GameState, s: Snapshot): void {
  const newRound = s.r !== state.round;
  if (newRound) {
    state.round = s.r;
    state.mazePlayers = s.n;
    state.maze = mazeForRound(state.seed, s.r, s.n).maze;
  }
  state.tick = s.k;
  state.phase = s.ph;
  state.phaseTimer = s.pt;
  state.matchWinner = s.w;

  const ids = new Set(s.tk.map((t) => t[0]));
  state.tanks = state.tanks.filter((t) => ids.has(t.id));
  for (const [id, x, y, angle, alive, score, power, powerTime, charges] of s.tk) {
    const t = state.tanks.find((t) => t.id === id);
    if (!t) continue;
    const teleport = newRound || !t.alive;
    t.prevX = teleport ? x : t.x;
    t.prevY = teleport ? y : t.y;
    t.prevAngle = teleport ? angle : t.angle;
    t.x = x;
    t.y = y;
    t.angle = angle;
    t.alive = alive === 1;
    t.score = score;
    t.power = power >= 0 ? POWER_KINDS[power] : null;
    t.powerTime = powerTime;
    t.charges = charges ?? 0;
  }

  const old = new Map(state.bullets.map((b) => [b.id, b]));
  state.bullets = s.b.map(([id, x, y, kind]) => {
    const prev = old.get(id);
    return {
      id, owner: 0, kind: BULLET_KINDS[kind], x, y,
      vx: prev ? x - prev.x : 0, vy: prev ? y - prev.y : 0,
      prevX: prev ? prev.x : x, prevY: prev ? prev.y : y, age: 0, armed: true,
    };
  });

  state.pickups = s.pk.map(([id, kind, x, y]) => ({ id, kind: POWER_KINDS[kind], x, y }));

  state.events.push(...s.ev);
}
