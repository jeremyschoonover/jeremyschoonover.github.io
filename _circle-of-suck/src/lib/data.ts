export interface Game {
  id: string;
  week: number;
  /** ISO date (YYYY-MM-DD) of kickoff, Eastern. */
  date: string;
  home: string;
  away: string;
  homePoints: number;
  awayPoints: number;
  neutral: boolean;
  homeConf: string;
  awayConf: string;
  conferenceGame: boolean;
  /** Decided in overtime. */
  ot?: boolean;
}

export interface Dataset {
  season: number;
  /** `compiled`: hand-checked finals bundled with the app; replaced by the first CFBD sync. */
  source: 'compiled' | 'collegefootballdata.com';
  updatedAt: string;
  games: Game[];
}

export const winner = (g: Game) => (g.homePoints > g.awayPoints ? g.home : g.away);
export const loser = (g: Game) => (g.homePoints > g.awayPoints ? g.away : g.home);
export const winPts = (g: Game) => Math.max(g.homePoints, g.awayPoints);
export const losePts = (g: Game) => Math.min(g.homePoints, g.awayPoints);

/** SEC conference games: both teams in the SEC. */
export function secGames(games: Game[]): Game[] {
  return games.filter((g) => g.homeConf === 'SEC' && g.awayConf === 'SEC');
}

export function teamsIn(games: Game[]): string[] {
  const s = new Set<string>();
  for (const g of games) s.add(g.home).add(g.away);
  return [...s].sort();
}

type Raw = Record<string, unknown>;
const pick = (r: Raw, ...keys: string[]) => {
  for (const k of keys) if (r[k] !== undefined && r[k] !== null) return r[k];
  return undefined;
};

/**
 * Normalize one record from the CollegeFootballData /games endpoint (v2 camelCase or v1 snake_case).
 * Returns null for games that are unfinished, tied, or involve a non-FBS team.
 */
export function normalizeCfbdGame(r: Raw): Game | null {
  const hp = pick(r, 'homePoints', 'home_points');
  const ap = pick(r, 'awayPoints', 'away_points');
  const completed = pick(r, 'completed');
  if (typeof hp !== 'number' || typeof ap !== 'number' || completed === false || hp === ap) return null;
  const hc = pick(r, 'homeClassification', 'home_division', 'home_classification');
  const ac = pick(r, 'awayClassification', 'away_division', 'away_classification');
  if ((hc !== undefined && hc !== 'fbs') || (ac !== undefined && ac !== 'fbs')) return null;
  const start = String(pick(r, 'startDate', 'start_date') ?? '');
  return {
    id: String(pick(r, 'id') ?? `${start}-${pick(r, 'homeTeam', 'home_team')}`),
    week: Number(pick(r, 'week') ?? 0),
    date: easternDate(start),
    home: String(pick(r, 'homeTeam', 'home_team')),
    away: String(pick(r, 'awayTeam', 'away_team')),
    homePoints: hp,
    awayPoints: ap,
    neutral: Boolean(pick(r, 'neutralSite', 'neutral_site')),
    homeConf: String(pick(r, 'homeConference', 'home_conference') ?? ''),
    awayConf: String(pick(r, 'awayConference', 'away_conference') ?? ''),
    conferenceGame: Boolean(pick(r, 'conferenceGame', 'conference_game')),
    ot: lineScoreCount(pick(r, 'homeLineScores', 'home_line_scores')) > 4,
  };
}

function lineScoreCount(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

/** Kickoffs are stored in UTC; a 10:30pm ET kickoff is the next day in UTC, so shift to Eastern. */
export function easternDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Date(d.getTime() - 5 * 3600_000).toISOString().slice(0, 10);
}

export function sortGames(games: Game[]): Game[] {
  return [...games].sort((a, b) => a.date.localeCompare(b.date) || a.week - b.week || a.home.localeCompare(b.home));
}
