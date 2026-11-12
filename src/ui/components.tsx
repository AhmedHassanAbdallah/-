import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { L } from '../i18n';
import { useStore } from '../store';

// ---------- Sheet ----------
export function Sheet(props: { title: ReactNode; onClose: () => void; children: ReactNode; half?: boolean; clear?: boolean; actions?: ReactNode }) {
  return (
    <div className={'overlay' + (props.clear ? ' clear' : '')} onPointerDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div className={'sheet' + (props.half ? ' half' : '')} role="dialog">
        <div className="sheet-head">
          <h2>{props.title}</h2>
          {props.actions}
          <button className="iconbtn" onClick={props.onClose} aria-label={L('إغلاق', 'Close')}>
            <X size={22} />
          </button>
        </div>
        <div className="sheet-body">{props.children}</div>
      </div>
    </div>
  );
}

// ---------- Number field ----------
export function NumField(props: {
  label?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  stepper?: boolean;
  digits?: number;
}) {
  const { value, min = -Infinity, max = Infinity, step = 1, digits = 1 } = props;
  const fmt = (v: number) => {
    const r = Math.round(v * 10 ** digits) / 10 ** digits;
    return String(r);
  };
  const [text, setText] = useState(fmt(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const commit = (raw: string) => {
    const v = parseFloat(raw.replace(',', '.').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
    if (!isFinite(v)) {
      setText(fmt(value));
      return;
    }
    const c = Math.max(min, Math.min(max, v));
    setText(fmt(c));
    if (c !== value) props.onChange(c);
  };
  const bump = (dir: number) => {
    const c = Math.max(min, Math.min(max, Math.round((value + dir * step) * 100) / 100));
    setText(fmt(c));
    if (c !== value) props.onChange(c);
  };
  const body = (
    <div className="numfield">
      {props.stepper !== false && (
        <button type="button" onClick={() => bump(-1)} aria-label="-">
          −
        </button>
      )}
      <input
        inputMode="decimal"
        value={text}
        onFocus={(e) => {
          focused.current = true;
          e.currentTarget.select();
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => {
          focused.current = false;
          commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      {props.unit && <span className="unit">{props.unit}</span>}
      {props.stepper !== false && (
        <button type="button" onClick={() => bump(1)} aria-label="+">
          +
        </button>
      )}
    </div>
  );
  if (!props.label) return body;
  return (
    <label className="field">
      <span className="lbl">{props.label}</span>
      {body}
    </label>
  );
}

export function TextField(props: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <label className="field">
      {props.label && <span className="lbl">{props.label}</span>}
      <input className="input" value={props.value} placeholder={props.placeholder} autoFocus={props.autoFocus} onChange={(e) => props.onChange(e.target.value)} />
    </label>
  );
}

// ---------- Segmented control ----------
export function Seg<T extends string>(props: { value: T; onChange: (v: T) => void; options: { id: T; label: ReactNode }[]; block?: boolean }) {
  return (
    <div className={'seg' + (props.block ? ' block' : '')}>
      {props.options.map((o) => (
        <button key={o.id} type="button" className={o.id === props.value ? 'active' : ''} onClick={() => props.onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle(props: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button type="button" className={'toggle' + (props.on ? ' on' : '')} onClick={() => props.onChange(!props.on)} aria-pressed={props.on} aria-label={props.label} />;
}

export function ToggleRow(props: { label: ReactNode; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="row" style={{ padding: '6px 0' }}>
      <div className="grow">
        <div style={{ fontWeight: 600 }}>{props.label}</div>
        {props.hint && <div className="small muted">{props.hint}</div>}
      </div>
      <Toggle on={props.on} onChange={props.onChange} />
    </div>
  );
}

export function Swatch(props: { color?: string; image?: string; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={'swatch' + (props.active ? ' active' : '')} onClick={props.onClick}>
      <span className="dot" style={{ backgroundColor: props.color, backgroundImage: props.image ? `url(${props.image})` : undefined }} />
      {props.label}
    </button>
  );
}

// ---------- Promise-based dialogs ----------
type DialogReq =
  | { kind: 'confirm'; title: string; message?: string; danger?: boolean; ok?: string; resolve: (v: boolean) => void }
  | { kind: 'prompt'; title: string; initial: string; placeholder?: string; resolve: (v: string | null) => void };

let pushDialog: ((d: DialogReq) => void) | null = null;

export const ask = {
  confirm(title: string, message?: string, opts?: { danger?: boolean; ok?: string }): Promise<boolean> {
    return new Promise((resolve) => {
      if (!pushDialog) return resolve(window.confirm(title));
      pushDialog({ kind: 'confirm', title, message, danger: opts?.danger, ok: opts?.ok, resolve });
    });
  },
  prompt(title: string, initial = '', placeholder?: string): Promise<string | null> {
    return new Promise((resolve) => {
      if (!pushDialog) return resolve(window.prompt(title, initial));
      pushDialog({ kind: 'prompt', title, initial, placeholder, resolve });
    });
  },
};

export function DialogHost() {
  const [req, setReq] = useState<DialogReq | null>(null);
  const [text, setText] = useState('');
  useEffect(() => {
    pushDialog = (d) => {
      setReq(d);
      if (d.kind === 'prompt') setText(d.initial);
    };
    return () => {
      pushDialog = null;
    };
  }, []);
  if (!req) return null;
  const close = (ok: boolean) => {
    if (req.kind === 'confirm') req.resolve(ok);
    else req.resolve(ok ? text.trim() : null);
    setReq(null);
  };
  return (
    <div className="overlay" style={{ alignItems: 'center', zIndex: 70 }} onPointerDown={(e) => e.target === e.currentTarget && close(false)}>
      <form
        className="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          close(true);
        }}
      >
        <h2>{req.title}</h2>
        {req.kind === 'confirm' && req.message && <p className="muted small">{req.message}</p>}
        {req.kind === 'prompt' && <input className="input" autoFocus value={text} placeholder={req.placeholder} onChange={(e) => setText(e.target.value)} />}
        <div className="row" style={{ marginTop: 16 }}>
          <button type="button" className="btn ghost grow" onClick={() => close(false)}>
            {L('إلغاء', 'Cancel')}
          </button>
          <button type="submit" className={'btn grow ' + (req.kind === 'confirm' && req.danger ? 'danger' : 'primary')}>
            {req.kind === 'confirm' ? (req.ok ?? L('تأكيد', 'Confirm')) : L('حفظ', 'Save')}
          </button>
        </div>
      </form>
    </div>
  );
}

export function Toast() {
  const toast = useStore((s) => s.toast);
  if (!toast) return null;
  return <div className="toast">{toast.msg}</div>;
}

export function Busy(props: { text: string }) {
  return (
    <div className="busy">
      <div className="box">
        <div className="spinner" />
        {props.text}
      </div>
    </div>
  );
}
