# Spell- und Upgrade-System

Alle Zahlen sind Design-Werte → im Code // PH.

## Rahmen
- Max. 8 aktive Spells. Neuer Spell bei vollen Slots → Spieler wählt, welcher ersetzt wird.
- Actionbar wächst mit (Tasten 1–8, Keybinds wie bisher erweiterbar).
- Datengetrieben: src/spells/ (ein Spell pro Datei, gleiche Schnittstelle wie die jetzigen),
  src/cards.ts (Kartenarten, Seltenheit, Glück), Tags pro Spell.
- Visuals im Stil der bestehenden Effekte (Partikel + Bloom, Bodendecals).

## Tags
Frost, Arkan, Feuer, Blitz, Schatten, Leere, Natur, Knochen, Fläche, Kanal, Nova, Geschoss, Kette, Bewegung.

## Kartenarten
| Art | Wirkung |
|---|---|
| Rang | +Schaden / −Mana / +Radius für einen Spell, stapelbar |
| Neuer Spell | schaltet Spell aus dem Pool frei |
| Rune | ändert Verhalten eines Spells, 3 pro Spell, nur 1 aktiv (neue ersetzt alte) |
| Support | wirkt auf alle Spells mit Tag X, je Support 1× pro Run |
| Relikt | Boss-Spell, max. 1 pro Run, erst ab Level 30 |

Mindestens eine angebotene Karte betrifft einen Spell, den der Spieler schon hat.

## Seltenheit (jede Karte)
| Stufe | Farbe | Multiplikator | Grundgewicht |
|---|---|---|---|
| 0 | grau | ×0,5 | 30 |
| 1 | weiß | ×1 | 35 |
| 2 | grün | ×2 | 20 |
| 3 | blau | ×3 | 10 |
| 4 | lila | ×4 | 4 |
| 5 | orange | ×5 | 1 |

- Multiplikator × Kartenwert. Neuer Spell/Rune/Support: Wert = +10 % Schaden auf den Spell.
- Relikte nur lila oder orange.
- Kartenrahmen in der Farbe der Seltenheit, Name in der Farbe.

## Glück
- Neuer Spielerwert luck, Start 0. Karte "Glück +5" (mit Seltenheit: grau +2,5 … orange +25).
- Gewicht je Stufe: grundgewicht × (1 + luck/100) ^ stufe
- Karten pro Level-Up: 4 + floor(luck / 25), max. 8
- Glück im Spieler-Frame anzeigen.

## Spell-Pool (neu)
| Spell | Im Spiel | Tags | Runen |
|---|---|---|---|
| Flammenstoß | 2 s Zauber aufs Bodenziel, Treffer + Brandfläche 8 s | Feuer, Fläche | sofort nach Blink · Fläche wandert zum Spieler · doppelter Radius/halber Schaden |
| Druckwelle | Nova mit Rückschlag + 50 % Slow | Feuer, Nova | Sog statt Rückschlag · hinterlässt Feuerring · halbe CD, kein Rückschlag |
| Höllenfeuer | Kanal um dich, kostet Leben statt Mana | Feuer, Schatten, Kanal | heilt pro Kill · laufen erlaubt, halber Schaden · Radius wächst/s |
| Hurrikan | Kanal aufs Bodenziel, Gegner schlagen 25 % langsamer | Natur, Fläche, Kanal | zieht zur Mitte · folgt dir · 1 Blitz/s auf ein Ziel |
| Frostkugel | fliegt 20 yd vorwärts, Splitter rundum, Explosion am Ende | Frost, Geschoss, Fläche | kehrt zurück · bleibt stehen und dreht · Splitter verlangsamen |
| Kettenblitz | bis zu 50 Sprünge in 12 yd, jeder Sprung −2 % Schaden, 1,5 s Zauber | Blitz, Kette | gleiches Ziel mehrfach · Kill = +5 Sprünge · gabelt bei jedem 10. Sprung |
| Leerenkugel | dunkle Kugel aufs Bodenziel 6 s, zieht alle in 15 yd zur Mitte, pulsierender Schattenschaden, bis 40 % Slow nahe Mitte | Schatten, Leere, Fläche | folgt dir · implodiert am Ende (Schaden pro Gefangenem) · 2 kleine Kugeln |
| Wirbel | Nova + Wirbel 6 s am Boden, 30 % Slow | Frost, Nova, Fläche | folgt dir · 3 kleine Wirbel · zieht an |
| Bogenblitz | springt 5× in 10 yd | Blitz, Kette | +3 Sprünge · Schock: Ziele +10 % Schaden · springt über Leichen |

## Runen für das Start-Kit
| Spell | Runen |
|---|---|
| Frost Nova | wiederholt sich von jedem getroffenen Gegner · doppelte Eisdauer, kein Schaden · 2 Ladungen |
| Arcane Explosion | zieht 3 yd an · gratis bei 5+ Treffern · jede 3. gratis |
| Blizzard | laufen erlaubt, halber Schaden · wandert zum Spieler · letzter Tick friert ein |
| Cone of Cold | 360°, halber Schaden · friert statt Slow · CD −5 s pro Kill |
| Blink | Teleport zum Bodenziel, Frostschaden + Kalter Boden an Start/Ziel · Nova am Start · 2 Ladungen |

## Supports
| Support | Tag | Effekt |
|---|---|---|
| Echo | Fläche, Nova (kein Kanal) | wiederholt nach 0,5 s mit 70 % Schaden, +50 % Mana |
| Großes Echo | Fläche, Nova | 2 Wiederholungen, jede größer + stärker |
| Konzentration | Fläche | −30 % Fläche, +40 % Schaden |
| Weite | Fläche | +30 % Fläche, −10 % Schaden |
| Wirksamkeit | Kanal, Dauereffekte | +40 % Dauer, +20 % Schaden über Zeit |
| Kette | Geschoss | springt nach Treffer zu 2 weiteren |
| Knochenkälte | Frost | verlangsamte Gegner +15 % Schaden |
| Blutopfer | Schatten, Feuer | Leben statt Mana |

## Relikte (nur lila/orange, ab Level 30)
| Relikt | Im Spiel | CD |
|---|---|---|
| Zorn des Ragnaros | Feuerschlag 15 yd, alle fliegen weg | 25 s |
| Entweihen | Schattenfläche aufs Bodenziel 10 s, wächst mit jedem Tick, der trifft | 40 s |
| Frostatem | nach 3 s Einschlag, trifft alle in 30 yd mit Sichtlinie, Eingefrorene ×2 | 60 s |
| Frostschlag | friert Ziel 4 s ein, springt als Kette auf jeden in 10 yd | 45 s |
| Feuernova | Feuerring breitet sich auf 40 yd aus | 30 s |
| Knochengefängnis | Knochenring um ein Pack, 6 s gefangen, Kettenblitz + Leerenkugel +50 % darin | 35 s |

## Commits (je einer, nach jedem muss npm run dev laufen)
1. Tags + Spell-Slots (8) + Actionbar 1–8
2. Kartensystem: 4 Karten, Seltenheit, Farben, Glück + mehr Auswahl
3. Runen-System + Runen fürs Start-Kit
4. Supports
5.–7. Spell-Pool: je 3 Spells pro Commit
8. Relikte
9. Dev im Esc-Menü: "Karte erzwingen" (Art + Seltenheit wählen), "Glück +25"
10. entfällt laut Ansage (kein Publish, handoff.md gehört dem Maps-Branch)
