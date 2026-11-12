import { useState } from 'react';
import { L } from '../i18n';
import { bounds, lRoom, rectRoom, uRoom } from '../lib/geometry';
import { useStore } from '../store';
import type { Vec2 } from '../types';
import { NumField, Seg, Sheet, TextField } from './components';

type Shape = 'rect' | 'L' | 'U';

export function NewProject(props: { onClose: () => void }) {
  const createProject = useStore((s) => s.createProject);
  const count = useStore((s) => s.metas.length);
  const [name, setName] = useState(L(`مطبخ ${count + 1}`, `Kitchen ${count + 1}`));
  const [shape, setShape] = useState<Shape>('rect');
  const [w, setW] = useState(400);
  const [d, setD] = useState(300);
  const [h, setH] = useState(280);
  const [cw, setCw] = useState(150);
  const [cd, setCd] = useState(120);
  const cm = L('سم', 'cm');

  const ncw = Math.min(cw, w - 60);
  const ncd = Math.min(cd, d - 60);
  const points: Vec2[] = shape === 'rect' ? rectRoom(w, d) : shape === 'L' ? lRoom(w, d, ncw, ncd) : uRoom(w, d, ncw, ncd);
  const b = bounds(points);
  const s = Math.min(220 / b.w, 130 / b.h);

  return (
    <Sheet title={L('مشروع جديد', 'New project')} onClose={props.onClose}>
      <div className="card">
        <TextField label={L('اسم المشروع', 'Project name')} value={name} onChange={setName} />
      </div>
      <div className="card">
        <h3>{L('شكل ومقاسات الغرفة', 'Room shape & size')}</h3>
        <Seg
          block
          value={shape}
          onChange={setShape}
          options={[
            { id: 'rect', label: L('مستطيل', 'Rectangle') },
            { id: 'L', label: L('حرف L', 'L-shape') },
            { id: 'U', label: L('ببروز', 'With recess') },
          ]}
        />
        <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 6px' }}>
          <svg width={250} height={160} viewBox={`-15 -15 250 160`}>
            <g transform={`translate(${(220 - b.w * s) / 2} ${(130 - b.h * s) / 2})`}>
              <polygon points={points.map((p) => `${p.x * s},${p.y * s}`).join(' ')} fill="#fbfaf7" stroke="#3b4450" strokeWidth={5} strokeLinejoin="miter" />
              <text x={(b.w * s) / 2} y={-6} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0f766e" style={{ direction: 'ltr' }}>
                {w}
              </text>
              <text x={-8} y={(b.h * s) / 2} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0f766e" transform={`rotate(-90 -8 ${(b.h * s) / 2})`} style={{ direction: 'ltr' }}>
                {d}
              </text>
            </g>
          </svg>
        </div>
        <div className="grid3">
          <NumField label={L('العرض', 'Width')} value={w} min={120} max={1500} step={10} unit={cm} stepper={false} onChange={setW} />
          <NumField label={L('العمق', 'Depth')} value={d} min={120} max={1500} step={10} unit={cm} stepper={false} onChange={setD} />
          <NumField label={L('الارتفاع', 'Height')} value={h} min={200} max={500} step={5} unit={cm} stepper={false} onChange={setH} />
        </div>
        {shape !== 'rect' && (
          <div className="grid2" style={{ marginTop: 10 }}>
            <NumField label={L('عرض الجزء المقتطع', 'Cut-out width')} value={ncw} min={30} max={w - 60} step={10} unit={cm} stepper={false} onChange={setCw} />
            <NumField label={L('عمق الجزء المقتطع', 'Cut-out depth')} value={ncd} min={30} max={d - 60} step={10} unit={cm} stepper={false} onChange={setCd} />
          </div>
        )}
        <p className="small muted" style={{ marginTop: 10 }}>
          {L('يمكنك بعد الإنشاء سحب الأركان، وتقسيم الحوائط لأي شكل، وإضافة الأبواب والشبابيك والأعمدة ومصادر المياه والكهرباء والغاز.', 'After creating it you can drag corners, split walls into any shape, and add doors, windows, columns and service points.')}
        </p>
      </div>
      <button
        className="btn primary block"
        style={{ marginTop: 14 }}
        onClick={async () => {
          await createProject(name.trim() || L('مطبخ', 'Kitchen'), points, h);
          props.onClose();
        }}
      >
        {L('إنشاء المشروع', 'Create project')}
      </button>
    </Sheet>
  );
}
