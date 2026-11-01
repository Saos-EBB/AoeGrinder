# Status Branch blau-levels

Spec: `docs/levels-spec.md`. Basis: `5219f8f` (main). Nichts gepusht, nichts veröffentlicht, nichts gemergt. Der Build-Log dieses Auftrags steht hier, um Merge-Konflikte in `build-log.md` zu vermeiden.

## Messwerte Level 1–100
Gemessen im Spiel per echtem `cast('ae')`, je 1000 gleichstufige Klapperskelette ohne Karten, Normal-Modus, mit Trefferwurf und Crits.

| Level | Leben | Mana | Spirit | dmgMult | Mob-Leben | AE im Schnitt | genau 3 AE | XP je Level | XP je Kill | Kills je Level |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 299 | 399 | 7 | 1,00 | 100 | 3,10 | 90 % | 500 | 50 | 10 |
| 20 | 1040 | 1387 | 45 | 1,95 | 195 | 3,10 | 91 % | 1450 | 145 | 10 |
| 50 | 2210 | 2947 | 105 | 3,45 | 345 | 3,11 | 89 % | 2950 | 295 | 10 |
| 100 | 4160 | 5547 | 205 | 5,95 | 595 | 3,12 | 88 % | 5450 | 545 | 10 |

Die Abweichung von 3 kommt vom Trefferwurf (96 %) und seltenen Doppel-Crits. Leben, Mana, Spirit, dmgMult und Mob-Leben sind auf Level 1–100 positiv, das Leben steigt mit jedem Level.

## Build-Log
- **feat(level): Level 1–100, Skalierung.** Schaden und Mob-Leben hängen am selben Faktor, deshalb bleibt es auf jedem Level bei 3 Treffern. `xpNeeded` und Spirit waren schon passend und blieben unverändert. Mob-Level-Grenzen waren es auch: ab Level 100 ergibt +2 genau 102. `ui/hud.ts` steht nicht auf der Dateiliste, bekam aber die drei Zeilen für den XP-Balken, weil der Text dort gesetzt wird. Nicht gebaut: keine Skalierung von Manakosten, Mob-Schaden und festem Umgebungsschaden.
- **feat(level): Mob-Freischaltung und Einblendung.** `spawnPack` wählt nur noch aus den freigeschalteten Mobs, bestehende Packs bleiben. Die Einblendung läuft über die Spielzeit, damit sie nach der Kartenwahl zu sehen ist und nicht hinter dem Kartenmenü abläuft. Elvyn hat nur den Eber, dort kommt nie eine Einblendung. Nicht gebaut: kein sofortiges Nachspawnen beim Level-Up, neue Mobs kommen mit dem nächsten Pack.
  Gemessen über alle 5 Zonen auf Level 15, 16, 30, 31, 45, 46, 60, 61, 100: unter 16 nur der Start-Mob, danach 45–56 %, Spezial-Mobs gleichmäßig. In BRD liegt der Bauer ab 16 bei 42–52 %, der Sanitäter kommt durch die Sonderregel bis auf 58 % (Level 30), weil er dort der einzige Spezial-Mob ist.
- **feat(dev): Level setzen im Esc-Menü.** Der Block hängt sich aus `ui/leaderboardView.ts` selbst ein, `index.html` und `ui/menus.ts` bleiben unberührt. Mobs werden wie beim Zonenwechsel neu gesetzt und der Spieler kommt in die Mitte, sonst stünden noch die Packs des alten Levels da. Das ist die einzige Ausnahme von „bestehende Packs bleiben“. Nicht gebaut: keine Karten für übersprungene Level.
- **fix(score): Halbe Werte als eigener Faktor.** Der Modus steckt jetzt in `maxHp` und `maxMana`, nicht mehr in `mods`, wo Karten darauf addierten. Das behebt die in `status-maps.md` notierte Abweichung (+15 % wirkten im Hardmode wie +30 %). Schaden war schon getrennt. Gemessen auf Level 20: Hardmode 520, mit 1× Frostrüstung 598 (= 1040 × 0,5 × 1,15); Normal 1040 und 1196, also in beiden Modi ×1,15. Mana im Hardmode mit Arcane Mind (+10 %): 763 (= 1387 × 0,5 × 1,1). Nicht gebaut: —
- **feat(score): castKey hat Vorrang.** Alles, was keine Spell-ID ist, gilt als echte Cast-ID und zählt ohne 1,2-s-Fenster, sodass auch alle Kills eines 8-s-Blizzards ein Cast sind. Spell-IDs und `env` laufen weiter über das Fenster. Nur `score.ts` wurde geändert, weil Grün `damageMob` schon anfasst: `mob.castKey = source` bleibt dort stehen, bis Grün die Zeile ersetzt. Vertrag für Grün: Die Cast-ID darf nicht wie ein Spell heißen (eine Zahl oder `ae#12` passt). Nicht gebaut: kein zweites Feld für die Spell-ID.

## Stand
Alle 5 Punkte sind fertig. `tsc` ist sauber, der Build läuft, im Browser gab es keine Laufzeitfehler.

**Getestet im Spiel:** Lauf von Level 1 bis 100 mit echtem Kartenmenü (immer Karten im Angebot, danach Max-Level, keine weiteren Level-Ups, Punkte laufen weiter), Mob-Level, Mob-Verteilung in allen Zonen, Einblendung, alle 10 Dev-Knöpfe, Hardmode mit Karten, castKey mit Spell-ID, Zahl, Text und ohne Quelle.

**Merge mit `gruen-polish` (Stand `f1f9b0b`):** Probe-Merge ohne Konflikte. Beide ändern `updateHud` in `ui/hud.ts` und `mobs.ts` in verschiedenen Zeilen. Grüns offene Änderungen an `spells/core.ts` sind nicht geprüft.

**Offen, nicht im Auftrag und daher nicht geändert:**
- Hardmode auf Level 1: 150 Leben und 200 Mana. Das reicht für 2 AE, ein Mob braucht dort 6; Blizzard (320) und Cone of Cold (210) sind nicht wirkbar. Im Normal-Modus reicht es für 5 AE und das ganze Kit.
- Manakosten sind fest: AE kostet auf jedem Level 75, das sind 19 % des Manas auf Level 1 und 1,4 % auf Level 100. Mana verliert nach oben an Bedeutung.
- Mob-Schaden blieb `Level × 0,9–1,3`: Auf Level 1 trifft ein Mob für 1 Leben (0,4 %), auf Level 20 für etwa 22 (2 %), auf Level 100 für etwa 110 (2,6 %). Die ersten Level sind fast gefahrlos.
- Fester Schaden skaliert nicht: Lava 40/s nimmt auf Level 1 13 % der Spieler-Leben pro Sekunde und tötet einen Start-Mob in 3 s. Lavaflächen (30/s) und Gift (4 je Stapel) kommen erst ab Level 61 vor.
- Packgröße ist unverändert und bleibt bis Level 17 bei 2 Mobs.
- `SCORE_VERSION` steht weiter auf `v8`. Vor dem nächsten Publish erhöhen, sonst mischt der Versionsfilter alte und neue Balance.

# Massive Objekte (Branch blau-maps)
Audit: `docs/map-audit.md`. Basis `9363cd4`. Nichts gepusht, nichts veröffentlicht, nichts gemergt.

## Build-Log
- **feat(collision): collision.ts.** Kreis, gedrehte Box, begehbare Fläche im 8-yd-Raster, `groundAt`, `resolve`, Stufe 0,6 yd. Jede Oberkante trägt, wenn man sie erreicht, das spart Sonderfälle beim Landen. Kein Zyklus: `world.ts` importiert `collision.ts` und übergibt die Geländehöhe. Nicht gebaut: keine Kollision von Mobs untereinander, kein Pathfinding. `bottom` und `height` sind vorhanden, weil der Auftrag `resolve(pos, radius, height)` verlangt; noch hängt nichts Überkopf.
- **feat(collision): Spieler und Mobs.** Beide nutzen `resolve` und `groundAt`, fallen von Kanten und landen auf Flächen. Mobs laufen an der Tangente um Hindernisse und behalten dabei die Seite, bis der Weg frei ist. Sprungbögen starten und enden auf der echten Höhe. `world.collide` bleibt als dünne Hülle für `spells/blink.ts`. Nicht gebaut: kein Pathfinding, keine Höhe beim Nahkampf.
- **feat(zones): Tirisfal massiv.** Alle Objekte aus dem Audit haben Collider, die Zäune je Seite eine feste Lücke. Der Wachturm bekommt eine Wendeltreppe aus 30 Stufen bis aufs Dach; unter den hohen Stufen ist Durchgang, das nutzt `bottom`. Dazu `addRoute`: Steht der Spieler höher auf einem Bauwerk, folgen Mobs einer festen Spur die Treppe hoch. Das geht über den Auftrag hinaus, aber ohne sie wäre das Turmdach ein unerreichbarer Platz, von dem aus AE die Mobs am Fuß trifft. Nicht gebaut: kein begehbares Inneres von Turm, Mühle und Gruft, die Türen bleiben Optik.
- **feat(zones): Schlingendorntal massiv.** Die Zikkurat hat 5 begehbare Ebenen und vorn eine Treppe aus 24 flachen Stufen, kollidiert als Rampe mit Steigung 0,75, damit auch Mobs mit Radius 0,7 oben ankommen. Der Altar oben ist kleiner, sonst bliebe kein Platz zum Stehen. Die Treppe reicht weiter nach vorn, der Spawn rückt deshalb von z = 2 auf z = 6. Nicht gebaut: keine Treppen an den anderen Seiten; die Ebenen sind 2,4 hoch und bleiben für einen Sprung (bis 2,2) zu hoch.
- **feat(zones): Tanaris massiv.** Mauern sind gedrehte Boxen, die Kreise passen jetzt zur Optik, der Turmsockel lässt sich anspringen, Gerippe haben Collider. Der Schlund sperrt bis zu den äußeren Stacheln (r = 17). Nicht gebaut: Der Brunnenturm ist nicht begehbar, das verlangt der Auftrag dort nicht. Dünen bleiben Gelände.
- **feat(zones): Blackrock Depths massiv.** Korridorwände, Brüstungen, Schmiede und Ambosse sind gedrehte Boxen, die Brücken begehbare Platten knapp über dem Gelände. Die Statuen fehlten im Code; 4 neue stehen rund um die Schmiede. Jedes vierte Brüstungsstück fehlt, sonst kämen Mobs vom Ufer nie auf die Brücke. Nicht gebaut: keine echte Spannweite über Lava. Die Brücke bleibt ein Geländerücken unter der Platte, sonst müsste `zone.hazard` die Höhe kennen und der Lavaschaden umgebaut werden.
- **Ausbruch aus Nischen (in `steer`).** Tangente allein ließ in Tests 7 von 16 Mobs in BRD und 6 von 16 in Tirisfal zwischen Wandblöcken und Kürbisreihen hängen. Kommt ein Mob in 20 Aufrufen keine 0,5 yd voran, läuft er 45 Aufrufe schräg zurück, abwechselnd links und rechts. Nicht gebaut: weiter kein Pathfinding.
- **feat(dev): Collider anzeigen.** Knopf im Esc-Menü, Drahtgitter durch alles hindurch: massiv rot, begehbar grün. Unendlich hohe Objekte enden im Bild bei 8 yd. Die Anzeige überlebt den Zonenwechsel. Nicht gebaut: keine Anzeige der Mob-Spuren.

## Stand massive Objekte
Alle Schritte sind fertig. `tsc` und Build sind sauber, in den Testläufen gab es keine Laufzeitfehler. Gespielt wurde per Skript, nicht von Hand.

**Getestet (Physik per Skript, gleiche Regeln wie im Spiel):**
- Wand, Gleiten, Sprung auf Plattform, Fall von der Kante.
- Spieler kommt auf das Wachturm-Dach und die oberste Zikkurat-Ebene.
- Mobs je von 8 Seiten: alle erreichen Dach (8–10 s) und Zikkurat-Spitze (4–13 s).
- Mobs auf freier Strecke, 16 Starts je Zone: 0 hängen geblieben. Schnitt 4,5–9,9 s, längster Weg 21,7 s (BRD).
- Keine Mobs stecken nach dem Spawn in Objekten.

**Leistung BRD, 40 Mobs im Kampf, vorher `9363cd4` gegen nachher, je 3 abwechselnde Läufe auf demselben Rechner:**
| | vorher | nachher |
|---|---|---|
| FPS (Software-Rendering) | 7,3 / 7,3 / 9,2 | 7,2 / 8,0 / 9,1 |
| Mob-Update je Frame | 0,40–0,60 ms | 0,16–0,26 ms |

Die FPS begrenzt hier das Software-Rendering, auf einer echten Grafikkarte muss noch gemessen werden. Das Raster macht die Kollision trotz mehr Collidern billiger.

**Merge:** Probe-Merge mit `gruen-tuning` (`2646d04`) ohne Konflikte. Grün hat den Leash entfernt, Mobs jagen also dauerhaft; deshalb sind Ausweichen und Spuren wichtiger.

**Offen, außerhalb meiner Dateien:**
- `spells/blink.ts` setzt die Höhe aufs Gelände: Ein Blink auf der Zikkurat landet unten neben dem Bauwerk, nie darin. Blink geht auch durch Wände.
- Bodenziele (`input.ts`) und Boden-Effekte (`drape`) folgen dem Gelände, nicht den Plattformen.
- Flächenzauber, Aggro und Nahkampf messen 2D: Ein Mob am Fuß einer Ebene kann den Spieler direkt über sich treffen, AE trifft nach unten.
- Die Kamera kollidiert nur mit Baumkronen und kann in Bauwerke geraten.
- Mobs springen nicht: Zäune, Mauern und Brüstungen (bis 1,2 hoch) umlaufen sie, der Spieler springt drüber. Das ist beim Kiten ein Vorteil.
