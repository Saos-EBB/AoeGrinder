# UI & Meta – Konzept (2026-11-02)

## Entscheidungen Kevin
- Ziel des Spiels: Speedrun, so schnell wie möglich auf Level 100. Modi und Mods sorgen für Abwechslung und Schwierigkeit.
- Zwei gleichwertige Ranglisten: **Zeit bis Level 100** und **Punkte**.
- Meta-Progression vorerst **nur horizontal**: Der Pool wächst (Runen, Waffen, Relikte, Spielweisen), es gibt keine permanenten Werte. Speedrun-Zeiten bleiben dadurch vergleichbar.
- Ausrüstung: **Startwahl vor dem Run**. Freischalten **nur im Shop nach Run-Ende**. Preise sollen sich hart, aber fair anfühlen.
- UI frei verschiebbar, das Standard-Layout ist für alle gleich.

## Hauptmenü (Fullscreen)
- In der Mitte groß das Modell des gewählten Chars, mit Idle-Animation, dreht sich.
- Darunter eine Leiste mit 5 Chars: Kapuzenmagier (Alle), Eis-Skelett (Frost), Feuer-Skelett (Feuer), Arkan-Skelett (Arkan), Skelett-Krieger (Real Men). Wechsel mit A/D bzw. LB/RB.
- Darunter Mods als Chips, stapelbar: Teil 1/2, Hardmode und weitere, die es im Code gibt.
- Waffenwahl: nur freigeschaltete, gesperrte mit Schloss und Preis.
- Rechts: Rangliste (Zeit + Punkte) für die gewählte Kombination aus Char und Mods.
- Unten: Run starten, Einstellungen, Keybinds, UI bearbeiten.

## HUD (Standard-Layout)
- Oben eine Kopfleiste: Zone, Level, Zeit, Split, Punkte, Combo, Multi-Kill, Mobs. Darunter eine dünne XP-Leiste.
- Unter dem Spieler HP links und Mana rechts nebeneinander, darunter die Castbar.
- Unten mittig die Zauberleiste, größer (ca. 64 px). Pro Slot: Taste, Manakosten, Ladungen, Cooldown-Sweep, blauer Schleier bei zu wenig Mana. Icons aus dem Assets-Ordner.
- Links oben Effekte und Runen klein mit Stacks. Rechts die Relikte, groß und mit Goldrahmen.
- Verschieben: Jedes Element hat Anker und Offset in % vom Bildschirm. Ein Bearbeiten-Modus macht es ziehbar, mit Raster. Gespeichert wird in localStorage, „Zurücksetzen“ lädt den Standard.

## Schadenszahlen
- Dicke dunkle Kontur, Schriftgewicht 900, Größe steigt mit dem Schaden. Crits sind 1,5× größer, mit „!“ und Pop.
- Farbe nach Schule: Frost blau, Feuer orange, Arkan violett, Krieger weiß/rot.
- Begrenzte Anzahl gleichzeitig; kleine Treffer pro Mob werden kurz zusammengefasst.

## Level-up-Karten
- Größer. Rahmen = Seltenheit, Kopfleiste und Icon = Typ (Spell, Rune, Support, Relikt).
- Relikte: Goldrahmen, eigene Form, Leuchten.
- Spellname leuchtet in Schulfarbe. Stichwörter farbig, immer dieselben Farben aus einer Tabelle.
- Hover über „+x %“ zeigt den echten Wert vorher → nachher.
- Verbessert eine Karte etwas, das man schon hat: Leuchten + „Stufe 2 → 3“.

## Charakterfenster (Taste X)
- Pausiert, geht auch während der Kartenwahl.
- Tabs: Werte, Build (Karten + Relikte), Schaden nach Quelle (dieser Run, wie Details! in WoW).

## Meta Phase 1
- Währung „Knochenstaub“ pro Run, abhängig vom erreichten Level und den Mods.
- Shop nach dem Ergebnis-Screen am Run-Ende: gesperrte Einträge kaufen, die dann in den Pool kommen.
- Startset vs. gesperrt: Kevin wählt aus der Liste, die CC erstellt.

## Später (nicht jetzt)
- Auslöser → Wirkung mit Tags (bei Kill, bei Crit, bei Frost-Treffer …), dazu eine Tiefensperre gegen Endlosschleifen. Daraus entstehen Kombos, die nicht geplant sind.
- Kleiner Wertebaum (vertikal), dann mit Meta-Stufe in der Rangliste.
- Ausrüstungs-Slots außer der Waffe (Ring, Amulett).

## Offene Punkte
- HP/Mana nebeneinander (Standard) oder untereinander: noch nicht bestätigt.
- Vollständige Mod-Liste: CC liest sie aus dem Code.
- „Shop nach Lvl-Abschluss“ ist als „nach Run-Ende“ gelesen. Bestätigen, ob es nach jedem Run gemeint ist oder nur nach Level 100.
- Preise und Staub-Formel sind Platzhalter, Kevin tunt sie nach den ersten Runs.
