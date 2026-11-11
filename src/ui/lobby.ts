import { MAX_PLAYERS, POINTS_TO_WIN_OPTIONS } from '../game/settings';
import { inviteLink } from '../net/protocol';
import type { Session } from '../net/session';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

/** Lobby screen: player slots, invite dropdown, host-only settings and start button. */
export class LobbyView {
  private session: Session | null = null;
  private slots = $('#slots');
  private inviteToggle = $<HTMLButtonElement>('#invite-toggle');
  private invite = $('#invite');
  private selfDamage = $<HTMLInputElement>('#set-selfdamage');
  private items = $<HTMLInputElement>('#set-items');
  private points = $<HTMLSelectElement>('#set-points');
  private startBtn = $<HTMLButtonElement>('#start-btn');
  private status = $('#lobby-status');
  private note = $('#settings-note');

  constructor(onLeave: () => void) {
    for (const n of POINTS_TO_WIN_OPTIONS) this.points.add(new Option(n === 0 ? 'No limit' : String(n), String(n)));

    this.inviteToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setInviteOpen(this.invite.hasAttribute('hidden'));
    });
    this.invite.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', () => this.setInviteOpen(false));
    document.addEventListener('keydown', (e) => e.key === 'Escape' && this.setInviteOpen(false));

    this.invite.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) =>
      btn.addEventListener('click', () => {
        if (!this.session) return;
        const text = btn.dataset.copy === 'code' ? this.session.code : inviteLink(this.session.code);
        copy(text).then((ok) => {
          btn.textContent = ok ? 'Copied!' : 'Select & copy';
          setTimeout(() => (btn.textContent = 'Copy'), 1500);
        });
      }),
    );
    $<HTMLInputElement>('#invite-link').addEventListener('focus', (e) => (e.target as HTMLInputElement).select());

    this.selfDamage.addEventListener('change', () => this.session?.updateSettings?.({ selfDamage: this.selfDamage.checked }));
    this.items.addEventListener('change', () => this.session?.updateSettings?.({ items: this.items.checked }));
    this.points.addEventListener('change', () => this.session?.updateSettings?.({ pointsToWin: Number(this.points.value) }));
    this.startBtn.addEventListener('click', () => this.session?.start?.());
    $('#leave-lobby').addEventListener('click', onLeave);
  }

  private setInviteOpen(open: boolean): void {
    this.invite.hidden = !open;
    this.inviteToggle.setAttribute('aria-expanded', String(open));
    this.inviteToggle.textContent = open ? 'Invite friends ▴' : 'Invite friends ▾';
  }

  /** Show the lobby for a new session (host opens the invite dropdown straight away). */
  open(session: Session): void {
    this.session = session;
    $('#invite-code').textContent = session.code;
    $<HTMLInputElement>('#invite-link').value = inviteLink(session.code);
    this.setInviteOpen(session.role === 'host');
    this.render();
  }

  render(): void {
    const s = this.session;
    if (!s) return;
    const { players, settings } = s.lobby;
    const isHost = s.role === 'host';

    const cells: HTMLElement[] = [];
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const p = players[i];
      const el = document.createElement('div');
      if (!p) {
        el.className = 'slot empty';
        el.textContent = 'Waiting for player…';
      } else {
        el.className = 'slot';
        el.innerHTML = `<span class="chip"></span><span class="who"><span class="nm"></span><span class="tag"></span></span>`;
        (el.querySelector('.chip') as HTMLElement).style.background = p.color;
        el.querySelector('.nm')!.textContent = p.name;
        el.querySelector('.tag')!.textContent = [p.host ? 'Host' : '', p.id === s.myId ? 'You' : ''].filter(Boolean).join(' · ');
      }
      cells.push(el);
    }
    this.slots.replaceChildren(...cells);

    this.selfDamage.checked = settings.selfDamage;
    this.items.checked = settings.items;
    this.points.value = String(settings.pointsToWin);
    for (const el of [this.selfDamage, this.items, this.points]) el.disabled = !isHost;
    this.note.textContent = isHost ? '' : '(only the host can change these)';

    this.startBtn.hidden = !isHost;
    this.startBtn.disabled = players.length < 2;
    this.status.textContent = isHost
      ? players.length < 2 ? 'Waiting for at least one more player…' : `${players.length} players ready`
      : 'Waiting for the host to start…';
  }
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
