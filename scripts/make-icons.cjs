// Renders the FAHDAR geometric mark to the PNG assets Expo needs.
// Usage: NODE_PATH=$(npm root -g) node scripts/make-icons.cjs   (uses the preinstalled Playwright Chromium)
const { chromium } = require('playwright');
const { mkdirSync } = require('node:fs');

const mark = (fill = true, mono = false) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16305F"/><stop offset="1" stop-color="#2C56D6"/></linearGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6B91F7"/><stop offset="1" stop-color="#0A1630"/></linearGradient>
  </defs>
  ${mono ? `
  <path d="M50 3 L91 26.5 L91 73.5 L50 97 L9 73.5 L9 26.5 Z M34 27 V73 H45 V55.5 H57 V45.5 H45 V38 H67 V27 Z" fill="#fff" fill-rule="evenodd"/>
  ` : `
  ${fill ? '<path d="M50 3 L91 26.5 L91 73.5 L50 97 L9 73.5 L9 26.5 Z" fill="url(#edge)"/>' : ''}
  <path d="M50 8 L86.5 29 L86.5 71 L50 92 L13.5 71 L13.5 29 Z" fill="url(#bg)"/>
  <rect x="34" y="27" width="11" height="46" rx="2.5" fill="#fff"/>
  <rect x="34" y="27" width="33" height="11" rx="2.5" fill="#fff"/>
  <rect x="34" y="45.5" width="23" height="10" rx="2.5" fill="#A9C0FB"/>
  <circle cx="64.5" cy="66" r="5.5" fill="#6B91F7"/><circle cx="64.5" cy="66" r="2.4" fill="#fff"/>`}
</svg>`;

const page = (inner, { bg = 'transparent', pad = 0.18 } = {}) => `<!doctype html><html><body style="margin:0;background:${bg}">
<div style="width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;background:${bg}">
<div style="width:${(1 - pad * 2) * 100}vw;height:${(1 - pad * 2) * 100}vh">${inner}</div></div></body></html>`;

const targets = [
  ['assets/icon.png', 1024, page(mark(), { bg: 'radial-gradient(circle at 30% 20%, #16305F, #050C1A 75%)', pad: 0.14 })],
  ['assets/android-icon-foreground.png', 1024, page(mark(), { pad: 0.27 })],
  ['assets/android-icon-background.png', 1024, page('', { bg: 'linear-gradient(135deg, #0A1630, #050C1A)' })],
  ['assets/android-icon-monochrome.png', 1024, page(mark(true, true), { pad: 0.27 })],
  ['assets/splash-icon.png', 1024, page(mark(), { pad: 0.1 })],
  ['assets/favicon.png', 96, page(mark(), { pad: 0.02 })],
  ['assets/notification-icon.png', 96, page(mark(true, true), { pad: 0.06 })],
];

(async () => {
mkdirSync('assets', { recursive: true });
const browser = await chromium.launch();
for (const [file, size, html] of targets) {
  const p = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await p.setContent(html);
  await p.screenshot({ path: file, omitBackground: true });
  await p.close();
  console.log('wrote', file);
}
await browser.close();
})();
