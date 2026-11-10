# Handoff: 6 neue Skins (Blitz, Seuche, Frost 14, Ausbrecher, Classic-Krieger 55, Holzfäller)

Stand main d8af1a4 (09.11.2026). Vorlage: Set-Skins Viewer (slug `4f8bd607-31e1-4f6e-9ebd-5ed7fadd988c`, Version `1794183170-e278`).
Kevin legt ab: `docs/ref/set-skins-magier.html` (index.html) und `docs/ref/set-skins-krieger.html` (krieger.html).
Nur Look. Das Gear-/Set-System aus `claude/items-plan.md` wird hier NICHT gebaut (keine Slots, keine Werte, keine 5/5-Mechanik).

```
Du arbeitest an Frost Grind (AoeGrinder), Repo ~/dev/frost-grind, Vite + TypeScript + Three.js 0.170.
Lies AGENTS.md, docs/overview.md, docs/handoff.md, src/models/strichMagier.ts, src/models/strichKrieger.ts, src/ui/mainMenu.ts, src/meta.ts.
Vorlagen: docs/ref/set-skins-magier.html und docs/ref/set-skins-krieger.html im Browser öffnen.

## Was rein kommt
Magier (index.html, SETS + buildFigure):
- Blitz: „Hochspannung“ – Trainingsanzug mit eigenem Zickzack-Streifen (KEINE 3 Streifen, kein Logo), Sonnenbrille, Kupferkette, Isolierband-Bündchen,
  Glasflasche auf dem Rücken mit gelber Leucht-Flüssigkeit.
- Seuche: „Pestbringer“ – verwester Anzug Dunkellila/Grün/Gold, Pestmaske, Phiolen-Kette, Umhangrest, tropfende Manschetten, Dampf + Fliegen, Müllbeutel in der freien Hand.
- Frost: „Splitterkönig“ – Muster Facette, Schnitt 14 „Weste mit Stehkragen“ (CUTS[13]), Platin-Perücke, Eis-Schulter links, Kristall-Kette, Eis-Manschetten,
  Knöchel frei, spitze Lackschuhe. Nur dieser Schnitt, die anderen 14 nicht übernehmen.
Krieger (krieger.html, SKINS):
- Riesenschwert: „Ausbrecher“ (id klapse) – Zwangsjacke, Brechstange als Waffen-Look, Flüster-Blasen.
- Leeroys Klinge: „Classic-Krieger 55“ (id classic) – Clownsuit, Zweihänder mit rotem Glühen, Leeroy-Sprechblasen + Namensschild.
- Sions Axt: „Holzfäller“ (id holz) – Karohemd, Bommelmütze, Vollbart, Fällaxt, Holzstapel auf dem Rücken.
Feuer-Set und alle anderen Mockups aus dem Viewer: nicht übernehmen.

## Regeln
- Branch: steht schon (Orchestrator). Ein Commit pro Schritt, CHANGELOG.md-Zeile im selben Commit. Nicht pushen, nicht mergen.
- Simpel, keine neuen npm-Pakete, Optik-Zahlen // PH. Keine Spiellogik ändern.
- Auf dem Spiel-Rig bauen (Bones aus strichMagier/strichKrieger), Formen/Farben/Teile aus dem Viewer. Viewer-Proportionen weichen ab:
  Rig + Animationen des Spiels behalten, Teile anpassen, Abweichungen im Bericht.
- 0 Draw Calls extra: alle Teile an Bones ins Körper-Mesh mergen, Leuchtteile ins vorhandene Glüh-Mesh. Partikel (Dampf, Fliegen, Funken) über das vorhandene Partikelsystem.
  Sprechblasen/Namensschild als DOM-Overlay (wie Nameplates), nicht als 3D.
- Vorher/nachher messen: renderer.info.render.calls, FPS Mittel 10 s, Lvl 1, volles Pack, je neuer Skin.
- Waffenfarbe (Element-Teile aus magier-waffenfarbe) muss mit den neuen Magier-Skins weiter funktionieren.

## Schritt 1: Skin-Auswahl (nur Daten + Menü)
- Pro Figur eine Skin-Liste: Standard + neue Skins. Krieger-Skins hängen an der Waffe (Ausbrecher nur mit Riesenschwert usw.).
- Gewählter Skin in meta (Feld skins: { figur: skinId }, fehlt → 'standard'). Spielstand-Code: fehlendes Feld → Standard, nie crashen.
- Hauptmenü: Skin-Wechsler unter der Figur (◀ Name ▶), Vorschau = Menü-Figur. Im Flavor-Look (src/ui/flavors), keine neuen Styles erfinden.
- Alle 6 Skins sind frei (kein Shop, keine Freischaltung). Im Bericht sagen.
  Später geändert (10.11.): Magier-Skins gibt es nur über das volle Set 5/5 (Erfolg), Krieger-Skins kommen mit den Waffen, siehe `src/skins.ts`.
Commit.

## Schritt 2: Magier-Skins (Blitz, Seuche, Frost 14)
Je Skin ein Block wie die bestehenden `if (skin === …)` in strichMagier.ts. Ein Commit pro Skin.
Gags nur Optik, an vorhandenen Spielwerten:
- Blitz-Flasche: Pegel = Kettenblitz-Fortschritt bzw. Batterie (was der Code hat), Flüssigkeit über Bone-Skalierung.
- Müllbeutel: Größe ~ Anzahl markierter Mobs (plagueMarks.ts), gedeckelt PH, Bone der Trink-Requisite links.
- Splitterkönig: Splitter-Anzeige nur, wenn es Splitter im Code gibt; sonst weglassen und melden.

## Schritt 3: Krieger-Skins (Ausbrecher, Classic 55, Holzfäller)
Je Skin ein Block in strichKrieger.ts + Waffen-Look (Brechstange, Zweihänder, Fällaxt) als reiner Look über dem Waffen-Modell. Ein Commit pro Skin.
- Holzfäller: Kerben im Stiel = Kills im Run (max 40 sichtbar), ab 100 goldener Stiel, ab 500 Sprössling, alle 20 Kills ein Scheit (alles PH).
- Classic 55 / Ausbrecher: Sprechblasen alle paar Sekunden (PH), Texte in i18n de/en. „Ton“ aus dem Viewer weglassen (keine Sprachausgabe).

## Schritt 4: i18n
Skin-Namen und Blasen-Texte in src/i18n/de.ts + en.ts. Englisch selbst übersetzen, im Bericht listen.
Commit.

## Test
- Skript: jede Figur × jeder Skin bauen, Screenshot-Raster (Menü-Kamera + Spielkamera), Konsole sauber.
- Magier-Skins × jedes Waffen-Element: Element-Teile sichtbar.
- Run starten mit jedem Skin, Gags reagieren (Kills, Male, Kette).
- Alter Spielstand ohne skins-Feld lädt.

## Bericht (kurz)
Commits, Draw Calls/FPS je Skin, Abweichungen zum Viewer, weggelassene Teile, englische Texte.
```
