# Status Branch spells

Arbeitsstand des Spell-Systems. Grundlage: `docs/spells-spec.md`. Per Fast-Forward in main gemerged und als v7 (`1793479590-bf7f`) ins Artifact gepublisht, nicht gepusht.

## Steps
- chore(docs): Spec abgelegt. Nicht gebaut: —
- feat(spells): Tags, 8 Slots, Actionbar 1–8. `src/spells.ts` wird zu `src/spells/` (ein Spell pro Datei, `core.ts`, `index.ts`). Nicht gebaut: kein Umbau von `input.ts`/`gamepad.ts`, kein Pad-Button für Slot 7–8.
- feat(cards): 4+ Karten, Seltenheit, Glück, Ersatz-Auswahl bei vollen Slots. Nicht gebaut: kein Abbruch im Ersetzen-Dialog (Spec: Spieler wählt).
- feat(spells): Runen-System, 15 Start-Kit-Runen, Dauerflächen (`addField`), Ladungen, `pullMob`/`knockbackMob` in `mobs.ts`. Nicht gebaut: keine Ladungsanzeige auf der Actionbar.
- feat(spells): acht Supports. Nicht gebaut: Großes Echo wiederholt keine Kanäle (der Kanal würde sich selbst abbrechen), die Spec schließt das nur bei Echo aus.
- feat(spells): Castzeit (Bewegung bricht ab, Treffer schieben auf), Flammenstoß, Druckwelle, Höllenfeuer. Nicht gebaut: eigene Texturen für die Bodenflächen.
- feat(spells): Hurrikan, Frostkugel, Kettenblitz. Nicht gebaut: kein Zielen beim Kettenblitz, er nimmt den nächsten Mob in 30 yd.
- feat(spells): Leerenkugel, Wirbel, Bogenblitz; Schock wirkt auf allen Schaden der Spells. Nicht gebaut: —
- feat(spells): sechs Relikte in `relics.ts`, Kartenart Relikt. Nicht gebaut: Relikte haben keine Runen (Spec nennt keine); entgegen "ein Spell pro Datei" liegen sie gesammelt in einer Datei.
- feat(ui): Dev im Esc-Menü: Karte erzwingen (Art + Seltenheit), Glück +25. Nicht gebaut: —
- fix(spells): Knochenring ohne Bloom, er überstrahlte das Bild. Nicht gebaut: —

## Struktur
- `src/spells/core.ts`: Slots, Tags, `cast`, Channel, Kontext `c` pro Wirkung (`c.hit`, `c.radius`, `c.duration`), Runen, Ladungen, Dauerflächen
- `src/spells/fx.ts`: Bausteine für Flächen, Blitze, Explosionen
- `src/spells/<id>.ts`: Werte und Wirkung eines Spells; `index.ts` registriert sie in `SPELLS`
- Die Tasten-Aktionen behalten ihre IDs (`nova` = Slot 1 …). `cast(aktion)` sucht den Spell im Slot, `castSpell(id)` zaubert direkt.

## Stand
Alle Commits des Spec bis auf den entfallenen Publish sind drin. Geprüft im Headless-Browser (Dev-Server): alle 20 zauberbaren Spells mit jeder Rune ohne Laufzeitfehler, dazu gezielt Stichproben der Wirkungen, Kartenregeln, Ersetzen-Dialog, Neustart. `tsc` und `vite build` laufen. Nicht geprüft: Spielbalance, echtes Pad.

## Abweichungen und offene Punkte
- `mobs.ts` bleibt unangetastet, deshalb: „schlagen langsamer“ schiebt `nextSwing` pro Frame (`slowSwing`).
- Pushback beim Zaubern erkennt Treffer am Lebensverlust (`player.ts` nicht angefasst), Ticks von Gift und Lava sind ausgenommen.
- `formulas.ts` und `fx/spellFx.ts` standen nicht auf der Dateiliste, mussten aber kleine Änderungen bekommen.
- Die bisherigen Upgrades (Shatter, Arcane Mind …) laufen als sechste Art "Talent" weiter, die Karte "Glück" als siebte. Die Spec nennt keine Verteilung der Arten: `CARD_KIND_WEIGHTS` ist PH.
- Trinken belegt Slot 6 und ist nicht ersetzbar, sonst gäbe es keine Mana-Quelle mehr.
