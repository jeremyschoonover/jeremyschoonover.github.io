export interface RingNode { x: number; y: number }
export interface RingArrow { x1: number; y1: number; x2: number; y2: number; lx: number; ly: number; angle: number }
export interface RingLayout { r: number; nodes: RingNode[]; arrows: RingArrow[]; showLabels: boolean }

/** Clockwise ring starting at 12 o'clock; arrows run from each team to the next (winner -> loser). */
export function ringLayout(n: number, cx: number, cy: number, R: number): RingLayout {
  const chord = n > 1 ? 2 * R * Math.sin(Math.PI / n) : R;
  const r = Math.max(7, Math.min(R * 0.135, chord * 0.3));
  const nodes = Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  const gap = r + Math.max(3, r * 0.18);
  const arrows = nodes.map((p, i) => {
    const q = nodes[(i + 1) % n];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const mx = (p.x + q.x) / 2;
    const my = (p.y + q.y) / 2;
    const ox = mx - cx;
    const oy = my - cy;
    const ol = Math.hypot(ox, oy) || 1;
    const push = r * 0.75 + 10;
    return {
      x1: p.x + ux * gap, y1: p.y + uy * gap, x2: q.x - ux * gap, y2: q.y - uy * gap,
      lx: mx + (ox / ol) * push, ly: my + (oy / ol) * push, angle: Math.atan2(dy, dx),
    };
  });
  return { r, nodes, arrows, showLabels: chord > 70 };
}
