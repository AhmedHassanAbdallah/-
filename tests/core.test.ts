import { describe, expect, it } from 'vitest';
import { autoLayout, DEFAULT_AUTO } from '../src/lib/autolayout';
import { computeBom } from '../src/lib/bom';
import { CATALOG, createItem } from '../src/lib/catalog';
import { ensureClockwise, findProblems, getWalls, itemWall, lRoom, placeOnWall, rectRoom, resizeWall, signedArea, snapItem, uid } from '../src/lib/geometry';
import { cabinetLayout, sectionHeights } from '../src/lib/layout';
import { DEFAULT_FINISHES, DEFAULT_PRICES, DEFAULT_RULES } from '../src/lib/materials';
import { nest } from '../src/lib/nesting';
import { itemParts } from '../src/lib/parts';
import type { Project, Room } from '../src/types';

const room = (pts = rectRoom(420, 320)): Room => ({ points: ensureClockwise(pts), height: 280, wallThickness: 12, openings: [], utilities: [], columns: [] });
const project = (r: Room, items = [] as Project['items']): Project => ({
  id: 'p', name: 't', createdAt: 0, updatedAt: 0, room: r, items,
  finishes: { ...DEFAULT_FINISHES }, prices: JSON.parse(JSON.stringify(DEFAULT_PRICES)), rules: { ...DEFAULT_RULES },
});
const def = (k: string) => CATALOG.find((m) => m.key === k)!;

describe('geometry', () => {
  it('orients walls with inward normals', () => {
    const r = room();
    expect(signedArea(r.points)).toBeGreaterThan(0);
    const walls = getWalls(r);
    expect(walls[0].n).toEqual({ x: -0, y: 1 });
    expect(walls[1].n.x).toBeCloseTo(-1);
    expect(walls[1].angle).toBe(90);
    expect(ensureClockwise([...r.points].reverse())).toEqual(r.points);
  });
  it('snaps an item to the nearest wall and against neighbours', () => {
    const r = room();
    const walls = getWalls(r);
    const a = createItem(def('base_2d'), placeOnWall(walls[0], 0, 80, 58));
    const b = createItem(def('base_1d'), { x: 200, y: 200, rot: 0 });
    const s = snapItem(b, { x: 108, y: 40 }, r, [a]);
    expect(s.wall).toBe(0);
    expect(s.rot).toBe(0);
    expect(s.y).toBeCloseTo(29);
    expect(s.x).toBeCloseTo(80 + 22.5); // flush to the right of the 80 cm unit
    // right wall
    const s2 = snapItem(b, { x: 400, y: 150 }, r, [a]);
    expect(s2.wall).toBe(1);
    expect(s2.rot).toBe(90);
    expect(s2.x).toBeCloseTo(420 - 29);
  });
  it('detects overlaps and items outside the room', () => {
    const r = room();
    const walls = getWalls(r);
    const a = createItem(def('base_2d'), placeOnWall(walls[0], 0, 80, 58));
    const b = createItem(def('base_2d'), placeOnWall(walls[0], 40, 80, 58));
    const c = createItem(def('wall_2d'), placeOnWall(walls[0], 0, 80, 34));
    const d = createItem(def('base_1d'), { x: 500, y: 100, rot: 0 });
    const pr = findProblems([a, b, c, d], r);
    expect(pr.get(a.id)).toBe('overlap');
    expect(pr.get(b.id)).toBe('overlap');
    expect(pr.has(c.id)).toBe(false); // wall unit above a base unit is fine
    expect(pr.get(d.id)).toBe('outside');
  });
  it('resizes a wall by stretching the room', () => {
    const r = room();
    const res = resizeWall(r, 0, 500);
    expect(res.points[1]).toEqual({ x: 500, y: 0 });
    expect(res.points[2]).toEqual({ x: 500, y: 320 });
    expect(res.points[3]).toEqual({ x: 0, y: 320 });
  });
});

describe('cabinet layout & parts', () => {
  it('splits section heights', () => {
    expect(sectionHeights([{ kind: 'drawer', h: 14 }, { kind: 'door', h: 0 }], 72)).toEqual([14, 58]);
    expect(sectionHeights([{ kind: 'drawer', h: 0 }, { kind: 'drawer', h: 0 }], 72)).toEqual([36, 36]);
    expect(sectionHeights([{ kind: 'oven', h: 60 }, { kind: 'door', h: 60 }], 72)).toEqual([36, 36]);
  });
  it('produces a cut list for a 2-door base unit', () => {
    const it0 = createItem(def('base_2d'), { x: 0, y: 0, rot: 0 });
    const lay = cabinetLayout(it0, DEFAULT_RULES, DEFAULT_FINISHES);
    expect(lay.plinth).toBe(10);
    expect(lay.fronts).toHaveLength(2);
    expect(lay.fronts[0].w).toBeCloseTo(39.7);
    expect(lay.fronts[0].h).toBeCloseTo(71.7);
    const { parts, hw } = itemParts(it0, DEFAULT_RULES, DEFAULT_FINISHES);
    const side = parts.find((p) => p.name.en === 'Side')!;
    expect([side.L, side.W, side.qty]).toEqual([720, 562, 2]);
    const bottom = parts.find((p) => p.name.en === 'Bottom')!;
    expect(bottom.L).toBe(800 - 36);
    expect(parts.filter((p) => p.material === 'front')).toHaveLength(2);
    expect(hw.hinges).toBe(4);
    expect(hw.handles).toBe(2);
    expect(hw.legs).toBe(4);
  });
  it('builds drawer boxes with slides', () => {
    const it0 = createItem(def('base_3dr'), { x: 0, y: 0, rot: 0 });
    const { parts, hw } = itemParts(it0, DEFAULT_RULES, DEFAULT_FINISHES);
    expect(hw.slides).toBe(3);
    expect(parts.filter((p) => p.name.en === 'Drawer side').reduce((s, p) => s + p.qty, 0)).toBe(6);
    expect(parts.find((p) => p.name.en === 'Drawer side')!.L).toBe(550);
  });
});

describe('nesting', () => {
  it('packs pieces into sheets without overlap', () => {
    const pieces = Array.from({ length: 30 }, (_, i) => ({ l: 720, w: 560 - (i % 3) * 40, label: 'B' + i, rotate: true }));
    const res = nest(pieces, 2440, 1220, 4);
    const placed = res.sheets.flatMap((s) => s.pieces);
    expect(placed).toHaveLength(30);
    for (const s of res.sheets) {
      for (let i = 0; i < s.pieces.length; i++) {
        const a = s.pieces[i];
        expect(a.x + a.pl).toBeLessThanOrEqual(2440);
        expect(a.y + a.pw).toBeLessThanOrEqual(1220);
        for (let j = i + 1; j < s.pieces.length; j++) {
          const b = s.pieces[j];
          const overlap = a.x < b.x + b.pl && b.x < a.x + a.pl && a.y < b.y + b.pw && b.y < a.y + a.pw;
          expect(overlap).toBe(false);
        }
      }
    }
    expect(res.sheets.length).toBeLessThanOrEqual(6);
  });
});

describe('auto layout', () => {
  const styles = ['I', 'L', 'U', 'auto'] as const;
  for (const style of styles) {
    it(`generates a clean ${style} layout`, () => {
      const r = room();
      r.openings.push({ id: uid(), type: 'window', wall: 0, offset: 150, width: 120, height: 110, sill: 100 });
      r.openings.push({ id: uid(), type: 'door', wall: 3, offset: 20, width: 90, height: 210, sill: 0 });
      const res = autoLayout(r, { ...DEFAULT_AUTO, style, dishwasher: true, pantry: true });
      expect(res.items.length).toBeGreaterThan(5);
      const problems = findProblems(res.items, r);
      expect([...problems.entries()].map(([id, pr]) => res.items.find((i) => i.id === id)!.type + ':' + pr)).toEqual([]);
      expect(res.items.some((i) => i.opts.sink)).toBe(true);
      expect(res.items.some((i) => i.opts.cooktop || i.appliance === 'cooker')).toBe(true);
      const walls = getWalls(r);
      for (const it0 of res.items) expect(itemWall(it0, walls)).not.toBeNull();
    });
  }
  it('works in an L-shaped room and with an island', () => {
    const r = room(lRoom(500, 400, 200, 150));
    const res = autoLayout(r, { ...DEFAULT_AUTO, island: true });
    expect(res.items.length).toBeGreaterThan(5);
    expect(findProblems(res.items, r).size).toBe(0);
    const big = room(rectRoom(600, 500));
    const res2 = autoLayout(big, { ...DEFAULT_AUTO, style: 'L', island: true });
    expect(res2.items.some((i) => i.type === 'island')).toBe(true);
    expect(findProblems(res2.items, big).size).toBe(0);
  });
});

describe('bom', () => {
  it('totals parts, hardware and cost', () => {
    const r = room();
    r.openings.push({ id: uid(), type: 'door', wall: 3, offset: 20, width: 90, height: 210, sill: 0 });
    const items = autoLayout(r, { ...DEFAULT_AUTO, style: 'L' }).items;
    const bom = computeBom(project(r, items));
    expect(bom.counts.total).toBe(items.length);
    expect(bom.parts.length).toBeGreaterThan(20);
    expect(bom.sheets.carcass).toBeGreaterThan(0);
    expect(bom.countertop.lengthM).toBeGreaterThan(2);
    expect(bom.cost.total).toBeGreaterThan(0);
    const sum = bom.cost.lines.reduce((s, l) => s + l.total, 0);
    expect(bom.cost.materials + bom.cost.services + bom.cost.appliances).toBeCloseTo(sum);
    expect(new Set(bom.tags.values()).size).toBe(items.length);
  });
});

describe('project normalisation', () => {
  it('fills defaults and drops broken items from imported files', async () => {
    const { normalizeProject } = await import('../src/store');
    const raw = {
      id: 'x', name: 'old', createdAt: 1, updatedAt: 1,
      room: { points: [{ x: 0, y: 0 }, { x: 0, y: 300 }, { x: 400, y: 300 }, { x: 400, y: 0 }] },
      items: [
        { id: 'a', type: 'base_2d', cat: 'base', x: 40, y: 29, rot: 0, w: 80, d: 58, h: 82, elev: 0 },
        { id: 'b', type: 'base_2d', cat: 'base', x: Number.NaN, y: 29, rot: 0, w: 80, d: 58, h: 82, elev: 0 },
      ],
    } as unknown as Project;
    const p = normalizeProject(raw);
    expect(signedArea(p.room.points)).toBeGreaterThan(0); // re-oriented clockwise
    expect(p.room.height).toBe(280);
    expect(p.items.map((i) => i.id)).toEqual(['a']);
    expect(p.items[0].opts).toEqual({});
    expect(p.finishes.countertop).toBe(DEFAULT_FINISHES.countertop);
    expect(p.prices.front.mdf).toBe(DEFAULT_PRICES.front.mdf);
    expect(computeBom(p).cost.total).toBeGreaterThan(0);
  });
});
