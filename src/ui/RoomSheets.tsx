import { Scissors, Trash2 } from 'lucide-react';
import { fmtCm, L } from '../i18n';
import { dot, getWalls, resizeWall, round1, roomArea, signedArea } from '../lib/geometry';
import { useStore } from '../store';
import type { Opening, Room, Utility, UtilityType } from '../types';
import { NumField, Seg, Sheet } from './components';

export type RoomSel = { kind: 'opening' | 'utility' | 'column'; id: string } | { kind: 'vertex' | 'wall'; index: number };

export const UTIL_META: Record<UtilityType, { ar: string; en: string; color: string; letter: string; height: number }> = {
  water: { ar: 'مصدر مياه', en: 'Water supply', color: '#2f80ed', letter: 'W', height: 55 },
  drain: { ar: 'صرف', en: 'Drain', color: '#6b7280', letter: 'D', height: 40 },
  electric: { ar: 'كهرباء', en: 'Power socket', color: '#d9a400', letter: 'E', height: 110 },
  gas: { ar: 'غاز', en: 'Gas', color: '#f2792b', letter: 'G', height: 60 },
};

export function RoomSettings(props: { onClose: () => void }) {
  const room = useStore((s) => s.project!.room);
  const setRoom = useStore((s) => s.setRoom);
  const commit = useStore((s) => s.commit);
  const walls = getWalls(room);
  const cm = L('سم', 'cm');

  const setLen = (i: number, len: number) => {
    const res = resizeWall(room, i, len);
    if (signedArea(res.points) < 1000) return;
    commit((p) => ({
      ...p,
      room: {
        ...p.room,
        points: res.points,
        columns: p.room.columns.map((c) => (dot({ x: c.x, y: c.y }, res.dir) >= res.threshold - 1 ? { ...c, x: c.x + res.shift.x, y: c.y + res.shift.y } : c)),
      },
      items: p.items.map((it) => (dot({ x: it.x, y: it.y }, res.dir) >= res.threshold - Math.max(it.w, it.d) / 2 - 5 ? { ...it, x: round1(it.x + res.shift.x), y: round1(it.y + res.shift.y) } : it)),
    }));
  };

  return (
    <Sheet title={L('أبعاد الغرفة', 'Room dimensions')} onClose={props.onClose}>
      <div className="card">
        <div className="grid2">
          <NumField label={L('ارتفاع السقف', 'Ceiling height')} value={room.height} min={200} max={500} step={5} unit={cm} onChange={(height) => setRoom((r) => ({ ...r, height }))} />
          <NumField label={L('سمك الحائط', 'Wall thickness')} value={room.wallThickness} min={5} max={50} unit={cm} onChange={(wallThickness) => setRoom((r) => ({ ...r, wallThickness }))} />
        </div>
        <div className="kv" style={{ marginTop: 10 }}>
          <span>{L('مساحة الأرضية', 'Floor area')}</span>
          <b>{roomArea(room).toFixed(2)} m²</b>
        </div>
      </div>
      <div className="card">
        <h3>{L('أطوال الحوائط', 'Wall lengths')}</h3>
        <div className="grid2">
          {walls.map((w) => (
            <NumField key={w.i} label={L(`حائط ${w.i + 1}`, `Wall ${w.i + 1}`)} value={round1(w.len)} min={20} max={2000} step={5} unit={cm} onChange={(len) => setLen(w.i, len)} />
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>
          {L('تغيير طول حائط يمدّ الغرفة في اتجاهه ويحرّك الوحدات الملاصقة معه. لتغيير الشكل اسحب الأركان في المخطط.', 'Changing a wall length stretches the room along it and moves the adjacent units. Drag the corners on the plan to change the shape.')}
        </p>
      </div>
    </Sheet>
  );
}

export function RoomElementSheet(props: { sel: RoomSel; onClose: () => void }) {
  const room = useStore((s) => s.project!.room);
  const setRoom = useStore((s) => s.setRoom);
  const commit = useStore((s) => s.commit);
  const { sel } = props;
  const walls = getWalls(room);
  const cm = L('سم', 'cm');
  const patchRoom = (fn: (r: Room) => Room) => setRoom(fn);

  if (sel.kind === 'opening') {
    const op = room.openings.find((o) => o.id === sel.id);
    if (!op) return null;
    const wall = walls[op.wall];
    const upd = (patch: Partial<Opening>) => patchRoom((r) => ({ ...r, openings: r.openings.map((o) => (o.id === op.id ? { ...o, ...patch } : o)) }));
    return (
      <Sheet title={op.type === 'door' ? L('باب', 'Door') : L('شباك', 'Window')} onClose={props.onClose} half clear>
        <div className="card">
          <Seg
            block
            value={op.type}
            onChange={(type) => upd(type === 'door' ? { type, sill: 0, height: 210, width: Math.min(op.width, 120) } : { type, sill: 100, height: 110 })}
            options={[
              { id: 'door', label: L('باب', 'Door') },
              { id: 'window', label: L('شباك', 'Window') },
            ]}
          />
          <div className="grid2" style={{ marginTop: 10 }}>
            <NumField label={L('العرض', 'Width')} value={op.width} min={30} max={Math.max(30, wall.len)} step={5} unit={cm} onChange={(width) => upd({ width, offset: Math.max(0, Math.min(op.offset, wall.len - width)) })} />
            <NumField label={L('الارتفاع', 'Height')} value={op.height} min={30} max={room.height - op.sill} step={5} unit={cm} onChange={(height) => upd({ height })} />
            <NumField label={L('البعد عن بداية الحائط', 'Offset from wall start')} value={round1(op.offset)} min={0} max={Math.max(0, wall.len - op.width)} step={5} unit={cm} onChange={(offset) => upd({ offset })} />
            {op.type === 'window' && <NumField label={L('ارتفاع الجلسة', 'Sill height')} value={op.sill} min={0} max={room.height - 30} step={5} unit={cm} onChange={(sill) => upd({ sill, height: Math.min(op.height, room.height - sill) })} />}
          </div>
          <button
            className="btn danger block"
            style={{ marginTop: 12 }}
            onClick={() => {
              patchRoom((r) => ({ ...r, openings: r.openings.filter((o) => o.id !== op.id) }));
              props.onClose();
            }}
          >
            <Trash2 size={18} /> {L('حذف', 'Delete')}
          </button>
        </div>
      </Sheet>
    );
  }

  if (sel.kind === 'utility') {
    const ut = room.utilities.find((u) => u.id === sel.id);
    if (!ut) return null;
    const wall = walls[ut.wall];
    const upd = (patch: Partial<Utility>) => patchRoom((r) => ({ ...r, utilities: r.utilities.map((u) => (u.id === ut.id ? { ...u, ...patch } : u)) }));
    return (
      <Sheet title={L('نقطة مرافق', 'Service point')} onClose={props.onClose} half clear>
        <div className="card">
          <Seg block value={ut.type} onChange={(type) => upd({ type, height: UTIL_META[type].height })} options={(Object.keys(UTIL_META) as UtilityType[]).map((k) => ({ id: k, label: L(UTIL_META[k].ar, UTIL_META[k].en) }))} />
          <div className="grid2" style={{ marginTop: 10 }}>
            <NumField label={L('البعد عن بداية الحائط', 'Offset from wall start')} value={round1(ut.offset)} min={0} max={wall.len} step={5} unit={cm} onChange={(offset) => upd({ offset })} />
            <NumField label={L('الارتفاع عن الأرض', 'Height above floor')} value={ut.height} min={0} max={room.height} step={5} unit={cm} onChange={(height) => upd({ height })} />
          </div>
          <button
            className="btn danger block"
            style={{ marginTop: 12 }}
            onClick={() => {
              patchRoom((r) => ({ ...r, utilities: r.utilities.filter((u) => u.id !== ut.id) }));
              props.onClose();
            }}
          >
            <Trash2 size={18} /> {L('حذف', 'Delete')}
          </button>
        </div>
      </Sheet>
    );
  }

  if (sel.kind === 'column') {
    const col = room.columns.find((c) => c.id === sel.id);
    if (!col) return null;
    const upd = (patch: Partial<typeof col>) => patchRoom((r) => ({ ...r, columns: r.columns.map((c) => (c.id === col.id ? { ...c, ...patch } : c)) }));
    return (
      <Sheet title={L('عمود خرساني', 'Column')} onClose={props.onClose} half clear>
        <div className="card">
          <div className="grid2">
            <NumField label={L('العرض', 'Width')} value={col.w} min={10} max={200} step={5} unit={cm} onChange={(w) => upd({ w })} />
            <NumField label={L('العمق', 'Depth')} value={col.d} min={10} max={200} step={5} unit={cm} onChange={(d) => upd({ d })} />
            <NumField label="X" value={round1(col.x)} min={-5000} max={5000} step={5} unit={cm} onChange={(x) => upd({ x })} />
            <NumField label="Y" value={round1(col.y)} min={-5000} max={5000} step={5} unit={cm} onChange={(y) => upd({ y })} />
          </div>
          <button
            className="btn danger block"
            style={{ marginTop: 12 }}
            onClick={() => {
              patchRoom((r) => ({ ...r, columns: r.columns.filter((c) => c.id !== col.id) }));
              props.onClose();
            }}
          >
            <Trash2 size={18} /> {L('حذف', 'Delete')}
          </button>
        </div>
      </Sheet>
    );
  }

  if (sel.kind === 'wall') {
    const w = walls[sel.index];
    if (!w) return null;
    const split = () => {
      // insert a corner in the middle of the wall; openings / services past it move to the new wall
      const mid = { x: round1((w.a.x + w.b.x) / 2), y: round1((w.a.y + w.b.y) / 2) };
      const half = w.len / 2;
      commit((p) => {
        const points = [...p.room.points];
        points.splice(w.i + 1, 0, mid);
        const remap = <T extends { wall: number; offset: number }>(o: T, width = 0): T => {
          if (o.wall > w.i) return { ...o, wall: o.wall + 1 };
          if (o.wall === w.i && o.offset + width / 2 >= half) return { ...o, wall: w.i + 1, offset: Math.max(0, o.offset - half) };
          return o;
        };
        return { ...p, room: { ...p.room, points, openings: p.room.openings.map((o) => remap(o, o.width)), utilities: p.room.utilities.map((u) => remap(u)) } };
      });
      props.onClose();
    };
    return (
      <Sheet title={L(`حائط ${w.i + 1}`, `Wall ${w.i + 1}`)} onClose={props.onClose} half clear>
        <div className="card">
          <div className="kv">
            <span>{L('الطول الحالي', 'Current length')}</span>
            <b>{fmtCm(w.len)} cm</b>
          </div>
          <p className="small muted" style={{ margin: '8px 0' }}>
            {L('لتعديل الطول بدقة استخدم «أبعاد الغرفة»، أو اسحب الأركان. يمكنك تقسيم الحائط لإضافة ركن جديد وتشكيل غرفة غير مستطيلة.', 'Use “Room dimensions” for exact lengths, or drag the corners. Split the wall to add a corner and shape a non-rectangular room.')}
          </p>
          <button className="btn soft block" onClick={split}>
            <Scissors size={18} /> {L('تقسيم الحائط (إضافة ركن)', 'Split wall (add corner)')}
          </button>
        </div>
      </Sheet>
    );
  }

  // vertex
  const pt = room.points[sel.index];
  if (!pt) return null;
  const move = (patch: { x?: number; y?: number }) =>
    patchRoom((r) => {
      const points = r.points.map((p, i) => (i === sel.index ? { ...p, ...patch } : p));
      return signedArea(points) > 1000 ? { ...r, points } : r;
    });
  const remove = () => {
    if (room.points.length <= 3) return;
    const i = sel.index;
    const n = room.points.length;
    const prev = (i - 1 + n) % n;
    commit((p) => {
      const points = p.room.points.filter((_, k) => k !== i);
      if (signedArea(points) < 1000) return p;
      // walls prev and i merge; drop what was attached to them
      const keep = (wall: number) => wall !== i && wall !== prev;
      const shift = (wall: number) => (wall > i ? wall - 1 : wall);
      return {
        ...p,
        room: {
          ...p.room,
          points,
          openings: p.room.openings.filter((o) => keep(o.wall)).map((o) => ({ ...o, wall: shift(o.wall) })),
          utilities: p.room.utilities.filter((u) => keep(u.wall)).map((u) => ({ ...u, wall: shift(u.wall) })),
        },
      };
    });
    props.onClose();
  };
  return (
    <Sheet title={L(`ركن ${sel.index + 1}`, `Corner ${sel.index + 1}`)} onClose={props.onClose} half clear>
      <div className="card">
        <div className="grid2">
          <NumField label="X" value={round1(pt.x)} min={-5000} max={5000} step={5} unit={cm} onChange={(x) => move({ x })} />
          <NumField label="Y" value={round1(pt.y)} min={-5000} max={5000} step={5} unit={cm} onChange={(y) => move({ y })} />
        </div>
        <button className="btn danger block" style={{ marginTop: 12 }} disabled={room.points.length <= 3} onClick={remove}>
          <Trash2 size={18} /> {L('حذف الركن', 'Remove corner')}
        </button>
      </div>
    </Sheet>
  );
}
