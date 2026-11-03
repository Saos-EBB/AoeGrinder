// Info-Karte beim Hovern über eine Waffe (Hauptmenü, Shop-Inventar): Name in Seltenheitsfarbe, darunter alle Schichten.

import { weaponName, effectLines, rarityOf } from '../weaponRolls';

const card = document.createElement('div');
Object.assign(card.style, {
  position: 'fixed', zIndex: '30', pointerEvents: 'none', display: 'none', maxWidth: '320px', padding: '8px 10px',
  background: 'linear-gradient(#1b1712f2, #0d0b08f2)', border: '2px solid', borderRadius: '6px',
  font: '12px/1.45 system-ui, sans-serif', color: '#efe0b8', whiteSpace: 'pre-line', boxShadow: '0 4px 14px #000a',
});
document.body.appendChild(card);

function place(e) {
  const pad = 14, r = card.getBoundingClientRect();
  card.style.left = `${Math.min(innerWidth - r.width - 4, e.clientX + pad)}px`;
  card.style.top = `${Math.min(innerHeight - r.height - 4, e.clientY + pad)}px`;
}
export function attachWeaponCard(el, w) {
  el.removeAttribute('title');
  el.addEventListener('mouseenter', e => {
    const rar = rarityOf(w);
    card.textContent = '';
    const head = document.createElement('div');
    head.textContent = `${weaponName(w)} · ${rar.name}`;
    Object.assign(head.style, { color: rar.color, fontWeight: '700', marginBottom: '4px' });
    card.append(head, effectLines(w).join('\n'));
    card.style.borderColor = rar.color;
    card.style.display = 'block';
    place(e);
  });
  el.addEventListener('mousemove', place);
  el.addEventListener('mouseleave', () => { card.style.display = 'none'; });
  el.addEventListener('click', () => { card.style.display = 'none'; });
}
