import { describe, expect, it } from 'vitest';
import seed from '../data/games-2026.json';
import { type Dataset, type Game, gamesFor } from '../src/lib/data';
import { allDistances, analyze, buildGraph, longestCycle, shortestPath, stronglyConnected } from '../src/lib/graph';
import { teamInfo } from '../src/data/teams';

const data = seed as Dataset;
const abbr = (ids: string[]) => ids.map((t) => teamInfo(t).abbr);

let n = 0;
const game = (winner: string, loser: string, week = 1): Game => ({
  id: `t${n++}`, week, date: '2026-09-05', home: winner, away: loser, homePoints: 21, awayPoints: 14,
  neutral: false, homeConf: 'X', awayConf: 'X', conferenceGame: true,
});

describe('seed dataset', () => {
  it('holds 31 completed SEC games through Week 7 (Oct 17, 2026)', () => {
    const sec = gamesFor(data.games, 'SEC');
    expect(sec).toHaveLength(31);
    expect(Math.max(...sec.map((g) => g.week))).toBe(7);
    expect(sec.every((g) => g.date <= '2026-10-17' && g.homePoints !== g.awayPoints)).toBe(true);
  });

  it('never schedules a team twice in one week', () => {
    const seen = new Set<string>();
    for (const g of data.games) {
      for (const t of [g.home, g.away]) {
        const k = `${t}@${g.week}`;
        expect(seen.has(k), k).toBe(false);
        seen.add(k);
      }
    }
  });
});

describe('SEC parity analysis', () => {
  const a = analyze(gamesFor(data.games, 'SEC'));

  it('finds the 11-team ring starting from Georgia', () => {
    expect(abbr(a.cycle)).toEqual(['UGA', 'OU', 'TEX', 'TENN', 'BAMA', 'UK', 'LSU', 'MSU', 'SC', 'UF', 'AUB']);
    expect(a.cycleExhaustive).toBe(true);
  });

  it('every arrow in the ring is a real result', () => {
    a.cycle.forEach((t, i) => {
      expect(a.graph.adj.get(t)).toContain(a.cycle[(i + 1) % a.cycle.length]);
    });
  });

  it('has a 13-team strongly connected component', () => {
    expect(a.scc).toHaveLength(13);
    expect(abbr(a.scc).sort()).toEqual(
      ['UGA', 'OU', 'TEX', 'TENN', 'BAMA', 'UK', 'LSU', 'MSU', 'SC', 'UF', 'AUB', 'MIZ', 'MISS'].sort(),
    );
  });

  it('proves Auburn > Oklahoma through Georgia, and that nobody in the SCC is out of reach', () => {
    expect(shortestPath(a.graph, 'Auburn', 'Oklahoma')).toEqual(['Auburn', 'Georgia', 'Oklahoma']);
    const d = allDistances(a.graph);
    for (const x of a.scc) for (const y of a.scc) if (x !== y) expect(d.get(x)!.has(y)).toBe(true);
  });

  it('has no chain from winless Arkansas to anyone', () => {
    expect(shortestPath(a.graph, 'Arkansas', 'Georgia')).toBeNull();
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

  it('returns an empty cycle for an acyclic graph', () => {
    expect(longestCycle(buildGraph([game('A', 'B'), game('B', 'C')])).cycle).toEqual([]);
  });

  it('handles a split season series as a 2-cycle', () => {
    expect(longestCycle(buildGraph([game('A', 'B', 1), game('B', 'A', 2)])).cycle.sort()).toEqual(['A', 'B']);
  });

  it('reports a non-exhaustive search when the budget runs out', () => {
    const r = longestCycle(buildGraph(gamesFor(data.games, 'SEC')), { maxSteps: 20 });
    expect(r.exhaustive).toBe(false);
    expect(r.cycle.length).toBeLessThanOrEqual(11);
  });
});
