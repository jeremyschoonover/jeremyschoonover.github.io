import { teamInfo } from '../data/teams';
import { loser, losePts, winner, winPts } from '../lib/data';
import { CARD_SIZES } from '../lib/card';
import { ringLayout } from '../lib/ring';
import { disc, discFont, esc, fmtDate, score } from '../lib/ui';
import { type Ctx, edgeGame } from './shared';

function ringSvg(ctx: Ctx): string {
  const { cycle } = ctx;
  const S = 640;
  const L = ringLayout(cycle.length, S / 2, S / 2, 230);
  const fs = Math.round(Math.max(18, L.r * 0.74));
  const head = Math.max(10, L.r * 0.42).toFixed(1);
  const arrows = L.arrows.map((a, i) => {
    const g = edgeGame(ctx.a, cycle[i], cycle[(i + 1) % cycle.length])!;
    return `<line x1="${a.x1.toFixed(1)}" y1="${a.y1.toFixed(1)}" x2="${a.x2.toFixed(1)}" y2="${a.y2.toFixed(1)}" stroke="#111111" stroke-width="2.5" marker-end="url(#ah)"/>
      <text x="${a.lx.toFixed(1)}" y="${a.ly.toFixed(1)}" dy="0.35em" text-anchor="middle" font-family="'Barlow Condensed', sans-serif" font-weight="700" font-size="${fs}" fill="#111111" paint-order="stroke" stroke="#FFFFFF" stroke-width="6" stroke-linejoin="round">${winPts(g)}&ndash;${losePts(g)}</text>`;
  });
  const nodes = L.nodes.map((p, i) => {
    const t = teamInfo(cycle[i]);
    const beatBy = cycle[(i + cycle.length - 1) % cycle.length];
    return `<a href="${esc(ctx.href({ view: 'proof', from: t.id, to: beatBy }))}" aria-label="${esc(`${t.id}: open proof that ${t.id} is better than ${beatBy}`)}">
      <title>${esc(t.id)}</title>
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${L.r.toFixed(1)}" fill="${t.color}" stroke="#111111" stroke-width="1"/>
      <text x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" dy="0.35em" text-anchor="middle" font-family="'Barlow Condensed', sans-serif" font-weight="800" font-size="${discFont(t.abbr, L.r * 2)}" fill="${t.ink}">${esc(t.abbr)}</text>
    </a>`;
  });
  return `<svg viewBox="0 0 ${S} ${S}" class="w-full h-auto max-w-[620px] mx-auto block" role="img" aria-label="${esc(cycle.join(' beat ') + ' beat ' + cycle[0])}">
    <defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="${head}" markerHeight="${head}" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L10 5L0 10z" fill="#111111"/></marker></defs>
    ${arrows.join('')}${nodes.join('')}
  </svg>`;
}

export function exportButtons(kind: 'ring' | 'proof'): string {
  return `<div class="grid grid-cols-2 gap-2">${CARD_SIZES.map((s) =>
    `<button class="btn" data-export="${kind}" data-size="${s}">PNG <span class="num font-semibold">${s.replace('x', '&times;')}</span></button>`).join('')}</div>`;
}

export function renderRing(ctx: Ctx): string {
  const { a, cycle } = ctx;
  if (!cycle.length) {
    return `<section class="border border-ink bg-card p-8"><h2 class="display text-4xl">No circle yet</h2>
      <p class="mt-2 max-w-xl">Every chain of SEC results still runs one way. Check back after Saturday.</p></section>`;
  }
  const n = cycle.length;
  const games = cycle.map((t, i) => edgeGame(a, t, cycle[(i + 1) % n])!);
  const rows = cycle.map((t, i) => {
    const l = cycle[(i + 1) % n];
    const g = games[i];
    return `<li class="grid grid-cols-[1.75rem_auto_1fr_auto] items-center gap-x-2.5 border-t border-rule py-2 first:border-t-0">
      <span class="num text-[15px] text-muted">${i + 1}</span>
      <span class="flex items-center">${disc(t, 30)}</span>
      <span class="min-w-0 leading-tight"><span class="font-semibold">${esc(t)}</span><span class="text-muted"> beat </span><span>${esc(l)}</span></span>
      <span class="text-right leading-tight"><span class="num text-[20px]">${score(winPts(g), losePts(g))}</span><span class="block label text-[11px] text-muted">Wk ${g.week}${g.ot ? ' &middot; OT' : ''}</span></span>
    </li>`;
  }).join('');

  const rec = (t: string) => { const r = a.records.get(t)!; return `${r.w}&ndash;${r.l}`; };
  const inRing = new Set(cycle);
  const core = a.scc.filter((t) => !inRing.has(t));
  const sccSet = new Set(a.scc);
  const outside = a.teams.filter((t) => !sccSet.has(t));
  const list = (ts: string[]) => ts.length
    ? ts.map((t) => `<li class="flex items-center gap-2.5 py-1.5">${disc(t, 26)}<span class="font-medium">${esc(t)}</span><span class="num text-[17px] ml-auto">${rec(t)}</span></li>`).join('')
    : '<li class="py-1.5 text-muted">None</li>';

  const ringPicker = a.rings.length > 1
    ? `<div class="flex flex-wrap items-center gap-2 border-b border-rule px-4 py-3 md:px-6">
        <span class="label text-muted mr-1">${a.rings.length} rings of ${n}</span>
        ${a.rings.map((_, i) => `<a class="btn !min-h-[34px] !py-1" href="${esc(ctx.href({ ring: i }))}" aria-pressed="${i === ctx.ring}">Ring ${i + 1}</a>`).join('')}
        <span class="text-[13px] text-muted basis-full md:basis-auto md:ml-2">${ctx.ring === 0 ? 'Ring 1 is the tightest: the smallest combined margin of victory.' : `Same length, different route. Ring 1 is the tightest.`}</span>
      </div>`
    : '';

  const latest = [...games].sort((x, y) => y.date.localeCompare(x.date))[0];

  return `<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
    <section>
      <span class="tag tag-line">The circle</span>
      <div class="border border-ink bg-card">
        ${ringPicker}
        <div class="px-2 py-4 md:p-6">${ringSvg(ctx)}</div>
        <p class="border-t border-rule px-4 py-3 text-[14px] text-muted md:px-6">Arrows point from winner to loser. Start anywhere and follow them around: every team beat the next, and the last arrow lands back where you started. Tap a team to see the case for it over the team that beat it.</p>
      </div>
    </section>
    <aside class="flex flex-col gap-6">
      <section>
        <span class="tag">Game by game</span>
        <ol class="border border-ink bg-card px-4 py-1">${rows}</ol>
      </section>
      <section>
        <span class="tag">Share it</span>
        <div class="border border-ink bg-card p-4">
          ${exportButtons('ring')}
          <p class="mt-3 text-[13px] text-muted">1200&times;630 for link previews and X; 1080&times;1350 for Instagram.</p>
        </div>
      </section>
    </aside>
  </div>
  <section class="mt-8">
    <span class="tag">Who's in, who's out</span>
    <div class="grid border border-ink bg-card md:grid-cols-3">
      <div class="border-b border-ink p-4 md:border-b-0 md:border-r md:p-5">
        <p class="display text-[28px] leading-none">${n} on the ring</p>
        <p class="mt-1 text-[14px] text-muted">The longest loop of results in the conference.</p>
        <ul class="mt-2">${list(cycle)}</ul>
      </div>
      <div class="border-b border-ink p-4 md:border-b-0 md:border-r md:p-5">
        <p class="display text-[28px] leading-none">${core.length} more in the core</p>
        <p class="mt-1 text-[14px] text-muted">Off the ring, but each has a chain of wins to and from all ${a.scc.length} core teams.</p>
        <ul class="mt-2">${list(core)}</ul>
      </div>
      <div class="p-4 md:p-5">
        <p class="display text-[28px] leading-none">${outside.length} on the outside</p>
        <p class="mt-1 text-[14px] text-muted">No chain of wins runs both ways between these teams and the core.</p>
        <ul class="mt-2">${list(outside)}</ul>
      </div>
    </div>
    <p class="mt-2 text-[13px] text-muted">Newest link in the ring: ${esc(winner(latest))} over ${esc(loser(latest))}, ${esc(fmtDate(latest.date))}.</p>
  </section>`;
}

