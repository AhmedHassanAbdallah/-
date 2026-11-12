import type { Item, ModuleDef } from '../types';
import { cabinetLayout } from '../lib/layout';
import { DEFAULT_RULES } from '../lib/materials';

const INK = '#4b5a6a';
const FRONT = '#dfe6ee';
const BODY = '#f5f7f9';

/** Miniature front elevation of a module, drawn from the same layout the 3D view uses. */
export function ModuleGlyph({ def }: { def: ModuleDef }) {
  const S = 64;
  const pad = 5;
  const scale = Math.min((S - pad * 2) / def.w, (S - pad * 2) / def.h);
  const w = def.w * scale;
  const h = def.h * scale;
  const ox = (S - w) / 2;
  const oy = (S - h) / 2;
  // y is measured from the bottom of the unit
  const X = (x: number) => ox + x * scale;
  const Y = (y: number) => oy + h - y * scale;
  const sw = 1;

  const els: React.ReactNode[] = [];
  if (def.cat === 'appliance') {
    els.push(<rect key="b" x={ox} y={oy} width={w} height={h} rx={2} fill={BODY} stroke={INK} strokeWidth={sw} />);
    switch (def.appliance) {
      case 'fridge':
        els.push(<line key="s" x1={ox} x2={ox + w} y1={Y(def.h * 0.38)} y2={Y(def.h * 0.38)} stroke={INK} strokeWidth={sw} />);
        els.push(<line key="h1" x1={ox + 4} x2={ox + 4} y1={Y(def.h * 0.5)} y2={Y(def.h * 0.75)} stroke={INK} strokeWidth={1.6} />);
        els.push(<line key="h2" x1={ox + 4} x2={ox + 4} y1={Y(def.h * 0.14)} y2={Y(def.h * 0.3)} stroke={INK} strokeWidth={1.6} />);
        break;
      case 'fridge_sbs':
        els.push(<line key="s" x1={ox + w * 0.42} x2={ox + w * 0.42} y1={oy} y2={oy + h} stroke={INK} strokeWidth={sw} />);
        els.push(<line key="h1" x1={ox + w * 0.42 - 3} x2={ox + w * 0.42 - 3} y1={Y(def.h * 0.3)} y2={Y(def.h * 0.75)} stroke={INK} strokeWidth={1.6} />);
        els.push(<line key="h2" x1={ox + w * 0.42 + 3} x2={ox + w * 0.42 + 3} y1={Y(def.h * 0.3)} y2={Y(def.h * 0.75)} stroke={INK} strokeWidth={1.6} />);
        break;
      case 'cooker':
        els.push(<rect key="o" x={ox + 4} y={oy + h * 0.3} width={w - 8} height={h * 0.42} rx={1.5} fill="#2d3640" />);
        for (let i = 0; i < 4; i++) els.push(<circle key={'k' + i} cx={ox + w * (0.2 + i * 0.2)} cy={oy + h * 0.14} r={1.8} fill={INK} />);
        els.push(<line key="d" x1={ox} x2={ox + w} y1={oy + h * 0.82} y2={oy + h * 0.82} stroke={INK} strokeWidth={sw} />);
        break;
      case 'hood':
        els.length = 0;
        els.push(<rect key="c" x={ox + w * 0.32} y={oy} width={w * 0.36} height={h * 0.8} fill={BODY} stroke={INK} strokeWidth={sw} />);
        els.push(<rect key="b" x={ox} y={oy + h * 0.8} width={w} height={h * 0.2} rx={1.5} fill={FRONT} stroke={INK} strokeWidth={sw} />);
        break;
      case 'dishwasher':
        els.push(<rect key="t" x={ox} y={oy} width={w} height={h * 0.16} fill="#2d3640" />);
        els.push(<line key="h" x1={ox + 8} x2={ox + w - 8} y1={oy + h * 0.24} y2={oy + h * 0.24} stroke={INK} strokeWidth={1.8} />);
        break;
      case 'washer':
        els.push(<line key="t" x1={ox} x2={ox + w} y1={oy + h * 0.17} y2={oy + h * 0.17} stroke={INK} strokeWidth={sw} />);
        els.push(<circle key="c" cx={ox + w / 2} cy={oy + h * 0.58} r={w * 0.28} fill="#2d3640" stroke={INK} strokeWidth={2} />);
        break;
      case 'microwave':
        els.push(<rect key="g" x={ox + 3} y={oy + 3} width={w * 0.66} height={h - 6} rx={1} fill="#2d3640" />);
        els.push(<circle key="k" cx={ox + w * 0.86} cy={oy + h * 0.7} r={2} fill={INK} />);
        break;
    }
    return (
      <svg className="glyph" viewBox={`0 0 ${S} ${S}`}>
        {els}
      </svg>
    );
  }

  const item = { id: 'g', type: def.key, cat: def.cat, x: 0, y: 0, rot: 0, w: def.w, d: def.d, h: def.h, elev: def.elev, opts: def.opts } as Item;
  const lay = cabinetLayout(item, DEFAULT_RULES);
  els.push(<rect key="body" x={ox} y={Y(def.h)} width={w} height={lay.carcassH * scale} fill={BODY} stroke={INK} strokeWidth={sw} />);
  if (lay.plinth > 0) els.push(<rect key="pl" x={ox + Math.min(2, w / 4)} y={Y(lay.plinth)} width={Math.max(0.5, w - 2 * Math.min(2, w / 4))} height={lay.plinth * scale} fill="#9aa5b1" />);
  lay.bands.forEach((b, i) => {
    const bx = X(lay.x0);
    const bw = (lay.x1 - lay.x0) * scale;
    if (b.kind === 'open') {
      els.push(<rect key={'o' + i} x={bx + 1.5} y={Y(b.y1) + 1.5} width={bw - 3} height={(b.y1 - b.y0) * scale - 3} fill="#c7d0d9" />);
      const n = def.opts.shelves ?? 1;
      for (let s = 1; s <= n; s++) {
        const y = Y(b.y0 + ((b.y1 - b.y0) * s) / (n + 1));
        els.push(<line key={'os' + i + s} x1={bx + 1.5} x2={bx + bw - 1.5} y1={y} y2={y} stroke={INK} strokeWidth={sw} />);
      }
    } else if (b.kind === 'oven' || b.kind === 'micro') {
      els.push(<rect key={'a' + i} x={bx + 1.5} y={Y(b.y1) + 1.5} width={bw - 3} height={(b.y1 - b.y0) * scale - 3} rx={1} fill="#c9ced4" stroke={INK} strokeWidth={0.6} />);
      els.push(<rect key={'ag' + i} x={bx + 4} y={Y(b.y1) + (b.kind === 'oven' ? 6 : 4)} width={(bw - 8) * (b.kind === 'micro' ? 0.7 : 1)} height={(b.y1 - b.y0) * scale - (b.kind === 'oven' ? 9 : 8)} rx={1} fill="#2d3640" />);
    }
  });
  if (def.opts.blind) {
    const bx = lay.x0 > 0 ? ox : X(lay.x1);
    const bw = (lay.x0 > 0 ? lay.x0 : def.w - lay.x1) * scale;
    els.push(<rect key="blind" x={bx} y={Y(def.h)} width={bw} height={lay.carcassH * scale} fill="#e9edf1" stroke={INK} strokeWidth={0.6} strokeDasharray="2 2" />);
  }
  lay.fronts.forEach((f, i) => {
    const x = X(f.x);
    const y = Y(f.y + f.h);
    const fw = f.w * scale;
    const fh = f.h * scale;
    els.push(<rect key={'f' + i} x={x} y={y} width={fw} height={fh} rx={0.8} fill={f.kind === 'glass' ? '#cfe6f0' : f.kind === 'panel' ? '#e9edf1' : FRONT} stroke={INK} strokeWidth={sw} />);
    if (f.handle) {
      const hx = X(f.handle.x);
      const hy = Y(f.handle.y);
      const hl = Math.min(f.handle.len * scale, (f.handle.orient === 'v' ? fh : fw) - 3) / 2;
      if (hl > 1)
        els.push(
          f.handle.orient === 'v' ? (
            <line key={'h' + i} x1={hx} x2={hx} y1={hy - hl} y2={hy + hl} stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
          ) : (
            <line key={'h' + i} x1={hx - hl} x2={hx + hl} y1={hy} y2={hy} stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
          ),
        );
    }
  });
  if (def.opts.countertop) {
    els.push(<rect key="ct" x={ox - 1} y={Y(def.h) - 2.2} width={w + 2} height={2.2} fill="#5b6876" />);
    if (def.opts.sink) els.push(<path key="tap" d={`M ${ox + w / 2} ${Y(def.h) - 2} v -6 q 0 -3 4 -3`} fill="none" stroke={INK} strokeWidth={1.4} strokeLinecap="round" />);
    if (def.opts.cooktop) {
      els.push(<line key="b1" x1={ox + w * 0.2} x2={ox + w * 0.42} y1={Y(def.h) - 3.6} y2={Y(def.h) - 3.6} stroke={INK} strokeWidth={1.6} strokeLinecap="round" />);
      els.push(<line key="b2" x1={ox + w * 0.58} x2={ox + w * 0.8} y1={Y(def.h) - 3.6} y2={Y(def.h) - 3.6} stroke={INK} strokeWidth={1.6} strokeLinecap="round" />);
    }
  }
  return (
    <svg className="glyph" viewBox={`0 0 ${S} ${S}`}>
      {els}
    </svg>
  );
}
