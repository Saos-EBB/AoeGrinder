# Namen neu + i18n (DE/EN) – 07.11.2026

Kevins Namensliste, Grundlage für `src/i18n/de.ts` und `src/i18n/en.ts`. Ton: düster/gotisch, Bosse mit Augenzwinkern.
Nicht in dieser Runde: Spiel-Name „Frost Grind“, Zonen. Im Code stehen Namen nur noch in den Wörterbüchern; Beschreibungen verweisen mit `@{key}` auf sie, Umbenennen heißt also: eine Zeile pro Sprache ändern.

## Figuren & Skins
| Alt | DE | EN |
|---|---|---|
| Strichmagier Basis (Fedora, pinker Pelz, Goldkette) | Der Pelzbaron | The Fur Baron |
| Feuermagier | Der Glutnarr | The Emberjester |
| Frostmagier | Der Bibbernde | The Shiverer |
| Arkanmagier | Der Sternmönch | The Starmonk |
| Blitzmagier | Der Sturmprediger | The Stormpreacher |
| Seuchenmagier | Moderschlund | Rotmaw |
| ?-Magier / Kapuzenmagier | Der Leere | The Hollow |
| Strichkrieger | Kohlenhüne | Charbrute |
| Klingenstrich | Tuschklinge | Inkblade |
| Verdorbener X | Falscher X | False X |

## Allgemein
| Alt | DE | EN |
|---|---|---|
| Staub | Knochenstaub | Bonedust |
| Magische Kiste | Gruftkiste | Crypt Chest |
| Blink | Huschen | Flit |
| Perfekter Dodge | Haaresbreite | Hairbreadth |
| Kill-Anzeige | Seelenhunger | Soul Hunger |
| Karte Macht / Zähigkeit / Weisheit | Verderben / Knochenmark / Grabwissen | Ruin / Marrow / Gravelore |
| Champion | Verfluchter | Accursed |
| Affixe Schnell / Stark / Feuer-verzaubert / Kälte-verzaubert / Steinhaut | Gehetzt / Grausam / Glutgeweiht / Reifgeweiht / Versteinert | Hounded / Cruel / Emberbound / Rimebound / Petrified |

## Spells, Runen, Talente, Relikte, Waffen, Bosse
Die vollständigen Tabellen pro Figur (Glutnarr, Bibbernde, Sternmönch, Sturmprediger, Moderschlund, Kohlenhüne, Tuschklinge), legendäre Waffen und Bosse stehen 1:1 als Einträge in den Wörterbüchern, Schlüssel `spell.<id>.name`, `spell.<id>.runes.<rune>.name`, `card.<id>.name`, `legend.<id>.name`, `boss.<id>.name`. Die Zuordnung Alt → Schlüssel steht im Commit „feat(i18n): neue Namen“.
