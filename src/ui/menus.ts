import { state, player } from '../state';
import { $ } from '../util';
import { SPELLS, CARD_RARITIES } from '../config';
import { rollOffer } from '../cards';
import { maxHp, maxMana } from '../formulas';
import { refreshKeyLabels, renderActionbar, togglePerf, perfEnabled } from '../ui/hud';
import { resetSpells, learnSpell, stopChannel, clearSpellEffects } from '../spells/core';
import { ACTIONS, binds, saveBinds, keyName, actionForCode, resetBinds } from '../input';
import { resetGame, switchZone } from '../player';
import { ZONES } from '../zones';
import { zoneId } from '../world';
import { PAD_ACTIONS, padBinds, padLabel, resetPadBinds, savePadBinds } from '../gamepad';

// Level-Up-Karten
export function showCards() {
  state.paused = true;
  $('cardLvl').textContent = String(player.level - state.pendingLevelUps + 1);
  $('cardHint').textContent = '';
  $('cards').innerHTML = '';
  for (const c of rollOffer()) {
    const r = CARD_RARITIES[c.tier];
    const el = document.createElement('div');
    el.className = 'card frame';
    el.style.borderColor = r.color;
    el.innerHTML = `<h3 class="title" style="color:${r.color}">${c.name}</h3>
      <div class="src">${c.src}</div>
      <p>${c.desc(r.mult)}</p><div class="rank" style="color:${r.color}">${r.name} ×${String(r.mult).replace('.', ',')}</div>`;
    el.addEventListener('click', () => pickCard(c));
    $('cards').appendChild(el);
  }
  $('cardModal').classList.add('show');
  ding();
}

function pickCard(card) {
  card.apply(CARD_RARITIES[card.tier].mult);
  if (!card.learn) return finishCard();
  const free = state.slots.indexOf(null);
  if (free >= 0) { learnSpell(card.learn, free); return finishCard(); }
  chooseReplacement(card.learn);
}

// Alle Slots voll: Spieler wählt, welcher Spell ersetzt wird
function chooseReplacement(id) {
  $('cardHint').textContent = `${SPELLS[id].name} ersetzt welchen Spell?`;
  $('cards').innerHTML = '';
  state.slots.forEach((old, slot) => {
    if (SPELLS[old].fixed) return;
    const el = document.createElement('div');
    el.className = 'card frame';
    el.innerHTML = `<h3 class="title">${SPELLS[old].name}</h3><div class="src">Slot ${slot + 1}</div><p>${SPELLS[old].desc}</p>`;
    el.addEventListener('click', () => { learnSpell(id, slot); finishCard(); });
    $('cards').appendChild(el);
  });
}

function finishCard() {
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
  renderDevZones();
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

// Dev: Zonenwechsel
function renderDevZones() {
  $('devPerf').textContent = `Leistungsanzeige: ${perfEnabled() ? 'an' : 'aus'}`;
  const box = $('devZones');
  box.innerHTML = '';
  for (const [id, z] of Object.entries<any>(ZONES)) {
    const b = document.createElement('button');
    b.className = 'bindBtn' + (id === zoneId ? ' selected' : '');
    b.textContent = z.name;
    b.addEventListener('click', () => { stopChannel(true); clearSpellEffects(); switchZone(id); closeBinds(); });
    box.appendChild(b);
  }
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
  stopChannel(true);
  resetGame();
  resetSpells();
  renderActionbar();
  state.paused = false;
});
$('devPerf').addEventListener('click', () => { togglePerf(); renderDevZones(); });
$('bindsOpen').addEventListener('click', openBinds);
$('bindsClose').addEventListener('click', closeBinds);
// Abbrechen hat den Fokus, damit Enter oder Leertaste nichts löscht
$('bindsReset').addEventListener('click', () => { state.rebinding = null; state.padRebinding = null; renderBinds(); $('resetModal').classList.add('show'); $('resetNo').focus(); });
$('resetNo').addEventListener('click', closeResetConfirm);
$('resetYes').addEventListener('click', () => { resetBinds(); resetPadBinds(); saveBinds(); savePadBinds(); refreshKeyLabels(); renderBinds(); closeResetConfirm(); });
