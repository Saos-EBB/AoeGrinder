// Rückmeldung an den Spieler aus der Spiel-Logik (ARCH-02): schwebende Schrift, Fehlermeldung, Aktionsleiste, Tasten-Hilfe.
// Eigenes Modul ohne Imports (wie hooks.ts, device.ts), damit Logik-Dateien nicht ui/hud.ts importieren und so den Import-Kreis schließen.
// ui/hud.ts setzt beim Laden die echte Umsetzung ein (connectFeedback), die Zahlen kommen aus ui/dmgNumbers.ts. Vorher sind die Aufrufe leer; beim Laden ruft sie niemand.

type CombatText = (pos: any, text: any, cls: string, height?: number, color?: string) => void;
type Feedback = {
  combatText: CombatText; showError: (msg: string) => void; renderActionbar: () => void; refreshKeyLabels: () => void;
  damageNumber: (mob: any, dmg: number, crit: boolean, source: any, tick?: boolean) => void; hurtNumber: (pos: any, amount: number) => void;
};

const none = () => {};
let impl: Feedback = { combatText: none, showError: none, renderActionbar: none, refreshKeyLabels: none, damageNumber: none, hurtNumber: none };
export function connectFeedback(f: Feedback) { impl = f; }

// Schwebende Schrift über pos (Schaden, XP, „Kein Mana“ …), cls = CSS-Klasse (dmg, crit, xp, info, heal …)
export const combatText: CombatText = (pos, text, cls, height?, color?) => impl.combatText(pos, text, cls, height, color);
// Rote Meldung in der Bildmitte
export const showError = (msg: string) => impl.showError(msg);
// Aktionsleiste neu zeichnen (Spells, Tasten, Modus)
export const renderActionbar = () => impl.renderActionbar();
// Tasten-Beschriftungen und Hilfe neu (Tastatur oder Gamepad)
export const refreshKeyLabels = () => impl.refreshKeyLabels();
// Schadenszahl am Mob im Zahlen-Stil (ui/dmgNumbers.ts), tick = kleine Tick-Zahl (DoT, Umgebung)
export const damageNumber = (mob: any, dmg: number, crit: boolean, source: any, tick?: boolean) => impl.damageNumber(mob, dmg, crit, source, tick);
// Treffer am Spieler im Zahlen-Stil (ui/dmgNumbers.ts)
export const hurtNumber = (pos: any, amount: number) => impl.hurtNumber(pos, amount);
