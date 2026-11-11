// Spell-ID → Icon-URL. SVGs aus dem Spell-Viewer (spellIcons.ts, nicht von Hand ändern), Zuordnung über die ID (ICON_KEY).
// Fehlt ein Icon, steht der erste Buchstabe des Anzeigenamens in der Schulfarbe. Getränke des ?-Magiers stehen mit ihrer ID in ICON_KEY.
import { SPELLS, RANDOM_MAGE } from '../config';
import { SPELL_ICONS } from './spellIcons';
import { COLORS, schoolColor } from './colors';

// Spell-ID → Icon im Viewer (spellIcons.ts). Fest nach ID, damit Umbenennen und Übersetzen die Icons nicht verlieren
const ICON_KEY: Record<string, string> = {
  wQ: 'schlagfolge', wE: 'bodenbrecher', wR: 'wirbelwind', wExec: 'hinrichtung', wLast: 'letzteratem', wCry: 'kampfschrei', wLeap: 'sturzsprung',
  wCharge: 'ansturm', wClap: 'donnerknall', wShout: 'einschuechterungsruf', wBerserk: 'berserker', lLeeroy: 'ansturm', sR: 'ansturm', sE: 'einschuechterungsruf', rOff: 'q_offensiv', rDef: 'q_defensiv',
  rUtil: 'q_utility', rDrink: 'q_drink', iceblock: 'eisblock', phoenix: 'phoenix', detonate: 'brandmal', gasoline: 'benzin', firetrail: 'feuerspur',
  firestorm: 'feuersbrunst', frostbolt: 'frostblitz', needle: 'gletschernadel', icebarrier: 'eisbarriere', quake: 'erdbeben', keeper: 'sturmhueter',
  staticfield: 'statikfeld', stormelem: 'sturmelementar', nova: 'frostnova', bliz: 'blizzard', coc: 'coneofcold', blink: 'blink', drink: 'q_drink',
  flame: 'flammenstoss', blast: 'druckwelle', hellfire: 'hoellenfeuer', frostorb: 'frostkugel', whirl: 'wirbel', icelance: 'eislanze',
  fireball: 'feuerball', meteor: 'meteor', chain: 'kettenblitz', arc: 'bogenblitz', strike: 'blitzschlag', ball: 'kugelblitz',
  discharge: 'entladung', storm: 'gewitter', sludge: 'schlammwurf', slimetrap: 'schleimfalle', slimewave: 'schleimwelle', blackhole: 'schwarzesloch',
  poisoncloud: 'giftwolke', web: 'klebefaden', contract: 'zusammenziehen', drain: 'entziehen', burst: 'platzen', melt: 'zerfliessen',
  pestilence: 'pestilenz', gold: 'goldbecher', schnaps: 'feuerschnaps', tasse: 'heissetasse', tee: 'teeschale'
};

// Klammern und Apostrophe mitkodieren: die URL steht ungequotet in url(...) und in style-Attributen
const dataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg).replace(/[()']/g, c => `%${c.charCodeAt(0).toString(16)}`)}`;
const placeholder = (name: string, color: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><rect x="1.5" y="1.5" width="61" height="61" rx="9" fill="#1d1b18" stroke="${color}" stroke-width="3"/><text x="32" y="44" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="34" fill="${color}">${[...name][0]?.toUpperCase() ?? '?'}</text></svg>`;

const cache: Record<string, string> = {};
export function iconUrl(id: string): string | undefined {
  if (cache[id]) return cache[id];
  const s = SPELLS[id], name: string | undefined = s?.name ?? RANDOM_MAGE.drinks[id]?.name;
  if (!name) return undefined;   // SPELLS füllt sich erst beim Import von spells/index.ts
  const key = ICON_KEY[id];
  return cache[id] = dataUrl(key ? SPELL_ICONS[key] : placeholder(name, schoolColor(id) ?? COLORS.text));
}

export const ICONS: Record<string, string> = new Proxy({}, { get: (_, id) => typeof id === 'string' ? iconUrl(id) : undefined });
