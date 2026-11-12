/**
 * Regenerates the launcher / PWA icons from public/icon.svg.
 * Dev tool only: needs Playwright with a Chromium build (`npx playwright install chromium`).
 *   node scripts/make-icons.cjs
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'public/icon.svg'), 'utf8');
// the artwork without the rounded background, for the adaptive-icon foreground layer
const glyph = svg.replace(/<rect width="512" height="512" rx="112" fill="url\(#g\)"\/>/, '');
if (glyph === svg) throw new Error('background rect not found in icon.svg');

const res = path.join(root, 'android/app/src/main/res');
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const shot = async (html, size, file) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${html}</body></html>`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  };
  const full = (size) => `<div style="width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div>`;
  const round = (size) => `<div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;background:linear-gradient(135deg,#0f172a,#115e59)">${glyph.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div>`;
  // adaptive foreground: artwork scaled into the 66/108 safe zone
  const fg = (size) => {
    const inner = Math.round(size * 0.66);
    const off = Math.round((size - inner) / 2);
    return `<div style="width:${size}px;height:${size}px;position:relative">${glyph.replace('<svg ', `<svg width="${inner}" height="${inner}" style="position:absolute;left:${off}px;top:${off}px" `)}</div>`;
  };
  for (const [name, k] of Object.entries(densities)) {
    const dir = path.join(res, `mipmap-${name}`);
    await shot(full(48 * k), 48 * k, path.join(dir, 'ic_launcher.png'));
    await shot(round(48 * k), 48 * k, path.join(dir, 'ic_launcher_round.png'));
    await shot(fg(108 * k), 108 * k, path.join(dir, 'ic_launcher_foreground.png'));
  }
  await shot(full(192), 192, path.join(root, 'public/icon-192.png'));
  // maskable: full-bleed background with the artwork in the safe zone
  await shot(`<div style="width:512px;height:512px;background:linear-gradient(135deg,#0f172a,#115e59);position:relative">${glyph.replace('<svg ', '<svg width="400" height="400" style="position:absolute;left:56px;top:56px" ')}</div>`, 512, path.join(root, 'public/icon-512.png'));
  await browser.close();
  console.log('icons written');
})();
