# Handoff: UI-Mix einbauen (3 Flavors), alte UIs + Zahlen raus

Stand 2026-11-08 (inkl. Waffenmenü mit Baukasten-Filtern + Einstellungen pro Flavor). Ersetzt `claude/handoff-ui-komplett.md` und `claude/ui-auswahl.md` (beide überholt).
**Vorher:** `fg-ui-mix.zip` (neueste Version aus dem Chat) nach `~/Downloads/` entpacken → `~/Downloads/fg-ui-mix/` (README.md = Übersicht).
Danach (separat): Spell-Icons-Prompt.

```
Du arbeitest an Frost Grind (AoeGrinder), Repo ~/dev/frost-grind, Vite + TypeScript + Three.js.
Lies zuerst AGENTS.md, docs/overview.md, docs/handoff.md. Dann ~/Downloads/fg-ui-mix/README.md und die Mockups X1*–X3*.
Mockups = Vorlage für Layout, Farben, Größen, Texte, Ornamente. Exakte Werte in gen*.py (siehe README). Boards 1280×720 → % umrechnen.

Ziel: Es gibt nur noch 3 UI-Flavors, im Spiel wählbar: 1 Höllenfeste, 2 Schlachtbank, 3 Kompakt-Krypta.
Jeder Flavor bringt mit (Mockup pro Flavor): HUD (X?H), Hauptmenü mit Map-Hintergrund (X?M), Level-up (X?K), Shop (X?S), Run-Ende (X?E),
Schadenszahlen + Erfolgs-Meldungen (X?Z), Waffenmenü (X?W), Einstellungen (X?O).
Ohne eigenes Mockup, aber im Flavor-Look: Dev-Fenster (Dev), Tooltips (T1), 4–10 Level-up-Karten (L2), Charakterfenster (C2), Ladebildschirm (LoadDoom).
Alle alten HUD-Presets, Zahlen-Stile und Menü-Looks werden ENTFERNT (nicht nur versteckt).
KEINE Spiellogik ändern (Schaden, CDs, Kosten, Drops), außer den kleinen Datenquellen in Phase 0b.

## Regeln
- Branch: git switch -c ui-mix (vom aktuellen Stand; vorher git status + Branch prüfen, im Zweifel fragen).
- Ein Commit pro Phase, CHANGELOG.md-Zeile im selben Commit. Nicht pushen, nicht mergen.
- Simpel, keine neuen npm-Pakete. Optik-Zahlen mit // PH. Code menschlich lesbar, ein Flavor = eine Datei pro Teil, keine Magie.
- Ornamente NICHT als hunderte Einzel-divs nachbauen wie im Mockup: wiederverwendbare SVG-Dateien (public/ui/<flavor>/corner.svg, divider.svg, …)
  + CSS-Klassen (.fg-panel, .fg-title, .fg-btn, .fg-card, .fg-toggle, .fg-slider, .fg-seg, .fg-chip) mit ::before/::after, border-image oder background-image.
- Bildschirm-Effekte (Funken, Rauch, Scanlines, Glitch, Ketten, Banner) als EIN Overlay pro Flavor, nur CSS, pointer-events: none.
  Im Spiel (HUD) nur die leichten Teile; Einstellung „Bildschirm-Effekte an/aus“.
- Einstellungen weiter in localStorage frostgrind.ui.v1 (fehlende Felder → Standard).
- Fehlen Daten für eine Anzeige: „—“ zeigen und im Bericht auflisten.
- Nach jeder Phase: tsc 0 Fehler, Spiel starten, Konsole sauber. FPS (Mittel 10 s, erste Map Lvl 1, volles Pack) vor Phase 1 und nach Phase 4 messen; Einbruch > 10 % → stoppen, melden.

## Phase 0: Bestand + Datenquellen
a) Tabelle (Datei:Zeile): was aus claude/handoff-ui-komplett.md schon gebaut ist (HUD-Presets H01…, Zahlen-Stile N…, Glut-Theme, Layout-/Bearbeiten-Modus,
   Tooltips, Karten-Layouts, Shop, Run-Ende, Charakterfenster, Inventar/Waffen, Dev-Fenster, Einstellungen) und was es noch nicht gibt.
b) Falls nicht vorhanden, ergänzen: Schaden nach Quelle (Zähler pro Quellen-id im Run), Splits (Lvl 15/30/…/100 + Bestwerte pro Figur+Map+Mods),
   Trigger-Daten für Meldungen (Phase 6). Nur zählen, keine Spielwerte ändern.
Commit.

## Phase 1: Aufräumen
- Alte HUD-Presets, alte Zahlen-Stile, alte Menü-Themes (Glut/Kathedrale/Grimoire bzw. was in Phase 0 gefunden wurde) samt CSS, Settings-Einträgen und Assets löschen.
- Behalten und weiterverwenden: Layout-System + Bearbeiten-Modus (Elemente frei verschiebbar), Tooltip-Modul, Karten-Logik, Shop-/Run-Ende-/Inventar-Logik, Dev-Fenster.
- Alte Werte in frostgrind.ui.v1 (hudPreset, numberStyle …) beim Laden verwerfen → Standard-Flavor 1.
Commit.

## Phase 2: Flavor-Grundlage
- src/ui/flavors/{hoellenfeste,schlachtbank,krypta}.ts + .css. Ein Flavor = { id, name, tokens, hud, numbers, messages, overlay }.
- Tokens als CSS-Variablen auf <body data-flavor="…">. Werte aus gen4.py (M1/M2/M3, H1/H2/H3) und gen5/gen6:
  1 Höllenfeste: Hintergrund #2e140d→#060202, Panel #140a07 + 2px #8a6a35 + inneres Rot-Glühen, Titel Cinzel 900 #e3c27a mit rotem Glow, Knopf #a3140e + Gold.
    Deko: Gold-Ranken an Panel-Ecken, rote Edelsteine (Ecken + oben Mitte), eingravierte Rauten, Titel zwischen Gold-Linien mit roten Rauten + Zacken-Bogen,
    Bildschirm: Steinsäulen links/rechts, gotischer Bogen, Ketten, Funken, Rauch, rote Glut unten.
  2 Schlachtbank: Glut-Farben (#33070a→#050101, Panel rgba(14,4,3,.88), oben 2px #ff3d1f), Titel Anton, Text Oswald.
    Deko: Nieten, abgeschrägte Ecken, Warnstreifen, Lüftungsschlitze, „SEKTOR xx“-Schilder, Gold-Winkel, Knöpfe eckig abgeschnitten + Caps,
    Bildschirm: Scanlines, Vignette, Warnstreifen oben, rote Risse, Runenring hinten, Glitch-Streifen, Statuszeilen („■ HÖLLE AKTIV“).
  3 Kompakt-Krypta: Stein #1c1915 + 1px #b8963e, Titel Cinzel 700 #f2d58a auf rotem Banner, Akzent #ff5a3c, Knöpfe mit Glanz/Schräge.
    Deko: Gold-Endkappen, Wappen oben Mitte, Goldnieten/-perlen, blaue Edelsteine an Ecken, Bildschirm: hängende Banner, Goldschnörkel-Ecken, Leder-/Steintextur.
- Schriften: Cinzel, Oswald, Anton, Barlow, Barlow Condensed, UnifrakturCook (eine Google-Fonts-Zeile reicht).
- Einstellung „Schrift: Standard / Fraktur“ bleibt (Fraktur = Titel in UnifrakturCook, Fließtext unverändert).
- Seltenheiten bleiben: grau #9d9d9d, weiß #e8e8e8, grün #2ecc40, blau #3a8cff, lila #b05cff, orange #ff8a1a, Relikt #e3c27a.
Commit.

## Phase 3: Einstellungen (X?O) + Dev-Fenster im neuen Look
- Einstellungen pro Flavor wie X1O/X2O/X3O: Tabs links (Grafik, Audio, Steuerung & Tasten, Interface, Gameplay), Inhalt rechts, Esc schließt + pausiert.
- Tab Interface:
  - UI-Flavor als 3 große Karten mit Mini-Vorschau (Kugeln + Leiste in Flavor-Farben), Wechsel sofort sichtbar, aktive Karte mit Rahmen-Glühen + ✔.
  - Zahlen & Meldungen: „wie Flavor / Höllenfeste / Schlachtbank / Kompakt-Krypta“ (Segment-Knöpfe).
  - Zahlen-Größe (Slider), Kleine Treffer zusammenfassen, Heilzahlen, Erfolgs-Meldungen, Erweiterte Tooltips, Bildschirm-Effekte (Schalter),
    Schrift Standard/Fraktur (Segment), HUD-Größe (Slider). Knöpfe: UI bearbeiten, Layout zurücksetzen, Abbrechen, Übernehmen.
  - Schalter, Slider, Segment-Knöpfe im Flavor-Look (Akzentfarbe, Rauten-Griff am Slider).
- Dev-Fenster (F10, schwebend, ziehbar, Größe änderbar) bekommt nur Panel-/Knopf-Look des Flavors, Inhalt bleibt.
Commit.

## Phase 4: HUD pro Flavor (X?H)
Je Flavor ein Standard-Layout aus gen4.py (hud1/hud2/hud3), alle Elemente weiter einzeln verschiebbar (Overrides pro Flavor gespeichert).
Zauberleiste = 5 Slots + Trinken + Blink-Taste (bei Frost Eiszeit usw. – was der Code liefert), Taste, Kosten, Ladungen, Cooldown-Sweep, Mana-Schleier.
- 1 Höllenfeste: HP-/Mana-Kugeln mit Gold-Zackenring links/rechts eines Panels unten, kompakte Leiste (46 px, 2 px Abstand) im Panel,
  Kill-Anzeige darüber, XP unten, Schädel mit roten Augen über der Leiste, Kettenglieder, Rundkarte oben rechts + Zeit darunter, Combo „MASSAKER ×47“-Stil oben Mitte.
- 2 Schlachtbank: große HP-/Mana-Zahlen (Anton) unten links/rechts mit dünnen Balken + Leuchtlinien, kompakte Leiste (44 px) unten Mitte,
  Rundkarte mit rotem Rand oben rechts, Relikte als Gold-Rauten daneben, Zeit groß oben links, Combo als riesige Zahl rechts + „MULTI ×6“, Warnstreifen unten.
- 3 Kompakt-Krypta: Spielerrahmen mit Portrait + Level-Abzeichen oben links, Buffs darunter, Rundkarte mit Zonenname oben rechts, Zeit darunter,
  Leiste (40 px) im Steinpanel unten Mitte mit Gold-Flügeln an beiden Enden, XP darunter, Castbar + Kill-Anzeige darüber, Mikro-Menü + 4 Taschen unten rechts, Doom-Combo rechts.
- Minimap: 2D-Canvas, Spieler-Pfeil, Mobs rot, Champions orange, Boss lila, 10 Updates/s, Reichweite PH.
Commit.

## Phase 5: Schadenszahlen pro Flavor (X?Z, gen8.py NUMS)
Gleiche Spawn-Logik wie heute (Pool-Grenze, Zusammenfassen), nur Stil je Flavor. Arten: Treffer, Crit, Mega-Crit (≥ 10× Grundschaden, PH), zusammengefasst ×N, Tick, Heilung, Schaden an dir.
Alle Zahlen als ganze Zahlen mit Tausenderpunkt (Intl.NumberFormat('de-DE'), keine Nachkommastellen, keine Abkürzungen wie „4,8 Mio“).
1: weiß / Crit gelb + rotes Glühen / Mega-Crit Cinzel orange „✦ 48.120 ✦“. 2: Anton / Crit im roten Kasten schräg / Mega-Crit riesig „48.120!!“. 3: WoW-Art Barlow / Crit groß weiß / Mega-Crit gelb.
Commit.

## Phase 6: Erfolgs-Meldungen (X?Z, gen8.py EVENTS / LINES / msg1–3)
Gleiche 16 Auslöser für alle Flavors, nur Text + Look anders:
Multi-Kill 3 / 5 / 10 / 20+ (in kurzer Zeit, PH 1,5 s), Combo 25 / 50 / 100 / 200, 30 s ungetroffen, Elite-Pack tot, Boss tot, Kill-Anzeige voll,
Level-up, Split vor Bestzeit, Mega-Crit, Knapp überlebt (< 5 % Leben).
- Texte aus LINES['1'|'2'|'3'] in die i18n-Dateien (siehe claude/namen-i18n.md bzw. vorhandenes i18n-System), Deutsch = Mockup, Englisch übersetzen und im Bericht listen.
- Look: 1 Gold-Schrift zwischen Linien + roten Rauten (Mitte oben). 2 schräger roter Block + Zahl daneben (Mitte, leichtes Wackeln). 3 Erfolgs-Toast mit Stern-Medaillon (rechts oben, stapelt bis 3).
- Warteschlange: max. 1 Meldung gleichzeitig (bei 3: 3 Toasts), wichtigere (Boss, Combo 200, Multi 20+) überspringen die Schlange. Dauer PH 1,8 s.
- Gibt es einen Auslöser im Code noch nicht: minimal ergänzen (nur zählen), sonst weglassen und melden.
Commit.

## Phase 7: Hauptmenü = Charakterwahl mit Map-Hintergrund (X?M, gen4 charsel + gen7)
- Layout: Modell groß Mitte, links Name/Rolle/Text/3 Werte/Waffe, rechts Rangliste (für Figur + Map + Mods), Mod-Chips, unten Figurenleiste, „Run starten“, „Waffen“ (→ Phase 8 Waffenmenü).
- Figuren = was im Code aktiv ist (aktuell Feuer, Frost, Blitz, Seuche, Strichkrieger; Arkan/Klinge liegen in maybeLater → nicht zeigen).
- Hintergrund = die echte gewählte Map: die Zonen-Szene in Three.js hinter dem Menü rendern, langsamer Kameraschwenk, abgedunkelt (Vignette wie Mockup).
  Zu teuer oder zu aufwendig → einmal ein Standbild der Map rendern und als Hintergrund nutzen. Was du gewählt hast, im Bericht.
- Map-Wechsler oben links: ◀ ▶, kleine Vorschau, Map-Name, „Map x / n“, Bestzeit; Tasten Q/E bzw. LB/RB (vorher auf Konflikte mit bestehenden Tasten prüfen).
  Maps = alle, die es im Code gibt. Gewählte Map ist die Map für den Run.
Commit.

## Phase 8: Waffenmenü, Level-up, Shop, Run-Ende, Charakterfenster, Ladebildschirm, Tooltips im Flavor
- Waffenmenü pro Flavor wie X1W/X2W/X3W (gen10.py, ersetzt das alte Inventar). Daten = Waffen-Baukasten (src/models/weapons/baukasten.ts + src/weaponRolls.ts, v2-Waffen `{ v: 2, s: spec }`):
  - Kopf: Titel „Waffen“, Knochenstaub + Belegung x/15.
  - Filterleiste (alle Filter kombinierbar, Zustand in frostgrind.ui.v1 merken):
    Typ (Langer Stab / Zauberstab / Buch / Relikt) · Schule = Kopf-Schule (Frost / Feuer / Blitz / Seuche / Arkan) · Element (keins / Frost / Feuer / Blitz / Seuche / Arkan) ·
    Hersteller (Grabkammer & Söhne / Sternwarte Ost / Hexenküche Morra / Kristallgießerei Vey / Kriegsschmiede Brandt, Mehrfachauswahl mit Material-Farbe) ·
    Werte = Schaft-Wertgruppe (Schaden/Crit · Abklingzeit/Tempo · Leben/Regen · Mana/Dauereffekte · Radius) ·
    Seltenheit als 6 Rauten zum An/Aus · Sortieren (Seltenheit, Neueste, Hauptwert, Hersteller) · Suche nach Name.
    Namen, Werte und Listen direkt aus baukasten.ts lesen, nichts doppelt pflegen. Steht im Code etwas anderes als hier (z. B. alte Elemente/Köpfe), gilt der Code + Bericht.
    Dropdown = Liste mit Checkboxen, „Alle / Keine“. Aktive Filter als Chips mit ✕ über dem Raster, dazu „x von y“. Nicht passende Waffen abgedunkelt statt ausgeblendet (PH, im Bericht sagen, wie es sich anfühlt).
  - Links: Figur mit Slots – Waffe (Seltenheitsrahmen + Glühen), Nebenhand (für Buch/Relikt; bei Langem Stab belegt mit Hinweis), Ring/Amulett gesperrt mit Schloss; darunter Werte.
  - Mitte: Raster 5 × 3, Kachel = Typ-Silhouette in Seltenheitsfarbe, Element-Punkt oben rechts, Hersteller-Quadrat unten links (Material-Farbe), „E“ = ausgerüstet, „NEU“-Marke,
    leere Plätze gestrichelt; Knöpfe „Zur Kiste“ (→ Shop) und „3 × <Seltenheit> verschmelzen“ (nur wenn gebaut, sonst deaktiviert); Hinweiszeilen.
  - Rechts: Detail der gewählten Waffe: Name in Seltenheitsfarbe (generierter Name aus dem Baukasten), Seltenheit · Typ · Kopf, Hersteller + Material + Element,
    großer Hauptwert, ▲/▼ gegenüber ausgerüstet, Zeilen für Schaft-Werte, Typ-Regel, Hersteller-Eigenschaft, Element-Effekt, Fokus-Spell, Combo; ausgerüstete Waffe darunter;
    Knöpfe „Ausrüsten“ und „+x“ (Zerlegen, Staub). Löschen mit Rückfrage wie heute.
- Level-up: bis 3 Karten wie X?K; 4–10 Karten im L2-Raster (2 × 5) im Flavor-Look; Hover = Tooltip mit vorher → nachher; X = Charakterfenster.
- Shop wie X?S (Kiste + Pity, Ergebnis + Vergleich + Ausrüsten, Verschmelzen nur wenn gebaut, sonst deaktiviert).
- Run-Ende wie X?E: Gesamtschaden groß + Schaden nach Quelle als GANZE Zahlen mit Tausenderpunkt (z. B. 4.812.301), Prozent nur klein daneben; Staub-Rechnung; Knöpfe.
- Charakterfenster (C2-Struktur), Ladebildschirm (LoadDoom-Struktur), Hover-Karten (T1-Struktur): nur Flavor-Tokens + Deko anwenden.
- „Neu würfeln“, „Überspringen“, „×5 öffnen“ nur, wenn es das im Code gibt.
Commit.

## Test (Skript wo möglich)
- Flavor 1/2/3 umschalten: HUD, Hauptmenü, Waffenmenü, Level-up (3 und 10 Karten), Shop, Run-Ende, Einstellungen, Dev-Fenster – keine Konsolenfehler.
- Zahlen „wie Flavor“ und jede feste Wahl; Mega-Crit, Heilung, Schaden an dir auslösen. Tausenderpunkte überall.
- Jede Meldung einmal per Dev-Knopf oder Skript auslösen.
- Bearbeiten-Modus pro Flavor: verschieben, Reload, gleich. Zurücksetzen.
- Map wechseln im Hauptmenü, Run startet auf der gewählten Map.
- Waffenmenü: Dev-Inventar 50 füllen → jeden Filter einzeln + kombiniert, Seltenheits-Rauten, Sortierung, Suche, Reload behält Filter; Ausrüsten, Zerlegen (Rückfrage), Vergleich mit Shift.
- Alte Presets/Stile: grep nach alten ids → nichts mehr da.
- FPS vorher/nachher, mit Bildschirm-Effekten an und aus.

## Bericht (kurz)
Commits, FPS, was gelöscht wurde (Liste), „Daten fehlen“, fehlende Auslöser, englische Meldungs-Texte, Map-Hintergrund (live oder Standbild),
Abweichungen Baukasten-Code vs. Filterliste, Unklarheiten.
npx vite starten, Kevin die URL geben, warten.
```
