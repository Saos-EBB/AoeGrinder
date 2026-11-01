# Status Branch gruen-vfx

Spell-Optik polieren. Nicht gepusht, nicht gemergt, Spiel-Artifact nicht angefasst. Alle neuen Zahlen sind `// PH`.

## 1. VFX-Labor
`npm run dev`, dann `/vfx.html`. `npm run build:vfx` erzeugt die einzelne `dist-vfx/vfx.html`. Das Labor nutzt den echten Spell-Code und die echte Render-Kette. Spells wirken ohne Kosten, Abklingzeit und Castzeit direkt über `effect`.

- Zone `lab` und Mob-Typ `dummy` trägt `vfxLab.ts` zur Laufzeit ein, `zones.ts` und `mobTypes.ts` bleiben unberührt.
- Die Zauber-Module greifen beim Laden auf das Spiel-Menü zu. `vfx.html` legt fehlende Elemente unsichtbar an.
- Die Ziele stehen gestaffelt vor der Figur, damit Kegel, Nova und Bodenziele alle 8 erreichen.
- Spielcode: Effekte laufen auf `fxClock` statt `performance.now`, damit die Zeitlupe greift. Die Blizzard-Animation wanderte aus `main.ts` nach `updateBlizFx`.

## 2. Werkzeuge
- `fx/shaders.ts`: Rauschen aus gebackener 256²-Textur, Fresnel, Auflösen mit Saum, scrollende UVs. Qualität `PERF.vfx` mit `VFX_QUALITY` in `config.ts`.
- `fx/softPass.ts`: Partikel in eigenem Puffer (niedrig/mittel halbe Auflösung), weich gegen die Tiefe des Szenen-Passes.
- `fx/impact.ts`: Licht-Pool, Schockwelle als Post-Pass, Kamera-Ruck, Hitstop 40 ms mit 250 ms Mindestabstand.
- `fx/bolts.ts`: alle Blitze in einem Ringpuffer und einem Draw Call, ab dem Schreiben läuft alles im Shader.

**Außerhalb der genannten Dateien, je minimal:** `render.ts` (Tiefentextur), `main.ts` (Hitstop, Blizzard-Aufruf), `ui/hud.ts` (Crit-Meldung, weil `mobs.ts` gesperrt ist), `score.ts` (Multi-Kill-Meldung), `config.ts` (Schalter), `vite.config.ts`, `package.json`, `.gitignore`.

## 4. Sound
`fx/sound.ts`: synthetisch über WebAudio, Einschlag, Frost-Klirren, Blitzknistern, Feuer-Wumms; pro Art ein Mindestabstand, ein Kompressor gegen Übersteuern. Regler im Esc-Menü und im Labor, Standard 60 %, gespeichert in `frostgrind.volume.v1`. Der Ding-Ton folgt dem Regler und klingt bei 60 % wie vorher. Wiedergabe per Skript geprüft (Pegel ungleich null), nicht angehört.

## 3. Spells neu
Die Alt-Optik bleibt je Funktion hinter `vfxOld()`, nur für den Schalter im Labor. Schaden, Radius und Abklingzeit sind unberührt.

- **Frost:** Nova, Cone of Cold, Blizzard (Wolke und 110 Splitter im Shader, 2 Draw Calls statt über 100), Wirbel, Frostkugel. Die Wolke liegt bei 11,5 yd statt 15 yd, sonst bleibt sie aus der Spielkamera.
- **Relikte:** Ragnaros (Feuerhammer aus dem Himmel, doppelte Welle, Brandriss), Frostatem (3 s schließender Ring mit dichter werdendem Sog, dann Säule und Eisfeld), Frostschlag (harter erster Treffer, Eis auf jedem Ziel), Entweihen (Einsturz nach innen), Feuernova (durchgehende Flammenwand), Knochengefängnis (runde Knochen statt 5-seitiger Kegel).
- **Blitz/Natur:** Kettenblitz und Bogenblitz über den Blitz-Baustein (ein Draw Call, keine Materialien pro Sprung), Hurrikan mit zwei gegenläufigen Trichtern und spiralenden Partikeln.
- **Feuer:** Flammenstoß (Säule, Welle, Glut), Druckwelle (kaum Säule, viel Druck, mit Rune Implosion nach innen), Höllenfeuer (Flammenwand folgt der Figur, Puls bei jedem Tick).
- **Arkan/Leere:** Arcane Explosion, Blink (Einsturz am Start, Stoß am Ziel, Strahl dazwischen), Leerenkugel (Partikel starten außen und spiralen zur Mitte, dunkler Kern mit Fresnel-Rand, Schockwelle nach innen).

## Messwerte
Nur Software-Rendering (swiftshader, 800×500), das sagt nichts über Kevins Rechner aus, nur über das Verhältnis. „Last“ ist Kettenblitz mit 50 Sprüngen plus Blizzard mit 8 Zielen.

| Szene | FPS | Draw Calls (max.) | Partikel (max.) |
|---|---:|---:|---:|
| Leer, alt | 13,5 | 91 | 4 |
| Leer, neu mittel | 13,7 | 91 | 4 |
| Last, alt | 12,7 | 197 | 339 |
| Last, neu niedrig | 10,9 | 94 | 127 |
| Last, neu mittel | 10,4 | 94 | 198 |
| Last, neu hoch | 9,7 | 94 | 238 |

Unter Software-Rendering kostet die neue Optik unter Last rund 18 % FPS, trotz halb so vieler Draw Calls: Das Rendering dort leidet vor allem an Füllrate. Ob das Budget (≥ 55 FPS mit 8 Zielen, ≥ 40 FPS unter Last) auf dem Rechner ohne dedizierte GPU hält, **ist nicht gemessen**. Standard ist „mittel“.

## Stand
Alles aus dem Auftrag ist gebaut. `tsc` und beide Builds sind sauber.

**Geprüft per Skript:** alle 21 Spells mit allen Runen in beiden Optiken (126 Casts, 0 Fehler); nach 3 Runden gleiche Zahl an Geometrien, Texturen und Shader-Programmen, also kein Leck; Hitstop hält die Spielzeit 40 ms an, die Effekte laufen weiter; Fenstergröße ändern; im Spiel Nova und Arcane Explosion an einem echten Mob; Lautstärke-Regler, Pegel ungleich null.

**Nicht geprüft:** das Budget auf echter Grafikkarte, der Klang im Ohr, das Spielgefühl von Ruck und Hitstop, die Optik in den 5 echten Zonen.

**Offen:**
- Die Alt-Optik bleibt nur für den Schalter im Labor im Code, nach Kevins Abnahme kann sie raus.
- Die Blizzard-Wolke liegt tiefer als früher (11,5 statt 15 yd), sonst bleibt sie aus dem Bild.
- Auf Bloom-Stärke und ACES-Sättigung sind die Feuerfarben abgestimmt: Über rund 2 im Farbwert brennt Feuer weiß aus.
- Das Esc-Menü ist jetzt scrollbar, weil es höher als kleine Fenster ist.
- Das Labor-Artifact bekommt nur Stände aus diesem Branch, das Spiel-Artifact blieb unberührt.

## Schadenszahlen
Wunsch von Kevin, nur Schriftgröße. Treffer 18 → 22 px, Crit 28 → 34 px, Schaden an der Figur 18 → 22 px. Im Labor waren es vorher 16 und 26 px, jetzt dieselben Werte wie im Spiel.
