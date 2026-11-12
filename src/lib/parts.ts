import type { Finishes, Item, LText, Rules } from '../types';
import { cabinetLayout, hasPlinth, itemFinishId } from './layout';
import { doorFinish } from './materials';

export type PartMaterial = 'carcass' | 'front' | 'back' | 'drawer';

/** One line of the cut list. Dimensions in mm. */
export interface Part {
  itemId: string;
  name: LText;
  material: PartMaterial;
  /** door finish id for front parts */
  finish?: string;
  /** length (along the grain) and width */
  L: number;
  W: number;
  T: number;
  qty: number;
  /** edge banding per piece, mm */
  edge: number;
  edgeNote: LText;
  /** piece shows a grain direction and must not be rotated when nesting */
  grain: boolean;
}

export interface Hardware {
  hinges: number;
  handles: number;
  slides: number;
  legs: number;
  hangers: number;
  flapLifts: number;
  shelfPins: number;
  screws: number;
  plinthCm: number;
  ledCm: number;
  golaCm: number;
  sinks: number;
  hobs: number;
}

export const emptyHardware = (): Hardware => ({
  hinges: 0,
  handles: 0,
  slides: 0,
  legs: 0,
  hangers: 0,
  flapLifts: 0,
  shelfPins: 0,
  screws: 0,
  plinthCm: 0,
  ledCm: 0,
  golaCm: 0,
  sinks: 0,
  hobs: 0,
});

const r = (v: number) => Math.max(0, Math.round(v));

const EDGE = {
  none: { ar: '—', en: '—' },
  front: { ar: 'حرف أمامي', en: 'front edge' },
  all: { ar: '4 جوانب', en: '4 sides' },
  top: { ar: 'حرف علوي', en: 'top edge' },
  frontBottom: { ar: 'أمامي + سفلي', en: 'front + bottom' },
};

export function hingesForDoor(heightMm: number): number {
  if (heightMm <= 900) return 2;
  if (heightMm <= 1500) return 3;
  if (heightMm <= 2000) return 4;
  return 5;
}

/** Standard drawer-slide length (mm) that fits a carcass depth. */
export function slideLength(carcassDepthMm: number): number {
  const max = carcassDepthMm - 10;
  const std = [550, 500, 450, 400, 350, 300, 250];
  return std.find((s) => s <= max) ?? 250;
}

export function itemParts(it: Item, rules: Rules, fin: Finishes): { parts: Part[]; hw: Hardware } {
  const parts: Part[] = [];
  const hw = emptyHardware();
  if (it.cat === 'appliance') return { parts, hw };

  const t = rules.boardT;
  const W = it.w * 10;
  const lay = cabinetLayout(it, rules, fin);
  const Hc = lay.carcassH * 10;
  const CD = it.d * 10 - rules.frontT;
  const finishId = itemFinishId(it, fin);
  const frontGrain = !!doorFinish(finishId).grain;
  const push = (p: Omit<Part, 'itemId' | 'T' | 'grain'> & { T?: number; grain?: boolean }) => {
    if (p.L <= 0 || p.W <= 0 || p.qty <= 0) return;
    parts.push({
      itemId: it.id,
      T: p.T ?? (p.material === 'back' ? rules.backT : p.material === 'drawer' ? rules.drawerT : p.material === 'front' ? rules.frontT : t),
      grain: p.grain ?? false,
      ...p,
      L: r(p.L),
      W: r(p.W),
      edge: r(p.edge),
    });
  };

  const floorUnit = hasPlinth(it);
  if (floorUnit) hw.plinthCm += it.opts.island ? 2 * it.w + 2 * it.d : it.w;

  if (it.opts.slat) {
    const n = Math.max(1, Math.floor(it.w / 4.2));
    push({ name: { ar: 'لوح خلفية البانوه', en: 'Panel backing' }, material: 'front', finish: finishId, L: it.h * 10, W: W, qty: 1, edge: 2 * (it.h * 10 + W), edgeNote: EDGE.all, grain: frontGrain });
    push({ name: { ar: 'سدابة مضلّعة', en: 'Batten' }, material: 'front', finish: finishId, L: it.h * 10, W: 24, qty: n, edge: 2 * it.h * 10, edgeNote: EDGE.front, grain: frontGrain });
    return { parts, hw };
  }
  if (it.opts.filler) {
    push({ name: { ar: 'حشوة أمامية', en: 'Filler front' }, material: 'front', finish: finishId, L: Hc, W: W, qty: 1, edge: 2 * (Hc + W), edgeNote: EDGE.all, grain: frontGrain });
    return { parts, hw };
  }

  const innerW = W - 2 * t;
  // ---- carcass ----
  push({
    name: { ar: 'جنب', en: 'Side' },
    material: 'carcass',
    L: Hc,
    W: CD,
    qty: 2,
    edge: it.cat === 'wall' ? Hc + CD : Hc,
    edgeNote: it.cat === 'wall' ? EDGE.frontBottom : EDGE.front,
  });
  push({ name: { ar: 'قاعدة', en: 'Bottom' }, material: 'carcass', L: innerW, W: CD, qty: 1, edge: innerW, edgeNote: EDGE.front });
  hw.screws += 4;
  if (it.cat === 'base') {
    push({ name: { ar: 'عارضة علوية', en: 'Top rail' }, material: 'carcass', L: innerW, W: rules.stretcherW, qty: 2, edge: innerW, edgeNote: EDGE.front });
    hw.screws += 8;
  } else {
    push({ name: { ar: 'سقف', en: 'Top' }, material: 'carcass', L: innerW, W: CD, qty: 1, edge: innerW, edgeNote: EDGE.front });
    hw.screws += 4;
  }
  // fixed dividers between sections that need a structural shelf
  let dividers = 0;
  for (let i = 0; i < lay.bands.length - 1; i++) {
    const a = lay.bands[i].kind;
    const b = lay.bands[i + 1].kind;
    const structural = (k: string) => k === 'oven' || k === 'micro' || k === 'open' || k === 'glass';
    if (structural(a) || structural(b) || (it.cat === 'tall' && a !== b) || (it.cat === 'tall' && a === 'door' && b === 'door')) dividers++;
  }
  if (dividers) {
    push({ name: { ar: 'رف ثابت (فاصل)', en: 'Fixed shelf (divider)' }, material: 'carcass', L: innerW, W: CD, qty: dividers, edge: innerW, edgeNote: EDGE.front });
    hw.screws += 4 * dividers;
  }
  const shelves = it.opts.shelves ?? 0;
  if (shelves > 0) {
    push({
      name: { ar: 'رف متحرك', en: 'Adjustable shelf' },
      material: 'carcass',
      L: innerW - 2,
      W: CD - rules.shelfSetback,
      qty: shelves,
      edge: innerW - 2,
      edgeNote: EDGE.front,
    });
    hw.shelfPins += shelves * 4;
  }
  push({ name: { ar: 'ظهر', en: 'Back panel' }, material: 'back', L: Hc - 4, W: W - 4, qty: 1, edge: 0, edgeNote: EDGE.none });
  if (it.opts.blind) {
    const bw = (lay.x0 > 0 ? lay.x0 : it.w - lay.x1) * 10;
    push({ name: { ar: 'لوح الجزء الأعمى', en: 'Blind panel' }, material: 'carcass', L: Hc, W: bw, qty: 1, edge: Hc, edgeNote: EDGE.front });
  }
  if (it.opts.island) {
    push({ name: { ar: 'ظهر ديكوري', en: 'Decorative back' }, material: 'front', finish: finishId, L: Hc, W: W, qty: 1, edge: 2 * (Hc + W), edgeNote: EDGE.all, grain: frontGrain });
    push({ name: { ar: 'جنب ديكوري', en: 'Decorative end panel' }, material: 'front', finish: finishId, L: Hc, W: it.d * 10, qty: 2, edge: 2 * (Hc + it.d * 10), edgeNote: EDGE.all, grain: frontGrain });
  }

  // ---- fronts & hardware ----
  const usesHandles = fin.handle === 'bar' || fin.handle === 'knob' || fin.handle === 'cup';
  let drawerRows = 0;
  for (const f of lay.fronts) {
    const fl = f.h * 10;
    const fw = f.w * 10;
    const nameByKind: Record<string, LText> = {
      door: { ar: 'ضلفة', en: 'Door' },
      glass: { ar: 'ضلفة زجاج (إطار)', en: 'Glass door (frame)' },
      drawer: { ar: 'وجه درج', en: 'Drawer front' },
      flap: { ar: 'قلاب', en: 'Flap front' },
      panel: { ar: 'وجه ثابت', en: 'Fixed front' },
    };
    push({
      name: nameByKind[f.kind] ?? nameByKind.door,
      material: 'front',
      finish: finishId,
      L: f.kind === 'drawer' || f.kind === 'flap' ? fw : fl,
      W: f.kind === 'drawer' || f.kind === 'flap' ? fl : fw,
      qty: 1,
      edge: 2 * (fl + fw),
      edgeNote: EDGE.all,
      grain: frontGrain,
    });
    if (f.kind === 'door' || f.kind === 'glass') {
      hw.hinges += hingesForDoor(fl);
      if (usesHandles) hw.handles += 1;
    } else if (f.kind === 'flap') {
      hw.hinges += 2;
      hw.flapLifts += 1;
      if (usesHandles) hw.handles += 1;
    } else if (f.kind === 'drawer') {
      drawerRows++;
      hw.slides += 1;
      if (usesHandles) hw.handles += 1;
      // drawer box
      const SL = slideLength(CD);
      const boxW = innerW - rules.slideClear;
      const boxH = Math.max(60, Math.min(200, Math.floor((fl - 40) / 10) * 10));
      const dt = rules.drawerT;
      push({ name: { ar: 'جنب درج', en: 'Drawer side' }, material: 'drawer', L: SL, W: boxH, qty: 2, edge: SL, edgeNote: EDGE.top });
      push({ name: { ar: 'صدر/ظهر درج', en: 'Drawer front/back' }, material: 'drawer', L: boxW - 2 * dt, W: boxH, qty: 2, edge: boxW - 2 * dt, edgeNote: EDGE.top });
      push({ name: { ar: 'قاع درج', en: 'Drawer bottom' }, material: 'back', L: SL - 2, W: boxW - 2, qty: 1, edge: 0, edgeNote: EDGE.none });
      hw.screws += 8;
    }
  }
  if (fin.handle === 'gola' && it.cat !== 'wall') {
    hw.golaCm += it.w * (drawerRows >= 2 ? 2 : 1);
  }

  if (floorUnit) hw.legs += it.w > 90 ? 6 : 4;
  if (it.cat === 'wall') {
    hw.hangers += 2;
    if (it.opts.ledUnder ?? fin.led) hw.ledCm += it.w;
  }
  if (it.opts.ledInside) hw.ledCm += 2 * lay.carcassH + it.w;
  if (it.opts.sink) hw.sinks += 1;
  if (it.opts.cooktop) hw.hobs += 1;
  return { parts, hw };
}
