# Asset-Audit

Gesichtet: alle 25 Dateien aus `~/Assets cc0/aoeGrinder`, entpackt nach `~/dev/frost-grind-assets/raw/`. Nichts ausgeführt, nichts ins Spiel eingebaut. Kein Archiv enthält Programme oder Skripte.

**Blender ist nicht installiert.** Es gab deshalb keine Konvertierung von FBX, OBJ, STL und Blend. Kennzahlen dort stammen aus den Dateien selbst, `.mdx` aus einem kleinen Parser, `.blend` blieb ungeöffnet. `gltf-transform inspect` lief nur auf den KayKit-glTFs.

**Stil:** Nur KayKit konnte ich als Render beurteilen, dazu die Texturen von Maid, Ritual und Skelett. Alle anderen Stilwerte kommen aus Kennzahlen und Beschreibung und sind Schätzungen (Spalte mit „~“).

**Lizenz:** „ok“ heißt, das Archiv nennt ausdrücklich CC0. „unklar“ heißt, es fehlt ein Lizenztext oder die Rechte hängen an Dritten.

## Modelle
| Datei | Lizenz | Format | Dreiecke | Texturen | Skelett/Anims | MB vorher → nachher | Stil 1–5 | Verwendung | Urteil |
|---|---|---|---:|---|---|---|---|---|---|
| KayKit `Skeleton_Minion` | ok, CC0 | glb | 5288 | 1024 PNG → 512 WebP, 1 Atlas | ja, 23 Knochen; Anims getrennt | 0,31 → 0,10 | 3 | Mob Tirisfal: Klapperskelett | optimieren |
| KayKit `Skeleton_Mage` | ok, CC0 | glb | 4588 | wie oben | ja, 23 | 0,26 → 0,09 | 3 | Mob Tirisfal: Knochenwirker; Spieler möglich | optimieren |
| KayKit `Skeleton_Warrior` | ok, CC0 | glb | 5934 | wie oben | ja, 23 | 0,36 → 0,12 | 3 | Reserve: Elite-Variante Tirisfal | optimieren |
| KayKit `Skeleton_Rogue` | ok, CC0 | glb | 5278 | wie oben | ja, 23 | 0,32 → 0,11 | 3 | Reserve: Variante Tirisfal | optimieren |
| KayKit `Rig_Medium_General` | ok, CC0 | glb | Vorschau-Meshes | – | 15 Anims | 0,81 → 0,33 | – | Tod, Treffer, Idle, Spawn, Throw | optimieren |
| KayKit `Rig_Medium_MovementBasic` | ok, CC0 | glb | Vorschau-Meshes | – | 11 Anims | 0,67 → 0,27 | – | Laufen, Gehen, Springen | optimieren |
| KayKit Waffen (13 Stück) | ok, CC0 | gltf | 40–1519 | geteilter Atlas | nein | zusammen → 0,33 | 3 | Stab, Axt, Klinge, Schilde für die Skelette | optimieren |
| `Mor'Ladim.mdx` (3 Varianten) | unklar: „commercial use not allowed“, Design Blizzard | MDX | 974–1192 | BLP | ja, 19–22 Anims | 1,1 → – | ~5 | wäre Klapperskelett | raus |
| `BrotherKorloff.mdx` | unklar: Autor nennt Blizzard | MDX | 7406 | BLP | ja, 41 Anims | 3,5 → – | ~4 | – | raus |
| `CommanderDurand.mdx` | unklar: Autor nennt Blizzard | MDX | 8808 | BLP | ja, 45 Anims | 4,2 → – | ~4 | – | raus |
| `DoomRel.mdx` | unklar: Autor nennt Blizzard | MDX | 8064 | BLP | ja, 48 Anims | 4,2 → – | ~4 | wäre Zwerg in BRD | raus |
| `ForsakenPaladin.mdx` (+ `nailong`, 2 Auren) | unklar: Umbau, Rechte beim Original-Autor | MDX | 16462 / 9984 / 12 | BLP | ja, 8 Anims | 7,3 → – | ~3 | – | raus |
| `Annie` (4 Varianten) | unklar: Basis ist ein Blizzard-Modell | MDX | 19781–21241 | DDS 2048+ mit ORM | ja, 4–31 Anims | 75 → – | ~2 | – | raus |
| `Ny'alotha Allseer.mdx` | unklar: Teile aus WoW | MDX | 3178 | fehlen im Archiv | ja, 4 Anims | 0,4 → – | ~4 | – | raus |
| `Wizard-Finished.blend` | unklar: kein Lizenztext | Blend (2.92) | nicht lesbar ohne Blender | unbekannt | unbekannt | 1,8 → – | ? | wäre Spieler | raus, bis Lizenz und Blender da sind |
| `dark+elf.obj` | unklar: kein Lizenztext | OBJ | 20419 | keine | nein | 3,3 → – | ~2 | – | raus |
| `human_skeleton.obj` | unklar: kein Lizenztext | OBJ | 75381 | 2048 JPG, PBR | nein | 8,8 → – | 1 | – | raus |
| `Witch.stl` | unklar: kein Lizenztext | STL (Druck) | 361410 | keine, keine UVs | nein | 18 → – | ~1 | – | raus |
| `RITUAL+WOMEN+50k` | unklar: kein Lizenztext, wirkt KI-generiert | OBJ | 49952 | 4096 PNG, PBR mit Normal | nein | 31 → – | 1 | – | raus |
| `RITUAL+WOMEN+500k` | wie oben | OBJ | 498326 | 4096 PNG, PBR mit Normal | nein | 63 → – | 1 | – | raus |
| `Female+Maid+Facesless` | wie oben | OBJ | 500000 | 4096 PNG, PBR mit Normal | nein | 55 → – | 1 | – | raus |

## Keine Modelle
| Datei | Inhalt | Lizenz | Urteil |
|---|---|---|---|
| `BattleMageBetter`, `HighElfMage.blp` | Skins für Warcraft-III-Modelle, ohne Mesh nutzlos | unklar | raus |
| `Mage of the Damned` | Skin | nein: „do not distribute or modify“ | raus |
| `Sally Whitemane` | Skin (Whitemane-Figur) | unklar | raus |
| `Maghar Mage` | Skin, 2 Icons | unklar | raus |
| `Flame Spells`, `FrostMissiles`, `BTNblockblack`, `SnowBall - FireBall`, `Hero Ability Icon Set 3` | Zauber-Icons (BLP, DDS) | unklar: nur „credit the author“ | raus; als Vorlage für die Actionbar nur mit Erlaubnis der Autoren |

Nachtrag 2026-11-02: Laut Kevin sind die Icon-Packs selbstgemachte CC0-Packs von Leuten, die Icons sind deshalb in `src/assets/icons/` eingebaut.

## Auffälligkeiten
- `23-animated_chainsaw__low-poly_version.zip` enthält keine Kettensäge, sondern das Pack **KayKit Skeletons 1.1**. Die Lizenz gilt für das Pack, der Dateiname passt nicht.
- Die Warcraft-Modelle tragen zum Teil „Blizzard Entertainment“ als Mit-Autor. Ohne Klärung gehören sie nicht in einen Build.
- Probe-Optimierung: Alle 26 Animationen sind danach noch drin, die Skelette auch (geprüft im glTF). Die Kopien liegen in `~/dev/frost-grind-assets/opt/kaykit-skeletons/`.

## KayKit gegen das Budget
| Punkt | Budget | Stand |
|---|---|---|
| Dreiecke Mob | ≤ 4000 | 4588–5934, zu hoch. Vereinfachung auf Faktor 0,7 brachte den Minion nur auf 4224, weil Fehlergrenze und Nähte bremsen |
| Textur | ≤ 512 | 512 WebP, ein Atlas |
| Draw Calls pro Mob | ≤ 3 | **9–10**, das Zusammenfassen in `gltf-transform` greift bei Skinning nicht. Bei 40 Mobs sind das 360–400 Calls, ähnlich wie die heutigen Rigs (8–15 Meshes) |
| Höhe | 1,9 | 2,17–2,63 inklusive Hut oder Helm, Skalierung etwa 0,75–0,9 nötig |

**Vor dem Einbau nötig:**
- Meshes pro Figur auf 2 Draw Calls zusammenführen (Körper und leuchtende Augen). Hut, Helm und Kapuze hängen ohne Skinning am Kopfknochen und müssen dafür gebunden werden. Das geht am einfachsten mit Blender.
- Die Vorschau-Meshes aus den beiden Anim-Dateien entfernen.
- **Es fehlt eine Angriffs-Animation.** Die Gratis-Anims enthalten nur `Throw`, `Use_Item` und `Interact`. Für Nahkampf reicht das behelfsweise, sonst braucht es das Pack „KayKit Character Animations“ (Link liegt im Archiv, nicht geprüft).

**Stil:** Niedrige Polygonzahl, kräftige Farben und keine Normal-Maps passen. Die Figuren sind aber Chibi mit großem Kopf, die Farben kommen aus einem Verlaufs-Atlas statt aus Handmalerei. Neben den heutigen schlanken Rigs fällt das auf, deshalb 3 von 5.

## Summe
„Rein“ und „optimieren“ nach Optimierung: **1,2 MB** von 40 MB (4 Figuren, 2 Anim-Dateien, 13 Waffen).

## Abdeckung
**Abgedeckt (2 von 21 Mobs):** Tirisfal Klapperskelett und Knochenwirker.

**Fehlen:**
- Tirisfal: Verfluchter Dunkelhund, Vampir-Fledermaus, Scharlachroter Wächter.
- Blackrock Depths: alle 5 (Shadowforge-Bauer, Anvilrage-Sanitäter, Anvilrage-Offizier, Feuerwache, Zwielicht-Abgesandter).
- Schlingendorntal: alle 5 (Junger Raptor, Peitschenschwanz-Raptor, Bloodscalp-Axtwerfer, Kurzen-Medizinmann, Schattenpanther).
- Tanaris: alle 5 (Wüstenhyäne, Wastewander-Dieb, Dunemaul-Rohling, Silithid-Schwärmer, Sandskorpid).
- Elvyn: Wildeber.
- Props: keine in der Sammlung, nur die Waffen passen dazu.
- Spieler: nur `Skeleton_Mage` als Notlösung im Chibi-Stil; `Wizard-Finished.blend` ist ungeprüft.

Gemischte Stile wären sichtbar. Sinnvoll ist eine Quelle für alle Mobs. KayKit und ähnliche CC0-Packs würde ich als Nächstes danach durchsuchen, das gehört aber nicht zu dieser Sichtung.

## Vorschlag: Build mit `index.html` + `assets/`
Bei 1,2 MB ginge Singlefile noch, weil Base64 nur etwa ein Drittel aufschlägt. Sobald mehrere Zonen Modelle bekommen, wird die eine HTML-Datei aber groß und muss bei jeder Änderung komplett neu laden. Das Artifact erlaubt 16 MB pro Seite, die Umstellung lohnt also vor dem ersten Mob-Pack.

**Nötig dafür (nichts davon getestet):**
1. `vite-plugin-singlefile` aus `vite.config.ts` und `package.json` entfernen, `base: './'` setzen, damit relative Pfade im Artifact funktionieren.
2. Optimierte Modelle nach `public/assets/models/` legen, die `handoff.md` schon vorsieht.
3. Loader: `GLTFLoader` mit `MeshoptDecoder` aus `three/addons/libs/meshopt_decoder.module.js`. WebP brauchen die Browser nicht extra.
4. Laden vor dem Start: Heute baut `main.ts` beim Import sofort die Welt. Es braucht einen Ladeschritt vor `resetGame()` mit Fortschritt im Startbildschirm.
5. Mobs klonen: `SkeletonUtils.clone` pro Mob und ein `AnimationMixer`. Die Schnittstelle `{ root, update(dt, anim) }` kann bleiben, damit `mobTypes.ts` nur den Builder tauscht. Die Materialien bleiben geteilt.
6. Publish: Das Artifact bekommt die Modelle über `files` als Nebendateien, einzeln bis 15 MB. `handoff.md` beschreibt bisher eine gebündelte HTML-Datei und muss angepasst werden.

Kosten beachten: 40 Mixer mit 23 Knochen laufen auf der CPU und sind neu gegenüber den heutigen Gelenk-Rigs. Das muss vor der Zusage gemessen werden.
