import { useEffect, useState } from 'react';
import { Check, ChefHat, Copy, FileJson, FolderOpen, GitCompareArrows, Languages, LayoutGrid, MoreVertical, Pencil, Plus, Sparkles, Trash2, Upload } from 'lucide-react';
import { db } from '../db';
import { fmtDate, fmtNum, L } from '../i18n';
import { computeBom, type Bom } from '../lib/bom';
import { pickFile, projectToJson, safeName, saveText } from '../lib/exporters';
import { rectRoom } from '../lib/geometry';
import { normalizeProject, useStore } from '../store';
import type { Project, ProjectMeta } from '../types';
import { ask, Sheet } from './components';
import { NewProject } from './NewProject';

function Compare(props: { ids: string[]; onClose: () => void }) {
  const [rows, setRows] = useState<{ p: Project; bom: Bom }[] | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const list: { p: Project; bom: Bom }[] = [];
      for (const id of props.ids) {
        const raw = await db.getProject(id);
        if (raw) {
          const p = normalizeProject(raw);
          list.push({ p, bom: computeBom(p) });
        }
      }
      if (alive) setRows(list);
    })();
    return () => {
      alive = false;
    };
  }, [props.ids]);

  const best = rows && rows.length ? Math.min(...rows.map((r) => r.bom.cost.total)) : 0;
  const line = (label: string, get: (r: { p: Project; bom: Bom }) => string, strong?: (r: { p: Project; bom: Bom }) => boolean) => (
    <tr>
      <td className="muted">{label}</td>
      {rows!.map((r) => (
        <td key={r.p.id} className="num" style={strong?.(r) ? { color: 'var(--primary)', fontWeight: 800 } : undefined}>
          {get(r)}
        </td>
      ))}
    </tr>
  );
  return (
    <Sheet title={L('مقارنة التصميمات', 'Compare designs')} onClose={props.onClose}>
      {!rows ? (
        <div className="empty">
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      ) : (
        <div className="card">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th />
                  {rows.map((r) => (
                    <th key={r.p.id} className="num" style={{ whiteSpace: 'normal', minWidth: 96 }}>
                      {r.p.thumb && <img src={r.p.thumb} alt="" style={{ width: '100%', borderRadius: 8, display: 'block', marginBottom: 4 }} />}
                      <span style={{ color: 'var(--ink)', fontSize: 12.5 }}>{r.p.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {line(L('عدد الوحدات', 'Units'), (r) => String(r.bom.counts.total - r.bom.counts.appliance))}
                {line(L('الأجهزة', 'Appliances'), (r) => String(r.bom.counts.appliance))}
                {line(L('وحدات سفلية (م)', 'Base run (m)'), (r) => r.bom.runM.base.toFixed(2))}
                {line(L('وحدات علوية (م)', 'Wall run (m)'), (r) => r.bom.runM.wall.toFixed(2))}
                {line(L('أعمدة (م)', 'Tall run (m)'), (r) => r.bom.runM.tall.toFixed(2))}
                {line(L('سطح العمل (م)', 'Countertop (m)'), (r) => r.bom.countertop.lengthM.toFixed(2))}
                {line(L('ألواح الهيكل', 'Carcass sheets'), (r) => String(r.bom.sheets.carcass + r.bom.sheets.drawer))}
                {line(L('مساحة الضلف (م²)', 'Fronts (m²)'), (r) => r.bom.areas.front.toFixed(2))}
                {line(L('أدراج', 'Drawers'), (r) => String(r.bom.hw.slides))}
                {line(L('الخامات', 'Materials'), (r) => fmtNum(r.bom.cost.materials))}
                {line(L('المصنعيات', 'Labour'), (r) => fmtNum(r.bom.cost.services))}
                {line(
                  L('الإجمالي', 'Total'),
                  (r) => `${fmtNum(r.bom.cost.total)} ${r.p.prices.currency}`,
                  (r) => rows.length > 1 && r.bom.cost.total === best,
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="small muted center" style={{ marginTop: 10 }}>
        {L('الأقل تكلفة مميز باللون الأخضر.', 'The lowest total is highlighted.')}
      </p>
    </Sheet>
  );
}

export function Home() {
  const metas = useStore((s) => s.metas);
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  const openProject = useStore((s) => s.openProject);
  const createProject = useStore((s) => s.createProject);
  const deleteProject = useStore((s) => s.deleteProject);
  const duplicateProject = useStore((s) => s.duplicateProject);
  const renameProject = useStore((s) => s.renameProject);
  const importProject = useStore((s) => s.importProject);
  const notify = useStore((s) => s.notify);
  const [creating, setCreating] = useState(false);
  const [menu, setMenu] = useState<ProjectMeta | null>(null);
  const [comparing, setComparing] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [compare, setCompare] = useState(false);

  const doImport = async () => {
    const f = await pickFile('.json,application/json');
    if (!f) return;
    const ok = await importProject(await f.text());
    notify(ok ? L('تم استيراد المشروع', 'Project imported') : L('الملف غير صالح', 'Invalid file'));
  };
  const sample = () => createProject(L('مطبخ تجريبي', 'Sample kitchen'), rectRoom(420, 320), 280, true);

  const togglePick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? p : [...p, id]));

  return (
    <>
      <div className="topbar">
        <span className="iconbtn" style={{ background: 'rgba(255,255,255,.1)' }}>
          <ChefHat size={22} />
        </span>
        <div className="title">
          Kitchen Studio
          <span className="sub">{L('مصمم المطابخ الذكي', 'Smart kitchen designer')}</span>
        </div>
        <button className="iconbtn" onClick={doImport} aria-label={L('استيراد مشروع', 'Import project')} title={L('استيراد مشروع', 'Import project')}>
          <Upload size={20} />
        </button>
        <button className="iconbtn" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} aria-label="Language" title={lang === 'ar' ? 'English' : 'العربية'}>
          <Languages size={20} />
        </button>
      </div>
      <div className="content">
        <div className="scroll" style={{ paddingBottom: 96 }}>
          <div className="wrap">
            <div className="hero">
              <h1>{L('صمّم مطبخك بنفسك وشاهده قبل التنفيذ', 'Design your kitchen and see it before it is built')}</h1>
              <p>{L('ارسم الغرفة، وزّع الوحدات والأجهزة، اختر الخامات والألوان، ثم احصل على العرض ثلاثي الأبعاد والتكلفة والمخططات التنفيذية.', 'Draw the room, place units and appliances, choose materials, then get the 3D view, the cost and the working drawings.')}</p>
              <div className="row wrapx">
                <button className="btn primary" onClick={() => setCreating(true)}>
                  <Plus size={18} /> {L('مشروع جديد', 'New project')}
                </button>
                <button className="btn ghost" onClick={sample}>
                  <Sparkles size={18} /> {L('جرّب مشروعاً تجريبياً', 'Try a sample project')}
                </button>
              </div>
              <LayoutGrid className="hero-art" size={170} />
            </div>

            {metas.length > 0 && (
              <div className="row" style={{ margin: '18px 4px 10px' }}>
                <h3 className="grow" style={{ fontSize: 16 }}>
                  {L('مشاريعي', 'My projects')} <span className="muted small">({metas.length})</span>
                </h3>
                {metas.length > 1 && (
                  <button
                    className={'btn sm ' + (comparing ? 'primary' : 'ghost')}
                    onClick={() => {
                      setComparing((v) => !v);
                      setPicked([]);
                    }}
                  >
                    <GitCompareArrows size={16} /> {comparing ? L('إلغاء', 'Cancel') : L('مقارنة', 'Compare')}
                  </button>
                )}
              </div>
            )}
            {comparing && <p className="small muted" style={{ margin: '0 4px 10px' }}>{L('اختر من 2 إلى 4 تصميمات للمقارنة بينها.', 'Pick 2 to 4 designs to compare.')}</p>}
            <div className="proj-grid">
              {metas.map((m) => {
                const sel = picked.includes(m.id);
                return (
                  <div key={m.id} className={'proj' + (sel ? ' sel' : '')} role="button" tabIndex={0} onClick={() => (comparing ? togglePick(m.id) : void openProject(m.id))}>
                    <div className="thumb" style={m.thumb ? { backgroundImage: `url(${m.thumb})` } : undefined}>
                      {!m.thumb && <LayoutGrid size={34} />}
                    </div>
                    <div className="meta">
                      <div className="name">{m.name}</div>
                      <div className="small muted" style={{ direction: 'ltr', textAlign: 'start' }}>
                        {m.roomLabel} cm
                      </div>
                      <div className="small muted">
                        {m.itemCount} {L('وحدة', 'units')} · {fmtDate(m.updatedAt)}
                      </div>
                    </div>
                    {comparing ? (
                      <span className="check">{sel && <Check size={16} />}</span>
                    ) : (
                      <button
                        className="more"
                        aria-label={L('خيارات', 'Options')}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenu(m);
                        }}
                      >
                        <MoreVertical size={18} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {!metas.length && (
              <div className="empty">
                <FolderOpen size={44} />
                <div>{L('لا توجد مشاريع بعد — ابدأ بمشروع جديد أو جرّب المشروع التجريبي.', 'No projects yet — start a new one or try the sample.')}</div>
              </div>
            )}
            <p className="small muted center" style={{ marginTop: 22 }}>
              {L('تُحفظ مشاريعك على هذا الجهاز ويعمل التطبيق بدون إنترنت.', 'Your projects are stored on this device and the app works offline.')}
            </p>
          </div>
        </div>
        {comparing ? (
          <button className="fab" disabled={picked.length < 2} style={picked.length < 2 ? { opacity: 0.5 } : undefined} onClick={() => setCompare(true)}>
            <GitCompareArrows size={20} /> {L(`قارن (${picked.length})`, `Compare (${picked.length})`)}
          </button>
        ) : (
          metas.length > 0 && (
            <button className="fab" onClick={() => setCreating(true)}>
              <Plus size={22} /> {L('مشروع جديد', 'New project')}
            </button>
          )
        )}
      </div>

      {creating && <NewProject onClose={() => setCreating(false)} />}
      {compare && <Compare ids={picked} onClose={() => setCompare(false)} />}
      {menu && (
        <Sheet title={menu.name} onClose={() => setMenu(null)}>
          <div className="menu-list">
            <button
              onClick={() => {
                void openProject(menu.id);
                setMenu(null);
              }}
            >
              <FolderOpen size={20} /> {L('فتح', 'Open')}
            </button>
            <button
              onClick={async () => {
                const m = menu;
                setMenu(null);
                const name = await ask.prompt(L('اسم المشروع', 'Project name'), m.name);
                if (name) void renameProject(m.id, name);
              }}
            >
              <Pencil size={20} /> {L('إعادة تسمية', 'Rename')}
            </button>
            <button
              onClick={() => {
                void duplicateProject(menu.id);
                setMenu(null);
                notify(L('تم إنشاء نسخة من التصميم', 'Design duplicated'));
              }}
            >
              <Copy size={20} /> {L('نسخ التصميم', 'Duplicate')}
            </button>
            <button
              onClick={async () => {
                const m = menu;
                setMenu(null);
                const raw = await db.getProject(m.id);
                if (!raw) return;
                try {
                  await saveText(projectToJson(raw), `${safeName(m.name)}.kitchen.json`, 'application/json');
                } catch {
                  notify(L('تعذر التصدير', 'Export failed'));
                }
              }}
            >
              <FileJson size={20} /> {L('تصدير ملف المشروع', 'Export project file')}
            </button>
            <button
              className="danger"
              onClick={async () => {
                const m = menu;
                setMenu(null);
                if (await ask.confirm(L('حذف المشروع نهائياً؟', 'Delete this project permanently?'), m.name, { danger: true, ok: L('حذف', 'Delete') })) void deleteProject(m.id);
              }}
            >
              <Trash2 size={20} /> {L('حذف', 'Delete')}
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}
