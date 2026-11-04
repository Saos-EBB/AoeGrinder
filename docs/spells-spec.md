# Spell- und Upgrade-System

Alle Zahlen sind Design-Werte → im Code // PH.

## Rahmen
- Max. 8 aktive Spells. Neuer Spell bei vollen Slots → Spieler wählt, welcher ersetzt wird.
- Actionbar wächst mit (Tasten 1–8, Keybinds wie bisher erweiterbar).
- Datengetrieben: src/spells/ (ein Spell pro Datei, gleiche Schnittstelle wie die jetzigen),
  src/cards.ts (Kartenarten, Seltenheit, Glück), Tags pro Spell.
- Visuals im Stil der bestehenden Effekte (Partikel + Bloom, Bodendecals).

## Tags
Frost, Arkan, Feuer, Dunkel, Leere, Knochen, Fläche, Kanal, Nova, Geschoss, Kette, Kontrolle, Bewegung. Blitz tragen seit v23 nur noch die Moves des Streitkolbens (Strichkrieger).

## Kartenarten
| Art | Wirkung |
|---|---|
| Rang | +Schaden / −Mana / +Radius / −Abklingzeit (Phönix, Blink) / +3 yd Reichweite (nur Blink) für einen Spell, stapelbar. Tempo gibt es nur bei den Nahkämpfern (Dauer der Aktion) |
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
| Höllenfeuer | Kanal um dich, 20 Mana pro Tick, heilt 1 % pro Tick | Feuer, Kanal | heilt pro Kill · laufen erlaubt, halber Schaden · Radius wächst/s |
| Frostkugel | fliegt 20 yd vorwärts, Splitter rundum, Explosion am Ende | Frost, Geschoss, Fläche | kehrt zurück · bleibt stehen und dreht · Splitter verlangsamen |
| Leerenkugel | dunkle Kugel aufs Bodenziel 6 s, zieht alle in 15 yd zur Mitte, pulsierender Schattenschaden, bis 40 % Slow nahe Mitte | Schatten, Leere, Fläche | folgt dir · implodiert am Ende (Schaden pro Gefangenem) · 2 kleine Kugeln |
| Wirbel | Nova + Wirbel 6 s am Boden, 30 % Slow | Frost, Nova, Fläche | folgt dir · 3 kleine Wirbel · zieht an |
| Arkane Geschosse | Kanal 3 s aufs nächste Ziel, 5 Geschosse, ersetzt Arkanes Sperrfeuer | Arkan, Geschoss, Kanal | Splitter: Treffer springt auf 1 Mob in 5 yd · Schnellfeuer: Kanal 2 s, gleicher Schaden · Arkane Ladung: letztes Geschoss explodiert 4 yd |
| Arkanes Mal | Bodenziel, markiert alle Mobs in 6 yd für 8 s; trifft ein anderer Arkan-Spell, platzt das Mal mit +80 % des Treffers | Arkan, Fläche, Kontrolle | Lähmendes Mal: 60 % Slow 3 s statt Schaden · Kettenmal: Platzen markiert 1 Mob in 5 yd · Großes Mal: Radius ×1,5 |
| Phönix | passiv, CD 90 s: statt zu sterben Explosion mit Meteor-Schaden ×2,5 in Meteor-Radius ×1,5, Rückstoß, Brandfläche, Aufstehen mit 50 % Leben, 1,5 s unverwundbar | Feuer, Nova | Asche: 100 % Leben · Ewige Glut: CD 60 s · Wiedergeburt: danach 8 s +50 % Schaden |
| Brandmal-Detonation | zündet alle brennenden Mobs in 20 yd: restlicher Brand ×1,5 als Explosion 3 yd um jeden, Brand weg, CD 8 s | Feuer, Fläche | Kettenbrand: Explosion hinterlässt Brand · Großer Knall: 5 yd · Nachglühen: 1 % Leben pro gezündetem Mob |

Brennend heißt: Ein Feuer-Tick einer Fläche oder eines Kanals hat den Mob getroffen. Der Brand hält, solange die Quelle läuft, höchstens 3 s nach dem letzten Tick; restlicher Brand = Schaden pro Tick × verbleibende Sekunden (`burnLeft` in `core.ts`).

Entfernt in v23: Kettenblitz, Bogenblitz, Hurrikan, Arkanes Sperrfeuer.

## Runen für das Start-Kit
| Spell | Runen |
|---|---|
| Frost Nova | wiederholt sich von jedem getroffenen Gegner · doppelte Eisdauer, kein Schaden · 2 Ladungen |
| Arcane Explosion | zieht 3 yd an · gratis bei 5+ Treffern · jede 3. gratis |
| Blizzard | laufen erlaubt, halber Schaden · wandert zum Spieler · letzter Tick friert ein |
| Cone of Cold | 360°, halber Schaden · friert statt Slow · CD −5 s pro Kill |
| Blink | Teleport zum Bodenziel, Frostschaden + Kalter Boden an Start/Ziel · Nova am Start · 2 Ladungen. Blink selbst macht keinen Schaden, Ränge: Reichweite und Abklingzeit |

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
| Knochengefängnis | Knochenring um ein Pack, 6 s gefangen, Leerenkugel + Arkane Geschosse +50 % darin | 35 s |

## ?-Magier (v24)
Ersetzt den Normal-Modus (ID bleibt `normal`, Rangliste läuft weiter, `SCORE_VERSION` trennt). Hardmode, Sprint, Classic und Eigene Mischung behalten das alte Start-Kit, zeigen aber dieselbe Figur. Zahlen in `RANDOM_MAGE`, Logik in `spells/random.ts`, Buffs in `buffs.ts`.
- 4 Tasten (Slots 1–4): Offensiv, Defensiv, Utility, Drink Something. Pools und CDs siehe [Pool-Liste](pool-liste.md).
- Der nächste Wurf steht fest und klein im Slot. Ein Druck wirkt ihn mit normalen Werten, Kosten, Zielen, Zauberzeit und Kanal; sobald er anfängt, startet der Kategorie-CD und der nächste Wurf kommt (`onCastStart`).
- „Nur GCD“ bei Offensiv: einen GCD gibt es seit v22 nicht, deshalb 1 s Kategorie-CD.
- Drink Something: 2 s sitzen mit Requisite und Sitz-Animation des Getränks, bricht ab wie Trinken, wirkt erst am Ende.

| Getränk | Wirkung |
|---|---|
| Goldbecher | 10 s +30 % Tempo, +15 % Crit |
| Feuerschnaps | Mana voll, 10 s +25 % Schaden, am Ende Feuerrülpser (Kegel 6 yd, Schaden wie ein Flammenstoß-Treffer) |
| Heiße Tasse | Gegner in 8 yd 50 % langsamer, solange er sitzt; danach Leben voll über 6 s |
| Tee-Schale | Mana voll, 10 s Abklingzeiten −30 % |

## Anzeige der Schul-Modi (v23, Feuer seit v25 Hitze)
Nur Frost only, Fire only, Arcane only, unter dem Mana-Balken in Schulfarbe. Zahlen in `SCHOOL_METER` (`config.ts`), Logik in `schoolMeter.ts`.
- Frost und Arkan: jeder Kill +2 %, Champion +10 %. 3 s ohne Kill: −5 % pro Sekunde. Voll (pulsiert): Frost +35 % Slow auf jeden Treffer (gesamt höchstens 80 %), Arkan −25 % Abklingzeiten.
- Feuer, **Hitze** 0–100: jeder Feuer-Treffer auf einen Gegner +1,5 (Brand-Ticks nicht), 1,5 s ohne Treffer −10/s. Pro Hitze +0,4 % Schaden auf Treffer und +0,8 % auf Brand-Ticks (bei 100: +40 % und +80 %, der Restbrand der Detonation wächst mit). Bei 100 überhitzt: er brennt selbst mit 3 % Leben/s, bis die Hitze unter 50 fällt. Ein Frost-Zauber (nur über Waffen-Fokus im Pool) halbiert die Hitze. Ab 80 rot, überhitzt pulsiert die Anzeige rot.
- Die Feuer-Stufen der Figur folgen der Hitze, überhitzt volle Flammen und Rauch.
- Die Figur zeigt 4 Stufen (0–24, 25–49, 50–99 %, voll): Feuer mehr Flammen am Körper, Frost Reif und Eiskristalle, Arkan 1, 4, 9, 16 Runen am Körper und Glühen; Fußspuren größer und länger, bis zu 15 statt 10.

## Commits (je einer, nach jedem muss npm run dev laufen)
1. Tags + Spell-Slots (8) + Actionbar 1–8
2. Kartensystem: 4 Karten, Seltenheit, Farben, Glück + mehr Auswahl
3. Runen-System + Runen fürs Start-Kit
4. Supports
5.–7. Spell-Pool: je 3 Spells pro Commit
8. Relikte
9. Dev im Esc-Menü: "Karte erzwingen" (Art + Seltenheit wählen), "Glück +25"
10. entfällt laut Ansage (kein Publish, handoff.md gehört dem Maps-Branch)
