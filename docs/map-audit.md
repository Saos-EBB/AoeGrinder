# Map-Audit: Kollision der Objekte

Stand vor dem Umbau (Basis `9363cd4`). Bisher gibt es nur Kreise ohne Höhe (`ctx.obstacle`), und der Boden ist immer das Gelände (`heightAt`). Spring- und Stufenwerte: Sprunghöhe 1,6 yd (`jumpSpeed` 8, `gravity` 20), Stufe laut Auftrag 0,6 yd. Erreichbar sind also Oberkanten bis etwa 2,2 yd über den Füßen.

Plan: Kreis und Box tragen eine Oberkante, auf der man stehen kann, wenn man sie erreicht. „begehbar“ heißt Plattform oder Rampe.

## Alle Zonen
| Objekt | jetzige Kollision | Problem | Plan |
|---|---|---|---|
| Kartenrand | Kreis 98 yd in `collide` | – | bleibt, wandert nach `resolve` |
| Gras | keine | weich, darf durchlaufbar sein | bleibt ohne |
| Findlinge | Kreis 0,9 × s, keine Höhe | man kann nicht hinauf | Kreis mit Oberkante |

## Tirisfal
| Objekt | jetzige Kollision | Problem | Plan |
|---|---|---|---|
| Kahle Bäume | Kreis 0,5 × s | passt | Kreis |
| Kürbisse | keine | sehen fest aus, durchlaufbar | Kreis, Oberkante 0,8 |
| Zäune | keine | durchlaufbar, Lücken nur zufällig | Box 3,2 × 0,3, Oberkante 1,2; feste Lücke je Seite |
| Windmühle | Kreis 5 | unsichtbarer Rand, Sockel nur bis 4,4 | Kreis 4,4 |
| Mühlen-Schutt | im Kreis der Mühle | ragt aus dem Mühlenkreis | 2 Boxen mit Oberkante |
| Grabsteine | Kreis 0,5 | breiter als der Stein tief ist | Box 0,8 × 0,3, Oberkante 1,25 |
| Grabplatten | keine | 0,1 hoch | bleibt ohne, unter der Stufe |
| Gruft | Kreis 3,8 | Ecken durchlaufbar | Box 7 × 6 |
| Friedhofsmauer | Kreise r = 1 auf 3,2 yd Abstand | Löcher zwischen den Kreisen | Box 3,2 × 0,4, Oberkante 1 |
| Wachturm | Kreis 4 | Rand unsichtbar, kein Weg nach oben | Kreis 3,5, außen Wendeltreppe, begehbares Dach |
| Zinnen | keine | oben durchlaufbar | Boxen, Lücke am Treppenaustritt |
| See | Gelände, kein Hindernis | man läuft unter Wasser | bleibt Gelände |

## Schlingendorntal
| Objekt | jetzige Kollision | Problem | Plan |
|---|---|---|---|
| Dschungelbäume | Kreis 0,7 × s, Krone für die Kamera | passt | Kreis |
| Farne | keine | weich | bleibt ohne |
| Zikkurat | ein Kreis r = 13 | Ecken durchlaufbar, Treppe unerreichbar, Stufen 1 yd hoch | 5 Plattformen, Treppe als Rampe, flache Stufen |
| Altar oben | im Zikkurat-Kreis | füllt die oberste Ebene fast ganz aus | kleiner, Box |
| Ruinensäulen | Kreis 0,8 × s | keine Höhe trotz gekürzter Säulen | Kreis mit Oberkante |
| Fluss | Gelände | man läuft unter Wasser | bleibt Gelände |

## Tanaris
| Objekt | jetzige Kollision | Problem | Plan |
|---|---|---|---|
| Brunnenturm | Kreis 5 | unsichtbarer Rand | Kreis 3,6 |
| Turmsockel | im Kreis des Turms | nicht betretbar | Kreis 4,8, Oberkante 1,2 |
| Ruinenmauern | Kreis 2,2 | 5 yd breit, Enden durchlaufbar | gedrehte Box 5,2 × 1,2 |
| Säulen | Kreis 0,9 | keine Höhe | Kreis mit Oberkante |
| Silithid-Schlund | Kreis 12 | Stacheln bis r = 16,5 durchlaufbar | Kreis 17 |
| Kakteen | Kreis 0,45 × s | passt | Kreis |
| Knochengerippe | keine | sehen fest aus, durchlaufbar | Box, Oberkante 1,8 × s |
| Dünen | Gelände | passt | bleibt Gelände |

## Blackrock Depths
| Objekt | jetzige Kollision | Problem | Plan |
|---|---|---|---|
| Korridorwände | Kreis 1,8 | Blöcke sind eckig | gedrehte Box 4 × 3,6 |
| Brücken | Gelände ohne Lava, Belag nur Optik | funktioniert, aber nicht als Fläche erkennbar | begehbare Platte über dem Gelände |
| Brüstung | Kreis 0,8 auf 3 yd | Löcher | Box 3,1 × 0,6, Oberkante 1 |
| Schmiede | Kreis 7,5 | Gebäude ist 14 × 10, Ecken durchlaufbar | Box 14 × 10 |
| Ambosse | Kreis 1 | zu groß, keine Höhe | gedrehte Box, Oberkante 1,5 |
| Hallensäulen | Kreis 2 × s | etwas zu groß | Kreis 1,9 × s |
| Statuen | gibt es nicht | im Auftrag verlangt, im Code fehlend | 4 neue Statuen an der Schmiede, Kreis mit Sockel |
| Lava | Schaden über `zone.hazard` | kein Kollisionsthema | bleibt Schadenszone |

## Elvyn
| Objekt | jetzige Kollision | Problem | Plan |
|---|---|---|---|
| Nadelbäume | Kreis 0,6 × s, Krone für die Kamera | passt | Kreis |

## Grenzen außerhalb meiner Dateien
- `spells/blink.ts` setzt die Höhe fest aufs Gelände. Ein Blink von einer Plattform landet deshalb unten und wird aus dem Objekt geschoben.
- `input.ts` zielt nur aufs Gelände, und Boden-Effekte (`drape`) folgen dem Gelände statt Plattformen.
- Flächenzauber, Aggro und Nahkampf messen 2D-Abstand, also auch über Höhenunterschiede.
- `spells/relics.ts` (Sichtlinie) liest weiter die Kreisliste `obstacles`; alles Hohe trägt dort einen umschließenden Kreis ein.
