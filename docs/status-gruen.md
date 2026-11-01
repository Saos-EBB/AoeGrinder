# Status Branch gruen-tuning

Kleine Fixes, Mob-Dichte, Bewegungsgefühl. Nicht gepusht, nicht gemerged, nicht veröffentlicht. Jede Änderung mit Vorher/Nachher.

## Mob-Dichte (`LEVEL_*` in `config.ts`, alles PH)
| Wert | Vorher | Nachher |
|---|---|---|
| Mobs auf Level 1 | 30–34 | mindestens 40 (40–47 im Kampf) |
| Pack-Größe auf Level 1–15 | 2 | 4–6 |
| Streuung um die Pack-Mitte | ±5 yd | ±3 yd, große Packs bis ±5 yd |
| Respawn | erst unter der Pack-Grenze | jeder tote Pack sofort, darunter die Mindestdichte |
| Mobs in Tirisfal auf Level 30 / 45 / 100 | Formel 91 / 130 / 130 | gemessen 97 / 134 / 135 (gleiche Formel, nie unter 40) |

Leistungsanzeige auf Level 1, Software-Rendering im Headless-Browser, auf echter GPU neu zu messen. Die FPS taugen nur als grober Vergleich:

| Zone | Mobs vorher → nachher | FPS vorher → nachher | Draw Calls vorher → nachher (Momentaufnahme) |
|---|---|---|---|
| Tirisfal | 34 → 45 | 3 → 5 | 200 → 161 |
| Elvyn | 30 → 40 | 3 → 5 | 147 → 190 |
| Blackrock Depths | 30 → 43 | 4 → 6 | 225 → 160 |
| Schlingendorntal | 30 → 40 | 2 → 4 | 204 → 218 |
| Tanaris | 30 → 44 | 7 → 7 | 169 → 286 |

Draw Calls und FPS hängen am Bildausschnitt, die Werte sind keine belastbare Aussage über die Mehrlast. `zone.packs.initialMobs` in `zones.ts` wird nicht mehr gelesen, die Datei ist gesperrt.

# Status Branch gruen-polish

Nacharbeiten an Spells und Input, Modi Teil 2, Feld `build`, echte Cast-ID. Per Fast-Forward in main gemerged und als v9 (`1793484974-aac1`) veröffentlicht, nicht gepusht.

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
