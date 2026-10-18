import type { Dataset, Game } from '../lib/data';
import type { Analysis } from '../lib/graph';
import { edgeKey } from '../lib/graph';
import type { CardMeta } from '../lib/card';

export type View = 'ring' | 'proof' | 'grid' | 'scores';

export interface State {
  view: View;
  from: string | null;
  to: string | null;
  /** 0-based index into `Analysis.rings`. */
  ring: number;
}

export interface Ctx extends State {
  data: Dataset;
  a: Analysis;
  /** The ring currently on display. */
  cycle: string[];
  meta: CardMeta;
  href: (p: Partial<State>) => string;
}

/** The game behind "winner beat loser"; the most recent one if they met twice. */
export function edgeGame(a: Analysis, w: string, l: string): Game | undefined {
  const gs = a.graph.edgeGames.get(edgeKey(w, l)) ?? [];
  return [...gs].sort((x, y) => y.date.localeCompare(x.date))[0];
}

/** "FINAL" or "FINAL/OT". */
export const finalTag = (g: Game) => (g.ot ? 'Final/OT' : 'Final');
