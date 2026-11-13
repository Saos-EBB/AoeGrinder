// ───────────────────────── Körper-Shader: Glühen (aGlow), Eiszapfen wachsen nach uM (icT ≥ 0), Requisite (icT = -2), Rand-Licht

import * as THREE from 'three';
import { RIM, rimChunk } from '../strichKit';

export function bodyHook(U) {
  return sh => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uM = U.uM;
    sh.vertexShader = 'attribute float aGlow, flick, icT; attribute vec3 icB; uniform float uTime, uM; varying float vGlow, vIce;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float gr = icT < 0. ? 1. : clamp((uM - icT) / .1, 0., 1.); gr = gr * gr * (3. - 2. * gr);
        transformed = icB + (transformed - icB) * gr;`)
      .replace('#include <skinning_vertex>', `#include <skinning_vertex>
        float sd = position.x * 31.0 + position.z * 17.0;
        transformed += vec3(sin(uTime * 17.0 + sd) * .03, (.55 + .45 * sin(uTime * 23.0 + sd * 1.7)) * .13, cos(uTime * 13.0 + sd) * .03) * flick * flick * aGlow;
        vGlow = aGlow; vIce = step(0., icT);`);
    sh.fragmentShader = 'varying float vGlow, vIce;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       totalEmissiveRadiance += vGlow * diffuseColor.rgb + vIce * vec3(.016, .04, .058); diffuseColor.rgb *= 1. - vGlow;`)
      .replace('#include <opaque_fragment>',
        `outgoingLight += (1. - vGlow) * (1. - vIce) * ${rimChunk(RIM.color, RIM.power)};\n#include <opaque_fragment>`);
  };
}
// Schatten: Eiszapfen und versteckte Requisiten wachsen auch in der Schatten-Tiefe mit
export function depthMat(U) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = sh => {
    sh.uniforms.uM = U.uM;
    sh.vertexShader = 'attribute float icT; attribute vec3 icB; uniform float uM;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nfloat gr = icT < 0. ? 1. : clamp((uM - icT) / .1, 0., 1.); transformed = icB + (transformed - icB) * gr;');
  };
  return m;
}
// Hüllen (Feuer, Eis) nutzen die Körper-Geometrie: die Requisite (icT = -2) bekommt keine Hülle
export function shellNoProp(sh) {
  sh.vertexShader = (sh.vertexShader.includes('attribute float icT') ? '' : 'attribute float icT;\n') + 'varying float vPr;\n' + sh.vertexShader.replace('void main() {', 'void main() {\n  vPr = step(icT, -1.5);');
  sh.fragmentShader = 'varying float vPr;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n  if (vPr > .5) discard;');
}
