# Map-Umbau Teil 2: Reise, Weltkarte, Objekte (08.11.2026)

Quelle: Project-Doc `claude/handoff-map-umbau.md`, Teil 2. Teil 1 steht in `map-umbau.md`.

Du arbeitest an Frost Grind (AoeGrinder), Repo ~/dev/frost-grind, Branch maps-gen (Teil 1 ist drin).
Lies AGENTS.md, docs/overview.md, docs/handoff.md und den Bericht von Teil 1.
Regeln wie Teil 1 (Commit pro Phase, // PH, keine npm-Pakete, FPS-Grenze 10 %, nicht pushen).

## Phase 1: Portale im Run
- Bei Lvl 25 / 50 / 75 (PH) erscheint auf einem portalSpot ein Portal (Landmarke leuchtet, Minimap-Symbol).
- Betreten = gleiches Theme, neuer Seed, Mob-Kategorien und Skins neu gewürfelt; Level, Karten, Ausrüstung bleiben. Kurzer Übergang (Blende), kein Ladebildschirm.
- Portal muss man nicht nehmen: XP pro Kill sinkt nach 2 min ohne Portal um 25 % PH (damit man weiter will). Wenn sich das schlecht anfühlt, weglassen und melden.
- Wellen-Modus: Portal kommt nach dem Boss statt bei Leveln.
Commit.

## Phase 2: Weltkarte im Hauptmenü
- Eine gemalte Karte (2D, SVG/Canvas) mit den 5 Themes als Orte, Linien dazwischen (Wald → Wüste → Kanäle → Kathedrale → Hölle), Arena separat.
- Ort = Name, Schwierigkeit (1–5 Totenköpfe), Bestzeit, gesperrt/offen.
- Freischalten: nächstes Theme nach Lvl 100 im vorherigen (PH). Dev: alles offen.
- Ersetzt den Map-Wechsler ◀ ▶ aus handoff-ui-mix Phase 7, falls der schon gebaut ist (sonst Hinweis im Bericht). Hintergrund des Hauptmenüs = gewähltes Theme.
- Rangliste getrennt pro Theme.
Commit.

## Phase 3: Objekt-System (src/objects/)
- objects.ts: Liste pro Map, gesetzt auf objectSpots. Ein Objekt = { id, mesh (InstancedMesh pro Art), radius, onHit?, onUse?, onTouch? }.
  Benutzen = Taste F / Pad-Taste (vorher auf Konflikte prüfen). Pro Map PH: 3 Schreine, 4 Truhen, 8 Fässer, 1 Schatzdieb-Chance 30 %.
- Schreine (wie Diablo 2, 30 s, Leuchten in eigener Farbe, Buff-Symbol im HUD): Erfahrung ×2, Schaden +50 %, Mana-Regen ×3, Abklingzeit −30 %, Monster-Schrein (ruft ein Champion-Pack, champions.ts).
- Truhen: öffnen 1 s (Treffer bricht ab), Drop auf den Boden. 10 % Mimic (wird zum Mob, droppt doppelt).
- Drops auf dem Boden: Staub-Haufen und Waffen (weaponRolls.ts, Seltenheit nach Theme-Schwierigkeit), Lichtsäule in Seltenheitsfarbe, Aufheben per Lauf-Radius 2 yd (Staub) bzw. Taste (Waffe, Inventar max 15 wie heute).
  Mobs droppen selten Staub (PH 2 %), Champions und Große sicher (Große: Staub + 25 % Waffe).
- Explosiv-Fässer: reagieren auf das Element des Treffers: Feuer = Explosion + Brand, Frost = Eis-Nova (Slow), Blitz = Kette auf 5 Ziele, Seuche = Giftwolke 5 s, Nahkampf = Explosion + Rückstoß.
  Fässer lösen Fässer in Reichweite aus (Kettenreaktion). Treffen auch den Spieler (halber Schaden).
- Schatzdieb (wie D3-Goblin): flieht, öffnet nach 15 s ein Portal und ist weg; tot = großer Staub-Haufen + 1 Waffe.
Commit.

## Phase 4: Theme-Objekte (je 1, nutzen das System aus Phase 3)
- Kanäle: Schleuse (Hebel) flutet einen Gang 10 s → Mobs darin verlangsamt + nass (Blitz-Schaden +50 %).
- Hölle: Lava-Rinne mit Hebel (Mobs darin brennen).
- Kathedrale: Glocke (läuten = alle Mobs in 60 yd greifen an), Kronleuchter (abschießen = fällt, Schaden + Feuer).
- Wüste: Sandfalle (Grube zieht Mobs rein).
- Wald: Bienenstock (abschießen = Schwarm, schadet Mobs).
Commit.

## Test
Jedes Objekt per Dev-Knopf spawnen + auslösen, Kettenreaktion 8 Fässer, Mimic, Schatzdieb entkommt + stirbt, Portal 3× bis Lvl 100,
Weltkarte freischalten/gesperrt, Reload behält Freischaltung, Großer droppt sicher. FPS mit allen Objekten.
Bericht wie Teil 1. npx vite starten, URL geben, warten.
