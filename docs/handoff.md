# Frost Grind – Stand & Übergabe (Chat ↔ Claude Code)

**Artifact:** „Frost Grind – Prototyp“ · slug `2998fbb5-dd3d-4566-a5fc-dab03102f1e9`
Stand: v7 (`1793477567-2d9a`, 2026-10-31), gebündelter Build aus diesem Repo. Quelle ist das Repo, das Artifact wird nicht mehr direkt editiert.
**Mechanik-Quelle:** `docs/mechanics-spec.md` (VMaNGOS + Wowhead, jede Regel mit Beleg).

## Regeln für beide Seiten
1. Vor jeder Änderung die live Version lesen und mit dieser `base_version` publishen. Ein Konflikt heißt: jemand anderes war schneller, neu lesen.
2. Kleine Änderungen per `edit_version`, keine Komplett-Neuschreibung ohne Grund.
3. Nach dem Publish den Stand-Abschnitt unten aktualisieren (Version + 1–3 Zeilen).
4. Werte ohne Beleg im Code mit `// PH` markieren. Belegte Werte mit Quelle kommentieren (Datei/Funktion oder Spell-ID).
5. Ab der Repo-Migration ist das Repo die Quelle. Das Artifact wird nur noch als spielbarer Build aktualisiert (gebündelte index.html), nicht mehr direkt editiert.

## Code-Aufbau (Abschnitte in index.html)
- `CFG`, `SPELLS`, `CARDS`: alle Zahlen. Tunen nur hier.
- `ACTIONS` / `binds`: Tastenbelegung, localStorage `frostgrind.binds.v1`.
- Formeln (`aggroRadius`, `hitChance`, `xpForKill` …) 1:1 aus der Spec.
- Welt: `heightAt(x,z)` ist die einzige Quelle für Bodenhöhe; `collide()` für Bäume/Steine/Kartenrand; `obstacles[]` (Bäume mit `canopy` für Kamerakollision).
- Render: kein Schattenwurf; EffectComposer = RenderPass → UnrealBloom (Schwelle 1.5) → Vignette/Tönung (ShaderPass) → OutputPass. Nur HDR-Farben > 1 leuchten.
- Modelle: `buildMage()` (Skelett) / `buildBoar()` liefern `{ root, update(dt, anim) }`. Ein CC0-glTF ersetzt sie mit gleicher Schnittstelle (`anim.state`: idle/run/back/air/sit/dead, plus cast, channel, attack, frozen, slowed, flash). Mage hat `anchors` (Kristall, Hand) als Partikel-Ursprung.
- Effekte: `particles` (ein Points-Draw-Call, additiv), `*Fx()` pro Spell, `groundDecalFx()` (Canvas-Texturen iceTex, runeTex), `ambientParticles()`, `shakeCamera()`, `sinkCorpse()`.
- Test-Hook: `window.__game`.

## Stand
- v7 – Fünfte Zone Elvyn (Wald mit Ebern), Lava schadet auch Mobs (`// PH`, kein Pathfinding), Leistungsanzeige im Dev-Menü (FPS, Draw Calls über den ganzen Frame, Mobs).
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
- Leistung: Kevin misst auf seinem Rechner, bis dahin wird nicht optimiert. Falls nötig: pro Mob Materialien teilen. Meshes am selben Gelenk sind in `creatures.ts` über `mergeByJoint` schon verschmolzen, nur der Eber noch nicht; geteilte Materialien brauchen einen anderen Weg für Treffer-Blitz und Slow-Farbe, die heute pro Mob am Material hängen.
- Platzhalter: Mob-HP/-Schaden/-Tempo, Trinkwerte, GCD, Spell-Radien, Nova-Break-Chance, Sprungphysik, Crit-Chance.
- Echte CC0-Modelle (Kevin sucht selbst aus).
