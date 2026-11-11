# Code-Audit Frost Grind – Gesamtbericht

Stand `23eb490` (main, 10.11.2026). Fünf getrennte Audits, nur lesend, jeder Fund mit Beleg:
[doppelter Code](dup.md) (DUP, 24) · [Architektur](arch.md) (ARCH, 16) · [Benennung](name.md) (NAME, 33) · [Komplexität](komp.md) (KOMP, 22) · [Dead Code & Doku](dead.md) (DEAD, 30).
Die schwersten Funde sind zusätzlich von Hand nachgeprüft (✔ unten).

## Kurz
Der Code läuft und ist für einen Prototyp aus vielen Agenten-Sessions erstaunlich ordentlich: kein auskommentierter Code, keine TODOs, tsc sauber, Median-Komplexität pro Funktion 1.
Die Kosten liegen woanders:

1. **Ein Import-Kreis trägt das Spiel.** 88 von 206 Modulen hängen in einer einzigen Schleife. Daher kamen die Init-Crashes von heute (`VALUE_KEY before initialization`, ROLLS in heroWindow). Jede Session hat sie anders umgangen, es gibt ~16 Umgehungen in 5 Bauarten.
2. **Eine Schule, sieben Namen.** Feuer ist `fire`, `feuer`, `Feuer`, Seuche ist `blut`, `plague`, `seuche`, `nature`. 8 Übersetzungstabellen, die Hälfte der Doppelungen und Namensprobleme hängt daran. Sichtbar: Seuche-Spells zeigen „Natur“ als Schule.
3. **Zustand ohne Typ.** `state: any`, `player: any`, Mobs mit 206 Feldern, `strict: false` (mit `noImplicitAny` 4212 Fehler). Jede Änderung muss raten, welche Felder es gibt.
4. **Werte als Text.** Vergleiche (▲/▼) parsen den übersetzten Anzeigetext zurück in Zahlen, an 3–5 Stellen kopiert. Ergebnis heute schon falsch bei Abklingzeit.
5. **Spielstand-Sicherheit.** Ein Fehler beim Laden ersetzt den Fortschritt durch einen leeren Stand, der beim nächsten Speichern geschrieben wird.

| Kennzahl | Wert |
|---|---|
| Code (src ohne i18n) | 30 197 Zeilen, 4 427 Funktionen, CC-Summe 13 037 |
| Import-Kreis | 88 von 206 Modulen in einer Komponente, madge: 249 Zyklen |
| Typen | 266 `any`, 81 `as any`, `noImplicitAny` → 4 212 Fehler |
| Lesbarkeit | 4 010 Zeilen > 120 Zeichen, 586 > 200, 1 650 Ternaries (152 verschachtelt) |
| Monster-Funktionen | 54 mit CC > 20, Spitze `strichMagier.update` CC 113, `buildStrichKrieger` 790 Zeilen |
| Platzhalter | 364 `// PH` + ~1 400 ungenannte Zahlen in Spiellogik |
| Dead Code | ~330 Zeilen sicher, 46 i18n-Keys sicher tot, 58 nur für `maybeLater/`, 14 PNGs (152 KB) |
| Doku | Code-Karte in handoff.md: 14 tote/geparkte Verweise, 6 neue Dateien fehlen; architecture.md veraltet |
| Build | `dist/index.html` 2,06 MB (608 KB gzip): three 926 KB, beide Sprachen 239 KB, Spell-Icons 163 KB |
| Tests | keine im Repo, 137 Playwright-Skripte außerhalb (`~/dev/.fg-pw`) |

## 1. Sichtbare Fehler (heute im Spiel)
| Fund | Was der Spieler sieht | Belege | Aufwand |
|---|---|---|---|
| ✔ ▲/▼ widersprüchlich | Waffe mit Abklingzeit-Wert: Inventar ▲, Hover-Karte/Shop ▼ für dieselbe Waffe. Gear kann „▼ −0 %“ zeigen | DUP-01, DUP-02, ARCH-09c · [heroWindow.ts:340](../../src/ui/heroWindow.ts#L340) `Math.abs(a)-Math.abs(b)` vs. [weaponCard.ts:50](../../src/ui/weaponCard.ts#L50) `main.v - other.v` | S |
| ✔ Seuche heißt „Natur“ | Spell-Karten der Seuche zeigen Schule „Natur“ (`cls: 'nature'` → `school.nature`) | NAME-02 · [plague.ts:89](../../src/spells/plague.ts#L89), [spellCard.ts:20](../../src/ui/spellCard.ts#L20) | S |
| Taste I heißt „Ausrüstungsfenster“ | Tastenbelegung zeigt zwei Namen für dasselbe Fenster | DEAD-26, NAME-11 | S |
| Split-Zeit zweimal verschieden | HUD `+m:ss.t`, Rangliste `+m:ss` | DUP-13 | S, Entscheidung |
| Tausenderzeichen gemischt | Auf Englisch: Score-HUD `1,234`, Run-Ende/Schadenszahlen `1.234` | DUP-24 | S, Entscheidung |
| Seltenheitsfarben doppelt | CSS `--rar-*` hat andere Farben als `CARD_RARITIES` (Rahmen vs. Text leicht verschieden) | DUP-03 | S, Entscheidung |
| `#runNote` widersprüchlich gestylt | Breite/Farbe hängt an der Einfüge-Reihenfolge | DUP-12 | S |

## 2. Risiken für Spielstände
| Fund | Risiko | Belege | Aufwand |
|---|---|---|---|
| ✔ `meta.load()` schluckt alles | Kaputter/teilweise ungültiger Stand → leerer Stand → nächster `saveMeta()` (36 Aufrufer) überschreibt den Fortschritt. Auslöser heute keiner bekannt, aber jede neue Säuberungs-Funktion im `try` ist einer | KOMP-06 · [meta.ts:34-37](../../src/meta.ts#L34) | S |
| ✔ `frostgrind.runs.v1` dreimal als Literal | Ändert sich die Version an einer Stelle, schreibt `saveRunBuild` woandershin als `loadRuns` | NAME-12, ARCH-08 · [leaderboard.ts:15](../../src/leaderboard.ts#L15), [spells/core.ts:383](../../src/spells/core.ts#L383), [saveCode.ts:13](../../src/ui/saveCode.ts#L13) | S |
| Säuberung an 4 Stellen | Start und Spielstand-Code-Import säubern verschieden (Import ohne Id-Dedupe) | ARCH-08 | M |
| Keine Schema-Version in `meta` | Migration nur „reparieren beim Laden“; ein Format-Wechsel hat keinen Weg | ARCH-08 | M |

## 3. Struktur (warum Änderungen teuer sind)
- **Import-Kreis + Umgehungen** (ARCH-01/03, Anhang in [arch.md](arch.md)): 18 Stellen laufen heute nur dank Hoisting. Ein harmloser Umbau `function x` → `const x = () =>` wirft dort sofort einen ReferenceError.
  Weg: ein Modul `hooks.ts` ohne Imports (Vorbild `device.ts`) für alle Rückwege, danach kein neuer Trick mehr.
- **Logik ruft UI direkt** (ARCH-02): `combatText` 24×, `showError` 9× aus Logik-Dateien. Ein `feedback.ts` ohne Imports schrumpft den Kreis von 88 auf ~68.
- **Import = Ausführen** (ARCH-04): 49 Module bauen beim Laden DOM/Listener; das Dev-Panel hängt an der Import-Reihenfolge. Der heutige Erfolgs-Bug (`achievements.ts` nicht mehr importiert) war genau das.
- **Events uneinheitlich** (ARCH-07): Kill über Hook-Liste + 8 Direktaufrufe, Erfolg über `window`-Event, Figur über eigenen Hub, dazu 8 Setter.
- **Globaler Zustand** (ARCH-05, KOMP-01/02): `state`/`player` ungetypt, `mods`/`SPELLS` als Laufzeit-Zustand in `config.ts`, `resetGame` mit 15 Hand-Resets, `heroStats` verändert global und spielt zurück.
- **Gott-Dateien** (ARCH-06, KOMP-03/04): `strichMagier.ts` 1 482 Zeilen, `heroWindow.ts` 820, `gear.ts` 58 Exporte, `player.ts` 45 Imports, `main.ts` 64 Imports. Schnitt-Vorschläge stehen in ARCH-06.
- **Modelle hängen an Logik** (ARCH-11): `models/mage.ts` importiert gear, weaponRolls, meta, realMen …

## 4. Ein Vokabular für Schule, Figur, Skin, Kosmetik
Größter Querschnitt über alle Audits (NAME-01…07, DUP-04/05/06, KOMP-05). Heute:

| Konzept | heute im Code | Vorschlag |
|---|---|---|
| Klasse | Typ `Figur`, `isMagierSkin`, 3 Arten „ist Krieger?“ | `HeroClass`, eine Funktion `isWarrior()` |
| Figur (Frost, Feuer, Blitz, Seuche, Leere, Krieger) | `mage.skin`, Mod-ID, `CHARS`, `charIdx`; Leere hat 5 IDs | `figureId` + **eine Tabelle** `FIGURES` (Mod, Element, Palette, Tag, Set) |
| Schule/Element | 7 ID-Systeme, 8 Übersetzungstabellen | `ELEMENTS`-Keys als einzige ID, alles andere aus `FIGURES` |
| Skin | `mage.look`, `opts.look`, `forcedLook` | `skinId` |
| Kosmetik | `LOOKS`, `lookIn`, `wearLook`, `cos*` | `kosmetik*` (gespeicherte Felder `looks`/`lookWear` bleiben) |
| Seltenheit | `r`, `tier`, `rar`, `'grün'`, `CARD_RARITIES` | `rarity` (Index) + `RARITY_ID`; „tier“ nur noch Shop-Stufe |
| Spielermodell | `mage` (auch für den Krieger) | `heroModel` |

Gespeicherte IDs (Mod-IDs in Runs/Rangliste, Bind-IDs `nova/bliz/coc…`, `meta.looks`, Feld `r`) **bleiben** und werden über die Tabelle abgebildet. Volles Glossar: [name.md](name.md#glossar-vorschlag-ein-begriff-pro-konzept).

## 5. Doppelter Code (ohne die Fälle oben)
- **Daten mit mehreren Quellen:** Elementfarben 4× als Hex (DUP-04), Tag→Element 4× (DUP-05), Mana-Regen-Formel 2× (ARCH-09a), `BASE_HIT` 3× (DUP-07).
- **Viewer-Code eins zu eins:** `ik()` 2× Zeichen für Zeichen, Partikel-Pools je Figur (laufen schon auseinander), Toon-Gradient/Rim-Shader 3× (Rim-Farbe weicht ab), gearParts/kosmetikParts mit 10 gemeinsamen Geometrie-Helfern (DUP-08/09/10/15).
- **Kleinhelfer pro Datei:** 6 Zeitformatierer, `esc` 3×, `rnd` 5×, `clamp` 3×, `wrap` 4×, `V` 18×; `boss.ts` importiert `yawTo` und definiert es selbst (DUP-13/17/18/19).
- **CSS in Schichten:** 12 Selektoren aus `index.html` werden von `theme.css`/`hud.css` überschrieben (DUP-12).

## 6. Komplexität
- **Hotspots:** `strichMagier.update` (CC 113, pro Frame), `buildStrichMagier` (CC 89), `updatePlayer` (57), `updateHud` (54, baut pro Frame Chip-Listen + `JSON.stringify`), `updateVisuals` (51), `spells/core.hit` (CC 43 auf 26 Zeilen, 14 Multiplikatoren in balance-relevanter Reihenfolge). Top 30: [komp.md](komp.md#top-30-funktionen-nach-cc).
- **Zustände ohne Zustandsmaschine:** Pause/Fenster im DOM (`classList.contains('show')`, 11 Modal-IDs), Krieger mit 28 Modul-Variablen, Mobs mit String-State + 24 `…Until` (KOMP-08/09/12).
- **Parameter-Ketten:** `damageMob(…, noRoll, dark, forceCrit)`, `noRoll` steht für 5 Dinge (KOMP-10).
- **Game-Loop:** kein kritisches O(n²). Vermeidbare Arbeit im HUD und in `modValue`/`modFactor` (filtern bei jedem Aufruf) (KOMP-13).

## 7. Dead Code & Doku
Sicher löschbar (~330 Zeilen): `src/fx/fireFx.ts`, 18 tote Exporte (z. B. `galeTex`/`voidTex`, die beim Laden unnötig Canvas zeichnen), `kosSlot`, `optCall`/`GEARMOD` in heroWindow, 4 CSS-Regeln, 46 i18n-Keys (`wm.*`, `cw.*`, `gear.*`, `inv.*`, `box.soon` …).
Entscheidung nötig: 58 Keys nur für `maybeLater/`, 14 PNGs in `src/assets/icons/`.
Doku: Code-Karte in `docs/handoff.md` (14 tote Verweise, fehlend: gearParts, kosmetikParts, figEvents, itemThumb, weaponThumb, devKosmetik), `docs/architecture.md` neu aus dem Schichtplan erzeugen. Details: [dead.md](dead.md).

## Fahrplan
Jede Etappe ist als eigener Agenten-Auftrag geschnitten (eigener Branch, ein Commit pro Schritt, Spiel verhält sich gleich, ausgenommen die Fehler aus Abschnitt 1). Reihenfolge nach Nutzen/Risiko.

| # | Etappe | Inhalt (IDs) | Aufwand | Risiko | braucht |
|---|---|---|---|---|---|
| E1 | **Sichtbare Fehler** | ▲/▼ über Zahlen statt Text (DUP-01/02, ARCH-09c), „Natur“ → Seuche (NAME-02), Taste-I-Text (DEAD-26), `#runNote` (DUP-12 Teil) | S | niedrig | – |
| E2 | **Spielstände absichern** | `meta.load` trennen: Parse-Fehler → Rohtext als Backup-Key sichern, nie leer überschreiben; Säuberung einzeln absichern (KOMP-06). `storage.ts` mit Key-Registry, `runs.v1` nur über leaderboard (NAME-12, ARCH-08 1–2) | S | niedrig | – |
| E3 | **Aufräumen** | Alles „sicher“ aus dead.md, Code-Karte + architecture.md neu, Kommentare „Waffenmenü/Ausrüstungsfenster“ (DEAD-*, NAME-29) | S | niedrig | – |
| E4 | **Messbasis** | `npm run check:cycles` (Ausgangswert 88/4/2), Seed-Snapshot (gleicher Seed = gleiche Map) als Schutz vor KOMP-15, erste reine Tests auf rng/grid/`clean*` (ARCH-12) | S–M | niedrig | Entscheidung vitest |
| E5 | **Kleine Quellen-Bündel** | Mana-Regen/`baseHit`/`levelRefill` an einen Ort (ARCH-09, DUP-07), `ui/fmt.ts` + `ui/dom.ts` (DUP-13/17/21/24), Mathe-Helfer in util (DUP-18/19/20), `jag`/`yawTo` (DUP-11/19), Seltenheit + Elementfarben aus einer Quelle (DUP-03/04) | S–M | niedrig | Entscheidungen Split/Tausender/Farben |
| E6 | **Rückwege vereinheitlichen** | `hooks.ts` (ARCH-03), `feedback.ts` (ARCH-02), Erfolg/Kill/Crit über einen Bus (ARCH-07), `registerDev` + `mount()` statt Import-Seiteneffekt (ARCH-04), `spells/stats.ts` gegen formulas↔core (ARCH-01). Ziel: Kreis 88 → ~60 | M | mittel | E4 |
| E7 | **Ein Vokabular** | Tabelle `FIGURES`/Schule, eine `isWarrior()`, `mage`→`heroModel`, `skin`/`look` entwirren, i18n-Präfixe `wm/cw` → `hw` (NAME-01…10, DUP-05/06, KOMP-05). Gespeicherte IDs bleiben | M | mittel | E6, Entscheidung dodge |
| E8 | **Zustand typisieren** | Interfaces für `state`/`player`/Mob (nur dokumentierend), `mods`/`SPELLS` aus config, `onRunReset`, `normalizeMeta` + Schema-Version (ARCH-05/08, KOMP-01) | M | mittel | E2, E4 |
| E9 | **Modell-Bausätze** | `models/strichKit.ts` (ik, grad, Rim, Partikelpool) und `models/partKit.ts` (gear/kosmetik/itemThumb) mit Vorher/Nachher-Screenshots (DUP-08/09/10/15) | M–L | mittel | – |
| E10 | **Gott-Dateien schneiden** | `gear.ts` → `gear/*` (clean testbar), `player.ts` → `run.ts`, `strichMagier/` (Abschnitte existieren schon), `heroWindow/`; danach Modelle von Logik lösen (ARCH-06/11, KOMP-03/04/14) | L | mittel | E6, E8 |

Laufend statt als Etappe: `strict` pro Modul einschalten, wenn eine Datei ohnehin angefasst wird; neue Funde unten anhängen.

## Entscheidungen für mich
1. Split-Zeit mit oder ohne Zehntel (DUP-13)?
2. Englisch mit Tausenderpunkt wie Deutsch oder `1,234` (DUP-24)?
3. Welche Seltenheitsfarben gelten, `CARD_RARITIES` oder CSS (DUP-03)?
4. Dodge-Kombo: Blitz und Seuche absichtlich „normal“ (DUP-06)?
5. Rim-Farbe des Kriegers absichtlich anders (DUP-15)?
6. `vitest` als devDependency für Tests, oder nur `node --test` (ARCH-12)?
7. i18n-Keys und PNGs, die nur `maybeLater/` braucht: behalten oder weg?

## Nicht anfassen (Absicht, mit Beleg in den Einzelberichten)
`fx/` neben `vfx/` (Schalter `vfxOld`) · `mapgen/rng.ts` und die Reihenfolge der `rng()`-Aufrufe (Seed-Rangliste) · feste Seeds der Figuren · `initGear()` aus main.ts und die Hook-Listen an Funktionen (bis `hooks.ts` steht) · Zahlen-Tabellen pro Modul mit `// PH` · Dev-Panel und `window.__*` im Live-Build · `strict: false` global · Single-File-Build · `spellIcons.ts` (erzeugt) · `device.ts` ohne Imports · Mobile-Code · gespeicherte IDs (Bind-, Mod-, Spell-, Look-IDs, Feld `r`, Speicher-Keys).

## Nachträge
Neue Funde aus späteren Sessions hier anhängen (Datum, ID-Kürzel, Beleg).
- 2026-11-11 (E4) Messwert Import-Kreise: `npm run check:cycles` (`scripts/cycles.mjs`, ohne Pakete, Einstiege main.ts und vfxLab.ts). Ausgangswert **statisch 88/4/2** (94 Module in Kreisen, wie Audit), **mit `import()` 102/2** (104): `mapgen/arena.ts:59` `import('../boss')` zieht boss, bosses/*, camera, kathedrale, world, zones, leaderboard und mapgen/* mit in den großen Kreis. Beide Werte stehen als Grenze im Skript (exit 1, wenn größer) und dürfen nur sinken.
- 2026-11-11 (E4) ARCH-15 geprüft, nicht verschoben: `vfxLab.ts` lädt 176 Module (statisch) und hängt im selben 88er-Kreis wie main.ts, `npm run build:vfx` grün. `strichLab.ts` lädt nur 22 Module (strichKrieger, strichMagier, three) und hat keine Kreise; `strich.html` wird nicht gebaut (nur Dev-Server). Ein Umzug nach `src/labs/` braucht nur die zwei `<script src>` in vfx.html/strich.html, `ENTRIES` in `scripts/cycles.mjs` und die Doku-Zeilen (handoff.md, architecture.md); sinnvoll erst nach ARCH-01.
- 2026-11-11 (E4) Blockiert für Node-Tests: `gear.ts` (`cleanGear`) über gear → weaponRolls → spells/fx → render.ts (`new WebGLRenderer` beim Laden), dazu braucht `cleanGear` die erst zur Laufzeit gefüllte `SPELLS`-Registry und würfelt mit `pick` (Math.random). `ui/saveCode.ts` (`check`/`toB64`/`fromB64`) exportiert nichts und lädt über models/mage → render.ts. Beide erst nach ARCH-06 (`gear/clean.ts`) bzw. ARCH-08 (`normalizeMeta`) testbar. `meta.ts` lädt nur mit Browser-Ersatz (`tests/setup/browserStub.ts`: Canvas über baukasten.ts, document über i18n, location über toon.ts).
- 2026-11-11 (E4) Ist-Stand, kein Fix: `cleanStats({ dust: Infinity })` lässt Infinity stehen (im Test festgehalten); `?seed=0.5` ergibt festen Seed 0 (wie vor `seedFromUrl`).
- erledigt: ARCH-01 Weg (1) (fe77b09), ARCH-04 Weg (4) `seedFromUrl` (abfcf82), ARCH-12 Weg (1)+(2) vitest und erste Tests (abfcf82, 08dcdb5), KOMP-15 Vorbedingung Seed-Snapshot (f905405), ARCH-15 geprüft (E4)
- 2026-11-11 E1 erledigt: DUP-01, DUP-02, ARCH-09c (9e66981) · NAME-02 nur Anzeige, cls `nature` bleibt bis E7 (727fcc5) · DEAD-26, NAME-11 (f4e68ee) · DUP-12 nur `#runNote` (43d9021). Offen aus E1: Key `school.nature` ungenutzt (E3/E7), `wm.better`/`wm.worse` ungenutzt (E3)
- 2026-11-11 E2 erledigt: KOMP-06 (e4b6ae8), ARCH-08 Schritt 1–2, NAME-12, NAME-13, KOMP-18 (f7e8fa7), ARCH-08 Schritt 3 `normalizeMeta` (b92482a). Offen aus ARCH-08: Schritt 4 (`schema`-Feld) und 5 (Tests, E8). Hinweis: es sind 16 `frostgrind.*`-Keys (nicht 18), dazu neu das Präfix `frostgrind.meta.v1.backup-`. Konstanten heißen jetzt einheitlich `KEYS.<bereich>` in `src/storage.ts`.
- 2026-11-11 E3 erledigt: DEAD-03, DEAD-10…16, DEAD-29 Teil (nur `export` weg: FIG_EV, KOS_IDS, GEAR_HIDE, KOS_HIDE, THUMB, achText, showAch, gearMaker, gearGroup) (bb85c9b) · DEAD-19…21 (8cc2c5c) · DEAD-05…09 + `school.nature`, DEAD-30/NAME-30 (Entscheidung 7: 63 maybeLater-Keys weg, `school.blood` bleibt, wird in spellCard.ts genutzt) (3730a59) · DEAD-22 (fa6100f) · DEAD-23…25, 27, 28, NAME-29 (8297763) · DEAD-01, 02, 04, ARCH-14 (120e806). Offen/bewusst nicht: DEAD-17 (`__game.m`), DEAD-18 (spellIcons.ts erzeugt), übrige DEAD-29-Exporte (ohne knip nicht vollständig geprüft), `strich.html` meldet schon vor E3 `computeBoundingSphere(): radius is NaN`.
- 2026-11-11 E5 erledigt: ARCH-09a/b, DUP-07 (f33d334) · DUP-13, DUP-21, DUP-24 (7e22335, fd45881; Entscheidungen 1+2) · DUP-16, DUP-17 (7004a21) · DUP-03 (8c887f8; Entscheidung 3, `--rar-*` setzt jetzt `ui/flavors/index.ts` aus `CARD_RARITIES`) · DUP-04 (fe8924c) · DUP-11 nur `jag`, DUP-18, DUP-19, DUP-20 (726e660). Abweichung: `jag` liegt in `util.ts` (boltLook reicht weiter) statt Import strichMagier → vfx/boltLook, der hätte strichMagier in den großen Kreis gezogen (88 → 89). Offen: `TAU` steht weiter lokal in mehreren Dateien; `fmtNum` bleibt in `i18n/index.ts`; Run-Ende-Farben `#6ee7a0`/`#f87171` als Literal (= `COLORS.up/down`).
- 2026-11-11 E6 erledigt: ARCH-03 Listen an Funktionen (1c5c9d7), Setter als Plätze in `hooks.ts` (dcd7e5e), Kanäle mit fester Reihenfolge `rank` (736cac5), `import('../boss')` in arena.ts weg (af6ea35, auch ARCH-13 Teil 3) · ARCH-02 Weg 1–3 `feedback.ts` (f1d54b3, 55d849d, 3de95a3, c041862, de6ccca; `fmtTime` kam schon in E5 aus `ui/fmt.ts`) · ARCH-07 Weg 1–2 Bus `emit`/`on` (7ee808e) · ARCH-04 Weg 1–2 `registerDev`/`DEV_LAYOUT`, Dev-UI raus aus mobKinds/champions/portal/objects/boss/dodge, `mount()` für saveCode/achievements/settingsView/devPanel/devForge/devKosmetik (f31df40, 2fa9561, 19ca32d, 0f5634d, 4bb105c), dabei `setTimeout` in menus.ts weg · ARCH-01 Weg 3 `spells/stats.ts`, Kopie in gear.ts weg (736cac5). Kreis statisch 88 → **84/4/2** (90), mit `import()` 102 → **84/4/2** (90). Prüfung je Commit: Hook-Reihenfolge, Fenster-Listener, Register (registerKind, onMapObjects, addUseSource, addXpMul, addDevButton), CSS-Reihenfolge, Stapel gleicher z-index, rAF-Reihenfolge, Dev-Panel (HTML + Screenshot je Gruppe) gegen den Stand vor E6 (Skripte `~/dev/.fg-pw/e6/order.mjs`, `cmp.mjs`, `imgcmp.py`, Dev-Server mit `evo.config.mjs` schreibt die Modul-Auswertungsreihenfolge mit).
- 2026-11-11 (E6) Nicht gemacht, mit Befund: Schritt „Logik → UI kappen“ (player.ts → menus/leaderboardView/scoreHud, waves.ts → mainMenu, input/gamepad/mobile → heroWindow/mainMenu/menus) brächte den Kreis auf **66** (UI fällt in einen eigenen 7er-Kreis), ändert aber die Lade-Reihenfolge der UI-Module: 9 Capture-Keydown-Listener mit `stopImmediatePropagation` (hud/layout, mainMenu, heroWindow, menus, shop, worldMap, leaderboardView) liefen in anderer Reihenfolge, dazu CSS-Kaskade (`cards.css`, `heroWindow.css` nach `hud.css`), rAF-Reihenfolge (messages/mainMenu) und Stapel `loadModal`/`portalVeil` (z 30). Vorbedingung: diese UI-Module legen Listener und DOM in `mount()` an, `main.ts` ruft sie in der heutigen Reihenfolge. Dann ist der Schnitt klein (Muster liegt bereit: Platz-Objekt in hooks.ts, Umsetzung per `connect…`).
- 2026-11-11 (E6) Anhang B nach E6: über `hooks.ts` sicher sind figures.ts onAnyHit, loot/mobKinds/realMen/plague onMobDeath, realMen setSpellSwap und onWarriorHit, gasoline onFireHit, plague onAnyHit, random onCastStart. Weiter nur dank Hoisting: `mobKinds.ts` `window.__kinds` (spawnMob/removeMob/damageMob/enterCombat), `spells/index.ts` resetSpells, `ui/mainMenu.ts` openBinds (2×) und toggleHero.
- 2026-11-11 (E6) Kleine Ist-Abweichungen der Lade-Reihenfolge, geprüft ohne Wirkung: Keydown-Listener `figEvents.ts` (Idle-Zähler, passiv) und `legends.ts` (Kombo) laufen in anderer Reihenfolge zu `input.ts`, keiner stoppt das Ereignis; F10 (devPanel) läuft jetzt nach dem Boss-Tab-Listener; Kinder von `body` mit verschiedenem z-index in anderer DOM-Reihenfolge (useHint, scoreHud/Legenden-Symbol: z gleich, aber ohne Überlappung).
- 2026-11-11 (E6) CSS-Reihenfolge: Im Build hängt die Kaskade an der Modul-Reihenfolge, und die ist schon vor E6 eine andere als im Dev-Server (Build: cards, heroWindow, flavors/…, numbers, hud, theme, skinTalk; Dev: heroWindow erst nach den Flavors). Die Setter-Umstellung hätte im Build `heroWindow.css` hinter die Flavor-CSS geschoben. Seitdem importiert `main.ts` alle `.css` ganz oben in der Build-Reihenfolge von vor E6; CSS im Build byte-gleich zum Stand vor E6 (`dist/index.html`, auch `dist-vfx`). Neue `.css`-Dateien dort eintragen.
- 2026-11-11 E7 erledigt: NAME-01, NAME-33, DUP-05, DUP-06, KOMP-05 (`src/figureTable.ts` FIGURES, `currentFigure()`/`isWarrior()` in modifiers.ts, `spellElement()` in config.ts; 15eb648) · NAME-02 Rest (Figur-ID `blut` → `seuche`, cls `nature` → `plague`, Rest `blood` weg; 419245c) · Entscheidung 4 Dodge Blitz/Seuche (nur Optik, Wirkung wie Normal; 51c2330) · NAME-03…08 (`heroModel`, `figureId`/`skinId`, `HeroClass`, Kosmetik `kosmetik*`, `rarity`/`rarityOf`, Boss `stage`; b33b90f) · NAME-10, NAME-20 (`wm`/`cw` → `hw`, `set` → `settings`; d479cdc) · NAME-09, 14, 15, 22, 25 (97aa7f3). Glossar: docs/architecture.md „Begriffe im Code“. Kreis bleibt 84/4/2, Modul-Auswertungsreihenfolge und Build-CSS gleich.
- 2026-11-11 (E7) Nicht gemacht: i18n `look.<kosId>.*` → `kos.*` (NAME-04, dynamische Keys, rund 50), `interface Look` (mapgen) → `ThemeStyle` und `pad.look` → `pad.aim` (NAME-04), `menux`/`hudx` (NAME-20), `inv.*` → `hw.inv.*` (NAME-10), `mage.hero` → `rig`, `RARITY_ID` für die Farb-IDs `'grün'…` (NAME-07); in den Viewer-Modellen `strichMagier`/`strichKrieger` heißt der Skin intern weiter `look` (nur die Optionen heißen `skinId`/`kosmetik`). `window.__game.mage`, `window.__gear`, `window.__progress` behalten ihre alten Keys für Testskripte, die Getter heißen aber jetzt `figureId`/`skinId`.
- 2026-11-11 (E7) Fund, nicht behoben (Spielverhalten): `spells/plague.ts` `spell()` setzt `tags: ['Seuche', …o.tags]`, danach überschreibt `...o` das Feld wieder. 9 der 11 Seuche-Spells (alle mit eigenen Tags, z. B. sludge, slimewave, poisoncloud) haben deshalb **kein** Tag `Seuche`. Folgen: Fässer reagieren auf diese Spells wie auf Nahkampf (`elementOf` → `nah`), Wucht-Kachel 3. Unabhängig davon enthält `FOCUS_SPELLS` (weaponRolls.ts) keinen Seuche-Spell: Gear des Seuchenmagiers würfelt nie einen Fokus. Fix wäre `{ ...o, tags: ['Seuche', ...(o.tags ?? [])] }`, ändert aber Spielverhalten (Kevin entscheidet).
- 2026-11-11 E9 erledigt: DUP-08, DUP-15 Kopien (`models/strichKit.ts`: `ik`, `grad`, `TINTS`, `capDown`, `prep`, `RIM`/`rimChunk`; 666b93f) · DUP-15 Rest Rim-Farbe Krieger (Entscheidung 5, sichtbar, CHANGELOG; 8a5fda8) · DUP-09 (`fx/pointPool.ts` `makePointPool`; 1c6d086) · DUP-10 (`models/partKit.ts`, `convert` mit Bone-Hook; 6536923) · KOMP-03 nur Magier (`stepCast`, `nextMode`, `poseFor`, `fireFx`/`iceFx`/`arcaneFx`/`blitzFx`/`plagueFx`; d49a4d5). Beweis „Optik gleich“: deterministischer Pixel-Vergleich (eigener Renderer, Spiel-Schleife angehalten, `Math.random`/`performance.now` je Variante fest), 1082 Bilder: 101 Item-Bilder (25 Gear-Formen × 3 Varianten, 26 Kosmetik), 7 Magier-Paletten + 6 Skin-Varianten + 5× Gear + 10× Kosmetik (mit und ohne Spiel-Partikel) + Mix in 9 Zuständen aus Menü-, Spiel- und Seitenkamera, 5 Krieger (4 Skins, Schwert) in 31 Zuständen (alle Moves, Wut, Sitzen, Tod), 86 Mob-Raster (strichMob, Zusätze, mobTypes/creatures, Eber) in 6 Zuständen. Nach jedem Schritt 0 Pixel Abweichung, nur der Rim-Commit ändert Krieger-Bilder (je Kanal ≤ 24/255). Draw Calls der Figur gleich (Harness und `fixmod/dc.mjs`). Skripte `~/dev/.fg-pw/e9/shots.mjs`, `cmp.py`, `game.mjs`.
- 2026-11-11 (E9) Abweichungen: `makePointPool` liegt in `fx/pointPool.ts`, nicht in `fx/particles.ts`: das lädt `render.ts` (WebGLRenderer beim Laden) und zöge `/strich.html` (strichLab, sonst ohne Spiel-Module) und die Modelle in den Spiel-Graph. Der Krieger-Pool zählt jetzt lebende Punkte wie der Magier: ohne lebende ist das Points-Mesh unsichtbar (−1 Draw Call im Leerlauf des Kriegers, Effekt-Gruppe, nicht die Figur). `creatures.ts` und `strichMob.ts` bleiben beide, geteilt sind nur `TINTS` (und bei strichMob `grad`, `capDown`, Rim). Gear-`seg` war ungenutzt (`void seg`) und ist weg.
- 2026-11-11 (E9) Nicht gemacht: KOMP-03 für `strichKrieger.update` (CC 65) und KOMP-04 (`buildStrichKrieger` 790 Zeilen, Viewer-Abgleich). Vorschlag KOMP-04: erst `interface Fig` für die geteilten `let` (lift, spinAng, rage, flare, qPal, fin, act, T …) als `F.anim`, dann in dieser Reihenfolge herausziehen, je Schritt mit `shots.mjs war` gegen 0 Pixel: (1) Waffen-Geometrie (`swordGeo`/Axt/Kolben, schon ohne Closure-Zugriff) und Skin-Teile (`LW`/`wp`/`wg`) als Modul-Funktionen, (2) Effekte (`crack`, `impact`, `ring`, `ghost`, Wirbel-Sicheln, Stoff-Band) als `buildWarFx(F)`, (3) `makeAction` als Tabelle `ACTIONS[ability](F, W)`, (4) `update` wie beim Magier in `stepAction`, `locoPose`, `applyPose`, `tickFx`. KOMP-17 (`strichMob.anim`) nicht angefasst.
