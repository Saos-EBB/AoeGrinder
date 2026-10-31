# Zonen und Mobs

Aufgabe: 4 Zonen mit je 5 Mobs einbauen + Dev-Zonenwechsel im Esc-Menü.

## Rahmen
- Gleiche Machart wie jetzt: Low-Poly-Rigs aus Three-Primitiven, prozedurale Animation,
  Schnittstelle { root, update(dt, anim) } wie buildBoar(). Keine externen Modelle.
- Zonen datengetrieben: src/zones.ts mit ZONES = { tirisfal, brd, stv, tanaris }.
  Pro Zone: Himmel/Nebel/Licht, Gelände-Farben + heightAt-Variante, Props, Mob-Liste, optional Event.
- Mobs datengetrieben: src/mobTypes.ts. Pro Typ: name, model-Builder, ability (oder null).
  Fähigkeiten als kleine Funktionen in src/abilities.ts, Hook-Punkte: onCombatStart, onUpdate,
  onHit (Mob trifft Spieler), onDamaged, onDeath. Nur die Hooks bauen, die gebraucht werden.
- Alle Werte unten sind Design-Werte → im Code mit // PH markieren.
- Dev-Buttons im Esc-Menü (Bereich "Dev"): Zone wechseln (4 Buttons). Wechsel = Mobs weg,
  Welt neu aufbauen, Spieler in die Mitte, Level und Karten bleiben.
- Kartengröße, Spielerwerte, Spells, Formeln bleiben wie sie sind.

## Commits (je einer, nach jedem muss npm run dev laufen)
1. zones.ts + mobTypes.ts + Zonenwechsel; aktuelle Welt = Zone "tirisfal" als Platzhalter
2. Fähigkeiten-Hooks in mobs.ts
3.–6. je eine Zone komplett (Optik + 5 Mobs + Modelle): Tirisfal, Schlingendorntal, Tanaris, BRD
7. docs/handoff.md Stand ergänzen, Build ins Artifact publishen

## Zone 1: Tirisfal – "Die Felder von Agamand"
Optik: Himmel grau-grün, keine Sonnenscheibe, flaches kaltes Licht, grüner Nebel ab ~30 yd.
Olivgrünes ausgeblichenes Gras, graubraune Wege, kahle verdrehte Bäume statt Nadelbäumen,
schiefe Zäune, Kürbisfelder. Mitte: zerfallene Windmühle. Rand: Friedhof, trüber See, Wachturm.
Viele kleine Packs.

| Mob | Fähigkeit |
|---|---|
| Klapperskelett | keine (Start-Mob) |
| Verfluchter Dunkelhund | Sprungbiss aus 8 yd: Schaden + Rückstoß, bricht Trinken |
| Knochenwirker | bleibt auf 20 yd, Schattenblitze, läuft nie ins Pack |
| Vampir-Fledermaus | schwebt, immun gegen Root (Slows wirken), jeder Biss heilt sie |
| Scharlachroter Wächter | ruft bei Kampfbeginn alle Mobs in 20 yd (statt 10) |

## Zone 2: Blackrock Depths – "Die Schwarze Schmiede"
Optik: unterirdisch, schwarzer Himmel/Decke, Licht fast nur von unten. Schwarzer Basalt,
Lavaflüsse (HDR-orange → Bloom, Schadenszone), Steinbrücken, enge Korridore, Schmiede mit
Ambossen in der Mitte, dunkelroter Nebel. Gemischte Packs (Soldaten + Sanitäter).

| Mob | Fähigkeit |
|---|---|
| Shadowforge-Bauer | keine (Start-Mob) |
| Anvilrage-Sanitäter | heilt das verletzteste Pack-Mitglied, flieht bei 15 % |
| Anvilrage-Offizier | Gottesschild bei 30 %: 6 s immun |
| Feuerwache | Hitzeaura: Frost Nova hält nur 2 s, Frostschaden halbiert |
| Zwielicht-Abgesandter | alle 8 s Lavafläche unter dem Spieler (Schaden pro s) |

## Zone 3: Schlingendorntal – "Ruinen von Zul'Kunda"
Optik: hohe helle Sonne, warm-gelbes Licht, feuchter Dunst ab ~40 yd. Satte Grüntöne,
großblättrige Pflanzen, Lianen, Troll-Zikkurat auf einer Lichtung in der Mitte, Fluss quer,
schmaler Strand an einer Seite. Dichter Dschungel = viele Hindernisse, Pullen über Pfade.

| Mob | Fähigkeit |
|---|---|
| Junger Schlingendornraptor | keine (Start-Mob) |
| Peitschenschwanz-Raptor | +15 % Tempo pro totem Mitglied seines Packs |
| Bloodscalp-Axtwerfer | wirft aus 25 yd, weicht zurück wenn Spieler < 10 yd |
| Kurzen-Medizinmann | Fluch: Spieler 30 % langsamer für 10 s |
| Schattenpanther | getarnt, erst ab 6 yd sichtbar, dann Ansprung |

## Zone 4: Tanaris – "Die Noonshade-Dünen"
Optik: weiße Mittagssonne, tiefblauer Himmel, flirrender heller Dunst, Sand- und Ockertöne,
lange sanfte Dünen, Felsen, Knochen, Kakteen, kaum Hindernisse. Mitte: Trollruinen mit
Brunnenturm. Süden: Silithid-Schlund (Loch im Boden).
Event Sandsturm: alle paar Minuten Sicht 20 yd, Nameplates nur bis 20 yd.

| Mob | Fähigkeit |
|---|---|
| Wüstenhyäne | keine (Start-Mob) |
| Wastewander-Dieb | jeder Treffer stiehlt 5 % max. Mana |
| Dunemaul-Rohling | Stampfer im Nahkampf: 3 s Betäubung, bricht Blizzard; Blink löst |
| Silithid-Schwärmer | ruft bei Kampfbeginn 4 Schwärmlinge (wenig HP, harter Schaden) |
| Sandskorpid | Gift stapelt bis 5×, tickt weiter (auch beim Trinken) |

## Pack-Regel für alle Zonen
Start-Mob ca. 50 % der Spawns, die 4 Spezial-Mobs teilen sich den Rest. Packs gemischt.
