import type { GameState } from '../game/sim';

/** Scoreboard + round banner. Only touches the DOM when something changed. */
export class Hud {
  private lastKey = '';

  constructor(private scores: HTMLElement, private banner: HTMLElement) {}

  update(state: GameState, myId: number): void {
    const alive = state.tanks.filter((t) => t.alive);
    let bannerText = '';
    if (state.phase === 'matchOver') {
      const w = state.tanks.find((t) => t.id === state.matchWinner);
      bannerText = w ? `${w.name} wins the match!` : 'Match over';
    } else if (state.phase === 'roundOver') {
      bannerText = alive.length === 1 && state.tanks.length > 1 ? `${alive[0].name} wins the round` : 'Draw';
    }
    const target = state.settings.pointsToWin;
    const key = state.tanks.map((t) => `${t.id}:${t.name}:${t.score}:${t.alive ? 1 : 0}`).join() + bannerText + myId;
    if (key === this.lastKey) return;
    this.lastKey = key;

    this.scores.replaceChildren(
      ...state.tanks.map((t) => {
        const el = document.createElement('div');
        el.className = 'score' + (t.alive ? '' : ' dead') + (t.id === myId ? ' me' : '');
        el.innerHTML = `<span class="chip"></span><span class="name"></span><span class="pts"></span>`;
        (el.querySelector('.chip') as HTMLElement).style.background = t.color;
        el.querySelector('.name')!.textContent = t.name;
        el.querySelector('.pts')!.textContent = String(t.score);
        el.title = target > 0 ? `First to ${target}` : '';
        return el;
      }),
    );
    this.banner.textContent = bannerText;
    this.banner.hidden = !bannerText;
  }
}
