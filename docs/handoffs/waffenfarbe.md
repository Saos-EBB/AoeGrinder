# Handoff: Magier tragen die Farbe des Waffen-Elements

Neue Claude-Code-Session. Block unten komplett hineinkopieren.
Vorher `spell-viewer-magier.html` (aus dem Chat, Stand 2026-11-08, Spell-Viewer-Version `1794166638-67cb`) nach `~/Downloads/` legen (alte ersetzen).
Konzept + Abnahme (Kevin, 08.11.): `claude/magier-waffenfarbe.md`.

```
Du arbeitest an Frost Grind (AoeGrinder), Repo ~/dev/frost-grind, Vite + TypeScript + Three.js 0.170.
Lies zuerst AGENTS.md, docs/overview.md, docs/handoff.md (Code-Karte).
Aufgabe: Jeder Magier zeigt die Farbe des Elements seiner ausgerüsteten Waffe an Kragen, Schärpe, Armreifen, einem schwebenden Stein über dem Stab und den Augen. Nur Optik, keine Spiellogik.

## Vorlage
~/Downloads/spell-viewer-magier.html im Browser öffnen, unten „Waffen-Element“ durchklicken.
Code: makeMage, Block `if (WEL !== 'none')` (direkt vor dem Bauen des Skeletts), ELC, Funken in frame (`F.wel`), rebuildFig.

## Regeln
- Branch: git switch -c waffenfarbe. Ein Commit pro Schritt, CHANGELOG.md-Zeile im selben Commit. Nicht pushen, nicht mergen.
- Simpel halten, keine neuen Abhängigkeiten, Optik-Zahlen mit // PH.
- Keine Draw Calls extra: alle Teile hängen an Bones im Körper-Mesh. Vorher/nachher messen (renderer.info.render.calls, FPS Mittel über 10 s, Tirisfal Level 1, volles Pack).

## Schritt 1: Teile am Modell
Im Magier-Modell (src/models/strichMagier.ts o. ä.) einen Parameter `weaponElement` ('frost' | 'feuer' | 'blitz' | 'seuche' | 'arkan' | null).
- Farben = ELEMENTS.color aus src/models/weapons/baukasten.ts (nicht doppelt anlegen, von dort importieren): Frost #9fe4ff, Feuer #ff7a22, Blitz #ffe866, Seuche #7dff3a, Arkan #d070ff.
- Ist ein Element gesetzt, kommen dazu (Werte aus dem Viewer):
  - Kragen: Torus r .14, Dicke .045 an der Brust (y .555), liegend
  - Schärpe: Torus r .16, Dicke .035 an der Hüfte + 3 hängende Kegel-Enden vorn rechts
  - Armreifen: Torus r .06 am Unterarm kurz vor der Hand, beide Seiten
  - Stein: Oktaeder .055, gestreckt ×1,5 in y, über dem Stab-Knauf (y .95), als Glüh-Teil
  - Augen: 2 kleine Glüh-Kugeln im Gesicht
- Seuchenmagier (Schleim-Shader): alle Element-Teile als Glüh-Teile, sonst gehen sie im Muster unter.
- Ohne Element: Modell wie bisher.
Commit.

## Schritt 2: An die Waffe koppeln
- Element kommt aus der ausgerüsteten Waffe (v2-Waffen: spec.element). Alte Elemente ohne Farbe (blut, dunkel, void, gift oder unbekannt) → kein Element.
- Wechselt die Waffe (Ausrüsten, Run-Start, Laden), das Modell mit dem neuen Element neu bauen. Das passiert selten, ein Neubau ist ok. Laufende Animation, Stufen-Wert (setMeter) und Position übernehmen.
- Funken: alle ca. 0,07 s ein Partikel in Element-Farbe an Hand oder Stein-Spitze, steigt leicht auf (vorhandenes Partikel-System).
- Gilt für alle Magier-Figuren: Feuer, Frost, Arkan (falls noch im Spiel), Blitz, Seuche, ?-Magier.
Commit.

## Schritt 3: Test
- Skript: jeden Magier mit jedem Element (und ohne) bauen, Screenshot-Raster speichern, keine Fehler. Waffe im Run wechseln → Farbe wechselt.
- Messen wie oben.
- npx vite starten, Kevin die URL geben, warten.

## Bericht (kurz)
Commits, Messwerte, was weggelassen wurde, was unklar war.
```
