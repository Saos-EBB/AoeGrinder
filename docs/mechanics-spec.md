# Mechanik-Spec: WoW Classic Mage AoE-Grind → Browser-Roguelike

Quellen:
- **Code:** VMaNGOS (github.com/vmangos/core, Branch `development`, Stand 2026-10-31), Pfade relativ zu `src/game/`
- **Spellwerte:** Wowhead Classic Tooltips (`nether.wowhead.com/classic/tooltip/spell/<id>`)

Einheiten: Distanz in **Yards** (1 yd = 1 Spieleinheit), Zeit in ms.
`[verifiziert]` = aus Code/Tooltip belegt. `[offen]` = noch nicht belegt, Platzhalter.

---

## 1. Mob-Aggro (Pull)

`Objects/Creature.cpp` → `Creature::GetAttackDistance()`

```
leveldiff     = playerLevel - mobLevel
leveldiff     = max(leveldiff, -25)          // Cap: MAX_LEVEL_DIFF_FOR_AGGRO_RANGE = 25
aggroRadius   = detectionRange - leveldiff    // detectionRange ≈ 18 yd bei gleichem Level (Kommentar im Code)
aggroRadius   = max(aggroRadius, min(detectionRange, 5))
```
- Höherer Mob → größerer Radius (+1 yd pro Level Unterschied). Niedrigerer Mob → kleiner, min. 5 yd. `[verifiziert]`
- `detectionRange` kommt pro Mob aus der DB; 18 yd als Default nehmen.

## 2. Social Aggro (Mobs helfen sich)

`Objects/Creature.cpp` ~Z. 2526, Defaults in `World.cpp` Z. 562/741
- Mob im Kampf ruft Mobs derselben Fraktion im Umkreis **10 yd** zu Hilfe. `[verifiziert]`
- Die Helfer joinen nach **1500 ms** Verzögerung. `[verifiziert]`

## 3. Fliehen

`Objects/Creature.cpp` → `DoFleeToGetAssistance()`, Defaults `World.cpp` Z. 563/742
- Sucht Helfer im Umkreis **30 yd** und rennt hin. Ohne Helfer: Flucht für **7000 ms**. `[verifiziert]`
- *Wann* geflohen wird (typisch bei ~15 % HP), steht pro Mob im DB-Script und nicht im Core. → selbst festlegen, z. B. 15 % HP und 30 % Chance (`[offen]`).

## 4. Leash / Evade
**Im Spiel entfernt (2026-11-01, Wunsch Kevin):** Mobs verlieren die Aggro nur noch beim Tod der Figur. Der Beleg bleibt zum Nachschlagen.


`Objects/Creature.cpp` → `IsOutOfThreatArea()`, Default `World.cpp` Z. 564
```
threatArea = max(aggroRadius * 1.5, 50)       // gemessen ab Kampf-Startpunkt des Mobs
evade wenn Mob UND Spieler außerhalb threatArea UND letzte Leash-Verlängerung > 12 s her
```
- Kiten ist also bis ~50 yd vom Startpunkt erlaubt. Danach resettet der Mob. `[verifiziert]`

## 5. Spell-Treffer / Resist (PvE)

`Objects/SpellCaster.cpp` → `MagicSpellHitChance()`
```
d = mobLevel - playerLevel
hit% = d < 3 ? 96 - d : 94 - (d - 2) * 11     // 11 = PvE-Faktor (gegen Spieler 7)
hit% = max(hit%, 22)
clamp 1..99
```
- Gleiches Level: 96 % Treffer, +3 Level: 83 %, +5 Level: 61 %. `[verifiziert]`
- AoE nutzt dieselbe Formel. Jedes Ziel würfelt einzeln.

## 6. Crit

`Objects/SpellCaster.cpp` → `SpellCriticalDamageBonus()`
- Spell-Crit = **+50 %** Schaden (Melee/Ranged = +100 %). `[verifiziert]`
- Crit-Chance-Formel (Int → Crit) noch nicht extrahiert. `[offen]` Platzhalter: 5 % Basis.

## 7. Pushback (Schaden unterbricht Cast/Channel)

`Spells/Spell.cpp` → `Delayed()` / `DelayedChannel()`, `Spells/Spell.h` Z. 401
```
delay(n) = n < 5 ? 1000 - n*200 : 200        // 1000, 800, 600, 400, 200, 200 ... ms
Cast:    Castzeit wird um delay verlängert (max. bis volle Castzeit)
Channel: Restdauer wird um delay VERKÜRZT; bei 0 → Channel bricht ab
```
- Für Blizzard heißt das: Mobs, die dich schlagen, fressen dir Ticks weg. Das ist der Kern des Kitens. `[verifiziert]`

## 8. Mana-Regeneration (5-Sekunden-Regel)

`Objects/Unit.h` Z. 868, `Objects/Player.cpp` → `Regenerate()`, `Objects/Unit.cpp` → `GetRegenMPPerSpirit()`
```
Mage-Regen pro 2-s-Tick = Spirit / 4 + 12.5
Nach jedem Mana-Verbrauch: 5000 ms lang KEINE Spirit-Regen (außer Talent-Modifikator)
Tick-Intervall: 2000 ms
```
`[verifiziert]`
- Trinken: Werte noch nicht geholt. `[offen]` Platzhalter: 18 s sitzen, ~X % Mana pro Sekunde.

## 9. Crowd-Control-Heartbeat (Mobs brechen CC)

`Spells/SpellAuras.cpp` → `CalculateHeartBeat()`, `Update()`
- Nur für CC mit Dauer **> 10 s** auf NPCs: alle 5000 ms ein Wurf mit der Resist-Chance aus §5 → bei Miss bricht die CC. `[verifiziert]`
- Frost Nova (8 s) ist davon **nicht** betroffen.

## 10. Frost Nova bricht durch Schaden

- Laut Tooltip kann Schaden den Freeze vorzeitig beenden. `[verifiziert, Tooltip]`
- Im Core läuft das über Proc-Flags in den Spelldaten (Patch 1.10+), siehe Kommentar `Objects/Unit.cpp` ~Z. 736. Die genaue Break-Chance steckt in den Spelldaten und nicht im Code. `[offen]` Platzhalter: jeder Treffer bricht die Nova beim Ziel.

## 11. XP pro Kill

`Formulas.h` → `MaNGOS::XP`
```
grayLevel(pl) = pl<=5 ? 0 : pl<=39 ? pl - 5 - floor(pl/10) : pl - 1 - floor(pl/5)
factor:
  mob >= pl:      1 + 0.05 * min(mob - pl, 4)
  mob > gray:     (ZD + mob - pl) / ZD        // ZD = Tabelle: <8:5, <10:6, <12:7, <16:8, <20:9, <30:11, <40:12, <45:13, <50:14, <55:15, <60:16, sonst 17
  sonst:          0
xp = (pl * 5 + 45) * factor     // Elite: x2 (Dungeon x2.5)
```
`[verifiziert]`
Farben: rot ≥ pl+5, orange ≥ pl+3, gelb ≥ pl-2, grün > gray, sonst grau.

## 12. Global Cooldown

`Objects/SpellCaster.cpp` ~Z. 2398: GCD = `StartRecoveryTime` aus den Spelldaten. `[verifiziert]`
Den Wert 1500 ms für Mage-Spells habe ich nicht aus den Daten gezogen. `[offen]` Platzhalter: 1500 ms.

## 13. Bewegung

`Objects/Unit.cpp` Z. 67 → `baseMoveSpeed[]`
```
Laufen 7.0 yd/s · Rückwärts 4.5 yd/s · Gehen 2.5 yd/s · Schwimmen 4.72 yd/s · Drehen 3.141594 rad/s
```
`[verifiziert]`
- Sprung/Schwerkraft: nicht im Server-Code, läuft im Client. `[offen]`
- Mob-Laufgeschwindigkeit: pro Mob in `creature_template.speed_run` (DB). `[offen]`

---

## Spells (Wowhead Classic Tooltips)

| Spell | Rang 1 (Lvl) | Höchster Rang (Lvl) | Mana R1 → max | Schaden R1 → max | Sonstiges |
|---|---|---|---|---|---|
| **Frost Nova** (122 / 10230) | 10 | 54 | 55 → 145 | 19–21 → 71–79 | Instant, CD 25 s, Root bis 8 s, Schaden kann brechen |
| **Arcane Explosion** (1449 / 10202) | 14 | 54 | 75 → 390 | 34–38 → 249–270 | Instant, 10 yd um Caster |
| **Blizzard** (10 / 10187) | 20 | 60 | 320 → 1400 | 26 → 149 pro Tick | Channel 8 s, 8 Ticks à 1 s, Range 30 yd |
| **Cone of Cold** (120 / 10161) | 26 | 58 | 210 → 555 | 98–108 → 335–365 | Instant, CD 10 s, Slow 50 % für 8 s |
| **Blink** (1953) | 20 | – | ~⅓ Basismana | – | CD 15 s, 20 yd vorwärts, löst Stun/Root |
| **Improved Blizzard** (Talent 11185 / 12487) | – | – | – | – | Blizzard slowt 30 % → 50 % für 1,5 s |

Wichtig: **Blizzard slowt ohne Talent nicht.** Das passt gut als Roguelike-Upgrade-Karte.

`[offen]` Radien Blizzard / Frost Nova / Cone of Cold stehen nicht im Tooltip. Platzhalter: 8 / 10 / 10 yd.

---

## Für den Prototyp übernehmen (Zusammenfassung)

1. Aggro 18 yd ± Leveldiff, min. 5. Social Aggro 10 yd, Helfer nach 1,5 s.
2. ~~Leash 50 yd ab Startpunkt, 12 s Gnade.~~ Entfernt am 2026-11-01 (Wunsch Kevin), siehe §4.
3. Treffer 96 % bei gleichem Level, −11 % pro Level ab +3. AoE würfelt pro Ziel.
4. Crit +50 %.
5. Channel-Pushback verkürzt Blizzard: 1000/800/600/400/200 ms.
6. 5-Sekunden-Regel, Regen in 2-s-Ticks.
7. Spellwerte aus der Tabelle. Rang 1 als Start, Ränge als Level-Up-Karten.

## Offene Punkte
- Crit-Chance-Formel (Int → Crit %)
- Trinkwerte (Mana/s, Dauer)
- GCD-Wert aus Spelldaten bestätigen
- Radien Blizzard / Nova / CoC
- Frost-Nova-Break-Regel genau (pro Treffer oder Schadensschwelle)
