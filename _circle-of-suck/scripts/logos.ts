/**
 * Download team logos from ESPN's CDN into public/logos/{ABBR}.png and list the ones we have in
 * data/logos.json. Runs in CI before the build; files already on disk are kept.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { TEAMS } from '../src/data/teams';

const DIR = new URL('../public/logos/', import.meta.url);
const MANIFEST = new URL('../data/logos.json', import.meta.url);

async function main() {
  mkdirSync(DIR, { recursive: true });
  for (const t of TEAMS) {
    const file = new URL(`${t.abbr}.png`, DIR);
    if (existsSync(file)) continue;
    try {
      const res = await fetch(`https://a.espncdn.com/i/teamlogos/ncaa/500/${t.espn}.png`);
      const buf = Buffer.from(await res.arrayBuffer());
      // A real logo is a PNG of several KB; anything else (an error page, a placeholder) is skipped.
      if (!res.ok || buf.length < 2000 || buf.subarray(1, 4).toString() !== 'PNG') throw new Error(`HTTP ${res.status}, ${buf.length} bytes`);
      writeFileSync(file, buf);
      console.log(`${t.abbr}: saved`);
    } catch (e) {
      console.log(`${t.abbr}: no logo (${(e as Error).message}); the colored disc will be used`);
    }
  }
  const have = readdirSync(DIR).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)).sort();
  writeFileSync(MANIFEST, JSON.stringify(have) + '\n');
  console.log(`${have.length} logos on file.`);
}

main();
