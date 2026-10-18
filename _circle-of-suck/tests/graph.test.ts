import { describe, expect, it } from 'vitest';
// A frozen copy of the results through Week 7. The live data/games-2026.json changes every
// Saturday, so tests that pin exact circles must not read it.
import seed from './fixtures/sec-2026-week7.json';
import liveData from '../data/games-2026.json';
import { type Dataset, type Game, secGames } from '../src/lib/data';
import { allDistances, analyze, buildGraph, longestCycle, mainBranch, shortestPath, stronglyConnected } from '../src/lib/graph';
import { teamInfo } from '../src/data/teams';

const data = seed as Dataset;
const abbr = (ids: string[]) => ids.map((t) => teamInfo(t).abbr);

let n = 0;
const game = (winner: string, loser: string, week = 1): Game => ({
  id: `t${n++}`, week, date: '2026-09-05', home: winner, away: loser, homePoints: 21, awayPoints: 14,
  neutral: false, homeConf: 'SEC', awayConf: 'SEC', conferenceGame: true,
});

describe('bundled 2026 SEC results', () => {
  const games = secGames(data.games);

  it('holds every SEC conference final through Week 7 (Oct 17, 2026)', () => {
    expect(games).toHaveLength(33);
    expect(Math.max(...games.map((g) => g.week))).toBe(7);
    expect(games.every((g) => g.date <= '2026-10-17' && g.homePoints !== g.awayPoints)).toBe(true);
  });

  it('never has a team playing twice in one week', () => {
    const seen = new Set<string>();
    for (const g of games) {
      for (const t of [g.home, g.away]) {
        const k = `${t}@${g.week}`;
        expect(seen.has(k), k).toBe(false);
        seen.add(k);
      }
    }
  });

  it('only uses teams with color metadata', () => {
    for (const g of games) for (const t of [g.home, g.away]) expect(teamInfo(t).color).not.toBe('#E7E3D9');
  });
});

describe('SEC parity analysis', () => {
  const a = analyze(secGames(data.games));

  it('features the tightest 11-team ring, starting from the best record', () => {
    expect(abbr(a.cycle)).toEqual(['UGA', 'OU', 'TEX', 'TENN', 'BAMA', 'UK', 'LSU', 'MSU', 'SC', 'UF', 'AUB']);
    expect(a.cycleExhaustive).toBe(true);
  });

  it('also finds the second 11-team ring through Missouri', () => {
    expect(a.rings).toHaveLength(2);
    expect(abbr(a.rings[1])).toEqual(['UGA', 'OU', 'TEX', 'TENN', 'BAMA', 'UK', 'LSU', 'MSU', 'MIZ', 'UF', 'AUB']);
  });

  it('every arrow in every ring is a real result', () => {
    for (const r of a.rings) r.forEach((t, i) => expect(a.graph.adj.get(t)).toContain(r[(i + 1) % r.length]));
  });

  it('has a 13-team strongly connected core', () => {
    expect(abbr(a.scc).sort()).toEqual(
      ['UGA', 'OU', 'TEX', 'TENN', 'BAMA', 'UK', 'LSU', 'MSU', 'SC', 'UF', 'AUB', 'MIZ', 'MISS'].sort(),
    );
    const d = allDistances(a.graph);
    for (const x of a.scc) for (const y of a.scc) if (x !== y) expect(d.get(x)!.has(y)).toBe(true);
  });

  it('proves Oklahoma > Georgia despite losing to them', () => {
    const p = shortestPath(a.graph, 'Oklahoma', 'Georgia')!;
    expect(p[0]).toBe('Oklahoma');
    expect(p[p.length - 1]).toBe('Georgia');
    p.slice(0, -1).forEach((t, i) => expect(a.graph.adj.get(t)).toContain(p[i + 1]));
  });

  it('has no chain from Texas A&M back into the core', () => {
    expect(shortestPath(a.graph, 'Texas A&M', 'Georgia')).toBeNull();
  });
});

describe('the branch off the circle', () => {
  const a = analyze(secGames(data.games));

  it('runs from Florida through all five other teams', () => {
    const b = mainBranch(a.graph, a.cycle);
    expect(abbr(b)).toEqual(['UF', 'MISS', 'MIZ', 'TAMU', 'ARK', 'VAN']);
    b.slice(0, -1).forEach((t, i) => expect(a.graph.adj.get(t)).toContain(b[i + 1]));
  });

  it('only leaves the ring once', () => {
    const b = mainBranch(a.graph, a.cycle);
    expect(b.slice(1).filter((t) => a.cycle.includes(t))).toEqual([]);
  });

  it('is empty when no ring team has beaten anyone outside it', () => {
    const g = buildGraph([game('A', 'B'), game('B', 'C'), game('C', 'A'), game('X', 'A')]);
    expect(mainBranch(g, ['A', 'B', 'C'])).toEqual([]);
  });

  it('prefers the longest chain, then the tightest', () => {
    const g = buildGraph([game('A', 'B'), game('B', 'A'), game('A', 'X'), game('B', 'Y'), game('Y', 'Z')]);
    expect(mainBranch(g, ['A', 'B'])).toEqual(['B', 'Y', 'Z']);
  });
});

describe('graph primitives', () => {
  it('finds SCCs on a small graph', () => {
    const g = buildGraph([game('A', 'B'), game('B', 'C'), game('C', 'A'), game('C', 'D')]);
    expect(stronglyConnected(g)).toEqual([['A', 'B', 'C'], ['D']]);
  });

  it('prefers the longest of several cycles', () => {
    // A>B>C>A (3) and A>B>D>E>C>A (5)
    const g = buildGraph([game('A', 'B'), game('B', 'C'), game('C', 'A'), game('B', 'D'), game('D', 'E'), game('E', 'C')]);
    expect(longestCycle(g).cycle).toHaveLength(5);
  });

  it('collects ties', () => {
    // A>B>C>A and A>D>C... two 3-cycles through A and C.
    const g = buildGraph([game('A', 'B'), game('B', 'C'), game('C', 'A'), game('A', 'D'), game('D', 'C')]);
    expect(longestCycle(g).cycles).toHaveLength(2);
  });

  it('returns an empty cycle for an acyclic graph', () => {
    expect(longestCycle(buildGraph([game('A', 'B'), game('B', 'C')])).cycle).toEqual([]);
  });

  it('handles a split season series as a 2-cycle', () => {
    expect(longestCycle(buildGraph([game('A', 'B', 1), game('B', 'A', 2)])).cycle.sort()).toEqual(['A', 'B']);
  });

  it('reports a non-exhaustive search when the budget runs out', () => {
    const r = longestCycle(buildGraph(secGames(data.games)), { maxSteps: 20 });
    expect(r.exhaustive).toBe(false);
    expect(r.cycle.length).toBeLessThanOrEqual(11);
  });
});

describe('live data (whatever week it is)', () => {
  const live = secGames((liveData as Dataset).games);
  const a = analyze(live);

  it('never has a team playing twice in one week, and has no ties', () => {
    const seen = new Set<string>();
    for (const g of live) {
      expect(g.homePoints).not.toBe(g.awayPoints);
      for (const t of [g.home, g.away]) {
        const k = `${t}@${g.week}`;
        expect(seen.has(k), k).toBe(false);
        seen.add(k);
      }
    }
  });

  it('draws a circle and branch made only of real results', () => {
    a.cycle.forEach((t, i) => expect(a.graph.adj.get(t)).toContain(a.cycle[(i + 1) % a.cycle.length]));
    const b = mainBranch(a.graph, a.cycle);
    b.slice(0, -1).forEach((t, i) => expect(a.graph.adj.get(t)).toContain(b[i + 1]));
  });
});
