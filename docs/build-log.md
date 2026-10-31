# Build-Log

## 2026-10-31 — feat(mage): Griff im oberen Stabdrittel, beim Laufen waagerecht
**Was:** Griff sitzt ein Drittel von oben, die Hand ist dafür höher, damit der Stab nicht im Boden steckt; beim Laufen wirkte er aufrecht zu steif und liegt jetzt waagerecht.
**Nicht gebaut:** keine eigene Haltung für Rückwärts, dort bleibt er fast aufrecht.

## 2026-10-31 — feat(ui): Rückfrage vor dem Zurücksetzen der Belegung
**Was:** „Standard“ liegt direkt neben „Schließen“, ein Fehlklick löschte bisher alle eigenen Tasten; Abbrechen hat den Fokus.
**Nicht gebaut:** keine Pad-Bedienung des Fensters, „Standard“ ist am Pad ohnehin nicht erreichbar.

## 2026-10-31 — fix(input): mittlere Maustaste und Seitentasten belegbar
**Was:** Das Menü hörte nur auf `keydown`; die drei Maustasten laufen jetzt über denselben Weg wie Tasten und lösen kein Browser-Zurück mehr aus.
**Nicht gebaut:** linke und rechte Maustaste bleiben fest, sie bedienen Menü und Kamera.

## 2026-10-31 — refactor(mage): Teile pro Gelenk zusammenfassen
**Was:** Das Rig hatte 134 Draw Calls statt vorher 51, das kostet auf Rechnern ohne eigene Grafikkarte; Meshes eines Gelenks mit gleichem Material werden beim Bau verschmolzen.
**Nicht gebaut:** keine Geometrie-Reduktion, die Dreiecke bleiben.

## 2026-10-31 — feat(mage): Einknicken bei der Landung
**Was:** `player.landAt` merkt den Aufsetz-Zeitpunkt, die Knie federn 300 ms nach.
**Nicht gebaut:** kein Ausholen vor dem Sprung: Springen muss sofort auf den Tastendruck reagieren.

## 2026-10-31 — feat(mage): neues Rig mit 48 Gelenken und gebückter Haltung
**Was:** Rig aus dem Mockup übernommen: dreiteiliger Rücken, Finger, Zehen, Kiefer, Stoffkette, Gehen und Laufen als eigene Gangarten, Spinnen-Pose am Sprung-Zenit; Haltung über `CFG.mageHunch`.
**Nicht gebaut:** keine Größenänderung, keine Fußanpassung an Hänge.

## 2026-10-31 — chore(docs): Stand v5 in handoff.md
**Was:** Artifact auf v5 aktualisiert (gebündelter Build), Stand und offene Pad-Prüfung festgehalten.
**Nicht gebaut:** —

## 2026-10-31 — feat(gamepad): Vibration bei Crits und schweren Treffern
**Was:** Rumble nur, wenn der Browser dual-rumble meldet.
**Nicht gebaut:** keine Einstellung zum Abschalten, nicht verlangt.

## 2026-10-31 — feat(gamepad): Tasten-Symbole je nach letzter Eingabe
**Was:** Actionbar und Hilfe zeigen PlayStation-Symbole, sobald das Pad zuletzt benutzt wurde, und Tastaturnamen nach dem nächsten Tastendruck.
**Nicht gebaut:** keine Xbox-Symbole, kein automatisches Umschalten nach Pad-Typ (entschieden).

## 2026-10-31 — feat(gamepad): Pad-Neubelegung im Tastenbelegungs-Menü
**Was:** Dritte Spalte im Menü, Speicherung unter `frostgrind.padbinds.v1`; Bestätigen, Abbrechen und Steuerkreuz im Menü bleiben fest, damit man sich nicht aussperrt.
**Nicht gebaut:** Pad-Bedienung für die Knöpfe Standard und Schließen, Kreis schließt das Menü bereits.

## 2026-10-31 — feat(gamepad): Start, Karten und Tod per Pad bedienbar
**Was:** Kreuz löst die vorhandenen Klick-Handler aus, damit es keinen zweiten Weg durch die Menüs gibt; die Auswahl steckt nur in der CSS-Klasse.
**Nicht gebaut:** Tastenbelegung am Pad kommt im nächsten Schritt.

## 2026-10-31 — feat(gamepad): Blizzard-Zielmodus mit R1 halten, loslassen, Kreis abbrechen
**Was:** Eigener Zielpunkt `state.padAim`, die Maus-Variante über `mouse.ground` bleibt; ein Fehlschlag wie „Außer Reichweite“ beendet das Zielen, weil R1 dann ohnehin los ist.
**Nicht gebaut:** kein Schnellzauber (entschieden), kein Mitwandern des Zielkreises mit dem Charakter.

## 2026-10-31 — feat(gamepad): Zauber, Sprung, Trinken, Autorun, Zoom auf die Tasten
**Was:** Einzeldrücke rufen dieselben Funktionen wie die Tastatur; Belegung in eigenem `padBinds`, damit gespeicherte Tastatur-Belegungen unberührt bleiben (statt zweitem Feld in `binds`).
**Nicht gebaut:** L2-Modifier, weil noch keine zweite Zauberebene da ist.

## 2026-10-31 — feat(gamepad): Laufen mit linkem Stick, Kamera mit rechtem Stick
**Was:** Stick und Tastatur laufen in einen Vektor, gedeckelt auf Länge 1; unter 0,5 Ausschlag Gehen mit 2,5 yd/s (belegt), die Laufanimation folgt dem Tempo.
**Nicht gebaut:** kein eigener Geh-Animationszustand, `run` läuft einfach langsamer.

## 2026-10-31 — feat(gamepad): Pad erkennen, Achsen und Buttons pro Frame lesen
**Was:** Abfrage mit radialer Deadzone; die API ist in try/catch, weil sie in einem fremden iframe per Permissions-Policy werfen kann und sonst die Spielschleife stirbt.
**Nicht gebaut:** noch keine Wirkung im Spiel.

## 2026-10-31 — chore(docs): Controller-Spec ablegen
**Was:** Spec samt Entscheidungen (PlayStation-Symbole, kein Schnellzauber, keine Addition von Tastatur und Stick) liegt im Repo.
**Nicht gebaut:** noch kein Code.

## 2026-10-31 — chore(docs): Stand der Repo-Migration in handoff.md
**Was:** Stand-Abschnitt ergänzt, damit die Chat-Seite den Repo-Stand kennt; dazu einen doppelten Import in main.ts entfernt.
**Nicht gebaut:** keine Spec-Anpassungen, kein Artifact-Update.

## 2026-10-31 — refactor(player): Bewegung, Physik, Mana auslagern
**Was:** Danach bleiben in main.ts nur Bootstrap und Loop.
**Nicht gebaut:** keine Player-Klasse.

## 2026-10-31 — refactor(spells): cast und Spell-Logik auslagern
**Was:** Cast-Prüfung, Zauberwirkung, Channel, Slow.
**Nicht gebaut:** kein Rang-System, das ist der Spec-Schritt danach.

## 2026-10-31 — refactor(mobs): Spawn, KI, Leash, Flee auslagern
**Was:** Mob-Logik inkl. Schaden und Kill.
**Nicht gebaut:** keine Mob-Klasse, keine weiteren Mob-Typen.

## 2026-10-31 — refactor(input): Tasten, Maus, Keybinds auslagern
**Was:** Eingaben und gespeicherte Belegung; resetBinds ist neu, weil menus die Variable binds nicht mehr selbst zuweisen kann.
**Nicht gebaut:** kein Gamepad, kein Action-Mapping-Layer.

## 2026-10-31 — refactor(ui): Menüs auslagern
**Was:** Start, Karten, Tod, Tastenbelegung und Ding-Sound.
**Nicht gebaut:** kein Sound-Modul für einen einzigen Sound.

## 2026-10-31 — refactor(ui): HUD auslagern
**Was:** Frames, Actionbar, Castbar, Nameplates, Kampftext.
**Nicht gebaut:** kein UI-Framework, Markup bleibt in index.html.

## 2026-10-31 — refactor(camera): Orbit-Kamera, Kollision, Shake
**Was:** Kamera-Logik getrennt vom Render-Setup.
**Nicht gebaut:** keine Kamera-Klasse.

## 2026-10-31 — refactor(fx): Zaubereffekte auslagern
**Was:** Nova, AE, Blizzard, CoC, Blink, Decals und Dauer-Emitter an einem Ort.
**Nicht gebaut:** kein Effekt-Registry-System.

## 2026-10-31 — refactor(models): Eber auslagern
**Was:** Gleiche Schnittstelle wie der Mage.
**Nicht gebaut:** keine gemeinsame Basisklasse (nur zwei Rigs).

## 2026-10-31 — refactor(models): Skelett-Mage auslagern
**Was:** Rig mit der Schnittstelle root/update, die später ein glTF ersetzt.
**Nicht gebaut:** kein glTF-Loader, kommt mit den echten Modellen.

## 2026-10-31 — refactor(fx): Partikelsystem auslagern
**Was:** Ein Draw-Call; das Limit kommt aus PERF. glowTex liegt hier, weil auch der Kristall des Mage sie nutzt.
**Nicht gebaut:** kein Pooling, kein GPU-Update.

## 2026-10-31 — refactor(world): Terrain, Hindernisse, Kollision
**Was:** heightAt bleibt einzige Quelle für Bodenhöhe; terrainDecal und drape liegen hier, weil sie der Höhe folgen.
**Nicht gebaut:** kein Chunking, kein Spatial Grid für Kollision.

## 2026-10-31 — refactor(render): Renderer, Composer, Himmel, Licht
**Was:** Render-Setup unabhängig vom Spiel; die Schalter aus PERF greifen hier.
**Nicht gebaut:** keine Schatten, kein Bloom-Umbau.

## 2026-10-31 — refactor(formulas): Formeln mit Spec-Verweisen auslagern
**Was:** Aggro, Treffer, XP und Farben getrennt von der Welt, mit Verweis auf den Spec-Abschnitt.
**Nicht gebaut:** keine Tests für die Formeln, nicht beauftragt.

## 2026-10-31 — refactor(config): CFG, SPELLS, CARDS und Performance-Schalter
**Was:** Alle Zahlen an einem Ort; PERF schaltet Bloom, Partikel-Limit und Pixel-Ratio, Standardwerte entsprechen v4.
**Nicht gebaut:** keine Qualitätsstufen, kein Menü für die Schalter.

## 2026-10-31 — refactor(util): Helfer in util.ts auslagern
**Was:** rand, clamp, part, joint usw. brauchen fast alle Module. Modul steht nicht in der handoff-Liste, verhindert aber doppelte Helfer.
**Nicht gebaut:** keine Typ-Generics für die Helfer.

## 2026-10-31 — refactor(state): gemeinsamen Spielzustand in state.ts bündeln
**Was:** Module können fremde `let`-Variablen nicht zuweisen; now, paused, mobs usw. liegen deshalb in einem Objekt. Modul steht nicht in der handoff-Liste, ist aber für die Aufteilung nötig.
**Nicht gebaut:** keine Getter/Setter, kein Store, nur ein Objekt.

## 2026-10-31 — chore(repo): Vite + TypeScript, v4 unverändert in main.ts
**Was:** Gerüst mit Build zu einer einzelnen index.html; Spielcode unverändert aus Artifact v4, damit jeder Modul-Schritt danach prüfbar bleibt. handoff.md und mechanics-spec.md liegen jetzt in docs/.
**Nicht gebaut:** keine Linter-Konfiguration, keine Tests im Repo, kein public/assets (noch keine Assets).
