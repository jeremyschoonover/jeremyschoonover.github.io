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
const { a, week, lastGame, results, branch, rest } = info(data);
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

/**
 * Logos around a circle, clockwise, with a curved arrow and score from each winner to its victim.
 * `start` is the canvas angle of ring[0] (default 12 o'clock).
 */
function drawRing(ctx: SKRSContext2D, cx: number, cy: number, R: number, maxLogo: number, labelSize: number, start = -Math.PI / 2) {
  const step = (2 * Math.PI) / n;
  const angle = (i: number) => start + step * i;
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
    // Push each score outward until its box clears the arrow and both neighboring logos.
    const mid = angle(i) + step / 2;
    font(ctx, 800, labelSize);
    const tw = ctx.measureText(results[i].score).width / 2;
    const th = labelSize * 0.42;
    const boxes = [i, (i + 1) % n].map((j) => {
      const { w, h } = markSize(ring[j], s);
      const x = cx + R * Math.cos(angle(j));
      const y = cy + R * Math.sin(angle(j));
      return { x0: x - w / 2 - 8, x1: x + w / 2 + 8, y0: y - h / 2 - 8, y1: y + h / 2 + 8 };
    });
    let lr = R + 14 + Math.abs(Math.cos(mid)) * tw + Math.abs(Math.sin(mid)) * th;
    for (let k = 0; k < 40; k++, lr += 3) {
      const x = cx + lr * Math.cos(mid);
      const y = cy + lr * Math.sin(mid);
      if (!boxes.some((b) => x + tw > b.x0 && x - tw < b.x1 && y + th > b.y0 && y - th < b.y1)) break;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(results[i].score, cx + lr * Math.cos(mid), cy + lr * Math.sin(mid));
  }
  ring.forEach((t, i) => drawTeam(ctx, t, cx + R * Math.cos(angle(i)), cy + R * Math.sin(angle(i)), s));
  return s;
}

function arrowTo(ctx: SKRSContext2D, x1: number, y1: number, x2: number, y2: number, head: number) {
  const ux = (x2 - x1) / Math.hypot(x2 - x1, y2 - y1);
  const uy = (y2 - y1) / Math.hypot(x2 - x1, y2 - y1);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - ux * head, y2 - uy * head);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ux * head * 1.6 - uy * head * 0.75, y2 - uy * head * 1.6 + ux * head * 0.75);
  ctx.lineTo(x2 - ux * head * 1.6 + uy * head * 0.75, y2 - uy * head * 1.6 - ux * head * 0.75);
  ctx.closePath();
  ctx.fill();
}

/**
 * The branch grows out of its ring team at (ax, ay): an arrow straight down to the first team off
 * the ring, then the rest of the chain running right along `rowY`.
 */
function drawBranch(ctx: SKRSContext2D, W: number, ax: number, ay: number, anchorSize: number, rowY: number) {
  const teams = branch!.teams;
  const scores = branch!.results.map((r) => r.score);
  const m = teams.length - 1;
  const step = m > 1 ? Math.min(176, (W - 60 - ax - 44) / (m - 1)) : 0;
  const sm = Math.min(84, step ? step * 0.56 : 84);
  const label = Math.round(Math.max(26, sm * 0.42));
  const xs = teams.slice(1).map((_, i) => ax + i * step);
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';

  // The drop from the ring team.
  const top = ay + markSize(teams[0], anchorSize).h / 2 + 12;
  const bottom = rowY - markSize(teams[1], sm).h / 2 - 12;
  arrowTo(ctx, ax, top, ax, bottom, 14);
  font(ctx, 800, 40);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(scores[0], ax - 18, (top + bottom) / 2);

  // Along the row.
  for (let i = 1; i < m; i++) {
    const xa = xs[i - 1] + markSize(teams[i], sm).w / 2 + 12;
    const xb = xs[i] - markSize(teams[i + 1], sm).w / 2 - 12;
    arrowTo(ctx, xa, rowY, xb, rowY, 12);
    font(ctx, 800, label);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(scores[i], (xa + xb) / 2, rowY - 14);
  }
  teams.slice(1).forEach((t, i) => drawTeam(ctx, t, xs[i], rowY, sm));
}

/** Anyone on neither the ring nor the branch, as a small captioned row. */
function drawRest(ctx: SKRSContext2D, W: number, y: number) {
  const sm = 52;
  const gap = 74;
  font(ctx, 700, 22);
  ctx.save();
  ctx.letterSpacing = '2px';
  const caption = 'THE REST';
  const cw = ctx.measureText(caption).width + 28;
  const total = cw + gap * (rest.length - 1) + sm;
  let x = W / 2 - total / 2;
  ctx.fillStyle = GRAY;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(caption, x, y);
  ctx.restore();
  x += cw + sm / 2;
  rest.forEach((t, i) => drawTeam(ctx, t, x + i * gap, y, sm));
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

/** Shown until some loop of results exists (early season): the title and an honest "not yet". */
function noCircle(ctx: SKRSContext2D, cx: number, cy: number, maxW: number) {
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  font(ctx, 800, fit(ctx, LEAGUE.name, 800, 170, maxW * 0.5));
  ctx.fillText(LEAGUE.name, cx, cy - 90);
  font(ctx, 800, fit(ctx, 'CIRCLE OF SUCK', 800, 88, maxW));
  ctx.fillText('CIRCLE OF SUCK', cx, cy - 6);
  font(ctx, 800, fit(ctx, 'NOT YET', 800, 120, maxW));
  ctx.fillStyle = '#C8C8C8';
  ctx.fillText('NOT YET', cx, cy + 120);
  font(ctx, 700, 30);
  ctx.fillStyle = GRAY;
  ctx.fillText('Every chain of wins still runs one way.', cx, cy + 180);
}

/** Canvas angle where the branch's ring team sits: lower left, so the branch can drop and run right. */
const ANCHOR_ANGLE = (130 * Math.PI) / 180;

/** Rotation that puts the branch's ring team at ANCHOR_ANGLE (or the leader at 12 o'clock). */
function ringStart(): number {
  if (!branch) return -Math.PI / 2;
  return ANCHOR_ANGLE - ((2 * Math.PI) / n) * ring.indexOf(branch.teams[0]);
}

function post(): Buffer {
  const W = 1080;
  const H = 1350;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  if (!n) {
    noCircle(ctx, W / 2, H / 2 - 60, 700);
    watermark(ctx, W, H - 34);
    return c.toBuffer('image/png');
  }

  // With a branch the circle sits higher to leave room underneath; alone, it's centered.
  const cx = W / 2;
  const cy = branch ? 544 : rest.length ? 560 : 610;
  const R = branch ? 360 : 380;
  const start = ringStart();
  const s = drawRing(ctx, cx, cy, R, 132, 40, start);
  const inner = 2 * (R - s / 2 - 24);
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  font(ctx, 800, fit(ctx, LEAGUE.name, 800, 170, inner * 0.6));
  ctx.fillText(LEAGUE.name, cx, cy - 4);
  font(ctx, 800, fit(ctx, 'CIRCLE OF SUCK', 800, 88, inner * 0.92));
  ctx.fillText('CIRCLE OF SUCK', cx, cy + 78);

  if (branch) drawBranch(ctx, W, cx + R * Math.cos(ANCHOR_ANGLE), cy + R * Math.sin(ANCHOR_ANGLE), s, 1150);
  if (rest.length) drawRest(ctx, W, branch ? 1250 : 1200);
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
  if (!n) {
    noCircle(ctx, W / 2, H / 2 - 20, 640);
    return c.toBuffer('image/png');
  }
  drawRing(ctx, 862, 318, 214, 86, 27, ringStart());
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
writeFileSync(new URL('../public/circle.png', import.meta.url), post());
writeFileSync(new URL('../public/og.png', import.meta.url), preview());
const withLogos = a.teams.filter((t) => logos.get(t)).length;
console.log(n
  ? `Rendered a ${n}-team circle${branch ? ` with a ${branch.teams.length - 1}-team branch off ${branch.teams[0]}` : ''}, ${rest.length} more, ${withLogos}/${a.teams.length} logos.`
  : 'No circle yet; rendered the "not yet" image.');
