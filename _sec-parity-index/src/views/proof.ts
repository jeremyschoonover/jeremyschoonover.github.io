import { teamInfo } from '../data/teams';
import { losePts, winPts, winner } from '../lib/data';
import { shortestPath } from '../lib/graph';
import { disc, esc, fmtDate, score } from '../lib/ui';
import { exportButtons } from './diagram';
import { type Ctx, edgeGame, emptyState } from './shared';

/** Default matchup: the ring's runner-up "beats" the ring's lead team, despite losing to it. */
export function defaultPair(ctx: Ctx): [string, string] {
  const { a } = ctx;
  if (a.cycle.length >= 2) return [a.cycle[1], a.cycle[0]];
  const s = a.standings;
  return [s[s.length - 1]?.team ?? '', s[0]?.team ?? ''];
}

export function proofPath(ctx: Ctx): { from: string; to: string; path: string[] | null } {
  const [df, dt] = defaultPair(ctx);
  const from = ctx.from ?? df;
  const to = ctx.to ?? dt;
  return { from, to, path: shortestPath(ctx.a.graph, from, to) };
}

function chain(ctx: Ctx, path: string[]): string {
  return `<ol class="relative">${path.map((t, i) => {
    const next = path[i + 1];
    const g = next ? edgeGame(ctx.a, t, next) : undefined;
    return `<li class="grid grid-cols-[44px_1fr] gap-x-4">
      <div class="flex flex-col items-center">${disc(t, 40)}${next ? `<svg width="12" height="54" viewBox="0 0 12 54" aria-hidden="true"><line x1="6" y1="4" x2="6" y2="44" stroke="#141413" stroke-width="1.5"/><path d="M0 42L12 42L6 52z" fill="#141413"/></svg>` : ''}</div>
      <div class="pt-2">
        <p class="text-[16px] font-semibold">${esc(t)}</p>
        ${g ? `<p class="text-[13px] mt-1"><span class="text-muted">def. ${esc(next!)}</span>
          <span class="tabular ml-2">${score(winPts(g), losePts(g))}</span>
          <span class="tabular text-muted ml-2">Wk ${g.week} &middot; ${esc(fmtDate(g.date))} &middot; ${g.neutral ? 'neutral site' : winner(g) === g.home ? 'home' : 'road'}</span></p>` : ''}
      </div>
    </li>`;
  }).join('')}</ol>`;
}

export function renderProof(ctx: Ctx): string {
  const { a } = ctx;
  if (!a.games.length) return emptyState(ctx, 'proof');
  const { from, to, path } = proofPath(ctx);
  const opts = (sel: string) => [...a.teams].sort((x, y) => x.localeCompare(y))
    .map((t) => `<option value="${esc(t)}" ${t === sel ? 'selected' : ''}>${esc(t)} (${esc(teamInfo(t).abbr)})</option>`).join('');
  const back = shortestPath(a.graph, to, from);
  const direct = edgeGame(a, to, from) ?? edgeGame(a, from, to);

  const verdict = path
    ? `<h2 class="font-serif text-5xl md:text-6xl leading-[1.02]">${esc(from)} <span class="italic">&gt;</span> ${esc(to)}</h2>
       <p class="font-serif italic text-2xl text-muted mt-2">By the transitive property, in ${path.length - 1} ${path.length === 2 ? 'step' : 'steps'}.</p>`
    : `<h2 class="font-serif text-5xl leading-[1.02]">No proof exists.</h2>
       <p class="font-serif italic text-2xl text-muted mt-2">${from === to ? 'Pick two different teams.' : `No chain of ${esc(ctx.confLabel)} wins leads from ${esc(from)} to ${esc(to)}.`}</p>`;

  return `<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
    <section class="border border-ink bg-card">
      <form class="grid gap-3 border-b border-ink p-5 sm:grid-cols-[1fr_auto_1fr] sm:items-end" data-proof-form>
        <label class="block"><span class="kicker">Claim: this team</span><select class="field mt-1" name="from">${opts(from)}</select></label>
        <button type="button" class="btn justify-center" data-swap aria-label="Swap teams">Swap</button>
        <label class="block"><span class="kicker">is better than</span><select class="field mt-1" name="to">${opts(to)}</select></label>
      </form>
      <div class="p-5 md:p-8">
        ${verdict}
        ${path ? `<div class="mt-8">${chain(ctx, path)}</div>` : ''}
        ${!path && from !== to && !a.scc.includes(from) ? `<p class="mt-6 text-[15px] max-w-xl">${esc(from)} sits outside the ${a.scc.length}-team strong component, so its wins never connect to the teams above it.</p>` : ''}
      </div>
    </section>
    <aside class="flex flex-col gap-6">
      <section class="border border-ink bg-card p-5">
        <p class="kicker">What actually happened</p>
        ${direct
          ? `<p class="mt-2 text-[15px]"><strong>${esc(winner(direct))}</strong> won the head-to-head, <span class="tabular">${score(winPts(direct), losePts(direct))}</span>, in Week ${direct.week}.</p>`
          : `<p class="mt-2 text-[15px]">${esc(from)} and ${esc(to)} have not played.</p>`}
      </section>
      <section class="border border-ink bg-card p-5">
        <p class="kicker">The rebuttal</p>
        ${back
          ? `<p class="mt-2 text-[15px]">${esc(to)} can prove the opposite in ${back.length - 1} ${back.length === 2 ? 'step' : 'steps'}:</p>
             <p class="tabular text-[13px] mt-2 leading-relaxed">${back.map((t) => esc(teamInfo(t).abbr)).join(' &gt; ')}</p>
             <a class="btn mt-3" href="${esc(ctx.href({ view: 'proof', from: to, to: from }))}">Open rebuttal</a>`
          : `<p class="mt-2 text-[15px]">${esc(to)} has no chain back to ${esc(from)}. This one is airtight.</p>`}
      </section>
      ${path ? `<section class="border border-ink bg-card p-5">
        <p class="kicker mb-3">Share this proof</p>
        ${exportButtons('proof')}
        <button class="btn mt-2" data-copy-link>Copy link</button>
        <p class="mt-3 text-[12px] text-muted tabular break-all">?from=${esc(teamInfo(from).abbr)}&amp;to=${esc(teamInfo(to).abbr)}</p>
      </section>` : ''}
    </aside>
  </div>`;
}
