import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { fmtCm, getLang, L, LT } from '../i18n';
import { CATALOG, GROUPS } from '../lib/catalog';
import { useStore } from '../store';
import type { ModuleDef } from '../types';
import { ask, Sheet } from './components';
import { ModuleGlyph } from './glyph';

export function Library(props: { onClose: () => void }) {
  const modules = useStore((s) => s.modules);
  const addModule = useStore((s) => s.addModule);
  const notify = useStore((s) => s.notify);
  const deleteCustomModule = useStore((s) => s.deleteCustomModule);
  const [group, setGroup] = useState(GROUPS[0].id);

  const groups = [...GROUPS.map((g) => ({ id: g.id, name: LT(g.name) })), ...(modules.length ? [{ id: 'custom', name: L('وحداتي', 'My units') }] : [])];
  const list: ModuleDef[] = group === 'custom' ? modules : CATALOG.filter((m) => m.group === group);

  const pick = (def: ModuleDef) => {
    addModule(def);
    notify(L('تمت الإضافة — اسحب الوحدة لتحريكها', 'Added — drag the unit to move it'));
    props.onClose();
  };

  return (
    <Sheet title={L('مكتبة الوحدات', 'Unit library')} onClose={props.onClose}>
      <div className="chips">
        {groups.map((g) => (
          <button key={g.id} className={'chip' + (g.id === group ? ' active' : '')} onClick={() => setGroup(g.id)}>
            {g.name}
          </button>
        ))}
      </div>
      <div className="lib-grid">
        {list.map((def) => (
          <div key={def.key} className="lib-item" role="button" tabIndex={0} onClick={() => pick(def)}>
            <ModuleGlyph def={def} />
            <span className="nm">{def.name[getLang()]}</span>
            <span className="dm">
              {fmtCm(def.w)}×{fmtCm(def.d)}×{fmtCm(def.h)}
            </span>
            {def.custom && (
              <button
                className="del"
                aria-label={L('حذف', 'Delete')}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (await ask.confirm(L('حذف الوحدة من مكتبتك؟', 'Delete this unit from your library?'), def.name.ar, { danger: true, ok: L('حذف', 'Delete') })) void deleteCustomModule(def.key);
                }}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
      {group === 'custom' && !modules.length && <div className="empty">{L('لا توجد وحدات محفوظة بعد', 'No saved units yet')}</div>}
      <p className="small muted center" style={{ marginTop: 14 }}>
        {L('يمكنك تعديل أبعاد وتقسيم أي وحدة بعد إضافتها، ثم حفظها في «وحداتي».', 'You can resize and re-divide any unit after adding it, then save it to “My units”.')}
      </p>
    </Sheet>
  );
}
