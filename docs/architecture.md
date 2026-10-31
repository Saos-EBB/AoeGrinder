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

## Entscheidungen
- 2026-10-31: `strict` ist aus. Der Code ist 1:1 aus dem untypisierten Artifact übernommen, `tsc` prüft Imports und offensichtliche Typfehler.
- 2026-10-31: Basis ist Artifact v4 (`1793417937-48fc`); das Verhalten bleibt gleich, Abweichungen von der Spec kommen in einem eigenen Schritt danach.
