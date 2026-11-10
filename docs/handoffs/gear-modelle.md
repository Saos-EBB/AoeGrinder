# Handoff: Gear-Modelle an der Figur (Gear-Baukasten v3, 25 Formen)

Stand main bf4e742 (10.11.2026). Plan: `claude/gear-looks.md` (v3 abgenommen, 10.11.).
Vorlage: Gear-Baukasten Viewer (slug `2a0a962c-1b2e-481d-a3d8-b70647b2181b`, Version `1794267412-f191`) → `docs/ref/gear-baukasten.html`.

```
Du arbeitest an Frost Grind (AoeGrinder), Repo ~/dev/frost-grind, Vite + TypeScript + Three.js 0.170.
Lies AGENTS.md, docs/overview.md, src/gear.ts, src/weaponRolls.ts, src/models/weapons/baukasten.ts (SHAFTS, MAKERS, ELEMENTS, makeHead),
src/models/strichMagier.ts (Bones, buildLook, Glüh-Mesh), src/skins.ts, src/meta.ts.
Vorlage: docs/ref/gear-baukasten.html im Browser öffnen. Code dort: GROUPS, FORMS, MAKERS (cloth/main/acc/trim), Form-Bauer je Slot × Gruppe, emblem, rarityExtras, buildFigure.

## Ziel
Jedes angelegte Gear-Teil ist an der Figur sichtbar. Form = Wertgruppe (5 Gruppen × 5 Slots = 25 Formen).
Jedes Teil zeigt alle seine Merkmale: Stoff in der Hausfarbe des Herstellers, Ornamente im Hersteller-Material, Leuchtkante/Funken in Elementfarbe,
Schul-Emblem bei Fokus, Glühen/Extras nach Seltenheit. Nur Magier.

## Regeln
- Branch steht (Orchestrator). Ein Commit pro Schritt, CHANGELOG.md-Zeile im selben Commit. Nicht pushen, nicht mergen.
- Simpel, keine neuen npm-Pakete, Optik-Zahlen // PH. Formen aus dem Viewer 1:1, nicht neu erfinden.
- 0 Draw Calls extra: alle Teile an Bones ins Körper-Mesh mergen (wie buildLook), Leuchtteile ins vorhandene Glüh-Mesh.
  Wehende/drehende Teile (Schal, Bänder, Umhang, Halo, Zauberkreis, Bücher) auf eigenen Bones, Bewegung über Bone-Rotation.
  Funken über das vorhandene Partikelsystem (emit). Inverted-Hull-Outline aus dem Viewer NICHT übernehmen (toon.ts-Fresnel-Rand nutzen).
- Draw Calls + FPS vorher/nachher (Lvl 1, volles Pack, alle 5 Slots orange belegt). Mehr Draw Calls oder > 10 % FPS weniger → stoppen, melden.
- Besitzer: du änderst gear.ts, strichMagier.ts, eine neue Datei src/models/gearParts.ts, i18n. src/ui/* gehört dem Fenster-Agent: brauchst du dort etwas, melde es.
- Wenn ein Schritt bricht: stoppen und melden.

## Schritt 1: Daten – jedes Teil würfelt alle Schichten
Heute hat ein Gear-Teil value ODER focus und keinen Hersteller (rollGear in gear.ts). Neu (claude/gear-looks.md):
- Jedes Teil hat IMMER 1 Wert (value aus VALUE_KEY) → group = Schaft-Gruppe dieses Werts (SHAFTS in baukasten.ts, wie in rollWeapon).
  Zuordnung zu den Viewer-Gruppen: gerade = off, gedreht = tempo, geknotet = leben, segmentiert = mana, umwickelt = radius.
- Ab Blau zusätzlich Fokus mit 50 % (PH), sonst nie.
- maker zufällig aus MAKERS (Trait halb so stark wie bei der Waffe, über die bestehenden Wege).
- Element wie bisher.
- Migration in cleanGear: alte Teile ohne value bekommen einen zufälligen Wert, ohne maker einen zufälligen Hersteller, Fokus bleibt. Nie crashen. Spielstand-Code geht weiter.
- Für das Fenster exportieren: makerOf(item), groupOf(item) (fehlend → null).
- SCORE_VERSION v35 → v36 (src/config.ts, Werte ändern die Balance).
- Test per Skript: 10.000 Rolls → jedes Teil hat value + group + maker, Fokus nur ab Blau, ~50 % der Blauen+ mit Fokus.
Commit.

## Schritt 2: Teile-Bauer (src/models/gearParts.ts)
- Die 25 Form-Bauer, emblem und rarityExtras aus dem Viewer portieren. Eingang: (slot, item) → Liste { bone, geo, color, m } wie in buildLook.
- Material-Farben aus MAKERS des Viewers (cloth, main, acc, trim). Kristall (vey) ohne Transparenz, nur hell.
- Seltenheit: Grau/Weiß matt, ab Blau Leuchtkante + Funken in Elementfarbe, ab Lila 2 schwebende Splitter, Orange Aura (Partikel).
- Fokus-Emblem je Schule: Frost Kristall, Feuer Flamme, Blitz Zickzack, Seuche Phiole.
Commit.

## Schritt 3: An die Figur
- buildStrichMagier bekommt die angelegten Teile (Regel: look[slot] ?? gear[slot]). Bones: kopf → F.head, hals/koerper → F.chest, ruecken → F.chest (hinten), arme → F.armL/F.armR (.ua/.fa).
- Set-Skin bei 5/5 hat Vorrang (forcedLook): dann keine Gear-Teile darüber.
- Skins ohne Set (Standard-Skins): Gear-Teile darüber. Passt ein Teil nicht zu einem Skin (z. B. Kapuze über Tentakeln): ausblenden, im Bericht listen.
- Figur wird wie heute beim Run-Start und im Menü bei Änderung neu gebaut. Waffenfarbe (Element-Teile) muss weiter funktionieren.
Commit.

## Schritt 4: Bewegung + Feinschliff
- Schal, Bänder, Umhang, Feder, Schöße wehen (Bone-Sinus wie die Tentakel der Seuche), Halo/Zauberkreis/Siegel drehen, Bücher kreisen.
- Offene Punkte aus dem Plan: Krempe des Reisehuts leicht kippen, Feder flacher.
- Größe aus der Spielkamera prüfen: lesbar, nichts verdeckt die Figur. Bei Bedarf alles ×Faktor (PH).
Commit.

## Test
- Skript: jeder Slot × jede Gruppe × jeder Hersteller (125) einmal bauen, Screenshot-Raster (Menü-Kamera), Konsole sauber.
- Je Seltenheit und je Element ein Raster. Fokus-Embleme pro Schule.
- Jeder Magier-Skin mit 5 orangen Teilen, aus der Spielkamera.
- Set 5/5: Gear-Teile weg, Set-Skin da. 4/5: Gear-Teile da.
- Alter Spielstand mit alten Gear-Teilen lädt und zeigt Formen.

## Bericht (kurz)
Commits, Draw Calls/FPS, Migration, ausgeblendete Teile je Skin, Abweichungen zum Viewer, Screenshots.
```
