# Frost Grind – Stand & Übergabe

**Spiel-Artifact:** „Frost Grind – Prototyp“ · https://claude.ai/artifact/68vgdsC4svaWovgDnPum84 · slug `2998fbb5-dd3d-4566-a5fc-dab03102f1e9`
**Live-Version für Kevin:** https://saosgonegametry02.vercel.app/ (Vercel-Team `saosgone`, Projekt `saosgonegametry02`). Deploy: `dist/index.html` in einen leeren Ordner kopieren, dort `vercel link` und `vercel deploy --prod`; ein Push deployt nicht.
Stand Vercel: v23 von `main` (2026-11-04): Schulen geschärft (neue Arkan- und Feuer-Spells, Blitz und Hurrikan raus, Kill-Anzeige mit Modell-Stufen, Blink-Ränge). Stand Artifact: v15 (`1793625667-fc85`, 2026-11-02), `SCORE_VERSION` dort noch v14. Das Repo ist die Quelle, das Artifact wird nicht direkt editiert.
**Mechanik-Quelle:** `docs/mechanics-spec.md` (VMaNGOS + Wowhead, jede Regel mit Beleg).
**Modell-Quelle:** Viewer „Frost Grind – Strichmagier“ (https://claude.ai/artifact/5gmtckZXNhJgC3peZ8xArU), „Frost Grind – Strichkrieger“ (https://claude.ai/artifact/CWAKpz96NVdZ2sQQWd8yXR), „Frost Grind – Klingenstrich“. Im Spiel: `models/strichMagier.ts`, `strichKrieger.ts`, `klingeModel.ts`. `heroModels.ts` ist gelöscht (alte Magier, Krieger, Samurai, Ninja); Spuren und `SKIN_FX` liegen in `models/trail.ts`.

## Regeln
1. Es gibt nur noch `main` und einen Agenten, keine parallelen Branches oder Worktrees mehr.
2. Ein Commit pro Schritt. `tsc` und `npm run build` müssen sauber sein. Pushen und Artifact-Publish nur auf Kevins Wunsch.
3. Vor jedem Publish die live Version lesen und aktualisieren, danach den Stand unten nachtragen.
4. Werte ohne Beleg im Code mit `// PH` markieren, belegte Werte mit Quelle kommentieren.
5. `SCORE_VERSION` erhöhen, sobald eine Änderung die Punkte beeinflusst: Die Rangliste trennt danach alte und neue Läufe.

## Code-Karte
- `src/main.ts`: Bootstrap, Loop, Hitstop. Test-Hook `window.__game`.
- `src/config.ts`: `CFG`, `SPELLS`, `CARDS`, `SCORE_*`, `LEVEL_*`, `PERF` (Bloom, Partikel, Pixel-Ratio, `vfx`-Stufe), `WORLD_K` (Radius-Faktor der Karte, 2 = vierfache Fläche).
- `src/formulas.ts`: Aggro, Hit, XP, Schaden, Mob-Leben und Schadensreduktion (`mobDmgTaken`), `maxMana` (mit `player.rageMax` für Wut).
- `src/modifiers.ts`: `MODIFIERS`, `MODES` (auch Nur Arkan, Real Men), `mobMode`.
- **Welt:** `world.ts` (`heightAt`, Terrain, `buildWorld`), `collision.ts` (`groundAt`, `resolve`, begehbare Flächen; für Effekte und Bodenziele immer `groundAt`), `zones.ts`, `props.ts` (`scatter` skaliert Karten-Streu mit `WORLD_K`).
- **Spieler:** `player.ts`, `input.ts`, `gamepad.ts`, `camera.ts`.
- **Handy:** `boot.ts` (Startbildschirm Desktop oder Handy, lädt danach `main.ts`; `?mobile=1` oder `0` überspringt ihn), `device.ts` (`device.mobile`, Vollbild und Querformat-Sperre, sonst `html.rot` mit um 90° gedrehter Seite; `viewW`/`viewH`/`toView` statt `innerWidth`/`innerHeight`), `mobile.ts` (Touch-Sticks und 8 Slot-Tasten, Tippen auf den rechten Stick springt). Touch läuft über `pad` in `gamepad.ts`. Eigenes HUD-Layout in `ui/hudLayout.ts`, CSS unter `body.mobile` und `html.rot` in `index.html`.
- **Modell:** `models/strichMagier.ts`, `models/strichKrieger.ts`, `models/klingeModel.ts`, Testseiten `/strich.html` und `/klinge.html`, `models/mage.ts` (Hülle, Skin aus dem Modus, `SKIN_WEAPON`), `models/weapons/` (Baukasten und die alten Modelle als Unikate), `models/creatures.ts`, `models/boar.ts`.
- `src/skinFx.ts`: Feuerspur 5 dps, Frostspur 30 % Slow, Arkan +10 % Tempo.
- `src/realMen.ts`: Modus Strichkrieger (Modus-ID bleibt `realmen`). Alle Zahlen in `REALMEN`, Wut steht in `player.mana`, Faktor `rageMul`. Moves sind Spells mit `press`. Wirbelwind-Radius Classic: [Wirbelwind](https://vanilla-wow-archive.fandom.com/wiki/Whirlwind).
- `src/melee.ts`: gemeinsame Helfer von Real Men und Klingenstrich (Kosten/Abklingzeit, Linie, Sprint, Bewegungsfenster, verzögerte Treffer, Wellen).
- `src/klinge.ts`: Modus Klingenstrich, alle Zahlen in `KLINGE`. Keine Ressource, `player.resLabel` zeigt die Haltung. `models/klingeModel.ts`: Figur, Aktionen, `cloneKlinge`, Testseite `/klinge.html`. Eigene Tasten in `useKlingeBinds` (`input.ts`).
- `src/siege.ts`: Mob-Modus Belagerung mit Zielen 5, 10, 15 Minuten und endlos, Rate in `SIEGE`, je ein Ranglisten-Tab.
- `src/wucht.ts`: Zahlen in `W`. Trauma-Wackeln hinter `shakeCamera()`, Hitstop selbst in `fx/impact.ts` (Zeitlupe `W.hitstop.scale`, Crit nur bei Einzelziel über `noteHit`), große Treffer ab `W.big.frac` des Mob-Lebens: Kamera-Ruck, Boden-Spur (ein InstancedMesh), Trümmer, Knockback (`bigKnock` in `mobs.ts`). `src/champions.ts`: Zahlen in `C`, Spawn in `spawnPack`, Dev-Knopf in den Einstellungen.
- `src/models/weapons/baukasten.ts`: Waffen-Baukasten aus dem Viewer (https://claude.ai/artifact/McdzspSdum69PJUhrWJjKy), 4 Typen ohne Nebenhand, statische Teile pro Material verschmolzen. `weaponRolls.ts` würfelt die Schichten (`ROLLS`), alte Waffen `{ e, r, m }` bleiben gültig, neue sind `{ v: 2, r, s }`.
- `src/boss.ts`: Boss-Prototyp (Branch `boss`), nur mit `#boss` oder Dev-Knopf „Boss jetzt“. Alle Zahlen in `B`. Haken: `updateBoss`/`updateBossVisuals`/`bossBusy`/`bossTimeScale` in `main.ts`, `setCamOverride` in `camera.ts`, `state.bossLock` (A/D seitwärts, `player.ts`), `state.bossAim` (Bodenzauber, `spells/core.ts`, `gamepad.ts`), Tint `boss`/`boss2` in `creatures.ts`. Test-Hook `window.__boss`.
- `src/dodge.ts`: Ausweichen, Zahlen in `DG`. i-Frames in `damagePlayer`, Bewegung über `dodgeVelocity` in `updatePlayer`, Kombo pro Modus über `consumeCombo` (Spell-Kern, `realMen.ts`, `klinge.ts`), Start-Effekte (Mini-Nova, Feuerspur) in `startDodge` (`player.ts`).
- `src/weaponRolls.ts`: Mage-Waffen (Effekt × Seltenheit), Kiste, Inventar, Wirkung über `mods`/`stat`/`state.poolExtra`, Zahlen in `ROLLS`. `ui/saveCode.ts`: Spielstand-Code. Modus-Regeln (`dotMul`, `baseCrit`, `hitSlow`, `castWhileMoving`, `blinkCharges`, `manaCost`) stehen in `MODIFIERS`, gelesen über `modValue`.
- `src/meta.ts`: Knochenstaub, gesperrter Pool, Shop-Stufen und Preise in `META` (`docs/pool-liste.md`). `ui/shop.ts`: Ablauf Ergebnis → Shop → Hauptmenü, Shop im Hauptmenü. Credits: `docs/credits.md`.
- `src/mobs.ts`, `mobTypes.ts`, `abilities.ts`: Spawn (Ring um den Spieler), KI, `damageMob`, Fähigkeiten.
- `src/spells/`: ein Spell pro Datei, `core.ts` (Casts, `mobsInRadius`, `applySlow`, Felder), `fx.ts` (gemeinsame Optik), `relics.ts`, `supports.ts`. `src/cards.ts`: Level-Karten.
- **Effekte:** `render.ts` (Composer, Bloom, Tiefentextur), `fx/spellFx.ts`, `fx/frostFx.ts`, `fireFx.ts`, `arcaneFx.ts`, `relicFx.ts`, `prims.ts`, `bolts.ts`, `impact.ts`, `shaders.ts`, `softPass.ts`, `particles.ts`, `sound.ts`.
- **VFX-Labor:** `vfx.html` + `src/vfxLab.ts`, im Dev-Server unter `/vfx.html`, `npm run build:vfx`.
- **Oberfläche:** `ui/hud.ts`, `ui/hudLayout.ts` (Anker, Bearbeiten-Modus), `ui/minimap.ts` (Minimap, Zahlen in `MINIMAP`), `ui/mainMenu.ts` (Hauptmenü, Pause), `ui/menus.ts` (Karten, Keybinds, `syncPause`), `ui/charWindow.ts`, `ui/dmgNumbers.ts`, `ui/scoreHud.ts`, `ui/leaderboardView.ts`. Farben in `ui/colors.ts`, Größen in `ui/uiConfig.ts`, Icons in `ui/icons.ts`. Konzept: `docs/ui-meta-konzept.md`. Punkte in `score.ts`, `leaderboard.ts`.
- `npm run build` erzeugt eine einzelne `dist/index.html` fürs Artifact.

## Stand
- v23 (auf `main`, auf Vercel) – Schulen geschärft: Kettenblitz, Bogenblitz, Hurrikan raus; Arkane Geschosse (ersetzt Sperrfeuer) und Arkanes Mal (`spells/arcmark.ts`, Haken `onArcaneHit` in `core.ts`); Phönix (`spells/phoenix.ts`, fängt den Tod in `damagePlayer`) und Brandmal-Detonation (Brand am Mob: `mob.burn`, `burnLeft`); Blink-Ränge Reichweite und Abklingzeit (Rang-Arten `range`, `cd`); Kill-Anzeige der Schul-Modi (`schoolMeter.ts`, Zahlen in `SCHOOL_METER`) mit 4 Modell-Stufen (`anim.stage`, `trail.setStage`). Alte Waffen mit entferntem Fokus lesen den Ersatz (`focusId` in `weaponRolls.ts`). Getestet per Skript.
- v22 (auf `main`, auf Vercel) – Minimap (`ui/minimap.ts`). Mobs hinter dem Nebel ausgeblendet, Animation nach Abstand, Schatten nur im Lichtkreis (`PERF.mob*` in `config.ts`, Schleife in `main.ts`). Mob-Modelle in `creatures.ts` (`skin()`) als SkinnedMesh pro Material, die Gelenk-Gruppen sind die Knochen. Level 30: 1130 → 86 Draw Calls. Getestet per Skript und Bildvergleich.
- v22 (auf `main`, auf Vercel) – Klingenstrich-Q als Schlag-Kette (`KLINGE.q.chain`, Dauern in `KLINGE_TIMING.qChain`), Endpose halten, Wegstecken nach Ablauf. Globaler Cooldown entfernt. Waffen-Werte in festen farbigen Zeilen (`effectRows`, `weaponStats`). Level-Karten zeigen, was sie ersetzen (`cardReplaces`). Dev-Knöpfe Inventar füllen/leeren. Getestet per Skript.
- v21 (auf `main`, auf Vercel) – Dodge mit perfektem Dodge, Kombo pro Modus, 2 Karten. Licht in Dunkel als Kreis über der Figur. Packs doppelt so groß (`PACK_SIZE_MUL`), Champion-Packs 20 % ab Level 6, zu niedrige unberührte Packs werden außer Sicht ersetzt (`replaceStalePack`). „Große Packs“ bei Level 30: rund 436 Mobs, 31 FPS. Getestet per Skript.
- v20 (auf `main`, auf Vercel) – Waffen-Baukasten für Magier, Spielversion v20. Getestet per Skript.
- v20 (auf `main`, auf Vercel) – Wucht und Champion-Packs. Getestet per Skript, nicht von Hand gespielt.
- v19 (auf `main`, auf Vercel) – Modi-Konzept: Tag Dunkel, Schulen mit Stärken und Schwächen, Eisblock, Flammenstoß 0,5 s und Feuerball 0,35 s, Mage-Waffen aus der Magischen Kiste (`weaponRolls.ts`, Inventar in `meta`), Spielstand-Code (`ui/saveCode.ts`), `heroModels.ts` gelöscht. Getestet per Skript, nicht von Hand gespielt.
- v18 (auf `main`, auf Vercel) – Strichkrieger ersetzt den Skelett-Krieger samt 4 Waffen, Strichmagier ersetzt die Skelett-Magier. Getestet per Skript, nicht von Hand gespielt.
- v17 (auf `main`) – Neuer Nahkämpfer Klingenstrich, Gebeinsamurai und Aschenschatten entfernt (`buildSamurai`, `buildNinja` bleiben in `heroModels.ts`, weil die Datei aus dem Viewer kommt). Dunkel liegt unter `/dark`. Getestet per Skript, nicht von Hand gespielt.
- v16 (auf `main`, noch nicht deployt) – Run auf 15 Minuten ausgelegt: `LEVEL_PACE` bremst XP bei Vorsprung und hilft bei Rückstand, `LEVEL_KILLS` statt fester 10 Kills, Kartentakt als Reihe im Hauptmenü (`CARD_PACES`: Gestaffelt mit 31 Karten, 1 pro Level, 1 pro 2 Level, 1 pro 3 Level) mit eigener Mindestlücke zwischen den Fenstern, Heilung und Mana pro Level statt pro Karte. Schul-Modi nur noch mit Karten der eigenen Schule. 6 neue Spells, Nahkampf-Tuning, Wirbelwind-Fix. Getestet per Skript, nicht von Hand gespielt.
- v15 – Handy: Startbildschirm Desktop oder Handy, Vollbild quer (sonst um 90° gedrehte Seite), Touch mit 2 Sticks und je 4 Tasten, eigenes HUD-Layout, Menüs im Vollbild. Dazu Nahkämpfer aus PR #2 (Real-Men-Waffen, Ronin, Schatten, `heroModels.ts`). Getestet per Skript, nicht am echten Handy.
- v14 – Neue UI: Hauptmenü, verschiebbares HUD mit Einrasten, Icons, Schadenszahlen, Karten mit echter Vorschau, Charakterfenster, Pause-Menü, Auto-Kamera. Meta Phase 1: Speedrun-Zeit mit Splits, Belagerung mit Zielen 5, 10, 15 Minuten und endlos, Knochenstaub, gesperrter Pool, Shop nach Abschluss und im Hauptmenü, Credits. Level-up heilt 25 % Leben. Getestet per Skript in allen Modi, nicht von Hand gespielt.
- v12 – Alle Branches in `main` zusammengeführt. Neues Spielermodell mit 4 Skins, 15 Waffen als Standard pro Skin und Skin-Effekte; Modus Nur Arkan (Leerenkugel zählt als Arkan); Modus Real Men mit 6 Attacken und je 3 Runen; Karten mit vierfacher Fläche; Mob-Modus Belagerung; Mobs mit doppeltem Leben und Schadensreduktion pro Level; neue Spell-Effekte, Sound und VFX-Labor, Effekte liegen über `groundAt`. Getestet per Skript in allen Modi, nicht von Hand gespielt.
- v11 – Spells kennen die massiven Objekte: Blink stoppt vor Wänden und landet auf begehbaren Flächen, Bodenziele und Zielkreis liegen auf `groundAt`, Flächen-Spells treffen nur unter 3 yd Höhenunterschied (`SPELL_AOE_HEIGHT`, PH). Spielversion v11, weil die Höhenprüfung Treffer ändert. Getestet per Skript, nicht von Hand gespielt.
- v10 – **Teil Blau:** Massive Objekte in allen Zonen für Spieler und Mobs, neues `src/collision.ts` (Kreis, gedrehte Box, begehbare Fläche, 8-yd-Raster, Stufe 0,6 yd), Mobs weichen seitlich aus und folgen festen Treppen-Spuren. Wachturm (Tirisfal) und Zikkurat (Schlingendorntal) sind begehbar, Dev „Collider anzeigen“ im Esc-Menü. Audit in `docs/map-audit.md`. Alle neuen Zahlen sind `// PH`; getestet per Skript, nicht von Hand gespielt. **Teil Grün:** Mob-Dichte (mindestens 40 Mobs ab Level 1, enge Packs zu 4–6, tote Packs kommen sofort nach), Leash entfernt auf Kevins Wunsch (Vermerk in `docs/mechanics-spec.md` §4; Mobs brechen nur beim Tod der Figur ab, Fliehen bleibt), Spielversion v10. Feeling-Fixes (Tempo, Drehen, Sprung, Kamera) sind nicht enthalten, dazu kam bisher kein Wunsch. Balance ungeprüft.
- v9 – **Teil Blau:** Level 1–100 mit neuer Skalierung, Mob-Freischaltung pro Zone mit Einblendung, Dev „Level setzen“ im Esc-Menü, Hardmode-Fix (Halbe Werte als eigener Faktor), castKey-Vorrang in `score.ts`. Spec in `docs/levels-spec.md`. Alle neuen Zahlen sind `// PH`. **Teil Grün:** Nacharbeiten (Taste 3 frei, Pad-Slots 7/8 auf R2 und Steuerkreuz rechts, Zielmodus für Bodenziel-Spells in jedem Slot, Funken in der eigenen Schule, kein Zauber-Pushback durch Gift und Lava, Bodentexturen), Modi Teil 2 (Nur Frost, Nur Feuer, Kein Trinken, Classic pur, Kein Glück und drei Presets), Feld `build` der Rangliste, echte Cast-ID. Details in `docs/score-spec.md`. Das echte Pad und die Spielbalance sind ungeprüft.
- v8 – Punkte mit HUD, Modi und Modifikatoren im Startbildschirm, lokale Rangliste mit Export und Import (`docs/score-spec.md`, Teil 2 steht aus); Draw Calls pro Mob gesenkt, Materialien geteilt. Enthält das Spell-System aus v7. Alle Punktwerte sind `// PH`.
- v7 – Fünfte Zone Elvyn (Wald mit Ebern), Lava schadet auch Mobs (`// PH`, kein Pathfinding), Leistungsanzeige im Dev-Menü (FPS, Draw Calls über den ganzen Frame, Mobs). Dazu Spell- und Kartensystem laut `docs/spells-spec.md`: 8 Slots, 9 neue Spells, Runen, Supports, 6 Relikte ab Level 30, Karten mit Seltenheit und Glück, Dev-Karten im Esc-Menü. Alle neuen Werte sind `// PH`, die Spielbalance und das echte Pad sind ungeprüft.
- v6 – Vier Zonen laut `docs/zones-spec.md` (Tirisfal, Blackrock Depths, Schlingendorntal, Tanaris) mit je fünf Mobs und Fähigkeiten, Sandsturm in Tanaris, Lava in BRD; Dev-Zonenwechsel im Esc-Menü. Dazu neuer Magier mit 48 Gelenken, Stab auf dem Rücken, Mittel- und Seitentasten der Maus belegbar, Rückfrage bei „Standard“. Alle Zonen- und Mob-Werte sind `// PH`. Getestet per Skript und Standbild, die Spielbalance ist ungeprüft.
- v5 – Erster Build aus dem Repo, mit Controller-Steuerung (`src/gamepad.ts`, Spec: `docs/gamepad-spec.md`): Laufen/Gehen analog, Kamera, Zauber, Blizzard mit R1 halten, Menüs, Neubelegung, PlayStation-Symbole, Vibration. Getestet mit simuliertem Pad; `mapping === "standard"` am echten PS-Pad steht noch aus. Im Artifact kann die Gamepad-API am iframe scheitern, dann läuft das Spiel nur ohne Pad weiter.
- Repo-Migration (Basis v4 `1793417937-48fc`) – Vite + TypeScript, Module laut Liste unten plus `state.ts` und `util.ts`; `PERF` in `config.ts` (Bloom, Partikel-Limit, Pixel-Ratio); `npm run build` erzeugt eine einzelne `dist/index.html`. Verhalten wie v4, Artifact noch nicht aktualisiert, nichts gepusht.
- v4 – Abendlicht (tiefe Sonne, warmer Dunst, Sonnenscheibe, Vignette); Nova legt Eisfläche mit Rissen; AE mit Runenkreis; Blizzard-Wolke; Treffer-Blitz, Kamera-Wackeln bei Crits, Leichen versinken; Kamera weicht Baumkronen aus.
- v3 – Skelett-Mage mit rotem Lendenschurz + Kristallstab; Schatten aus; Partikel + Bloom; Leben ×2 (1040 @20), Mana = Leben × 4/3; Bewegung belegt aus baseMoveSpeed (7 / 4,5 / π).
- v2 – WoW-Kamera/Steuerung, Sprung, Terrain + Kollision, Gelenk-Rigs, Keybind-Menü.
- v1 – Kernloop: Aggro, Social Aggro, Leash, Flee, 6 Spells, 5-Sek-Regel, Pushback, XP, Level-Karten.

## Offen
**Kevin:**
- Handtest: Shop, Staub-Tempo, Einrasten, Auto-Kamera, Spielgefühl der neuen Mob-Werte, Pad.
- Kartengröße bestätigen: gebaut ist vierfache Fläche, 4× Breite wäre `WORLD_K = 4` (ungetestet, teurer).
- Auto-Kamera prüfen: gelesen als Drehen mit der Laufrichtung.
- Neue Optik abnehmen, danach kann die Alt-Optik im Labor raus.
- Vercel: Der angemeldete Account `kevinschaberl-8542` hat nur das Team `saosgone`, m2tn fehlt.

**Viewer (Modell):**
- Modell im Abendlicht sehr dunkel, vor allem Kapuze und Feuer-Skin.
- Füße rutschen: `speedK` bei 1,8 gedeckelt, etwa 1,2 Schrittzyklen pro Sekunde, altes Modell 2,1.
- Spuren haben Lücken (rund 3 yd Abstand bei 0,45 yd Radius). Kein Einknicken beim Landen (`squat`).

**Dunkel (immer an, Kevins Wunsch; `/dark` bleibt als alter Link über `vercel.json`; Zahlen in `D` in `src/dunkel.ts`):**
- Einzige Stelle mit Schatten-Maps: ein Spotlicht senkrecht über der Figur, Lichtkreis rundum. Mobs werfen nur im Lichtkreis Schatten, hinter dem Nebel werden sie gar nicht gezeichnet (`PERF.mob*` in `config.ts`).

**Balance (alles `// PH`):**
- Pacing: Mit festen Kill-Raten im Skript 14–16 Minuten bis Level 100, im echten Spiel ungeprüft. Die Bestzeit-Liste ist dadurch gedeckelt, Läufe unter etwa 14 Minuten sind kaum möglich.
- Nur Arkan hat kein Relikt, die anderen Schulen haben je zwei.
- Shop: Preise und Staub-Formel in `META`. Ein Abschluss ist für neue Angebote nötig; der schnellste Weg ist Belagerung 5 min.
- Mana-Bedarf pro Kill etwa verdoppelt. Arcane only hat nur zwei Schadens-Spells. Donnerknall (10 Schaden, Classic) ist schwach. Real Men hat weder Trinken noch Blink.
- Belagerung: Rate in `SIEGE`, „Größter Pull“ treibt die Punkte sehr hoch. Ohne Leash jagen gezogene Mobs unbegrenzt.
- Weitere Platzhalter: Mob-Tempo, Trinkwerte, Radien, Crit, Sprungphysik.

**Klingenstrich, alles `// PH`, getestet per Skript, nicht von Hand gespielt:**
- Kevin bestätigen: keine Ressource; Abklingzeit-Kürzung auch für Blutwirbel; Q und Strichschnitt in Zweihand teilen den Schaden auf 2 Schnitte; Einhand kürzt auch den Blutwirbel auf 2,6 s.
- Aderlass zündet einmal, Klone geben je +50 %. Kein Haltungs-Faktor darauf, er steckt schon in den Stapeln. In Zweihand steckt die Figur links weg und zieht am Ende beide wieder.
- Blutung ignoriert Crits. Keine Icons für die 8 Slots. Im Modus keine Seitwärts- und Autorun-Taste (Q, E, R belegt), Seitwärts geht mit rechter Maus plus A/D.
- Ungetestet: Runen Jäger, Gerichteter Wurf, Blutzoll; Pad und Handy.

**Strichkrieger-Waffen (Branch `waffen`):** Riesenschwert (Schlachtblech), Holzfälleraxt, Streitkolben; Wahl vor dem Run, gespeichert in `frostgrind.warWeapon`. Zahlen und Kits in `REALMEN.weapons` und `KITS` (`realMen.ts`), Modelle und Schlag-Dauern in `strichKrieger.ts` (`STRICH_TIMING.weapons`). Modelle selbst gebaut, nicht aus dem Viewer. Runen für Q und Maus 4 von Axt und Kolben fehlen noch. Die Runen-Freischaltungen im Shop gelten pro Slot, also für alle drei Waffen gemeinsam.

**Strichkrieger, alles `// PH`, getestet per Skript, nicht von Hand gespielt:**
- Kevin bestätigen: Halten von Q schlägt weiter (Entwurf: ein Schlag pro Druck); Kosten und Abklingzeiten der neuen Moves sind frei gesetzt; Wirbelwind behält Radius 8 aus dem Spiel, der Viewer zeigt 3,2.
- Rüstung 25 % plus ×3 bei voller Wut und wenig Leben, dazu Letzter Atem: Balance ungeprüft. Runen fast alle ungetestet. Keine Icons außer Kampfschrei.

**Strichmagier:**
- Basis im 90er-Look (Viewer `1793671029-70f4`), Bewegungen noch neutral. Der Goldknauf des Viewers fehlt, weil die gewählte Waffe den Stab ersetzt. Lotussitz wirkt eher kniend als gekreuzt.
- Zaubern läuft im Spiel höchstens 700 ms (`CAST_MS`), der Viewer zeigt 1,0–2,2 s, sonst hinkt die Figur hinterher. Der Stab des Viewers ist raus, die 15 Waffen hängen am Stabgelenk. „Ta-da“ und Lachanfall laufen nur im Idle. `RUN_REF` entfällt, die Spuren kommen weiter über `stepWatcher`; Abstände ungeprüft. Sitzen und Tod sind neu, im Viewer gab es sie nicht.

**Technik:**
- Belagerung bei etwa 200–300 Mobs an der Grenze des Spielbaren, mit Zaubern ungemessen. Ansätze: Mob-Instancing, Nameplates.
- Ungetestet: echtes Pad (auch Menüs und Shop), 12 der 18 Real-Men-Runen, Ansturm in echten Packs (ein Test stoppte nach 0,6 yd), Clipping der Waffen am neuen Modell, Spuren am Hang, Arkan rückwärts, Klicks im VFX-Labor, echter Run bis Level 100.
- Fehlende Icons: Trinken, Arkanes Mal, Wirbel, Entweihen, Knochengefängnis, Frostatem, vier Krieger-Attacken. Einige Icons sind doppelt belegt.
- Frostblaue Partikel überdecken die Waffeneffekte der Magier.
- Spuren, Aggro, Nahkampf und der Kettenblitz des Streitkolbens prüfen keine Höhe. Die Kamera kann in Bauwerke geraten. Brücken in BRD bleiben Geländerücken. Außen auf der großen Karte gibt es keine Bauwerke.
- Lava-Ticks schieben Kanäle auf (`abilities.ts`). `build` wird einen Frame nach dem Tod nachgetragen. `initialMobs` in `zones.ts` ist ungenutzt.
- Im Artifact kann die Gamepad-API am iframe scheitern.
