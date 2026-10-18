/**
 * Render the circle as a social post. Runs before every build and writes:
 *   public/circle.png          1080x1350, the page image and the file people save and share
 *   public/og.png              1200x630, the link preview
 *   public/apple-touch-icon.png 180x180, the home-screen icon
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createCanvas, GlobalFonts, type Image, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import { teamInfo } from '../src/data/teams';
import type { Dataset } from '../src/lib/data';
import { info, LEAGUE, longDate, SITE } from '../src/site';

const FONT = 'Barlow Condensed';
const INK = '#111111';
const GRAY = '#6B6B6B';
const LIGHT = '#9A9A9A';

const require = createRequire(import.meta.url);
for (const w of [600, 700, 800]) {
  GlobalFonts.registerFromPath(require.resolve(`@fontsource/barlow-condensed/files/barlow-condensed-latin-${w}-normal.woff2`), FONT);
}

const data = JSON.parse(readFileSync(new URL('../data/games-2026.json', import.meta.url), 'utf8')) as Dataset;
const { a, week, lastGame, results, outside } = info(data);
const ring = a.cycle;
const n = ring.length;

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
const logos = new Map<string, Logo | null>();
for (const t of a.teams) logos.set(t, await logo(t));

/**
 * Drawn size of a team's mark for a nominal size `s`. Logos are scaled to equal visual area, so a
 * wide wordmark and a tall letter read as the same weight, then capped so neither gets huge.
 */
function markSize(team: string, s: number): { w: number; h: number } {
  const l = logos.get(team);
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

function drawTeam(ctx: SKRSContext2D, team: string, x: number, y: number, s: number) {
  const l = logos.get(team);
  if (l) {
    const { w, h } = markSize(team, s);
    ctx.drawImage(l.img, l.sx, l.sy, l.sw, l.sh, x - w / 2, y - h / 2, w, h);
    return;
  }
  // No logo on file: a flat school-color disc with the abbreviation.
  const t = teamInfo(team);
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
  // Room each mark takes up along the ring, so arrows stop short of wide logos too.
  const half = ring.map((t, i) => {
    const { w, h } = markSize(t, s);
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
    const tw = ctx.measureText(results[i].score).width / 2;
    const lr = R + 14 + Math.abs(Math.cos(mid)) * tw + Math.abs(Math.sin(mid)) * labelSize * 0.5;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(results[i].score, cx + lr * Math.cos(mid), cy + lr * Math.sin(mid));
  }
  ring.forEach((t, i) => drawTeam(ctx, t, cx + R * Math.cos(angle(i)), cy + R * Math.sin(angle(i)), s));
  return s;
}

/** Centered row(s) of the teams that didn't make the ring. */
function drawOutside(ctx: SKRSContext2D, W: number, top: number) {
  ctx.fillStyle = GRAY;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  font(ctx, 700, 28);
  ctx.save();
  ctx.letterSpacing = '3px';
  ctx.fillText(outside.length ? 'NOT IN THE CIRCLE' : 'EVERY TEAM IS IN THE CIRCLE', W / 2, top);
  ctx.restore();
  if (!outside.length) return;
  const perRow = Math.min(outside.length, 8);
  const rows = Math.ceil(outside.length / perRow);
  const s = Math.min(92, (W - 200) / perRow - 24);
  const gap = s + 28;
  outside.forEach((t, i) => {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, outside.length - row * perRow);
    const x = W / 2 + (i % perRow - (inRow - 1) / 2) * gap;
    const y = top + 30 + s / 2 + row * (s + 16) + (rows > 1 ? 0 : 6);
    drawTeam(ctx, t, x, y, s);
  });
}

function watermark(ctx: SKRSContext2D, W: number, y: number) {
  font(ctx, 600, 21);
  ctx.fillStyle = LIGHT;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText(`${LEAGUE.season} · THROUGH WEEK ${week} · ${longDate(lastGame).toUpperCase()}`, 40, y);
  ctx.textAlign = 'right';
  ctx.fillText(SITE.display, W - 40, y);
}

function post(): Buffer {
  const W = 1080;
  const H = 1350;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  const cy = 528;
  const R = 366;
  const s = drawRing(ctx, W / 2, cy, R, 132, 40);
  const inner = 2 * (R - s / 2 - 24);
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  font(ctx, 800, fit(ctx, LEAGUE.name, 800, 170, inner * 0.6));
  ctx.fillText(LEAGUE.name, W / 2, cy - 4);
  font(ctx, 800, fit(ctx, 'CIRCLE OF SUCK', 800, 88, inner * 0.92));
  ctx.fillText('CIRCLE OF SUCK', W / 2, cy + 78);
  ctx.fillStyle = '#E5E5E5';
  ctx.fillRect(80, 1036, W - 160, 2);
  drawOutside(ctx, W, 1100);
  watermark(ctx, W, H - 34);
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
  ctx.fillText(LEAGUE.name, 64, 220);
  font(ctx, 800, 96);
  ctx.fillText('CIRCLE', 64, 320);
  ctx.fillText('OF SUCK', 64, 410);
  font(ctx, 700, 28);
  ctx.fillStyle = GRAY;
  ctx.fillText(`${LEAGUE.season} · THROUGH WEEK ${week}`, 64, 470);
  font(ctx, 600, 21);
  ctx.fillStyle = LIGHT;
  ctx.fillText(SITE.display, 64, H - 44);
  return c.toBuffer('image/png');
}

/** Home-screen icon: a black ring running clockwise into an arrowhead, matching the favicon. */
function icon(): Buffer {
  const S = 180;
  const R = 56;
  const c = createCanvas(S, S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, S, S);
  const a0 = -Math.PI / 2 + 0.2;
  const a1 = -Math.PI / 2 - 0.75 + 2 * Math.PI;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, R, a0, a1);
  ctx.stroke();
  // Arrowhead continuing clockwise from a1.
  const tip = a1 + 0.62;
  const tx = -Math.sin(a1);
  const ty = Math.cos(a1);
  const nx = Math.cos(a1);
  const ny = Math.sin(a1);
  const bx = S / 2 + R * nx;
  const by = S / 2 + R * ny;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(S / 2 + R * Math.cos(tip), S / 2 + R * Math.sin(tip));
  ctx.lineTo(bx + nx * 22 - tx * 2, by + ny * 22 - ty * 2);
  ctx.lineTo(bx - nx * 22 - tx * 2, by - ny * 22 - ty * 2);
  ctx.closePath();
  ctx.fill();
  return c.toBuffer('image/png');
}

writeFileSync(new URL('../public/apple-touch-icon.png', import.meta.url), icon());
if (!n) {
  console.log('No circle yet; skipping the post image.');
} else {
  writeFileSync(new URL('../public/circle.png', import.meta.url), post());
  writeFileSync(new URL('../public/og.png', import.meta.url), preview());
  const withLogos = a.teams.filter((t) => logos.get(t)).length;
  console.log(`Rendered a ${n}-team circle (${outside.length} outside) with ${withLogos}/${a.teams.length} logos.`);
}
