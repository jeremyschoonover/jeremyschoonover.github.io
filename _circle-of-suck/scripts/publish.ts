/**
 * Copy the build into the site and keep old links working:
 *   ../circle-of-suck/sec/        the SEC page (from dist/)
 *   ../circle-of-suck/index.html  site root; sends visitors to the SEC page until there are more leagues
 *   ../sec-parity-index/          the project's first address; redirects, keeping ?from=&to=
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { LEAGUE, PAGE_URL, SITE } from '../src/site';

const repo = new URL('../../', import.meta.url);
const root = new URL(`.${SITE.root}`, repo);
const league = new URL(`${LEAGUE.id}/`, root);
const legacy = new URL('sec-parity-index/', repo);

function redirect(relative: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${SITE.name}</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${PAGE_URL}">
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
writeFileSync(new URL('index.html', root), redirect(`./${LEAGUE.id}/`));

rmSync(legacy, { recursive: true, force: true });
mkdirSync(legacy, { recursive: true });
writeFileSync(new URL('index.html', legacy), redirect(`..${SITE.root}${LEAGUE.id}/`));

console.log(`Published to ${SITE.root}${LEAGUE.id}/`);
