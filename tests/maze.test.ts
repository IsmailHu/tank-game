import { describe, expect, it } from 'vitest';
import { generateMaze, mazeSizeFor } from '../src/game/maze';
import { Rng } from '../src/game/rng';

function reachableCells(m: ReturnType<typeof generateMaze>): number {
  const seen = new Set<string>(['0,0']);
  const queue: [number, number][] = [[0, 0]];
  while (queue.length) {
    const [c, r] = queue.shift()!;
    const next: [number, number, boolean][] = [
      [c, r - 1, !m.hWalls[r][c]],
      [c, r + 1, !m.hWalls[r + 1][c]],
      [c - 1, r, !m.vWalls[r][c]],
      [c + 1, r, !m.vWalls[r][c + 1]],
    ];
    for (const [nc, nr, open] of next) {
      if (!open || nc < 0 || nr < 0 || nc >= m.cols || nr >= m.rows) continue;
      const k = `${nc},${nr}`;
      if (!seen.has(k)) { seen.add(k); queue.push([nc, nr]); }
    }
  }
  return seen.size;
}

describe('maze', () => {
  it('every cell is reachable and the border is closed', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const m = generateMaze(10, 7, new Rng(seed));
      expect(reachableCells(m)).toBe(70);
      expect(m.hWalls[0].every(Boolean)).toBe(true);
      expect(m.hWalls[7].every(Boolean)).toBe(true);
      expect(m.vWalls.every((row) => row[0] && row[10])).toBe(true);
    }
  });

  it('same seed gives the same maze', () => {
    expect(generateMaze(8, 6, new Rng(42)).walls).toEqual(generateMaze(8, 6, new Rng(42)).walls);
  });

  it('grows with player count', () => {
    const area = (p: number) => { const s = mazeSizeFor(p, new Rng(1)); return s.cols * s.rows; };
    expect(area(8)).toBeGreaterThan(area(2));
  });
});
