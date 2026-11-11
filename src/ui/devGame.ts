// Dev-Panel (F10): baut die Dev-Blöcke und meldet sie bei ui/devPanel.ts an (registerDev). main.ts ruft mountDev einmal, wenn alle Module geladen sind.
// Logik-Dateien bauen keine Dev-UI selbst, sie liefern hier nur Funktionen. Wo der Block im Panel steht, sagt DEV_LAYOUT in devPanel.ts.

import { $ } from '../util';
import { html } from './dom';
import { state, player } from '../state';
import { registerDev } from './devPanel';
import { renderDevZones, devLegendBlock } from './menus';
import { devWorldBlock } from './worldMap';
import { devGearSetBlock } from './lootView';
import { devLevelsBlock, devCollidersBlock } from './leaderboardView';
import { devFeatBlock } from './messages';
import { mountForge } from './devForge';
import { devKosmetikBlock } from './devKosmetik';
import { THEME_DIFF, KIND_IDS, ZUSATZ_IDS, devSpawn } from '../mobKinds';
import { C, AFFIX_IDS, rollAffixes } from '../champions';
import { spawnChampionPack } from '../mobs';
import { devPortal } from '../portal';
import { kindList, spawnObj, devAhead, devButtons, devButton, devTrigger } from '../objects/objects';
import { startBoss } from '../boss';
import { TIERS, BOSSES, poolOf } from '../bosses/roster';
import { DG } from '../dodge';

const val = (id: string) => ($(id) as HTMLSelectElement).value;
const opt = (v, label) => `<option value="${v}">${label}</option>`;

// Mobs: Pack spawnen, Kategorie × Zusatz × Theme (Theme nur als Skin-Wahl, die Map bleibt; mobKinds.ts devSpawn)
const DE = { normal: 'Normal', schnell: 'Schnell', stark: 'Stark', aoe: 'AoE', zauberer: 'Zauberer', werfer: 'Werfer', hexer: 'Hexer', gross: 'Groß', lauerer: 'Lauerer' };
const ZDE = { heal: 'Heilen', shield: 'Schild', haste: 'Tempo', fliegt: 'Fliegt', platzt: 'Platzt', teilt: 'Teilt' };
function devKinds() {
  registerDev('devKinds', html(`<div id="devKinds">
  <select class="bindBtn" id="devKTheme">${Object.keys(THEME_DIFF).map(k => opt(k, k)).join('')}${opt('test', 'test')}</select>
  <select class="bindBtn" id="devKCat">${opt('regeln', 'Pack nach Regeln')}${KIND_IDS.map(k => opt(k, DE[k])).join('')}</select>
  <select class="bindBtn" id="devKZus">${opt('zufall', 'Zusatz: Regeln')}${opt('none', 'kein Zusatz')}${ZUSATZ_IDS.map(k => opt(k, ZDE[k])).join('')}</select>
  <select class="bindBtn" id="devKN">${[1, 3, 6].map(n => opt(n, `× ${n}`)).join('')}</select>
  <button class="bindBtn" id="devKSpawn">Pack spawnen</button></div>`));
  $('devKSpawn').addEventListener('click', () => devSpawn(val('devKTheme'), val('devKCat'), val('devKZus'), +val('devKN')));
}

// Mobs: Champion-Pack neben dem Spieler, Affix wählbar (champions.ts, mobs.ts spawnChampionPack)
function devChamp() {
  registerDev('devChamp', html(`<div><select class="bindBtn" id="devChampAffix"><option value="">Zufall</option>${AFFIX_IDS.map(a => `<option value="${a}">${C.affixes[a].name}</option>`).join('')}</select>
    <button class="bindBtn" id="devChamp">Champion-Pack spawnen</button></div>`));
  $('devChamp').addEventListener('click', () => {
    const a = ($('devChampAffix') as HTMLSelectElement).value;
    spawnChampionPack(player.pos.x + 8, player.pos.z + 8, a ? [a] : rollAffixes());
    $('settingsClose').click();
  });
}

// Mobs: alle Bosse nach Stufe, Starten (boss.ts startBoss)
function devBoss() {
  const group = (label, list) => `<optgroup label="${label}">${list.map(b => `<option value="${b.id}">${b.evil ? 'V · ' : ''}${b.name}</option>`).join('')}</optgroup>`;
  const opts = TIERS.map(([t, label]) => group(label, poolOf(t))).join('') + group('Verdorbene', BOSSES.filter(b => b.evil))
    + group('nicht im Pool', BOSSES.filter(b => b.tier === 'aus')) + '<option value="prototyp">Prototyp-Boss</option>';
  registerDev('devBoss', html(`<div style="display:flex;gap:6px;margin-bottom:14px"><select id="devBossPick" class="bindBtn" style="flex:1">${opts}</select><button class="bindBtn" id="devBoss">Starten</button></div>`));
  $('devBoss').addEventListener('click', () => { $('settingsClose').click(); startBoss(($('devBossPick') as HTMLSelectElement).value); });
}

// Mobs: Mob-Angriffe sichtbar verlangsamen (dodge.ts mobAttackSlow liest state.devMobSlow)
function devMobAtk() {
  const btn = document.createElement('button');
  btn.className = 'bindBtn';
  btn.id = 'devMobAtk';
  const show = () => { btn.textContent = `Dev: Mob-Angriffe ×${String(DG.devMobSlow).replace('.', ',')}: ${state.devMobSlow ? 'an' : 'aus'}`; };
  btn.addEventListener('click', () => { state.devMobSlow = !state.devMobSlow; show(); });
  registerDev('devMobAtk', btn);
  show();
}

// Zone & Map: Portal öffnen, hin und durch, 2 min vorspulen (portal.ts devPortal)
function devPortalBlock() {
  registerDev('devPortal', html(`<div id="devPortal" style="display:flex;gap:6px;flex-wrap:wrap"><button class="bindBtn" data-a="open">Portal öffnen</button><button class="bindBtn" data-a="go">Hin + durch</button><button class="bindBtn" data-a="lazy">2 min vorspulen</button></div>`));
  $('devPortal').addEventListener('click', e => devPortal((e.target as HTMLElement).closest('button')?.dataset.a));
}

// Zone & Map: Map-Objekte spawnen und auslösen, dazu die Knöpfe der Arten (objects/objects.ts addDevButton)
function devObjects() {
  const box = html('<div id="devObjects"></div>');
  registerDev('devObjects', box);
  box.innerHTML = `<div style="display:flex;gap:6px;flex-wrap:wrap"><select class="bindBtn" id="devObjKind">${kindList().map(k => `<option value="${k.id}">${k.name}</option>`).join('')}</select>
    <button class="bindBtn" data-a="spawn">Spawnen</button><button class="bindBtn" data-a="trigger">Auslösen</button></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">${devButtons().map((l, i) => `<button class="bindBtn" data-f="${i}">${l}</button>`).join('')}</div>`;
  box.addEventListener('click', ev => {
    const btn = (ev.target as HTMLElement).closest('button');
    if (!btn) return;
    const kind = ($('devObjKind') as HTMLSelectElement).value;
    if (btn.dataset.a === 'spawn') { const p = devAhead(); spawnObj(kind, p.x, p.z); }
    if (btn.dataset.a === 'trigger') devTrigger(kind);
    if (btn.dataset.f) devButton(+btn.dataset.f);
  });
}

export function mountDev() {
  registerDev('devZones', $('devZones'), renderDevZones);   // Zonen-Knöpfe bei jedem Öffnen neu (aktuelle Zone markiert)
  registerDev('devLevels', devLevelsBlock());
  registerDev('devColliders', devCollidersBlock());
  registerDev('devWorld', devWorldBlock());
  registerDev('devGearSet', devGearSetBlock());
  registerDev('devLegend', devLegendBlock());
  registerDev('devFeat', devFeatBlock());
  mountForge();   // #devForge aus index.html
  registerDev('devKosmetik', devKosmetikBlock());
  devPortalBlock();
  devObjects();
  devChamp();
  devBoss();
  devKinds();
  devMobAtk();
}
