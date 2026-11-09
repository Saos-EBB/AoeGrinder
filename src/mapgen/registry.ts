// Generierte Zonen für ZONES (zones.ts): ein Eintrag pro Theme mit fertigem Layout, Zonen-ID map-<theme>.

import { genZone, type GenDef } from './genZone';
import { THEMES } from './themes';
import { offen } from './layouts/offen';
import { kanaele } from './layouts/kanaele';
import { raeume } from './layouts/raeume';
import { hallen } from './layouts/hallen';
import { arena } from './arena';
import type { Layout } from './grid';
import type { Rng } from './rng';
import type { LayoutId, ThemeId } from './types';

const LAYOUTS: Partial<Record<LayoutId, (rng: Rng) => Layout>> = { offen, kanaele, raeume, hallen };

export const zoneIdOf = (theme: ThemeId) => `map-${theme}`;

function defOf(id: ThemeId, layout: (rng: Rng) => Layout, zoneId = zoneIdOf(id), name?: string): GenDef {
  const th = THEMES[id];
  return { id: zoneId, name: name ?? th.name, theme: th.info, layout, look: th.look, env: th.env, mobs: th.mobs, packs: th.packs, storm: th.storm, fogExtra: th.fogExtra };
}

export const GEN_ZONES: Record<string, any> = {};
for (const th of Object.values(THEMES)) if (LAYOUTS[th.layout]) GEN_ZONES[zoneIdOf(th.id)] = genZone(defOf(th.id, LAYOUTS[th.layout]!));
GEN_ZONES.arena = arena;   // feste Arena für den Boss-Modus, kein Generator

// Standard-Startmap und ?theme=<id> (world.ts)
export const DEFAULT_ZONE = zoneIdOf('wald');
export const THEME_ZONES = Object.keys(THEMES).map(id => zoneIdOf(id as ThemeId));
