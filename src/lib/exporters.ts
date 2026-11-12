import { Capacitor } from '@capacitor/core';
import type { Project } from '../types';

/** File output that works both in a browser (download) and inside the Android app (share sheet). */
export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream';
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1] ?? '');
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

export function safeName(name: string): string {
  return (name || 'kitchen').replace(/[\\/:*?"<>|\n\r\t]+/g, ' ').trim().replace(/\s+/g, '_').slice(0, 60) || 'kitchen';
}

/** Save or share a file. Returns how it was delivered. */
export async function saveBlob(blob: Blob, filename: string): Promise<'shared' | 'downloaded'> {
  if (isNative()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const data = await blobToBase64(blob);
    const res = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache, recursive: true });
    try {
      await Share.share({ title: filename, url: res.uri, dialogTitle: filename });
    } catch (e) {
      // the user closing the share sheet is not an error
      if (!/cancel/i.test(String((e as Error)?.message ?? e))) throw e;
    }
    return 'shared';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 4000);
  return 'downloaded';
}

export function saveText(text: string, filename: string, mime = 'text/plain;charset=utf-8'): Promise<'shared' | 'downloaded'> {
  return saveBlob(new Blob([text], { type: mime }), filename);
}

export function projectToJson(p: Project): string {
  return JSON.stringify({ kitchenStudio: 1, exportedAt: new Date().toISOString(), project: p }, null, 1);
}

export function toCsv(rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  // BOM so spreadsheet apps read the Arabic text as UTF-8
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    document.body.appendChild(input);
    let done = false;
    const finish = (f: File | null) => {
      if (done) return;
      done = true;
      input.remove();
      resolve(f);
    };
    input.onchange = () => finish(input.files?.[0] ?? null);
    input.addEventListener('cancel', () => finish(null));
    input.click();
  });
}
