// Hover-Karten (Mockup T1.dc.html, Look Glut): ein Modul für Spells, Karten, Relikte und Waffen.
// Erweiterte Tooltips (Einstellung) zeigen alles, sonst nur Name, eine Zeile Werte und den Text.
// Erscheint nach TIP_DELAY, bleibt im Bild (klappt an den Rändern um). Shift zeigt Formeln, wenn es welche gibt.

import { uiSettings } from './uiSettings';
import { t } from '../i18n';

export type TipData = {
  label?: string;                 // über der Karte, z. B. „SPELL (Taste 4)“
  title: string; color: string;   // Name in Schul- oder Seltenheitsfarbe
  icon?: string;                  // Bild-URL links vom Namen (Spell-Icon)
  right?: string; sub?: string;   // rechts neben dem Namen (Rang), Zeile darunter (Schule · Typ)
  border?: string; relic?: boolean;
  stats?: [string, string][];     // Wertepaare, zwei pro Zeile
  big?: { value: string; label: string; delta?: string; deltaColor?: string };   // Waffe: großer Hauptwert
  short?: string;                 // Haupttext (HTML aus Spieldaten)
  rows?: string[];                // weitere Zeilen, nur erweitert
  facts?: [string, string][];     // kleine Zeilen links/rechts, z. B. „Schaden in diesem Run“
  flavor?: string;
  formulas?: string;              // Shift
  footer?: [string, string];
  compare?: TipData;              // zweite Karte rechts (Waffen-Vergleich)
  compareLabels?: [string, string];
};

const TIP_DELAY = 150;   // PH
const box = document.createElement('div');
box.id = 'tipBox';
box.hidden = true;
document.body.appendChild(box);

const pair = (l: string, r: string, cls = '') => `<div class="tRow ${cls}"><span>${l}</span><span>${r}</span></div>`;
function card(d: TipData, ext: boolean, label?: string) {
  const out = [`<div class="tCard${d.relic ? ' relic' : ''}" style="--tc:${d.border ?? d.color}">`];
  if (label ?? d.label) out.push(`<span class="tLabel">${label ?? d.label}</span>`);
  out.push(`<div class="tHead">${d.icon ? `<img class="tIcon" src="${d.icon}" alt="">` : ''}<span class="tName" style="color:${d.color}">${d.title}</span>${d.right ? `<span class="tRight">${d.right}</span>` : ''}</div>`);
  if (d.sub) out.push(`<div class="tSub">${d.sub}</div>`);
  const stats = ext ? d.stats ?? [] : (d.stats ?? []).slice(0, 2);
  if (stats.length || d.big) out.push('<i class="tSep"></i>');
  if (d.big) out.push(`<div class="tBig">${d.big.value}</div>${pair(d.big.label, '')}${d.big.delta ? `<div class="tRow"><span style="color:${d.big.deltaColor ?? '#6ee7a0'}">${d.big.delta}</span></div>` : ''}`);
  for (let i = 0; i < stats.length; i += 2) out.push(pair(stats[i].join(' '), stats[i + 1]?.join(' ') ?? ''));
  if (d.short) out.push(`${stats.length || d.big ? '<i class="tSep"></i>' : ''}<p class="tText">${d.short}</p>`);
  if (ext) {
    for (const r of d.rows ?? []) out.push(`<p class="tText">${r}</p>`);
    if (d.flavor) out.push(`<p class="tFlavor">${d.flavor}</p>`);
    for (const [l, r] of d.facts ?? []) out.push(pair(l, r, 'tFact'));
    if (d.formulas) out.push(`<div class="tFormula">${d.formulas}</div>${pair(t('tip.shift'), '', 'tFact tShift')}`);
    if (d.footer) out.push(pair(d.footer[0], d.footer[1], 'tFoot'));
  }
  out.push('</div>');
  return out.join('');
}

let timer = 0, lastX = 0, lastY = 0, current: (() => TipData | null) | null = null;
function render() {
  const d = current?.();
  if (!d) { box.hidden = true; return; }
  const ext = uiSettings.tooltipsExt;
  box.innerHTML = d.compare && ext
    ? `<div class="tPair">${card(d, ext, d.compareLabels?.[0])}${card(d.compare, ext, d.compareLabels?.[1])}</div>`
    : card(d, ext);
  box.hidden = false;
  place();
}
function place() {
  const pad = 18, r = box.getBoundingClientRect();
  let x = lastX + pad, y = lastY - r.height - pad;               // über dem Zeiger: Leisten und Karten liegen unten
  if (x + r.width > innerWidth - 4) x = lastX - r.width - pad;    // rechts kein Platz: links vom Zeiger
  if (y < 4) y = lastY + pad;                                     // oben kein Platz: darunter
  box.style.left = `${Math.max(4, Math.min(innerWidth - r.width - 4, x))}px`;
  box.style.top = `${Math.max(4, Math.min(innerHeight - r.height - 4, y))}px`;
}
export function hideTip() { clearTimeout(timer); current = null; box.hidden = true; }

export function attachTip(el: HTMLElement, build: () => TipData | null) {
  el.removeAttribute('title');
  el.addEventListener('mouseenter', e => {
    lastX = e.clientX; lastY = e.clientY;
    clearTimeout(timer);
    current = build;
    timer = window.setTimeout(render, TIP_DELAY);
  });
  el.addEventListener('mousemove', e => { lastX = e.clientX; lastY = e.clientY; if (!box.hidden) place(); });
  el.addEventListener('mouseleave', hideTip);
  el.addEventListener('mousedown', hideTip);
}
addEventListener('keydown', e => { if (e.key === 'Shift') box.classList.add('formulas'); });
addEventListener('keyup', e => { if (e.key === 'Shift') box.classList.remove('formulas'); });
addEventListener('uisettings', () => { if (!box.hidden) render(); });
