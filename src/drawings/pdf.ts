import type { Project } from '../types';
import { PAGE_H, PAGE_W } from './kit';
import { renderSheet, type SheetSpec } from './sheets';

/** Rasterise every sheet and assemble an A4-landscape PDF. */
export async function exportPdf(p: Project, specs: SheetSpec[], onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  for (let i = 0; i < specs.length; i++) {
    const canvas = renderSheet(specs[i], i, specs.length, p, 6.5);
    const data = canvas.toDataURL('image/jpeg', 0.86);
    if (i > 0) doc.addPage('a4', 'landscape');
    doc.addImage(data, 'JPEG', 0, 0, PAGE_W, PAGE_H, undefined, 'FAST');
    canvas.width = canvas.height = 0;
    onProgress?.(i + 1, specs.length);
    // let the UI breathe between pages
    await new Promise((r) => setTimeout(r, 0));
  }
  doc.setProperties({ title: p.name, creator: 'Kitchen Studio' });
  return doc.output('blob');
}
