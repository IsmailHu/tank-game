// All gameplay tuning in one place. Units: world pixels and seconds.

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

// Maze
export const CELL = 64; // cell size (corridor width ≈ CELL - WALL)
export const WALL = 4; // wall thickness
export const EXTRA_OPENINGS = 0.3; // fraction of interior walls knocked out to create loops

// Tanks
export const TANK_RADIUS = 13; // collision circle
export const TANK_SPEED = 115;
export const TANK_REVERSE_FACTOR = 0.7;
export const TANK_TURN_SPEED = 3.6; // radians per second

// Bullets
export const BULLET_RADIUS = 3;
export const BULLET_SPEED = 175;
export const BULLET_LIFETIME = 10;
export const MAX_BULLETS_PER_TANK = 5;
export const FIRE_COOLDOWN = 0.12;
export const BARREL_LENGTH = 18;

// Rounds
export const ROUND_END_DELAY = 3;
