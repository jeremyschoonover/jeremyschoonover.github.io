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
  /** One longest cycle (the first found), or [] if the graph is acyclic. */
  cycle: string[];
  /** Every distinct longest cycle found, up to `maxCycles`. */
  cycles: string[][];
  /** False when the search budget ran out before every candidate was ruled out. */
  exhaustive: boolean;
}

/**
 * Longest simple cycles in the beat graph (NP-hard in general). Searches each strongly connected
 * component with a branch-and-bound DFS that only extends a cycle through vertices ordered after its
 * start, so every cycle is enumerated once. Ties are kept so callers can choose among equally long rings.
 */
export function longestCycle(g: WinGraph, opts: SearchBudget & { maxCycles?: number } = {}): CycleResult {
  let maxSteps = opts.maxSteps ?? 5_000_000;
  const maxCycles = opts.maxCycles ?? 50;
  const deadline = opts.maxMs ? Date.now() + opts.maxMs : Infinity;
  let steps = 0;
  let best: string[][] = [];
  let bestLen = 0;
  let exhaustive = true;
  const out = () => steps > maxSteps;

  for (const comp of stronglyConnected(g)) {
    if (comp.length < 2 || comp.length < bestLen) continue;
    const order = new Map(comp.map((t, i) => [t, i]));
    const nbrs = new Map(comp.map((t) => [t, (g.adj.get(t) ?? []).filter((x) => order.has(x))]));

    for (let s = 0; s < comp.length && comp.length - s >= Math.max(2, bestLen); s++) {
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
        if (path.length + reachable(v) < bestLen) return;
        for (const w of nbrs.get(v)!) {
          if (out() || (bestLen === comp.length && best.length >= maxCycles)) return;
          if (w === start) {
            if (path.length > bestLen) { bestLen = path.length; best = [[...path]]; }
            else if (path.length === bestLen && best.length < maxCycles) best.push([...path]);
            continue;
          }
          if (order.get(w)! < s || visited.has(w)) continue;
          visited.add(w); path.push(w);
          dfs(w);
          visited.delete(w); path.pop();
        }
      };
      dfs(start);
      if (out()) break;
    }
    if (out()) break;
  }
  return { cycle: best[0] ?? [], cycles: best, exhaustive };
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

/** Smallest margin of victory behind the edge winner -> loser. */
function edgeMargin(g: WinGraph, w: string, l: string): number {
  return Math.min(...(g.edgeGames.get(edgeKey(w, l)) ?? []).map((x) => winPts(x) - losePts(x)));
}

export interface Branches {
  /**
   * Chains of wins that attach the rest of the teams to the ring, each in win order (teams[i] beat
   * teams[i+1]). Exactly one end is already placed: the first team of an outward branch, or the last
   * team of an inward one (teams that beat their way into the circle without being beaten by it).
   */
  branches: string[][];
  /** Teams with no result linking them to anyone placed. */
  unattached: string[];
}

/**
 * Hang every team that isn't on the ring off it: repeatedly take the longest chain of wins that
 * runs from a placed team out through unplaced ones, or through unplaced ones into a placed team.
 * Ties go to outward chains, then chains anchored on the ring, then the tightest (smallest combined
 * margin), then alphabetically.
 */
export function branches(g: WinGraph, ring: string[], maxSteps = 2_000_000): Branches {
  const onRing = new Set(ring);
  const placed = new Set(ring);
  const remaining = new Set(g.teams.filter((t) => !placed.has(t)));
  const beatenBy = new Map<string, string[]>(g.teams.map((t) => [t, []]));
  for (const [w, ls] of g.adj) for (const l of ls) beatenBy.get(l)!.push(w);
  for (const ws of beatenBy.values()) ws.sort();
  const out: string[][] = [];
  let steps = 0;

  while (remaining.size) {
    let best: string[] = [];
    let bestKey: (number | string)[] | null = null;
    const consider = (chain: string[], outward: boolean) => {
      const anchor = outward ? chain[0] : chain[chain.length - 1];
      const margin = chain.slice(1).reduce((m, t, i) => m + edgeMargin(g, chain[i], t), 0);
      const key = [chain.length, outward ? 1 : 0, onRing.has(anchor) ? 1 : 0, -margin];
      const cmp = bestKey ? key.findIndex((k, i) => k !== bestKey![i]) : 0;
      const wins = !bestKey || (cmp >= 0 ? (key[cmp] as number) > (bestKey[cmp] as number) : chain.join('>') < best.join('>'));
      if (wins) { best = [...chain]; bestKey = key; }
    };
    // Walk `next` from each placed team through unplaced ones; `outward` says which way the wins run.
    const search = (next: Map<string, string[]>, outward: boolean) => {
      for (const start of [...placed].sort()) {
        const path = [start];
        const seen = new Set<string>();
        const dfs = (v: string) => {
          if (++steps > maxSteps) return;
          if (path.length > 1) consider(outward ? path : [...path].reverse(), outward);
          for (const w of next.get(v) ?? []) {
            if (!remaining.has(w) || seen.has(w)) continue;
            seen.add(w); path.push(w);
            dfs(w);
            seen.delete(w); path.pop();
          }
        };
        dfs(start);
      }
    };
    search(g.adj, true);
    search(beatenBy, false);
    if (best.length < 2) break;
    out.push(best);
    for (const t of best) { placed.add(t); remaining.delete(t); }
  }
  return { branches: out, unattached: [...remaining].sort() };
}

export interface Analysis {
  teams: string[];
  games: Game[];
  graph: WinGraph;
  records: Map<string, TeamRecord>;
  standings: TeamRecord[];
  /** The featured ring: of all longest cycles, the one with the smallest total margin of victory. */
  cycle: string[];
  /** Every longest cycle, featured ring first, each rotated to start at its best team. */
  rings: string[][];
  cycleExhaustive: boolean;
  sccs: string[][];
  /** Largest strongly connected component (the "circle of parity" pool). */
  scc: string[];
}

/** Total margin of victory around a ring; smaller means a tighter, more "parity" ring. */
export function ringMargin(g: WinGraph, ring: string[]): number {
  return ring.reduce((sum, t, i) => {
    const games = g.edgeGames.get(edgeKey(t, ring[(i + 1) % ring.length])) ?? [];
    return sum + Math.min(...games.map((x) => winPts(x) - losePts(x)));
  }, 0);
}

export function analyze(games: Game[], teams: string[] = [], opts: SearchBudget = {}): Analysis {
  const graph = buildGraph(games, teams);
  const recs = records(games, graph.teams);
  const cmp = (a: string, b: string) => compareRecords(recs.get(a)!, recs.get(b)!);
  const { cycles, exhaustive } = longestCycle(graph, opts);
  const rings = cycles
    .map((c) => rotateCycle(c, cmp))
    .map((c) => ({ c, m: ringMargin(graph, c), k: c.join('>') }))
    .sort((x, y) => x.m - y.m || x.k.localeCompare(y.k))
    .map((x) => x.c);
  const sccs = stronglyConnected(graph);
  return {
    teams: graph.teams,
    games,
    graph,
    records: recs,
    standings: [...recs.values()].sort(compareRecords),
    cycle: rings[0] ?? [],
    rings,
    cycleExhaustive: exhaustive,
    sccs,
    scc: sccs[0]?.length > 1 ? sccs[0] : [],
  };
}
