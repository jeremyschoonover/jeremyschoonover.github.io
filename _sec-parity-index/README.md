# SEC Parity Index

Live at https://jeremyschoonover.github.io/sec-parity-index/

The 2026 SEC football Circle of Parity:

- **The circle**: the longest ring of SEC teams where each one beat the next, closing back on the first. When several rings tie for longest, all of them are shown; Ring 1 is the tightest (smallest combined margin of victory).
- **The core**: the strongly connected component, every team with a chain of wins to and from every other member.
- **Head to head**: the shortest chain of wins from any team to any other, linkable as `?from=OU&to=UGA`.
- **The grid**: every team's results against every other, with transitive chains where they didn't play.
- **Scores**: every SEC conference final, week by week, with standings.

The circle and head-to-head views export PNG share cards at 1200&times;630 and 1080&times;1350.

This folder holds the source. Its leading underscore keeps Jekyll from publishing it; the built site lives in `../sec-parity-index/`.

## Data

`data/games-2026.json` ships with all 33 SEC conference finals through Week 7 (Oct 17, 2026), compiled from ESPN, CBS Sports and Fox Sports box scores (`"source": "compiled"`).

`.github/workflows/saturday-cron.yml` (at the repository root) runs every 10 minutes on Saturdays, plus the early-Sunday UTC hours for late kickoffs. It:

1. fetches `https://api.collegefootballdata.com/games?year=2026&conference=SEC`,
2. recomputes the longest rings, the core and all-pairs shortest chains into `data/analysis-2026.json`,
3. rebuilds into `../sec-parity-index/` and commits, which triggers the site's normal GitHub Pages build.

The API needs a free key from [collegefootballdata.com/key](https://collegefootballdata.com/key), saved as the `CFBD_API_KEY` repository secret (Settings → Secrets and variables → Actions). Without it, the sync keeps the bundled results. It also never replaces the file with a response that has fewer finals than are already on file.

## URL parameters

| Param | Example | |
| --- | --- | --- |
| `view` | `ring`, `proof`, `grid`, `scores` | Which view |
| `from`, `to` | `AUB`, `Georgia` | Head-to-head teams (abbreviation or school name) |
| `ring` | `2` | Which of the tied longest rings to show |

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

The longest-ring search is exact: a branch-and-bound DFS over each strongly connected component.
