# Punkte, Rangliste und Modi (Teil 1)

Alle Zahlen sind Design-Werte (`// PH`).

## Punkte
Punkte pro Kill = XP × M_multi × M_combo × M_modus
- XP: wie bisher (Classic-Formel), graue Mobs = 0
- Multi-Kill: Kills mit gleicher source-ID (Spell-ID aus damageMob), die höchstens 1,2 s auseinanderliegen, zählen als ein Cast. M_multi = 1 + 0,1 × (n − 1), max ×5. Später ersetzt der Spells-Agent das durch eine echte Cast-ID; score.ts liest nur ein Feld "castKey".
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
