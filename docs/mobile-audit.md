# Mobile-Audit: Steuerung und Performance

Stand 2026-11-06, Branch `mobile`, Basis `918326a`. Nur Befund, noch nichts umgebaut.

**Gemessen:** Playwright mit Chromium, Gerät „Pixel 7 landscape“ (863 × 360 CSS-px, DPR 2,6, Touch), `?mobile=1`, Run gestartet, Zone Start, 86 Mobs, Level 1. Ein echtes Handy ist das nicht: Die GPU ist die des PCs, die CPU wird nur mit CDP gedrosselt. Die Zahlen zeigen die Größenordnung und wo es hakt, nicht die echten FPS.

## Kurz

- Für Handys werden keine eigenen Grafikeinstellungen gesetzt. Alles aus `PERF` (`src/config.ts`) gilt so wie am Desktop: Pixel-Ratio 2, Bloom, Antialias, 5000 Partikel, VFX „mittel“, gleich viele Mobs. Die einzige Ausnahme ist der Lampenschatten in `dunkel.ts`.
- Der Engpass ist die **CPU**. Mit 4-fach gedrosselter CPU fällt das Spiel schon bei Level 1 auf **31 FPS mit 50 ms p95**. Draw Calls sind mit 46 gering.
- Bei der Steuerung fehlen **Ausweichen** und das **Boss-Lock**. Beides ist für Bosskämpfe nötig, und es gibt dafür keine Touch-Taste.
- Mehrere Elemente am Bildschirmrand überlappen sich (siehe unten).

## Messwerte

| Lauf | FPS | p95 Frame | Draw Calls | Dreiecke | Canvas | Heap |
|---|---|---|---|---|---|---|
| Mobil, CPU normal | 59 | 17 ms | 46 | 425 k | 1726 × 720 (PR 2) | 64 MB |
| Mobil, CPU ÷ 4 | **31** | **50 ms** | 46 | 425 k | 1726 × 720 | 67 MB |

- Mobs: 86, genauso viele wie am Desktop.
- Bundle: eine einzige `index.html` mit 1,78 MB, gzip 633 kB. Gespielt wird erst, wenn alles geladen ist.
- Fehler auf der Seite: keine.
- Linker Stick: In 1,2 s läuft die Figur 12 yd, `pad.move` ist `{0, 1}`. Das funktioniert.

## Performance: Befunde

| # | Befund | Wo | Wirkung |
|---|---|---|---|
| P1 | Kein Mobile-Profil: Pixel-Ratio bis 2, Bloom, VFX „mittel“, 5000 Partikel. Das gilt alles auch auf dem Handy | `src/config.ts` `PERF`, `src/render.ts` | hoch: Füllrate und CPU |
| P2 | Mobs und Packs wie am Desktop (86 bei Level 1, später deutlich mehr). Animation, KI und Kollision kosten CPU pro Mob | `src/mobs.ts` `mobTarget` | hoch, weil die CPU der Engpass ist |
| P3 | `antialias: true`, obwohl alles über den Composer läuft. Der RenderPass zeichnet in ein Render Target ohne MSAA, damit kostet das MSAA im Canvas nur Speicher und Bandbreite | `src/render.ts:10` | mittel |
| P4 | Composer-Puffer sind HalfFloat mit Tiefentextur, in voller Auflösung bei PR 2. Bloom hängt mehrere Passes daran | `src/render.ts` | mittel, vor allem bei schwachen GPUs |
| P5 | Dreiecke 425 k schon bei Level 1. Die Mob-Sichtgrenze `mobHideYd` 62 und der Schatten sind auf den Desktop ausgelegt | `PERF.mobHideYd`, Zone-Props | mittel |
| P6 | Ein Bundle mit 1,8 MB, alles in einer Datei. Kein Laden in Teilen | `vite` Single-File-Build | niedrig: einmalig beim Start |

**Vorschlag:** In `boot.ts` gleich nach `device.mobile = true` ein Mobile-Profil auf `PERF` legen, bevor `main` lädt:

- `maxPixelRatio` auf 1,25–1,5
- `bloom` aus oder Bloom mit halber Auflösung
- `vfx` auf „niedrig“
- `maxParticles` auf 2000
- `mobHideYd` auf 45
- `antialias` aus

Mobs: Einen Faktor auf `mobTarget` setzen, z. B. 0,6. Den sollte man aber erst auf einem echten Gerät abwägen, weil er das Spielgefühl ändert. Danach auf einem echten Gerät messen (Dev-Panel FPS oder `?perf`).

## Steuerung: Befunde

| # | Befund | Wo | Wirkung |
|---|---|---|---|
| S1 | **Keine Taste zum Ausweichen.** `dodge` liegt am Pad auf L2, Touch bietet nur die 8 Zauber-Slots. Bosse, perfekte Dodges und Dodge-Statistik sind auf dem Handy nicht spielbar | `src/mobile.ts` `build`, `src/gamepad.ts:30` | **hoch** |
| S2 | **Boss-Lock:** Der rechte Stick löst das Lock (`padBreak`). Neu anlegen geht nur mit Tab oder R3, Touch hat beides nicht. Nach dem ersten Umsehen bleibt der Kampf ohne Lock | `src/boss.ts:111`, `:518` | **hoch** im Bosskampf |
| S3 | Springen geht nur durch kurzes Tippen auf den rechten Stick (220 ms, 12 px). Das ist kaum zu entdecken und kollidiert mit Zielen und Umsehen | `src/mobile.ts:19` | mittel |
| S4 | Der Menü-Knopf ☰ (`#tMenu`, oben rechts) liegt über der Minimap | `index.html:182` | mittel: Fehlgriffe, Karte verdeckt |
| S5 | Die Combo- und Multi-Kill-Anzeige liegt über dem unteren rechten Slot | HUD-Layout Mobile (`src/ui/hud/layout.ts`, `MOBILE`) | mittel |
| S6 | Das Banner „Handy-Steuerung noch buggy“ verdeckt den Timer oben in der Mitte, bis man es wegtippt | `src/mobile.ts` `banner` | niedrig |
| S7 | Die normale Aktionsleiste unten bleibt sichtbar. Sie ist doppelt zu den Touch-Slots und am Handy sehr klein | `body.mobile` CSS | niedrig: Platz |
| S8 | Bei „Mobs in der Nähe“ links oben überlappen Text und Buff-Punkte | HUD links | niedrig |
| S9 | Kein Abstand für Notch und Rundung: `viewport-fit=cover` ist gesetzt, `env(safe-area-inset-*)` wird nirgends benutzt. Sticks, Slots und ☰ liegen nur 8–12 px vom Rand entfernt | `index.html` | mittel bei iPhones mit Notch |
| S10 | Slots haben 58 px, die Abstände 8 px. Das ist knapp über der Mindestgröße. Leere Slots (3 von 8 beim Start) brauchen trotzdem Platz | `index.html:176` | niedrig |
| S11 | Die Touch-Tasten geben kein Haptik-Feedback (`navigator.vibrate`) | `src/mobile.ts` | niedrig, Feinschliff |

**Vorschlag Steuerung:**
1. Eigene Taste zum Ausweichen, groß, rechts unten neben dem rechten Stick. Daneben eine kleine Taste zum Springen (S1, S3).
2. Taste für das Boss-Lock, nur sichtbar im Bosskampf, z. B. oben rechts beim Boss-Balken (S2).
3. `#tMenu` unter die Minimap oder nach oben links. Die Combo-Anzeige im Mobile-Layout nach oben verschieben (S4, S5).
4. Safe-Area-Abstände auf `#touchLayer`, `#tMenu` und den HUD-Rand (S9).
5. Aktionsleiste auf dem Handy ausblenden, das Banner nach dem ersten Wegtippen nicht mehr zeigen und das in `localStorage` merken (S6, S7).

## Offen

- Auf einem echten Handy messen, Android und iPhone. Die Emulation sagt wenig über die GPU und über Wärme-Drosselung.
- Späte Level mit vielen Mobs und Effekten sind nicht gemessen, gemessen ist nur der Start mit 86 Mobs auf Level 1.
