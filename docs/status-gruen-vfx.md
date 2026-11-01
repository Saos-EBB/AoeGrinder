# Status Branch gruen-vfx

Spell-Optik polieren. Nicht gepusht, nicht gemergt, Spiel-Artifact nicht angefasst. Alle neuen Zahlen sind `// PH`.

## 1. VFX-Labor
`npm run dev`, dann `/vfx.html`. `npm run build:vfx` erzeugt die einzelne `dist-vfx/vfx.html`. Das Labor nutzt den echten Spell-Code und die echte Render-Kette. Spells wirken ohne Kosten, Abklingzeit und Castzeit direkt über `effect`.

- Zone `lab` und Mob-Typ `dummy` trägt `vfxLab.ts` zur Laufzeit ein, `zones.ts` und `mobTypes.ts` bleiben unberührt.
- Die Zauber-Module greifen beim Laden auf das Spiel-Menü zu. `vfx.html` legt fehlende Elemente unsichtbar an.
- Die Ziele stehen gestaffelt vor der Figur, damit Kegel, Nova und Bodenziele alle 8 erreichen.
- Spielcode: Effekte laufen auf `fxClock` statt `performance.now`, damit die Zeitlupe greift. Die Blizzard-Animation wanderte aus `main.ts` nach `updateBlizFx`.

## 2. Werkzeuge
- `fx/shaders.ts`: Rauschen aus gebackener 256²-Textur, Fresnel, Auflösen mit Saum, scrollende UVs. Qualität `PERF.vfx` mit `VFX_QUALITY` in `config.ts`.
- `fx/softPass.ts`: Partikel in eigenem Puffer (niedrig/mittel halbe Auflösung), weich gegen die Tiefe des Szenen-Passes.
- `fx/impact.ts`: Licht-Pool, Schockwelle als Post-Pass, Kamera-Ruck, Hitstop 40 ms mit 250 ms Mindestabstand.
- `fx/bolts.ts`: alle Blitze in einem Ringpuffer und einem Draw Call, ab dem Schreiben läuft alles im Shader.

**Außerhalb der genannten Dateien, je minimal:** `render.ts` (Tiefentextur), `main.ts` (Hitstop, Blizzard-Aufruf), `ui/hud.ts` (Crit-Meldung, weil `mobs.ts` gesperrt ist), `score.ts` (Multi-Kill-Meldung), `config.ts` (Schalter), `vite.config.ts`, `package.json`, `.gitignore`.

## 3. Spells neu
Die Alt-Optik bleibt je Funktion hinter `vfxOld()`, nur für den Schalter im Labor. Schaden, Radius und Abklingzeit sind unberührt.

- **Frost:** Nova, Cone of Cold, Blizzard (Wolke und 110 Splitter im Shader, 2 Draw Calls statt über 100), Wirbel, Frostkugel. Die Wolke liegt bei 11,5 yd statt 15 yd, sonst bleibt sie aus der Spielkamera.
- **Relikte:** Ragnaros (Feuerhammer aus dem Himmel, doppelte Welle, Brandriss), Frostatem (3 s schließender Ring mit dichter werdendem Sog, dann Säule und Eisfeld), Frostschlag (harter erster Treffer, Eis auf jedem Ziel), Entweihen (Einsturz nach innen), Feuernova (durchgehende Flammenwand), Knochengefängnis (runde Knochen statt 5-seitiger Kegel).
- **Blitz/Natur:** Kettenblitz und Bogenblitz über den Blitz-Baustein (ein Draw Call, keine Materialien pro Sprung), Hurrikan mit zwei gegenläufigen Trichtern und spiralenden Partikeln.
- **Feuer:** Flammenstoß (Säule, Welle, Glut), Druckwelle (kaum Säule, viel Druck, mit Rune Implosion nach innen), Höllenfeuer (Flammenwand folgt der Figur, Puls bei jedem Tick).
- **Arkan/Leere:** Arcane Explosion, Blink (Einsturz am Start, Stoß am Ziel, Strahl dazwischen), Leerenkugel (Partikel starten außen und spiralen zur Mitte, dunkler Kern mit Fresnel-Rand, Schockwelle nach innen).
