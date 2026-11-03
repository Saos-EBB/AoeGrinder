import * as THREE from 'three';
import { viewW, viewH } from '../device';
import { state, player } from '../state';
import { $, rand, clamp, dist2d } from '../util';
import { CFG, SPELLS, CARDS, SPELL_ACTIONS, LEVEL_MAX } from '../config';
import { xpColor, xpNeeded, maxHp, maxMana, manaCost, spellCd } from '../formulas';
import { camera, renderer } from '../render';
import { ACTIONS, binds } from '../input';
import { castSpell, paysLife, cdEnd as spellCdEnd, saveRunBuild, chargesOf } from '../spells/core';
import { padBinds, padLabel } from '../gamepad';
import { onCrit } from '../fx/impact';
import { zone } from '../world';
import { run } from '../score';
import { rune } from '../spells/core';
import { SUPPORTS } from '../spells/supports';
import { manaCost as costOf } from '../formulas';
import { ICONS } from './icons';
import { UI } from './uiConfig';
import './hudLayout';

document.documentElement.style.setProperty('--slot', `${UI.slotPx}px`);

export const overlay = $('overlay');

export function screenPos(pos, height) {
  const p = new THREE.Vector3(pos.x, pos.y + height, pos.z).project(camera);
  if (p.z > 1) return null;
  return { x: (p.x + 1) / 2 * viewW(), y: (1 - p.y) / 2 * viewH() };
}

export function combatText(pos, text, cls, height = 2) {
  if (cls === 'crit') onCrit();
  const p = screenPos(pos, height);
  if (!p) return;
  const el = document.createElement('div');
  el.className = `ct ${cls}`;
  el.textContent = text;
  el.style.left = `${p.x + rand(-18, 18)}px`;
  el.style.top = `${p.y}px`;
  overlay.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

export function showError(msg) {
  const el = $('err');
  el.textContent = msg;
  el.classList.remove('show');
  void el.offsetWidth;               // Animation neu starten
  el.classList.add('show');
}

export const fmtTime = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

// Actionbar: wächst mit den belegten Slots
let slots: any = {};
export function renderActionbar() {
  const bar = $('actionbar');
  bar.innerHTML = '';
  slots = {};
  state.slots.forEach((id, i) => {
    const action = ACTIONS.find(a => a.id === SPELL_ACTIONS[i]);
    action.label = id ? `Slot ${i + 1}: ${SPELLS[id].name}` : `Slot ${i + 1}: leer`;
    if (!id) return;
    const el = document.createElement('div');
    el.className = `slot ${SPELLS[id].cls}`;
    el.title = SPELLS[id].name;
    if (ICONS[id]) { el.style.backgroundImage = `url(${ICONS[id]})`; el.classList.add('hasIcon'); }
    el.innerHTML = `<span class="key"></span><span class="name">${SPELLS[id].name}</span><span class="cost"></span><span class="charges"></span><div class="cd"></div><div class="cdText"></div>`;
    el.addEventListener('click', () => castSpell(id));
    bar.appendChild(el);
    slots[id] = { el, action: action.id, key: el.querySelector('.key'), cost: el.querySelector('.cost'), charges: el.querySelector('.charges'), cd: el.querySelector('.cd'), cdText: el.querySelector('.cdText') };
  });
  labelSlots();
}
function labelSlots() {
  const onPad = state.lastInput === 'pad';
  for (const id in slots) slots[id].key.textContent = onPad ? padLabel(padBinds[slots[id].action] ?? -1) : binds[slots[id].action].key;
}

export function refreshKeyLabels() {
  const onPad = state.lastInput === 'pad';
  renderActionbar();
  if (onPad) {
    const p = id => `<b>${padLabel(padBinds[id])}</b>`;
    $('help').innerHTML =
      `<b>Linker Stick</b> laufen · <b>Rechter Stick</b> Kamera<br>` +
      `${p('jump')} springen · ${p('autorun')} Autorun · ${p('camBehind')} Kamera hinter Figur<br>` +
      `Bodenziel: Taste halten, rechter Stick zielt · ${p('zoomIn')} ${p('zoomOut')} Zoom`;
    return;
  }
  const b = id => `<b>${binds[id].key}</b>`;
  $('help').innerHTML =
    `${b('forward')} ${b('back')} vor/zurück · ${b('turnLeft')} ${b('turnRight')} drehen<br>` +
    `${b('strafeLeft')} ${b('strafeRight')} seitwärts · ${b('jump')} springen · ${b('autorun')} Autorun<br>` +
    `<b>LMB ziehen</b> Kamera · <b>RMB ziehen</b> Charakter<br><b>Mausrad</b> Zoom`;
}

// Dev: Leistungsanzeige. Draw Calls über den ganzen Frame, inklusive Bloom-Durchgänge
let perfOn = false, perfFrames = 0, perfSince = performance.now();
export const perfEnabled = () => perfOn;
export function togglePerf() {
  perfOn = !perfOn;
  $('perf').hidden = !perfOn;
  perfFrames = 0;
  perfSince = performance.now();
}
export function updatePerf(t) {
  const calls = renderer.info.render.calls;
  renderer.info.reset();
  if (!perfOn) return;
  perfFrames++;
  if (t - perfSince < 500) return;
  $('perf').textContent = `${Math.round(perfFrames * 1000 / (t - perfSince))} FPS · ${calls} Calls · ${state.mobs.length} Mobs`;
  perfFrames = 0;
  perfSince = t;
}

// Links die Effekte und Runen mit Stacks, rechts die Relikte. Nur neu bauen, wenn sich der Inhalt ändert.
let chipKey = '', relicKey = '';
function updateBuildChips() {
  const chips = [];
  if (player.poison) chips.push(['Gift', player.poison.stacks]);
  for (const [id, r] of Object.entries<any>(state.runes ?? {})) { const def = rune(id); if (r && def) chips.push([def.name, 0]); }
  for (const id of Object.keys(state.supports ?? {})) chips.push([SUPPORTS.find(x => x.id === id)?.name ?? id, 0]);
  for (const [id, n] of Object.entries<any>(state.cardRanks ?? {})) if (n) chips.push([CARDS.find(c => c.id === id)?.name ?? id, n]);
  const key = JSON.stringify(chips);
  if (key !== chipKey) {
    chipKey = key;
    $('hudEffects').innerHTML = chips.map(([name, n]) => `<span class="fxChip">${name}${n ? `<b>${n}</b>` : ''}</span>`).join('');
  }
  const relics = state.slots.filter(id => id && SPELLS[id].relic), rk = relics.join();
  if (rk !== relicKey) {
    relicKey = rk;
    $('hudRelics').innerHTML = relics.map(id => `<div class="relicBox">${SPELLS[id].name}</div>`).join('');
  }
}

export function updateHud() {
  saveRunBuild();
  const hpMax = maxHp(), manaMax = maxMana();
  $('lvl').textContent = player.level;
  $('luck').textContent = String(player.luck).replace('.', ',');
  $('hpFill').style.transform = `scaleX(${clamp(player.hp / hpMax, 0, 1)})`;
  $('hpText').textContent = `${Math.ceil(Math.max(0, player.hp))} / ${hpMax}`;
  $('manaFill').style.transform = `scaleX(${clamp(player.mana / manaMax, 0, 1)})`;
  $('manaText').textContent = player.resLabel ?? `${Math.floor(player.mana)} / ${manaMax}${player.resNote ? ` · ${player.resNote}` : ''}`;   // resNote: z. B. Blutrausch-Stapel
  const fsrLeft = clamp(1 - (state.now - player.lastManaUse) / CFG.fiveSecRule, 0, 1);
  $('fsrFill').style.width = `${fsrLeft * 100}%`;
  $('status').textContent = player.stunUntil > state.now ? 'Betäubt (Blink löst)' : player.poison ? `Gift ×${player.poison.stacks}` : player.slowUntil > state.now ? 'Verflucht: langsamer' : player.drink ? (player.drink.label ? 'Isst …' : 'Trinkt …') : state.autorun ? 'Autorun' : fsrLeft > 0 ? '5-Sekunden-Regel: keine Regeneration' : '';

  const need = xpNeeded();
  const atMax = player.level >= LEVEL_MAX;
  $('xpFill').style.transform = `scaleX(${atMax ? 1 : player.xp / need})`;
  $('xpText').textContent = atMax ? 'Max' : `${player.xp} / ${need}`;

  $('iTime').textContent = fmtTime(state.now);
  $('iKills').textContent = player.kills;
  $('iCombat').textContent = String(state.mobs.filter(m => !m.dead).length);
  $('hZone').textContent = zone.name;
  $('hMulti').textContent = run.bestMulti > 1 ? `×${run.bestMulti}` : '–';
  updateBuildChips();

  // Castbar (Channel läuft von rechts nach links wie in WoW)
  const ch = player.channel, dr = player.drink, ct = player.casting;
  if (ct) {                                 // Zauber füllt von links nach rechts
    $('castbar').style.display = 'block';
    $('castFill').style.transform = `scaleX(${clamp(1 - (ct.end - state.now) / ct.total, 0, 1)})`;
    $('castText').textContent = `${SPELLS[ct.id].name} ${((ct.end - state.now) / 1000).toFixed(1)}`;
  } else if (ch || dr) {
    const bar = ch || dr;
    const left = clamp((bar.end - state.now) / (bar.end - bar.start), 0, 1);
    $('castbar').style.display = 'block';
    $('castFill').style.transform = `scaleX(${left})`;
    $('castText').textContent = `${ch ? SPELLS[ch.id].name : dr.label ?? 'Trinken'} ${((bar.end - state.now) / 1000).toFixed(1)}`;
  } else $('castbar').style.display = 'none';

  for (const [id, sl] of Object.entries<any>(slots)) {
    const own = spellCdEnd(id);
    const total = own > player.gcdUntil ? spellCd(id) : CFG.gcd;
    const left = Math.max(0, Math.max(own, player.gcdUntil) - state.now);
    const pct = left > 0 ? left / total * 100 : 0;
    sl.cd.style.background = pct > 0 ? `conic-gradient(#000a ${pct}%, transparent 0)` : 'none';
    sl.cdText.textContent = own - state.now > 1500 ? Math.ceil(left / 1000) : '';
    const cost = paysLife(id) ? 0 : costOf(id), maxCharges = chargesOf(id) ?? 0;
    sl.cost.textContent = cost > 0 ? cost : '';
    sl.charges.textContent = maxCharges > 1 ? (player.charges[id] ?? []).filter(t => t <= state.now).length || (player.charges[id] ? 0 : maxCharges) : '';
    sl.el.classList.toggle('nomana', !paysLife(id) && player.mana < manaCost(id));
    sl.el.classList.toggle('active', player.targeting === id || ch?.id === id || ct?.id === id || ((id === 'drink' || id === 'kEat') && !!dr));
  }

  // Nameplates
  for (const m of state.mobs) {
    if (m.dead) continue;
    const d = dist2d(m.pos, player.pos);
    const show = !m.hidden && (state.stormK > 0.5 ? d < 20 : m.state !== 'idle' || d < 35);   // PH: Sandsturm
    const p = show && screenPos(m.pos, 2.3);
    if (!p) { m.plate.style.display = 'none'; continue; }
    m.plate.style.display = 'block';
    m.plate.style.left = `${p.x}px`;
    m.plate.style.top = `${p.y - 24}px`;
    m.plateHp.style.width = `${m.hp / m.maxHp * 100}%`;
    m.plateLv.textContent = m.level;
    m.plateLv.style.color = xpColor(m.level);
  }
}
