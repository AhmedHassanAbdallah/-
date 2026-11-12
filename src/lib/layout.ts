import type { Finishes, Item, Rules, Section, SectionKind } from '../types';

/**
 * Front layout of a cabinet, shared by the 3D builder, the elevation drawings and the cut list.
 * Coordinates are cm in the cabinet's front view: x from the viewer's left edge (0 → w), y from the
 * bottom of the item (0 → h).
 */
export interface FrontRect {
  kind: SectionKind;
  section: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hinge?: 'L' | 'R';
  /** handle centre and orientation, when the front carries one */
  handle?: { x: number; y: number; orient: 'v' | 'h'; len: number };
}

export interface SectionBand {
  kind: SectionKind;
  n: number;
  y0: number;
  y1: number;
}

export interface CabinetLayout {
  plinth: number;
  carcassH: number;
  /** usable front range (excludes the blind part of a corner unit) */
  x0: number;
  x1: number;
  bands: SectionBand[];
  fronts: FrontRect[];
}

export function hasPlinth(it: Item): boolean {
  return (it.cat === 'base' || it.cat === 'tall') && it.elev < 1;
}

export function sectionHeights(sections: Section[], total: number): number[] {
  if (!sections.length) return [];
  const fixed = sections.reduce((s, x) => s + (x.h > 0 ? x.h : 0), 0);
  const autos = sections.filter((x) => !(x.h > 0)).length;
  if (autos === 0) {
    const k = fixed > 0 ? total / fixed : 1;
    return sections.map((x) => x.h * k);
  }
  const minAuto = 8;
  if (fixed + autos * minAuto > total) {
    // squeeze fixed sections so every auto section keeps a minimum height
    const k = Math.max(0.1, (total - autos * minAuto) / fixed);
    return sections.map((x) => (x.h > 0 ? x.h * k : minAuto));
  }
  const each = (total - fixed) / autos;
  return sections.map((x) => (x.h > 0 ? x.h : each));
}

export function cabinetLayout(it: Item, rules: Rules, fin?: Pick<Finishes, 'handle'>): CabinetLayout {
  const plinth = hasPlinth(it) ? Math.min(rules.plinthH / 10, it.h - 10) : 0;
  const carcassH = it.h - plinth;
  const gap = rules.gap / 10;
  const sections = it.opts.sections ?? [];
  const heights = sectionHeights(sections, carcassH);
  const blindW = it.opts.blind ? Math.min(it.opts.blindW ?? 50, it.w - 20) : 0;
  const x0 = it.opts.blind === 'L' ? blindW : 0;
  const x1 = it.opts.blind === 'R' ? it.w - blindW : it.w;
  const handleType = fin?.handle ?? 'bar';

  const bands: SectionBand[] = [];
  const fronts: FrontRect[] = [];
  let top = it.h;
  sections.forEach((s, i) => {
    const y1 = top;
    const y0 = top - heights[i];
    top = y0;
    const n = Math.max(1, s.n ?? 1);
    bands.push({ kind: s.kind, n, y0, y1 });
    if (s.kind === 'open' || s.kind === 'oven' || s.kind === 'micro') return;
    const fy = y0 + gap / 2;
    const fh = y1 - y0 - gap;
    if (s.kind === 'door' || s.kind === 'glass') {
      const lw = (x1 - x0) / n;
      for (let k = 0; k < n; k++) {
        let hinge: 'L' | 'R';
        if (n === 1) hinge = it.opts.hinge ?? 'L';
        else hinge = k % 2 === 0 ? 'L' : 'R';
        const fx = x0 + k * lw + gap / 2;
        const fw = lw - gap;
        const midAbs = it.elev + fy + fh / 2;
        const len = fh > 120 ? 32 : 16;
        const hy = midAbs > 115 ? fy + Math.min(6 + len / 2, fh / 2) : fy + fh - Math.min(6 + len / 2, fh / 2);
        const hx = hinge === 'L' ? fx + fw - Math.min(4.5, fw / 2) : fx + Math.min(4.5, fw / 2);
        fronts.push({
          kind: s.kind,
          section: i,
          x: fx,
          y: fy,
          w: fw,
          h: fh,
          hinge,
          handle: handleType === 'cup' ? { x: fx + fw / 2, y: midAbs > 115 ? fy + 5 : fy + fh - 5, orient: 'h', len: 10 } : { x: hx, y: hy, orient: 'v', len },
        });
      }
    } else if (s.kind === 'drawer') {
      const fw = x1 - x0 - gap;
      const fx = x0 + gap / 2;
      const hy = fh <= 22 ? fy + fh / 2 : fy + fh - 8;
      fronts.push({
        kind: 'drawer',
        section: i,
        x: fx,
        y: fy,
        w: fw,
        h: fh,
        handle: { x: fx + fw / 2, y: hy, orient: fw < 24 && fh > 40 ? 'v' : 'h', len: Math.max(8, Math.min(fw < 24 ? 16 : fw * 0.32, 40)) },
      });
    } else if (s.kind === 'flap') {
      const fw = x1 - x0 - gap;
      const fx = x0 + gap / 2;
      fronts.push({
        kind: 'flap',
        section: i,
        x: fx,
        y: fy,
        w: fw,
        h: fh,
        handle: { x: fx + fw / 2, y: fy + Math.min(5, fh / 2), orient: 'h', len: Math.max(8, Math.min(fw * 0.32, 40)) },
      });
    } else {
      // fixed panel
      fronts.push({ kind: 'panel', section: i, x: x0 + gap / 2, y: fy, w: x1 - x0 - gap, h: fh });
    }
  });
  return { plinth, carcassH, x0, x1, bands, fronts };
}

/** Finish id used by an item's fronts. */
export function itemFinishId(it: Item, fin: Finishes): string {
  if (it.finish) return it.finish;
  if (it.cat === 'wall') return fin.wallDoor;
  if (it.cat === 'tall') return fin.tallDoor;
  return fin.baseDoor;
}
