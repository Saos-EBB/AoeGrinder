# Handoff: Items (Gear-Slots, Sets, Drops, Boxen, Ausrüstungsfenster)

Stand: main ec53683 (09.11.2026). Branch `items` hat der Orchestrator von `mobs-neu` abgezweigt (Maps + neue Mobs), damit die Drop-Hooks auf dem neuen Mob-Code sitzen.
Plan: `claude/items-plan.md` (alle Entscheidungen von Kevin, liegt im Claude-Projekt, nicht im Repo). Skins sind schon drin (`src/skins.ts`, `docs/handoffs/skins.md`). Darauf baut das hier auf.
Vorlagen: Mockup Ausrüstungsfenster https://claude.ai/artifact/26pxzMrk5sixn15Zqx3tYi, Set-Skins Viewer https://claude.ai/artifact/ApibEgesNnQqnuUa3hreF5 (lokal: docs/ref/set-skins-magier.html)

```
Du arbeitest an Frost Grind (AoeGrinder), Repo ~/dev/frost-grind, Vite + TypeScript + Three.js 0.170.
Lies AGENTS.md, docs/overview.md, src/meta.ts, src/weaponRolls.ts, src/skins.ts, src/ui/shop.ts, src/ui/mainMenu.ts, src/ui/saveCode.ts,
src/mobs.ts (Kill ~Z. 387), src/champions.ts, src/boss.ts, src/waves.ts, src/plagueMarks.ts, src/spells/fireball.ts, src/spells/needle.ts, src/spells/chain.ts.

## Ziel
Neben der Waffe gibt es 5 Gear-Slots mit Werten, 4 Sets (1 pro Magier) mit Bonus bei 5/5, Gear-Drops im Run, eine Gear-Box und eine Kosmetik-Box
(Gerüst) und ein Ausrüstungsfenster im Hauptmenü. Nur Magier. Der Krieger bekommt nichts davon.

## Regeln
- Branch `items` von main. Ein Commit pro Schritt, mit CHANGELOG.md-Zeile im selben Commit. Nicht pushen, nicht mergen.
- Simpel, keine neuen npm-Pakete. Alle Zahlen bekommen // PH. Kein zweites Roll-System: bestehende Wege aus weaponRolls.ts nutzen
  (rollTier, VALUE_KEY, FOCUS_SPELLS, ELEMENTS, mods/stat, der Treffer-Hook).
- Grundregel: kein Pay-to-win, nur erspielter Staub.
- Gear-Modelle auf der Figur gehören NICHT in diesen Handoff (eigener Handoff später). Einzige Ausnahme ist der Set-Look bei 5/5 (Schritt 4).
- Wenn ein Schritt bricht: stoppen und melden.

## Daten (src/gear.ts, neu)
- SLOTS = ['kopf', 'hals', 'ruecken', 'arme', 'koerper'].
- Gear-Item: { id, v: 1, slot, r, s: { value?, focus?, element, setId? } }. Die id kommt aus demselben Zähler wie die Waffen (meta.nextWeapon) oder einem eigenen nextGear.
- meta.gear: Record<slot, Item[]>, meta.wear: Record<slot, id | null>, meta.looks: string[] (freigeschaltete Kosmetik), meta.lookWear: Record<slot|'waffe', lookId | null>.
  Fehlt ein Feld (alter Stand, alter Code): Standardwert, nie crashen. Laden wie die bestehenden Felder in loadMeta.
- Inventar: 25 je Slot-Art, auch Waffen (ROLLS.invMax 15 → 25). // PH

## Schritt 1: Gear würfeln + Werte wirken
- rollGear(slot, tier?) mit rollTier() und denselben Gewichten [5, 20, 35, 25, 11, 4].
  - Die Hälfte der Teile bekommt Fokus (FOCUS_SPELLS der Schule des gespielten Magiers), die andere Hälfte 1 Wert aus VALUE_KEY.
    Dazu kommt ein Element nach ROLLS.elementChance. Die Stärke skaliert wie bei der Waffe mit der Seltenheit, PH: halb so stark wie die Waffe.
- Wirkung: angelegtes Gear über dieselben Wege wie die Waffe (mods/stat, Element-Proc im Treffer-Hook). resetMods pro Run beachten.
- Seltenheit beim Aufheben bzw. Ziehen:
  - Grau wird sofort Staub (ROLLS.refund).
  - Weiß und Grün gehen in die Kosmetik-Sammlung, sobald es Inhalte gibt. Bis dahin werden sie Staub (refund). // TODO Kosmetik-Inhalte
  - Blau und besser kommen ins Inventar.
- Test per Skript: 10.000 Rolls → Verteilung der Seltenheiten, kein Crash, jedes Teil hat Wert oder Fokus.
Commit.

## Schritt 2: Drops im Run
- Ziel: im Schnitt ca. 25 Gear-Drops pro vollem Run (Level 100). // PH
  - Jedes Boss-Pack (alle 25 Level, boss.ts) droppt sicher 2 Teile.
  - Jedes Champion-Pack (champions.ts, championDied) droppt 1 Teil mit 50 %.
  - Normale Kills: eine Chance pro Kill, die du so einstellst, dass der Schnitt bei ~25 liegt. Per Skript-Run messen und die Zahl in den Bericht schreiben.
- Optik: kleiner Loot-Strahl in Seltenheitsfarbe, Aufheben automatisch beim Drüberlaufen. Den einfachsten Weg nehmen, vorhandenes Partikel- oder Nameplate-System nutzen.
- Run-Ende (Ergebnis-Screen): Liste der Funde.
  - Ist ein Slot-Tab voll: Auswahl, was bleibt. Der Rest wird Staub.
  - Kein Verlust ohne Rückfrage.
- Gilt auch beim Tod: Funde bleiben. // PH, im Bericht nennen
Commit.

## Schritt 3: Boxen im Shop
- Gear-Box: 120 Staub (PH), zufälliger Slot, rollGear, gleiche Würfel-Animation wie die Waffen-Kiste, gleiche Seltenheits-Regeln wie Schritt 1.
- Kosmetik-Box: 120 Staub (PH), gibt nie Duplikate. Pool = KOSMETIK_POOL (leer bis Inhalte kommen).
  Ist der Pool leer oder alles besessen: Knopf ausgegraut mit Text „bald“.
- Die Waffen-Kiste bleibt, wie sie ist (Gewichte unverändert).
- Löschen eines Teils gibt Staub zurück wie bei der Waffe (deleteWeapon als Vorlage).
Commit.

## Schritt 4: Sets (1 pro Magier)
SETS in gear.ts. Ein Set-Teil ist ein Gear-Item mit setId. Set-Teile droppen ab Blau, nur für den gerade gespielten Magier.
Chance: 15 % der blauen und besseren Drops sind Set-Teile, Slot zufällig. // PH
Mit 1–4 Teilen gelten die eigenen zufälligen Rolls, es gibt keinen Teilbonus.
Mit allen 5 Teilen angelegt:
  (a) Jeder Teil-Roll wird durch den festen Perfekt-Wert ersetzt (Tabelle unten).
  (b) Die Set-Mechanik ist aktiv.
  (c) Der Set-Skin wird erzwungen (SKIN_LIST: glut, frost14, blitz, seuche), solange 5/5 angelegt ist. Die gespeicherte Skin-Wahl bleibt erhalten.

| Set (setId, Schule) | Kopf | Hals | Rücken | Arme | Körper |
|---|---|---|---|---|---|
| Glutprophet (glut, feuer) | +15 % Crit | +1 Projektil Feuerball | −10 % Wurfzeit Feuerball | +1 Projektil Feuerball | −10 % Wurfzeit Feuerball |
| Splitterkönig (frost14, frost) | Splitter-Max +5 | Splitter-Max +5 | Gletschernadel +10 % pro Splitter | Gletschernadel +10 % pro Splitter | +15 % Schaden auf Eingefrorene |
| Hochspannung (blitz, blitz) | +1 Sprung | +0,5 % Schaden pro Kill in der Kette | +1 Sprung | +1 Sprung | Kettenblitz −15 % Kosten |
| Pestbringer (seuche, blut) | Platzen +15 % Schaden | Ansteckung +1 Mob | Ansteckung +1 Mob | Platzen-Gift tickt 25 % schneller | Platzen +15 % Schaden |

Mechaniken (je eine Funktion, Hook am Spell):
- Glutprophet: Jeder 10. Feuerball ist ein Riesen-Feuerball (3× Größe, 300 % Schaden). Alle Feuerball-Runen und Talente wirken mit (Splitterball, Große Explosion, Wahnsinn, Dauerfeuer).
- Splitterkönig: Gletschernadel +50 % Reichweite, durchschlägt alle Gegner auf der Linie, am Endpunkt eine Frost Nova. Diese nutzt die normale Nova mit allen Nova-Karten.
- Hochspannung: Jeder Sprung des Kettenblitzes gabelt sich mit 20 % in 2 Ketten. Eine Obergrenze gegen Endlosketten setzen und nennen.
- Pestbringer: Jedes Seuchen-Mal kann 2× gepoppt werden statt 1×.
Gibt es eine Mechanik (z. B. Splitter) im Code nicht so wie beschrieben: das Nächstliegende bauen und im Bericht melden.
Ein Commit pro Set.

## Schritt 5: Ausrüstungsfenster (Hauptmenü)
Nach dem Mockup (Link oben), im Look des UI-Flavors (src/ui/flavors). Keine neuen Styles erfinden.
- Links Gear-Spalte: 5 Slots + Waffe. Seltenheitsfarbe, Wert-Text (effectLines als Vorlage), SET-Marke.
  Darunter der Set-Fortschritt „Glutprophet 3/5“ mit den Texten für Mechanik und Look. Inaktiv = ausgegraut.
- Mitte: die Menü-Figur (Vorschau wie beim Skin-Wechsler).
- Rechts Kosmetik-Spalte, gleiche Slots + Waffe. Belegt heißt, die Figur zeigt den Look. Ist ein Slot leer, steht dort „zeigt Gear: <Name>“.
  Klick auf einen belegten Slot leert ihn. Regel: look ?? gear.
  Jetzt einziger Inhalt: Waffen-Look „Haarspray + Feuerzeug“ (glut). Er wird bei Glutprophet 5/5 freigeschaltet, ist reine Kosmetik und ändert nur die Wurf-Animation des Feuerballs.
  Ist er im Skin-Handoff schon gebaut: freischaltbar machen statt neu bauen.
- Inventar mit Tabs je Slot (25 Plätze). Klick legt an. Löschen mit Rückfrage.
- Handy: Spalten untereinander, Knöpfe mindestens 44 px.
Commit.

## Schritt 6: Spielstand, Rangliste, i18n
- Spielstand-Code: gear, wear, looks und lookWear dazu. Bleibt Version 1, wenn das Laden mit fehlenden Feldern sauber geht, sonst Version 2 mit Migration.
  Export → Reset → Import = gleicher Stand.
- SCORE_VERSION v34 (Gear ändert die Balance). Im Feld build der Rangliste das angelegte Set nennen.
- i18n de/en: Slot-Namen, Set-Namen, Mechanik-Texte, Box-Texte. Englisch selbst übersetzen.
Commit.

## Test
- Skript-Run Level 100 normal, ×20: Gear-Drops im Mittel ~25, Verteilung der Seltenheiten, Set-Teil-Anteil.
- Jedes Set 5/5 per Dev anlegen: Mechanik feuert, Skin wird erzwungen, Werte stimmen. Mit 4/5: kein Bonus.
- Alter Spielstand und alter Code ohne die neuen Felder laden sauber.
- Draw Calls und FPS vorher/nachher (Lvl 1, volles Pack). Drops dürfen nicht spürbar kosten.

## Bericht (kurz)
Commits, gemessene Drop-Rate und die gewählte Kill-Chance, Draw Calls/FPS, Abweichungen von den Mechaniken, weggelassene Teile, englische Texte.
```

## Offen (Kevin, mit Vorschlag)
- Gear-Teile wirken halb so stark wie die Waffe. Vorschlag: so lassen und nach dem ersten Test tunen.
- Funde beim Tod behalten (Vorschlag) oder verlieren.
- Kosmetik-Inhalte: Der Brainstorm pro Slot fehlt noch (Plan Nr. 21). Bis dahin werden Weiß/Grün zu Staub, und die Kosmetik-Box ist „bald“.
- Gear-Modelle auf der Figur (5 Slots als Bones, 0 Draw Calls): eigener Handoff danach.
