// Skins (nur Look) pro Figur, Vorlage docs/ref/set-skins-*.html, Handoff docs/handoffs/skins.md. Alle frei, kein Shop, keine Freischaltung.
// Neuer Skin: Eintrag in SKIN_LIST + i18n-Key look.<figur>.<id>.name (de/en), Optik als `if (look === '<id>')` im Modell
// (buildStrichMagier: opts.look, buildStrichKrieger: { look }). Noch nicht gebaut = sieht aus wie 'standard'.
// Gewählt wird in meta.skins ({ figur: skinId }), Auflösen über skinOf in meta.ts.

export type Figur = 'magier' | 'krieger';
export type SkinId = string;
// weapon: Krieger-Skin nur mit dieser Waffe (Basis-Waffe aus realMen R.weapons oder legendäre aus LEGENDARY): sword = Riesenschwert, leeroy = Leeroys Klinge, sion = Sions Axt
export interface SkinDef { id: SkinId; name: string; weapon?: string }

export const STANDARD = 'standard';
const def = (figur: Figur, id: SkinId, weapon?: string): SkinDef => ({ id, name: id === STANDARD ? 'look.standard.name' : `look.${figur}.${id}.name`, weapon });

export const SKIN_LIST: Record<Figur, SkinDef[]> = {
  magier: [def('magier', STANDARD), def('magier', 'blitz'), def('magier', 'seuche'), def('magier', 'frost14')],   // Hochspannung, Pestbringer, Splitterkönig
  krieger: [def('krieger', STANDARD), def('krieger', 'klapse', 'sword'), def('krieger', 'classic', 'leeroy'), def('krieger', 'holz', 'sion')],   // Ausbrecher, Classic-Krieger 55, Holzfäller
};

// Figur zum Spielmodell (mage.skin): Strichkrieger, alles andere sind Strichmagier
export const figurOf = (gameSkin: string): Figur => (gameSkin === 'krieger' ? 'krieger' : 'magier');
// Wählbare Skins der Figur mit der aktuellen Waffe (Krieger: Waffen-ID, Magier: egal)
export const skinsFor = (figur: Figur, weapon?: string | null) => SKIN_LIST[figur].filter(s => !s.weapon || s.weapon === weapon);

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
