// Dev: Waffen-Baukasten in den Einstellungen. Jede Schicht selbst wählen oder ein Legi-Unikat picken, Vorschau wie die Info-Karte, ab ins Inventar (ohne Staub, ohne Limit).

import { $ } from '../util';
import { CARD_RARITIES, SPELLS } from '../config';
import { TYPES, HEADS, SHAFTS, ELEMENTS, MAKERS, EXTRAS } from '../models/weapons/baukasten';
import { WEAPONS } from '../models/weapons/defs';
import { ROLLS, FOCUS_SPELLS, devAddWeapon, weaponName, rarityOf } from '../weaponRolls';
import { weaponStats } from './weaponCard';
import { mage } from '../models/mage';
import { renderMenu } from './mainMenu';
import { LEGENDS } from '../legends';
import { t } from '../i18n';

const VALUES = Object.values(SHAFTS).flatMap((s: any) => s.values);
const UNIQUES = WEAPONS.filter(w => !ROLLS.notForMages.includes(w.id) && w.id !== ROLLS.fallback);
const opts = (list: [string, string][]) => list.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');

// Füllt #devForge (index.html); ui/devGame.ts mountDev ruft das einmal, wenn alle Module geladen sind
export function mountForge() {
  const box = $('devForge');
  const field = (id, label) => `<label class="forgeField"><span>${label}</span><select class="bindBtn" id="${id}"></select></label>`;
  box.innerHTML = [
    field('forgeRarity', 'Seltenheit'), field('forgeUnique', 'Legi-Modell'), field('forgeLegend', 'Legende'),
    field('forgeType', 'Typ'), field('forgeHead', 'Kopf'),
    field('forgeFocus', 'Fokus'), field('forgeValue', 'Wert'),
    field('forgeElement', 'Element'), field('forgeMaker', 'Hersteller'),
    field('forgeExtra', 'Anhänger'), field('forgeValue2', 'Zweitwert'),
  ].join('') + `<div id="forgePreview"></div>
    <button class="bindBtn" id="forgeAdd">Ins Inventar</button><button class="bindBtn" id="forgeEquip">Ins Inventar + anlegen</button>`;
  const sel = id => $(id) as HTMLSelectElement;

  sel('forgeRarity').innerHTML = opts(CARD_RARITIES.map((r, i) => [String(i), r.name]));
  sel('forgeRarity').value = '5';
  sel('forgeUnique').innerHTML = opts(UNIQUES.map(w => [w.id, w.name]));
  sel('forgeLegend').innerHTML = opts([['', 'keine'], ...Object.entries(LEGENDS).filter(([, l]: any) => l.kind === 'mage').map(([k, l]: any) => [k, `${l.name}${l.element ? ` (${l.element})` : ''}`] as [string, string])]);
  sel('forgeType').innerHTML = opts(Object.entries(TYPES).map(([k, t]: any) => [k, t.name]));
  sel('forgeValue').innerHTML = sel('forgeValue2').innerHTML = opts(VALUES.map(v => [v, v]));
  sel('forgeElement').innerHTML = opts(Object.entries(ELEMENTS).map(([k, e]: any) => [k, e.name]));
  sel('forgeMaker').innerHTML = opts(Object.entries(MAKERS).map(([k, m]: any) => [k, `${m.name} (${t(`wmat.${m.main}`)})`]));
  sel('forgeExtra').innerHTML = opts([['none', 'keiner'], ...Object.entries(EXTRAS) as [string, string][]]);

  // Kopf hängt am Typ, Fokus an der Schule des Kopfs: Listen neu, Wahl bleibt wenn möglich
  function refill(id, list: [string, string][]) {
    const s = sel(id), keep = s.value;
    s.innerHTML = opts(list);
    if (list.some(([v]) => v === keep)) s.value = keep;
  }
  function build() {
    refill('forgeHead', TYPES[sel('forgeType').value].heads.map(h => [h, `${HEADS[h][0]} (${HEADS[h][1]})`]));
    const school = HEADS[sel('forgeHead').value][1];
    refill('forgeFocus', FOCUS_SPELLS.filter(id => SPELLS[id]?.tags.includes(school)).map(id => [id, SPELLS[id].name]));
    const r = Number(sel('forgeRarity').value);
    sel('forgeUnique').parentElement.hidden = sel('forgeLegend').parentElement.hidden = r !== 5;
    sel('forgeExtra').disabled = sel('forgeValue2').disabled = r < 4;       // Anhänger erst ab lila
    const value = sel('forgeValue').value;
    const s: any = {
      seed: Math.floor(Math.random() * 1e9), rarity: r, type: sel('forgeType').value, maker: sel('forgeMaker').value, head: sel('forgeHead').value,
      shaft: Object.keys(SHAFTS).find(k => SHAFTS[k].values.includes(value)), value, focus: sel('forgeFocus').value, element: sel('forgeElement').value,
      extra: r >= 4 ? sel('forgeExtra').value : 'none', value2: sel('forgeValue2').value, fv: 1,
    };
    if (r === 5) s.unique = sel('forgeUnique').value;
    if (r === 5 && sel('forgeLegend').value) s.legend = sel('forgeLegend').value;
    return { v: 2, r, s };
  }
  function preview() {
    const w = build(), p = $('forgePreview');
    p.textContent = '';
    const name = Object.assign(document.createElement('div'), { textContent: `${weaponName(w)} · ${rarityOf(w).name}` });
    Object.assign(name.style, { color: rarityOf(w).color, fontWeight: '700', marginBottom: '4px' });
    p.append(name, weaponStats(w));
    p.style.borderColor = rarityOf(w).color;
  }
  box.addEventListener('change', preview);
  const add = equipIt => { devAddWeapon(build(), equipIt); mage.refreshWeapon(); renderMenu(); preview(); };
  $('forgeAdd').addEventListener('click', () => add(false));
  $('forgeEquip').addEventListener('click', () => add(true));
  preview();
}
