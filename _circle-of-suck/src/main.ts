import './styles.css';
import dataset from '../data/games-2026.json';
import logoList from '../data/logos.json';
import { teamInfo } from './data/teams';
import { type Dataset, losePts, secGames, winPts } from './lib/data';
import { buildGraph, edgeKey, shortestPath } from './lib/graph';
import { esc, fmtDate } from './lib/ui';
import { LEAGUE, PAGE_URL } from './site';

// The page only needs the win graph; the circle itself is found at build time.
const graph = buildGraph(secGames((dataset as Dataset).games));
const teams = graph.teams;
const logos = new Set(logoList as string[]);

const form = document.querySelector<HTMLFormElement>('[data-form]')!;
const out = document.querySelector<HTMLElement>('[data-proof]')!;
const status = document.querySelector<HTMLElement>('[data-status]')!;
const share = document.querySelector<HTMLButtonElement>('[data-share]')!;

function teamFrom(q: string | null | undefined): string | null {
  if (!q) return null;
  const s = q.trim().toLowerCase();
  return teams.find((t) => t.toLowerCase() === s || teamInfo(t).abbr.toLowerCase() === s) ?? null;
}

// Default matchup (set at build time): the team after the leader on the circle "beats" the leader.
const params = new URLSearchParams(location.search);
let from = teamFrom(params.get('from')) ?? teamFrom(form.dataset.from) ?? teams[0];
let to = teamFrom(params.get('to')) ?? teamFrom(form.dataset.to) ?? teams[1];
if (from === to) {
  // A link that names one team shouldn't pair it with itself.
  const other = teams.find((t) => t !== from) ?? to;
  if (params.get('from')) to = other; else from = other;
}

function mark(team: string, size: number): string {
  const t = teamInfo(team);
  if (logos.has(t.abbr)) {
    return `<img src="logos/${t.abbr}.png" alt="" width="${size}" height="${size}" loading="lazy" class="shrink-0 object-contain" style="width:${size}px;height:${size}px">`;
  }
  const fs = (size * (t.abbr.length > 3 ? 0.28 : 0.36)).toFixed(1);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true" class="shrink-0">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.42}" fill="${t.color}" stroke="#111111" stroke-width="1.5"/>
    <text x="50%" y="50%" dy="0.36em" text-anchor="middle" font-family="'Barlow Condensed', sans-serif" font-weight="800" font-size="${fs}" fill="${t.ink}">${esc(t.abbr)}</text>
  </svg>`;
}

const game = (w: string, l: string) => graph.edgeGames.get(edgeKey(w, l))?.at(-1);
const better = '<span aria-hidden="true"> &gt; </span><span class="sr-only"> is better than </span>';

function proof(): string {
  if (from === to) return '<p class="mt-5 text-[17px]" data-lead>Pick two different teams.</p>';
  const path = shortestPath(graph, from, to);
  const real = game(to, from);
  const h2h = real ? `${esc(to)} won head-to-head ${winPts(real)}-${losePts(real)}` : '';
  if (!path) {
    return `<p class="display mt-5 text-[30px]">No case yet</p>
      <p class="mt-1 text-[17px] text-balance" data-lead>No chain of ${LEAGUE.name} wins gets ${esc(from)} to ${esc(to)}${h2h ? `, and ${h2h}` : ''}.</p>`;
  }
  const steps = path.length - 1;
  const rows = path.map((t, i) => {
    const next = path[i + 1];
    const g = next ? game(t, next)! : null;
    return `<li>
      <div class="flex items-center gap-3">${mark(t, 44)}<span class="display text-[24px]">${esc(t)}</span></div>
      ${g ? `<div class="ml-[21px] flex items-center gap-3 border-l-2 border-ink py-2 pl-[30px]">
        <span class="sr-only">beat ${esc(next!)}</span>
        <span class="num text-[22px]">${winPts(g)}-${losePts(g)}</span>
        <span class="text-[14px] text-gray">Week ${g.week} &middot; ${esc(fmtDate(g.date))}${g.ot ? ' &middot; OT' : ''}</span>
      </div>` : ''}
    </li>`;
  }).join('');
  const lead = steps === 1
    ? `<strong class="font-semibold">${esc(from)}</strong> beat ${esc(to)} head-to-head.`
    : `<strong class="font-semibold">${esc(from)}${better}${esc(to)}</strong> in ${steps} games${h2h ? `, even though ${h2h}` : ''}.`;
  return `<p class="mt-5 text-[17px] text-balance" data-lead>${lead}</p><ol class="mt-4">${rows}</ol>`;
}

function fill(select: HTMLSelectElement, selected: string) {
  select.innerHTML = [...teams].sort().map((t) => `<option value="${esc(t)}"${t === selected ? ' selected' : ''}>${esc(t)}</option>`).join('');
}

function update(changed: boolean) {
  out.innerHTML = proof();
  if (!changed) return;
  const p = new URLSearchParams({ from: teamInfo(from).abbr, to: teamInfo(to).abbr });
  history.replaceState(null, '', `?${p}#better`);
  // Announce one sentence, not the whole chain, so arrowing through teams stays quiet.
  status.innerHTML = out.querySelector('[data-lead]')?.innerHTML ?? '';
}

if (teams.length >= 2) {
  form.hidden = false;
  fill(form.elements.namedItem('from') as HTMLSelectElement, from);
  fill(form.elements.namedItem('to') as HTMLSelectElement, to);
  update(false);
  form.addEventListener('change', (e) => {
    const el = e.target as HTMLSelectElement;
    if (el.name === 'from') from = el.value; else to = el.value;
    update(true);
  });
}

// Share the image itself where the platform allows it (phones), otherwise the link. The file is
// fetched ahead of time because Safari only allows share() right after the tap.
const canShare = typeof navigator.share === 'function';
const saveLink = document.querySelector<HTMLAnchorElement>('a[download]')!;
const imageFile: Promise<File | null> = canShare
  ? fetch(saveLink.href)
    .then((r) => r.blob())
    .then((b) => new File([b], saveLink.getAttribute('download')!, { type: 'image/png' }))
    .catch(() => null)
  : Promise.resolve(null);

function say(text: string) {
  share.textContent = text;
  status.textContent = text;
  setTimeout(() => { share.textContent = 'Share'; status.textContent = ''; }, 2000);
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(PAGE_URL);
    say('Link copied');
  } catch {
    say("Couldn't share");
  }
}

share.hidden = false;
share.addEventListener('click', async () => {
  const title = `${LEAGUE.name} Circle of Suck`;
  if (!canShare) return copyLink();
  try {
    const file = await imageFile;
    if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title, text: `${title} ${PAGE_URL}` });
    else await navigator.share({ title, url: PAGE_URL });
  } catch (err) {
    if ((err as Error).name !== 'AbortError') await copyLink();
  }
});
