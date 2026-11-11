// The game simulation. Pure logic, no DOM, so the host can run it for everyone later.

import {
  BARREL_LENGTH, BULLET_LIFETIME, BULLET_RADIUS, BULLET_SPEED, CELL, DT, FIRE_COOLDOWN,
  MAX_BULLETS_PER_TANK, ROUND_END_DELAY, TANK_RADIUS, TANK_REVERSE_FACTOR, TANK_SPEED, TANK_TURN_SPEED,
} from './constants';
import { generateMaze, mazeSizeFor, type Maze } from './maze';
import { moveBouncing, resolveWalls } from './physics';
import { Rng } from './rng';

export interface TankInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
}

export const NO_INPUT: TankInput = { up: false, down: false, left: false, right: false, fire: false };

// Weapon / bullet kinds: only 'basic' for now. Items (Stage 4) will add more kinds here.
export type WeaponKind = 'basic';

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
  weapon: WeaponKind;
  cooldown: number;
  fireHeld: boolean;
}

export interface Bullet {
  id: number;
  owner: number;
  kind: WeaponKind;
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

export type GameEvent =
  | { type: 'explode'; x: number; y: number; color: string }
  | { type: 'fire'; x: number; y: number; angle: number }
  | { type: 'roundStart'; round: number }
  | { type: 'roundEnd'; winner: number | null };

export interface GameState {
  seed: number;
  round: number;
  tick: number;
  maze: Maze;
  tanks: Tank[];
  bullets: Bullet[];
  phase: 'playing' | 'roundOver';
  phaseTimer: number;
  nextBulletId: number;
  /** Events since the renderer last cleared them (explosions, shots...). */
  events: GameEvent[];
}

export function createGame(players: Player[], seed: number): GameState {
  const state: GameState = {
    seed,
    round: 0,
    tick: 0,
    maze: generateMaze(1, 1, new Rng(seed)),
    tanks: players.map((p) => ({
      ...p, x: 0, y: 0, angle: 0, prevX: 0, prevY: 0, prevAngle: 0,
      alive: true, score: 0, weapon: 'basic', cooldown: 0, fireHeld: false,
    })),
    bullets: [],
    phase: 'playing',
    phaseTimer: 0,
    nextBulletId: 1,
    events: [],
  };
  startRound(state);
  return state;
}

export function startRound(state: GameState): void {
  state.round++;
  const rng = new Rng((state.seed ^ Math.imul(state.round, 0x9e3779b1)) >>> 0);
  const { cols, rows } = mazeSizeFor(state.tanks.length, rng);
  state.maze = generateMaze(cols, rows, rng);
  state.bullets = [];
  state.phase = 'playing';
  state.phaseTimer = 0;

  const cells = spawnCells(cols, rows, state.tanks.length, rng);
  state.tanks.forEach((t, i) => {
    const [c, r] = cells[i];
    t.x = t.prevX = (c + 0.5) * CELL;
    t.y = t.prevY = (r + 0.5) * CELL;
    t.angle = t.prevAngle = rng.int(0, 3) * (Math.PI / 2);
    t.alive = true;
    t.weapon = 'basic';
    t.cooldown = 0;
    t.fireHeld = true; // ignore a fire key still held from last round
  });
  state.events.push({ type: 'roundStart', round: state.round });
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

  // Tanks
  for (const t of state.tanks) {
    t.prevX = t.x;
    t.prevY = t.y;
    t.prevAngle = t.angle;
    if (!t.alive) continue;
    const input = inputs.get(t.id) ?? NO_INPUT;

    const turn = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    t.angle += turn * TANK_TURN_SPEED * DT;
    const move = (input.up ? 1 : 0) - (input.down ? TANK_REVERSE_FACTOR : 0);
    t.x += Math.cos(t.angle) * move * TANK_SPEED * DT;
    t.y += Math.sin(t.angle) * move * TANK_SPEED * DT;
    resolveWalls(t, TANK_RADIUS, walls);

    t.cooldown = Math.max(0, t.cooldown - DT);
    if (input.fire && !t.fireHeld && t.cooldown === 0) fire(state, t);
    t.fireHeld = input.fire;
  }
  separateTanks(state.tanks);
  for (const t of state.tanks) if (t.alive) resolveWalls(t, TANK_RADIUS, walls);

  // Bullets
  const survivors: Bullet[] = [];
  for (const b of state.bullets) {
    b.prevX = b.x;
    b.prevY = b.y;
    b.age += DT;
    if (b.age > BULLET_LIFETIME) continue;
    moveBouncing(b, BULLET_RADIUS, DT, walls);
    if (hitTank(state, b)) continue;
    survivors.push(b);
  }
  state.bullets = survivors;

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
      startRound(state);
    }
  }
}

function fire(state: GameState, t: Tank): void {
  if (state.bullets.filter((b) => b.owner === t.id).length >= MAX_BULLETS_PER_TANK) return;
  t.cooldown = FIRE_COOLDOWN;
  const dx = Math.cos(t.angle);
  const dy = Math.sin(t.angle);
  const b: Bullet = {
    id: state.nextBulletId++, owner: t.id, kind: t.weapon,
    x: t.x, y: t.y, vx: dx * BULLET_SPEED, vy: dy * BULLET_SPEED,
    prevX: t.x, prevY: t.y, age: 0, armed: false,
  };
  // Travel from the tank's centre to the barrel tip with collisions, so firing
  // point-blank into a wall bounces straight back (as it should).
  moveBouncing(b, BULLET_RADIUS, BARREL_LENGTH / BULLET_SPEED, state.maze.walls);
  b.prevX = b.x;
  b.prevY = b.y;
  state.bullets.push(b);
  state.events.push({ type: 'fire', x: b.x, y: b.y, angle: t.angle });
}

function hitTank(state: GameState, b: Bullet): boolean {
  const reach = TANK_RADIUS + BULLET_RADIUS;
  for (const t of state.tanks) {
    if (!t.alive) continue;
    const d = Math.hypot(t.x - b.x, t.y - b.y);
    if (t.id === b.owner && !b.armed) {
      if (d > reach) b.armed = true;
      continue;
    }
    if (d < reach - 2) {
      t.alive = false;
      state.events.push({ type: 'explode', x: t.x, y: t.y, color: t.color });
      return true;
    }
  }
  return false;
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
