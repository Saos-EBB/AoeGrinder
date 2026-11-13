// Figur des Strichkriegers (KOMP-04): was die Teile (Bau, Skins, Moves, Effekte, Pro-Frame) gemeinsam lesen und schreiben.
// F.anim = der geteilte Animations-Zustand (vorher lose let im Builder). Nicht verwechseln mit dem anim-Objekt, das das Spiel pro Frame an update gibt.
import type * as THREE from 'three';
import type { buildWarFx } from './fx';

export interface WarAnim {
  lift: number; spinAng: number; rage: number; flare: number; qPal: string | null; fin: { s: number; tor: number };
  tipLen: number; gripLen: number; baseTip: number; baseGrip: number; lastGrip: number[];
  eatK: { s: number; k: number }; act: any; actKey: string; lastPose: any; blendFrom: any; blendT: number; runPh: number; T: number; lastLoco: string; ready: boolean; kills: number;
}
export interface WarArm { ua: THREE.Bone; fa: THREE.Bone; hand: THREE.Bone; side: number; pu: any; pf: any; ph: any; plate: any[] }
export interface WarLeg { th: THREE.Bone; sh: THREE.Bone; ft: THREE.Bone; side: number; pt: any; ps: any; pf: any }
export interface Fig {
  anim: WarAnim;
  bones: THREE.Bone[]; parts: any[];
  root: THREE.Group; hips: THREE.Bone; chest: THREE.Bone; neck: THREE.Bone; head: THREE.Bone;
  armL: WarArm; armR: WarArm; legL: WarLeg; legR: WarLeg; clothAnchor: THREE.Object3D;
  fxGroup: THREE.Group; gy: () => number;   // Effekt-Gruppe (eigene Szene-Wurzel), Boden unter der Figur
  weapon: string;                               // eingebaute Waffe: 'sword' | 'axe' | 'mace'
  fx: ReturnType<typeof buildWarFx>;            // Effekte (fx.ts)
  tipPos: () => THREE.Vector3;                  // Treffer-Spitze der Waffe (Welt)
  hitTip: (kind: string, i?: number) => void;   // Treffer-Moment an der Spitze → model.onHit
  hitRoot: (kind: string, i?: number) => void;  // Treffer-Moment am Spieler → model.onHit
  bp: { pHips: any; pChest: any; pNeck: any; pHead: any; pBelt: any };   // Grund-Teile, die Skins umfärben oder rauswerfen
}
