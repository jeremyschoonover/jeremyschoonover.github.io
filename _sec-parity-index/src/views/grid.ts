import { teamInfo } from '../data/teams';
import { losePts, winPts } from '../lib/data';
import { allDistances } from '../lib/graph';
import { disc, esc } from '../lib/ui';
import { type Ctx, edgeGame } from './shared';

export function renderGrid(ctx: Ctx): string {
  const { a } = ctx;
  const order = a.standings.map((r) => r.team);
  const dist = allDistances(a.graph);
  const n = order.length;
  const head = order.map((t) => `<th scope="col" class="bg-card p-1"><div class="flex flex-col items-center gap-0.5">${disc(t, 28)}<span class="label text-[11px]">${esc(teamInfo(t).abbr)}</span></div></th>`).join('');
  const cell = (cls: string, href: string, title: string, body: string) =>
    `<td class="${cls}"><a href="${esc(href)}" title="${esc(title)}" aria-label="${esc(title)}">${body}</a></td>`;
  const body = order.map((row) => {
    const r = a.records.get(row)!;
    const cells = order.map((col) => {
      if (row === col) return '<td class="bg-ink" aria-label="same team"></td>';
      const w = edgeGame(a, row, col);
      const l = edgeGame(a, col, row);
      const href = ctx.href({ view: 'proof', from: row, to: col });
      if (w && l) return cell('bg-card num text-[14px]', href, 'Split', '<span class="text-win">W</span>/<span class="text-loss">L</span>');
      if (w) return cell('bg-win-bg text-win num text-[15px]', href, `${row} beat ${col} ${winPts(w)}-${losePts(w)}`, `W ${winPts(w)}&ndash;${losePts(w)}`);
      if (l) return cell('bg-loss-bg text-loss num text-[15px]', href, `${row} lost to ${col} ${losePts(l)}-${winPts(l)}`, `L ${losePts(l)}&ndash;${winPts(l)}`);
      const d = dist.get(row)!.get(col);
      return d
        ? cell('bg-card text-muted num text-[14px] font-semibold', href, `${row} > ${col} in ${d} steps`, `+${d}`)
        : '<td class="bg-card"></td>';
    }).join('');
    return `<tr><th scope="row" class="sticky left-0 z-10 bg-card px-2 py-1 text-left">
        <span class="flex items-center gap-2">${disc(row, 26)}<span class="label text-[14px]">${esc(teamInfo(row).abbr)}</span><span class="num text-[15px] text-muted ml-auto">${r.w}&ndash;${r.l}</span></span>
      </th>${cells}</tr>`;
  }).join('');

  return `<section>
    <span class="tag tag-line">The grid</span>
    <div class="border border-ink bg-card">
      <p class="border-b border-rule px-4 py-3 text-[14px] text-muted md:px-5">Read across: each row is one team's results against every other. Sorted by SEC record. Tap a square for the full case.</p>
      <div class="overflow-x-auto">
        <table class="grid-table w-full table-fixed border-collapse" style="min-width:${120 + n * 56}px">
          <colgroup><col style="width:120px">${order.map(() => '<col>').join('')}</colgroup>
          <thead><tr><th class="sticky left-0 z-10 bg-card"></th>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      <div class="flex flex-wrap gap-x-6 gap-y-2 border-t border-rule px-4 py-3 text-[14px] md:px-5">
        <span class="flex items-center gap-2"><span class="inline-block h-4 w-6 border border-win bg-win-bg"></span>Won</span>
        <span class="flex items-center gap-2"><span class="inline-block h-4 w-6 border border-loss bg-loss-bg"></span>Lost</span>
        <span class="flex items-center gap-2"><span class="num text-muted">+3</span>Didn't play; row team has a 3-step chain of wins over them</span>
      </div>
    </div>
  </section>`;
}
