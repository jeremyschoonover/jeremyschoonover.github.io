# SEC Circle of Suck

Live at https://jeremyschoonover.github.io/sec-parity-index/

One page: the 2026 SEC circle of suck (the longest ring of teams where each one beat the next) as a post-style image, and a "who's better?" picker that finds the shortest chain of wins from any team to any other (`?from=OU&to=UGA`).

The image is rendered at build time by `scripts/render.ts` into `public/circle.png` (1080&times;1080, the page and the saved file) and `public/og.png` (1200&times;630, the link preview). Team logos are downloaded from ESPN's CDN by `scripts/logos.ts` in CI; any team without a logo falls back to a colored disc.

This folder holds the source. Its leading underscore keeps Jekyll from publishing it; the built site lives in `../sec-parity-index/`.

## Data

`data/games-2026.json` ships with all 33 SEC conference finals through Week 7 (Oct 17, 2026), compiled from ESPN, CBS Sports and Fox Sports box scores.

`.github/workflows/saturday-cron.yml` (at the repository root) runs every 10 minutes on Saturdays, plus the early-Sunday UTC hours for late kickoffs. It fetches `https://api.collegefootballdata.com/games?year=2026&conference=SEC`, recomputes the circle, re-renders the image, rebuilds into `../sec-parity-index/` and commits, which triggers the site's GitHub Pages build.

The API needs a free key from [collegefootballdata.com/key](https://collegefootballdata.com/key), saved as the `CFBD_API_KEY` repository secret. Without it, the sync keeps the bundled results.

## How the circle is found

Longest simple cycle in the "beat" graph, an NP-hard problem, solved exactly with a branch-and-bound search over each strongly connected component. When several rings tie, the one with the smallest combined margin of victory is drawn.

## Development

```sh
npm install
npm run dev        # local server
npm test           # Vitest
npm run build      # type-check, render the image, build to dist/
npm run publish    # build and copy to ../sec-parity-index/
npm run logos      # download team logos (needs access to a.espncdn.com)
npm run sync       # fetch from CFBD (needs CFBD_API_KEY) and recompute
```
