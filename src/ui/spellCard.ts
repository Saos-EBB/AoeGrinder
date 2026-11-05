// Info-Karte beim Hovern über einen Spell: Hauptmenü (Start-Kit), Pause (aktuelle Slots), Aktionsleiste.
// Zeigt, was der Spell gerade kann: Beschreibung, Kosten, Abklingzeit, Zauberzeit, Schaden, aktive und mögliche Runen.

import { state, player } from '../state';
import { SPELLS } from '../config';
import { manaCost, spellCd } from '../formulas';
import { paysLife, rune, runesOf, stat } from '../spells/core';
import { spellValue } from '../cards';
import { batteryMode } from '../battery';
import { ICONS } from './icons';
import { COLORS } from './colors';

const card = document.createElement('div');
Object.assign(card.style, {
  position: 'fixed', zIndex: '30', pointerEvents: 'none', display: 'none', maxWidth: '340px', padding: '8px 10px',
  background: 'linear-gradient(#1b1712f2, #0d0b08f2)', border: '2px solid', borderRadius: '6px',
  font: '12px/1.45 system-ui, sans-serif', color: '#efe0b8', boxShadow: '0 4px 14px #000a', textAlign: 'left',
});
document.body.appendChild(card);
function place(e) {
  const pad = 14, r = card.getBoundingClientRect();
  card.style.left = `${Math.max(4, Math.min(innerWidth - r.width - 4, e.clientX + pad))}px`;
  card.style.top = `${Math.max(4, Math.min(innerHeight - r.height - 4, e.clientY - r.height - pad))}px`;   // über dem Mauszeiger: die Leisten liegen unten
}
const sec = ms => `${String(Math.round(ms / 10) / 100).replace('.', ',')} s`;
const unit = id => paysLife(id) ? 'Leben' : batteryMode() ? 'Ladung' : player.rageMax === 1 ? '' : player.rageMax ? 'Wut' : 'Mana';
const line = (label, text, color = COLORS.text) => `<div><span style="color:${COLORS.dim}">${label}</span> <b style="color:${color}">${text}</b></div>`;

function fill(id) {
  const s = SPELLS[id], color = COLORS.school[s.cls] ?? COLORS.text;
  const parts = [`<div style="font:700 14px Cinzel,serif;color:${color}">${s.name}</div>`];
  if (s.tags?.length) parts.push(`<div style="color:${COLORS.dim};font-size:11px">${s.tags.join(' · ')}${s.relic ? ' · Relikt' : ''}</div>`);
  parts.push(`<div style="margin:4px 0">${s.desc ?? ''}</div>`);
  const cost = s.press && !s.random ? s.mana : manaCost(id), u = unit(id);
  if (cost > 0 && u) parts.push(line('Kosten', `${cost} ${u}`));
  const cd = spellCd(id);
  if (cd > 0) parts.push(line('Abklingzeit', sec(cd)));
  if (s.channel) parts.push(line('Kanal', sec(s.channel)));
  else if (s.castTime) parts.push(line('Zauberzeit', sec(s.castTime)));
  else if (!s.press && !s.fixed) parts.push(line('Zauberzeit', 'sofort'));
  if (s.range) parts.push(line('Reichweite', `${s.range + (stat(id).range ?? 0)} yd`));
  const dmg = spellValue(id);
  if (dmg) parts.push(line('Schaden', `etwa ${dmg}${s.tickDmg ? ' pro Tick' : ''}`, color));
  if (s.preview) { const next = s.preview(); parts.push(line('Nächster Wurf', SPELLS[next]?.name ?? next, color)); }
  const runes = runesOf(id) ?? [], active = rune(id);
  if (runes.length) parts.push(`<div style="margin-top:5px;color:${COLORS.dim};font-size:11px;text-transform:uppercase">Runen</div>` +
    runes.map(r => `<div style="opacity:${r === active || r.id === active?.id ? 1 : .6}">${r.id === active?.id ? '★ ' : '· '}<b>${r.name}</b>: ${r.desc}</div>`).join(''));
  card.innerHTML = parts.join('');
  card.style.borderColor = color;
}

// Drag & Drop auf der Hotbar: Karte ausblenden
export function hideSpellCards() { card.style.display = 'none'; }
export function attachSpellCard(el, id) {
  el.removeAttribute('title');
  el.addEventListener('mouseenter', e => { if (!SPELLS[id]) return; fill(id); card.style.display = 'block'; place(e); });
  el.addEventListener('mousemove', place);
  el.addEventListener('mouseleave', () => { card.style.display = 'none'; });
  el.addEventListener('mousedown', () => { card.style.display = 'none'; });
}

// Zeile kleiner Spell-Felder mit Icon oder Kurznamen, Hovern zeigt die Karte
export function renderKit(box, ids) {
  box.textContent = '';
  for (const id of ids) {
    if (!id || !SPELLS[id]) continue;
    const el = document.createElement('div');
    el.className = `kitSlot ${SPELLS[id].cls}`;
    if (ICONS[id]) el.style.backgroundImage = `url(${ICONS[id]})`;
    else el.textContent = SPELLS[id].name;
    attachSpellCard(el, id);
    box.appendChild(el);
  }
}
export const currentKit = () => state.slots ?? [];
