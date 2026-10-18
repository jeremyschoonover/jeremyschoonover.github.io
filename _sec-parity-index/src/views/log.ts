import { teamInfo } from '../data/teams';
import { losePts, sortGames, winPts, winner } from '../lib/data';
import { disc, esc, fmtDate } from '../lib/ui';
import { type Ctx, emptyState } from './shared';

export function renderLog(ctx: Ctx): string {
  const { a } = ctx;
  if (!a.games.length) return emptyState(ctx, 'box score log');
  const byWeek = new Map<number, typeof a.games>();
  for (const g of sortGames(a.games)) byWeek.set(g.week, [...(byWeek.get(g.week) ?? []), g]);
  const ring = new Set(a.cycle);
  const core = new Set(a.scc);

  const side = (t: string, pts: number, won: boolean) =>
    `<span class="flex items-center gap-2 ${won ? 'font-semibold' : 'text-muted'}">${disc(t, 20)}<span class="truncate">${esc(t)}</span><span class="tabular ml-auto ${won ? '' : ''}">${pts}</span></span>`;

  const weeks = [...byWeek.entries()].map(([wk, gs]) => `
    <section class="border border-ink bg-card">
      <div class="flex items-baseline justify-between border-b border-ink px-4 py-2">
        <h3 class="font-serif text-2xl">Week ${wk}</h3>
        <p class="kicker text-muted">${esc(fmtDate(gs[0].date))}${gs[gs.length - 1].date !== gs[0].date ? ` &ndash; ${esc(fmtDate(gs[gs.length - 1].date))}` : ''} &middot; ${gs.length} ${gs.length === 1 ? 'final' : 'finals'}</p>
      </div>
      <ul>${gs.map((g) => {
        const hw = winner(g) === g.home;
        return `<li class="grid grid-cols-[1fr_auto] gap-x-4 border-b border-rule last:border-b-0 px-4 py-2.5 text-[14px]">
          <div class="grid gap-1 min-w-0">
            ${side(g.away, g.awayPoints, !hw)}
            ${side(g.home, g.homePoints, hw)}
          </div>
          <div class="text-right text-[11px] text-muted leading-5 self-center">
            <div class="kicker">Final</div>
            <div class="tabular">${g.neutral ? 'Neutral' : `at ${esc(teamInfo(g.home).abbr)}`}</div>
            <div class="tabular">Margin ${winPts(g) - losePts(g)}</div>
          </div>
        </li>`;
      }).join('')}</ul>
    </section>`).join('');

  const standings = a.standings.map((r, i) => `<tr>
      <td class="py-1.5 pr-2 tabular text-muted text-[12px]">${i + 1}</td>
      <td class="py-1.5"><span class="flex items-center gap-2">${disc(r.team, 20)}<span class="text-[13px] font-medium">${esc(r.team)}</span></span></td>
      <td class="py-1.5 tabular text-right">${r.w}&ndash;${r.l}</td>
      <td class="py-1.5 tabular text-right">${r.pf}</td>
      <td class="py-1.5 tabular text-right">${r.pa}</td>
      <td class="py-1.5 tabular text-right ${r.pf - r.pa > 0 ? 'text-win' : r.pf - r.pa < 0 ? 'text-loss' : ''}">${r.pf - r.pa > 0 ? '+' : ''}${r.pf - r.pa}</td>
      <td class="py-1.5 pl-3 text-[10px] font-semibold tracking-wider text-muted">${ring.has(r.team) ? 'RING' : core.has(r.team) ? 'CORE' : ''}</td>
    </tr>`).join('');

  return `<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px] items-start">
    <div class="grid gap-6 md:grid-cols-2 items-start">${weeks}</div>
    <section class="border border-ink bg-card lg:sticky lg:top-4">
      <div class="border-b border-ink px-4 py-2"><h3 class="font-serif text-2xl">Standings</h3></div>
      <div class="overflow-x-auto px-4 pb-3 ${a.standings.length > 24 ? 'max-h-[70vh] overflow-y-auto' : ''}">
        <table class="log-table w-full text-[13px]">
          <thead><tr class="kicker text-muted text-left"><th class="py-2"></th><th class="py-2">Team</th><th class="py-2 text-right">W&ndash;L</th><th class="py-2 text-right">PF</th><th class="py-2 text-right">PA</th><th class="py-2 text-right">Diff</th><th></th></tr></thead>
          <tbody>${standings}</tbody>
        </table>
        <p class="text-[11px] text-muted mt-2">RING: on the longest cycle. CORE: in the strong component.</p>
      </div>
    </section>
  </div>`;
}
