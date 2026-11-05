import * as THREE from 'three';
import { viewW, viewH } from '../device';
import { state, player } from '../state';
import { $, rand, clamp, dist2d } from '../util';
import { CFG, SPELLS, CARDS, SPELL_ACTIONS, LEVEL_MAX } from '../config';
import { xpColor, xpNeeded, maxHp, maxMana, manaCost, spellCd } from '../formulas';
import { camera, renderer } from '../render';
import { ACTIONS, binds } from '../input';
import { castSpell, paysLife, cdEnd as spellCdEnd, saveRunBuild, chargesOf, isGround } from '../spells/core';
import { padBinds, padLabel } from '../gamepad';
import { onCrit } from '../fx/impact';
import { zone } from '../world';
import { run } from '../score';
import { rune } from '../spells/core';
import { SUPPORTS } from '../spells/supports';
import { manaCost as costOf } from '../formulas';
import { ICONS } from './icons';
import { attachSpellCard, hideSpellCards } from './spellCard';
import { slotAt, swapPos, modeAt, setModeAt, MODE_NAMES, type CastMode } from '../hotbar';
import { UI } from './uiConfig';
import { uiSettings } from './uiSettings';
import './hudLayout';
import { meterSchool, meterValue, meterHeat, meterOverheated } from '../schoolMeter';
import { SCHOOL_METER, RANDOM_MAGE } from '../config';
import { markStacks } from '../plagueMarks';
import { buffs } from '../buffs';
import { batteryMode } from '../battery';
import { BATTERY } from '../config';

document.documentElement.style.setProperty('--slot', `${UI.slotPx}px`);

export const overlay = $('overlay');

export function screenPos(pos, height) {
  const p = new THREE.Vector3(pos.x, pos.y + height, pos.z).project(camera);
  if (p.z > 1) return null;
  return { x: (p.x + 1) / 2 * viewW(), y: (1 - p.y) / 2 * viewH() };
}

export function combatText(pos, text, cls, height = 2) {
  if (cls === 'crit') onCrit();
  if (cls === 'heal' && !uiSettings.healNums && /^\+\d+$/.test(text)) return;   // nur Heilzahlen, Texte wie „Phönix!“ bleiben
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

// Hotbar: feste Plätze, die Tasten gehören den Plätzen (hotbar.ts). Spells lassen sich per Drag & Drop umsetzen,
// Rechtsklick wählt den Auslöse-Modus des Platzes (Sofort, Bei Loslassen, Klicken). Leere Plätze bleiben als Rahmen stehen.
let slots: any = {}, empties: any[] = [];
const MODE_TAG = { instant: '', release: '⇡', click: '◎' };   // kleines Zeichen unten in der Mitte; Sofort ohne Zeichen
export function renderActionbar() {
  const bar = $('actionbar');
  bar.innerHTML = '';
  slots = {};
  empties = [];
  SPELL_ACTIONS.forEach((actionId, pos) => {
    const id = state.slots[slotAt(pos)] ?? null;
    const action = ACTIONS.find(a => a.id === actionId);
    action.label = id ? `Leiste ${pos + 1}: ${SPELLS[id].name}` : `Leiste ${pos + 1}: leer`;
    const el = document.createElement('div');
    el.dataset.pos = String(pos);
    if (!id) {
      el.className = 'slot empty';
      el.innerHTML = '<span class="key"></span>';
      empties.push({ el, action: actionId, key: el.querySelector('.key') });
    } else {
      el.className = `slot ${SPELLS[id].cls}`;
      el.title = SPELLS[id].name;
      el.draggable = true;
      if (ICONS[id]) { el.style.backgroundImage = `url(${ICONS[id]})`; el.classList.add('hasIcon'); }
      const tag = MODE_TAG[modeAt(pos, isGround(id) && !SPELLS[id].press)];
      el.innerHTML = `<span class="key"></span><span class="name">${SPELLS[id].name}</span><span class="cost"></span><span class="charges"></span><div class="cd"></div><div class="cdText"></div>${SPELLS[id].preview ? '<span class="next"></span>' : ''}${tag ? `<span class="mode">${tag}</span>` : ''}`;
      el.addEventListener('click', () => castSpell(id));
      el.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', String(pos)); e.dataTransfer.effectAllowed = 'move'; el.classList.add('dragging'); hideSpellCards(); });
      el.addEventListener('dragend', () => el.classList.remove('dragging'));
      el.addEventListener('contextmenu', e => { e.preventDefault(); openModeMenu(el, pos, id); });
      attachSpellCard(el, id);
      slots[id] = { el, action: actionId, key: el.querySelector('.key'), cost: el.querySelector('.cost'), charges: el.querySelector('.charges'), cd: el.querySelector('.cd'), cdText: el.querySelector('.cdText'), next: el.querySelector('.next'), shown: '' };
    }
    // Jeder Platz nimmt Spells an: tauscht mit dem gezogenen Platz
    el.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('dropOver'); });
    el.addEventListener('dragleave', () => el.classList.remove('dropOver'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      const from = +e.dataTransfer.getData('text/plain');
      if (Number.isInteger(from)) { swapPos(from, pos); renderActionbar(); }
    });
    bar.appendChild(el);
  });
  labelSlots();
}
function labelSlots() {
  const onPad = state.lastInput === 'pad';
  const label = action => onPad ? padLabel(padBinds[action] ?? -1) : binds[action]?.key ?? '';
  for (const id in slots) slots[id].key.textContent = label(slots[id].action);
  for (const e of empties) e.key.textContent = label(e.action);
}
// Auswahl des Auslöse-Modus am Platz
let modeMenu: HTMLDivElement = null;
function openModeMenu(el, pos, id) {
  modeMenu?.remove();
  const ground = isGround(id) && !SPELLS[id].press, cur = modeAt(pos, ground);
  const menu = modeMenu = document.createElement('div');
  menu.className = 'modeMenu';
  menu.innerHTML = `<div class="mmHead">${SPELLS[id].name}</div>` + (Object.keys(MODE_NAMES) as CastMode[]).map(m =>
    `<button data-m="${m}" class="${m === cur ? 'on' : ''}">${MODE_NAMES[m]}<small>${MODE_HINT[m](ground)}</small></button>`).join('');
  document.body.appendChild(menu);
  const r = el.getBoundingClientRect();
  menu.style.left = `${Math.max(4, Math.min(innerWidth - menu.offsetWidth - 4, r.left + r.width / 2 - menu.offsetWidth / 2))}px`;
  menu.style.top = `${Math.max(4, r.top - menu.offsetHeight - 8)}px`;
  menu.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    setModeAt(pos, b.dataset.m as CastMode);
    closeModeMenu();
    renderActionbar();
  });
  setTimeout(() => addEventListener('pointerdown', outside, true));
}
const MODE_HINT = {
  instant: g => g ? 'beim Drücken, unter der Maus' : 'beim Drücken',
  release: g => g ? 'Zielkreis halten, beim Loslassen' : 'beim Loslassen',
  click: g => g ? 'Zielkreis, dann Klick' : 'beim Drücken',
};
function outside(e) { if (modeMenu && !modeMenu.contains(e.target)) closeModeMenu(); }
function closeModeMenu() { modeMenu?.remove(); modeMenu = null; removeEventListener('pointerdown', outside, true); }

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
  const devFps = $('devPanel').hidden ? null : $('devFps');
  if (!perfOn && !devFps) return;
  perfFrames++;
  if (t - perfSince < 500) return;
  if (devFps) devFps.textContent = `FPS ${Math.round(perfFrames * 1000 / (t - perfSince))} · Calls ${calls} · Mobs ${state.mobs.length}`;
  if (perfOn) $('perf').textContent = `${Math.round(perfFrames * 1000 / (t - perfSince))} FPS · ${calls} Calls · ${state.mobs.length} Mobs · Dodges ${state.dodgeStats?.n ?? 0}, perfekt ${state.dodgeStats?.perfect ?? 0}`;
  perfFrames = 0;
  perfSince = t;
}

// ?-Magier: der nächste Wurf klein im Slot, als Icon oder Kurzname
function showNext(sl, pid) {
  if (sl.shown === pid) return;
  sl.shown = pid;
  const drink = RANDOM_MAGE.drinks[pid], icon = ICONS[pid];
  sl.next.style.backgroundImage = icon ? `url(${icon})` : '';
  sl.next.textContent = icon ? '' : drink?.short ?? SPELLS[pid]?.name ?? '';
  sl.next.title = drink?.name ?? SPELLS[pid]?.name ?? '';
}

// Links die Effekte und Runen mit Stacks, rechts die Relikte. Nur neu bauen, wenn sich der Inhalt ändert.
let chipKey = '', relicKey = '';
function updateBuildChips() {
  const chips = [];
  if (player.poison) chips.push(['Gift', player.poison.stacks]);
  for (const b of buffs()) chips.push([b.name, Math.ceil((b.until - state.now) / 1000)]);   // Getränke des ?-Magiers, Zahl = Sekunden
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

// Kill-Anzeige unter Mana, nur in den Schul-Modi
let meterKey = '', manaBattery = false;
function updateMeterBar() {
  const school = meterSchool(), el = $('meter');
  el.hidden = !school;
  if (!school) return;
  const M: any = SCHOOL_METER[school], v = meterValue();
  if (school === 'Feuer') {                 // Hitze: orange, ab hotFrom rot, überhitzt pulsiert rot
    const heat = meterHeat(), over = meterOverheated(), color = over || heat >= M.hotFrom ? M.hot : M.color, key = `Feuer${color}`;
    if (meterKey !== key) { meterKey = key; el.style.setProperty('--meter', color); $('meterFill').style.background = `linear-gradient(${color}, ${color}88)`; }
    $('meterFill').style.transform = `scaleX(${v})`;
    $('meterText').textContent = over ? `Überhitzt · ${Math.floor(heat)}` : `Hitze ${Math.floor(heat)}`;
    el.classList.toggle('full', over);
    return;
  }
  const full = v >= 1;
  if (meterKey !== school) { meterKey = school; el.style.setProperty('--meter', M.color); $('meterFill').style.background = `linear-gradient(${M.color}, ${M.color}88)`; }
  if (school === 'Arkan') { $('meterFill').style.transform = `scaleX(${v})`; $('meterText').textContent = `${M.name} ${Math.round(v * M.max)} / ${M.max}`; el.classList.toggle('full', full); return; }
  $('meterFill').style.transform = `scaleX(${v})`;
  $('meterText').textContent = full ? M.full : `${M.name} ${Math.floor(v * 100)} %`;
  el.classList.toggle('full', full);
}

export function updateHud() {
  saveRunBuild();
  const hpMax = maxHp(), manaMax = maxMana();
  $('lvl').textContent = player.level;
  $('luck').textContent = String(player.luck).replace('.', ',');
  const cut = player.hpCut ?? 0;   // Zerstörung: Leben-Balken bezieht sich aufs volle Leben, der verlorene Teil ist grau
  $('hpFill').style.transform = `scaleX(${clamp(player.hp / hpMax * (1 - cut), 0, 1)})`;
  $('hpCut').style.width = `${cut * 100}%`;
  $('hpText').textContent = `${Math.ceil(Math.max(0, player.hp))} / ${hpMax}`;
  $('manaFill').style.transform = `scaleX(${clamp(player.mana / manaMax, 0, 1)})`;
  $('manaText').textContent = player.resLabel ?? `${Math.floor(player.mana)} / ${manaMax}${player.resNote ? ` · ${player.resNote}` : ''}`;   // resNote: z. B. Blutrausch-Stapel
  updateMeterBar();
  const bat = batteryMode();               // Blitz only: Batterie gelb im Mana-Balken, überladen pulsiert er
  if (bat !== manaBattery) { manaBattery = bat; $('manaFill').style.background = bat ? `linear-gradient(${BATTERY.color}, #b89a10)` : ''; }
  $('hudMana').classList.toggle('over', bat && !!player.overcharged);
  const fsrLeft = clamp(1 - (state.now - player.lastManaUse) / CFG.fiveSecRule, 0, 1);
  $('fsrFill').style.width = `${fsrLeft * 100}%`;
  $('status').textContent = player.stunUntil > state.now ? 'Betäubt (Blink löst)' : player.poison ? `Gift ×${player.poison.stacks}` : player.slowUntil > state.now ? 'Verflucht: langsamer' : player.drink ? (player.drink.pose === 'charge' ? 'Lädt auf …' : player.drink.label && !player.drink.custom ? 'Isst …' : 'Trinkt …') : state.autorun ? 'Autorun' : fsrLeft > 0 ? '5-Sekunden-Regel: keine Regeneration' : '';

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
    const total = spellCd(id);
    const left = Math.max(0, own - state.now);
    const pct = left > 0 ? left / total * 100 : 0;
    sl.cd.style.background = pct > 0 ? `conic-gradient(#000a ${pct}%, transparent 0)` : 'none';
    sl.cdText.textContent = own - state.now > 1500 ? Math.ceil(left / 1000) : '';
    const cost = paysLife(id) ? 0 : costOf(id), maxCharges = chargesOf(id) ?? 0;
    sl.cost.textContent = cost > 0 ? cost : '';
    sl.charges.textContent = maxCharges > 1 ? (player.charges[id] ?? []).filter(t => t <= state.now).length || (player.charges[id] ? 0 : maxCharges) : '';
    if (sl.next) showNext(sl, SPELLS[id].preview());
    sl.el.classList.toggle('nomana', !paysLife(id) && player.mana < manaCost(id));
    sl.el.classList.toggle('active', player.targeting === id || ch?.id === id || ct?.id === id || ((id === 'drink' || id === 'kEat' || id === 'rDrink') && !!dr));
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
    const inf = markStacks(m);   // Seuchen-Mal: Stapel am Namensschild
    if (inf || m.plateInf) {
      if (!m.plateInf) { m.plateInf = document.createElement('b'); m.plateInf.style.cssText = 'color:#8ee04a;margin-left:4px'; m.plate.firstElementChild.after(m.plateInf); }
      m.plateInf.textContent = inf ? `${inf}` : '';
    }
  }
}
