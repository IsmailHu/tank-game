// The game simulation. Pure logic, no DOM, so the host can run it for everyone.

import {
  BARREL_LENGTH, CELL, DT, FIRE_COOLDOWN, MATCH_END_DELAY, MAX_BULLETS_PER_TANK, ROUND_END_DELAY,
  TANK_RADIUS, TANK_REVERSE_FACTOR, TANK_SPEED, TANK_TURN_SPEED,
} from './constants';
import {
  BULLETS, HOMING_DELAY, HOMING_TURN, ITEM_FIRST_DELAY, ITEM_INTERVAL_MAX, ITEM_INTERVAL_MIN, maxPickups,
  MINIGUN_INTERVAL, MINIGUN_SPREAD, PICKUP_RADIUS, POWERS, RAPID_COOLDOWN, RAY_LENGTH, RAY_SAFE_DISTANCE,
  rollPower, SHARD_COUNT, SPEED_BOOST, SPEED_TURN_BOOST, type BulletKind, type PowerKind,
} from './items';
import { generateMaze, mazeSizeFor, type Maze } from './maze';
import { moveBouncing, resolveWalls } from './physics';
import { Rng } from './rng';
import { DEFAULT_SETTINGS, type MatchSettings } from './settings';

export interface TankInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
}

export const NO_INPUT: TankInput = { up: false, down: false, left: false, right: false, fire: false };

export interface Player {
  id: number;
  name: string;
  color: string;
}

export interface Tank extends Player {
  x: number;
  y: number;
  angle: number;
  prevX: number;
  prevY: number;
  prevAngle: number;
  alive: boolean;
  score: number;
  /** Active power-up (one at a time; picking up another replaces it). */
  power: PowerKind | null;
  powerTime: number;
  /** A frag bomb this tank fired that hasn't gone off yet (fire again to detonate). */
  fragId: number | null;
  cooldown: number;
  fireHeld: boolean;
}

export interface Bullet {
  id: number;
  owner: number;
  kind: BulletKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  prevX: number;
  prevY: number;
  age: number;
  /** Becomes true once the bullet has left its owner, after which it can hit them. */
  armed: boolean;
}

export interface Pickup {
  id: number;
  kind: PowerKind;
  x: number;
  y: number;
}

export type GameEvent =
  | { type: 'explode'; x: number; y: number; color: string }
  | { type: 'fire'; x: number; y: number; angle: number; kind: BulletKind }
  | { type: 'pickup'; x: number; y: number; kind: PowerKind }
  | { type: 'ray'; points: number[]; color: string }
  | { type: 'frag'; x: number; y: number }
  | { type: 'shield'; x: number; y: number }
  | { type: 'roundStart'; round: number }
  | { type: 'roundEnd'; winner: number | null }
  | { type: 'matchEnd'; winner: number };

export type Phase = 'playing' | 'roundOver' | 'matchOver';

export interface GameState {
  seed: number;
  settings: MatchSettings;
  round: number;
  /** Player count the current maze was generated for. */
  mazePlayers: number;
  tick: number;
  maze: Maze;
  tanks: Tank[];
  bullets: Bullet[];
  pickups: Pickup[];
  phase: Phase;
  phaseTimer: number;
  matchWinner: number | null;
  itemTimer: number;
  nextId: number;
  /** Random numbers for in-round events (item spawns). Host only. */
  rng: Rng;
  /** Events since the renderer last cleared them (explosions, shots...). */
  events: GameEvent[];
}

export function createGame(players: Player[], seed: number, settings: MatchSettings = DEFAULT_SETTINGS): GameState {
  const state: GameState = {
    seed,
    settings: { ...settings },
    round: 0,
    mazePlayers: players.length,
    tick: 0,
    maze: generateMaze(1, 1, new Rng(seed)),
    tanks: players.map((p) => ({
      id: p.id, name: p.name, color: p.color,
      x: 0, y: 0, angle: 0, prevX: 0, prevY: 0, prevAngle: 0,
      alive: true, score: 0, power: null, powerTime: 0, fragId: null, cooldown: 0, fireHeld: false,
    })),
    bullets: [],
    pickups: [],
    phase: 'playing',
    phaseTimer: 0,
    matchWinner: null,
    itemTimer: 0,
    nextId: 1,
    rng: new Rng(seed ^ 0x5bd1e995),
    events: [],
  };
  startRound(state);
  return state;
}

/** Deterministic maze for a round, so peers can rebuild it from (seed, round, players). */
export function mazeForRound(seed: number, round: number, players: number): { maze: Maze; rng: Rng } {
  const rng = new Rng((seed ^ Math.imul(round, 0x9e3779b1)) >>> 0);
  const { cols, rows } = mazeSizeFor(players, rng);
  return { maze: generateMaze(cols, rows, rng), rng };
}

export function startRound(state: GameState): void {
  state.round++;
  state.mazePlayers = state.tanks.length;
  const { maze, rng } = mazeForRound(state.seed, state.round, state.mazePlayers);
  state.maze = maze;
  state.bullets = [];
  state.pickups = [];
  state.phase = 'playing';
  state.phaseTimer = 0;
  state.itemTimer = ITEM_FIRST_DELAY;

  const cells = spawnCells(maze.cols, maze.rows, state.tanks.length, rng);
  state.tanks.forEach((t, i) => {
    const [c, r] = cells[i];
    t.x = t.prevX = (c + 0.5) * CELL;
    t.y = t.prevY = (r + 0.5) * CELL;
    t.angle = t.prevAngle = rng.int(0, 3) * (Math.PI / 2);
    t.alive = true;
    t.power = null;
    t.powerTime = 0;
    t.fragId = null;
    t.cooldown = 0;
    t.fireHeld = true; // ignore a fire key still held from last round
  });
  state.events.push({ type: 'roundStart', round: state.round });
}

/** Remove a player who left mid-game. */
export function removeTank(state: GameState, id: number): void {
  const t = state.tanks.find((t) => t.id === id);
  if (!t) return;
  if (t.alive) state.events.push({ type: 'explode', x: t.x, y: t.y, color: t.color });
  state.tanks = state.tanks.filter((t) => t.id !== id);
  state.bullets = state.bullets.filter((b) => b.owner !== id);
}

/** Pick spawn cells that are spread out across the maze. */
function spawnCells(cols: number, rows: number, count: number, rng: Rng): [number, number][] {
  const all: [number, number][] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) all.push([c, r]);
  for (let i = all.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [all[i], all[j]] = [all[j], all[i]];
  }
  for (let minDist = Math.floor((cols + rows) / 2); minDist >= 0; minDist--) {
    const chosen: [number, number][] = [];
    for (const cell of all) {
      if (chosen.every(([c, r]) => Math.abs(c - cell[0]) + Math.abs(r - cell[1]) >= minDist)) chosen.push(cell);
      if (chosen.length === count) return chosen;
    }
  }
  return all.slice(0, count);
}

export function step(state: GameState, inputs: Map<number, TankInput>): void {
  state.tick++;
  const walls = state.maze.walls;

  if (state.phase === 'matchOver') {
    for (const t of state.tanks) {
      t.prevX = t.x;
      t.prevY = t.y;
      t.prevAngle = t.angle;
    }
    state.phaseTimer = Math.max(0, state.phaseTimer - DT);
    return;
  }

  // Tanks
  for (const t of state.tanks) {
    t.prevX = t.x;
    t.prevY = t.y;
    t.prevAngle = t.angle;
    if (!t.alive) continue;
    const input = inputs.get(t.id) ?? NO_INPUT;

    if (t.power) {
      t.powerTime -= DT;
      if (t.powerTime <= 0) {
        t.power = null;
        t.powerTime = 0;
      }
    }

    const fast = t.power === 'speed';
    const turn = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    t.angle += turn * TANK_TURN_SPEED * (fast ? SPEED_TURN_BOOST : 1) * DT;
    const move = (input.up ? 1 : 0) - (input.down ? TANK_REVERSE_FACTOR : 0);
    const speed = TANK_SPEED * (fast ? SPEED_BOOST : 1);
    t.x += Math.cos(t.angle) * move * speed * DT;
    t.y += Math.sin(t.angle) * move * speed * DT;
    resolveWalls(t, TANK_RADIUS, walls);

    t.cooldown = Math.max(0, t.cooldown - DT);
    handleFire(state, t, input);
    t.fireHeld = input.fire;
  }
  separateTanks(state.tanks);
  for (const t of state.tanks) if (t.alive) resolveWalls(t, TANK_RADIUS, walls);

  // Pickups
  collectPickups(state);
  if (state.settings.items && state.phase === 'playing') {
    state.itemTimer -= DT;
    if (state.itemTimer <= 0) {
      state.itemTimer = ITEM_INTERVAL_MIN + state.rng.next() * (ITEM_INTERVAL_MAX - ITEM_INTERVAL_MIN);
      if (state.pickups.length < maxPickups(state.tanks.length)) spawnPickup(state);
    }
  }

  // Bullets
  const survivors: Bullet[] = [];
  const spawned: Bullet[] = [];
  for (const b of state.bullets) {
    b.prevX = b.x;
    b.prevY = b.y;
    b.age += DT;
    const def = BULLETS[b.kind];
    if (b.age > def.life) {
      if (b.kind === 'frag') detonate(state, b, spawned);
      continue;
    }
    if (b.kind === 'homing' && b.age > HOMING_DELAY) steerHoming(state, b);
    moveBouncing(b, def.radius, DT, walls);
    if (hitTank(state, b, spawned)) continue;
    survivors.push(b);
  }
  state.bullets = survivors.concat(spawned);

  // Round flow
  const alive = state.tanks.filter((t) => t.alive);
  const minAlive = state.tanks.length > 1 ? 1 : 0;
  if (state.phase === 'playing' && alive.length <= minAlive) {
    state.phase = 'roundOver';
    state.phaseTimer = ROUND_END_DELAY;
  } else if (state.phase === 'roundOver') {
    state.phaseTimer -= DT;
    if (state.phaseTimer <= 0) {
      const winner = alive.length === 1 && state.tanks.length > 1 ? alive[0] : null;
      if (winner) winner.score++;
      state.events.push({ type: 'roundEnd', winner: winner?.id ?? null });
      const target = state.settings.pointsToWin;
      if (winner && target > 0 && winner.score >= target) {
        state.phase = 'matchOver';
        state.phaseTimer = MATCH_END_DELAY;
        state.matchWinner = winner.id;
        state.events.push({ type: 'matchEnd', winner: winner.id });
      } else {
        startRound(state);
      }
    }
  }
}

// ---------- Firing ----------

function handleFire(state: GameState, t: Tank, input: TankInput): void {
  const pressed = input.fire && !t.fireHeld;

  // A frag bomb in flight: the next press detonates it.
  if (t.fragId !== null) {
    const bomb = state.bullets.find((b) => b.id === t.fragId);
    if (!bomb) t.fragId = null;
    else if (pressed) {
      const spawned: Bullet[] = [];
      detonate(state, bomb, spawned);
      state.bullets = state.bullets.filter((b) => b !== bomb).concat(spawned);
      return;
    }
  }

  switch (t.power) {
    case 'minigun':
      if (input.fire && t.cooldown === 0) {
        const spread = (state.rng.next() - 0.5) * 2 * MINIGUN_SPREAD;
        fireBullet(state, t, 'mini', t.angle + spread);
        t.cooldown = MINIGUN_INTERVAL;
      }
      return;
    case 'rapid':
      if (pressed && t.cooldown === 0) {
        fireBullet(state, t, 'rapid', t.angle);
        t.cooldown = RAPID_COOLDOWN;
      }
      return;
    case 'homing':
      if (pressed) {
        fireBullet(state, t, 'homing', t.angle);
        clearPower(t);
      }
      return;
    case 'frag':
      if (pressed) {
        t.fragId = fireBullet(state, t, 'frag', t.angle).id;
        clearPower(t);
      }
      return;
    case 'ray':
      if (pressed) {
        fireRay(state, t);
        clearPower(t);
      }
      return;
    default:
      if (pressed && t.cooldown === 0) {
        const own = state.bullets.filter((b) => b.owner === t.id && b.kind === 'basic').length;
        if (own < MAX_BULLETS_PER_TANK) {
          fireBullet(state, t, 'basic', t.angle);
          t.cooldown = FIRE_COOLDOWN;
        }
      }
  }
}

function clearPower(t: Tank): void {
  t.power = null;
  t.powerTime = 0;
}

function fireBullet(state: GameState, t: Tank, kind: BulletKind, angle: number): Bullet {
  const def = BULLETS[kind];
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const b: Bullet = {
    id: state.nextId++, owner: t.id, kind,
    x: t.x, y: t.y, vx: dx * def.speed, vy: dy * def.speed,
    prevX: t.x, prevY: t.y, age: 0, armed: false,
  };
  // Travel from the tank's centre to the barrel tip with collisions, so firing
  // point-blank into a wall bounces straight back (as it should).
  moveBouncing(b, def.radius, BARREL_LENGTH / def.speed, state.maze.walls);
  b.prevX = b.x;
  b.prevY = b.y;
  state.bullets.push(b);
  state.events.push({ type: 'fire', x: b.x, y: b.y, angle, kind });
  return b;
}

function detonate(state: GameState, bomb: Bullet, out: Bullet[]): void {
  const def = BULLETS.shard;
  for (let i = 0; i < SHARD_COUNT; i++) {
    const a = (i / SHARD_COUNT) * Math.PI * 2 + state.rng.next() * 0.2;
    const s = def.speed * (0.8 + state.rng.next() * 0.4);
    out.push({
      id: state.nextId++, owner: bomb.owner, kind: 'shard',
      x: bomb.x, y: bomb.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      prevX: bomb.x, prevY: bomb.y, age: 0, armed: true,
    });
  }
  const owner = state.tanks.find((t) => t.id === bomb.owner);
  if (owner && owner.fragId === bomb.id) owner.fragId = null;
  state.events.push({ type: 'frag', x: bomb.x, y: bomb.y });
}

function steerHoming(state: GameState, b: Bullet): void {
  let best: Tank | null = null;
  let bestD = Infinity;
  for (const t of state.tanks) {
    if (!t.alive || t.id === b.owner) continue;
    const d = Math.hypot(t.x - b.x, t.y - b.y);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  if (!best) return;
  const speed = Math.hypot(b.vx, b.vy);
  const cur = Math.atan2(b.vy, b.vx);
  const want = Math.atan2(best.y - b.y, best.x - b.x);
  let diff = want - cur;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  const maxTurn = HOMING_TURN * DT;
  const a = cur + Math.max(-maxTurn, Math.min(maxTurn, diff));
  b.vx = Math.cos(a) * speed;
  b.vy = Math.sin(a) * speed;
}

/** Instant beam that bounces off walls and destroys every tank it touches. */
function fireRay(state: GameState, t: Tank): void {
  const p = { x: t.x, y: t.y, vx: Math.cos(t.angle), vy: Math.sin(t.angle) };
  const points = [t.x, t.y];
  const stepLen = 2;
  const hit = new Set<number>();
  for (let d = 0; d < RAY_LENGTH; d += stepLen) {
    const bounces = moveBouncing(p, 1, stepLen, state.maze.walls);
    if (bounces > 0) points.push(p.x, p.y);
    for (const tank of state.tanks) {
      if (!tank.alive || hit.has(tank.id)) continue;
      if (tank.id === t.id && (d < RAY_SAFE_DISTANCE || !state.settings.selfDamage)) continue;
      if (Math.hypot(tank.x - p.x, tank.y - p.y) < TANK_RADIUS) hit.add(tank.id);
    }
  }
  points.push(p.x, p.y);
  state.events.push({ type: 'ray', points: points.map((v) => Math.round(v)), color: POWERS.ray.color });
  for (const tank of state.tanks) if (hit.has(tank.id)) damageTank(state, tank);
}

// ---------- Hits ----------

/** Returns true if the tank was destroyed (false if a shield saved it). */
function damageTank(state: GameState, t: Tank): boolean {
  if (t.power === 'shield') {
    state.events.push({ type: 'shield', x: t.x, y: t.y });
    return false;
  }
  t.alive = false;
  t.fragId = null;
  state.events.push({ type: 'explode', x: t.x, y: t.y, color: t.color });
  return true;
}

function hitTank(state: GameState, b: Bullet, spawned: Bullet[]): boolean {
  const reach = TANK_RADIUS + BULLETS[b.kind].radius;
  for (const t of state.tanks) {
    if (!t.alive) continue;
    const d = Math.hypot(t.x - b.x, t.y - b.y);
    if (t.id === b.owner) {
      if (!state.settings.selfDamage) continue;
      if (!b.armed) {
        if (d > reach) b.armed = true;
        continue;
      }
    }
    if (d < reach - 2) {
      // A frag bomb that hits a tank bursts on impact.
      if (b.kind === 'frag') detonate(state, b, spawned);
      damageTank(state, t);
      return true;
    }
  }
  return false;
}

// ---------- Pickups ----------

function spawnPickup(state: GameState): void {
  const { cols, rows } = state.maze;
  for (let attempt = 0; attempt < 20; attempt++) {
    const x = (state.rng.int(0, cols - 1) + 0.5) * CELL;
    const y = (state.rng.int(0, rows - 1) + 0.5) * CELL;
    const nearTank = state.tanks.some((t) => t.alive && Math.hypot(t.x - x, t.y - y) < CELL * 1.5);
    const taken = state.pickups.some((p) => p.x === x && p.y === y);
    if (nearTank || taken) continue;
    state.pickups.push({ id: state.nextId++, kind: rollPower(state.rng.next()), x, y });
    return;
  }
}

function collectPickups(state: GameState): void {
  if (!state.pickups.length) return;
  state.pickups = state.pickups.filter((p) => {
    for (const t of state.tanks) {
      if (!t.alive || Math.hypot(t.x - p.x, t.y - p.y) > TANK_RADIUS + PICKUP_RADIUS) continue;
      t.power = p.kind;
      t.powerTime = POWERS[p.kind].duration;
      t.cooldown = 0;
      state.events.push({ type: 'pickup', x: p.x, y: p.y, kind: p.kind });
      return false;
    }
    return true;
  });
}

function separateTanks(tanks: Tank[]): void {
  const min = TANK_RADIUS * 2;
  for (let i = 0; i < tanks.length; i++) {
    for (let j = i + 1; j < tanks.length; j++) {
      const a = tanks[i];
      const b = tanks[j];
      if (!a.alive || !b.alive) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d >= min || d === 0) continue;
      const push = (min - d) / 2;
      a.x -= (dx / d) * push;
      a.y -= (dy / d) * push;
      b.x += (dx / d) * push;
      b.y += (dy / d) * push;
    }
  }
}
