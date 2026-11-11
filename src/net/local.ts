import { DT } from '../game/constants';
import { DEFAULT_SETTINGS, PLAYER_COLORS } from '../game/settings';
import { createGame, step, type GameState, type Player } from '../game/sim';
import { FireLatch, LOCAL_P2, WASD, type Keyboard } from '../input/keyboard';
import type { LobbyState } from './protocol';
import type { Session } from './session';

/** Two players on one keyboard, no network. Handy for testing. */
export class LocalSession implements Session {
  readonly role = 'local';
  readonly code = '';
  myId = 1;
  lobby: LobbyState;
  game: GameState;
  onChange = () => {};
  onClosed = (_reason: string) => {};

  private acc = 0;
  private latches = [new FireLatch(), new FireLatch()];
  private players: Player[] = [
    { id: 1, name: 'WASD', color: PLAYER_COLORS[0] },
    { id: 2, name: 'Arrows', color: PLAYER_COLORS[1] },
  ];

  constructor() {
    this.lobby = { players: this.players.map((p) => ({ ...p, host: false })), settings: DEFAULT_SETTINGS, inGame: true };
    this.game = this.newGame();
  }

  private newGame(): GameState {
    return createGame(this.players, (Math.random() * 2 ** 32) >>> 0, DEFAULT_SETTINGS);
  }

  frame(realDt: number, keyboard: Keyboard): number {
    this.acc += realDt;
    while (this.acc >= DT) {
      this.acc -= DT;
      step(this.game, new Map([
        [1, this.latches[0].apply(keyboard.read(WASD))],
        [2, this.latches[1].apply(keyboard.read(LOCAL_P2))],
      ]));
      if (this.game.phase === 'matchOver' && this.game.phaseTimer <= 0) this.game = this.newGame();
    }
    return this.acc / DT;
  }

  leave(): void {}
}
