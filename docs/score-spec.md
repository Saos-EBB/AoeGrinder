# Punkte, Rangliste und Modi (Teil 1)

Alle Zahlen sind Design-Werte (`// PH`).

## Punkte
Punkte pro Kill = XP × M_multi × M_combo × M_modus
- XP: wie bisher (Classic-Formel), graue Mobs = 0
- Multi-Kill: Kills mit gleicher source-ID (Spell-ID aus damageMob), die höchstens 1,2 s auseinanderliegen, zählen als ein Cast. M_multi = 1 + 0,1 × (n − 1), max ×5. Seit Teil 2 ist das eine echte Cast-ID (Zähler in `makeCtx`, Echos und Flächen behalten die ID ihres Casts); score.ts liest nur das Feld "castKey".
- Combo: Kill innerhalb 4 s nach dem letzten → Combo +1. M_combo = 1 + Combo/50, max ×3. Trinken oder 4 s ohne Kill → Combo 0.
- M_modus: Produkt der aktiven Modifikatoren
- Run-Ende: + größter Pull (max. gleichzeitig kämpfende Mobs) × 100, + 50 pro Minute

HUD: Punkte oben Mitte, darunter Combo-Zahl mit 4-s-Balken, ab 10 Kills pro Cast groß "MULTI-KILL ×n".

## Modifikatoren (Teil 1)
| Modifikator | Wirkung | Punkte |
|---|---|---|
| Halbe Werte | −50 % Leben, Mana, Schaden | ×2,0 |
| Wilde Mobs | Mobs +30 % Tempo | ×1,3 |
| Große Packs | doppelte Packgröße | ×1,0 |
| Zeitlimit | Run endet nach 10 Minuten | ×1,0 |

Als Daten in modifiers.ts: { id, name, scoreMult, excludes: [] }, damit Teil 2 nur Einträge ergänzt.

## Modi (Presets, Teil 1)
| Modus | Modifikatoren | Punkte |
|---|---|---|
| Normal | – | ×1,0 |
| Hardmode | Halbe Werte | ×2,0 |
| Sprint | Zeitlimit | ×1,0 |
| Eigene Mischung | frei aus den 4 Modifikatoren | Produkt |

Auswahl im Startbildschirm. Teil 2 (nach dem Spells-Merge, nicht jetzt): Frost only, Fire only, Classic, Kein Trinken, Kein Glück.

## Rangliste (nur lokal, kein Tageslauf, kein Seed)
- localStorage "frostgrind.runs.v1", try/catch.
- Pro Run: Datum, Modus + Modifikatoren + Gesamt-Multiplikator, Punkte, Level, Kills, Zeit, größter Pull, längste Combo, bester Multi-Kill, Zone, Todesursache, Spielversion, Notiz (optional). Feld "build" vorsehen, aber leer lassen (füllt Teil 2).
- Ansicht: Tabs pro Modus + "Eigene Mischungen" + "Alle", Top 10, Bestleistung markiert, Filter Spielversion, Klick auf Eintrag = Details.
- Todesbildschirm: Punkte-Aufschlüsselung, Platz im Modus, "Neuer Rekord!".
- Export: Button kopiert JSON in die Zwischenablage. Import: Textfeld zum Einfügen. Kein Datei-Download.
- Aufrufbar im Start- und Esc-Menü.

## Feld build
Text: `Frost Nova (Tiefes Eis), Blizzard · Echo, Weite · Relikt: Frostatem`. Spells mit aktiver Rune, ohne Trinken, dann Supports, dann Relikt. Teile ohne Inhalt fallen weg. Runs vor diesem Stand haben `build: ''`.

## Modi Teil 2
Einträge in `modifiers.ts`, Regeln in `spells/core.ts` (`modRule`, `tagsAllowed`). Punkte `// PH`.

| Modifikator | Wirkung | Punkte | Schließt aus |
|---|---|---|---|
| Nur Frost | Start-Kit Frost Nova, Wirbel, Blizzard, Cone of Cold, Blink, Trinken; nur Karten mit Tag Frost | ×1,2 | Nur Feuer |
| Nur Feuer | Start-Kit Druckwelle, Flammenstoß, Höllenfeuer, Blink, Trinken; keine Frost-Karten | ×1,4 | Nur Frost |
| Kein Trinken | Trinken-Slot entfällt, Level-Up füllt kein Mana auf | ×1,5 | – |
| Classic pur | keine Level-Karten, alle 2 Level ein Rang auf jeden Wert aller Spells | ×1,5 | Kein Glück |
| Kein Glück | Glück bleibt 0, immer 4 Karten | ×1,2 | Classic pur |

Presets: Frost only, Fire only, Classic.

Festlegungen, die die Tabelle offen lässt:
- Supports haben keinen Frost-Tag. Sie bleiben im Angebot, solange sie auf einen erlaubten Spell wirken.
- Talente: Improved Blizzard, Improved Frost Nova, Shatter, Weiter Sturm und Frostrüstung zählen als Frost. Arkane Macht, Arcane Mind und Arcane Meditation tragen keinen Tag: bei Nur Frost fallen sie weg, bei Nur Feuer bleiben sie.
- Nur Feuer: Trinken bleibt auf Slot 6, Blink auf Slot 5, Slot 4 ist frei.
