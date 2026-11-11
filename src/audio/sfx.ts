import type { GameEvent } from '../game/sim';

/**
 * Sound effects synthesised with the Web Audio API: no audio files to download.
 * Browsers only allow sound after the player has clicked something, so call unlock() from a click.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastPlayed = new Map<string, number>();
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem('tank-muted') === '1';
    } catch { /* storage unavailable */ }
  }

  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem('tank-muted', muted ? '1' : '0');
    } catch { /* ignore */ }
  }

  play(e: GameEvent): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    switch (e.type) {
      case 'fire':
        if (e.kind === 'mini' || e.kind === 'rapid') {
          if (!this.throttle('rapidfire', 0.045)) return;
          this.tone('square', 900, 300, 0.05, 0.06);
        } else if (e.kind === 'pellet') {
          this.boom(0.18, 0.35);
          this.hiss(0.12, 0.15, 2500);
        } else if (e.kind === 'mine') {
          this.tone('square', 300, 300, 0.05, 0.08);
          this.tone('square', 450, 450, 0.05, 0.08, 0.07);
        } else if (e.kind === 'homing') {
          this.tone('sawtooth', 180, 520, 0.3, 0.1);
          this.hiss(0.3, 0.08, 3000);
        } else if (e.kind === 'frag') {
          this.tone('sine', 160, 60, 0.18, 0.35);
        } else {
          this.tone('square', 520, 160, 0.08, 0.1);
          this.hiss(0.04, 0.08, 4000);
        }
        break;
      case 'explode':
        this.boom(0.7, 0.55);
        break;
      case 'frag':
        this.boom(0.5, 0.45);
        this.hiss(0.35, 0.2, 5000);
        break;
      case 'ray':
        this.tone('sawtooth', 1400, 120, 0.55, 0.16);
        this.hiss(0.45, 0.12, 6000);
        break;
      case 'pickup':
        [660, 880, 1175].forEach((f, i) => this.tone('triangle', f, f, 0.08, 0.15, i * 0.06));
        break;
      case 'shield':
        this.tone('sine', 1200, 900, 0.2, 0.2);
        break;
      case 'matchEnd':
        [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.18, 0.15, i * 0.12));
        break;
    }
  }

  /** Limit how often a sound can play (the minigun fires a lot). */
  private throttle(key: string, gap: number): boolean {
    const now = this.ctx!.currentTime;
    if (now - (this.lastPlayed.get(key) ?? -1) < gap) return false;
    this.lastPlayed.set(key, now);
    return true;
  }

  private tone(type: OscillatorType, from: number, to: number, dur: number, vol: number, delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private hiss(dur: number, vol: number, cutoff: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(this.master!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur);
  }

  private boom(dur: number, vol: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(this.master!);
    src.start(t, Math.random() * 0.3);
    src.stop(t + dur);
    this.tone('sine', 110, 35, dur * 0.8, vol * 0.8);
  }
}
