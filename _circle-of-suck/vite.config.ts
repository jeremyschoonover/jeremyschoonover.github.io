import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import dataset from './data/games-2026.json';
import type { Dataset } from './src/lib/data';
import { esc } from './src/lib/ui';
import { info, LEAGUE, longDate, PAGE_URL, SITE } from './src/site';

/** Fill {{KEY}} placeholders in index.html with the site config and this build's results. */
function siteHtml(): Plugin {
  return {
    name: 'site-html',
    transformIndexHtml(html) {
      const i = info(dataset as Dataset);
      const png = new URL('./public/circle.png', import.meta.url);
      // Changes whenever the image does, so browsers and link previews pick up new results.
      const version = existsSync(png) ? createHash('sha256').update(readFileSync(png)).digest('hex').slice(0, 10) : 'dev';
      const vars: Record<string, string> = {
        TITLE: `${LEAGUE.name} Circle of Suck ${LEAGUE.season} | ${SITE.name}`,
        DESCRIPTION: `Every team beat the next one, all the way around. The ${LEAGUE.season} ${LEAGUE.name} circle of suck, through Week ${i.week} and updated after every game.`,
        SITE_NAME: SITE.name,
        PAGE_URL,
        VERSION: version,
        ALT: i.alt,
        LEAGUE: LEAGUE.name,
        SEASON: String(LEAGUE.season),
        WEEK: String(i.week),
        LAST_GAME: longDate(i.lastGame),
        SOURCE_LINE: i.sourceLine,
        ISSUES: SITE.issues,
        AUTHOR: SITE.author,
        AUTHOR_URL: SITE.authorUrl,
        FILE_NAME: `${LEAGUE.id}-circle-of-suck-week-${i.week}.png`,
      };
      return html.replace(/\{\{(\w+)\}\}/g, (m, k: string) => {
        if (!(k in vars)) throw new Error(`index.html: unknown placeholder ${m}`);
        return esc(vars[k]);
      });
    },
  };
}

// Relative base so the build works at any path depth.
export default defineConfig({
  base: './',
  plugins: [siteHtml(), tailwindcss()],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
