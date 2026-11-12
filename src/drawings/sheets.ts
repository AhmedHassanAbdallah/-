import { fmtCm, fmtDate, fmtNum, getLang, L, LT } from '../i18n';
import type { Bom } from '../lib/bom';
import { CAT_NAMES, itemName, SECTION_NAMES } from '../lib/catalog';
import { bounds, dot, getWalls, itemAxes, itemCorners, itemWall, sub, wallPoint, type Wall } from '../lib/geometry';
import { cabinetLayout, itemFinishId } from '../lib/layout';
import { countertopFinish, doorFinish, DOOR_TYPES, handleColor, HANDLE_TYPES } from '../lib/materials';
import type { Part } from '../lib/parts';
import type { Item, Project } from '../types';
import { Kit, PAGE_H, PAGE_W, pickScale } from './kit';

export interface SheetSpec {
  id: string;
  title: string;
  scale?: string;
  draw: (k: Kit) => void;
}

const INK = '#1b2430';
const SOFT = '#59626e';
const DIM = '#0b5d57';
const FRONT_FILL = '#f6f1e6';
const UTIL: Record<string, { c: string; l: string }> = { water: { c: '#2f80ed', l: 'W' }, drain: { c: '#6b7280', l: 'D' }, electric: { c: '#d9a400', l: 'E' }, gas: { c: '#f2792b', l: 'G' } };

// content box inside the frame
const CX0 = 10;
const CX1 = PAGE_W - 10;
const CY0 = 21;
const CY1 = 191;

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------
function frame(k: Kit, p: Project, spec: SheetSpec, index: number, total: number) {
  k.rect(6, 6, PAGE_W - 12, PAGE_H - 12, { stroke: INK, lw: 0.4 });
  k.rect(6, 6, PAGE_W - 12, 11, { fill: '#0f172a', stroke: 'none' });
  const rtl = k.rtl;
  k.text(spec.title, rtl ? PAGE_W - 10 : 10, 13.4, { size: 4.4, bold: true, color: '#ffffff', align: rtl ? 'right' : 'left' });
  k.text(p.name, rtl ? 10 : PAGE_W - 10, 13.2, { size: 3.4, bold: true, color: '#cbd5e1', align: rtl ? 'left' : 'right', maxWidth: 110 });
  k.line(6, 195, PAGE_W - 6, 195, 0.25, INK);
  k.text('Kitchen Studio', rtl ? PAGE_W - 10 : 10, 200.6, { size: 2.9, bold: true, color: '#0f766e', align: rtl ? 'right' : 'left' });
  const mid = [fmtDate(p.updatedAt), spec.scale ? L('مقياس الرسم', 'Scale') + ' ' + spec.scale : '', L('الأبعاد بالسنتيمتر ما لم يذكر غير ذلك', 'Dimensions in cm unless noted')].filter(Boolean).join('   ·   ');
  k.text(mid, PAGE_W / 2, 200.6, { size: 2.5, color: SOFT, align: 'center' });
  k.text(`${index + 1} / ${total}`, rtl ? 10 : PAGE_W - 10, 200.6, { size: 2.9, bold: true, align: rtl ? 'left' : 'right' });
}

// ---------------------------------------------------------------------------
// Item fronts (shared by elevations and unit details)
// ---------------------------------------------------------------------------
function applianceFront(k: Kit, it: Item, X: number, Y: number, sc: number) {
  const w = it.w * sc;
  const h = it.h * sc;
  const top = Y - h;
  const body = { fill: '#eceff2', stroke: INK, lw: 0.3 };
  switch (it.appliance) {
    case 'fridge': {
      k.rect(X, top, w, h, body);
      const sy = Y - h * 0.38;
      k.line(X, sy, X + w, sy, 0.25);
      k.line(X + 5 * sc, sy - 6 * sc, X + 5 * sc, sy - 46 * sc, 0.5);
      k.line(X + 5 * sc, sy + 6 * sc, X + 5 * sc, sy + 32 * sc, 0.5);
      break;
    }
    case 'fridge_sbs': {
      k.rect(X, top, w, h, body);
      const sx = X + w * 0.42;
      k.line(sx, top, sx, Y, 0.25);
      k.line(sx - 3 * sc, Y - h * 0.3, sx - 3 * sc, Y - h * 0.75, 0.5);
      k.line(sx + 3 * sc, Y - h * 0.3, sx + 3 * sc, Y - h * 0.75, 0.5);
      break;
    }
    case 'cooker': {
      k.rect(X, top, w, h, body);
      k.rect(X, top, w, 9 * sc, { fill: '#c9ced4', stroke: INK, lw: 0.2 });
      for (let i = 0; i < 5; i++) k.circle(X + (w * (i + 1)) / 6, top + 4.5 * sc, 1.4 * sc, { fill: SOFT });
      k.rect(X + 3 * sc, top + 13 * sc, w - 6 * sc, h - 13 * sc - 24 * sc, { fill: '#59626e', stroke: INK, lw: 0.2 });
      k.line(X + 6 * sc, top + 11 * sc, X + w - 6 * sc, top + 11 * sc, 0.5);
      k.line(X, Y - 8 * sc, X + w, Y - 8 * sc, 0.2);
      break;
    }
    case 'hood': {
      const canopy = 6 * sc;
      k.rect(X + w / 2 - 12 * sc, top, 24 * sc, h - canopy, { fill: '#eceff2', stroke: INK, lw: 0.25 });
      k.rect(X, Y - canopy, w, canopy, { fill: '#c9ced4', stroke: INK, lw: 0.3 });
      break;
    }
    case 'dishwasher': {
      k.rect(X + 0.5, Y - 10 * sc, w - 1, 10 * sc, { fill: '#c5cad0', stroke: INK, lw: 0.15 });
      k.rect(X, top, w, h - 10 * sc, body);
      k.rect(X, top, w, 11 * sc, { fill: '#59626e', stroke: INK, lw: 0.2 });
      k.line(X + 7 * sc, top + 15.5 * sc, X + w - 7 * sc, top + 15.5 * sc, 0.5);
      break;
    }
    case 'washer': {
      k.rect(X, top, w, h, { fill: '#f6f7f8', stroke: INK, lw: 0.3 });
      k.line(X, top + 12 * sc, X + w, top + 12 * sc, 0.2);
      k.circle(X + w / 2, top + 12 * sc + (h - 12 * sc) / 2, Math.min(17, it.w / 2 - 8) * sc, { fill: '#59626e', stroke: INK, lw: 0.5 });
      break;
    }
    case 'microwave': {
      k.rect(X, top, w, h, body);
      k.rect(X + 2 * sc, top + 2.5 * sc, w * 0.68, h - 5 * sc, { fill: '#59626e', stroke: INK, lw: 0.15 });
      k.circle(X + w * 0.87, Y - h * 0.3, 1.6 * sc, { fill: SOFT });
      break;
    }
    default:
      k.rect(X, top, w, h, body);
  }
}

/** Front elevation of one item. X = paper x of its left edge, Y = paper y of its bottom. */
export function itemFront(k: Kit, it: Item, p: Project, X: number, Y: number, sc: number) {
  if (it.cat === 'appliance') {
    applianceFront(k, it, X, Y, sc);
  } else {
    const lay = cabinetLayout(it, p.rules, p.finishes);
    const w = it.w * sc;
    const x = (v: number) => X + v * sc;
    const y = (v: number) => Y - v * sc;
    if (lay.plinth > 0) k.rect(X + 0.5, y(lay.plinth), Math.max(0.2, w - 1), lay.plinth * sc, { fill: '#c5cad0', stroke: INK, lw: 0.15 });
    if (it.opts.filler) {
      k.rect(X, y(it.h), w, lay.carcassH * sc, { fill: '#e9e3d6', stroke: INK, lw: 0.25 });
    } else {
      k.rect(X, y(it.h), w, lay.carcassH * sc, { fill: '#ffffff', stroke: INK, lw: 0.32 });
      if (it.opts.blind) {
        const bx = lay.x0 > 0 ? X : x(lay.x1);
        const bw = (lay.x0 > 0 ? lay.x0 : it.w - lay.x1) * sc;
        k.rect(bx, y(it.h), bw, lay.carcassH * sc, { fill: '#e4e7ea', stroke: INK, lw: 0.15, dash: [0.9, 0.7] });
        k.line(bx, y(it.h), bx + bw, y(lay.plinth), 0.1, SOFT);
        k.line(bx + bw, y(it.h), bx, y(lay.plinth), 0.1, SOFT);
      }
      for (const band of lay.bands) {
        const bx = x(lay.x0);
        const bw = (lay.x1 - lay.x0) * sc;
        const top = y(band.y1);
        const bh = (band.y1 - band.y0) * sc;
        if (band.kind === 'open') {
          k.rect(bx + 0.4, top + 0.4, bw - 0.8, bh - 0.8, { fill: '#eceff2', stroke: INK, lw: 0.12 });
          const n = Math.max(0, it.opts.shelves ?? 0);
          for (let s = 1; s <= n; s++) k.line(bx + 0.4, top + (bh * s) / (n + 1), bx + bw - 0.4, top + (bh * s) / (n + 1), 0.25);
        } else if (band.kind === 'oven') {
          k.rect(bx + 0.4, top + 0.4, bw - 0.8, bh - 0.8, { fill: '#d5d9de', stroke: INK, lw: 0.2 });
          k.rect(bx + 3 * sc, top + 12 * sc, bw - 6 * sc, bh - 16 * sc, { fill: '#59626e', stroke: INK, lw: 0.15 });
          k.line(bx + 6 * sc, top + 9.5 * sc, bx + bw - 6 * sc, top + 9.5 * sc, 0.45);
          k.circle(bx + bw * 0.2, top + 4.5 * sc, 1.4 * sc, { fill: SOFT });
          k.circle(bx + bw * 0.8, top + 4.5 * sc, 1.4 * sc, { fill: SOFT });
        } else if (band.kind === 'micro') {
          k.rect(bx + 0.4, top + 0.4, bw - 0.8, bh - 0.8, { fill: '#d5d9de', stroke: INK, lw: 0.2 });
          k.rect(bx + 2.5 * sc, top + 3 * sc, bw * 0.66, bh - 6 * sc, { fill: '#59626e', stroke: INK, lw: 0.15 });
          k.circle(bx + bw * 0.87, top + bh * 0.7, 1.5 * sc, { fill: SOFT });
        }
      }
      for (const f of lay.fronts) {
        const fx = x(f.x);
        const fy = y(f.y + f.h);
        const fw = f.w * sc;
        const fh = f.h * sc;
        k.rect(fx, fy, fw, fh, { fill: f.kind === 'glass' ? '#e1eff5' : f.kind === 'panel' ? '#eeeeea' : FRONT_FILL, stroke: INK, lw: 0.22 });
        const dash = [1.1, 0.8];
        if (f.kind === 'door' || f.kind === 'glass') {
          // opening symbol: the apex points to the hinged side
          const ax = f.hinge === 'L' ? fx : fx + fw;
          const ox = f.hinge === 'L' ? fx + fw : fx;
          k.line(ox, fy, ax, fy + fh / 2, 0.1, SOFT, dash);
          k.line(ox, fy + fh, ax, fy + fh / 2, 0.1, SOFT, dash);
        } else if (f.kind === 'flap') {
          k.line(fx, fy + fh, fx + fw / 2, fy, 0.1, SOFT, dash);
          k.line(fx + fw, fy + fh, fx + fw / 2, fy, 0.1, SOFT, dash);
        }
        if (f.handle && p.finishes.handle !== 'none' && p.finishes.handle !== 'gola') {
          const hx = x(f.handle.x);
          const hy = y(f.handle.y);
          if (p.finishes.handle === 'knob') k.circle(hx, hy, Math.max(0.35, 1.4 * sc), { fill: INK });
          else {
            const hl = (Math.min(f.handle.len, (f.handle.orient === 'v' ? f.h : f.w) - 3) * sc) / 2;
            if (hl > 0.3) {
              if (f.handle.orient === 'v') k.line(hx, hy - hl, hx, hy + hl, 0.5);
              else k.line(hx - hl, hy, hx + hl, hy, 0.5);
            }
          }
        }
      }
    }
  }
  if (it.opts.countertop) {
    const ct = p.finishes.countertopT;
    const w = it.w * sc;
    const yt = Y - (it.h + ct) * sc;
    k.rect(X, yt, w, ct * sc, { fill: '#59626e', stroke: INK, lw: 0.2 });
    if (it.opts.sink) {
      const cx = X + w / 2;
      const ctx = k.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.lineWidth = 0.45;
      ctx.strokeStyle = INK;
      ctx.moveTo(cx, yt);
      ctx.lineTo(cx, yt - 22 * sc);
      ctx.quadraticCurveTo(cx, yt - 30 * sc, cx + 9 * sc, yt - 30 * sc);
      ctx.lineTo(cx + 12 * sc, yt - 26 * sc);
      ctx.stroke();
      ctx.restore();
    }
    if (it.opts.cooktop) {
      k.rect(X + w * 0.06, yt - 1.4 * sc, w * 0.88, 1.4 * sc, { fill: '#1b2430', stroke: 'none' });
      for (const fx of [0.28, 0.72]) k.rect(X + w * fx - 6 * sc, yt - 3.6 * sc, 12 * sc, 2.2 * sc, { fill: '#1b2430', stroke: 'none' });
    }
  }
}

/** Side section of a cabinet. X = paper x of its back, Y = paper y of its bottom. */
function itemSide(k: Kit, it: Item, p: Project, X: number, Y: number, sc: number) {
  const lay = cabinetLayout(it, p.rules, p.finishes);
  const ft = p.rules.frontT / 10;
  const y = (v: number) => Y - v * sc;
  const cd = (it.d - ft) * sc;
  if (lay.plinth > 0) k.rect(X + 3 * sc, y(lay.plinth), cd - 8 * sc, lay.plinth * sc, { fill: '#c5cad0', stroke: INK, lw: 0.15 });
  if (!it.opts.filler) {
    k.rect(X, y(it.h), cd, lay.carcassH * sc, { fill: '#ffffff', stroke: INK, lw: 0.32 });
    const n = it.opts.shelves ?? 0;
    for (let s = 1; s <= n; s++) {
      const yy = y(lay.plinth + (lay.carcassH * s) / (n + 1));
      k.line(X + 0.4, yy, X + cd - 2 * sc, yy, 0.18, SOFT, [1.2, 0.8]);
    }
  }
  k.rect(X + cd, y(it.h), ft * sc, lay.carcassH * sc, { fill: FRONT_FILL, stroke: INK, lw: 0.25 });
  if (it.opts.countertop) {
    const ct = p.finishes.countertopT;
    k.rect(X, y(it.h + ct), (it.d + p.finishes.overhang) * sc, ct * sc, { fill: '#59626e', stroke: INK, lw: 0.2 });
  }
}

function tagBubble(k: Kit, tag: string, x: number, y: number, size = 2.5) {
  const w = Math.max(k.measure(tag, size, true) + 2.2, size * 2);
  const ctx = k.ctx;
  ctx.save();
  ctx.beginPath();
  const h = size * 1.7;
  const r = h / 2;
  ctx.moveTo(x - w / 2 + r, y - h / 2);
  ctx.arcTo(x + w / 2, y - h / 2, x + w / 2, y + h / 2, r);
  ctx.arcTo(x + w / 2, y + h / 2, x - w / 2, y + h / 2, r);
  ctx.arcTo(x - w / 2, y + h / 2, x - w / 2, y - h / 2, r);
  ctx.arcTo(x - w / 2, y - h / 2, x + w / 2, y - h / 2, r);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 0.22;
  ctx.strokeStyle = '#0f766e';
  ctx.stroke();
  ctx.restore();
  k.text(tag, x, y + size * 0.36, { size, bold: true, align: 'center', color: '#0b5d57' });
}

function uniq(vals: number[], tol = 0.3): number[] {
  const s = [...vals].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of s) if (!out.length || v - out[out.length - 1] > tol) out.push(v);
  return out;
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------
function drawPlan(k: Kit, p: Project, bom: Bom, box: { x: number; y: number; w: number; h: number }, dims: boolean): number {
  const room = p.room;
  const walls = getWalls(room);
  const b = bounds(room.points);
  const T = room.wallThickness;
  const margin = dims ? 24 : 4;
  const { sc, n } = pickScale(Math.min((box.w - margin * 2) / (b.w + 2 * T), (box.h - margin * 2) / (b.h + 2 * T)));
  const ox = box.x + (box.w - b.w * sc) / 2;
  const oy = box.y + (box.h - b.h * sc) / 2;
  const X = (x: number) => ox + (x - b.minX) * sc;
  const Y = (y: number) => oy + (y - b.minY) * sc;
  const ctx = k.ctx;

  const pts = room.points.map((q) => [X(q.x), Y(q.y)] as [number, number]);
  k.poly(pts, { stroke: '#4a535e', lw: T * 2 * sc, join: 'miter' });
  k.poly(pts, { fill: '#ffffff', stroke: INK, lw: 0.3 });

  for (const c of room.columns) k.rect(X(c.x - c.w / 2), Y(c.y - c.d / 2), c.w * sc, c.d * sc, { fill: '#4a535e', stroke: INK, lw: 0.2 });

  // openings, drawn in each wall's frame
  for (const op of room.openings) {
    const w = walls[op.wall];
    if (!w) continue;
    ctx.save();
    ctx.translate(X(w.a.x), Y(w.a.y));
    ctx.rotate((w.angle * Math.PI) / 180);
    const o = op.offset * sc;
    const ow = op.width * sc;
    k.rect(o, -T * sc - 0.1, ow, T * sc + 0.2, { fill: '#ffffff', stroke: INK, lw: 0.2 });
    if (op.type === 'door') {
      ctx.beginPath();
      ctx.lineWidth = 0.14;
      ctx.strokeStyle = SOFT;
      ctx.setLineDash([1, 0.7]);
      const right = op.hinge === 'R';
      const out = op.swing === 'out';
      const hx = right ? o + ow : o;
      const y0 = out ? -T * sc : 0;
      const a0 = out ? (right ? Math.PI : -Math.PI / 2) : right ? Math.PI / 2 : 0;
      ctx.arc(hx, y0, ow, a0, a0 + Math.PI / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      k.line(hx, y0, hx, y0 + (out ? -ow : ow), 0.35);
    } else {
      k.line(o, (-T * sc) / 2, o + ow, (-T * sc) / 2, 0.4, '#2f80ed');
      k.line(o, (-T * sc) / 2 - 0.6, o + ow, (-T * sc) / 2 - 0.6, 0.12, '#2f80ed');
      k.line(o, (-T * sc) / 2 + 0.6, o + ow, (-T * sc) / 2 + 0.6, 0.12, '#2f80ed');
    }
    ctx.restore();
  }

  const drawFootprint = (it: Item) => {
    const upper = it.cat === 'wall' || it.elev >= 100;
    const cs = itemCorners(it).map((c) => [X(c.x), Y(c.y)] as [number, number]);
    if (upper) k.poly(cs, { stroke: '#2f6ea5', lw: 0.22, dash: [1.2, 0.8] });
    else {
      k.poly(cs, { fill: it.cat === 'appliance' ? '#e3e7eb' : it.cat === 'tall' ? '#e0d2b4' : '#f3ecdc', stroke: INK, lw: 0.28 });
      // front edge
      k.line(cs[3][0], cs[3][1], cs[2][0], cs[2][1], 0.7, SOFT);
      const { u, f } = itemAxes(it.rot);
      if (it.opts.sink) {
        const nB = it.opts.sink === 'double' ? 2 : 1;
        const bw = nB === 2 ? Math.min(36, (it.w - 16) / 2) : Math.min(46, it.w - 14);
        for (let i = 0; i < nB; i++) {
          const off = nB === 2 ? (i === 0 ? -bw / 2 - 3 : bw / 2 + 3) : 0;
          const cx = it.x + u.x * off + f.x * 1;
          const cy = it.y + u.y * off + f.y * 1;
          const q = [
            [-bw / 2, -17],
            [bw / 2, -17],
            [bw / 2, 17],
            [-bw / 2, 17],
          ].map(([a, c]) => [X(cx + u.x * a + f.x * c), Y(cy + u.y * a + f.y * c)] as [number, number]);
          k.poly(q, { fill: '#ffffff', stroke: SOFT, lw: 0.18 });
        }
      }
      if (it.opts.cooktop || it.appliance === 'cooker') {
        for (const a of [-1, 1])
          for (const c of [-1, 1]) {
            const px = it.x + u.x * a * Math.min(15, it.w / 4) + f.x * (c * 12 + 1);
            const py = it.y + u.y * a * Math.min(15, it.w / 4) + f.y * (c * 12 + 1);
            k.circle(X(px), Y(py), Math.min(7, it.w / 9) * sc, { stroke: SOFT, lw: 0.18 });
          }
      }
    }
  };
  const floorItems = p.items.filter((i) => !(i.cat === 'wall' || i.elev >= 100));
  const upperItems = p.items.filter((i) => i.cat === 'wall' || i.elev >= 100);
  floorItems.forEach(drawFootprint);
  upperItems.forEach(drawFootprint);

  for (const u of room.utilities) {
    const w = walls[u.wall];
    if (!w) continue;
    const q = wallPoint(w, u.offset, 0);
    const m = UTIL[u.type];
    k.circle(X(q.x) + w.n.x * 1.9, Y(q.y) + w.n.y * 1.9, 1.7, { fill: m.c, stroke: '#ffffff', lw: 0.25 });
    k.text(m.l, X(q.x) + w.n.x * 1.9, Y(q.y) + w.n.y * 1.9 + 0.8, { size: 2.1, bold: true, align: 'center', color: '#ffffff' });
  }

  // tags
  for (const it of p.items) {
    const upper = it.cat === 'wall' || it.elev >= 100;
    const { f } = itemAxes(it.rot);
    const hasBelow = upper && floorItems.some((o) => Math.hypot(o.x - it.x, o.y - it.y) < 45);
    const shift = upper ? (hasBelow ? -it.d / 2 + 7 : 0) : upperItems.some((o) => Math.hypot(o.x - it.x, o.y - it.y) < 45) ? it.d / 2 - 12 : 0;
    const tx = X(it.x + f.x * shift);
    const ty = Y(it.y + f.y * shift);
    const size = Math.max(1.7, Math.min(2.6, Math.min(it.w, it.d + 20) * sc * 0.16));
    if (dims || Math.min(it.w, it.d) * sc > 6) k.text(bom.tags.get(it.id) ?? '', tx, ty + size * 0.36, { size, bold: true, align: 'center', color: upper ? '#2f6ea5' : INK, halo: true });
  }

  if (dims) {
    for (const w of walls) {
      if (w.len < 5) continue;
      const ax = X(w.a.x);
      const ay = Y(w.a.y);
      const bx = X(w.b.x);
      const by = Y(w.b.y);
      // normal used by Kit.dim is the wall's inward normal, so negative offsets go outside
      const floorOn = floorItems.map((it) => itemWall(it, [w])).filter((a): a is NonNullable<typeof a> => !!a);
      let off = -(T * sc + 5);
      if (floorOn.length) {
        const cuts = uniq([0, w.len, ...floorOn.flatMap((a) => [Math.max(0, a.t0), Math.min(w.len, a.t1)])]);
        for (let i = 0; i < cuts.length - 1; i++) {
          const q1 = wallPoint(w, cuts[i]);
          const q2 = wallPoint(w, cuts[i + 1]);
          k.dim(X(q1.x), Y(q1.y), X(q2.x), Y(q2.y), off, fmtCm(cuts[i + 1] - cuts[i]), { size: 2.2 });
        }
        off -= 6.5;
      }
      k.dim(ax, ay, bx, by, off, fmtCm(w.len), { size: 2.7, color: INK });
    }
  }
  return n;
}

// ---------------------------------------------------------------------------
// Elevation of one wall
// ---------------------------------------------------------------------------
function drawElevation(k: Kit, p: Project, bom: Bom, w: Wall): number {
  const room = p.room;
  const H = room.height;
  const ct = p.finishes.countertopT;
  const availW = CX1 - CX0 - 34;
  const availH = CY1 - CY0 - 44;
  const { sc, n } = pickScale(Math.min(availW / w.len, availH / H));
  const x0 = CX0 + 20 + (availW - w.len * sc) / 2;
  const yFloor = CY0 + 14 + (availH + H * sc) / 2;
  const X = (t: number) => x0 + t * sc;
  const Y = (h: number) => yFloor - h * sc;

  k.rect(X(0), Y(H), w.len * sc, H * sc, { fill: '#fbfbfa', stroke: SOFT, lw: 0.2 });
  // openings
  for (const op of room.openings) {
    if (op.wall !== w.i) continue;
    const ox = X(op.offset);
    const oy = Y(op.sill + op.height);
    const ow = op.width * sc;
    const oh = op.height * sc;
    if (op.type === 'door') {
      k.rect(ox, oy, ow, oh, { fill: '#f1ede6', stroke: SOFT, lw: 0.25 });
      k.text(L('باب', 'Door'), ox + ow / 2, oy + oh / 2, { size: 2.6, align: 'center', color: SOFT });
    } else {
      k.rect(ox, oy, ow, oh, { fill: '#e6f1f8', stroke: '#2f80ed', lw: 0.25 });
      k.line(ox, oy, ox + ow, oy + oh, 0.1, '#8ab6e0');
      k.line(ox + ow, oy, ox, oy + oh, 0.1, '#8ab6e0');
      k.text(L('شباك', 'Window'), ox + ow / 2, oy + oh / 2 + 1, { size: 2.4, align: 'center', color: '#2f6ea5', halo: true });
    }
  }
  // context: units on the neighbouring walls seen in section
  const on: { it: Item; t0: number; t1: number }[] = [];
  for (const it of p.items) {
    const att = itemWall(it, [w]);
    if (att) {
      on.push({ it, t0: att.t0, t1: att.t1 });
      continue;
    }
    let tmin = Infinity,
      tmax = -Infinity,
      nmin = Infinity;
    for (const c of itemCorners(it)) {
      const rel = sub(c, w.a);
      tmin = Math.min(tmin, dot(rel, w.dir));
      tmax = Math.max(tmax, dot(rel, w.dir));
      nmin = Math.min(nmin, dot(rel, w.n));
    }
    if (nmin < 3 && tmax > 0.5 && tmin < w.len - 0.5) {
      const a = Math.max(0, tmin);
      const c = Math.min(w.len, tmax);
      const top = it.h + (it.opts.countertop ? ct : 0);
      k.rect(X(a), Y(it.elev + top), (c - a) * sc, top * sc, { fill: '#e9ecef', stroke: SOFT, lw: 0.15, dash: [1, 0.7] });
      k.line(X(a), Y(it.elev + top), X(c), Y(it.elev), 0.1, '#aab1b9');
    }
  }
  on.sort((a, b) => (a.it.elev >= 100 ? 1 : 0) - (b.it.elev >= 100 ? 1 : 0) || a.t0 - b.t0);
  for (const e of on) itemFront(k, e.it, p, X(e.t0), Y(e.it.elev), sc);
  // services
  for (const u of room.utilities) {
    if (u.wall !== w.i) continue;
    const m = UTIL[u.type];
    k.circle(X(u.offset), Y(u.height), 1.6, { fill: m.c, stroke: '#ffffff', lw: 0.25 });
    k.text(m.l, X(u.offset), Y(u.height) + 0.75, { size: 2, bold: true, align: 'center', color: '#ffffff' });
  }
  k.line(X(0) - 6, Y(0), X(w.len) + 6, Y(0), 0.6, INK);
  // tags
  for (const e of on) {
    const cx = X((e.t0 + e.t1) / 2);
    const cy = Y(e.it.elev + e.it.h / 2);
    tagBubble(k, bom.tags.get(e.it.id) ?? '', cx, e.it.cat === 'tall' || e.it.appliance === 'fridge' || e.it.appliance === 'fridge_sbs' ? Y(e.it.elev + e.it.h * 0.72) : cy, Math.max(1.9, Math.min(2.6, e.it.w * sc * 0.2)));
  }

  // ---- dimensions ----
  const floorOn = on.filter((e) => e.it.elev < 100);
  const upperOn = on.filter((e) => e.it.elev >= 100);
  let off = 5;
  if (floorOn.length) {
    const cuts = uniq([0, w.len, ...floorOn.flatMap((e) => [Math.max(0, e.t0), Math.min(w.len, e.t1)])]);
    for (let i = 0; i < cuts.length - 1; i++) k.dim(X(cuts[i]), Y(0), X(cuts[i + 1]), Y(0), off, fmtCm(cuts[i + 1] - cuts[i]), { size: 2.3 });
    off += 6.5;
  }
  const ops = room.openings.filter((o) => o.wall === w.i);
  if (ops.length) {
    const cuts = uniq([0, w.len, ...ops.flatMap((o) => [o.offset, o.offset + o.width])]);
    for (let i = 0; i < cuts.length - 1; i++) k.dim(X(cuts[i]), Y(0), X(cuts[i + 1]), Y(0), off, fmtCm(cuts[i + 1] - cuts[i]), { size: 2.1, color: '#2f6ea5' });
    off += 6.5;
  }
  k.dim(X(0), Y(0), X(w.len), Y(0), off, fmtCm(w.len), { size: 2.8, color: INK });
  if (upperOn.length) {
    const cuts = uniq([0, w.len, ...upperOn.flatMap((e) => [Math.max(0, e.t0), Math.min(w.len, e.t1)])]);
    for (let i = 0; i < cuts.length - 1; i++) k.dim(X(cuts[i]), Y(H), X(cuts[i + 1]), Y(H), -4.5, fmtCm(cuts[i + 1] - cuts[i]), { size: 2.3 });
  }
  // heights on the left
  const levels = [0, H];
  for (const e of on) {
    const it = e.it;
    if (it.elev > 0.5) levels.push(it.elev);
    levels.push(it.elev + it.h);
    if (it.opts.countertop) levels.push(it.elev + it.h + ct);
  }
  const lv = uniq(levels, 2.6).filter((v) => v <= H + 0.1);
  for (let i = 0; i < lv.length - 1; i++) k.dim(X(0), Y(lv[i + 1]), X(0), Y(lv[i]), 5.5, fmtCm(lv[i + 1] - lv[i]), { size: 2.2 });
  k.dim(X(w.len), Y(0), X(w.len), Y(H), 6, fmtCm(H), { size: 2.7, color: INK });
  return n;
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------
function frontSummary(it: Item): string {
  const secs = it.opts.sections ?? [];
  if (it.cat === 'appliance' || !secs.length) return '—';
  const groups: { kind: string; n: number; leaves: number }[] = [];
  for (const s of secs) {
    const last = groups[groups.length - 1];
    if (last && last.kind === s.kind && (s.kind === 'drawer' || s.kind === 'flap')) last.n++;
    else groups.push({ kind: s.kind, n: 1, leaves: s.n ?? 1 });
  }
  return groups
    .map((g) => {
      const name = LT(SECTION_NAMES[g.kind]);
      if (g.kind === 'door' || g.kind === 'glass') return `${g.leaves} ${name}`;
      return g.n > 1 ? `${g.n} ${name}` : name;
    })
    .join(' + ');
}

function finishLabel(it: Item, p: Project): string {
  if (it.cat === 'appliance') return '—';
  const f = doorFinish(itemFinishId(it, p.finishes));
  const ty = DOOR_TYPES.find((d) => d.id === f.type)!;
  return `${LT(ty.name)} – ${LT(f.name)}`;
}

interface CutRow {
  order: number;
  material: string;
  name: string;
  L: number;
  W: number;
  T: number;
  qty: number;
  edge: number;
  tags: string[];
}

export function consolidatedCutList(p: Project, bom: Bom): CutRow[] {
  const map = new Map<string, CutRow>();
  const matName = (part: Part): string => {
    if (part.material === 'carcass') return L('هيكل', 'Carcass');
    if (part.material === 'drawer') return L('صندوق درج', 'Drawer box');
    if (part.material === 'back') return L('ظهر HDF', 'HDF back');
    const f = doorFinish(part.finish);
    return `${L('ضلف', 'Front')} ${LT(f.name)}`;
  };
  for (const part of bom.parts) {
    const key = [part.material, part.finish ?? '', part.name.en, part.L, part.W, part.T].join('|');
    const tag = bom.tags.get(part.itemId) ?? '';
    const row = map.get(key);
    if (row) {
      row.qty += part.qty;
      row.edge += part.edge * part.qty;
      if (!row.tags.includes(tag)) row.tags.push(tag);
    } else {
      const order = part.material === 'carcass' ? 0 : part.material === 'drawer' ? 1 : part.material === 'back' ? 2 : 3;
      map.set(key, { order, material: matName(part), name: LT(part.name), L: part.L, W: part.W, T: part.T, qty: part.qty, edge: part.edge * part.qty, tags: [tag] });
    }
  }
  return [...map.values()].sort((a, b) => a.order - b.order || a.material.localeCompare(b.material) || b.L - a.L || b.W - a.W);
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out.length ? out : [[]];
}

// ---------------------------------------------------------------------------
// Sheet list
// ---------------------------------------------------------------------------
export function buildSheets(p: Project, bom: Bom, cover: CanvasImageSource | null): SheetSpec[] {
  const lang = getLang();
  const sheets: SheetSpec[] = [];
  const cur = p.prices.currency;
  const walls = getWalls(p.room);
  const b = bounds(p.room.points);

  // ---- cover ----
  sheets.push({
    id: 'cover',
    title: L('ملخص المشروع', 'Project summary'),
    draw: (k) => {
      const rtl = k.rtl;
      const imgBox = { x: rtl ? 106 : CX0, y: CY0 + 2, w: 181, h: 120 };
      const side = { x: rtl ? CX0 : 196, w: 91 };
      const ctx = k.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.rect(imgBox.x, imgBox.y, imgBox.w, imgBox.h);
      ctx.clip();
      if (cover) {
        const iw = (cover as HTMLImageElement).width as number;
        const ih = (cover as HTMLImageElement).height as number;
        const s = Math.max(imgBox.w / iw, imgBox.h / ih);
        ctx.drawImage(cover, imgBox.x + (imgBox.w - iw * s) / 2, imgBox.y + (imgBox.h - ih * s) / 2, iw * s, ih * s);
      } else {
        k.rect(imgBox.x, imgBox.y, imgBox.w, imgBox.h, { fill: '#f3f5f7', stroke: 'none' });
        drawPlan(k, p, bom, imgBox, false);
      }
      ctx.restore();
      k.rect(imgBox.x, imgBox.y, imgBox.w, imgBox.h, { stroke: SOFT, lw: 0.25 });

      const tx = rtl ? side.x + side.w : side.x;
      const al = rtl ? 'right' : 'left';
      k.text(L('مصمم المطابخ الذكي', 'Smart kitchen designer'), tx, CY0 + 7, { size: 3, color: '#0f766e', bold: true, align: al });
      k.text(p.name, tx, CY0 + 17, { size: 7, bold: true, align: al, maxWidth: side.w });
      k.text(fmtDate(p.updatedAt), tx, CY0 + 23.5, { size: 2.9, color: SOFT, align: al });
      const rows: [string, string][] = [
        [L('أبعاد الغرفة', 'Room size'), `${fmtCm(b.w)} × ${fmtCm(b.h)} × ${fmtCm(p.room.height)} cm`],
        [L('مساحة الأرضية', 'Floor area'), `${bom.roomAreaM2.toFixed(2)} m²`],
        [L('عدد الوحدات', 'Units'), `${bom.counts.total - bom.counts.appliance}  (${L('سفلي', 'base')} ${bom.counts.base} · ${L('علوي', 'wall')} ${bom.counts.wall} · ${L('أعمدة', 'tall')} ${bom.counts.tall})`],
        [L('الأجهزة', 'Appliances'), String(bom.counts.appliance)],
        [L('أطوال الوحدات', 'Cabinet run'), `${bom.runM.total.toFixed(2)} m`],
        [L('سطح العمل', 'Countertop'), `${bom.countertop.lengthM.toFixed(2)} m`],
        [L('ألواح الهيكل', 'Carcass sheets'), String(bom.sheets.carcass + bom.sheets.drawer)],
      ];
      let yy = CY0 + 31;
      for (const [a, c] of rows) {
        k.text(a, tx, yy, { size: 2.8, color: SOFT, align: al });
        k.text(c, rtl ? side.x : side.x + side.w, yy, { size: 2.9, bold: true, align: rtl ? 'left' : 'right' });
        k.line(side.x, yy + 1.8, side.x + side.w, yy + 1.8, 0.08, '#c9ced4');
        yy += 6.6;
      }
      k.rect(side.x, yy + 2, side.w, 21, { fill: '#0f172a', stroke: 'none' });
      k.text(L('التكلفة التقديرية الإجمالية', 'Estimated total cost'), side.x + side.w / 2, yy + 9, { size: 3, color: '#cbd5e1', align: 'center' });
      k.text(`${fmtNum(bom.cost.total)} ${cur}`, side.x + side.w / 2, yy + 18, { size: 6.4, bold: true, color: '#ffffff', align: 'center' });

      // finishes strip
      const fy = imgBox.y + imgBox.h + 7;
      k.text(L('الخامات والتشطيبات', 'Materials & finishes'), rtl ? CX1 : CX0, fy, { size: 3.6, bold: true, align: al });
      const fin = p.finishes;
      const ctF = countertopFinish(fin.countertop);
      const dl = (id: string) => {
        const f = doorFinish(id);
        return `${LT(DOOR_TYPES.find((d) => d.id === f.type)!.name)} – ${LT(f.name)}`;
      };
      const cards: { t: string; v: string; c: string }[] = [
        { t: L('ضلف الوحدات السفلية', 'Base fronts'), v: dl(fin.baseDoor), c: doorFinish(fin.baseDoor).color },
        { t: L('ضلف الوحدات العلوية', 'Wall fronts'), v: dl(fin.wallDoor), c: doorFinish(fin.wallDoor).color },
        { t: L('ضلف الأعمدة', 'Tall fronts'), v: dl(fin.tallDoor), c: doorFinish(fin.tallDoor).color },
        { t: L('سطح العمل', 'Countertop'), v: `${LT(ctF.name)} – ${fmtCm(fin.countertopT)} cm`, c: ctF.color },
        { t: L('المقابض', 'Handles'), v: `${LT(HANDLE_TYPES.find((h) => h.id === fin.handle)!.name)} – ${LT(handleColor(fin.handleColor).name)}`, c: handleColor(fin.handleColor).color },
      ];
      const cw = (CX1 - CX0 - 4 * 4) / 5;
      cards.forEach((c, i) => {
        const cx = rtl ? CX1 - (i + 1) * cw - i * 4 : CX0 + i * (cw + 4);
        const cy = fy + 4;
        k.rect(cx, cy, cw, 27, { fill: '#f6f7f8', stroke: '#c9ced4', lw: 0.15 });
        k.rect(rtl ? cx + cw - 12 : cx + 3, cy + 3, 9, 9, { fill: c.c, stroke: SOFT, lw: 0.15 });
        k.text(c.t, rtl ? cx + cw - 15 : cx + 15, cy + 9.4, { size: 2.6, color: SOFT, align: al, maxWidth: cw - 18 });
        k.text(c.v, rtl ? cx + cw - 3 : cx + 3, cy + 20, { size: 2.9, bold: true, align: al, maxWidth: cw - 6 });
      });
    },
  });

  // ---- plan ----
  const planSpec: SheetSpec = {
    id: 'plan',
    title: L('المسقط الأفقي', 'Floor plan'),
    draw: (k) => {
      const n = drawPlan(k, p, bom, { x: CX0, y: CY0, w: CX1 - CX0, h: CY1 - CY0 - 8 }, true);
      planSpec.scale = `1:${n}`;
      // legend
      const rtl = k.rtl;
      const items: [string, string][] = [
        ['B', L('وحدة سفلية', 'Base unit')],
        ['T', L('عمود', 'Tall unit')],
        ['W', L('وحدة علوية (خط متقطع)', 'Wall unit (dashed)')],
        ['A', L('جهاز', 'Appliance')],
      ];
      let lx = rtl ? CX1 : CX0;
      const ly = CY1 - 1;
      for (const [t, name] of items) {
        const wv = k.measure(name, 2.5) + 12;
        tagBubble(k, t, rtl ? lx - 3 : lx + 3, ly - 0.9, 2.2);
        k.text(name, rtl ? lx - 7 : lx + 7, ly, { size: 2.5, color: SOFT, align: rtl ? 'right' : 'left' });
        lx += rtl ? -wv : wv;
      }
      for (const key of Object.keys(UTIL)) {
        if (!p.room.utilities.some((u) => u.type === key)) continue;
        const nm = { water: L('مياه', 'Water'), drain: L('صرف', 'Drain'), electric: L('كهرباء', 'Power'), gas: L('غاز', 'Gas') }[key]!;
        const wv = k.measure(nm, 2.5) + 10;
        k.circle(rtl ? lx - 2 : lx + 2, ly - 0.9, 1.7, { fill: UTIL[key].c });
        k.text(UTIL[key].l, rtl ? lx - 2 : lx + 2, ly - 0.15, { size: 2, bold: true, align: 'center', color: '#fff' });
        k.text(nm, rtl ? lx - 5.5 : lx + 5.5, ly, { size: 2.5, color: SOFT, align: rtl ? 'right' : 'left' });
        lx += rtl ? -wv : wv;
      }
    },
  };
  sheets.push(planSpec);

  // ---- elevations ----
  for (const w of walls) {
    const has = p.items.some((it) => itemWall(it, [w]));
    if (!has) continue;
    const spec: SheetSpec = {
      id: 'elev-' + w.i,
      title: L(`واجهة الحائط ${w.i + 1}`, `Wall ${w.i + 1} elevation`),
      draw: (k) => {
        const n = drawElevation(k, p, bom, w);
        spec.scale = `1:${n}`;
        k.text(L(`المشهد من داخل المطبخ باتجاه الحائط ${w.i + 1} — طول الحائط ${fmtCm(w.len)} سم`, `Viewed from inside the kitchen towards wall ${w.i + 1} — wall length ${fmtCm(w.len)} cm`), k.rtl ? CX1 : CX0, CY0 + 3, {
          size: 2.8,
          color: SOFT,
          align: k.rtl ? 'right' : 'left',
        });
      },
    };
    sheets.push(spec);
  }

  // ---- unit schedule ----
  const schedRows = bom.ordered.map((it) => [
    { t: bom.tags.get(it.id) ?? '', bold: true, color: '#0b5d57' },
    itemName(it, lang),
    LT(CAT_NAMES[it.cat]),
    fmtCm(it.w),
    fmtCm(it.d),
    fmtCm(it.h),
    fmtCm(it.elev),
    frontSummary(it),
    finishLabel(it, p),
  ]);
  chunk(schedRows, 29).forEach((rows, pi, all) => {
    sheets.push({
      id: 'sched-' + pi,
      title: L('جدول الوحدات والمكونات', 'Unit schedule') + (all.length > 1 ? ` (${pi + 1}/${all.length})` : ''),
      draw: (k) => {
        k.table(
          CX0,
          CY0 + 1,
          [
            { title: '#', w: 14, align: 'center' },
            { title: L('الوحدة', 'Unit'), w: 62 },
            { title: L('النوع', 'Type'), w: 20 },
            { title: L('العرض', 'W'), w: 17, align: 'center' },
            { title: L('العمق', 'D'), w: 17, align: 'center' },
            { title: L('الارتفاع', 'H'), w: 18, align: 'center' },
            { title: L('عن الأرض', 'Elev.'), w: 19, align: 'center' },
            { title: L('تقسيم الواجهة', 'Front layout'), w: 52 },
            { title: L('الخامة واللون', 'Finish'), w: 58 },
          ],
          rows,
        );
      },
    });
  });

  // ---- unit details (one drawing per distinct cabinet) ----
  const groups = new Map<string, { it: Item; tags: string[] }>();
  for (const it of bom.ordered) {
    if (it.cat === 'appliance' || it.opts.filler) continue;
    const key = JSON.stringify([it.type, it.w, it.d, it.h, it.elev > 0, it.opts, itemFinishId(it, p.finishes)]);
    const g = groups.get(key);
    const tag = bom.tags.get(it.id) ?? '';
    if (g) g.tags.push(tag);
    else groups.set(key, { it, tags: [tag] });
  }
  const details = [...groups.values()];
  chunk(details, 2).forEach((pair, pi, all) => {
    if (!details.length) return;
    sheets.push({
      id: 'detail-' + pi,
      title: L('تفاصيل الوحدات', 'Unit details') + ` (${pi + 1}/${all.length})`,
      draw: (k) => {
        const colW = (CX1 - CX0 - 6) / 2;
        pair.forEach((g, gi) => {
          const slot = k.rtl ? 1 - gi : gi;
          const bx = CX0 + slot * (colW + 6);
          const it = g.it;
          const al = k.rtl ? 'right' : 'left';
          const hx = k.rtl ? bx + colW : bx;
          k.rect(bx, CY0, colW, CY1 - CY0, { stroke: '#c9ced4', lw: 0.2 });
          k.rect(bx, CY0, colW, 9, { fill: '#eef2f4', stroke: 'none' });
          k.text(itemName(it, lang), hx + (k.rtl ? -3 : 3), CY0 + 6.2, { size: 3.4, bold: true, align: al, maxWidth: colW - 60 });
          k.text(`${g.tags.join(', ')}   ×${g.tags.length}`, k.rtl ? bx + 3 : bx + colW - 3, CY0 + 6.2, { size: 3, bold: true, color: '#0b5d57', align: k.rtl ? 'left' : 'right', maxWidth: 54 });
          // drawings
          const ct = it.opts.countertop ? p.finishes.countertopT : 0;
          const dh = 70;
          const sc = Math.min(64 / it.w, (dh - 16) / (it.h + ct), 34 / (it.d + 4));
          const baseY = CY0 + 14 + dh - 7;
          const fx = bx + 15 + (66 - it.w * sc) / 2;
          itemFront(k, it, p, fx, baseY, sc);
          k.dim(fx, baseY, fx + it.w * sc, baseY, 4, fmtCm(it.w), { size: 2.4 });
          k.dim(fx, baseY - it.h * sc, fx, baseY, 4.5, fmtCm(it.h), { size: 2.4 });
          const sx = bx + 92 + (38 - it.d * sc) / 2;
          itemSide(k, it, p, sx, baseY, sc);
          k.dim(sx, baseY, sx + it.d * sc, baseY, 4, fmtCm(it.d), { size: 2.4 });
          k.text(L('واجهة', 'Front'), fx + (it.w * sc) / 2, CY0 + 14, { size: 2.4, color: SOFT, align: 'center' });
          k.text(L('قطاع جانبي', 'Side section'), sx + (it.d * sc) / 2, CY0 + 14, { size: 2.4, color: SOFT, align: 'center' });
          // parts
          const parts = bom.partsByItem.get(it.id) ?? [];
          const matShort = (m: Part) => (m.material === 'carcass' ? L('هيكل', 'Carcass') : m.material === 'drawer' ? L('درج', 'Drawer') : m.material === 'back' ? 'HDF' : L('ضلف', 'Front'));
          const rows = parts.slice(0, 15).map((pt) => [LT(pt.name), String(pt.L), String(pt.W), String(pt.T), String(pt.qty), matShort(pt), LT(pt.edgeNote)]);
          const ty = CY0 + 14 + dh + 3;
          k.text(L('قطع الوحدة الواحدة (مم)', 'Parts per unit (mm)'), hx + (k.rtl ? -2 : 2), ty, { size: 2.7, bold: true, align: al });
          k.table(
            bx + 2,
            ty + 2,
            [
              { title: L('القطعة', 'Part'), w: 36 },
              { title: L('الطول', 'L'), w: 15, align: 'center' },
              { title: L('العرض', 'W'), w: 15, align: 'center' },
              { title: L('سمك', 'T'), w: 11, align: 'center' },
              { title: L('عدد', 'Qty'), w: 11, align: 'center' },
              { title: L('الخامة', 'Material'), w: 18 },
              { title: L('شريط الحرف', 'Edging'), w: colW - 4 - 106 },
            ],
            rows,
            { rowH: 4.6, size: 2.4 },
          );
          if (parts.length > 15) k.text(L(`+ ${parts.length - 15} قطعة أخرى في قائمة القص`, `+ ${parts.length - 15} more in the cut list`), hx + (k.rtl ? -2 : 2), CY1 - 2, { size: 2.3, color: SOFT, align: al });
        });
      },
    });
  });

  // ---- cut list ----
  const cut = consolidatedCutList(p, bom).map((r) => [r.material, r.name, { t: String(r.L), bold: true }, { t: String(r.W), bold: true }, String(r.T), { t: String(r.qty), bold: true }, r.edge ? (r.edge / 1000).toFixed(2) : '—', r.tags.join(' ')]);
  chunk(cut, 29).forEach((rows, pi, all) => {
    if (!cut.length) return;
    sheets.push({
      id: 'cut-' + pi,
      title: L('قائمة القص', 'Cut list') + (all.length > 1 ? ` (${pi + 1}/${all.length})` : ''),
      draw: (k) => {
        k.table(
          CX0,
          CY0 + 1,
          [
            { title: L('الخامة', 'Material'), w: 52 },
            { title: L('القطعة', 'Part'), w: 44 },
            { title: L('الطول مم', 'Length mm'), w: 23, align: 'center' },
            { title: L('العرض مم', 'Width mm'), w: 23, align: 'center' },
            { title: L('السمك', 'Thick.'), w: 16, align: 'center' },
            { title: L('العدد', 'Qty'), w: 15, align: 'center' },
            { title: L('شريط الحرف م', 'Edging m'), w: 24, align: 'center' },
            { title: L('الوحدات', 'Units'), w: 80 },
          ],
          rows,
        );
      },
    });
  });

  // ---- nesting ----
  const nestCells: { label: string; idx: number; count: number; g: (typeof bom.nesting)[number] }[] = [];
  for (const g of bom.nesting) g.result.sheets.forEach((_, i) => nestCells.push({ label: LT(g.label), idx: i, count: g.result.sheets.length, g }));
  chunk(nestCells, 4).forEach((cells, pi, all) => {
    if (!nestCells.length) return;
    sheets.push({
      id: 'nest-' + pi,
      title: L('مخطط توزيع القطع على الألواح', 'Sheet cutting layout') + ` (${pi + 1}/${all.length})`,
      draw: (k) => {
        const cw = (CX1 - CX0 - 6) / 2;
        const ch = (CY1 - CY0 - 6) / 2;
        cells.forEach((c, ci) => {
          const col = k.rtl ? 1 - (ci % 2) : ci % 2;
          const x = CX0 + col * (cw + 6);
          const y = CY0 + Math.floor(ci / 2) * (ch + 6);
          const sheet = c.g.result.sheets[c.idx];
          const { sheetL, sheetW } = c.g.result;
          k.text(`${c.label} — ${L('لوح', 'sheet')} ${c.idx + 1}/${c.count}`, k.rtl ? x + cw : x, y + 4, { size: 2.9, bold: true, align: k.rtl ? 'right' : 'left', maxWidth: cw - 40 });
          const used = sheet.usedArea / (sheetL * sheetW);
          k.text(sheet.oversize ? L('قطعة أكبر من اللوح!', 'Larger than a sheet!') : `${L('استغلال', 'Yield')} ${(used * 100).toFixed(0)}%`, k.rtl ? x : x + cw, y + 4, { size: 2.6, color: sheet.oversize ? '#cf3f3f' : SOFT, align: k.rtl ? 'left' : 'right' });
          const s = Math.min(cw / sheetL, (ch - 8) / sheetW);
          const sx = x + (cw - sheetL * s) / 2;
          const sy = y + 7;
          k.rect(sx, sy, sheetL * s, sheetW * s, { fill: '#f3f5f7', stroke: INK, lw: 0.3 });
          for (const pc of sheet.pieces) {
            const px = sx + pc.x * s;
            const py = sy + pc.y * s;
            const pw = pc.pl * s;
            const ph = pc.pw * s;
            k.rect(px, py, pw, ph, { fill: sheet.oversize ? '#fde2e2' : '#e7dcc4', stroke: INK, lw: 0.15 });
            if (pw > 9 && ph > 5) {
              k.text(pc.label, px + pw / 2, py + ph / 2 - 0.2, { size: Math.min(2.4, ph * 0.36), bold: true, align: 'center', color: '#0b5d57' });
              if (ph > 8) k.text(`${pc.l}×${pc.w}`, px + pw / 2, py + ph / 2 + 2.6, { size: Math.min(2, pw * 0.16), align: 'center', color: SOFT });
            } else if (pw > 4 && ph > 9) {
              k.text(pc.label, px + pw / 2 + 0.7, py + ph / 2, { size: Math.min(2.2, pw * 0.5), bold: true, align: 'center', color: '#0b5d57', rotate: -90 });
            }
          }
          k.text(`${sheetL} × ${sheetW} mm`, sx + (sheetL * s) / 2, sy + sheetW * s + 3.4, { size: 2.3, color: SOFT, align: 'center' });
        });
      },
    });
  });

  // ---- materials, hardware, cost ----
  sheets.push({
    id: 'materials',
    title: L('قائمة الخامات والإكسسوارات والتكلفة', 'Materials, hardware & cost'),
    draw: (k) => {
      const half = (CX1 - CX0 - 8) / 2;
      const leftX = k.rtl ? CX0 + half + 8 : CX0;
      const rightX = k.rtl ? CX0 : CX0 + half + 8;
      const al = k.rtl ? 'right' : 'left';
      const hx = (x: number) => (k.rtl ? x + half : x);
      const m2 = (v: number) => v.toFixed(2);
      const matRows: string[][] = [
        [L('ألواح الهيكل', 'Carcass sheets'), String(bom.sheets.carcass), L('لوح', 'sheet'), `${m2(bom.areas.carcass)} m²`],
        [L('ألواح صناديق الأدراج', 'Drawer box sheets'), String(bom.sheets.drawer), L('لوح', 'sheet'), `${m2(bom.areas.drawer)} m²`],
        [L('ألواح الظهر HDF', 'HDF back sheets'), String(bom.sheets.back), L('لوح', 'sheet'), `${m2(bom.areas.back)} m²`],
        ...Object.entries(bom.areas.frontByFinish).map(([fid, a]) => {
          const f = doorFinish(fid);
          return [`${L('ضلف', 'Fronts')} ${LT(DOOR_TYPES.find((d) => d.id === f.type)!.name)} – ${LT(f.name)}`, String(bom.sheets.fronts[fid] ?? 0), L('لوح', 'sheet'), `${m2(a)} m²`];
        }),
        [L('شريط الحرف (شامل الهالك)', 'Edge banding (incl. waste)'), bom.edgeM.toFixed(1), L('م', 'm'), ''],
        [`${L('سطح العمل', 'Countertop')} – ${LT(countertopFinish(p.finishes.countertop).name)}`, bom.countertop.lengthM.toFixed(2), L('م', 'm'), `${m2(bom.countertop.areaM2)} m²`],
        [L('تجليد الحائط', 'Backsplash'), bom.backsplash.lengthM.toFixed(2), L('م', 'm'), `${m2(bom.backsplash.areaM2)} m²`],
      ].filter((r) => parseFloat(r[1]) > 0);
      k.text(L('الخامات', 'Materials'), hx(leftX), CY0 + 4, { size: 3.4, bold: true, align: al });
      let y = k.table(
        leftX,
        CY0 + 6,
        [
          { title: L('البند', 'Item'), w: half - 62 },
          { title: L('الكمية', 'Qty'), w: 18, align: 'center', bold: true },
          { title: L('الوحدة', 'Unit'), w: 16, align: 'center' },
          { title: L('المساحة', 'Area'), w: 28, align: 'center' },
        ],
        matRows,
        { rowH: 5 },
      );
      const hw = bom.hw;
      const hwRows: string[][] = [
        [L('مفصلات', 'Hinges'), String(hw.hinges), L('قطعة', 'pc')],
        [L('مقابض', 'Handles'), String(hw.handles), L('قطعة', 'pc')],
        [L('بروفيل جولا', 'Gola profile'), (hw.golaCm / 100).toFixed(2), L('م', 'm')],
        [L('مجاري أدراج', 'Drawer slides'), String(hw.slides), L('زوج', 'pair')],
        [L('أذرع قلاب', 'Flap lifts'), String(hw.flapLifts), L('طقم', 'set')],
        [L('أرجل', 'Legs'), String(hw.legs), L('قطعة', 'pc')],
        [L('علّاقات علوية', 'Wall hangers'), String(hw.hangers), L('قطعة', 'pc')],
        [L('حوامل أرفف', 'Shelf pins'), String(hw.shelfPins), L('قطعة', 'pc')],
        [L('مسامير تجميع (تقديري)', 'Assembly screws (approx.)'), String(hw.screws), L('قطعة', 'pc')],
        [L('وزرة', 'Plinth'), (hw.plinthCm / 100).toFixed(2), L('م', 'm')],
        [L('إضاءة LED', 'LED strip'), (hw.ledCm / 100).toFixed(2), L('م', 'm')],
        [L('أحواض', 'Sinks'), String(hw.sinks), L('قطعة', 'pc')],
        [L('مسطحات طهي', 'Hobs'), String(hw.hobs), L('قطعة', 'pc')],
      ].filter((r) => parseFloat(r[1]) > 0);
      k.text(L('الإكسسوارات', 'Hardware'), hx(leftX), y + 8, { size: 3.4, bold: true, align: al });
      k.table(
        leftX,
        y + 10,
        [
          { title: L('البند', 'Item'), w: half - 44 },
          { title: L('الكمية', 'Qty'), w: 22, align: 'center', bold: true },
          { title: L('الوحدة', 'Unit'), w: 22, align: 'center' },
        ],
        hwRows,
        { rowH: 5 },
      );

      k.text(L('التكلفة التقديرية', 'Cost estimate'), hx(rightX), CY0 + 4, { size: 3.4, bold: true, align: al });
      const costRows = bom.cost.lines.map((l) => [LT(l.label), `${l.qty % 1 ? l.qty.toFixed(2) : l.qty} ${LT(l.unit)}`, fmtNum(l.unitPrice), fmtNum(l.total)]);
      y = k.table(
        rightX,
        CY0 + 6,
        [
          { title: L('البند', 'Item'), w: half - 78 },
          { title: L('الكمية', 'Qty'), w: 26, align: 'center' },
          { title: L('سعر الوحدة', 'Unit price'), w: 24, align: 'center' },
          { title: L('الإجمالي', 'Total'), w: 28, align: 'center', bold: true },
        ],
        costRows,
        { rowH: 4.9, size: 2.55 },
      );
      const tot: [string, number, boolean][] = [
        [L('الخامات والإكسسوارات', 'Materials & hardware'), bom.cost.materials, false],
        [L('المصنعيات والخدمات', 'Labour & services'), bom.cost.services, false],
        [`${L('هامش الربح', 'Margin')} ${p.prices.margin}%`, bom.cost.margin, false],
        [L('الأجهزة', 'Appliances'), bom.cost.appliances, false],
        [`${L('الضريبة', 'Tax')} ${p.prices.tax}%`, bom.cost.tax, false],
        [L('الإجمالي', 'Total'), bom.cost.total, true],
      ];
      y += 3;
      for (const [label, v, strong] of tot) {
        if (!strong && v === 0) continue;
        if (strong) k.rect(rightX, y - 0.5, half, 8, { fill: '#0f172a', stroke: 'none' });
        k.text(label, k.rtl ? rightX + half - 2 : rightX + 2, y + (strong ? 5 : 4), { size: strong ? 3.4 : 2.8, bold: strong, color: strong ? '#fff' : INK, align: al });
        k.text(`${fmtNum(v)} ${cur}`, k.rtl ? rightX + 2 : rightX + half - 2, y + (strong ? 5 : 4), { size: strong ? 3.6 : 2.9, bold: true, color: strong ? '#fff' : INK, align: k.rtl ? 'left' : 'right' });
        y += strong ? 9 : 5.6;
      }
      k.text(L('تقدير مبدئي مبني على الأسعار المدخلة وقواعد التصنيع المحددة في التطبيق.', 'Preliminary estimate based on the prices and manufacturing rules entered in the app.'), hx(rightX), Math.min(y + 4, CY1 - 1), {
        size: 2.3,
        color: SOFT,
        align: al,
        maxWidth: half,
      });
    },
  });

  return sheets;
}

/** Render one sheet to a canvas at the given resolution. */
export function renderSheet(spec: SheetSpec, index: number, total: number, p: Project, pxPerMm: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = Math.round(PAGE_W * pxPerMm);
  cv.height = Math.round(PAGE_H * pxPerMm);
  const ctx = cv.getContext('2d')!;
  ctx.scale(pxPerMm, pxPerMm);
  const k = new Kit(ctx, getLang() === 'ar');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  // content first (clipped to the drawing area) so a sheet can report its scale to the title block
  ctx.save();
  ctx.beginPath();
  ctx.rect(6.2, 17, PAGE_W - 12.4, 178);
  ctx.clip();
  spec.draw(k);
  ctx.restore();
  frame(k, p, spec, index, total);
  return cv;
}

export async function ensureFonts(): Promise<void> {
  try {
    await Promise.all([document.fonts.load("500 16px 'Cairo Variable'", 'مطبخ Kitchen 123'), document.fonts.load("700 16px 'Cairo Variable'", 'مطبخ Kitchen 123')]);
  } catch {
    /* fall back to system fonts */
  }
}
