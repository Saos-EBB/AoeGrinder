// Objekt-System der generierten Maps (map-umbau-2 Phase 3). Ein Objekt = { id, Art, Lage, radius, onHit?, onUse?, onTouch? }.
// Jede Art hat EIN InstancedMesh (Körper, Vertex-Farben, Toon) und optional ein zweites fürs Leuchten (Farbe pro Instanz) → wenige Draw Calls.
// Gesetzt pro Map auf objectSpots des Layouts und freie Bodenplätze (Seed der Map, also gleiche Map = gleiche Objekte).
// Treffer: jede Wirkfläche eines Spells (spells/core.ts onSpellArea) mit dem Element des Spells. Benutzen: Taste „Benutzen“ (useKey.ts).
// Neue Map (Layout gewechselt) oder neuer Run (state.now springt zurück): alles neu. Alle Zahlen // PH

import * as THREE from 'three';
import { state, player } from '../state';
import { $, dist2d } from '../util';
import { scene } from '../render';
import { zone, heightAt } from '../world';
import { SPELLS } from '../config';
import { toonMat } from '../toon';
import { onSpellArea } from '../hooks';
import { makeRng, mixSeed, type Rng } from '../mapgen/rng';
import { addUseSource, updateUseHint } from '../useKey';
import { binds, keyText } from '../input';
import type { Spot } from '../mapgen/types';

export type Element = 'feuer' | 'frost' | 'blitz' | 'seuche' | 'nah';
export interface Obj {
  id: number; kind: Kind; x: number; z: number; y: number; ry: number; s: number; sy: number;
  alive: boolean; slot: number; glow: THREE.Color | null; tint: THREE.Color | null; data: any;
}
export interface Kind {
  id: string;
  name: string;                                  // Dev-Liste
  reserve: number;                               // Instanzen zusätzlich zur Map (Dev-Spawns)
  radius: number;                                // Treffer-/Berühr-Radius
  body: () => THREE.BufferGeometry;              // Vertex-Farben
  glow?: () => THREE.BufferGeometry;             // leuchtender Teil, Farbe pro Instanz (o.glow)
  themes?: string[];                             // nur in diesen Themes (Phase 4), sonst überall
  init?(o: Obj, rng: Rng): void;
  onHit?(o: Obj, el: Element, spellId: string | null): void;
  onUse?(o: Obj): void;
  useLabel?(o: Obj): string | null;              // null = gerade nicht benutzbar
  onTouch?(o: Obj): void;
  update?(o: Obj, dt: number): void;
  devTrigger?(o: Obj): void;                     // Dev „Auslösen“
}

export const OBJ = {
  useR: 2.6,                                    // yd: so nah zum Benutzen
  fromSpawn: 22, fromLandmark: 10, spacing: 10, // yd: Abstände beim Setzen
  tries: 400,
};

// ---------- Arten und Plan pro Map ----------
const KINDS = new Map<string, Kind>();
export const registerKind = (k: Kind) => { KINDS.set(k.id, k); };
export const kindList = () => [...KINDS.values()];
// Plan: n Stück pro Map, place = wie gesetzt wird. extra(): eigene Spawns ohne Instanz (Schatzdieb ist ein Mob)
type Plan = { kind: string; n: number; place: 'spots' | 'free' | 'nearPacks' };
const PLAN: Plan[] = [];
export const planObjects = (p: Plan) => { PLAN.push(p); };
const mapHooks: ((rng: Rng, free: () => Spot | null) => void)[] = [];
export const onMapObjects = (fn: (rng: Rng, free: () => Spot | null) => void) => { mapHooks.push(fn); };

// ---------- Darstellung ----------
type Batch = { body: THREE.InstancedMesh; glow: THREE.InstancedMesh | null; free: number[]; objs: Obj[] };
const batches = new Map<string, Batch>();
let objs: Obj[] = [], nextId = 0, builtFor: any = null, builtRun = -1;
export const objects = () => objs;
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
const WHITE = new THREE.Color(1, 1, 1), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

function batchOf(k: Kind, n: number): Batch {
  const cap = n + k.reserve;
  const body = new THREE.InstancedMesh(k.body(), toonMat({ vertexColors: true }), cap);
  body.frustumCulled = false;
  const glow = k.glow ? new THREE.InstancedMesh(k.glow(), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), cap) : null;
  if (glow) glow.frustumCulled = false;
  for (let i = 0; i < cap; i++) {
    body.setMatrixAt(i, ZERO); body.setColorAt(i, WHITE);
    if (glow) { glow.setMatrixAt(i, ZERO); glow.setColorAt(i, WHITE); }
  }
  scene.add(body); if (glow) scene.add(glow);
  return { body, glow, free: Array.from({ length: cap }, (_, i) => cap - 1 - i), objs: [] };
}

// Matrix und Farbe einer Instanz neu setzen (nach Änderung an o.s, o.sy, o.y, o.glow, o.tint, o.alive)
export function redraw(o: Obj) {
  const b = batches.get(o.kind.id);
  if (!b) return;
  if (!o.alive) { b.body.setMatrixAt(o.slot, ZERO); b.glow?.setMatrixAt(o.slot, ZERO); }
  else {
    e.set(0, o.ry, 0); q.setFromEuler(e);
    m4.compose(v.set(o.x, o.y, o.z), q, sc.set(o.s, o.s * o.sy, o.s));
    b.body.setMatrixAt(o.slot, m4);
    b.body.setColorAt(o.slot, o.tint ?? WHITE);
    if (b.glow) { b.glow.setMatrixAt(o.slot, o.glow ? m4 : ZERO); b.glow.setColorAt(o.slot, o.glow ?? WHITE); }
  }
  b.body.instanceMatrix.needsUpdate = true;
  if (b.body.instanceColor) b.body.instanceColor.needsUpdate = true;
  if (b.glow) { b.glow.instanceMatrix.needsUpdate = true; if (b.glow.instanceColor) b.glow.instanceColor.needsUpdate = true; }
}

export function spawnObj(kindId: string, x: number, z: number, rng: Rng = makeRng(Math.floor(Math.random() * 1e9))): Obj | null {
  const k = KINDS.get(kindId);
  if (!k) return null;
  let b = batches.get(kindId);
  if (!b) { b = batchOf(k, 0); batches.set(kindId, b); }
  const slot = b.free.pop();
  if (slot === undefined) return null;
  const o: Obj = { id: ++nextId, kind: k, x, z, y: heightAt(x, z), ry: rng.range(0, Math.PI * 2), s: 1, sy: 1, alive: true, slot, glow: null, tint: null, data: {} };
  k.init?.(o, rng);
  objs.push(o); b.objs.push(o);
  redraw(o);
  return o;
}
// Objekt verschwindet (Fass explodiert, Truhe wird zum Mimic)
export function removeObj(o: Obj) {
  if (!o.alive) return;
  o.alive = false;
  redraw(o);
}

function clearAll() {
  for (const b of batches.values()) for (const m of [b.body, b.glow]) if (m) { scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); m.dispose(); }
  batches.clear();
  objs = [];
}

// ---------- Plätze ----------
function buildMap() {
  clearAll();
  builtFor = zone.layout;
  builtRun = state.runNo;
  if (!zone.gen || !zone.layout) return;
  const l = zone.layout, g = l.grid, rng = makeRng(mixSeed(zone.theme.id, zone.seed, 'objekte'));
  const taken: Spot[] = [];
  const okAt = (x: number, z: number, gap = OBJ.spacing) => zone.spawnOk(x, z) && Math.hypot(x - l.spawn.x, z - l.spawn.z) >= OBJ.fromSpawn
    && Math.hypot(x - l.landmark.x, z - l.landmark.z) >= OBJ.fromLandmark && taken.every(p => Math.hypot(p.x - x, p.z - z) >= gap);
  const free = (): Spot | null => {
    for (let n = 0; n < OBJ.tries; n++) {
      const i = rng.int(1, g.n - 2), j = rng.int(1, g.n - 2), x = g.cx(i) + rng.range(-2.5, 2.5), z = g.cz(j) + rng.range(-2.5, 2.5);
      if (g.walk(i, j) && okAt(x, z)) { taken.push({ x, z }); return { x, z }; }
    }
    return null;
  };
  const spots = [...l.objectSpots];
  const kinds = PLAN.filter(p => { const k = KINDS.get(p.kind); return k && (!k.themes || k.themes.includes(zone.theme.id)); });
  // Zählen, damit jede Art ein passend großes InstancedMesh bekommt
  for (const p of kinds) batches.set(p.kind, batchOf(KINDS.get(p.kind)!, p.n));
  for (const p of kinds) for (let n = 0; n < p.n; n++) {
    let at: Spot | null = null;
    if (p.place === 'spots') { while (spots.length && !at) { const s = spots.shift()!; if (okAt(s.x, s.z, 6)) { at = s; taken.push(s); } } }
    if (p.place === 'nearPacks' && l.packSpots.length) {
      // Fässer in Grüppchen zu 2–3 am Rand eines Pack-Platzes: im Kampf in Reichweite der Flächen, Kettenreaktion möglich
      const prev = objs.filter(o => o.kind.id === p.kind);
      const group = prev.length % 3 !== 0 ? prev[prev.length - 1] : null;
      for (let k = 0; k < 30 && !at; k++) {
        const c = group ?? rng.pick(l.packSpots), a = rng.range(0, Math.PI * 2), r = group ? rng.range(2.2, 3.5) : (c as any).r + rng.range(2, 6);
        const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
        if (okAt(x, z, group ? 2 : OBJ.spacing)) { at = { x, z }; taken.push(at); }
      }
    }
    at ??= free();
    if (at) spawnObj(p.kind, at.x, at.z, rng);
  }
  for (const fn of mapHooks) fn(rng, free);
}

// ---------- Treffer, Benutzen, Berühren ----------
const TAG_EL: [string, Element][] = [['Feuer', 'feuer'], ['Frost', 'frost'], ['Blitz', 'blitz'], ['Seuche', 'seuche']];
export const elementOf = (spellId: string | null): Element => {
  const tags: string[] = (spellId && SPELLS[spellId]?.tags) || [];
  return TAG_EL.find(([tag]) => tags.includes(tag))?.[1] ?? 'nah';
};
onSpellArea((center, r, spellId) => {
  if (!objs.length) return;
  for (const o of objs) if (o.alive && o.kind.onHit && dist2d(center, o) <= r + o.kind.radius) o.kind.onHit(o, elementOf(spellId), spellId);
});

addUseSource(() => {
  let best: Obj | null = null, bd = OBJ.useR, label: string | null = null;
  for (const o of objs) {
    if (!o.alive || !o.kind.onUse) continue;
    const d = dist2d(player.pos, o) - o.kind.radius * 0.5;
    if (d > bd) continue;
    const l = o.kind.useLabel ? o.kind.useLabel(o) : o.kind.name;
    if (!l) continue;
    best = o; bd = d; label = l;
  }
  if (!best) return null;
  const o = best;
  return { dist: bd, label: label!, act: () => o.kind.onUse!(o) };
});

// Jeden Frame aus main.ts (auch pausiert, damit das Hauptmenü die Objekte schon zeigt)
let hintAt = 0;
export function syncObjects() {
  if (zone.layout !== builtFor || state.runNo !== builtRun) buildMap();   // neue Map oder neuer Run (resetGame zählt state.runNo hoch)
  const now = performance.now();
  if (now - hintAt > 100) { hintAt = now; updateUseHint(keyText((binds as any).use?.key ?? 'G')); }
}
export function updateObjects(dt: number) {
  for (const o of objs) {
    if (!o.alive) continue;
    o.kind.update?.(o, dt);
    if (o.kind.onTouch && !player.dead && dist2d(player.pos, o) <= o.kind.radius) o.kind.onTouch(o);
  }
}

// ---------- Dev (Gruppe Map-Objekte) ----------
const devFns: [string, () => void][] = [];
export const addDevButton = (label: string, fn: () => void) => { devFns.push([label, fn]); };
const ahead = (d = 6) => { const f = player.facing; return { x: player.pos.x + Math.sin(f) * d, z: player.pos.z + Math.cos(f) * d }; };
export const devAhead = ahead;
function renderDev() {
  const box = document.getElementById('devObjects');
  if (!box) return;
  box.innerHTML = `<div style="display:flex;gap:6px;flex-wrap:wrap"><select class="bindBtn" id="devObjKind">${kindList().map(k => `<option value="${k.id}">${k.name}</option>`).join('')}</select>
    <button class="bindBtn" data-a="spawn">Spawnen</button><button class="bindBtn" data-a="trigger">Auslösen</button></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">${devFns.map(([l], i) => `<button class="bindBtn" data-f="${i}">${l}</button>`).join('')}</div>`;
}
$('devZones').insertAdjacentHTML('afterend', '<div id="devObjects"></div>');
$('devObjects').addEventListener('click', ev => {
  const btn = (ev.target as HTMLElement).closest('button');
  if (!btn) return;
  const kind = ($('devObjKind') as HTMLSelectElement).value;
  if (btn.dataset.a === 'spawn') { const p = ahead(); spawnObj(kind, p.x, p.z); }
  if (btn.dataset.a === 'trigger') {
    const o = objs.filter(x => x.alive && x.kind.id === kind).sort((a, b) => dist2d(a, player.pos) - dist2d(b, player.pos))[0];
    if (o) o.kind.devTrigger ? o.kind.devTrigger(o) : o.kind.onUse ? o.kind.onUse(o) : o.kind.onHit?.(o, 'feuer', null);
  }
  if (btn.dataset.f) devFns[+btn.dataset.f][1]();
});
setTimeout(renderDev);   // nach dem Laden aller Arten

(window as any).__objects = { get list() { return objs; }, kinds: KINDS, spawn: spawnObj, remove: removeObj, OBJ, rebuild: buildMap, elementOf, batches };
