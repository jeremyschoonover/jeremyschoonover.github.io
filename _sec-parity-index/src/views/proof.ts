import { teamInfo } from '../data/teams';
import { losePts, winPts, winner } from '../lib/data';
import { shortestPath } from '../lib/graph';
import { disc, esc, fmtDate, score } from '../lib/ui';
import { exportButtons } from './ring';
import { type Ctx, edgeGame } from './shared';

/** Default matchup: the ring's No. 2 "beats" the ring's lead team, despite losing to it. */
export function proofPair(ctx: Ctx): [string, string] {
  const { cycle, a } = ctx;
  const df = cycle.length >= 2 ? cycle[1] : a.standings[a.standings.length - 1]?.team ?? '';
  const dt = cycle.length >= 2 ? cycle[0] : a.standings[0]?.team ?? '';
  return [ctx.from ?? df, ctx.to ?? dt];
}

export function proofPath(ctx: Ctx): string[] | null {
  const [from, to] = proofPair(ctx);
  return shortestPath(ctx.a.graph, from, to);
}

function chain(ctx: Ctx, path: string[]): string {
  return `<ol>${path.map((t, i) => {
    const next = path[i + 1];
    const g = next ? edgeGame(ctx.a, t, next) : undefined;
    const where = g ? (g.neutral ? 'Neutral site' : winner(g) === g.home ? 'At home' : 'On the road') : '';
    return `<li class="grid grid-cols-[48px_1fr] gap-x-4">
      <div class="flex flex-col items-center">${disc(t, 48)}${next ? `<svg width="14" height="58" viewBox="0 0 14 58" aria-hidden="true"><line x1="7" y1="4" x2="7" y2="44" stroke="#111111" stroke-width="2.5"/><path d="M0 42H14L7 56z" fill="#111111"/></svg>` : ''}</div>
      <div class="pt-1.5 min-w-0">
        <p class="display text-[26px] leading-none">${esc(t)}</p>
        ${g ? `<div class="mt-2 inline-grid grid-cols-[auto_auto] items-baseline gap-x-3 border border-ink bg-card px-3 py-1.5">
          <span class="text-[15px]">beat <strong class="font-semibold">${esc(next!)}</strong></span>
          <span class="num text-[22px] leading-none">${score(winPts(g), losePts(g))}</span>
          <span class="label text-[12px] text-muted col-span-2">Wk ${g.week} &middot; ${esc(fmtDate(g.date))} &middot; ${where}${g.ot ? ' &middot; OT' : ''}</span>
        </div>` : ''}
      </div>
    </li>`;
  }).join('')}</ol>`;
}

export function renderProof(ctx: Ctx): string {
  const { a } = ctx;
  const [from, to] = proofPair(ctx);
  const path = proofPath(ctx);
  const opts = (sel: string) => [...a.teams].sort((x, y) => x.localeCompare(y))
    .map((t) => `<option value="${esc(t)}" ${t === sel ? 'selected' : ''}>${esc(t)}</option>`).join('');
  const back = shortestPath(a.graph, to, from);
  const direct = edgeGame(a, to, from) ?? edgeGame(a, from, to);
  const steps = (p: string[]) => `${p.length - 1} ${p.length === 2 ? 'step' : 'steps'}`;

  const verdict = path
    ? `<p class="label text-muted">The case, in ${steps(path)}</p>
       <h2 class="display text-[44px] md:text-[64px] leading-[0.95] mt-1">${esc(from)} <span class="text-muted">&gt;</span> ${esc(to)}</h2>`
    : `<p class="label text-muted">No case to make</p>
       <h2 class="display text-[44px] md:text-[64px] leading-[0.95] mt-1">${from === to ? 'Pick two teams' : `${esc(from)} can't get there`}</h2>
       ${from !== to ? `<p class="mt-3 max-w-xl text-[16px]">No chain of SEC wins runs from ${esc(from)} to ${esc(to)}.${!a.scc.includes(from) ? ` ${esc(from)} is outside the ${a.scc.length}-team core, so its wins never reach back up.` : ''}</p>` : ''}`;

  return `<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
    <section>
      <span class="tag tag-line">Head to head</span>
      <div class="border border-ink bg-card">
        <form class="grid grid-cols-[1fr_auto_1fr] items-end gap-2 border-b border-ink p-4 md:gap-3 md:p-5" data-proof-form>
          <label class="block min-w-0"><span class="label text-muted">Team</span><select class="field mt-1" name="from" aria-label="Team making the claim">${opts(from)}</select></label>
          <button type="button" class="btn !min-h-[44px] !px-3" data-swap aria-label="Swap teams">
            <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true"><path d="M0 4h14M10 0l4 4-4 4M18 10H4M8 6l-4 4 4 4" fill="none" stroke="currentColor" stroke-width="2"/></svg>
          </button>
          <label class="block min-w-0"><span class="label text-muted">Better than</span><select class="field mt-1" name="to" aria-label="Team it is better than">${opts(to)}</select></label>
        </form>
        <div class="p-4 md:p-8">
          ${verdict}
          ${path ? `<div class="mt-6">${chain(ctx, path)}</div>` : ''}
        </div>
      </div>
    </section>
    <aside class="flex flex-col gap-6">
      <section>
        <span class="tag">On the field</span>
        <div class="border border-ink bg-card p-4">
          ${direct
            ? `<p class="text-[16px]"><strong class="font-semibold">${esc(winner(direct))}</strong> won the actual game, <span class="num text-[19px]">${score(winPts(direct), losePts(direct))}</span>, in Week ${direct.week}.</p>`
            : `<p class="text-[16px]">${esc(from)} and ${esc(to)} haven't played in 2026.</p>`}
        </div>
      </section>
      <section>
        <span class="tag">The rebuttal</span>
        <div class="border border-ink bg-card p-4">
          ${back
            ? `<p class="text-[16px]">${esc(to)} can argue the opposite in ${steps(back)}:</p>
               <p class="num text-[18px] mt-2 tracking-wide">${back.map((t) => esc(teamInfo(t).abbr)).join(' &gt; ')}</p>
               <a class="btn mt-3" href="${esc(ctx.href({ view: 'proof', from: to, to: from }))}">See the rebuttal</a>`
            : `<p class="text-[16px]">${esc(to)} has no chain of wins back to ${esc(from)}. This one holds up.</p>`}
        </div>
      </section>
      ${path ? `<section>
        <span class="tag">Share it</span>
        <div class="border border-ink bg-card p-4">
          ${exportButtons('proof')}
          <button class="btn mt-2 w-full" data-copy-link>Copy link</button>
        </div>
      </section>` : ''}
    </aside>
  </div>`;
}
