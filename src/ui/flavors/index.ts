// UI-Flavors (Mockups X1*–X3*, ~/Downloads/fg-ui-mix): Höllenfeste, Schlachtbank, Kompakt-Krypta.
// Ein Flavor = { id, name, tokens, hud, numbers, messages, overlay }, eine Datei pro Flavor (+ .css mit Farben und Ornamenten).
// Die CSS-Variablen hängen an <body data-flavor="…">, die gemeinsamen Bausteine (.fg-panel, .fg-btn …) stehen in base.css.
// Gewählt in Einstellungen → Interface, gespeichert in frostgrind.ui.v1 (flavor).

import { uiSettings } from '../uiSettings';
import type { HudElementId, Placement } from '../hud/layout';
import './base.css';
import { hoellenfeste } from './hoellenfeste';
import { schlachtbank } from './schlachtbank';
import { krypta } from './krypta';

export type FlavorId = 'hoellenfeste' | 'schlachtbank' | 'krypta';
export type Flavor = {
  id: FlavorId;
  name: string;                       // i18n-Key
  sub: string;                        // i18n-Key, Unterzeile der Auswahlkarte
  tokens: { bg: string; frame: string; hp: string; mana: string; bar: string };   // Farben für JS (Vorschau-Karte); alles andere als CSS-Variable in <id>.css
  hud: Partial<Record<HudElementId, Placement>>;   // Standard-Layout (Phase 4)
  numbers: (kind: string, text: string, count: number) => string;   // Inhalt einer Schadenszahl (Phase 5)
  messages: (line: string, sub: string, big: boolean) => string;    // Erfolgs-Meldung (Phase 6)
  overlay: string;                    // Bildschirm-Effekte; .lite = auch im Spiel, sonst nur bei offenem Menü
};

export const FLAVORS: Flavor[] = [hoellenfeste, schlachtbank, krypta];
export const flavorById = (id: string) => FLAVORS.find(f => f.id === id) ?? FLAVORS[0];
export const activeFlavor = () => flavorById(uiSettings.flavor);

// Ein Overlay für die Bildschirm-Effekte, Inhalt aus dem aktiven Flavor
const overlay = document.createElement('div');
overlay.id = 'fgOverlay';
overlay.setAttribute('aria-hidden', 'true');
document.body.append(overlay);

let shown = '';
function apply() {
  const f = activeFlavor();
  document.body.dataset.flavor = f.id;
  document.body.classList.toggle('fgNoFx', !uiSettings.screenFx);
  if (shown !== f.id) { shown = f.id; overlay.innerHTML = f.overlay; }
}
apply();
addEventListener('uisettings', apply);
