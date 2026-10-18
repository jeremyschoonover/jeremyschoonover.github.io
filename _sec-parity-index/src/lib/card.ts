import { teamInfo } from '../data/teams';
import { ringLayout } from './ring';

export type CardSize = '1200x630' | '1080x1350';
export const CARD_SIZES: CardSize[] = ['1200x630', '1080x1350'];

const PAPER = '#F6F4EE';
const CARD = '#FFFFFF';
const INK = '#141413';
const RULE = '#D5D1C7';
const MUTED = '#6B675E';
const SERIF = '"Instrument Serif", Georgia, serif';
const SANS = 'Inter, system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

export interface CardMeta {
  edition: string;
  site: string;
  source: string;
}

export interface RingCard {
  kind: 'ring';
  conference: string;
  cycle: string[];
  /** Score label for the arrow from cycle[i] to cycle[i+1]. */
  labels: string[];
  stats: [string, string][];
  lines: string[];
}

export interface ProofCard {
  kind: 'proof';
  conference: string;
  path: string[];
  /** One line per hop: "def. Georgia 17-13 - Wk 7". */
  hops: string[];
}

async function fontsReady() {
  if (!('fonts' in document)) return;
  await Promise.all([
    document.fonts.load(`64px ${SERIF}`),
    document.fonts.load(`italic 64px ${SERIF}`),
    document.fonts.load(`600 16px ${SANS}`),
    document.fonts.load(`700 16px ${SANS}`),
    document.fonts.load(`500 16px ${MONO}`),
  ]).catch(() => undefined);
}

function disc(ctx: CanvasRenderingContext2D, team: string, x: number, y: number, r: number) {
  const t = teamInfo(team);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = t.color;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = t.ink;
  ctx.font = `700 ${Math.round(r * (t.abbr.length > 3 ? 0.5 : 0.62))}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t.abbr, x, y + 1);
}

function arrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, head: number) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = Math.max(1.5, head / 5);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - Math.cos(a) * head * 0.8, y2 - Math.sin(a) * head * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(a - 0.42), y2 - head * Math.sin(a - 0.42));
  ctx.lineTo(x2 - head * Math.cos(a + 0.42), y2 - head * Math.sin(a + 0.42));
  ctx.closePath();
  ctx.fill();
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color = INK, align: CanvasTextAlign = 'left') {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
}

function hline(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, color = RULE) {
  ctx.fillStyle = color;
  ctx.fillRect(x1, Math.round(y), x2 - x1, 1);
}

/** Paper, white card, 1px ink frame, and the masthead watermark band along the bottom. */
function frame(ctx: CanvasRenderingContext2D, w: number, h: number, meta: CardMeta) {
  const m = 24;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = CARD;
  ctx.fillRect(m, m, w - 2 * m, h - 2 * m);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.strokeRect(m + 0.5, m + 0.5, w - 2 * m - 1, h - 2 * m - 1);
  const by = h - m - 64;
  hline(ctx, m, w - m, by, INK);
  hline(ctx, m, w - m, by + 3, INK);
  text(ctx, 'The SEC Parity Index', m + 28, by + 42, `30px ${SERIF}`);
  text(ctx, meta.site, w - m - 28, by + 30, `500 15px ${MONO}`, INK, 'right');
  text(ctx, meta.source, w - m - 28, by + 50, `500 12px ${MONO}`, MUTED, 'right');
  return { m, bottom: by };
}

function wrap(ctx: CanvasRenderingContext2D, s: string, maxW: number): string[] {
  const words = s.split(' ');
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxW && line) { out.push(line); line = w; } else line = next;
  }
  if (line) out.push(line);
  return out;
}

function ring(ctx: CanvasRenderingContext2D, card: RingCard, cx: number, cy: number, R: number) {
  const L = ringLayout(card.cycle.length, cx, cy, R);
  L.arrows.forEach((a) => arrow(ctx, a.x1, a.y1, a.x2, a.y2, Math.max(8, L.r * 0.42)));
  if (L.showLabels) {
    L.arrows.forEach((a, i) => {
      ctx.font = `500 ${Math.round(Math.max(11, L.r * 0.42))}px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = INK;
      ctx.fillText(card.labels[i] ?? '', a.lx, a.ly);
    });
  }
  L.nodes.forEach((p, i) => disc(ctx, card.cycle[i], p.x, p.y, L.r));
}

function drawRing(ctx: CanvasRenderingContext2D, w: number, h: number, card: RingCard, meta: CardMeta) {
  const { m, bottom } = frame(ctx, w, h, meta);
  const x0 = m + 36;
  if (w > h) {
    text(ctx, meta.edition.toUpperCase(), x0, m + 52, `600 13px ${SANS}`, MUTED);
    hline(ctx, x0, 540, m + 66);
    text(ctx, 'The Circle', x0, m + 140, `76px ${SERIF}`);
    text(ctx, 'of Parity', x0, m + 210, `italic 76px ${SERIF}`);
    ctx.font = `500 19px ${SANS}`;
    wrap(ctx, `${card.cycle.length} ${card.conference} teams, each one beaten by the team before it, all the way around.`, 470)
      .forEach((l, i) => text(ctx, l, x0, m + 258 + i * 27, `500 19px ${SANS}`));
    card.stats.forEach(([k, v], i) => {
      const y = m + 360 + i * 44;
      hline(ctx, x0, 540, y - 28);
      text(ctx, k.toUpperCase(), x0, y, `600 13px ${SANS}`, MUTED);
      text(ctx, v, 540, y, `500 22px ${MONO}`, INK, 'right');
    });
    ring(ctx, card, 880, m + (bottom - m) / 2 + 4, Math.min(220, (bottom - m) / 2 - 40));
  } else {
    text(ctx, meta.edition.toUpperCase(), x0, m + 58, `600 15px ${SANS}`, MUTED);
    hline(ctx, x0, w - x0, m + 74);
    text(ctx, 'The Circle of', x0, m + 160, `88px ${SERIF}`);
    text(ctx, 'Parity', x0 + ctx.measureText('The Circle of ').width, m + 160, `italic 88px ${SERIF}`);
    text(ctx, `${card.cycle.length} ${card.conference} teams. Every one beat the next.`, x0, m + 206, `500 22px ${SANS}`);
    ring(ctx, card, w / 2, m + 548, 290);
    const cols = 2;
    const per = Math.ceil(card.lines.length / cols);
    const colW = (w - 2 * x0) / cols;
    const top = m + 950;
    hline(ctx, x0, w - x0, top - 30, INK);
    card.lines.forEach((l, i) => {
      const c = Math.floor(i / per);
      const r = i % per;
      text(ctx, l, x0 + c * colW, top + r * 30, `500 17px ${MONO}`);
    });
    const sy = bottom - 34;
    hline(ctx, x0, w - x0, sy - 30);
    card.stats.forEach(([k, v], i) => {
      const x = x0 + i * ((w - 2 * x0) / card.stats.length);
      text(ctx, k.toUpperCase(), x, sy - 8, `600 12px ${SANS}`, MUTED);
      text(ctx, v, x, sy + 20, `500 22px ${MONO}`);
    });
  }
}

function drawProof(ctx: CanvasRenderingContext2D, w: number, h: number, card: ProofCard, meta: CardMeta) {
  const { m, bottom } = frame(ctx, w, h, meta);
  const x0 = m + 36;
  const a = teamInfo(card.path[0]).id;
  const b = teamInfo(card.path[card.path.length - 1]).id;
  const n = card.path.length;
  if (w > h) {
    text(ctx, `${meta.edition} · Head-to-Head Proof`.toUpperCase(), x0, m + 52, `600 13px ${SANS}`, MUTED);
    hline(ctx, x0, w - x0, m + 66);
    text(ctx, `${a} > ${b}`, x0, m + 140, `68px ${SERIF}`);
    text(ctx, `By the transitive property, in ${n - 1} ${n - 1 === 1 ? 'step' : 'steps'}.`, x0, m + 180, `italic 28px ${SERIF}`, MUTED);
    const span = w - 2 * x0 - 80;
    const step = n > 1 ? span / (n - 1) : 0;
    const r = Math.min(46, step * 0.3);
    const cy = m + 300;
    for (let i = 0; i < n - 1; i++) {
      const xa = x0 + 40 + i * step;
      arrow(ctx, xa + r + 8, cy, xa + step - r - 8, cy, Math.max(9, r * 0.36));
      const [sc, wk] = card.hops[i].split('|');
      text(ctx, sc, xa + step / 2, cy - 18, `500 ${Math.round(Math.min(20, r * 0.48))}px ${MONO}`, INK, 'center');
      text(ctx, wk, xa + step / 2, cy + 30, `500 ${Math.round(Math.min(14, r * 0.36))}px ${MONO}`, MUTED, 'center');
    }
    card.path.forEach((t, i) => disc(ctx, t, x0 + 40 + i * step, cy, r));
    text(ctx, card.path.map((t) => teamInfo(t).abbr).join('  >  '), x0, bottom - 34, `500 18px ${MONO}`, MUTED);
  } else {
    text(ctx, `${meta.edition} · Head-to-Head Proof`.toUpperCase(), x0, m + 58, `600 15px ${SANS}`, MUTED);
    hline(ctx, x0, w - x0, m + 74);
    ctx.font = `84px ${SERIF}`;
    const head = wrap(ctx, `${a} > ${b}`, w - 2 * x0);
    head.forEach((l, i) => text(ctx, l, x0, m + 160 + i * 86, `84px ${SERIF}`));
    const sub = m + 160 + head.length * 86 - 30;
    text(ctx, `By the transitive property, in ${n - 1} ${n - 1 === 1 ? 'step' : 'steps'}.`, x0, sub, `italic 32px ${SERIF}`, MUTED);
    const top = sub + 70;
    const avail = bottom - 40 - top;
    const step = n > 1 ? Math.min(170, avail / (n - 1)) : 0;
    const r = Math.min(48, step * 0.3);
    const cx = x0 + 60;
    for (let i = 0; i < n - 1; i++) {
      const ya = top + r + i * step;
      arrow(ctx, cx, ya + r + 8, cx, ya + step - r - 8, Math.max(9, r * 0.36));
      const [sc, wk] = card.hops[i].split('|');
      text(ctx, `${teamInfo(card.path[i]).id} def. ${teamInfo(card.path[i + 1]).id}`, cx + r + 40, ya + step / 2 - 6, `600 ${Math.round(Math.min(24, r * 0.5))}px ${SANS}`);
      text(ctx, `${sc}   ${wk}`, cx + r + 40, ya + step / 2 + 24, `500 ${Math.round(Math.min(20, r * 0.42))}px ${MONO}`, MUTED);
    }
    card.path.forEach((t, i) => disc(ctx, t, cx, top + r + i * step, r));
  }
}

export async function renderCard(card: RingCard | ProofCard, size: CardSize, meta: CardMeta): Promise<HTMLCanvasElement> {
  await fontsReady();
  const [w, h] = size.split('x').map(Number);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  if (card.kind === 'ring') drawRing(ctx, w, h, card, meta);
  else drawProof(ctx, w, h, card, meta);
  return c;
}

export async function downloadCard(card: RingCard | ProofCard, size: CardSize, meta: CardMeta, filename: string) {
  const canvas = await renderCard(card, size, meta);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
