# Map-Konzepte Anime (05.11.2026)

Auswahl aus dem 15er-Brainstorm: Winterquell, Kathedrale der Hölle, Kristallhöhlen, Mondsee.

**Stand:** Schritt 1 (gemeinsame Basis) gebaut in `src/toon.ts`, nur mit `?toon=1` an, an Tirisfal getestet. Schritt 2 Winterquell gebaut in `src/winterquell.ts` (Toon immer an), Mondsee in `src/mondsee.ts`. Messungen unten.

## Gemeinsame Basis (gilt für alle 4)
- Toon: MeshToonMaterial mit 3-Stufen-gradientMap (DataTexture 3×1), keine Texturen, Farben über Vertex-Farben.
- Kontur: keine Inverted-Hull-Outlines (verdoppeln Draw Calls). Stattdessen dunkler Fresnel-Rand im Shader (onBeforeCompile, 0 extra Calls).
- Himmel: Verlaufs-Shader auf einer Kugel (1 Call) oder scene.background-Farbe.
- Boden: 1 PlaneGeometry mit Vertex-Farben (Flecken per Noise beim Bauen, nicht pro Frame).
- Props: pro Prop-Art 1 InstancedMesh, Low-Poly (≤ 200 Tris).
- Partikel: 1 Points-Mesh pro Map, Bewegung im Vertex-Shader (uTime), keine CPU-Updates.
- Licht: Hemisphere + 1 Directional, keine Shadow-Maps. Blob-Schatten wie bisher.
- Leuchten nur über vorhandenes Bloom + emissive, keine zusätzlichen Lichter.
- Budget: Umgebung ≤ ~12 Draw Calls. Gegen aktuelle Tirisfal-Messung prüfen (renderer.info.render.calls, FPS Mittel 10 s, voller Pack).

## 1. Winterquell
- Look: Weiß/Hellblau, Himmel Rosa→Hellblau (Anime-Wintermorgen), harte Schattenstufe in Kaltblau.
- Props (je 1 InstancedMesh): Kegel-Tannen mit Schneekappe (Vertex-Farbe), Eisblöcke, Steine. Eisseen = flache Scheiben, halbtransparent, heller Fresnel-Rand.
- Partikel: Schneeflocken (Points, ~800).
- Mobs: Yetis, Eulenbestien, Frostsäbler.
- Mechanik: Eisfläche = Mobs rutschen, Knockback ×2 (nur Flag pro Fläche, Kreis-Check).
- Calls: Boden, Himmel, 3 Props, Seen, Schnee ≈ 7.

## 2. Kathedrale der Hölle
- Look: Etage 1 grauer Stein + kaltes Blau; tiefer warm Rot/Schwarz, Boden-Risse glühen orange (emissive Vertex-Band → Bloom).
- Props: Säulen, Bänke, Kerzen (Flamme = Billboard mit vorhandenem Feuer-eMat, instanziert), später Knochen/Fleischsäulen. Wände = einfache Box-Ringe.
- Partikel: Asche/Funken nach oben.
- Mobs: Gefallene, Dämonen, Skelette.
- Mechanik: Etagen. Alle X Kills Treppe tiefer → nur Palette + Prop-Set tauschen (gleiche Meshes, neue Farben/Instanz-Matrizen), kein Neuladen.
- Calls: Boden, Wände, 3 Props, Kerzen, Partikel ≈ 7.

## 3. Kristallhöhlen
- Look: Dunkles Violett, Kristalle türkis/pink mit harten Bändern (energy.ts-Stil), sonst fast kein Licht.
- Props: Kristall-Cluster (Oktaeder/gestreckte Kegel, emissive → Bloom), Stalagmiten, Pilze.
- Partikel: Glühsporen (langsam schwebend).
- Mobs: Kristallgolems, Fledermäuse.
- Mechanik: Kristalle reflektieren Projektile. Billig: nur Kreis-Kollision Projektil↔Kristall-Position, Richtung spiegeln. Max 1 Reflexion pro Projektil.
- Calls: Boden, Himmel (Decke = dunkle Kuppel), 3 Props, Sporen ≈ 6.

## 4. Mondsee
- Look: Nacht, Schwarzblau, riesiger Anime-Mond (1 Billboard + Bloom), Wasser schwarz mit Mond-Spiegelstreifen (Streifen = Shader-Band auf der Wasserfläche, keine Reflexion). Leichter Nebel (linear).
- Props: Tote Bäume, Holzstege, Steinlaternen (emissive Kern), Torii-ähnliche Tore.
- Partikel: Glühwürmchen / Geisterlichter.
- Mobs: Geister, Ertrunkene.
- Mechanik: Mondphase rotiert alle N Minuten. Vollmond = doppelte Packs, Neumond = Champions. Phase ändert nur Mond-Shader (uPhase) + Nebeldichte + Spawn-Tabelle.
- Calls: Boden, Wasser, Himmel, Mond, 3 Props, Partikel ≈ 8.

## Reihenfolge-Vorschlag
1. Gemeinsame Basis (Toon-Material + Fresnel-Rand) einmal bauen, an Tirisfal testen.
2. Winterquell (einfachste Mechanik, passt zu Frost).
3. Mondsee, Kristallhöhlen, Kathedrale.

## Messung Schritt 1 (Tirisfal Level 1, voller Pack, headless Chromium, 10 s)
- Ohne und mit `?toon=1` je 60 FPS. Calls pro Frame schwanken von Lauf zu Lauf zwischen 42 und 90, je nach Blickrichtung beim Start, in beiden Varianten gleich.
- Gezählt in einem Frame: Umgebung 18 Lambert-Meshes ohne Toon, mit Toon 17 Toon-Meshes + 1 Lambert (Wasser). Toon und Rand kosten also 0 extra Draw Calls.
- Abweichung vom Konzept: Das Spiel läuft immer dunkel (Spotlicht mit Schatten an der Figur, `dunkel.ts`). Daran ist nichts geändert. Weil das Toon-Material von Three.js nur den Lichtwinkel stuft und der Spot weich abfällt, stuft `toon.ts` zusätzlich die Summe des Lichts in 3 Bänder; dadurch bekommt der Lichtkreis harte Kanten. Den Verlaufs-Himmel gibt es schon (`render.ts`), im Dunkel-Modus ist er schwarz.

## Messung Winterquell (Level 1, voller Pack, headless Chromium, 10 s)
- 60 FPS. Umgebung im Frame gezählt: 5 Toon-Meshes (Gelände, Tannen, Eisblöcke, Steine, Seen) + 1 Points (Schnee) = 6 Calls, Himmel wie überall.
- Eis: Knockback 1,5 yd an Land, 3 yd auf dem See. Ein Mob, der 1 s übers Eis läuft, rutscht ohne Befehl noch etwa 2 yd weiter (`WQ.ice.grip`).
- Abweichungen: Dunkel-Modus bleibt, deshalb sieht man den rosa-blauen Himmel nicht und der Schnee ist nur im Umkreis der Figur sichtbar. Die Mobs sind umgefärbte vorhandene Rigs (humanoid, quadruped), keine eigenen Modelle. Die Zone ist nur über das Dev-Menü oder `?zone=winterquell` erreichbar, wie die anderen Zonen außer Tirisfal.

## Messung Mondsee (Level 1, voller Pack, headless Chromium, 10 s)
- 60 FPS. Umgebung im Frame gezählt: 5 Toon-Meshes (Gelände, Bäume, Stege, Tore, Laternen) + Laternen-Kerne + Wasser + Mond + Geisterlichter = 9 Calls.
- Phasen ab Run-Start: zunehmend, Vollmond (Packs ×2, im Test 88 → 162 Mobs), abnehmend, Neumond (Champion-Chance 60 % statt 20 %, ab Champion-Level 6), je 3 Minuten (`MS.phaseMs`). Nebel pro Phase über `state.fogExtra` in `dunkel.ts`.
- Abweichungen: Der Mond steht 150 yd vor der Kamera statt am Himmel, weil die Randberge (`heightAt` ab etwa 180 yd) alles Fernere verdecken. Der Run beginnt mit zunehmendem Mond statt Neumond, damit man den Mond sieht. Der Nebel bleibt der exponentielle des Dunkel-Modus (Konzept: linear).
