import { useMemo, useState } from 'react';
import { Download, Hammer, Settings2 } from 'lucide-react';
import { consolidatedCutList } from '../drawings/sheets';
import { fmtCm, fmtNum, getLang, L, LT } from '../i18n';
import { computeBom } from '../lib/bom';
import { CAT_NAMES, itemName } from '../lib/catalog';
import { safeName, saveText, toCsv } from '../lib/exporters';
import { COUNTERTOP_TYPES, DOOR_TYPES } from '../lib/materials';
import { useStore } from '../store';
import type { Prices, Rules } from '../types';
import { NumField, Seg, Sheet, TextField } from './components';

type View = 'summary' | 'units' | 'cut' | 'hardware';

export function CostsPanel() {
  const project = useStore((s) => s.project)!;
  const notify = useStore((s) => s.notify);
  const bom = useMemo(() => computeBom(project), [project.items, project.room, project.finishes, project.prices, project.rules]); // eslint-disable-line react-hooks/exhaustive-deps
  const [view, setView] = useState<View>('summary');
  const [sheet, setSheet] = useState<null | 'prices' | 'rules'>(null);
  const cur = project.prices.currency;
  const lang = getLang();
  const cut = useMemo(() => consolidatedCutList(project, bom), [project, bom]);

  const exportCsv = async () => {
    const rows: (string | number)[][] = [[L('الخامة', 'Material'), L('القطعة', 'Part'), L('الطول مم', 'Length mm'), L('العرض مم', 'Width mm'), L('السمك مم', 'Thickness mm'), L('العدد', 'Qty'), L('شريط الحرف م', 'Edging m'), L('الوحدات', 'Units')]];
    for (const r of cut) rows.push([r.material, r.name, r.L, r.W, r.T, r.qty, (r.edge / 1000).toFixed(2), r.tags.join(' ')]);
    try {
      const how = await saveText(toCsv(rows), `${safeName(project.name)}_cutlist.csv`, 'text/csv;charset=utf-8');
      if (how === 'downloaded') notify(L('تم تصدير قائمة القص', 'Cut list exported'));
    } catch {
      notify(L('تعذر التصدير', 'Export failed'));
    }
  };

  if (!project.items.length) {
    return (
      <div className="scroll">
        <div className="empty">
          <Hammer size={46} />
          <div>
            <b>{L('لا توجد وحدات بعد', 'No units yet')}</b>
          </div>
          <div className="small">{L('أضف وحدات من تبويب «المخطط» لتظهر الحسابات والتكلفة هنا.', 'Add units in the “Plan” tab to see quantities and cost here.')}</div>
        </div>
      </div>
    );
  }

  const groupNames: Record<string, string> = {
    boards: L('الألواح', 'Boards'),
    fronts: L('الضلف', 'Fronts'),
    tops: L('الأسطح', 'Tops'),
    hardware: L('الإكسسوارات', 'Hardware'),
    services: L('المصنعيات والخدمات', 'Labour & services'),
    appliances: L('الأجهزة', 'Appliances'),
  };
  const groups = ['boards', 'fronts', 'tops', 'hardware', 'services', 'appliances'].filter((g) => bom.cost.lines.some((l) => l.group === g));

  return (
    <div className="scroll">
      <div className="wrap">
        <div className="total-card">
          <div className="row">
            <div className="grow">
              <div className="small" style={{ opacity: 0.75 }}>
                {L('التكلفة التقديرية الإجمالية', 'Estimated total cost')}
              </div>
              <div className="big">
                {fmtNum(bom.cost.total)} <small>{cur}</small>
              </div>
            </div>
            <button className="btn sm" style={{ background: 'rgba(255,255,255,.14)', color: '#fff' }} onClick={() => setSheet('prices')}>
              <Settings2 size={16} /> {L('الأسعار', 'Prices')}
            </button>
          </div>
          <div className="row wrapx small" style={{ marginTop: 10, opacity: 0.85, gap: '4px 16px' }}>
            <span>
              {L('خامات', 'Materials')}: <b style={{ direction: 'ltr', display: 'inline-block' }}>{fmtNum(bom.cost.materials)}</b>
            </span>
            <span>
              {L('مصنعيات', 'Labour')}: <b style={{ direction: 'ltr', display: 'inline-block' }}>{fmtNum(bom.cost.services)}</b>
            </span>
            <span>
              {L('ربح', 'Margin')} {project.prices.margin}%: <b style={{ direction: 'ltr', display: 'inline-block' }}>{fmtNum(bom.cost.margin)}</b>
            </span>
            {bom.cost.appliances > 0 && (
              <span>
                {L('أجهزة', 'Appliances')}: <b style={{ direction: 'ltr', display: 'inline-block' }}>{fmtNum(bom.cost.appliances)}</b>
              </span>
            )}
            {bom.cost.tax > 0 && (
              <span>
                {L('ضريبة', 'Tax')}: <b style={{ direction: 'ltr', display: 'inline-block' }}>{fmtNum(bom.cost.tax)}</b>
              </span>
            )}
          </div>
        </div>

        <div className="stat-grid" style={{ marginTop: 12 }}>
          <div className="stat">
            <b>{bom.counts.total - bom.counts.appliance}</b>
            <span>
              {L('وحدة', 'units')} · {bom.counts.appliance} {L('جهاز', 'appliances')}
            </span>
          </div>
          <div className="stat">
            <b>{bom.runM.total.toFixed(2)} m</b>
            <span>{L('أطوال الوحدات', 'Cabinet run')}</span>
          </div>
          <div className="stat">
            <b>{bom.countertop.lengthM.toFixed(2)} m</b>
            <span>{L('طول سطح العمل', 'Countertop length')}</span>
          </div>
          <div className="stat">
            <b>{bom.sheets.carcass + bom.sheets.drawer}</b>
            <span>{L('ألواح الهيكل (تقديري)', 'Carcass sheets (est.)')}</span>
          </div>
          <div className="stat">
            <b>{bom.areas.front.toFixed(2)} m²</b>
            <span>{L('مساحة الضلف', 'Fronts area')}</span>
          </div>
          <div className="stat">
            <b>{bom.edgeM.toFixed(1)} m</b>
            <span>{L('شريط الحرف', 'Edge banding')}</span>
          </div>
        </div>

        <div style={{ margin: '14px 0 10px' }}>
          <Seg
            block
            value={view}
            onChange={setView}
            options={[
              { id: 'summary', label: L('التكلفة', 'Cost') },
              { id: 'units', label: L('الوحدات', 'Units') },
              { id: 'cut', label: L('قائمة القص', 'Cut list') },
              { id: 'hardware', label: L('الخامات', 'Materials') },
            ]}
          />
        </div>

        {view === 'summary' && (
          <>
            {groups.map((g) => (
              <div className="card" key={g}>
                <h3>{groupNames[g]}</h3>
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>{L('البند', 'Item')}</th>
                        <th className="num">{L('الكمية', 'Qty')}</th>
                        <th className="num">{L('السعر', 'Price')}</th>
                        <th className="num">{L('الإجمالي', 'Total')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bom.cost.lines
                        .filter((l) => l.group === g)
                        .map((l) => (
                          <tr key={l.key}>
                            <td>{LT(l.label)}</td>
                            <td className="num">
                              {l.qty % 1 ? l.qty.toFixed(2) : l.qty} {LT(l.unit)}
                            </td>
                            <td className="num">{fmtNum(l.unitPrice)}</td>
                            <td className="num">
                              <b>{fmtNum(l.total)}</b>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            <p className="small muted center" style={{ marginTop: 12 }}>
              {L('الأسعار الافتراضية استرشادية فقط — عدّلها من زر «الأسعار» لتطابق أسعار السوق عندك.', 'Default prices are indicative only — edit them with the “Prices” button to match your market.')}
            </p>
          </>
        )}

        {view === 'units' && (
          <div className="card">
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{L('الوحدة', 'Unit')}</th>
                    <th>{L('النوع', 'Type')}</th>
                    <th className="num">{L('عرض×عمق×ارتفاع', 'W×D×H')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bom.ordered.map((it) => (
                    <tr key={it.id}>
                      <td>
                        <span className="tag">{bom.tags.get(it.id)}</span>
                      </td>
                      <td>{itemName(it, lang)}</td>
                      <td>{LT(CAT_NAMES[it.cat])}</td>
                      <td className="num">
                        {fmtCm(it.w)}×{fmtCm(it.d)}×{fmtCm(it.h)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'cut' && (
          <>
            <div className="row" style={{ marginBottom: 10 }}>
              <button className="btn ghost sm" onClick={() => setSheet('rules')}>
                <Settings2 size={16} /> {L('قواعد التصنيع', 'Manufacturing rules')}
              </button>
              <span className="grow" />
              <button className="btn soft sm" onClick={exportCsv}>
                <Download size={16} /> CSV
              </button>
            </div>
            <div className="card">
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>{L('الخامة', 'Material')}</th>
                      <th>{L('القطعة', 'Part')}</th>
                      <th className="num">{L('الطول×العرض مم', 'L×W mm')}</th>
                      <th className="num">{L('عدد', 'Qty')}</th>
                      <th>{L('الوحدات', 'Units')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cut.map((r, i) => (
                      <tr key={i}>
                        <td>{r.material}</td>
                        <td>{r.name}</td>
                        <td className="num">
                          <b>
                            {r.L}×{r.W}
                          </b>{' '}
                          <span className="muted">/{r.T}</span>
                        </td>
                        <td className="num">
                          <b>{r.qty}</b>
                        </td>
                        <td className="small muted" style={{ direction: 'ltr', textAlign: 'start' }}>
                          {r.tags.join(' ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="small muted center" style={{ marginTop: 10 }}>
              {L('مخطط توزيع القطع على الألواح موجود في تبويب «المخططات».', 'The sheet cutting layout is in the “Drawings” tab.')}
            </p>
          </>
        )}

        {view === 'hardware' && (
          <>
            <div className="card">
              <h3>{L('الألواح (تقدير بتوزيع القطع)', 'Boards (nesting estimate)')}</h3>
              {bom.nesting.map((n) => (
                <div className="kv" key={n.key}>
                  <span>{LT(n.label)}</span>
                  <b>
                    {n.result.sheets.length} {L('لوح', 'sheets')} · {(n.result.efficiency * 100).toFixed(0)}%
                  </b>
                </div>
              ))}
              <div className="kv">
                <span>{L('شريط الحرف (شامل الهالك)', 'Edge banding (incl. waste)')}</span>
                <b>{bom.edgeM.toFixed(1)} m</b>
              </div>
            </div>
            <div className="card">
              <h3>{L('الأسطح', 'Tops')}</h3>
              <div className="kv">
                <span>{L('طول سطح العمل', 'Countertop length')}</span>
                <b>{bom.countertop.lengthM.toFixed(2)} m</b>
              </div>
              <div className="kv">
                <span>{L('مساحة سطح العمل', 'Countertop area')}</span>
                <b>{bom.countertop.areaM2.toFixed(2)} m²</b>
              </div>
              {bom.countertop.runs.map((r, i) => (
                <div className="kv small muted" key={i}>
                  <span>
                    {L('قطعة', 'Piece')} {i + 1} {r.island ? L('(جزيرة)', '(island)') : r.wall !== null ? L(`– حائط ${r.wall + 1}`, `– wall ${r.wall + 1}`) : ''}
                  </span>
                  <b>
                    {fmtCm(r.length)} × {fmtCm(r.depth)} cm
                  </b>
                </div>
              ))}
              {bom.backsplash.areaM2 > 0 && (
                <div className="kv">
                  <span>{L('تجليد الحائط', 'Backsplash')}</span>
                  <b>{bom.backsplash.areaM2.toFixed(2)} m²</b>
                </div>
              )}
            </div>
            <div className="card">
              <h3>{L('الإكسسوارات', 'Hardware')}</h3>
              {(
                [
                  [L('مفصلات', 'Hinges'), bom.hw.hinges, ''],
                  [L('مقابض', 'Handles'), bom.hw.handles, ''],
                  [L('بروفيل جولا', 'Gola profile'), bom.hw.golaCm / 100, 'm'],
                  [L('مجاري أدراج (زوج)', 'Drawer slides (pairs)'), bom.hw.slides, ''],
                  [L('أذرع قلاب (طقم)', 'Flap lifts (sets)'), bom.hw.flapLifts, ''],
                  [L('أرجل', 'Legs'), bom.hw.legs, ''],
                  [L('علّاقات الوحدات العلوية', 'Wall hangers'), bom.hw.hangers, ''],
                  [L('حوامل أرفف', 'Shelf pins'), bom.hw.shelfPins, ''],
                  [L('مسامير تجميع (تقديري)', 'Assembly screws (approx.)'), bom.hw.screws, ''],
                  [L('وزرة', 'Plinth'), bom.hw.plinthCm / 100, 'm'],
                  [L('إضاءة LED', 'LED strip'), bom.hw.ledCm / 100, 'm'],
                ] as [string, number, string][]
              )
                .filter(([, v]) => v > 0)
                .map(([k, v, u]) => (
                  <div className="kv" key={k}>
                    <span>{k}</span>
                    <b>
                      {u ? v.toFixed(2) : v} {u}
                    </b>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
      {sheet === 'prices' && <PriceSheet onClose={() => setSheet(null)} />}
      {sheet === 'rules' && <RulesSheet onClose={() => setSheet(null)} />}
    </div>
  );
}

function PriceSheet(props: { onClose: () => void }) {
  const prices = useStore((s) => s.project!.prices);
  const setPrices = useStore((s) => s.setPrices);
  const saveDefaults = useStore((s) => s.saveDefaults);
  const notify = useStore((s) => s.notify);
  const cur = prices.currency;
  const num = (label: string, key: keyof Prices, unit = cur) => <NumField key={key} label={label} value={prices[key] as number} min={0} max={10000000} step={10} digits={2} stepper={false} unit={unit} onChange={(v) => setPrices({ [key]: v } as Partial<Prices>)} />;
  return (
    <Sheet title={L('أسعار الخامات والخدمات', 'Material & service prices')} onClose={props.onClose}>
      <div className="card">
        <TextField label={L('العملة', 'Currency')} value={prices.currency} onChange={(currency) => setPrices({ currency })} />
      </div>
      <div className="card">
        <h3>{L('الألواح (سعر اللوح)', 'Boards (per sheet)')}</h3>
        <div className="grid2">
          {num(L('لوح الهيكل', 'Carcass sheet'), 'carcassSheet')}
          {num(L('لوح الظهر HDF', 'HDF back sheet'), 'backSheet')}
        </div>
      </div>
      <div className="card">
        <h3>{L('الضلف (سعر المتر المربع)', 'Fronts (per m²)')}</h3>
        <div className="grid2">
          {DOOR_TYPES.map((t) => (
            <NumField key={t.id} label={LT(t.name)} value={prices.front[t.id]} min={0} max={1000000} step={50} stepper={false} unit={cur} onChange={(v) => setPrices({ front: { ...prices.front, [t.id]: v } })} />
          ))}
        </div>
      </div>
      <div className="card">
        <h3>{L('أسطح العمل (سعر المتر الطولي)', 'Countertops (per linear metre)')}</h3>
        <div className="grid2">
          {COUNTERTOP_TYPES.map((t) => (
            <NumField key={t.id} label={LT(t.name)} value={prices.countertop[t.id]} min={0} max={1000000} step={50} stepper={false} unit={cur} onChange={(v) => setPrices({ countertop: { ...prices.countertop, [t.id]: v } })} />
          ))}
          {num(L('تجليد الحائط (م²)', 'Backsplash (m²)'), 'backsplash')}
        </div>
      </div>
      <div className="card">
        <h3>{L('الإكسسوارات', 'Hardware')}</h3>
        <div className="grid2">
          {num(L('مفصلة', 'Hinge'), 'hinge')}
          {num(L('مقبض', 'Handle'), 'handle')}
          {num(L('مجرى درج (زوج)', 'Drawer slide (pair)'), 'slide')}
          {num(L('ذراع قلاب (طقم)', 'Flap lift (set)'), 'flapLift')}
          {num(L('رجل', 'Leg'), 'leg')}
          {num(L('علّاقة علوية', 'Wall hanger'), 'hanger')}
          {num(L('حامل رف', 'Shelf pin'), 'shelfPin')}
          {num(L('شريط الحرف (م)', 'Edge banding (m)'), 'edge')}
          {num(L('وزرة (م)', 'Plinth (m)'), 'plinth')}
          {num(L('إضاءة LED (م)', 'LED strip (m)'), 'led')}
          {num(L('بروفيل جولا (م)', 'Gola profile (m)'), 'gola')}
          {num(L('حوض + خلاط', 'Sink + mixer'), 'sinkSet')}
        </div>
      </div>
      <div className="card">
        <h3>{L('المصنعيات والخدمات', 'Labour & services')}</h3>
        <div className="grid2">
          {num(L('مصنعية المتر الطولي', 'Labour per linear metre'), 'laborPerM')}
          {num(L('التركيب', 'Installation'), 'install')}
          {num(L('النقل', 'Transport'), 'transport')}
          {num(L('هامش الربح', 'Profit margin'), 'margin', '%')}
          {num(L('الضريبة', 'Tax'), 'tax', '%')}
        </div>
      </div>
      <button
        className="btn soft block"
        style={{ marginTop: 14 }}
        onClick={async () => {
          await saveDefaults();
          notify(L('ستُستخدم هذه الأسعار والقواعد في المشاريع الجديدة', 'These prices and rules will be used for new projects'));
        }}
      >
        {L('حفظ كأسعار افتراضية للمشاريع الجديدة', 'Save as defaults for new projects')}
      </button>
    </Sheet>
  );
}

function RulesSheet(props: { onClose: () => void }) {
  const rules = useStore((s) => s.project!.rules);
  const setRules = useStore((s) => s.setRules);
  const mm = L('مم', 'mm');
  const num = (label: string, key: keyof Rules, min: number, max: number, unit = mm) => <NumField key={key} label={label} value={rules[key]} min={min} max={max} step={1} stepper={false} unit={unit} onChange={(v) => setRules({ [key]: v } as Partial<Rules>)} />;
  return (
    <Sheet title={L('قواعد التصنيع', 'Manufacturing rules')} onClose={props.onClose}>
      <p className="small muted" style={{ marginBottom: 8 }}>
        {L('تُستخدم هذه القيم في حساب مقاسات القطع وقائمة القص وتوزيعها على الألواح.', 'These values drive part sizes, the cut list and the sheet layout.')}
      </p>
      <div className="card">
        <h3>{L('السماكات', 'Thicknesses')}</h3>
        <div className="grid2">
          {num(L('سمك لوح الهيكل', 'Carcass board'), 'boardT', 12, 25)}
          {num(L('سمك الضلفة', 'Front board'), 'frontT', 12, 30)}
          {num(L('سمك الظهر', 'Back panel'), 'backT', 2, 18)}
          {num(L('سمك صندوق الدرج', 'Drawer box board'), 'drawerT', 10, 20)}
        </div>
      </div>
      <div className="card">
        <h3>{L('الخلوصات', 'Clearances')}</h3>
        <div className="grid2">
          {num(L('الفاصل بين الضلف', 'Gap between fronts'), 'gap', 1, 6)}
          {num(L('ارتفاع الوزرة', 'Plinth height'), 'plinthH', 50, 200)}
          {num(L('ارتداد الرف عن الواجهة', 'Shelf setback'), 'shelfSetback', 0, 80)}
          {num(L('عرض العارضة العلوية', 'Top rail width'), 'stretcherW', 60, 150)}
          {num(L('خلوص مجاري الدرج', 'Drawer slide clearance'), 'slideClear', 10, 50)}
          {num(L('هالك شريط الحرف', 'Edge banding waste'), 'edgeWaste', 0, 40, '%')}
        </div>
      </div>
      <div className="card">
        <h3>{L('اللوح الخام', 'Raw sheet')}</h3>
        <div className="grid3">
          {num(L('الطول', 'Length'), 'sheetL', 1000, 4200)}
          {num(L('العرض', 'Width'), 'sheetW', 600, 2200)}
          {num(L('سمك المنشار', 'Saw kerf'), 'kerf', 0, 10)}
        </div>
      </div>
    </Sheet>
  );
}
