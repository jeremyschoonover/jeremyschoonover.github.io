import { teamInfo } from '../data/teams';
import { winPts, losePts } from '../lib/data';
import { ringLayout } from '../lib/ring';
import { esc, disc, fmtDate, score } from '../lib/ui';
import { type Ctx, edgeGame, emptyState } from './shared';
import { CARD_SIZES } from '../lib/card';

export function ringSvg(ctx: Ctx): string {
  const { cycle } = ctx.a;
  const S = 640;
  const L = ringLayout(cycle.length, S / 2, S / 2, 248);
  const fs = Math.round(Math.max(10, L.r * 0.42));
  const arrows = L.arrows.map((a, i) => {
    const g = edgeGame(ctx.a, cycle[i], cycle[(i + 1) % cycle.length]);
    const label = g && L.showLabels
      ? `<text x="${a.lx.toFixed(1)}" y="${a.ly.toFixed(1)}" dy="0.35em" text-anchor="middle" class="tabular" font-size="${fs}" fill="#141413" paint-order="stroke" stroke="#FFFFFF" stroke-width="4">${winPts(g)}&ndash;${losePts(g)}</text>`
      : '';
    return `<line x1="${a.x1.toFixed(1)}" y1="${a.y1.toFixed(1)}" x2="${a.x2.toFixed(1)}" y2="${a.y2.toFixed(1)}" stroke="#141413" stroke-width="1.5" marker-end="url(#ah)"/>${label}`;
  });
  const nodes = L.nodes.map((p, i) => {
    const t = teamInfo(cycle[i]);
    const f = Math.round(L.r * (t.abbr.length > 3 ? 0.5 : 0.62));
    return `<a href="${esc(ctx.href({ view: 'proof', from: t.id, to: cycle[(i + cycle.length - 1) % cycle.length] }))}" aria-label="${esc(t.id)}">
      <title>${esc(t.id)}</title>
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${L.r.toFixed(1)}" fill="${t.color}" stroke="#141413" stroke-width="1"/>
      <text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" dy="0.36em" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="${f}" fill="${t.ink}">${esc(t.abbr)}</text>
    </a>`;
  });
  return `<svg viewBox="0 0 ${S} ${S}" class="w-full h-auto max-w-[640px] mx-auto block" role="img" aria-label="Circle of parity: ${esc(cycle.join(' beat '))} beat ${esc(cycle[0])}">
    <defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="${Math.max(6, L.r * 0.4).toFixed(1)}" markerHeight="${Math.max(6, L.r * 0.4).toFixed(1)}" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L10 5L0 10z" fill="#141413"/></marker></defs>
    ${arrows.join('')}${nodes.join('')}
  </svg>`;
}

export function exportButtons(kind: 'ring' | 'proof'): string {
  return `<div class="flex flex-wrap gap-2">${CARD_SIZES.map((s) =>
    `<button class="btn" data-export="${kind}" data-size="${s}">Download PNG <span class="tabular font-normal">${s.replace('x', '&times;')}</span></button>`).join('')}</div>`;
}

export function renderDiagram(ctx: Ctx): string {
  const { a } = ctx;
  if (!a.games.length) return emptyState(ctx, 'circle');
  if (!a.cycle.length) {
    return `<div class="border border-ink bg-card p-8"><h2 class="font-serif text-4xl">No circle of parity yet.</h2>
      <p class="mt-3 max-w-xl">Every chain of results in this ${esc(ctx.confLabel)} dataset runs one way; nobody has beaten anyone who beat them, even transitively.</p></div>`;
  }
  const n = a.cycle.length;
  const rows = a.cycle.map((t, i) => {
    const l = a.cycle[(i + 1) % n];
    const g = edgeGame(a, t, l)!;
    return `<li class="grid grid-cols-[1.5rem_auto_1fr_auto] items-center gap-2 py-2 border-b border-rule last:border-b-0">
      <span class="tabular text-[12px] text-muted">${String(i + 1).padStart(2, '0')}</span>
      <span class="flex items-center gap-1">${disc(t, 22)}</span>
      <span class="text-[14px]"><strong class="font-semibold">${esc(t)}</strong> <span class="text-muted">def.</span> ${esc(l)}</span>
      <span class="tabular text-[13px] text-right">${score(winPts(g), losePts(g))} <span class="text-muted">Wk ${g.week}</span></span>
    </li>`;
  }).join('');

  const inRing = new Set(a.cycle);
  const core = a.scc.filter((t) => !inRing.has(t));
  const sccSet = new Set(a.scc);
  const outside = a.teams.filter((t) => !sccSet.has(t));
  const list = (ts: string[], note: (t: string) => string) => ts.length
    ? ts.map((t) => `<li class="flex items-center gap-2 py-1.5">${disc(t, 22)}<span class="text-[14px] font-medium">${esc(t)}</span><span class="text-[12px] text-muted ml-auto tabular">${note(t)}</span></li>`).join('')
    : '<li class="py-1.5 text-[14px] text-muted">None</li>';
  const rec = (t: string) => { const r = a.records.get(t)!; return `${r.w}&ndash;${r.l}`; };
  const isFbs = ctx.conf === 'FBS';

  return `<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
    <figure class="border border-ink bg-card">
      <div class="flex items-baseline justify-between gap-4 border-b border-ink px-5 py-3">
        <p class="kicker">Fig. 1 &mdash; The longest simple cycle</p>
        <p class="kicker text-muted">${n} of ${a.teams.length} teams</p>
      </div>
      <div class="p-4 md:p-8">${ringSvg(ctx)}</div>
      <figcaption class="border-t border-rule px-5 py-3 text-[13px] text-muted leading-relaxed">
        Read clockwise from twelve o'clock. Each arrow points from winner to loser, and the last arrow lands back on the first team.
        ${a.cycleExhaustive ? 'This is the longest such loop in the dataset.' : 'All FBS is too large to search exhaustively in the browser; this is the longest loop found within the search budget.'}
        Select a team to open its proof.
      </figcaption>
    </figure>
    <aside class="flex flex-col gap-6">
      <section class="border border-ink bg-card">
        <h2 class="font-serif text-2xl px-5 pt-4">The Ring, Annotated</h2>
        <ol class="px-5 pb-3 pt-1 ${isFbs ? 'max-h-[460px] overflow-auto' : ''}">${rows}</ol>
      </section>
      <section class="border border-ink bg-card p-5">
        <p class="kicker mb-3">Share card</p>
        ${exportButtons('ring')}
        <p class="mt-3 text-[12px] text-muted">Watermarked PNGs sized for link previews (1200&times;630) and portrait feeds (1080&times;1350).</p>
      </section>
    </aside>
  </div>
  <section class="mt-6 grid border border-ink bg-card md:grid-cols-3">
    <div class="p-5 border-b md:border-b-0 md:border-r border-ink">
      <p class="kicker">On the ring</p>
      <p class="font-serif text-3xl mt-1">${n} teams</p>
      <ul class="mt-2 ${isFbs ? 'max-h-72 overflow-auto' : ''}">${list(a.cycle, rec)}</ul>
    </div>
    <div class="p-5 border-b md:border-b-0 md:border-r border-ink">
      <p class="kicker">In the strong component, off the ring</p>
      <p class="font-serif text-3xl mt-1">${core.length} ${core.length === 1 ? 'team' : 'teams'}</p>
      <p class="text-[13px] text-muted mt-1">Each has a chain of wins to, and from, every other team in the ${a.scc.length}-team component.</p>
      <ul class="mt-2 ${isFbs ? 'max-h-72 overflow-auto' : ''}">${list(core, rec)}</ul>
    </div>
    <div class="p-5">
      <p class="kicker">Outside the component</p>
      <p class="font-serif text-3xl mt-1">${outside.length} ${outside.length === 1 ? 'team' : 'teams'}</p>
      <p class="text-[13px] text-muted mt-1">No chain of wins reaches back into the core, or none leads out of it.</p>
      <ul class="mt-2 ${isFbs ? 'max-h-72 overflow-auto' : ''}">${list(outside, rec)}</ul>
    </div>
  </section>
  <p class="mt-3 text-[12px] text-muted">Latest result in the ring: ${(() => {
    const gs = a.cycle.map((t, i) => edgeGame(a, t, a.cycle[(i + 1) % n])!).sort((x, y) => y.date.localeCompare(x.date));
    return `${esc(fmtDate(gs[0].date))}, Week ${gs[0].week}.`;
  })()}</p>`;
}
