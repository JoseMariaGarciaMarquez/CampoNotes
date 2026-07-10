let _id = 0;
export function uid(): string {
  return `id_${++_id}`;
}

export function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function angle(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
}

export function projectPointOnLine(
  px: number, py: number,
  x1: number, y1: number, x2: number, y2: number
): { x: number; y: number; t: number; dist: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: x1, y: y1, t: 0, dist: dist(px, py, x1, y1) };
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const ix = x1 + t * dx;
  const iy = y1 + t * dy;
  return { x: ix, y: iy, t, dist: dist(px, py, ix, iy) };
}

export function parallelLineData(
  x1: number, y1: number, x2: number, y2: number,
  px: number, py: number
): { x1: number; y1: number; x2: number; y2: number; distance: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { x1, y1, x2, y2, distance: 0 };

  const ux = -dy / len;
  const uy = dx / len;

  const t = ((px - x1) * dx + (py - y1) * dy) / (len * len);
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  const d = (px - closestX) * ux + (py - closestY) * uy;

  return {
    x1: x1 + d * ux,
    y1: y1 + d * uy,
    x2: x2 + d * ux,
    y2: y2 + d * uy,
    distance: Math.abs(d),
  };
}

export function perpendicularLineData(
  x1: number, y1: number, x2: number, y2: number,
  px: number, py: number,
  halfLen: number = 60
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { x1: px - halfLen, y1: py, x2: px + halfLen, y2: py };

  const t = ((px - x1) * dx + (py - y1) * dy) / (len * len);
  const ix = x1 + t * dx;
  const iy = y1 + t * dy;
  const ux = -dy / len;
  const uy = dx / len;

  return {
    x1: ix - halfLen * ux,
    y1: iy - halfLen * uy,
    x2: ix + halfLen * ux,
    y2: iy + halfLen * uy,
  };
}

export function pointToLineDist(
  px: number, py: number,
  x1: number, y1: number, x2: number, y2: number
): number {
  return projectPointOnLine(px, py, x1, y1, x2, y2).dist;
}

export function hitTestLine(
  px: number, py: number,
  x1: number, y1: number, x2: number, y2: number,
  threshold: number = 8
): boolean {
  return pointToLineDist(px, py, x1, y1, x2, y2) <= threshold;
}

export function bearing(angleDeg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(((angleDeg + 180) % 360) / 45) % 8;
  return dirs[idx];
}
