/**
 * Small drawing kit over Canvas 2D for A4-landscape sheets. All coordinates are millimetres on paper.
 * Canvas text handles Arabic shaping and bidi natively, so the same code serves the in-app preview and the PDF.
 */
export const PAGE_W = 297;
export const PAGE_H = 210;
export const FONT = "'Cairo Variable', 'Cairo', 'Noto Sans Arabic', system-ui, sans-serif";

export interface TextOpts {
  size?: number;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  color?: string;
  maxWidth?: number;
  rotate?: number;
  baseline?: CanvasTextBaseline;
  /** paint a white halo behind the text so it stays readable over lines */
  halo?: boolean;
}

const ARABIC = /[؀-ۿ]/;

export class Kit {
  constructor(
    public ctx: CanvasRenderingContext2D,
    public rtl: boolean,
  ) {}

  text(str: string, x: number, y: number, o: TextOpts = {}) {
    const ctx = this.ctx;
    const size = o.size ?? 3;
    ctx.save();
    ctx.font = `${o.bold ? 700 : 500} ${size}px ${FONT}`;
    ctx.fillStyle = o.color ?? '#1b2430';
    ctx.textAlign = o.align ?? 'left';
    ctx.textBaseline = o.baseline ?? 'alphabetic';
    // numbers and latin strings must not be reordered by the RTL paragraph direction
    ctx.direction = ARABIC.test(str) ? 'rtl' : 'ltr';
    ctx.translate(x, y);
    if (o.rotate) ctx.rotate((o.rotate * Math.PI) / 180);
    let s = str;
    if (o.maxWidth && ctx.measureText(s).width > o.maxWidth) {
      while (s.length > 1 && ctx.measureText(s + '…').width > o.maxWidth) s = s.slice(0, -1);
      s += '…';
    }
    if (o.halo) {
      ctx.lineWidth = size * 0.28;
      ctx.strokeStyle = '#ffffff';
      ctx.lineJoin = 'round';
      ctx.strokeText(s, 0, 0);
    }
    ctx.fillText(s, 0, 0);
    ctx.restore();
  }

  measure(str: string, size = 3, bold = false): number {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `${bold ? 700 : 500} ${size}px ${FONT}`;
    const w = ctx.measureText(str).width;
    ctx.restore();
    return w;
  }

  line(x1: number, y1: number, x2: number, y2: number, w = 0.25, color = '#1b2430', dash?: number[]) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = w;
    ctx.strokeStyle = color;
    if (dash) ctx.setLineDash(dash);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  rect(x: number, y: number, w: number, h: number, o: { fill?: string; stroke?: string; lw?: number; dash?: number[] } = {}) {
    const ctx = this.ctx;
    ctx.save();
    if (o.fill) {
      ctx.fillStyle = o.fill;
      ctx.fillRect(x, y, w, h);
    }
    if (o.stroke !== 'none' && (o.stroke || !o.fill)) {
      ctx.lineWidth = o.lw ?? 0.25;
      ctx.strokeStyle = o.stroke ?? '#1b2430';
      if (o.dash) ctx.setLineDash(o.dash);
      ctx.strokeRect(x, y, w, h);
    }
    ctx.restore();
  }

  poly(pts: [number, number][], o: { fill?: string; stroke?: string; lw?: number; close?: boolean; dash?: number[]; join?: CanvasLineJoin } = {}) {
    const ctx = this.ctx;
    if (pts.length < 2) return;
    ctx.save();
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    if (o.close !== false) ctx.closePath();
    if (o.fill) {
      ctx.fillStyle = o.fill;
      ctx.fill();
    }
    if (o.stroke) {
      ctx.lineWidth = o.lw ?? 0.25;
      ctx.strokeStyle = o.stroke;
      ctx.lineJoin = o.join ?? 'miter';
      if (o.dash) ctx.setLineDash(o.dash);
      ctx.stroke();
    }
    ctx.restore();
  }

  circle(x: number, y: number, r: number, o: { fill?: string; stroke?: string; lw?: number } = {}) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (o.fill) {
      ctx.fillStyle = o.fill;
      ctx.fill();
    }
    if (o.stroke) {
      ctx.lineWidth = o.lw ?? 0.25;
      ctx.strokeStyle = o.stroke;
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Dimension between two paper points, offset perpendicular to the measured line. */
  dim(x1: number, y1: number, x2: number, y2: number, offset: number, label: string, o: { color?: string; size?: number; ext?: boolean } = {}) {
    const ctx = this.ctx;
    const color = o.color ?? '#0b5d57';
    const size = o.size ?? 2.5;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.4) return;
    const ux = dx / len;
    const uy = dy / len;
    // normal (rotate the direction 90° clockwise on paper)
    const nx = -uy;
    const ny = ux;
    const ax = x1 + nx * offset;
    const ay = y1 + ny * offset;
    const bx = x2 + nx * offset;
    const by = y2 + ny * offset;
    const sgn = Math.sign(offset) || 1;
    if (o.ext !== false) {
      this.line(x1 + nx * sgn * 0.8, y1 + ny * sgn * 0.8, ax + nx * sgn * 1.2, ay + ny * sgn * 1.2, 0.12, color);
      this.line(x2 + nx * sgn * 0.8, y2 + ny * sgn * 0.8, bx + nx * sgn * 1.2, by + ny * sgn * 1.2, 0.12, color);
    }
    this.line(ax, ay, bx, by, 0.16, color);
    // architectural ticks
    for (const [px, py] of [
      [ax, ay],
      [bx, by],
    ]) {
      this.line(px - (ux + nx) * 0.9, py - (uy + ny) * 0.9, px + (ux + nx) * 0.9, py + (uy + ny) * 0.9, 0.3, color);
    }
    let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (ang > 90.01 || ang <= -89.99) ang += 180;
    const r = (ang * Math.PI) / 180;
    // text sits just off the dimension line, on its "upper" side
    const tx = (ax + bx) / 2 + Math.sin(r) * 0.9;
    const ty = (ay + by) / 2 - Math.cos(r) * 0.9;
    const tw = this.measure(label, size, true);
    ctx.save();
    if (tw > len - 1 && len < 9) {
      // too narrow: drop the text further out
      this.text(label, tx + Math.sin(r) * (size + 0.2), ty - Math.cos(r) * (size + 0.2), { size: size * 0.92, bold: true, align: 'center', color, rotate: ang, halo: true });
    } else {
      this.text(label, tx, ty, { size, bold: true, align: 'center', color, rotate: ang, halo: true });
    }
    ctx.restore();
  }

  /** Simple table. Returns the y below the last row. Columns are laid out in reading order. */
  table(
    x: number,
    y: number,
    cols: { title: string; w: number; align?: 'left' | 'center' | 'right'; bold?: boolean }[],
    rows: (string | { t: string; bold?: boolean; color?: string })[][],
    o: { rowH?: number; size?: number; zebra?: boolean; headFill?: string } = {},
  ): number {
    const rowH = o.rowH ?? 5.2;
    const size = o.size ?? 2.7;
    const total = cols.reduce((s, c) => s + c.w, 0);
    // in RTL the first column sits on the right
    const xs: number[] = [];
    let cur = this.rtl ? x + total : x;
    for (const c of cols) {
      if (this.rtl) {
        cur -= c.w;
        xs.push(cur);
      } else {
        xs.push(cur);
        cur += c.w;
      }
    }
    const cell = (t: string, ci: number, yy: number, bold: boolean, color?: string) => {
      const c = cols[ci];
      const align = c.align ?? (this.rtl ? 'right' : 'left');
      const tx = align === 'center' ? xs[ci] + c.w / 2 : align === 'right' ? xs[ci] + c.w - 1.4 : xs[ci] + 1.4;
      this.text(t, tx, yy + rowH * 0.68, { size, bold, align, color, maxWidth: c.w - 2.2 });
    };
    this.rect(x, y, total, rowH, { fill: o.headFill ?? '#0f172a', stroke: 'none' });
    cols.forEach((c, i) => cell(c.title, i, y, true, '#ffffff'));
    let yy = y + rowH;
    rows.forEach((r, ri) => {
      if (o.zebra !== false && ri % 2 === 1) this.rect(x, yy, total, rowH, { fill: '#f3f5f7', stroke: 'none' });
      r.forEach((v, ci) => {
        if (ci >= cols.length) return;
        if (typeof v === 'string') cell(v, ci, yy, !!cols[ci].bold);
        else cell(v.t, ci, yy, v.bold ?? !!cols[ci].bold, v.color);
      });
      this.line(x, yy + rowH, x + total, yy + rowH, 0.08, '#c9ced4');
      yy += rowH;
    });
    this.rect(x, y, total, yy - y, { stroke: '#8d96a0', lw: 0.2 });
    return yy;
  }
}

/** Largest standard drawing scale (1:N) that fits; returns paper mm per real cm. */
export function pickScale(maxMmPerCm: number): { sc: number; n: number } {
  const ns = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200];
  for (const n of ns) {
    const sc = 10 / n;
    if (sc <= maxMmPerCm) return { sc, n };
  }
  return { sc: maxMmPerCm, n: Math.round(10 / maxMmPerCm) };
}
