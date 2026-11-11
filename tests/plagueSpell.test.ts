// spells/plagueSpell.ts: jeder Seuchen-Spell trägt das Tag 'Seuche' (Schule), eigene Tags bleiben dahinter, kein Doppel.
// Die echten Spells (spells/plague.ts) laden render.ts und damit kein Node; geprüft im Browser (~/dev/.fg-pw/bugs/cards.mjs).
import { describe, it, expect } from 'vitest';
import { plagueSpell } from '../src/spells/plagueSpell';

// Tags wie in spells/plague.ts (burst ohne eigene Tags, Pestilenz schon mit 'Seuche')
const OWN: Record<string, string[] | undefined> = {
  sludge: ['Geschoss'], slimetrap: ['Fläche', 'Kontrolle'], slimewave: ['Fläche', 'Kontrolle'], blackhole: ['Fläche', 'Kontrolle'],
  poisoncloud: ['Fläche'], web: ['Fläche', 'Kontrolle'], contract: ['Kontrolle'], drain: ['Heilung'], burst: undefined,
  melt: ['Bewegung', 'Fläche', 'Kontrolle'], pestilence: ['Seuche'],
};

describe('plagueSpell', () => {
  for (const [id, tags] of Object.entries(OWN)) it(`${id}: Tag 'Seuche' vorn, eigene Tags dahinter, kein Doppel`, () => {
    const s = plagueSpell({ name: id, ...(tags ? { tags } : {}) });
    expect(s.tags[0]).toBe('Seuche');
    expect(s.tags.filter(x => x === 'Seuche')).toHaveLength(1);
    expect(s.tags.slice(1)).toEqual((tags ?? []).filter(x => x !== 'Seuche'));
  });
  it('Grundform: ranks und cls als Standard, eigene Felder gewinnen', () => {
    expect(plagueSpell({ name: 'a' })).toMatchObject({ ranks: ['dmg', 'radius'], cls: 'plague', name: 'a' });
    const own = plagueSpell({ ranks: ['radius'], cd: 5000, tags: ['Fläche'] });
    expect(own.ranks).toEqual(['radius']);
    expect(own.cd).toBe(5000);
  });
});
