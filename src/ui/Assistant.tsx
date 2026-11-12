import { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { L } from '../i18n';
import { autoLayout, DEFAULT_AUTO, type AutoOptions } from '../lib/autolayout';
import { CATALOG } from '../lib/catalog';
import { useStore } from '../store';
import { ask, Seg, Sheet, ToggleRow } from './components';

const EXTRA_KEYS = ['app_washer', 'app_dryer', 'app_washer_top', 'app_washer_mini', 'app_wine', 'app_freezer', 'app_chest', 'app_dispenser', 'app_microwave', 'app_coffee', 'app_heater'];

/** Offline rule-based layout assistant. */
export function Assistant(props: { onClose: () => void }) {
  const project = useStore((s) => s.project)!;
  const commit = useStore((s) => s.commit);
  const select = useStore((s) => s.select);
  const [opts, setOpts] = useState<AutoOptions>(DEFAULT_AUTO);
  const [notes, setNotes] = useState<string[] | null>(null);
  const set = (patch: Partial<AutoOptions>) => setOpts((o) => ({ ...o, ...patch }));

  const run = async () => {
    if (project.items.length) {
      const ok = await ask.confirm(L('استبدال التصميم الحالي؟', 'Replace the current design?'), L('سيتم حذف الوحدات الحالية ووضع التوزيع المقترح. يمكنك التراجع بعد ذلك.', 'Existing units will be replaced by the suggested layout. You can undo afterwards.'), {
        ok: L('استبدال', 'Replace'),
      });
      if (!ok) return;
    }
    const res = autoLayout(project.room, opts);
    select(null);
    commit((p) => ({ ...p, items: res.items }));
    setNotes([L(`تم وضع ${res.items.length} وحدة.`, `${res.items.length} units placed.`), ...res.notes]);
  };

  return (
    <Sheet
      title={
        <span className="row" style={{ gap: 6 }}>
          <Sparkles size={19} color="var(--accent)" /> {L('المساعد الذكي', 'Smart assistant')}
        </span>
      }
      onClose={props.onClose}
    >
      {notes ? (
        <>
          <div className="card">
            <h3>{L('تم إنشاء التوزيع المقترح', 'Suggested layout created')}</h3>
            {notes.map((n, i) => (
              <div key={i} className="row" style={{ alignItems: 'flex-start', padding: '4px 0' }}>
                <Check size={16} color="var(--primary)" style={{ flex: 'none', marginTop: 3 }} />
                <span className="small">{n}</span>
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn ghost grow" onClick={() => setNotes(null)}>
              {L('تجربة خيارات أخرى', 'Try other options')}
            </button>
            <button className="btn primary grow" onClick={props.onClose}>
              {L('عرض التصميم', 'View design')}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="small muted" style={{ marginBottom: 10 }}>
            {L(
              'يقترح توزيعاً للوحدات حسب أبعاد الغرفة وأماكن الأبواب والشبابيك ومصادر المياه والغاز، ويعمل بالكامل على جهازك بدون إنترنت.',
              'Suggests a unit layout from the room size, doors, windows and service points. Runs fully on your device, offline.',
            )}
          </p>
          <div className="card">
            <div className="field">
              <span className="lbl">{L('شكل التوزيع', 'Layout shape')}</span>
              <Seg
                block
                value={opts.style}
                onChange={(style) => set({ style })}
                options={[
                  { id: 'auto', label: L('تلقائي', 'Auto') },
                  { id: 'I', label: L('خطي', 'Straight') },
                  { id: 'L', label: L('حرف L', 'L-shape') },
                  { id: 'U', label: L('حرف U', 'U-shape') },
                ]}
              />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <span className="lbl">{L('الثلاجة', 'Fridge')}</span>
              <Seg
                block
                value={opts.fridge}
                onChange={(fridge) => set({ fridge })}
                options={[
                  { id: 'free', label: L('قائمة', 'Freestanding') },
                  { id: 'builtin', label: L('مدمجة', 'Built-in') },
                  { id: 'none', label: L('بدون', 'None') },
                ]}
              />
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <span className="lbl">{L('الطهي', 'Cooking')}</span>
              <Seg
                block
                value={opts.cooking}
                onChange={(cooking) => set({ cooking })}
                options={[
                  { id: 'builtin', label: L('مسطح + فرن بلت إن', 'Built-in hob + oven') },
                  { id: 'cooker', label: L('بوتاجاز قائم', 'Freestanding cooker') },
                ]}
              />
            </div>
          </div>
          <div className="card">
            {opts.cooking === 'builtin' && <ToggleRow label={L('عمود فرن وميكروويف', 'Oven + microwave tower')} on={opts.ovenTower} onChange={(ovenTower) => set({ ovenTower })} />}
            <ToggleRow label={L('غسالة أطباق بجوار الحوض', 'Dishwasher next to the sink')} on={opts.dishwasher} onChange={(dishwasher) => set({ dishwasher })} />
            <ToggleRow label={L('عمود تخزين (مؤن)', 'Pantry tower')} on={opts.pantry} onChange={(pantry) => set({ pantry })} />
            <ToggleRow label={L('وحدات علوية', 'Wall units')} on={opts.wallUnits} onChange={(wallUnits) => set({ wallUnits })} />
            <ToggleRow label={L('جزيرة في المنتصف', 'Central island')} hint={L('تضاف فقط إذا سمحت المساحة بممرات 100 سم', 'Only if 100 cm aisles fit')} on={opts.island} onChange={(island) => set({ island })} />
          </div>
          <div className="card">
            <h3>{L('أجهزتي الأخرى', 'My other appliances')}</h3>
            <p className="small muted" style={{ marginBottom: 8 }}>
              {L('اختر كل الأجهزة الموجودة عندك وسيضعها المساعد في أنسب مكان: الغسالات بجوار الحوض، والأجهزة القائمة في نهاية الصف، والصغيرة على سطح العمل.', 'Pick everything you own; the assistant places washers by the sink, free-standing units at the end of a run and small ones on the worktop.')}
            </p>
            <div className="chips" style={{ flexWrap: 'wrap', paddingBottom: 0 }}>
              {EXTRA_KEYS.map((key) => {
                const d = CATALOG.find((m) => m.key === key);
                if (!d) return null;
                const on = opts.extras.includes(key);
                return (
                  <button key={key} className={'chip' + (on ? ' active' : '')} onClick={() => set({ extras: on ? opts.extras.filter((k) => k !== key) : [...opts.extras, key] })}>
                    {L(d.name.ar, d.name.en)}
                  </button>
                );
              })}
            </div>
          </div>
          <button className="btn primary block" style={{ marginTop: 14 }} onClick={run}>
            <Sparkles size={18} /> {L('اقترح تصميماً', 'Suggest a design')}
          </button>
        </>
      )}
    </Sheet>
  );
}
