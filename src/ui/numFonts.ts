// Zahlen-Schriften (alle CC0, src/assets/fonts/num/README.md). Einstellung numFont: leer = Schrift des Zahlen-Stils, sonst diese Schrift.
// Farben, Kontur und Kasten bleiben beim Zahlen-Stil, nur die Schrift wechselt.

import { uiSettings } from './uiSettings';

const FILES = import.meta.glob('../assets/fonts/num/*.woff', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const NUM_FONTS: [string, string, string][] = [   // id, Name, Datei
  ['digit7', 'Digit Tech 7', 'DigitTech7-Regular'], ['matrix', 'MatrixType', 'MatrixTypeDisplay-Bold'], ['jupiteroid', 'Jupiteroid', 'Jupiteroid-Bold'],
  ['homevideo', 'Home Video', 'HomeVideo-Bold'], ['rainbow', 'Rainbow 2000', 'Rainbow2000-Bold'], ['napalm', 'Operation Napalm', 'OperationNapalm-Regular'],
  ['publicpixel', 'Public Pixel', 'PublicPixel'], ['drybrush', 'Drybrush', 'Drybrush'], ['stampcraft', 'Stampcraft', 'Stampcraft-Regular'],
  ['crayon', 'Crayon Libre', 'CrayonLibre-Regular'], ['skyte', 'Skyte', 'Skyte-Regular'], ['zerove', 'Zerove', 'Zerove-Regular'],
  ['kfuture', 'Kenney Future', 'kenvector_future'], ['kblocks', 'Kenney Blocks', 'kenpixel_blocks'], ['khigh', 'Kenney High', 'kenpixel_high'],
];
export const numFontFamily = (id: string) => `NumFont-${id}`;

const style = document.createElement('style');
style.textContent = NUM_FONTS.map(([id, , file]) => {
  const url = FILES[`../assets/fonts/num/${file}.woff`];
  return url ? `@font-face { font-family: '${numFontFamily(id)}'; src: url(${url}) format('woff'); font-display: swap; }` : '';
}).join('\n') + `
body.numFont .ct.num, body.numFont .ct.num .mx { font-family: var(--num-font) !important; font-weight: 400 !important; font-style: normal; }`;
document.head.appendChild(style);

function apply() {
  const on = !!uiSettings.numFont && NUM_FONTS.some(([id]) => id === uiSettings.numFont);
  document.body.classList.toggle('numFont', on);
  if (on) document.body.style.setProperty('--num-font', `'${numFontFamily(uiSettings.numFont)}', sans-serif`);
}
apply();
addEventListener('uisettings', apply);
