import type { Column, Item, Opening, Room, Vec2 } from '../types';

export const uid = (): string => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);

export const DEG = Math.PI / 180;
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const round1 = (v: number) => Math.round(v * 10) / 10;

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const len = (a: Vec2): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Signed area; positive when the outline is clockwise in plan (y-down) coordinates. */
export function signedArea(pts: Vec2[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export function ensureClockwise(pts: Vec2[]): Vec2[] {
  return signedArea(pts) < 0 ? [...pts].reverse() : pts;
}

export function bounds(pts: Vec2[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

export function pointInPolygon(p: Vec2, pts: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 === 0) return dist(p, a);
  const t = clamp(dot(sub(p, a), ab) / l2, 0, 1);
  return dist(p, add(a, mul(ab, t)));
}

/** Distance from p to the polygon boundary (0 if on it). */
export function distToPolygon(p: Vec2, pts: Vec2[]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) best = Math.min(best, distToSegment(p, pts[i], pts[(i + 1) % pts.length]));
  return best;
}

// ---------- Walls ----------
export interface Wall {
  i: number;
  a: Vec2;
  b: Vec2;
  len: number;
  /** unit direction a → b */
  dir: Vec2;
  /** unit normal pointing into the room */
  n: Vec2;
  /** degrees, equals the rot of an item standing against this wall */
  angle: number;
}

export function getWalls(room: Room): Wall[] {
  const pts = room.points;
  const walls: Wall[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const l = dist(a, b);
    const dir = l > 0 ? mul(sub(b, a), 1 / l) : { x: 1, y: 0 };
    walls.push({ i, a, b, len: l, dir, n: { x: -dir.y, y: dir.x }, angle: normAngle(Math.atan2(dir.y, dir.x) / DEG) });
  }
  return walls;
}

export function normAngle(a: number): number {
  let r = a % 360;
  if (r < 0) r += 360;
  if (Math.abs(r - 360) < 1e-6) r = 0;
  return Math.round(r * 1000) / 1000;
}

export function angleDiff(a: number, b: number): number {
  let d = Math.abs(normAngle(a) - normAngle(b));
  if (d > 180) d = 360 - d;
  return d;
}

export function wallPoint(w: Wall, t: number, inward = 0): Vec2 {
  return { x: w.a.x + w.dir.x * t + w.n.x * inward, y: w.a.y + w.dir.y * t + w.n.y * inward };
}

/** Whether the interior angle at the start corner of wall i is convex (a normal inside corner). */
export function cornerIsConvex(room: Room, i: number): boolean {
  const pts = room.points;
  const n = pts.length;
  const prev = pts[(i - 1 + n) % n];
  const cur = pts[i];
  const next = pts[(i + 1) % n];
  const cross = (cur.x - prev.x) * (next.y - cur.y) - (cur.y - prev.y) * (next.x - cur.x);
  return cross > 0;
}

// ---------- Items ----------
export function itemAxes(rot: number): { u: Vec2; f: Vec2 } {
  const r = rot * DEG;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { u: { x: c, y: s }, f: { x: -s, y: c } };
}

/** Corners in order: back-left, back-right, front-right, front-left. */
export function rectCorners(x: number, y: number, w: number, d: number, rot: number): Vec2[] {
  const { u, f } = itemAxes(rot);
  const hw = w / 2;
  const hd = d / 2;
  return [
    { x: x - u.x * hw - f.x * hd, y: y - u.y * hw - f.y * hd },
    { x: x + u.x * hw - f.x * hd, y: y + u.y * hw - f.y * hd },
    { x: x + u.x * hw + f.x * hd, y: y + u.y * hw + f.y * hd },
    { x: x - u.x * hw + f.x * hd, y: y - u.y * hw + f.y * hd },
  ];
}

export function itemCorners(it: Pick<Item, 'x' | 'y' | 'w' | 'd' | 'rot'>): Vec2[] {
  return rectCorners(it.x, it.y, it.w, it.d, it.rot);
}

export function verticalOverlap(a: Pick<Item, 'elev' | 'h'>, b: Pick<Item, 'elev' | 'h'>, tol = 0.5): boolean {
  return a.elev < b.elev + b.h - tol && b.elev < a.elev + a.h - tol;
}

/** Separating-axis test for two convex quads, with a small tolerance so touching items do not collide. */
export function quadsOverlap(A: Vec2[], B: Vec2[], tol = 0.5): boolean {
  for (const poly of [A, B]) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      const axis = { x: -(p2.y - p1.y), y: p2.x - p1.x };
      const l = len(axis);
      if (l === 0) continue;
      axis.x /= l;
      axis.y /= l;
      let minA = Infinity,
        maxA = -Infinity,
        minB = Infinity,
        maxB = -Infinity;
      for (const p of A) {
        const v = dot(p, axis);
        minA = Math.min(minA, v);
        maxA = Math.max(maxA, v);
      }
      for (const p of B) {
        const v = dot(p, axis);
        minB = Math.min(minB, v);
        maxB = Math.max(maxB, v);
      }
      if (maxA <= minB + tol || maxB <= minA + tol) return false;
    }
  }
  return true;
}

export interface WallAttachment {
  wall: Wall;
  /** offsets of the item's left / right edge from the wall start */
  t0: number;
  t1: number;
}

/** Find the wall an item stands against (back within `tol` cm of the wall and same orientation). */
export function itemWall(it: Item, walls: Wall[], tol = 4): WallAttachment | null {
  let best: WallAttachment | null = null;
  let bestD = Infinity;
  for (const w of walls) {
    if (angleDiff(w.angle, it.rot) > 1.5) continue;
    const rel = sub({ x: it.x, y: it.y }, w.a);
    const back = dot(rel, w.n) - it.d / 2;
    const t = dot(rel, w.dir);
    if (Math.abs(back) > tol) continue;
    if (t < -it.w / 2 || t > w.len + it.w / 2) continue;
    if (Math.abs(back) < bestD) {
      bestD = Math.abs(back);
      best = { wall: w, t0: t - it.w / 2, t1: t + it.w / 2 };
    }
  }
  return best;
}

export function placeOnWall(w: Wall, t0: number, width: number, depth: number): { x: number; y: number; rot: number } {
  const p = wallPoint(w, t0 + width / 2, depth / 2);
  return { x: round1(p.x), y: round1(p.y), rot: w.angle };
}

export function columnCorners(c: Column): Vec2[] {
  return rectCorners(c.x, c.y, c.w, c.d, 0);
}

interface Interval {
  a: number;
  b: number;
  soft?: boolean;
}

/**
 * Intervals along a wall that are occupied for an item of depth `depth` and vertical range [elev, elev+h].
 * Hard obstacles: other items and columns. Soft obstacles: door / window openings.
 */
export function wallObstacles(
  wall: Wall,
  room: Room,
  others: Item[],
  probe: { d: number; elev: number; h: number },
  includeOpenings = true,
): Interval[] {
  const out: Interval[] = [];
  const project = (corners: Vec2[]) => {
    let tmin = Infinity,
      tmax = -Infinity,
      nmin = Infinity,
      nmax = -Infinity;
    for (const c of corners) {
      const rel = sub(c, wall.a);
      const t = dot(rel, wall.dir);
      const n = dot(rel, wall.n);
      tmin = Math.min(tmin, t);
      tmax = Math.max(tmax, t);
      nmin = Math.min(nmin, n);
      nmax = Math.max(nmax, n);
    }
    return { tmin, tmax, nmin, nmax };
  };
  for (const o of others) {
    if (!verticalOverlap(o, probe)) continue;
    const p = project(itemCorners(o));
    if (p.nmax > 0.5 && p.nmin < probe.d - 0.5 && p.tmax > -0.5 && p.tmin < wall.len + 0.5) out.push({ a: p.tmin, b: p.tmax });
  }
  for (const c of room.columns) {
    const p = project(columnCorners(c));
    if (p.nmax > 0.5 && p.nmin < probe.d - 0.5 && p.tmax > -0.5 && p.tmin < wall.len + 0.5) out.push({ a: p.tmin, b: p.tmax });
  }
  if (includeOpenings) {
    const walls = getWalls(room);
    for (const op of room.openings) {
      const isDoor = op.type === 'door';
      if (!isDoor && !(probe.elev < op.sill + op.height - 0.5 && op.sill < probe.elev + probe.h - 0.5)) continue;
      if (op.wall === wall.i) {
        out.push({ a: op.offset, b: op.offset + op.width, soft: true });
        continue;
      }
      // openings on other walls: keep the area in front of them clear (matters next to corners)
      const ow = walls[op.wall];
      if (!ow) continue;
      const depth = isDoor ? 60 : 8;
      const c = wallPoint(ow, op.offset + op.width / 2, depth / 2);
      const p = project(rectCorners(c.x, c.y, op.width, depth, ow.angle));
      if (p.nmax > 0.5 && p.nmin < probe.d - 0.5 && p.tmax > 0.5 && p.tmin < wall.len - 0.5) out.push({ a: p.tmin, b: p.tmax, soft: true });
    }
  }
  return out;
}

export interface SnapResult {
  x: number;
  y: number;
  rot: number;
  wall: number | null;
}

/**
 * Magnetic placement: pull the item to the nearest wall (back against it, rotated to face the room),
 * then slide it flush against neighbours / corners. Away from walls the item moves freely and aligns to
 * parallel neighbours.
 */
export function snapItem(it: Item, pos: Vec2, room: Room, others: Item[], magnet = 10): SnapResult {
  const walls = getWalls(room);
  let bestWall: Wall | null = null;
  let bestScore = Infinity;
  for (const w of walls) {
    const rel = sub(pos, w.a);
    const t = dot(rel, w.dir);
    const n = dot(rel, w.n);
    if (t < -15 || t > w.len + 15) continue;
    // a unit the user turned by hand only snaps to walls it already faces
    if (it.opts.freeRot && angleDiff(w.angle, it.rot) > 1) continue;
    // when the item already faces this wall its depth is `d`; otherwise use the smaller of w/d as the reach
    const reach = it.d / 2 + 28;
    if (n < -40 || n > reach) continue;
    const score = Math.abs(n - it.d / 2) + (angleDiff(w.angle, it.rot) > 1 ? 6 : 0);
    if (score < bestScore) {
      bestScore = score;
      bestWall = w;
    }
  }

  if (bestWall) {
    const w = bestWall;
    let t = dot(sub(pos, w.a), w.dir);
    const lo = it.w / 2;
    const hi = w.len - it.w / 2;
    t = hi >= lo ? clamp(t, lo, hi) : w.len / 2;
    const obs = wallObstacles(w, room, others, it);
    // 1) push out of hard obstacles
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const o of obs) {
        if (o.soft) continue;
        const a = t - it.w / 2;
        const b = t + it.w / 2;
        if (a < o.b - 0.2 && b > o.a + 0.2) {
          const left = o.a - it.w / 2;
          const right = o.b + it.w / 2;
          const candidates = [left, right].filter((c) => c >= lo - 0.01 && c <= hi + 0.01);
          if (candidates.length) {
            candidates.sort((p, q) => Math.abs(p - t) - Math.abs(q - t));
            t = candidates[0];
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
    // 2) magnet to neighbour edges, opening edges and corners
    let bestT = t;
    let bestD = magnet;
    const consider = (c: number) => {
      if (c < lo - 0.01 || c > hi + 0.01) return;
      const dd = Math.abs(c - t);
      if (dd < bestD) {
        bestD = dd;
        bestT = c;
      }
    };
    consider(lo);
    consider(hi);
    for (const o of obs) {
      consider(o.b + it.w / 2);
      consider(o.a - it.w / 2);
    }
    t = bestT;
    const p = wallPoint(w, t, it.d / 2);
    return { x: round1(p.x), y: round1(p.y), rot: w.angle, wall: w.i };
  }

  // Free placement: align with parallel neighbours
  let { x, y } = pos;
  const { u, f } = itemAxes(it.rot);
  let bestU = magnet;
  let bestF = magnet;
  let du = 0;
  let df = 0;
  const myU = dot(pos, u);
  const myF = dot(pos, f);
  for (const o of others) {
    if (!verticalOverlap(o, it)) continue;
    const ad = angleDiff(o.rot, it.rot);
    if (!(ad < 1 || Math.abs(ad - 180) < 1 || Math.abs(ad - 90) < 1)) continue;
    const cs = itemCorners(o);
    let umin = Infinity,
      umax = -Infinity,
      fmin = Infinity,
      fmax = -Infinity;
    for (const c of cs) {
      const cu = dot(c, u);
      const cf = dot(c, f);
      umin = Math.min(umin, cu);
      umax = Math.max(umax, cu);
      fmin = Math.min(fmin, cf);
      fmax = Math.max(fmax, cf);
    }
    const nearF = myF + it.d / 2 > fmin - 30 && myF - it.d / 2 < fmax + 30;
    const nearU = myU + it.w / 2 > umin - 30 && myU - it.w / 2 < umax + 30;
    if (nearF) {
      for (const c of [umax + it.w / 2, umin - it.w / 2, umin + it.w / 2, umax - it.w / 2]) {
        const dd = Math.abs(c - myU);
        if (dd < bestU) {
          bestU = dd;
          du = c - myU;
        }
      }
    }
    if (nearU) {
      for (const c of [fmin + it.d / 2, fmax - it.d / 2, fmax + it.d / 2, fmin - it.d / 2]) {
        const dd = Math.abs(c - myF);
        if (dd < bestF) {
          bestF = dd;
          df = c - myF;
        }
      }
    }
  }
  x += u.x * du + f.x * df;
  y += u.y * du + f.y * df;
  // rotated units: bring the nearest edge flush with a wall
  const cs = rectCorners(x, y, it.w, it.d, it.rot);
  for (const w of walls) {
    let nmin = Infinity;
    let tmin = Infinity;
    let tmax = -Infinity;
    for (const c of cs) {
      const rel = sub(c, w.a);
      nmin = Math.min(nmin, dot(rel, w.n));
      tmin = Math.min(tmin, dot(rel, w.dir));
      tmax = Math.max(tmax, dot(rel, w.dir));
    }
    if (tmax > 0 && tmin < w.len && Math.abs(nmin) < magnet + 6) {
      x -= w.n.x * nmin;
      y -= w.n.y * nmin;
      for (const c of cs) {
        c.x -= w.n.x * nmin;
        c.y -= w.n.y * nmin;
      }
    }
  }
  return { x: round1(x), y: round1(y), rot: it.rot, wall: null };
}

/** Ids of items that overlap another item, leave the room, or block an opening. */
export function findProblems(items: Item[], room: Room): Map<string, 'overlap' | 'outside' | 'opening'> {
  const res = new Map<string, 'overlap' | 'outside' | 'opening'>();
  const walls = getWalls(room);
  const quads = items.map((it) => itemCorners(it));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (!verticalOverlap(items[i], items[j], 1)) continue;
      if (quadsOverlap(quads[i], quads[j], 0.6)) {
        res.set(items[i].id, 'overlap');
        res.set(items[j].id, 'overlap');
      }
    }
  }
  items.forEach((it, i) => {
    if (res.has(it.id)) return;
    const centerIn = pointInPolygon({ x: it.x, y: it.y }, room.points);
    const cornerOut = quads[i].some((c) => !pointInPolygon(c, room.points) && distToPolygon(c, room.points) > 1.5);
    if (!centerIn || cornerOut) {
      res.set(it.id, 'outside');
      return;
    }
    for (const col of room.columns) {
      if (quadsOverlap(quads[i], columnCorners(col), 0.6)) {
        res.set(it.id, 'overlap');
        return;
      }
    }
    for (const op of room.openings) {
      const w = walls[op.wall];
      if (!w) continue;
      const isDoor = op.type === 'door';
      if (!isDoor && !(it.elev < op.sill + op.height - 0.5 && op.sill < it.elev + it.h - 0.5)) continue;
      const depth = isDoor ? 30 : 8;
      const c = wallPoint(w, op.offset + op.width / 2, depth / 2);
      const zone = rectCorners(c.x, c.y, op.width, depth, w.angle);
      if (quadsOverlap(quads[i], zone, 0.6)) {
        res.set(it.id, 'opening');
        return;
      }
    }
  });
  return res;
}

/** First free stretch of `width` on any wall for an item of the given depth / vertical range. */
export function findFreeSpot(
  room: Room,
  items: Item[],
  probe: { w: number; d: number; elev: number; h: number },
  preferWall?: number,
  preferAfter?: number,
): { x: number; y: number; rot: number } | null {
  const walls = getWalls(room);
  const order = [...walls].sort((a, b) => {
    if (preferWall !== undefined) {
      if (a.i === preferWall) return -1;
      if (b.i === preferWall) return 1;
    }
    return b.len - a.len;
  });
  for (const w of order) {
    if (w.len < probe.w) continue;
    const obs = wallObstacles(w, room, items, probe)
      .map((o) => ({ a: Math.max(0, o.a), b: Math.min(w.len, o.b) }))
      .filter((o) => o.b > o.a)
      .sort((p, q) => p.a - q.a);
    const tryAt = (start: number): number | null => {
      let t = start;
      for (let guard = 0; guard < 50; guard++) {
        if (t + probe.w > w.len + 0.01) return null;
        const hit = obs.find((o) => t < o.b - 0.2 && t + probe.w > o.a + 0.2);
        if (!hit) return t;
        t = hit.b;
      }
      return null;
    };
    let t: number | null = null;
    if (preferWall === w.i && preferAfter !== undefined) t = tryAt(preferAfter);
    if (t === null) t = tryAt(0);
    if (t !== null) return placeOnWall(w, t, probe.w, probe.d);
  }
  return null;
}

/** Inner free intervals of a wall (complement of obstacles). */
export function freeIntervals(len: number, obstacles: { a: number; b: number }[]): { a: number; b: number }[] {
  const obs = obstacles
    .map((o) => ({ a: clamp(o.a, 0, len), b: clamp(o.b, 0, len) }))
    .filter((o) => o.b - o.a > 0.01)
    .sort((p, q) => p.a - q.a);
  const out: { a: number; b: number }[] = [];
  let cur = 0;
  for (const o of obs) {
    if (o.a > cur + 0.01) out.push({ a: cur, b: o.a });
    cur = Math.max(cur, o.b);
  }
  if (cur < len - 0.01) out.push({ a: cur, b: len });
  return out;
}

export function roomArea(room: Room): number {
  return Math.abs(signedArea(room.points)) / 10000; // m²
}

export function roomPerimeter(room: Room): number {
  return getWalls(room).reduce((s, w) => s + w.len, 0);
}

export function openingCenter(op: Opening, walls: Wall[]): Vec2 {
  const w = walls[op.wall];
  return wallPoint(w, op.offset + op.width / 2);
}

/** Room outline presets. */
export function rectRoom(w: number, d: number): Vec2[] {
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: d },
    { x: 0, y: d },
  ];
}

/** L-shaped room: full size w × d with a notch (cw × cd) cut from the bottom-right corner. */
export function lRoom(w: number, d: number, cw: number, cd: number): Vec2[] {
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: d - cd },
    { x: w - cw, y: d - cd },
    { x: w - cw, y: d },
    { x: 0, y: d },
  ];
}

/** U / T-like room: rectangle with a notch (cw × cd) cut from the middle of the bottom wall. */
export function uRoom(w: number, d: number, cw: number, cd: number): Vec2[] {
  const x0 = (w - cw) / 2;
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: d },
    { x: x0 + cw, y: d },
    { x: x0 + cw, y: d - cd },
    { x: x0, y: d - cd },
    { x: x0, y: d },
    { x: 0, y: d },
  ];
}

/**
 * Change the length of wall `i` by moving every vertex that lies at or beyond the wall's end
 * (measured along the wall direction). Returns the new points and the shift to apply to items past that line.
 */
export function resizeWall(room: Room, i: number, newLen: number): { points: Vec2[]; shift: Vec2; threshold: number; dir: Vec2 } {
  const walls = getWalls(room);
  const w = walls[i];
  const delta = newLen - w.len;
  const endProj = dot(w.b, w.dir);
  const shift = mul(w.dir, delta);
  const points = room.points.map((p) => (dot(p, w.dir) >= endProj - 0.01 ? add(p, shift) : p));
  return { points, shift, threshold: endProj, dir: w.dir };
}
