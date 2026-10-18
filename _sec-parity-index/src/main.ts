import './styles.css';
import dataset from '../data/games-2026.json';
import logoList from '../data/logos.json';
import { teamInfo } from './data/teams';
import { type Dataset, losePts, secGames, winPts } from './lib/data';
import { analyze, edgeKey, shortestPath } from './lib/graph';
import { esc, fmtDate } from './lib/ui';

const data = dataset as Dataset;
const a = analyze(secGames(data.games));
const ring = a.cycle;
const logos = new Set(logoList as string[]);
const lastGame = a.games.map((g) => g.date).sort().at(-1) ?? '';
// Bust caches when the results change; the image is re-rendered on every build.
const version = encodeURIComponent(data.updatedAt);

function teamFrom(q: string | null): string | null {
  if (!q) return null;
  const s = q.trim().toLowerCase();
  return a.teams.find((t) => t.toLowerCase() === s || teamInfo(t).abbr.toLowerCase() === s) ?? null;
}

const params = new URLSearchParams(location.search);
// Default: the team right after the leader on the circle "beats" the leader, despite losing to them.
let from = teamFrom(params.get('from')) ?? ring[1] ?? a.teams[0];
let to = teamFrom(params.get('to')) ?? ring[0] ?? a.teams[1];

function mark(team: string, size: number): string {
  const t = teamInfo(team);
  if (logos.has(t.abbr)) return `<img src="logos/${t.abbr}.png" alt="" width="${size}" height="${size}" class="shrink-0 object-contain" style="width:${size}px;height:${size}px">`;
  const fs = (size * (t.abbr.length > 3 ? 0.28 : 0.36)).toFixed(1);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true" class="shrink-0">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.42}" fill="${t.color}" stroke="#111111" stroke-width="1.5"/>
    <text x="50%" y="50%" dy="0.36em" text-anchor="middle" font-family="'Barlow Condensed', sans-serif" font-weight="800" font-size="${fs}" fill="${t.ink}">${esc(t.abbr)}</text>
  </svg>`;
}

function game(w: string, l: string) {
  return a.graph.edgeGames.get(edgeKey(w, l))?.at(-1);
}

function proof(): string {
  if (from === to) return '<p class="mt-6 text-gray">Pick two different teams.</p>';
  const path = shortestPath(a.graph, from, to);
  if (!path) {
    return `<p class="display mt-6 text-[34px]">No way.</p>
      <p class="mt-1 text-[17px]">No chain of SEC wins gets ${esc(from)} to ${esc(to)}. Yet.</p>`;
  }
  const steps = path.length - 1;
  const rows = path.map((t, i) => {
    const next = path[i + 1];
    const g = next ? game(t, next)! : null;
    return `<li>
      <div class="flex items-center gap-3">${mark(t, 44)}<span class="display text-[24px]">${esc(t)}</span></div>
      ${g ? `<div class="ml-[21px] flex items-center gap-3 border-l-2 border-ink py-2 pl-[30px]">
        <span class="num text-[22px]">${winPts(g)}-${losePts(g)}</span>
        <span class="text-[14px] text-gray">Week ${g.week} &middot; ${esc(fmtDate(g.date))}${g.ot ? ' &middot; OT' : ''}</span>
      </div>` : ''}
    </li>`;
  }).join('');
  const real = game(to, from);
  return `<p class="mt-6 text-[17px]"><strong class="font-semibold">${esc(from)} &gt; ${esc(to)}</strong> in ${steps} ${steps === 1 ? 'game' : 'games'}${real ? `, even though ${esc(to)} won the real one ${winPts(real)}-${losePts(real)}` : ''}.</p>
    <ol class="mt-4">${rows}</ol>`;
}

function options(selected: string): string {
  return [...a.teams].sort().map((t) => `<option value="${esc(t)}"${t === selected ? ' selected' : ''}>${esc(t)}</option>`).join('');
}

function render() {
  const alt = ring.length
    ? `SEC circle of suck: ${ring.join(' beat ')}, who beat ${ring[0]}.`
    : 'SEC circle of suck';
  document.getElementById('app')!.innerHTML = `
  <main class="mx-auto max-w-[620px] px-4 pb-16 pt-4 sm:pt-8">
    <h1 class="sr-only">SEC Circle of Suck, 2026</h1>
    <img src="circle.png?v=${version}" alt="${esc(alt)}" width="1080" height="1080" class="block h-auto w-full border border-line">
    <div class="mt-3 grid grid-cols-2 gap-2">
      <a class="btn" href="circle.png?v=${version}" download="sec-circle-of-suck.png">Save image</a>
      <button class="btn" data-share>Share</button>
    </div>

    <section class="mt-12" aria-labelledby="prove">
      <h2 id="prove" class="display text-[40px]">Who's better?</h2>
      <form class="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2" data-form>
        <select class="pick" name="from" aria-label="This team">${options(from)}</select>
        <span class="display text-[28px]" aria-hidden="true">&gt;</span>
        <select class="pick" name="to" aria-label="is better than this team">${options(to)}</select>
      </form>
      <div aria-live="polite">${proof()}</div>
    </section>

    <footer class="mt-14 border-t border-line pt-4 text-[14px] text-gray">
      Updates after every SEC game. Last game ${esc(fmtDate(lastGame))}.
    </footer>
  </main>`;
}

function sync() {
  const p = new URLSearchParams();
  p.set('from', teamInfo(from).abbr);
  p.set('to', teamInfo(to).abbr);
  history.replaceState(null, '', `?${p}`);
}

document.addEventListener('change', (e) => {
  const el = e.target as HTMLSelectElement;
  if (!el.closest('[data-form]')) return;
  if (el.name === 'from') from = el.value; else to = el.value;
  sync();
  const out = document.querySelector('[aria-live]');
  if (out) out.innerHTML = proof();
});

document.addEventListener('click', async (e) => {
  const btn = (e.target as Element).closest<HTMLButtonElement>('[data-share]');
  if (!btn) return;
  const url = location.href;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'SEC Circle of Suck', url });
      return;
    }
    await navigator.clipboard.writeText(url);
    btn.textContent = 'Link copied';
  } catch (err) {
    if ((err as Error).name === 'AbortError') return;
    btn.textContent = 'Copy failed';
  }
  setTimeout(() => { btn.textContent = 'Share'; }, 2000);
});

render();
