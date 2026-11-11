import type { MatchSettings } from '../game/settings';
import type { Player } from '../game/sim';
import type { Snapshot } from '../game/snapshot';

export interface LobbyPlayer extends Player {
  host: boolean;
}

export interface LobbyState {
  players: LobbyPlayer[];
  settings: MatchSettings;
  inGame: boolean;
}

/** Guest → host */
export type ToHost =
  | { t: 'hello'; name: string }
  | { t: 'in'; m: number; f: number } // held-keys bitmask, fire tap counter
  | { t: 'bye' };

/** Host → guest */
export type ToGuest =
  | { t: 'welcome'; id: number }
  | { t: 'reject'; reason: string }
  | { t: 'lobby'; lobby: LobbyState }
  | { t: 'start'; seed: number; players: Player[]; settings: MatchSettings }
  | Snapshot;

/** Prefix keeps our room IDs from colliding with other apps on the shared PeerJS server. */
export const PEER_PREFIX = 'tg24-tankgame-';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L

export function makeRoomCode(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}
