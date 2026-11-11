// noImplicitAny nur für schon saubere Dateien (KOMP-02). Global bleibt strict: false (tsconfig.json).
// tsc prüft das ganze Programm (auch alles Importierte), gezählt werden nur Fehler in den Dateien aus tsconfig.strict.json "files".
// Neue saubere Datei: dort eintragen. npm run check:strict (exit 1 bei Fehlern in der Liste); --all zeigt die Gesamtzahl im Programm.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = JSON.parse(fs.readFileSync(path.join(ROOT, 'tsconfig.strict.json'), 'utf8')).files.map(f => path.normalize(f));
const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsc', '--noEmit', '--pretty', 'false', '-p', 'tsconfig.strict.json'], { cwd: ROOT, encoding: 'utf8' });
const lines = (r.stdout + r.stderr).split('\n').filter(l => /error TS\d+/.test(l));
const mine = lines.filter(l => files.includes(path.normalize(l.split('(')[0])));
for (const l of mine) console.log(l);
console.log(`noImplicitAny: ${files.length} Dateien, ${mine.length} Fehler darin${process.argv.includes('--all') ? ` (im ganzen Programm ${lines.length})` : ''}`);
process.exit(mine.length ? 1 : 0);
