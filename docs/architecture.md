# Architektur

## Überblick
Frost Grind ist ein Browser-Roguelike: AoE-Grinden wie mit dem Classic-Mage, Three.js, Vite + TypeScript. `npm run dev` startet das Spiel, `npm run build` erzeugt eine einzelne `dist/index.html`. Das Markup und CSS liegen in `index.html`.

## Module
- `src/main.ts`: Einstieg: Bootstrap und Loop
- `src/state.ts`: Spielzustand (`state`, `player`), von allen Modulen geteilt
- `src/util.ts`: Kleine Helfer und Rig-Bausteine
- `src/config.ts`: CFG, SPELLS, CARDS, mods, PERF
- `src/formulas.ts`: Aggro, Treffer, XP, Farben, Spielerwerte
- `src/render.ts`: Renderer, Kamera-Objekt, Composer, Himmel, Licht, Resize
- `src/world.ts`: heightAt, Terrain, Bäume, Gras, collide, Boden-Decals
- `src/fx/particles.ts`: Partikelsystem, Glow-Textur
- `src/models/mage.ts`: Skelett-Rig des Spielers
- `src/models/boar.ts`: Eber-Rig
- `src/fx/spellFx.ts`: Effekte pro Zauber, Decals, Dauer-Emitter
- `src/camera.ts`: Orbit-Kamera, Baumkronen-Kollision, Shake
- `src/ui/hud.ts`: Frames, Actionbar, Castbar, Nameplates, Kampftext
- `src/ui/menus.ts`: Start, Karten, Tod, Tastenbelegung, Ding
- `src/input.ts`: Tasten, Maus, Keybinds, Bodenziel
- `src/mobs.ts`: Spawn, KI, Leash, Flee, Schaden, Kill
- `src/spells.ts`: cast, Zauberwirkung, Channel, Slow
- `src/player.ts`: Bewegung, Physik, Mana/Regeneration, XP, resetGame

## Entscheidungen
- 2026-10-31: `strict` ist aus. Der Code ist 1:1 aus dem untypisierten Artifact übernommen, `tsc` prüft Imports und offensichtliche Typfehler.
- 2026-10-31: Basis ist Artifact v4 (`1793417937-48fc`); das Verhalten bleibt gleich, Abweichungen von der Spec kommen in einem eigenen Schritt danach.
