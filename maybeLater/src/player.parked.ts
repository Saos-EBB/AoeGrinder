// Geparkt am 2026-11-08: Haken des Klingenstrichs außerhalb von klinge.ts
// src/player.ts: import { resetKlinge, klingeMoveMul, klingeRooted, klingeUntouchable, klingeHurt } from './klinge';
//   resetGame: resetKlinge();  (rief useKlingeBinds(on() || mage.skin === 'krieger') auf, jetzt useMeleeBinds in player.ts)
//   damagePlayer: klingeUntouchable() ||  …;  if (!dot && player.parryUntil > state.now) { player.onParry?.(); return; }   // Konter
//                 klingeHurt(amount / maxHp());   // Haltungs-Leiste: erlittener Schaden
//   stunned: … || klingeRooted() || …;  Lauftempo: … * klingeMoveMul() * …
// src/main.ts: import { updateKlinge, klingeAnim, updateKlingeVisuals } from './klinge'; updateKlinge(dt); mage.update(…, …klingeAnim()); updateKlingeVisuals();
// src/input.ts: ACTIONS { id: 'stance', label: t('bind.stance'), code: '', key: '–' }; Nahkampf-Belegung stance: ['KeyF', 'F'];
//   runAction: if (id === 'stance') state.stanceKey?.();   useKlingeBinds heißt jetzt useMeleeBinds
// src/ui/hud.ts: Mana-Text zeigte player.resLabel (Haltung) statt Zahl; src/ui/charWindow.ts: ci.stance-Zeile, Lauftempo * klingeMoveMul()
// src/mobs.ts updateMob idle: if (player.smokeUntil > state.now) { /* Rauchbombe: unsichtbar */ }
