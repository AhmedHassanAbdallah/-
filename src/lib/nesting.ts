/**
 * Sheet nesting (cutting-stock estimate) using guillotine free-rectangle packing.
 * All dimensions in millimetres.
 */
export interface NestPiece {
  /** size along the sheet length (grain direction) */
  l: number;
  /** size across the sheet */
  w: number;
  label: string;
  /** piece may be turned 90° (no visible grain) */
  rotate: boolean;
}

export interface PlacedPiece extends NestPiece {
  x: number;
  y: number;
  /** placed size along sheet length / width */
  pl: number;
  pw: number;
  rotated: boolean;
}

export interface NestSheet {
  pieces: PlacedPiece[];
  usedArea: number;
  oversize?: boolean;
}

export interface NestResult {
  sheets: NestSheet[];
  sheetL: number;
  sheetW: number;
  /** used / total */
  efficiency: number;
}

interface FreeRect {
  x: number;
  y: number;
  l: number;
  w: number;
}

export function nest(pieces: NestPiece[], sheetL: number, sheetW: number, kerf: number): NestResult {
  const sorted = [...pieces].sort((a, b) => Math.max(b.l, b.w) - Math.max(a.l, a.w) || b.l * b.w - a.l * a.w);
  const sheets: (NestSheet & { free: FreeRect[] })[] = [];
  const trim = 10; // edge trim on each sheet
  const usableL = sheetL - trim * 2;
  const usableW = sheetW - trim * 2;

  const newSheet = () => {
    const s = { pieces: [] as PlacedPiece[], usedArea: 0, free: [{ x: trim, y: trim, l: usableL, w: usableW }] };
    sheets.push(s);
    return s;
  };

  for (const p of sorted) {
    const orients: { l: number; w: number; rotated: boolean }[] = [{ l: p.l, w: p.w, rotated: false }];
    if (p.rotate && p.l !== p.w) orients.push({ l: p.w, w: p.l, rotated: true });
    const fitsAny = orients.some((o) => o.l <= usableL && o.w <= usableW);
    if (!fitsAny) {
      // larger than a sheet: record as its own oversize "sheet" so the user sees it
      sheets.push({
        pieces: [{ ...p, x: trim, y: trim, pl: Math.min(p.l, usableL), pw: Math.min(p.w, usableW), rotated: false }],
        usedArea: p.l * p.w,
        oversize: true,
        free: [],
      });
      continue;
    }
    let best: { s: (typeof sheets)[number]; fi: number; o: (typeof orients)[number]; score: number } | null = null;
    for (const s of sheets) {
      if (s.oversize) continue;
      s.free.forEach((f, fi) => {
        for (const o of orients) {
          if (o.l <= f.l + 0.01 && o.w <= f.w + 0.01) {
            const score = Math.min(f.l - o.l, f.w - o.w);
            if (!best || score < best.score) best = { s, fi, o, score };
          }
        }
      });
      if (best) break; // first-fit over sheets, best-fit inside a sheet
    }
    if (!best) {
      const s = newSheet();
      const f = s.free[0];
      const o = orients.find((q) => q.l <= f.l && q.w <= f.w)!;
      best = { s, fi: 0, o, score: 0 };
    }
    const { s, fi, o } = best;
    const f = s.free[fi];
    s.pieces.push({ ...p, x: f.x, y: f.y, pl: o.l, pw: o.w, rotated: o.rotated });
    s.usedArea += o.l * o.w;
    const ol = o.l + kerf;
    const ow = o.w + kerf;
    const remL = f.l - ol;
    const remW = f.w - ow;
    s.free.splice(fi, 1);
    if (remL < remW) {
      // split so the larger remainder runs the full length
      if (remL > 20) s.free.push({ x: f.x + ol, y: f.y, l: remL, w: Math.min(ow, f.w) });
      if (remW > 20) s.free.push({ x: f.x, y: f.y + ow, l: f.l, w: remW });
    } else {
      if (remL > 20) s.free.push({ x: f.x + ol, y: f.y, l: remL, w: f.w });
      if (remW > 20) s.free.push({ x: f.x, y: f.y + ow, l: Math.min(ol, f.l), w: remW });
    }
  }
  const used = sheets.reduce((a, s) => a + s.usedArea, 0);
  const total = sheets.length * sheetL * sheetW;
  return {
    sheets: sheets.map(({ free: _free, ...rest }) => rest),
    sheetL,
    sheetW,
    efficiency: total > 0 ? used / total : 0,
  };
}
