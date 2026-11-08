// Geparkt am 2026-11-08 aus src/spells/core.ts: Haken der Arkan-Figur.

// Arkan-Treffer melden sich hier (Arkanes Mal, arcmark.ts): fn(mob, spellId, Schaden vor Wurf und Rüstung)
// Liste an einer Funktions-Deklaration: arcmark.ts kann im Import-Kreis vor dem Rest dieser Datei laufen
function arcaneHooks(): any[] { return (arcaneHooks as any).list ??= []; }
export function onArcaneHit(fn) { arcaneHooks().push(fn); }

// in makeCtx → hit(m, amount):
      if (m.cagedUntil > state.now && (id === 'voidorb' || id === 'arcmissiles')) dmg *= 1.5;   // Knochengefängnis
      if (hasTag(id, 'Arkan')) dmg *= arcDmgMul();                          // Arkane Ladungen
      if (landed && !m.dead && hasTag(id, 'Arkan')) for (const fn of arcaneHooks()) fn(m, id, dmg);

// in cast(): Dodge-Kombo der Arkan-Figur (dodge.ts KIND arkan: 'instant')
  if (castTime && consumeCombo('instant')) castTime = 0;
// castTime teilte zusätzlich durch legendCastMul() (Legende Achtfacher Stern, maybeLater/src/legends.parked.ts)

// chargesOf: bonus += (id === 'blink' ? mods.blinkExtra : 0)   // blinkExtra: Doppelsprung
