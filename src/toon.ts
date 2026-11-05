// Anime-Basis der Map-Konzepte (docs/map-konzepte-anime.md): Toon-Material mit 3 harten Lichtstufen und dunklem Fresnel-Rand
// als Kontur im Shader (keine Inverted-Hull-Outlines, also 0 extra Draw Calls). Noch zum Ausprobieren: nur mit ?toon=1 an.
import * as THREE from 'three';

export const TOON = /[?&]toon=1\b/.test(location.search);

// Alles // PH
const T = {
  steps: [70, 165, 255],           // Helligkeit der 3 Lichtstufen (0–255), Schatten → Halbton → Licht
  rimColor: 0x14100c, rimEdge: 0.62, rimAmt: 0.85,   // Rand: ab rimEdge (1 = ganz streifend) hart dunkel
  // Licht-Stufen auf die Summe aller Lichter (Spot der Figur fällt sonst weich ab): unter dark bleibt es wie es ist (Nebel-Dunkel),
  // bis mid Halbton, darüber Licht. Werte = Lichtmenge relativ zur Grundfarbe
  bands: { dark: 0.22, mid: 0.85, half: 0.5, full: 1.15 },
};

// Eine geteilte Stufen-Textur (3×1, Nearest = harte Kanten)
const gradientMap = (() => {
  const t = new THREE.DataTexture(new Uint8Array(T.steps), T.steps.length, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();

// rimColor: Randfarbe (hell für Eis), shade: Farbe, mit der Halbton und Schatten eingefärbt werden (Winterquell: Kaltblau)
type ToonOpts = THREE.MeshToonMaterialParameters & { rim?: boolean; rimColor?: number; shade?: number };

const f = (v: number) => v.toFixed(3);
const BANDS = `
  vec3 litK = outgoingLight / max(diffuseColor.rgb, vec3(0.02));
  float litL = max(dot(litK, vec3(0.3333)), 1e-4);
  float litQ = litL < ${f(T.bands.dark)} ? litL : litL < ${f(T.bands.mid)} ? ${f(T.bands.half)} : ${f(T.bands.full)};
  outgoingLight *= litQ / litL;
  if (litL < ${f(T.bands.mid)}) outgoingLight *= uShade;`;
const RIM = `
  float rimK = 1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
  outgoingLight = mix(outgoingLight, uRim, step(${f(T.rimEdge)}, rimK) * ${f(T.rimAmt)});`;

// rim: false für große flache Flächen (Boden), dort würde der Rand in der Ferne alles abdunkeln
export function toonMat({ rim = true, rimColor = T.rimColor, shade = 0xffffff, ...opts }: ToonOpts = {}) {
  const m = new THREE.MeshToonMaterial({ gradientMap, ...opts });
  m.onBeforeCompile = sh => {
    sh.uniforms.uRim = { value: new THREE.Color(rimColor) };
    sh.uniforms.uShade = { value: new THREE.Color(shade) };
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform vec3 uRim;\nuniform vec3 uShade;\nvoid main() {')
      .replace('#include <opaque_fragment>', `${BANDS}${rim ? RIM : ''}\n#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => rim ? 'toonRim' : 'toon';
  return m;
}
