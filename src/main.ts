import './style.css';
import { DT } from './game/constants';
import { createGame, step, type Player, type TankInput } from './game/sim';
import { Keyboard, LOCAL_P2, WASD } from './input/keyboard';
import { Renderer } from './render/renderer';
import { placeholderSkin } from './render/skin';
import { Hud } from './ui/hud';

// Stage 1: offline prototype. Two players on one keyboard for testing;
// online (Stage 2) every player uses WASD + Space on their own device.
const players: Player[] = [
  { id: 1, name: 'Green', color: '#3f8f7a' },
  { id: 2, name: 'Red', color: '#d0644f' },
];

const state = createGame(players, (Math.random() * 2 ** 32) >>> 0);
const keyboard = new Keyboard([WASD, LOCAL_P2]);
const renderer = new Renderer(document.querySelector<HTMLCanvasElement>('#game')!, placeholderSkin);
const hud = new Hud(document.querySelector('#scores')!, document.querySelector('#banner')!);

// Fixed 60 Hz simulation, rendering as fast as the display allows.
let acc = 0;
let last = performance.now();
function frame(now: number) {
  const realDt = Math.min(0.25, (now - last) / 1000);
  last = now;
  acc += realDt;
  while (acc >= DT) {
    const inputs = new Map<number, TankInput>([
      [1, keyboard.read(WASD)],
      [2, keyboard.read(LOCAL_P2)],
    ]);
    step(state, inputs);
    acc -= DT;
  }
  renderer.draw(state, acc / DT, realDt);
  hud.update(state);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
