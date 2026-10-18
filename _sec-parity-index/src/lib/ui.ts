import { teamInfo } from '../data/teams';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: string | number) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

/** Flat school-color disc with a 1px ink border, as inline SVG. */
export function disc(team: string, size = 28): string {
  const t = teamInfo(team);
  const fs = Math.max(6, +(size * (t.abbr.length > 3 ? 0.25 : t.abbr.length > 2 ? 0.3 : 0.36)).toFixed(1));
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true" class="shrink-0">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 0.5}" fill="${t.color}" stroke="#141413" stroke-width="1"/>
    <text x="50%" y="50%" dy="0.36em" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="${fs}" fill="${t.ink}">${esc(t.abbr)}</text>
  </svg>`;
}

export const score = (a: number, b: number) => `${a}&ndash;${b}`;
