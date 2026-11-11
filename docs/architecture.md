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
| `src/models/` (15) | Figuren (`strichMagier`, `strichKrieger`, Hülle `mage.ts`), Gear-/Kosmetik-Teile, Mobs, `weapons/` (Baukasten) |
| `src/fx/` (10) | alte Spell-Optik, Partikel, Licht/Hitstop, Sound (bleibt neben `vfx/`, Schalter `vfxOld`) |
| `src/vfx/` (8) | Energie-Shader und Looks pro Schule |
| `src/ui/` (44, dazu `hud/`, `flavors/`) | Fenster, HUD, Menüs, Shop, Karten, Einstellungen, Dev-Panel; CSS in 10 `.css`-Dateien plus `<style>` in `index.html` und einigen TS-Dateien |
| `src/i18n/` | `de.ts` (zugleich Rückfall), `en.ts`, `t()`; Prüfung `npm run check:i18n` |
| `scripts/` | `i18n-check.mjs`, `cycles.mjs` (Import-Kreise, ohne Pakete) |
| `tests/` | vitest (nur Tests, nicht im Build): `rng`, `grid`, `meta`, Seed-Snapshot `mapSeeds`, Browser-Ersatz `setup/browserStub.ts` |

## Schichten und Import-Kreise
Heute gibt es keine durchgesetzte Schichtregel: Logik, Modelle und UI importieren sich gegenseitig. `npm run check:cycles` misst das ab `main.ts` und `vfxLab.ts`:

- statisch: **88/4/2** (größte SCC 88 Module, 94 Module in Kreisen)
- mit `import()`: **102/2** (104 Module in Kreisen)

Die Werte stehen als Grenze in `scripts/cycles.mjs` (exit 1, wenn größer) und dürfen nur sinken. Rückwege laufen bis dahin über Hook-Listen an Funktionen (z. B. `onMobDeath` in `mobs.ts`) und `fg:*`-Events.

Ziel (aus [audit/gesamt.md](audit/gesamt.md) und ARCH-01 in [audit/arch.md](audit/arch.md)): gerichteter Graph `base` (state, util, config, i18n, storage) → `core` (formulas, rng, Daten-Tabellen) → `sim` (mobs, spells, player, gear …) → `view` (fx, vfx, models) → `ui` → `main`, Kanten nur nach unten, Rückwege über Events. Der Fahrplan dorthin (E6, E10) steht in `docs/audit/gesamt.md`.

## Entscheidungen
- 2026-10-31: Lava schadet Mobs wie dem Spieler, kein Pathfinding; Kills dort zählen wie eigene. Gift bricht Trinken nicht, Schwärmlinge geben keine XP, der Panther bleibt nach Entdeckung sichtbar.
- 2026-10-31: `state.ts` und `util.ts` ergänzen die handoff-Liste. ES-Module können fremde `let`-Variablen nicht zuweisen, und die Helfer werden fast überall gebraucht.
- 2026-10-31: `strict` ist aus. Der Code ist 1:1 aus dem untypisierten Artifact übernommen, `tsc` prüft Imports und offensichtliche Typfehler.
- 2026-10-31: Basis ist Artifact v4 (`1793417937-48fc`); das Verhalten bleibt gleich, Abweichungen von der Spec kommen in einem eigenen Schritt danach.

## Spell-Optik (`src/fx/`)
`shaders.ts` Bausteine, Uhr und Qualität · `softPass.ts` Partikel-Puffer gegen die Szenen-Tiefe · `impact.ts` Licht-Pool, Schockwelle, Ruck, Hitstop · `bolts.ts` alle Blitze in einem Draw Call · `prims.ts` Grundformen · `frostFx`, `relicFx` je Gruppe (`fireFx` gelöscht, `arcaneFx` → `maybeLater/`; neue Optik in `src/vfx/`) · `sound.ts` WebAudio. `spellFx.ts` und `spells/fx.ts` bleiben die Einstiege und schalten mit `vfxOld()` auf die alte Optik. `vfx.html` mit `src/vfxLab.ts` ist das Labor mit echtem Spell-Code.
