# The SEC Parity Index

Live at https://jeremyschoonover.github.io/sec-parity-index/

This folder holds the source. Its leading underscore keeps Jekyll from publishing it; the built site lives in `../sec-parity-index/`.

The 2026 college football Circle of Parity, set like a box-score almanac. For the SEC (default), Big Ten, Big 12, ACC and all of FBS it finds:

- **The longest simple cycle**: the longest ring of teams where each one beat the next, closing back on the first.
- **The strongly connected component**: every team that has a chain of wins to, and from, every other member.
- **Shortest transitive proofs**: the fewest-step chain showing Team A "beat" Team B, linkable as `?from=OU&to=UGA`.

Four views: **Parity Diagram**, **Head-to-Head Proof**, **The Grid** (N&times;N head-to-head) and **Box Score Log**. The diagram and proofs export watermarked PNG share cards at 1200&times;630 and 1080&times;1350.

## Data

`data/games-2026.json` ships with a seed set of 31 SEC conference games through Week 7 (Oct 17, 2026) and is marked `"source": "seed"`. These seed scores are a placeholder, not verified results. The first successful sync replaces them with real finals.

`.github/workflows/saturday-cron.yml` (at the repository root) runs every 10 minutes on Saturdays (and the early-Sunday UTC hours for late kickoffs). It:

1. fetches `https://api.collegefootballdata.com/games?year=2026` (regular season, FBS),
2. recomputes the longest cycle, SCCs and all-pairs shortest transitive paths into `data/analysis-2026.json`,
3. rebuilds into `../sec-parity-index/` and commits, which triggers the site's normal GitHub Pages build.

The API requires a free key from [collegefootballdata.com/key](https://collegefootballdata.com/key). Add it as the `CFBD_API_KEY` repository secret (Settings → Secrets and variables → Actions). Without it the sync keeps the existing data.

## URL parameters

| Param | Example | |
| --- | --- | --- |
| `conf` | `SEC`, `Big Ten`, `Big 12`, `ACC`, `FBS` | Conference view |
| `view` | `diagram`, `proof`, `grid`, `log` | Which view |
| `from`, `to` | `AUB`, `Georgia` | Proof endpoints (abbreviation or school name) |

## Development

```sh
npm install
npm run dev        # local server
npm test           # Vitest
npm run build      # type-check and build to dist/
npm run publish    # build and copy to ../sec-parity-index/
npm run sync       # fetch from CFBD (needs CFBD_API_KEY) and recompute
npx tsx scripts/sync.ts --offline   # recompute analysis only
```

The longest-cycle search is exact (branch-and-bound DFS per strongly connected component). On All FBS it runs with a time budget, and the page says when a cycle is the best found rather than proven longest.
