/**
 * Saturday sync: pull 2026 finals from CollegeFootballData.com, then recompute the longest cycle,
 * strongly connected components and all-pairs shortest transitive paths for every conference view.
 *
 *   CFBD_API_KEY=... npx tsx scripts/sync.ts      # fetch + recompute
 *   npx tsx scripts/sync.ts --offline             # recompute from data/games-2026.json only
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { CONFERENCES, type ConferenceId } from '../src/data/teams';
import { type Dataset, type Game, gamesFor, normalizeCfbdGame, sortGames } from '../src/lib/data';
import { analyze, shortestPath } from '../src/lib/graph';

const YEAR = 2026;
const GAMES = new URL('../data/games-2026.json', import.meta.url);
const ANALYSIS = new URL('../data/analysis-2026.json', import.meta.url);
const API = `https://api.collegefootballdata.com/games?year=${YEAR}`;

async function fetchGames(key: string): Promise<Game[]> {
  const res = await fetch(`${API}&seasonType=regular&classification=fbs`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`CFBD ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 200)}`);
  const raw = (await res.json()) as Record<string, unknown>[];
  return sortGames(raw.map(normalizeCfbdGame).filter((g): g is Game => g !== null));
}

function stable(d: Dataset) {
  return JSON.stringify(d.games);
}

async function main() {
  const offline = process.argv.includes('--offline');
  let data = JSON.parse(readFileSync(GAMES, 'utf8')) as Dataset;
  const key = process.env.CFBD_API_KEY;

  if (!offline) {
    if (!key) {
      console.log('CFBD_API_KEY not set; keeping the existing dataset.');
    } else {
      const games = await fetchGames(key);
      if (!games.length) {
        console.log('CFBD returned no completed FBS games; keeping the existing dataset.');
      } else {
        const next: Dataset = { season: YEAR, source: 'collegefootballdata.com', updatedAt: new Date().toISOString(), games };
        if (stable(next) !== stable(data) || data.source !== next.source) {
          data = next;
          writeFileSync(GAMES, JSON.stringify(data, null, 1) + '\n');
          console.log(`Wrote ${games.length} completed FBS games.`);
        } else {
          console.log('No new finals.');
        }
      }
    }
  }

  const conferences: Record<string, unknown> = {};
  for (const { id } of CONFERENCES) {
    const games = gamesFor(data.games, id as ConferenceId);
    const a = analyze(games, [], id === 'FBS' ? { maxSteps: Infinity, maxMs: 180_000 } : { maxSteps: Infinity, maxMs: 60_000 });
    const paths: Record<string, Record<string, string[]>> = {};
    if (id !== 'FBS') {
      for (const x of a.teams) for (const y of a.teams) {
        const p = x === y ? null : shortestPath(a.graph, x, y);
        if (p) (paths[x] ??= {})[y] = p;
      }
    }
    conferences[id] = {
      games: games.length,
      teams: a.teams.length,
      cycle: a.cycle,
      cycleExhaustive: a.cycleExhaustive,
      scc: a.scc,
      parityIndex: a.teams.length ? +(a.cycle.length / a.teams.length).toFixed(4) : 0,
      paths,
    };
    console.log(`${id}: ${games.length} games, cycle ${a.cycle.length}${a.cycleExhaustive ? '' : ' (budget hit)'}, SCC ${a.scc.length}`);
  }
  writeFileSync(ANALYSIS, JSON.stringify({ season: YEAR, source: data.source, dataUpdatedAt: data.updatedAt, conferences }) + '\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
