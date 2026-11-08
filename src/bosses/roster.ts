// Alle Bosse aus dem Boss-Viewer (Artifact „Frost Grind – Boss-Viewer“), Daten 1:1 übernommen. Alle Werte PH aus dem Boss-Plan.
// Boss = Daten-Objekt: Modell (t, p), Angriffe { n, k, p, i, b?, p2? }, Regeln { n, k, p, i }. Angriffe mit „(P2)“ im Namen kommen erst in Phase 2.
// k verweist auf ATT (bosses/attacks.ts) bzw. RULE (bosses/rules.ts). tier: frueh, mittel, spaet, final. evil: verdorbene Figur (zählt zu mittel).
import { t } from '../i18n';

// Verdorbene Figuren: Viewer-Strichmännchen als Platzhalter; im Spiel baut boss.ts das echte Spielermodell der Figur (evil = Skin-ID)
const evil = (skin, p) => ({ t: 'evil', skin, p: { color: 0x2a0a0e, glow: 0xff2a2a, scale: 1.5, ...p } });
export const BOSSES: any[] = [
 // früh
 {id:'hogger',nr:1,name:t('boss.hogger.name'),from:t('boss.hogger.from'),tier:'frueh',desc:t('boss.hogger.desc'),
  model:{t:'biped',p:{skin:0x8a6a48,armor:0x6b4a2f,accent:0x9a3a2a,eye:0xffd060,bulk:1.25,head:'gnoll',weapon:'club',scale:1.6}},
  attacks:[{n:t('boss.hogger.attacks.0.n'),k:'kette',p:{hits:[1.0,.75,1.25],r:4,ang:100},i:t('boss.hogger.attacks.0.i')},{n:t('boss.hogger.attacks.1.n'),k:'ansturm',p:{len:12,warn:.9},i:t('boss.hogger.attacks.1.i')}],
  rules:[{n:t('boss.hogger.rules.0.n'),k:'enrage',p:{then:true},i:t('boss.hogger.rules.0.i')}]},
 {id:'sif',nr:56,name:t('boss.sif.name'),from:t('boss.sif.from'),tier:'frueh',desc:t('boss.sif.desc'),
  model:{t:'quadruped',p:{skin:0x8d8f98,eye:0xd0e0ff,metal:0xc8ccd8,swordInMouth:true,scale:1.9}},
  attacks:[{n:t('boss.sif.attacks.0.n'),k:'slam',p:{r:6,warn:1.0},i:t('boss.sif.attacks.0.i')},{n:t('boss.sif.attacks.1.n'),k:'ansturm',p:{len:14,warn:.7},i:t('boss.sif.attacks.1.i')},{n:t('boss.sif.attacks.2.n'),k:'explosion',p:{r:5,warn:.7,spin:true,color:0xffffff,fx:0xd8e0ff},i:t('boss.sif.attacks.2.i')}],
  rules:[{n:t('boss.sif.rules.0.n'),k:'hinken',i:t('boss.sif.rules.0.i')}]},
 {id:'duriel',nr:35,name:t('boss.duriel.name'),from:t('boss.duriel.from'),tier:'frueh',desc:t('boss.duriel.desc'),
  model:{t:'maggot',p:{skin:0xb79a6a,armor:0x7a6040,accent:0x4a3a2a,eye:0xff4040,scale:1.45}},
  attacks:[{n:t('boss.duriel.attacks.0.n'),k:'kette',p:{hits:[.75,.5],r:4.5,ang:110},i:t('boss.duriel.attacks.0.i')},{n:t('boss.duriel.attacks.1.n'),k:'ansturm',p:{len:10,w:3,warn:.6},i:t('boss.duriel.attacks.1.i')}],
  rules:[{n:t('boss.duriel.rules.0.n'),k:'arenaRadius',p:{r:10},i:t('boss.duriel.rules.0.i')},{n:t('boss.duriel.rules.1.n'),k:'slowAura',i:t('boss.duriel.rules.1.i')}]},
 {id:'shazzrah',nr:5,name:t('boss.shazzrah.name'),from:t('boss.shazzrah.from'),tier:'frueh',desc:t('boss.shazzrah.desc'),
  model:{t:'biped',p:{float:true,skin:0x6a4a8a,armor:0x3a2a5a,accent:0x8a5ad0,eye:0xd0a0ff,glow:0xb070ff,head:'horns',weapon:'staff',scale:1.7}},
  attacks:[{n:t('boss.shazzrah.attacks.0.n'),k:'blink',p:{explode:6,warn:.6},i:t('boss.shazzrah.attacks.0.i')},{n:t('boss.shazzrah.attacks.1.n'),k:'explosion',p:{r:6,warn:.6,color:0xb070ff},i:t('boss.shazzrah.attacks.1.i')},{n:t('boss.shazzrah.attacks.2.n'),k:'faecher',p:{n:5,spread:50,color:0xc080ff},i:t('boss.shazzrah.attacks.2.i')}],rules:[]},
 {id:'graefin',nr:39,name:t('boss.graefin.name'),from:t('boss.graefin.from'),tier:'frueh',desc:t('boss.graefin.desc'),
  model:{t:'biped',p:{skin:0xd0b0a0,armor:0x5a1a2a,accent:0x9a2a3a,eye:0xff8a40,bulk:.85,head:'crown',weapon:'none',cape:0x3a0a18,scale:1.6}},
  attacks:[{n:t('boss.graefin.attacks.0.n'),k:'faecher',p:{n:5,spread:60,color:0xff7a2a},i:t('boss.graefin.attacks.0.i')},{n:t('boss.graefin.attacks.1.n'),k:'pfuetze',p:{n:2,r:3.5,color:0xff5a1a,label:t('boss.graefin.attacks.1.p.label')},i:t('boss.graefin.attacks.1.i')}],
  rules:[{n:t('boss.graefin.rules.0.n'),k:'loot',i:t('boss.graefin.rules.0.i')}]},
 {id:'lazarus',nr:33,name:t('boss.lazarus.name'),from:t('boss.lazarus.from'),tier:'frueh',desc:t('boss.lazarus.desc'),
  model:{t:'biped',p:{float:true,skin:0xc8b8a0,armor:0x5a1a1a,accent:0xb08a3a,eye:0xff6a2a,glow:0xff6a2a,head:'hood',weapon:'staff',scale:1.65}},
  attacks:[{n:t('boss.lazarus.attacks.0.n'),k:'blink',p:{behind:5,color:0xff6a2a},i:t('boss.lazarus.attacks.0.i')},{n:t('boss.lazarus.attacks.1.n'),k:'feuerwand',p:{len:18,dur:4},i:t('boss.lazarus.attacks.1.i')},{n:t('boss.lazarus.attacks.2.n'),k:'faecher',p:{n:3,spread:30,speed:13,color:0xff6a2a},i:t('boss.lazarus.attacks.2.i')}],rules:[]},
 {id:'flickwerk',nr:11,name:t('boss.flickwerk.name'),from:t('boss.flickwerk.from'),tier:'frueh',desc:t('boss.flickwerk.desc'),
  model:{t:'biped',p:{skin:0x9aa58a,armor:0x5a4a3a,accent:0x7a2a2a,eye:0xffe060,bulk:1.6,belly:true,head:'bare',weapon:'hook',weapon2:'hook',pauldrons:false,scale:1.9}},
  attacks:[{n:t('boss.flickwerk.attacks.0.n'),k:'kette',p:{hits:[.6,.6,.6],r:4,ang:70},i:t('boss.flickwerk.attacks.0.i')}],
  rules:[{n:t('boss.flickwerk.rules.0.n'),k:'enrage',p:{then:true},i:t('boss.flickwerk.rules.0.i')}]},
 // mittel
 {id:'gruul',nr:17,name:t('boss.gruul.name'),from:t('boss.gruul.from'),tier:'mittel',desc:t('boss.gruul.desc'),
  model:{t:'biped',p:{skin:0x7a8a9a,armor:0x4a4038,accent:0x5a5a6a,eye:0xffa040,bulk:1.5,head:'bare',tusks:true,weapon:'none',scale:2.3}},
  attacks:[{n:t('boss.gruul.attacks.0.n'),k:'kette',p:{hits:[.9,.7],r:5,ang:90},i:t('boss.gruul.attacks.0.i')},{n:t('boss.gruul.attacks.1.n'),k:'slam',p:{r:6,warn:1.0},i:t('boss.gruul.attacks.1.i')},{n:t('boss.gruul.attacks.2.n'),k:'slam',p:{r:10,warn:1.4,gap:2},i:t('boss.gruul.attacks.2.i')}],
  rules:[{n:t('boss.gruul.rules.0.n'),k:'wachstum',i:t('boss.gruul.rules.0.i')}]},
 {id:'lilith',nr:51,name:t('boss.lilith.name'),from:t('boss.lilith.from'),tier:'mittel',desc:t('boss.lilith.desc'),
  model:{t:'biped',p:{skin:0x7a3a44,armor:0x2a0f18,accent:0xc0203a,eye:0xff3050,bulk:.85,head:'horns',wings:0x5a1020,weapon:'none',scale:1.9}},
  attacks:[{n:t('boss.lilith.attacks.0.n'),k:'kette',p:{hits:[.6,.5,.85],r:4,ang:100},i:t('boss.lilith.attacks.0.i')},{n:t('boss.lilith.attacks.1.n'),k:'faecher',p:{n:7,spread:80,color:0xd0203a},i:t('boss.lilith.attacks.1.i')},{n:t('boss.lilith.attacks.2.n'),k:'pfuetze',p:{n:3,r:3.5,color:0x9a1020,label:t('boss.lilith.attacks.2.p.label')},i:t('boss.lilith.attacks.2.i')}],
  rules:[{n:t('boss.lilith.rules.0.n'),k:'arenaSchrumpft',i:t('boss.lilith.rules.0.i')}]},
 {id:'azmodan',nr:44,name:t('boss.azmodan.name'),from:t('boss.azmodan.from'),tier:'mittel',desc:t('boss.azmodan.desc'),
  model:{t:'spider',p:{skin:0x8a3a2a,armor:0x3a1a14,eye:0x9aff4a,glow:0x9aff4a,scale:1.6}},
  attacks:[{n:t('boss.azmodan.attacks.0.n'),k:'riesenkugel',p:{size:2.4,speed:5,r:7},i:t('boss.azmodan.attacks.0.i')},{n:t('boss.azmodan.attacks.1.n'),k:'pfuetze',p:{n:3,r:3,color:0x6a8a3a,label:t('boss.azmodan.attacks.1.p.label')},i:t('boss.azmodan.attacks.1.i')},{n:t('boss.azmodan.attacks.2.n'),k:'explosion',p:{r:7,warn:.9,color:0xff5a2a},i:t('boss.azmodan.attacks.2.i')}],rules:[]},
 {id:'abgrund',nr:62,name:t('boss.abgrund.name'),from:t('boss.abgrund.from'),tier:'mittel',desc:t('boss.abgrund.desc'),
  bodies:[{m:{t:'biped',p:{skin:0x3a3438,armor:0x26242a,accent:0x3a2a2a,eye:0xff6a3a,cape:0x5a1a1a,bulk:.95,head:'helm',weapon:'greatsword',weapon2:'katana',scale:1.45}},off:[0,-4]},
          {m:{t:'biped',p:{skin:0x3a3438,armor:0x26242a,accent:0x3a2a2a,eye:0xff6a3a,cape:0x5a1a1a,bulk:.95,head:'helm',weapon:'greatsword',weapon2:'katana',scale:1.45}},off:[-6,-6]},
          {m:{t:'biped',p:{skin:0x3a3438,armor:0x26242a,accent:0x3a2a2a,eye:0xff1a1a,cape:0x5a1a1a,bulk:.95,head:'helm',weapon:'greatsword',weapon2:'katana',scale:1.45}},off:[6,-6]}],
  attacks:[{n:t('boss.abgrund.attacks.0.n'),k:'kette',p:{hits:[.5,.4,.65],r:4,ang:100},i:t('boss.abgrund.attacks.0.i')},{n:t('boss.abgrund.attacks.1.n'),k:'ansturm',p:{len:13,warn:.55},i:t('boss.abgrund.attacks.1.i')},{n:t('boss.abgrund.attacks.2.n'),p2:true,k:'ring',p:{r:11,color:0xff6a1a},i:t('boss.abgrund.attacks.2.i')}],
  rules:[{n:t('boss.abgrund.rules.0.n'),k:'bekaempfenSich',i:t('boss.abgrund.rules.0.i')}]},
 {id:'hornet',nr:85,name:t('boss.hornet.name'),from:t('boss.hornet.from'),tier:'mittel',desc:t('boss.hornet.desc'),
  model:{t:'biped',p:{skin:0x2a1a24,armor:0x9a1e2a,accent:0x7a1420,eye:0x1a1418,bulk:.7,head:'mask',weapon:'needle',pauldrons:false,cape:0x9a1e2a,scale:1.35}},
  attacks:[{n:t('boss.hornet.attacks.0.n'),k:'ansturm',p:{len:16,w:1.6,warn:.45},i:t('boss.hornet.attacks.0.i')},{n:t('boss.hornet.attacks.1.n'),k:'faecher',p:{n:1,speed:18,size:.3,color:0xf2ede4},i:t('boss.hornet.attacks.1.i')},{n:t('boss.hornet.attacks.2.n'),k:'explosion',p:{r:4.5,warn:.5,color:0xf2ede4,fx:0xffffff},i:t('boss.hornet.attacks.2.i')}],rules:[]},
 {id:'thaddius',nr:14,name:t('boss.thaddius.name'),from:t('boss.thaddius.from'),tier:'mittel',desc:t('boss.thaddius.desc'),
  model:{t:'biped',p:{skin:0x4a6a5a,armor:0x3a4a44,accent:0x6a8a7a,eye:0x80e0ff,glow:0x60c8ff,bulk:1.7,head:'bare',coils:true,belly:true,weapon:'none',scale:2.1}},
  attacks:[{n:t('boss.thaddius.attacks.0.n'),k:'kette',p:{hits:[.9,.7],r:5,ang:90},i:t('boss.thaddius.attacks.0.i')},{n:t('boss.thaddius.attacks.1.n'),k:'explosion',p:{r:8,warn:1.0,color:0x60c8ff},i:t('boss.thaddius.attacks.1.i')}],
  rules:[{n:t('boss.thaddius.rules.0.n'),k:'polaritaet',i:t('boss.thaddius.rules.0.i')}]},
 {id:'ragnaros',nr:3,name:t('boss.ragnaros.name'),from:t('boss.ragnaros.from'),tier:'mittel',desc:t('boss.ragnaros.desc'),
  model:{t:'lavaTorso',p:{skin:0x8a2a10,armor:0x5a1a08,accent:0xff6a1a,eye:0xffee60,metal:0x3a2a20,scale:1.45}},
  attacks:[{n:t('boss.ragnaros.attacks.0.n'),k:'kette',p:{hits:[1.0,.8],r:7,ang:120,color:0xff4a1a},i:t('boss.ragnaros.attacks.0.i')},{n:t('boss.ragnaros.attacks.1.n'),k:'ring',p:{r:10,color:0xff7a2a},i:t('boss.ragnaros.attacks.1.i')},{n:t('boss.ragnaros.attacks.2.n'),k:'meteor',p:{n:5,r:3},i:t('boss.ragnaros.attacks.2.i')}],
  rules:[{n:t('boss.ragnaros.rules.0.n'),k:'abtauchen',i:t('boss.ragnaros.rules.0.i')}]},
 {id:'chromaggus',nr:8,name:t('boss.chromaggus.name'),from:t('boss.chromaggus.from'),tier:'mittel',desc:t('boss.chromaggus.desc'),
  model:{t:'quadruped',p:{skin:0x6a5a4a,eye:0xffd040,heads:2,horns:true,scale:2.0}},
  attacks:[{n:t('boss.chromaggus.attacks.0.n'),k:'kette',p:{hits:[.6,.6],r:4.5,ang:80},i:t('boss.chromaggus.attacks.0.i')},{n:t('boss.chromaggus.attacks.1.n'),k:'atem',p:{color:0x6ac8ff,len:15,ang:50},i:t('boss.chromaggus.attacks.1.i')},{n:t('boss.chromaggus.attacks.2.n'),k:'atem',p:{color:0x7aff3a,len:15,ang:50},i:t('boss.chromaggus.attacks.2.i')}],
  rules:[{n:t('boss.chromaggus.rules.0.n'),k:'zufallsAtem',i:t('boss.chromaggus.rules.0.i')}]},
 {id:'wachritter',nr:88,name:t('boss.wachritter.name'),from:t('boss.wachritter.from'),tier:'mittel',desc:t('boss.wachritter.desc'),
  bodies:[0,1,2,3,4,5].map(i=>({m:{t:'biped',p:{skin:0x2a2a38,armor:0x3a3a4c,accent:0x5a5a74,eye:0xfff0a0,bulk:1.35,head:'helm',weapon:'club',scale:1.35}},off:[(i-2.5)*3.4,-5-Math.abs(i-2.5)*.8],state:i<2?'active':'sleep'})),
  attacks:[{n:t('boss.wachritter.attacks.0.n'),k:'kette',p:{hits:[.8,.6],r:4,ang:90},i:t('boss.wachritter.attacks.0.i')},{n:t('boss.wachritter.attacks.1.n'),k:'ansturm',p:{len:14,w:2.6,warn:.6},i:t('boss.wachritter.attacks.1.i')}],
  rules:[{n:t('boss.wachritter.rules.0.n'),k:'spawnUeberZeit',p:{max:2,label:t('boss.wachritter.rules.0.p.label')},i:t('boss.wachritter.rules.0.i')}]},
 // verdorbene figuren (mittel)
 {id:'v-krieger',nr:'V',name:t('boss.v-krieger.name'),from:t('boss.v-krieger.from'),tier:'mittel',evil:true,desc:t('boss.v-krieger.desc'),
  model:evil('krieger',{weapon:'greatsword',metal:0x3a3034,weaponGlow:0x8a1010}),
  attacks:[{n:t('boss.v-krieger.attacks.0.n'),k:'explosion',p:{r:5,warn:.6,spin:true,color:0xff3030},i:t('boss.v-krieger.attacks.0.i')},{n:t('boss.v-krieger.attacks.1.n'),k:'slam',p:{r:5,warn:.9},i:t('boss.v-krieger.attacks.1.i')},{n:t('boss.v-krieger.attacks.2.n'),k:'ring',p:{r:9,color:0xffd050},i:t('boss.v-krieger.attacks.2.i')}],rules:[]},
 {id:'v-klinge',nr:'V',name:t('boss.v-klinge.name'),from:t('boss.v-klinge.from'),tier:'mittel',evil:true,desc:t('boss.v-klinge.desc'),
  model:evil('klinge',{weapon:'katana',weapon2:'katana',weaponGlow:0xff2a3a}),
  attacks:[{n:t('boss.v-klinge.attacks.0.n'),k:'kette',p:{hits:[.4,.4,.55],r:3.5,ang:120},i:t('boss.v-klinge.attacks.0.i')},{n:t('boss.v-klinge.attacks.1.n'),k:'ansturm',p:{len:11,w:1.4,warn:.5},i:t('boss.v-klinge.attacks.1.i')},{n:t('boss.v-klinge.attacks.2.n'),k:'sog',p:{color:0xd0203a,explode:5},i:t('boss.v-klinge.attacks.2.i')}],rules:[]},
 {id:'v-feuer',nr:'V',name:t('boss.v-feuer.name'),from:t('boss.v-feuer.from'),tier:'mittel',evil:true,desc:t('boss.v-feuer.desc'),
  model:evil('feuer',{weapon:'staff',glow:0xff6a1a,color:0x2a0e08}),
  attacks:[{n:t('boss.v-feuer.attacks.0.n'),k:'faecher',p:{n:1,speed:14,size:.5,color:0xff6a1a},i:t('boss.v-feuer.attacks.0.i')},{n:t('boss.v-feuer.attacks.1.n'),k:'meteor',p:{n:1,r:5,warn:1.3},i:t('boss.v-feuer.attacks.1.i')},{n:t('boss.v-feuer.attacks.2.n'),k:'pfuetze',p:{n:1,r:5,color:0xd8b040,label:t('boss.v-feuer.attacks.2.p.label')},i:t('boss.v-feuer.attacks.2.i')},{n:t('boss.v-feuer.attacks.3.n'),k:'explosion',p:{r:6,warn:.7,color:0xff4a1a},i:t('boss.v-feuer.attacks.3.i')}],rules:[]},
 {id:'v-eis',nr:'V',name:t('boss.v-eis.name'),from:t('boss.v-eis.from'),tier:'mittel',evil:true,desc:t('boss.v-eis.desc'),
  model:evil('eis',{weapon:'staff',glow:0x6ac8ff,color:0x0a1420}),
  attacks:[{n:t('boss.v-eis.attacks.0.n'),k:'explosion',p:{r:7,warn:.5,color:0x6ac8ff},i:t('boss.v-eis.attacks.0.i')},{n:t('boss.v-eis.attacks.1.n'),k:'meteor',p:{n:9,r:2,warn:.8,spread:5,stagger:.12,color:0x9ad8ff},i:t('boss.v-eis.attacks.1.i')},{n:t('boss.v-eis.attacks.2.n'),k:'faecher',p:{n:3,spread:24,speed:15,color:0xbfe8ff},i:t('boss.v-eis.attacks.2.i')}],rules:[]},
 {id:'v-arkan',nr:'V',name:t('boss.v-arkan.name'),from:t('boss.v-arkan.from'),tier:'mittel',evil:true,desc:t('boss.v-arkan.desc'),
  model:evil('arkan',{weapon:'staff',glow:0xc070ff,color:0x140a20,float:true}),
  attacks:[{n:t('boss.v-arkan.attacks.0.n'),k:'blink',p:{explode:5,warn:.5,color:0xc070ff},i:t('boss.v-arkan.attacks.0.i')},{n:t('boss.v-arkan.attacks.1.n'),k:'faecher',p:{n:5,spread:14,speed:14,color:0xc070ff},i:t('boss.v-arkan.attacks.1.i')},{n:t('boss.v-arkan.attacks.2.n'),k:'explosion',p:{r:6,warn:.55,color:0xc070ff},i:t('boss.v-arkan.attacks.2.i')}],rules:[]},
 // spät
 {id:'os',nr:55,name:t('boss.os.name'),from:t('boss.os.from'),tier:'spaet',desc:t('boss.os.desc'),
  bodies:[{m:{t:'biped',p:{skin:0x8a7a5a,armor:0xc9a24a,accent:0xe0c060,eye:0xffe070,metal:0xffe9a0,bulk:.9,head:'lion',weapon:'spear',scale:1.7}},off:[-3.5,-4]},
          {m:{t:'biped',p:{skin:0x8a7a5a,armor:0xb08a3a,accent:0xd0a850,eye:0xffc060,bulk:1.8,belly:true,head:'helm',weapon:'hammer',scale:2.1}},off:[3.5,-5]}],
  attacks:[{n:t('boss.os.attacks.0.n'),k:'ansturm',b:0,p:{len:13,w:1.6,warn:.55,color:0xffe070},i:t('boss.os.attacks.0.i')},{n:t('boss.os.attacks.1.n'),k:'slam',b:1,p:{r:6,warn:1.1},i:t('boss.os.attacks.1.i')},{n:t('boss.os.attacks.2.n'),k:'faecher',b:0,p:{n:1,speed:16,size:.4,color:0xffe070},i:t('boss.os.attacks.2.i')}],
  rules:[{n:t('boss.os.rules.0.n'),k:'erbtKraft',i:t('boss.os.rules.0.i')}]},
 {id:'koenige',nr:59,name:t('boss.koenige.name'),from:t('boss.koenige.from'),tier:'spaet',desc:t('boss.koenige.desc'),
  bodies:[0,1,2,3].map(i=>({m:{t:'biped',p:{skin:0x18141f,armor:0x221c2c,accent:0x3a2a54,eye:0xb890ff,glow:0x9a70ff,bulk:.85,head:'crown',weapon:'sword',weaponGlow:0x9a70ff,scale:2.0}},off:[(i-1.5)*4.5,-5-(i%2)*1.5],state:i===0?'active':'hidden'})),
  attacks:[{n:t('boss.koenige.attacks.0.n'),k:'kette',p:{hits:[.8,.6],r:5,ang:90,color:0x9a70ff},i:t('boss.koenige.attacks.0.i')},{n:t('boss.koenige.attacks.1.n'),k:'faecher',p:{n:6,spread:70,color:0x9a70ff},i:t('boss.koenige.attacks.1.i')},{n:t('boss.koenige.attacks.2.n'),k:'explosion',p:{r:8,warn:1.0,color:0x7a50d0},i:t('boss.koenige.attacks.2.i')}],
  rules:[{n:t('boss.koenige.rules.0.n'),k:'spawnUeberZeit',p:{every:50,max:4,label:t('boss.koenige.rules.0.p.label')},i:t('boss.koenige.rules.0.i')}]},
 {id:'godrick',nr:76,name:t('boss.godrick.name'),from:t('boss.godrick.from'),tier:'spaet',desc:t('boss.godrick.desc'),
  model:{t:'biped',p:{skin:0x9a8a6a,armor:0xb08a3a,accent:0x8a6a2a,eye:0xffd070,cape:0x6a6040,bulk:1.5,head:'crown',weapon:'axe',scale:2.0}},
  attacks:[{n:t('boss.godrick.attacks.0.n'),k:'kette',p:{hits:[.9,.6,1.1],r:5,ang:100},i:t('boss.godrick.attacks.0.i')},{n:t('boss.godrick.attacks.1.n'),k:'slam',p:{r:7,warn:1.0,fx:0xd0d8e0},i:t('boss.godrick.attacks.1.i')},{n:t('boss.godrick.attacks.2.n'),k:'ring',p:{r:10,color:0xd0d8e0},i:t('boss.godrick.attacks.2.i')}],
  rules:[{n:t('boss.godrick.rules.0.n'),p2:true,k:'neuePhaseWaffe',i:t('boss.godrick.rules.0.i')}]},
 {id:'radahn',nr:78,name:t('boss.radahn.name'),from:t('boss.radahn.from'),tier:'spaet',desc:t('boss.radahn.desc'),
  model:{t:'biped',p:{skin:0x8a6a5a,armor:0x7a3a2a,accent:0x9a2a1a,eye:0xc090ff,cape:0x9a2a1a,bulk:1.6,head:'horns',weapon:'greatsword',weapon2:'greatsword',metal:0x9a8a7a,scale:2.3}},
  attacks:[{n:t('boss.radahn.attacks.0.n'),k:'kette',p:{hits:[.9,.7],r:6,ang:120},i:t('boss.radahn.attacks.0.i')},{n:t('boss.radahn.attacks.1.n'),k:'sog',p:{color:0xa070ff,explode:6},i:t('boss.radahn.attacks.1.i')},{n:t('boss.radahn.attacks.2.n'),k:'faecher',p:{n:5,spread:40,color:0xa070ff},i:t('boss.radahn.attacks.2.i')},{n:t('boss.radahn.attacks.3.n'),p2:true,k:'meteor',p:{n:1,r:9,warn:1.6,color:0xa070ff},i:t('boss.radahn.attacks.3.i')}],rules:[]},
 {id:'lich',nr:26,name:t('boss.lich.name'),from:t('boss.lich.from'),tier:'spaet',desc:t('boss.lich.desc'),
  model:{t:'biped',p:{skin:0x5a6a7a,armor:0x3a4a5a,accent:0x5a6a8a,eye:0x80d8ff,cape:0x14203a,bulk:1.1,head:'lich',weapon:'greatsword',weaponGlow:0x6ac8ff,scale:2.0}},
  attacks:[{n:t('boss.lich.attacks.0.n'),k:'kette',p:{hits:[.8,.6],r:5,ang:100,color:0x6ac8ff},i:t('boss.lich.attacks.0.i')},{n:t('boss.lich.attacks.1.n'),k:'explosion',p:{r:7,warn:.9,color:0x6ac8ff},i:t('boss.lich.attacks.1.i')}],
  rules:[{n:t('boss.lich.rules.0.n'),k:'pfuetzeWaechst',i:t('boss.lich.rules.0.i')}]},
 {id:'yogg',nr:23,name:t('boss.yogg.name'),from:t('boss.yogg.from'),tier:'spaet',desc:t('boss.yogg.desc'),
  model:{t:'blob',p:{skin:0x3a2a34,armor:0x2a3a22,eye:0xffd040,scale:1.3}},
  attacks:[{n:t('boss.yogg.attacks.0.n'),k:'atem',p:{color:0xb060ff,len:18,ang:30},i:t('boss.yogg.attacks.0.i')},{n:t('boss.yogg.attacks.1.n'),k:'faecher',p:{n:12,spread:360,color:0x9a50d0,speed:8},i:t('boss.yogg.attacks.1.i')},{n:t('boss.yogg.attacks.2.n'),k:'sog',p:{color:0x5a8a3a},i:t('boss.yogg.attacks.2.i')}],
  rules:[{n:t('boss.yogg.rules.0.n'),k:'wahnsinn',i:t('boss.yogg.rules.0.i')}]},
 {id:'atziri',nr:96,name:t('boss.atziri.name'),from:t('boss.atziri.from'),tier:'spaet',desc:t('boss.atziri.desc'),
  model:{t:'biped',p:{skin:0xc8a890,armor:0x6a1a2a,accent:0xd0a040,eye:0xff8a40,bulk:.85,head:'crown',weapon:'staff',glow:0xffb050,cape:0x6a1a2a,scale:1.8}},
  attacks:[{n:t('boss.atziri.attacks.0.n'),k:'explosion',p:{r:6,warn:1.3,color:0xff7a2a},i:t('boss.atziri.attacks.0.i')},{n:t('boss.atziri.attacks.1.n'),k:'faecher',p:{n:3,spread:30,speed:15,color:0xfff070},i:t('boss.atziri.attacks.1.i')}],
  rules:[{n:t('boss.atziri.rules.0.n'),k:'spiegelbilder',i:t('boss.atziri.rules.0.i')}]},
 {id:'maven',nr:94,name:t('boss.maven.name'),from:t('boss.maven.from'),tier:'spaet',desc:t('boss.maven.desc'),
  model:{t:'biped',p:{float:true,skin:0x8aa0c0,armor:0x2a3a5a,accent:0x5a7ab0,eye:0xb0e0ff,glow:0xb0e0ff,head:'crown',wings:0x3a5a8a,weapon:'none',scale:2.0}},
  attacks:[{n:t('boss.maven.attacks.0.n'),k:'muster',p:{n:5},i:t('boss.maven.attacks.0.i')},{n:t('boss.maven.attacks.1.n'),k:'faecher',p:{n:9,spread:120,color:0x7ae8ff},i:t('boss.maven.attacks.1.i')},{n:t('boss.maven.attacks.2.n'),k:'ring',p:{r:12,color:0x7ae8ff},i:t('boss.maven.attacks.2.i')}],rules:[]},
 {id:'gwyn',nr:61,name:t('boss.gwyn.name'),from:t('boss.gwyn.from'),tier:'spaet',desc:t('boss.gwyn.desc'),
  model:{t:'biped',p:{skin:0x6a5a4a,armor:0x4a3a2a,accent:0x5a4030,eye:0xffa040,cape:0x2a2018,head:'crown',weapon:'greatsword',weaponGlow:0xff8a30,scale:1.8}},
  attacks:[{n:t('boss.gwyn.attacks.0.n'),k:'kette',p:{hits:[.7,.5,.5,.9],r:5,ang:100,color:0xff8a30},i:t('boss.gwyn.attacks.0.i')},{n:t('boss.gwyn.attacks.1.n'),k:'slam',p:{r:5,warn:.9,fx:0xff8a30},i:t('boss.gwyn.attacks.1.i')},{n:t('boss.gwyn.attacks.2.n'),k:'explosion',p:{r:5,warn:.7,color:0xff6a1a},i:t('boss.gwyn.attacks.2.i')}],
  rules:[{n:t('boss.gwyn.rules.0.n'),k:'konter',i:t('boss.gwyn.rules.0.i')}]},
 // final
 {id:'malenia',nr:79,name:t('boss.malenia.name'),from:t('boss.malenia.from'),tier:'final',desc:t('boss.malenia.desc'),
  model:{t:'biped',p:{skin:0xd8c0a8,armor:0x8a7a5a,accent:0xb09a6a,eye:0xff4060,cape:0x9a1a2a,bulk:.8,head:'helm',redHair:true,prosthetic:true,weapon:'katana',scale:1.8}},
  attacks:[{n:t('boss.malenia.attacks.0.n'),k:'kette',p:{hits:[.9,.15,.15,.15,.6,.15,.15,.15],r:5,ang:360,color:0xff4060,gap:1.5},i:t('boss.malenia.attacks.0.i')},{n:t('boss.malenia.attacks.1.n'),k:'kette',p:{hits:[.6,.4],r:4,ang:90},i:t('boss.malenia.attacks.1.i')},{n:t('boss.malenia.attacks.2.n'),k:'explosion',p:{r:9,warn:1.5,color:0xd0203a},i:t('boss.malenia.attacks.2.i')}],
  rules:[{n:t('boss.malenia.rules.0.n'),k:'heiltBeiTreffer',i:t('boss.malenia.rules.0.i')}]},
 {id:'maliketh',nr:81,name:t('boss.maliketh.name'),from:t('boss.maliketh.from'),tier:'final',desc:t('boss.maliketh.desc'),
  model:{t:'biped',p:{skin:0x2a2428,armor:0x1a1a1f,accent:0x2a2a30,eye:0xff3030,cape:0x101014,bulk:1.0,head:'gnoll',weapon:'sword',weaponGlow:0xff2a2a,scale:2.0}},
  attacks:[{n:t('boss.maliketh.attacks.0.n'),k:'kette',p:{hits:[.4,.3,.4,.55],r:4.5,ang:100,color:0xff2a2a},i:t('boss.maliketh.attacks.0.i')},{n:t('boss.maliketh.attacks.1.n'),k:'slam',p:{r:5,warn:.8},i:t('boss.maliketh.attacks.1.i')},{n:t('boss.maliketh.attacks.2.n'),k:'faecher',p:{n:5,spread:60,color:0xff2a2a},i:t('boss.maliketh.attacks.2.i')}],
  rules:[{n:t('boss.maliketh.rules.0.n'),k:'maxHpSenken',i:t('boss.maliketh.rules.0.i')}]},
 {id:'shaper',nr:93,name:t('boss.shaper.name'),from:t('boss.shaper.from'),tier:'final',desc:t('boss.shaper.desc'),
  model:{t:'biped',p:{float:true,skin:0x2a3a5a,armor:0x1a2a4a,accent:0x3a5a8a,eye:0x6ab0ff,glow:0x6ab0ff,head:'hood',weapon:'staff',scale:2.2}},
  attacks:[{n:t('boss.shaper.attacks.0.n'),k:'rhythmus',p:{beats:4,int:.65},i:t('boss.shaper.attacks.0.i')},{n:t('boss.shaper.attacks.1.n'),k:'faecher',p:{n:16,spread:360,speed:7,color:0x6ab0ff,waves:2},i:t('boss.shaper.attacks.1.i')}],
  rules:[{n:t('boss.shaper.rules.0.n'),k:'zeitstopp',i:t('boss.shaper.rules.0.i')}]},
 {id:'asche',nr:66,name:t('boss.asche.name'),from:t('boss.asche.from'),tier:'final',desc:t('boss.asche.desc'),
  model:{t:'biped',p:{skin:0x4a3a30,armor:0x3a3330,accent:0x5a4030,eye:0xff8a30,cape:0x2a1a10,head:'crown',weapon:'greatsword',weaponGlow:0xff7a2a,scale:1.9}},
  attacks:[{n:t('boss.asche.attacks.0.n'),k:'kette',p:{hits:[.7,.5,.9],r:5,ang:100,color:0xff8a30},i:t('boss.asche.attacks.0.i')},{n:t('boss.asche.attacks.1.n'),k:'faecher',p:{n:5,spread:40,color:0xffb060},i:t('boss.asche.attacks.1.i')},{n:t('boss.asche.attacks.2.n'),k:'ansturm',p:{len:15,warn:.6},i:t('boss.asche.attacks.2.i')}],
  rules:[{n:t('boss.asche.rules.0.n'),k:'stilwechsel',i:t('boss.asche.rules.0.i')}]},
];
// Seele der Asche: Stilwechsel bei 75/50/25 % in dieser Reihenfolge
export const STYLES: any[] = [
 {name:t('boss.styles.0.name'),model:BOSSES.find(b=>b.id==='asche').model,atk:{k:'kette',p:{hits:[.6,.6],r:5,ang:100}}},
 {name:t('boss.styles.1.name'),model:BOSSES.find(b=>b.id==='v-krieger').model,atk:{k:'explosion',p:{r:5,warn:.6,spin:true,color:0xff3030}}},
 {name:t('boss.styles.2.name'),model:BOSSES.find(b=>b.id==='v-klinge').model,atk:{k:'ansturm',p:{len:11,w:1.4,warn:.5}}},
 {name:t('boss.styles.3.name'),model:BOSSES.find(b=>b.id==='v-feuer').model,atk:{k:'meteor',p:{n:3,r:4}}},
 {name:t('boss.styles.4.name'),model:BOSSES.find(b=>b.id==='v-eis').model,atk:{k:'explosion',p:{r:7,warn:.5,color:0x6ac8ff}}},
 {name:t('boss.styles.5.name'),model:BOSSES.find(b=>b.id==='v-arkan').model,atk:{k:'blink',p:{explode:5,color:0xc070ff}}},
];

// Spielwerte der Regeln, die im Viewer nur im Text stehen (Boss-Plan). Alle PH
const RULE_P = {
  hogger: { enrage: { hp: .2, speed: 1.2 } },                                 // unter 20 % HP Tempo ×1,2
  flickwerk: { enrage: { after: 60, dmg: 3, speed: 1.5 } },                   // nach 60 s Schaden ×3, Tempo ×1,5
  sif: { hinken: { hp: .25, speed: .6, wind: 1.3 } },                         // unter 25 % HP Tempo ×0,6, Ausholen ×1,3
  duriel: { slowAura: { pct: .3 } },
};
for (const b of BOSSES) for (const r of b.rules) r.p = { ...(r.p || {}), ...(RULE_P[b.id]?.[r.k] || {}) };

// Phase-2-Angriffe aus dem Namen ablesen
for (const b of BOSSES) for (const a of b.attacks) a.p2 ||= /\(P2\)/.test(a.n);   // p2 steht fest an den Angriffen, der Name ist übersetzt

// Prototyp aus v23 (Branch boss) als Roster-Eintrag: Modell = nächstes Mob-Modell der Zone, Angriffe wie bisher
export const PROTOTYPE = {
  id: 'prototyp', name: t('boss.prototyp.name'), from: t('boss.prototyp.from'), tier: 'proto', desc: t('boss.prototyp.desc'), zoneModel: true,
  attacks: [
    { n: t('boss.prototyp.attacks.0.n'), k: 'kette', p: { hits: [.8, .5, 1.0], r: 6, ang: 90, gap: 1.2 } },
    { n: t('boss.prototyp.attacks.1.n'), k: 'slam', p: { r: 6, warn: 1.4, gap: 1.5, ringP2: 12 } },
    { n: t('boss.prototyp.attacks.2.n'), k: 'ansturm', p: { len: 15, w: 3, warn: .7, gap: 1.0 } },
    { n: t('boss.prototyp.attacks.3.n'), k: 'faecher', p: { n: 5, spread: 60, speed: 8, size: .5, warn: .7, gap: .8 }, p2: true },
  ],
  rules: [],
};
export const ALL_BOSSES = [...BOSSES, PROTOTYPE];
export const bossById = id => ALL_BOSSES.find(b => b.id === id);
// Boss-Termine: Stufe nach Level. Verdorbene zählen zu mittel
export const TIER_OF_LEVEL = lv => lv >= 100 ? 'final' : lv >= 75 ? 'spaet' : lv >= 45 ? 'mittel' : 'frueh';
export const TIERS = [['frueh', t('boss.tier.frueh')], ['mittel', t('boss.tier.mittel')], ['spaet', t('boss.tier.spaet')], ['final', t('boss.tier.final')]];
