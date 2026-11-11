// Bind-IDs sind gespeichert und heißen nach alten Frost-Spells; config.ts bildet sie auf Rolle und Slot ab (NAME-09).
import './setup/browserStub';
import { describe, it, expect } from 'vitest';
import { SPELL_ACTIONS, BIND_LABEL, BIND_SLOT, SLOT } from '../src/config';

describe('Bind-IDs (config.ts BIND_LABEL/BIND_SLOT)', () => {
  it('jede Bind-ID hat Klartext und Slot, passend zu SLOT', () => {
    expect(Object.keys(BIND_LABEL).sort()).toEqual([...SPELL_ACTIONS].sort());
    expect(SPELL_ACTIONS.map(id => BIND_SLOT[id])).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(BIND_LABEL[SPELL_ACTIONS[SLOT.move]]).toBe('move');
    expect(BIND_LABEL[SPELL_ACTIONS[SLOT.relic]]).toBe('relic');
    expect(BIND_LABEL[SPELL_ACTIONS[SLOT.drink]]).toBe('drink');
  });
});
