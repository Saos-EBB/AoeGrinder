# Status Branch gruen-vfx

Spell-Optik polieren. Nicht gepusht, nicht gemergt, Spiel-Artifact nicht angefasst. Alle neuen Zahlen sind `// PH`.

## 1. VFX-Labor
`npm run dev`, dann `/vfx.html`. `npm run build:vfx` erzeugt die einzelne `dist-vfx/vfx.html`. Das Labor nutzt den echten Spell-Code und die echte Render-Kette. Spells wirken ohne Kosten, Abklingzeit und Castzeit direkt über `effect`.

- Zone `lab` und Mob-Typ `dummy` trägt `vfxLab.ts` zur Laufzeit ein, `zones.ts` und `mobTypes.ts` bleiben unberührt.
- Die Zauber-Module greifen beim Laden auf das Spiel-Menü zu. `vfx.html` legt fehlende Elemente unsichtbar an.
- Die Ziele stehen gestaffelt vor der Figur, damit Kegel, Nova und Bodenziele alle 8 erreichen.
- Spielcode: Effekte laufen auf `fxClock` statt `performance.now`, damit die Zeitlupe greift. Die Blizzard-Animation wanderte aus `main.ts` nach `updateBlizFx`.
