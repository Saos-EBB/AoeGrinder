// gear/roll.ts rollGear: Fokus ab Blau mit GEAR.focusShare, aus den Spells der gespielten Schule (FOCUS_SPELLS ∩ Tag der Figur).
// Bis 2026-11-11 fehlte den Seuchen-Spells das Tag 'Seuche' (spells/plagueSpell.ts): der Seuchenmagier würfelte immer Platzen.
// Die echte Registry füllt spells/index.ts (lädt render.ts); hier stehen die Fokus-Spells mit ihrem Schul-Tag, Seuche über plagueSpell.
import './setup/browserStub';
import { describe, it, expect, beforeAll } from 'vitest';
import { rollGear } from '../src/gear/roll';
import { GEAR } from '../src/gear/data';
import { FOCUS_SPELLS } from '../src/rollTables';
import { SPELLS } from '../src/spells/registry';
import { plagueSpell } from '../src/spells/plagueSpell';

const SCHOOL: Record<string, string[]> = {
  Frost: ['nova', 'bliz', 'coc', 'frostorb', 'whirl', 'icelance', 'glacier'],
  Feuer: ['flame', 'blast', 'hellfire', 'fireball', 'meteor', 'phoenix', 'detonate'],
  Blitz: ['chain', 'arc', 'strike', 'ball', 'discharge', 'storm'],
  Arkan: ['blink'],
  Seuche: ['sludge', 'slimetrap', 'slimewave', 'blackhole', 'poisoncloud', 'web', 'contract', 'drain', 'burst', 'melt'],
};
const FIG_TAG: Record<string, string> = { frost: 'Frost', feuer: 'Feuer', blitz: 'Blitz', seuche: 'Seuche' };
const N = 10000;

beforeAll(() => {
  for (const [tag, ids] of Object.entries(SCHOOL)) for (const id of ids)
    SPELLS[id] = tag === 'Seuche' ? plagueSpell(id === 'burst' ? { name: id } : { name: id, tags: ['Fläche'] }) : { name: id, tags: [tag, 'Fläche'] };
});

describe('rollGear Fokus', () => {
  it('Tabelle: FOCUS_SPELLS deckt die Schulen ab (Test-Registry vollständig)', () => {
    expect([...FOCUS_SPELLS].sort()).toEqual(Object.values(SCHOOL).flat().sort());
  });
  for (const [fig, tag] of Object.entries(FIG_TAG)) it(`${fig}: ${N} Teile ab Blau, ~${GEAR.focusShare * 100} % mit Fokus, nur aus der eigenen Schule`, () => {
    const seen = new Set<string>(); let n = 0;
    for (let i = 0; i < N; i++) {
      const g = rollGear('kopf', GEAR.focusFrom + (i % 3), fig);
      if (!g.s.focus) continue;
      n++; seen.add(g.s.focus);
    }
    expect(Math.abs(n / N - GEAR.focusShare)).toBeLessThan(0.03);
    expect([...seen].sort()).toEqual([...SCHOOL[tag]].sort());   // alle Spells der Schule kommen vor, keiner von außen
  });
  it('unter Blau nie ein Fokus', () => {
    for (let i = 0; i < 2000; i++) expect(rollGear('kopf', i % GEAR.focusFrom, 'seuche').s.focus).toBeUndefined();
  });
});
