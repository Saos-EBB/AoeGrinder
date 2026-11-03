# Frost Grind — Was ist los
> Browser-Game, das Kevin aus Spaß baut: AoE-Grinden wie der Mage in WoW Classic als Roguelike. Komplett in Arbeit, der Look ist noch raw, Spells und Balance werden gerade ausprobiert.

**Stand:** v14 auf `main` und [live](handoff.md#stand): neue UI, [Meta Phase 1](ui-meta-konzept.md#meta-phase-1) mit Speedrun-Liste, Staub und Shop. Getestet per Skript, Kevins Handtest läuft.

## Loslegen
```
npm install
npm run dev          # Spiel, VFX-Labor /vfx.html, Figuren-Tests /klinge.html und /strich.html
npm run check        # tsc
npm run build        # eine dist/index.html fürs Artifact
```

## Aufbau
| Teil | Was es macht | Details |
|---|---|---|
| `src/main.ts`, `state.ts`, `config.ts` | Loop, Zustand, alle Spielzahlen | [Code-Karte](handoff.md#code-karte) |
| `src/world.ts`, `collision.ts`, `zones.ts` | Karten, Boden, massive Objekte | [map-audit](map-audit.md) |
| `src/mobs.ts`, `abilities.ts`, `siege.ts` | Mobs, Fähigkeiten, Mob-Modus Belagerung | [zones-spec](zones-spec.md) |
| `src/spells/`, `cards.ts` | Spells, Runen, Relikte, Level-Karten | [spells-spec](spells-spec.md) |
| `src/models/` | Alle Figuren (Strichmagier mit 4 Skins, Strichkrieger, Klingenstrich), 15 Magier-Waffen | [status-waffen](status-waffen.md) |
| `src/realMen.ts`, `klinge.ts`, `melee.ts` | Nahkampf-Modi Strichkrieger, Klingenstrich und ihre Helfer | [Code-Karte](handoff.md#code-karte) |
| `src/skinFx.ts` | Skin-Effekte der Magier | [Code-Karte](handoff.md#code-karte) |
| `src/fx/`, `render.ts` | Effekte, Sound, Bloom | [status-gruen-vfx](status-gruen-vfx.md) |
| `src/ui/` | Menüs, HUD, Schadenszahlen, Fenster | [ui-meta-konzept](ui-meta-konzept.md) |
| `src/score.ts`, `leaderboard.ts` | Punkte, Zeit und lokale Ranglisten | [score-spec](score-spec.md) |
| `src/meta.ts`, `ui/shop.ts` | Knochenstaub, gesperrter Pool, Shop | [pool-liste](pool-liste.md) |

## ⚠ Besonderheiten
- Die Figuren kommen aus den Viewern, Quellen stehen im [handoff](handoff.md). `heroModels.ts` ist fast nur noch Altbestand, gebraucht werden `SKIN_FX` und die Spuren
- Effekte und Bodenziele nutzen `groundAt`, nicht `heightAt`, sonst liegen sie auf Plattformen falsch → [Code-Karte](handoff.md#code-karte)
- Modus-ID des Strichkriegers bleibt `realmen`, Skin `krieger`. Wut steht in `player.mana`, `player.rageMax` schaltet den Modus um; Klingenstrich hat keine Ressource und nutzt den Balken für die Haltung → [realMen.ts](../src/realMen.ts), [klinge.ts](../src/klinge.ts)
- Karten: `WORLD_K` ist der Radius-Faktor, 2 heißt vierfache Fläche, Bauwerke bleiben in der Mitte → [config.ts](../src/config.ts)
- Belagerung hat absichtlich keine Obergrenze, spielbar bis etwa 200–300 Mobs → [siege.ts](../src/siege.ts)
- `SCORE_VERSION` erhöhen, sobald eine Änderung die Punkte beeinflusst → [handoff](handoff.md#regeln)
- Der Shop öffnet nach einem Abschluss und im Hauptmenü, dort mit dem letzten Angebot. Staub gibt es auch nach einem Tod → [meta.ts](../src/meta.ts)
- Das Spiel läuft immer dunkel, mit Schatten-Map am Lichtkegel, das kostet Draw Calls → [dunkel.ts](../src/dunkel.ts), [handoff](handoff.md#offen)
- Die meisten Zahlen sind Platzhalter (`// PH`) → [handoff](handoff.md#offen)
- Spell-Icons sind Fremd-Packs, Autoren und Quellen stehen in den Credits → [credits](credits.md)

## Wo steht was
- Offene Punkte → [handoff.md](handoff.md#offen)
- Alle Änderungen → [CHANGELOG.md](../CHANGELOG.md)
- Warum etwas so gebaut wurde → [build-log.md](build-log.md)
- Mechanik mit Belegen → [mechanics-spec.md](mechanics-spec.md)
- Regeln für Agents → [AGENTS.md](../AGENTS.md)
