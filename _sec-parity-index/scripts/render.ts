/**
 * Render the circle as a social post: public/circle.png (1080x1080, the page hero and the file people
 * save) and public/og.png (1200x630, the link preview). Runs before every build.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createCanvas, GlobalFonts, type Image, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import { teamInfo } from '../src/data/teams';
import { type Dataset, losePts, secGames, winPts } from '../src/lib/data';
import { analyze, edgeKey } from '../src/lib/graph';

const SITE = 'jeremyschoonover.github.io/sec-parity-index';
const FONT = 'Barlow Condensed';
const INK = '#111111';
const GRAY = '#6B6B6B';

const require = createRequire(import.meta.url);
for (const w of [600, 700, 800]) {
  GlobalFonts.registerFromPath(require.resolve(`@fontsource/barlow-condensed/files/barlow-condensed-latin-${w}-normal.woff2`), FONT);
}

const data = JSON.parse(readFileSync(new URL('../data/games-2026.json', import.meta.url), 'utf8')) as Dataset;
const a = analyze(secGames(data.games));
const ring = a.cycle;
const n = ring.length;
const week = Math.max(0, ...a.games.map((g) => g.week));
const lastDate = new Date(`${a.games.map((g) => g.date).sort().at(-1)}T12:00:00Z`)
  .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const labels = ring.map((t, i) => {
  const g = a.graph.edgeGames.get(edgeKey(t, ring[(i + 1) % n]))!.at(-1)!;
  return `${winPts(g)}-${losePts(g)}`;
});

interface Logo { img: Image; sx: number; sy: number; sw: number; sh: number }

/** Load a logo and find the bounding box of its visible pixels, so padding doesn't shrink it. */
async function logo(team: string): Promise<Logo | null> {
  const file = new URL(`../public/logos/${teamInfo(team).abbr}.png`, import.meta.url);
  if (!existsSync(file)) return null;
  const img = await loadImage(readFileSync(file));
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, img.width, img.height).data;
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (px[(y * img.width + x) * 4 + 3] > 16) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { img, sx: x0, sy: y0, sw: x1 - x0 + 1, sh: y1 - y0 + 1 };
}
const logos = await Promise.all(ring.map(logo));

/**
 * Drawn size of team i's mark for a nominal size `s`. Logos are scaled to equal visual area, so a
 * wide wordmark and a tall letter read as the same weight, then capped so neither gets huge.
 */
function markSize(i: number, s: number): { w: number; h: number } {
  const l = logos[i];
  if (!l) return { w: s * 0.84, h: s * 0.84 };
  const k = Math.min((s * 0.76) / Math.sqrt(l.sw * l.sh), (s * 1.1) / l.sw, (s * 0.92) / l.sh);
  return { w: l.sw * k, h: l.sh * k };
}

function font(ctx: SKRSContext2D, weight: number, size: number) {
  ctx.font = `${weight} ${size}px "${FONT}"`;
}

/** Largest font size (up to `max`) at which `text` fits in `width`. */
function fit(ctx: SKRSContext2D, text: string, weight: number, max: number, width: number): number {
  font(ctx, weight, max);
  return Math.min(max, Math.floor((max * width) / ctx.measureText(text).width));
}

function drawTeam(ctx: SKRSContext2D, i: number, x: number, y: number, s: number) {
  const l = logos[i];
  if (l) {
    const { w, h } = markSize(i, s);
    ctx.drawImage(l.img, l.sx, l.sy, l.sw, l.sh, x - w / 2, y - h / 2, w, h);
    return;
  }
  const t = teamInfo(ring[i]);
  const r = s * 0.42;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = t.color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  font(ctx, 800, r * (t.abbr.length > 3 ? 0.62 : 0.8));
  ctx.fillStyle = t.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t.abbr, x, y + 2);
}

/** Logos around a circle, clockwise from 12 o'clock, with a curved arrow and score from each winner to its victim. */
function drawRing(ctx: SKRSContext2D, cx: number, cy: number, R: number, maxLogo: number, labelSize: number) {
  const step = (2 * Math.PI) / n;
  const angle = (i: number) => -Math.PI / 2 + step * i;
  const s = Math.min(maxLogo, 2 * R * Math.sin(Math.PI / n) * 0.62);
  // Angular room each mark takes up along the ring, so arrows stop short of wide logos too.
  const half = ring.map((_, i) => {
    const { w, h } = markSize(i, s);
    const a = angle(i);
    return (Math.abs(Math.sin(a)) * w + Math.abs(Math.cos(a)) * h) / 2;
  });
  const head = labelSize * 0.34;
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = Math.max(3, labelSize / 9);
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a0 = angle(i) + (half[i] + 10) / R;
    const a1 = angle(i + 1) - (half[(i + 1) % n] + 10) / R;
    ctx.beginPath();
    ctx.arc(cx, cy, R, a0, a1 - head / R);
    ctx.stroke();
    // Arrowhead pointing along the clockwise tangent at a1.
    const px = cx + R * Math.cos(a1);
    const py = cy + R * Math.sin(a1);
    const tx = -Math.sin(a1);
    const ty = Math.cos(a1);
    const nx = Math.cos(a1);
    const ny = Math.sin(a1);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - tx * head * 1.6 + nx * head * 0.75, py - ty * head * 1.6 + ny * head * 0.75);
    ctx.lineTo(px - tx * head * 1.6 - nx * head * 0.75, py - ty * head * 1.6 - ny * head * 0.75);
    ctx.closePath();
    ctx.fill();
    // Push each score outward far enough that its box clears the arrow, wider text going further.
    const mid = angle(i) + step / 2;
    font(ctx, 800, labelSize);
    const tw = ctx.measureText(labels[i]).width / 2;
    const lr = R + 14 + Math.abs(Math.cos(mid)) * tw + Math.abs(Math.sin(mid)) * labelSize * 0.5;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labels[i], cx + lr * Math.cos(mid), cy + lr * Math.sin(mid));
  }
  ring.forEach((_, i) => drawTeam(ctx, i, cx + R * Math.cos(angle(i)), cy + R * Math.sin(angle(i)), s));
  return s;
}

function post(): Buffer {
  const W = 1080;
  const c = createCanvas(W, W);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, W);
  const cy = 520;
  const R = 366;
  const s = drawRing(ctx, W / 2, cy, R, 132, 40);
  const inner = 2 * (R - s / 2 - 24);

  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  font(ctx, 800, fit(ctx, 'SEC', 800, 170, inner * 0.6));
  ctx.fillText('SEC', W / 2, cy - 4);
  font(ctx, 800, fit(ctx, 'CIRCLE OF SUCK', 800, 88, inner * 0.92));
  ctx.fillText('CIRCLE OF SUCK', W / 2, cy + 78);

  font(ctx, 700, 26);
  ctx.fillStyle = GRAY;
  ctx.textAlign = 'left';
  ctx.fillText(`2026 · THROUGH WEEK ${week} · ${lastDate.toUpperCase()}`, 40, W - 34);
  ctx.textAlign = 'right';
  ctx.fillText(SITE, W - 40, W - 34);
  return c.toBuffer('image/png');
}

function preview(): Buffer {
  const W = 1200;
  const H = 630;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  drawRing(ctx, 862, 318, 214, 86, 27);
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  font(ctx, 800, 150);
  ctx.fillText('SEC', 64, 220);
  font(ctx, 800, 96);
  ctx.fillText('CIRCLE', 64, 320);
  ctx.fillText('OF SUCK', 64, 410);
  font(ctx, 700, 28);
  ctx.fillStyle = GRAY;
  ctx.fillText(`2026 · THROUGH WEEK ${week}`, 64, 470);
  font(ctx, 700, 22);
  ctx.fillText(SITE, 64, H - 44);
  return c.toBuffer('image/png');
}

if (!n) {
  console.log('No circle yet; skipping render.');
} else {
  writeFileSync(new URL('../public/circle.png', import.meta.url), post());
  writeFileSync(new URL('../public/og.png', import.meta.url), preview());
  console.log(`Rendered a ${n}-team circle with ${logos.filter(Boolean).length} logos.`);
}
