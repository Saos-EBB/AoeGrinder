// Erfolge (schlicht): Liste in meta.achievements (skins.ts ACHIEVEMENTS): „Set <Name> 5/5 angelegt“ (gear.ts checkUnlocks), jeder schaltet den
// Set-Skin frei, dazu die Meilensteine (skins.ts MILESTONE_ACH, meta.ts milestone), jeder schaltet ein Kosmetik-Teil frei. Neuer Erfolg → Einblendung oben in der Mitte, auch über Fenstern. Liste im Fenster heroWindow.ts (unter dem Set-Fortschritt).

import { t } from '../i18n';
import { MILESTONE_LOOK } from '../skins';

const ACH_TOAST = { showMs: 4500 };   // PH

const setOf = (ach: string) => ach.slice(4);   // 'set:glut' → 'glut'
const setName = (ach: string) => t(`look.magier.${setOf(ach)}.name`);
// Meilenstein (meta.ts MILESTONES): Name und das Kosmetik-Teil, das er freischaltet
export const achText = (ach: string) => MILESTONE_LOOK[ach] ? t('ach.msDone', { name: t(`ach.ms.${ach}`), look: t(`look.${MILESTONE_LOOK[ach]}.name`) }) : t('ach.setDone', { set: setName(ach), skin: setName(ach) });

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
