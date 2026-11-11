import type { MatchSettings } from '../game/settings';
import type { GameState } from '../game/sim';
import type { Keyboard } from '../input/keyboard';
import type { LobbyState } from './protocol';

/** What the UI needs from a host, guest or local-practice session. */
export interface Session {
  readonly role: 'host' | 'guest' | 'local';
  readonly code: string;
  myId: number;
  lobby: LobbyState;
  game: GameState | null;
  /** Lobby changed, game started, or returned to lobby. */
  onChange: () => void;
  /** Session ended (host left, connection lost...). */
  onClosed: (reason: string) => void;
  /** Advance one rendered frame. Returns the interpolation alpha for rendering. */
  frame(realDt: number, keyboard: Keyboard): number;
  leave(): void;
  updateSettings?(patch: Partial<MatchSettings>): void;
  start?(): void;
}
