import type { ConferenceId } from '../data/teams';
import type { Dataset, Game } from '../lib/data';
import type { Analysis } from '../lib/graph';
import { edgeKey } from '../lib/graph';
import type { CardMeta } from '../lib/card';

export type View = 'diagram' | 'proof' | 'grid' | 'log';

export interface Ctx {
  conf: ConferenceId;
  confLabel: string;
  data: Dataset;
  a: Analysis;
  from: string | null;
  to: string | null;
  meta: CardMeta;
  href: (p: Partial<{ view: View; from: string; to: string; conf: ConferenceId }>) => string;
}

/** The game(s) behind "winner beat loser"; the most recent one first. */
export function edgeGame(a: Analysis, w: string, l: string): Game | undefined {
  const gs = a.graph.edgeGames.get(edgeKey(w, l)) ?? [];
  return [...gs].sort((x, y) => y.date.localeCompare(x.date))[0];
}

export function emptyState(ctx: Ctx, what: string): string {
  return `<div class="border border-ink bg-card p-8 md:p-12">
    <p class="kicker text-muted">No results on file</p>
    <h2 class="font-serif text-4xl mt-2">The ${ctx.confLabel} ledger is still blank.</h2>
    <p class="mt-3 max-w-xl text-[15px] leading-relaxed">There are no completed ${ctx.conf === 'FBS' ? 'FBS' : ctx.conf + ' conference'} games in the current dataset, so there is no ${what} to draw yet. The Saturday sync pulls every final from CollegeFootballData.com every ten minutes on game days; this page fills in on the next run.</p>
  </div>`;
}
