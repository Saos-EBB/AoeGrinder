# Handoff: Boss-Kader neu (5 pro Stufe + Verdorbene überall + neue Modelle)

Quelle: `claude/boss-plan.md` (Kader 08.11.) und Boss-Viewer (slug `e1c7d181-e48e-457f-8931-f2608e5999a2`, Version `1794166146-2db2`, neue Modelle für alle 20 Pool-Bosse). Block unten in eine neue CC-Session kopieren.

```
Du stellst den Boss-Kader in Frost Grind um. Alles nur unter #boss. Ohne #boss bleibt das Spiel unverändert.

## Projekt und Regeln
- Repo ~/dev/frost-grind (Saos-EBB/AoeGrinder). Lies AGENTS.md, docs/overview.md, src/bosses/* (roster, attacks, rules, models), CHANGELOG.
- Branch: git switch -c boss-kader (vom aktuellen Boss-Branch, im Bericht nennen).
- Ein Commit pro Schritt, CHANGELOG-Zeile im selben Commit. Nicht pushen, nicht mergen.
- Neue Zahlen mit // PH. Keine neuen Abhängigkeiten. Einfach halten.
- Rausgenommene Bosse NICHT löschen: nur aus dem Run-Pool nehmen, im Dev-Menü bleiben sie (Gruppe „nicht im Pool“).

## Schritt 1: Pool pro Stufe
Run-Pool genau so:
- frueh (Lvl 15/30): Hogger, Sif, Shazzrah, Gräfin, Lazarus
- mittel (Lvl 45/60): Lilith, Azmodan, Chromaggus, Wachritter, Hornet
- spaet (Lvl 75/90): Maven, Gwyn, Lichkönig, Radahn, Vier Könige
- final (Lvl 100): Ragnaros, Malenia, Maliketh, Shaper, Seele der Asche
- Raus aus dem Pool: Flickwerk, Duriel, Gruul, Abgrundwächter, Thaddius, Ornstein & Smough, Godrick, Yogg-Saron, Atziri.
- Ragnaros wandert von mittel nach final: tier ändern, sonst nichts.
Am einfachsten: Feld tier im Roster umstellen, raus = tier 'aus'.
Commit.

## Schritt 2: Hogger = Hogger + Duriel
- Angriffe: Prankenhiebe (kette), Gnoll-Ansturm (ansturm), dazu Duriels Durchbruch (ansturm len 10, w 3, Farbe eisblau). Gibt es aus dem Balancing schon den Gnoll-Sprung: bleibt drin.
- Regeln: Duriels enge Kammer (arenaRadius 10) + Frost-Aura (slowAura 30 %), Hoggers Wut-Schrei unter 20 %.
- Nameplate „Hogger“. Duriel-Eintrag bleibt als 'aus' im Roster.
Commit.

## Schritt 3: Verdorbene auf jeder Stufe
- An jedem Boss-Termin: Pool = 5 Bosse der Stufe + 1 Platz „Verdorbener“ (Chance 1/6). Fällt der Platz: zufällige verdorbene Figur, die im Run noch nicht dran war.
- Stärke pro Stufe über die TIER-Tabelle (aus dem Balancing). Gibt es sie noch nicht, anlegen:
  | Stufe | Ausholen × | Pause | Treffer |
  | frueh | 1,3 | 1,0–1,6 s | 15 % |
  | mittel | 1,1 | 0,7–1,2 s | 20 % |
  | spaet | 1,0 | 0,4–0,8 s | 25 % |
  | final | 0,9 | 0,3–0,6 s | 30 % |
  Verdorbene bekommen die TIER-Werte des Termins, nicht ihre eigene Stufe. HP wie alle: B.hpMul × Mob-HP des Levels.
- Nur Verdorbene, die im Viewer aktiv sind (Klingenstrich und Arkanmagier sind dort geparkt, maybeLater).
- Seele der Asche bleibt final und nutzt die Verdorbenen wie bisher.
Commit.

## Schritt 4: Neue Modelle (alle 20 Pool-Bosse)
Hol den Viewer mit read_artifact (slug oben). Übernimm in src/bosses/models.ts (Modell-Bauer, headOf, weapon) alles Neue 1:1, dann die model-Einträge der 20 Pool-Bosse aus BOSSES:
- Neuer Bauer: crystal (Shazzrah).
- Neue Köpfe: porcelain, candles, demonQueen, roundHelm, weaver, brain, ashKing, iceCrown, mane, starHood. Kopf-Flags: wildMane, flameCrown.
- Neue Waffen: mace, curved.
- biped-Flags: iceSpikes, collar, halo, stole, puddle, gown, book, orbL/orbR, roundBody, thorns, lantern, insectLegs, spool, embers, skullPads, rocks, bloom, runeRings, emberCracks, souls, wisp.
- quadruped-Flags: ribs, mane, headColors, spine. spider: bellyMouth. lavaTorso: cracks, lavaCrown.
- Wie im Spiel üblich zusammenführen (Merge). Draw Calls pro Boss messen; Wachritter (6 Körper) und Vier Könige (4) extra prüfen. Ist einer > +30 % gegenüber vorher: Teile mit gleichem Material zusammenführen, nichts weglassen.
Angriffe und Regeln bleiben.
Commit (gern 2: früh+mittel, spät+final).

## Schritt Ende: Test
- Dev: Run Lvl 15 → 100 springen, 5× wiederholen. Loggen: welcher Boss pro Termin, Stufe stimmt, keine Doppelten, wie oft Verdorbene kamen, welche TIER-Werte sie hatten.
- Hogger einmal per Dev-Menü: Arena 10 yd, Slow aktiv, alle 3 Angriffe kommen.
- Alle 20 Modelle per Dev-Menü ansehen, Screenshot-Raster.
- npx vite starten, Kevin die URL mit #boss geben, warten.

## Bericht an Kevin (kurz)
- Commits, Pool-Log der 5 Runs, Draw Calls pro Boss (teuerste 3), Abweichungen mit Grund.
```
