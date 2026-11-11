// Gear-Tabellen (ARCH-06): Slots, Zahlen, Set-Mechanik-Zahlen, Kosmetik-Liste, Shop-Boxen. Ohne Imports, damit Säubern (clean.ts) und Tests sie lesen können.
// Gear neben der Waffe (Handoff docs/handoffs/items.md): 5 Slots mit Werten, nur Magier. Der Strichkrieger bekommt nichts davon.
// Kein zweites Roll-System: Seltenheit (rollRarity), Werte (VALUE_KEY, ROLLS.values), Fokus (FOCUS_SPELLS), Element (ROLLS.elementChance) und der
// Treffer-Hook kommen aus weaponRolls.ts. Gear wirkt halb so stark wie die Waffe (GEAR.mul). Grundregel: nur erspielter Staub.
// Schichten je Teil (Gear-Baukasten v3, docs/ref/gear-baukasten.html): immer 1 Wert (→ Wertgruppe = Form am Modell), ab Blau mit focusShare ein Fokus (→ Emblem),
// immer ein Hersteller (→ Material, Trait halb so stark wie bei der Waffe), Element wie bei der Waffe, Seltenheit (→ Glühen, Extras).
// Gespeichert in meta: gear (Inventar je Slot), wear (angelegt je Slot), gearOver (Funde, die nicht mehr ins volle Inventar passten), nextGear (Zähler).
// Fehlt ein Feld (alter Stand), gilt der Standardwert; nichts crasht.

export const SLOTS = ['kopf', 'hals', 'ruecken', 'arme', 'koerper'] as const;
export type Slot = typeof SLOTS[number];
export interface GearItem { id: number; v: 1; slot: Slot; r: number; s: { value: string; focus?: string; element: string; maker: string; setId?: string } }

// Alle Zahlen PH
export const GEAR = {
  invMax: 25,          // je Slot-Art, wie die Waffen (ROLLS.invMax)
  mul: 0.5,            // halb so stark wie die Waffe (Kevin: erst testen, dann tunen)
  focusShare: 0.5,     // ab focusFrom: Anteil der Teile mit Fokus zusätzlich zum Wert
  focusFrom: 3,        // Fokus erst ab Blau
  makerMul: 0.5,       // Hersteller-Trait halb so stark wie bei der Waffe (ROLLS.maker)
  keepFrom: 3,         // ab Blau ins Inventar; Grau, Weiß und Grün werden Staub (Entscheidung: Kosmetik kommt aus Box und Meilensteinen, nicht aus Drops)
  baseNames: 3,        // Grundnamen je Slot (gear.base.<slot>.<n>)
  setChance: 0.15,     // Anteil der Set-Teile an den Drops ab Blau, nur für den gespielten Magier
};

// Set-Mechanik (Tabelle der Sets: sets.ts)
// Riesen-Feuerball (Glutprophet): jeder every-te Feuerball, size × Größe und Radius, dmg × Schaden
export const GIANT_FB = { every: 10, size: 3, dmg: 3 };
// Splitterkönig: Gletschernadel länger, am Endpunkt eine Frost Nova (spells/needle.ts)
export const SHARD_NEEDLE = { len: 1.5 };
// Hochspannung: jeder Sprung des Kettenblitzes gabelt sich mit fork in 2 Ketten; cap: höchstens so viele Sprünge pro Wurf, alle Äste zusammen (spells/chain.ts)
export const HV_FORK = { fork: 0.2, cap: 400 };

// Wertgruppe = Schaft-Gruppe des Werts (SHAFTS, wie rollWeapon) → Form am Modell (Gruppen des Viewers, models/gearParts.ts)
export const GROUP_OF_SHAFT = { gerade: 'off', gedreht: 'tempo', geknotet: 'leben', segmentiert: 'mana', umwickelt: 'radius' } as const;
export type GearGroup = typeof GROUP_OF_SHAFT[keyof typeof GROUP_OF_SHAFT];

// Kosmetik (meta.looks: freigeschaltet, meta.lookWear: getragen je Slot oder 'waffe'). Regel: Look vor Gear. Nur Aussehen, keine Werte.
// Freischalten: unlock = Set, dessen 5 Teile angelegt sein müssen (Haarspray + Feuerzeug, Glutprophet 5/5), ach = Meilenstein-Erfolg (meta.ts MILESTONES),
// sonst aus der Kosmetik-Box (KOSMETIK_POOL). 25 Teile aus dem Kosmetik-Viewer (docs/ref/kosmetik-viewer.html), 5 je Slot, Modelle in models/kosmetikParts.ts.
// Texte: look.<id>.name, look.<id>.hint (Reaktion auf ein Spiel-Ereignis)
export const KOSMETIK_SLOTS = ['kopf', 'hals', 'ruecken', 'arme', 'koerper', 'waffe'] as const;
export type KosmetikDef = { slot: typeof KOSMETIK_SLOTS[number]; name: string; unlock?: string; ach?: string };
const kos = (slot: Slot, id: string, ach?: string): [string, KosmetikDef] => [id, { slot, name: `look.${id}.name`, ...(ach ? { ach } : {}) }];
export const KOSMETIK: Record<string, KosmetikDef> = {
  haarspray: { slot: 'waffe', name: 'wmodel.haarspray.name', unlock: 'glut' },
  ...Object.fromEntries([
    kos('kopf', 'pappkrone', 'boss1'), kos('kopf', 'fischglas'), kos('kopf', 'gluehbirne'), kos('kopf', 'bartbrille'), kos('kopf', 'fliegenpilz'),
    kos('hals', 'goldkette', 'dust10k'), kos('hals', 'zahnkette'), kos('hals', 'kopfhoerer'), kos('hals', 'pizza'), kos('hals', 'schlangenschal'),
    kos('ruecken', 'killflagge', 'kills1k'), kos('ruecken', 'elementrucksack'), kos('ruecken', 'schriftrolle'), kos('ruecken', 'gewitterwolke'), kos('ruecken', 'limojetpack'),
    kos('arme', 'handschellen', 'bossNoHit'), kos('arme', 'krabbenscheren'), kos('arme', 'nietenhandschuhe'), kos('arme', 'marionette'), kos('arme', 'schlangenarmreif'),
    kos('koerper', 'dreiteiler', 'lvl100'), kos('koerper', 'schottenrock'), kos('koerper', 'bademantel'), kos('koerper', 'schaf'), kos('koerper', 'kuh'),
  ]),
};

// ---------- Boxen im Shop (Grundregel: nur erspielter Staub) ----------
export const BOX = { gear: 120, kosmetik: 120 };   // PH
// Kosmetik-Pool der Kosmetik-Box: die 20 Teile ohne Set und ohne Meilenstein (Haarspray + Feuerzeug nur über Glutprophet 5/5, ⭐-Teile nur über ihren Erfolg)
export const KOSMETIK_POOL: string[] = Object.keys(KOSMETIK).filter(id => !KOSMETIK[id].unlock && !KOSMETIK[id].ach);
