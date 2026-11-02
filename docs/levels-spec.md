# Level 1–100, Mob-Freischaltung, Hardmode-Fix

Auftrag an Agent BLAU (Branch `blau-levels`). Alle neuen Zahlen sind `// PH`. Stand und Messwerte: `docs/status-blau.md`.

## 1. Level 1–100
- Jeder Run startet auf Level 1, Maximum Level 100, in jeder Zone gleich.
- Volles Start-Kit ab Level 1 (wie bisher).
- Spielerwerte neu skalieren, positiv und stetig ab Level 1.
  Zielwert: Level 20 ≈ heutiger Stand (1040 Leben, Mana = Leben × 4/3).
- Balance-Regel Schaden: Auf JEDEM Level braucht ein gleichstufiger Start-Mob ca. 3 Arcane
  Explosions (ohne Karten). dmgMult(level) und mobMaxHp(level) danach auslegen.
  Per Test messen auf Level 1, 20, 50, 100, Werte in status-blau.md.
  Überholt auf Kevins Wunsch: Mob-Leben verdoppelt, dazu 0,4 % Schadensreduktion pro Level (höchstens 40 %). Rechnerisch 6 Explosions auf Level 1 und 20, 7 auf Level 50, 10 auf Level 100.
- XP: Classic-Formel bleibt (ZD ab Level 60 = 17). Überholt: xpNeeded wächst von 8 Kills auf Level 1 bis 48 auf Level 100 (`LEVEL_KILLS`), dazu Pacing auf 15 Minuten (`LEVEL_PACE`, `paceXpMul`). Karten nur noch auf den Leveln aus `CARD_LEVELS`.
- Level 100: kein Level-Up mehr, XP-Balken zeigt "Max-Level", Punkte laufen weiter.
- Mob-Level: Spielerlevel −1 bis +2, mindestens 1, höchstens 102.

## 2. Mob-Freischaltung pro Zone
Reihenfolge = Tabellen-Reihenfolge in docs/zones-spec.md (Start-Mob zuerst).

| Spielerlevel | Mobs im Spawn |
|---|---|
| 1–15 | nur Start-Mob |
| 16–30 | + Mob 2 |
| 31–45 | + Mob 3 |
| 46–60 | + Mob 4 |
| ab 61 | alle 5 |

- Verteilung: Start-Mob 50 %, die freigeschalteten Spezial-Mobs teilen sich den Rest.
  Vor Level 16 ist der Start-Mob 100 %.
- Sanitäter-Sonderregel (jedes 2. Pack ab 3 Mobs) erst, wenn der Sanitäter freigeschaltet ist.
- Beim Level-Up kommen neue Packs mit dem neuen Mob, bestehende Packs bleiben.
- Einblendung bei Freischaltung: "Neuer Gegner: <Name>".

## 3. Dev im Esc-Menü
"Level setzen" mit Knöpfen 1 / 15 / 16 / 30 / 31 / 45 / 46 / 60 / 61 / 100.

## 4. Hardmode-Fix
"Halbe Werte" als eigenen Faktor multiplizieren, nicht mit Karten-Boni addieren.
+15 % Leben muss in jedem Modus relativ +15 % bleiben.
Test: Hardmode + 1× Frostrüstung → Leben = Basis × 0,5 × 1,15.

## 5. castKey-Vorrang
score.ts: Der Fallback (Spell-ID + 1,2-s-Fenster) bleibt. Sobald mob.castKey gesetzt ist,
hat es Vorrang (Grün setzt es in damageMob).

## Dateien
Blau: zones.ts, mobTypes.ts, abilities.ts, world.ts, render.ts, models/*, mobs.ts, player.ts,
score.ts, leaderboard.ts, ui/scoreHud.ts, ui/leaderboardView.ts,
config.ts Abschnitte ZONE_* / SCORE_* / LEVEL_*, formulas.ts (XP, Level, Spielerwerte).
Nicht anfassen: spells/*, cards.ts, relics.ts, input.ts, gamepad.ts, modifiers.ts,
fx/spellFx.ts, Kartenmenü, Actionbar.
Vor Änderungen an geteilten Dateien (mobs.ts, config.ts, index.html):
`git diff main gruen-polish -- <datei>`. Ändert Grün dieselbe Funktion → stoppen und melden.

## Commits
1. Level 1–100 + Skalierung + Messwerte
2. Mob-Freischaltung + Einblendung
3. Dev "Level setzen"
4. Hardmode-Fix
5. castKey-Vorrang
6. status-blau.md aktualisieren, stoppen und berichten
