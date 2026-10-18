# Circle of Suck

Live: https://jeremyschoonover.github.io/circle-of-suck/sec/

A circle of suck is a loop of results where every team beat the next one and the last team beat the first. This site finds the longest one in a league, draws it as a ready-to-post image with team logos and scores, hangs the longest chain of wins off it as a branch (so the teams outside the loop show up too), and redraws it after every game. Below the image, "Who's better?" finds the shortest chain of wins from any team to any other (`?from=OU&to=UGA`).

Leagues live at their own path under `/circle-of-suck/`; the SEC is the first.

## Layout

| Path | What |
| --- | --- |
| `_circle-of-suck/` | Source (this folder). The leading underscore keeps Jekyll from publishing it. |
| `circle-of-suck/sec/` | Built SEC page, written by `npm run publish`. |
| `circle-of-suck/index.html` | Site root; redirects to the SEC page until there are more leagues. |
| `sec-parity-index/index.html` | The project's original address; redirects here, keeping `?from=&to=`. |

## How it updates

`.github/workflows/saturday-cron.yml` (repository root) runs during the season (August-December): every 15 minutes on Saturdays and the early-Sunday UTC hours for late kickoffs, once each weekday morning for Thursday/Friday games, and on pushes to this folder. That's at most about 680 API calls a month, inside CFBD's free tier of 1,000. It:

1. fetches finals from `https://api.collegefootballdata.com/games?year=2026&conference=SEC` (needs the `CFBD_API_KEY` repository secret, a free key from [collegefootballdata.com/key](https://collegefootballdata.com/key)). Without the key, or if the API errors, the run keeps the results on file, flags a warning on the run, and still publishes,
2. downloads any missing team logos from ESPN's CDN into `public/logos/`,
3. recomputes the circle and re-renders the images (`scripts/render.ts`),
4. builds, publishes and commits, which triggers the GitHub Pages deploy.

`data/games-2026.json` ships with all 33 SEC conference finals through Week 7 (Oct 17, 2026), compiled from ESPN, CBS Sports and Fox Sports box scores.

## Images

`scripts/render.ts` draws, from the same data as the page:

- `circle.png`, 1080&times;1350 (Instagram portrait): the page image and the file people save and share. The circle turns so the branch's team sits at lower left; the branch drops out of it and runs along the bottom. Anyone on neither the circle nor the branch appears in a small "The rest" row.
- `og.png`, 1200&times;630: the link preview
- `apple-touch-icon.png`, 180&times;180

## How the circle is found

It's the longest simple cycle in the "beat" graph, an NP-hard problem, solved exactly with a branch-and-bound search over each strongly connected component. When several loops tie for longest, every tie is scored and the one with the smallest combined margin of victory is drawn. The branch is the longest chain of wins from a circle team through teams outside it, again preferring the tightest.

Tests that pin exact results read a frozen copy of the Week 7 data (`tests/fixtures/`); the rest check rules that hold for any week, so new results never fail the build.

## Development

```sh
npm install
npm run dev        # local server
npm test           # Vitest
npm run build      # type-check, render the images, build to dist/
npm run publish    # build, then write ../circle-of-suck/ and the redirects
npm run logos      # download team logos (needs access to a.espncdn.com)
npm run sync       # fetch from CFBD (needs CFBD_API_KEY) and recompute
```

## Legal

Not affiliated with or endorsed by the Southeastern Conference or any of its member schools. Team names and logos are trademarks of their respective owners and are used only to identify the teams.
