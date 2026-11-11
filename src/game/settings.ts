/** Options the host can change in the lobby. */
export interface MatchSettings {
  /** Your own bullets can destroy your tank. */
  selfDamage: boolean;
  /** Item pickups (not built yet, setting is stored for later). */
  items: boolean;
  /** First to this many round wins takes the match. 0 = play forever. */
  pointsToWin: number;
}

export const DEFAULT_SETTINGS: MatchSettings = {
  selfDamage: true,
  items: true,
  pointsToWin: 5,
};

export const POINTS_TO_WIN_OPTIONS = [3, 5, 10, 20, 0];

export const MAX_PLAYERS = 8;

/** One colour per lobby slot. */
export const PLAYER_COLORS = [
  '#3f8f7a', // green
  '#d0644f', // red
  '#4a78c2', // blue
  '#d8a03a', // amber
  '#8a5cc0', // purple
  '#d9659b', // pink
  '#2f9fb3', // teal
  '#7c8a3a', // olive
];
