# Build-Log

## 2026-10-31 — refactor(camera): Orbit-Kamera, Kollision, Shake
**Was:** Kamera-Logik getrennt vom Render-Setup.
**Nicht gebaut:** keine Kamera-Klasse.

## 2026-10-31 — refactor(fx): Zaubereffekte auslagern
**Was:** Nova, AE, Blizzard, CoC, Blink, Decals und Dauer-Emitter an einem Ort.
**Nicht gebaut:** kein Effekt-Registry-System.

## 2026-10-31 — refactor(models): Eber auslagern
**Was:** Gleiche Schnittstelle wie der Mage.
**Nicht gebaut:** keine gemeinsame Basisklasse (nur zwei Rigs).

## 2026-10-31 — refactor(models): Skelett-Mage auslagern
**Was:** Rig mit der Schnittstelle root/update, die später ein glTF ersetzt.
**Nicht gebaut:** kein glTF-Loader, kommt mit den echten Modellen.

## 2026-10-31 — refactor(fx): Partikelsystem auslagern
**Was:** Ein Draw-Call; das Limit kommt aus PERF. glowTex liegt hier, weil auch der Kristall des Mage sie nutzt.
**Nicht gebaut:** kein Pooling, kein GPU-Update.

## 2026-10-31 — refactor(world): Terrain, Hindernisse, Kollision
**Was:** heightAt bleibt einzige Quelle für Bodenhöhe; terrainDecal und drape liegen hier, weil sie der Höhe folgen.
**Nicht gebaut:** kein Chunking, kein Spatial Grid für Kollision.

## 2026-10-31 — refactor(render): Renderer, Composer, Himmel, Licht
**Was:** Render-Setup unabhängig vom Spiel; die Schalter aus PERF greifen hier.
**Nicht gebaut:** keine Schatten, kein Bloom-Umbau.

## 2026-10-31 — refactor(formulas): Formeln mit Spec-Verweisen auslagern
**Was:** Aggro, Treffer, XP und Farben getrennt von der Welt, mit Verweis auf den Spec-Abschnitt.
**Nicht gebaut:** keine Tests für die Formeln, nicht beauftragt.

## 2026-10-31 — refactor(config): CFG, SPELLS, CARDS und Performance-Schalter
**Was:** Alle Zahlen an einem Ort; PERF schaltet Bloom, Partikel-Limit und Pixel-Ratio, Standardwerte entsprechen v4.
**Nicht gebaut:** keine Qualitätsstufen, kein Menü für die Schalter.

## 2026-10-31 — refactor(util): Helfer in util.ts auslagern
**Was:** rand, clamp, part, joint usw. brauchen fast alle Module. Modul steht nicht in der handoff-Liste, verhindert aber doppelte Helfer.
**Nicht gebaut:** keine Typ-Generics für die Helfer.

## 2026-10-31 — refactor(state): gemeinsamen Spielzustand in state.ts bündeln
**Was:** Module können fremde `let`-Variablen nicht zuweisen; now, paused, mobs usw. liegen deshalb in einem Objekt. Modul steht nicht in der handoff-Liste, ist aber für die Aufteilung nötig.
**Nicht gebaut:** keine Getter/Setter, kein Store, nur ein Objekt.

## 2026-10-31 — chore(repo): Vite + TypeScript, v4 unverändert in main.ts
**Was:** Gerüst mit Build zu einer einzelnen index.html; Spielcode unverändert aus Artifact v4, damit jeder Modul-Schritt danach prüfbar bleibt. handoff.md und mechanics-spec.md liegen jetzt in docs/.
**Nicht gebaut:** keine Linter-Konfiguration, keine Tests im Repo, kein public/assets (noch keine Assets).
