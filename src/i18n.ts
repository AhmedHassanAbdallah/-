import type { Lang, LText } from './types';

let current: Lang = 'ar';

export function setLang(lang: Lang) {
  current = lang;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }
}

export function getLang(): Lang {
  return current;
}

export function isRTL(): boolean {
  return current === 'ar';
}

/** Inline bilingual string: L('وحدات', 'Units') */
export function L(ar: string, en: string): string {
  return current === 'ar' ? ar : en;
}

/** Pick from an {ar,en} object. */
export function LT(t: LText | undefined | null): string {
  if (!t) return '';
  return current === 'ar' ? t.ar : t.en;
}

export function fmtNum(n: number, digits = 0): string {
  if (!isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** cm value shown without trailing zeros: 60 → "60", 60.5 → "60.5" */
export function fmtCm(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function fmtDate(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString(current === 'ar' ? 'ar-EG' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return new Date(ts).toDateString();
  }
}
