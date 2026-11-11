// Skins (nur Look) pro Figur, Vorlage docs/ref/set-skins-*.html, Handoff docs/handoffs/skins.md. Kein Shop. Krieger-Skins kommen mit der Waffe,
// Magier-Skins sind Set-Skins: frei erst mit dem Erfolg „Set <Name> 5/5 angelegt“ (meta.achievements, setAch unten, gear.ts checkUnlocks).
// Neuer Skin: Eintrag in SKIN_LIST (Krieger mit Waffe, Magier mit Schule) + i18n-Key look.<figur>.<id>.name (de/en), Optik als `if (look === '<id>')` im Modell
// (buildStrichMagier: opts.look, buildStrichKrieger: { look }).
// Gewählt wird in meta.skins ({ figur: skinId }), Auflösen über skinOf in meta.ts.

import { figureOfSet } from './figureTable';

export type Figur = 'magier' | 'krieger';
export type SkinId = string;
// weapon: Krieger-Skin nur mit dieser Waffe (Basis-Waffe aus realMen R.weapons oder legendäre aus LEGENDARY): sword = Riesenschwert, leeroy = Leeroys Klinge, sion = Sions Axt
// school: Magier-Skin nur in dieser Schule (Skin-ID im Spiel, mage.skin): blitz, seuche, frost, feuer (figureTable.ts). ?-Magier (und Arkan, geparkt): nur Standard
export interface SkinDef { id: SkinId; name: string; weapon?: string; school?: string }

export const STANDARD = 'standard';
const def = (figur: Figur, id: SkinId, need?: string): SkinDef => ({ id, name: id === STANDARD ? 'look.standard.name' : `look.${figur}.${id}.name`, ...(need ? (figur === 'krieger' ? { weapon: need } : { school: need }) : {}) });

export const SKIN_LIST: Record<Figur, SkinDef[]> = {
  magier: [def('magier', STANDARD), ...['blitz', 'seuche', 'frost14', 'glut'].map(id => def('magier', id, figureOfSet(id)))],   // Hochspannung, Pestbringer, Splitterkönig, Glutprophet
  krieger: [def('krieger', STANDARD), def('krieger', 'klapse', 'sword'), def('krieger', 'classic', 'leeroy'), def('krieger', 'holz', 'sion')],   // Ausbrecher, Classic-Krieger 55, Holzfäller
};

// Figur zum Spielmodell (mage.skin): Strichkrieger, alles andere sind Strichmagier
export const figurOf = (gameSkin: string): Figur => (gameSkin === 'krieger' ? 'krieger' : 'magier');
// Wählbare Skins der Figur: need = Waffen-ID (Krieger) bzw. Schule (Magier, mage.skin). Passt nicht → nur Standard, die gespeicherte Wahl bleibt
export const skinsFor = (figur: Figur, need?: string | null) => SKIN_LIST[figur].filter(s => { const req = s.weapon ?? s.school; return !req || req === need; });

// Erfolg, der einen Skin freischaltet: Magier-Skins (außer Standard) = Set gleicher ID 5/5 angelegt (gear.ts SETS). null = immer frei
export const setAch = (setId: string) => `set:${setId}`;
export const skinLock = (figur: Figur, id: SkinId): string | null => figur === 'magier' && id !== STANDARD ? id : null;
// Alle Erfolge (bisher nur die Set-Erfolge), Reihenfolge wie SKIN_LIST
export const ACHIEVEMENTS: string[] = SKIN_LIST.magier.filter(s => s.id !== STANDARD).map(s => setAch(s.id));
// Meilenstein-Erfolge (meta.ts MILESTONES): schalten je ein Kosmetik-Teil frei (gear.ts LOOKS ach), keinen Skin
export const MILESTONE_LOOK: Record<string, string> = { boss1: 'pappkrone', dust10k: 'goldkette', kills1k: 'killflagge', bossNoHit: 'handschellen', lvl100: 'dreiteiler' };
export const MILESTONE_ACH = Object.keys(MILESTONE_LOOK);
export const cleanAch = (raw: unknown): string[] => Array.isArray(raw) ? [...new Set(raw.filter(a => ACHIEVEMENTS.includes(a) || MILESTONE_ACH.includes(a)))] : [];

// Gespeichertes Feld säubern (localStorage, Spielstand-Code): nur bekannte Figuren mit bekannten Skins, sonst weg (= Standard)
export function cleanSkins(raw: unknown): Partial<Record<Figur, SkinId>> {
  const out: Partial<Record<Figur, SkinId>> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const f of Object.keys(SKIN_LIST) as Figur[]) {
    const v = (raw as any)[f];
    if (typeof v === 'string' && SKIN_LIST[f].some(s => s.id === v)) out[f] = v;
  }
  return out;
}
