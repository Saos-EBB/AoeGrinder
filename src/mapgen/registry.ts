// Generierte Zonen für ZONES (zones.ts): ein Eintrag pro Theme mit fertigem Layout, Zonen-ID map-<theme>.

import { genZone, type GenDef } from './genZone';
import { THEMES } from './themes';
import { offen } from './layouts/offen';
import type { Layout } from './grid';
import type { Rng } from './rng';
import type { LayoutId, ThemeId } from './types';

const LAYOUTS: Partial<Record<LayoutId, (rng: Rng) => Layout>> = { offen };

export const zoneIdOf = (theme: ThemeId) => `map-${theme}`;

function defOf(id: ThemeId, layout: (rng: Rng) => Layout, zoneId = zoneIdOf(id), name?: string): GenDef {
  const th = THEMES[id];
  return { id: zoneId, name: name ?? th.name, theme: th.info, layout, look: th.look, env: th.env, mobs: th.mobs, packs: th.packs, storm: th.storm, fogExtra: th.fogExtra };
}

export const GEN_ZONES: Record<string, any> = {};
for (const th of Object.values(THEMES)) if (LAYOUTS[th.layout]) GEN_ZONES[zoneIdOf(th.id)] = genZone(defOf(th.id, LAYOUTS[th.layout]!));
