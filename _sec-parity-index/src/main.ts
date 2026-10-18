import './styles.css';
import dataset from '../data/games-2026.json';
import precomputed from '../data/analysis-2026.json';
import { CONFERENCES, type ConferenceId, teamInfo } from './data/teams';
import { type Dataset, gamesFor, losePts, winPts } from './lib/data';
import { type Analysis, analyze, compareRecords, edgeKey, rotateCycle } from './lib/graph';
import { downloadCard, type CardSize, type CardMeta } from './lib/card';
import { esc } from './lib/ui';
import { type Ctx, type View, edgeGame } from './views/shared';
import { renderDiagram } from './views/diagram';
import { proofPath, renderProof } from './views/proof';
import { renderGrid } from './views/grid';
import { renderLog } from './views/log';

const data = dataset as Dataset;
type Pre = { games: number; cycle: string[]; cycleExhaustive: boolean };
const pre = (precomputed as { source: string; dataUpdatedAt: string; conferences: Record<string, Pre> });

const VIEWS: { id: View; label: string; num: string }[] = [
  { id: 'diagram', label: 'Parity Diagram', num: 'I' },
  { id: 'proof', label: 'Head-to-Head Proof', num: 'II' },
  { id: 'grid', label: 'The Grid', num: 'III' },
  { id: 'log', label: 'Box Score Log', num: 'IV' },
];

const cache = new Map<ConferenceId, Analysis>();
function analysisFor(conf: ConferenceId): Analysis {
  if (cache.has(conf)) return cache.get(conf)!;
  const games = gamesFor(data.games, conf);
  const p = pre.conferences[conf];
  const usePre = p && pre.dataUpdatedAt === data.updatedAt && p.games === games.length && p.cycle.length > 0;
  // The build-time analysis already ran the long search; in the browser only a short one is needed.
  const a = analyze(games, [], usePre ? { maxSteps: 0 } : { maxMs: 1500 });
  if (usePre && p.cycle.every((t, i) => a.graph.edgeGames.has(edgeKey(t, p.cycle[(i + 1) % p.cycle.length])))) {
    const cmp = (x: string, y: string) => compareRecords(a.records.get(x)!, a.records.get(y)!);
    a.cycle = rotateCycle(p.cycle, cmp);
    a.cycleExhaustive = p.cycleExhaustive;
  } else if (usePre) {
    Object.assign(a, analyze(games, [], { maxMs: 1500 }));
  }
  cache.set(conf, a);
  return a;
}

interface State { conf: ConferenceId; view: View; from: string | null; to: string | null }

function resolveTeam(q: string | null, a: Analysis): string | null {
  if (!q) return null;
  const s = q.trim().toLowerCase();
  return a.teams.find((t) => t.toLowerCase() === s)
    ?? a.teams.find((t) => teamInfo(t).abbr.toLowerCase() === s)
    ?? a.teams.find((t) => t.toLowerCase().replace(/[^a-z0-9]/g, '') === s.replace(/[^a-z0-9]/g, ''))
    ?? null;
}

function readState(): State {
  const p = new URLSearchParams(location.search);
  const c = (p.get('conf') ?? 'SEC').toLowerCase().replace(/[^a-z0-9]/g, '');
  const conf = CONFERENCES.find((x) => x.id.toLowerCase().replace(/[^a-z0-9]/g, '') === c || (c === 'allfbs' && x.id === 'FBS'))?.id ?? 'SEC';
  const a = analysisFor(conf);
  const from = resolveTeam(p.get('from'), a);
  const to = resolveTeam(p.get('to'), a);
  const v = p.get('view') as View | null;
  const view = VIEWS.some((x) => x.id === v) ? v! : from || to ? 'proof' : 'diagram';
  return { conf, view, from, to };
}

function href(s: State, patch: Partial<State>): string {
  const n = { ...s, ...patch };
  const p = new URLSearchParams();
  if (n.conf !== 'SEC') p.set('conf', n.conf === 'FBS' ? 'FBS' : n.conf);
  if (n.view !== 'diagram' && !(n.view === 'proof' && (n.from || n.to))) p.set('view', n.view);
  if (n.view === 'proof') {
    if (n.from) p.set('from', teamInfo(n.from).abbr);
    if (n.to) p.set('to', teamInfo(n.to).abbr);
  }
  const q = p.toString();
  return q ? `?${q}` : location.pathname;
}

function meta(): CardMeta {
  const maxWeek = Math.max(0, ...data.games.map((g) => g.week));
  const site = (location.host + location.pathname).replace(/index\.html$/, '').replace(/\/$/, '');
  return {
    edition: `2026 Season · Week ${maxWeek} Edition`,
    site,
    source: data.source === 'seed'
      ? 'Seed results through Wk 7 · Oct 17, 2026'
      : `Data: CollegeFootballData.com · ${new Date(data.updatedAt).toISOString().slice(0, 10)}`,
  };
}

let state = readState();

function ctx(): Ctx {
  const confInfo = CONFERENCES.find((c) => c.id === state.conf)!;
  return {
    conf: state.conf,
    confLabel: confInfo.short,
    data,
    a: analysisFor(state.conf),
    from: state.from,
    to: state.to,
    meta: meta(),
    href: (p) => href(state, p as Partial<State>),
  };
}

function render() {
  const c = ctx();
  const { a } = c;
  const confInfo = CONFERENCES.find((x) => x.id === state.conf)!;
  const pct = a.teams.length ? Math.round((a.cycle.length / a.teams.length) * 100) : 0;
  const body = { diagram: renderDiagram, proof: renderProof, grid: renderGrid, log: renderLog }[state.view](c);
  const live = data.source !== 'seed';

  document.getElementById('app')!.innerHTML = `
  <div class="mx-auto max-w-[1240px] px-4 md:px-8 pb-16">
    <header class="pt-6">
      <div class="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink pb-2">
        <p class="kicker">${esc(c.meta.edition)}</p>
        <p class="kicker text-muted">${live ? `Live sync &middot; ${esc(new Date(data.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}` : 'Seed results through Oct 17 &middot; Live sync on Saturdays'}</p>
      </div>
      <div class="border-b border-ink pt-5 pb-5 md:flex md:items-end md:justify-between md:gap-8">
        <div>
          <h1 class="font-serif text-[56px] md:text-[88px] leading-[0.92] tracking-[-0.01em]">The SEC Parity Index</h1>
          <p class="mt-3 max-w-2xl text-[15px] md:text-[17px] leading-relaxed">An almanac of the 2026 college football season&rsquo;s circular logic: the longest chain of results that loops back on itself, the teams who can each claim to be better than all the others, and the receipts.</p>
        </div>
        <div class="mt-5 md:mt-0 shrink-0">
          <p class="kicker text-muted mb-1.5">Conference</p>
          <div class="flex flex-wrap" role="group" aria-label="Conference">
            ${CONFERENCES.map((x) => `<button class="conf" data-conf="${esc(x.id)}" aria-pressed="${x.id === state.conf}">${esc(x.short)}</button>`).join('')}
          </div>
        </div>
      </div>
      <div class="h-px bg-ink mt-[3px]"></div>
      <dl class="grid grid-cols-2 md:grid-cols-4 border-x border-b border-ink bg-card mt-6">
        ${[
          ['Longest cycle', a.cycle.length ? `${a.cycle.length}` : '&ndash;', a.cycleExhaustive ? 'teams on one ring' : 'teams, best found'],
          ['Strong component', a.scc.length ? `${a.scc.length}` : '&ndash;', `of ${a.teams.length} teams`],
          ['Parity index', a.teams.length ? `.${String(pct).padStart(2, '0')}` : '&ndash;', 'ring length / teams'],
          ['Finals logged', `${a.games.length}`, state.conf === 'FBS' ? 'FBS vs. FBS' : `${esc(confInfo.short)} games`],
        ].map(([k, v, s], i) => `<div class="px-4 py-3 border-t border-ink ${i % 2 ? '' : 'border-r'} ${i === 1 ? 'md:border-r' : ''} ${i === 3 ? '' : ''}">
          <dt class="kicker text-muted">${k}</dt>
          <dd class="flex items-baseline gap-2 mt-1"><span class="tabular text-[30px] leading-none font-medium">${v}</span><span class="text-[12px] text-muted">${s}</span></dd>
        </div>`).join('')}
      </dl>
      <nav class="mt-6 flex gap-6 overflow-x-auto border-b border-rule" aria-label="Views">
        ${VIEWS.map((v) => `<a class="tab" href="${esc(href(state, { view: v.id }))}" data-view="${v.id}" aria-current="${v.id === state.view}"><span class="tabular text-muted mr-1.5">${v.num}.</span>${v.label}</a>`).join('')}
      </nav>
    </header>
    <main class="mt-6">${body}</main>
    <footer class="mt-12 border-t border-ink pt-3 grid gap-2 md:grid-cols-[1fr_auto] text-[12px] text-muted">
      <p>Arrows point from winner to loser. Only games between two teams in the selected group count. ${live ? 'Results from CollegeFootballData.com.' : 'Seed results bundled through Week 7 (Oct 17, 2026); replaced by CollegeFootballData.com finals when the Saturday sync runs.'}</p>
      <p class="tabular">Season 2026 &middot; ${esc(c.meta.site)}</p>
    </footer>
  </div>`;
  document.title = state.view === 'proof' && state.from && state.to
    ? `${state.from} > ${state.to} · The SEC Parity Index`
    : 'The SEC Parity Index';
}

function go(next: Partial<State>, push = true) {
  state = { ...state, ...next };
  if (next.conf) {
    const a = analysisFor(state.conf);
    if (state.from && !a.teams.includes(state.from)) state.from = null;
    if (state.to && !a.teams.includes(state.to)) state.to = null;
  }
  const url = href(state, {});
  if (push) history.pushState(null, '', url); else history.replaceState(null, '', url);
  render();
}

function ringCard(c: Ctx) {
  const { a } = c;
  const n = a.cycle.length;
  const games = a.cycle.map((t, i) => edgeGame(a, t, a.cycle[(i + 1) % n])!);
  return {
    kind: 'ring' as const,
    conference: c.confLabel === 'All FBS' ? 'FBS' : c.confLabel,
    cycle: a.cycle,
    labels: games.map((g) => `${winPts(g)}-${losePts(g)}`),
    stats: [
      ['Longest cycle', `${n}`],
      ['Strong component', `${a.scc.length} of ${a.teams.length}`],
      ['Parity index', `.${String(Math.round((n / a.teams.length) * 100)).padStart(2, '0')}`],
    ] as [string, string][],
    lines: a.cycle.slice(0, 16).map((t, i) => `${teamInfo(t).abbr.padEnd(4)} def. ${teamInfo(a.cycle[(i + 1) % n]).abbr.padEnd(4)} ${`${winPts(games[i])}-${losePts(games[i])}`.padStart(5)}  Wk ${games[i].week}`),
  };
}

function proofCard(c: Ctx) {
  const { path } = proofPath(c);
  if (!path) return null;
  return {
    kind: 'proof' as const,
    conference: c.confLabel,
    path,
    hops: path.slice(0, -1).map((t, i) => {
      const g = edgeGame(c.a, t, path[i + 1])!;
      return `${winPts(g)}-${losePts(g)}|Wk ${g.week}`;
    }),
  };
}

document.addEventListener('click', async (e) => {
  const el = e.target as HTMLElement;
  const confBtn = el.closest<HTMLElement>('[data-conf]');
  if (confBtn) return go({ conf: confBtn.dataset.conf as ConferenceId });

  const a = el.closest<HTMLAnchorElement>('a[href]');
  if (a && !a.hasAttribute('download') && a.protocol.startsWith('http') && a.origin === location.origin && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
    e.preventDefault();
    history.pushState(null, '', a.href);
    state = readState();
    render();
    window.scrollTo({ top: 0 });
    return;
  }

  const cell = el.closest<HTMLElement>('[data-href]');
  if (cell) {
    history.pushState(null, '', cell.dataset.href!);
    state = readState();
    render();
    return;
  }

  if (el.closest('[data-swap]')) {
    const { from, to } = proofPath(ctx());
    return go({ from: to, to: from }, false);
  }

  if (el.closest('[data-copy-link]')) {
    const btn = el.closest<HTMLButtonElement>('[data-copy-link]')!;
    try {
      await navigator.clipboard.writeText(location.href);
      btn.textContent = 'Link copied';
    } catch {
      btn.textContent = 'Copy failed';
    }
    return;
  }

  const exp = el.closest<HTMLButtonElement>('[data-export]');
  if (exp) {
    const c = ctx();
    const size = exp.dataset.size as CardSize;
    const card = exp.dataset.export === 'ring' ? ringCard(c) : proofCard(c);
    if (!card) return;
    const slug = card.kind === 'ring'
      ? `${c.conf.toLowerCase().replace(/\s+/g, '')}-circle-of-parity`
      : `${teamInfo(card.path[0]).abbr}-over-${teamInfo(card.path[card.path.length - 1]).abbr}`.toLowerCase();
    exp.disabled = true;
    await downloadCard(card, size, c.meta, `${slug}-${size}.png`);
    exp.disabled = false;
  }
});

document.addEventListener('change', (e) => {
  const el = e.target as HTMLSelectElement;
  if (el.closest('[data-proof-form]')) {
    const { from, to } = proofPath(ctx());
    go({ view: 'proof', from: el.name === 'from' ? el.value : from, to: el.name === 'to' ? el.value : to }, false);
  }
});

window.addEventListener('popstate', () => {
  state = readState();
  render();
});

render();
