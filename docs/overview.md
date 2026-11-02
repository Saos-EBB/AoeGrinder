# Frost Grind — Was ist los
> Browser-Game, das Kevin aus Spaß baut: AoE-Grinden wie der Mage in WoW Classic als Roguelike. Komplett in Arbeit, der Look ist noch raw, Spells und Balance werden gerade ausprobiert.

**Stand:** Auf `main` liegt die neue UI, Artifact und GitHub stehen noch auf [v12](handoff.md#stand) ohne sie. In Arbeit ist [Meta Phase 1](ui-meta-konzept.md#meta-phase-1) auf Branch `meta`: Speedrun-Liste und Shop, die [Pool-Liste](pool-liste.md) wartet auf Kevins Auswahl.

## Loslegen
```
npm install
npm run dev          # Spiel, VFX-Labor unter /vfx.html
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
| `src/models/` | Spielermodell mit Skins, Krieger, 15 Waffen | [status-waffen](status-waffen.md) |
| `src/realMen.ts`, `skinFx.ts` | Modus Real Men, Skin-Effekte | [Code-Karte](handoff.md#code-karte) |
| `src/fx/`, `render.ts` | Effekte, Sound, Bloom | [status-gruen-vfx](status-gruen-vfx.md) |
| `src/ui/` | Menüs, HUD, Schadenszahlen, Fenster | [ui-meta-konzept](ui-meta-konzept.md) |
| `src/score.ts`, `leaderboard.ts` | Punkte und lokale Rangliste | [score-spec](score-spec.md) |

## ⚠ Besonderheiten
- `mageModel.ts` kommt aus dem Viewer: dort ändern und neu ziehen, danach `RUN_REF` prüfen → [handoff](handoff.md#offen)
- Effekte und Bodenziele nutzen `groundAt`, nicht `heightAt`, sonst liegen sie auf Plattformen falsch → [Code-Karte](handoff.md#code-karte)
- Die Wut des Kriegers steht in `player.mana`, `player.rageMax` schaltet den Modus um → [realMen.ts](../src/realMen.ts)
- Karten: `WORLD_K` ist der Radius-Faktor, 2 heißt vierfache Fläche, Bauwerke bleiben in der Mitte → [config.ts](../src/config.ts)
- Belagerung hat absichtlich keine Obergrenze, spielbar bis etwa 200–300 Mobs → [siege.ts](../src/siege.ts)
- `SCORE_VERSION` erhöhen, sobald eine Änderung die Punkte beeinflusst → [handoff](handoff.md#regeln)
- Die meisten Zahlen sind Platzhalter (`// PH`) → [handoff](handoff.md#offen)
- Spell-Icons sind Fremd-Packs, Herkunft und Kevins Freigabe stehen im Audit → [asset-audit](asset-audit.md)

## Wo steht was
- Offene Punkte → [handoff.md](handoff.md#offen)
- Alle Änderungen → [CHANGELOG.md](../CHANGELOG.md)
- Warum etwas so gebaut wurde → [build-log.md](build-log.md)
- Mechanik mit Belegen → [mechanics-spec.md](mechanics-spec.md)
- Regeln für Agents → [AGENTS.md](../AGENTS.md)
