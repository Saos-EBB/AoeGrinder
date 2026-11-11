// Dev-Panel (F10): baut die Dev-Blöcke und meldet sie bei ui/devPanel.ts an (registerDev). main.ts ruft mountDev einmal, wenn alle Module geladen sind.
// Logik-Dateien bauen keine Dev-UI selbst, sie liefern hier nur Funktionen. Wo der Block im Panel steht, sagt DEV_LAYOUT in devPanel.ts.

import { $ } from '../util';
import { registerDev } from './devPanel';
import { renderDevZones } from './menus';

export function mountDev() {
  registerDev('devZones', $('devZones'), renderDevZones);   // Zonen-Knöpfe bei jedem Öffnen neu (aktuelle Zone markiert)
}
