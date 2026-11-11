import { CELL, EXTRA_OPENINGS, WALL } from './constants';
import { Rng } from './rng';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Maze {
  cols: number;
  rows: number;
  width: number;
  height: number;
  /** hWalls[r][c]: wall along the top edge of cell (c, r). r = 0..rows */
  hWalls: boolean[][];
  /** vWalls[r][c]: wall along the left edge of cell (c, r). c = 0..cols */
  vWalls: boolean[][];
  /** Merged wall rectangles used for collision and drawing. */
  walls: Rect[];
  style: MazeStyle;
}

/**
 * classic: the usual maze. tight: small and twisty with almost no shortcuts.
 * open: big arena with most of the walls knocked out.
 */
export type MazeStyle = 'classic' | 'tight' | 'open';

export const MAZE_STYLES: Record<MazeStyle, { name: string; weight: number; baseCells: number; perPlayer: number; openings: number }> = {
  classic: { name: 'Classic', weight: 50, baseCells: 30, perPlayer: 8, openings: EXTRA_OPENINGS },
  tight:   { name: 'Tight',   weight: 25, baseCells: 12, perPlayer: 4, openings: 0.08 },
  open:    { name: 'Open',    weight: 25, baseCells: 60, perPlayer: 12, openings: 0.72 },
};

export function mazeStyleFor(rng: Rng): MazeStyle {
  const styles = Object.keys(MAZE_STYLES) as MazeStyle[];
  let x = rng.next() * styles.reduce((s, k) => s + MAZE_STYLES[k].weight, 0);
  for (const k of styles) if ((x -= MAZE_STYLES[k].weight) < 0) return k;
  return 'classic';
}

/** Maze grows with the number of players so 8 tanks don't spawn on top of each other. */
export function mazeSizeFor(players: number, rng: Rng, style: MazeStyle = 'classic'): { cols: number; rows: number } {
  const def = MAZE_STYLES[style];
  const cells = def.baseCells + Math.max(2, players) * def.perPlayer;
  const cols = Math.max(4, Math.round(Math.sqrt(cells * 1.5)) + rng.int(-1, 1));
  const rows = Math.max(4, Math.round(cells / cols));
  return { cols, rows };
}

export function generateMaze(
  cols: number, rows: number, rng: Rng, extraOpenings = EXTRA_OPENINGS, style: MazeStyle = 'classic',
): Maze {
  const hWalls = Array.from({ length: rows + 1 }, () => Array<boolean>(cols).fill(true));
  const vWalls = Array.from({ length: rows }, () => Array<boolean>(cols + 1).fill(true));
  const visited = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));

  // Depth-first "recursive backtracker": guarantees every cell is reachable.
  const start: [number, number] = [rng.int(0, cols - 1), rng.int(0, rows - 1)];
  visited[start[1]][start[0]] = true;
  const stack = [start];
  while (stack.length) {
    const [c, r] = stack[stack.length - 1];
    const options: [number, number, 'N' | 'S' | 'W' | 'E'][] = [];
    if (r > 0 && !visited[r - 1][c]) options.push([c, r - 1, 'N']);
    if (r < rows - 1 && !visited[r + 1][c]) options.push([c, r + 1, 'S']);
    if (c > 0 && !visited[r][c - 1]) options.push([c - 1, r, 'W']);
    if (c < cols - 1 && !visited[r][c + 1]) options.push([c + 1, r, 'E']);
    if (!options.length) {
      stack.pop();
      continue;
    }
    const [nc, nr, dir] = rng.pick(options);
    if (dir === 'N') hWalls[r][c] = false;
    if (dir === 'S') hWalls[r + 1][c] = false;
    if (dir === 'W') vWalls[r][c] = false;
    if (dir === 'E') vWalls[r][c + 1] = false;
    visited[nr][nc] = true;
    stack.push([nc, nr]);
  }

  // Knock out extra interior walls so there are loops and multiple routes.
  for (let r = 1; r < rows; r++)
    for (let c = 0; c < cols; c++) if (hWalls[r][c] && rng.next() < extraOpenings) hWalls[r][c] = false;
  for (let r = 0; r < rows; r++)
    for (let c = 1; c < cols; c++) if (vWalls[r][c] && rng.next() < extraOpenings) vWalls[r][c] = false;

  return { cols, rows, width: cols * CELL, height: rows * CELL, hWalls, vWalls, walls: wallRects(cols, rows, hWalls, vWalls), style };
}

/** Merge runs of wall edges into as few rectangles as possible. */
function wallRects(cols: number, rows: number, h: boolean[][], v: boolean[][]): Rect[] {
  const rects: Rect[] = [];
  const half = WALL / 2;
  for (let r = 0; r <= rows; r++) {
    let c = 0;
    while (c < cols) {
      if (!h[r][c]) { c++; continue; }
      const start = c;
      while (c < cols && h[r][c]) c++;
      rects.push({ x: start * CELL - half, y: r * CELL - half, w: (c - start) * CELL + WALL, h: WALL });
    }
  }
  for (let c = 0; c <= cols; c++) {
    let r = 0;
    while (r < rows) {
      if (!v[r][c]) { r++; continue; }
      const start = r;
      while (r < rows && v[r][c]) r++;
      rects.push({ x: c * CELL - half, y: start * CELL - half, w: WALL, h: (r - start) * CELL + WALL });
    }
  }
  return rects;
}
