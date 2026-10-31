// Mob-Fähigkeiten. Hook-Punkte, alle optional:
//   onCombatStart(mob)               beim Eintritt in den Kampf
//   onUpdate(mob, dt)                jeden Frame im Kampf; true ersetzt Verfolgen und Nahkampf
//   onHit(mob, dmg)                  Mob hat den Spieler getroffen
//   onDamaged(mob, amount, source)   vor dem Schaden; gibt den neuen Betrag zurück, 0 = immun
// Alle Zahlen sind Design-Werte (PH).

export const ABILITIES: any = {};
