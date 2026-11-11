import type { TankInput } from '../game/sim';

export interface KeyLayout {
  up: string;
  down: string;
  left: string;
  right: string;
  fire: string;
}

/** The control scheme every player uses online: WASD to drive, Space to fire. */
export const WASD: KeyLayout = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', fire: 'Space' };

/** Second player on the same keyboard, for local practice only. */
export const LOCAL_P2: KeyLayout = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', fire: 'Enter' };

/** Raw key state: which keys are held, plus how many times fire was tapped (so quick taps are never lost). */
export interface KeyState {
  held: TankInput;
  firePresses: number;
}

/** Tracks held keys by physical position (event.code), so WASD works on any keyboard layout. */
export class Keyboard {
  private held = new Set<string>();
  private presses = new Map<string, number>();
  private gameKeys: Set<string>;
  /** Game keys are ignored while typing in a text box. */
  enabled = true;
  /** Called the instant any game key changes (guests use this to send input with no frame delay). */
  private listeners = new Set<() => void>();

  constructor(layouts: KeyLayout[]) {
    this.gameKeys = new Set(layouts.flatMap((l) => Object.values(l)));
    window.addEventListener('keydown', (e) => {
      if (!this.enabled || !this.gameKeys.has(e.code)) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      e.preventDefault(); // stop Space / arrows scrolling the page
      if (e.repeat) return;
      this.presses.set(e.code, (this.presses.get(e.code) ?? 0) + 1);
      this.held.add(e.code);
      this.emit();
    });
    window.addEventListener('keyup', (e) => {
      if (this.held.delete(e.code)) this.emit();
    });
    window.addEventListener('blur', () => {
      this.held.clear();
      this.emit();
    });
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  read(layout: KeyLayout): KeyState {
    return {
      held: {
        up: this.held.has(layout.up),
        down: this.held.has(layout.down),
        left: this.held.has(layout.left),
        right: this.held.has(layout.right),
        fire: this.held.has(layout.fire),
      },
      firePresses: this.presses.get(layout.fire) ?? 0,
    };
  }
}

/** Turns held keys + a tap counter into a per-tick input, so a tap shorter than one tick still fires. */
export class FireLatch {
  private last = -1;

  apply(state: KeyState): TankInput {
    const tapped = this.last >= 0 && state.firePresses > this.last;
    this.last = state.firePresses;
    return { ...state.held, fire: state.held.fire || tapped };
  }
}

export function encodeInput(i: TankInput): number {
  return (i.up ? 1 : 0) | (i.down ? 2 : 0) | (i.left ? 4 : 0) | (i.right ? 8 : 0) | (i.fire ? 16 : 0);
}

export function decodeInput(m: number): TankInput {
  return { up: !!(m & 1), down: !!(m & 2), left: !!(m & 4), right: !!(m & 8), fire: !!(m & 16) };
}
