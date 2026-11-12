import { useState } from 'react';
import { L, LT } from '../i18n';
import {
  BACKSPLASHES,
  CARCASS_FINISHES,
  COUNTERTOPS,
  COUNTERTOP_TYPES,
  countertopFinish,
  DOOR_FINISHES,
  DOOR_TYPES,
  doorFinish,
  FLOORS,
  HANDLE_COLORS,
  HANDLE_TYPES,
  LED_TEMPS,
  PLINTHS,
  STYLE_PRESETS,
  WALL_COLORS,
} from '../lib/materials';
import { useStore } from '../store';
import { swatchURL } from '../three/textures';
import type { CountertopType, DoorMaterialType, Finishes } from '../types';
import { NumField, Seg, Swatch, ToggleRow } from './components';

type Section = 'styles' | 'doors' | 'top' | 'handles' | 'room' | 'light';
type Target = 'all' | 'base' | 'wall' | 'tall';

function doorImage(id: string): string | undefined {
  const f = doorFinish(id);
  return f.grain ? swatchURL('wood', f.color, f.grain) : undefined;
}
function ctImage(id: string): string | undefined {
  const f = countertopFinish(id);
  return f.tex === 'plain' ? undefined : swatchURL(f.tex, f.color, f.c2);
}

export function FinishesPanel() {
  const fin = useStore((s) => s.project!.finishes);
  const setFinishes = useStore((s) => s.setFinishes);
  const [section, setSection] = useState<Section>('styles');
  const [target, setTarget] = useState<Target>('all');
  const curDoor = target === 'wall' ? fin.wallDoor : target === 'tall' ? fin.tallDoor : fin.baseDoor;
  const [doorType, setDoorType] = useState<DoorMaterialType>(doorFinish(curDoor).type);
  const [ctType, setCtType] = useState<CountertopType>(countertopFinish(fin.countertop).type);

  const setDoor = (id: string) => {
    const patch: Partial<Finishes> = {};
    if (target === 'all' || target === 'base') patch.baseDoor = id;
    if (target === 'all' || target === 'wall') patch.wallDoor = id;
    if (target === 'all' || target === 'tall') patch.tallDoor = id;
    setFinishes(patch);
  };
  const doorActive = (id: string) => (target === 'all' ? fin.baseDoor === id && fin.wallDoor === id && fin.tallDoor === id : curDoor === id);

  const sections: { id: Section; name: string }[] = [
    { id: 'styles', name: L('ستايلات جاهزة', 'Styles') },
    { id: 'doors', name: L('الضلف', 'Doors') },
    { id: 'top', name: L('سطح العمل', 'Countertop') },
    { id: 'handles', name: L('المقابض', 'Handles') },
    { id: 'room', name: L('الحوائط والأرضية', 'Walls & floor') },
    { id: 'light', name: L('الإضاءة', 'Lighting') },
  ];

  return (
    <>
      <div className="chips" style={{ padding: '10px 12px 8px', flex: 'none' }}>
        {sections.map((s) => (
          <button key={s.id} className={'chip' + (s.id === section ? ' active' : '')} onClick={() => setSection(s.id)}>
            {s.name}
          </button>
        ))}
      </div>
      <div className="scroll" style={{ paddingTop: 2 }}>
        <div className="wrap">
          {section === 'styles' && (
            <>
              <p className="small muted" style={{ marginBottom: 8 }}>
                {L('تركيبات ألوان وخامات متناسقة — اختر واحدة ثم عدّل التفاصيل كما تحب.', 'Matching colour and material sets — pick one, then fine-tune.')}
              </p>
              <div className="chips" style={{ gap: 10 }}>
                {STYLE_PRESETS.map((s) => {
                  const b = doorFinish(s.f.baseDoor);
                  const w = doorFinish(s.f.wallDoor);
                  const c = countertopFinish(s.f.countertop ?? '');
                  return (
                    <button key={s.id} className="preset" onClick={() => setFinishes(s.f)}>
                      <span className="bands">
                        <i style={{ backgroundColor: w.color, backgroundImage: w.grain ? `url(${swatchURL('wood', w.color, w.grain)})` : undefined }} />
                        <i style={{ backgroundColor: c.color, backgroundImage: `url(${ctImage(c.id)})`, flex: 0.45 }} />
                        <i style={{ backgroundColor: b.color, backgroundImage: b.grain ? `url(${swatchURL('wood', b.color, b.grain)})` : undefined }} />
                      </span>
                      <span className="txt">
                        {LT(s.name)}
                        <small>{LT(s.desc)}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {section === 'doors' && (
            <>
              <Seg
                block
                value={target}
                onChange={(t) => {
                  setTarget(t);
                  const id = t === 'wall' ? fin.wallDoor : t === 'tall' ? fin.tallDoor : fin.baseDoor;
                  setDoorType(doorFinish(id).type);
                }}
                options={[
                  { id: 'all', label: L('الكل', 'All') },
                  { id: 'base', label: L('السفلي', 'Base') },
                  { id: 'wall', label: L('العلوي', 'Wall') },
                  { id: 'tall', label: L('الأعمدة', 'Tall') },
                ]}
              />
              <div className="chips" style={{ marginTop: 10 }}>
                {DOOR_TYPES.map((t) => (
                  <button key={t.id} className={'chip' + (t.id === doorType ? ' active' : '')} onClick={() => setDoorType(t.id)}>
                    {LT(t.name)}
                  </button>
                ))}
              </div>
              <p className="small muted" style={{ margin: '0 2px 8px' }}>
                {LT(DOOR_TYPES.find((t) => t.id === doorType)!.desc)}
              </p>
              <div className="swatches">
                {DOOR_FINISHES.filter((f) => f.type === doorType).map((f) => (
                  <Swatch key={f.id} label={LT(f.name)} color={f.color} image={doorImage(f.id)} active={doorActive(f.id)} onClick={() => setDoor(f.id)} />
                ))}
              </div>
              <div className="section-title">{L('شكل الضلفة', 'Door style')}</div>
              <Seg
                block
                value={fin.doorStyle}
                onChange={(doorStyle) => setFinishes({ doorStyle })}
                options={[
                  { id: 'flat', label: L('سادة (مودرن)', 'Flat (modern)') },
                  { id: 'shaker', label: L('إطار شيكر (كلاسيك)', 'Shaker frame') },
                ]}
              />
              <div className="section-title">{L('لون الهيكل الداخلي', 'Carcass colour')}</div>
              <div className="swatches">
                {CARCASS_FINISHES.map((f) => (
                  <Swatch key={f.id} label={LT(f.name)} color={f.color} image={f.grain ? swatchURL('wood', f.color, f.grain) : undefined} active={fin.carcass === f.id} onClick={() => setFinishes({ carcass: f.id })} />
                ))}
              </div>
            </>
          )}

          {section === 'top' && (
            <>
              <div className="chips">
                {COUNTERTOP_TYPES.map((t) => (
                  <button key={t.id} className={'chip' + (t.id === ctType ? ' active' : '')} onClick={() => setCtType(t.id)}>
                    {LT(t.name)}
                  </button>
                ))}
              </div>
              <div className="swatches">
                {COUNTERTOPS.filter((c) => c.type === ctType).map((c) => (
                  <Swatch key={c.id} label={LT(c.name)} color={c.color} image={ctImage(c.id)} active={fin.countertop === c.id} onClick={() => setFinishes({ countertop: c.id })} />
                ))}
              </div>
              <div className="grid2" style={{ marginTop: 14 }}>
                <NumField label={L('سمك السطح', 'Thickness')} value={fin.countertopT} min={1} max={10} step={1} unit={L('سم', 'cm')} onChange={(countertopT) => setFinishes({ countertopT })} />
                <NumField label={L('بروز السطح للأمام', 'Front overhang')} value={fin.overhang} min={0} max={10} step={0.5} unit={L('سم', 'cm')} onChange={(overhang) => setFinishes({ overhang })} />
              </div>
              <div className="section-title">{L('تجليد الحائط (بين السفلي والعلوي)', 'Backsplash')}</div>
              <div className="swatches">
                {BACKSPLASHES.map((s) => (
                  <Swatch
                    key={s.id}
                    label={LT(s.name)}
                    color={s.tex === 'slab' ? countertopFinish(fin.countertop).color : s.tex === 'none' ? fin.wallColor : s.color}
                    image={s.tex === 'subway' || s.tex === 'mosaic' ? swatchURL(s.tex, s.color, s.c2) : s.tex === 'slab' ? ctImage(fin.countertop) : undefined}
                    active={fin.backsplash === s.id}
                    onClick={() => setFinishes({ backsplash: s.id })}
                  />
                ))}
              </div>
            </>
          )}

          {section === 'handles' && (
            <>
              <div className="chips" style={{ flexWrap: 'wrap' }}>
                {HANDLE_TYPES.map((h) => (
                  <button key={h.id} className={'chip' + (fin.handle === h.id ? ' active' : '')} onClick={() => setFinishes({ handle: h.id })}>
                    {LT(h.name)}
                  </button>
                ))}
              </div>
              <div className="section-title">{L('لون المقابض', 'Handle colour')}</div>
              <div className="swatches">
                {HANDLE_COLORS.map((c) => (
                  <Swatch key={c.id} label={LT(c.name)} color={c.color} active={fin.handleColor === c.id} onClick={() => setFinishes({ handleColor: c.id })} />
                ))}
              </div>
              <div className="section-title">{L('الوزرة (قاعدة الوحدات)', 'Plinth')}</div>
              <div className="swatches">
                {PLINTHS.map((c) => (
                  <Swatch key={c.id} label={LT(c.name)} color={c.id === 'pl-door' ? doorFinish(fin.baseDoor).color : c.color} image={c.id === 'pl-door' ? doorImage(fin.baseDoor) : undefined} active={fin.plinth === c.id} onClick={() => setFinishes({ plinth: c.id })} />
                ))}
              </div>
            </>
          )}

          {section === 'room' && (
            <>
              <div className="section-title">{L('لون الحوائط', 'Wall colour')}</div>
              <div className="swatches">
                {WALL_COLORS.map((c) => (
                  <Swatch key={c.id} label={LT(c.name)} color={c.color} active={fin.wallColor === c.id} onClick={() => setFinishes({ wallColor: c.id })} />
                ))}
              </div>
              <div className="section-title">{L('الأرضية', 'Floor')}</div>
              <div className="swatches">
                {FLOORS.map((f) => (
                  <Swatch key={f.id} label={LT(f.name)} color={f.color} image={swatchURL(f.tex, f.color, f.c2)} active={fin.floor === f.id} onClick={() => setFinishes({ floor: f.id })} />
                ))}
              </div>
            </>
          )}

          {section === 'light' && (
            <div className="card">
              <ToggleRow label={L('إضاءة LED أسفل الوحدات العلوية', 'LED strip under wall units')} on={fin.led} onChange={(led) => setFinishes({ led })} />
              {fin.led && (
                <div className="field" style={{ marginTop: 8 }}>
                  <span className="lbl">{L('لون الإضاءة', 'Light colour')}</span>
                  <Seg
                    block
                    value={fin.ledTemp}
                    onChange={(ledTemp) => setFinishes({ ledTemp })}
                    options={LED_TEMPS.map((t) => ({
                      id: t.id,
                      label: (
                        <>
                          <span style={{ width: 12, height: 12, borderRadius: 6, background: t.color, border: '1px solid rgba(0,0,0,.2)', display: 'inline-block' }} />
                          {LT(t.name)}
                        </>
                      ),
                    }))}
                  />
                </div>
              )}
              <div className="field" style={{ marginTop: 14 }}>
                <span className="lbl">
                  {L('شدة الإضاءة العامة', 'Overall brightness')} — {Math.round(fin.brightness * 100)}%
                </span>
                <input
                  type="range"
                  min={0.5}
                  max={1.5}
                  step={0.05}
                  value={fin.brightness}
                  onChange={(e) => setFinishes({ brightness: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--primary)', direction: 'ltr' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
