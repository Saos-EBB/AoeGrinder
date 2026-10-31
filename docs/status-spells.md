# Status Branch spells

Arbeitsstand des Spell-Systems. Grundlage: `docs/spells-spec.md`. Kein Publish, kein Push; Rebase auf main macht Kevin mit dem Agenten danach.

## Steps
- chore(docs): Spec abgelegt. Nicht gebaut: —
- feat(spells): Tags, 8 Slots, Actionbar 1–8. `src/spells.ts` wird zu `src/spells/` (ein Spell pro Datei, `core.ts`, `index.ts`). Nicht gebaut: kein Umbau von `input.ts`/`gamepad.ts`, kein Pad-Button für Slot 7–8.
- feat(cards): 4+ Karten, Seltenheit, Glück, Ersatz-Auswahl bei vollen Slots. Nicht gebaut: kein Abbruch im Ersetzen-Dialog (Spec: Spieler wählt).
- feat(spells): Runen-System, 15 Start-Kit-Runen, Dauerflächen (`addField`), Ladungen, `pullMob`/`knockbackMob` in `mobs.ts`. Nicht gebaut: keine Ladungsanzeige auf der Actionbar.
- feat(spells): acht Supports. Nicht gebaut: Großes Echo wiederholt keine Kanäle (der Kanal würde sich selbst abbrechen), die Spec schließt das nur bei Echo aus.

## Struktur
- `src/spells/core.ts`: Slots, Tags, `cast`, Channel, Kontext `c` pro Wirkung (`c.hit`, `c.radius`, `c.duration`), Runen, Ladungen, Dauerflächen
- `src/spells/fx.ts`: Bausteine für Flächen, Blitze, Explosionen
- `src/spells/<id>.ts`: Werte und Wirkung eines Spells; `index.ts` registriert sie in `SPELLS`
- Die Tasten-Aktionen behalten ihre IDs (`nova` = Slot 1 …). `cast(aktion)` sucht den Spell im Slot, `castSpell(id)` zaubert direkt.

## Abweichungen und offene Punkte
- `input.ts` ist bis auf die Tasten 7–8 unverändert. Dort steht `pressSpell` weiter fest auf `bliz`; `resolveSlot3()` in `core.ts` fängt das ab.
- `formulas.ts` und `fx/spellFx.ts` standen nicht auf der Dateiliste, mussten aber kleine Änderungen bekommen.
- Die bisherigen Upgrades (Shatter, Arcane Mind …) laufen als sechste Art "Talent" weiter, die Karte "Glück" als siebte. Die Spec nennt keine Verteilung der Arten: `CARD_KIND_WEIGHTS` ist PH.
- Trinken belegt Slot 6 und ist nicht ersetzbar, sonst gäbe es keine Mana-Quelle mehr.
- Pad: Slot 7–8 haben keinen Knopf (`gamepad.ts` nicht angefasst).
