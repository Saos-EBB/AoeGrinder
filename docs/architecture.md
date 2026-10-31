# Architektur

## Überblick
Frost Grind ist ein Browser-Roguelike: AoE-Grinden wie mit dem Classic-Mage, Three.js, Vite + TypeScript. `npm run dev` startet das Spiel, `npm run build` erzeugt eine einzelne `dist/index.html`. Das Markup und CSS liegen in `index.html`.

## Module
- `src/main.ts`: Das ganze Spiel, unverändert aus Artifact v4

## Entscheidungen
- 2026-10-31: `strict` ist aus. Der Code ist 1:1 aus dem untypisierten Artifact übernommen, `tsc` prüft Imports und offensichtliche Typfehler.
- 2026-10-31: Basis ist Artifact v4 (`1793417937-48fc`); das Verhalten bleibt gleich, Abweichungen von der Spec kommen in einem eigenen Schritt danach.
