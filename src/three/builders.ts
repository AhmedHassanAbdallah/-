import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Finishes, Item, Rules } from '../types';
import { WALL_ELEV } from '../lib/catalog';
import { cabinetLayout, itemFinishId, type FrontRect } from '../lib/layout';
import { carcassFinish, countertopFinish, doorFinish, floorFinish, handleColor, LED_TEMPS, PLINTHS, splashFinish } from '../lib/materials';
import { getTexture } from './textures';

/** Scene units are metres; builders work in centimetres and convert when merging. */
export const CM = 0.01;

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
export class MatLib {
  private cache = new Map<string, THREE.Material>();

  private get<T extends THREE.Material>(key: string, make: () => T): T {
    let m = this.cache.get(key) as T | undefined;
    if (!m) {
      m = make();
      this.cache.set(key, m);
    }
    return m;
  }

  door(id: string): THREE.Material {
    return this.get('door:' + id, () => {
      const f = doorFinish(id);
      const map = f.grain ? getTexture('wood', f.color, f.grain) : f.id === 'hpl-concrete' ? getTexture('concrete', f.color, '#84847f') : null;
      if (f.clearcoat) {
        return new THREE.MeshPhysicalMaterial({ color: f.color, roughness: f.rough, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04 });
      }
      return new THREE.MeshStandardMaterial({ color: map ? '#ffffff' : f.color, map, roughness: f.rough, metalness: 0 });
    });
  }
  carcass(id: string): THREE.Material {
    return this.get('carcass:' + id, () => {
      const f = carcassFinish(id);
      const map = f.grain ? getTexture('wood', f.color, f.grain) : null;
      return new THREE.MeshStandardMaterial({ color: map ? '#ffffff' : f.color, map, roughness: 0.7 });
    });
  }
  countertop(id: string): THREE.Material {
    return this.get('ct:' + id, () => {
      const f = countertopFinish(id);
      const kind = f.tex === 'plain' ? null : f.tex;
      const map = kind ? getTexture(kind, f.color, f.c2) : null;
      return new THREE.MeshStandardMaterial({ color: map ? '#ffffff' : f.color, map, roughness: f.rough, metalness: 0.02 });
    });
  }
  handle(id: string): THREE.Material {
    return this.get('handle:' + id, () => {
      const f = handleColor(id);
      return new THREE.MeshStandardMaterial({ color: f.color, roughness: f.rough, metalness: 0.85, envMapIntensity: 3 });
    });
  }
  plinth(fin: Finishes): THREE.Material {
    if (fin.plinth === 'pl-door') return this.door(fin.baseDoor);
    return this.get('plinth:' + fin.plinth, () => {
      const f = PLINTHS.find((p) => p.id === fin.plinth) ?? PLINTHS[0];
      return new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.4, metalness: f.id === 'pl-steel' ? 0.7 : 0.1, envMapIntensity: f.id === 'pl-steel' ? 2.6 : 1 });
    });
  }
  floor(id: string): THREE.Material {
    return this.get('floor:' + id, () => {
      const f = floorFinish(id);
      const map = getTexture(f.tex, f.color, f.c2);
      return new THREE.MeshStandardMaterial({ map, roughness: f.tex === 'planks' ? 0.55 : f.tex === 'concrete' ? 0.5 : 0.3, metalness: 0 });
    });
  }
  wall(color: string): THREE.Material {
    return this.get('wall:' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 }));
  }
  splash(fin: Finishes): THREE.Material | null {
    const f = splashFinish(fin.backsplash);
    if (f.tex === 'none') return null;
    if (f.tex === 'slab') return this.countertop(fin.countertop);
    return this.get('splash:' + f.id, () => {
      if (f.tex === 'glass') return new THREE.MeshPhysicalMaterial({ color: f.color, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02 });
      return new THREE.MeshStandardMaterial({ map: getTexture(f.tex as 'subway' | 'mosaic', f.color, f.c2), roughness: 0.25, metalness: 0 });
    });
  }
  led(fin: Finishes): THREE.Material {
    const c = LED_TEMPS.find((l) => l.id === fin.ledTemp)?.color ?? '#fff4e2';
    return this.get('led:' + c, () => new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
  }
  get steel() {
    return this.get('steel', () => new THREE.MeshStandardMaterial({ color: '#d2d5d9', roughness: 0.36, metalness: 0.7, envMapIntensity: 2.8 }));
  }
  get darkSteel() {
    return this.get('darkSteel', () => new THREE.MeshStandardMaterial({ color: '#4a4e53', roughness: 0.45, metalness: 0.55, envMapIntensity: 2.2 }));
  }
  get blackGlass() {
    return this.get('blackGlass', () => new THREE.MeshPhysicalMaterial({ color: '#0d0f12', roughness: 0.08, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2.2 }));
  }
  get glass() {
    return this.get(
      'glass',
      () => new THREE.MeshPhysicalMaterial({ color: '#d6e8ee', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
    );
  }
  get white() {
    return this.get('white', () => new THREE.MeshStandardMaterial({ color: '#f1f1ef', roughness: 0.32, metalness: 0.05 }));
  }
  get black() {
    return this.get('black', () => new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.75, metalness: 0.1 }));
  }
  get grey() {
    return this.get('grey', () => new THREE.MeshStandardMaterial({ color: '#8d9093', roughness: 0.5, metalness: 0.3 }));
  }
  /** painted metal casing of appliances */
  get casing() {
    return this.get('casing', () => new THREE.MeshStandardMaterial({ color: '#b4b8bc', roughness: 0.5, metalness: 0.35, envMapIntensity: 1.6 }));
  }
  get woodDoor() {
    return this.get('woodDoor', () => new THREE.MeshStandardMaterial({ map: getTexture('wood', '#b08a5e', '#8a6740'), roughness: 0.6 }));
  }
  get ceiling() {
    return this.get('ceiling', () => new THREE.MeshStandardMaterial({ color: '#fbfbf9', roughness: 1 }));
  }

  dispose() {
    this.cache.forEach((m) => m.dispose());
    this.cache.clear();
  }
}

// ---------------------------------------------------------------------------
// Geometry batching
// ---------------------------------------------------------------------------
/** Collects primitives per material and merges them into one mesh each (few draw calls per item). */
export class Batch {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  /** uv offsets in cm so textures continue across neighbouring items */
  constructor(
    private ox = 0,
    private oz = 0,
  ) {}

  private push(mat: THREE.Material, geo: THREE.BufferGeometry) {
    let list = this.parts.get(mat);
    if (!list) {
      list = [];
      this.parts.set(mat, list);
    }
    list.push(geo);
  }

  /** World-scale UVs (metres) chosen by the dominant normal axis. */
  private worldUV(geo: THREE.BufferGeometry) {
    const pos = geo.getAttribute('position');
    const nor = geo.getAttribute('normal');
    const uv = geo.getAttribute('uv');
    if (!uv) return;
    for (let i = 0; i < pos.count; i++) {
      const nx = Math.abs(nor.getX(i));
      const ny = Math.abs(nor.getY(i));
      const nz = Math.abs(nor.getZ(i));
      const x = pos.getX(i) + this.ox;
      const y = pos.getY(i);
      const z = pos.getZ(i) + this.oz;
      if (nx > ny && nx > nz) uv.setXY(i, z * CM, y * CM);
      else if (ny > nz) uv.setXY(i, x * CM, z * CM);
      else uv.setXY(i, x * CM, y * CM);
    }
  }

  box(mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number): this {
    if (!(w > 0.01 && h > 0.01 && d > 0.01)) return this;
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    this.worldUV(g);
    this.push(mat, g);
    return this;
  }

  cyl(mat: THREE.Material, r: number, h: number, x: number, y: number, z: number, axis: 'x' | 'y' | 'z' = 'y', seg = 20, rTop?: number): this {
    if (!(r > 0 && h > 0)) return this;
    const g = new THREE.CylinderGeometry(rTop ?? r, r, h, seg);
    if (axis === 'x') g.rotateZ(Math.PI / 2);
    if (axis === 'z') g.rotateX(Math.PI / 2);
    g.translate(x, y, z);
    this.push(mat, g);
    return this;
  }

  torus(mat: THREE.Material, R: number, r: number, x: number, y: number, z: number, arc = Math.PI * 2, rotX = 0, rotY = 0): this {
    const g = new THREE.TorusGeometry(R, r, 10, 28, arc);
    if (rotX) g.rotateX(rotX);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    this.push(mat, g);
    return this;
  }

  build(): THREE.Group {
    const group = new THREE.Group();
    this.parts.forEach((list, mat) => {
      const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (!merged) return;
      if (list.length > 1) list.forEach((g) => g.dispose());
      merged.scale(CM, CM, CM);
      const mesh = new THREE.Mesh(merged, mat);
      const transparent = (mat as THREE.Material).transparent;
      const emissive = mat instanceof THREE.MeshBasicMaterial;
      mesh.castShadow = !transparent && !emissive;
      mesh.receiveShadow = !emissive;
      group.add(mesh);
    });
    return group;
  }
}

// ---------------------------------------------------------------------------
// Item builders (local frame: x = width, centred; y up from the item's bottom; z = depth, front at +d/2)
// ---------------------------------------------------------------------------
export interface BuildCtx {
  rules: Rules;
  fin: Finishes;
  mats: MatLib;
  /** item stands against a wall (gets a backsplash) */
  onWall: boolean;
}

function handle(b: Batch, ctx: BuildCtx, f: FrontRect, w: number, zf: number) {
  const type = ctx.fin.handle;
  if (!f.handle || type === 'gola' || type === 'none') return;
  const m = ctx.mats.handle(ctx.fin.handleColor);
  const hx = f.handle.x - w / 2;
  const hy = f.handle.y;
  if (type === 'knob') {
    b.cyl(m, 1.5, 0.8, hx, hy, zf + 2.2, 'z', 18);
    b.cyl(m, 0.6, 2, hx, hy, zf + 1, 'z', 10);
    return;
  }
  if (type === 'cup') {
    const len = f.handle.orient === 'h' ? Math.min(10, f.w - 4) : 9;
    b.box(m, len, 3.2, 2.2, f.handle.orient === 'h' ? hx : f.x + f.w / 2 - w / 2, hy, zf + 1.1);
    return;
  }
  const len = Math.min(f.handle.len, (f.handle.orient === 'v' ? f.h : f.w) - 3);
  if (len < 4) return;
  if (f.handle.orient === 'v') {
    b.box(m, 1.1, len, 1.1, hx, hy, zf + 2.6);
    b.box(m, 0.9, 0.9, 2.2, hx, hy - len / 2 + 1.8, zf + 1.1);
    b.box(m, 0.9, 0.9, 2.2, hx, hy + len / 2 - 1.8, zf + 1.1);
  } else {
    b.box(m, len, 1.1, 1.1, hx, hy, zf + 2.6);
    b.box(m, 0.9, 0.9, 2.2, hx - len / 2 + 1.8, hy, zf + 1.1);
    b.box(m, 0.9, 0.9, 2.2, hx + len / 2 - 1.8, hy, zf + 1.1);
  }
}

function ovenFront(b: Batch, m: MatLib, x0: number, x1: number, y0: number, y1: number, zf: number) {
  const bw = x1 - x0 - 0.6;
  const bh = y1 - y0 - 0.6;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  b.box(m.steel, bw, bh, 2, cx, cy, zf - 1);
  const strip = Math.min(10, bh * 0.2);
  b.box(m.blackGlass, bw - 5, bh - strip - 5, 0.8, cx, y0 + 0.3 + (bh - strip - 5) / 2 + 2.5, zf + 0.2);
  b.box(m.steel, bw - 12, 1.5, 1.5, cx, y1 - strip - 2.6, zf + 3.2);
  b.box(m.steel, 1.2, 1.2, 3, cx - bw / 2 + 8, y1 - strip - 2.6, zf + 1.6);
  b.box(m.steel, 1.2, 1.2, 3, cx + bw / 2 - 8, y1 - strip - 2.6, zf + 1.6);
  b.box(m.blackGlass, bw * 0.24, strip * 0.5, 0.5, cx, y1 - strip / 2 - 0.3, zf + 0.2);
  b.cyl(m.darkSteel, 1.7, 2, cx - bw * 0.32, y1 - strip / 2 - 0.3, zf + 1, 'z', 16);
  b.cyl(m.darkSteel, 1.7, 2, cx + bw * 0.32, y1 - strip / 2 - 0.3, zf + 1, 'z', 16);
}

function microFront(b: Batch, m: MatLib, x0: number, x1: number, y0: number, y1: number, zf: number) {
  const bw = x1 - x0 - 0.6;
  const bh = y1 - y0 - 0.6;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  b.box(m.steel, bw, bh, 2, cx, cy, zf - 1);
  const gw = bw * 0.7;
  b.box(m.blackGlass, gw - 3, bh - 6, 0.8, x0 + 0.3 + gw / 2 + 1, cy, zf + 0.2);
  b.box(m.blackGlass, bw - gw - 4, bh - 6, 0.6, x1 - 0.3 - (bw - gw) / 2 - 0.5, cy, zf + 0.15);
  b.box(m.steel, 1.2, bh - 12, 1.4, x0 + 0.3 + gw + 0.6, cy, zf + 2.4);
  b.cyl(m.steel, 1.6, 1.6, x1 - 0.3 - (bw - gw) / 2 - 0.5, y0 + bh * 0.28, zf + 0.9, 'z', 16);
}

/** A slab with rectangular cut-outs that all share one z range. */
function slabWithHoles(b: Batch, mat: THREE.Material, x0: number, x1: number, z0: number, z1: number, yc: number, t: number, holes: { x0: number; x1: number }[], hz0: number, hz1: number) {
  if (!holes.length) {
    b.box(mat, x1 - x0, t, z1 - z0, (x0 + x1) / 2, yc, (z0 + z1) / 2);
    return;
  }
  b.box(mat, x1 - x0, t, hz0 - z0, (x0 + x1) / 2, yc, (z0 + hz0) / 2);
  b.box(mat, x1 - x0, t, z1 - hz1, (x0 + x1) / 2, yc, (hz1 + z1) / 2);
  let cur = x0;
  for (const h of [...holes].sort((p, q) => p.x0 - q.x0)) {
    b.box(mat, h.x0 - cur, t, hz1 - hz0, (cur + h.x0) / 2, yc, (hz0 + hz1) / 2);
    cur = h.x1;
  }
  b.box(mat, x1 - cur, t, hz1 - hz0, (cur + x1) / 2, yc, (hz0 + hz1) / 2);
}

function gasBurners(b: Batch, m: MatLib, cw: number, cd: number, y: number, zc: number) {
  const five = cw > 75;
  const px = five ? [-cw * 0.32, cw * 0.32] : [-cw * 0.24, cw * 0.24];
  const pz = [-cd * 0.22, cd * 0.2];
  const spots: [number, number, number][] = [];
  for (const x of px) for (const z of pz) spots.push([x, zc + z, 1]);
  if (five) spots.push([0, zc - 1, 1.35]);
  for (const [x, z, s] of spots) {
    b.cyl(m.darkSteel, 4.4 * s, 1, x, y + 0.5, z, 'y', 22);
    b.cyl(m.black, 2.6 * s, 1.4, x, y + 1.4, z, 'y', 18);
    b.box(m.black, 15 * s, 0.8, 1, x, y + 2.6, z);
    b.box(m.black, 1, 0.8, 15 * s, x, y + 2.6, z);
    for (const [dx, dz] of [
      [-7 * s, 0],
      [7 * s, 0],
      [0, -7 * s],
      [0, 7 * s],
    ])
      b.box(m.black, 0.9, 2.4, 0.9, x + dx, y + 1.3, z + dz);
  }
  const knobs = five ? 5 : 4;
  for (let i = 0; i < knobs; i++) {
    const x = (i - (knobs - 1) / 2) * 5.2;
    b.cyl(m.steel, 1.5, 1.8, x, y + 0.9, zc + cd / 2 - 4, 'y', 14);
  }
}

function cooktop(b: Batch, m: MatLib, kind: 'gas' | 'induction', w: number, y: number, zc: number) {
  const cw = Math.min(w - 3, w >= 88 ? 86 : 58);
  const cd = 50;
  b.box(m.blackGlass, cw, 0.9, cd, 0, y + 0.45, zc);
  if (kind === 'gas') {
    gasBurners(b, m, cw, cd, y + 0.9, zc);
  } else {
    const px = [-cw * 0.24, cw * 0.24];
    const pz = [-cd * 0.22, cd * 0.2];
    let i = 0;
    for (const x of px)
      for (const z of pz) {
        const r = i++ % 2 ? 8.5 : 10;
        b.torus(m.grey, r, 0.12, x, y + 0.95, zc + z, Math.PI * 2, Math.PI / 2);
      }
    b.box(m.grey, cw * 0.3, 0.05, 1.2, 0, y + 0.93, zc + cd / 2 - 4);
  }
}

function sinkAndTop(b: Batch, ctx: BuildCtx, it: Item, x0: number, x1: number, z0: number, z1: number, top: number) {
  const m = ctx.mats;
  const ct = ctx.fin.countertopT;
  const mat = m.countertop(ctx.fin.countertop);
  const w = it.w;
  const holes: { x0: number; x1: number }[] = [];
  const hd = Math.min(40, it.d - 16);
  const hz0 = -hd / 2 + 2;
  const hz1 = hd / 2 + 2;
  if (it.opts.sink === 'double' && w >= 76) {
    const bw = Math.min(38, (w - 16) / 2);
    holes.push({ x0: -bw - 3, x1: -3 }, { x0: 3, x1: bw + 3 });
  } else if (it.opts.sink) {
    const bw = Math.min(50, w - 12);
    holes.push({ x0: -bw / 2, x1: bw / 2 });
  }
  slabWithHoles(b, mat, x0, x1, z0, z1, top + ct / 2, ct, holes, hz0, hz1);
  const depth = 18;
  for (const h of holes) {
    const hw = h.x1 - h.x0;
    const cx = (h.x0 + h.x1) / 2;
    const cz = (hz0 + hz1) / 2;
    const yb = top + ct - depth;
    b.box(m.steel, hw, 0.6, hd, cx, yb + 0.3, cz);
    b.box(m.steel, 0.6, depth, hd, h.x0 + 0.3, yb + depth / 2, cz);
    b.box(m.steel, 0.6, depth, hd, h.x1 - 0.3, yb + depth / 2, cz);
    b.box(m.steel, hw, depth, 0.6, cx, yb + depth / 2, hz0 + 0.3);
    b.box(m.steel, hw, depth, 0.6, cx, yb + depth / 2, hz1 - 0.3);
    // rim
    b.box(m.steel, hw + 2.4, 0.25, 1.2, cx, top + ct + 0.12, hz0 - 0.6);
    b.box(m.steel, hw + 2.4, 0.25, 1.2, cx, top + ct + 0.12, hz1 + 0.6);
    b.box(m.steel, 1.2, 0.25, hd, h.x0 - 0.6, top + ct + 0.12, cz);
    b.box(m.steel, 1.2, 0.25, hd, h.x1 + 0.6, top + ct + 0.12, cz);
    b.cyl(m.darkSteel, 2.2, 0.3, cx, yb + 0.75, cz, 'y', 16);
  }
  if (holes.length) {
    // mixer tap behind the bowl(s)
    const fx = holes.length === 2 ? 0 : 0;
    const fz = hz0 - 4.5;
    const y0 = top + ct;
    b.cyl(m.steel, 2.3, 3, fx, y0 + 1.5, fz, 'y', 18);
    b.cyl(m.steel, 1.1, 26, fx, y0 + 16, fz, 'y', 14);
    b.torus(m.steel, 7, 1.1, fx, y0 + 29, fz + 7, Math.PI, 0, -Math.PI / 2);
    b.cyl(m.steel, 1.1, 3, fx, y0 + 27.5, fz + 14, 'y', 14);
    b.box(m.steel, 5, 1, 1.4, fx + 4, y0 + 4, fz);
  }
}

function buildCabinet(it: Item, ctx: BuildCtx, b: Batch) {
  const { rules, fin, mats } = ctx;
  const t = rules.boardT / 10;
  const ft = rules.frontT / 10;
  const gap = rules.gap / 10;
  const lay = cabinetLayout(it, rules, fin);
  const { w, d } = it;
  const pl = lay.plinth;
  const hc = lay.carcassH;
  const zf = d / 2;
  const cd = d - ft;
  const zc = -ft / 2;
  const carc = mats.carcass(fin.carcass);
  const doorM = mats.door(itemFinishId(it, fin));
  const plinthM = mats.plinth(fin);

  if (it.opts.filler) {
    b.box(doorM, w - gap * 0.3, hc - gap, ft, 0, pl + hc / 2, zf - ft / 2);
    if (pl > 0) b.box(plinthM, w, pl, 1.6, 0, pl / 2, zf - ft - 5);
    return;
  }

  // ---- carcass ----
  const sideM = it.opts.island ? doorM : carc;
  b.box(sideM, t, hc, cd, -w / 2 + t / 2, pl + hc / 2, zc);
  b.box(sideM, t, hc, cd, w / 2 - t / 2, pl + hc / 2, zc);
  b.box(carc, w - 2 * t, t, cd, 0, pl + t / 2, zc);
  b.box(carc, w - 2 * t, t, cd, 0, pl + hc - t / 2, zc);
  if (it.opts.island) b.box(doorM, w - 2 * t, hc - 0.2, ft, 0, pl + hc / 2, -d / 2 + ft / 2);
  else b.box(carc, w - 2 * t, hc - 2 * t, 0.6, 0, pl + hc / 2, -d / 2 + 0.3);

  // dividers and visible shelves
  const structural = (k: string) => k === 'oven' || k === 'micro' || k === 'open' || k === 'glass';
  for (let i = 0; i < lay.bands.length - 1; i++) {
    const a = lay.bands[i];
    const c = lay.bands[i + 1];
    if (structural(a.kind) || structural(c.kind) || it.cat === 'tall') b.box(carc, w - 2 * t, t, cd - 0.6, 0, a.y0, zc + 0.3);
  }
  const openBands = lay.bands.filter((x) => x.kind === 'open' || x.kind === 'glass');
  const shelves = it.opts.shelves ?? 0;
  if (openBands.length && shelves > 0) {
    const per = Math.max(1, Math.round(shelves / openBands.length));
    for (const band of openBands) {
      const lo = Math.max(band.y0, pl + t);
      const hi = Math.min(band.y1, pl + hc - t);
      for (let s = 1; s <= per; s++) {
        const y = lo + ((hi - lo) * s) / (per + 1);
        b.box(band.kind === 'glass' ? mats.glass : carc, w - 2 * t - 0.2, band.kind === 'glass' ? 0.8 : t, cd - 4, 0, y, zc - 1);
      }
    }
  }

  // plinth
  if (pl > 0) {
    if (it.opts.island) {
      b.box(plinthM, w - 8, pl, 1.6, 0, pl / 2, zf - 5);
      b.box(plinthM, w - 8, pl, 1.6, 0, pl / 2, -zf + 5);
      b.box(plinthM, 1.6, pl, d - 10, -w / 2 + 4.8, pl / 2, 0);
      b.box(plinthM, 1.6, pl, d - 10, w / 2 - 4.8, pl / 2, 0);
    } else {
      b.box(plinthM, w, pl, 1.6, 0, pl / 2, zf - ft - 5);
    }
  }

  // blind part of a corner unit
  if (it.opts.blind) {
    const bw = lay.x0 > 0 ? lay.x0 : w - lay.x1;
    const cx = lay.x0 > 0 ? -w / 2 + bw / 2 : w / 2 - bw / 2;
    b.box(carc, bw - 0.4, hc - 0.4, 1.6, cx, pl + hc / 2, zf - ft - 0.8);
  }

  // ---- fronts ----
  const gola = fin.handle === 'gola' && it.cat !== 'wall';
  for (const f of lay.fronts) {
    let fh = f.h;
    let cy = f.y + f.h / 2;
    const cx = f.x + f.w / 2 - w / 2;
    if (gola && (f.kind === 'door' || f.kind === 'drawer') && f.h > 12) {
      // recessed finger channel above the front
      fh -= 2.6;
      cy -= 1.3;
      b.box(mats.darkSteel, f.w, 2.4, 1.2, cx, f.y + f.h - 1.3, zf - ft + 0.2);
    }
    if (f.kind === 'glass') {
      const fr = Math.min(5, f.w / 4);
      b.box(doorM, f.w, fr, ft, cx, f.y + fr / 2, zf - ft / 2);
      b.box(doorM, f.w, fr, ft, cx, f.y + f.h - fr / 2, zf - ft / 2);
      b.box(doorM, fr, f.h - 2 * fr, ft, cx - f.w / 2 + fr / 2, cy, zf - ft / 2);
      b.box(doorM, fr, f.h - 2 * fr, ft, cx + f.w / 2 - fr / 2, cy, zf - ft / 2);
      b.box(mats.glass, f.w - 2 * fr, f.h - 2 * fr, 0.5, cx, cy, zf - ft / 2);
    } else if (fin.doorStyle === 'shaker' && f.w >= 20 && fh >= 20) {
      const rail = Math.min(6.5, f.w / 4, fh / 4);
      const raise = 0.7;
      b.box(doorM, f.w, fh, ft - raise, cx, cy, zf - ft / 2 - raise / 2);
      b.box(doorM, f.w, rail, raise, cx, cy - fh / 2 + rail / 2, zf - raise / 2);
      b.box(doorM, f.w, rail, raise, cx, cy + fh / 2 - rail / 2, zf - raise / 2);
      b.box(doorM, rail, fh - 2 * rail, raise, cx - f.w / 2 + rail / 2, cy, zf - raise / 2);
      b.box(doorM, rail, fh - 2 * rail, raise, cx + f.w / 2 - rail / 2, cy, zf - raise / 2);
    } else {
      b.box(doorM, f.w, fh, ft, cx, cy, zf - ft / 2);
    }
    handle(b, ctx, f, w, zf);
  }

  // ---- appliance sections ----
  for (const band of lay.bands) {
    if (band.kind === 'oven') ovenFront(b, mats, lay.x0 - w / 2 + 0.3, lay.x1 - w / 2 - 0.3, band.y0, band.y1, zf);
    if (band.kind === 'micro') microFront(b, mats, lay.x0 - w / 2 + 0.3, lay.x1 - w / 2 - 0.3, band.y0, band.y1, zf);
  }

  // LED profiles inside: two uprights behind the front edge and one under the top of every glass / open section
  if (it.opts.ledInside) {
    const led = mats.led(fin);
    const bands = openBands.length ? openBands : lay.bands.slice(0, 1);
    for (const band of bands) {
      const lo = Math.max(band.y0, pl + t);
      const hi = Math.min(band.y1, pl + hc - t);
      if (hi - lo < 6) continue;
      const z = zf - ft - 2.2;
      b.box(led, 0.9, hi - lo - 1, 0.9, -w / 2 + t + 0.7, (lo + hi) / 2, z);
      b.box(led, 0.9, hi - lo - 1, 0.9, w / 2 - t - 0.7, (lo + hi) / 2, z);
      b.box(led, w - 2 * t - 3, 0.6, 1.2, 0, hi - 0.5, z);
    }
  }

  // built-in extractor and LED under wall units
  if (it.cat === 'wall') {
    if (it.opts.hood) {
      b.box(mats.steel, w - 5, 1.6, cd - 6, 0, -0.8, zc);
      b.box(mats.darkSteel, w - 16, 0.4, cd - 18, 0, -1.7, zc);
    }
    if ((it.opts.ledUnder ?? fin.led) && it.elev > 100) b.box(mats.led(fin), w - 6, 0.5, 1.8, 0, -0.25, zf - 7);
  }
}

function buildTop(it: Item, ctx: BuildCtx, b: Batch) {
  const { fin, mats } = ctx;
  const ct = fin.countertopT;
  const oh = fin.overhang;
  const top = it.h;
  const x0 = it.opts.island ? -it.w / 2 - oh : -it.w / 2;
  const x1 = it.opts.island ? it.w / 2 + oh : it.w / 2;
  const z0 = it.opts.island ? -it.d / 2 - oh : -it.d / 2;
  const z1 = it.d / 2 + oh;
  if (it.opts.sink) sinkAndTop(b, ctx, it, x0, x1, z0, z1, top);
  else b.box(mats.countertop(fin.countertop), x1 - x0, ct, z1 - z0, (x0 + x1) / 2, top + ct / 2, (z0 + z1) / 2);
  if (it.opts.cooktop) cooktop(b, mats, it.opts.cooktop, it.w, top + ct, 1);
}

function buildSplash(it: Item, ctx: BuildCtx, b: Batch) {
  const mat = ctx.mats.splash(ctx.fin);
  if (!mat || !ctx.onWall) return;
  const from = it.h + (it.opts.countertop ? ctx.fin.countertopT : 0);
  const to = WALL_ELEV - it.elev;
  if (to - from < 5) return;
  b.box(mat, it.w, to - from, 0.8, 0, (from + to) / 2, -it.d / 2 + 0.4);
}

function buildAppliance(it: Item, ctx: BuildCtx, b: Batch) {
  const m = ctx.mats;
  const { w, h, d } = it;
  const zf = d / 2;
  switch (it.appliance) {
    case 'fridge': {
      b.box(m.casing, w - 1, h - 3, d - 5, 0, 3 + (h - 3) / 2, -2.5);
      b.box(m.black, w - 6, 3, d - 10, 0, 1.5, -2);
      const split = 3 + (h - 3) * 0.38;
      b.box(m.steel, w - 0.6, split - 3 - 0.4, 5, 0, 3 + (split - 3) / 2, zf - 2.5);
      b.box(m.steel, w - 0.6, h - split - 0.4, 5, 0, split + (h - split) / 2, zf - 2.5);
      b.box(m.darkSteel, 1.4, 30, 1.6, -w / 2 + 5, split - 20, zf + 2.2);
      b.box(m.darkSteel, 1.4, 44, 1.6, -w / 2 + 5, split + 28, zf + 2.2);
      for (const y of [split - 33, split - 7, split + 8, split + 48]) b.box(m.darkSteel, 1.2, 1.2, 2.4, -w / 2 + 5, y, zf + 1);
      break;
    }
    case 'fridge_sbs': {
      b.box(m.casing, w - 1, h - 3, d - 5, 0, 3 + (h - 3) / 2, -2.5);
      b.box(m.black, w - 6, 3, d - 10, 0, 1.5, -2);
      const lw = w * 0.42;
      b.box(m.steel, lw - 0.5, h - 3.4, 5, -w / 2 + lw / 2 + 0.1, 3 + (h - 3) / 2, zf - 2.5);
      b.box(m.steel, w - lw - 0.5, h - 3.4, 5, w / 2 - (w - lw) / 2 - 0.1, 3 + (h - 3) / 2, zf - 2.5);
      const sx = -w / 2 + lw;
      b.box(m.darkSteel, 1.4, h * 0.5, 1.6, sx - 3.2, h * 0.52, zf + 2.2);
      b.box(m.darkSteel, 1.4, h * 0.5, 1.6, sx + 3.2, h * 0.52, zf + 2.2);
      for (const y of [h * 0.3, h * 0.74]) {
        b.box(m.darkSteel, 1.2, 1.2, 2.4, sx - 3.2, y, zf + 1);
        b.box(m.darkSteel, 1.2, 1.2, 2.4, sx + 3.2, y, zf + 1);
      }
      b.box(m.blackGlass, lw * 0.5, 26, 0.6, -w / 2 + lw / 2 - 2, h * 0.62, zf + 0.1);
      break;
    }
    case 'cooker': {
      const body = m.steel;
      b.box(body, w, h - 8, d - 3, 0, 8 + (h - 8) / 2, -1.5);
      b.box(m.black, w - 4, 8, d - 10, 0, 4, -2);
      b.box(m.blackGlass, w, 1, d, 0, h - 0.5, 0);
      gasBurners(b, m, w - 2, d - 8, h, -1);
      // front: control strip, oven door, storage drawer
      b.box(m.darkSteel, w - 0.4, 9, 2.4, 0, h - 6.5, zf - 0.6);
      const knobs = w > 75 ? 6 : 5;
      for (let i = 0; i < knobs; i++) b.cyl(m.steel, 1.7, 2.2, (i - (knobs - 1) / 2) * (w / (knobs + 1)), h - 6.5, zf + 1.4, 'z', 14);
      const doorH = h - 11 - 8 - 14;
      b.box(m.blackGlass, w - 5, doorH, 1, 0, 8 + 14 + doorH / 2, zf - 0.6);
      b.box(m.steel, w - 12, 1.6, 1.6, 0, 8 + 14 + doorH - 4, zf + 2.6);
      b.box(m.steel, 1.2, 1.2, 2.6, -w / 2 + 8, 8 + 14 + doorH - 4, zf + 1.2);
      b.box(m.steel, 1.2, 1.2, 2.6, w / 2 - 8, 8 + 14 + doorH - 4, zf + 1.2);
      b.box(m.darkSteel, w - 3, 11.5, 1, 0, 8 + 7, zf - 0.8);
      b.box(body, w, 4, 2, 0, h + 2, -d / 2 + 1);
      break;
    }
    case 'hood': {
      const canopy = 6;
      b.box(m.steel, w, canopy, d, 0, canopy / 2, 0);
      b.box(m.darkSteel, w - 8, 0.5, d - 10, 0, -0.25, 1);
      b.box(m.steel, Math.min(w * 0.55, 34), 5, Math.min(30, d * 0.7), 0, canopy + 2.5, -d / 2 + Math.min(30, d * 0.7) / 2);
      b.box(m.steel, 24, h - canopy - 5, 22, 0, canopy + 5 + (h - canopy - 5) / 2, -d / 2 + 11);
      b.box(m.blackGlass, 14, 2, 0.4, 0, canopy / 2, d / 2 + 0.1);
      if (ctx.fin.led) {
        b.box(m.led(ctx.fin), 5, 0.3, 5, -w * 0.28, -0.55, 6);
        b.box(m.led(ctx.fin), 5, 0.3, 5, w * 0.28, -0.55, 6);
      }
      break;
    }
    case 'dishwasher': {
      const pl = Math.min(ctx.rules.plinthH / 10, 12);
      b.box(m.casing, w - 1, h - pl, d - 4, 0, pl + (h - pl) / 2, -2);
      b.box(m.plinth(ctx.fin), w, pl, 1.6, 0, pl / 2, zf - 7);
      b.box(m.steel, w - 0.6, h - pl - 12, 2, 0, pl + (h - pl - 12) / 2, zf - 1);
      b.box(m.blackGlass, w - 0.6, 11, 2, 0, h - 6, zf - 1);
      b.box(m.steel, w - 14, 1.6, 1.6, 0, h - 15.5, zf + 2.4);
      b.box(m.steel, 1.2, 1.2, 2.6, -w / 2 + 9, h - 15.5, zf + 1);
      b.box(m.steel, 1.2, 1.2, 2.6, w / 2 - 9, h - 15.5, zf + 1);
      break;
    }
    case 'dryer':
    case 'washer': {
      b.box(m.white, w - 0.6, h - 1.5, d - 3, 0, 1.5 + (h - 1.5) / 2, -1.5);
      b.box(m.black, w - 6, 1.5, d - 10, 0, 0.75, -2);
      b.box(m.grey, w - 0.6, 11, 1, 0, h - 6.5, zf - 1);
      b.cyl(m.steel, 3, 2.4, w / 2 - 12, h - 6.5, zf + 0.6, 'z', 20);
      b.box(m.blackGlass, 13, 4.5, 0.4, -4, h - 6.5, zf - 0.4);
      const r = Math.min(17, w / 2 - 8);
      const cy = (h - 12) / 2 + 2;
      b.torus(m.steel, r, 2.2, 0, cy, zf - 0.6);
      b.cyl(m.blackGlass, r - 1.4, 1.2, 0, cy, zf - 1, 'z', 28);
      break;
    }
    case 'microwave': {
      b.box(m.darkSteel, w, h, d - 2, 0, h / 2, -1);
      const gw = w * 0.72;
      b.box(m.blackGlass, gw - 2, h - 5, 1, -w / 2 + gw / 2 + 0.5, h / 2, zf - 0.6);
      b.box(m.blackGlass, w - gw - 2, h - 5, 0.8, w / 2 - (w - gw) / 2 - 0.3, h / 2, zf - 0.7);
      b.box(m.steel, 1.1, h - 9, 1.3, -w / 2 + gw + 0.2, h / 2, zf + 1.2);
      b.cyl(m.steel, 1.7, 1.6, w / 2 - (w - gw) / 2 - 0.3, h * 0.28, zf + 0.5, 'z', 16);
      break;
    }
    case 'freezer': {
      b.box(m.casing, w - 1, h - 3, d - 5, 0, 3 + (h - 3) / 2, -2.5);
      b.box(m.black, w - 6, 3, d - 10, 0, 1.5, -2);
      b.box(m.white, w - 0.6, h - 3.4, 5, 0, 3 + (h - 3) / 2, zf - 2.5);
      b.box(m.darkSteel, 1.4, 50, 1.6, -w / 2 + 5, h * 0.55, zf + 2.2);
      b.box(m.blackGlass, 12, 4, 0.4, 0, h - 10, zf + 0.1);
      break;
    }
    case 'chest_freezer': {
      b.box(m.white, w, h - 7, d, 0, (h - 7) / 2, 0);
      b.box(m.white, w + 1, 6, d + 1, 0, h - 3, 0);
      b.box(m.grey, w + 1.2, 0.8, d + 1.2, 0, h - 6.4, 0);
      b.box(m.steel, 14, 1.6, 2, 0, h - 4, zf + 1.2);
      b.box(m.black, w - 8, 3, d - 8, 0, 1.5, 0);
      break;
    }
    case 'wine': {
      const pl = Math.min(ctx.rules.plinthH / 10, 12);
      b.box(m.casing, w - 1, h - pl, d - 4, 0, pl + (h - pl) / 2, -2);
      b.box(m.plinth(ctx.fin), w, pl, 1.6, 0, pl / 2, zf - 7);
      b.box(m.darkSteel, w - 0.6, h - pl - 0.6, 1.6, 0, pl + (h - pl) / 2, zf - 1.4);
      b.box(m.blackGlass, w - 7, h - pl - 8, 1, 0, pl + (h - pl) / 2, zf - 0.4);
      b.box(m.steel, 1.2, h - pl - 20, 1.4, w / 2 - 3, pl + (h - pl) / 2, zf + 1.6);
      break;
    }
    case 'dispenser': {
      b.box(m.white, w, h, d, 0, h / 2, 0);
      b.box(m.grey, w - 6, 16, 1, 0, h - 26, zf + 0.2);
      b.box(m.grey, w - 8, 1.2, 9, 0, h - 36, zf + 3);
      b.cyl(m.steel, 1, 3, -5, h - 20, zf + 1.5, 'z', 10);
      b.cyl(m.steel, 1, 3, 5, h - 20, zf + 1.5, 'z', 10);
      b.cyl(m.glass, Math.min(w, d) / 2 - 3, 34, 0, h + 19, 0, 'y', 22);
      b.cyl(m.glass, 5, 6, 0, h + 3, 0, 'y', 14);
      break;
    }
    case 'heater': {
      const r = Math.min(w, d) / 2;
      b.cyl(m.white, r, h, 0, h / 2, 0, 'y', 28);
      b.cyl(m.grey, r + 0.4, 2, 0, 1, 0, 'y', 28);
      b.cyl(m.grey, r + 0.4, 2, 0, h - 1, 0, 'y', 28);
      b.cyl(m.steel, 1, 14, -6, -7, 0, 'y', 10);
      b.cyl(m.steel, 1, 14, 6, -7, 0, 'y', 10);
      b.cyl(m.blackGlass, 3, 0.6, 0, h * 0.25, r, 'z', 16);
      break;
    }
    case 'coffee': {
      b.box(m.darkSteel, w, h, d * 0.6, 0, h / 2, -d * 0.2);
      b.box(m.darkSteel, w, 4, d, 0, 2, 0);
      b.box(m.darkSteel, w, 9, d, 0, h - 4.5, 0);
      b.box(m.steel, w * 0.5, 5, 6, 0, h - 11, d * 0.2);
      b.box(m.steel, w - 4, 0.6, d * 0.35, 0, 4.3, d * 0.28);
      b.cyl(m.white, 3.4, 6, 0, 7.6, d * 0.28, 'y', 16);
      break;
    }
    default:
      b.box(m.grey, w, h, d, 0, h / 2, 0);
  }
}

/** Build the mesh group for one item, positioned and rotated in the scene (metres). */
export function buildItem(it: Item, ctx: BuildCtx): THREE.Group {
  const r = (it.rot * Math.PI) / 180;
  const along = it.x * Math.cos(r) + it.y * Math.sin(r);
  const across = -it.x * Math.sin(r) + it.y * Math.cos(r);
  const b = new Batch(along, across);
  if (it.cat === 'appliance') buildAppliance(it, ctx, b);
  else buildCabinet(it, ctx, b);
  if (it.opts.countertop) buildTop(it, ctx, b);
  if (it.opts.countertop || it.appliance === 'cooker') buildSplash(it, ctx, b);
  const g = b.build();
  g.position.set(it.x * CM, it.elev * CM, it.y * CM);
  g.rotation.y = -r;
  g.userData.itemId = it.id;
  return g;
}

export function disposeGroup(g: THREE.Object3D) {
  g.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
  });
}
