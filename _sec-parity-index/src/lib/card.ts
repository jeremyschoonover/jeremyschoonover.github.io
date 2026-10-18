import { teamInfo } from '../data/teams';
import { ringLayout } from './ring';
import { discFont } from './ui';

export type CardSize = '1200x630' | '1080x1350';
export const CARD_SIZES: CardSize[] = ['1200x630', '1080x1350'];

const PAPER = '#EFEDE6';
const CARD = '#FFFFFF';
const INK = '#111111';
const RULE = '#D5D1C7';
const MUTED = '#5F5B53';
const LINE = '#FFD100';
const COND = '"Barlow Condensed", "Arial Narrow", sans-serif';
const SANS = 'Barlow, system-ui, sans-serif';

export interface CardMeta {
  /** e.g. "Through Week 7". */
  edition: string;
  site: string;
  source: string;
}

export interface RingCard {
  kind: 'ring';
  cycle: string[];
  /** Score label for the arrow from cycle[i] to cycle[i+1]. */
  labels: string[];
  /** [value, label] pairs. */
  stats: [string, string][];
  lines: [string, string, string][];
}

export interface ProofCard {
  kind: 'proof';
  path: string[];
  /** Score and week for each hop. */
  hops: { score: string; week: string }[];
}

async function fontsReady() {
  if (!('fonts' in document)) return;
  await Promise.all([
    document.fonts.load(`800 64px ${COND}`),
    document.fonts.load(`italic 800 64px ${COND}`),
    document.fonts.load(`700 16px ${COND}`),
    document.fonts.load(`600 16px ${COND}`),
    document.fonts.load(`500 16px ${SANS}`),
    document.fonts.load(`600 16px ${SANS}`),
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
  ctx.font = `800 ${Math.round(discFont(t.abbr, r * 2))}px ${COND}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t.abbr, x, y + 1);
}

function arrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, head: number) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = Math.max(2.5, head / 4.5);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - Math.cos(a) * head * 0.8, y2 - Math.sin(a) * head * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(a - 0.45), y2 - head * Math.sin(a - 0.45));
  ctx.lineTo(x2 - head * Math.cos(a + 0.45), y2 - head * Math.sin(a + 0.45));
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

/** Score label with a white knockout so it reads over arrows. */
function knockout(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number) {
  ctx.font = `700 ${size}px ${COND}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6;
  ctx.strokeStyle = CARD;
  ctx.strokeText(s, x, y);
  ctx.fillStyle = INK;
  ctx.fillText(s, x, y);
}

function hline(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, color = RULE, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(x1, Math.round(y), x2 - x1, h);
}

/** Black scorebug header and watermark footer around a white field. Returns the usable box. */
function frame(ctx: CanvasRenderingContext2D, w: number, h: number, meta: CardMeta, title: string) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  const m = 20;
  ctx.fillStyle = CARD;
  ctx.fillRect(m, m, w - 2 * m, h - 2 * m);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.strokeRect(m + 0.5, m + 0.5, w - 2 * m - 1, h - 2 * m - 1);

  const hb = 64;
  ctx.fillStyle = INK;
  ctx.fillRect(m, m, w - 2 * m, hb);
  ctx.fillStyle = LINE;
  ctx.fillRect(m, m + hb - 5, w - 2 * m, 5);
  text(ctx, 'SEC PARITY INDEX', m + 28, m + 42, `italic 800 34px ${COND}`, CARD);
  text(ctx, `${title}  ·  ${meta.edition}`.toUpperCase(), w - m - 28, m + 40, `700 20px ${COND}`, CARD, 'right');

  const fb = 46;
  const fy = h - m - fb;
  hline(ctx, m, w - m, fy, INK);
  text(ctx, meta.site, m + 28, fy + 30, `700 20px ${COND}`, INK);
  text(ctx, meta.source.toUpperCase(), w - m - 28, fy + 30, `600 15px ${COND}`, MUTED, 'right');
  return { x: m + 40, y: m + hb, r: w - m - 40, b: fy };
}

function ring(ctx: CanvasRenderingContext2D, card: RingCard, cx: number, cy: number, R: number) {
  const L = ringLayout(card.cycle.length, cx, cy, R);
  L.arrows.forEach((a) => arrow(ctx, a.x1, a.y1, a.x2, a.y2, Math.max(11, L.r * 0.42)));
  L.arrows.forEach((a, i) => knockout(ctx, card.labels[i] ?? '', a.lx, a.ly, Math.round(Math.max(17, L.r * 0.6))));
  L.nodes.forEach((p, i) => disc(ctx, card.cycle[i], p.x, p.y, L.r));
}

function drawRing(ctx: CanvasRenderingContext2D, w: number, h: number, card: RingCard, meta: CardMeta) {
  const box = frame(ctx, w, h, meta, 'The circle of parity');
  const n = card.cycle.length;
  if (w > h) {
    text(ctx, `${n} TEAMS.`, box.x, box.y + 112, `800 84px ${COND}`);
    text(ctx, 'ONE CIRCLE.', box.x, box.y + 192, `800 84px ${COND}`);
    hline(ctx, box.x, box.x + 90, box.y + 214, LINE, 8);
    text(ctx, 'Each team beat the next, all the way around.', box.x, box.y + 258, `500 22px ${SANS}`);
    card.stats.forEach(([v, k], i) => {
      const x = box.x + i * 150;
      text(ctx, v, x, box.y + 350, `800 56px ${COND}`);
      text(ctx, k.toUpperCase(), x, box.y + 378, `700 16px ${COND}`, MUTED);
    });
    ring(ctx, card, 862, box.y + (box.b - box.y) / 2 + 2, Math.min(196, (box.b - box.y) / 2 - 44));
  } else {
    text(ctx, `${n} TEAMS. ONE CIRCLE.`, box.x, box.y + 104, `800 86px ${COND}`);
    hline(ctx, box.x, box.x + 110, box.y + 126, LINE, 8);
    text(ctx, 'Each team beat the next, all the way around.', box.x, box.y + 170, `500 26px ${SANS}`);
    ring(ctx, card, w / 2, box.y + 498, 286);
    const top = box.y + 860;
    hline(ctx, box.x, box.r, top - 34, INK, 2);
    const per = Math.ceil(card.lines.length / 2);
    const colW = (box.r - box.x) / 2;
    card.lines.forEach(([win, sc, wk], i) => {
      const x = box.x + Math.floor(i / per) * colW;
      const y = top + (i % per) * 34;
      text(ctx, win, x, y, `700 24px ${COND}`);
      text(ctx, sc, x + 230, y, `700 24px ${COND}`, INK, 'right');
      text(ctx, wk, x + 300, y, `600 18px ${COND}`, MUTED, 'right');
    });
    const sy = box.b - 26;
    card.stats.forEach(([v, k], i) => {
      const x = box.x + i * ((box.r - box.x) / card.stats.length);
      text(ctx, v, x, sy - 22, `800 52px ${COND}`);
      text(ctx, k.toUpperCase(), x, sy, `700 16px ${COND}`, MUTED);
    });
  }
}

function drawProof(ctx: CanvasRenderingContext2D, w: number, h: number, card: ProofCard, meta: CardMeta) {
  const box = frame(ctx, w, h, meta, 'Head to head');
  const a = card.path[0];
  const b = card.path[card.path.length - 1];
  const n = card.path.length;
  const steps = `${n - 1} ${n === 2 ? 'STEP' : 'STEPS'}`;
  if (w > h) {
    const size = a.length + b.length > 26 ? 64 : 80;
    text(ctx, `${a} > ${b}`.toUpperCase(), box.x, box.y + 106, `800 ${size}px ${COND}`);
    hline(ctx, box.x, box.x + 90, box.y + 126, LINE, 8);
    text(ctx, `The case, in ${steps.toLowerCase()}.`, box.x, box.y + 166, `500 24px ${SANS}`);
    const span = box.r - box.x - 80;
    const step = n > 1 ? span / (n - 1) : 0;
    const r = Math.min(52, step * 0.3);
    const cy = box.y + 300;
    for (let i = 0; i < n - 1; i++) {
      const xa = box.x + 40 + i * step;
      arrow(ctx, xa + r + 10, cy, xa + step - r - 10, cy, Math.max(11, r * 0.36));
      text(ctx, card.hops[i].score, xa + step / 2, cy - 20, `700 ${Math.round(Math.min(30, r * 0.62))}px ${COND}`, INK, 'center');
      text(ctx, card.hops[i].week.toUpperCase(), xa + step / 2, cy + 38, `700 ${Math.round(Math.min(18, r * 0.4))}px ${COND}`, MUTED, 'center');
    }
    card.path.forEach((t, i) => disc(ctx, t, box.x + 40 + i * step, cy, r));
  } else {
    text(ctx, a.toUpperCase(), box.x, box.y + 108, `800 92px ${COND}`);
    text(ctx, `> ${b}`.toUpperCase(), box.x, box.y + 196, `800 92px ${COND}`, MUTED);
    hline(ctx, box.x, box.x + 110, box.y + 220, LINE, 8);
    text(ctx, `The case, in ${steps.toLowerCase()}.`, box.x, box.y + 264, `500 28px ${SANS}`);
    const top = box.y + 320;
    const step = n > 1 ? Math.min(176, (box.b - 70 - top) / (n - 1)) : 0;
    const r = Math.min(52, step * 0.3);
    const cx = box.x + 56;
    for (let i = 0; i < n - 1; i++) {
      const ya = top + r + i * step;
      arrow(ctx, cx, ya + r + 10, cx, ya + step - r - 10, Math.max(11, r * 0.36));
      const mid = ya + step / 2;
      text(ctx, `${card.path[i]} beat ${card.path[i + 1]}`, cx + r + 36, mid - 4, `600 ${Math.round(Math.min(28, r * 0.56))}px ${SANS}`);
      text(ctx, `${card.hops[i].score}   ${card.hops[i].week}`.toUpperCase(), cx + r + 36, mid + 30, `700 ${Math.round(Math.min(26, r * 0.5))}px ${COND}`, MUTED);
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
