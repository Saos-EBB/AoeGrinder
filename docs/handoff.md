# Frost Grind – Stand & Übergabe

**Spiel-Artifact:** „Frost Grind – Prototyp“ · https://claude.ai/artifact/68vgdsC4svaWovgDnPum84 · slug `2998fbb5-dd3d-4566-a5fc-dab03102f1e9`
Stand: v14 (`__ARTIFACT_VERSION__`, 2026-11-02), gebündelter Build aus diesem Repo. Das Repo ist die Quelle, das Artifact wird nicht direkt editiert.
**Mechanik-Quelle:** `docs/mechanics-spec.md` (VMaNGOS + Wowhead, jede Regel mit Beleg).
**Modell-Quelle:** Viewer „Frost Grind – MC-Modell“ (slug `677fa515-4c5d-4dc3-9b50-181e9a15fcc6`). Änderungen am Modell dort machen und `src/models/mageModel.ts` neu ziehen, danach `RUN_REF` prüfen.

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
- **Modell:** `models/mageModel.ts` (aus dem Viewer: `buildMage`, `buildWarrior`), `models/mage.ts` (Hülle, Skin aus dem Modus, `SKIN_WEAPON`), `models/weapons/` (15 Waffen, siehe `docs/status-waffen.md`), `models/creatures.ts`, `models/boar.ts`.
- `src/skinFx.ts`: Feuerspur 5 dps, Frostspur 30 % Slow, Arkan +10 % Tempo.
- `src/realMen.ts`: Modus Real Men. Zahlen in `REALMEN` und `RUNES`, Wut steht in `player.mana`, Attacken sind Spells mit `press`. Classic-Werte: [Wirbelwind](https://vanilla-wow-archive.fandom.com/wiki/Whirlwind), [Donnerknall Rang 1](https://classicdb.ch/?spell=6343), [Abklingzeit 6 s](https://wowclassicdb.com/wotlk/spell/6343).
- `src/siege.ts`: Mob-Modus Belagerung mit Zielen 5, 10, 15 Minuten und endlos, Rate in `SIEGE`, je ein Ranglisten-Tab.
- `src/meta.ts`: Knochenstaub, gesperrter Pool, Shop-Stufen und Preise in `META` (`docs/pool-liste.md`). `ui/shop.ts`: Ablauf Ergebnis → Shop → Hauptmenü, Shop im Hauptmenü. Credits: `docs/credits.md`.
- `src/mobs.ts`, `mobTypes.ts`, `abilities.ts`: Spawn (Ring um den Spieler), KI, `damageMob`, Fähigkeiten.
- `src/spells/`: ein Spell pro Datei, `core.ts` (Casts, `mobsInRadius`, `applySlow`, Felder), `fx.ts` (gemeinsame Optik), `relics.ts`, `supports.ts`. `src/cards.ts`: Level-Karten.
- **Effekte:** `render.ts` (Composer, Bloom, Tiefentextur), `fx/spellFx.ts`, `fx/frostFx.ts`, `fireFx.ts`, `arcaneFx.ts`, `relicFx.ts`, `prims.ts`, `bolts.ts`, `impact.ts`, `shaders.ts`, `softPass.ts`, `particles.ts`, `sound.ts`.
- **VFX-Labor:** `vfx.html` + `src/vfxLab.ts`, im Dev-Server unter `/vfx.html`, `npm run build:vfx`.
- **Oberfläche:** `ui/hud.ts`, `ui/hudLayout.ts` (Anker, Bearbeiten-Modus), `ui/mainMenu.ts` (Hauptmenü, Pause), `ui/menus.ts` (Karten, Keybinds, `syncPause`), `ui/charWindow.ts`, `ui/dmgNumbers.ts`, `ui/scoreHud.ts`, `ui/leaderboardView.ts`. Farben in `ui/colors.ts`, Größen in `ui/uiConfig.ts`, Icons in `ui/icons.ts`. Konzept: `docs/ui-meta-konzept.md`. Punkte in `score.ts`, `leaderboard.ts`.
- `npm run build` erzeugt eine einzelne `dist/index.html` fürs Artifact.

## Stand
- v14 – Neue UI: Hauptmenü, verschiebbares HUD mit Einrasten, Icons, Schadenszahlen, Karten mit echter Vorschau, Charakterfenster, Pause-Menü, Auto-Kamera. Meta Phase 1: Speedrun-Zeit mit Splits, Belagerung mit Zielen 5, 10, 15 Minuten und endlos, Knochenstaub, gesperrter Pool, Shop nach Abschluss und im Hauptmenü, Credits. Level-up heilt 25 % Leben. Getestet per Skript in allen Modi, nicht von Hand gespielt.
- v12 – Alle Branches in `main` zusammengeführt. Neues Spielermodell mit 4 Skins, 15 Waffen als Standard pro Skin und Skin-Effekte; Modus Nur Arkan (Leerenkugel zählt als Arkan); Modus Real Men mit 6 Attacken und je 3 Runen; Karten mit vierfacher Fläche; Mob-Modus Belagerung; Mobs mit doppeltem Leben und Schadensreduktion pro Level; neue Spell-Effekte, Sound und VFX-Labor, Effekte liegen über `groundAt`. Getestet per Skript in allen Modi, nicht von Hand gespielt.
- v11 – Spells kennen die massiven Objekte: Blink stoppt vor Wänden und landet auf begehbaren Flächen, Bodenziele und Zielkreis liegen auf `groundAt`, Flächen-Spells treffen nur unter 3 yd Höhenunterschied (`SPELL_AOE_HEIGHT`, PH). Spielversion v11, weil die Höhenprüfung Treffer ändert. Details in `docs/status-gruen.md`. Getestet per Skript, nicht von Hand gespielt.
- v10 – **Teil Blau:** Massive Objekte in allen Zonen für Spieler und Mobs, neues `src/collision.ts` (Kreis, gedrehte Box, begehbare Fläche, 8-yd-Raster, Stufe 0,6 yd), Mobs weichen seitlich aus und folgen festen Treppen-Spuren. Wachturm (Tirisfal) und Zikkurat (Schlingendorntal) sind begehbar, Dev „Collider anzeigen“ im Esc-Menü. Audit in `docs/map-audit.md`, Messwerte in `docs/status-blau.md`. Alle neuen Zahlen sind `// PH`; getestet per Skript, nicht von Hand gespielt. **Teil Grün:** Mob-Dichte (mindestens 40 Mobs ab Level 1, enge Packs zu 4–6, tote Packs kommen sofort nach), Leash entfernt auf Kevins Wunsch (Vermerk in `docs/mechanics-spec.md` §4; Mobs brechen nur beim Tod der Figur ab, Fliehen bleibt), Spielversion v10. Feeling-Fixes (Tempo, Drehen, Sprung, Kamera) sind nicht enthalten, dazu kam bisher kein Wunsch. Werte in `docs/status-gruen.md`. Balance ungeprüft.
- v9 – **Teil Blau:** Level 1–100 mit neuer Skalierung, Mob-Freischaltung pro Zone mit Einblendung, Dev „Level setzen“ im Esc-Menü, Hardmode-Fix (Halbe Werte als eigener Faktor), castKey-Vorrang in `score.ts`. Messwerte und offene Balance-Punkte in `docs/status-blau.md`, Spec in `docs/levels-spec.md`. Alle neuen Zahlen sind `// PH`. **Teil Grün:** Nacharbeiten (Taste 3 frei, Pad-Slots 7/8 auf R2 und Steuerkreuz rechts, Zielmodus für Bodenziel-Spells in jedem Slot, Funken in der eigenen Schule, kein Zauber-Pushback durch Gift und Lava, Bodentexturen), Modi Teil 2 (Nur Frost, Nur Feuer, Kein Trinken, Classic pur, Kein Glück und drei Presets), Feld `build` der Rangliste, echte Cast-ID. Details in `docs/status-gruen.md` und `docs/score-spec.md`. Das echte Pad und die Spielbalance sind ungeprüft.
- v8 – Punkte mit HUD, Modi und Modifikatoren im Startbildschirm, lokale Rangliste mit Export und Import (`docs/score-spec.md`, Teil 2 steht aus); Draw Calls pro Mob gesenkt, Materialien geteilt (`docs/status-maps.md`). Enthält das Spell-System aus v7. Alle Punktwerte sind `// PH`.
- v7 – Fünfte Zone Elvyn (Wald mit Ebern), Lava schadet auch Mobs (`// PH`, kein Pathfinding), Leistungsanzeige im Dev-Menü (FPS, Draw Calls über den ganzen Frame, Mobs). Dazu Spell- und Kartensystem laut `docs/spells-spec.md`: 8 Slots, 9 neue Spells, Runen, Supports, 6 Relikte ab Level 30, Karten mit Seltenheit und Glück, Dev-Karten im Esc-Menü. Details, Abweichungen und offene Punkte in `docs/status-spells.md`. Alle neuen Werte sind `// PH`, die Spielbalance und das echte Pad sind ungeprüft.
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

**Balance (alles `// PH`):**
- Shop: Preise und Staub-Formel in `META`. Ein Abschluss ist für neue Angebote nötig; der schnellste Weg ist Belagerung 5 min.
- Mana-Bedarf pro Kill etwa verdoppelt. Arcane only hat nur zwei Schadens-Spells. Donnerknall (10 Schaden, Classic) ist schwach. Real Men hat weder Trinken noch Blink.
- Belagerung: Rate in `SIEGE`, „Größter Pull“ treibt die Punkte sehr hoch. Ohne Leash jagen gezogene Mobs unbegrenzt.
- Weitere Platzhalter: Mob-Tempo, Trinkwerte, GCD, Radien, Crit, Sprungphysik.

**Technik:**
- Belagerung bei etwa 200–300 Mobs an der Grenze des Spielbaren, mit Zaubern ungemessen. Ansätze: Mob-Instancing, Nameplates.
- Ungetestet: echtes Pad (auch Menüs und Shop), 12 der 18 Real-Men-Runen, Ansturm in echten Packs (ein Test stoppte nach 0,6 yd), Clipping der Waffen am neuen Modell, Spuren am Hang, Arkan rückwärts, Klicks im VFX-Labor, echter Run bis Level 100.
- Fehlende Icons: Trinken, Hurrikan, Wirbel, Bogenblitz, Entweihen, Knochengefängnis, Frostatem, vier Krieger-Attacken. Einige Icons sind doppelt belegt.
- Frostblaue Partikel überdecken die Waffeneffekte der Magier.
- Spuren, Aggro, Nahkampf, Kettenblitz und Bogenblitz prüfen keine Höhe. Die Kamera kann in Bauwerke geraten. Brücken in BRD bleiben Geländerücken. Außen auf der großen Karte gibt es keine Bauwerke.
- Lava-Ticks schieben Kanäle auf (`abilities.ts`). `build` wird einen Frame nach dem Tod nachgetragen. `initialMobs` in `zones.ts` ist ungenutzt.
- Im Artifact kann die Gamepad-API am iframe scheitern.
