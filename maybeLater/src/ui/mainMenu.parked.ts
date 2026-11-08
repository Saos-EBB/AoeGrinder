// Geparkt am 2026-11-08 aus src/ui/mainMenu.ts

// CHARS (nach fire bzw. nach realmen)
  { mod: 'arcane', name: t('char.arcane.name'), sub: t('char.arcane.sub'), color: '#c4b5fd', stats: [4, 3, 2] },
  { mod: 'klinge', name: t('char.klinge.name'), sub: t('char.klinge.sub'), color: '#e5e7eb', stats: [4, 3, 3] },

// Waffenwahl im Menü (renderMenu), import { KLINGE_WEAPON_NAMES } from '../klinge';
  const hasWeapons = !!mage.weapon || mage.skin === 'krieger' || mage.skin === 'klinge';
  if (mage.skin === 'klinge') for (const [id, name] of Object.entries(KLINGE_WEAPON_NAMES))   // Klingenstrich: Standard oder Thunderfury
    weapons.appendChild(button('chip' + (id === mage.klingeWeapon ? ' selected' : ''), name, () => { mage.setKlingeWeapon(id); renderMenu(); }));

// src/meta.ts META.charMods enthielt 'arcane' und 'klinge'
// src/figures.ts: import { updateArcRelics, endArchon } from './spells/arcRelics'; resetFigures: state.archon = null; state.warp = null; updateFigures: updateArcRelics();
