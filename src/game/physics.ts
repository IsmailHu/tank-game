import type { Rect } from './maze';

export interface Hit {
  nx: number; // push-out normal
  ny: number;
  depth: number; // how far to push out along the normal
}

/** Circle vs axis-aligned rectangle. Returns the push-out normal and depth, or null. */
export function circleRect(px: number, py: number, radius: number, r: Rect): Hit | null {
  const cx = Math.max(r.x, Math.min(px, r.x + r.w));
  const cy = Math.max(r.y, Math.min(py, r.y + r.h));
  const dx = px - cx;
  const dy = py - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= radius * radius) return null;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    return { nx: dx / d, ny: dy / d, depth: radius - d };
  }
  // Centre is inside the rectangle: push out through the nearest side.
  const left = px - r.x;
  const right = r.x + r.w - px;
  const top = py - r.y;
  const bottom = r.y + r.h - py;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { nx: -1, ny: 0, depth: left + radius };
  if (m === right) return { nx: 1, ny: 0, depth: right + radius };
  if (m === top) return { nx: 0, ny: -1, depth: top + radius };
  return { nx: 0, ny: 1, depth: bottom + radius };
}

export interface Body {
  x: number;
  y: number;
}

/** Push a circle out of all walls (a few passes handles corners). */
export function resolveWalls(body: Body, radius: number, walls: Rect[]): void {
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const w of walls) {
      const hit = circleRect(body.x, body.y, radius, w);
      if (hit) {
        body.x += hit.nx * hit.depth;
        body.y += hit.ny * hit.depth;
        moved = true;
      }
    }
    if (!moved) return;
  }
}

export interface Moving extends Body {
  vx: number;
  vy: number;
}

/** Move a bouncing circle for dt seconds, reflecting off walls. Returns number of bounces. */
export function moveBouncing(b: Moving, radius: number, dt: number, walls: Rect[]): number {
  const dist = Math.hypot(b.vx, b.vy) * dt;
  const steps = Math.max(1, Math.ceil(dist / (radius * 0.75)));
  const sdt = dt / steps;
  let bounces = 0;
  for (let i = 0; i < steps; i++) {
    b.x += b.vx * sdt;
    b.y += b.vy * sdt;
    for (const w of walls) {
      const hit = circleRect(b.x, b.y, radius, w);
      if (!hit) continue;
      b.x += hit.nx * hit.depth;
      b.y += hit.ny * hit.depth;
      const vn = b.vx * hit.nx + b.vy * hit.ny;
      if (vn < 0) {
        b.vx -= 2 * vn * hit.nx;
        b.vy -= 2 * vn * hit.ny;
        bounces++;
      }
    }
  }
  return bounces;
}
