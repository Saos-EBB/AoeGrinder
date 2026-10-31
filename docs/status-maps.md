# Status Branch maps

Stand 2026-10-31. Basis: `f17bd80` (main). Nichts gepusht, nichts veröffentlicht.

## Aufgaben
1. **Lava schadet Mobs:** schon in der Basis (`8bccbd6`), kein neuer Commit.
2. **Leistungsanzeige:** schon in der Basis (`9f996c4`), kein neuer Commit. Sie steckt in `ui/hud.ts`, `ui/menus.ts`, `index.html`, die für diesen Branch gesperrt sind.
3. **Draw Calls senken:** dieser Commit.

## Aufgabe 3
**Was:** Pro Mob wird jedes Gelenk zu einem Mesh verschmolzen, auch über Farben hinweg (Vertex-Farben). Materialien sind geteilt, sogar über alle Mob-Typen hinweg statt nur pro Typ, weil die Farbe jetzt in der Geometrie steckt. Der Eber nutzt denselben Weg.

**Nicht gebaut:** kein Instancing, kein Skinning, keine Änderung an Posen und Animationen. `mobs.ts` ist unangetastet: `removeMob` ruft weiter `material.dispose()`, geteilte Materialien ignorieren das.

**Vorher/Nachher:** alle Mobs im Bild, gleiche Kamera, Software-Rendering. Die Mob-Anzahl schwankt leicht, weil sich der Zufall mit dem Umbau verschiebt, deshalb zählt die Spalte pro Mob. Die Meshes enthalten den unsichtbaren Eisblock je Mob. Draw Calls sind der ganze Frame inklusive Welt und Bloom.

| Zone | Meshes pro Mob vorher | nachher | Draw Calls vorher (Mobs) | nachher (Mobs) |
|---|---|---|---|---|
| Elvyn | 12,0 | 8,0 | 426 (31) | 316 (33) |
| Tirisfal | 14,9 | 12,7 | 584 (35) | 494 (34) |
| Schlingendorntal | 18,4 | 15,2 | 650 (32) | 532 (31) |
| Tanaris | 18,7 | 15,4 | 622 (30) | 536 (31) |
| Blackrock Depths | 20,4 | 14,3 | 716 (32) | 493 (30) |

Die Dreiecke bleiben gleich. FPS sind hier nicht aussagekräftig, gemessen werden muss auf einer echten Grafikkarte.

**Grenze:** Jedes bewegte Gelenk bleibt ein eigener Draw Call, tiefer geht es so nicht. Weniger bringt nur Skinning oder Instancing.

**Sichtbare Änderungen:**
- Der Treffer-Blitz läuft in 4 Stufen statt stufenlos; er dauert 140 ms.
- Beim Eber blitzen und färben sich jetzt alle Teile wie bei den anderen Mobs, vorher nur der Körper.

## Offen, außerhalb dieses Auftrags
Altfehler in `models/creatures.ts`, nicht behoben, weil Animationen gleich bleiben sollen: `x.add(part(...)).rotation.x = ...` dreht das Gelenk statt des Teils, weil `add` das Gelenk zurückgibt. Betroffen sind Bart beim Humanoid sowie Klauen und Unterschenkel beim Insekt.

# Punkte, Rangliste, Modi (Teil 1)
Spec: `docs/score-spec.md`. Build-Log dieses Auftrags steht hier, um Merge-Konflikte in `build-log.md` zu vermeiden.

## Build-Log
- **feat(score): Punkte, Kill-Ereignis, HUD.** `killMob` meldet XP und `mob.castKey`; in `damageMob` kommt dafür eine zweite Zeile dazu, weil `killMob` die Quelle sonst nicht kennt. HUD läuft in eigener Schleife, weil `main.ts` nicht freigegeben ist. Nicht gebaut: Bonus-Anzeige im HUD, die kommt am Run-Ende.
- **feat(score): Modifikatoren, Modi, Auswahl im Startbildschirm.** Daten in `modifiers.ts`. Halbe Werte läuft über `mods.hpMult`/`manaMult` in `resetGame`, weil `maxHp` in `formulas.ts` liegt und die Datei nicht freigegeben ist; Karten addieren dort weiter auf die halbierte Basis. Die Auswahl hängt sich selbst in den Startbildschirm, `menus.ts` und `index.html` bleiben unberührt. Nicht gebaut: Moduswechsel auf dem Todesbildschirm, die Wahl gilt bis zum Neuladen.
- **feat(score): Rangliste und Ergebnis auf dem Todesbildschirm.** `leaderboard.ts` speichert unter `frostgrind.runs.v1`, `build` bleibt leer. Die Todesursache kommt aus `damagePlayer`, ohne dass Aufrufer sich ändern: `hitPlayer` setzt `attackAt` direkt davor. Nicht gebaut: Trennung von Lava und Lavaflächen, beides heißt „Lava“.
