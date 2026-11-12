import * as THREE from 'three';

/**
 * Procedural, tileable canvas textures — everything is generated on the device so the app works offline
 * and ships no image assets.
 */
export type TexKind = 'wood' | 'marble' | 'granite' | 'quartz' | 'tiles' | 'planks' | 'concrete' | 'subway' | 'mosaic';

/** Real-world size (metres) covered by one repeat of each texture. */
export const TEX_SIZE: Record<TexKind, number> = {
  wood: 0.9,
  marble: 1.8,
  granite: 0.9,
  quartz: 0.9,
  tiles: 1.2,
  planks: 1.6,
  concrete: 2.4,
  subway: 0.6,
  mosaic: 0.4,
};

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function mix(c1: string, c2: string, t: number): string {
  const a = hexToRgb(c1);
  const b = hexToRgb(c2);
  const m = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${m[0]},${m[1]},${m[2]})`;
}

function shade(c: string, amt: number): string {
  return amt >= 0 ? mix(c, '#ffffff', amt) : mix(c, '#000000', -amt);
}

function rgba(c: string, a: number): string {
  const [r, g, b] = hexToRgb(c);
  return `rgba(${r},${g},${b},${a})`;
}

export function drawTexture(kind: TexKind, color: string, c2: string, size = 512): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d')!;
  const rand = rng(hash(kind + color + c2));
  const S = size;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, S, S);

  const speckle = (count: number, col: string, minR: number, maxR: number, alpha: number) => {
    ctx.fillStyle = rgba(col, alpha);
    for (let i = 0; i < count; i++) {
      const x = rand() * S;
      const y = rand() * S;
      const r = minR + rand() * (maxR - minR);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      // wrap so the texture tiles
      if (x < r || y < r || x > S - r || y > S - r) {
        ctx.beginPath();
        ctx.arc(x < r ? x + S : x > S - r ? x - S : x, y < r ? y + S : y > S - r ? y - S : y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
  const clouds = (count: number, col: string, alpha: number, minR: number, maxR: number) => {
    for (let i = 0; i < count; i++) {
      const x = rand() * S;
      const y = rand() * S;
      const r = minR + rand() * (maxR - minR);
      for (const ox of [-S, 0, S])
        for (const oy of [-S, 0, S]) {
          if (x + ox + r < 0 || x + ox - r > S || y + oy + r < 0 || y + oy - r > S) continue;
          const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
          g.addColorStop(0, rgba(col, alpha));
          g.addColorStop(1, rgba(col, 0));
          ctx.fillStyle = g;
          ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
        }
    }
  };
  const grainLines = (x0: number, y0: number, w: number, h: number, col: string, n: number, vertical: boolean) => {
    for (let i = 0; i < n; i++) {
      const p = rand();
      const amp = 1 + rand() * 4;
      const k = 1 + Math.floor(rand() * 3);
      const ph = rand() * Math.PI * 2;
      ctx.strokeStyle = rgba(col, 0.05 + rand() * 0.22);
      ctx.lineWidth = 0.5 + rand() * 1.6;
      ctx.beginPath();
      const steps = 24;
      for (let s = 0; s <= steps; s++) {
        const q = s / steps;
        const wob = Math.sin(q * Math.PI * 2 * k + ph) * amp;
        const px = vertical ? x0 + p * w + wob : x0 + q * w;
        const py = vertical ? y0 + q * h : y0 + p * h + wob;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  };

  switch (kind) {
    case 'wood': {
      // broad tone bands, then fine vertical grain (periodic in y so it tiles)
      for (let i = 0; i < 14; i++) {
        const x = rand() * S;
        const w = 20 + rand() * 70;
        ctx.fillStyle = rgba(rand() > 0.5 ? c2 : shade(color, 0.12), 0.1 + rand() * 0.12);
        ctx.fillRect(x, 0, w, S);
        if (x + w > S) ctx.fillRect(x - S, 0, w, S);
      }
      grainLines(0, 0, S, S, c2, 150, true);
      grainLines(0, 0, S, S, shade(color, 0.25), 40, true);
      break;
    }
    case 'planks': {
      const rows = 8;
      const rh = S / rows;
      for (let r = 0; r < rows; r++) {
        const off = ((r * 0.37) % 1) * S;
        const segs = 2;
        for (let k = 0; k < segs; k++) {
          const x = off + (k * S) / segs;
          const tone = mix(color, c2, rand() * 0.8);
          for (const ox of [-S, 0]) {
            ctx.fillStyle = tone;
            ctx.fillRect(x + ox, r * rh, S / segs, rh);
          }
        }
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, r * rh, S, rh);
        ctx.clip();
        grainLines(0, r * rh, S, rh, shade(c2, -0.25), 14, false);
        ctx.restore();
        ctx.fillStyle = rgba('#000000', 0.28);
        ctx.fillRect(0, r * rh, S, 1.2);
        for (let k = 0; k < segs; k++) {
          const x = (off + (k * S) / segs) % S;
          ctx.fillRect(x, r * rh, 1.2, rh);
        }
      }
      break;
    }
    case 'marble': {
      clouds(26, c2, 0.1, 40, 150);
      clouds(14, shade(color, 0.3), 0.18, 40, 120);
      for (let i = 0; i < 9; i++) {
        let x = rand() * S;
        let y = rand() * S;
        let ang = rand() * Math.PI * 2;
        const width = 0.6 + rand() * 2.6;
        const alpha = 0.25 + rand() * 0.45;
        const pts: [number, number][] = [[x, y]];
        const steps = 30 + Math.floor(rand() * 30);
        for (let s = 0; s < steps; s++) {
          ang += (rand() - 0.5) * 0.7;
          x += Math.cos(ang) * 14;
          y += Math.sin(ang) * 14;
          pts.push([x, y]);
        }
        for (const ox of [-S, 0, S])
          for (const oy of [-S, 0, S]) {
            ctx.strokeStyle = rgba(c2, alpha);
            ctx.lineWidth = width;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            pts.forEach(([px, py], idx) => (idx === 0 ? ctx.moveTo(px + ox, py + oy) : ctx.lineTo(px + ox, py + oy)));
            ctx.stroke();
            ctx.strokeStyle = rgba(c2, alpha * 0.25);
            ctx.lineWidth = width * 5;
            ctx.stroke();
          }
      }
      break;
    }
    case 'granite': {
      speckle(2600, c2, 0.6, 2.4, 0.55);
      speckle(1800, shade(color, 0.35), 0.5, 2, 0.5);
      speckle(1400, shade(color, -0.4), 0.5, 2.2, 0.5);
      speckle(260, c2, 2, 4.5, 0.5);
      break;
    }
    case 'quartz': {
      clouds(10, c2, 0.25, 60, 160);
      speckle(900, c2, 0.4, 1.3, 0.5);
      speckle(500, shade(color, 0.4), 0.4, 1.2, 0.5);
      break;
    }
    case 'concrete': {
      clouds(40, c2, 0.22, 30, 140);
      clouds(24, shade(color, 0.25), 0.2, 30, 120);
      speckle(900, shade(color, -0.3), 0.3, 1.1, 0.25);
      break;
    }
    case 'tiles': {
      const nT = 2;
      const ts = S / nT;
      for (let i = 0; i < nT; i++)
        for (let j = 0; j < nT; j++) {
          ctx.fillStyle = mix(color, c2, rand() * 0.25);
          ctx.fillRect(i * ts, j * ts, ts, ts);
        }
      clouds(18, c2, 0.12, 40, 130);
      speckle(500, c2, 0.4, 1.2, 0.25);
      ctx.fillStyle = shade(c2, -0.18);
      const gw = 3;
      for (let i = 0; i < nT; i++) {
        ctx.fillRect(i * ts - gw / 2, 0, gw, S);
        ctx.fillRect(0, i * ts - gw / 2, S, gw);
      }
      ctx.fillRect(S - gw / 2, 0, gw, S);
      ctx.fillRect(0, S - gw / 2, S, gw);
      break;
    }
    case 'subway': {
      const cols = 4;
      const rows = 8;
      const tw = S / cols;
      const th = S / rows;
      ctx.fillStyle = c2;
      ctx.fillRect(0, 0, S, S);
      const g = 2.5;
      for (let r = 0; r < rows; r++) {
        const off = r % 2 ? tw / 2 : 0;
        for (let c = -1; c <= cols; c++) {
          const x = c * tw + off;
          const tone = shade(color, (rand() - 0.5) * 0.08);
          const grad = ctx.createLinearGradient(0, r * th, 0, (r + 1) * th);
          grad.addColorStop(0, shade(color, 0.12));
          grad.addColorStop(0.5, tone);
          grad.addColorStop(1, shade(color, -0.08));
          ctx.fillStyle = grad;
          ctx.fillRect(x + g / 2, r * th + g / 2, tw - g, th - g);
        }
      }
      break;
    }
    case 'mosaic': {
      const nM = 8;
      const ms = S / nM;
      ctx.fillStyle = c2;
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < nM; i++)
        for (let j = 0; j < nM; j++) {
          ctx.fillStyle = shade(color, (rand() - 0.5) * 0.45);
          ctx.fillRect(i * ms + 2, j * ms + 2, ms - 4, ms - 4);
        }
      break;
    }
  }
  return cv;
}

const texCache = new Map<string, THREE.CanvasTexture>();
export function getTexture(kind: TexKind, color: string, c2: string): THREE.CanvasTexture {
  const key = `${kind}|${color}|${c2}`;
  let t = texCache.get(key);
  if (!t) {
    t = new THREE.CanvasTexture(drawTexture(kind, color, c2, 512));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    const r = 1 / TEX_SIZE[kind];
    t.repeat.set(r, r);
    texCache.set(key, t);
  }
  return t;
}

const swatchCache = new Map<string, string>();
/** Small data-URL preview for UI swatches. */
export function swatchURL(kind: TexKind, color: string, c2: string): string {
  const key = `${kind}|${color}|${c2}`;
  let u = swatchCache.get(key);
  if (!u) {
    const src = drawTexture(kind, color, c2, 256);
    const cv = document.createElement('canvas');
    cv.width = cv.height = 96;
    const zoom = kind === 'tiles' || kind === 'subway' || kind === 'mosaic' || kind === 'planks' ? 1 : 0.5;
    cv.getContext('2d')!.drawImage(src, 0, 0, 256 * zoom, 256 * zoom, 0, 0, 96, 96);
    u = cv.toDataURL('image/jpeg', 0.8);
    swatchCache.set(key, u);
  }
  return u;
}
