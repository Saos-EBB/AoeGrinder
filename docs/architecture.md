# Architektur

## Überblick
Frost Grind ist ein Browser-Roguelike: AoE-Grinden wie mit dem Classic-Mage, Three.js, Vite + TypeScript. `npm run dev` startet das Spiel, `npm run build` erzeugt eine einzelne `dist/index.html` (Single-File). Einstieg ist `index.html` → `src/boot.ts` (Desktop/Handy) → `src/main.ts` (Bootstrap, Loop). Labore: `vfx.html` → `src/vfxLab.ts` (`npm run build:vfx`), `strich.html` → `src/strichLab.ts` (nur Dev-Server). Geparkter Code liegt außerhalb von `src/` in `maybeLater/` und wird nicht gebaut.

Welche Datei was macht, steht in der Code-Karte von [handoff.md](handoff.md#code-karte). Hier nur die Ordner und die Schichten.

## Ordner (Ist-Stand 11.11.2026)
| Ordner | Inhalt |
|---|---|
| `src/*.ts` (~60 Dateien) | Kern und Spielsysteme: `state`, `util`, `config`, `storage`, `formulas`, `player`, `mobs`/`mobTypes`/`mobKinds`/`abilities`, `cards`, `modifiers`, `meta`/`metaNormalize`, `gear`, `weaponRolls`, `loot`, `skins`, `waves`, `boss`, Zonen (`world`, `zones`, `winterquell`, `mondsee`, …), `render`, `camera`, `input`/`gamepad`/`mobile` |
| `src/spells/` (40) | ein Spell pro Datei, `core.ts` (Casts, Treffer, Felder), `fx.ts`, `relics.ts`, `supports.ts`, `random.ts` |
| `src/bosses/` (6) | Boss-Kern, Angriffe, Liste, Regeln, Modelle |
| `src/mapgen/` (16) | Karten-Generator, seed-fest über `rng.ts` (Reihenfolge der `rng()`-Aufrufe nicht ändern), `layouts/` |
| `src/objects/` (7) | Fässer, Truhen, Schreine, Dieb, Theme-Objekte |
| `src/models/` (15) | Figuren (`strichMagier`, `strichKrieger`, Hülle `heroModel.ts`), Gear-/Kosmetik-Teile, Mobs, `weapons/` (Baukasten) |
| `src/fx/` (10) | alte Spell-Optik, Partikel, Licht/Hitstop, Sound (bleibt neben `vfx/`, Schalter `vfxOld`) |
| `src/vfx/` (8) | Energie-Shader und Looks pro Schule |
| `src/ui/` (44, dazu `hud/`, `flavors/`) | Fenster, HUD, Menüs, Shop, Karten, Einstellungen, Dev-Panel; CSS in 10 `.css`-Dateien plus `<style>` in `index.html` und einigen TS-Dateien |
| `src/i18n/` | `de.ts` (zugleich Rückfall), `en.ts`, `t()`; Prüfung `npm run check:i18n` |
| `scripts/` | `i18n-check.mjs`, `cycles.mjs` (Import-Kreise, ohne Pakete), `strict.mjs` (`noImplicitAny` für die Liste in `tsconfig.strict.json`) |
| `tests/` | vitest (nur Tests, nicht im Build): `rng`, `grid`, `meta`, `metaSchema`, `binds`, `figureTable`, Seed-Snapshot `mapSeeds`, Browser-Ersatz `setup/browserStub.ts` |

## Schichten und Import-Kreise
Heute gibt es keine durchgesetzte Schichtregel: Logik, Modelle und UI importieren sich gegenseitig. `npm run check:cycles` misst das ab `main.ts` und `vfxLab.ts`:

- Ausgang (Audit, E4): statisch **88/4/2** (94 Module in Kreisen), mit `import()` **102/2** (104)
- nach E6: statisch und mit `import()` **84/4/2** (90 Module in Kreisen)

Die Werte stehen als Grenze in `scripts/cycles.mjs` (exit 1, wenn größer) und dürfen nur sinken.

### Rückwege (E6): ein Muster
Ein Modul weiter unten, das ein Modul weiter oben braucht, importiert es nicht, sondern geht über ein Modul **ohne Imports** (Vorbild `device.ts`). Solche Module werden immer vor ihren Importeuren ausgewertet, die Kanäle stehen also beim Laden, egal wie der Kreis läuft.
- `src/hooks.ts`: **Kanäle** (`hooks.mobDeath`, `anyHit`, `fireHit`, `spellArea`, `castStart`, `warriorHit`; viele Abonnenten, feste Reihenfolge über `rank`, nicht über die Import-Reihenfolge), **Plätze** (`hooks.spellSwap`, `runEnd`, `xpHold`, `boss`, `switchZone`, `figSay`, `envHook`, `camOverride`; genau eine Umsetzung, `set`/`fn`) und der **Bus** `emit`/`on` für Optik, UI und Erfolge (`kill`, `crit`, `cast`, `hit`, `level`, `ach`). Spielrelevante Folgen (XP, Punkte, Staub, Loot) laufen nie über den Bus, sondern als direkte Aufrufe in fester Reihenfolge.
- `src/feedback.ts`: Rückmeldung aus der Logik (`combatText`, `showError`, `renderActionbar`, `refreshKeyLabels`, `damageNumber`, `hurtNumber`); `ui/hud.ts` setzt die Umsetzung ein (`connectFeedback`). Logik-Dateien importieren nie `ui/hud`.
- Run-Reset (E8): `onRunReset(fn, rank)` = Kanal `hooks.runReset`. Jedes System mit Run-Zustand meldet seinen Reset selbst an, `player.ts` `resetGame` ruft nur die Liste; die Ränge (heute 10 … 190, Reihenfolge wie vor E8) stehen in `hooks.ts`. Ein neues System trägt dort seinen Rang ein, nicht in `resetGame`.
- `src/spells/stats.ts`: Spell-Werte für Formeln und Gear (`stat`, `rune`, `supported`, `echoCost`, `radiusMult` …) ohne Rückimporte; `spells/core.ts` reicht sie weiter.
- Start in fester Reihenfolge: Module mit DOM beim Laden bekommen `mount()`, `main.ts` ruft sie ausdrücklich (`saveCode`, `achievements`, `settingsView`, `devPanel`, danach `ui/devGame.ts` `mountDev`). Dev-Blöcke melden sich mit `registerDev(key, el)`, Gruppen und Reihenfolge stehen in `DEV_LAYOUT` (`ui/devPanel.ts`); Logik-Dateien bauen keine Dev-UI.
- Keine neuen Listen an Funktionen, Setter, `setTimeout`- oder `import()`-Tricks mehr.
- CSS-Reihenfolge (Kaskade) steht oben in `main.ts` (alle `.css`-Imports in der Build-Reihenfolge von vor E6); neue `.css`-Dateien dort eintragen, sonst hängt die Kaskade wieder an der Modul-Reihenfolge.
- Offen: Logik → UI über `player.ts` (`showCards`, `showRunResult`, `ui/scoreHud`), `waves.ts` (`renderMenu`) und `input.ts`/`gamepad.ts`/`mobile.ts` (Pause, Charakterfenster, Belegung). Das Kappen bringt den Kreis auf 66, ändert aber die Lade-Reihenfolge der UI-Module und damit die Reihenfolge von 9 Capture-Keydown-Listenern mit `stopImmediatePropagation`, die CSS-Kaskade (`cards.css`, `heroWindow.css`), rAF-Reihenfolge und den Stapel `loadModal`/`portalVeil`. Erst wenn diese UI-Module ihre Listener und ihr DOM in `mount()` anlegen (feste Reihenfolge in `main.ts`), ist das ein kleiner Schritt.

Ziel (aus [audit/gesamt.md](audit/gesamt.md) und ARCH-01 in [audit/arch.md](audit/arch.md)): gerichteter Graph `base` (state, util, config, i18n, storage) → `core` (formulas, rng, Daten-Tabellen) → `sim` (mobs, spells, player, gear …) → `view` (fx, vfx, models) → `ui` → `main`, Kanten nur nach unten, Rückwege über Events. Der Fahrplan dorthin (E6, E10) steht in `docs/audit/gesamt.md`.

## Zustand und Typen (E8)
- `src/state.ts` hat keine Laufzeit-Imports (nur `import type`) und beschreibt den Laufzeit-Zustand: `GameState` (52 Felder), `PlayerState` (50), `Mob` (~75 häufige Felder, Rest über Index-Signatur), `MobState` (`'idle'│'combat'│'evade'│'flee'`), `Mods` (aus den Startwerten in `resetMods`). Optional (`?`) heißt: wird erst nach dem Start gesetzt; `any` mit „(unklar)“: Form hängt am Aufrufer. Global bleibt `strict: false`.
- Laufzeit-Zustand gehört nicht in `config.ts`: `mods` liegt in `state.ts`, die Spell-Registry `SPELLS` in `spells/registry.ts` (ohne Imports). `config.ts` exportiert beide für den Übergang weiter.
- Waffe und Gear schreiben über ein Ziel (`ModTarget` in `weaponRolls.ts`: `mods`, `stat`, `state`): der Run-Start in die echten Werte (`runTarget()`), das Charakterfenster in eine Kopie (`ui/heroStats.ts` `computeModLayers`). Nur die Formeln (`formulas.ts`) lesen weiter die globalen `mods`, darum wertet `withMods` jede Schicht kurz mit getauschten `mods` aus.
- Spielstand: Feld `schema` (`META_SCHEMA` in `storage.ts`, fehlt = 0), gesetzt von `normalizeMeta`; der Spielstand-Code gibt es als `sc` mit, beim Laden wird es ignoriert. Neue Migrationen prüfen `metaSchemaOf(m) < n` in `normalizeMeta`.

## Begriffe im Code (Glossar, E7)
Ein Begriff pro Konzept. Gespeicherte IDs bleiben, wie sie sind, und werden über `src/figureTable.ts` abgebildet.

| Konzept | Code | gespeichert (bleibt) |
|---|---|---|
| Klasse (Magier/Krieger) | `HeroClass` (`figureTable.ts`), `classOf()` (`skins.ts`) | Keys `magier`/`krieger` in `meta.skins` |
| Figur (Frost, Feuer, Blitz, Seuche, ?-Magier, Krieger) | `figureId` (`frost│feuer│blitz│seuche│zufall│krieger`), Tabelle `FIGURES`, `currentFigure()`, `isWarrior()` (`modifiers.ts`) | Mod-IDs `frost/fire/blitz/plague/realmen` in Runs/Rangliste/Splits, Hotbar-Key `normal` |
| Schule/Element | `ElementId` = `ELEMENTS`-Keys (`frost│feuer│blitz│seuche│arkan`), `elementOfFigure()`, `elementOfTag()`, `spellElement(id)` (`config.ts`) | Element-IDs in Waffen/Gear |
| Spielermodell | `heroModel` (`models/heroModel.ts`), `heroModel.figureId`, `heroModel.skinId` | – |
| Skin (Set-Skin, Krieger-Skin) | `skinId`, `forcedSkin`, `refreshSkin`; in den Viewer-Modellen (`strichMagier`/`strichKrieger`) intern weiter `look` | `meta.skins` |
| Kosmetik-Teil | `KOSMETIK`, `kosmetikIn`, `wearKosmetik`, `hasKosmetik`, `kosmetikShown` (`gear.ts`) | `meta.looks`, `meta.lookWear`, Code-Felder `lk`/`lw` |
| Spell-Optik | `*Look` (`vfx/*Look.ts`) – nur hier heißt etwas „Look“ | – |
| Viewer-Skin der Strichmagier | `palette` (`fire/ice/blitz/plague/qm`, `paletteOf()`) | – |
| Spell-Schule (Karte, Farbe) | Feld `cls` (`frost/fire/lightning/plague/arcane/…`) | – |
| Seltenheit | `rarity` (Index 0–5), Zugriff `rarityOf(x)`, `rollRarity()`, Karten `rollCardRarity()` | Feld `r` in Waffen/Gear/Spielstand-Code |
| Shop-Stufe / Boss-Stufe | „tier“ nur hier: `shopTier`, `bestTier`; Boss lokal `stage` (Roster-Feld `tier` bleibt) | `bestTier` |
| Tasten-Aktion | Bind-IDs `nova/ae/bliz/coc/slot7/blink/drink/slot8`, Klartext `BIND_LABEL` und `BIND_SLOT` (`config.ts`) | `frostgrind.binds.v1`, Hotbar-/Pad-Store |
| Bodenzauber-Zielkreis | `groundCursor` (`fx/spellFx.ts`) | – |
| Map freigeschaltet | `isThemeUnlocked` (`mapgen/progress.ts`), `isMapUnlocked` (Hauptmenü); „Open“ heißt nur „Fenster offen“ | `meta.maps` (Theme-IDs) |
| Säubern beim Laden | `clean*` (`cleanWeapon`, `cleanGearItem`, `cleanGear`, `cleanSkins` …), Prüfen `isValid*` | – |
| Spuren-Regeln | `trailEffects.ts` (`updateTrailEffects`): Feuerspur Schaden, Frostspur Slow | – |

## Entscheidungen
- 2026-10-31: Lava schadet Mobs wie dem Spieler, kein Pathfinding; Kills dort zählen wie eigene. Gift bricht Trinken nicht, Schwärmlinge geben keine XP, der Panther bleibt nach Entdeckung sichtbar.
- 2026-10-31: `state.ts` und `util.ts` ergänzen die handoff-Liste. ES-Module können fremde `let`-Variablen nicht zuweisen, und die Helfer werden fast überall gebraucht.
- 2026-10-31: `strict` ist aus. Der Code ist 1:1 aus dem untypisierten Artifact übernommen, `tsc` prüft Imports und offensichtliche Typfehler.
- 2026-10-31: Basis ist Artifact v4 (`1793417937-48fc`); das Verhalten bleibt gleich, Abweichungen von der Spec kommen in einem eigenen Schritt danach.

## Spell-Optik (`src/fx/`)
`shaders.ts` Bausteine, Uhr und Qualität · `softPass.ts` Partikel-Puffer gegen die Szenen-Tiefe · `impact.ts` Licht-Pool, Schockwelle, Ruck, Hitstop · `bolts.ts` alle Blitze in einem Draw Call · `prims.ts` Grundformen · `frostFx`, `relicFx` je Gruppe (`fireFx` gelöscht, `arcaneFx` → `maybeLater/`; neue Optik in `src/vfx/`) · `sound.ts` WebAudio. `spellFx.ts` und `spells/fx.ts` bleiben die Einstiege und schalten mit `vfxOld()` auf die alte Optik. `vfx.html` mit `src/vfxLab.ts` ist das Labor mit echtem Spell-Code.

## Bausätze der Modelle (Audit E9)
`models/strichKit.ts`: was alle Strich-Figuren gleich brauchen (Toon-Verlauf `grad`, Status-Tönungen `TINTS`, `capDown`, `prep` für Vertex-Farben, Lichtrand `RIM`/`rimChunk`, Zwei-Knochen-`ik`), genutzt von `strichMagier`, `strichKrieger`, `strichMob` und `creatures` (nur `TINTS`). `models/partKit.ts`: Material-Beschreibung `Mat`, Geometrie-Helfer, Viewer-Maße `VP`/`FIT` und `convert()` (Teilbaum → Teile am Körper-Mesh, Bone-Hook je Aufrufer) für `gearParts`, `kosmetikParts` und `ui/itemThumb.ts`; Segmentzahlen bleiben je Aufrufer. `fx/pointPool.ts`: Punkt-Partikelpool einer Figur (`makePointPool`), ohne `render.ts`, damit `/strich.html` ohne Spiel-Module bleibt. Die Zahlen sind die der Viewer: eine Änderung dort trifft alle Figuren.
