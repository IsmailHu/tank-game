// All visuals live behind this interface so the art style can be swapped
// later without touching game logic.

import type { Rect } from '../game/maze';

export interface TankLook {
  x: number;
  y: number;
  angle: number; // radians, 0 = facing right
  color: string;
}

export interface Skin {
  background: string; // around the arena
  floor: string;
  drawWalls(ctx: CanvasRenderingContext2D, walls: Rect[]): void;
  drawTank(ctx: CanvasRenderingContext2D, tank: TankLook): void;
  drawBullet(ctx: CanvasRenderingContext2D, x: number, y: number): void;
}

const INK = '#35353b';

/** Simple flat placeholder style: plain shapes, nothing final. */
export const placeholderSkin: Skin = {
  background: '#e4e1da',
  floor: '#fbfaf7',

  drawWalls(ctx, walls) {
    ctx.fillStyle = INK;
    for (const w of walls) {
      ctx.beginPath();
      ctx.roundRect(w.x, w.y, w.w, w.h, 2);
      ctx.fill();
    }
  },

  drawTank(ctx, { x, y, angle, color }) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    // shadow
    ctx.fillStyle = 'rgb(0 0 0 / 0.12)';
    ctx.beginPath();
    ctx.roundRect(-11, -9, 25, 22, 4);
    ctx.fill();
    // treads
    ctx.fillStyle = '#4a4a50';
    ctx.beginPath();
    ctx.roundRect(-13, -12, 26, 6, 2);
    ctx.roundRect(-13, 6, 26, 6, 2);
    ctx.fill();
    // hull
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-12, -9, 24, 18, 3);
    ctx.fill();
    // barrel
    ctx.fillStyle = INK;
    ctx.fillRect(0, -2.25, 18, 4.5);
    // turret
    ctx.fillStyle = color;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  },

  drawBullet(ctx, x, y) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  },
};
