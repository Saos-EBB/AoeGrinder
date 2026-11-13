// Strichmagier: welche Gear- und Kosmetik-Teile zu einem Skin oder Schul-Look nicht passen (Regeln, gebraucht in buildStrichMagier).

// Gear-Teile (gearParts.ts), die zu einem Skin oder Schul-Look nicht passen: ausgeblendet. look = Skin (skins.ts), skin = Schul-Look (paletteOf).
// Kevin: fertige Skins müssen nicht alles zulassen, mit Skin keine Hüte, Hochspannung keine Rückenteile. Angelegt bleibt das Teil trotzdem (Werte zählen)
export const GEAR_HIDE: { look: Record<string, string[]>; skin: Record<string, string[]> } = {
  look: { seuche: ['kopf'],        // Pestmaske mit Hut: kein Hut/Kapuze/Diadem/Halo darüber
    frost14: ['kopf'],             // Platin-Perücke mit hoher Welle
    blitz: ['kopf', 'ruecken'],    // Haar mit Sonnenbrille; Flasche mit Strom auf dem Rücken
    glut: ['kopf'] },              // Sturmhaube mit Flammen aus den Augen
  skin: { base: ['kopf'] },        // Zuhälter-Look (nur Dev): Fedora
};
// Kosmetik-Teile (kosmetikParts.ts), die zu einem Skin oder Schul-Look nicht passen: ausgeblendet. Einträge sind Slots oder Look-IDs. Gleiche Regel wie oben
export const KOS_HIDE: { look: Record<string, string[]>; skin: Record<string, string[]> } = {
  look: { seuche: ['kopf'],        // Pestmaske mit Hut: nichts auf dem Kopf
    frost14: ['kopf'],             // Platin-Perücke
    blitz: ['kopf', 'ruecken'],    // Haar mit Sonnenbrille; Flasche mit Strom auf dem Rücken (auch Element-Rucksack, Limo-Jetpack, Kill-Flagge …)
    glut: ['kopf'] },              // Sturmhaube mit Augen-Feuer (auch Fake-Bart-Brille)
  skin: { base: ['kopf'] },        // Zuhälter-Look (nur Dev): Fedora
};
