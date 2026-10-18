/**
 * Site identity and the facts every surface shares (page, post image, link preview). The brand is
 * league-agnostic; each league lives at its own path under the site root, starting with the SEC.
 */
import { teamInfo } from './data/teams';
import { type Dataset, losePts, secGames, winPts } from './lib/data';
import { type Analysis, analyze, edgeKey, mainBranch } from './lib/graph';

export const SITE = {
  name: 'Circle of Suck',
  origin: 'https://jeremyschoonover.github.io',
  /** Site root; leagues live below it. */
  root: '/circle-of-suck/',
  /** Short form printed on images as the watermark. */
  display: 'jeremyschoonover.github.io/circle-of-suck',
  author: 'Jeremy Schoonover',
  authorUrl: 'https://jeremyschoonover.github.io/',
  issues: 'https://github.com/jeremyschoonover/jeremyschoonover.github.io/issues/new',
} as const;

export const LEAGUE = { id: 'sec', name: 'SEC', season: 2026 } as const;

export const PAGE_URL = `${SITE.origin}${SITE.root}${LEAGUE.id}/`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Oct 17, 2026" from an ISO date. */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export interface Result { winner: string; loser: string; score: string }

export interface Info {
  a: Analysis;
  week: number;
  lastGame: string;
  /** The ring's results in order: ring[i] beat ring[i+1]. */
  results: Result[];
  /** The main branch: the longest chain of wins running off the ring, starting at a ring team. */
  branch: { teams: string[]; results: Result[] } | null;
  /** Teams on neither the ring nor the branch. */
  rest: string[];
  sourceLine: string;
  alt: string;
}

export function info(data: Dataset): Info {
  const a = analyze(secGames(data.games));
  const ring = a.cycle;
  const result = (w: string, l: string): Result => {
    const g = a.graph.edgeGames.get(edgeKey(w, l))!.at(-1)!;
    return { winner: w, loser: l, score: `${winPts(g)}-${losePts(g)}` };
  };
  const results = ring.map((t, i) => result(t, ring[(i + 1) % ring.length]));
  const path = ring.length ? mainBranch(a.graph, ring) : [];
  const branch = path.length ? { teams: path, results: path.slice(1).map((t, i) => result(path[i], t)) } : null;
  const shown = new Set([...ring, ...path]);
  const rest = a.standings.map((r) => r.team).filter((t) => !shown.has(t));
  const week = Math.max(0, ...a.games.map((g) => g.week));
  const lastGame = a.games.map((g) => g.date).sort().at(-1) ?? '';
  const sourceLine = data.source === 'compiled'
    ? 'Scores compiled from ESPN, CBS Sports and Fox Sports box scores.'
    : 'Scores from CollegeFootballData.com.';
  const said = (rs: Result[]) => rs.map((r) => `${r.winner} beat ${r.loser} ${r.score}`).join(', ');
  const alt = ring.length
    ? `${LEAGUE.name} circle of suck through Week ${week}: ${said(results)}.`
      + (branch ? ` Branching off ${branch.teams[0]}: ${said(branch.results)}.` : '')
      + (rest.length ? ` The rest: ${rest.join(', ')}.` : '')
    : `${LEAGUE.name} circle of suck: no circle yet.`;
  return { a, week, lastGame, results, branch, rest, sourceLine, alt };
}

/** Abbreviations for the teams on the ring and outside it, used for logo file names. */
export const abbr = (team: string) => teamInfo(team).abbr;
