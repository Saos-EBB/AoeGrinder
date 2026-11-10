// Waffen-Werte: Block für den Dev-Baukasten und Hover-Karte für Inventar, Shop und Hauptmenü.

import { weaponName, effectRows, rarityOf, equipped, ROLLS } from '../weaponRolls';
import { attachTip, TipData } from './tooltip';
import { COLORS } from './colors';
import { t, fmtNum } from '../i18n';

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
      for (const part of body.split(/([+−]\d[\d,.]* %)/)) {
        if (!part) continue;
        text.append(/^[+−]\d/.test(part) ? Object.assign(document.createElement('b'), { textContent: part, style: `color:${color}` }) : part);
      }
    }
    grid.append(label, text);
  }
  return grid;
}

// Hover-Karte einer Waffe (Mockup T1): Name in Seltenheitsfarbe, großer Hauptwert, ▲/▼ gegenüber der ausgerüsteten Waffe,
// Affixe blau (Element in seiner Farbe), Legendär-Effekt orange, Combo-Zeile, „Zerlegen +x Staub“. Vergleich: diese Waffe links, ausgerüstete rechts.
const pctOf = (s: string) => { const m = s?.match(/^([+−-]?\d+(?:[,.]\d+)?) %\s*(.*)$/); return m ? { v: parseFloat(m[1].replace('−', '-').replace(',', '.')), label: m[2] } : null; };
function weaponTip(w): TipData {
  const rar = rarityOf(w), rows = effectRows(w), byKind = Object.fromEntries(rows.map(r => [r.kind, r]));
  const main = pctOf(byKind.value?.text?.replace(/^[^:]*: /, '') ?? byKind.value?.text);
  const lines: string[] = [];
  if (byKind.type?.text) lines.push(`<span style="color:${COLORS.dim}">${byKind.type.text}</span>`);
  for (const k of ['focus', 'element', 'maker', 'extra']) if (byKind[k]?.text) lines.push(`<span class="tAffix"${k === 'element' ? ` style="color:${byKind[k].color}"` : ''}>◆ ${byKind[k].text}</span>`);   // Element in seiner Farbe
  const uniq = byKind.unique?.text;
  if (uniq) {
    const [effect, combo] = uniq.split(' Combo ');
    lines.push(`<span class="tLegend">◆ ${effect}</span>`);
    if (combo) lines.push(`<span class="tCombo">◆ <b>Combo ${combo}</b></span>`);
  }
  const eq = equipped(), other = eq && eq !== w ? pctOf(effectRows(eq).find(r => r.kind === 'value')?.text ?? '') : null;
  const delta = main && other && other.label === main.label && other.v !== main.v ? main.v - other.v : null;
  return {
    title: weaponName(w), color: rar.color, border: rar.color, sub: `${rar.name}${byKind.type?.text ? ` · ${byKind.type.text.split(':')[0]}` : ''}`,
    big: main ? { value: `${main.v > 0 ? '+' : ''}${fmtNum(main.v)} %`, label: main.label,
      delta: eq === w ? t('wcard.equippedLow') : delta === null ? undefined : `${delta > 0 ? '▲ +' : '▼ −'}${fmtNum(Math.abs(Math.round(delta * 10) / 10))} %`,
      deltaColor: eq === w ? '#f87171' : delta > 0 ? '#6ee7a0' : '#f87171' } : undefined,
    short: lines.shift() ?? '', rows: lines,
    footer: [t('wcard.salvage'), t('shop.refund', { n: ROLLS.refund[w.r] })],
  };
}
// Karte mit Vergleich zur ausgerüsteten Waffe (auch für Tastatur-Auswahl im Fenster heroWindow.ts)
export function weaponCardData(w): TipData {
  const d = weaponTip(w), eq = equipped();
  if (eq && eq !== w) Object.assign(d, { compare: weaponTip(eq), compareLabels: [t('wcard.this'), t('shop.equipped')] });
  else d.label = eq === w ? t('shop.equipped') : t('wcard.weapon');
  return d;
}
export function attachWeaponCard(el: HTMLElement, w) {
  attachTip(el, () => weaponCardData(w));
}
