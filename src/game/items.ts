// Power-ups and bullet types. Tune spawn weights, durations and bullet stats here.

export type PowerKind =
  | 'speed' | 'shield' | 'rapid' | 'shotgun' | 'minigun' | 'ghost' | 'mines' | 'homing' | 'cloak' | 'frag' | 'ray';

export interface PowerDef {
  name: string;
  /** Relative spawn chance. Higher = more common. */
  weight: number;
  /** Seconds the power lasts (one-shot weapons: seconds you have to use it). */
  duration: number;
  color: string;
  /** Uses before the power is spent (weapons with limited shots). */
  charges?: number;
}

export const POWERS: Record<PowerKind, PowerDef> = {
  speed:   { name: 'Speed',          weight: 18, duration: 5, color: '#e0a526' },
  shield:  { name: 'Shield',         weight: 16, duration: 5, color: '#3d9be0' },
  rapid:   { name: 'Rapid fire',     weight: 15, duration: 5, color: '#4fae5a' },
  shotgun: { name: 'Shotgun',        weight: 13, duration: 5, color: '#c2703a', charges: 3 },
  minigun: { name: 'Minigun',        weight: 11, duration: 4, color: '#8a6a5c' },
  ghost:   { name: 'Ghost',          weight: 10, duration: 4, color: '#7d8a99' },
  homing:  { name: 'Homing missile', weight: 10, duration: 5, color: '#d0603c' },
  mines:   { name: 'Mines',          weight: 9,  duration: 5, color: '#5a6b3a', charges: 3 },
  cloak:   { name: 'Cloak',          weight: 8,  duration: 5, color: '#4b4f7a' },
  frag:    { name: 'Frag bomb',      weight: 7,  duration: 5, color: '#8f55c4' },
  ray:     { name: 'Death ray',      weight: 4,  duration: 5, color: '#e23b55' },
};

export const POWER_KINDS = Object.keys(POWERS) as PowerKind[];

/** Pick a power-up by weight. r is a random number in [0, 1). */
export function rollPower(r: number): PowerKind {
  const total = POWER_KINDS.reduce((s, k) => s + POWERS[k].weight, 0);
  let x = r * total;
  for (const k of POWER_KINDS) {
    x -= POWERS[k].weight;
    if (x < 0) return k;
  }
  return POWER_KINDS[0];
}

export type BulletKind = 'basic' | 'mini' | 'rapid' | 'homing' | 'frag' | 'shard' | 'pellet' | 'mine';

export interface BulletDef {
  radius: number;
  speed: number;
  life: number;
}

export const BULLETS: Record<BulletKind, BulletDef> = {
  basic:  { radius: 3, speed: 175, life: 5 },
  mini:   { radius: 2, speed: 215, life: 1.25 },
  rapid:  { radius: 2, speed: 300, life: 2 },
  homing: { radius: 4, speed: 150, life: 3 },
  frag:   { radius: 6, speed: 120, life: 2 },
  shard:  { radius: 2, speed: 240, life: 0.55 },
  pellet: { radius: 2, speed: 260, life: 0.5 },
  mine:   { radius: 5, speed: 0,   life: 15 },
};

export const BULLET_KINDS = Object.keys(BULLETS) as BulletKind[];

// Item tuning
export const ITEM_FIRST_DELAY = 2.5; // seconds into a round before the first item
export const ITEM_INTERVAL_MIN = 3;
export const ITEM_INTERVAL_MAX = 5.5;
export const PICKUP_RADIUS = 11;
export const SPEED_BOOST = 1.6;
export const SPEED_TURN_BOOST = 1.3;
export const MINIGUN_INTERVAL = 0.07;
export const MINIGUN_SPREAD = 0.14; // radians
export const RAPID_COOLDOWN = 0.08;
export const SHOTGUN_PELLETS = 9;
export const SHOTGUN_SPREAD = 0.45; // radians either side
export const SHOTGUN_COOLDOWN = 0.45;
export const MINE_COOLDOWN = 0.35;
export const MINE_ARM_TIME = 0.6; // seconds before a mine can go off
export const HOMING_TURN = 2.8; // radians per second
export const HOMING_DELAY = 0.25; // seconds before it starts seeking
export const SHARD_COUNT = 28;
export const RAY_LENGTH = 1400;
export const RAY_SAFE_DISTANCE = 30; // the ray can't hit its owner before travelling this far

export function maxPickups(players: number): number {
  return 3 + Math.floor(players / 3);
}
