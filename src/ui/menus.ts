import { state, player } from '../state';
import { $ } from '../util';
import { CARDS } from '../config';
import { maxHp, maxMana } from '../formulas';
import { refreshKeyLabels } from '../ui/hud';
import { ACTIONS, binds, saveBinds, keyName, actionForCode, resetBinds } from '../input';
import { resetGame } from '../player';
import { PAD_ACTIONS, padBinds, padLabel, resetPadBinds, savePadBinds } from '../gamepad';

// Level-Up-Karten
export function showCards() {
  state.paused = true;
  const available = CARDS.filter(c => (state.cardRanks[c.id] || 0) < c.max);
  const picks = available.sort(() => Math.random() - 0.5).slice(0, 3);
  $('cardLvl').textContent = String(player.level - state.pendingLevelUps + 1);
  $('cards').innerHTML = '';
  for (const c of picks) {
    const rank = state.cardRanks[c.id] || 0;
    const el = document.createElement('div');
    el.className = 'card frame';
    el.innerHTML = `<h3 class="title">${c.name}</h3>
      <div class="src">${c.verified ? 'Classic-Talent (Wert belegt)' : 'Prototyp-Upgrade'}</div>
      <p>${c.desc(rank)}</p><div class="rank">Rang ${rank + 1} / ${c.max}</div>`;
    el.addEventListener('click', () => pickCard(c));
    $('cards').appendChild(el);
  }
  $('cardModal').classList.add('show');
  ding();
}

function pickCard(card) {
  card.apply(state.cardRanks[card.id] || 0);
  state.cardRanks[card.id] = (state.cardRanks[card.id] || 0) + 1;
  state.pendingLevelUps--;
  player.hp = maxHp();                 // Ding füllt auf
  player.mana = maxMana();
  $('cardModal').classList.remove('show');
  if (state.pendingLevelUps > 0) showCards();
  else state.paused = false;
}

// Tastenbelegung-Menü
let selectedPad = null;   // bleibt beim Neuaufbau der Liste gewählt
export function openBinds() {
  state.paused = true;
  renderBinds();
  $('bindModal').classList.add('show');
}
export function closeResetConfirm() { $('resetModal').classList.remove('show'); }
export function closeBinds() {
  closeResetConfirm();
  state.rebinding = null;
  state.padRebinding = null;
  $('bindModal').classList.remove('show');
  state.paused = $('startModal').classList.contains('show') || $('cardModal').classList.contains('show') || player.dead;
}
export function renderBinds() {
  const list = $('bindList');
  list.innerHTML = '';
  for (const a of ACTIONS) {
    if (a.group) { list.insertAdjacentHTML('beforeend', `<div class="group">${a.group}</div>`); continue; }
    const label = document.createElement('span');
    label.textContent = a.label;
    const btn = document.createElement('button');
    btn.className = 'bindBtn' + (state.rebinding === a.id ? ' waiting' : '');
    btn.textContent = state.rebinding === a.id ? 'Taste drücken …' : binds[a.id].key;
    btn.addEventListener('click', () => { state.rebinding = a.id; renderBinds(); });
    list.append(label, btn, a.id in padBinds ? padBindBtn(a.id) : document.createElement('span'));
  }
  list.insertAdjacentHTML('beforeend', '<div class="group">Nur Pad</div>');
  for (const a of PAD_ACTIONS) {
    if (ACTIONS.some(k => k.id === a.id)) continue;
    const label = document.createElement('span');
    label.textContent = a.label;
    list.append(label, document.createElement('span'), padBindBtn(a.id));
  }
  list.querySelector(`[data-pad="${selectedPad}"]`)?.classList.add('selected');
}
function padBindBtn(id) {
  const btn = document.createElement('button');
  btn.className = 'bindBtn padBtn' + (state.padRebinding === id ? ' waiting' : '');
  btn.dataset.pad = id;
  btn.textContent = state.padRebinding === id ? '…' : padLabel(padBinds[id]);
  btn.addEventListener('click', () => { state.padRebinding = id; state.rebinding = null; selectedPad = id; renderBinds(); });
  return btn;
}
export function setBind(id, e) {
  const other = actionForCode(e.code);
  if (other && other !== id) binds[other] = { code: '', key: '–' };   // Doppelbelegung aufheben
  binds[id] = { code: e.code, key: keyName(e) };
  saveBinds();
  refreshKeyLabels();
}

// Ding-Sound
let audio;
function ding() {
  try {
    audio = audio || new AudioContext();
    const t = audio.currentTime;
    for (const [freq, delay] of [[784, 0], [1175, 0.12]]) {
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.25, t + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.9);
      osc.connect(gain).connect(audio.destination);
      osc.start(t + delay); osc.stop(t + delay + 1);
    }
  } catch { /* kein Audio – egal */ }
}

$('startBtn').addEventListener('click', () => { $('startModal').classList.remove('show'); state.paused = false; ding(); });
$('restartBtn').addEventListener('click', () => {
  $('deathModal').classList.remove('show');
  resetGame();
  state.paused = false;
});
$('bindsOpen').addEventListener('click', openBinds);
$('bindsClose').addEventListener('click', closeBinds);
// Abbrechen hat den Fokus, damit Enter oder Leertaste nichts löscht
$('bindsReset').addEventListener('click', () => { state.rebinding = null; state.padRebinding = null; renderBinds(); $('resetModal').classList.add('show'); $('resetNo').focus(); });
$('resetNo').addEventListener('click', closeResetConfirm);
$('resetYes').addEventListener('click', () => { resetBinds(); resetPadBinds(); saveBinds(); savePadBinds(); refreshKeyLabels(); renderBinds(); closeResetConfirm(); });
