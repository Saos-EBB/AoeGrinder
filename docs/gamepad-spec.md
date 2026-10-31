# Frost Grind – Controller-Steuerung

Stand 2026-10-31. Quelle für Button-Indizes, Achsenrichtung und Vibration: W3C Gamepad.

## Ziel und Grundsätze
Das Gamepad steuert das Spiel vollständig, ohne Maus, und fühlt sich an wie WoW: links laufen, rechts Kamera, Zauber auf den Tasten. Es ersetzt die Tastatur nicht, beide funktionieren gleichzeitig.

- **Laufen relativ zur Kamera:** Der linke Stick bewegt den Charakter in Kamerarichtung, wie WoW mit gedrückter rechter Maustaste. Der Charakter dreht sich dabei mit.
- **Analog:** Gehen 2,5 yd/s unter 0,5 Ausschlag, Laufen 7 yd/s darüber, rückwärts 4,5 yd/s (baseMoveSpeed in VMaNGOS).
- **Blickrichtung zählt:** Cone of Cold und Blink gehen in Blickrichtung des Charakters.
- **Keine Addition:** Tastatur und Stick ergeben zusammen einen Vektor der Länge höchstens 1. W plus Stick vorne ist nicht schneller.

## Belegung
Symbole sind PlayStation, ohne automatisches Umschalten. Index = Button im Standard-Mapping.

| Taste | Index | Aktion |
|---|---|---|
| Linker Stick | Achsen 0, 1 | Laufen, Gehen bei halbem Ausschlag |
| Rechter Stick | Achsen 2, 3 | Kamera drehen und neigen |
| Kreuz | 0 | Springen |
| Kreis | 1 | Cone of Cold; im Zielmodus: abbrechen |
| Quadrat | 2 | Arcane Explosion |
| Dreieck | 3 | Frost Nova |
| L1 | 4 | Blink |
| R1 | 5 | Blizzard: halten zum Zielen, loslassen zum Zaubern |
| L2 | 6 | Modifier für eine zweite Ebene (später) |
| R2 | 7 | frei |
| Share | 8 | Hilfe ein/aus |
| Options | 9 | Pause und Tastenbelegung |
| L3 | 10 | Autorun an/aus |
| R3 | 11 | Kamera hinter den Charakter setzen |
| Steuerkreuz oben / unten | 12, 13 | Zoom rein / raus |
| Steuerkreuz links | 14 | Trinken |
| Steuerkreuz rechts | 15 | frei |

Der Home-Button (16) bleibt frei, weil Betriebssystem und Steam ihn oft abfangen.

## Blizzard zielen
1. R1 drücken: Der Zielkreis erscheint 12 yd vor dem Charakter.
2. Solange R1 gehalten ist, verschiebt der rechte Stick den Zielkreis statt der Kamera (25 yd/s bei vollem Ausschlag). Der linke Stick läuft weiter.
3. R1 loslassen: Blizzard wird gezaubert. Über 30 yd ist der Kreis rot und es kommt „Außer Reichweite“.
4. Kreis während R1 gehalten: abbrechen.

Kein Schnellzauber: R1 kurz antippen zaubert 12 yd vor dem Charakter. Die Maus-Variante bleibt unverändert.

## Kamera
- Rechter Stick im Stand: Kamera kreist um den Charakter, er bleibt stehen.
- Sobald der linke Stick bewegt wird, dreht sich der Charakter in Kamerarichtung.
- 2,5 rad/s Drehung und 1,5 rad/s Neigung bei vollem Ausschlag, beides in `config.ts`.

## Menüs
- Start und Tod: Kreuz bestätigt.
- Level-Karten: Steuerkreuz oder linker Stick wählt, Kreuz nimmt die Karte.
- Tastenbelegung: Steuerkreuz wählt die Zeile, Kreuz startet das Neubelegen, die nächste Pad-Taste wird gespeichert, Kreis geht zurück.

## Vibration
Kurzer Rumble bei Crits und bei Treffern über 5 % Leben, nur wenn der Browser `dual-rumble` meldet.

## Technik
- `navigator.getGamepads()` pro Frame, erstes Pad mit `mapping === "standard"`. Ein Pad ohne Standard-Mapping bekommt einen Hinweis statt Steuerung.
- Flanken: Ein Druck löst genau einmal aus.
- Deadzone: radial 0,15 auf beiden Sticks, danach auf 0–1 neu skaliert.
- Nach oben gedrückt ist negativ, vorwärts ist also `-axes[1]`.
- Pad-Belegung in localStorage unter `frostgrind.padbinds.v1`, Tastatur-Belegungen bleiben erhalten.
- Actionbar zeigt Pad-Symbole, sobald die letzte Eingabe vom Pad kam, und Tastaturnamen, sobald wieder eine Taste gedrückt wird.
- Beim Ausstecken stoppt der Charakter, Autorun geht aus.
