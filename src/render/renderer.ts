import type { GameState } from '../game/sim';
import type { Skin } from './skin';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Draws the game scaled to fill the canvas (letterboxed, any window size),
 * at the display's native resolution and refresh rate.
 */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private shake = 0;

  constructor(private canvas: HTMLCanvasElement, private skin: Skin) {
    this.ctx = canvas.getContext('2d')!;
  }

  private fit(): number {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    return dpr;
  }

  /** alpha: 0..1 progress between the last two simulation steps. realDt: seconds since last frame. */
  draw(state: GameState, alpha: number, realDt: number): void {
    const dpr = this.fit();
    const { ctx, skin, canvas } = this;
    this.consumeEvents(state);

    const pad = 16 * dpr;
    const { width: mw, height: mh } = state.maze;
    const scale = Math.min((canvas.width - pad * 2) / mw, (canvas.height - pad * 2) / mh);
    let ox = (canvas.width - mw * scale) / 2;
    let oy = (canvas.height - mh * scale) / 2;
    if (this.shake > 0) {
      ox += (Math.random() - 0.5) * this.shake * dpr;
      oy += (Math.random() - 0.5) * this.shake * dpr;
      this.shake = Math.max(0, this.shake - realDt * 40);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = skin.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    ctx.fillStyle = skin.floor;
    ctx.fillRect(0, 0, mw, mh);

    for (const t of state.tanks) {
      if (!t.alive) continue;
      skin.drawTank(ctx, {
        x: lerp(t.prevX, t.x, alpha),
        y: lerp(t.prevY, t.y, alpha),
        angle: lerp(t.prevAngle, t.angle, alpha),
        color: t.color,
      });
    }

    skin.drawWalls(ctx, state.maze.walls);

    for (const b of state.bullets) skin.drawBullet(ctx, lerp(b.prevX, b.x, alpha), lerp(b.prevY, b.y, alpha));

    this.drawParticles(realDt);
  }

  private consumeEvents(state: GameState): void {
    for (const e of state.events) {
      if (e.type === 'explode') {
        this.shake = 10;
        for (let i = 0; i < 36; i++) {
          const a = Math.random() * Math.PI * 2;
          const s = 30 + Math.random() * 160;
          const life = 0.4 + Math.random() * 0.6;
          this.particles.push({
            x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
            life, maxLife: life, size: 2 + Math.random() * 4,
            color: i % 3 === 0 ? '#35353b' : i % 3 === 1 ? '#f2a03d' : e.color,
          });
        }
      } else if (e.type === 'fire') {
        for (let i = 0; i < 5; i++) {
          const a = e.angle + (Math.random() - 0.5) * 0.9;
          const s = 40 + Math.random() * 60;
          this.particles.push({
            x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
            life: 0.15, maxLife: 0.15, size: 1.5 + Math.random() * 1.5, color: '#f2a03d',
          });
        }
      } else if (e.type === 'roundStart') {
        this.particles = [];
      }
    }
    state.events.length = 0;
  }

  private drawParticles(dt: number): void {
    const { ctx } = this;
    this.particles = this.particles.filter((p) => (p.life -= dt) > 0);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 3 * dt;
      p.vy *= 1 - 3 * dt;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * (p.life / p.maxLife)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
