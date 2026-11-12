import type { Item, ItemOptions, Room } from '../types';
import { BASE_D, CATALOG, createItem, WALL_D } from './catalog';
import { bounds, cornerIsConvex, freeIntervals, getWalls, itemCorners, placeOnWall, pointInPolygon, quadsOverlap, rectCorners, wallObstacles, type Wall } from './geometry';
import { L } from '../i18n';

export type LayoutStyle = 'auto' | 'I' | 'L' | 'U';

export interface AutoOptions {
  style: LayoutStyle;
  fridge: 'free' | 'builtin' | 'none';
  /** built-in hob (+ oven) or a freestanding cooker */
  cooking: 'builtin' | 'cooker';
  /** put the oven in a tall tower instead of under the hob */
  ovenTower: boolean;
  dishwasher: boolean;
  pantry: boolean;
  wallUnits: boolean;
  island: boolean;
}

export const DEFAULT_AUTO: AutoOptions = {
  style: 'auto',
  fridge: 'free',
  cooking: 'builtin',
  ovenTower: false,
  dishwasher: false,
  pantry: false,
  wallUnits: true,
  island: false,
};

export interface AutoResult {
  items: Item[];
  style: 'I' | 'L' | 'U';
  notes: string[];
}

interface Iv {
  a: number;
  b: number;
}

class Strip {
  blocked: Iv[];
  constructor(
    public wall: Wall,
    public a: number,
    public b: number,
    blocked: Iv[],
  ) {
    this.blocked = blocked.map((x) => ({ ...x }));
  }
  free(extra: Iv[] = []): Iv[] {
    const obs = [...this.blocked, ...extra, { a: -1e6, b: this.a }, { a: this.b, b: 1e6 }].map((o) => ({ a: o.a + 1e6, b: o.b + 1e6 }));
    return freeIntervals(2e6, obs).map((f) => ({ a: f.a - 1e6, b: f.b - 1e6 }));
  }
  /** Start offset for a piece of width w placed as close as possible to centre tc. */
  fit(tc: number, w: number, extra: Iv[] = []): number | null {
    let best: number | null = null;
    let bestD = Infinity;
    for (const f of this.free(extra)) {
      if (f.b - f.a < w - 0.01) continue;
      let t0 = Math.max(f.a, Math.min(f.b - w, tc - w / 2));
      // avoid leaving slivers that cannot hold a cabinet
      if (t0 - f.a < 30) t0 = f.a;
      else if (f.b - (t0 + w) < 30) t0 = f.b - w;
      const d = Math.abs(t0 + w / 2 - tc);
      if (d < bestD) {
        bestD = d;
        best = t0;
      }
    }
    return best;
  }
  take(t0: number, w: number) {
    this.blocked.push({ a: t0, b: t0 + w });
  }
  get length() {
    return this.b - this.a;
  }
}

const def = (key: string) => CATALOG.find((m) => m.key === key)!;

function baseFree(room: Room, wall: Wall): Iv[] {
  const obs = wallObstacles(wall, room, [], { d: BASE_D, elev: 0, h: 88 }).map((o) => ({ a: o.a - 4, b: o.b + 4 }));
  return freeIntervals(wall.len, obs);
}

export function autoLayout(room: Room, opts: AutoOptions): AutoResult {
  const walls = getWalls(room);
  const n = walls.length;
  const notes: string[] = [];
  const free = walls.map((w) => baseFree(room, w));
  const startFree = (i: number) => {
    const f = free[i][0];
    return f && f.a < 0.5 ? f.b - f.a : 0;
  };
  const endFree = (i: number) => {
    const f = free[i][free[i].length - 1];
    return f && f.b > walls[i].len - 0.5 ? f.b - f.a : 0;
  };
  const maxFree = (i: number) => free[i].reduce((m, f) => Math.max(m, f.b - f.a), 0);

  // ---- choose walls ----
  let bestI = 0;
  for (let i = 1; i < n; i++) if (maxFree(i) > maxFree(bestI)) bestI = i;

  let bestL = -1;
  let bestLScore = 0;
  let bestU = -1;
  let bestUScore = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const k = (i + 2) % n;
    if (!cornerIsConvex(room, j)) continue;
    if (endFree(i) >= 150 && startFree(j) >= BASE_D + 60) {
      const s = Math.min(endFree(i), 420) + Math.min(startFree(j), 420);
      if (s > bestLScore) {
        bestLScore = s;
        bestL = i;
      }
      const jFull = free[j].length === 1 && free[j][0].a < 0.5 && free[j][0].b > walls[j].len - 0.5;
      if (n >= 4 && jFull && walls[j].len >= 250 && cornerIsConvex(room, k) && startFree(k) >= BASE_D + 60) {
        const su = endFree(i) + walls[j].len + startFree(k);
        if (su > bestUScore) {
          bestUScore = su;
          bestU = i;
        }
      }
    }
  }

  let style: 'I' | 'L' | 'U';
  if (opts.style === 'auto') {
    const b = bounds(room.points);
    if (bestU >= 0 && Math.min(b.w, b.h) >= 280 && !opts.island) style = 'U';
    else if (bestL >= 0) style = 'L';
    else style = 'I';
  } else if (opts.style === 'U') {
    style = bestU >= 0 ? 'U' : bestL >= 0 ? 'L' : 'I';
    if (style !== 'U') notes.push(L('المساحة لا تسمح بتوزيع حرف U، تم اختيار أقرب توزيع مناسب.', 'The room cannot take a U layout; the closest layout was used.'));
  } else if (opts.style === 'L') {
    style = bestL >= 0 ? 'L' : 'I';
    if (style !== 'L') notes.push(L('لا يوجد ركن مناسب لتوزيع حرف L، تم استخدام توزيع خطي.', 'No suitable corner for an L layout; a straight layout was used.'));
  } else style = 'I';

  // ---- build the chain of runs ----
  interface Run {
    wall: Wall;
    a: number;
    b: number;
    cornerEnd: boolean;
    cornerStart: boolean;
  }
  const runs: Run[] = [];
  if (style === 'I') {
    const f = free[bestI].reduce((m, x) => (x.b - x.a > m.b - m.a ? x : m), { a: 0, b: 0 });
    runs.push({ wall: walls[bestI], a: f.a, b: f.b, cornerEnd: false, cornerStart: false });
  } else {
    const i0 = style === 'L' ? bestL : bestU;
    const count = style === 'L' ? 2 : 3;
    for (let r = 0; r < count; r++) {
      const wi = (i0 + r) % n;
      const w = walls[wi];
      const first = r === 0;
      const last = r === count - 1;
      const a = first ? w.len - endFree(wi) : BASE_D;
      const b = last ? startFree(wi) : w.len;
      runs.push({ wall: w, a, b, cornerEnd: !last, cornerStart: !first });
    }
  }

  const items: Item[] = [];
  const add = (key: string, wall: Wall, t0: number, w: number, over?: Partial<ItemOptions>, patch?: Partial<Item>): Item => {
    const d = def(key);
    const it = createItem(d, placeOnWall(wall, t0, w, d.d), w);
    if (over) it.opts = { ...it.opts, ...over };
    if (patch) Object.assign(it, patch);
    items.push(it);
    return it;
  };

  const baseStrips = runs.map((r) => new Strip(r.wall, r.a, r.b, wallObstacles(r.wall, room, [], { d: BASE_D, elev: 0, h: 88 }).map((o) => ({ a: o.a - 4, b: o.b + 4 }))));
  const wallStrips = runs.map(
    (r) =>
      new Strip(
        r.wall,
        r.cornerStart ? WALL_D : r.a,
        r.b,
        wallObstacles(r.wall, room, [], { d: WALL_D, elev: 146, h: 72 }).map((o) => ({ a: o.a - 2, b: o.b + 2 })),
      ),
  );
  const tallBlocked = (wall: Wall) => wallObstacles(wall, room, [], { d: BASE_D, elev: 0, h: 218 }).map((o) => ({ a: o.a - 4, b: o.b + 4 }));
  const windowsOn = (wall: Wall) => room.openings.filter((o) => o.wall === wall.i && o.type === 'window');

  // ---- corner units ----
  runs.forEach((r, ri) => {
    if (!r.cornerEnd) return;
    const s = baseStrips[ri];
    const w = Math.min(100, s.b - s.a);
    add('base_corner', r.wall, s.b - w, w, { blind: 'R', blindW: BASE_D, hinge: 'L' });
    s.take(s.b - w, w);
  });

  // ---- tall cluster (fridge / oven tower / pantry) ----
  const totalLen = baseStrips.reduce((s, x) => s + x.length, 0);
  const cluster: { key: string; w: number; tall: boolean }[] = [];
  if (opts.fridge === 'free') cluster.push({ key: 'app_fridge', w: 70, tall: true });
  if (opts.fridge === 'builtin') cluster.push({ key: 'tall_fridge', w: 60, tall: true });
  const tower = opts.cooking === 'builtin' && opts.ovenTower && totalLen >= 360;
  if (tower) cluster.push({ key: 'tall_oven', w: 60, tall: true });
  if (opts.pantry && totalLen >= 420) cluster.push({ key: 'tall_pantry', w: 60, tall: true });
  if (opts.cooking === 'builtin' && opts.ovenTower && !tower) notes.push(L('المساحة صغيرة لعمود الفرن، تم وضع الفرن أسفل المسطح.', 'Not enough room for an oven tower; the oven sits under the hob.'));

  const clusterW = cluster.reduce((s, c) => s + c.w, 0);
  const tallRanges: { ri: number; a: number; b: number }[] = [];
  if (cluster.length) {
    const first = baseStrips[0];
    const last = baseStrips[baseStrips.length - 1];
    const fitsAt = (s: Strip, t0: number) => {
      const fr = s.free(tallBlocked(s.wall));
      return fr.some((f) => f.a <= t0 + 0.01 && f.b >= t0 + clusterW - 0.01);
    };
    let placed: { s: Strip; ri: number; t0: number; atStart: boolean } | null = null;
    if (fitsAt(first, first.a) && first.length - clusterW >= (runs.length === 1 ? 200 : 100)) placed = { s: first, ri: 0, t0: first.a, atStart: true };
    else if (fitsAt(last, last.b - clusterW) && last.length - clusterW >= (runs.length === 1 ? 200 : 60)) placed = { s: last, ri: baseStrips.length - 1, t0: last.b - clusterW, atStart: false };
    if (placed) {
      const seq = placed.atStart ? cluster : [...cluster].reverse();
      let t = placed.t0;
      for (const c of seq) {
        add(c.key, placed.s.wall, t, c.w, c.key === 'tall_fridge' || c.key === 'tall_pantry' || c.key === 'tall_oven' ? { hinge: placed.atStart ? 'L' : 'R' } : undefined);
        if (c.key === 'app_fridge' && opts.wallUnits) add('wall_top', placed.s.wall, t, c.w);
        t += c.w;
      }
      placed.s.take(placed.t0, clusterW);
      wallStrips[placed.ri].take(placed.t0, clusterW);
      tallRanges.push({ ri: placed.ri, a: placed.t0, b: placed.t0 + clusterW });
    } else {
      notes.push(L('لم يوجد مكان مناسب للثلاجة والأعمدة بجوار الحوائط؛ أضفها يدوياً.', 'No suitable spot for the fridge / tall units; add them manually.'));
    }
  }
  const hasTower = items.some((i) => i.type === 'tall_oven');

  // ---- sink ----
  const sinkW = totalLen >= 520 ? 100 : 80;
  const sinkKey = sinkW >= 100 ? 'base_sink2' : 'base_sink';
  let sinkPos: { ri: number; t0: number } | null = null;
  const trySink = (ri: number, tc: number): boolean => {
    const t0 = baseStrips[ri].fit(tc, sinkW);
    if (t0 === null) return false;
    sinkPos = { ri, t0 };
    return true;
  };
  // 1) plumbing point, 2) under a window, 3) sensible default
  let sinkReason = '';
  const water = room.utilities.filter((u) => u.type === 'water' || u.type === 'drain');
  for (const u of water) {
    const ri = runs.findIndex((r) => r.wall.i === u.wall);
    if (ri >= 0 && !sinkPos && trySink(ri, u.offset)) sinkReason = L('تم وضع الحوض عند مصدر المياه/الصرف.', 'The sink was placed at the water / drain point.');
  }
  if (!sinkPos) {
    for (let ri = 0; ri < runs.length && !sinkPos; ri++) {
      for (const win of windowsOn(runs[ri].wall)) {
        if (win.sill < 92) continue;
        if (trySink(ri, win.offset + win.width / 2)) {
          sinkReason = L('تم وضع الحوض تحت الشباك للإضاءة الطبيعية.', 'The sink was placed under the window for daylight.');
          break;
        }
      }
    }
  }
  if (!sinkPos) {
    const ri = runs.length === 3 ? 1 : runs.length === 2 ? 1 : 0;
    const s = baseStrips[ri];
    const fr = s.free().reduce((m, x) => (x.b - x.a > m.b - m.a ? x : m), { a: s.a, b: s.a });
    const tc = runs.length === 1 ? fr.a + (fr.b - fr.a) * 0.3 : (fr.a + fr.b) / 2;
    if (!trySink(ri, tc)) for (let r2 = 0; r2 < runs.length && !sinkPos; r2++) trySink(r2, (baseStrips[r2].a + baseStrips[r2].b) / 2);
  }
  if (sinkPos) {
    const sp = sinkPos as { ri: number; t0: number };
    add(sinkKey, runs[sp.ri].wall, sp.t0, sinkW);
    baseStrips[sp.ri].take(sp.t0, sinkW);
    if (sinkReason) notes.push(sinkReason);
    if (opts.dishwasher) {
      const s = baseStrips[sp.ri];
      const fr = s.free();
      const right = fr.find((f) => Math.abs(f.a - (sp.t0 + sinkW)) < 0.5 && f.b - f.a >= 60);
      const left = fr.find((f) => Math.abs(f.b - sp.t0) < 0.5 && f.b - f.a >= 60);
      if (right) {
        add('app_dishwasher', s.wall, right.a, 60);
        s.take(right.a, 60);
      } else if (left) {
        add('app_dishwasher', s.wall, left.b - 60, 60);
        s.take(left.b - 60, 60);
      } else notes.push(L('لا يوجد مكان لغسالة الأطباق بجوار الحوض.', 'No room for the dishwasher next to the sink.'));
    }
  } else {
    notes.push(L('لم يوجد مكان مناسب للحوض.', 'No suitable position for the sink.'));
  }

  // ---- cooking ----
  const hobW = 60;
  let hobPos: { ri: number; t0: number } | null = null;
  const tryHob = (ri: number, tc: number): boolean => {
    const s = baseStrips[ri];
    const windows = windowsOn(s.wall).map((w) => ({ a: w.offset - 5, b: w.offset + w.width + 5 }));
    // keep a landing space next to tall units and the sink
    const guard: Iv[] = [...windows];
    for (const tr of tallRanges) if (tr.ri === ri) guard.push({ a: tr.a - 30, b: tr.b + 30 });
    if (sinkPos && (sinkPos as { ri: number }).ri === ri) {
      const sp = sinkPos as { ri: number; t0: number };
      guard.push({ a: sp.t0 - 40, b: sp.t0 + sinkW + 40 });
    }
    let t0 = s.fit(tc, hobW, guard);
    if (t0 === null) t0 = s.fit(tc, hobW, windows);
    if (t0 === null) return false;
    hobPos = { ri, t0 };
    return true;
  };
  const gas = room.utilities.filter((u) => u.type === 'gas');
  let hobReason = '';
  for (const u of gas) {
    const ri = runs.findIndex((r) => r.wall.i === u.wall);
    if (ri >= 0 && !hobPos && tryHob(ri, u.offset)) hobReason = L('تم وضع البوتاجاز عند مصدر الغاز.', 'The cooker was placed at the gas point.');
  }
  if (!hobPos) {
    const sinkRi = sinkPos ? (sinkPos as { ri: number }).ri : -1;
    const order = runs.map((_, i) => i).sort((p, q) => (p === sinkRi ? 1 : 0) - (q === sinkRi ? 1 : 0) || baseStrips[q].length - baseStrips[p].length);
    for (const ri of order) {
      const s = baseStrips[ri];
      const fr = s.free().reduce((m, x) => (x.b - x.a > m.b - m.a ? x : m), { a: s.a, b: s.a });
      const tc = ri === sinkRi ? fr.a + (fr.b - fr.a) * 0.7 : (fr.a + fr.b) / 2;
      if (tryHob(ri, tc)) break;
    }
  }
  if (hobPos) {
    const hp = hobPos as { ri: number; t0: number };
    const s = baseStrips[hp.ri];
    if (opts.cooking === 'cooker') {
      add('app_cooker', s.wall, hp.t0, hobW);
    } else if (hasTower) {
      add('base_hob', s.wall, hp.t0, hobW);
    } else {
      add('base_oven', s.wall, hp.t0, hobW);
    }
    s.take(hp.t0, hobW);
    if (hobReason) notes.push(hobReason);
    // extraction above
    const ws = wallStrips[hp.ri];
    const clear = ws.free().some((f) => f.a <= hp.t0 + 0.01 && f.b >= hp.t0 + hobW - 0.01);
    if (clear) {
      if (opts.cooking === 'cooker' || !opts.wallUnits) add('app_hood', s.wall, hp.t0, hobW);
      else add('wall_hood', s.wall, hp.t0, hobW);
      ws.take(hp.t0, hobW);
    }
    // a drawer stack beside the hob
    const fr = s.free();
    const right = fr.find((f) => Math.abs(f.a - (hp.t0 + hobW)) < 0.5 && f.b - f.a >= 90);
    const left = fr.find((f) => Math.abs(f.b - hp.t0) < 0.5 && f.b - f.a >= 90);
    if (right) {
      add('base_3dr', s.wall, right.a, 60);
      s.take(right.a, 60);
    } else if (left) {
      add('base_3dr', s.wall, left.b - 60, 60);
      s.take(left.b - 60, 60);
    }
  } else {
    notes.push(L('لم يوجد مكان مناسب للبوتاجاز.', 'No suitable position for the cooker.'));
  }

  // ---- fill the remaining base space ----
  baseStrips.forEach((s) => {
    for (const f of s.free()) {
      let t = f.a;
      let g = f.b - f.a;
      if (g < 2) continue;
      while (g > 120) {
        const w = g - 80 < 30 ? 60 : g - 90 >= 30 && Math.abs((g / 90) % 1) < 0.001 ? 90 : 80;
        add('base_2d', s.wall, t, w);
        t += w;
        g -= w;
      }
      if (g < 15) add('base_filler', s.wall, t, g);
      else if (g < 30) add('base_pullout', s.wall, t, g);
      else if (g <= 60) add('base_1d', s.wall, t, g, { hinge: 'L' });
      else add('base_2d', s.wall, t, g);
    }
  });

  // ---- wall units ----
  if (opts.wallUnits) {
    runs.forEach((r, ri) => {
      const ws = wallStrips[ri];
      if (r.cornerEnd) {
        const fr = ws.free();
        const lastF = fr[fr.length - 1];
        if (lastF && lastF.b > ws.b - 0.5 && lastF.b - lastF.a >= 60) {
          const w = Math.min(70, lastF.b - lastF.a);
          add('wall_corner', r.wall, ws.b - w, w, { blind: 'R', blindW: WALL_D, hinge: 'L' });
          ws.take(ws.b - w, w);
        }
      }
      // boundaries of the floor units below, so the fronts line up
      const cuts = items
        .filter((it) => it.elev === 0 && it.rot === r.wall.angle)
        .flatMap((it) => {
          const rel = { x: it.x - r.wall.a.x, y: it.y - r.wall.a.y };
          const t = rel.x * r.wall.dir.x + rel.y * r.wall.dir.y;
          return [t - it.w / 2, t + it.w / 2];
        });
      for (const f of ws.free()) {
        if (f.b - f.a < 25) continue;
        const pts = [f.a, ...[...new Set(cuts.map((c) => Math.round(c * 10) / 10))].filter((c) => c > f.a + 25 && c < f.b - 25).sort((p, q) => p - q), f.b];
        // merge short pieces, split long ones
        const segs: Iv[] = [];
        for (let i = 0; i < pts.length - 1; i++) {
          const seg = { a: pts[i], b: pts[i + 1] };
          const prev = segs[segs.length - 1];
          if (prev && (seg.b - seg.a < 30 || prev.b - prev.a < 30) && seg.b - prev.a <= 100) prev.b = seg.b;
          else segs.push(seg);
        }
        for (const sg of segs) {
          const len = sg.b - sg.a;
          const parts = len > 100 ? Math.ceil(len / 90) : 1;
          const w = len / parts;
          for (let k = 0; k < parts; k++) {
            const t0 = sg.a + k * w;
            if (w < 25) add('wall_open', r.wall, t0, w);
            else if (w <= 60) add('wall_1d', r.wall, t0, w, { hinge: 'L' });
            else add('wall_2d', r.wall, t0, w);
          }
        }
      }
    });
  }

  // ---- island ----
  if (opts.island) {
    const islandDef = def('island');
    const b = bounds(room.points);
    const main = runs[0].wall;
    const tryAt = (cx: number, cy: number, w: number): boolean => {
      const quad = rectCorners(cx, cy, w + 200, islandDef.d + 200, main.angle);
      const inner = rectCorners(cx, cy, w + 120, islandDef.d + 120, main.angle);
      if (!inner.every((c) => pointInPolygon(c, room.points))) return false;
      if (items.some((it) => it.elev < 90 && quadsOverlap(itemCorners(it), quad, 0))) return false;
      const it = createItem(islandDef, { x: Math.round(cx), y: Math.round(cy), rot: (main.angle + 180) % 360 }, w);
      items.push(it);
      return true;
    };
    let ok = false;
    for (const w of [180, 160, 140, 120]) {
      // start at the centre and move away from the main run
      for (let k = 0; k <= 6 && !ok; k++) {
        const off = k * 20;
        ok = tryAt(b.cx + main.n.x * off, b.cy + main.n.y * off, w);
      }
      if (ok) break;
    }
    if (!ok) notes.push(L('المساحة لا تكفي لجزيرة مع ممرات مريحة (100 سم).', 'Not enough space for an island with comfortable aisles (100 cm).'));
  }

  if (style === 'I') notes.unshift(L('توزيع خطي على أطول حائط متاح.', 'Straight layout on the longest free wall.'));
  if (style === 'L') notes.unshift(L('توزيع حرف L مع ركنة عمياء.', 'L-shaped layout with a blind corner unit.'));
  if (style === 'U') notes.unshift(L('توزيع حرف U على ثلاثة حوائط.', 'U-shaped layout over three walls.'));
  return { items, style, notes };
}
