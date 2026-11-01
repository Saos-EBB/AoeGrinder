# Status Waffen (Branch `waffen`)

Die 15 Waffen aus dem Viewer „Frost Grind – Stäbe & Klingen“ (Version `1793503310-e645`) liegen in der rechten Hand der Figur. Getestet per Skript und Standbild, nicht von Hand gespielt.

## Aufbau
- `src/models/weapons/`: `textures.ts` (Abschnitt 1), `fx.ts` (Emitter, Arc), `defs.ts` (15 Waffen mit Texten), `index.ts` (`buildWeapon`, Merge), `menu.ts` (Dev-Auswahl).
- `mage.setWeapon(id)` tauscht zur Laufzeit, `mage.weapon` ist die aktuelle Waffe. `anchors.crystal` zeigt auf den Leuchtpunkt, `handL` und `handR` bleiben.
- Auswahl: Esc-Menü „Dev: Waffe“, localStorage `frostgrind.weapon.v1`, Standard `grenzwaechter`. Der Schalter „Alle 15 durchschalten“ wechselt alle 2,5 s. Das Menü hängt sich per DOM ein, `index.html` und `ui/menus.ts` sind unverändert.

## Technik
- 1 Lambert-Mesh (Atlas 2×2 à 256 px, Tönung und Transparenz pro Vertex), 1 Glow-Mesh, 1 Points. Bewegliche Teile (Laterne, Glocke, Ringe, Sanduhr, Auge, Splitter) laufen über ein Skelett, das Mesh bleibt ein Draw Call.
- Partikel sind in einem Points-Objekt mit Atlas. Additiv und normal gemischt laufen über vormultipliertes Alpha im selben Draw Call. Halos und Strahlen sind dauerhafte Punkte in diesem Batch, keine Sprites.
- Partikel werden in Waffen-Koordinaten simuliert und mit der Waffenlage beim Entstehen gezeichnet. Sie bleiben also in der Welt stehen.
- Bloom: Der Composer existiert (`render.ts`, Schwelle 1,5), darum bleiben die HDR-Farben des Viewers erhalten.
- Rate im Ruhezustand 50 % (`FX_IDLE`), bei Cast und Kanal 100 %. Gemessen an der Glutrute: im Mittel 32 gegen 64 lebende Partikel.
- `// PH`: `LIT_GAIN` 1,9, `POINT_SCALE` 1,5, Griffhöhen, Neigungen und Armhaltung.

## Messwerte (Level 1, 1600×900, Radeon Vega Renoir, ohne VSync)
Gleiche eingefrorene Szene, Waffe umgeschaltet (43 Mobs, drei Durchläufe):

| Variante | Calls im Frame | FPS |
|---|---|---|
| ohne Waffe | 209 | 259–270 |
| Schlachtblech (billigste) | 211 | 265–284 |
| Glutrute (teuerste) | 212 | 277–282 |
| Glutrute im Kanal | 212 | 249–269 |

Der Unterschied liegt im Messrauschen. Die Reihenfolge der Durchläufe verzerrt die FPS, ein Kosten-Nachweis ist das nicht.

Spielermodell (sichtbare Objekte / Dreiecke):

| | Objekte | Dreiecke |
|---|---|---|
| vorher, alter Stab | 63 | 12.158 |
| nachher, Schlachtblech | 59 + 1 Points | 11.934 |
| nachher, Glutrute | 60 + 1 Points | 12.170 |

Calls über ganze Frames sind zwischen zwei Seitenladungen nicht vergleichbar: Die Mobs stehen jedes Mal anders, das ergab 149–292 Calls schon auf `main`.

Waffen: 192–532 Dreiecke, 2–3 Draw Calls. Dazu kommen beim Zucken bis zu 6 Lines (Knöchelzweig, Zirkelstab), bei der Totenglocke 1 Klangring-Mesh für 1,4 s. 30 Wechsel: Geometrien stabil (133 → 133). Texturen wachsen nur um die gecachten Atlanten, höchstens einen pro Texturkombination.

## Prüfungen
- Clipping: dichte Samples der Waffe gegen Kapseln für Rumpf, Kopf, linken Arm und Beine, in Idle, Gehen, Rennen, Rückwärts, Cast und Kanal. Alle 15 haben 0 Treffer, auch Erntemond, Lampenhaken, Totenglocke und Kammerschlüssel. Darum ist `yaw` überall 0. Gegenprobe mit falscher Neigung: Der Test meldet Treffer. Der rechte Arm, Sitzen und Tod sind nicht im Test, die beiden Zustände nur per Standbild angesehen.
- Stabfuß über dem Boden: −0,04 bis +0,12 m. Hanglagen sind nicht geprüft, dort kann der Fuß einsinken.
- Welt-Koordinaten: Figur um 5 m versetzt, die 23 geprüften Partikel haben sich in dem Schritt nicht verschoben.

## Offen
- Keine Loot- oder Ausrüstungslogik vorhanden, nur die Dev-Auswahl. Die Texte (`story`, `read`, `wear`, `fx`, `arch`, `school`) liegen in `WEAPONS`, die UI fehlt.
- Budget Körper: Das Modell liegt schon ohne Waffe über den 10.000 Dreiecken und 6 Draw Calls (58 Objekte, rund 11.640 Dreiecke). Das ist älter als dieser Branch und hier nicht angefasst.
- `ambientParticles` und `crystalBurst` (`fx/spellFx.ts`, Grün) sprühen immer frostblaue Partikel am Leuchtpunkt. Das überdeckt die feineren Waffeneffekte und passt nicht zu Feuer oder zum Schlachtblech ohne Magie. Besser wäre eine Farbe pro Waffe und weniger Rate.
- `fx/spellFx.ts:300` hat den veralteten Kommentar „Stab auf dem Rücken“ (Datei von Grün).
- Merge-Konflikte: `gruen-vfx` ändert `mage.ts` nicht. `docs/handoff.md` kann kollidieren.
