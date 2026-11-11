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

/** Second player on the same keyboard, for offline testing only. */
export const LOCAL_P2: KeyLayout = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', fire: 'Enter' };

/** Tracks held keys by physical position (event.code), so WASD works on any keyboard layout. */
export class Keyboard {
  private held = new Set<string>();
  private gameKeys: Set<string>;

  constructor(layouts: KeyLayout[]) {
    this.gameKeys = new Set(layouts.flatMap((l) => Object.values(l)));
    window.addEventListener('keydown', (e) => {
      if (!this.gameKeys.has(e.code)) return;
      e.preventDefault(); // stop Space / arrows scrolling the page
      this.held.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => this.held.clear());
  }

  read(layout: KeyLayout): TankInput {
    return {
      up: this.held.has(layout.up),
      down: this.held.has(layout.down),
      left: this.held.has(layout.left),
      right: this.held.has(layout.right),
      fire: this.held.has(layout.fire),
    };
  }
}
