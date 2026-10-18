import { type Game, losePts, loser, winPts, winner } from './data';

/** Directed "beat" graph: an edge A -> B means A beat B. */
export interface WinGraph {
  teams: string[];
  adj: Map<string, string[]>;
  /** Games behind each edge, keyed `${winner}>${loser}`. */
  edgeGames: Map<string, Game[]>;
}

export const edgeKey = (a: string, b: string) => `${a}>${b}`;

export function buildGraph(games: Game[], extraTeams: string[] = []): WinGraph {
  const teams = new Set<string>(extraTeams);
  const adj = new Map<string, Set<string>>();
  const edgeGames = new Map<string, Game[]>();
  for (const g of games) {
    teams.add(g.home).add(g.away);
    const w = winner(g);
    const l = loser(g);
    if (!adj.has(w)) adj.set(w, new Set());
    adj.get(w)!.add(l);
    const k = edgeKey(w, l);
    edgeGames.set(k, [...(edgeGames.get(k) ?? []), g]);
  }
  const sorted = [...teams].sort();
  return {
    teams: sorted,
    adj: new Map(sorted.map((t) => [t, [...(adj.get(t) ?? [])].sort()])),
    edgeGames,
  };
}

export interface TeamRecord {
  team: string;
  w: number;
  l: number;
  pf: number;
  pa: number;
}

export function records(games: Game[], teams: string[] = []): Map<string, TeamRecord> {
  const m = new Map<string, TeamRecord>(teams.map((t) => [t, { team: t, w: 0, l: 0, pf: 0, pa: 0 }]));
  const get = (t: string) => {
    if (!m.has(t)) m.set(t, { team: t, w: 0, l: 0, pf: 0, pa: 0 });
    return m.get(t)!;
  };
  for (const g of games) {
    const w = get(winner(g));
    const l = get(loser(g));
    w.w++; w.pf += winPts(g); w.pa += losePts(g);
    l.l++; l.pf += losePts(g); l.pa += winPts(g);
  }
  return m;
}

/** Standings order: win pct, then point differential, then name. */
export function compareRecords(a: TeamRecord, b: TeamRecord): number {
  const pa = a.w + a.l ? a.w / (a.w + a.l) : 0;
  const pb = b.w + b.l ? b.w / (b.w + b.l) : 0;
  return pb - pa || b.pf - b.pa - (a.pf - a.pa) || a.team.localeCompare(b.team);
}

/** Tarjan's algorithm. Components are returned largest first, members sorted by name. */
export function stronglyConnected(g: WinGraph): string[][] {
  let index = 0;
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const out: string[][] = [];

  // Iterative to stay safe on large FBS graphs.
  for (const root of g.teams) {
    if (idx.has(root)) continue;
    const work: [string, number][] = [[root, 0]];
    while (work.length) {
      const frame = work[work.length - 1];
      const [v, i] = frame;
      if (i === 0) {
        idx.set(v, index); low.set(v, index); index++;
        stack.push(v); onStack.add(v);
      }
      const nbrs = g.adj.get(v) ?? [];
      if (i < nbrs.length) {
        frame[1]++;
        const w = nbrs[i];
        if (!idx.has(w)) work.push([w, 0]);
        else if (onStack.has(w)) low.set(v, Math.min(low.get(v)!, idx.get(w)!));
        continue;
      }
      work.pop();
      if (work.length) {
        const parent = work[work.length - 1][0];
        low.set(parent, Math.min(low.get(parent)!, low.get(v)!));
      }
      if (low.get(v) === idx.get(v)) {
        const comp: string[] = [];
        let w: string;
        do { w = stack.pop()!; onStack.delete(w); comp.push(w); } while (w !== v);
        out.push(comp.sort());
      }
    }
  }
  return out.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
}

export interface SearchBudget {
  maxSteps?: number;
  maxMs?: number;
}

export interface CycleResult {
  cycle: string[];
  /** False when the search budget ran out before every candidate was ruled out. */
  exhaustive: boolean;
}

/**
 * Longest simple cycle in the beat graph (NP-hard in general). Searches each strongly connected
 * component with a branch-and-bound DFS that only extends a cycle through vertices ordered after its
 * start, so every cycle is enumerated once. `maxSteps` caps the work for huge graphs (All FBS).
 */
export function longestCycle(g: WinGraph, opts: SearchBudget = {}): CycleResult {
  let maxSteps = opts.maxSteps ?? 5_000_000;
  const deadline = opts.maxMs ? Date.now() + opts.maxMs : Infinity;
  let steps = 0;
  let best: string[] = [];
  let exhaustive = true;

  for (const comp of stronglyConnected(g)) {
    if (comp.length < 2 || comp.length <= best.length) continue;
    const order = new Map(comp.map((t, i) => [t, i]));
    const nbrs = new Map(comp.map((t) => [t, (g.adj.get(t) ?? []).filter((x) => order.has(x))]));

    for (let s = 0; s < comp.length && comp.length - s > best.length; s++) {
      const start = comp[s];
      const path = [start];
      const visited = new Set([start]);

      // Upper bound: vertices still reachable from `v` without revisiting the path.
      const reachable = (v: string) => {
        const seen = new Set<string>();
        const q = [v];
        while (q.length) {
          for (const w of nbrs.get(q.pop()!)!) {
            if (order.get(w)! > s && !visited.has(w) && !seen.has(w)) { seen.add(w); q.push(w); }
          }
        }
        return seen.size;
      };

      const dfs = (v: string): void => {
        if (++steps > maxSteps || ((steps & 1023) === 0 && Date.now() > deadline)) {
          maxSteps = Math.min(maxSteps, steps - 1);
          exhaustive = false;
          return;
        }
        if (path.length + reachable(v) <= best.length) return;
        for (const w of nbrs.get(v)!) {
          if (steps > maxSteps || best.length === comp.length) return;
          if (w === start) {
            if (path.length > best.length) best = [...path];
            continue;
          }
          if (order.get(w)! < s || visited.has(w)) continue;
          visited.add(w); path.push(w);
          dfs(w);
          visited.delete(w); path.pop();
        }
      };
      dfs(start);
      if (steps > maxSteps) break;
    }
    if (steps > maxSteps) break;
  }
  return { cycle: best, exhaustive };
}

/** Rotate a cycle so it starts at the team that sorts first by `compare`. */
export function rotateCycle(cycle: string[], compare: (a: string, b: string) => number): string[] {
  if (!cycle.length) return cycle;
  const top = [...cycle].sort(compare)[0];
  const i = cycle.indexOf(top);
  return [...cycle.slice(i), ...cycle.slice(0, i)];
}

/** Breadth-first search for the fewest-step chain `from` beat X beat ... beat `to`. */
export function shortestPath(g: WinGraph, from: string, to: string): string[] | null {
  if (from === to || !g.adj.has(from) || !g.adj.has(to)) return null;
  const prev = new Map<string, string>([[from, from]]);
  const q = [from];
  for (let h = 0; h < q.length; h++) {
    const v = q[h];
    for (const w of g.adj.get(v)!) {
      if (prev.has(w)) continue;
      prev.set(w, v);
      if (w === to) {
        const path = [to];
        while (path[0] !== from) path.unshift(prev.get(path[0])!);
        return path;
      }
      q.push(w);
    }
  }
  return null;
}

/** Hop distance from every team to every team it transitively beats. */
export function allDistances(g: WinGraph): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const s of g.teams) {
    const d = new Map<string, number>([[s, 0]]);
    const q = [s];
    for (let h = 0; h < q.length; h++) {
      for (const w of g.adj.get(q[h])!) {
        if (!d.has(w)) { d.set(w, d.get(q[h])! + 1); q.push(w); }
      }
    }
    d.delete(s);
    out.set(s, d);
  }
  return out;
}

export interface Analysis {
  teams: string[];
  games: Game[];
  graph: WinGraph;
  records: Map<string, TeamRecord>;
  standings: TeamRecord[];
  cycle: string[];
  cycleExhaustive: boolean;
  sccs: string[][];
  /** Largest strongly connected component (the "circle of parity" pool). */
  scc: string[];
}

export function analyze(games: Game[], teams: string[] = [], opts: SearchBudget = {}): Analysis {
  const graph = buildGraph(games, teams);
  const recs = records(games, graph.teams);
  const cmp = (a: string, b: string) => compareRecords(recs.get(a)!, recs.get(b)!);
  const { cycle, exhaustive } = longestCycle(graph, opts);
  const sccs = stronglyConnected(graph);
  return {
    teams: graph.teams,
    games,
    graph,
    records: recs,
    standings: [...recs.values()].sort(compareRecords),
    cycle: rotateCycle(cycle, cmp),
    cycleExhaustive: exhaustive,
    sccs,
    scc: sccs[0]?.length > 1 ? sccs[0] : [],
  };
}
