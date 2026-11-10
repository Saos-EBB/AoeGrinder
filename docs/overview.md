# Frost Grind — Was ist los
> Mein Browser-Game, aus Spaß gebaut: AoE-Grinden wie der Mage in WoW Classic als Roguelike. Der Prototyp ist fast fertig, gerade läuft Feinschliff an Maps, Items und Kosmetik.

**Stand:** Zwei Klassen (Strichmagier mit 6 Figuren, Strichkrieger), generierte Maps mit 5 Themes, neue Mobs, Gear mit Sets (an der Figur sichtbar), Portale, Weltkarte und Map-Objekte. Nur Desktop, Handy ist bis auf Weiteres gesperrt. Live-Version und Deploy → [handoff](handoff.md#stand).

## Loslegen
```
npm install
npm run dev          # Spiel, dazu VFX-Labor /vfx.html und Figuren-Test /strich.html
npm run check        # tsc
npm run check:i18n   # alle Texte in DE und EN
npm run build        # eine dist/index.html
```

## Aufbau
| Teil | Was es macht | Details |
|---|---|---|
| `src/main.ts`, `state.ts`, `config.ts` | Loop, Zustand, alle Spielzahlen | [Code-Karte](handoff.md#code-karte) |
| `src/mapgen/` | Map-Generator: 4 Layouts aus Seed, 5 Themes (Wald, Wüste, Kanäle, Kathedrale, Hölle), Arena, Freischaltung | [map-umbau](handoffs/map-umbau.md) |
| `src/portal.ts`, `src/ui/worldMap.ts` | Portale im Run (neue Map, gleiches Theme), Weltkarte im Hauptmenü mit Seed-Feld | [map-umbau-2](handoffs/map-umbau-2.md) |
| `src/objects/` | Schreine, Truhen mit Mimic, Explosiv-Fässer, Schatzdieb, ein Objekt pro Theme; Taste „Benutzen“ | [map-umbau-2](handoffs/map-umbau-2.md) |
| `src/world.ts`, `collision.ts`, `zones.ts` | Alte Handbau-Zonen (nur über Dev), Boden, Kollision | [map-audit](map-audit.md) |
| `src/mobs.ts`, `mobKinds.ts`, `abilities.ts` | Mobs = Kategorie + Zusatz + Theme-Skin, Spawn auf Pack-Plätzen | [map-umbau](handoffs/map-umbau.md) |
| `src/boss.ts`, `waves.ts`, `champions.ts` | Bosse, Wellen-Modus, Champion-Packs mit Affixen | [boss-kader](handoffs/boss-kader.md) |
| `src/spells/`, `cards.ts` | Spells, Runen, Relikte, Level-Karten | [spells-spec](spells-spec.md) |
| `src/gear.ts`, `loot.ts`, `models/gearParts.ts`, `ui/lootView.ts` | Gear in 5 Slots, 4 Sets, Drops am Boden, 25 Gear-Formen an der Figur, Erfolge | [items](handoffs/items.md), [gear-modelle](handoffs/gear-modelle.md) |
| `src/ui/heroWindow.ts`, `ui/heroStats.ts`, `ui/itemThumb.ts` | Ein Fenster für Figur, Werte und Inventar (Taste X oder I), Baum nach Art und Schule, 3D-Bilder aller Items, ganz ohne Maus bedienbar | [fenster](handoffs/fenster.md) |
| `src/models/kosmetikParts.ts`, `src/figEvents.ts` | 25 Kosmetik-Teile (20 aus der Box, 5 über Meilensteine), reagieren auf Spiel-Ereignisse wie Kill, Crit, Treffer | [kosmetik](handoffs/kosmetik.md) |
| `src/skins.ts`, `skinFx.ts`, `src/models/` | Figuren, Skins, Mob-Rigs, Waffen-Baukasten | [skins](handoffs/skins.md) |
| `src/realMen.ts`, `melee.ts`, `wucht.ts` | Nahkampf des Strichkriegers, Treffer-Gefühl | [Code-Karte](handoff.md#code-karte) |
| `src/fx/`, `src/vfx/`, `render.ts`, `dunkel.ts` | Effekte, Sound, Bloom, dunkles Licht mit Lampe | [Code-Karte](handoff.md#code-karte) |
| `src/ui/`, `src/ui/flavors/` | Menüs, HUD, Fenster, drei UI-Looks (Höllenfeste, Krypta, Schlachtbank) | [ui-mix](handoffs/ui-mix.md) |
| `src/score.ts`, `leaderboard.ts` | Punkte, Zeit, Rangliste pro Map mit Seed | [score-spec](score-spec.md) |
| `src/meta.ts`, `ui/shop.ts`, `weaponRolls.ts`, `ui/saveCode.ts` | Knochenstaub, Shop, Waffen-Kiste, Spielstand-Code | [pool-liste](pool-liste.md) |

## ⚠ Besonderheiten
- Grundregel: NIE Pay-to-win, der Shop läuft nur über erspielten Staub → [AGENTS.md](../AGENTS.md)
- Jede Map und jeder Run bekommt einen neuen Seed. `?seed=` oder das Seed-Feld der Weltkarte halten ihn fest, auch hinter Portalen (für Speedruns auf einem Seed) → [rng.ts](../src/mapgen/rng.ts)
- Alte Handbau-Zonen gibt es nur noch über Dev → Zone oder `?zone=<id>`, nicht auf der Weltkarte → [map-umbau](handoffs/map-umbau.md)
- Krieger-Skins kommen mit den Waffen. Magier-Skins (einer pro Schule) gibt es nur über das volle Set 5/5: Erfolg, danach dauerhaft wählbar → [skins.ts](../src/skins.ts), [gear.ts](../src/gear.ts)
- Mit Skin bleiben die Schul-Effekte aus, die den ganzen Körper bedecken. Ausnahme ist der Frost-Skin, der babyblau einfriert → [strichMagier.ts](../src/models/strichMagier.ts)
- `gear.ts` säubert den Spielstand erst über `initGear()` aus `main.ts`, nicht beim Laden des Moduls (Import-Zyklen) → [main.ts](../src/main.ts)
- Drops normaler Kills sind absichtlich fast null, die Drops kommen aus Bossen, Champions, Truhen und Großen. Balance folgt später → [loot.ts](../src/loot.ts)
- Nach dem letzten Boss wird alles am Boden automatisch aufgehoben, das Waffen-Inventar darf dabei überlaufen → [loot.ts](../src/loot.ts)
- Handy ist gesperrt („In Arbeit“), der Code bleibt; `?mobile=1` öffnet ihn trotzdem → [boot.ts](../src/boot.ts)
- Kein UI-Element darf unter den Zierrahmen-Ecken liegen: Abstand über `--fg-safe` pro UI-Look → [base.css](../src/ui/flavors/base.css)
- `SCORE_VERSION` erhöhen, sobald eine Änderung die Punkte beeinflusst → [handoff](handoff.md#regeln)
- Das Spiel läuft immer dunkel, Helligkeit stellt man in den Einstellungen ein. Mobs hinter dem Nebel werden nicht gezeichnet → [dunkel.ts](../src/dunkel.ts)
- Kosmetik geht vor Gear: angezeigt wird `look[slot] ?? gear[slot]`, Meilensteine zählen Kills und Staub über alle Runs in `meta.stats` → [gear.ts](../src/gear.ts)
- Gear-Teile werden an die Bones ins Körper-Mesh der Figur gemergt, kosten also keine Draw Calls; Set-Skin 5/5 verdeckt sie → [gearParts.ts](../src/models/gearParts.ts)
- Mob-Modelle sind ein SkinnedMesh pro Material, die Gelenk-Gruppen dienen als Knochen → [creatures.ts](../src/models/creatures.ts)
- Die meisten Zahlen sind Platzhalter (`// PH`) → [handoff](handoff.md#offen)
- Spell-Icons kommen als SVG aus dem Spell-Viewer, `ui/spellIcons.ts` wird erzeugt und nicht von Hand geändert → [icons.ts](../src/ui/icons.ts)
- Geparkter Code (z. B. eine frühere dritte Klasse) liegt in `maybeLater/` und wird nicht gebaut → [maybeLater](../maybeLater/README.md)

## Wo steht was
- Offene Punkte → [handoff.md](handoff.md#offen)
- Aufträge pro Feature → [docs/handoffs/](handoffs/), Vorlagen und Viewer → [docs/ref/](ref/)
- Alle Änderungen → [CHANGELOG.md](../CHANGELOG.md)
- Warum etwas so gebaut wurde → [build-log.md](build-log.md)
- Mechanik mit Belegen → [mechanics-spec.md](mechanics-spec.md)
- Regeln für Agents → [AGENTS.md](../AGENTS.md)
