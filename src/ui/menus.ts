import { state, player } from '../state';
import { showLoad } from './loadScreen';
import { $ } from '../util';
import { SPELLS, CARD_RARITIES, SLOT } from '../config';
import { rollOffer, forcedOffer, cardPreview, cardStage, cardReplaces } from '../cards';
import { COLORS, schoolColor } from './colors';
import { markWords } from './keywords';
import { ICONS } from './icons';
import { attachTip } from './tooltip';
import './cards.css';
import { refreshKeyLabels, renderActionbar, showError, togglePerf, perfEnabled } from '../ui/hud';
import { resetSpells, learnSpell, stopChannel, clearSpellEffects } from '../spells/core';
import { ACTIONS, binds, saveBinds, keyName, keyText, actionForCode, resetBinds } from '../input';
import { resetGame, switchZone, newRunMap } from '../player';
import { warLegendary, setWarLegendary, WAR_LEGENDARIES } from '../realMen';
import { LEGENDS } from '../legends';
import { applyRunWeapon } from '../weaponRolls';
import { applyRunGear } from '../gear/apply';
import { heroModel } from '../models/heroModel';
import { ZONES } from '../zones';
import { zoneId } from '../world';
import { renderDevMapGen } from '../mapgen/devMap';
import { mountVolume, getVolume } from '../fx/sound';
import { PAD_ACTIONS, padBinds, padLabel, resetPadBinds, savePadBinds } from '../gamepad';
import { t, fmtNum } from '../i18n';
import { html } from './dom';

const KIND_LOOK = { rang: { name: t('cardui.kind.rang'), icon: '▲' }, spell: { name: t('cardui.kind.spell'), icon: '✦' }, rune: { name: t('cardui.kind.rune'), icon: '✧' }, support: { name: t('cardui.kind.support'), icon: '◆' }, relic: { name: t('cardui.kind.relic'), icon: '♛' }, talent: { name: t('cardui.kind.talent'), icon: '★' }, luck: { name: t('cardui.kind.luck'), icon: '♣' } };
// Level-Up-Karten: bis 3 Karten groß (Mockup K2), 4–10 kompakt in 2 Reihen à 5 (L2). F1–F12 wählen (nicht die Zahlentasten: die zaubern, wer
// beim Level-up Spell 1 spammt, nimmt sonst aus Versehen eine Karte), X öffnet das Charakterfenster.
// Rahmen = Seltenheit, Kopfleiste = Typ, Relikt mit Goldrahmen und gewölbter Oberkante, Upgrade grün mit „Rang x → y“.
const CARD_KEYS = Array.from({ length: 12 }, (_, i) => `F${i + 1}`);   // Karte n = Fn
let offerShown = [];
const cardSpell = c => c.spell ?? c.learn;
function cardIcon(c, kind) {
  const icon = ICONS[cardSpell(c)];
  return icon ? `<div class="lvIcon" style="background-image:url(${icon})"></div>` : `<div class="lvIcon glyph">${kind.icon}</div>`;
}
export function showCards(offer?) {
  offer ??= rollOffer();
  offerShown = offer;
  state.paused = true;
  const big = offer.length <= 3;
  $('cardLvl').textContent = String(player.level);
  $('cardHint').textContent = t('card.hint', { keys: big ? CARD_KEYS.slice(0, offer.length).join(' / ') : `F1–${CARD_KEYS[offer.length - 1]}` });
  $('cards').innerHTML = '';
  $('cards').className = `cards ${big ? 'k2' : 'l2'}`;
  offer.forEach((c, i) => {
    const r = CARD_RARITIES[c.rarity], relic = c.kind === 'relic';
    const el = document.createElement('div'), stage = cardStage(c), rep = cardReplaces(c), kind = KIND_LOOK[c.kind] ?? KIND_LOOK.rang;
    const school = schoolColor(cardSpell(c));
    const col = relic ? COLORS.relic : r.color;
    el.className = `card lvCard${relic ? ' relicCard' : big ? ' fg-deco' : ''}${stage ? ' improves' : ''}`;   // fg-deco: Panel-Ornamente des Flavors (gen5 card_deco)
    el.style.setProperty('--rc', col);
    el.dataset.key = CARD_KEYS[i];
    const up = stage ? `<div class="lvUp">${t('cardui.up', { a: stage, b: stage + 1 })}</div>` : '';
    el.innerHTML = big
      ? `<div class="lvKind">${kind.name}</div>${cardIcon(c, kind)}
        <h3 class="lvName" style="color:${school ?? col}">${c.name}</h3>${up}
        <div class="lvSrc">${c.src}</div>
        <p class="lvText">${markWords(c.desc(r.mult))}</p>
        ${rep ? `<div class="lvRep">⇄ ${rep.label}: <b>${rep.name}</b></div>` : ''}
        <div class="preview">${cardPreview(c, r.mult)}</div>
        <div class="lvRar">${relic ? t('cardui.relic') : r.name} ×${fmtNum(r.mult)}</div><span class="lvKey">${CARD_KEYS[i]}</span>`
      : `<div class="lvKind">${kind.name}</div>${cardIcon(c, kind)}
        <h3 class="lvName" style="color:${school ?? col}">${c.name}</h3>
        <div class="lvSub">${stage ? t('cardui.up', { a: stage, b: stage + 1 }) : c.kind === 'spell' ? t('cardui.new') : c.src}</div>
        <p class="lvText">${markWords(c.desc(r.mult))}</p>
        ${rep ? `<div class="lvRep">⇄ ${rep.label}: <b>${rep.name}</b></div>` : ''}
        ${cardPreview(c, r.mult) ? `<div class="lvPrev">${cardPreview(c, r.mult)}</div>` : ''}
        <div class="lvFoot"><span class="lvRarS">${relic ? t('cardui.relic') : r.name} ×${fmtNum(r.mult)}</span><span class="lvKey">${CARD_KEYS[i]}</span></div>`;
    el.addEventListener('click', () => pickCard(c));
    cardTip(el, c, r, kind, stage, rep, school ?? col);
    $('cards').appendChild(el);
  });
  $('cardModal').classList.add('show');
  ding();
}
// Hover-Karte: voller Text und echte Werte vorher → nachher (Phase 11 übernimmt das Aussehen)
function cardTip(el, c, r, kind, stage, rep, color) {
  const prev = cardPreview(c, r.mult);
  attachTip(el, () => ({ title: c.name, color, sub: `${kind.name} · ${c.relic || c.kind === 'relic' ? t('cardui.relic') : r.name}`, border: el.style.getPropertyValue('--rc'),
    short: markWords(c.desc(r.mult)),
    rows: [stage ? `<span class="tGood">${t('cardui.up', { a: stage, b: stage + 1 })}</span>` : '', prev ? `<span class="tGood">${prev}</span>` : '', rep ? `<span class="tRune">⇄ ${rep.label}: ${rep.name}</span>` : ''].filter(Boolean) }));
}
// F1–F12 wählen eine Karte. Solange die Kartenwahl offen ist, gehören alle F-Tasten ihr: kein Browser (F1 Hilfe, F5 Neu laden, F11 Vollbild;
// F12 lässt sich nicht immer abfangen) und kein Dev-Panel (F10), auch ohne Karte unter der Taste. Capture vor devPanel.ts
addEventListener('keydown', e => {
  if (!$('cardModal').classList.contains('show') || state.rebinding) return;
  const i = CARD_KEYS.indexOf(e.code);
  if (i < 0) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (e.repeat || $('heroModal')?.classList.contains('show')) return;
  $('cards').querySelectorAll<HTMLElement>('.card')[i]?.click();
}, true);

function pickCard(card) {
  state.cardPicks[card.id] = (state.cardPicks[card.id] || 0) + 1;
  card.apply(CARD_RARITIES[card.rarity].mult);
  if (!card.learn) return finishCard();
  if (card.learnSlot != null) { learnSpell(card.learn, card.learnSlot); return finishCard(); }   // Relikt der Figur: eigene Taste
  const free = state.slots.slice(0, SLOT.attacks).indexOf(null);   // nur die 5 Attacken-Slots
  if (free >= 0) { learnSpell(card.learn, free); return finishCard(); }
  chooseReplacement(card.learn);
}

// Alle Slots voll: Spieler wählt, welcher Spell ersetzt wird
function chooseReplacement(id) {
  $('cardHint').textContent = t('card.replaceWhich', { name: SPELLS[id].name });
  $('cards').innerHTML = '';
  // Kandidaten: Attacken-Slots ohne „fixed“. Der Strichkrieger hat nur fixed-Moves: dann stehen diese zur Wahl,
  // sonst bliebe die Ansicht leer und der Run hinge fest. Gibt es gar keinen Slot, verfällt die Karte.
  const attacks = state.slots.map((old, slot) => ({ old, slot })).filter(x => x.slot < SLOT.attacks && x.old);
  const open = attacks.some(x => !SPELLS[x.old].fixed) ? attacks.filter(x => !SPELLS[x.old].fixed) : attacks;
  if (!open.length) return finishCard();
  $('cards').className = `cards ${open.length <= 3 ? 'k2' : 'l2'}`;
  open.forEach(({ old, slot }, i) => {
    const el = document.createElement('div');
    el.className = 'card lvCard';
    el.style.setProperty('--rc', '#ff3d1f');
    el.innerHTML = `<div class="lvKind">${t('cardui.replace')}</div>${ICONS[old] ? `<div class="lvIcon" style="background-image:url(${ICONS[old]})"></div>` : ''}<h3 class="lvName">${SPELLS[old].name}</h3><div class="lvSrc">${t('cardui.slot', { n: slot + 1 })}</div><p class="lvText">${SPELLS[old].desc}</p><div class="lvFoot"><span></span><span class="lvKey">${CARD_KEYS[i]}</span></div>`;
    el.addEventListener('click', () => { learnSpell(id, slot); finishCard(); });
    $('cards').appendChild(el);
  });
}

function finishCard() {
  state.pendingLevelUps--;
  $('cardModal').classList.remove('show');
  syncPause();
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
  syncPause();
}

// Pausiert, solange irgendein Fenster offen ist oder die Figur tot
const BLOCKING = ['heroModal', 'loadModal', 'codeModal', 'startModal', 'cardModal', 'bindModal', 'pauseModal', 'settingsModal', 'deathModal', 'shopModal', 'gearKeepModal'];
export function syncPause() {
  state.paused = player.dead || BLOCKING.some(id => $(id)?.classList.contains('show'));
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
    btn.textContent = state.rebinding === a.id ? t('binds.press') : keyText(binds[a.id].key);
    btn.addEventListener('click', () => { state.rebinding = a.id; renderBinds(); });
    list.append(label, btn, a.id in padBinds ? padBindBtn(a.id) : document.createElement('span'));
  }
  list.insertAdjacentHTML('beforeend', `<div class="group">${t('binds.padOnly')}</div>`);
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
export function renderDevZones() {
  $('devPerf').textContent = `Leistungsanzeige: ${perfEnabled() ? 'an' : 'aus'}`;
  const box = $('devZones');
  box.innerHTML = '';
  for (const [id, z] of Object.entries<any>(ZONES)) {
    const b = document.createElement('button');
    b.className = 'bindBtn' + (id === zoneId ? ' selected' : '');
    b.textContent = z.name;
    b.addEventListener('click', () => { stopChannel(true); clearSpellEffects(); switchZone(id); $('settingsClose').click(); });
    box.appendChild(b);
  }
  renderDevMapGen(box, id => { stopChannel(true); clearSpellEffects(); switchZone(id); renderDevZones(); });   // Seed der generierten Maps (mapgen/devMap.ts)
}

// Dev: Karte erzwingen, Glück
const KIND_NAMES = Object.fromEntries(['rang', 'spell', 'rune', 'support', 'relic', 'talent', 'luck'].map(k => [k, t(`cardui.kindName.${k}`)]));
for (const [id, name] of Object.entries(KIND_NAMES)) $('devKind').insertAdjacentHTML('beforeend', `<option value="${id}">${name}</option>`);
CARD_RARITIES.forEach((r, rarity) => $('devTier').insertAdjacentHTML('beforeend', `<option value="${rarity}">${r.name}</option>`));
$('devForce').addEventListener('click', () => {
  const offer = forcedOffer(($('devKind') as HTMLSelectElement).value, Number(($('devTier') as HTMLSelectElement).value));
  if (!offer.length) return showError(t('dev.noCard'));
  $('settingsClose').click();
  state.pendingLevelUps++;
  showCards(offer);
});
$('devLuck').addEventListener('click', () => { player.luck += 25; });

// Dev: legendäre Waffe des Strichkriegers (realMen.ts LEGENDARY). Wechsel startet den Run neu, damit Kit und Kette stimmen
// Block für ui/devGame.ts (mountDev läuft, wenn alle Module geladen sind)
export function devLegendBlock() {
  const sel = html(`<select class="bindBtn" id="devLegend" style="width:100%;margin-bottom:4px"></select>`) as HTMLSelectElement;
  for (const [id, name] of [['', 'keine'], ...WAR_LEGENDARIES.map(id => [id, LEGENDS[id]?.name ?? id])]) sel.insertAdjacentHTML('beforeend', `<option value="${id}">${name}</option>`);
  sel.value = warLegendary() ?? '';
  sel.addEventListener('change', e => {
    setWarLegendary((e.target as HTMLSelectElement).value || null);
    stopChannel(true);
    resetGame();
    resetSpells();
    renderActionbar();
  });
  return sel;
}

mountVolume($('settingsVol'), 'beforeend');
Object.assign($('bindList').parentElement.style, { maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box' });

// Ding-Sound
let audio;
export function ding() {
  try {
    audio = audio || new AudioContext();
    const t = audio.currentTime;
    for (const [freq, delay] of [[784, 0], [1175, 0.12]]) {
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + delay);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.42 * getVolume()), t + delay + 0.02);   // bei Standard 60 % wie bisher 0,25
      gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.9);
      osc.connect(gain).connect(audio.destination);
      osc.start(t + delay); osc.stop(t + delay + 1);
    }
  } catch { /* kein Audio – egal */ }
}

$('restartBtn').addEventListener('click', () => {
  $('deathModal').classList.remove('show');
  stopChannel(true);
  newRunMap();   // jeder Run eine neue Map (Seed, mapgen/rng.ts)
  resetGame();
  resetSpells();
  applyRunWeapon(!!heroModel.weapon);
  applyRunGear(heroModel.figureId);   // Gear nach der Waffe: hängt seinen Element-Proc an deren Treffer-Hook
  renderActionbar();
  showLoad(syncPause);
  syncPause();
});
$('devPerf').addEventListener('click', () => { togglePerf(); renderDevZones(); });

$('bindsClose').addEventListener('click', closeBinds);
// Abbrechen hat den Fokus, damit Enter oder Leertaste nichts löscht
$('bindsReset').addEventListener('click', () => { state.rebinding = null; state.padRebinding = null; renderBinds(); $('resetModal').classList.add('show'); $('resetNo').focus(); });
$('resetNo').addEventListener('click', closeResetConfirm);
$('resetYes').addEventListener('click', () => { resetBinds(); resetPadBinds(); saveBinds(); savePadBinds(); refreshKeyLabels(); renderBinds(); closeResetConfirm(); });
