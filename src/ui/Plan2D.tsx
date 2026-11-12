import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Columns3, Copy, DoorOpen, Maximize, Plug, Plus, RotateCw, Ruler, SlidersHorizontal, Sparkles, Square, Trash2 } from 'lucide-react';
import { fmtCm, getLang, L } from '../i18n';
import { tagItems } from '../lib/bom';
import { itemName } from '../lib/catalog';
import {
  bounds,
  clamp,
  dot,
  findProblems,
  getWalls,
  itemCorners,
  itemWall,
  pointInPolygon,
  signedArea,
  snapItem,
  sub,
  uid,
  wallObstacles,
  wallPoint,
  type Wall,
} from '../lib/geometry';
import { useStore } from '../store';
import type { Item, Opening, UtilityType, Vec2 } from '../types';
import { Assistant } from './Assistant';
import { Seg } from './components';
import { ItemProps } from './ItemProps';
import { Library } from './Library';
import { RoomElementSheet, RoomSettings, UTIL_META, type RoomSel } from './RoomSheets';

interface View {
  s: number;
  tx: number;
  ty: number;
}

type Gesture =
  | { kind: 'pan'; sx: number; sy: number; tx0: number; ty0: number; moved: boolean }
  | { kind: 'pinch'; d0: number; s0: number; wx: number; wy: number }
  | { kind: 'item'; id: string; start: Vec2; orig: Vec2; moved: boolean; sx: number; sy: number; hits: string[]; wasSelected: boolean }
  | { kind: 'vertex'; index: number; moved: boolean; sx: number; sy: number }
  | { kind: 'opening'; id: string; grab: number; moved: boolean; sx: number; sy: number }
  | { kind: 'utility'; id: string; moved: boolean; sx: number; sy: number }
  | { kind: 'column'; id: string; start: Vec2; orig: Vec2; moved: boolean; sx: number; sy: number }
  | { kind: 'wall'; index: number; sx: number; sy: number; tx0: number; ty0: number; moved: boolean };

const CAT_STYLE: Record<string, { fill: string; stroke: string }> = {
  base: { fill: '#eadfc9', stroke: '#8a7754' },
  tall: { fill: '#cdb68d', stroke: '#6f5d3c' },
  wall: { fill: 'rgba(96,150,200,0.22)', stroke: '#3f79ad' },
  appliance: { fill: '#d6dbe0', stroke: '#5f6b78' },
};

function nearestWall(walls: Wall[], p: Vec2): { wall: Wall; t: number; d: number } | null {
  let best: { wall: Wall; t: number; d: number } | null = null;
  for (const w of walls) {
    const rel = sub(p, w.a);
    const t = clamp(dot(rel, w.dir), 0, w.len);
    const q = wallPoint(w, t);
    const d = Math.hypot(p.x - q.x, p.y - q.y);
    if (!best || d < best.d) best = { wall: w, t, d };
  }
  return best;
}

export function Plan2D() {
  const project = useStore((s) => s.project)!;
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const updateItem = useStore((s) => s.updateItem);
  const removeItem = useStore((s) => s.removeItem);
  const duplicateItem = useStore((s) => s.duplicateItem);
  const pushHistory = useStore((s) => s.pushHistory);
  const setRoom = useStore((s) => s.setRoom);
  const notify = useStore((s) => s.notify);

  const holder = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 360, h: 520 });
  const [view, setView] = useState<View>({ s: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [mode, setMode] = useState<'units' | 'room'>(project.items.length === 0 && project.room.openings.length === 0 ? 'room' : 'units');
  const [roomSel, setRoomSel] = useState<RoomSel | null>(null);
  const [sheet, setSheet] = useState<null | 'library' | 'props' | 'assistant' | 'room' | 'services'>(null);
  const [showDims, setShowDims] = useState(true);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const fittedFor = useRef('');

  const room = project.room;
  const walls = useMemo(() => getWalls(room), [room]);
  const problems = useMemo(() => findProblems(project.items, room), [project.items, room]);
  const tags = useMemo(() => tagItems(project).tags, [project]);
  const lang = getLang();
  const selected = project.items.find((i) => i.id === selectedId) ?? null;

  // ---- view fitting ----
  const fit = useCallback(() => {
    const b = bounds(room.points);
    const pad = 64;
    const el = holder.current;
    const w = el?.clientWidth ?? size.w;
    const h = el?.clientHeight ?? size.h;
    // leave room for the floating toolbars at the top and bottom
    const s = Math.max(0.05, Math.min((w - pad * 2) / Math.max(b.w, 1), (h - pad * 2 - 84) / Math.max(b.h, 1)));
    setView({ s, tx: w / 2 - b.cx * s, ty: h / 2 - b.cy * s - 14 });
  }, [room.points, size.w, size.h]);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const key = project.id + ':' + size.w + 'x' + size.h;
    if (size.w > 0 && fittedFor.current !== key) {
      fittedFor.current = key;
      fit();
    }
  }, [project.id, size.w, size.h, fit]);

  // wheel zoom (desktop)
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const v = viewRef.current;
      const s = clamp(v.s * Math.exp(-e.deltaY * 0.0015), 0.08, 12);
      setView({ s, tx: px - ((px - v.tx) / v.s) * s, ty: py - ((py - v.ty) / v.s) * s });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const toWorld = (cx: number, cy: number): Vec2 => {
    const rect = svgRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (cx - rect.left - v.tx) / v.s, y: (cy - rect.top - v.ty) / v.s };
  };
  const toScreen = (p: Vec2): Vec2 => ({ x: p.x * view.s + view.tx, y: p.y * view.s + view.ty });

  // ---- pointer handling ----
  const onPointerDown = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const rect = svg.getBoundingClientRect();
      const mx = (a.x + b.x) / 2 - rect.left;
      const my = (a.y + b.y) / 2 - rect.top;
      const v = viewRef.current;
      gesture.current = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: v.s, wx: (mx - v.tx) / v.s, wy: (my - v.ty) / v.s };
      return;
    }
    if (pointers.current.size > 2) return;
    const target = (e.target as Element).closest('[data-kind]') as HTMLElement | SVGElement | null;
    const kind = target?.getAttribute('data-kind');
    const id = target?.getAttribute('data-id') ?? '';
    const world = toWorld(e.clientX, e.clientY);
    const base = { moved: false, sx: e.clientX, sy: e.clientY };
    const v = viewRef.current;
    if (kind === 'item' && mode === 'units') {
      // wall units hang over base units, so several items can sit under one finger:
      // keep working with the selected one if it is among them, otherwise take the top-most
      const hits = [...upperItems].reverse().concat([...floorItems].reverse()).filter((i) => pointInPolygon(world, itemCorners(i))).map((i) => i.id);
      if (!hits.includes(id)) hits.unshift(id);
      const wasSelected = !!selectedId && hits.includes(selectedId);
      const targetId = wasSelected ? selectedId! : hits[0];
      const it = project.items.find((i) => i.id === targetId);
      if (it) {
        if (!wasSelected) select(targetId);
        gesture.current = { kind: 'item', id: targetId, start: world, orig: { x: it.x, y: it.y }, hits, wasSelected, ...base };
        return;
      }
    }
    if (mode === 'room') {
      if (kind === 'vertex') {
        gesture.current = { kind: 'vertex', index: Number(id), ...base };
        return;
      }
      if (kind === 'opening') {
        const op = room.openings.find((o) => o.id === id);
        if (op) {
          const w = walls[op.wall];
          const t = dot(sub(world, w.a), w.dir);
          gesture.current = { kind: 'opening', id, grab: t - op.offset, ...base };
          return;
        }
      }
      if (kind === 'utility') {
        gesture.current = { kind: 'utility', id, ...base };
        return;
      }
      if (kind === 'column') {
        const c = room.columns.find((x) => x.id === id);
        if (c) {
          gesture.current = { kind: 'column', id, start: world, orig: { x: c.x, y: c.y }, ...base };
          return;
        }
      }
      if (kind === 'wall') {
        gesture.current = { kind: 'wall', index: Number(id), sx: e.clientX, sy: e.clientY, tx0: v.tx, ty0: v.ty, moved: false };
        return;
      }
    }
    gesture.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, tx0: v.tx, ty0: v.ty, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'pinch') {
      if (pointers.current.size < 2) return;
      const [a, b] = [...pointers.current.values()];
      const rect = svgRef.current!.getBoundingClientRect();
      const mx = (a.x + b.x) / 2 - rect.left;
      const my = (a.y + b.y) / 2 - rect.top;
      const s = clamp((g.s0 * Math.hypot(a.x - b.x, a.y - b.y)) / g.d0, 0.08, 12);
      setView({ s, tx: mx - g.wx * s, ty: my - g.wy * s });
      return;
    }
    const dx = e.clientX - g.sx;
    const dy = e.clientY - g.sy;
    if (!g.moved) {
      if (Math.hypot(dx, dy) < 6) return;
      g.moved = true;
      if (g.kind !== 'pan' && g.kind !== 'wall') pushHistory();
    }
    const world = toWorld(e.clientX, e.clientY);
    switch (g.kind) {
      case 'pan':
      case 'wall':
        setView((v) => ({ ...v, tx: g.tx0 + dx, ty: g.ty0 + dy }));
        break;
      case 'item': {
        const st = useStore.getState().project!;
        const it = st.items.find((i) => i.id === g.id);
        if (!it) break;
        const desired = { x: g.orig.x + (world.x - g.start.x), y: g.orig.y + (world.y - g.start.y) };
        const snap = snapItem(
          it,
          desired,
          st.room,
          st.items.filter((i) => i.id !== g.id),
          Math.min(12, 9 / viewRef.current.s + 3),
        );
        if (snap.x !== it.x || snap.y !== it.y || snap.rot !== it.rot) updateItem(g.id, { x: snap.x, y: snap.y, rot: snap.rot }, false);
        break;
      }
      case 'vertex': {
        const st = useStore.getState().project!;
        const pts = st.room.points;
        const n = pts.length;
        let x = Math.round(world.x / 5) * 5;
        let y = Math.round(world.y / 5) * 5;
        // keep walls square with the neighbouring corners when close
        for (const k of [(g.index - 1 + n) % n, (g.index + 1) % n]) {
          if (Math.abs(pts[k].x - world.x) < 9 / viewRef.current.s + 4) x = pts[k].x;
          if (Math.abs(pts[k].y - world.y) < 9 / viewRef.current.s + 4) y = pts[k].y;
        }
        const next = pts.map((p, i) => (i === g.index ? { x, y } : p));
        if (signedArea(next) > 2000) setRoom((r) => ({ ...r, points: next }), false);
        break;
      }
      case 'opening': {
        const st = useStore.getState().project!;
        const op = st.room.openings.find((o) => o.id === g.id);
        if (!op) break;
        const ws = getWalls(st.room);
        const near = nearestWall(ws, world);
        if (!near) break;
        let wallIdx = op.wall;
        let grab = g.grab;
        if (near.wall.i !== op.wall && near.d < 40 && near.wall.len >= op.width) {
          wallIdx = near.wall.i;
          grab = op.width / 2;
          g.grab = grab;
        }
        const w = ws[wallIdx];
        const t = dot(sub(world, w.a), w.dir);
        const offset = clamp(Math.round(t - grab), 0, Math.max(0, w.len - op.width));
        if (offset !== op.offset || wallIdx !== op.wall) setRoom((r) => ({ ...r, openings: r.openings.map((o) => (o.id === g.id ? { ...o, wall: wallIdx, offset } : o)) }), false);
        break;
      }
      case 'utility': {
        const st = useStore.getState().project!;
        const near = nearestWall(getWalls(st.room), world);
        if (!near) break;
        const offset = Math.round(near.t);
        setRoom((r) => ({ ...r, utilities: r.utilities.map((u) => (u.id === g.id ? { ...u, wall: near.wall.i, offset } : u)) }), false);
        break;
      }
      case 'column': {
        const x = Math.round(g.orig.x + world.x - g.start.x);
        const y = Math.round(g.orig.y + world.y - g.start.y);
        setRoom((r) => ({ ...r, columns: r.columns.map((c) => (c.id === g.id ? { ...c, x, y } : c)) }), false);
        break;
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'pinch') {
      if (pointers.current.size < 2) gesture.current = null;
      return;
    }
    gesture.current = null;
    if (g.moved) return;
    // taps
    if (g.kind === 'pan') {
      select(null);
      setRoomSel(null);
    } else if (g.kind === 'item') {
      // tapping again on a stack of units moves the selection to the next one underneath
      if (g.wasSelected && g.hits.length > 1) select(g.hits[(g.hits.indexOf(g.id) + 1) % g.hits.length]);
    } else if (g.kind === 'vertex') setRoomSel({ kind: 'vertex', index: g.index });
    else if (g.kind === 'wall') setRoomSel({ kind: 'wall', index: g.index });
    else if (g.kind === 'opening' || g.kind === 'utility' || g.kind === 'column') setRoomSel({ kind: g.kind, id: g.id });
  };

  // ---- actions ----
  const rotateSelected = () => {
    if (!selected) return;
    const rot = (selected.rot + 90) % 360;
    // a unit turned next to a wall would poke through it: slide it back inside the room
    let { x, y } = selected;
    const inside = () => itemCorners({ ...selected, x, y, rot }).every((c) => pointInPolygon(c, room.points));
    for (let k = 0; k < 60 && !inside(); k++) {
      const dx = b.cx - x;
      const dy = b.cy - y;
      const l = Math.hypot(dx, dy) || 1;
      x += (dx / l) * 4;
      y += (dy / l) * 4;
    }
    updateItem(selected.id, { rot, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, opts: { ...selected.opts, freeRot: true } });
  };

  const freeSpotOnWall = (width: number): { wall: number; offset: number } => {
    const prefer = roomSel?.kind === 'wall' ? roomSel.index : undefined;
    const order = [...walls].sort((a, b) => (a.i === prefer ? -1 : b.i === prefer ? 1 : b.len - a.len));
    for (const w of order) {
      if (w.len < width + 10) continue;
      const taken = room.openings.filter((o) => o.wall === w.i).map((o) => ({ a: o.offset - 10, b: o.offset + o.width + 10 }));
      const candidates = [w.len / 2 - width / 2, 20, w.len - width - 20, ...taken.map((t) => t.b)];
      for (const c of candidates) {
        if (c < 0 || c + width > w.len) continue;
        if (!taken.some((t) => c < t.b && c + width > t.a)) return { wall: w.i, offset: Math.round(c) };
      }
    }
    return { wall: order[0].i, offset: Math.max(0, Math.round(order[0].len / 2 - width / 2)) };
  };

  const addOpening = (type: 'door' | 'window') => {
    const width = type === 'door' ? 90 : 120;
    const spot = freeSpotOnWall(width);
    const op: Opening = { id: uid(), type, wall: spot.wall, offset: spot.offset, width, height: type === 'door' ? 210 : 110, sill: type === 'door' ? 0 : 100 };
    setRoom((r) => ({ ...r, openings: [...r.openings, op] }));
    setRoomSel({ kind: 'opening', id: op.id });
  };
  const addUtility = (type: UtilityType) => {
    const prefer = roomSel?.kind === 'wall' ? walls[roomSel.index] : [...walls].sort((a, b) => b.len - a.len)[0];
    // keep clear of doors and of the points already on this wall
    const blocked = [
      ...room.openings.filter((o) => o.wall === prefer.i && o.type === 'door').map((o) => ({ a: o.offset - 8, b: o.offset + o.width + 8 })),
      ...room.utilities.filter((u) => u.wall === prefer.i).map((u) => ({ a: u.offset - 14, b: u.offset + 14 })),
    ];
    let offset = prefer.len / 2;
    for (let k = 0; k < 80; k++) {
      const c = prefer.len / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 12;
      if (c < 10 || c > prefer.len - 10) continue;
      if (!blocked.some((bl) => c > bl.a && c < bl.b)) {
        offset = c;
        break;
      }
    }
    const ut = { id: uid(), type, wall: prefer.i, offset: Math.round(offset), height: UTIL_META[type].height };
    setRoom((r) => ({ ...r, utilities: [...r.utilities, ut] }));
    setSheet(null);
    setRoomSel({ kind: 'utility', id: ut.id });
  };
  const addColumn = () => {
    const b = bounds(room.points);
    const col = { id: uid(), x: Math.round(b.minX + 20), y: Math.round(b.minY + 20), w: 40, d: 40 };
    // tuck it into the first corner
    setRoom((r) => ({ ...r, columns: [...r.columns, { ...col, x: r.points[0].x + 20, y: r.points[0].y + 20 }] }));
    setRoomSel({ kind: 'column', id: col.id });
  };

  // ---- derived drawing data ----
  const T = room.wallThickness;
  const polyPts = room.points.map((p) => `${p.x},${p.y}`).join(' ');
  const floorItems = project.items.filter((i) => i.cat !== 'wall' && i.elev < 100);
  const upperItems = project.items.filter((i) => !(i.cat !== 'wall' && i.elev < 100));
  const px = 1 / view.s; // one screen pixel in world units
  const grid = view.s > 0.9 ? 10 : 50;
  const b = bounds(room.points);

  const selDims = useMemo(() => {
    if (!selected || mode !== 'units') return null;
    const att = itemWall(selected, walls);
    if (!att) return null;
    const obs = wallObstacles(
      att.wall,
      room,
      project.items.filter((i) => i.id !== selected.id),
      selected,
      false,
    );
    let left = 0;
    let right = att.wall.len;
    for (const o of obs) {
      if (o.b <= att.t0 + 0.6) left = Math.max(left, o.b);
      if (o.a >= att.t1 - 0.6) right = Math.min(right, o.a);
    }
    return { wall: att.wall, t0: att.t0, t1: att.t1, left, right, depth: selected.d };
  }, [selected, walls, room, project.items, mode]);

  const renderItem = (it: Item) => {
    const st = CAT_STYLE[it.cat];
    const prob = problems.get(it.id);
    const isSel = it.id === selectedId;
    const upper = it.cat === 'wall' || it.elev >= 100;
    const stroke = prob ? '#cf3f3f' : isSel ? '#0f766e' : st.stroke;
    const hw = it.w / 2;
    const hd = it.d / 2;
    const detail: React.ReactNode[] = [];
    if (it.opts.sink) {
      const n = it.opts.sink === 'double' ? 2 : 1;
      const bw = n === 2 ? Math.min(36, (it.w - 16) / 2) : Math.min(46, it.w - 14);
      for (let k = 0; k < n; k++) {
        const cx = n === 2 ? (k === 0 ? -bw / 2 - 3 : bw / 2 + 3) : 0;
        detail.push(<rect key={'s' + k} x={cx - bw / 2} y={-16} width={bw} height={34} rx={5} fill="#f6f8fa" stroke="#6b7684" strokeWidth={1} vectorEffect="non-scaling-stroke" />);
      }
      detail.push(<circle key="tap" cx={0} cy={-21} r={2.6} fill="#6b7684" />);
    }
    if (it.opts.cooktop || it.appliance === 'cooker') {
      const r = Math.min(7.5, it.w / 9);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) detail.push(<circle key={`c${sx}${sy}`} cx={sx * Math.min(15, it.w / 4)} cy={sy * 12 + 1} r={r} fill="none" stroke="#39424d" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />);
    }
    if (it.appliance === 'washer') detail.push(<circle key="w" cx={0} cy={0} r={Math.min(18, it.w / 3)} fill="none" stroke="#5f6b78" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />);
    if (it.opts.blind) {
      const bw = Math.min(it.opts.blindW ?? 50, it.w - 20);
      const x0 = it.opts.blind === 'L' ? -hw : hw - bw;
      detail.push(<rect key="bl" x={x0} y={-hd} width={bw} height={it.d} fill="url(#hatch)" opacity={0.5} />);
    }
    return (
      <g key={it.id} transform={`translate(${it.x} ${it.y}) rotate(${it.rot})`} data-kind="item" data-id={it.id} style={{ cursor: mode === 'units' ? 'grab' : 'default', pointerEvents: mode === 'units' ? 'auto' : 'none' }} opacity={mode === 'room' ? 0.45 : 1}>
        <rect
          x={-hw}
          y={-hd}
          width={it.w}
          height={it.d}
          fill={prob ? 'rgba(207,63,63,0.22)' : st.fill}
          stroke={stroke}
          strokeWidth={isSel || prob ? 2.4 : 1.2}
          strokeDasharray={upper ? `${5 * px} ${3.5 * px}` : undefined}
          vectorEffect="non-scaling-stroke"
        />
        {!upper && <rect x={-hw} y={hd - Math.min(3.2, it.d / 4)} width={it.w} height={Math.min(3.2, it.d / 4)} fill={stroke} opacity={0.55} />}
        {detail}
      </g>
    );
  };

  const labelFor = (it: Item) => {
    const sw = it.w * view.s;
    const sd = it.d * view.s;
    if (Math.min(sw, sd) < 13) return null;
    const upper = it.cat === 'wall' || it.elev >= 100;
    const r = (it.rot * Math.PI) / 180;
    const f = { x: -Math.sin(r), y: Math.cos(r) };
    // wall units hang over floor units: push the two labels apart so both stay readable
    const stacked = upper ? floorItems.some((o) => Math.hypot(o.x - it.x, o.y - it.y) < 45) : upperItems.some((o) => Math.hypot(o.x - it.x, o.y - it.y) < 45);
    const shift = !stacked ? 0 : upper ? -it.d / 2 + 8 : it.d / 2 - 13;
    const c = toScreen({ x: it.x + f.x * shift, y: it.y + f.y * shift });
    const tag = tags.get(it.id) ?? '';
    const room = (stacked ? (upper ? 16 : 26) : Math.min(sw, sd)) * (stacked ? view.s : 1);
    const showW = !upper && sw >= 30 && room >= 22;
    const size = Math.max(8, Math.min(11, Math.min(sw, sd) * 0.42));
    return (
      <g key={'l' + it.id} transform={`translate(${c.x} ${c.y})`} opacity={mode === 'room' ? 0.4 : 1}>
        <text textAnchor="middle" y={showW ? -1 : size * 0.36} fontSize={size} fontWeight={800} fill={upper ? '#2d6491' : '#3a3324'} style={{ direction: 'ltr' }}>
          {tag}
        </text>
        {showW && (
          <text textAnchor="middle" y={size - 1} fontSize={size - 1.5} fontWeight={600} fill="#6b5f45" style={{ direction: 'ltr' }}>
            {fmtCm(it.w)}
          </text>
        )}
      </g>
    );
  };

  const overlapCount = [...problems.values()].length;

  return (
    <div className="plan" ref={holder}>
      <svg ref={svgRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <defs>
          <pattern id="grid" width={grid} height={grid} patternUnits="userSpaceOnUse">
            <path d={`M ${grid} 0 L 0 0 0 ${grid}`} fill="none" stroke="#d3d7dc" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          </pattern>
          <pattern id="hatch" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={6} stroke="#7b6a48" strokeWidth={1.4} />
          </pattern>
        </defs>
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.s})`}>
          <rect x={b.minX - 3000} y={b.minY - 3000} width={b.w + 6000} height={b.h + 6000} fill="url(#grid)" />
          {/* walls: thick outline, then the floor on top */}
          <polygon points={polyPts} fill="none" stroke="#3b4450" strokeWidth={T * 2} strokeLinejoin="miter" />
          <polygon points={polyPts} fill="#fbfaf7" stroke="#3b4450" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          {mode === 'room' &&
            walls.map((w) => (
              <line key={'wh' + w.i} x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} stroke={roomSel?.kind === 'wall' && roomSel.index === w.i ? '#0f766e' : 'transparent'} strokeWidth={Math.max(T * 2, 26 * px)} data-kind="wall" data-id={w.i} style={{ cursor: 'pointer' }} opacity={0.35} />
            ))}
          {room.columns.map((c) => (
            <rect
              key={c.id}
              x={c.x - c.w / 2}
              y={c.y - c.d / 2}
              width={c.w}
              height={c.d}
              fill="#59626e"
              stroke={roomSel?.kind === 'column' && roomSel.id === c.id ? '#0f766e' : '#3b4450'}
              strokeWidth={roomSel?.kind === 'column' && roomSel.id === c.id ? 2.5 : 1}
              vectorEffect="non-scaling-stroke"
              data-kind="column"
              data-id={c.id}
              style={{ pointerEvents: mode === 'room' ? 'auto' : 'none' }}
            />
          ))}
          {/* openings */}
          {room.openings.map((op) => {
            const w = walls[op.wall];
            if (!w) return null;
            const sel = roomSel?.kind === 'opening' && roomSel.id === op.id;
            const col = sel ? '#0f766e' : op.type === 'door' ? '#8b5e34' : '#2f80ed';
            return (
              <g key={op.id} transform={`translate(${w.a.x} ${w.a.y}) rotate(${w.angle})`} data-kind="opening" data-id={op.id} style={{ pointerEvents: mode === 'room' ? 'auto' : 'none', cursor: 'grab' }}>
                <rect x={op.offset} y={-T - 0.5} width={op.width} height={T + 1} fill="#fbfaf7" stroke={col} strokeWidth={sel ? 2.4 : 1.2} vectorEffect="non-scaling-stroke" />
                {op.type === 'door' ? (
                  <>
                    {(() => {
                      const right = op.hinge === 'R';
                      const out = op.swing === 'out';
                      const hx = right ? op.offset + op.width : op.offset;
                      const ex = right ? op.offset : op.offset + op.width;
                      const y0 = out ? -T : 0;
                      const y1 = y0 + (out ? -op.width : op.width);
                      const sweep = right !== out ? 1 : 0;
                      return (
                        <>
                          <path d={`M ${hx} ${y0} L ${hx} ${y1} A ${op.width} ${op.width} 0 0 ${sweep} ${ex} ${y0}`} fill="rgba(139,94,52,0.08)" stroke={col} strokeWidth={1} strokeDasharray={`${4 * px} ${3 * px}`} vectorEffect="non-scaling-stroke" />
                          <line x1={hx} y1={y0} x2={hx} y2={y1} stroke={col} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    <line x1={op.offset} y1={-T / 2} x2={op.offset + op.width} y2={-T / 2} stroke={col} strokeWidth={2.2} vectorEffect="non-scaling-stroke" />
                    <line x1={op.offset} y1={-T / 2 - 2.2} x2={op.offset + op.width} y2={-T / 2 - 2.2} stroke={col} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
                    <line x1={op.offset} y1={-T / 2 + 2.2} x2={op.offset + op.width} y2={-T / 2 + 2.2} stroke={col} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
                  </>
                )}
                {/* generous invisible touch target */}
                <rect x={op.offset} y={-T - 10 * px} width={op.width} height={T + 26 * px} fill="transparent" />
              </g>
            );
          })}
          {floorItems.map(renderItem)}
          {upperItems.map(renderItem)}
          {/* selected item: distances to its neighbours */}
          {selDims && showDims && (
            <g transform={`translate(${selDims.wall.a.x} ${selDims.wall.a.y}) rotate(${selDims.wall.angle})`} pointerEvents="none">
              {[
                [selDims.left, selDims.t0],
                [selDims.t1, selDims.right],
              ]
                .filter(([a, c]) => c - a > 0.6)
                .map(([a, c], i) => {
                  const y = selDims.depth + 14 * px;
                  return (
                    <g key={i} stroke="#0f766e" strokeWidth={1.3}>
                      <line x1={a} y1={y} x2={c} y2={y} vectorEffect="non-scaling-stroke" />
                      <line x1={a} y1={y - 5 * px} x2={a} y2={y + 5 * px} vectorEffect="non-scaling-stroke" />
                      <line x1={c} y1={y - 5 * px} x2={c} y2={y + 5 * px} vectorEffect="non-scaling-stroke" />
                    </g>
                  );
                })}
            </g>
          )}
        </g>

        {/* ---- screen-space layer: labels keep a constant size ---- */}
        {showDims &&
          walls.map((w) => {
            const mid = toScreen(wallPoint(w, w.len / 2, -(T + 0)));
            const off = 15;
            const x = mid.x - w.n.x * off;
            const y = mid.y - w.n.y * off;
            let ang = w.angle;
            if (ang > 90 && ang <= 270) ang -= 180;
            if (w.len * view.s < 34) return null;
            return (
              <g key={'wl' + w.i} transform={`translate(${x} ${y}) rotate(${ang})`}>
                <text textAnchor="middle" y={4} fontSize={12} fontWeight={800} fill="#27313d" stroke="#e9ebee" strokeWidth={3.5} paintOrder="stroke" style={{ direction: 'ltr' }}>
                  {fmtCm(w.len)}
                </text>
              </g>
            );
          })}
        {room.utilities.map((u) => {
          const w = walls[u.wall];
          if (!w) return null;
          const p = toScreen(wallPoint(w, u.offset, 0));
          const meta = UTIL_META[u.type];
          const sel = roomSel?.kind === 'utility' && roomSel.id === u.id;
          return (
            <g key={u.id} transform={`translate(${p.x + w.n.x * 9} ${p.y + w.n.y * 9})`} data-kind="utility" data-id={u.id} style={{ pointerEvents: mode === 'room' ? 'auto' : 'none', cursor: 'grab' }} opacity={mode === 'room' ? 1 : 0.75}>
              <circle r={mode === 'room' ? 16 : 8} fill="transparent" />
              <circle r={8} fill={meta.color} stroke={sel ? '#0f766e' : '#fff'} strokeWidth={sel ? 3 : 1.5} />
              <text textAnchor="middle" y={3.4} fontSize={9} fontWeight={800} fill="#fff" style={{ direction: 'ltr' }}>
                {meta.letter}
              </text>
            </g>
          );
        })}
        {project.items.map(labelFor)}
        {selDims &&
          showDims &&
          [
            [selDims.left, selDims.t0],
            [selDims.t1, selDims.right],
          ]
            .filter(([a, c]) => c - a > 0.6)
            .map(([a, c], i) => {
              const p = toScreen(wallPoint(selDims.wall, (a + c) / 2, selDims.depth));
              const x = p.x + selDims.wall.n.x * 27;
              const y = p.y + selDims.wall.n.y * 27;
              return (
                <text key={'sd' + i} x={x} y={y + 4} textAnchor="middle" fontSize={11.5} fontWeight={800} fill="#0f766e" stroke="#fff" strokeWidth={3.5} paintOrder="stroke" style={{ direction: 'ltr' }}>
                  {fmtCm(c - a)}
                </text>
              );
            })}
        {mode === 'room' &&
          room.points.map((p, i) => {
            const sp = toScreen(p);
            const sel = roomSel?.kind === 'vertex' && roomSel.index === i;
            return (
              <g key={'v' + i} transform={`translate(${sp.x} ${sp.y})`} data-kind="vertex" data-id={i} style={{ cursor: 'move' }}>
                <circle r={20} fill="transparent" />
                <circle r={sel ? 10 : 8} fill="#fff" stroke="#0f766e" strokeWidth={sel ? 4 : 3} />
              </g>
            );
          })}
      </svg>

      <div className="float-top">
        <Seg
          value={mode}
          onChange={(m) => {
            setMode(m);
            setRoomSel(null);
            select(null);
          }}
          options={[
            { id: 'room', label: L('الغرفة', 'Room') },
            { id: 'units', label: L('الوحدات', 'Units') },
          ]}
        />
        <div className="float-col">
          <button className="iconbtn light" onClick={fit} aria-label={L('ملاءمة', 'Fit')}>
            <Maximize size={19} />
          </button>
          <button className={'iconbtn light' + (showDims ? ' on' : '')} onClick={() => setShowDims((v) => !v)} aria-label={L('الأبعاد', 'Dimensions')}>
            <Ruler size={19} />
          </button>
        </div>
      </div>

      {overlapCount > 0 && mode === 'units' && !selected && (
        <div style={{ position: 'absolute', top: 58, insetInlineStart: 10, zIndex: 3 }}>
          <span className="warn-badge">
            <AlertTriangle size={14} /> {L(`${overlapCount} وحدة بها تعارض`, `${overlapCount} unit(s) in conflict`)}
          </span>
        </div>
      )}

      <div className="float-bottom">
        {mode === 'units' && !selected && (
          <>
            <div className="pill">
              <button className="act primary" style={{ flexDirection: 'row', gap: 6, fontSize: 13.5, padding: '0 16px' }} onClick={() => setSheet('library')}>
                <Plus size={19} /> {L('إضافة وحدة', 'Add unit')}
              </button>
              <button className="act" style={{ flexDirection: 'row', gap: 6, fontSize: 13.5, padding: '0 14px' }} onClick={() => setSheet('assistant')}>
                <Sparkles size={18} color="var(--accent)" /> {L('المساعد الذكي', 'Assistant')}
              </button>
            </div>
          </>
        )}
        {mode === 'units' && selected && (
          <div className="pill">
            <div className="lbl">
              {itemName(selected, lang)}
              <small>
                {tags.get(selected.id)} · {fmtCm(selected.w)}×{fmtCm(selected.d)}×{fmtCm(selected.h)}
                {problems.get(selected.id) ? ' ⚠' : ''}
              </small>
            </div>
            <span className="sep" />
            <button className="act" onClick={() => setSheet('props')}>
              <SlidersHorizontal size={18} />
              {L('خصائص', 'Edit')}
            </button>
            <button className="act" onClick={rotateSelected}>
              <RotateCw size={18} />
              {L('تدوير', 'Rotate')}
            </button>
            <button className="act" onClick={() => duplicateItem(selected.id)}>
              <Copy size={18} />
              {L('تكرار', 'Copy')}
            </button>
            <button className="act danger" onClick={() => removeItem(selected.id)}>
              <Trash2 size={18} />
              {L('حذف', 'Delete')}
            </button>
          </div>
        )}
        {mode === 'room' && (
          <div className="pill">
            <button className="act" onClick={() => addOpening('door')}>
              <DoorOpen size={18} />
              {L('باب', 'Door')}
            </button>
            <button className="act" onClick={() => addOpening('window')}>
              <Square size={18} />
              {L('شباك', 'Window')}
            </button>
            <button className="act" onClick={() => setSheet('services')}>
              <Plug size={18} />
              {L('مرافق', 'Services')}
            </button>
            <button className="act" onClick={addColumn}>
              <Columns3 size={18} />
              {L('عمود', 'Column')}
            </button>
            <span className="sep" />
            <button className="act" onClick={() => setSheet('room')}>
              <Ruler size={18} />
              {L('الأبعاد', 'Sizes')}
            </button>
          </div>
        )}
      </div>
      {mode === 'room' && !roomSel && !sheet && (
        <div style={{ position: 'absolute', bottom: 76, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 2 }}>
          <span className="hint">{L('اسحب الأركان لتغيير الشكل · اضغط على حائط أو عنصر لتعديله', 'Drag corners to reshape · tap a wall or element to edit')}</span>
        </div>
      )}
      {selected && problems.get(selected.id) && mode === 'units' && !sheet && (
        <div style={{ position: 'absolute', bottom: 76, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 2 }}>
          <span className="warn-badge">
            <AlertTriangle size={14} />
            {problems.get(selected.id) === 'overlap' ? L('تتداخل مع وحدة أخرى', 'Overlaps another unit') : problems.get(selected.id) === 'outside' ? L('خارج حدود الغرفة', 'Outside the room') : L('تسد باباً أو شباكاً', 'Blocks a door or window')}
          </span>
        </div>
      )}

      {sheet === 'library' && <Library onClose={() => setSheet(null)} />}
      {sheet === 'assistant' && <Assistant onClose={() => setSheet(null)} />}
      {sheet === 'props' && selected && <ItemProps id={selected.id} tag={tags.get(selected.id)} onClose={() => setSheet(null)} />}
      {sheet === 'room' && <RoomSettings onClose={() => setSheet(null)} />}
      {sheet === 'services' && (
        <div className="overlay" onPointerDown={(e) => e.target === e.currentTarget && setSheet(null)}>
          <div className="sheet half">
            <div className="sheet-head">
              <h2>{L('إضافة نقطة مرافق', 'Add a service point')}</h2>
            </div>
            <div className="sheet-body">
              <div className="grid2">
                {(Object.keys(UTIL_META) as UtilityType[]).map((k) => (
                  <button key={k} className="btn ghost" onClick={() => addUtility(k)}>
                    <span style={{ width: 14, height: 14, borderRadius: 7, background: UTIL_META[k].color, display: 'inline-block' }} />
                    {L(UTIL_META[k].ar, UTIL_META[k].en)}
                  </button>
                ))}
              </div>
              <p className="small muted" style={{ marginTop: 10 }}>
                {L('المساعد الذكي يستخدم أماكن المياه والغاز لوضع الحوض والبوتاجاز.', 'The assistant uses the water and gas points to place the sink and cooker.')}
              </p>
            </div>
          </div>
        </div>
      )}
      {mode === 'room' && roomSel && !sheet && <RoomElementSheet sel={roomSel} onClose={() => setRoomSel(null)} />}
    </div>
  );
}

