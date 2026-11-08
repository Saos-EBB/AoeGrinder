# maybeLater (geparkt am 08.11.2026)

**Aktiver Fokus:** Feuer, Frost, Blitz, Seuche und Nahkampf (Strichkrieger).
Hier liegt alles, was rausgenommen wurde. Es wird nicht gelöscht, nur geparkt.

- **Arkan:** zu ähnlich zu Blitz, und Blitz fühlt sich besser an.
- **Klingenstrich:** für jetzt zu viel Arbeit.

Der Ordner liegt außerhalb von `src/`: `tsc` und Vite sehen ihn nicht, nichts davon wird gebaut.
Ganze Dateien sind mit `git mv` hierher gewandert (Pfade wie vorher unter `src/`, History bleibt: `git log --follow`).
Teile aus Dateien, die im Spiel bleiben, liegen als `*.parked.ts` daneben: ausgeschnittener Code plus Notiz, wo er stand.

## Was drin liegt

**Arkan, ganze Dateien**
- `src/spells/ae.ts`, `arcmissiles.ts`, `arcane2.ts` (Arkanbeschuss, Arkanstrahl, Arkane Kugel, Arkanschlag), `voidorb.ts`, `arcmark.ts`, `surge.ts`
- `src/spells/arcRelics.ts`: Relikte Archon (mit Archon-Strahl, -Explosion, -Teleport) und Zeitkrümmung
- `src/fx/arcaneFx.ts`: alte Arkan-Optik (war schon nicht mehr eingebunden)

**Klingenstrich, ganze Dateien**
- `src/klinge.ts` (Regeln, Haltungen, Kit), `src/models/klingeModel.ts` (Modell), `src/vfx/klingeLook.ts` (Optik)
- `klinge.html` + `src/klingeLab.ts` (Testseite)

**Ausgeschnittene Teile (`*.parked.ts`)**
- `config.parked.ts`: Talente/Karten Splitterschwarm, Blinkbombe, Doppelsprung, Tiefe Wunden, Flackern, Schattenpakt; `SCHOOL_METER.Arkan`; Talent-Felder in `mods`; Arkan-Spells im Pool des ?-Magiers
- `modifiers.parked.ts`: Figuren `arcane` und `klinge`, Modi `arcaneonly` und `klinge`
- `schoolMeter.parked.ts`: Arkane Ladungen · `spells/core.parked.ts`: Arkan-Treffer-Haken, Ladungs-Schaden, Dodge-Kombo „sofort“
- `vfx/arcaneLook.parked.ts`, `fx/spellFx.parked.ts`: Arkan-Optik (Woge, Blink-Puff und Getränke bleiben im Spiel, die nutzen Seuche, Blink und ?-Magier)
- `legends.parked.ts`: **Donnerzorn** (Klingen-Legende) und **Achtfacher Stern** (Magier-Legende mit Element Arkan, feuert Arkane Geschosse); seit Schlagfolge E auch **Fleischerhaken** (Krieger-Legende, geplant sind nur Leeroys Klinge und Sions Axt)
- `bosses/roster.parked.ts`, `bosses/evil.parked.ts`: Verdorbener Arkanmagier, Verdorbener Klingenstrich und ihre zwei Stile der Seele der Asche
- `ui/mainMenu.parked.ts`, `ui/charInfo.parked.ts`, `ui/icons.parked.ts`, `models/mage.parked.ts`, `player.parked.ts`, `dodge.parked.ts`: Menü, Werte-Fenster, Icons, Skin- und Waffenwahl, Haken in Spieler, Eingabe, HUD

**Bleibt im Spiel, weil andere es nutzen:** Blink (Tag Arkan, alle Magier), Strichmagier-Skin `arcane` (Teil des ?-Magiers, Tee-Schale), Nahkampf-Tastenbelegung (Strichkrieger; heißt jetzt `useMeleeBinds`, Speicher `frostgrind.binds.klinge.v1` bleibt), `melee.ts`, Waffen-Element Arkan (nur Optik), alle Texte in `src/i18n` (auch die der geparkten Sachen).

**Nicht im Code gefunden:** die Klingen-Legenden *Schwert der tausend Wahrheiten* und *Sandai Kitetsu* (unten beschrieben) gab es nur als Plan, gebaut war nur Donnerzorn.

## Zurückholen
1. Dateien mit `git mv` zurück nach `src/`.
2. Die `*.parked.ts`-Stücke an die genannten Stellen einsetzen, Imports ergänzen.
3. `npx tsc --noEmit`, `npm run check:i18n`, Spell- und Boss-Viewer wieder ergänzen.

---

## Arkan (Stand vor dem Parken)
- **Pool (9):** Arcane Explosion, Arkane Geschosse, Arkanbeschuss, Leerenkugel, Arkanes Mal, Arkanstrahl (Skillshot), Arkane Kugel, Arkane Woge, Arkanschlag.
- **Relikte (Wahl, nur eins pro Run):** offensiv **Archon** oder defensiv **Zeitkrümmung** (nach 4 s zurück an Ort und Lebensstand).
- **Start-Kit:** Arcane Explosion, Arkane Geschosse, Arkanbeschuss, Leerenkugel, Arkane Woge.
- **Arkane Ladungen** (ersetzen die Fokus-Anzeige):
  - Arcane Explosion und Arkane Geschosse geben je +1 Ladung, maximal 4.
  - Jede Ladung gibt +15 % Schaden und +25 % Kosten auf Arkan-Spells.
  - Arkanbeschuss verbraucht alle Ladungen und macht +50 % Schaden pro Ladung.
- **Arkanschlag:** Kegel 6 yd vor dir, gibt +1 Ladung, betäubt 0,5 s, 4 s Abklingzeit.
- **Archon (Relikt):** nur bei 4 Ladungen, 10 s, 60 s Abklingzeit. Kills verlängern (abnehmend). Slots 1–3 werden Archon-Strahl, Archon-Explosion, Archon-Teleport.
- **Spellslinger:** Geschoss-Treffer haben 20 % Chance auf einen Splitter (fliegt nach 1 s ins Ziel). Talent „Splitterschwarm“ (3 Ränge): +10 % pro Rang.
- **Leeren-Combo:** Leerenkugel nur Sog und CC. Arkanstrahl trifft die Kugel → Explosion 15 yd, Markierte nehmen ×1,8 Schaden.
- **Blink-Bomber:** Talent „Blinkbombe“ (Blink löst Arcane Explosion aus), Talent „Doppelsprung“ (+1 Blink-Ladung). Arkane Kugel rollt 20 yd, max. 1 Ladung pro Wurf.
- **Skin:** Arkan-Skelett, schwebt, 10 % schneller.
- **Kill-Anzeige:** voll = −25 % Abklingzeit.

## Klingenstrich (Stand vor dem Parken)
- Strichfigur mit 2 Katanas, ersetzt Ronin + Schatten. Modell ist fertig.
- **Haltungen:**
  - Haltung 1 = Einhand, Standard, keine Boni.
  - Leiste füllt sich durch Schaden insgesamt.
  - Haltung 2 = Zweihand: stärker, dazu Blutung. Einsetzbar bei voller Leiste.
  - Haltung 3: Haltung 2 + mehr Laufgeschwindigkeit und Angriffstempo ×2. Kommt nach 1,5 min in Haltung 2.
  - Leiste leert sich nach 10 s ohne Kill, leer → zurück in Haltung 1.

### Legendäre Klingenstrich-Waffen
**Schwert der tausend Wahrheiten (South Park, „Make Love, Not Warcraft“)**
- Passiv „Griefer-Schlächter“: +50 % Schaden gegen Champions und Bosse.
- Schlagfolge: Einhand mit Frost, jeder Treffer verlangsamt 20 %.
- „Tausend Schnitte“ (ersetzt Kreisschnitt): 10 schnelle Schnitte auf ein Ziel.
- „Bann“ (ersetzt Konter): stärkster Gegner nimmt 8 s doppelten Schaden von dir.
- Combo „Make Love, Not Warcraft“: Mobs in 10 yd hören 3 s auf zu kämpfen.
- Easter Egg: Champions heißen manchmal „Jenkins“.

**Sandai Kitetsu (One Piece, Zoro)**
- Passiv „Verflucht“: +40 % Schaden, ohne Kill in 5 s −2 % Leben/s.
- Ausrüsten: Schwert wird hochgeworfen (Loguetown). Stillstehen → 3 Min. +20 % Schaden.
- Schlagfolge: jeder 3. Schlag legt Blutung, auch in Haltung 1.
- „Oni Giri“ (ersetzt Iaido): Dash durch die Gegner mit Kreuzschnitt.
- „Blutrausch“ (ersetzt Rauchbombe): Haltungs-Leiste sofort voll, kostet 20 % Leben.
- Combo „Fluch des Kitetsu“: 8 s heilt jeder Kill 3 %, danach 10 % Schaden.
