// Erfolge (schlicht): Liste in meta.achievements (skins.ts ACHIEVEMENTS), bisher nur „Set <Name> 5/5 angelegt“ (gear.ts checkUnlocks), jeder schaltet den
// Set-Skin frei. Neuer Erfolg → Einblendung oben in der Mitte, auch über Fenstern. Liste im Charakterfenster (Werte, achListHtml).

import { hasAch } from '../meta';
import { ACHIEVEMENTS } from '../skins';
import { t } from '../i18n';

const ACH_TOAST = { showMs: 4500 };   // PH

const setOf = (ach: string) => ach.slice(4);   // 'set:glut' → 'glut'
const setName = (ach: string) => t(`look.magier.${setOf(ach)}.name`);
export const achText = (ach: string) => t('ach.setDone', { set: setName(ach), skin: setName(ach) });

const box = document.createElement('div');
box.id = 'achToasts';
box.setAttribute('aria-live', 'polite');
box.style.cssText = 'position:fixed;left:50%;top:calc(var(--fg-safe, 60px) + 8px);transform:translateX(-50%);z-index:9;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none';
document.body.append(box);

export function showAch(ach: string) {
  const el = document.createElement('div');
  el.className = 'gPanel fg-panel';
  el.style.cssText = 'padding:calc(12 * var(--hu)) calc(22 * var(--hu));font:700 calc(18 * var(--hu)) var(--font-body);color:var(--fg-text);white-space:nowrap';
  const txt = document.createElement('span');
  txt.style.cssText = 'position:relative;z-index:2';
  txt.textContent = `★ ${achText(ach)}`;
  el.append(txt);
  box.append(el);
  setTimeout(() => el.remove(), ACH_TOAST.showMs);
}
addEventListener('fg:ach', (e: Event) => showAch((e as CustomEvent).detail));

// Charakterfenster: alle Erfolge, erreichte hell mit ★, offene grau mit Bedingung
export function achListHtml() {
  const n = ACHIEVEMENTS.filter(hasAch).length;
  return `<div class="cSub">${t('ach.title', { n, m: ACHIEVEMENTS.length })}</div>${ACHIEVEMENTS.map(a => hasAch(a)
    ? `<div class="cRow"><span>★ ${t('ach.setName', { set: setName(a) })}</span><b>${t('ach.skinFree', { skin: setName(a) })}</b></div>`
    : `<div class="cRow" style="opacity:.5"><span>🔒 ${t('ach.setName', { set: setName(a) })}</span><b>${t('ach.need', { set: setName(a) })}</b></div>`).join('')}`;
}
