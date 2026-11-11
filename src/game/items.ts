// Power-ups and bullet types. Tune spawn weights, durations and bullet stats here.

export type PowerKind = 'speed' | 'shield' | 'rapid' | 'minigun' | 'homing' | 'frag' | 'ray';

export interface PowerDef {
  name: string;
  /** Relative spawn chance. Higher = more common. */
  weight: number;
  /** Seconds the power lasts (one-shot weapons: seconds you have to use it). */
  duration: number;
  color: string;
}

export const POWERS: Record<PowerKind, PowerDef> = {
  speed:   { name: 'Speed',          weight: 22, duration: 5, color: '#e0a526' },
  shield:  { name: 'Shield',         weight: 20, duration: 5, color: '#3d9be0' },
  rapid:   { name: 'Rapid fire',     weight: 18, duration: 5, color: '#4fae5a' },
  minigun: { name: 'Minigun',        weight: 14, duration: 4, color: '#8a6a5c' },
  homing:  { name: 'Homing missile', weight: 12, duration: 5, color: '#d0603c' },
  frag:    { name: 'Frag bomb',      weight: 9,  duration: 5, color: '#8f55c4' },
  ray:     { name: 'Death ray',      weight: 5,  duration: 5, color: '#e23b55' },
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

export type BulletKind = 'basic' | 'mini' | 'rapid' | 'homing' | 'frag' | 'shard';

export interface BulletDef {
  radius: number;
  speed: number;
  life: number;
}

export const BULLETS: Record<BulletKind, BulletDef> = {
  basic:  { radius: 3,   speed: 175, life: 10 },
  mini:   { radius: 2,   speed: 215, life: 2.5 },
  rapid:  { radius: 2,   speed: 300, life: 4 },
  homing: { radius: 4,   speed: 150, life: 6 },
  frag:   { radius: 6,   speed: 120, life: 4 },
  shard:  { radius: 2,   speed: 240, life: 1.1 },
};

export const BULLET_KINDS = Object.keys(BULLETS) as BulletKind[];

// Item tuning
export const ITEM_FIRST_DELAY = 4; // seconds into a round before the first item
export const ITEM_INTERVAL_MIN = 5;
export const ITEM_INTERVAL_MAX = 9;
export const PICKUP_RADIUS = 11;
export const SPEED_BOOST = 1.6;
export const SPEED_TURN_BOOST = 1.3;
export const MINIGUN_INTERVAL = 0.07;
export const MINIGUN_SPREAD = 0.14; // radians
export const RAPID_COOLDOWN = 0.08;
export const HOMING_TURN = 2.8; // radians per second
export const HOMING_DELAY = 0.25; // seconds before it starts seeking
export const SHARD_COUNT = 28;
export const RAY_LENGTH = 1400;
export const RAY_SAFE_DISTANCE = 30; // the ray can't hit its owner before travelling this far

export function maxPickups(players: number): number {
  return 2 + Math.floor(players / 3);
}
