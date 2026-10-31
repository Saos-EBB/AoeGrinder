# Status Branch blau-levels

Spec: `docs/levels-spec.md`. Basis: `5219f8f` (main). Nichts gepusht, nichts veröffentlicht, nichts gemergt. Der Build-Log dieses Auftrags steht hier, um Merge-Konflikte in `build-log.md` zu vermeiden.

## Messwerte Level 1–100
Gemessen im Spiel per echtem `cast('ae')`, je 1000 gleichstufige Klapperskelette ohne Karten, Normal-Modus, mit Trefferwurf und Crits.

| Level | Leben | Mana | Spirit | dmgMult | Mob-Leben | AE im Schnitt | genau 3 AE | XP je Level | XP je Kill | Kills je Level |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 299 | 399 | 7 | 1,00 | 100 | 3,10 | 90 % | 500 | 50 | 10 |
| 20 | 1040 | 1387 | 45 | 1,95 | 195 | 3,10 | 91 % | 1450 | 145 | 10 |
| 50 | 2210 | 2947 | 105 | 3,45 | 345 | 3,11 | 89 % | 2950 | 295 | 10 |
| 100 | 4160 | 5547 | 205 | 5,95 | 595 | 3,12 | 88 % | 5450 | 545 | 10 |

Die Abweichung von 3 kommt vom Trefferwurf (96 %) und seltenen Doppel-Crits. Leben, Mana, Spirit, dmgMult und Mob-Leben sind auf Level 1–100 positiv, das Leben steigt mit jedem Level.

## Build-Log
- **feat(level): Level 1–100, Skalierung.** Schaden und Mob-Leben hängen am selben Faktor, deshalb bleibt es auf jedem Level bei 3 Treffern. `xpNeeded` und Spirit waren schon passend und blieben unverändert. Mob-Level-Grenzen waren es auch: ab Level 100 ergibt +2 genau 102. `ui/hud.ts` steht nicht auf der Dateiliste, bekam aber die drei Zeilen für den XP-Balken, weil der Text dort gesetzt wird. Nicht gebaut: keine Skalierung von Manakosten, Mob-Schaden und festem Umgebungsschaden.
