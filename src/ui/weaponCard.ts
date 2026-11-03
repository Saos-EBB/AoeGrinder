// Info-Karte beim Hovern über eine Waffe (Hauptmenü, Shop-Inventar): Name in Seltenheitsfarbe, darunter alle Schichten.

import { weaponName, effectRows, rarityOf } from '../weaponRolls';
import { COLORS } from './colors';

// Werte-Block: jede Schicht in fester Zeile, links farbiges Etikett, Zahlen in derselben Farbe. Fehlende Schichten bleiben als „—“ stehen.
export function weaponStats(w) {
  const grid = document.createElement('div');
  Object.assign(grid.style, { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 8px', alignItems: 'baseline', textAlign: 'left', whiteSpace: 'normal' });
  for (const r of effectRows(w)) {
    const color = r.text ? r.color ?? COLORS.weaponRow[r.kind] : COLORS.dim;
    const label = document.createElement('span');
    label.textContent = r.label;
    Object.assign(label.style, { color, font: '700 10px system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '.5px', borderLeft: `3px solid ${color}`, paddingLeft: '5px', opacity: r.text ? '1' : '.45' });
    const text = document.createElement('span');
    if (!r.text) { text.textContent = '—'; text.style.color = COLORS.dim; text.style.opacity = '.45'; }
    else {
      text.style.color = COLORS.text;
      const [head, ...rest] = r.text.split(': ');   // Name vor dem Doppelpunkt in der Zeilenfarbe
      const body = rest.length ? rest.join(': ') : head;
      if (rest.length) text.append(Object.assign(document.createElement('b'), { textContent: head + ': ', style: `color:${color}` }));
      for (const part of body.split(/([+−]\d[\d,]* %)/)) {
        if (!part) continue;
        text.append(/^[+−]\d/.test(part) ? Object.assign(document.createElement('b'), { textContent: part, style: `color:${color}` }) : part);
      }
    }
    grid.append(label, text);
  }
  return grid;
}

const card = document.createElement('div');
Object.assign(card.style, {
  position: 'fixed', zIndex: '30', pointerEvents: 'none', display: 'none', maxWidth: '360px', padding: '8px 10px',
  background: 'linear-gradient(#1b1712f2, #0d0b08f2)', border: '2px solid', borderRadius: '6px',
  font: '12px/1.45 system-ui, sans-serif', color: '#efe0b8', boxShadow: '0 4px 14px #000a',
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
    card.append(head, weaponStats(w));
    card.style.borderColor = rar.color;
    card.style.display = 'block';
    place(e);
  });
  el.addEventListener('mousemove', place);
  el.addEventListener('mouseleave', () => { card.style.display = 'none'; });
  el.addEventListener('click', () => { card.style.display = 'none'; });
}
