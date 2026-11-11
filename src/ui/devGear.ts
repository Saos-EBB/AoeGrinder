// Dev-Teile des Gears (ARCH-06): Set anlegen, Set-Erfolg setzen (aus gear.ts), Block fürs Dev-Panel (aus lootView.ts), Debug-API window.__gear für Testskripte (aus gear.ts).

import { meta, saveMeta } from '../meta';
import { setAch } from '../skins';
import { figureOfSet } from '../figureTable';
import { SLOTS, GEAR, KOSMETIK, KOSMETIK_POOL } from '../gear/data';
import { SETS } from '../gear/sets';
import { cleanGear } from '../gear/rules';
import { gearInv, wearMap, overflow, worn, checkUnlocks, takeGear, wearGear, deleteGear, fullSet, setCount, hasKosmetik, kosmetikIn, wearKosmetik, kosmetikBoxLeft } from '../gear/inventory';
import { rollGear, buyKosmetikBox } from '../gear/roll';
import { gearShown, kosmetikShown, groupOf, makerOf } from '../gear/shown';
import { gearRows, gearName, kosmetikSource } from '../gear/text';
import { applyRunGear } from '../gear/apply';
import { t } from '../i18n';
import { heroModel } from '../models/heroModel';
import { renderMenu } from './mainMenu';
import { html } from './dom';

// Dev: Set des Schul-Magiers anlegen (n Teile, Rest leer), ohne Staub und Limit. Seltenheit lila
export function devWearSet(setId: string, n: number = SLOTS.length) {
  SLOTS.forEach((slot, i) => {
    if (i >= n) { wearMap()[slot] = null; return; }
    const g = rollGear(slot, 4, figureOfSet(setId));
    g.s.setId = setId;
    gearInv(slot).push(g);
    wearMap()[slot] = g.id;
  });
  checkUnlocks();
  saveMeta();
}

// Dev: Set-Erfolg (= Set-Skin frei) setzen oder entfernen, ohne Gear
export function devSetAch(setId: string, on: boolean) {
  const a = setAch(setId);
  meta.achievements = meta.achievements.filter(x => x !== a);
  if (on) meta.achievements.push(a);
  saveMeta();
}

// Dev: Set 5/5 oder 4/5 anlegen, Set-Erfolg setzen (Block für ui/devGame.ts)
export function devGearSetBlock() {
  const box = html(`<div><select class="bindBtn" id="devGearSet">${Object.keys(SETS).map(id => `<option value="${id}">${t(`look.magier.${id}.name`)}</option>`).join('')}</select>
  <button class="bindBtn" id="devGearSet5">5/5 anlegen</button><button class="bindBtn" id="devGearSet4">4/5 anlegen</button>
  <button class="bindBtn" id="devGearAchOn">Skin frei</button><button class="bindBtn" id="devGearAchOff">Skin sperren</button></div>`);
  const q = (id: string) => box.querySelector<HTMLElement>(`#${id}`);
  for (const n of [5, 4] as number[]) q(`devGearSet${n}`).addEventListener('click', () => {
    devWearSet((q('devGearSet') as HTMLSelectElement).value, n);
    heroModel.refreshSkin();
    renderMenu();
  });
  // Set-Erfolg (= Set-Skin frei) setzen oder entfernen, ohne Gear anzulegen. Sperren lässt die Wahl stehen, skinOf zeigt dann Standard
  for (const [id, on] of [['devGearAchOn', true], ['devGearAchOff', false]] as [string, boolean][]) q(id).addEventListener('click', () => {
    devSetAch((q('devGearSet') as HTMLSelectElement).value, on);
    heroModel.refreshSkin();
    renderMenu();
  });
  return box;
}

// Dev / Tests
// Debug-API für Testskripte: alte Namen als Keys bleiben (E7)
(window as any).__gear = { lookSource: kosmetikSource, cosLook: kosmetikShown, LOOKS: KOSMETIK, KOSMETIK_POOL, buyLookBox: buyKosmetikBox, lookBoxLeft: kosmetikBoxLeft, hasLook: hasKosmetik, gearLook: gearShown, groupOf, makerOf, devSetAch, checkUnlocks, wearLook: wearKosmetik, lookIn: kosmetikIn, devWearSet, SETS, fullSet, setCount, SLOTS, GEAR, rollGear, takeGear, wearGear, deleteGear, gearRows, gearName, applyRunGear, cleanGear, worn, gearInv, overflow };
