/**
 * Saturday sync: pull 2026 SEC finals from CollegeFootballData.com, then recompute the longest
 * cycles, strongly connected components and all-pairs shortest transitive paths.
 *
 *   CFBD_API_KEY=... npx tsx scripts/sync.ts      # fetch + recompute
 *   npx tsx scripts/sync.ts --offline             # recompute from data/games-2026.json only
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { type Dataset, type Game, normalizeCfbdGame, secGames, sortGames } from '../src/lib/data';
import { analyze, ringMargin, shortestPath } from '../src/lib/graph';

const YEAR = 2026;
const GAMES = new URL('../data/games-2026.json', import.meta.url);
const ANALYSIS = new URL('../data/analysis-2026.json', import.meta.url);
const API = `https://api.collegefootballdata.com/games?year=${YEAR}&seasonType=regular&conference=SEC`;

async function fetchGames(key: string): Promise<Game[]> {
  const res = await fetch(API, { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' } });
  if (!res.ok) {
    throw Object.assign(new Error(`CFBD ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 200)}`), { status: res.status });
  }
  const raw = (await res.json()) as Record<string, unknown>[];
  return sortGames(secGames(raw.map(normalizeCfbdGame).filter((g): g is Game => g !== null)));
}

/** Compare by results only, so a sync that finds no new finals writes nothing. */
const fingerprint = (games: Game[]) =>
  JSON.stringify(sortGames(games).map((g) => [g.date, g.home, g.away, g.homePoints, g.awayPoints]));

async function main() {
  let data = JSON.parse(readFileSync(GAMES, 'utf8')) as Dataset;
  const key = process.env.CFBD_API_KEY;

  if (process.argv.includes('--offline')) {
    console.log('Offline: recomputing from the existing dataset.');
  } else if (!key) {
    // A GitHub Actions annotation, so a missing secret shows up on the run instead of passing quietly.
    console.log('::warning::CFBD_API_KEY is not set; keeping the existing results. Add it under Settings > Secrets and variables > Actions.');
  } else {
    let games: Game[] | null = null;
    try {
      games = await fetchGames(key);
    } catch (e) {
      // Over quota, a 5xx, a network blip: keep what's on file so the rest of the job still publishes.
      console.log(`::warning::CFBD fetch failed (${(e as Error).message}); keeping the existing results.`);
      // A rejected or over-quota key won't fix itself, so fail this step (after the analysis below);
      // the workflow still publishes, then turns the run red so the owner hears about it.
      if ([401, 403, 429].includes((e as { status?: number }).status ?? 0)) process.exitCode = 1;
    }
    if (!games) {
      // Nothing new; fall through to recompute from what's on file.
    } else if (games.length < secGames(data.games).length) {
      // Never replace a fuller dataset with a partial response.
      console.log(`CFBD returned ${games.length} SEC finals, fewer than the ${data.games.length} on file; keeping the existing dataset.`);
    } else if (fingerprint(games) === fingerprint(data.games)) {
      console.log('No new finals.');
    } else {
      data = { season: YEAR, source: 'collegefootballdata.com', updatedAt: new Date().toISOString(), games };
      writeFileSync(GAMES, JSON.stringify(data, null, 1) + '\n');
      console.log(`Wrote ${games.length} SEC finals.`);
    }
  }

  const a = analyze(secGames(data.games), [], { maxSteps: Infinity, maxMs: 60_000 });
  const paths: Record<string, Record<string, string[]>> = {};
  for (const x of a.teams) for (const y of a.teams) {
    const p = x === y ? null : shortestPath(a.graph, x, y);
    if (p) (paths[x] ??= {})[y] = p;
  }
  const out = {
    season: YEAR,
    source: data.source,
    dataUpdatedAt: data.updatedAt,
    games: a.games.length,
    teams: a.teams.length,
    rings: a.rings.map((r) => ({ teams: r, margin: ringMargin(a.graph, r) })),
    cycleExhaustive: a.cycleExhaustive,
    scc: a.scc,
    parityIndex: a.teams.length ? +(a.cycle.length / a.teams.length).toFixed(4) : 0,
    paths,
  };
  writeFileSync(ANALYSIS, JSON.stringify(out) + '\n');
  console.log(`${a.games.length} games, ${a.rings.length} longest ring(s) of ${a.cycle.length}, core of ${a.scc.length}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
