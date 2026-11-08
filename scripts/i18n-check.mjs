// Prüft die Wörterbücher: gleiche Keys in DE und EN, jeder im Code benutzte Key existiert, @{key}-Verweise zeigen auf echte Keys,
// Platzhalter {x} sind in beiden Sprachen gleich. Aufruf: npm run check:i18n (Exit-Code 1 bei Fehlern)
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const dict = f => Object.fromEntries([...read(f).matchAll(/^\s*'([^']+)': (".*"),$/gm)].map(m => [m[1], JSON.parse(m[2])]));
const de = dict('src/i18n/de.ts'), en = dict('src/i18n/en.ts');
const errors = [];

for (const k of Object.keys(de)) if (!(k in en)) errors.push(`fehlt in EN: ${k}`);
for (const k of Object.keys(en)) if (!(k in de)) errors.push(`fehlt in DE: ${k}`);

const files = [];
const walk = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.ts')) files.push(p); } };
walk(path.join(root, 'src'));
const used = new Set();
for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(/(?<![\w.$])t\('([\w.\-]+)'/g)) used.add(m[1]);
for (const m of read('index.html').matchAll(/data-i18n(?:-\w+)?="([\w.\-]+)"/g)) used.add(m[1]);
for (const k of used) if (!(k in de)) errors.push(`im Code benutzt, fehlt im Wörterbuch: ${k}`);

const vars = s => [...s.matchAll(/(?<!@)\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
for (const [name, d] of [['DE', de], ['EN', en]]) for (const [k, v] of Object.entries(d)) {
  for (const m of v.matchAll(/@\{([\w.\-]+)\}/g)) if (!(m[1] in d) && !(m[1] in de)) errors.push(`${name} ${k}: Verweis auf fehlenden Key ${m[1]}`);
}
for (const k of Object.keys(de)) if (k in en && vars(de[k]) !== vars(en[k])) errors.push(`Platzhalter unterschiedlich in ${k}: DE {${vars(de[k])}} EN {${vars(en[k])}}`);

console.log(`${Object.keys(de).length} Keys DE, ${Object.keys(en).length} EN, ${used.size} im Code`);
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
console.log('i18n ok');
