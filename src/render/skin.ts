// All visuals live behind this interface so the art style can be swapped
// later without touching game logic.

export interface TankLook {
  x: number;
  y: number;
  angle: number; // radians, 0 = facing right
  color: string;
}

export interface Skin {
  floor: string;
  drawWall(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void;
  drawTank(ctx: CanvasRenderingContext2D, tank: TankLook): void;
  drawBullet(ctx: CanvasRenderingContext2D, x: number, y: number): void;
}

/** Simple flat placeholder style: plain shapes, nothing final. */
export const placeholderSkin: Skin = {
  floor: '#fbfaf7',

  drawWall(ctx, x1, y1, x2, y2) {
    ctx.strokeStyle = '#3a3a3f';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  },

  drawTank(ctx, { x, y, angle, color }) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    // treads
    ctx.fillStyle = '#4a4a50';
    ctx.fillRect(-14, -14, 28, 6);
    ctx.fillRect(-14, 8, 28, 6);
    // hull
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-13, -10, 26, 20, 4);
    ctx.fill();
    // barrel
    ctx.fillStyle = '#3a3a3f';
    ctx.fillRect(0, -2.5, 20, 5);
    // turret
    ctx.fillStyle = color;
    ctx.strokeStyle = '#3a3a3f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  },

  drawBullet(ctx, x, y) {
    ctx.fillStyle = '#2b2b2e';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  },
};
