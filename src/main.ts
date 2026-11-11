import './style.css';
import { placeholderSkin as skin } from './render/skin';

// Stage 0 placeholder: a static scene to prove the build + deploy pipeline.
// Drawn at the display's native resolution, re-rendered every frame (uncapped).

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = canvas.getContext('2d')!;

const W = 600;
const H = 400;
const CELL = 100;

// A hand-placed demo maze on a 6x4 grid: [x1, y1, x2, y2] in cell units.
const walls: [number, number, number, number][] = [
  [0, 0, 6, 0], [6, 0, 6, 4], [6, 4, 0, 4], [0, 4, 0, 0], // border
  [1, 0, 1, 2], [2, 1, 4, 1], [3, 1, 3, 3], [1, 3, 2, 3],
  [4, 2, 5, 2], [5, 1, 5, 2], [4, 3, 4, 4], [2, 2, 2, 3],
];

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
}
window.addEventListener('resize', resize);
resize();

function frame(t: number) {
  const s = canvas.width / W;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.fillStyle = skin.floor;
  ctx.fillRect(0, 0, W, H);

  for (const [x1, y1, x2, y2] of walls) {
    skin.drawWall(ctx, x1 * CELL, y1 * CELL, x2 * CELL, y2 * CELL);
  }

  const sec = t / 1000;
  skin.drawTank(ctx, { x: 50, y: 50, angle: sec * 0.8, color: '#3f8f7a' });
  skin.drawTank(ctx, { x: 550, y: 350, angle: Math.PI - sec * 0.6, color: '#d0644f' });
  skin.drawTank(ctx, { x: 450, y: 150, angle: Math.PI / 2 + Math.sin(sec) * 0.5, color: '#d8a03a' });

  const bx = 250 + Math.cos(sec * 2) * 40;
  skin.drawBullet(ctx, bx, 250);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
