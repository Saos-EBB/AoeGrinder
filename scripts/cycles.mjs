// Import-Kreise messen (ARCH-01): Laufzeit-Imports ab den Einstiegen src/main.ts und src/vfxLab.ts,
// stark zusammenhängende Komponenten (Tarjan), größte SCC und Zahl der Module in Kreisen.
// Ohne Pakete: eigener kleiner Import-Parser (TypeScript 7 hat keine JS-Compiler-API mehr).
// Zählt: import … from, import '…', export … from, import('…'). Nicht: import type / export type, import { type A, type B }.
// Grenze: Module, die nur als Typ gebraucht werden, aber ohne `type` importiert sind, zählen mit (Vite wirft sie weg), der Wert ist also eher zu hoch.
// Zwei Zählweisen je Einstieg: „statisch“ (ohne import(), so hat das Audit gezählt; das ist die Lade-Reihenfolge)
// und „mit import()“ (dynamische Imports als Kante; arena.ts → import('../boss') zieht boss/bosses/mapgen/world mit in den Kreis).
//
//   npm run check:cycles               Ausgabe + Grenzen prüfen (exit 1, wenn eine Zahl über LIMIT liegt)
//   node scripts/cycles.mjs --list     zusätzlich alle Module der Kreise
//   node scripts/cycles.mjs --max=60   eigene Grenze für die größte SCC (beide Zählweisen)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const ENTRIES = ['main.ts', 'vfxLab.ts'];
// Ausgangswert 11.11.2026 (Audit, E4): statisch Kreise 88/4/2 (94 Module in Kreisen), mit import() 102/2 (104).
// Nach E6 (hooks.ts, feedback.ts, spells/stats.ts, arena ohne import()): beide 84/4/2 (90).
// Nach E10 Schritt 4 (Logik → UI über hooks.ui, ui/connect.ts; mount() für Fenster-Listener): beide 65/6/4/2 (77), die Fenster bilden einen eigenen 6er-Kreis.
// Nach E10 Schritt 5 (ARCH-11: models/heroModel.ts ohne weaponRolls/realMen, fx/frostFx.ts ohne heroModel): beide 53/6/4/3/2 (68).
// Darf nur sinken; nach jedem Umbau, der Kreise auflöst, hier nachziehen.
const LIMIT = { static: { largest: 53, inCycles: 68 }, dynamic: { largest: 53, inCycles: 68 } };
let NO_DYN = false;

// Kommentare entfernen, Strings behalten (Regex-Literale grob erkannt, damit // darin nicht als Kommentar gilt)
function stripComments(src) {
  let out = '', i = 0, prev = '';
  const n = src.length;
  const regexAllowed = () => !prev || /[(,=:[!&|?{};+\-*%<>~^]$/.test(prev) || /\b(return|typeof|case|in|of|void|delete|new|throw|else|do)$/.test(prev);
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; out += ' '; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n && src[j] !== c) { if (src[j] === '\\') j++; j++; }
      out += src.slice(i, j + 1); prev = c; i = j + 1; continue;
    }
    if (c === '/' && regexAllowed()) {
      let j = i + 1, cls = false;
      while (j < n && src[j] !== '\n') {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; else if (src[j] === '/' && !cls) break;
        j++;
      }
      out += src.slice(i, j + 1); prev = '/'; i = j + 1; continue;
    }
    out += c;
    if (!/\s/.test(c)) prev = (/\w/.test(c) && /\w$/.test(prev) ? prev : '') + c;
    if (prev.length > 20) prev = prev.slice(-20);
    i++;
  }
  return out;
}

function importsOf(code) {
  const out = [];
  const onlyTypes = (clause) => {
    const b = clause.match(/^\{([^}]*)\}$/);
    if (!b) return false;
    const names = b[1].split(',').map(s => s.trim()).filter(Boolean);
    return names.length > 0 && names.every(s => /^type\s/.test(s));                // import { type A, type B }
  };
  const S = /(?:^|[;\n}])\s*/.source;
  // import X from '…' · import { … } from '…' · import * as X from '…' · import type … (übersprungen)
  for (const m of code.matchAll(new RegExp(S + /import\s+(type\s+)?([\w$]+\s*,\s*)?(\{[^}]*\}|\*\s*as\s+[\w$]+|[\w$]+)\s*from\s*(['"])([^'"]+)\4/.source, 'g'))) {
    if (m[1] && m[3] !== 'from') continue;
    if (!m[2] && onlyTypes(m[3].trim())) continue;
    out.push(m[5]);
  }
  // import '…' (Seiteneffekt)
  for (const m of code.matchAll(new RegExp(S + /import\s*(['"])([^'"]+)\1/.source, 'g'))) out.push(m[2]);
  // export * from '…' · export { … } from '…' · export type { … } from '…' (übersprungen)
  for (const m of code.matchAll(new RegExp(S + /export\s+(type\s+)?(\*(?:\s*as\s+[\w$]+)?|\{[^}]*\})\s*from\s*(['"])([^'"]+)\3/.source, 'g'))) {
    if (m[1] || onlyTypes(m[2].trim())) continue;
    out.push(m[4]);
  }
  // import('…') (dynamisch)
  if (!NO_DYN) for (const m of code.matchAll(/\bimport\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g)) out.push(m[2]);
  return out;
}

const EXT = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.js'];
function resolve(from, spec) {
  if (!spec.startsWith('.')) return null;                                          // Pakete (three …) zählen nicht
  const base = path.resolve(path.dirname(from), spec);
  for (const e of EXT) {
    const p = base + e;
    if (fs.existsSync(p) && fs.statSync(p).isFile() && /\.(ts|tsx|js|mjs)$/.test(p)) return p;
  }
  const ts = base.replace(/\.js$/, '.ts');
  if (ts !== base && fs.existsSync(ts)) return ts;
  return null;                                                                     // CSS, Bilder, ?raw …
}

const graph = new Map();
function walk(file) {
  if (graph.has(file)) return;
  const deps = [];
  graph.set(file, deps);
  for (const spec of importsOf(stripComments(fs.readFileSync(file, 'utf8')))) {
    const r = resolve(file, spec.split('?')[0]);
    if (r && !deps.includes(r)) deps.push(r);
  }
  for (const d of deps) walk(d);
}

// Tarjan, iterativ (tiefe Ketten sprengen sonst den Stack nicht, aber sicher ist sicher)
function tarjan(g) {
  let idx = 0;
  const index = new Map(), low = new Map(), on = new Set(), stack = [], comps = [];
  for (const start of g.keys()) {
    if (index.has(start)) continue;
    const work = [[start, 0]];
    index.set(start, idx); low.set(start, idx); idx++; stack.push(start); on.add(start);
    while (work.length) {
      const top = work[work.length - 1], [v, k] = top, deps = g.get(v);
      if (k < deps.length) {
        top[1]++;
        const w = deps[k];
        if (!index.has(w)) { index.set(w, idx); low.set(w, idx); idx++; stack.push(w); on.add(w); work.push([w, 0]); }
        else if (on.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
      } else {
        work.pop();
        if (work.length) { const u = work[work.length - 1][0]; low.set(u, Math.min(low.get(u), low.get(v))); }
        if (low.get(v) === index.get(v)) {
          const comp = [];
          let w;
          do { w = stack.pop(); on.delete(w); comp.push(w); } while (w !== v);
          comps.push(comp);
        }
      }
    }
  }
  return comps;
}

const name = f => path.relative(SRC, f).replace(/\.ts$/, '');
const args = process.argv.slice(2);
const maxArg = args.find(a => a.startsWith('--max='));

let fail = false;
for (const entry of ENTRIES) for (const mode of ['static', 'dynamic']) {
  NO_DYN = mode === 'static';
  graph.clear();
  walk(path.join(SRC, entry));
  const cyc = tarjan(graph).filter(c => c.length > 1 || graph.get(c[0]).includes(c[0])).sort((a, b) => b.length - a.length);
  const sizes = cyc.map(c => c.length);
  const inCycles = sizes.reduce((a, b) => a + b, 0);
  const largest = sizes[0] ?? 0;
  const lim = maxArg ? { largest: Number(maxArg.slice(6)), inCycles: Infinity } : LIMIT[mode];
  console.log(`${entry} ${NO_DYN ? 'statisch    ' : 'mit import()'}: ${graph.size} Module, Kreise ${sizes.join('/') || '0'}, größte SCC ${largest} (Grenze ${lim.largest}), in Kreisen ${inCycles}`);
  if (args.includes('--list')) for (const c of cyc) console.log(`  [${c.length}] ${c.map(name).sort().join(', ')}`);
  if (largest > lim.largest) { console.error(`  ✗ größte SCC ${largest} > Grenze ${lim.largest}`); fail = true; }
  if (inCycles > lim.inCycles) { console.error(`  ✗ in Kreisen ${inCycles} > Grenze ${lim.inCycles}`); fail = true; }
}
process.exit(fail ? 1 : 0);
