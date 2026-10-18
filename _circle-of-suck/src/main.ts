import './styles.css';
import dataset from '../data/games-2026.json';
import logoList from '../data/logos.json';
import { teamInfo } from './data/teams';
import { type Dataset, losePts, winPts } from './lib/data';
import { edgeKey, shortestPath } from './lib/graph';
import { esc, fmtDate } from './lib/ui';
import { info, LEAGUE } from './site';

const { a } = info(dataset as Dataset);
const ring = a.cycle;
const logos = new Set(logoList as string[]);

function teamFrom(q: string | null): string | null {
  if (!q) return null;
  const s = q.trim().toLowerCase();
  return a.teams.find((t) => t.toLowerCase() === s || teamInfo(t).abbr.toLowerCase() === s) ?? null;
}

const params = new URLSearchParams(location.search);
// Default: the team after the leader on the circle "beats" the leader, despite losing to them.
let from = teamFrom(params.get('from')) ?? ring[1] ?? a.teams[0];
let to = teamFrom(params.get('to')) ?? ring[0] ?? a.teams[1];

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

const game = (w: string, l: string) => a.graph.edgeGames.get(edgeKey(w, l))?.at(-1);

function proof(): string {
  if (from === to) return '<p class="mt-5 text-[17px]">Pick two different teams.</p>';
  const path = shortestPath(a.graph, from, to);
  const real = game(to, from);
  if (!path) {
    return `<p class="display mt-5 text-[30px]">No case yet</p>
      <p class="mt-1 text-[17px]">No chain of ${LEAGUE.name} wins gets ${esc(from)} to ${esc(to)}${real ? `, and ${esc(to)} won the real game ${winPts(real)}-${losePts(real)}` : ''}.</p>`;
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
    ? `<strong class="font-semibold">${esc(from)}</strong> beat ${esc(to)} straight up.`
    : `<strong class="font-semibold">${esc(from)} &gt; ${esc(to)}</strong> in ${steps} games${real ? `, even though ${esc(to)} won the real one ${winPts(real)}-${losePts(real)}` : ''}.`;
  return `<p class="mt-5 text-[17px]">${lead}</p><ol class="mt-4">${rows}</ol>`;
}

const form = document.querySelector<HTMLFormElement>('[data-form]')!;
const out = document.querySelector<HTMLElement>('[data-proof]')!;
const share = document.querySelector<HTMLButtonElement>('[data-share]')!;

function fill(select: HTMLSelectElement, selected: string) {
  select.innerHTML = [...a.teams].sort().map((t) => `<option value="${esc(t)}"${t === selected ? ' selected' : ''}>${esc(t)}</option>`).join('');
}

function update(push: boolean) {
  out.innerHTML = proof();
  if (push) {
    const p = new URLSearchParams({ from: teamInfo(from).abbr, to: teamInfo(to).abbr });
    history.replaceState(null, '', `?${p}#better`);
  }
}

form.hidden = false;
fill(form.elements.namedItem('from') as HTMLSelectElement, from);
fill(form.elements.namedItem('to') as HTMLSelectElement, to);
update(false);

form.addEventListener('change', (e) => {
  const el = e.target as HTMLSelectElement;
  if (el.name === 'from') from = el.value; else to = el.value;
  update(true);
});

// Share the image itself where the platform allows it (phones), otherwise the link. The file is
// fetched ahead of time because Safari only allows share() right after the tap.
share.hidden = false;
// Not every browser has the Web Share API, whatever the DOM types say.
const canShare = typeof navigator.share === 'function';
const imageFile: Promise<File | null> = canShare
  ? fetch(document.querySelector<HTMLImageElement>('main img')!.src)
    .then((r) => r.blob())
    .then((b) => new File([b], `${LEAGUE.id}-circle-of-suck.png`, { type: 'image/png' }))
    .catch(() => null)
  : Promise.resolve(null);

share.addEventListener('click', async () => {
  const title = `${LEAGUE.name} Circle of Suck`;
  const url = location.href;
  try {
    if (canShare) {
      const file = await imageFile;
      if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title, text: `${title} ${url}` });
      else await navigator.share({ title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    share.textContent = 'Link copied';
  } catch (err) {
    if ((err as Error).name === 'AbortError') return;
    share.textContent = 'Copy failed';
  }
  setTimeout(() => { share.textContent = 'Share'; }, 2000);
});


