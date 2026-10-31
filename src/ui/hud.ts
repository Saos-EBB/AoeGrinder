import * as THREE from 'three';
import { state, player } from '../state';
import { $, rand, clamp, dist2d } from '../util';
import { CFG, SPELLS, SPELL_ACTIONS } from '../config';
import { xpColor, xpNeeded, maxHp, maxMana, manaCost, spellCd } from '../formulas';
import { camera, renderer } from '../render';
import { ACTIONS, binds } from '../input';
import { castSpell, cdEnd as spellCdEnd } from '../spells/core';
import { padBinds, padLabel } from '../gamepad';

export const overlay = $('overlay');

function screenPos(pos, height) {
  const p = new THREE.Vector3(pos.x, pos.y + height, pos.z).project(camera);
  if (p.z > 1) return null;
  return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight };
}

export function combatText(pos, text, cls, height = 2) {
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
    el.innerHTML = `<span class="key"></span>${SPELLS[id].name}<div class="cd"></div><div class="cdText"></div>`;
    el.addEventListener('click', () => castSpell(id));
    bar.appendChild(el);
    slots[id] = { el, action: action.id, key: el.querySelector('.key'), cd: el.querySelector('.cd'), cdText: el.querySelector('.cdText') };
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
      `${p('bliz')} halten: Slot 3 zielen · ${p('zoomIn')} ${p('zoomOut')} Zoom`;
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

export function updateHud() {
  const hpMax = maxHp(), manaMax = maxMana();
  $('lvl').textContent = player.level;
  $('luck').textContent = String(player.luck).replace('.', ',');
  $('hpFill').style.transform = `scaleX(${clamp(player.hp / hpMax, 0, 1)})`;
  $('hpText').textContent = `${Math.ceil(Math.max(0, player.hp))} / ${hpMax}`;
  $('manaFill').style.transform = `scaleX(${clamp(player.mana / manaMax, 0, 1)})`;
  $('manaText').textContent = `${Math.floor(player.mana)} / ${manaMax}`;
  const fsrLeft = clamp(1 - (state.now - player.lastManaUse) / CFG.fiveSecRule, 0, 1);
  $('fsrFill').style.width = `${fsrLeft * 100}%`;
  $('status').textContent = player.stunUntil > state.now ? 'Betäubt (Blink löst)' : player.poison ? `Gift ×${player.poison.stacks}` : player.slowUntil > state.now ? 'Verflucht: langsamer' : player.drink ? 'Trinkt …' : state.autorun ? 'Autorun' : fsrLeft > 0 ? '5-Sekunden-Regel: keine Regeneration' : '';

  const need = xpNeeded();
  $('xpFill').style.transform = `scaleX(${player.xp / need})`;
  $('xpText').textContent = `XP ${player.xp} / ${need}`;

  $('iTime').textContent = fmtTime(state.now);
  $('iKills').textContent = player.kills;
  $('iCombat').textContent = String(state.mobs.filter(m => !m.dead && (m.state === 'combat' || m.state === 'flee')).length);

  // Castbar (Channel läuft von rechts nach links wie in WoW)
  const ch = player.channel, dr = player.drink;
  if (ch || dr) {
    const bar = ch || dr;
    const left = clamp((bar.end - state.now) / (bar.end - bar.start), 0, 1);
    $('castbar').style.display = 'block';
    $('castFill').style.transform = `scaleX(${left})`;
    $('castText').textContent = `${ch ? SPELLS[ch.id].name : 'Trinken'} ${((bar.end - state.now) / 1000).toFixed(1)}`;
  } else $('castbar').style.display = 'none';

  for (const [id, sl] of Object.entries<any>(slots)) {
    const own = spellCdEnd(id);
    const total = own > player.gcdUntil ? spellCd(id) : CFG.gcd;
    const left = Math.max(0, Math.max(own, player.gcdUntil) - state.now);
    const pct = left > 0 ? left / total * 100 : 0;
    sl.cd.style.background = pct > 0 ? `conic-gradient(#000a ${pct}%, transparent 0)` : 'none';
    sl.cdText.textContent = own - state.now > 1500 ? Math.ceil(left / 1000) : '';
    sl.el.classList.toggle('nomana', player.mana < manaCost(id));
    sl.el.classList.toggle('active', player.targeting === id || ch?.id === id || (player.targeting === true && state.slots[2] === id) || (id === 'drink' && !!dr));
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
