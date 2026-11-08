// Rückfrage im Spiel-Look statt der Browser-Abfrage: askConfirm(...) → Promise<boolean>. Enter bestätigt nicht, Esc bricht ab.
import { t } from '../i18n';

const modal = document.createElement('div');
modal.className = 'modal';
modal.style.zIndex = '6';
modal.innerHTML = `<div class="frame panel" role="alertdialog" aria-labelledby="askTitle">
  <h1 class="title" id="askTitle" style="font-size:22px"></h1>
  <p id="askText"></p>
  <div class="row2">
    <button class="smallBtn" id="askNo" style="width:auto;padding:6px 14px">${t('ui.cancel')}</button>
    <button class="smallBtn" id="askYes" style="width:auto;padding:6px 14px"></button>
  </div>
</div>`;
document.body.appendChild(modal);
const el = id => modal.querySelector<HTMLElement>(`#${id}`);
let done = null;
function close(ok) {
  modal.classList.remove('show');
  removeEventListener('keydown', onKey, true);
  done?.(ok);
  done = null;
}
const onKey = e => { if (e.code === 'Escape') { e.stopImmediatePropagation(); close(false); } };
el('askNo').addEventListener('click', () => close(false));
el('askYes').addEventListener('click', () => close(true));

export function askConfirm(title, text, yes = t('ui.yes')) {
  if (done) close(false);
  el('askTitle').textContent = title;
  el('askText').textContent = text;
  el('askYes').textContent = yes;
  modal.classList.add('show');
  addEventListener('keydown', onKey, true);
  el('askNo').focus();                                 // Abbrechen hat den Fokus, damit Enter nichts löscht
  return new Promise<boolean>(res => { done = res; });
}
