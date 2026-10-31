# Status Branch gruen-polish

Nacharbeiten an Spells und Input, Modi Teil 2, Feld `build`, echte Cast-ID. Nicht gepusht, nicht gemerged.

## Steps
- fix(input): Taste 3 sucht den Spell im Slot wie jede andere Taste, `resolveSlot3()` ist weg. Nicht gebaut: —
- feat(gamepad): Slot 7 auf R2/RT, Slot 8 auf Steuerkreuz rechts, Zielmodus für Bodenziel-Spells in jedem Slot. Nicht gebaut: —
- fix(fx): Treffer-Funken nur in der Farbe der eigenen Schule. Nicht gebaut: —
- fix(spells): Gift- und Lava-Ticks schieben das Zaubern nicht mehr auf. Nicht gebaut: kein Treffer-Ereignis in `player.ts`.
- feat(fx): Canvas-Texturen für alle Dauerflächen der neuen Spells. Nicht gebaut: keine Texturen für Effekte ohne Bodenfläche (Feuerring, Feuernova: nur Partikel).
- feat(modes): Nur Frost, Nur Feuer, Kein Trinken, Classic pur, Kein Glück und drei Presets (`docs/score-spec.md`). Nicht gebaut: keine Vorschau des Start-Kits im Startmenü.
- feat(score): Feld `build` der Rangliste wird beim Run-Ende gefüllt. Nicht gebaut: keine Anzeige, die gehört Blau.
