import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const CFG = {
  startLevel: 20,
  aggroBase: 18, aggroMin: 5, aggroLevelCap: 25,     // Creature::GetAttackDistance
  socialRadius: 10, socialDelay: 1500,              // CreatureFamilyAssistance*
  fleeAssistRadius: 30, fleeDuration: 7000,         // DoFleeToGetAssistance
  fleeHpPct: 0.15, fleeChance: 0.3,                 // PH: steht im DB-Script, nicht im Core
  leashRadius: 50, leashGrace: 12000,               // IsOutOfThreatArea
  regenTick: 2000, fiveSecRule: 5000,               // Player::Regenerate, SetLastManaUse
  critBonus: 0.5,                                   // SpellCriticalDamageBonus
  baseCrit: 0.05,                                   // PH
  gcd: 1500,                                        // PH (StartRecoveryTime aus Spelldaten)
  novaBreakChance: 0.25,                            // PH
  runSpeed: 7, backSpeed: 4.5, turnSpeed: 3.141594, // baseMoveSpeed[] in Unit.cpp (yd/s, rad/s)
  jumpSpeed: 8, gravity: 20,                        // PH: Sprungphysik läuft im Client, nicht im Server
  mobSpeed: 6.2,                                    // PH: steht pro Mob in creature_template.speed_run (DB)
  meleeRange: 2.2, swingTime: 2000,
  playRadius: 98,
  packCount: 9,
};

// Rang-1-Werte laut Wowhead Classic. Radien PH (stehen nicht im Tooltip).
const SPELLS = {
  nova:  { name: 'Frost Nova',       cls: 'frost',  mana: 55,  cd: 25000, min: 19, max: 21, radius: 10, root: 8000 },
  ae:    { name: 'Arcane Explosion', cls: 'arcane', mana: 75,  cd: 0,     min: 34, max: 38, radius: 10 },
  bliz:  { name: 'Blizzard',         cls: 'frost',  mana: 320, cd: 0,     tick: 26, channel: 8000, range: 30, radius: 8 },
  coc:   { name: 'Cone of Cold',     cls: 'frost',  mana: 210, cd: 10000, min: 98, max: 108, range: 10, angle: Math.PI / 3, slow: 0.5, slowDur: 8000 },
  blink: { name: 'Blink',            cls: 'arcane', mana: 80,  cd: 15000, dist: 20 },  // Mana PH
  drink: { name: 'Trinken',          cls: 'util',   mana: 0,   cd: 0,     dur: 18000 },  // Werte PH
};

// Roguelike-Modifikatoren (werden von Karten verändert)
let mods;
function resetMods() {
  mods = { dmg: 1, shatter: 0, novaCd: 0, aeCost: 1, blizSlow: 0, blizRadius: 0, castRegen: 0, manaMult: 1, hpMult: 1 };
}

// "verified: true" = Wert belegt (Wowhead-Tooltip). Sonst Prototyp-Erfindung.
const CARDS = [
  { id: 'ibliz', name: 'Improved Blizzard', verified: true, max: 2,
    desc: r => `Blizzard verlangsamt Gegner um ${[30, 50][r]} % für 1,5 s.`, apply: r => mods.blizSlow = [0.3, 0.5][r] },
  { id: 'ifn', name: 'Improved Frost Nova', verified: true, max: 2,
    desc: r => `Frost Nova Abklingzeit ${[23, 21][r]} s statt ${[25, 23][r]} s.`, apply: r => mods.novaCd = [2000, 4000][r] },
  { id: 'shatter', name: 'Shatter', max: 3,
    desc: () => '+10 % kritische Trefferchance gegen eingefrorene Ziele.', apply: () => mods.shatter += 0.10 },
  { id: 'power', name: 'Arkane Macht', max: 5,
    desc: () => '+12 % Zauberschaden.', apply: () => mods.dmg += 0.12 },
  { id: 'amind', name: 'Arcane Mind', max: 3,
    desc: () => '+10 % maximales Mana.', apply: () => mods.manaMult += 0.10 },
  { id: 'amed', name: 'Arcane Meditation', max: 3,
    desc: () => '+5 % Mana-Regeneration während der 5-Sekunden-Regel.', apply: () => mods.castRegen += 0.05 },
  { id: 'storm', name: 'Weiter Sturm', max: 2,
    desc: () => 'Blizzard-Radius +2 yd.', apply: () => mods.blizRadius += 2 },
  { id: 'aecost', name: 'Arkane Effizienz', max: 2,
    desc: () => 'Arcane Explosion kostet 15 % weniger Mana.', apply: () => mods.aeCost -= 0.15 },
  { id: 'armor', name: 'Frostrüstung', max: 3,
    desc: () => '+15 % maximale Gesundheit.', apply: () => mods.hpMult += 0.15 },
];

const ACTIONS = [
  { group: 'Bewegung' },
  { id: 'forward',     label: 'Vorwärts',          code: 'KeyW',   key: 'W' },
  { id: 'back',        label: 'Rückwärts',         code: 'KeyS',   key: 'S' },
  { id: 'turnLeft',    label: 'Links drehen',      code: 'KeyA',   key: 'A' },
  { id: 'turnRight',   label: 'Rechts drehen',     code: 'KeyD',   key: 'D' },
  { id: 'strafeLeft',  label: 'Seitwärts links',   code: 'KeyQ',   key: 'Q' },
  { id: 'strafeRight', label: 'Seitwärts rechts',  code: 'KeyE',   key: 'E' },
  { id: 'jump',        label: 'Springen',          code: 'Space',  key: 'Leertaste' },
  { id: 'autorun',     label: 'Autorun',           code: 'KeyR',   key: 'R' },
  { group: 'Zauber' },
  { id: 'nova',  label: 'Frost Nova',       code: 'Digit1', key: '1', spell: true },
  { id: 'ae',    label: 'Arcane Explosion', code: 'Digit2', key: '2', spell: true },
  { id: 'bliz',  label: 'Blizzard',         code: 'Digit3', key: '3', spell: true },
  { id: 'coc',   label: 'Cone of Cold',     code: 'Digit4', key: '4', spell: true },
  { id: 'blink', label: 'Blink',            code: 'Digit5', key: '5', spell: true },
  { id: 'drink', label: 'Trinken',          code: 'Digit6', key: '6', spell: true },
];
const BIND_STORE = 'frostgrind.binds.v1';
let binds = loadBinds();

function defaultBinds() {
  const b = {};
  for (const a of ACTIONS) if (a.id) b[a.id] = { code: a.code, key: a.key };
  return b;
}
function loadBinds() {
  const b = defaultBinds();
  try { Object.assign(b, JSON.parse(localStorage.getItem(BIND_STORE) || '{}')); } catch { /* kein Storage */ }
  return b;
}
function saveBinds() {
  try { localStorage.setItem(BIND_STORE, JSON.stringify(binds)); } catch { /* egal */ }
}
const keyName = e => e.code === 'Space' ? 'Leertaste' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
const actionForCode = code => Object.keys(binds).find(id => binds[id].code === code);

const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const lerpTo = (cur, target, k) => cur + (target - cur) * k;

function aggroRadius(mob) {
  const diff = Math.max(player.level - mob.level, -CFG.aggroLevelCap);
  return Math.max(CFG.aggroBase - diff, Math.min(CFG.aggroBase, CFG.aggroMin));
}

function hitChance(mob) {                       // in Prozent
  const d = mob.level - player.level;
  const hit = d < 3 ? 96 - d : 94 - (d - 2) * 11;
  return clamp(Math.max(hit, 22), 1, 99);
}

function grayLevel(pl) {
  if (pl <= 5) return 0;
  if (pl <= 39) return pl - 5 - Math.floor(pl / 10);
  return pl - 1 - Math.floor(pl / 5);
}
function zeroDiff(pl) {
  const table = [[8, 5], [10, 6], [12, 7], [16, 8], [20, 9], [30, 11], [40, 12], [45, 13], [50, 14], [55, 15], [60, 16]];
  for (const [lvl, zd] of table) if (pl < lvl) return zd;
  return 17;
}
function xpForKill(mobLevel) {
  const pl = player.level;
  let factor;
  if (mobLevel >= pl) factor = 1 + 0.05 * Math.min(mobLevel - pl, 4);
  else if (mobLevel > grayLevel(pl)) factor = (zeroDiff(pl) + mobLevel - pl) / zeroDiff(pl);
  else factor = 0;
  return Math.round((pl * 5 + 45) * factor);
}
function xpColor(mobLevel) {
  const pl = player.level;
  if (mobLevel >= pl + 5) return '#ff2020';
  if (mobLevel >= pl + 3) return '#ff8040';
  if (mobLevel >= pl - 2) return '#ffff00';
  if (mobLevel > grayLevel(pl)) return '#40c040';
  return '#808080';
}

// PH: Werte für Level-Skalierung, Spielerstats und XP-Bedarf
const xpNeeded = () => (player.level * 5 + 45) * 10;
const baseHp = () => (520 + 30 * (player.level - 20)) * 2;
const MANA_PER_HP = 4 / 3;                       // Mana = Leben + 1/3
const maxHp = () => Math.round(baseHp() * mods.hpMult);
const maxMana = () => Math.round(baseHp() * MANA_PER_HP * mods.manaMult);
const spirit = () => 45 + 2 * (player.level - 20);
const dmgMult = () => mods.dmg * (1 + 0.05 * (player.level - 20));
const mobMaxHp = lvl => 8 * lvl + 60;
const mobHitDmg = lvl => Math.round(lvl * rand(0.9, 1.3));

function manaCost(id) {
  const base = SPELLS[id].mana;
  return Math.round(id === 'ae' ? base * mods.aeCost : base);
}
function spellCd(id) {
  return id === 'nova' ? SPELLS.nova.cd - mods.novaCd : SPELLS[id].cd;
}
const blizRadius = () => SPELLS.bliz.radius + mods.blizRadius;

function heightAt(x, z) {
  let h = 2.2 * Math.sin(x * 0.035) * Math.cos(z * 0.03)
        + 1.2 * Math.sin(x * 0.08 + z * 0.06)
        + 0.6 * Math.sin(z * 0.13 - x * 0.05);
  const r = Math.hypot(x, z);
  if (r > 92) h += Math.pow(r - 92, 1.45) * 0.4;     // Berge am Rand
  return h;
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const FOG_COLOR = 0xe8c9a4;                         // warmer Abenddunst
scene.fog = new THREE.Fog(FOG_COLOR, 45, 185);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.3, 700);

// Tief stehende Abendsonne: warmes Hauptlicht, bläulicher Himmel als Fülllicht
scene.add(new THREE.HemisphereLight(0xb8c8ff, 0x6a4a2a, 1.25));
const sun = new THREE.DirectionalLight(0xffb070, 2.1);
sun.position.set(120, 45, -60);
scene.add(sun);
const SUN_DIR = sun.position.clone().normalize();

// Bloom: nur sehr helle Farben (Zauber-Partikel, Kristall) leuchten
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.4, 1.5);
composer.addPass(bloom);
// Vignette + leichte Farbtönung (warme Lichter, kühle Schatten)
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float lum = dot(c, vec3(0.299, 0.587, 0.114));
      c *= mix(vec3(0.92, 0.97, 1.08), vec3(1.06, 1.0, 0.92), clamp(lum, 0.0, 1.0));
      float v = smoothstep(0.95, 0.35, distance(vUv, vec2(0.5)));
      gl_FragColor = vec4(c * mix(0.62, 1.0, v), 1.0);
    }`,
}));
composer.addPass(new OutputPass());

// Himmel als Farbverlauf-Kuppel
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(500, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x2c4f8c) }, mid: { value: new THREE.Color(0x9fb4d0) },
      horizon: { value: new THREE.Color(FOG_COLOR) }, sunDir: { value: SUN_DIR },
    },
    vertexShader: 'varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sunDir; varying vec3 vPos;
      void main() {
        vec3 d = normalize(vPos);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.25, h));
        col = mix(col, top, smoothstep(0.25, 0.9, h));
        float s = max(dot(d, sunDir), 0.0);
        col += vec3(1.0, 0.6, 0.3) * pow(s, 8.0) * 0.45;      // Sonnenhof
        col += vec3(3.0, 2.2, 1.3) * pow(s, 900.0);            // Sonnenscheibe (blüht)
        gl_FragColor = vec4(col, 1.0);
      }`,
  })));

// Terrain mit Vertex-Farben (Gras, Erdflecken, Fels an Hängen)
const terrain = (() => {
  const size = 340, segs = 150;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  const grassA = new THREE.Color(0x3f6e22), grassB = new THREE.Color(0x86a83e),
        dirt = new THREE.Color(0x8a6a42), rock = new THREE.Color(0x7d766a);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = heightAt(x, z);
    pos.setY(i, h);
    const n = Math.sin(x * 0.11) * Math.cos(z * 0.09) + Math.sin(x * 0.031 + z * 0.047);
    c.copy(grassA).lerp(grassB, clamp(0.5 + n * 0.3 + h * 0.05 + rand(-0.06, 0.06), 0, 1));
    if (n > 1.3) c.lerp(dirt, 0.65);
    if (h > 6) c.lerp(rock, clamp((h - 6) / 10, 0, 0.9));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(mesh);
  return mesh;
})();

// Hindernisse (Bäume, Steine) – Kreise für die Kollision
const obstacles = [];

(() => {
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 3, 7);
  const leafGeo = new THREE.ConeGeometry(2.6, 5, 8);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a3d22 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const trees = [];
  for (let i = 0; i < 190; i++) {                       // Waldrand
    const a = rand(0, Math.PI * 2), r = rand(100, 160);
    trees.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, s: rand(1, 1.8) });
  }
  for (let i = 0; i < 40; i++) {                        // einzelne Bäume im Spielbereich
    const a = rand(0, Math.PI * 2), r = rand(18, 88);
    trees.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, s: rand(0.9, 1.4), inside: true });
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, trees.length * 2);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  trees.forEach((t, i) => {
    const y = heightAt(t.x, t.z);
    m.compose(new THREE.Vector3(t.x, y + 1.5 * t.s, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
    trunks.setMatrixAt(i, m);
    for (let k = 0; k < 2; k++) {
      const sc = t.s * (1 - k * 0.3);
      m.compose(new THREE.Vector3(t.x, y + (4 + k * 2.4) * t.s, t.z), q, new THREE.Vector3(sc, sc, sc));
      leaves.setMatrixAt(i * 2 + k, m);
      leaves.setColorAt(i * 2 + k, col.setHSL(0.28 + rand(-0.03, 0.03), 0.45, 0.22 + rand(0, 0.08)));
    }
    if (t.inside) obstacles.push({ x: t.x, z: t.z, r: 0.6 * t.s, canopy: 2.4 * t.s });
  });
  scene.add(trunks, leaves);

  const rockGeo = new THREE.DodecahedronGeometry(1);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x8a857a, flatShading: true });
  for (let i = 0; i < 30; i++) {
    const a = rand(0, Math.PI * 2), r = rand(12, 90);
    const x = Math.cos(a) * r, z = Math.sin(a) * r, s = rand(0.8, 2);
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(x, heightAt(x, z) + 0.2 * s, z);
    rock.scale.set(s, s * rand(0.5, 0.9), s * rand(0.8, 1.2));
    rock.rotation.y = rand(0, 6);
    scene.add(rock);
    obstacles.push({ x, z, r: s * 0.9 });
  }

  // Grasbüschel
  const tuftGeo = new THREE.ConeGeometry(0.12, 0.7, 3);
  tuftGeo.translate(0, 0.35, 0);
  const grass = new THREE.InstancedMesh(tuftGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), 6000);
  for (let i = 0; i < grass.count; i++) {
    const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * 105;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, s = rand(0.35, 0.8);
    q.setFromEuler(new THREE.Euler(rand(-0.3, 0.3), rand(0, 6), rand(-0.3, 0.3)));
    m.compose(new THREE.Vector3(x, heightAt(x, z), z), q, new THREE.Vector3(s, s, s));
    grass.setMatrixAt(i, m);
    grass.setColorAt(i, col.setHSL(0.27 + rand(-0.03, 0.03), 0.5, 0.24 + rand(0, 0.08)));
  }
  scene.add(grass);
})();

// Spieler/Mobs aus Hindernissen herausschieben
function collide(pos, radius) {
  for (const o of obstacles) {
    const dx = pos.x - o.x, dz = pos.z - o.z, d = Math.hypot(dx, dz), min = o.r + radius;
    if (d < min && d > 0.0001) { pos.x = o.x + dx / d * min; pos.z = o.z + dz / d * min; }
  }
  const r = Math.hypot(pos.x, pos.z);
  if (r > CFG.playRadius) { pos.x *= CFG.playRadius / r; pos.z *= CFG.playRadius / r; }
}

function part(geo, mat, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  return mesh;
}
function joint(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

// Glow-Textur (weicher Kreis) für Partikel und Leuchteffekte
const glowTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.7)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
function glowSprite(color, size) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sp.scale.setScalar(size);
  return sp;
}

// Skelett-Magier mit rotem Lendenschurz und Stab
function buildMage() {
  const bone = new THREE.MeshLambertMaterial({ color: 0xd2c8a8 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x0a0806 });
  const cloth = new THREE.MeshLambertMaterial({ color: 0xa01818, side: THREE.DoubleSide });
  const wood = new THREE.MeshLambertMaterial({ color: 0x4a2f1a });
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.6, 3.0) });   // > 1 → Bloom
  const crystalMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 1.8, 2.8) });

  const cyl = (r, h) => new THREE.CylinderGeometry(r, r * 0.85, h, 7);
  const ball = r => new THREE.SphereGeometry(r, 8, 6);

  const root = new THREE.Group();
  const body = joint(root);                       // verschiebbar (Sitzen, Tod)
  const hips = joint(body, 0, 1.0, 0);
  // Becken
  hips.add(part(new THREE.BoxGeometry(0.42, 0.14, 0.2), bone, 0, 0.02, 0));
  const torso = joint(hips);
  // Wirbelsäule
  for (let i = 0; i < 6; i++) torso.add(part(ball(0.055), bone, 0, 0.1 + i * 0.12, -0.08));
  // Rippen (Torus-Bögen)
  for (let i = 0; i < 4; i++) {
    const w = 0.24 - Math.abs(i - 1.2) * 0.03;
    const rib = part(new THREE.TorusGeometry(w, 0.022, 4, 14, Math.PI * 1.5), bone, 0, 0.36 + i * 0.1, 0);
    rib.rotation.set(Math.PI / 2, 0, Math.PI * 0.75);
    torso.add(rib);
  }
  torso.add(part(new THREE.BoxGeometry(0.06, 0.32, 0.04), bone, 0, 0.5, 0.17));          // Brustbein
  const collar = part(cyl(0.035, 0.7), bone, 0, 0.8, -0.02);                            // Schlüsselbein
  collar.rotation.z = Math.PI / 2;
  torso.add(collar);
  // Schädel
  const neck = joint(torso, 0, 0.86, 0);
  neck.add(part(cyl(0.04, 0.12), bone, 0, 0.04, -0.04));
  neck.add(part(new THREE.SphereGeometry(0.22, 12, 10), bone, 0, 0.24, 0));
  neck.add(part(new THREE.BoxGeometry(0.24, 0.1, 0.2), bone, 0, 0.07, 0.07));            // Kiefer
  for (const sx of [-0.08, 0.08]) {
    neck.add(part(ball(0.06), dark, sx, 0.25, 0.16));                                     // Augenhöhle
    neck.add(part(ball(0.025), eyeMat, sx, 0.25, 0.2));                                   // Leuchtauge
  }
  const nose = part(new THREE.ConeGeometry(0.03, 0.06, 3), dark, 0, 0.16, 0.2);          // Nasenloch
  nose.rotation.x = Math.PI;
  neck.add(nose);

  const arm = side => {
    const shoulder = joint(torso, side * 0.36, 0.78, 0);
    shoulder.add(part(ball(0.06), bone));
    shoulder.add(part(cyl(0.04, 0.42), bone, 0, -0.22, 0));
    const elbow = joint(shoulder, 0, -0.45, 0);
    elbow.add(part(ball(0.05), bone));
    elbow.add(part(cyl(0.032, 0.4), bone, side * 0.02, -0.2, 0));
    elbow.add(part(cyl(0.028, 0.4), bone, -side * 0.02, -0.2, 0));
    elbow.add(part(new THREE.BoxGeometry(0.1, 0.12, 0.05), bone, 0, -0.44, 0));           // Hand
    return { shoulder, elbow };
  };
  const armL = arm(1), armR = arm(-1);

  const staff = joint(armR.elbow, 0, -0.45, 0.04);
  staff.add(part(new THREE.CylinderGeometry(0.035, 0.045, 2.3, 6), wood, 0, 0.3, 0));
  for (const a of [0, 2.1, 4.2]) {                                                         // Krallen um den Kristall
    const claw = part(new THREE.ConeGeometry(0.03, 0.3, 4), wood, Math.cos(a) * 0.09, 1.5, Math.sin(a) * 0.09);
    claw.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
    staff.add(claw);
  }
  const crystal = part(new THREE.OctahedronGeometry(0.13), crystalMat, 0, 1.55, 0);
  crystal.scale.y = 1.6;
  staff.add(crystal);
  const crystalGlow = glowSprite(0x7fd8ff, 0.4);
  crystalGlow.position.y = 1.55;
  staff.add(crystalGlow);
  staff.rotation.x = 0.5;                                          // gleicht den gebeugten Ellbogen aus -> Stab senkrecht

  const leg = side => {
    const hip = joint(hips, side * 0.15, 0, 0);
    hip.add(part(ball(0.06), bone));
    hip.add(part(cyl(0.045, 0.48), bone, 0, -0.25, 0));
    const knee = joint(hip, 0, -0.5, 0);
    knee.add(part(ball(0.055), bone));
    knee.add(part(cyl(0.038, 0.44), bone, 0, -0.22, 0));
    knee.add(part(new THREE.BoxGeometry(0.11, 0.05, 0.24), bone, 0, -0.47, 0.06));       // Fuß
    return { hip, knee };
  };
  const legL = leg(1), legR = leg(-1);

  // Roter Lendenschurz: Gürtel + vordere und hintere Stoffbahn (schwingen beim Laufen)
  const belt = part(new THREE.TorusGeometry(0.22, 0.03, 4, 16), cloth, 0, 0.06, 0);
  belt.rotation.x = Math.PI / 2;
  hips.add(belt);
  const flapFront = joint(hips, 0, 0.05, 0.14);
  flapFront.add(part(new THREE.BoxGeometry(0.3, 0.55, 0.015), cloth, 0, -0.27, 0));
  const flapBack = joint(hips, 0, 0.05, -0.14);
  flapBack.add(part(new THREE.BoxGeometry(0.32, 0.5, 0.015), cloth, 0, -0.25, 0));

  // Punkte, an denen Zauber-Partikel entstehen
  const anchors = { crystal, handL: armL.elbow };
  let phase = 0;
  const j = { hipsY: 1, bodyY: 0, bodyRotX: 0, lean: 0,
    lHip: 0, rHip: 0, lKnee: 0, rKnee: 0, lSh: 0, rSh: 0, lShZ: 0.1, rShZ: -0.1, lEl: 0, rEl: 0, headX: 0 };

  function update(dt, a) {
    const s = dt / 1000;
    const t = { ...j, hipsY: 1, bodyY: 0, bodyRotX: 0, lean: 0, lHip: 0, rHip: 0, lKnee: 0, rKnee: 0,
      lSh: 0.05, rSh: 0.05, lShZ: 0.12, rShZ: -0.12, lEl: -0.15, rEl: -0.5, headX: 0 };

    if (a.state === 'run' || a.state === 'back') {
      const dir = a.state === 'back' ? -1 : 1;
      phase += s * a.speed * 1.55 * dir;
      const sw = Math.sin(phase), amp = a.state === 'back' ? 0.6 : 0.85;
      t.lHip = -sw * amp; t.rHip = sw * amp;
      t.lKnee = Math.max(0, sw) * 1.1; t.rKnee = Math.max(0, -sw) * 1.1;
      t.lSh = sw * 0.6; t.rSh = -sw * 0.6 - 0.2;
      t.lean = 0.12 * dir;
      t.hipsY = 1 - 0.04 + Math.abs(Math.cos(phase)) * 0.08;
    } else if (a.state === 'idle') {
      phase += s * 1.6;
      t.hipsY = 1 + Math.sin(phase) * 0.012;
      t.lShZ = 0.12 + Math.sin(phase) * 0.03;
    } else if (a.state === 'air') {
      t.lHip = -0.7; t.rHip = -0.2; t.lKnee = 1.2; t.rKnee = 0.6;
      t.lShZ = 0.6; t.rShZ = -0.6;
    } else if (a.state === 'sit') {
      t.bodyY = -0.55; t.lHip = -1.45; t.rHip = -1.45; t.lKnee = 0.2; t.rKnee = 0.2;
      t.rSh = -1.1; t.rEl = -1.7; t.headX = -0.15;               // Becher zum Mund
    } else if (a.state === 'dead') {
      t.bodyRotX = -Math.PI / 2; t.bodyY = 0.3;
    }
    if (a.channel) {                                            // Arme hoch, leichtes Zittern
      t.lSh = -2.6 + Math.sin(performance.now() / 120) * 0.05; t.rSh = -2.6; t.lShZ = 0.35; t.rShZ = -0.35;
      t.lEl = 0; t.rEl = 0;
    } else if (a.cast > 0) {                                     // kurzer Wurf nach vorne
      t.rSh = -1.6 * a.cast; t.lSh = -1.1 * a.cast; t.rEl = -0.2; t.lEl = -0.3;
    }

    const k = Math.min(1, s * 14);
    for (const key in j) j[key] = lerpTo(j[key], t[key], k);

    hips.position.y = j.hipsY;
    body.position.y = j.bodyY;
    body.rotation.x = j.bodyRotX;
    torso.rotation.x = j.lean;
    neck.rotation.x = j.headX;
    legL.hip.rotation.x = j.lHip;  legR.hip.rotation.x = j.rHip;
    legL.knee.rotation.x = j.lKnee; legR.knee.rotation.x = j.rKnee;
    armL.shoulder.rotation.x = j.lSh; armR.shoulder.rotation.x = j.rSh;
    armL.shoulder.rotation.z = j.lShZ; armR.shoulder.rotation.z = j.rShZ;
    armL.elbow.rotation.x = j.lEl; armR.elbow.rotation.x = j.rEl;
    flapFront.rotation.x = Math.min(j.lHip, j.rHip, 0) * 0.7;
    flapBack.rotation.x = Math.max(j.lHip, j.rHip, 0) * 0.7;
    crystalGlow.scale.setScalar(0.4 + Math.sin(performance.now() / 300) * 0.06 + (a.channel || a.cast > 0 ? 0.3 : 0));
  }
  return { root, update, anchors };
}

// Eber: Körper, Kopf-Gelenk, 4 Beine
const boarGeo = {
  body: new THREE.BoxGeometry(0.95, 0.8, 1.5),
  hump: new THREE.BoxGeometry(0.7, 0.3, 0.8),
  head: new THREE.BoxGeometry(0.62, 0.55, 0.65),
  snout: new THREE.BoxGeometry(0.34, 0.26, 0.2),
  tusk: new THREE.ConeGeometry(0.06, 0.35, 5),
  leg: new THREE.BoxGeometry(0.2, 0.5, 0.2),
  tail: new THREE.BoxGeometry(0.06, 0.06, 0.3),
  ice: new THREE.BoxGeometry(1.6, 1.7, 2.3),
};
const tuskMat = new THREE.MeshLambertMaterial({ color: 0xf2ecd8 });
const snoutMat = new THREE.MeshLambertMaterial({ color: 0xc08a7a });
const iceMat = new THREE.MeshLambertMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.5, emissive: 0x2a5070 });

function buildBoar(level) {
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x6b4426 });
  const legMat = new THREE.MeshLambertMaterial({ color: 0x3b2614 });
  const root = new THREE.Group();
  const body = joint(root, 0, 0.82, 0);
  body.add(part(boarGeo.body, bodyMat));
  body.add(part(boarGeo.hump, legMat, 0, 0.48, 0.15));
  const neck = joint(body, 0, 0.1, 0.72);
  neck.add(part(boarGeo.head, bodyMat, 0, -0.05, 0.28));
  neck.add(part(boarGeo.snout, snoutMat, 0, -0.15, 0.66));
  for (const sx of [-0.2, 0.2]) {
    const t = part(boarGeo.tusk, tuskMat, sx, -0.22, 0.58);
    t.rotation.x = -0.6;
    neck.add(t);
  }
  const tail = joint(body, 0, 0.2, -0.75);
  tail.add(part(boarGeo.tail, legMat, 0, 0, -0.15));
  const legs = [[-0.3, 0.5], [0.3, 0.5], [-0.3, -0.5], [0.3, -0.5]].map(([x, z]) => {
    const hip = joint(body, x, -0.32, z);
    hip.add(part(boarGeo.leg, legMat, 0, -0.22, 0));
    return hip;
  });
  const ice = new THREE.Mesh(boarGeo.ice, iceMat);
  ice.position.y = 0.85; ice.visible = false;
  root.add(ice);
  root.scale.setScalar(0.9 + (level - 18) * 0.02);

  let phase = rand(0, 6);
  const j = { legs: 0, neckX: 0, bodyY: 0.82, rollZ: 0, tail: 0 };
  function update(dt, a) {
    const s = dt / 1000;
    ice.visible = !!a.frozen;
    bodyMat.color.set(a.state === 'dead' ? 0x5a5048 : a.slowed ? 0x6f7fa0 : 0x6b4426);
    bodyMat.emissive.setScalar(a.flash * 0.9);                 // kurzer weißer Treffer-Blitz
    if (a.frozen) return;                                      // eingefroren: Pose bleibt stehen
    const t = { legs: 0, neckX: 0, bodyY: 0.82, rollZ: 0, tail: Math.sin(performance.now() / 200) * 0.4 };
    if (a.state === 'run') {
      phase += s * a.speed * 2.2;
      t.legs = Math.sin(phase) * 0.8;
      t.bodyY = 0.82 + Math.abs(Math.cos(phase)) * 0.06;
      t.neckX = Math.sin(phase * 2) * 0.05;
    } else if (a.state === 'idle') {
      phase += s * 1.2;
      t.neckX = 0.25 + Math.sin(phase) * 0.1;                    // schnüffelt am Boden
    } else if (a.state === 'dead') {
      t.rollZ = Math.PI / 2; t.bodyY = 0.5; t.tail = 0;
    }
    if (a.attack > 0) t.neckX = Math.sin(a.attack * Math.PI) * 0.7;  // Kopfstoß
    const k = Math.min(1, s * 12);
    for (const key in j) j[key] = lerpTo(j[key], t[key], k);
    legs[0].rotation.x = j.legs; legs[3].rotation.x = j.legs;    // diagonale Paare
    legs[1].rotation.x = -j.legs; legs[2].rotation.x = -j.legs;
    neck.rotation.x = j.neckX;
    body.position.y = j.bodyY;
    body.rotation.z = j.rollZ;
    tail.rotation.y = j.tail;
  }
  return { root, update };
}

// Blizzard-Zielkreis
// Flache Kreise/Ringe, deren Vertices der Bodenhöhe folgen
function terrainDecal(geo, mat) {
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.base = geo.attributes.position.array.slice();
  return mesh;
}
function drape(mesh, center, radius) {
  const base = mesh.userData.base, arr = mesh.geometry.attributes.position.array;
  mesh.position.set(center.x, 0, center.z);
  for (let i = 0; i < base.length; i += 3) {
    const x = base[i] * radius, z = base[i + 2] * radius;
    arr[i] = x; arr[i + 2] = z;
    arr[i + 1] = heightAt(center.x + x, center.z + z) + 0.15;
  }
  mesh.geometry.attributes.position.needsUpdate = true;
  mesh.geometry.computeBoundingSphere();
}

const blizCursor = terrainDecal(new THREE.RingGeometry(0.93, 1, 64, 1),
  new THREE.MeshBasicMaterial({ color: 0x7fd0ff, transparent: true, opacity: 0.9, depthWrite: false }));
blizCursor.visible = false;
scene.add(blizCursor);

// Blizzard-Effekt (Boden + fallende Eissplitter)
const blizFx = (() => {
  const g = new THREE.Group();
  const disc = terrainDecal(new THREE.RingGeometry(0, 1, 48, 8),
    new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.12, depthWrite: false }));
  scene.add(disc);
  const shardGeo = new THREE.BoxGeometry(0.06, 0.9, 0.06);
  const shardMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 1.3, 1.8) });
  const shards = [];
  for (let i = 0; i < 90; i++) {
    const s = new THREE.Mesh(shardGeo, shardMat);
    s.rotation.z = 0.25;
    s.userData.speed = rand(18, 28);
    shards.push(s); g.add(s);
  }
  // Wolke aus flachen Kugeln über dem Zielkreis
  const cloud = new THREE.Group();
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0x8796b4, emissive: 0x1a2440, transparent: true, opacity: 0.9, depthWrite: false });
  const puff = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2, r = rand(2, 7);
    const m = new THREE.Mesh(puff, cloudMat);
    m.position.set(Math.cos(a) * r, rand(-0.6, 0.6), Math.sin(a) * r);
    m.scale.set(rand(2.2, 3.6), rand(1, 1.6), rand(2.2, 3.6));
    cloud.add(m);
  }
  cloud.position.y = 15;
  g.add(cloud);
  g.visible = disc.visible = false;
  scene.add(g);
  return { g, disc, shards, cloud, cloudMat };
})();

const player: any = {};
const mage = buildMage();
scene.add(mage.root);

let now = 0;                 // Spielzeit in ms (läuft nur, wenn nicht pausiert)
let paused = true;
let mobs = [];
let packCounter = 0;
let pendingLevelUps = 0;
let cardRanks = {};
const effects = [];
const overlay = $('overlay');

// Kamera wie in WoW: Orbit um den Spieler
const cam = { offset: 0, pitch: 0.45, dist: 16, shake: 0 };

// Eingabe
const held = new Set();      // gedrückte Tasten (e.code)
const mouseBtn = { left: false, right: false };
const mouse = { ndc: new THREE.Vector2(), ground: new THREE.Vector3(), dragged: false, downX: 0, downY: 0 };
let autorun = false;
let jumpQueued = false;
let rebinding = null;        // Aktion, die gerade neu belegt wird
const act = id => held.has(binds[id].code);

function resetGame() {
  for (const m of mobs) { scene.remove(m.model.root); m.plate.remove(); }
  mobs = [];
  resetMods();
  cardRanks = {};
  now = 0;
  pendingLevelUps = 0;
  autorun = false;
  Object.assign(player, {
    pos: new THREE.Vector3(0, heightAt(0, 0), 0), vel: new THREE.Vector3(), grounded: true,
    facing: Math.PI, moveState: 'idle', level: CFG.startLevel, xp: 0,
    lastManaUse: -1e9, nextRegen: CFG.regenTick, gcdUntil: 0, cds: {}, castAnimUntil: 0,
    channel: null, drink: null, targeting: false, lastCombat: -1e9, dead: false, kills: 0,
  });
  cam.offset = 0;
  player.hp = maxHp();
  player.mana = maxMana();
  blizCursor.visible = false;
  stopChannel();
  while (mobs.length < 30) spawnPack();
}

function spawnPack() {
  let center;
  for (let tries = 0; tries < 40; tries++) {
    const a = rand(0, Math.PI * 2), r = rand(15, 85);
    center = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    const farFromPlayer = dist2d(center, player.pos) > 40;
    const farFromPacks = mobs.every(m => m.dead || dist2d(m.home, center) > 18);
    if (farFromPlayer && farFromPacks) break;
  }
  const size = clamp(3 + Math.floor((player.level - 20) / 2) + randInt(-1, 1), 2, 10);
  const packId = ++packCounter;
  for (let i = 0; i < size; i++) {
    const level = Math.max(1, player.level + [-1, 0, 0, 1, 1, 2][randInt(0, 5)]);
    const pos = center.clone().add(new THREE.Vector3(rand(-5, 5), 0, rand(-5, 5)));
    collide(pos, 0.7);
    pos.y = heightAt(pos.x, pos.z);
    const model = buildBoar(level);
    model.root.position.copy(pos);
    model.root.rotation.y = rand(0, Math.PI * 2);
    scene.add(model.root);
    const plate = document.createElement('div');
    plate.className = 'plate';
    plate.innerHTML = `<span class="lv"></span> Wildeber<div class="hp"><div></div></div>`;
    overlay.appendChild(plate);
    mobs.push({
      model, plate, plateHp: plate.querySelector('.hp div'), plateLv: plate.querySelector('.lv'),
      pos: model.root.position, home: pos.clone(), combatStart: pos.clone(), packId,
      level, hp: mobMaxHp(level), maxHp: mobMaxHp(level),
      state: 'idle', assistAt: 0, nextSwing: 0, attackAt: -1e9, rootUntil: 0, slowUntil: 0, slowPct: 0,
      fleeRolled: false, fleeTarget: null, fleeUntil: 0, lastLeashExt: 0, dead: false, deathAt: 0, moving: false,
    });
  }
}

function enterCombat(mob, callForHelp) {
  if (mob.dead || mob.state === 'combat') return;
  mob.state = 'combat';
  mob.combatStart.copy(mob.pos);
  mob.lastLeashExt = now;
  mob.nextSwing = now + 500;
  mob.assistAt = 0;
  if (!callForHelp) return;
  for (const other of mobs) {                 // Social Aggro: 10 yd, Helfer nach 1,5 s
    if (other === mob || other.dead || other.state !== 'idle' || other.assistAt) continue;
    if (dist2d(other.pos, mob.pos) <= CFG.socialRadius) other.assistAt = now + CFG.socialDelay;
  }
}

function startEvade(mob) {
  mob.state = 'evade';
  mob.rootUntil = 0;
  mob.slowUntil = 0;
}

function isOutOfThreatArea(mob) {
  const area = Math.max(aggroRadius(mob) * 1.5, CFG.leashRadius);
  const out = dist2d(mob.pos, mob.combatStart) > area && dist2d(player.pos, mob.combatStart) > area;
  return out && now - mob.lastLeashExt > CFG.leashGrace;
}

function startFlee(mob) {
  let helper = null, best = CFG.fleeAssistRadius;
  for (const other of mobs) {
    if (other === mob || other.dead || other.state !== 'idle') continue;
    const d = dist2d(other.pos, mob.pos);
    if (d < best) { best = d; helper = other; }
  }
  mob.state = 'flee';
  mob.fleeTarget = helper;
  mob.fleeUntil = now + CFG.fleeDuration;
  combatText(mob.pos, 'läuft in Panik davon!', 'info', 2.5);
}

function moveMob(mob, target, dt, speedMul = 1, ignoreCC = false) {
  if (!ignoreCC && mob.rootUntil > now) return;
  let speed = CFG.mobSpeed * speedMul;
  if (!ignoreCC && mob.slowUntil > now) speed *= 1 - mob.slowPct;
  const dx = target.x - mob.pos.x, dz = target.z - mob.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.01) return;
  const step = Math.min(d, speed * dt / 1000);
  mob.pos.x += dx / d * step;
  mob.pos.z += dz / d * step;
  mob.moving = true;
  mob.speed = speed;
}

function faceMob(mob, target) {
  const want = Math.atan2(target.x - mob.pos.x, target.z - mob.pos.z);
  if (mob.rootUntil > now) return;
  mob.model.root.rotation.y = want;
}

function updateMob(mob, dt) {
  if (mob.dead) return;
  mob.moving = false;
  const d = dist2d(mob.pos, player.pos);

  if (mob.state === 'idle') {
    if (!player.dead && d < aggroRadius(mob)) enterCombat(mob, true);
    else if (mob.assistAt && now >= mob.assistAt) enterCombat(mob, false);
  }
  else if (mob.state === 'combat') {
    if (player.dead || isOutOfThreatArea(mob)) { startEvade(mob); return; }
    if (d > CFG.meleeRange) moveMob(mob, player.pos, dt);
    else if (now >= mob.nextSwing && mob.rootUntil <= now) {
      mob.nextSwing = now + CFG.swingTime;
      mob.attackAt = now;
      damagePlayer(mobHitDmg(mob.level));
    }
    faceMob(mob, player.pos);
  }
  else if (mob.state === 'flee') {
    const helper = mob.fleeTarget;
    if (helper && !helper.dead) {
      moveMob(mob, helper.pos, dt);
      faceMob(mob, helper.pos);
      if (dist2d(mob.pos, helper.pos) < 3) { enterCombat(helper, true); mob.state = 'combat'; }
    } else {
      const away = mob.pos.clone().multiplyScalar(2).sub(player.pos);
      moveMob(mob, away, dt);
      faceMob(mob, away);
      if (now >= mob.fleeUntil) mob.state = 'combat';
    }
  }
  else if (mob.state === 'evade') {
    moveMob(mob, mob.home, dt, 1.6, true);
    faceMob(mob, mob.home);
    mob.hp = mob.maxHp;
    if (dist2d(mob.pos, mob.home) < 0.5) { mob.state = 'idle'; mob.fleeRolled = false; }
  }
  collide(mob.pos, 0.7);
  mob.pos.y = heightAt(mob.pos.x, mob.pos.z);
}

// Mobs im Kampf schieben sich leicht auseinander
function separateMobs() {
  const active = mobs.filter(m => !m.dead && m.state !== 'idle');
  for (let i = 0; i < active.length; i++) {
    for (let k = i + 1; k < active.length; k++) {
      const a = active[i].pos, b = active[k].pos;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d > 0.001 && d < 1.3) {
        const push = (1.3 - d) / 2;
        if (active[i].rootUntil <= now) { a.x -= dx / d * push; a.z -= dz / d * push; }
        if (active[k].rootUntil <= now) { b.x += dx / d * push; b.z += dz / d * push; }
      }
    }
  }
}

// Gibt true zurück, wenn der Zauber getroffen hat
function damageMob(mob, amount, source) {
  if (mob.dead) return false;
  if (mob.state === 'evade') { combatText(mob.pos, 'Entkommen', 'miss'); return false; }
  if (mob.state === 'idle') enterCombat(mob, true);
  player.lastCombat = now;
  mob.lastLeashExt = now;

  if (Math.random() * 100 >= hitChance(mob)) { combatText(mob.pos, 'Widerstanden', 'miss'); return false; }

  const frozen = mob.rootUntil > now;
  const crit = Math.random() < CFG.baseCrit + (frozen ? mods.shatter : 0);
  const dmg = Math.round(amount * dmgMult() * (crit ? 1 + CFG.critBonus : 1));
  mob.hp -= dmg;
  mob.hitAt = now;
  if (crit) shakeCamera(0.18);
  combatText(mob.pos, dmg, crit ? 'crit' : 'dmg');
  hitSparkFx(mob.pos, source === 'ae' ? 'arcane' : 'frost');

  if (frozen && source !== 'nova' && Math.random() < CFG.novaBreakChance) mob.rootUntil = 0;

  if (mob.hp <= 0) { killMob(mob); return true; }
  if (!mob.fleeRolled && mob.hp < mob.maxHp * CFG.fleeHpPct) {
    mob.fleeRolled = true;
    if (Math.random() < CFG.fleeChance) startFlee(mob);
  }
  return true;
}

function killMob(mob) {
  mob.dead = true;
  mob.deathAt = now;
  mob.hp = 0;
  mob.rootUntil = 0;
  mob.plate.style.display = 'none';
  player.kills++;
  const xp = xpForKill(mob.level);
  if (xp > 0) { combatText(mob.pos, `+${xp} XP`, 'xp', 2); gainXp(xp); }
}

function damagePlayer(amount) {
  if (player.dead) return;
  player.hp -= amount;
  player.lastCombat = now;
  combatText(player.pos, amount, 'hurt', 2.6);
  if (player.drink) stopDrink();
  pushbackChannel();
  if (player.hp <= 0) die();
}

// Channel-Pushback: 1000, 800, 600, 400, 200, 200 ... ms (Spell::DelayedChannel)
function pushbackChannel() {
  const ch = player.channel;
  if (!ch) return;
  const delay = ch.delays < 5 ? 1000 - ch.delays * 200 : 200;
  ch.delays++;
  ch.end -= delay;
  if (ch.end <= now) stopChannel();
}

function spendMana(cost) {
  if (cost <= 0) return;
  player.mana -= cost;
  player.lastManaUse = now;              // startet die 5-Sekunden-Regel
}

function regenerate(dt) {
  if (now >= player.nextRegen) {         // Tick alle 2 s
    player.nextRegen += CFG.regenTick;
    let mana = spirit() / 4 + 12.5;
    if (now - player.lastManaUse < CFG.fiveSecRule) mana *= mods.castRegen;
    player.mana = Math.min(maxMana(), player.mana + mana);
    if (now - player.lastCombat > 5000) player.hp = Math.min(maxHp(), player.hp + maxHp() * 0.03);  // PH
  }
  if (player.drink) {                    // PH: 90 % Mana + 50 % HP über 18 s
    player.mana = Math.min(maxMana(), player.mana + maxMana() * 0.9 * dt / SPELLS.drink.dur);
    player.hp = Math.min(maxHp(), player.hp + maxHp() * 0.5 * dt / SPELLS.drink.dur);
    const full = player.mana >= maxMana() && player.hp >= maxHp();
    if (now >= player.drink.end || full) stopDrink();
  }
}

function gainXp(xp) {
  player.xp += xp;
  while (player.xp >= xpNeeded()) {
    player.xp -= xpNeeded();
    player.level++;
    pendingLevelUps++;
  }
  if (pendingLevelUps > 0 && !$('cardModal').classList.contains('show')) { levelUpFx(); showCards(); }
}

function die() {
  player.dead = true;
  player.hp = 0;
  stopChannel(); stopDrink();
  paused = true;
  setTimeout(() => {
    $('deathStats').innerHTML = `Level <b>${player.level}</b> · <b>${player.kills}</b> Kills · Zeit <b>${fmtTime(now)}</b>`;
    $('deathModal').classList.add('show');
  }, 900);
}

// Bewegung wie in WoW: A/D drehen, Q/E (oder A/D mit rechter Maus) seitwärts,
// kein Lenken in der Luft, Rückwärts langsamer.
function updatePlayer(dt) {
  const s = dt / 1000;
  const turn = (act('turnLeft') ? 1 : 0) - (act('turnRight') ? 1 : 0);
  if (!mouseBtn.right) player.facing += turn * CFG.turnSpeed * s;

  let fwd = (act('forward') || autorun || (mouseBtn.left && mouseBtn.right)) ? 1 : 0;
  if (act('back')) fwd -= 1;
  let strafe = (act('strafeRight') ? 1 : 0) - (act('strafeLeft') ? 1 : 0);
  if (mouseBtn.right) strafe -= turn;
  strafe = clamp(strafe, -1, 1);

  if (player.grounded) {
    const f = player.facing;
    let vx = Math.sin(f) * fwd - Math.cos(f) * strafe;
    let vz = Math.cos(f) * fwd + Math.sin(f) * strafe;
    const len = Math.hypot(vx, vz);
    const speed = fwd < 0 ? CFG.backSpeed : CFG.runSpeed;
    player.vel.x = len ? vx / len * speed : 0;
    player.vel.z = len ? vz / len * speed : 0;
    player.moveState = len ? (fwd < 0 ? 'back' : 'run') : 'idle';
    if (jumpQueued) {
      player.vel.y = CFG.jumpSpeed;
      player.grounded = false;
    }
  }
  jumpQueued = false;

  const moved = Math.hypot(player.vel.x, player.vel.z) > 0 || !player.grounded;
  player.pos.x += player.vel.x * s;
  player.pos.z += player.vel.z * s;
  collide(player.pos, 0.45);

  const ground = heightAt(player.pos.x, player.pos.z);
  if (player.grounded) {
    player.pos.y = ground;               // klebt am Boden (auch bergab)
  } else {
    player.vel.y -= CFG.gravity * s;
    player.pos.y += player.vel.y * s;
    if (player.pos.y <= ground) { player.pos.y = ground; player.vel.y = 0; player.grounded = true; }
  }

  if (moved) {
    if (player.channel) stopChannel();   // Bewegung bricht Channel und Trinken ab
    if (player.drink) stopDrink();
    if (!mouseBtn.left) cam.offset -= cam.offset * Math.min(1, s * 3);   // Kamera dreht sich langsam hinter den Spieler
  }
  updateChannel();
  regenerate(dt);
}

function cast(id, point?) {
  if (paused || player.dead) return;
  if (now < player.gcdUntil || (player.cds[id] || 0) > now) return showError('Fähigkeit ist noch nicht bereit');
  const cost = manaCost(id);
  if (player.mana < cost) return showError('Nicht genug Mana');
  if (id === 'bliz' && dist2d(player.pos, point) > SPELLS.bliz.range) return showError('Außer Reichweite');
  if (id === 'drink' && !player.grounded) return showError('Du kannst das nicht im Sprung tun');

  stopChannel();
  stopDrink();
  spendMana(cost);
  player.gcdUntil = now + CFG.gcd;
  if (SPELLS[id].cd) player.cds[id] = now + spellCd(id);
  if (id !== 'drink' && id !== 'bliz') { player.castAnimUntil = now + 450; crystalBurst(SPELLS[id].cls); }
  SPELL_EFFECTS[id](point);
}

const mobsInRadius = (center, r) => mobs.filter(m => !m.dead && dist2d(m.pos, center) <= r);

const SPELL_EFFECTS = {
  nova() {
    const s = SPELLS.nova;
    for (const m of mobsInRadius(player.pos, s.radius)) {
      if (damageMob(m, rand(s.min, s.max), 'nova') && !m.dead) m.rootUntil = now + s.root;
    }
    novaFx(player.pos, s.radius);
  },
  ae() {
    const s = SPELLS.ae;
    for (const m of mobsInRadius(player.pos, s.radius)) damageMob(m, rand(s.min, s.max), 'ae');
    arcaneExplosionFx(player.pos, s.radius);
  },
  bliz(point) {
    player.channel = { id: 'bliz', point: point.clone(), start: now, end: now + SPELLS.bliz.channel, nextTick: now + 1000, delays: 0 };
    player.targeting = false;
    blizCursor.visible = false;
    blizFx.g.position.copy(point);
    drape(blizFx.disc, point, blizRadius());
    for (const sh of blizFx.shards) resetShard(sh, true);
    blizFx.g.visible = blizFx.disc.visible = true;
    blizFx.cloud.scale.setScalar(blizRadius() / 8 * 0.2);
  },
  coc() {
    const s = SPELLS.coc;
    for (const m of mobsInRadius(player.pos, s.range)) {
      const angleToMob = Math.atan2(m.pos.x - player.pos.x, m.pos.z - player.pos.z);
      const diff = Math.abs(Math.atan2(Math.sin(angleToMob - player.facing), Math.cos(angleToMob - player.facing)));
      if (diff > s.angle / 2) continue;
      if (damageMob(m, rand(s.min, s.max), 'coc') && !m.dead) applySlow(m, s.slow, s.slowDur);
    }
    coneOfColdFx(s.range, s.angle);
  },
  blink() {
    const from = player.pos.clone();
    player.pos.x += Math.sin(player.facing) * SPELLS.blink.dist;
    player.pos.z += Math.cos(player.facing) * SPELLS.blink.dist;
    collide(player.pos, 0.45);
    player.pos.y = heightAt(player.pos.x, player.pos.z);
    player.grounded = true;
    player.vel.set(0, 0, 0);
    blinkFx(from, player.pos);
  },
  drink() {
    player.drink = { start: now, end: now + SPELLS.drink.dur };
  },
};

// Stärkerer Slow gewinnt; abgelaufener Slow zählt nicht mehr
function applySlow(mob, pct, dur) {
  if (mob.slowUntil <= now) mob.slowPct = 0;
  mob.slowPct = Math.max(mob.slowPct, pct);
  mob.slowUntil = Math.max(mob.slowUntil, now + dur);
}

function updateChannel() {
  const ch = player.channel;
  if (!ch) return;
  while (ch.nextTick <= now && ch.nextTick <= ch.end) {
    ch.nextTick += 1000;
    for (const m of mobsInRadius(ch.point, blizRadius())) {
      if (damageMob(m, SPELLS.bliz.tick, 'bliz') && !m.dead && mods.blizSlow > 0) applySlow(m, mods.blizSlow, 1500);
    }
  }
  if (now >= ch.end) stopChannel();
}

function stopChannel() {
  player.channel = null;
  blizFx.g.visible = blizFx.disc.visible = false;
}
function stopDrink() {
  player.drink = null;
}

// ---------- Partikelsystem (ein Draw-Call, additiv, HDR-Farben > 1 erzeugen Bloom) ----------
const FROST = [0.35, 1.0, 2.1], FROST_WHITE = [1.1, 1.5, 2.1], MIST = [0.05, 0.1, 0.15];
const ARCANE = [1.5, 0.45, 2.1], ARCANE_PINK = [1.9, 0.7, 1.6], GOLD = [2.2, 1.6, 0.5];
const SCHOOL_COLOR = { frost: FROST, arcane: ARCANE };

const particles = (() => {
  const MAX = 5000;
  const posArr = new Float32Array(MAX * 3), colArr = new Float32Array(MAX * 3), sizeArr = new Float32Array(MAX);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute('pcolor', new THREE.BufferAttribute(colArr, 3));
  geo.setAttribute('psize', new THREE.BufferAttribute(sizeArr, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: glowTex }, scale: { value: 1 } },
    vertexShader: `attribute float psize; attribute vec3 pcolor; uniform float scale; varying vec3 vColor;
      void main() { vColor = pcolor; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = psize * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; varying vec3 vColor;
      void main() { gl_FragColor = vec4(vColor, 1.0) * texture2D(map, gl_PointCoord); }`,
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  const list = [];

  // o: { x,y,z, vx,vy,vz, life, color:[r,g,b], size, grow, grav, drag }
  function spawn(o) {
    if (list.length >= MAX) return;
    list.push({ vx: 0, vy: 0, vz: 0, grow: 0, grav: 0, drag: 0, ...o, max: o.life });
  }
  function update(dt) {
    const s = dt / 1000;
    mat.uniforms.scale.value = innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    let n = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= s;
      if (p.life <= 0) { list[i] = list[list.length - 1]; list.pop(); continue; }
      const d = Math.max(0, 1 - p.drag * s);
      p.vx *= d; p.vz *= d; p.vy = p.vy * d - p.grav * s;
      p.x += p.vx * s; p.y += p.vy * s; p.z += p.vz * s;
    }
    for (const p of list) {
      const f = p.life / p.max;                       // 1 → 0
      const fade = Math.min(1, f * 2.5) * Math.min(1, (1 - f) * 20 + 0.05);
      posArr[n * 3] = p.x; posArr[n * 3 + 1] = p.y; posArr[n * 3 + 2] = p.z;
      colArr[n * 3] = p.color[0] * fade; colArr[n * 3 + 1] = p.color[1] * fade; colArr[n * 3 + 2] = p.color[2] * fade;
      sizeArr[n] = p.size * (1 + (1 - f) * p.grow);
      n++;
    }
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = geo.attributes.pcolor.needsUpdate = geo.attributes.psize.needsUpdate = true;
  }
  return { spawn, update };
})();
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
// Anzahl Partikel pro Frame für eine Rate (pro Sekunde)
const perFrame = (rate, dt) => { const n = rate * dt / 1000; return Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); };

// Heller Lichtblitz (Sprite, wächst und verblasst)
function flashFx(pos, color, size, dur) {
  const sp = glowSprite(color, 0.1);
  sp.position.copy(pos);
  addEffect(sp, dur, t => { sp.scale.setScalar(size * (0.3 + t * 0.7)); sp.material.opacity = 0.6 * (1 - t); });
}
// Schockwellen-Ring am Boden
function ringFx(pos, radius, color, dur) {
  const mesh = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(...color), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  mesh.position.set(pos.x, pos.y + 0.35, pos.z);
  addEffect(mesh, dur, t => { mesh.scale.setScalar(Math.max(0.01, radius * Math.sqrt(t))); mesh.material.opacity = 1 - t; });
}

// Canvas-Texturen für Bodeneffekte
function canvasTex(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  draw(c.getContext('2d'), 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const iceTex = canvasTex((g, r) => {                      // Eisfläche mit Rissen
  const grd = g.createRadialGradient(r, r, 0, r, r, r);
  grd.addColorStop(0, 'rgba(220,245,255,0.75)');
  grd.addColorStop(0.75, 'rgba(170,220,255,0.55)');
  grd.addColorStop(1, 'rgba(170,220,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 2 * r, 2 * r);
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 26; i++) {                          // Risse vom Zentrum nach außen
    let a = Math.random() * Math.PI * 2, x = r, y = r;
    g.lineWidth = rand(1, 3);
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 7; k++) {
      a += rand(-0.4, 0.4);
      x += Math.cos(a) * rand(20, 38); y += Math.sin(a) * rand(20, 38);
      g.lineTo(x, y);
    }
    g.stroke();
  }
});
const runeTex = canvasTex((g, r) => {                     // Arkaner Runenkreis
  g.strokeStyle = '#fff'; g.fillStyle = '#fff';
  for (const [rad, w] of [[0.95, 6], [0.82, 3], [0.55, 4], [0.45, 2]]) {
    g.lineWidth = w; g.beginPath(); g.arc(r, r, r * rad, 0, Math.PI * 2); g.stroke();
  }
  for (let i = 0; i < 6; i++) {                           // Hexagramm
    const a = i / 6 * Math.PI * 2, b = (i + 2) / 6 * Math.PI * 2;
    g.lineWidth = 3; g.beginPath();
    g.moveTo(r + Math.cos(a) * r * 0.55, r + Math.sin(a) * r * 0.55);
    g.lineTo(r + Math.cos(b) * r * 0.55, r + Math.sin(b) * r * 0.55); g.stroke();
  }
  for (let i = 0; i < 24; i++) {                          // Runenzeichen zwischen den Ringen
    const a = i / 24 * Math.PI * 2;
    g.save(); g.translate(r + Math.cos(a) * r * 0.885, r + Math.sin(a) * r * 0.885); g.rotate(a + Math.PI / 2);
    g.lineWidth = 3; g.beginPath();
    for (let k = 0; k < 3; k++) { g.moveTo(rand(-9, 9), rand(-11, 11)); g.lineTo(rand(-9, 9), rand(-11, 11)); }
    g.stroke(); g.restore();
  }
});

// Bodeneffekt, der sich ans Gelände legt, sich dreht/skaliert und ausblendet
function groundDecalFx(tex, center, radius, color, dur, { additive = false, spin = 0, grow = 0.15, peak = 1 } = {}) {
  const mesh = terrainDecal(new THREE.RingGeometry(0, 1, 48, 8), new THREE.MeshBasicMaterial({
    map: tex, color: new THREE.Color(...color), transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
  const c = center.clone();
  addEffect(mesh, dur, t => {
    drape(mesh, c, radius * Math.min(1, t / grow));
    mesh.rotation.y = spin * t;
    mesh.material.opacity = peak * (t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3);
  });
}

const spikeGeo = new THREE.ConeGeometry(0.22, 1.5, 5);
function novaFx(pos, radius) {
  groundDecalFx(iceTex, pos, radius, [1, 1, 1], 4000, { grow: 0.04, peak: 0.85 });
  shakeCamera(0.12);
  ringFx(pos, radius, FROST_WHITE, 450);
  flashFx(new THREE.Vector3(pos.x, pos.y + 1, pos.z), 0x9fdcff, 5, 250);
  for (let i = 0; i < 160; i++) {                           // Frostwelle über den Boden
    const a = rand(0, Math.PI * 2), sp = rand(14, 22);
    particles.spawn({ x: pos.x, y: pos.y + rand(0.2, 0.8), z: pos.z, vx: Math.cos(a) * sp, vy: rand(0, 1.5), vz: Math.sin(a) * sp,
      drag: 2.6, life: rand(0.5, 0.85), color: pick([FROST, FROST_WHITE]), size: rand(0.25, 0.6) });
  }
  for (let i = 0; i < 25; i++) {                            // kalter Nebel
    const a = rand(0, Math.PI * 2), sp = rand(4, 9);
    particles.spawn({ x: pos.x, y: pos.y + 0.5, z: pos.z, vx: Math.cos(a) * sp, vy: 0.3, vz: Math.sin(a) * sp,
      drag: 1.5, life: rand(1, 1.6), color: MIST, size: rand(2, 3.5), grow: 1 });
  }
  // Eisspitzen aus dem Boden
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 1.15, 1.5), transparent: true });
  for (let i = 0; i < 30; i++) {
    const a = i / 30 * Math.PI * 2 + rand(-0.1, 0.1), r = radius * rand(0.45, 0.95);
    const x = pos.x + Math.cos(a) * r, z = pos.z + Math.sin(a) * r;
    const sp = new THREE.Mesh(spikeGeo, mat);
    sp.position.set(x, heightAt(x, z), z);
    sp.rotation.set(rand(-0.35, 0.35), 0, rand(-0.35, 0.35));
    g.add(sp);
  }
  scene.add(g);
  effects.push({ mesh: g, start: performance.now(), dur: 1000, shared: true,
    update: t => { const k = t < 0.15 ? t / 0.15 : 1; g.children.forEach(c => c.scale.set(1, k, 1)); mat.opacity = t < 0.6 ? 0.9 : 0.9 * (1 - (t - 0.6) / 0.4); } });
}

function arcaneExplosionFx(pos, radius) {
  const c = new THREE.Vector3(pos.x, pos.y + 1, pos.z);
  groundDecalFx(runeTex, pos, radius, [1.8, 0.7, 2.4], 700, { additive: true, spin: 1.2, grow: 0.25 });
  flashFx(c, 0xd890ff, 6, 250);
  ringFx(pos, radius, ARCANE_PINK, 350);
  for (let i = 0; i < 180; i++) {                           // Kugel-Explosion
    const dir = new THREE.Vector3(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).normalize();
    const sp = rand(15, 24);
    particles.spawn({ x: c.x, y: c.y, z: c.z, vx: dir.x * sp, vy: dir.y * sp * 0.6, vz: dir.z * sp,
      drag: 3.2, life: rand(0.4, 0.7), color: pick([ARCANE, ARCANE_PINK]), size: rand(0.22, 0.5) });
  }
  for (let i = 0; i < 40; i++) {                            // Funken, die nachglühen und aufsteigen
    const a = rand(0, Math.PI * 2), r = rand(1, radius);
    particles.spawn({ x: pos.x + Math.cos(a) * r, y: pos.y + rand(0.3, 1.5), z: pos.z + Math.sin(a) * r,
      vy: rand(1, 3), life: rand(0.6, 1.1), color: ARCANE_PINK, size: rand(0.2, 0.35) });
  }
}

function coneOfColdFx(range, angle) {
  const hand = new THREE.Vector3();
  mage.anchors.handL.getWorldPosition(hand);
  for (let i = 0; i < 150; i++) {
    const a = player.facing + rand(-angle / 2, angle / 2), sp = rand(14, 24);
    particles.spawn({ x: hand.x, y: hand.y, z: hand.z, vx: Math.sin(a) * sp, vy: rand(-2, 1.5), vz: Math.cos(a) * sp,
      drag: 2.4, life: rand(0.45, 0.8), color: pick([FROST, FROST_WHITE, FROST]), size: rand(0.4, 0.9) });
  }
  for (let i = 0; i < 20; i++) {
    const a = player.facing + rand(-angle / 2, angle / 2), sp = rand(5, 10);
    particles.spawn({ x: hand.x, y: hand.y - 0.5, z: hand.z, vx: Math.sin(a) * sp, vz: Math.cos(a) * sp,
      drag: 1.2, life: rand(1, 1.5), color: MIST, size: rand(2, 3), grow: 1.2 });
  }
}

function blinkFx(from, to) {
  for (const p of [from, to]) {
    const c = new THREE.Vector3(p.x, p.y + 1.2, p.z);
    flashFx(c, 0xd890ff, 5, 300);
    for (let i = 0; i < 70; i++) {
      const dir = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
      particles.spawn({ x: c.x, y: c.y, z: c.z, vx: dir.x * 6, vy: dir.y * 6, vz: dir.z * 6,
        drag: 3, life: rand(0.3, 0.6), color: pick([ARCANE, ARCANE_PINK]), size: rand(0.25, 0.5) });
    }
  }
  for (let i = 0; i < 80; i++) {                            // Spur zwischen Start und Ziel
    const t = Math.random();
    particles.spawn({ x: lerpTo(from.x, to.x, t) + rand(-0.3, 0.3), y: lerpTo(from.y, to.y, t) + rand(0.5, 1.8), z: lerpTo(from.z, to.z, t) + rand(-0.3, 0.3),
      vy: rand(0.2, 1), life: rand(0.3, 0.7), color: ARCANE, size: rand(0.2, 0.4) });
  }
}

function hitSparkFx(pos, school) {
  const color = SCHOOL_COLOR[school] || FROST_WHITE;
  for (let i = 0; i < 10; i++) {
    particles.spawn({ x: pos.x, y: pos.y + 0.9, z: pos.z, vx: rand(-4, 4), vy: rand(1, 5), vz: rand(-4, 4),
      grav: 9, drag: 1, life: rand(0.25, 0.5), color, size: rand(0.15, 0.3) });
  }
}

function crystalBurst(school) {
  const c = new THREE.Vector3();
  mage.anchors.crystal.getWorldPosition(c);
  const color = SCHOOL_COLOR[school] || FROST;
  for (let i = 0; i < 25; i++) {
    const dir = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
    particles.spawn({ x: c.x, y: c.y, z: c.z, vx: dir.x * 4, vy: dir.y * 4, vz: dir.z * 4,
      drag: 3, life: rand(0.2, 0.45), color, size: rand(0.15, 0.35) });
  }
}

function levelUpFx() {
  for (let i = 0; i < 180; i++) {
    const a = rand(0, Math.PI * 2), r = rand(0.3, 1.4);
    particles.spawn({ x: player.pos.x + Math.cos(a) * r, y: player.pos.y + rand(0, 0.5), z: player.pos.z + Math.sin(a) * r,
      vx: -Math.sin(a) * 2, vy: rand(4, 10), vz: Math.cos(a) * 2, drag: 0.6, life: rand(0.8, 1.5), color: GOLD, size: rand(0.2, 0.5) });
  }
  flashFx(new THREE.Vector3(player.pos.x, player.pos.y + 1, player.pos.z), 0xffd060, 8, 600);
}

// Laufende Emitter: Kristall, Blizzard, Trinken, eingefrorene Mobs
const tmpV = new THREE.Vector3();
function ambientParticles(dt) {
  if (!dt) return;
  mage.anchors.crystal.getWorldPosition(tmpV);
  const channeling = !!player.channel;
  for (let i = perFrame(channeling ? 45 : 5, dt); i > 0; i--) {
    const a = rand(0, Math.PI * 2), r = channeling ? 0.35 : 0.1;
    particles.spawn({ x: tmpV.x + Math.cos(a) * r, y: tmpV.y, z: tmpV.z + Math.sin(a) * r,
      vx: -Math.sin(a) * (channeling ? 2 : 0.2), vy: rand(0.5, channeling ? 4 : 1), vz: Math.cos(a) * (channeling ? 2 : 0.2),
      life: rand(0.4, 0.9), color: FROST, size: rand(0.12, channeling ? 0.35 : 0.2) });
  }
  if (player.channel) {
    const c = player.channel.point, r = blizRadius();
    for (let i = perFrame(40, dt); i > 0; i--) {             // wirbelnder Schnee
      const a = rand(0, Math.PI * 2), d = r * Math.sqrt(Math.random());
      particles.spawn({ x: c.x + Math.cos(a) * d, y: c.y + rand(4, 12), z: c.z + Math.sin(a) * d,
        vx: -Math.sin(a) * 3, vy: -rand(5, 9), vz: Math.cos(a) * 3, life: rand(0.8, 1.4), color: FROST_WHITE, size: rand(0.12, 0.25) });
    }
    for (let i = perFrame(5, dt); i > 0; i--) {              // Kältenebel am Boden
      const a = rand(0, Math.PI * 2), d = r * Math.sqrt(Math.random());
      const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      particles.spawn({ x, y: heightAt(x, z) + 0.4, z, vx: rand(-1, 1), vz: rand(-1, 1),
        life: rand(1.2, 2), color: MIST, size: rand(2.5, 4), grow: 0.6 });
    }
  }
  if (player.drink) {
    for (let i = perFrame(12, dt); i > 0; i--) {
      const a = rand(0, Math.PI * 2);
      particles.spawn({ x: player.pos.x + Math.cos(a) * 0.8, y: player.pos.y + rand(0, 1), z: player.pos.z + Math.sin(a) * 0.8,
        vy: rand(0.8, 1.6), life: rand(0.8, 1.3), color: [0.6, 1.2, 2.6], size: rand(0.12, 0.22) });
    }
  }
  for (const m of mobs) {
    if (m.dead || m.rootUntil <= now) continue;
    for (let i = perFrame(4, dt); i > 0; i--) {
      particles.spawn({ x: m.pos.x + rand(-0.7, 0.7), y: m.pos.y + rand(0.3, 1.6), z: m.pos.z + rand(-0.9, 0.9),
        vy: rand(0.3, 0.8), life: rand(0.6, 1), color: FROST, size: rand(0.12, 0.22) });
    }
  }
}

function addEffect(mesh, dur, update) {
  scene.add(mesh);
  effects.push({ mesh, start: performance.now(), dur, update });
}
function updateEffects() {
  const t0 = performance.now();
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    const t = (t0 - e.start) / e.dur;
    if (t >= 1) {
      scene.remove(e.mesh);
      if (!e.shared) { e.mesh.geometry.dispose(); e.mesh.material.dispose(); }
      effects.splice(i, 1);
    } else e.update(t);
  }
}
function resetShard(sh, randomHeight) {
  const r = blizRadius() * Math.sqrt(Math.random()), a = rand(0, Math.PI * 2);
  sh.position.set(Math.cos(a) * r, randomHeight ? rand(0, 16) : rand(14, 18), Math.sin(a) * r);
}

function screenPos(pos, height) {
  const p = new THREE.Vector3(pos.x, pos.y + height, pos.z).project(camera);
  if (p.z > 1) return null;
  return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight };
}

function combatText(pos, text, cls, height = 2) {
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

function showError(msg) {
  const el = $('err');
  el.textContent = msg;
  el.classList.remove('show');
  void el.offsetWidth;               // Animation neu starten
  el.classList.add('show');
}

const fmtTime = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

// Actionbar
const slots: any = {};
for (const [id, s] of Object.entries(SPELLS)) {
  const el = document.createElement('div');
  el.className = `slot ${s.cls}`;
  el.innerHTML = `<span class="key"></span>${s.name}<div class="cd"></div><div class="cdText"></div>`;
  el.addEventListener('click', () => pressSpell(id));
  $('actionbar').appendChild(el);
  slots[id] = { el, key: el.querySelector('.key'), cd: el.querySelector('.cd'), cdText: el.querySelector('.cdText') };
}

function refreshKeyLabels() {
  for (const id in slots) slots[id].key.textContent = binds[id].key;
  const b = id => `<b>${binds[id].key}</b>`;
  $('help').innerHTML =
    `${b('forward')} ${b('back')} vor/zurück · ${b('turnLeft')} ${b('turnRight')} drehen<br>` +
    `${b('strafeLeft')} ${b('strafeRight')} seitwärts · ${b('jump')} springen · ${b('autorun')} Autorun<br>` +
    `<b>LMB ziehen</b> Kamera · <b>RMB ziehen</b> Charakter<br><b>Mausrad</b> Zoom`;
}

function updateHud() {
  const hpMax = maxHp(), manaMax = maxMana();
  $('lvl').textContent = player.level;
  $('hpFill').style.transform = `scaleX(${clamp(player.hp / hpMax, 0, 1)})`;
  $('hpText').textContent = `${Math.ceil(Math.max(0, player.hp))} / ${hpMax}`;
  $('manaFill').style.transform = `scaleX(${clamp(player.mana / manaMax, 0, 1)})`;
  $('manaText').textContent = `${Math.floor(player.mana)} / ${manaMax}`;
  const fsrLeft = clamp(1 - (now - player.lastManaUse) / CFG.fiveSecRule, 0, 1);
  $('fsrFill').style.width = `${fsrLeft * 100}%`;
  $('status').textContent = player.drink ? 'Trinkt …' : autorun ? 'Autorun' : fsrLeft > 0 ? '5-Sekunden-Regel: keine Regeneration' : '';

  const need = xpNeeded();
  $('xpFill').style.transform = `scaleX(${player.xp / need})`;
  $('xpText').textContent = `XP ${player.xp} / ${need}`;

  $('iTime').textContent = fmtTime(now);
  $('iKills').textContent = player.kills;
  $('iCombat').textContent = String(mobs.filter(m => !m.dead && (m.state === 'combat' || m.state === 'flee')).length);

  // Castbar (Channel läuft von rechts nach links wie in WoW)
  const ch = player.channel, dr = player.drink;
  if (ch || dr) {
    const bar = ch || dr;
    const left = clamp((bar.end - now) / (bar.end - bar.start), 0, 1);
    $('castbar').style.display = 'block';
    $('castFill').style.transform = `scaleX(${left})`;
    $('castText').textContent = `${ch ? 'Blizzard' : 'Trinken'} ${((bar.end - now) / 1000).toFixed(1)}`;
  } else $('castbar').style.display = 'none';

  for (const [id, sl] of Object.entries<any>(slots)) {
    const cdEnd = Math.max(player.cds[id] || 0, player.gcdUntil);
    const total = (player.cds[id] || 0) > player.gcdUntil ? spellCd(id) : CFG.gcd;
    const left = Math.max(0, cdEnd - now);
    const pct = left > 0 ? left / total * 100 : 0;
    sl.cd.style.background = pct > 0 ? `conic-gradient(#000a ${pct}%, transparent 0)` : 'none';
    sl.cdText.textContent = (player.cds[id] || 0) - now > 1500 ? Math.ceil(left / 1000) : '';
    sl.el.classList.toggle('nomana', player.mana < manaCost(id));
    sl.el.classList.toggle('active', (id === 'bliz' && (player.targeting || !!ch)) || (id === 'drink' && !!dr));
  }

  // Nameplates
  for (const m of mobs) {
    if (m.dead) continue;
    const show = m.state !== 'idle' || dist2d(m.pos, player.pos) < 35;
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

// Level-Up-Karten
function showCards() {
  paused = true;
  const available = CARDS.filter(c => (cardRanks[c.id] || 0) < c.max);
  const picks = available.sort(() => Math.random() - 0.5).slice(0, 3);
  $('cardLvl').textContent = String(player.level - pendingLevelUps + 1);
  $('cards').innerHTML = '';
  for (const c of picks) {
    const rank = cardRanks[c.id] || 0;
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
  card.apply(cardRanks[card.id] || 0);
  cardRanks[card.id] = (cardRanks[card.id] || 0) + 1;
  pendingLevelUps--;
  player.hp = maxHp();                 // Ding füllt auf
  player.mana = maxMana();
  $('cardModal').classList.remove('show');
  if (pendingLevelUps > 0) showCards();
  else paused = false;
}

// Tastenbelegung-Menü
function openBinds() {
  paused = true;
  renderBinds();
  $('bindModal').classList.add('show');
}
function closeBinds() {
  rebinding = null;
  $('bindModal').classList.remove('show');
  paused = $('startModal').classList.contains('show') || $('cardModal').classList.contains('show') || player.dead;
}
function renderBinds() {
  const list = $('bindList');
  list.innerHTML = '';
  for (const a of ACTIONS) {
    if (a.group) { list.insertAdjacentHTML('beforeend', `<div class="group">${a.group}</div>`); continue; }
    const label = document.createElement('span');
    label.textContent = a.label;
    const btn = document.createElement('button');
    btn.className = 'bindBtn' + (rebinding === a.id ? ' waiting' : '');
    btn.textContent = rebinding === a.id ? 'Taste drücken …' : binds[a.id].key;
    btn.addEventListener('click', () => { rebinding = a.id; renderBinds(); });
    list.append(label, btn);
  }
}
function setBind(id, e) {
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

function pressSpell(id) {
  if (paused || player.dead) return;
  if (id === 'bliz') {                       // erst Zielmodus, Cast per Klick
    player.targeting = !player.targeting;
    blizCursor.visible = player.targeting;
    return;
  }
  cast(id);
}

addEventListener('keydown', e => {
  if (rebinding) {
    e.preventDefault();
    if (e.code !== 'Escape') setBind(rebinding, e);
    rebinding = null;
    renderBinds();
    return;
  }
  if (e.code === 'Escape') {
    if (player.targeting) { player.targeting = false; blizCursor.visible = false; }
    else if ($('bindModal').classList.contains('show')) closeBinds();
    else if (!paused) openBinds();
    return;
  }
  const id = actionForCode(e.code);
  if (id) e.preventDefault();
  held.add(e.code);
  if (e.repeat || !id) return;
  if (SPELLS[id]) pressSpell(id);
  if (id === 'jump') jumpQueued = true;
  if (id === 'autorun') autorun = !autorun;
  if (id === 'back' || id === 'forward') autorun = false;
});
addEventListener('keyup', e => held.delete(e.code));
addEventListener('blur', () => { held.clear(); mouseBtn.left = mouseBtn.right = false; });

const canvas = renderer.domElement;
canvas.addEventListener('mousedown', e => {
  if (e.button === 0) mouseBtn.left = true;
  if (e.button === 2) {
    mouseBtn.right = true;
    player.facing += cam.offset;               // Charakter dreht sich in Kamerarichtung
    cam.offset = 0;
  }
  mouse.dragged = false;
  mouse.downX = e.clientX; mouse.downY = e.clientY;
});
addEventListener('mouseup', e => {
  const wasClick = !mouse.dragged;
  if (e.button === 0) mouseBtn.left = false;
  if (e.button === 2) mouseBtn.right = false;
  if (document.pointerLockElement && !mouseBtn.left && !mouseBtn.right) document.exitPointerLock();
  if (!wasClick || !player.targeting || e.target !== canvas) return;
  if (e.button === 0) cast('bliz', mouse.ground.clone());
  else { player.targeting = false; blizCursor.visible = false; }
});
addEventListener('mousemove', e => {
  if (mouseBtn.left || mouseBtn.right) {
    if (!mouse.dragged && Math.hypot(e.clientX - mouse.downX, e.clientY - mouse.downY) > 4) {
      mouse.dragged = true;
      try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch { /* ohne Lock geht's auch */ }
    }
    if (mouse.dragged) {
      const yaw = -e.movementX * 0.005;
      if (mouseBtn.right) player.facing += yaw; else cam.offset += yaw;
      cam.pitch = clamp(cam.pitch + e.movementY * 0.004, -0.2, 1.35);
    }
  }
  if (!document.pointerLockElement) mouse.ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => { cam.dist = clamp(cam.dist + Math.sign(e.deltaY) * 1.5, 3, 35); });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

$('startBtn').addEventListener('click', () => { $('startModal').classList.remove('show'); paused = false; ding(); });
$('restartBtn').addEventListener('click', () => {
  $('deathModal').classList.remove('show');
  resetGame();
  paused = false;
});
$('bindsOpen').addEventListener('click', openBinds);
$('bindsClose').addEventListener('click', closeBinds);
$('bindsReset').addEventListener('click', () => { binds = defaultBinds(); saveBinds(); refreshKeyLabels(); renderBinds(); });

// Mauszeiger auf den Boden projizieren (Ray-Marching über die Höhenfunktion)
const raycaster = new THREE.Raycaster();
function pickGround() {
  raycaster.setFromCamera(mouse.ndc, camera);
  const { origin, direction } = raycaster.ray;
  const p = new THREE.Vector3();
  for (let t = 0; t < 150; t += 0.5) {
    p.copy(origin).addScaledVector(direction, t);
    if (p.y <= heightAt(p.x, p.z)) { mouse.ground.set(p.x, heightAt(p.x, p.z), p.z); return; }
  }
}

function update(dt) {
  updatePlayer(dt);
  for (const m of mobs) updateMob(m, dt);
  separateMobs();

  // Leichen nach 4 s entfernen, Packs nachspawnen
  mobs = mobs.filter(m => {
    if (m.dead && now - m.deathAt > 4000) { scene.remove(m.model.root); m.plate.remove(); return false; }
    return true;
  });
  const activePacks = new Set(mobs.filter(m => !m.dead).map(m => m.packId)).size;
  if (activePacks < CFG.packCount) spawnPack();
}

// Kamera-Wackeln (z. B. bei Crits): klingt schnell ab
function shakeCamera(amount) { cam.shake = Math.max(cam.shake || 0, amount); }

// Leiche versinkt nach 1,5 s im Boden, mit Staubwolke
function sinkCorpse(mob) {
  const t = clamp((now - mob.deathAt - 1500) / 2000, 0, 1);
  if (t > 0 && !mob.dusted) {
    mob.dusted = true;
    for (let i = 0; i < 18; i++) {
      const a = rand(0, Math.PI * 2);
      particles.spawn({ x: mob.pos.x + Math.cos(a) * 0.6, y: mob.pos.y + 0.3, z: mob.pos.z + Math.sin(a) * 0.6,
        vx: Math.cos(a) * rand(0.5, 1.5), vy: rand(0.3, 1), vz: Math.sin(a) * rand(0.5, 1.5), drag: 1.5,
        life: rand(0.8, 1.4), color: [0.09, 0.07, 0.05], size: rand(1, 1.8), grow: 0.8 });
    }
  }
  mob.pos.y = heightAt(mob.pos.x, mob.pos.z) - t * 1.4;
}

// Anteil t (0..1) auf der Strecke a→b (nur x/z), an dem sie den Kreis trifft; 1 = kein Treffer
function segmentHitsCircle(a, b, c, r) {
  const dx = b.x - a.x, dz = b.z - a.z, fx = a.x - c.x, fz = a.z - c.z;
  const A = dx * dx + dz * dz, B = 2 * (fx * dx + fz * dz), C = fx * fx + fz * fz - r * r;
  if (C < 0) return 1;                                   // Spieler steht selbst unter dem Baum
  const disc = B * B - 4 * A * C;
  if (disc < 0) return 1;
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  return t >= 0 && t <= 1 ? t : 1;
}

function updateCamera() {
  const yaw = player.facing + cam.offset;
  const target = new THREE.Vector3(player.pos.x, player.pos.y + 1.8, player.pos.z);
  const horiz = Math.cos(cam.pitch) * cam.dist;
  camera.position.set(
    target.x - Math.sin(yaw) * horiz,
    target.y + Math.sin(cam.pitch) * cam.dist,
    target.z - Math.cos(yaw) * horiz);
  // Kamera vor Baumkronen heranziehen (wie WoW-Kamerakollision)
  let nearest = 1;
  for (const o of obstacles) {
    if (o.canopy) nearest = Math.min(nearest, segmentHitsCircle(target, camera.position, o, o.canopy));
  }
  if (nearest < 1) camera.position.lerpVectors(target, camera.position, Math.max(0.15, nearest - 0.05));
  const minY = heightAt(camera.position.x, camera.position.z) + 0.5;   // nicht unter den Boden
  if (camera.position.y < minY) camera.position.y = minY;
  camera.lookAt(target);
  if (cam.shake > 0.001) {
    camera.position.x += rand(-1, 1) * cam.shake;
    camera.position.y += rand(-1, 1) * cam.shake;
    cam.shake *= 0.86;
  }

}

function updateVisuals(dt) {
  updateCamera();
  if (player.targeting) pickGround();

  mage.root.position.copy(player.pos);
  mage.root.rotation.y = player.facing;
  const castT = clamp((player.castAnimUntil - now) / 450, 0, 1);
  mage.update(dt, {
    state: player.dead ? 'dead' : player.drink ? 'sit' : !player.grounded ? 'air' : player.moveState,
    speed: player.moveState === 'back' ? CFG.backSpeed : CFG.runSpeed,
    channel: !!player.channel, cast: Math.sin(castT * Math.PI),
  });

  for (const m of mobs) {
    const attackT = (now - m.attackAt) / 400;
    m.model.update(dt, {
      state: m.dead ? 'dead' : m.moving ? 'run' : 'idle', speed: m.speed || CFG.mobSpeed,
      frozen: !m.dead && m.rootUntil > now, slowed: m.slowUntil > now,
      attack: attackT >= 0 && attackT < 1 ? attackT : 0,
      flash: clamp(1 - (now - (m.hitAt ?? -1e9)) / 140, 0, 1),
    });
    if (m.dead) sinkCorpse(m);
  }

  if (player.targeting) {
    drape(blizCursor, mouse.ground, blizRadius());
    blizCursor.material.color.set(dist2d(player.pos, mouse.ground) <= SPELLS.bliz.range ? 0x7fd0ff : 0xff5050);
  }
  if (blizFx.g.visible) {
    const cl = blizFx.cloud;
    cl.rotation.y += dt / 1000 * 0.4;
    cl.scale.setScalar(lerpTo(cl.scale.x, blizRadius() / 8, Math.min(1, dt / 150)));   // Wolke baut sich auf
    for (const sh of blizFx.shards) {
      sh.position.y -= sh.userData.speed * (paused ? 0 : dt) / 1000;
      if (sh.position.y < 0) {
        const wx = blizFx.g.position.x + sh.position.x, wz = blizFx.g.position.z + sh.position.z;
        for (let i = 0; i < 3; i++) particles.spawn({ x: wx, y: heightAt(wx, wz) + 0.1, z: wz,
          vx: rand(-2, 2), vy: rand(1, 3), vz: rand(-2, 2), grav: 6, life: rand(0.2, 0.4), color: FROST_WHITE, size: rand(0.12, 0.25) });
        resetShard(sh, false);
      }
    }
  }
  ambientParticles(paused ? 0 : dt);
  particles.update(paused ? 0 : dt);
  updateEffects();
}

let last = performance.now();
function loop(t) {
  const dt = Math.min(50, t - last);
  last = t;
  if (!paused) { now += dt; update(dt); }
  updateVisuals(dt);
  composer.render();
  updateHud();
  requestAnimationFrame(loop);
}

resetGame();
refreshKeyLabels();
requestAnimationFrame(loop);

// Für Tests
(window as any).__game = { player, get mobs() { return mobs; }, get mods() { return mods; }, cast, pressSpell, CFG, cam, binds: () => binds };
