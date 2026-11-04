# Pool-Liste: Vorschlag Startset und Shop

Stand 2026-11-04 (v23), aus dem Code gelesen. **Vorschlag, Kevin entscheidet.** Seltenheit gibt es für diese Einträge im Spiel noch nicht (Karten würfeln sie beim Ziehen), sie ist hier neu vergeben und zählt nur für den Shop.

## Shop-Stufen

| Abschluss | Stufe | Angebot bis |
|---|---|---|
| Belagerung 5 min | 1 | blau |
| Belagerung 10 min | 2 | blau, dazu einzelne lila |
| Belagerung 15 min, Packs bis Level 100 | 3 | lila |
| Belagerung endlos ab 20 min, Packs mit 1 Mod | 5 | orange |
| jeder weitere Mod | +1 | siehe offene Fragen |

## Magische Kiste (120 Staub)

Keine feste Waffen-Tabelle mehr: Die Kiste würfelt eine Magier-Waffe aus Schichten (Typ, Kopf mit Fokus-Spell, Schaft, Element, Hersteller, Seltenheit), Inventar höchstens 15. Ab orange kommt eins der alten Modelle als Unikat. Zahlen in `ROLLS` (`src/weaponRolls.ts`), Fokus-Spells in `FOCUS_SPELLS`. Waffen mit dem Fokus eines entfernten Spells bleiben gültig und wirken auf den Ersatz: Kettenblitz, Bogenblitz und Arkanes Sperrfeuer → Arkane Geschosse, Hurrikan → Blizzard. Das bleibt für Waffen von vor v26 so; neue Waffen (`s.fv`) können Kettenblitz und Bogenblitz wirklich als Fokus haben. Kopf Gabel = Blitz.

## Spells

Alle frei. Trinken, Eisblock, die Krieger- und die Klingenstrich-Moves gehören fest zum Modus.

| Name | Schule | Tags |
|---|---|---|
| Frost Nova | Frost | Frost, Nova |
| Arcane Explosion | Arkan | Arkan, Nova |
| Blizzard | Frost | Frost, Fläche, Kanal |
| Cone of Cold | Frost | Frost, Fläche |
| Blink | Arkan | Arkan, Bewegung |
| Flammenstoß | Feuer | Feuer, Fläche |
| Druckwelle | Feuer | Feuer, Nova |
| Höllenfeuer | Feuer | Feuer, Kanal |
| Frostkugel | Frost | Frost, Geschoss, Fläche |
| Leerenkugel | Arkan | Arkan, Leere, Fläche |
| Wirbel | Frost | Frost, Nova, Fläche |
| Eislanze | Frost | Frost, Geschoss |
| Gletscherspalte | Frost | Frost, Fläche |
| Feuerball | Feuer | Feuer, Geschoss |
| Meteor | Feuer | Feuer, Fläche |
| Phönix | Feuer | Feuer, Nova |
| Brandmal-Detonation | Feuer | Feuer, Fläche |
| Arkane Geschosse | Arkan | Arkan, Geschoss, Kanal |
| Arkanes Mal | Arkan | Arkan, Fläche, Kontrolle |
| Arkane Woge | Arkan | Arkan, Fläche |
| Kettenblitz | Blitz | Blitz, Kette |
| Bogenblitz | Blitz | Blitz, Kette |
| Blitzschlag | Blitz | Blitz, Fläche, Kontrolle |
| Kugelblitz | Blitz | Blitz, Geschoss, Fläche |
| Entladung | Blitz | Blitz, Nova |
| Gewitter | Blitz | Blitz, Fläche |
| Blutpeitsche | Blut | Blut, Fläche |
| Blutsprung | Blut | Blut, Bewegung, Fläche |
| Saugen | Blut | Blut, Kanal, Heilung |
| Blutwelle | Blut | Blut, Fläche, Kontrolle |
| Verkleben | Blut | Blut, Kontrolle |
| Zerfließen | Blut | Blut, Fläche, Kontrolle |

## ?-Magier (Modus `normal`, v24)

Keine Spell-Karten, keine Runen. 4 feste Tasten würfeln aus Kategorien (`RANDOM_MAGE` in `config.ts`). Der eigene CD eines Spells zählt nicht, nur der der Kategorie. Kann der Wurf gerade nicht (kein Ziel, nichts brennt), würfelt der Druck neu, ohne CD.

| Taste | Kategorie | Pool | CD |
|---|---|---|---|
| 1 | Offensiv | Arcane Explosion, Arkane Woge, Arkane Geschosse, Feuerball, Flammenstoß, Meteor, Brandmal-Detonation, Frostkugel, Eislanze, Blizzard, Blitzschlag, Kugelblitz, Entladung, Gewitter, Kettenblitz, Bogenblitz, Blutpeitsche | 1 s |
| 2 | Defensiv | Frost Nova, Eisblock, Druckwelle, Cone of Cold, Wirbel, Gletscherspalte, Höllenfeuer, Blutwelle, Saugen | 6 s |
| 3 | Utility | Blink, Leerenkugel, Arkanes Mal, Verkleben, Blutsprung | 5 s |
| 4 | Drink Something | Goldbecher, Feuerschnaps, Heiße Tasse, Tee-Schale | 30 s |

Rang-Karten: Offensiv +15 % Schaden auf alle Offensiv-Spells, Defensiv +10 % Dauer und Radius, Utility −10 % Abklingzeit der Kategorie. Supports, Relikte, Talente und Glück bleiben. Waffen-Fokus wirkt, wenn der Spell gewürfelt wird.

Fest im Modus:

| Modus | Moves |
|---|---|
| Frost only | Eisblock (Taste; im ?-Magier auch über Defensiv) |
| Blitz only | Aufladen statt Trinken |
| Blut only | kein Trinken; Blut-Spells haben noch keine Runen |
| Strichkrieger, Riesenschwert | Schlagfolge, Bodenbrecher, Wirbelwind, Hinrichtung, Letzter Atem, Kampfschrei, Sturzsprung, Essen |
| Strichkrieger, Holzfälleraxt | wie Riesenschwert, aber Hackfolge, Kahlschlag, Fällen statt Schlagfolge, Bodenbrecher, Hinrichtung |
| Strichkrieger, Streitkolben | wie Riesenschwert, aber Donnerfolge, Donnerschlag, Kugelblitz statt Schlagfolge, Bodenbrecher, Hinrichtung |
| Klingenstrich | Schnitt, Kreisschnitt, Blutwirbel, Aderlass, Schattenklone, Haltung, Strichschnitt, Essen |

Entfernt in v23: Kettenblitz, Bogenblitz, Hurrikan, Arkanes Sperrfeuer. Kettenblitz und Bogenblitz sind seit v26 zurück.

## Relikte

| Name | Seltenheit | Vorschlag |
|---|---|---|
| Zorn des Ragnaros | orange | gesperrt |
| Entweihen | lila | gesperrt |
| Frostatem | lila | gesperrt |
| Frostschlag | orange | gesperrt |
| Feuernova | lila | gesperrt |
| Knochengefängnis | lila | gesperrt |

## Supports

| Name | Seltenheit | Vorschlag |
|---|---|---|
| Echo | lila | gesperrt |
| Großes Echo | orange | gesperrt |
| Konzentration | grün | frei |
| Weite | grün | frei |
| Wirksamkeit | blau | gesperrt |
| Kette | blau | gesperrt |
| Knochenkälte | blau | gesperrt |
| Blutopfer | lila | gesperrt |

## Runen

Regel: erste Rune jedes Spells grün und frei, zweite blau und gesperrt, dritte lila und gesperrt.

| Spell | grün, frei | blau, gesperrt | lila, gesperrt |
|---|---|---|---|
| Frost Nova | Kaltes Echo | Tiefes Eis | Zweiter Frost |
| Arcane Explosion | Arkaner Sog | Überladung | Rhythmus |
| Blizzard | Wandelnder Sturm | Treibender Sturm | Letzter Frost |
| Cone of Cold | Eisring | Eiskegel | Kalte Ernte |
| Blink | Eisportal | Frostabschied | Doppelsprung |
| Flammenstoß | Heißer Sprung | Feuerspur | Flächenbrand |
| Druckwelle | Implosion | Feuerring | Kurzer Stoß |
| Höllenfeuer | Seelenernte | Brennender Gang | Ausbreitung |
| Frostkugel | Bumerang | Eisstern | Kalte Splitter |
| Leerenkugel | Leerenbegleiter | Implosion | Zwillinge |
| Wirbel | Eisläufer | Dreifach | Mahlstrom |
| Eislanze | Breite Lanze | Kalte Spitze | Schnelle Lanze |
| Gletscherspalte | Sofortbruch | Nachbeben | Weite Spalte |
| Feuerball | Große Explosion | Entzünden | Schnellwurf |
| Meteor | Meteorschauer | Glutkrater | Einschlag |
| Phönix | Asche | Ewige Glut | Wiedergeburt |
| Brandmal-Detonation | Kettenbrand | Großer Knall | Nachglühen |
| Arkane Geschosse | Splitter | Schnellfeuer | Arkane Ladung |
| Arkanes Mal | Lähmendes Mal | Kettenmal | Großes Mal |
| Arkane Woge | Breite Woge | Rücksog | Doppelwoge |
| Kettenblitz | Wiederkehr | Entladung | Gabelung |
| Bogenblitz | Weiter Bogen | Schock | Totenleiter |
| Blitzschlag | Doppelschlag | Weiter Schlag | Lange Betäubung |
| Kugelblitz | Großkugel | Träge Kugel | Zwillingskugel |
| Entladung | Restladung | Weite Entladung | Schockwelle |
| Gewitter | Doppelblitz | Wanderndes Gewitter | Großes Gewitter |
| Schlagfolge | Weiter Schwung | Blutdurst | Wutschlag |
| Bodenbrecher | Tiefe Risse | Erdstoß | Zweiter Stoß |
| Wirbelwind | Sturmschritt | Rasender Tanz | Mahlstrom |
| Hinrichtung | Gnadenstoß | Breite Klinge | Blutgier |
| Kampfschrei | Zorniger Schrei | Schreckensschrei | Schockwelle |
| Sturzsprung | Beben | Einschlag | Hast |
| Kahlschlag (Axt) | Weite Ernte | Gierige Klinge | Zweiter Schwung |
| Donnerschlag (Kolben) | Weiter Ring | Überladung | Nachhall |
| Schnitt | Weiter Bogen | Nachhall | Lange Klinge |
| Kreisschnitt | Eisschnitt | Sog | Doppelte Drehung |
| Blutwirbel | Jäger | Gerichteter Wurf | Langer Wirbel |
| Aderlass | Übersprung | Blutzoll | Lebenssaft |
| Haltung | Wechselschnitt | Überraschung | Fließender Wechsel |
| Strichschnitt | Nachsetzen | Blutspur | Rückstrich |

Die Runen-Freischaltungen der Krieger gelten pro Slot, also für alle drei Waffen gemeinsam.

## Talente

Bleiben alle frei: Improved Blizzard, Improved Frost Nova, Shatter, Arkane Macht, Arcane Mind, Arcane Meditation, Weiter Sturm, Arkane Effizienz, Frostrüstung. Nur im Schul-Modus: Eisherz (Frost), Glutherz und Glutseele (Feuer). Nur Nahkampf: Kampfkunst, Knochenpanzer. In allen Modi: Ausweichrolle (+1 Dodge-Ladung) und Kombo-Meister (Kombo-Fenster nach dem Dodge).
