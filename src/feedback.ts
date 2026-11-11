// Rückmeldung an den Spieler aus der Spiel-Logik (ARCH-02): schwebende Schrift, Fehlermeldung, Aktionsleiste, Tasten-Hilfe.
// Eigenes Modul ohne Imports (wie hooks.ts, device.ts), damit Logik-Dateien nicht ui/hud.ts importieren und so den Import-Kreis schließen.
// ui/hud.ts setzt beim Laden die echte Umsetzung ein (connectFeedback). Vorher sind die Aufrufe leer; beim Laden ruft sie niemand.

type CombatText = (pos: any, text: any, cls: string, height?: number, color?: string) => void;
type Feedback = { combatText: CombatText; showError: (msg: string) => void; renderActionbar: () => void; refreshKeyLabels: () => void };

let impl: Feedback = { combatText: () => {}, showError: () => {}, renderActionbar: () => {}, refreshKeyLabels: () => {} };
export function connectFeedback(f: Feedback) { impl = f; }

// Schwebende Schrift über pos (Schaden, XP, „Kein Mana“ …), cls = CSS-Klasse (dmg, crit, xp, info, heal …)
export const combatText: CombatText = (pos, text, cls, height?, color?) => impl.combatText(pos, text, cls, height, color);
// Rote Meldung in der Bildmitte
export const showError = (msg: string) => impl.showError(msg);
// Aktionsleiste neu zeichnen (Spells, Tasten, Modus)
export const renderActionbar = () => impl.renderActionbar();
// Tasten-Beschriftungen und Hilfe neu (Tastatur oder Gamepad)
export const refreshKeyLabels = () => impl.refreshKeyLabels();
