import { Peer, type DataConnection } from 'peerjs';
import { DT } from '../game/constants';
import { DEFAULT_SETTINGS } from '../game/settings';
import { createGame, type GameState } from '../game/sim';
import { applySnapshot } from '../game/snapshot';
import { encodeInput, WASD, type Keyboard } from '../input/keyboard';
import { friendlyError } from './host';
import { PEER_PREFIX, type LobbyState, type ToGuest, type ToHost } from './protocol';
import type { Session } from './session';

const JOIN_TIMEOUT_MS = 15000;

/** A guest sends its keys to the host and draws the snapshots it gets back. */
export class GuestSession implements Session {
  readonly role = 'guest';
  myId = 0;
  lobby: LobbyState = { players: [], settings: { ...DEFAULT_SETTINGS }, inGame: false };
  game: GameState | null = null;
  onChange = () => {};
  onClosed = (_reason: string) => {};

  private lastSnapAt = 0;
  private sentMask = -1;
  private sentPresses = -1;
  private leaving = false;
  private unsubscribe: () => void;

  private constructor(private peer: Peer, private conn: DataConnection, readonly code: string, private keyboard: Keyboard) {
    this.unsubscribe = keyboard.onChange(() => this.sendInput());
  }

  static join(code: string, name: string, keyboard: Keyboard): Promise<GuestSession> {
    return new Promise((resolve, reject) => {
      const peer = new Peer();
      let settled = false;
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        peer.destroy();
        reject(new Error(message));
      };
      const timer = setTimeout(() => fail('Could not connect to that game (timed out).'), JOIN_TIMEOUT_MS);
      peer.on('error', (err) => fail(friendlyError(err)));

      peer.once('open', () => {
        const conn = peer.connect(PEER_PREFIX + code, { reliable: true, serialization: 'json' });
        const session = new GuestSession(peer, conn, code, keyboard);
        conn.on('open', () => conn.send({ t: 'hello', name } satisfies ToHost));
        conn.on('data', (raw) => {
          const msg = raw as ToGuest;
          if (!settled) {
            if (msg.t === 'reject') return fail(msg.reason);
            if (msg.t === 'welcome') {
              settled = true;
              clearTimeout(timer);
              session.myId = msg.id;
              resolve(session);
            }
            return;
          }
          session.handle(msg);
        });
        conn.on('close', () => {
          if (!settled) fail('The host closed the connection.');
          else session.closed('The host left the game.');
        });
      });
    });
  }

  private handle(msg: ToGuest): void {
    switch (msg.t) {
      case 'lobby':
        this.lobby = msg.lobby;
        if (!msg.lobby.inGame) this.game = null;
        this.onChange();
        break;
      case 'start':
        this.game = createGame(msg.players, msg.seed, msg.settings);
        this.lastSnapAt = performance.now();
        this.onChange();
        break;
      case 'snap':
        if (this.game) {
          applySnapshot(this.game, msg);
          this.lastSnapAt = performance.now();
        }
        break;
    }
  }

  private closed(reason: string): void {
    if (this.leaving) return;
    this.leaving = true;
    this.unsubscribe();
    this.peer.destroy();
    this.onClosed(reason);
  }

  /** Send our keys to the host if they changed. Called on every key event and every frame. */
  private sendInput(): void {
    if (!this.game) return;
    const keys = this.keyboard.read(WASD);
    const mask = encodeInput(keys.held);
    if (mask === this.sentMask && keys.firePresses === this.sentPresses) return;
    this.sentMask = mask;
    this.sentPresses = keys.firePresses;
    this.send({ t: 'in', m: mask, f: keys.firePresses });
  }

  frame(): number {
    if (!this.game) return 0;
    this.sendInput();
    // Smooth between the last two snapshots.
    return Math.min(1, (performance.now() - this.lastSnapAt) / (DT * 1000));
  }

  private send(msg: ToHost): void {
    if (this.conn.open) this.conn.send(msg);
  }

  leave(): void {
    this.leaving = true;
    this.unsubscribe();
    this.send({ t: 'bye' });
    setTimeout(() => this.peer.destroy(), 100);
  }
}
