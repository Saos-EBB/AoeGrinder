# Build-Log

## 2026-11-01 — chore(docs): Stand v9 in handoff.md
**Was:** Teil Grün ergänzt, Artifact auf v9 aktualisiert.
**Nicht gebaut:** —

## 2026-11-01 — chore(score): Spielversion v9
**Was:** Runs des neuen Builds liefen sonst in der Rangliste als v8, obwohl Level und Modi anders sind.
**Nicht gebaut:** —

## 2026-11-01 — fix(cards): Keine Talente für verlernte Spells
**Was:** Improved Blizzard, Improved Frost Nova und Weiter Sturm kamen auch ohne den Spell im Slot und hätten dann nichts bewirkt. Sie verlangen ihn jetzt über `needs`.
**Nicht gebaut:** kein Zurücksetzen von Rängen und Runen beim Verlernen; ein verlernter Spell kann weiter als Neuer Spell kommen.

## 2026-10-31 — chore(docs): Stand Branch gruen-polish
**Was:** Prüfstand und offene Punkte in `docs/status-gruen.md`.
**Nicht gebaut:** —

## 2026-10-31 — feat(spells): Echte Cast-ID
**Was:** Multi-Kills zählten pro Spell, zwei getrennte Casts galten also als einer. Jetzt hat jeder Cast und Kanal eine eigene ID.
**Nicht gebaut:** keine Änderung an `score.ts`, Fähigkeiten und Lava bleiben ohne ID.

## 2026-10-31 — feat(score): Feld build der Rangliste
**Was:** `recordRun` speichert mit leerem `build`, und `leaderboard.ts` gehört Blau. Darum schreibt `saveRunBuild()` in `core.ts` den Text einen Frame nach dem Tod in den letzten Eintrag.
**Nicht gebaut:** keine Anzeige. Der Speicherschlüssel steht dadurch doppelt im Code; sauberer wäre `build: buildText()` direkt in `recordRun`.

## 2026-10-31 — feat(modes): Modi Teil 2
**Was:** Fünf Modifikatoren und drei Presets als Daten. Das Start-Kit wird beim Klick auf Start gesetzt, weil die Modus-Auswahl davor nur `resetGame` aufruft.
**Nicht gebaut:** keine Vorschau des Start-Kits im Startmenü.

## 2026-10-31 — feat(fx): Texturen für die Bodenflächen der neuen Spells
**Was:** Glut, Wind, Leere und Entweihung als Canvas-Texturen im Stil von `iceTex`/`runeTex`, die flachen Farbscheiben sind weg. `fieldDecal` nimmt jetzt Textur, Farbe, Deckkraft und Drehung.
**Nicht gebaut:** keine Texturen für Effekte ohne Bodenfläche, Feuerring und Feuernova bleiben Partikel.

## 2026-10-31 — fix(spells): Kein Pushback durch Schaden über Zeit
**Was:** Das Zaubern erkannte Treffer nur am Lebensverlust, also zählten Ticks mit. Jetzt zählt die Quelle aus `player.lastHitBy`. Kanäle schützt `damagePlayer` schon vor Gift.
**Nicht gebaut:** kein Treffer-Ereignis in `player.ts`. Lava-Ticks schieben Kanäle weiter (`abilities.ts` ruft `damagePlayer` ohne `dot`).

## 2026-10-31 — fix(fx): Treffer-Funken nur in der eigenen Schule
**Was:** `damageMob` sprühte bei allem außer Arcane Frost, die neuen Schulen kamen obendrauf. Jetzt sucht `hitSparkFx` die Farbe über die Spell-ID.
**Nicht gebaut:** —

## 2026-10-31 — feat(gamepad): Slot 7/8 und Zielmodus in jedem Slot
**Was:** Bodenziel-Spells lagen außerhalb von Slot 3 fest 12 yd vor der Figur. Jetzt gilt überall: halten, rechter Stick verschiebt, loslassen zaubert, Kreis bricht ab.
**Nicht gebaut:** keine eigene Zielgeschwindigkeit pro Spell.

## 2026-10-31 — fix(input): Taste 3 nicht mehr fest auf Blizzard
**Was:** Taste 3 lief über einen Sonderfall und wurde erst in `resolveSlot3()` aufgelöst. Jetzt geht sie den Weg aller Slots über `cast()`.
**Nicht gebaut:** kein neuer Zielmodus am Pad, der folgt im nächsten Schritt.

## 2026-11-01 — chore(docs): Stand v9 Teil Blau in handoff.md
**Was:** Branch `blau-levels` per Fast-Forward in `main`; die Einzelschritte stehen in `docs/status-blau.md`.
**Nicht gebaut:** kein Publish, Artifact bleibt auf v8.

## 2026-10-31 — chore(docs): Stand v8 in handoff.md
**Was:** Branch `maps` per Fast-Forward in `main`, Artifact auf v8; die Einzelschritte von Punkte und Draw Calls stehen in `docs/status-maps.md`.
**Nicht gebaut:** Punkte Teil 2.

## 2026-10-31 — chore(docs): Stand v7 und offene Leistungsmessung in handoff.md
**Was:** Artifact auf v7 aktualisiert; der Optimierungsplan steht unter Offen, samt dem, was davon schon gebaut ist.
**Nicht gebaut:** keine Optimierung.

## 2026-10-31 — feat(ui): Leistungsanzeige im Dev-Menü
**Was:** FPS, Draw Calls und Mob-Anzahl oben rechts, damit die Mob-Rigs auf dem echten Rechner messbar sind. Draw Calls zählen über den ganzen Frame, sonst zeigt `renderer.info` wegen des Composers nur den letzten Durchgang.
**Nicht gebaut:** keine Optimierung, erst wird gemessen.

## 2026-10-31 — feat(mobs): Lava schadet auch Mobs
**Was:** Entscheidung: Mobs laufen weiter gerade durch die Lava und nehmen dort denselben Schaden wie der Spieler; das macht Lava zu einem Werkzeug beim Pullen.
**Nicht gebaut:** kein Pathfinding, kein Schaden durch die Lavaflächen des Abgesandten.

## 2026-10-31 — feat(zones): Elvyn, der Wald vom Anfang mit Ebern
**Was:** Die erste Welt kommt als fünfte Zone zurück: gleiches Licht, Gelände, Nadelwald und nur Wildeber, wählbar im Esc-Menü.
**Nicht gebaut:** keine weiteren Mob-Typen, der Eber bleibt der einzige Mob dort.

## 2026-10-31 — chore(docs): Stand v6 in handoff.md
**Was:** Artifact auf v6 aktualisiert (gebündelter Build), Stand festgehalten.
**Nicht gebaut:** —

## 2026-10-31 — fix(mobs): Sanitäter nur in jedem zweiten größeren Pack
**Was:** In jedem Pack ab 3 Mobs lag der Sanitäter bei einem Drittel aller BRD-Spawns und drückte die 50-%-Regel für den Start-Mob.
**Nicht gebaut:** —

## 2026-10-31 — feat(zones): Blackrock Depths mit fünf Mobs
**Was:** Basalt, Lavaflüsse als Schadenszone, Brücken, Korridore, Schmiede; Sanitäter in jedem größeren Pack (`packAlways`), Heilung, Gottesschild, Hitzeaura, Lavaflächen. Eber und Platzhalter-Welt sind damit überflüssig und gelöscht.
**Nicht gebaut:** keine Wegfindung um Lava: Mobs laufen durch und nehmen keinen Schaden.

## 2026-10-31 — feat(zones): Tanaris mit fünf Mobs und Sandsturm
**Was:** Dünen, Ruinen mit Brunnenturm, Schlund im Süden, Hitzeflirren im Nachbild; Insekten-Rig; Manaraub, Stampfer mit Betäubung, Schwärmlinge, stapelndes Gift; Sandsturm alle 3 Minuten. Gift-Ticks brechen Trinken nicht, gelesen aus „tickt weiter, auch beim Trinken“.
**Nicht gebaut:** Schwärmlinge geben keine XP, damit das Beschwören nicht zum XP-Quell wird.

## 2026-10-31 — feat(zones): Schlingendorntal mit fünf Mobs
**Was:** Dschungel mit Zikkurat, Fluss, Strand und Pfaden zwischen vielen Bäumen; Raptor-Rig; Rudelwut, Axtwurf, Fluch, getarnter Panther. Der Fluch bremst über `player.slowUntil`, Nameplates respektieren `mob.hidden`.
**Nicht gebaut:** keine Tarnung nach dem Zurücklaufen: einmal entdeckt bleibt der Panther sichtbar.

## 2026-10-31 — feat(zones): Tirisfal mit fünf Mobs
**Was:** Erste echte Zone: grüner Nebel, Windmühle, Friedhof, See, Wachturm, Kürbisfelder; Baukasten `creatures.ts` für die Mob-Rigs; Sprungbiss, Schattenblitze, Lebensraub, Alarm. Mob-Modelle werden beim Entfernen freigegeben, sonst läuft der Speicher voll.
**Nicht gebaut:** keine Tierfallen- oder Wegfindung: Mobs laufen weiter gerade auf den Spieler zu.

## 2026-10-31 — feat(mobs): Fähigkeiten-Hooks und Typ-Werte
**Was:** `mobs.ts` ruft vier Hooks auf und kennt Typ-Werte; `spawnMob`, `hitPlayer`, `startLeap`, `applyRoot` stehen den Fähigkeiten offen. Noch keine Fähigkeit belegt, das Spiel läuft wie vorher.
**Nicht gebaut:** kein `onDeath`-Hook: Pack-Tode zählt `killMob` direkt, sonst braucht ihn keine Fähigkeit.

## 2026-10-31 — feat(zones): Zonen und Mob-Typen datengetrieben, Dev-Zonenwechsel
**Was:** Welt, Licht und Mob-Auswahl kommen aus `ZONES` und `MOB_TYPES`; bisherige Welt ist Platzhalter für alle vier Zonen, das Esc-Menü wechselt die Zone. Die Gras- und Baumfarben sind jetzt pro Instanz statt Einzelfarbe nur noch beim Gras.
**Nicht gebaut:** kein Zonen-Fortschritt im Spiel, der Wechsel bleibt ein Dev-Knopf.

## 2026-10-31 — chore(docs): Zonen-Spec ablegen
**Was:** Auftrag für vier Zonen mit je fünf Mobs liegt als Quelle im Repo.
**Nicht gebaut:** noch kein Code.

## 2026-10-31 — feat(mage): Stab auf den Rücken
**Was:** Griff und waagerechtes Tragen haben nicht gefallen; der Stab hängt jetzt quer am Rücken, der rechte Arm schwingt frei wie der linke, Zauber-Partikel kommen aus der rechten Hand.
**Nicht gebaut:** keine Animation zum Ziehen des Stabs.

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
