# Map-Umbau Teil 1: Generator + Layouts + Themes + Mob-Kategorien + Arena

Quelle: Project-Doc `claude/handoff-map-umbau.md` (08.11.2026), nur Teil 1. Teil 2 (Portale, Weltkarte, Objekte) erst nach Kevins Test.
Mob-Vorlage: `docs/ref/mob-viewer.html` (Artifact „Frost Grind – Mob-Viewer“, Version 1794179387-9769).

## Layouts × Themes (Entscheidungen Kevin)
| Theme | Layout | Schwierigkeit | Gefahr (PH) | Landmarke |
|---|---|---|---|---|
| Wald (Start) | Offen | 1 | keine | alter Riesenbaum |
| Wüste | Offen | 2 | Sandsturm (gibt es schon, `zone.storm`) | Grabmal-Eingang / Obelisk |
| Kanäle | Kanäle | 3 | Wasserrinne bremst 20 % | großes Schleusentor |
| Kathedrale | Hallen | 4 | Dunkelheit außerhalb von Kerzen/Licht | Glockenturm / Apsis-Fenster |
| Hölle | Räume | 5 | Lava (gibt es schon in BRD) | Höllenschlund-Tor |
| Arena | fest, kein Generator | – | – | – |

Alte 9 Zonen: bleiben über Dev → Zone und `?zone=` erreichbar, kommen nicht auf die Weltkarte.

```
Du arbeitest an Frost Grind (AoeGrinder), Repo ~/dev/frost-grind, Vite + TypeScript + Three.js.
Lies zuerst AGENTS.md, docs/overview.md, docs/handoff.md, docs/map-audit.md, docs/zones-spec.md.

Ziel: Maps werden nicht mehr von Hand gebaut, sondern aus 4 Layouts nach Regeln erzeugt (Seed).
Jede Map ist anders, fühlt sich aber gleich an. Dazu 5 Themes, ein neues Mob-System (Kategorie + Zusatz + Theme-Skin) und 1 feste Arena.
Prototyp: testen, behalten oder wegwerfen.

## Regeln
- Branch: git switch -c maps-gen (vorher git status + Branch prüfen, im Zweifel fragen).
- Ein Commit pro Phase, CHANGELOG.md-Zeile im selben Commit. Nicht pushen, nicht mergen.
- Simpel, keine neuen npm-Pakete. Alle Design-Zahlen // PH. Code lesbar, ein Layout = eine Datei.
- Alte Zonen und alte Mobs NICHT löschen, nur nicht mehr Standard. Spiellogik (Spells, Schaden, XP) nicht anfassen, außer Phase 0b.
- Budget Umgebung ≤ ~12 Draw Calls pro Map (Wände/Props je Art 1 InstancedMesh, Boden 1 Mesh). FPS Mittel 10 s, Lvl 1, volles Pack vorher (Tirisfal) und nach jeder Layout-Phase. Einbruch > 10 % → stoppen, melden.
- Nach jeder Phase: tsc 0 Fehler, Spiel starten, Konsole sauber.

## Phase 0: Bestand
Kurz (Datei:Zeile): Zonen-Schnittstelle (height, ground, props, env, mobs, packs, spawn, edgeR, spawnOk, storm, update, leave),
alle Stellen mit CFG.playRadius (collision.ts, minimap.ts, blink.ts, …) und runder Kartenrand, Pack-Spawn in mobs.ts, Wellen-Spawn in waves.ts,
wie Mob-Typen über die Level freigeschaltet werden (pickMobType), welche Fähigkeiten in abilities.ts es gibt, wie hpMul/speedMul/XP pro Typ wirken.
Kein Commit, nur Bericht-Abschnitt.

## Phase 0b: Fairness-Fix für alte Fernkämpfer
Problem: Knochenwirker (shadowCaster) und Axtwerfer fühlen sich unkillbar an.
- abilities.ts holdRange: unter min wird ohne Grenze mit vollem Tempo weggelaufen → raus. Neu: über max ranlaufen, sonst stehen bleiben + Richtung Spieler drehen.
- Projektile (shoot / Update-Schleife in abilities.ts): fliegen jeden Frame neu auf player.pos → raus. Neu: Ziel = Spielerposition beim Abschuss,
  gerade Linie, trifft nur bei Abstand < 1,2 yd PH zum Spieler unterwegs, sonst verfällt es am Ziel. Geschoss gut sichtbar (Größe/Glühen leicht erhöhen PH).
- Abstände: shadowCaster 12 yd, axeThrower 15 yd PH.
Commit.

## Phase 1: Generator-Kern (src/mapgen/)
- rng.ts: Seed-RNG (mulberry32 o. ä.), Seed pro Map, im Dev-Fenster anzeigen + per ?seed= setzbar.
- grid.ts: Raster 8 yd pro Zelle (passt zum Kollisionsraster), Größe ~25 × 25 Zellen (≈ heutige Fläche) PH.
  Zelle = boden | wand | wasser | lava | loch. Ergebnis eines Layouts:
  { cells, spawn, packSpots[], objectSpots[], portalSpots[], landmark, bounds }.
- build.ts: aus dem Raster Kollision (zusammenhängende Wandzellen zu Boxen zusammenfassen, addBox), Boden-Mesh (Vertex-Farben aus Theme),
  Wand-Mesh (InstancedMesh pro Wandart). Höhe flach, außer Layout Offen.
- Prüfungen nach jeder Erzeugung: Flood-Fill (alle Bodenzellen verbunden, sonst neu würfeln, max 10 Versuche),
  Spawn 3×3 frei, Pack-Plätze ≥ 30 yd vom Spawn, Portal-Plätze ≥ 60 yd vom Spawn.
- Kartenrand: playRadius-Kreis ersetzen durch „ausserhalb bounds / Wandzelle = blockiert“ (collision.ts, blink.ts, minimap.ts).
  Alte Zonen behalten ihren Kreis (zone.bounds fehlt → alter Kreis).
- Packs und Wellen spawnen nur noch auf packSpots bzw. Rand-Bodenzellen (zone.spawnOk aus dem Raster).
Commit.

## Phase 2: Layout „Offen“ (Wald, Wüste)
- Rand unregelmäßig: Radius mit Noise (± 15 %), außen Fels-/Baumwand.
- 3–5 Lichtungen (Kreise 20–35 yd), Pfade dazwischen (Polylinien wie tirPath in zones.ts wiederverwenden).
- Landmarke auf der Lichtung, die am weitesten vom Spawn entfernt ist; von überall sichtbar (hoch, ragt über den Nebel).
- Höhe: sanftes Noise wie heute, auf Pfaden flach.
Commit.

## Phase 3: Layout „Kanäle“
- Garantiert 1 Haupt-Ring (Schleife zum Kiten) + 2–4 Querkanäle. Gang 2 Zellen breit (16 yd) PH.
- Wasserrinne 4 yd mittig im Gang (Zelle wasser, bremst Spieler und Mobs 20 % PH), Stege/Brücken an Kreuzungen.
- Kreuzungen 3 × 3 Zellen = Kampfplätze (packSpots bevorzugt hier).
- 1–2 Sackgassen mit objectSpot am Ende (später Truhe).
- Decke offen lassen (Kamera), Wände hoch genug, dass man nicht drüber sieht; dunkles Licht, Nebel nah.
Commit.

## Phase 4: Layout „Räume“ (Hölle)
- 8–12 Räume (3×3 bis 6×6 Zellen), verbinden per Minimal-Spannbaum + 2 Extra-Kanten (Schleifen). Gänge 2 Zellen.
- In ~30 % der Räume Lava-Ränder (vorhandene Lava-Logik aus BRD wiederverwenden), nie im Spawn-Raum.
- Portal im entferntesten Raum, Landmarke = Höllentor dort.
Commit.

## Phase 5: Layout „Hallen“ (Kathedrale)
- Langschiff 4 Zellen breit mit Säulenreihen, 2 Seitenschiffe, Querschiff, Apsis am Ende (Landmarke + Portal).
- Zufall: Länge, Anzahl Seitenkapellen (2–6), eingestürzte Stellen (Löcher in Wänden, Schutt), spiegelsymmetrisch ja/nein.
- Bänke/Kerzen wie in kathedrale.ts wiederverwenden (Kerzen = Lichtinseln).
Commit.

## Phase 6: Themes + Arena
- src/mapgen/themes.ts: pro Theme { id, name (i18n), layout, difficulty 1–5, env, ground-Farben, Wand-/Prop-Sets, skins, hazard, landmark }.
- Schwierigkeit: Mob-Leben ×(1 + 0,25 × (difficulty − 1)), Schaden ×(1 + 0,15 × (difficulty − 1)) PH; zentral an einer Stelle anwenden.
- Mobs vorerst mit alten Typen als Platzhalter (Phase 7 ersetzt sie).
- Arena: fester Kreis ~40 yd, Säulenring, kein Generator, keine Packs; nur für Boss-Modus (#boss) als Ort nutzbar.
- Dev-Fenster: Theme + Seed wählen, „Neu würfeln“. ?theme=<id>&seed=<n>.
- Standard-Startmap = Wald.
Commit.

## Phase 7: Mob-Kategorien (src/mobKinds.ts + Skins pro Theme)
Ein Mob = Kategorie (Verhalten + Grundwerte) + Zusatz + Theme-Skin (Modell + Name). Kategorien und Zusätze einmal bauen, Themes liefern nur Skins.

Kategorien (relativ zu Normal, alles PH):
| Kategorie | Leben | Schaden | Tempo | XP | Verhalten |
| Normal    | 1×   | 1×   | 1×   | 1×   | läuft hin, schlägt; Masse |
| Schnell   | 0,6× | 0,7× | 1,4× | 0,8× | Sprung aus 8 yd (leapBite ohne Trink-Abbruch) |
| Stark     | 1,8× | 1,6× | 0,8× | 1,8× | holt 0,8 s sichtbar aus, dann harter Schlag |
| AoE       | 1,3× | 1,2× | 0,9× | 1,5× | Wirbel/Bodenschlag 5 yd, Ring 0,7 s vorher am Boden |
| Zauberer  | 0,7× | 1,1× | 1×   | 1,2× | läuft auf 12 yd ran, bleibt stehen, castet (Geschoss wie Phase 0b) |
| Werfer    | 0,8× | 0,8× | 1×   | 1×   | wie Zauberer, 15 yd, schnelleres schwächeres Geschoss |
| Hexer     | 0,7× | 1,1× | 1×   | 1,3× | wie Zauberer; EINZIGER der flieht: Teleport 8 yd weg höchstens alle 6 s, Weglaufen mit 60 % Tempo |
| Groß      | 5×   | 2,5× | 0,7× | 8×   | 2–3× Größe, Stampfen 6 yd mit 1 s Ansage, Rückstoß auf ihn halb |
| Lauerer   | 1×   | 1,5× | 1,2× | 3×   | taucht 6 yd hinter dir auf, erstarrt solange er im Sichtkegel der Kamera ist |

Spawn-Regeln:
- Pack = Normal + 1–2 andere Kategorien (Werte gewürfelt pro Pack, PH). Freischalten über die Level wie bisher (pickMobType) – Reihenfolge PH: Normal, Schnell, Werfer, Stark, Zauberer, AoE, Hexer.
- Groß: 1 pro 3–4 Packs (eigenes Pack, allein oder mit 2 Normalen). Saftig: 8× XP, sicherer Drop (Staub, 25 % Waffe; Drops kommen in Teil 2 – bis dahin nur XP), Lichtsäule beim Tod.
- Lauerer: höchstens 1 gleichzeitig, 10 % Chance pro Minute, erst ab Theme-Schwierigkeit 3.
- Fliehen ist ein Schalter pro Kategorie (flee: false Standard), nur Hexer true.

Zusatz (Feld pro Mob, Standard none, ~15 % der Mobs bekommen einen, PH):
| Zusatz | Wirkung | Fair-Regel |
| heal   | heilt einen Mob in 10 yd um 5 % Leben alle 3 s | Cast 1 s sichtbar, Treffer unterbricht |
| shield | Schild auf einen Mob in 10 yd, hält 1 Treffer, alle 6 s | Schild sichtbar |
| haste  | Aura: Mobs in 10 yd +20 % Tempo | stapelt nicht |
| fliegt | schwebt, ignoriert Gelände, immun gegen Root | Slow wirkt doppelt |
| platzt | beim Tod Explosion 4 yd | Ring 0,5 s vorher |
| teilt  | beim Tod 2 kleine mit 20 % Leben, je 0,3× XP | – |
- Höchstens 1 von heal/shield/haste pro Pack. Zusatz-Träger −30 % Leben. Zusatz sichtbar (kleines Symbol über dem Kopf oder Farbring, PH).
- Vorhandene Fähigkeiten in abilities.ts wiederverwenden wo es passt (medic, divineShield, leapBite, stomp, …) und im Bericht sagen.
- Zusätze kombinieren sich mit Champions (champions.ts) – Affixe bleiben wie sie sind.

Skins pro Theme im STRICH-STIL wie src/models/strichMagier.ts (Kevin: „cleaner, wie die Sticks“):
dunkler Körper in einer Farbe (ink), dünne Kapsel-Glieder in 2 Segmenten, Ikosaeder-Kopf und -Hände, Kegel-Füße, Toon-Material mit 3-Stufen-gradientMap + Lichtrand (RIM wie strichMagier),
eine Akzentfarbe für Kleidung/Merkmale (ac), Leuchten nur für Augen und Magie (gl). Pro Mob 1 SkinnedMesh (Teile mergen wie im strichMagier) + ggf. 1 Glüh-Mesh.
Vorlage mit allen Werten (ink/ac/gl, Proportionen, Merkmale): docs/ref/mob-viewer.html (Builder humanoid/quadruped/bat/bug + SKINS darin übernehmen).
Hölle/Kathedrale im Horror-Look à la Berserk-Dämonen / Silent Hill: entstellt, zu lange Glieder, falsche Proportionen, ruckartige Bewegung, Gesichter ohne Augen:
| Kategorie | Wald | Wüste | Kanäle | Kathedrale | Hölle |
| Normal   | Moosling | Sandschlurfer | Kanalratte | Knochen-Novize | Wichtel |
| Schnell  | Dornwolf | Wüstenräuber | Rohrkriecher | Wasserspeier | Höllenhund |
| Stark    | Hauerbulle | Grabwächter | Schlammschlurfer | Henker | Schinder |
| AoE      | Wirbelschrat | Sandwirbler | Kloakenkoloss | Geißler | Klingendämon |
| Zauberer | Irrlichtrufer | Sandpriester | Kloakenhexer | Chorgeist | Glutbeschwörer |
| Werfer   | Wurzelschleuderer | Speerwerfer | Unratwerfer | Knochenwerfer | Ascheschleuderer |
| Hexer    | Waldhexe | Grabhexer | Brackhexer | Bußhexer | Sündenhexer |
| Groß     | Moos-Oger | Sandriese | Kloakenoger | Glockenriese | Erzdämon |
| Lauerer  | – | – | Schachtlauerer | Ohnegesicht | Fleischschatten |
- Namen i18n DE/EN (Deutsch = Tabelle, Englisch selbst übersetzen, im Bericht listen).
- Dev: „Pack spawnen: Kategorie × Zusatz × Theme“ im Dev-Fenster.
Commit pro Teil: (a) Kategorien + Zusätze mit einem Test-Skin, (b) Skins Wald + Wüste, (c) Kanäle + Kathedrale, (d) Hölle.

## Test
- Phase 0b: Knochenwirker + Axtwerfer in Tirisfal: man kommt ran, seitlich laufen weicht Geschossen aus.
- Jedes Theme 20 Seeds per Skript: Flood-Fill ok, Spawn frei, Packs/Portale erreichbar, keine Mobs in Wänden, Konsole sauber.
- Screenshot von oben pro Theme, 3 Seeds nebeneinander (zeigt „anders, aber gleich“).
- Kiten im Kanal-Ring einmal per Skript ablaufen (Spieler kommt ohne Hängen rundherum).
- Jede Kategorie und jeder Zusatz einmal per Dev spawnen: Hexer flieht höchstens alle 6 s und ist einholbar, Lauerer erstarrt im Blick,
  Groß kommt 1× pro 3–4 Packs, max 1 Unterstützer pro Pack. Screenshot aller Skins pro Theme in einer Reihe.
- Alte Zonen per ?zone= laufen wie vorher.
- FPS-Tabelle pro Theme, mit vollem Pack der neuen Mobs.

## Bericht (kurz)
Commits, FPS-Tabelle, Screenshots, wiederverwendete Fähigkeiten, englische Mob-Namen, Abweichungen, Unklarheiten.
npx vite starten, Kevin die URL geben, warten.
```
