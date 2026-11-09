// Skins (nur Look) pro Figur, Vorlage docs/ref/set-skins-*.html, Handoff docs/handoffs/skins.md. Alle frei, kein Shop, keine Freischaltung.
// Neuer Skin: Eintrag in SKIN_LIST (Krieger mit Waffe, Magier mit Schule) + i18n-Key look.<figur>.<id>.name (de/en), Optik als `if (look === '<id>')` im Modell
// (buildStrichMagier: opts.look, buildStrichKrieger: { look }). Noch nicht gebaut = sieht aus wie 'standard'.
// Gewählt wird in meta.skins ({ figur: skinId }), Auflösen über skinOf in meta.ts.

export type Figur = 'magier' | 'krieger';
export type SkinId = string;
// weapon: Krieger-Skin nur mit dieser Waffe (Basis-Waffe aus realMen R.weapons oder legendäre aus LEGENDARY): sword = Riesenschwert, leeroy = Leeroys Klinge, sion = Sions Axt
// school: Magier-Skin nur in dieser Schule (Skin-ID im Spiel, mage.skin): blitz, blut (Seuche), frost, feuer. ?-Magier (und Arkan, geparkt): nur Standard
export interface SkinDef { id: SkinId; name: string; weapon?: string; school?: string }

export const STANDARD = 'standard';
const def = (figur: Figur, id: SkinId, need?: string): SkinDef => ({ id, name: id === STANDARD ? 'look.standard.name' : `look.${figur}.${id}.name`, ...(need ? (figur === 'krieger' ? { weapon: need } : { school: need }) : {}) });

export const SKIN_LIST: Record<Figur, SkinDef[]> = {
  magier: [def('magier', STANDARD), def('magier', 'blitz', 'blitz'), def('magier', 'seuche', 'blut'), def('magier', 'frost14', 'frost'), def('magier', 'glut', 'feuer')],   // Hochspannung, Pestbringer, Splitterkönig, Glutprophet
  krieger: [def('krieger', STANDARD), def('krieger', 'klapse', 'sword'), def('krieger', 'classic', 'leeroy'), def('krieger', 'holz', 'sion')],   // Ausbrecher, Classic-Krieger 55, Holzfäller
};

// Figur zum Spielmodell (mage.skin): Strichkrieger, alles andere sind Strichmagier
export const figurOf = (gameSkin: string): Figur => (gameSkin === 'krieger' ? 'krieger' : 'magier');
// Wählbare Skins der Figur: need = Waffen-ID (Krieger) bzw. Schule (Magier, mage.skin). Passt nicht → nur Standard, die gespeicherte Wahl bleibt
export const skinsFor = (figur: Figur, need?: string | null) => SKIN_LIST[figur].filter(s => { const req = s.weapon ?? s.school; return !req || req === need; });

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
