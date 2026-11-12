import type { Item, LText, Project } from '../types';
import { catLetter } from './catalog';
import { getWalls, itemWall, roomArea } from './geometry';
import { countertopFinish, doorFinish, splashFinish, DOOR_TYPES, COUNTERTOP_TYPES } from './materials';
import { nest, type NestPiece, type NestResult } from './nesting';
import { emptyHardware, itemParts, type Hardware, type Part } from './parts';

export interface CostLine {
  key: string;
  group: 'boards' | 'fronts' | 'tops' | 'hardware' | 'services' | 'appliances';
  label: LText;
  qty: number;
  unit: LText;
  unitPrice: number;
  total: number;
}

export interface CountertopRun {
  /** cm */
  length: number;
  depth: number;
  wall: number | null;
  itemIds: string[];
  island: boolean;
}

export interface Bom {
  tags: Map<string, string>;
  ordered: Item[];
  parts: Part[];
  partsByItem: Map<string, Part[]>;
  hw: Hardware;
  counts: { base: number; wall: number; tall: number; appliance: number; total: number };
  /** linear metres of cabinets */
  runM: { base: number; wall: number; tall: number; total: number };
  areas: { carcass: number; drawer: number; back: number; front: number; frontByFinish: Record<string, number> };
  nesting: { key: string; label: LText; result: NestResult }[];
  sheets: { carcass: number; drawer: number; back: number; fronts: Record<string, number> };
  edgeM: number;
  countertop: { runs: CountertopRun[]; lengthM: number; areaM2: number; pricedM: number };
  backsplash: { lengthM: number; areaM2: number };
  roomAreaM2: number;
  cost: { lines: CostLine[]; materials: number; services: number; appliances: number; subtotal: number; margin: number; tax: number; total: number };
}

const U = {
  sheet: { ar: 'لوح', en: 'sheet' },
  m2: { ar: 'م²', en: 'm²' },
  m: { ar: 'م', en: 'm' },
  pc: { ar: 'قطعة', en: 'pc' },
  pair: { ar: 'زوج', en: 'pair' },
  set: { ar: 'طقم', en: 'set' },
  job: { ar: 'مقطوعية', en: 'lump sum' },
};

/** Stable unit tags (B1, W2 …) ordered along the walls. */
export function tagItems(p: Pick<Project, 'items' | 'room'>): { tags: Map<string, string>; ordered: Item[] } {
  const walls = getWalls(p.room);
  const keyed = p.items.map((it, idx) => {
    const att = itemWall(it, walls);
    return { it, wall: att ? att.wall.i : 999, t: att ? att.t0 : idx };
  });
  const catOrder = { base: 0, tall: 1, wall: 2, appliance: 3 } as const;
  keyed.sort((a, b) => catOrder[a.it.cat] - catOrder[b.it.cat] || a.wall - b.wall || a.t - b.t);
  const counters: Record<string, number> = {};
  const tags = new Map<string, string>();
  for (const k of keyed) {
    const letter = catLetter(k.it.cat);
    counters[letter] = (counters[letter] ?? 0) + 1;
    tags.set(k.it.id, letter + counters[letter]);
  }
  return { tags, ordered: keyed.map((k) => k.it) };
}

export function countertopRuns(p: Pick<Project, 'items' | 'room' | 'finishes'>): CountertopRun[] {
  const walls = getWalls(p.room);
  const runs: CountertopRun[] = [];
  const byWall = new Map<number, { it: Item; t0: number; t1: number }[]>();
  for (const it of p.items) {
    if (!it.opts.countertop) continue;
    if (it.opts.island) {
      runs.push({ length: it.w + 2 * p.finishes.overhang, depth: it.d + 2 * p.finishes.overhang, wall: null, itemIds: [it.id], island: true });
      continue;
    }
    const att = itemWall(it, walls);
    if (!att) {
      runs.push({ length: it.w, depth: it.d + p.finishes.overhang, wall: null, itemIds: [it.id], island: false });
      continue;
    }
    const list = byWall.get(att.wall.i) ?? [];
    list.push({ it, t0: att.t0, t1: att.t1 });
    byWall.set(att.wall.i, list);
  }
  for (const [wall, list] of byWall) {
    list.sort((a, b) => a.t0 - b.t0);
    let cur: CountertopRun | null = null;
    let end = -Infinity;
    for (const e of list) {
      if (cur && e.t0 - end < 1.5) {
        cur.length += e.t1 - Math.max(end, e.t0);
        cur.depth = Math.max(cur.depth, e.it.d + p.finishes.overhang);
        cur.itemIds.push(e.it.id);
      } else {
        cur = { length: e.t1 - e.t0, depth: e.it.d + p.finishes.overhang, wall, itemIds: [e.it.id], island: false };
        runs.push(cur);
      }
      end = Math.max(end, e.t1);
    }
  }
  return runs;
}

export function computeBom(p: Project): Bom {
  const { tags, ordered } = tagItems(p);
  const parts: Part[] = [];
  const partsByItem = new Map<string, Part[]>();
  const hw = emptyHardware();
  const counts = { base: 0, wall: 0, tall: 0, appliance: 0, total: 0 };
  const runCm = { base: 0, wall: 0, tall: 0 };
  let applianceCost = 0;

  for (const it of ordered) {
    counts[it.cat]++;
    counts.total++;
    if (it.cat === 'appliance') {
      applianceCost += it.price ?? 0;
      continue;
    }
    if (!it.opts.filler) runCm[it.cat] += it.w;
    const res = itemParts(it, p.rules, p.finishes);
    parts.push(...res.parts);
    partsByItem.set(it.id, res.parts);
    (Object.keys(hw) as (keyof Hardware)[]).forEach((k) => (hw[k] += res.hw[k]));
  }

  // ---- areas & nesting ----
  const areas = { carcass: 0, drawer: 0, back: 0, front: 0, frontByFinish: {} as Record<string, number> };
  const groups = new Map<string, { label: LText; pieces: NestPiece[] }>();
  const groupOf = (key: string, label: LText) => {
    let g = groups.get(key);
    if (!g) {
      g = { label, pieces: [] };
      groups.set(key, g);
    }
    return g;
  };
  let edgeMm = 0;
  for (const part of parts) {
    const a = (part.L * part.W * part.qty) / 1e6;
    edgeMm += part.edge * part.qty;
    let key: string;
    let label: LText;
    if (part.material === 'carcass') {
      areas.carcass += a;
      key = 'carcass';
      label = { ar: `ألواح الهيكل ${part.T} مم`, en: `Carcass board ${part.T} mm` };
    } else if (part.material === 'drawer') {
      areas.drawer += a;
      key = 'drawer';
      label = { ar: `ألواح صناديق الأدراج ${part.T} مم`, en: `Drawer box board ${part.T} mm` };
    } else if (part.material === 'back') {
      areas.back += a;
      key = 'back';
      label = { ar: `ألواح الظهر HDF ${part.T} مم`, en: `HDF back ${part.T} mm` };
    } else {
      areas.front += a;
      const fid = part.finish ?? '';
      areas.frontByFinish[fid] = (areas.frontByFinish[fid] ?? 0) + a;
      key = 'front:' + fid;
      const f = doorFinish(fid);
      const ty = DOOR_TYPES.find((d) => d.id === f.type)!;
      label = { ar: `ضلف ${ty.name.ar} – ${f.name.ar}`, en: `Fronts ${ty.name.en} – ${f.name.en}` };
    }
    const g = groupOf(key, label);
    const tag = tags.get(part.itemId) ?? '';
    for (let i = 0; i < part.qty; i++) g.pieces.push({ l: part.L, w: part.W, label: tag, rotate: !part.grain && part.material !== 'front' });
  }
  const nesting: Bom['nesting'] = [];
  const sheets = { carcass: 0, drawer: 0, back: 0, fronts: {} as Record<string, number> };
  const order = ['carcass', 'drawer', 'back'];
  const keys = [...groups.keys()].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || a.localeCompare(b);
  });
  for (const key of keys) {
    const g = groups.get(key)!;
    const result = nest(g.pieces, p.rules.sheetL, p.rules.sheetW, p.rules.kerf);
    nesting.push({ key, label: g.label, result });
    if (key === 'carcass') sheets.carcass = result.sheets.length;
    else if (key === 'drawer') sheets.drawer = result.sheets.length;
    else if (key === 'back') sheets.back = result.sheets.length;
    else sheets.fronts[key.slice(6)] = result.sheets.length;
  }
  const edgeM = (edgeMm / 1000) * (1 + p.rules.edgeWaste / 100);

  // ---- countertop & backsplash ----
  const runs = countertopRuns(p);
  const ctLen = runs.reduce((s, r) => s + r.length, 0) / 100;
  const ctArea = runs.reduce((s, r) => s + r.length * r.depth, 0) / 10000;
  const pricedM = runs.reduce((s, r) => s + (r.length / 100) * Math.max(1, r.depth / 62), 0);
  const splash = splashFinish(p.finishes.backsplash);
  const wallRuns = runs.filter((r) => r.wall !== null);
  const splashLen = splash.tex === 'none' ? 0 : wallRuns.reduce((s, r) => s + r.length, 0) / 100;
  const splashH = 0.6;
  const backsplash = { lengthM: splashLen, areaM2: splashLen * splashH };

  // ---- cost ----
  const pr = p.prices;
  const lines: CostLine[] = [];
  const line = (key: string, group: CostLine['group'], label: LText, qty: number, unit: LText, unitPrice: number) => {
    if (qty <= 0) return;
    lines.push({ key, group, label, qty, unit, unitPrice, total: qty * unitPrice });
  };
  line('carcass', 'boards', { ar: 'ألواح الهيكل', en: 'Carcass boards' }, sheets.carcass + sheets.drawer, U.sheet, pr.carcassSheet);
  line('back', 'boards', { ar: 'ألواح الظهر HDF', en: 'HDF back sheets' }, sheets.back, U.sheet, pr.backSheet);
  const frontByType: Record<string, number> = {};
  for (const [fid, a] of Object.entries(areas.frontByFinish)) {
    const ty = doorFinish(fid).type;
    frontByType[ty] = (frontByType[ty] ?? 0) + a * 1.1;
  }
  for (const ty of DOOR_TYPES) {
    const a = frontByType[ty.id];
    if (a) line('front-' + ty.id, 'fronts', { ar: `ضلف ${ty.name.ar} (شامل هالك 10%)`, en: `${ty.name.en} fronts (incl. 10% waste)` }, a, U.m2, pr.front[ty.id]);
  }
  const ct = countertopFinish(p.finishes.countertop);
  const ctType = COUNTERTOP_TYPES.find((c) => c.id === ct.type)!;
  line('countertop', 'tops', { ar: `سطح العمل – ${ctType.name.ar}`, en: `Countertop – ${ctType.name.en}` }, pricedM, U.m, pr.countertop[ct.type]);
  line('backsplash', 'tops', { ar: 'تجليد الحائط (باك سبلاش)', en: 'Backsplash' }, backsplash.areaM2, U.m2, pr.backsplash);
  line('edge', 'hardware', { ar: 'شريط حرف (كنار)', en: 'Edge banding' }, edgeM, U.m, pr.edge);
  line('hinge', 'hardware', { ar: 'مفصلات', en: 'Hinges' }, hw.hinges, U.pc, pr.hinge);
  line('handle', 'hardware', { ar: 'مقابض', en: 'Handles' }, hw.handles, U.pc, pr.handle);
  line('gola', 'hardware', { ar: 'بروفيل جولا', en: 'Gola profile' }, hw.golaCm / 100, U.m, pr.gola);
  line('slide', 'hardware', { ar: 'مجاري أدراج', en: 'Drawer slides' }, hw.slides, U.pair, pr.slide);
  line('flap', 'hardware', { ar: 'أذرع قلاب', en: 'Flap lifts' }, hw.flapLifts, U.set, pr.flapLift);
  line('leg', 'hardware', { ar: 'أرجل', en: 'Legs' }, hw.legs, U.pc, pr.leg);
  line('hanger', 'hardware', { ar: 'علّاقات الوحدات العلوية', en: 'Wall hangers' }, hw.hangers, U.pc, pr.hanger);
  line('pin', 'hardware', { ar: 'حوامل أرفف', en: 'Shelf pins' }, hw.shelfPins, U.pc, pr.shelfPin);
  line('plinth', 'hardware', { ar: 'وزرة', en: 'Plinth' }, hw.plinthCm / 100, U.m, pr.plinth);
  line('led', 'hardware', { ar: 'إضاءة LED', en: 'LED strip' }, hw.ledCm / 100, U.m, pr.led);
  line('sink', 'hardware', { ar: 'حوض + خلاط', en: 'Sink + mixer' }, hw.sinks, U.set, pr.sinkSet);
  const runM = { base: runCm.base / 100, wall: runCm.wall / 100, tall: runCm.tall / 100, total: (runCm.base + runCm.wall + runCm.tall) / 100 };
  line('labor', 'services', { ar: 'مصنعية التصنيع', en: 'Manufacturing labour' }, runM.total, U.m, pr.laborPerM);
  if (counts.total - counts.appliance > 0) {
    line('install', 'services', { ar: 'التركيب', en: 'Installation' }, 1, U.job, pr.install);
    line('transport', 'services', { ar: 'النقل', en: 'Transport' }, 1, U.job, pr.transport);
  }
  if (applianceCost > 0) line('appliances', 'appliances', { ar: 'الأجهزة', en: 'Appliances' }, 1, U.job, applianceCost);

  const materials = lines.filter((l) => l.group !== 'services' && l.group !== 'appliances').reduce((s, l) => s + l.total, 0);
  const services = lines.filter((l) => l.group === 'services').reduce((s, l) => s + l.total, 0);
  const base = materials + services;
  const margin = (base * pr.margin) / 100;
  const subtotal = base + margin + applianceCost;
  const tax = (subtotal * pr.tax) / 100;

  return {
    tags,
    ordered,
    parts,
    partsByItem,
    hw,
    counts,
    runM,
    areas,
    nesting,
    sheets,
    edgeM,
    countertop: { runs, lengthM: ctLen, areaM2: ctArea, pricedM },
    backsplash,
    roomAreaM2: roomArea(p.room),
    cost: { lines, materials, services, appliances: applianceCost, subtotal, margin, tax, total: subtotal + tax },
  };
}
