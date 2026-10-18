import { teamInfo } from '../data/teams';
import { losePts, winPts } from '../lib/data';
import { allDistances } from '../lib/graph';
import { disc, esc } from '../lib/ui';
import { type Ctx, edgeGame, emptyState } from './shared';

const MAX = 24;

export function renderGrid(ctx: Ctx): string {
  const { a } = ctx;
  if (!a.games.length) return emptyState(ctx, 'grid');
  if (a.teams.length > MAX) {
    return `<div class="border border-ink bg-card p-8"><h2 class="font-serif text-4xl">${a.teams.length} teams is too many squares.</h2>
      <p class="mt-3 max-w-xl text-[15px]">The head-to-head grid is drawn one conference at a time. Choose the SEC, Big Ten, Big 12 or ACC above.</p></div>`;
  }
  const order = a.standings.map((r) => r.team);
  const dist = allDistances(a.graph);
  const n = order.length;
  const head = order.map((t) => `<th scope="col" class="p-1 bg-card"><div class="flex flex-col items-center gap-1">${disc(t, 24)}<span class="text-[10px] font-semibold tabular">${esc(teamInfo(t).abbr)}</span></div></th>`).join('');
  const body = order.map((row) => {
    const r = a.records.get(row)!;
    const cells = order.map((col) => {
      if (row === col) return '<td class="bg-rule" aria-label="same team"></td>';
      const w = edgeGame(a, row, col);
      const l = edgeGame(a, col, row);
      const link = ctx.href({ view: 'proof', from: row, to: col });
      if (w && l) return `<td class="hit text-center tabular text-[11px] bg-card" data-href="${esc(link)}" title="Split series"><span class="text-win">W</span>/<span class="text-loss">L</span></td>`;
      if (w) return `<td class="hit text-center tabular text-[11px] bg-win-bg text-win font-medium" data-href="${esc(link)}" title="${esc(`${row} def. ${col}`)}">W ${winPts(w)}&ndash;${losePts(w)}</td>`;
      if (l) return `<td class="hit text-center tabular text-[11px] bg-loss-bg text-loss font-medium" data-href="${esc(link)}" title="${esc(`${col} def. ${row}`)}">L ${losePts(l)}&ndash;${winPts(l)}</td>`;
      const d = dist.get(row)!.get(col);
      return d
        ? `<td class="hit text-center tabular text-[11px] text-muted bg-card" data-href="${esc(link)}" title="${esc(`${row} > ${col} in ${d} steps`)}">&gt;${d}</td>`
        : '<td class="bg-card"></td>';
    }).join('');
    return `<tr><th scope="row" class="sticky left-0 z-10 bg-card px-2 py-1 text-left whitespace-nowrap">
        <span class="flex items-center gap-2">${disc(row, 22)}<span class="text-[12px] font-semibold">${esc(teamInfo(row).abbr)}</span><span class="tabular text-[11px] text-muted ml-auto pl-2">${r.w}&ndash;${r.l}</span></span>
      </th>${cells}</tr>`;
  }).join('');

  return `<section class="border border-ink bg-card">
    <div class="flex flex-wrap items-baseline justify-between gap-3 border-b border-ink px-5 py-3">
      <p class="kicker">Fig. 3 &mdash; ${n}&times;${n} head-to-head grid</p>
      <p class="text-[12px] text-muted">Rows read against columns. Sorted by conference record.</p>
    </div>
    <div class="overflow-x-auto p-3">
      <table class="grid-table border-collapse w-full table-fixed" style="min-width:${128 + n * 52}px">
        <colgroup><col style="width:128px">${order.map(() => '<col>').join('')}</colgroup>
        <thead><tr><th class="bg-card"></th>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <div class="flex flex-wrap gap-x-6 gap-y-2 border-t border-rule px-5 py-3 text-[12px]">
      <span class="flex items-center gap-2"><span class="inline-block w-6 h-4 border border-win bg-win-bg"></span>Row team won</span>
      <span class="flex items-center gap-2"><span class="inline-block w-6 h-4 border border-loss bg-loss-bg"></span>Row team lost</span>
      <span class="flex items-center gap-2"><span class="tabular text-muted">&gt;3</span>Didn't play; row team wins a transitive argument in 3 steps</span>
      <span class="text-muted">Select any square to open the proof.</span>
    </div>
  </section>`;
}
