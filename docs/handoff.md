# Frost Grind – Stand & Übergabe (Chat ↔ Claude Code)

**Artifact:** „Frost Grind – Prototyp“ · slug `2998fbb5-dd3d-4566-a5fc-dab03102f1e9`
Stand: v11 (`1793501678-2c8c`, 2026-11-01), gebündelter Build aus diesem Repo. Quelle ist das Repo, das Artifact wird nicht mehr direkt editiert.
**Mechanik-Quelle:** `docs/mechanics-spec.md` (VMaNGOS + Wowhead, jede Regel mit Beleg).

## Regeln für beide Seiten
1. Vor jeder Änderung die live Version lesen und mit dieser `base_version` publishen. Ein Konflikt heißt: jemand anderes war schneller, neu lesen.
2. Kleine Änderungen per `edit_version`, keine Komplett-Neuschreibung ohne Grund.
3. Nach dem Publish den Stand-Abschnitt unten aktualisieren (Version + 1–3 Zeilen).
4. Werte ohne Beleg im Code mit `// PH` markieren. Belegte Werte mit Quelle kommentieren (Datei/Funktion oder Spell-ID).
5. Ab der Repo-Migration ist das Repo die Quelle. Das Artifact wird nur noch als spielbarer Build aktualisiert (gebündelte index.html), nicht mehr direkt editiert.

## Branch mc-model (Agent Rot)
Neues Spielermodell mit 4 Skins, 15 Waffen und Skin-Effekten. Agent Rot arbeitet im Haupt-Repo, Blau (`blau-assets`) und Grün (`gruen-vfx`) in eigenen Worktrees. Noch nicht auf `main`, Artifact bleibt v11 bis zur Freigabe.
- `src/models/mageModel.ts`: Modell aus dem Viewer „Frost Grind – MC-Modell“ (slug `677fa515-4c5d-4dc3-9b50-181e9a15fcc6`). Dort ändern und neu ziehen; danach `RUN_REF` prüfen (bisher 3.9 statt 7).
- `src/models/mage.ts`: dünne Hülle mit Skin aus dem Modus. `SKIN_WEAPON` legt die Standardwaffe pro Skin fest.
- `src/models/weapons/`: 15 Waffen, Details in `docs/status-waffen.md`.
- `src/skinFx.ts`: Feuerspur 5 dps, Frostspur 30 % Slow, Arkan +10 % Tempo. Modi: Normal = Alle, Frost only, Fire only, Arcane only (Leerenkugel zählt jetzt als Arkan).
- Messung Level 1, 1600×900 (FPS / Calls / davon Spieler): vorher 165 / 262 / 63, Alle 159 / 188 / 4, Feuer mit 10 Spuren 139 / 201 / 7.

## Branch real-men (Agent Gelb)
Modus „Real Men“: Skelett-Krieger aus `buildWarrior` (`mageModel.ts`), abgezweigt von `mc-model`, darum erst danach auf `main`. Zahlen und Regeln in `src/realMen.ts` (`REALMEN`). Wut steht in `player.mana`, `player.rageMax` schaltet `maxMana` und die Regeneration um. Die Attacken sind Spells mit `press`, sie überspringen in `castSpell` den GCD.
Classic-Werte: [Wirbelwind](https://vanilla-wow-archive.fandom.com/wiki/Whirlwind), [Donnerknall Rang 1](https://classicdb.ch/?spell=6343), [Abklingzeit 6 s](https://wowclassicdb.com/wotlk/spell/6343). Sechs Attacken mit je drei Runen (`RUNES`): Hieb, Wirbelwind, Smash, Donnerknall, Kampfschrei, Ansturm. Der Ansturm hat keine eigene Animation, er nutzt den Laufzyklus.

## Code-Aufbau (Abschnitte in index.html)
- `CFG`, `SPELLS`, `CARDS`: alle Zahlen. Tunen nur hier.
- `ACTIONS` / `binds`: Tastenbelegung, localStorage `frostgrind.binds.v1`.
- Formeln (`aggroRadius`, `hitChance`, `xpForKill` …) 1:1 aus der Spec.
- Welt: `heightAt(x,z)` ist die einzige Quelle für Bodenhöhe; `collide()` für Bäume/Steine/Kartenrand; `obstacles[]` (Bäume mit `canopy` für Kamerakollision).
- Render: kein Schattenwurf; EffectComposer = RenderPass → UnrealBloom (Schwelle 1.5) → Vignette/Tönung (ShaderPass) → OutputPass. Nur HDR-Farben > 1 leuchten.
- Modelle: `mage` (`models/mage.ts`, Abschnitt mc-model) / `buildBoar()` liefern `{ root, update(dt, anim) }`. Ein CC0-glTF ersetzt sie mit gleicher Schnittstelle (`anim.state`: idle/run/back/air/sit/dead, plus cast, channel, attack, frozen, slowed, flash). Mage hat `anchors` (Kristall, Hand) als Partikel-Ursprung.
- Waffen: `src/models/weapons/`, `buildWeapon(id)`, `mage.setWeapon(id)`, Auswahl im Esc-Menü (`docs/status-waffen.md`). `anchors.crystal` zeigt auf den Leuchtpunkt der Waffe.
- Effekte: `particles` (ein Points-Draw-Call, additiv), `*Fx()` pro Spell, `groundDecalFx()` (Canvas-Texturen iceTex, runeTex), `ambientParticles()`, `shakeCamera()`, `sinkCorpse()`.
- Test-Hook: `window.__game`.

## Stand
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

## Nächster Schritt: Repo-Migration (Claude Code)
Ziel: gleiches Spiel, gleiches Verhalten, als Repo mit Vite + TypeScript, aufgeteilt in Module. Keine neuen Features.

```
src/
  main.ts            Bootstrap, Loop
  config.ts          CFG, SPELLS, CARDS + Performance-Schalter
  formulas.ts        Aggro, Hit, XP, Farben (mit Spec-Verweisen)
  input.ts           Tasten, Maus, Keybinds
  camera.ts          Orbit-Kamera, Kollision, Shake
  world.ts           heightAt, Terrain, Bäume, Gras, collide
  render.ts          Renderer, Composer, Himmel, Licht
  player.ts          Bewegung, Physik, Mana/Regeneration
  mobs.ts            Spawn, KI, Leash, Flee
  spells.ts          cast(), Spell-Logik
  fx/particles.ts    Partikelsystem
  fx/spellFx.ts      Nova/AE/Blizzard/CoC/Blink/Decals
  models/mage.ts     Skelett-Rig (später glTF)
  models/boar.ts     Eber-Rig (später glTF)
  ui/hud.ts          Frames, Actionbar, Castbar, Nameplates, Kampftext
  ui/menus.ts        Start, Karten, Tod, Tastenbelegung
public/assets/       CC0-Modelle, Sounds (später)
```

- npm run build erzeugt eine einzelne index.html (z. B. vite-plugin-singlefile), damit das Artifact als spielbarer Build aktualisiert werden kann.
- Performance-Schalter in config.ts: Bloom an/aus, Partikel-Limit, Pixel-Ratio (Rechner ohne dedizierte GPU).

## Offen
- mc-model: Modell im Abendlicht sehr dunkel, Füße rutschen (`speedK` bei 1,8 gedeckelt), Spuren mit Lücken (alles im Viewer). Kein Einknicken beim Landen, Spuren am Hang und ohne Höhenprüfung ungeprüft.
- Kollision: Aggro und Nahkampf messen nur 2D; ein Mob am Fuß einer Ebene kann den Spieler direkt über sich schlagen. Flächen-Spells prüfen die Höhe (`SPELL_AOE_HEIGHT`, Branch `gruen-terrain`), Kettenblitz und Bogenblitz nicht.
- Kollision: Die Kamera kann in Bauwerke geraten. Brücken in BRD bleiben Geländerücken mit begehbarer Platte, keine echte Spannweite über Lava.
- Leistung v10: Die BRD-Werte stammen aus Software-Rendering, Messung auf echter Grafikkarte steht aus.
- Leistung: Kevin misst auf seinem Rechner. Pro Mob ist jedes Gelenk verschmolzen und die Materialien sind geteilt; jedes Gelenk bleibt ein Draw Call, weniger ginge nur mit Skinning oder Instancing.
- Balance ohne Leash: Gezogene Mobs jagen unbegrenzt und sammeln sich bei der neuen Dichte. Leistung Level 1 und 45 auf echter Grafikkarte misst Kevin. `initialMobs` in `zones.ts` ist ungenutzt.
- Lava-Ticks schieben Kanäle noch auf (`abilities.ts` ruft `damagePlayer` ohne `dot`). `build` wird einen Frame nach dem Tod nachgetragen, sauberer wäre es direkt in `recordRun` (`docs/status-gruen.md`).
- Platzhalter: Mob-HP/-Schaden/-Tempo, Trinkwerte, GCD, Spell-Radien, Nova-Break-Chance, Sprungphysik, Crit-Chance.
- Waffen: Noch kein Loot- oder Ausrüstungssystem, nur Dev-Auswahl; Grüns blaue Kristall-Partikel überdecken die Waffeneffekte (`docs/status-waffen.md`).
- Echte CC0-Modelle (Kevin sucht selbst aus).
