// Geparkt am 2026-11-08 aus src/models/mage.ts: Klingenstrich und Arkan-Skin-Wahl.

import { buildKlinge } from './klingeModel';
// Klingenstrich: Standard oder Thunderfury (legends.ts), gleiches Modell
const KLINGE_WEAPON_STORE = 'frostgrind.klingeWeapon';
let klingeWeapon = (() => { try { const w = localStorage.getItem(KLINGE_WEAPON_STORE); return w === 'thunderfury' ? w : 'standard'; } catch { return 'standard'; } })();
// HEROES: klinge: () => buildKlinge({ bloom: PERF.bloom })
// skinForRun: ids.includes('arcane') ? 'arkan' (nach fire), ids.includes('klinge') ? 'klinge' (nach realmen)
// mage:
  get klingeWeapon() { return klingeWeapon; },
  setKlingeWeapon(id) { klingeWeapon = id; try { localStorage.setItem(KLINGE_WEAPON_STORE, id); } catch { /* egal */ } },
// setWarWeapon endete mit dem Kommentar „Klingenstrich: Effekte und Haltung des Modells“: mage.hero.setStance, setFx kommen aus klingeModel.ts
