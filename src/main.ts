import './style.css';
import { Sfx } from './audio/sfx';
import { GuestSession } from './net/guest';
import { HostSession } from './net/host';
import { LocalSession } from './net/local';
import { normalizeCode } from './net/protocol';
import type { Session } from './net/session';
import { Keyboard, LOCAL_P2, WASD } from './input/keyboard';
import { Renderer } from './render/renderer';
import { placeholderSkin } from './render/skin';
import { Hud } from './ui/hud';
import { LobbyView } from './ui/lobby';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const screens = { menu: $('#menu'), lobby: $('#lobby'), game: $('#game-screen') };
const nameInput = $<HTMLInputElement>('#name');
const codeInput = $<HTMLInputElement>('#code-input');
const menuStatus = $('#menu-status');
const hostBtn = $<HTMLButtonElement>('#host-btn');
const joinBtn = $<HTMLButtonElement>('#join-btn');

const keyboard = new Keyboard([WASD, LOCAL_P2]);
const sfx = new Sfx();
const renderer = new Renderer($<HTMLCanvasElement>('#game'), placeholderSkin, sfx);
const hud = new Hud($('#scores'), $('#banner'));
const lobbyView = new LobbyView(() => leave());

let session: Session | null = null;

// ---------- Name (remembered on this device) ----------
try {
  nameInput.value = localStorage.getItem('tank-name') ?? '';
} catch { /* storage unavailable */ }
const playerName = () => {
  const n = nameInput.value.trim().slice(0, 16) || 'Player';
  try { localStorage.setItem('tank-name', n); } catch { /* ignore */ }
  return n;
};

// ---------- Screen switching ----------
function show(which: keyof typeof screens): void {
  for (const [k, el] of Object.entries(screens)) el.hidden = k !== which;
}

function refresh(): void {
  if (!session) return show('menu');
  if (session.game) {
    $('#local-help').hidden = session.role !== 'local';
    show('game');
  } else {
    lobbyView.render();
    show('lobby');
  }
}

function attach(s: Session): void {
  session = s;
  s.onChange = refresh;
  s.onClosed = (reason) => {
    session = null;
    setMenuStatus(reason, true);
    show('menu');
  };
  if (s.role !== 'local') lobbyView.open(s);
  refresh();
}

function leave(): void {
  if (session?.role === 'host' && session.lobby.players.length > 1 && !confirm('Leaving ends the game for everyone. Leave?')) return;
  session?.leave();
  session = null;
  setMenuStatus('');
  show('menu');
}

function setMenuStatus(text: string, error = false): void {
  menuStatus.textContent = text;
  menuStatus.classList.toggle('error', error);
}

function setBusy(busy: boolean): void {
  hostBtn.disabled = joinBtn.disabled = busy;
}

// ---------- Menu actions ----------
hostBtn.addEventListener('click', async () => {
  setBusy(true);
  setMenuStatus('Creating game…');
  try {
    attach(await HostSession.create(playerName(), keyboard));
    setMenuStatus('');
  } catch (e) {
    setMenuStatus((e as Error).message, true);
  } finally {
    setBusy(false);
  }
});

$('#join-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = normalizeCode(codeInput.value);
  if (code.length !== 6) return setMenuStatus('Game codes are 6 characters.', true);
  setBusy(true);
  setMenuStatus(`Joining ${code}…`);
  try {
    attach(await GuestSession.join(code, playerName(), keyboard));
    setMenuStatus('');
  } catch (err) {
    setMenuStatus((err as Error).message, true);
  } finally {
    setBusy(false);
  }
});

codeInput.addEventListener('input', () => (codeInput.value = normalizeCode(codeInput.value)));

$('#practice-btn').addEventListener('click', () => attach(new LocalSession()));
$('#leave-game').addEventListener('click', () => leave());

nameInput.focus();

// ---------- Sound ----------
const muteBtn = $<HTMLButtonElement>('#mute-btn');
const syncMute = () => (muteBtn.textContent = sfx.muted ? 'Sound: off' : 'Sound: on');
const toggleMute = () => {
  sfx.setMuted(!sfx.muted);
  syncMute();
};
syncMute();
muteBtn.addEventListener('click', (e) => {
  toggleMute();
  (e.currentTarget as HTMLElement).blur(); // keep Space for firing, not re-clicking this button
});
// Browsers only allow audio after a click or key press.
window.addEventListener('pointerdown', () => sfx.unlock());
window.addEventListener('keydown', (e) => {
  sfx.unlock();
  if (e.code === 'KeyM' && session?.game && !(e.target instanceof HTMLInputElement)) toggleMute();
});

window.addEventListener('beforeunload', () => session?.leave());

// Dev-only debugging hook (stripped from production builds).
if (import.meta.env.DEV) (window as unknown as { __session: () => Session | null }).__session = () => session;

// ---------- Main loop: simulation at fixed 60 Hz, drawing at display rate ----------
let last = performance.now();
function frame(now: number) {
  const realDt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (session?.game) {
    const alpha = session.frame(realDt, keyboard);
    const game = session.game; // may have ended during frame()
    if (game) {
      renderer.draw(game, alpha, realDt);
      hud.update(game, session.myId);
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
show('menu');
