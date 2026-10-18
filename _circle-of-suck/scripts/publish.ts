/**
 * Copy the build into the site and keep old links working:
 *   ../circle-of-suck/sec/        the SEC page (from dist/)
 *   ../circle-of-suck/index.html  site root; sends visitors to the home league
 *   ../sec-parity-index/          the project's first address; redirects to the SEC page, keeping
 *                                 ?from=&to=, and still serves the images old previews point at
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { LEAGUE, SITE } from '../src/site';

const repo = new URL('../../', import.meta.url);
const root = new URL(`.${SITE.root}`, repo);
const league = new URL(`${LEAGUE.id}/`, root);
const legacy = new URL('sec-parity-index/', repo);
const built = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');

// Redirect pages carry the SEC page's title and preview tags, so a shared link to them (the
// address printed on the image is the site root) still unfurls with the image and description.
const title = built.match(/<title>[^<]*<\/title>/)?.[0] ?? `<title>${SITE.name}</title>`;
const tags = (built.match(/^\s*<(?:meta (?:name="(?:description|twitter:card)"|property="og:)|link rel="canonical")[^>]*>$/gm) ?? [])
  .map((t) => t.trim())
  .join('\n');

function redirect(relative: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
${title}
${tags}
<script>location.replace(${JSON.stringify(relative)} + location.search + location.hash)</script>
<meta http-equiv="refresh" content="0; url=${relative}">
</head>
<body><p><a href="${relative}">${SITE.name}</a></p></body>
</html>
`;
}

rmSync(league, { recursive: true, force: true });
mkdirSync(league, { recursive: true });
cpSync(new URL('../dist/', import.meta.url), league, { recursive: true });
writeFileSync(new URL('index.html', root), redirect(`./${SITE.home}/`));

// The legacy address was the SEC page, whatever leagues are added later.
rmSync(legacy, { recursive: true, force: true });
mkdirSync(legacy, { recursive: true });
writeFileSync(new URL('index.html', legacy), redirect(`..${SITE.root}sec/`));
for (const f of ['og.png', 'circle.png']) cpSync(new URL(`${SITE.root.slice(1)}sec/${f}`, repo), new URL(f, legacy));

console.log(`Published to ${SITE.root}${LEAGUE.id}/`);
