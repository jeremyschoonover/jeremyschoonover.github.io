import './styles.css';
import dataset from '../data/games-2026.json';
import { teamInfo } from './data/teams';
import { type Dataset, losePts, secGames, winPts } from './lib/data';
import { analyze } from './lib/graph';
import { downloadCard, type CardMeta, type CardSize, type ProofCard, type RingCard } from './lib/card';
import { esc } from './lib/ui';
import { type Ctx, type State, type View, edgeGame } from './views/shared';
import { renderRing } from './views/ring';
import { proofPair, proofPath, renderProof } from './views/proof';
import { renderGrid } from './views/grid';
import { renderScores } from './views/scores';

const data = dataset as Dataset;
const a = analyze(secGames(data.games));
const maxWeek = Math.max(0, ...a.games.map((g) => g.week));

const VIEWS: { id: View; label: string }[] = [
  { id: 'ring', label: 'The Circle' },
  { id: 'proof', label: 'Head to Head' },
  { id: 'grid', label: 'The Grid' },
  { id: 'scores', label: 'Scores' },
];
/** Older links used these view names. */
const VIEW_ALIASES: Record<string, View> = { diagram: 'ring', log: 'scores' };

function resolveTeam(q: string | null): string | null {
  if (!q) return null;
  const s = q.trim().toLowerCase();
  const squash = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
  return a.teams.find((t) => t.toLowerCase() === s)
    ?? a.teams.find((t) => teamInfo(t).abbr.toLowerCase() === s)
    ?? a.teams.find((t) => squash(t) === squash(s))
    ?? null;
}

function readState(): State {
  const p = new URLSearchParams(location.search);
  const from = resolveTeam(p.get('from'));
  const to = resolveTeam(p.get('to'));
  const raw = p.get('view') ?? '';
  const v = VIEW_ALIASES[raw] ?? raw;
  const view = VIEWS.some((x) => x.id === v) ? (v as View) : from || to ? 'proof' : 'ring';
  const ring = Math.min(Math.max(0, Number(p.get('ring') ?? 1) - 1 || 0), Math.max(0, a.rings.length - 1));
  return { view, from, to, ring };
}

function href(s: State, patch: Partial<State>): string {
  const n = { ...s, ...patch };
  const p = new URLSearchParams();
  if (n.view !== 'ring' && !(n.view === 'proof' && (n.from || n.to))) p.set('view', n.view);
  if (n.view === 'proof') {
    if (n.from) p.set('from', teamInfo(n.from).abbr);
    if (n.to) p.set('to', teamInfo(n.to).abbr);
  }
  if (n.ring > 0) p.set('ring', String(n.ring + 1));
  const q = p.toString();
  return q ? `?${q}` : location.pathname;
}

const updated = new Date(data.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const meta: CardMeta = {
  edition: `Through Week ${maxWeek}`,
  site: (location.host + location.pathname).replace(/index\.html$/, '').replace(/\/$/, ''),
  source: data.source === 'compiled'
    ? `Finals from ESPN, CBS & Fox box scores · ${updated}`
    : `Data: CollegeFootballData.com · ${updated}`,
};

let state = readState();

function ctx(): Ctx {
  return { ...state, data, a, cycle: a.rings[state.ring] ?? a.cycle, meta, href: (p) => href(state, p) };
}

function render() {
  const c = ctx();
  const n = c.cycle.length;
  const body = { ring: renderRing, proof: renderProof, grid: renderGrid, scores: renderScores }[state.view](c);
  const stats: [string, string, string][] = [
    [n ? `${n}` : '0', 'On the ring', 'Longest loop of results'],
    [`${a.scc.length}`, 'In the core', `Of ${a.teams.length} teams`],
    [a.teams.length ? `${Math.round((n / a.teams.length) * 100)}%` : '0%', 'Parity index', 'Ring / conference'],
    [`${a.games.length}`, 'SEC finals', `Through Week ${maxWeek}`],
  ];

  document.getElementById('app')!.innerHTML = `
  <header>
    <div class="bg-ink text-white" style="box-shadow: inset 0 -5px 0 var(--color-line)">
      <div class="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 pb-3.5 pt-2.5 md:px-8">
        <a href="${esc(href(state, { view: 'ring', from: null, to: null }))}" class="flex items-center gap-2.5">
          <span class="display text-[24px] italic leading-none md:text-[28px]">SEC Parity Index</span>
          <span class="num bg-line px-1.5 text-[16px] leading-6 text-ink">2026</span>
        </a>
        <span class="label text-[13px] text-white/80">Through Week ${maxWeek} &middot; Updated ${esc(updated)}</span>
      </div>
    </div>
    <div class="mx-auto max-w-[1240px] px-4 pt-8 md:px-8 md:pt-12">
      <p class="label text-muted">2026 SEC football</p>
      <h1 class="display mt-1 text-[52px] leading-[0.88] md:text-[104px]">The circle of parity</h1>
      <p class="mt-4 max-w-2xl text-[17px] leading-relaxed md:text-[19px]">Everybody in the SEC can argue they're better than everybody else. Here's the longest chain of results that proves it, game by game.</p>
      <dl class="mt-7 grid grid-cols-2 gap-px border border-ink bg-ink md:grid-cols-4">
        ${stats.map(([v, k, s]) => `<div class="bg-ink px-4 py-3 text-white md:px-5 md:py-4">
          <dt class="label text-[13px] text-line">${k}</dt>
          <dd class="mt-0.5"><span class="num block text-[44px] leading-none md:text-[56px]">${v}</span><span class="mt-1 block text-[13px] text-white/70">${s}</span></dd>
        </div>`).join('')}
      </dl>
      <nav class="mt-7 grid grid-cols-2 gap-2 sm:flex" aria-label="Views">
        ${VIEWS.map((v) => `<a class="tab" href="${esc(href(state, { view: v.id }))}" aria-current="${v.id === state.view ? 'page' : 'false'}">${v.label}</a>`).join('')}
      </nav>
    </div>
  </header>
  <main class="mx-auto max-w-[1240px] px-4 pb-16 pt-7 md:px-8">${body}</main>
  <footer class="border-t border-ink bg-card">
    <div class="mx-auto grid max-w-[1240px] gap-2 px-4 py-5 text-[14px] text-muted md:grid-cols-[1fr_auto] md:px-8">
      <p>SEC conference games only. Arrows and chains run from winner to loser. ${data.source === 'compiled'
        ? 'Finals compiled from ESPN, CBS Sports and Fox Sports box scores; updated automatically from CollegeFootballData.com on Saturdays.'
        : 'Finals from CollegeFootballData.com, refreshed every 10 minutes on Saturdays.'}</p>
      <p class="label">${esc(meta.site)}</p>
    </div>
  </footer>`;

  const [from, to] = proofPair(c);
  document.title = state.view === 'proof' ? `${from} > ${to} | SEC Parity Index` : 'SEC Parity Index';
}

function go(next: Partial<State>, push = true) {
  state = { ...state, ...next };
  const url = href(state, {});
  if (push) history.pushState(null, '', url); else history.replaceState(null, '', url);
  render();
}

function navigate(url: string) {
  history.pushState(null, '', url);
  const prevView = state.view;
  state = readState();
  render();
  if (state.view !== prevView) document.querySelector('main')?.scrollIntoView({ block: 'start' });
}

function ringCard(c: Ctx): RingCard {
  const n = c.cycle.length;
  const games = c.cycle.map((t, i) => edgeGame(a, t, c.cycle[(i + 1) % n])!);
  return {
    kind: 'ring',
    cycle: c.cycle,
    labels: games.map((g) => `${winPts(g)}-${losePts(g)}`),
    stats: [
      [`${n}`, 'On the ring'],
      [`${a.scc.length}`, 'In the core'],
      [`${Math.round((n / a.teams.length) * 100)}%`, 'Parity index'],
    ],
    lines: c.cycle.map((t, i) => [
      `${teamInfo(t).abbr} over ${teamInfo(c.cycle[(i + 1) % n]).abbr}`,
      `${winPts(games[i])}-${losePts(games[i])}`,
      `WK ${games[i].week}`,
    ]),
  };
}

function proofCard(c: Ctx): ProofCard | null {
  const path = proofPath(c);
  if (!path) return null;
  return {
    kind: 'proof',
    path,
    hops: path.slice(0, -1).map((t, i) => {
      const g = edgeGame(a, t, path[i + 1])!;
      return { score: `${winPts(g)}-${losePts(g)}`, week: `Wk ${g.week}` };
    }),
  };
}

document.addEventListener('click', async (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const el = e.target as Element;

  const link = el.closest('a[href]') as HTMLAnchorElement | SVGAElement | null;
  if (link) {
    const raw = link instanceof SVGAElement ? link.href.baseVal : link.getAttribute('href')!;
    const url = new URL(raw, location.href);
    if (!link.hasAttribute('download') && url.origin === location.origin && url.pathname === location.pathname) {
      e.preventDefault();
      navigate(url.search || location.pathname);
    }
    return;
  }

  if (el.closest('[data-swap]')) {
    const [from, to] = proofPair(ctx());
    return go({ from: to, to: from }, false);
  }

  const copy = el.closest<HTMLButtonElement>('[data-copy-link]');
  if (copy) {
    let ok = true;
    try { await navigator.clipboard.writeText(location.href); } catch { ok = false; }
    copy.textContent = ok ? 'Link copied' : 'Copy failed';
    setTimeout(() => { copy.textContent = 'Copy link'; }, 2000);
    return;
  }

  const exp = el.closest<HTMLButtonElement>('[data-export]');
  if (exp) {
    const c = ctx();
    const size = exp.dataset.size as CardSize;
    const card = exp.dataset.export === 'ring' ? ringCard(c) : proofCard(c);
    if (!card) return;
    const slug = card.kind === 'ring'
      ? `sec-circle-of-parity${c.ring ? `-ring-${c.ring + 1}` : ''}`
      : `${teamInfo(card.path[0]).abbr}-over-${teamInfo(card.path[card.path.length - 1]).abbr}`.toLowerCase();
    exp.disabled = true;
    try {
      await downloadCard(card, size, c.meta, `${slug}-${size}.png`);
    } finally {
      exp.disabled = false;
    }
  }
});

document.addEventListener('change', (e) => {
  const el = e.target as HTMLSelectElement;
  if (!el.closest('[data-proof-form]')) return;
  const [from, to] = proofPair(ctx());
  go({ view: 'proof', from: el.name === 'from' ? el.value : from, to: el.name === 'to' ? el.value : to }, false);
});

window.addEventListener('popstate', () => {
  state = readState();
  render();
});

render();
