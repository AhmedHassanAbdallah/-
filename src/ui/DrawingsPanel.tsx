import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, FileDown, FileJson, FileSpreadsheet, FileText, Image as ImageIcon, PencilRuler, Share2, X } from 'lucide-react';
import { exportPdf } from '../drawings/pdf';
import { buildSheets, consolidatedCutList, ensureFonts, renderSheet, type SheetSpec } from '../drawings/sheets';
import { L } from '../i18n';
import { computeBom } from '../lib/bom';
import { dataUrlToBlob, projectToJson, safeName, saveBlob, saveText, toCsv } from '../lib/exporters';
import { useStore } from '../store';
import { exportProject3D, renderProjectImage } from '../three/SceneManager';
import { Busy, Sheet, useBackClose } from './components';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function canvasToUrl(cv: HTMLCanvasElement, type = 'image/jpeg', q = 0.88): Promise<string> {
  return new Promise((resolve) => {
    cv.toBlob(
      (b) => {
        cv.width = cv.height = 0;
        resolve(b ? URL.createObjectURL(b) : '');
      },
      type,
      q,
    );
  });
}

/** Full-screen pan / pinch-zoom viewer for one sheet. */
function Viewer(props: { url: string; onClose: () => void }) {
  useBackClose(props.onClose);
  const [t, setT] = useState({ s: 1, x: 0, y: 0 });
  const tRef = useRef(t);
  tRef.current = t;
  const img = useRef<HTMLImageElement>(null);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const g = useRef<{ kind: 'pan'; sx: number; sy: number; x0: number; y0: number } | { kind: 'pinch'; d0: number; s0: number; ix: number; iy: number } | null>(null);
  const lastTap = useRef(0);

  const fit = () => {
    const el = img.current;
    if (!el || !el.naturalWidth) return;
    const s = Math.min(window.innerWidth / el.naturalWidth, window.innerHeight / el.naturalHeight);
    setT({ s, x: (window.innerWidth - el.naturalWidth * s) / 2, y: (window.innerHeight - el.naturalHeight * s) / 2 });
  };

  const zoomAt = (cx: number, cy: number, s: number) => {
    const c = tRef.current;
    const ns = Math.max(0.05, Math.min(8, s));
    setT({ s: ns, x: cx - ((cx - c.x) / c.s) * ns, y: cy - ((cy - c.y) / c.s) * ns });
  };

  return (
    <div
      className="viewer"
      onWheel={(e) => zoomAt(e.clientX, e.clientY, tRef.current.s * Math.exp(-e.deltaY * 0.0015))}
      onPointerDown={(e) => {
        // leave taps on the close button alone: capturing the pointer would swallow its click
        if ((e.target as Element).closest('button')) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const c = tRef.current;
        if (pts.current.size === 2) {
          const [a, b] = [...pts.current.values()];
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          g.current = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: c.s, ix: (mx - c.x) / c.s, iy: (my - c.y) / c.s };
        } else {
          g.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, x0: c.x, y0: c.y };
          const now = performance.now();
          if (now - lastTap.current < 300) zoomAt(e.clientX, e.clientY, c.s * 2);
          lastTap.current = now;
        }
      }}
      onPointerMove={(e) => {
        if (!pts.current.has(e.pointerId) || !g.current) return;
        pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const cur = g.current;
        if (cur.kind === 'pinch' && pts.current.size >= 2) {
          const [a, b] = [...pts.current.values()];
          const s = Math.max(0.05, Math.min(8, (cur.s0 * Math.hypot(a.x - b.x, a.y - b.y)) / cur.d0));
          setT({ s, x: (a.x + b.x) / 2 - cur.ix * s, y: (a.y + b.y) / 2 - cur.iy * s });
        } else if (cur.kind === 'pan') {
          setT((c) => ({ ...c, x: cur.x0 + e.clientX - cur.sx, y: cur.y0 + e.clientY - cur.sy }));
        }
      }}
      onPointerUp={(e) => {
        pts.current.delete(e.pointerId);
        g.current = null;
      }}
      onPointerCancel={(e) => {
        pts.current.delete(e.pointerId);
        g.current = null;
      }}
    >
      <img ref={img} src={props.url} onLoad={fit} draggable={false} style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})` }} alt="" />
      <button className="iconbtn light close" onClick={props.onClose} aria-label={L('إغلاق', 'Close')}>
        <X size={22} />
      </button>
    </div>
  );
}

export function DrawingsPanel() {
  const project = useStore((s) => s.project)!;
  const notify = useStore((s) => s.notify);
  const [specs, setSpecs] = useState<SheetSpec[]>([]);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [viewer, setViewer] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const { items, room, finishes, prices, rules, name } = project;
  const bom = useMemo(() => computeBom(project), [items, room, finishes, prices, rules]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      await ensureFonts();
      const p = useStore.getState().project!;
      let cover: HTMLImageElement | null = null;
      if (p.items.length) {
        try {
          cover = await loadImage(renderProjectImage(p, 1448, 960));
        } catch {
          cover = null;
        }
      }
      if (cancelled) return;
      const list = buildSheets(p, bom, cover);
      setSpecs(list);
      setThumbs(list.map(() => ''));
      for (let i = 0; i < list.length; i++) {
        if (cancelled) return;
        const url = await canvasToUrl(renderSheet(list[i], i, list.length, p, 4));
        urls.push(url);
        if (cancelled) return;
        setThumbs((prev) => prev.map((u, k) => (k === i ? url : u)));
        await new Promise((r) => setTimeout(r, 0));
      }
    })();
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [bom, name]);

  const openViewer = async (i: number) => {
    setBusy(L('جارٍ التجهيز…', 'Preparing…'));
    await new Promise((r) => setTimeout(r, 20));
    const url = await canvasToUrl(renderSheet(specs[i], i, specs.length, project, 8), 'image/jpeg', 0.9);
    setBusy(null);
    setViewer(url);
  };

  const run = async (label: string, fn: () => Promise<'shared' | 'downloaded' | void>) => {
    setMenu(false);
    setBusy(label);
    await new Promise((r) => setTimeout(r, 30));
    try {
      const how = await fn();
      if (how === 'downloaded') notify(L('تم حفظ الملف', 'File saved'));
    } catch (e) {
      console.error(e);
      notify(L('تعذر التصدير', 'Export failed'));
    } finally {
      setBusy(null);
    }
  };

  const base = safeName(project.name);
  const doPdf = () =>
    run(L('جارٍ إنشاء ملف PDF…', 'Building the PDF…'), async () => {
      const blob = await exportPdf(project, specs, (d, n) => setBusy(L(`جارٍ إنشاء ملف PDF… ${d}/${n}`, `Building the PDF… ${d}/${n}`)));
      return saveBlob(blob, `${base}.pdf`);
    });
  const do3dImage = () => run(L('جارٍ إخراج الصورة…', 'Rendering…'), async () => saveBlob(dataUrlToBlob(renderProjectImage(project, 1920, 1200)), `${base}_3D.jpg`));
  const doPlanImage = () =>
    run(L('جارٍ إخراج الصورة…', 'Rendering…'), async () => {
      const i = specs.findIndex((s) => s.id === 'plan');
      const cv = renderSheet(specs[i], i, specs.length, project, 8);
      const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/png'));
      return saveBlob(blob!, `${base}_plan.png`);
    });
  const doGlb = () => run(L('جارٍ تصدير النموذج…', 'Exporting the model…'), async () => saveBlob(await exportProject3D(project, 'glb'), `${base}.glb`));
  const doObj = () => run(L('جارٍ تصدير النموذج…', 'Exporting the model…'), async () => saveBlob(await exportProject3D(project, 'obj'), `${base}.obj`));
  const doCsv = () =>
    run(L('جارٍ التصدير…', 'Exporting…'), async () => {
      const rows: (string | number)[][] = [[L('الخامة', 'Material'), L('القطعة', 'Part'), L('الطول مم', 'Length mm'), L('العرض مم', 'Width mm'), L('السمك مم', 'Thickness mm'), L('العدد', 'Qty'), L('شريط الحرف م', 'Edging m'), L('الوحدات', 'Units')]];
      for (const r of consolidatedCutList(project, bom)) rows.push([r.material, r.name, r.L, r.W, r.T, r.qty, (r.edge / 1000).toFixed(2), r.tags.join(' ')]);
      return saveText(toCsv(rows), `${base}_cutlist.csv`, 'text/csv;charset=utf-8');
    });
  const doJson = () => run(L('جارٍ التصدير…', 'Exporting…'), async () => saveText(projectToJson(project), `${base}.kitchen.json`, 'application/json'));

  return (
    <div className="scroll">
      <div className="wrap">
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="btn primary grow" onClick={doPdf} disabled={!specs.length}>
            <FileDown size={18} /> {L('تصدير المخططات PDF', 'Export drawings as PDF')}
          </button>
          <button className="btn ghost" onClick={() => setMenu(true)}>
            <Share2 size={18} /> {L('تصدير آخر', 'More')}
          </button>
        </div>
        {!project.items.length && (
          <div className="card small muted" style={{ marginBottom: 12 }}>
            <PencilRuler size={16} style={{ verticalAlign: -3 }} /> {L('أضف وحدات إلى التصميم لتظهر الواجهات وقوائم القص.', 'Add units to the design to get elevations and cut lists.')}
          </div>
        )}
        {specs.map((s, i) => (
          <button key={s.id} className="sheet-thumb" style={{ display: 'block', width: '100%' }} onClick={() => thumbs[i] && openViewer(i)}>
            {thumbs[i] ? (
              <img src={thumbs[i]} alt={s.title} />
            ) : (
              <div style={{ aspectRatio: '297/210', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" />
              </div>
            )}
            <span className="cap">
              {i + 1}. {s.title}
            </span>
          </button>
        ))}
        {specs.length > 0 && <p className="small muted center">{L('اضغط على أي لوحة لتكبيرها', 'Tap a sheet to zoom in')}</p>}
      </div>

      {menu && (
        <Sheet title={L('تصدير ومشاركة', 'Export & share')} onClose={() => setMenu(false)}>
          <div className="menu-list">
            <button onClick={doPdf}>
              <FileText size={20} /> {L('ملف PDF للمخططات التنفيذية', 'PDF of the working drawings')}
            </button>
            <button onClick={do3dImage} disabled={!project.items.length}>
              <ImageIcon size={20} /> {L('صورة المنظور ثلاثي الأبعاد (JPG)', '3D perspective image (JPG)')}
            </button>
            <button onClick={doPlanImage}>
              <ImageIcon size={20} /> {L('صورة المسقط الأفقي (PNG)', 'Floor plan image (PNG)')}
            </button>
            <button onClick={doGlb} disabled={!project.items.length}>
              <Box size={20} /> {L('نموذج ثلاثي الأبعاد GLB (glTF)', '3D model – GLB (glTF)')}
            </button>
            <button onClick={doObj} disabled={!project.items.length}>
              <Box size={20} /> {L('نموذج ثلاثي الأبعاد OBJ', '3D model – OBJ')}
            </button>
            <button onClick={doCsv} disabled={!project.items.length}>
              <FileSpreadsheet size={20} /> {L('قائمة القص CSV (إكسل)', 'Cut list CSV (Excel)')}
            </button>
            <button onClick={doJson}>
              <FileJson size={20} /> {L('ملف المشروع (نسخة احتياطية / مشاركة)', 'Project file (backup / share)')}
            </button>
          </div>
        </Sheet>
      )}
      {viewer && (
        <Viewer
          url={viewer}
          onClose={() => {
            URL.revokeObjectURL(viewer);
            setViewer(null);
          }}
        />
      )}
      {busy && <Busy text={busy} />}
    </div>
  );
}
