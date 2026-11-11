import type { Sfx } from '../audio/sfx';
import { TANK_RADIUS } from '../game/constants';
import { POWERS } from '../game/items';
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

interface Beam {
  points: number[];
  color: string;
  life: number;
}

interface Ring {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const BEAM_LIFE = 0.45;

/**
 * Draws the game scaled to fill the canvas (letterboxed, any window size),
 * at the display's native resolution and refresh rate.
 */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private beams: Beam[] = [];
  private rings: Ring[] = [];
  private shake = 0;
  private time = 0;

  constructor(private canvas: HTMLCanvasElement, private skin: Skin, private sfx?: Sfx) {
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
  draw(state: GameState, alpha: number, realDt: number, myId = -1): void {
    const dpr = this.fit();
    const { ctx, skin, canvas } = this;
    this.time += realDt;
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

    // Darker surround with a soft vignette towards the screen edges.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = skin.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const vg = ctx.createRadialGradient(cx, cy, Math.min(cx, cy) * 0.6, cx, cy, Math.hypot(cx, cy));
    vg.addColorStop(0, 'rgb(0 0 0 / 0)');
    vg.addColorStop(1, skin.vignette);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    ctx.fillStyle = 'rgb(0 0 0 / 0.18)';
    ctx.fillRect(2, 4, mw, mh);
    ctx.fillStyle = skin.floor;
    ctx.fillRect(0, 0, mw, mh);

    for (const p of state.pickups) skin.drawPickup(ctx, p.kind, p.x, p.y, this.time);

    for (const t of state.tanks) {
      if (!t.alive) continue;
      const x = lerp(t.prevX, t.x, alpha);
      const y = lerp(t.prevY, t.y, alpha);
      if (t.power === 'speed' && (t.x !== t.prevX || t.y !== t.prevY) && Math.random() < 0.6) {
        this.particles.push({
          x: x - Math.cos(t.angle) * 12, y: y - Math.sin(t.angle) * 12,
          vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20,
          life: 0.3, maxLife: 0.3, size: 2.5, color: POWERS.speed.color,
        });
      }
      // Cloaked tanks are almost invisible to everyone else; ghosts are see-through.
      const cloaked = t.power === 'cloak';
      const hidden = cloaked && t.id !== myId;
      if (cloaked) ctx.globalAlpha = hidden ? 0.05 + Math.max(0, Math.sin(this.time * 3 + t.id)) * 0.05 : 0.35;
      else if (t.power === 'ghost') ctx.globalAlpha = 0.5 + Math.sin(this.time * 6) * 0.1;
      skin.drawTank(ctx, { x, y, angle: lerp(t.prevAngle, t.angle, alpha), color: t.color });
      ctx.globalAlpha = 1;
      if (t.power && !hidden) this.drawPowerRing(x, y, t.power === 'shield', POWERS[t.power].color, t.powerTime / POWERS[t.power].duration);
    }

    skin.drawWalls(ctx, state.maze.walls);

    for (const b of state.bullets) {
      skin.drawBullet(ctx, lerp(b.prevX, b.x, alpha), lerp(b.prevY, b.y, alpha), b.kind, Math.atan2(b.vy, b.vx), this.time);
    }

    this.drawBeams(realDt);
    this.drawRings(realDt);
    this.drawParticles(realDt);
  }

  /** Shield bubble and/or a ring showing how much of the power-up is left. */
  private drawPowerRing(x: number, y: number, shield: boolean, color: string, left: number): void {
    const { ctx } = this;
    if (shield) {
      ctx.fillStyle = 'rgb(61 155 224 / 0.15)';
      ctx.strokeStyle = 'rgb(61 155 224 / 0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, TANK_RADIUS + 6 + Math.sin(this.time * 8) * 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y, TANK_RADIUS + 10, -Math.PI / 2, -Math.PI / 2 + Math.max(0, Math.min(1, left)) * Math.PI * 2);
    ctx.stroke();
  }

  private consumeEvents(state: GameState): void {
    for (const e of state.events) {
      this.sfx?.play(e);
      switch (e.type) {
        case 'explode':
          this.shake = 10;
          this.burst(e.x, e.y, 36, [e.color, '#35353b', '#f2a03d'], 30, 190, 0.4, 1.0, 2, 6);
          break;
        case 'frag':
          this.shake = Math.max(this.shake, 7);
          this.burst(e.x, e.y, 24, [POWERS.frag.color, '#f2a03d'], 40, 160, 0.2, 0.5, 2, 5);
          this.rings.push({ x: e.x, y: e.y, radius: 40, life: 0.35, maxLife: 0.35, color: POWERS.frag.color });
          break;
        case 'fire':
          if (e.kind === 'mine') this.rings.push({ x: e.x, y: e.y, radius: 14, life: 0.25, maxLife: 0.25, color: POWERS.mines.color });
          else if (e.kind === 'pellet') this.burst(e.x, e.y, 10, ['#f2a03d', '#35353b'], 60, 160, 0.12, 0.2, 1.5, 3, e.angle);
          else if (e.kind === 'mini' || e.kind === 'rapid') this.burst(e.x, e.y, 2, ['#f2a03d'], 30, 60, 0.08, 0.1, 1, 2, e.angle);
          else this.burst(e.x, e.y, 5, ['#f2a03d'], 40, 100, 0.15, 0.15, 1.5, 3, e.angle);
          break;
        case 'ray':
          this.shake = Math.max(this.shake, 6);
          this.beams.push({ points: e.points, color: e.color, life: BEAM_LIFE });
          break;
        case 'pickup':
          this.rings.push({ x: e.x, y: e.y, radius: 26, life: 0.3, maxLife: 0.3, color: POWERS[e.kind].color });
          break;
        case 'shield':
          this.rings.push({ x: e.x, y: e.y, radius: TANK_RADIUS + 14, life: 0.25, maxLife: 0.25, color: POWERS.shield.color });
          break;
        case 'roundStart':
          this.particles = [];
          this.beams = [];
          this.rings = [];
          break;
      }
    }
    state.events.length = 0;
  }

  private burst(
    x: number, y: number, count: number, colors: string[], minSpeed: number, maxSpeed: number,
    minLife: number, maxLife: number, minSize: number, maxSize: number, angle?: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const a = angle === undefined ? Math.random() * Math.PI * 2 : angle + (Math.random() - 0.5) * 0.9;
      const s = minSpeed + Math.random() * (maxSpeed - minSpeed);
      const life = minLife + Math.random() * (maxLife - minLife);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, maxLife: life,
        size: minSize + Math.random() * (maxSize - minSize), color: colors[i % colors.length],
      });
    }
  }

  private drawBeams(dt: number): void {
    const { ctx } = this;
    this.beams = this.beams.filter((b) => (b.life -= dt) > 0);
    for (const beam of this.beams) {
      const k = beam.life / BEAM_LIFE;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const [width, color, alpha] of [[10, beam.color, 0.25], [4, beam.color, 0.9], [1.5, '#fff', 1]] as const) {
        ctx.globalAlpha = alpha * k;
        ctx.strokeStyle = color;
        ctx.lineWidth = width * (0.6 + 0.4 * k);
        ctx.beginPath();
        ctx.moveTo(beam.points[0], beam.points[1]);
        for (let i = 2; i < beam.points.length; i += 2) ctx.lineTo(beam.points[i], beam.points[i + 1]);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawRings(dt: number): void {
    const { ctx } = this;
    this.rings = this.rings.filter((r) => (r.life -= dt) > 0);
    for (const r of this.rings) {
      const k = r.life / r.maxLife;
      ctx.globalAlpha = k;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3 * k;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius * (1.2 - k * 0.6), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
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
