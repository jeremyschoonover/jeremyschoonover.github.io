import { teamInfo } from '../data/teams';
import { type Game, sortGames, winner } from '../lib/data';
import { disc, esc, fmtDate } from '../lib/ui';
import { type Ctx, finalTag } from './shared';

function scoreBox(g: Game): string {
  const hw = winner(g) === g.home;
  const line = (t: string, pts: number, won: boolean) =>
    `<div class="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 px-3 py-2 ${won ? '' : 'text-muted'}">
      ${disc(t, 28)}
      <span class="min-w-0 truncate ${won ? 'font-semibold text-ink' : ''}">${esc(t)}</span>
      <span class="num text-[26px] leading-none ${won ? 'text-ink' : ''}">${pts}</span>
    </div>`;
  return `<li class="border border-ink bg-card">
    <div class="flex items-center justify-between bg-ink px-3 py-1 text-white">
      <span class="label text-[12px]">${finalTag(g)}</span>
      <span class="label text-[12px] text-white/75">${g.neutral ? 'Neutral site' : `at ${esc(teamInfo(g.home).abbr)}`}</span>
    </div>
    ${line(g.away, g.awayPoints, !hw)}
    <div class="mx-3 border-t border-rule"></div>
    ${line(g.home, g.homePoints, hw)}
  </li>`;
}

export function renderScores(ctx: Ctx): string {
  const { a } = ctx;
  const byWeek = new Map<number, Game[]>();
  for (const g of sortGames(a.games)) byWeek.set(g.week, [...(byWeek.get(g.week) ?? []), g]);
  const ring = new Set(ctx.cycle);
  const core = new Set(a.scc);

  const weeks = [...byWeek.entries()].reverse().map(([wk, gs]) => `
    <section>
      <div class="flex items-baseline gap-3 border-b-2 border-ink pb-1">
        <h3 class="display text-[30px] leading-none">Week ${wk}</h3>
        <span class="label text-muted">${esc(fmtDate(gs[0].date))} &middot; ${gs.length} ${gs.length === 1 ? 'game' : 'games'}</span>
      </div>
      <ul class="mt-3 grid gap-3 sm:grid-cols-2">${gs.map(scoreBox).join('')}</ul>
    </section>`).join('');

  const standings = a.standings.map((r, i) => {
    const diff = r.pf - r.pa;
    return `<tr class="border-t border-rule">
      <td class="py-1.5 pr-1 num text-[15px] text-muted">${i + 1}</td>
      <td class="py-1.5"><span class="flex items-center gap-2">${disc(r.team, 24)}<span class="font-medium">${esc(r.team)}</span></span></td>
      <td class="py-1.5 num text-[17px] text-right">${r.w}&ndash;${r.l}</td>
      <td class="py-1.5 num text-[16px] text-right ${diff > 0 ? 'text-win' : diff < 0 ? 'text-loss' : ''}">${diff > 0 ? '+' : ''}${diff}</td>
      <td class="py-1.5 pl-2 label text-[11px] text-right">${ring.has(r.team) ? 'Ring' : core.has(r.team) ? '<span class="text-muted">Core</span>' : ''}</td>
    </tr>`;
  }).join('');

  return `<div class="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
    <div class="grid gap-8">${weeks}</div>
    <section class="lg:sticky lg:top-4">
      <span class="tag tag-line">SEC standings</span>
      <div class="border border-ink bg-card px-4 pb-3">
        <table class="w-full text-[15px]">
          <thead><tr class="label text-[12px] text-muted"><th class="py-2"></th><th class="py-2 text-left">Team</th><th class="py-2 text-right">SEC</th><th class="py-2 text-right">Diff</th><th></th></tr></thead>
          <tbody>${standings}</tbody>
        </table>
        <p class="mt-2 text-[13px] text-muted">Ring: on the featured ring. Core: in the ${a.scc.length}-team core.</p>
      </div>
    </section>
  </div>`;
}
