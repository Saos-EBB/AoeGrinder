# Handoff: Figuren, Attacken, Runen und Karten (Stand v30, Branch `magier-neu`)

Aus dem Code gelesen (Spell-Objekte, `MODIFIERS`, `CARDS`, `SUPPORTS`, `RANDOM_MAGE`, `BATTERY`, `BLOOD`, `SCHOOL_METER`). Alle Zahlen sind Platzhalter (`// PH`). Schaden ist der Grundwert auf Level 1 ohne Karten, Seltenheit und Modus-Faktoren. Kosten in Mana, im Blitz only in Ladung, im Blut only in Leben.

## Übersicht

| Figur (Hauptmenü) | Modus | Ressource | Start-Kit | Punkte |
|---|---|---|---|---|
| ?-Magier | `normal` | Mana | Offensiv, Defensiv, Utility, Drink Something (würfeln) | ×1 |
| Eismagier | `frost` | Mana, Kälte-Anzeige | Frost Nova, Wirbel, Blizzard, Cone of Cold, Blink, Trinken, Eisblock | ×1,2 |
| Feuermagier | `fire` | Mana, Hitze | Druckwelle, Flammenstoß, Höllenfeuer, Phönix, Blink, Trinken | ×1,4 |
| Arkanmagier | `arcane` | Mana, Fokus-Anzeige | Arcane Explosion, Leerenkugel, Arkane Geschosse, Arkanes Mal, Blink, Trinken | ×1,4 |
| Blitzmagier | `blitz` | Batterie 0–100 | Kettenblitz, Bogenblitz, Blitzschlag, Kugelblitz, Blink, Aufladen | ×1,4 |
| Blutmagier | `blood` | Leben | Blutpeitsche, Blutsprung, Saugen, Blutwelle, Verkleben, Zerfließen | ×1,4 |
| Strichkrieger | `realmen` | Wut | Schlagfolge, Bodenbrecher, Wirbelwind, Hinrichtung, Letzter Atem, Kampfschrei, Sturzsprung, Essen | ×1 |
| Klingenstrich | `klinge` | keine (Haltung) | Schnitt, Kreisschnitt, Blutwirbel, Aderlass, Schattenklone, Haltung, Strichschnitt, Essen | ×1 |

Hardmode, Sprint, Classic und Eigene Mischung nutzen das alte Strichmagier-Kit (Frost Nova, Arcane Explosion, Blizzard, Cone of Cold, Blink, Trinken) mit der ?-Figur. In den Schul-Modi kommen neue Spells über Karten nur aus der eigenen Schule (plus Waffen-Fokus), in Hardmode, Sprint, Classic und Eigene Mischung aus allen Schulen.

## ?-Magier

Jede Taste würfelt aus ihrer Kategorie, der nächste Wurf steht klein im Slot. Der Spell wirkt mit seinen normalen Werten, Kosten und Zielen; sein eigener CD zählt nicht, nur der der Kategorie. Geht der Wurf gerade nicht (kein Ziel, nichts infiziert, nichts brennt), würfelt der Druck neu, ohne CD.

| Taste | Kategorie | CD | Pool |
|---|---|---|---|
| 1 | Offensiv | 1 s | Arcane Explosion, Arkane Woge, Arkane Geschosse, Feuerball, Flammenstoß, Meteor, Brandmal-Detonation, Frostkugel, Eislanze, Blizzard, Blitzschlag, Kugelblitz, Entladung, Gewitter, Kettenblitz, Bogenblitz, Blutpeitsche |
| 2 | Defensiv | 6 s | Frost Nova, Eisblock, Druckwelle, Cone of Cold, Wirbel, Gletscherspalte, Höllenfeuer, Blutwelle, Saugen |
| 3 | Utility | 5 s | Blink, Leerenkugel, Arkanes Mal, Verkleben, Blutsprung |
| 4 | Drink Something | 30 s | Goldbecher, Feuerschnaps, Heiße Tasse, Tee-Schale |

**Drink Something:** 2 s sitzen mit Requisite und Sitz-Animation des Getränks, bricht ab wie Trinken, wirkt erst am Ende.

| Getränk | Wirkung |
|---|---|
| Goldbecher | 10 s +30 % Tempo, +15 % Crit |
| Feuerschnaps | Mana voll, 10 s +25 % Schaden, am Ende Feuerrülpser (Kegel 6 yd, Schaden wie Flammenstoß) |
| Heiße Tasse | Gegner in 8 yd 50 % langsamer, solange er sitzt; danach Leben voll über 6 s |
| Tee-Schale | Mana voll, 10 s Abklingzeiten −30 % |

**Karten:** keine Spell- und Runen-Karten. Rang-Karten: Offensiv +15 % Schaden auf alle Offensiv-Spells, Defensiv +10 % Dauer und Radius, Utility −10 % Abklingzeit der Kategorie. Supports, Relikte, Talente (aller Schulen, ohne „nur Modus“) und Glück bleiben. Waffen-Fokus wirkt, wenn der Spell gewürfelt wird.

## Eismagier (Frost only)

Nur Frost-Spells und -Karten, Blink und Trinken bleiben. Jeder Frost-Treffer verlangsamt 20 % für 2 s. **Kälte-Anzeige:** +2 % pro Kill, Champion +10 %, nach 3 s ohne Kill −5 %/s. Voll: +35 % Slow auf jeden Treffer (höchstens 80 %). Eisblock (Taste, 6 s unverwundbar, CD 90 s) gibt es nur hier. Dodge-Kombo: Mini-Nova am Startpunkt.

**Start-Kit:** Frost Nova, Wirbel, Blizzard, Cone of Cold, Blink, Trinken, Eisblock

| Spell | Was | Tags | Kosten | CD | Zeit | Runen |
|---|---|---|---|---|---|---|
| Eisblock | 6 s unverwundbar, keine Aktion, kein Laufen. Erneut drücken beendet ihn. | Frost | – | 90 s | sofort | – |
| Frost Nova | Friert Gegner um dich bis zu 8 s ein. | Frost, Nova | 55 Mana | 25 s | sofort | **Kaltes Echo**: Wiederholt sich von jedem getroffenen Gegner. · **Tiefes Eis**: Doppelte Eisdauer, kein Schaden. · **Zweiter Frost**: 2 Ladungen. |
| Blizzard | Kanal aufs Bodenziel, 8 Ticks. | Frost, Fläche, Kanal | 320 Mana | – | Kanal 8 s | **Wandelnder Sturm**: Laufen erlaubt, halber Schaden. · **Treibender Sturm**: Wandert zum Spieler. · **Letzter Frost**: Letzter Tick friert ein. |
| Cone of Cold | Kegel vor dir, verlangsamt um 50 %. | Frost, Fläche | 210 Mana | 10 s | sofort | **Eisring**: 360°, halber Schaden. · **Eiskegel**: Friert statt Slow. · **Kalte Ernte**: CD −5 s pro Kill. |
| Frostkugel | Fliegt 20 yd vorwärts, Splitter rundum, Explosion am Ende. | Frost, Geschoss, Fläche | 180 Mana | 8 s | sofort | **Bumerang**: Kehrt zurück. · **Eisstern**: Bleibt stehen und dreht. · **Kalte Splitter**: Splitter verlangsamen. |
| Wirbel | Nova + Wirbel 6 s am Boden, 30 % Slow. | Frost, Nova, Fläche | 140 Mana | 15 s | sofort | **Eisläufer**: Folgt dir. · **Dreifach**: 3 kleine Wirbel. · **Mahlstrom**: Zieht an. |
| Eislanze | Durchbohrt alles auf 20 yd vor dir, Eingefrorene nehmen doppelten Schaden. | Frost, Geschoss | 70 Mana | 4 s | sofort | **Breite Lanze**: Doppelte Breite. · **Kalte Spitze**: Getroffene sind 3 s 40 % langsamer. · **Schnelle Lanze**: Halbe CD, −25 % Schaden. |
| Gletscherspalte | Bodenziel: Nach 1 s bricht das Eis auf, Schaden und 3 s eingefroren. | Frost, Fläche | 240 Mana | 18 s | sofort | **Sofortbruch**: Bricht ohne Verzögerung auf. · **Nachbeben**: Bricht 2 s später mit 50 % Schaden erneut auf. · **Weite Spalte**: +50 % Radius, friert nicht ein. |

## Feuermagier (Fire only)

Nur Feuer-Spells und -Karten. Dauerschaden mit Tag Feuer ×1,5, Grund-Crit 15 %, Leben ×0,9. **Hitze** 0–100: jeder Feuer-Treffer auf einen Gegner +1,5 (Brand-Ticks nicht), nach 1,5 s ohne Treffer −10/s. Pro Hitze +0,4 % Schaden auf Treffer und +0,8 % auf Brand-Ticks (bei 100: +40 % / +80 %). Bei 100 überhitzt: 3 % Leben/s Selbstschaden, bis unter 50. Ein Frost-Zauber (nur per Waffen-Fokus) halbiert die Hitze. Brennend = von einem Feuer-Tick getroffen, hält höchstens 3 s nach dem letzten Tick. Dodge-Kombo: nächster Feuerball crittet.

**Start-Kit:** Druckwelle, Flammenstoß, Höllenfeuer, Phönix, Blink, Trinken

| Spell | Was | Tags | Kosten | CD | Zeit | Runen |
|---|---|---|---|---|---|---|
| Phönix | Passiv: Stirbst du, explodierst du stattdessen mit 2,5-fachem Meteor-Schaden und stehst mit 50 % Leben wieder auf. CD 90 s. | Feuer, Nova | – | 90 s | sofort | **Asche**: Aufstehen mit 100 % Leben. · **Ewige Glut**: CD 60 s. · **Wiedergeburt**: Nach dem Aufstehen 8 s +50 % Schaden. |
| Brandmal-Detonation | Zündet alle brennenden Mobs in 20 yd: restlicher Brandschaden sofort ×1,5 als Explosion 3 yd um jeden, der Brand erlischt. | Feuer, Fläche | 160 Mana | 8 s | sofort | **Kettenbrand**: Jede Explosion hinterlässt Brand. · **Großer Knall**: Explosion 5 yd. · **Nachglühen**: Heilt 1 % Leben pro gezündetem Mob. |
| Flammenstoß | 0,5 s Zauber aufs Bodenziel, Treffer + Brandfläche 8 s. | Feuer, Fläche | 195 Mana | – | Zauber 0,5 s | **Heißer Sprung**: Sofort nach Blink. · **Feuerspur**: Fläche wandert zum Spieler. · **Flächenbrand**: Doppelter Radius, halber Schaden. |
| Druckwelle | Nova mit Rückschlag und 50 % Slow. | Feuer, Nova | 150 Mana | 12 s | sofort | **Implosion**: Sog statt Rückschlag. · **Feuerring**: Hinterlässt einen Feuerring. · **Kurzer Stoß**: Halbe CD, kein Rückschlag. |
| Höllenfeuer | Kanal um dich, kostet 20 Mana pro Tick und heilt dich um 1 % pro Tick. | Feuer, Kanal | – | – | Kanal 15 s | **Seelenernte**: Heilt pro Kill. · **Brennender Gang**: Laufen erlaubt, halber Schaden. · **Ausbreitung**: Radius wächst pro Sekunde. |
| Feuerball | 0,35 s Zauber aufs nächste Ziel, explodiert mit 50 % Schaden drumherum. | Feuer, Geschoss | 110 Mana | – | Zauber 0,35 s | **Große Explosion**: +75 % Radius. · **Entzünden**: Hinterlässt 4 s Brandfläche. · **Schnellwurf**: Sofort, −40 % Schaden. |
| Meteor | Bodenziel: Schlägt nach 1,5 s ein und lässt eine Brandfläche für 6 s zurück. | Feuer, Fläche | 320 Mana | 20 s | sofort | **Meteorschauer**: 3 kleine Meteore mit halbem Schaden und Radius. · **Glutkrater**: Brandfläche hält doppelt so lang. · **Einschlag**: Schleudert Gegner weg. |

## Arkanmagier (Arcane only)

Nur Arkan-Spells und -Karten. Zaubern und Kanäle im Laufen, Blink mit 2 Ladungen, Leben ×0,85, Manakosten ×1,15, schwebt, +10 % Tempo. **Fokus-Anzeige:** wie Kälte (Kills), voll −25 % Abklingzeiten. Arkanes Mal platzt bei jedem anderen Arkan-Treffer (+80 % des Treffers). Dodge-Kombo: nächster Zauber sofort.

**Start-Kit:** Arcane Explosion, Leerenkugel, Arkane Geschosse, Arkanes Mal, Blink, Trinken

| Spell | Was | Tags | Kosten | CD | Zeit | Runen |
|---|---|---|---|---|---|---|
| Arcane Explosion | Arkane Explosion um dich. | Arkan, Nova | 75 Mana | – | sofort | **Arkaner Sog**: Zieht Gegner 3 yd an. · **Überladung**: Gratis bei 5+ Treffern. · **Rhythmus**: Jede 3. gratis. |
| Blink | 20 yd vorwärts, löst Betäubung. Kein Schaden. | Arkan, Bewegung | 80 Mana | 15 s | sofort | **Eisportal**: Teleport zum Bodenziel, Frostschaden + Kalter Boden an Start und Ziel. · **Frostabschied**: Nova am Start. · **Doppelsprung**: 2 Ladungen. |
| Leerenkugel | Dunkle Kugel aufs Bodenziel 6 s, zieht alle in 15 yd zur Mitte, Arkanschaden, bis 40 % Slow nahe der Mitte. | Arkan, Leere, Fläche | 350 Mana | 30 s | sofort | **Leerenbegleiter**: Folgt dir. · **Implosion**: Implodiert am Ende, Schaden pro Gefangenem. · **Zwillinge**: 2 kleine Kugeln. |
| Arkane Geschosse | Kanal 3 s aufs nächste Ziel, 5 Geschosse. | Arkan, Geschoss, Kanal | 140 Mana | – | Kanal 3 s | **Splitter**: Jeder Treffer springt auf 1 Mob in 5 yd (50 %). · **Schnellfeuer**: Kanal 2 s, gleicher Schaden. · **Arkane Ladung**: Das letzte Geschoss explodiert in 4 yd. |
| Arkanes Mal | Bodenziel: markiert alle Mobs in 6 yd für 8 s. Trifft ein anderer Arkan-Spell, platzt das Mal: +80 % des Treffers als Extra-Schaden. | Arkan, Fläche, Kontrolle | 120 Mana | 6 s | sofort | **Lähmendes Mal**: Platzen verlangsamt um 60 % für 3 s statt Extra-Schaden. · **Kettenmal**: Platzen markiert 1 Mob in 5 yd neu. · **Großes Mal**: Radius ×1,5. |
| Arkane Woge | Welle 16 yd nach vorn, 6 yd breit. | Arkan, Fläche | 130 Mana | 6 s | sofort | **Breite Woge**: +50 % Breite. · **Rücksog**: Zieht Getroffene 8 yd zu dir. · **Doppelwoge**: Zweite Welle nach 0,4 s mit 60 % Schaden. |

## Blitzmagier (Blitz only)

Nur Blitz-Spells und -Karten, Blink bleibt. **Batterie** statt Mana: 0–100, Start 50, +8/s, +3 pro getroffenem Gegner. Spells kosten `charge` oder Mana/8. Voll = überladen: keine Regeneration, der nächste Blitz-Zauber macht ×2 Schaden und betäubt alle Getroffenen 0,5 s (Root: kein Laufen, kein Schlag), danach 0. **Aufladen** statt Trinken: 2 s stehen, +60 Ladung.

**Start-Kit:** Kettenblitz, Bogenblitz, Blitzschlag, Kugelblitz, Blink, Aufladen

| Spell | Was | Tags | Kosten | CD | Zeit | Runen |
|---|---|---|---|---|---|---|
| Kettenblitz | Bis zu 100 Sprünge in 12 yd, jeder Sprung −2 % Schaden, 0,35 s Zauber. | Blitz, Kette | 35 Ladung | 6 s | Zauber 0,35 s | **Wiederkehr**: Gleiches Ziel mehrfach. · **Entladung**: Kill = +10 Sprünge. · **Gabelung**: Gabelt bei jedem 10. Sprung. · **Überschlag**: +40 Sprünge. |
| Bogenblitz | Springt 10× in 10 yd. | Blitz, Kette | 11 Ladung | 3 s | sofort | **Weiter Bogen**: +6 Sprünge. · **Schock**: Ziele nehmen +10 % Schaden. · **Totenleiter**: Springt über Leichen. · **Funkenregen**: +8 Sprünge, zweimal wählbar. |
| Blitzschlag | Bodenziel: harter Schlag in 3 yd, betäubt 0,5 s. | Blitz, Fläche, Kontrolle | 20 Ladung | 2 s | sofort | **Doppelschlag**: Ein zweiter Schlag nach 0,4 s mit 50 %. · **Weiter Schlag**: Doppelter Radius. · **Lange Betäubung**: Betäubt 1,5 s. · **Dreifachschlag**: 3 Schläge mit je 60 %. |
| Kugelblitz | Langsame Kugel 20 yd nach vorn, zappt alle 0,5 s alles in 5 yd. | Blitz, Geschoss, Fläche | 25 Ladung | 6 s | sofort | **Großkugel**: +40 % Radius. · **Träge Kugel**: Halbes Tempo, zappt doppelt so lange. · **Zwillingskugel**: 2 Kugeln im Fächer mit je 70 % Schaden. · **Schnellzapper**: Zappt alle 0,25 s. |
| Entladung | Nova 8 yd, verbraucht die ganze Ladung: Schaden = Ladung × 1,5. | Blitz, Nova | 0 Ladung | 4 s | sofort | **Restladung**: Behält 30 % der Ladung. · **Weite Entladung**: Radius 12 yd. · **Schockwelle**: Betäubt 1 s. · **Nachentladung**: Zweite Nova nach 0,5 s mit 50 %. |
| Gewitter | Bodenziel: Gewitter 8 s, alle 0,5 s ein Blitz auf einen zufälligen Gegner darin. | Blitz, Fläche | 35 Ladung | 12 s | sofort | **Doppelblitz**: 2 Blitze pro Takt. · **Wanderndes Gewitter**: Folgt dir. · **Großes Gewitter**: Radius 12 yd. · **Blitzhagel**: 3 Blitze pro Takt. |

Blink im Blitz only: 10 Ladung, Ränge Reichweite und Abklingzeit.

## Blutmagier (Blut only)

Zauber kosten Leben (Anteil der max. Leben), −40 % Leben, +40 % Schaden, bei weniger Leben mehr Schaden (bei 0 Leben +60 %, linear). Kein Trinken, keine Regeneration außerhalb des Kampfes. **Infekt** (passiv): jeder Treffer eines Blut-Spells hängt 4 s an, höchstens 5 Stapel = 20 s; pro Sekunde 1 % der Mob-Leben × Stapel als fester Schaden, du heilst um denselben Betrag. **Blutlachen** bei Sprung-Landung und beim Tod eines Infizierten: 6 s, 3 yd, Gegner 20 % langsamer und 5 Schaden/s (mit Infekt), du heilst darin 1 %/s, höchstens 8. Blut-Spells haben noch keine Runen.

**Start-Kit:** Blutpeitsche, Blutsprung, Saugen, Blutwelle, Verkleben, Zerfließen

| Spell | Was | Tags | Kosten | CD | Zeit | Runen |
|---|---|---|---|---|---|---|
| Blutpeitsche | Kegel 6 yd vor dir, legt Infekt. | Blut, Fläche | 2 % Leben | – | sofort | – |
| Blutsprung | Halten lädt (0,2 s → 6 yd bis 1,2 s → 18 yd), Loslassen springt. Landung: Schaden in 4 yd, Rückstoß, Infekt, Blutlache. In der Luft nicht angreifbar. | Blut, Bewegung, Fläche | 4 % Leben | 8 s | sofort | – |
| Saugen | Kanal 3 s: Blutfäden zu allen Gegnern in 6 yd, alle 0,5 s Schaden, Heilung und Infekt. Laufen bricht ab. | Blut, Kanal, Heilung | 5 % Leben | 6 s | Kanal 3 s | – |
| Blutwelle | Welle 12 yd nach vorn, 6 yd breit, schiebt Gegner 5 yd weg, Infekt. | Blut, Fläche, Kontrolle | 4 % Leben | 5 s | sofort | – |
| Verkleben | Nur infizierte Gegner in 15 yd: werden zur Mitte ihres Klumpens gezogen und kleben 2 s fest. | Blut, Kontrolle | 3 % Leben | 10 s | sofort | – |
| Zerfließen | Du zerfließt 3 s zu einer Lache bis 15 yd (nicht angreifbar, kein Zaubern, Infekt darin). Dann reißt das Blut alle darin zur Mitte und betäubt sie 2 s. | Blut, Fläche, Kontrolle | 10 % Leben | 45 s | sofort | – |

## Strichkrieger (`realmen`)

Wut statt Mana (`player.mana`), mehr Wut und weniger Leben machen mehr Schaden, 25 % Rüstung. Waffe wird vor dem Run gewählt. Zahlen in `REALMEN` (`realMen.ts`). Ränge: Schaden, Radius, Tempo (= kürzere Aktion).

**Riesenschwert (Standard):**

| Attacke | Was | Tags | Kosten | CD | Runen |
|---|---|---|---|---|---|
| Schlagfolge | Vier Schläge, der vierte ein Sprung-Smash. Bringt Wut. | Krieger, Nahkampf, Fläche | 0 Wut | – | **Weiter Schwung**: +50 % Radius. · **Blutdurst**: Heilt 1 % Leben pro getroffenem Mob. · **Wutschlag**: +50 % Wut pro Schlag. |
| Bodenbrecher | Klinge in den Boden, Risse laufen 8 yd nach vorn und schleudern weg. | Krieger, Nahkampf, Linie, Fläche | 15 Wut | 8 s | **Tiefe Risse**: Risse laufen 5 yd weiter. · **Erdstoß**: Betäubt 1 s. · **Zweiter Stoß**: 2 Ladungen. |
| Wirbelwind | Halten: trifft alles um dich, kostet Wut pro Sekunde. | Krieger, Nahkampf, Fläche | 0 Wut | – | **Sturmschritt**: Volles Lauftempo im Wirbel. · **Rasender Tanz**: Halbe Wutkosten, −20 % Schaden. · **Mahlstrom**: Zieht Mobs zu dir. |
| Hinrichtung | Langes Ausholen, ein gewaltiger Schlag im Kegel vor dir. | Krieger, Nahkampf, Fläche | 35 Wut | 12 s | **Gnadenstoß**: Doppelter Schaden unter 30 % Leben des Ziels. · **Breite Klinge**: +50 % Kegel. · **Blutgier**: Ein Kill gibt 30 Wut. |
| Letzter Atem | Schwert in den Boden, Brüllen: 5 s nicht unter 1 Leben, Wut voll. | Krieger | 0 Wut | 60 s | – |
| Kampfschrei | +40 Wut und eine Druckwelle, die Mobs wegstößt. | Krieger | 0 Wut | 20 s | **Zorniger Schrei**: +70 statt +40 Wut. · **Schreckensschrei**: Betäubt Mobs in 8 yd für 2 s. · **Schockwelle**: Die Druckwelle macht Schaden. |
| Sturzsprung | 10 yd Sprung, in der Luft nicht angreifbar. Die Landung schleudert weg. | Krieger, Nahkampf, Bewegung, Fläche | 15 Wut | 10 s | **Beben**: +50 % Radius. · **Einschlag**: Betäubt 2 s. · **Hast**: Halbe Abklingzeit. |
| Essen | Sitzen und in 18 s alles Leben auffüllen. Bewegung oder Angriff bricht ab, Schaden nicht. | Krieger | 0 Wut | – | – |

**Holzfälleraxt:** ×0,85 Schaden, 8 % Lebensraub. Ersetzt Q, E und Maus 4:
| Attacke | Was | Runen |
|---|---|---|
| Hackfolge | Drei Schläge, der dritte spaltet den Boden. Bringt Wut. | – |
| Kahlschlag | Zieht die Axt rundum, 5 yd. Heilt 1 % Leben pro Gegner, Lebensraub zählt doppelt. | **Weite Ernte**: +2 yd Radius pro Stufe (2 Stufen) · **Gierige Klinge**: 2 % statt 1 % pro Gegner · **Zweiter Schwung**: nach 0,5 s noch einmal mit 50 % |
| Fällen | Linie 6 × 2 yd, dreifacher Schaden. Unter 20 % Leben sterben Gegner sofort und heilen 2 %. | – |

**Streitkolben:** ×0,7 Schaden, schneller; 20 % Chance auf Kettenblitz (3 Sprünge, 40 %). Ersetzt Q, E und Maus 4:
| Attacke | Was | Runen |
|---|---|---|
| Donnerfolge | Vier schnelle Schläge, der vierte schießt einen Blitz 12 yd nach vorn. | – |
| Donnerschlag | Blitzring 6 yd, betäubt 1,5 s. | **Weiter Ring**: +2 yd · **Überladung**: Kettenblitz sicher · **Nachhall**: 1 s später zweiter Ring mit 50 % |
| Kugelblitz | Blitzkugel fliegt 15 yd, alle 0,3 s Blitze in 4 yd. | – |

Die Runen-Freischaltungen im Shop gelten pro Slot, also für alle drei Waffen gemeinsam.

## Klingenstrich (`klinge`)

Zwei Katanas, keine Ressource, nur Abklingzeiten. Haltung Einhand oder Zweihand (Taste Haltung), Blutung statt Crits. Zahlen in `KLINGE` (`klinge.ts`). Eigene Tasten (Q, E, R, Maus 4/5, 1–3).

| Attacke | Was | Tags | CD | Runen |
|---|---|---|---|---|
| Schnitt | Schlag-Kette, ein Schlag pro Druck. Einhand 3 Schläge, der letzte trifft beim Wegstecken. Zweihand 4 Schläge bis zum Wirbelsprung. | Klinge, Nahkampf, Fläche, Schnitt | – | **Weiter Bogen**: Kegel 180°, zweite Stufe 360°. · **Nachhall**: Zweiter Schnitt nach 0,3 s mit 50 %. · **Lange Klinge**: +1 yd Radius pro Stufe. |
| Kreisschnitt | Drehung um dich, verlangsamt 40 % für 3 s. | Klinge, Nahkampf, Fläche, Kontrolle | 4 s | **Eisschnitt**: Friert 1 s ein statt zu verlangsamen. · **Sog**: Zieht Mobs 2 yd zu dir. · **Doppelte Drehung**: 2 Ladungen. |
| Blutwirbel | Zieht Mobs an, sie kreisen um dich, am Ende fliegen sie weg. Du gehst mit 50 % Tempo. | Klinge, Nahkampf, Fläche, Kontrolle | 25 s | **Jäger**: Folgt der Maus. · **Gerichteter Wurf**: Wirft alle nach vorn statt rundum. · **Langer Wirbel**: +1 s Dauer. |
| Aderlass | Alle blutenden Mobs in 15 yd nehmen sofort ihre restliche Blutung ×1,5. | Klinge, Blutung, Fläche | 6 s | **Übersprung**: Gezündete Stapel springen auf 1 Mob in 5 yd über. · **Blutzoll**: Kill durch Aderlass: −3 s Blutwirbel-Abklingzeit. · **Lebenssaft**: Heilt 10 % des Schadens. |
| Schattenklone | Zwei Klone neben dir machen 8 s jeden Move mit, 50 % Schaden. | Klinge | 60 s | – |
| Haltung | Wechselt zwischen Einhand und Zweihand. Der erste Treffer danach macht +30 %. | Klinge | 1 s | **Wechselschnitt**: Der Wechsel macht einen kleinen Kreisschnitt. · **Überraschung**: Wechsel-Bonus +60 % statt +30 %. · **Fließender Wechsel**: Wechsel ohne Abklingzeit. |
| Strichschnitt | Sprint, dabei nicht angreifbar. Danach trifft es alles auf der Linie. | Klinge, Nahkampf, Bewegung, Linie | 5 s | **Nachsetzen**: Ein Kill setzt eine Ladung zurück. · **Blutspur**: Zweihand: Wer über die Linie läuft, blutet. · **Rückstrich**: Zurück zum Start, schneidet erneut. |
| Essen | Sitzen und in 18 s alles Leben auffüllen. Bewegung oder Angriff bricht ab, Schaden nicht. | Klinge | – | – |

## Alte Strichmagier-Spells (Hardmode, Sprint, Classic, Eigene Mischung)

Start-Kit: Frost Nova, Arcane Explosion, Blizzard, Cone of Cold, Blink, Trinken (18 s, 90 % Mana und 50 % Leben). Danach kommen über Karten alle Spells aller Schulen in Frage (Tabellen oben).

## Relikte (ab Level 30, nur lila oder orange, 1 pro Run)

| Relikt | Was | Tags | CD |
|---|---|---|---|
| Zorn des Ragnaros | Feuerschlag 15 yd, alle fliegen weg. | Feuer, Nova | 25 s |
| Entweihen | Dunkle Fläche aufs Bodenziel 10 s, wächst mit jedem Tick, der trifft. Dunkel-Schaden trifft immer, ignoriert die Rüstung und heilt dich. | Dunkel, Fläche | 40 s |
| Frostatem | Nach 3 s Einschlag, trifft alle in 30 yd mit Sichtlinie, Eingefrorene ×2. | Frost, Fläche | 60 s |
| Frostschlag | Friert Ziel 4 s ein, springt als Kette auf jeden in 10 yd. | Frost, Kette | 45 s |
| Feuernova | Feuerring breitet sich auf 40 yd aus. | Feuer, Nova | 30 s |
| Knochengefängnis | Knochenring um ein Pack, 6 s gefangen, Leerenkugel + Arkane Geschosse +50 % darin. | Knochen, Fläche | 35 s |

## Supports (je 1× pro Run, wirken auf alle Spells mit dem Tag)

| Support | Tags | Wirkung |
|---|---|---|
| Echo | Fläche, Nova | Wiederholt nach 0,5 s mit 70 % Schaden, +50 % Mana. Kein Kanal. |
| Großes Echo | Fläche, Nova | 2 Wiederholungen, jede größer und stärker. Kein Kanal. |
| Konzentration | Fläche | −30 % Fläche, +40 % Schaden. |
| Weite | Fläche | +30 % Fläche, −10 % Schaden. |
| Wirksamkeit | Kanal | Kanäle und Dauereffekte: +40 % Dauer, +20 % Schaden über Zeit. |
| Kette | Geschoss | Springt nach Treffer zu 2 weiteren. |
| Knochenkälte | Frost | Verlangsamte Gegner nehmen +15 % Schaden. |
| Blutopfer | Dunkel, Feuer | Leben statt Mana. |

## Karten

Pro Level-Up 4 Karten (+1 je 25 Glück, höchstens 8). Arten: Rang, Neuer Spell, Rune, Support, Relikt, Talent, Glück. Mindestens eine Karte betrifft einen eigenen Spell. Seltenheit multipliziert den Kartenwert:

| grau | weiß | grün | blau | lila | orange |
|---|---|---|---|---|---|
| ×0,5 | ×1 | ×2 | ×3 | ×4 | ×5 |

**Rang-Karten** (pro Spell im Slot, Werte bei weiß ×1):
| Rang | Wirkung | Wer |
|---|---|---|
| Schaden | +15 % Schaden | fast alle |
| Mana | −10 % Kosten (Untergrenze 10 %) | Magier-Spells |
| Radius | +10 % Radius | Flächen-Spells |
| Abklingzeit | −10 % CD (Untergrenze 30 %) | Phönix, Blink, Utility (?-Magier) |
| Reichweite | +3 yd | nur Blink |
| Dauer | +10 % Dauer und Radius | Defensiv (?-Magier) |
| Tempo | +10 % schnellere Aktion | Strichkrieger, Klingenstrich |

**Neuer Spell, Rune, Support, Relikt:** jeweils zusätzlich +10 % Schaden auf den Spell (× Seltenheit). Runen: 3 pro Spell (Blitz-Spells 4), nur eine aktiv, eine neue ersetzt die alte. Im Shop: 1. Rune grün (frei), 2. blau, 3. und 4. lila (gesperrt, mit Staub freischalten).

**Talente nach Figur:**

Alle Magier (Schule muss passen, im ?-Magier alle ohne „nur“):

| Karte | Wirkung (bei weiß ×1) | max. Ränge | Hinweis |
|---|---|---|---|
| Improved Blizzard | Blizzard verlangsamt Gegner um 30 % für 1,5 s. | 2 | nur mit Blizzard |
| Improved Frost Nova | Frost Nova Abklingzeit −2 s. | 2 | nur mit Frost Nova |
| Shatter | +10 % kritische Trefferchance gegen eingefrorene Ziele. | 3 | – |
| Arkane Macht | +12 % Zauberschaden. | 5 | – |
| Arcane Mind | +10 % maximales Mana. | 3 | – |
| Arcane Meditation | +5 % Mana-Regeneration während der 5-Sekunden-Regel. | 3 | – |
| Weiter Sturm | Blizzard-Radius +2 yd. | 2 | nur mit Blizzard |
| Arkane Effizienz | Arcane Explosion kostet 15 % weniger Mana. | 2 | nur mit Arcane Explosion |
| Frostrüstung | +15 % maximale Gesundheit. | 3 | – |

Nur im Schul-Modus:

| Karte | Wirkung (bei weiß ×1) | max. Ränge | Hinweis |
|---|---|---|---|
| Eisherz | +12 % Zauberschaden. | 5 | – |
| Glutherz | +12 % Zauberschaden. | 5 | – |
| Leitfähigkeit | Kettenblitz +20 Sprünge, Bogenblitz +4 Sprünge. | 3 | – |
| Gewitterkaskade | Alle Sprünge von Kettenblitz und Bogenblitz ×2. | 1 | immer orange, 15 % Chance im Angebot |
| Donnerhall | Blitzschlag schlägt 1 Mal mehr nach (50 %). | 2 | nur mit Blitzschlag |
| Sturmfront | Gewitter: +1 Blitz pro Takt. | 2 | nur mit Gewitter |
| Kugelnetz | Kugelblitz zappt doppelt so oft. | 2 | nur mit Kugelblitz |
| Sturmherz | +12 % Zauberschaden. | 5 | – |
| Glutseele | +10 % maximales Mana. | 3 | – |

Nur Nahkampf (Strichkrieger, Klingenstrich):

| Karte | Wirkung (bei weiß ×1) | max. Ränge | Hinweis |
|---|---|---|---|
| Kampfkunst | +12 % Schaden. | 5 | – |
| Knochenpanzer | +15 % maximale Gesundheit. | 3 | – |

In allen Modi:

| Karte | Wirkung (bei weiß ×1) | max. Ränge | Hinweis |
|---|---|---|---|
| Ausweichrolle | +1 Dodge-Ladung. | 1 | – |
| Kombo-Meister | Kombo-Fenster nach dem Dodge +50 %. | 2 | – |

**Glück:** +5 pro Karte (× Seltenheit): bessere Seltenheit (Gewicht × (1 + Glück/100)^Stufe) und mehr Karten.

## Waffen (Magische Kiste, nur Magier)

Kiste 120 Staub, Inventar 15. Schichten: Typ (Stab, Zauberstab, Buch, Relikt), Kopf mit Fokus-Spell (+8 % Schaden, +4 % Radius bei weiß; außerhalb der Schule kommt er in den Pool), Schaft mit Hauptwert, Element, Hersteller, ab lila Anhänger, orange Unikat-Modell.

| Element | Wirkung pro Treffer (5 % Chance bei weiß × Seltenheit) |
|---|---|
| Frost | 20 % Slow für 2 s |
| Feuer | Brand: 30 % des Treffers über 3 s |
| Arkan | 2 % Mana zurück |
| Blitz | Kettenblitz: 40 % auf 3 Mobs in 6 yd |
| Blut | +1 Infekt-Stapel |
| Dunkel | True Damage, heilt 20 % |

Alte Waffen: Gift → Blut, Void → Arkan; Fokus Kettenblitz/Bogenblitz/Sperrfeuer → Arkane Geschosse, Hurrikan → Blizzard (nur Waffen von vor v26).

## Offen
- Blut-Spells ohne Runen, einige Icons fehlen (Eisblock, Blut-Spells, Kugelblitz, Gewitter).
- Dunkel ist kein Spiel-Element einer Schule, aber als Waffen-Element noch drin (Kevin entscheidet).
- Kettenblitz verliert 2 % pro Sprung: ab etwa 100 Sprüngen kaum noch Schaden pro Sprung.
- Alles per Skript getestet, nicht von Hand gespielt.
