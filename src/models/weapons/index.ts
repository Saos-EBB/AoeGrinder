// Waffe in der Hand: buildWeapon(id) → { root, update(dt, t), glowAnchor, gripY, … }, dt und t in Sekunden.
// Alle Teile werden gemergt: 1 Lambert-Mesh (Atlas), 1 Glow-Mesh, 1 Points. Blitze und der Klangring kommen nur zuckend dazu.

import * as THREE from 'three';
import { FX } from './fx';
import { WEAPONS } from './defs';
import { atlasFor, ATLAS_TILE } from './textures';

export { WEAPONS };
export const DEFAULT_WEAPON = 'grenzwaechter';   // kommt dem alten Kristallstab am nächsten
const LIT_GAIN = 1.9;                            // der Viewer hatte Environment-Licht und PBR, das Abendlicht im Spiel macht Lambert sonst fast schwarz, // PH
const INSET = 1 / (ATLAS_TILE * 4);              // Kachelrand, damit der Filter nicht in die Nachbarkachel greift

// Atlas mit Kacheln und Wiederholung: Eine gekachelte UV darf den Atlas nicht verlassen, also fract() im Fragment-Shader.
// textureGrad nimmt die Ableitung der ungebrochenen UV, sonst entsteht an jeder Kachelkante eine Mip-Naht.
function atlasPatch(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec2 aTile;\nvarying vec2 vTile;')
    .replace('#include <uv_vertex>', '#include <uv_vertex>\nvTile = aTile;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec2 vTile;')
    .replace('#include <map_fragment>', `vec2 tuv = fract(vMapUv) * ${(0.5 - 2 * INSET).toFixed(6)} + vTile + ${INSET.toFixed(6)};
      diffuseColor *= textureGrad(map, tuv, dFdx(vMapUv) * 0.5, dFdy(vMapUv) * 0.5);`);
}

const uvM = new THREE.Matrix3(), uvV = new THREE.Vector3(), col = new THREE.Color();

function mergeParts(root, fx) {
  root.updateMatrixWorld(true);
  const bones = [root, ...fx.pivots], boneOf = m => { for (let o = m; o && o !== root; o = o.parent) { const i = bones.indexOf(o); if (i > 0) return i; } return 0; };
  const meshes = [];
  root.traverse(o => { if (o.isMesh && !o.userData.fxMesh) meshes.push(o); });

  const lit = meshes.filter(m => !m.material.isMeshBasicMaterial);
  const glow = meshes.filter(m => m.material.isMeshBasicMaterial);
  // Durchsichtige Teile zuletzt, damit sie über dem Rest liegen
  lit.sort((a, b) => (a.material.opacity < 1 ? 1 : 0) - (b.material.opacity < 1 ? 1 : 0));

  const kinds = [...new Set(lit.map(m => m.material.tex))] as string[];
  if (kinds.length > 4) throw new Error(`Waffe braucht ${kinds.length} Texturen, der Atlas fasst 4`);

  const out = [];
  const skinned = bones.length > 1;
  const bake = m => { const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); return g.applyMatrix4(m.matrixWorld); };
  const addSkin = (geo, parts) => {
    if (!skinned) return;
    const n = geo.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    let v = 0;
    for (const [m, g] of parts) { const b = boneOf(m); for (let i = 0; i < g.attributes.position.count; i++, v++) { si[v * 4] = b; sw[v * 4] = 1; } }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  };
  const makeMesh = (geo, mat) => {
    const mesh = skinned ? new THREE.SkinnedMesh(geo, mat) : new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false; root.add(mesh); out.push(mesh); return mesh;
  };

  // 1 Mesh: Lambert mit Atlas und Vertex-Farben (RGBA, für Eis und Glas)
  let litTris = 0, mainGeo = null;
  if (lit.length) {
    const parts = lit.map(m => [m, bake(m)]);
    const n = parts.reduce((s, [, g]) => s + g.attributes.position.count, 0);
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), C = new Float32Array(n * 4), T = new Float32Array(n * 2);
    let v = 0;
    for (const [m, g] of parts) {
      const d = m.material, tile = kinds.indexOf(d.tex);
      // Kachel 0 liegt im Canvas oben links; flipY der Textur dreht v
      const tu = (tile % 2) * .5, tv = (tile >> 1) ? 0 : .5;
      uvM.setUvTransform(0, 0, d.rep?.[0] ?? 1, d.rep?.[1] ?? 1, d.rot ? Math.PI / 2 : 0, .5, .5);
      col.set(d.color);
      const pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv;
      for (let i = 0; i < pa.count; i++, v++) {
        P[v * 3] = pa.getX(i); P[v * 3 + 1] = pa.getY(i); P[v * 3 + 2] = pa.getZ(i);
        N[v * 3] = na.getX(i); N[v * 3 + 1] = na.getY(i); N[v * 3 + 2] = na.getZ(i);
        uvV.set(ua.getX(i), ua.getY(i), 1).applyMatrix3(uvM);
        U[v * 2] = uvV.x; U[v * 2 + 1] = uvV.y;
        C[v * 4] = col.r * LIT_GAIN; C[v * 4 + 1] = col.g * LIT_GAIN; C[v * 4 + 2] = col.b * LIT_GAIN; C[v * 4 + 3] = d.opacity;
        T[v * 2] = tu; T[v * 2 + 1] = tv;
      }
    }
    mainGeo = new THREE.BufferGeometry();
    mainGeo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    mainGeo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    mainGeo.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    mainGeo.setAttribute('color', new THREE.BufferAttribute(C, 4));
    mainGeo.setAttribute('aTile', new THREE.BufferAttribute(T, 2));
    addSkin(mainGeo, parts);
    const clear = lit.some(m => m.material.opacity < 1);
    const mat = new THREE.MeshLambertMaterial({
      map: atlasFor(kinds.length ? kinds : ['white']), vertexColors: true, flatShading: true, transparent: clear,
      side: lit.some(m => m.material.double) ? THREE.DoubleSide : THREE.FrontSide,
    });
    mat.onBeforeCompile = atlasPatch;
    mat.customProgramCacheKey = () => 'weaponAtlas';
    makeMesh(mainGeo, mat);
    litTris = n / 3;
    for (const [, g] of parts) g.dispose();
  }

  // 1 Glow-Mesh: Farben pro Vertex, damit Runen und Risse weiter einzeln pulsieren können
  const ranges = [];
  let glowTris = 0, colorAttr = null;
  if (glow.length) {
    const parts = glow.map(m => [m, bake(m)]);
    const n = parts.reduce((s, [, g]) => s + g.attributes.position.count, 0);
    const P = new Float32Array(n * 3), C = new Float32Array(n * 3);
    let v = 0;
    for (const [m, g] of parts) {
      P.set(g.attributes.position.array, v * 3);
      ranges.push({ mat: m.material, start: v, count: g.attributes.position.count, r: NaN, g: NaN, b: NaN });
      v += g.attributes.position.count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    geo.setAttribute('color', colorAttr = new THREE.BufferAttribute(C, 3));
    addSkin(geo, parts);
    makeMesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
    glowTris = n / 3;
    for (const [, g] of parts) g.dispose();
  }
  const syncGlow = () => {
    let dirty = false;
    for (const r of ranges) {
      const c = r.mat.color;
      if (c.r === r.r && c.g === r.g && c.b === r.b) continue;
      r.r = c.r; r.g = c.g; r.b = c.b; dirty = true;
      for (let i = r.start; i < r.start + r.count; i++) colorAttr.setXYZ(i, c.r, c.g, c.b);
    }
    if (dirty) colorAttr.needsUpdate = true;
  };
  syncGlow();

  // Quellteile weg. Bewegliche Teile bleiben als unsichtbare Knoten, ihr Skelett treibt die Merges an.
  for (const m of meshes) { if (bones.includes(m)) m.visible = false; else { m.geometry.dispose(); m.removeFromParent(); } }

  if (skinned) {
    const inv = bones.map(b => b.matrixWorld.clone().invert());
    const skeleton = new THREE.Skeleton(bones as any, inv);
    for (const mesh of out) mesh.bind(skeleton, new THREE.Matrix4());
  }
  return { out, syncGlow, tris: litTris + glowTris, litTris, glowTris, kinds };
}

export function buildWeapon(id) {
  const def = WEAPONS.find(w => w.id === id) ?? WEAPONS.find(w => w.id === DEFAULT_WEAPON);
  const inner = new THREE.Group();             // Waffen-Koordinaten wie im Viewer (Griff bei gripY)
  const fx = new FX();
  const upd = def.build(inner, fx) || null;
  if (!fx.glowAnchor) throw new Error(`Waffe ${def.id} hat keinen Leuchtpunkt`);
  const merged = mergeParts(inner, fx);
  fx.finish();
  inner.position.y = -def.gripY;
  const root = new THREE.Group();
  root.add(inner);
  return {
    id: def.id, def, root, gripY: def.gripY, cane: def.cane, pitch: def.pitch, yaw: def.yaw ?? 0, glowAnchor: fx.glowAnchor, stats: merged,
    get combat() { return fx.combat; }, set combat(v) { fx.combat = v; },
    get alive() { return fx.alive; },
    update(dt, t) {
      upd?.(t);
      root.updateMatrixWorld(true);
      if (dt > 0) fx.update(dt, t);
      merged.syncGlow();
    },
    dispose() {
      fx.dispose();
      root.removeFromParent();
      for (const m of merged.out) { m.geometry.dispose(); m.material.dispose(); m.skeleton?.dispose(); }
      inner.traverse((o: any) => { if (o.userData.fxMesh) { o.geometry.dispose(); o.material.dispose(); } });
    },
  };
}
