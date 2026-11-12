import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Box, Calculator, FileText, Palette, PencilRuler, Redo2, Undo2 } from 'lucide-react';
import { isRTL, L } from '../i18n';
import { useStore, type Tab } from '../store';
import { renderProjectImage } from '../three/SceneManager';
import { ask } from './components';
import { CostsPanel } from './CostsPanel';
import { DrawingsPanel } from './DrawingsPanel';
import { Plan2D } from './Plan2D';
import { sceneRef, View3D } from './View3D';

/** Save a preview image and return to the project list. */
export async function leaveEditor() {
  const st = useStore.getState();
  const p = st.project;
  if (p && p.items.length) {
    try {
      if (sceneRef.current) {
        if (sceneRef.current.mode === 'walk') sceneRef.current.setMode('orbit');
        st.saveThumb(sceneRef.current.snapshot(480, 300, 0.72));
      } else if (!p.thumb || p.updatedAt > editorOpenedAt) {
        st.saveThumb(renderProjectImage(p, 480, 300));
      }
    } catch {
      /* a missing preview is not a reason to block leaving */
    }
  }
  await st.closeProject();
}

let editorOpenedAt = 0;

export function Editor() {
  const name = useStore((s) => s.project!.name);
  const id = useStore((s) => s.project!.id);
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const renameProject = useStore((s) => s.renameProject);
  const leaving = useRef(false);

  useEffect(() => {
    editorOpenedAt = Date.now();
  }, [id]);

  const back = async () => {
    if (leaving.current) return;
    leaving.current = true;
    await leaveEditor();
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'plan', label: L('المخطط', 'Plan'), icon: <PencilRuler size={21} /> },
    { id: '3d', label: L('ثلاثي الأبعاد', '3D'), icon: <Box size={21} /> },
    { id: 'finishes', label: L('الخامات', 'Finishes'), icon: <Palette size={21} /> },
    { id: 'costs', label: L('الحسابات', 'Costs'), icon: <Calculator size={21} /> },
    { id: 'drawings', label: L('المخططات', 'Drawings'), icon: <FileText size={21} /> },
  ];

  return (
    <>
      <div className="topbar">
        <button className="iconbtn" onClick={back} aria-label={L('رجوع', 'Back')}>
          {isRTL() ? <ArrowRight size={22} /> : <ArrowLeft size={22} />}
        </button>
        <button
          className="title"
          onClick={async () => {
            const n = await ask.prompt(L('اسم المشروع', 'Project name'), name);
            if (n) void renameProject(id, n);
          }}
        >
          {name}
        </button>
        <button className="iconbtn" onClick={undo} disabled={!canUndo} aria-label={L('تراجع', 'Undo')}>
          <Undo2 size={20} />
        </button>
        <button className="iconbtn" onClick={redo} disabled={!canRedo} aria-label={L('إعادة', 'Redo')}>
          <Redo2 size={20} />
        </button>
      </div>
      <div className="content">
        {tab === 'plan' && <Plan2D />}
        {(tab === '3d' || tab === 'finishes') && <View3D withFinishes={tab === 'finishes'} />}
        {tab === 'costs' && <CostsPanel />}
        {tab === 'drawings' && <DrawingsPanel />}
      </div>
      <nav className="bottomnav">
        {tabs.map((t) => (
          <button key={t.id} className={t.id === tab ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>
    </>
  );
}
