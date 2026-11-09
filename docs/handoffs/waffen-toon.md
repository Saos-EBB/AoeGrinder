# Handoff für Claude Code: Waffen-Baukasten Rework (Toon) ins Spiel

Stand: main 028385b (08.11.2026). Repo `~/dev/frost-grind`. Referenz: `docs/ref/waffen-baukasten.html` (Viewer-Quelle, Kevin legt sie ab). Daraus übernehmen, nicht neu erfinden.

## Regeln
- Branch `waffen-toon` von main. Ein Commit pro Step, CHANGELOG im selben Commit. Kein Push.
- Alle Zahlen bekommen `// PH`. Simpel vor schlau. Wenn ein Step bricht, stoppen und melden.
- Nur bauen, was hier steht. Was du weglässt, schreibst du in den Bericht.

## Was sich ändert (Entscheidungen Kevin, 08.11.)
- **Elemente**: frost, feuer, blitz, seuche, arkan. `blut` und `dunkel` fallen raus.
  - Arkan gibt es nur über Items, weil die Schule geparkt ist.
  - Farben: frost `0x9fe4ff`, feuer `0xff7a22`, blitz `0xffe866`, seuche `0x7dff3a`, arkan `0xd070ff`.
- **Köpfe nach Schule**, jeder Kopf geht an jedem Typ (`ALL_HEADS`):
  - Frost: `frostorb` (Frostkugel), `sichel` (Sichel)
  - Feuer: `glutschaedel` (Glutschädel), `dreizack` (Dreizack)
  - Blitz: `wolke` (Wolken), `spulen` (Spulen)
  - Seuche: `speischaedel` (Speischädel), `phiole` (Phiolen)
  - Arkan: `ring` (Ring), `auge` (Augen)
- **Hersteller**: alle 5 bleiben, jeder bekommt sein eigenes Material und eine eigene Textur:
  - grab = bronze (Grünspan)
  - stern = gold (Filigran)
  - morra = darkwood (Maserung, aufgehellt)
  - vey = crystal
  - brandt = blueiron (gehämmert, Nieten)
- **Stil**: Toon.

## Code-Stellen
- `src/models/weapons/baukasten.ts`: TYPES, HEADS, ELEMENTS, MAKERS, die Materialien (Lambert), die Partikel-Motions und die Element-FX `blut`/`dunkel` (Z. 40–41, 196–222).
- `src/weaponRolls.ts`:
  - `ROLLS.element`: `darkMul` und `darkHeal` fallen weg.
  - `weaponHit`: `blut` wird `seuche` und setzt weiter `mark(m, infectStacks)`. Der `dunkel`-Zweig fällt weg.
- `src/meta.ts:36`: `ELEMENT_REPLACE` und `fixWeapon`. Das ist der Migrationspunkt für Inventar und Spielstand-Codes (`src/ui/saveCode.ts`).
- `src/legends.ts`: Legenden mit `element` prüfen. Aktuell gibt es nur feuer und frost, also passt das voraussichtlich.
- `src/strichLab.ts:25`: Die Magier-ID `blut` ist die Strich-Magier-Figur, kein Waffen-Element. Nicht anfassen.
- `src/toon.ts`: Hier gibt es schon `toonMat()` (3 Stufen + Fresnel-Rand, 0 extra Draw Calls).
- i18n `src/i18n/de.ts` und `en.ts`: Die Keys für `element.*`, Köpfe und Hersteller anpassen.

## Steps
0. **Code-Map**: Kurz lesen und melden, wo die Köpfe in Namen, Rolls, devForge und Shop-Anzeige hängen. Noch nichts ändern.
1. **Elemente**:
   - ELEMENTS auf die 5 aus Viewer-`ELEMENTS` umstellen, mit fx-Texten aus dem Viewer (frost slow 20 % / 2 s, feuer Brand 30 % / 3 s, blitz Kette 40 % auf 3 Mobs in 6 yd, seuche 1 Seuchen-Mal, arkan 2 % Mana).
   - Die Werte bleiben in ROLLS. `weaponHit` umstellen.
   - FX: Die Motion `blut` wird `seuche` (Tropfen + Blasen wie im Viewer, Animationen `sdrip`/`bubble`). `dunkel` wird gelöscht.
2. **Köpfe**:
   - `ALL_HEADS` und HEADS aus dem Viewer übernehmen.
   - `makeHead(H, head, s, mats, r)` portieren. Alle Typen nutzen es:
     - staff: Kopfgröße 0.1, bei L+0.15
     - wand: 0.045
     - book: 0.05, schwebt über dem Buch (`hover`)
     - relic: Kopf = Kern, 0.075 × thick, in der Fassung
   - Alte Kopf-Geometrie löschen.
3. **Hersteller-Materialien**: Die Canvas-Texturen gold, darkwood, bronze und blueiron aus dem Viewer übernehmen. Die MAKERS-Materialien wie im Viewer setzen. Die alten bone/brass/wood/steel-Texturen löschen, falls nichts anderes sie nutzt.
4. **Toon**:
   - Lambert durch `toonMat()` aus `src/toon.ts` ersetzen. Grundfarben = `TOON_COL` aus dem Viewer.
   - Gem bleibt MeshBasic in Elementfarbe ×1.6 ab grün.
   - Waffen sind immer Toon, auch ohne `?toon=1`. Wenn das neben den Lambert-Figuren falsch aussieht, melden statt basteln.
   - Viewer-Outline (Inverted Hull, `addOutlines`) nur übernehmen, wenn der Fresnel-Rand aus der Spielkamera die Waffe nicht trennt. Draw Calls vorher und nachher melden.
5. **Migration** in `fixWeapon` (gilt für Inventar und Spielstand-Codes):
   - Element: `blut` → `seuche`, `dunkel` → `arkan` (**offen**, siehe unten), `gift` → `seuche`, `void` → `arkan`.
   - Kopf (nach alter Schule):
     - kristall, splitter, nadel, siegel → `frostorb`
     - sichel → `sichel`
     - kaefig, laterne, herz → `glutschaedel`
     - klaue, maul → `dreizack`
     - gabel → `spulen`
     - ring, kugel, rune → `ring`
     - auge, schaedel → `auge`
   - Unbekannte Werte fallen auf den ersten Kopf des Typs bzw. auf `none` zurück und dürfen nie crashen.
   - Kommentar mit der Version dazu.
6. **i18n**: Die de/en-Keys für die neuen Elemente, Köpfe und Hersteller-Materialien ergänzen. Die Keys für blut und dunkel entfernen. Waffennamen in beiden Sprachen prüfen (`weaponNameOf`, Genus).
7. **Check**:
   - `npm run build` ohne Fehler.
   - Im devForge jede Kombination aus Typ × Kopf × Element einmal rollen: kein Crash, Name korrekt.
   - Einen alten Spielstand-Code mit blut/dunkel/alten Köpfen laden. Er muss sauber migrieren.
   - Screenshot aus der Spielkamera: Stab und Zauberstab mit je einem Kopf pro Schule.
   - SCORE_VERSION bleibt (keine Balance-Änderung, außer dass dunkel wegfällt). Melden, falls du das anders siehst.
   - Vite starten und berichten: was geändert wurde, was weggelassen wurde, Draw Calls, offene Punkte.

## Offen (Kevin entscheidet)
- **dunkel-Waffen im Spielstand**: Vorschlag `arkan`, weil die Waffe dann weiter leuchtet und Mana gibt. Die Alternative ist `none`. Bis Kevin entscheidet, gilt der Vorschlag.
- **Outline**: Fresnel-Rand aus toon.ts oder Inverted Hull wie im Viewer. Das entscheidet sich nach dem Screenshot in Step 7.
- **Magier trägt Elementfarbe** (`claude/magier-waffenfarbe.md`): Eigener Handoff nach Kevins Abnahme. Nicht hier bauen.
