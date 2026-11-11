import { Peer, type DataConnection } from 'peerjs';
import { DT } from '../game/constants';
import { DEFAULT_SETTINGS, MAX_PLAYERS, PLAYER_COLORS, type MatchSettings } from '../game/settings';
import { createGame, removeTank, step, type GameState, type TankInput } from '../game/sim';
import { makeSnapshot } from '../game/snapshot';
import { decodeInput, FireLatch, WASD, type Keyboard } from '../input/keyboard';
import { makeRoomCode, PEER_PREFIX, type LobbyState, type ToGuest, type ToHost } from './protocol';
import type { Session } from './session';
import { startTicker } from './ticker';

interface Guest {
  id: number;
  conn: DataConnection;
  mask: number;
  firePresses: number;
  latch: FireLatch;
}

/** The host's browser owns the lobby and runs the authoritative simulation. */
export class HostSession implements Session {
  readonly role = 'host';
  myId = 1;
  lobby: LobbyState;
  game: GameState | null = null;
  onChange = () => {};
  onClosed = (_reason: string) => {};

  private guests = new Map<number, Guest>();
  private nextId = 2;
  private acc = 0;
  private localLatch = new FireLatch();
  private closed = false;
  private stopTicker: (() => void) | null = null;
  private lastPump = 0;

  private constructor(private peer: Peer, readonly code: string, name: string, private keyboard: Keyboard) {
    this.lobby = {
      players: [{ id: 1, name, color: PLAYER_COLORS[0], host: true }],
      settings: { ...DEFAULT_SETTINGS },
      inGame: false,
    };
    peer.on('connection', (conn) => this.accept(conn));
    peer.on('disconnected', () => {
      // Lost the matchmaking server only; existing player connections keep working.
      if (!this.closed) peer.reconnect();
    });
  }

  /** Register a room code on the PeerJS server (retrying if the code is taken). */
  static create(name: string, keyboard: Keyboard, attempts = 4): Promise<HostSession> {
    return new Promise((resolve, reject) => {
      const code = makeRoomCode();
      const peer = new Peer(PEER_PREFIX + code);
      const fail = (err: { type?: string; message?: string }) => {
        peer.destroy();
        if (err.type === 'unavailable-id' && attempts > 1) resolve(HostSession.create(name, keyboard, attempts - 1));
        else reject(new Error(friendlyError(err)));
      };
      peer.once('open', () => {
        peer.off('error', fail);
        resolve(new HostSession(peer, code, name, keyboard));
      });
      peer.once('error', fail);
    });
  }

  private accept(conn: DataConnection): void {
    conn.on('data', (raw) => this.onMessage(conn, raw as ToHost));
    conn.on('close', () => this.drop(conn));
    conn.on('error', () => this.drop(conn));
  }

  private send(conn: DataConnection, msg: ToGuest): void {
    if (conn.open) conn.send(msg);
  }

  private broadcast(msg: ToGuest): void {
    for (const g of this.guests.values()) this.send(g.conn, msg);
  }

  private onMessage(conn: DataConnection, msg: ToHost): void {
    if (msg.t === 'hello') {
      const reason = this.lobby.inGame
        ? 'That game has already started. Ask the host to return to the lobby.'
        : this.lobby.players.length >= MAX_PLAYERS ? 'That lobby is full.' : null;
      if (reason) {
        this.send(conn, { t: 'reject', reason });
        setTimeout(() => conn.close(), 500);
        return;
      }
      const id = this.nextId++;
      const used = new Set(this.lobby.players.map((p) => p.color));
      const color = PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[0];
      const name = String(msg.name || 'Player').slice(0, 16);
      this.lobby.players.push({ id, name, color, host: false });
      this.guests.set(id, { id, conn, mask: 0, firePresses: 0, latch: new FireLatch() });
      this.send(conn, { t: 'welcome', id });
      this.lobbyChanged();
      return;
    }
    const guest = [...this.guests.values()].find((g) => g.conn === conn);
    if (!guest) return;
    if (msg.t === 'in') {
      guest.mask = msg.m;
      guest.firePresses = msg.f;
    } else if (msg.t === 'bye') {
      this.drop(conn);
    }
  }

  private drop(conn: DataConnection): void {
    const guest = [...this.guests.values()].find((g) => g.conn === conn);
    if (!guest) return;
    this.guests.delete(guest.id);
    this.lobby.players = this.lobby.players.filter((p) => p.id !== guest.id);
    if (this.game) {
      removeTank(this.game, guest.id);
      if (this.game.tanks.length < 2) {
        this.returnToLobby();
        return;
      }
    }
    this.lobbyChanged();
  }

  private lobbyChanged(): void {
    this.broadcast({ t: 'lobby', lobby: this.lobby });
    this.onChange();
  }

  updateSettings(patch: Partial<MatchSettings>): void {
    Object.assign(this.lobby.settings, patch);
    this.lobbyChanged();
  }

  start(): void {
    if (this.lobby.players.length < 2 || this.game) return;
    const seed = (Math.random() * 2 ** 32) >>> 0;
    const players = this.lobby.players.map(({ id, name, color }) => ({ id, name, color }));
    this.game = createGame(players, seed, this.lobby.settings);
    this.lobby.inGame = true;
    this.acc = 0;
    this.lastPump = performance.now();
    this.stopTicker = startTicker(() => this.pump());
    this.broadcast({ t: 'start', seed, players, settings: this.lobby.settings });
    this.lobbyChanged();
  }

  private returnToLobby(): void {
    this.stopTicker?.();
    this.stopTicker = null;
    this.game = null;
    this.lobby.inGame = false;
    this.lobbyChanged();
  }

  /** Rendering calls this every frame; the background ticker keeps the game running when the tab is hidden. */
  frame(): number {
    this.pump();
    return this.acc / DT;
  }

  /** Run however many 60 Hz steps are due since the last call. */
  private pump(): void {
    const game = this.game;
    if (!game) return;
    const now = performance.now();
    this.acc += Math.min(0.25, (now - this.lastPump) / 1000);
    this.lastPump = now;
    while (this.acc >= DT) {
      this.acc -= DT;
      const inputs = new Map<number, TankInput>([[this.myId, this.localLatch.apply(this.keyboard.read(WASD))]]);
      for (const g of this.guests.values()) {
        const held = decodeInput(g.mask);
        inputs.set(g.id, g.latch.apply({ held, firePresses: g.firePresses }));
      }
      const before = game.events.length;
      step(game, inputs);
      this.broadcast(makeSnapshot(game, game.events.slice(before)));
      if (game.phase === 'matchOver' && game.phaseTimer <= 0) {
        this.returnToLobby();
        return;
      }
    }
  }

  leave(): void {
    this.closed = true;
    this.stopTicker?.();
    for (const g of this.guests.values()) g.conn.close();
    this.peer.destroy();
  }
}

export function friendlyError(err: { type?: string; message?: string }): string {
  switch (err.type) {
    case 'peer-unavailable':
      return 'No game found with that code. Check it and try again.';
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return 'Could not reach the matchmaking server. Check your internet connection.';
    case 'browser-incompatible':
      return 'This browser does not support peer-to-peer connections.';
    default:
      return err.message || 'Something went wrong with the connection.';
  }
}
