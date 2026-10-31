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
- feat(spells): Jeder Cast und Kanal hat eine eigene ID, `damageMob` setzt sie als `mob.castKey`. Nicht gebaut: keine Änderung an `score.ts`.

## Stand
Alle Punkte des Auftrags sind drin. Geprüft im Headless-Browser: alle 63 Kombinationen aus Spell und Rune ohne Laufzeitfehler, simuliertes Pad, alle neuen Modi, `build` über zwei Runs, Cast-IDs bei Casts, Kanal und Echo. `tsc` und `vite build` laufen. Probe-Merge mit `blau-levels` ohne Konflikt, `tsc` sauber. Nicht geprüft: echtes Pad, Spielbalance, Spielgefühl der neuen Modi.

## Offen und Festlegungen
- Lava-Ticks schieben Kanäle weiter auf: `abilities.ts` ruft `damagePlayer(dmg)` ohne `dot`, die Datei ist gesperrt. Beim Zaubern sind sie ausgenommen. `dot = true` allein reicht nicht, die Todesursache hieße dann „Gift“.
- `build` wird einen Frame nach dem Tod nachgetragen, weil `leaderboard.ts` gesperrt ist; der Speicherschlüssel steht deshalb auch in `core.ts`. Sauberer wäre `build: buildText()` in `recordRun`.
- Pushback beim Zaubern: Trifft ein Mob genau einen Frame vor einem Gift-Tick, entfällt dieser eine Pushback, weil `lastHitBy` überschrieben wird.
- Classic pur: Ein Rang wirkt auf jeden Rang-Wert des Spells (Schaden, Mana, Radius), ×1.
- Kein Trinken: Level-Ups füllen kein Mana auf, Leben schon.
- Nur Frost: Supports bleiben, wenn sie auf erlaubte Spells wirken; Talente ohne Tag fallen weg (`docs/score-spec.md`).
