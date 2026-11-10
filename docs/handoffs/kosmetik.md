# Handoff: Kosmetik-Inhalte (25 Teile, Box + Meilensteine)

Basis: main **nach** Merge von `gear-modelle` + `fenster` (Orchestrator 3). Grund: nutzt `src/models/gearParts.ts` und das neue Fenster.
Plan: `claude/kosmetik-auswahl.md` (Kevin 10.11.). Vorlage: Kosmetik-Viewer (slug `700b2d38-f3c6-44f6-9e16-d8e107c70be2`, Version `1794298214-56c9`) → `docs/ref/kosmetik-viewer.html`.
Hinweis: `claude/kosmetik-auswahl.md` liegt nicht im Repo, maßgeblich sind dieser Handoff und der Viewer.

```
Du arbeitest an Frost Grind (AoeGrinder), Repo ~/dev/frost-grind, Vite + TypeScript + Three.js 0.170.
Lies AGENTS.md, docs/overview.md, src/gear.ts (LOOKS, LOOK_SLOTS, KOSMETIK_POOL, buyLookBox, takeGear, checkUnlocks, lookIn),
src/models/strichMagier.ts (Bones, part(), Glüh-Mesh, props mit Scale 0), src/models/gearParts.ts, src/meta.ts (grantAch, Erfolge),
src/ui/dmgNumbers.ts, src/ui/heroWindow.ts, src/ui/shop.ts, src/ui/saveCode.ts.
Vorlage: docs/ref/kosmetik-viewer.html im Browser öffnen. Im Code: COS (25 Teile: build + Reaktion), suit(), hood(), neckLoop().

## Ziel
25 Kosmetik-Teile (5 je Slot) als Looks. Regel bleibt: look[slot] ?? gear[slot]. Kein Wert, nur Aussehen + eine Reaktion auf ein Spiel-Ereignis.
20 Teile kommen aus der Kosmetik-Box (120 Staub), 5 nur über Meilensteine (⭐). Nur Magier.

## Regeln
- Eigener Branch `kosmetik` von main. Ein Commit pro Schritt, CHANGELOG.md-Zeile im selben Commit. Nicht pushen, nicht mergen.
- Simpel, keine neuen npm-Pakete, Optik-Zahlen // PH. Formen und Reaktionen aus dem Viewer übernehmen, nicht neu erfinden.
- Draw Calls: Teile an Bones ins Körper-Mesh mergen wie gearParts. Bewegung über Bone-Rotation/-Scale (Scale 0 = unsichtbar),
  Partikel über das Partikelsystem des Spiels. Ausnahmen, je max. +1 Draw Call pro Figur:
  Glas (Fischglas, Limo-Flaschen, Rucksack-Fenster) in EIN gemeinsames transparentes Mesh; Zahl auf der Kill-Flagge als Canvas-Textur.
  Mehr als +2 Draw Calls oder > 10 % FPS weniger (Lvl 1, volles Pack, 5 Kosmetik-Teile an) → stoppen, melden.
- Sprechblasen (Määäh!, MUUUH!, *gääähn*) über dmgNumbers bzw. die vorhandene schwebende Schrift, nichts Neues bauen.
- Inverted-Hull-Outline aus dem Viewer NICHT übernehmen (toon.ts-Fresnel-Rand).
- Wenn ein Schritt bricht: stoppen und melden.

## Schritt 1: Daten
- LOOKS in gear.ts um die 25 Teile erweitern (ids wie im Viewer: pappkrone, fischglas, gluehbirne, bartbrille, fliegenpilz, goldkette, zahnkette,
  kopfhoerer, pizza, schlangenschal, killflagge, elementrucksack, schriftrolle, gewitterwolke, limojetpack, handschellen, krabbenscheren,
  nietenhandschuhe, marionette, schlangenarmreif, dreiteiler, schottenrock, bademantel, schaf, kuh). Namen über i18n (look.<id>.name, .hint).
- Neues Feld ach?: string = Erfolg, der das Teil freischaltet. checkUnlocks gibt das Teil frei, sobald hasAch(ach).
- KOSMETIK_POOL = die 20 Teile ohne ach. Box bleibt ohne Duplikate (vorhandene Logik), leer = Knopf aus.
- takeGear: Weiß/Grün bleiben Staub, aber als Entscheidung, nicht als TODO (Kommentare in gear.ts + GEAR.keepFrom anpassen).
- cleanGear: unbekannte Look-ids fallen weg (läuft schon), neue werden behalten. Spielstand-Code: looks/lookWear gehen schon mit, prüfen.
Commit.

## Schritt 2: Meilensteine
Prüfe zuerst, was meta schon zählt (Datei:Zeile im Bericht). Fehlendes neu in meta.stats { kills, dust } (gesamt über alle Runs), sauber in cleanMeta + Spielstand-Code.
Erfolge (grantAch, Einblendung fg:ach wie bei den Sets):
| Erfolg | Bedingung | Teil |
|---|---|---|
| boss1 | erster Boss-Kill | Pappkrone |
| dust10k | 10.000 Staub gesammelt (erspielt, nicht Kontostand) | XXL-Goldkette |
| kills1k | 1.000 Kills gesamt | Kill-Flagge |
| bossNoHit | einen Boss besiegt, ohne in dem Kampf getroffen zu werden | Kaputte Handschellen |
| lvl100 | Level 100 in einem Run | Business-3-Teiler |
Alle Grenzen // PH. Test per Dev-Befehl: Zähler setzen → Erfolg + Look frei.
Commit.

## Schritt 3: Ereignisse
Ein kleiner Ereignis-Hub für die Figur (z. B. F.onEvent(name)), aufgerufen an den vorhandenen Stellen:
kill, crit, cast, hit (Spieler verliert Leben), level, streak (10 Kills in 2 s, // PH), idle (10 s ohne Eingabe), sprint (an/aus: Spieler läuft / Dash, was es gibt).
Dazu Werte, die die Figur pro Frame lesen darf: Mana %, Kills im Run, Element der Waffe.
Nur Aufrufe ergänzen, keine Spiellogik ändern.
Commit.

## Schritt 4: Modelle + Reaktionen (src/models/kosmetikParts.ts)
- Die 25 build-Funktionen aus COS portieren: Eingang (slot, id) → Teile { bone, geo, color, m } wie gearParts, plus Reaktion (ereignis, t) → Bone-Rotation/Scale.
- Onesies/Anzüge (dreiteiler, bademantel, schaf, kuh, schottenrock) ersetzen den sichtbaren Körper-Look wie ein Gear-Körperteil. Kuh-Flecken: als Farbe/Vertexfarbe, keine extra Textur.
- Arme: Marionette dreht die Arm-Bones, Bademantel kippt den Kopf-Bone. Konflikt mit der Lauf-/Cast-Animation: Kosmetik-Rotation additiv obendrauf, sonst melden.
- Teile, die zu einem Skin nicht passen: ausblenden, im Bericht listen. Set-Skin 5/5 hat Vorrang (wie Gear).
Commit.

## Schritt 5: Fenster + Shop
- Kosmetik-Tab im Fenster zeigt alle 25: freigeschaltet anklickbar, gesperrt grau mit Quelle („Kosmetik-Box“ oder Meilenstein-Text + Fortschritt, z. B. 412/1.000 Kills).
- Look-Feld je Slot setzt/leert wie gehabt. Kosmetik-Box im Shop an (Text „bald“ weg), zeigt x/20 offen.
- i18n de + en (Englisch selbst übersetzen).
Commit.

## Test
- Skript: jedes der 25 Teile allein bauen, Screenshot-Raster aus Menü- und Spielkamera, Konsole sauber.
- Jedes Ereignis per Dev-Befehl auslösen, Reaktion sichtbar (Screenshot-Paar vorher/nachher).
- Draw Calls + FPS: main vs. kosmetik (Lvl 1, volles Pack, 5 Teile an).
- Box 20× kaufen → alle 20, keine Duplikate, dann Knopf aus. Meilensteine per Dev-Zähler.
- Alter Spielstand lädt, alter Spielstand-Code lädt.

## Bericht (kurz)
Commits, Draw Calls/FPS, vorhandene vs. neue Zähler, ausgeblendete Teile je Skin, Abweichungen zum Viewer, Screenshots.
```
