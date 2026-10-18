/**
 * Site identity and the facts every surface shares (page, post image, link preview). The brand is
 * league-agnostic; each league lives at its own path under the site root, starting with the SEC.
 */
import { teamInfo } from './data/teams';
import { type Dataset, losePts, secGames, winPts } from './lib/data';
import { type Analysis, analyze, branches, edgeKey } from './lib/graph';

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
  /** Chains of wins hanging off the ring; each starts at a team already shown. */
  branches: { teams: string[]; results: Result[] }[];
  /** Teams no chain of wins reaches yet (for example, unbeaten ones). */
  unattached: string[];
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
  const tree = ring.length ? branches(a.graph, ring) : { branches: [], unattached: [] };
  const hanging = tree.branches.map((p) => ({ teams: p, results: p.slice(1).map((t, i) => result(p[i], t)) }));
  const week = Math.max(0, ...a.games.map((g) => g.week));
  const lastGame = a.games.map((g) => g.date).sort().at(-1) ?? '';
  const sourceLine = data.source === 'compiled'
    ? 'Scores compiled from ESPN, CBS Sports and Fox Sports box scores.'
    : 'Scores from CollegeFootballData.com.';
  const said = (rs: Result[]) => rs.map((r) => `${r.winner} beat ${r.loser} ${r.score}`).join(', ');
  const alt = ring.length
    ? `${LEAGUE.name} circle of suck through Week ${week}: ${said(results)}.`
      + hanging.map((b) => ` Off the circle: ${said(b.results)}.`).join('')
      + (tree.unattached.length ? ` Not connected yet: ${tree.unattached.join(', ')}.` : '')
    : `${LEAGUE.name} circle of suck: no circle yet.`;
  return { a, week, lastGame, results, branches: hanging, unattached: tree.unattached, sourceLine, alt };
}

/** Abbreviations for the teams on the ring and outside it, used for logo file names. */
export const abbr = (team: string) => teamInfo(team).abbr;
