// Blut-Infekt am Mob: Stapel laufen je 4 s und hängen sich hinten an. Ohne Imports aus spells/, damit Waffen (weaponRolls.ts) ihn legen können.
// Die Ticks laufen in spells/blood.ts (updateBlood). Zahlen in BLOOD.infect (config.ts).

import { state } from './state';
import { BLOOD } from './config';

const I = BLOOD.infect;
export const infectStacks = m => m.infect && m.infect.until > state.now ? Math.min(I.maxStacks, Math.ceil((m.infect.until - state.now) / I.stackMs)) : 0;
export function infect(m, n = 1) {
  if (m.dead) return;
  const fresh = !infectStacks(m), left = fresh ? 0 : m.infect.until - state.now;
  m.infect = { until: state.now + Math.min(I.maxStacks * I.stackMs, left + n * I.stackMs), next: fresh ? state.now + I.tickMs : m.infect.next };
}
