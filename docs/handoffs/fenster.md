# Handoff: Ein Fenster für Waffen, Charakter und Ausrüstung (Layout A)

Stand main bf4e742 (10.11.2026). Vorlage: Artifact „Charakterfenster – 4 Layouts“ (https://claude.ai/artifact/UuBU3NxYfPhhR8fwQAejEz, Version 1794271017-4372), Layout A → `docs/ref/charakterfenster/` (Main = A, X1–X3 = A in Höllenfeste, Schlachtbank, Krypta).

```
Du arbeitest an Frost Grind (AoeGrinder), Repo ~/dev/frost-grind, Vite + TypeScript + Three.js 0.170.
Lies AGENTS.md, docs/overview.md, src/ui/weaponMenu.ts, src/ui/gearWindow.ts, src/ui/charWindow.ts, src/ui/charInfo.ts,
src/ui/weaponCard.ts, src/ui/weaponThumb.ts, src/ui/flavors/*, src/input.ts (Binds charWin/gearWin), src/gear.ts, src/meta.ts, src/weaponRolls.ts.

## Ziel
Waffenmenü, Charakterfenster (X) und Ausrüstungsfenster (I) werden EIN Fenster. Nur Layout und Bedienung ändern sich.
Daten und Logik bleiben (Baukasten, weaponRolls, gear.ts, Zerlegen, Staub, Filter in frostgrind.ui.v1). Keine Spielwerte ändern.

## Regeln
- Branch: git switch -c fenster (von main). Ein Commit pro Schritt, CHANGELOG.md-Zeile im selben Commit. Nicht pushen, nicht mergen.
- Simpel, keine neuen npm-Pakete, Optik-Zahlen // PH. Im Look des UI-Flavors (src/ui/flavors), keine neuen Styles erfinden, Klassen .fg-* wiederverwenden.
- Bestehende Bausteine wiederverwenden (weaponCard, weaponThumb, Filterleiste aus weaponMenu, Set-Fortschritt + Erfolge aus gearWindow, Werte aus charInfo).
- Gear-Teile bekommen evtl. neue Felder (maker, group). Zeig sie, wenn vorhanden, sonst „—“. Nie crashen.
- Nach jedem Schritt: tsc 0 Fehler, Spiel starten, Konsole sauber. Fenster bei 1263 × 638 und 2560 × 1440 prüfen (Screenshot).

## Schritt 0: Bestand
Kurz (Datei:Zeile): was jedes der 4 alten Fenster zeigt und kann, wer sie öffnet (Menü-Knöpfe, Binds, Run, Kartenwahl), was im Run erlaubt ist.
Kein Commit, nur Bericht-Abschnitt.

## Schritt 1: Gerüst + Öffnen
- Neue Datei src/ui/heroWindow.ts (+ .css). X und I öffnen/schließen dasselbe Fenster (beide Binds bleiben, gleiche Aktion). Esc schließt.
- Pausiert im Run, geht auch während der Kartenwahl. Im Run wie heute nur ansehen (kein Ausrüsten/Zerlegen), im Menü voll.
- Menü-Knopf „Waffen“ und alte Einstiege zeigen auf das neue Fenster.
Commit.

## Schritt 2: Links – Figur, Slots, Werte
- Oben Name + Stufe. Figur mittig (vorhandene Menü-Figur/3D-Ansicht aus weaponMenu, Drehen per Ziehen).
- Slots links: Kopf, Hals, Rücken. Rechts: Arme, Körper, Waffe. Rahmen in Seltenheitsfarbe.
- Jeder Slot hat oben rechts ein kleines Look-Feld (Kosmetik). Regel: look[slot] ?? gear[slot]. Klick auf belegtes Look-Feld leert es.
- Darunter Set-Fortschritt („Glutprophet 3/5“, Mechanik, Look, Erfolge) wie in gearWindow.
- Werte: Kurzblock mit 6 Hauptwerten, darunter aufklappbar „Alle Werte“ in Gruppen:
  Angriff (Schaden, Crit-Chance, Crit-Schaden, Abklingzeit, Zaubertempo, Radius, Projektile) ·
  Abwehr (Leben, Regen, Schadensreduktion, Dodge-Ladungen) · Ressource (Mana, Mana/s, Kosten-Reduktion) ·
  Element (Schaden je Element, Slow/Brand/Gift-Stärke, Kill-Anzeige-Bonus) ·
  Schaden (Run): Gesamt + nach Quelle, ganze Zahlen mit Tausenderpunkt (de-DE), Prozent klein daneben, außerhalb des Runs „—“ ·
  Build (Karten, Runen, Talente, Relikte), nur im Run.
- Hover auf einen Wert: Aufschlüsselung Basis + Waffe + Gear + Karten/Relikte.
- Liste = was stat()/mods liefern. Fehlt etwas: „—“ und im Bericht.
Commit.

## Schritt 3: Rechts – Inventar (Raster)
- Tabs: Waffen, Kopf, Hals, Rücken, Arme, Körper, Kosmetik, je mit Belegung (x/25, Kosmetik nur Anzahl).
- Filter-Chips + „x von y“ (Filterleiste aus weaponMenu übernehmen, für Gear die passenden Filter: Seltenheit, Element, Hersteller, Fokus, Set).
- Raster 10 breit. Hover-Tooltip mit ▲/▼ gegenüber ausgerüstet (weaponCard). Shift = Vergleich.
- Unten: Staub, „Zur Kiste“ (→ Shop), „Verschmelzen“ (nur wenn gebaut, sonst deaktiviert).
- Klick = Ausrüsten. Zerlegen mit Rückfrage wie heute.
Commit.

## Schritt 4: Rechts – Baum-Ansicht
Schalter „Raster | Baum“ über dem Inventar. Baum ersetzt nur das Raster, Tabs werden Ordner:
  ▾ Waffen 12/25
      ◆ Splitterzepter Vey   ▲ 64 NEU
  ▸ Kopf 6/25
  ▸ Kosmetik 31
Zeile: Seltenheits-Raute + Name in Seltenheitsfarbe, rechts ▲/▼, E (ausgerüstet), NEU.
Ordner auf/zu und gewählte Ansicht in frostgrind.ui.v1 merken.
Commit.

## Schritt 5: Bedienung
- Pfeile wählen (im Baum → ← auf/zu), Enter = Ausrüsten, Entf = Zerlegen (Rückfrage), Shift = Vergleich, / = Suche.
- Controller: Steuerkreuz wie Pfeile, A = Ausrüsten, X = Zerlegen, LB/RB = Tabs. Vorher auf Konflikte mit bestehenden Binds prüfen.
Commit.

## Schritt 6: Aufräumen + i18n
- Alte Fenster löschen (weaponMenu, gearWindow, charWindow, charInfo samt CSS), wenn nichts mehr darauf zeigt. Wiederverwendete Teile vorher herausziehen.
- grep nach alten ids/Klassen → nichts mehr da.
- Texte in src/i18n/de.ts + en.ts, Englisch selbst übersetzen.
Commit.

## Test
- Alle 3 Flavors: Fenster im Menü und im Run (X, I, Kartenwahl), Screenshots bei 1263 × 638 und 2560 × 1440.
- Dev-Inventar füllen (25 je Tab): Filter, Sortierung, Suche, Raster ↔ Baum, Reload behält Ansicht/Ordner/Filter.
- Ausrüsten, Zerlegen, Look-Feld setzen/leeren, Set 4/5 → 5/5.
- Tastatur und Controller komplett ohne Maus durchspielen.
- Alter Spielstand lädt.

## Bericht (kurz)
Commits, gelöschte Dateien, Werte mit „—“, Abweichungen vom Plan, englische Texte, Screenshots.
npx vite starten, Kevin die URL geben, warten.
```
