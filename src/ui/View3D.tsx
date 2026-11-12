import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Camera, DoorOpen, Footprints, PanelTop, RotateCw, SlidersHorizontal, Square, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { fmtCm, getLang, L } from '../i18n';
import { tagItems } from '../lib/bom';
import { itemName } from '../lib/catalog';
import { dataUrlToBlob, safeName, saveBlob } from '../lib/exporters';
import { useStore } from '../store';
import { SceneManager } from '../three/SceneManager';
import { FinishesPanel } from './FinishesPanel';
import { ItemProps } from './ItemProps';

/** The live scene, so the editor can grab a thumbnail or export 3D files without re-rendering. */
export const sceneRef: { current: SceneManager | null } = { current: null };

function Joystick(props: { onMove: (x: number, y: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef<number | null>(null);
  const update = (e: React.PointerEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    let dx = e.clientX - (rect.left + rect.width / 2);
    let dy = e.clientY - (rect.top + rect.height / 2);
    const max = 38;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    setKnob({ x: dx, y: dy });
    props.onMove(dx / max, -dy / max);
  };
  const stop = () => {
    active.current = null;
    setKnob({ x: 0, y: 0 });
    props.onMove(0, 0);
  };
  return (
    <div
      className="joystick"
      ref={ref}
      onPointerDown={(e) => {
        active.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => active.current === e.pointerId && update(e)}
      onPointerUp={stop}
      onPointerCancel={stop}
    >
      <i style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

export function View3D(props: { withFinishes: boolean }) {
  const project = useStore((s) => s.project)!;
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const removeItem = useStore((s) => s.removeItem);
  const notify = useStore((s) => s.notify);
  const holder = useRef<HTMLDivElement>(null);
  const sm = useRef<SceneManager | null>(null);
  const [walk, setWalk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propsOpen, setPropsOpen] = useState(false);
  const [openAll, setOpenAll] = useState(false);
  const [openIds, setOpenIds] = useState<string[]>([]);
  useEffect(() => {
    sm.current?.setOpen(openAll, openIds);
  }, [openAll, openIds]);
  const lang = getLang();

  useEffect(() => {
    if (!holder.current) return;
    let scene: SceneManager;
    try {
      scene = new SceneManager(holder.current);
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
      return;
    }
    scene.onSelect = (id) => useStore.getState().select(id);
    sm.current = scene;
    sceneRef.current = scene;
    const st = useStore.getState();
    if (st.project) scene.setProject(st.project, st.selectedId);
    return () => {
      // keep a fresh preview for the project list
      try {
        const cur = useStore.getState().project;
        if (cur && cur.items.length) {
          if (scene.mode === 'walk') scene.setMode('orbit');
          useStore.getState().saveThumb(scene.snapshot(480, 300, 0.72));
        }
      } catch {
        /* ignore */
      }
      scene.dispose();
      sm.current = null;
      if (sceneRef.current === scene) sceneRef.current = null;
    };
  }, []);

  // rebuild when the design changes (not when only the thumbnail does)
  const { items, room, finishes, rules } = project;
  useEffect(() => {
    sm.current?.setProject(useStore.getState().project!, useStore.getState().selectedId);
  }, [items, room, finishes, rules]);

  useEffect(() => {
    sm.current?.setSelected(selectedId);
  }, [selectedId]);

  useEffect(() => {
    // the canvas area changes size when the finishes panel opens
    const t = setTimeout(() => sm.current?.resize(), 30);
    return () => clearTimeout(t);
  }, [props.withFinishes]);

  const selected = project.items.find((i) => i.id === selectedId) ?? null;
  const tag = useMemo(() => (selected ? tagItems(project).tags.get(selected.id) : undefined), [selected, project]);

  const toggleWalk = () => {
    const next = !walk;
    setWalk(next);
    select(null);
    sm.current?.setMode(next ? 'walk' : 'orbit');
  };

  const shot = async () => {
    if (!sm.current) return;
    try {
      const url = sm.current.snapshot(1920, 1200, 0.92);
      const how = await saveBlob(dataUrlToBlob(url), `${safeName(project.name)}_3D.jpg`);
      if (how === 'downloaded') notify(L('تم حفظ الصورة', 'Image saved'));
    } catch (e) {
      notify(L('تعذر حفظ الصورة', 'Could not save the image'));
    }
  };

  return (
    <>
      <div className="view3d">
        <div className="canvas-holder" ref={holder} />
        {error && (
          <div className="empty" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <b>{L('تعذر تشغيل العرض ثلاثي الأبعاد على هذا الجهاز', '3D view is not available on this device')}</b>
            <span className="small">{error}</span>
          </div>
        )}
        <div className="float-top">
          <div className="float-col">
            <button className={'iconbtn light' + (walk ? ' on' : '')} onClick={toggleWalk} aria-label={L('تجول', 'Walk')} title={L('التجول داخل المطبخ', 'Walk inside')}>
              <Footprints size={19} />
            </button>
          </div>
          <div className="float-col">
            <button
              className="iconbtn light"
              onClick={() => {
                setWalk(false);
                sm.current?.setView('iso');
              }}
              aria-label={L('منظور', 'Perspective')}
              title={L('منظور', 'Perspective')}
            >
              <Box size={19} />
            </button>
            <button
              className="iconbtn light"
              onClick={() => {
                setWalk(false);
                sm.current?.setView('top');
              }}
              aria-label={L('علوي', 'Top')}
              title={L('مسقط علوي', 'Top view')}
            >
              <Square size={19} />
            </button>
            <button
              className="iconbtn light"
              onClick={() => {
                setWalk(false);
                sm.current?.setView('wall');
              }}
              aria-label={L('واجهة', 'Elevation')}
              title={L('واجهات الحوائط', 'Wall elevations')}
            >
              <PanelTop size={19} />
            </button>
            {!walk && !props.withFinishes && (
              <>
                <button className="iconbtn light" onClick={() => sm.current?.zoom(0.8)} aria-label={L('تكبير', 'Zoom in')}>
                  <ZoomIn size={19} />
                </button>
                <button className="iconbtn light" onClick={() => sm.current?.zoom(1.25)} aria-label={L('تصغير', 'Zoom out')}>
                  <ZoomOut size={19} />
                </button>
              </>
            )}
            <button
              className={'iconbtn light' + (openAll ? ' on' : '')}
              onClick={() => {
                setOpenAll((v) => !v);
                setOpenIds([]);
              }}
              aria-label={L('فتح الضلف', 'Open doors')}
              title={L('فتح / غلق كل الضلف والأدراج', 'Open / close all doors and drawers')}
            >
              <DoorOpen size={19} />
            </button>
            <button className="iconbtn light" onClick={shot} aria-label={L('التقاط صورة', 'Screenshot')} title={L('حفظ صورة', 'Save image')}>
              <Camera size={19} />
            </button>
          </div>
        </div>
        {walk && <Joystick onMove={(x, y) => sm.current?.setMove(x, y)} />}
        <div className="float-bottom">
          {walk && <span className="hint">{L('اسحب للنظر حولك · استخدم العصا للحركة', 'Drag to look around · use the stick to move')}</span>}
          {!walk && selected && !props.withFinishes && (
            <div className="pill">
              <div className="lbl">
                {itemName(selected, lang)}
                <small>
                  {tag} · {fmtCm(selected.w)}×{fmtCm(selected.d)}×{fmtCm(selected.h)}
                </small>
              </div>
              <span className="sep" />
              <button className="act" onClick={() => setPropsOpen(true)}>
                <SlidersHorizontal size={18} />
                {L('خصائص', 'Edit')}
              </button>
              {selected.cat !== 'appliance' && (
                <button className="act" onClick={() => setOpenIds((ids) => (ids.includes(selected.id) ? ids.filter((x) => x !== selected.id) : [...ids, selected.id]))}>
                  <DoorOpen size={18} />
                  {openAll || openIds.includes(selected.id) ? L('غلق', 'Close') : L('فتح', 'Open')}
                </button>
              )}
              <button className="act" onClick={() => useStore.getState().updateItem(selected.id, { rot: (selected.rot + 90) % 360, opts: { ...selected.opts, freeRot: true } })}>
                <RotateCw size={18} />
                {L('تدوير', 'Rotate')}
              </button>
              <button className="act danger" onClick={() => removeItem(selected.id)}>
                <Trash2 size={18} />
                {L('حذف', 'Delete')}
              </button>
            </div>
          )}
          {!walk && !selected && !props.withFinishes && project.items.length === 0 && <span className="hint">{L('أضف وحدات من تبويب «المخطط» لتظهر هنا', 'Add units in the “Plan” tab to see them here')}</span>}
        </div>
      </div>
      {props.withFinishes && (
        <div className="split-panel">
          <FinishesPanel />
        </div>
      )}
      {propsOpen && selected && <ItemProps id={selected.id} tag={tag} onClose={() => setPropsOpen(false)} />}
    </>
  );
}
