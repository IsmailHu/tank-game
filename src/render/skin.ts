// All visuals live behind this interface so the art style can be swapped
// later without touching game logic.

import { POWERS, type BulletKind, type PowerKind } from '../game/items';
import type { Rect } from '../game/maze';

export interface TankLook {
  x: number;
  y: number;
  angle: number; // radians, 0 = facing right
  color: string;
}

export interface Skin {
  background: string; // around the arena
  vignette: string; // colour the screen edges fade to
  floor: string;
  drawWalls(ctx: CanvasRenderingContext2D, walls: Rect[]): void;
  drawTank(ctx: CanvasRenderingContext2D, tank: TankLook): void;
  drawBullet(ctx: CanvasRenderingContext2D, x: number, y: number, kind: BulletKind, angle: number, time: number): void;
  drawPickup(ctx: CanvasRenderingContext2D, kind: PowerKind, x: number, y: number, time: number): void;
}

const INK = '#35353b';

/** Simple flat placeholder style: plain shapes, nothing final. */
export const placeholderSkin: Skin = {
  background: '#b9b3a7',
  vignette: 'rgb(40 36 30 / 0.35)',
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

  drawBullet(ctx, x, y, kind, angle, time) {
    switch (kind) {
      case 'homing': {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = '#f2a03d';
        ctx.beginPath();
        ctx.moveTo(-5, -2.5);
        ctx.lineTo(-10 - Math.random() * 4, 0);
        ctx.lineTo(-5, 2.5);
        ctx.fill();
        ctx.fillStyle = POWERS.homing.color;
        ctx.beginPath();
        ctx.roundRect(-6, -3, 12, 6, 3);
        ctx.fill();
        ctx.restore();
        return;
      }
      case 'frag': {
        const pulse = 1 + Math.sin(time * 14) * 0.15;
        ctx.fillStyle = POWERS.frag.color;
        ctx.beginPath();
        ctx.arc(x, y, 6 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        return;
      }
      case 'mine': {
        ctx.fillStyle = '#4a4a50';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = Math.sin(time * 6) > 0 ? '#e23b55' : '#7a2030';
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      case 'pellet':
        ctx.fillStyle = '#7a4a22';
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      case 'shard':
        ctx.fillStyle = '#c47a2c';
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      case 'mini':
      case 'rapid':
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      default:
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
    }
  },

  drawPickup(ctx, kind, x, y, time) {
    const s = 1 + Math.sin(time * 4 + x) * 0.06;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = 'rgb(0 0 0 / 0.15)';
    ctx.beginPath();
    ctx.roundRect(-9, -8, 20, 20, 5);
    ctx.fill();
    ctx.fillStyle = POWERS[kind].color;
    ctx.beginPath();
    ctx.roundRect(-10, -10, 20, 20, 5);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    switch (kind) {
      case 'speed': // double chevron
        ctx.moveTo(-5, -5); ctx.lineTo(0, 0); ctx.lineTo(-5, 5);
        ctx.moveTo(1, -5); ctx.lineTo(6, 0); ctx.lineTo(1, 5);
        ctx.stroke();
        break;
      case 'shield':
        ctx.moveTo(0, -6); ctx.lineTo(5, -4); ctx.lineTo(4, 2); ctx.lineTo(0, 6); ctx.lineTo(-4, 2); ctx.lineTo(-5, -4);
        ctx.closePath();
        ctx.stroke();
        break;
      case 'rapid': // three dots in a line
        for (const dx of [-5, 0, 5]) { ctx.moveTo(dx + 1.6, 0); ctx.arc(dx, 0, 1.6, 0, Math.PI * 2); }
        ctx.fill();
        break;
      case 'minigun': // three barrels
        for (const dy of [-4, 0, 4]) { ctx.moveTo(-5, dy); ctx.lineTo(5, dy); }
        ctx.stroke();
        break;
      case 'homing': // crosshair
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
        ctx.moveTo(0, -7); ctx.lineTo(0, -3); ctx.moveTo(0, 3); ctx.lineTo(0, 7);
        ctx.moveTo(-7, 0); ctx.lineTo(-3, 0); ctx.moveTo(3, 0); ctx.lineTo(7, 0);
        ctx.stroke();
        break;
      case 'frag': // burst
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.moveTo(Math.cos(a) * 2.5, Math.sin(a) * 2.5);
          ctx.lineTo(Math.cos(a) * 6.5, Math.sin(a) * 6.5);
        }
        ctx.stroke();
        break;
      case 'shotgun': // fan of three lines
        for (const a of [-0.5, 0, 0.5]) { ctx.moveTo(-5, 0); ctx.lineTo(-5 + Math.cos(a) * 11, Math.sin(a) * 11); }
        ctx.stroke();
        break;
      case 'ghost': // little ghost outline
        ctx.moveTo(-5, 6); ctx.lineTo(-5, -1); ctx.arc(0, -1, 5, Math.PI, 0); ctx.lineTo(5, 6);
        ctx.lineTo(2.5, 4); ctx.lineTo(0, 6); ctx.lineTo(-2.5, 4); ctx.closePath();
        ctx.stroke();
        break;
      case 'mines': // mine with spikes
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4); ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 7); }
        ctx.stroke();
        break;
      case 'cloak': // eye with a slash
        ctx.ellipse(0, 0, 6.5, 4, 0, 0, Math.PI * 2);
        ctx.moveTo(-6, 6); ctx.lineTo(6, -6);
        ctx.stroke();
        break;
      case 'ray': // lightning bolt
        ctx.moveTo(2, -7); ctx.lineTo(-3, 1); ctx.lineTo(1, 1); ctx.lineTo(-2, 7);
        ctx.stroke();
        break;
    }
    ctx.restore();
  },
};
