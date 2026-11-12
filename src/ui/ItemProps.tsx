import { ArrowDown, ArrowUp, BookmarkPlus, Copy, Plus, Trash2, X } from 'lucide-react';
import { fmtCm, getLang, L, LT } from '../i18n';
import { CAT_NAMES, itemName, moduleDef, SECTION_NAMES } from '../lib/catalog';
import { getWalls, itemAxes, itemWall, round1, wallPoint } from '../lib/geometry';
import { DOOR_FINISHES, DOOR_TYPES } from '../lib/materials';
import { useStore } from '../store';
import type { Item, ItemOptions, Section, SectionKind } from '../types';
import { swatchURL } from '../three/textures';
import { ask, NumField, Seg, Sheet, Swatch, TextField, ToggleRow } from './components';

const SECTION_KINDS: SectionKind[] = ['door', 'drawer', 'flap', 'glass', 'open', 'oven', 'micro', 'panel'];

export function ItemProps(props: { id: string; tag?: string; onClose: () => void }) {
  const project = useStore((s) => s.project)!;
  const updateItem = useStore((s) => s.updateItem);
  const removeItem = useStore((s) => s.removeItem);
  const duplicateItem = useStore((s) => s.duplicateItem);
  const saveCustomModule = useStore((s) => s.saveCustomModule);
  const notify = useStore((s) => s.notify);
  const it = project.items.find((i) => i.id === props.id);
  if (!it) return null;
  const lang = getLang();
  const def = moduleDef(it.type);
  const walls = getWalls(project.room);
  const att = itemWall(it, walls);
  const isCab = it.cat !== 'appliance';
  const sections = it.opts.sections ?? [];

  const set = (patch: Partial<Item>) => updateItem(it.id, patch);
  const setOpts = (patch: Partial<ItemOptions>) => updateItem(it.id, { opts: { ...it.opts, ...patch } });

  /** Resize while keeping the left edge / the back in place. */
  const setWidth = (w: number) => {
    const { u } = itemAxes(it.rot);
    const dw = (w - it.w) / 2;
    set({ w, x: round1(it.x + u.x * dw), y: round1(it.y + u.y * dw) });
  };
  const setDepth = (d: number) => {
    const { f } = itemAxes(it.rot);
    const dd = (d - it.d) / 2;
    set({ d, x: round1(it.x + f.x * dd), y: round1(it.y + f.y * dd) });
  };
  const setOffset = (t0: number) => {
    if (!att) return;
    const p = wallPoint(att.wall, t0 + it.w / 2, it.d / 2);
    set({ x: round1(p.x), y: round1(p.y) });
  };

  const setSection = (i: number, patch: Partial<Section>) => setOpts({ sections: sections.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const moveSection = (i: number, dir: number) => {
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    setOpts({ sections: next });
  };

  const singleDoor = sections.some((s) => (s.kind === 'door' || s.kind === 'glass') && (s.n ?? 1) === 1);

  return (
    <Sheet
      title={
        <>
          {props.tag && <span className="tag">{props.tag}</span>} {itemName(it, lang)}
        </>
      }
      onClose={props.onClose}
    >
      <div className="card">
        <div className="small muted" style={{ marginBottom: 8 }}>
          {LT(CAT_NAMES[it.cat])} · {def ? def.name[lang] : ''}
        </div>
        <TextField label={L('اسم الوحدة (اختياري)', 'Unit label (optional)')} value={it.label ?? ''} placeholder={def?.name[lang]} onChange={(v) => set({ label: v || undefined })} />
        <div className="grid3" style={{ marginTop: 10 }}>
          <NumField label={L('العرض', 'Width')} value={it.w} min={2} max={400} onChange={setWidth} stepper={false} unit={L('سم', 'cm')} />
          <NumField label={L('العمق', 'Depth')} value={it.d} min={10} max={150} onChange={setDepth} stepper={false} unit={L('سم', 'cm')} />
          <NumField label={L('الارتفاع', 'Height')} value={it.h} min={10} max={300} onChange={(h) => set({ h })} stepper={false} unit={L('سم', 'cm')} />
        </div>
        <div className="grid2" style={{ marginTop: 10 }}>
          <NumField label={L('الارتفاع عن الأرض', 'Height above floor')} value={it.elev} min={0} max={300} onChange={(elev) => set({ elev })} stepper={false} unit={L('سم', 'cm')} />
          {att ? (
            <NumField label={L('المسافة من بداية الحائط', 'Offset from wall start')} value={round1(att.t0)} min={0} max={Math.max(0, att.wall.len - it.w)} onChange={setOffset} stepper={false} unit={L('سم', 'cm')} />
          ) : (
            <NumField label={L('زاوية الدوران', 'Rotation')} value={it.rot} min={0} max={359} step={15} onChange={(rot) => set({ rot: rot % 360 })} unit="°" />
          )}
        </div>
        {def && (
          <div className="chips" style={{ marginTop: 10, paddingBottom: 0 }}>
            {[15, 20, 30, 40, 45, 50, 60, 70, 80, 90, 100, 120]
              .filter((w) => w >= def.minW && w <= def.maxW)
              .map((w) => (
                <button key={w} className={'chip' + (Math.abs(it.w - w) < 0.05 ? ' active' : '')} onClick={() => setWidth(w)}>
                  {w}
                </button>
              ))}
          </div>
        )}
      </div>

      {isCab && !it.opts.filler && (
        <div className="card">
          <h3>{L('تقسيم الواجهة (من أعلى لأسفل)', 'Front layout (top to bottom)')}</h3>
          {sections.map((s, i) => (
            <div className="sec-row" key={i}>
              <select value={s.kind} onChange={(e) => setSection(i, { kind: e.target.value as SectionKind })}>
                {SECTION_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {LT(SECTION_NAMES[k])}
                  </option>
                ))}
              </select>
              {(s.kind === 'door' || s.kind === 'glass') && (
                <select style={{ flex: 0.9 }} value={s.n ?? 1} onChange={(e) => setSection(i, { n: Number(e.target.value) })} aria-label={L('عدد الضلف', 'Leaves')}>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n} {L('ضلفة', 'leaf')}
                    </option>
                  ))}
                </select>
              )}
              <NumField value={s.h} min={0} max={250} onChange={(h) => setSection(i, { h })} stepper={false} unit={s.h > 0 ? L('سم', 'cm') : L('تلقائي', 'auto')} />
              <button className="iconbtn" style={{ width: 30 }} onClick={() => moveSection(i, -1)} disabled={i === 0} aria-label="up">
                <ArrowUp size={16} />
              </button>
              <button className="iconbtn" style={{ width: 30 }} onClick={() => moveSection(i, 1)} disabled={i === sections.length - 1} aria-label="down">
                <ArrowDown size={16} />
              </button>
              <button className="iconbtn" style={{ width: 30, color: 'var(--danger)' }} onClick={() => setOpts({ sections: sections.filter((_, k) => k !== i) })} disabled={sections.length <= 1} aria-label="remove">
                <X size={16} />
              </button>
            </div>
          ))}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn soft sm" onClick={() => setOpts({ sections: [...sections, { kind: 'drawer', h: 0 }] })}>
              <Plus size={16} /> {L('إضافة قسم', 'Add section')}
            </button>
            <span className="small muted grow">{L('الارتفاع 0 = يتوزع تلقائياً', 'Height 0 = auto')}</span>
          </div>
          <div className="grid2" style={{ marginTop: 12 }}>
            <NumField label={L('عدد الأرفف المتحركة', 'Adjustable shelves')} value={it.opts.shelves ?? 0} min={0} max={8} onChange={(shelves) => setOpts({ shelves })} />
            {singleDoor && (
              <div className="field">
                <span className="lbl">{L('اتجاه المفصلات', 'Hinge side')}</span>
                <Seg
                  block
                  value={it.opts.hinge ?? 'L'}
                  onChange={(hinge) => setOpts({ hinge })}
                  options={[
                    { id: 'L', label: L('يسار', 'Left') },
                    { id: 'R', label: L('يمين', 'Right') },
                  ]}
                />
              </div>
            )}
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <span className="lbl">{L('ركنة عمياء (الجزء المخفي)', 'Blind corner (hidden part)')}</span>
            <div className="row">
              <div className="grow">
                <Seg
                  block
                  value={it.opts.blind ?? 'none'}
                  onChange={(v) => setOpts({ blind: v === 'none' ? null : (v as 'L' | 'R'), blindW: it.opts.blindW ?? (it.cat === 'wall' ? 34 : 58) })}
                  options={[
                    { id: 'none', label: L('لا', 'None') },
                    { id: 'L', label: L('يسار', 'Left') },
                    { id: 'R', label: L('يمين', 'Right') },
                  ]}
                />
              </div>
              {it.opts.blind && (
                <div style={{ width: 110 }}>
                  <NumField value={it.opts.blindW ?? 50} min={10} max={it.w - 20} onChange={(blindW) => setOpts({ blindW })} stepper={false} unit={L('سم', 'cm')} />
                </div>
              )}
            </div>
          </div>
          {it.cat === 'base' && (
            <>
              <div className="grid2" style={{ marginTop: 12 }}>
                <div className="field">
                  <span className="lbl">{L('الحوض', 'Sink')}</span>
                  <Seg
                    block
                    value={it.opts.sink ?? 'none'}
                    onChange={(v) => setOpts({ sink: v === 'none' ? null : (v as 'single' | 'double'), cooktop: v === 'none' ? it.opts.cooktop : null })}
                    options={[
                      { id: 'none', label: L('لا', 'No') },
                      { id: 'single', label: L('مفرد', '1') },
                      { id: 'double', label: L('مزدوج', '2') },
                    ]}
                  />
                </div>
                <div className="field">
                  <span className="lbl">{L('مسطح الطهي', 'Hob')}</span>
                  <Seg
                    block
                    value={it.opts.cooktop ?? 'none'}
                    onChange={(v) => setOpts({ cooktop: v === 'none' ? null : (v as 'gas' | 'induction'), sink: v === 'none' ? it.opts.sink : null })}
                    options={[
                      { id: 'none', label: L('لا', 'No') },
                      { id: 'gas', label: L('غاز', 'Gas') },
                      { id: 'induction', label: L('كهرباء', 'Electric') },
                    ]}
                  />
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <ToggleRow label={L('سطح عمل فوق الوحدة', 'Countertop over the unit')} on={!!it.opts.countertop} onChange={(countertop) => setOpts({ countertop })} />
                <ToggleRow label={L('جزيرة (ظهر وجوانب مشطبة)', 'Island (finished back & sides)')} on={!!it.opts.island} onChange={(island) => setOpts({ island })} />
              </div>
            </>
          )}
          {it.cat === 'wall' && <ToggleRow label={L('شفاط مدمج أسفل الوحدة', 'Built-in extractor')} on={!!it.opts.hood} onChange={(hood) => setOpts({ hood })} />}
        </div>
      )}

      {isCab && (
        <div className="card">
          <h3>{L('خامة ولون الضلف', 'Door finish')}</h3>
          <button className={'chip' + (!it.finish ? ' active' : '')} onClick={() => set({ finish: null })} style={{ marginBottom: 10 }}>
            {L('حسب إعدادات المشروع', 'Follow project finishes')}
          </button>
          {DOOR_TYPES.map((ty) => (
            <div key={ty.id}>
              <div className="section-title">{LT(ty.name)}</div>
              <div className="swatches">
                {DOOR_FINISHES.filter((f) => f.type === ty.id).map((f) => (
                  <Swatch key={f.id} label={LT(f.name)} color={f.color} image={f.grain ? swatchURL('wood', f.color, f.grain) : undefined} active={it.finish === f.id} onClick={() => set({ finish: f.id })} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {it.cat === 'appliance' && (
        <div className="card">
          <NumField label={L('سعر الجهاز (يضاف للتكلفة)', 'Appliance price (added to the cost)')} value={it.price ?? 0} min={0} max={10000000} step={500} onChange={(price) => set({ price })} stepper={false} unit={project.prices.currency} digits={0} />
        </div>
      )}

      <div className="row wrapx" style={{ marginTop: 14 }}>
        {isCab && (
          <button
            className="btn soft grow"
            onClick={async () => {
              const name = await ask.prompt(L('اسم الوحدة في مكتبتك', 'Name for your library'), `${itemName(it, lang)} ${fmtCm(it.w)}`);
              if (name) {
                await saveCustomModule(it.id, name);
                notify(L('تم الحفظ في «وحداتي»', 'Saved to “My units”'));
              }
            }}
          >
            <BookmarkPlus size={18} /> {L('حفظ كوحدة جديدة', 'Save as new unit')}
          </button>
        )}
        <button
          className="btn ghost"
          onClick={() => {
            duplicateItem(it.id);
            props.onClose();
          }}
        >
          <Copy size={18} /> {L('تكرار', 'Duplicate')}
        </button>
        <button
          className="btn danger"
          onClick={() => {
            removeItem(it.id);
            props.onClose();
          }}
        >
          <Trash2 size={18} /> {L('حذف', 'Delete')}
        </button>
      </div>
    </Sheet>
  );
}
