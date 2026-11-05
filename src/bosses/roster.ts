// Alle Bosse aus dem Boss-Viewer (Artifact „Frost Grind – Boss-Viewer“), Daten 1:1 übernommen. Alle Werte PH aus dem Boss-Plan.
// Boss = Daten-Objekt: Modell (t, p), Angriffe { n, k, p, i, b?, p2? }, Regeln { n, k, p, i }. Angriffe mit „(P2)“ im Namen kommen erst in Phase 2.
// k verweist auf ATT (bosses/attacks.ts) bzw. RULE (bosses/rules.ts). tier: frueh, mittel, spaet, final. evil: verdorbene Figur (zählt zu mittel).

// Verdorbene Figuren: Viewer-Strichmännchen als Platzhalter; im Spiel baut boss.ts das echte Spielermodell der Figur (evil = Skin-ID)
const evil = (skin, p) => ({ t: 'evil', skin, p: { color: 0x2a0a0e, glow: 0xff2a2a, scale: 1.5, ...p } });
export const BOSSES: any[] = [
 // früh
 {id:'hogger',nr:1,name:'Hogger',from:'WoW · Elwynn',tier:'frueh',desc:'Tutorial-Elite. Haut stur drauf. Unter 20 % HP schreit er und wird schneller.',
  model:{t:'biped',p:{skin:0x8a6a48,armor:0x6b4a2f,accent:0x9a3a2a,eye:0xffd060,bulk:1.25,head:'gnoll',weapon:'club',scale:1.6}},
  attacks:[{n:'Prankenhiebe',k:'kette',p:{hits:[1.0,.75,1.25],r:4,ang:100},i:'3 Schläge · Kegel 100° · 4 yd · letzter verzögert'},{n:'Gnoll-Ansturm',k:'ansturm',p:{len:12,warn:.9},i:'Linie 12 yd · Ausholen 0,9 s'}],
  rules:[{n:'Wut-Schrei',k:'enrage',p:{then:true},i:'unter 20 % HP: Tempo ×1,2'}]},
 {id:'sif',nr:56,name:'Sif',from:'Dark Souls',tier:'frueh',desc:'Riesiger Wolf mit dem Schwert im Maul. Wird bei wenig Leben langsamer und hinkt.',
  model:{t:'quadruped',p:{skin:0x8d8f98,eye:0xd0e0ff,metal:0xc8ccd8,swordInMouth:true,scale:1.9}},
  attacks:[{n:'Sprung-Schlag',k:'slam',p:{r:6,warn:1.0},i:'Kreis 6 yd · Warnung 1,0 s'},{n:'Klingen-Ansturm',k:'ansturm',p:{len:14,warn:.7},i:'Linie 14 yd'},{n:'Schwert-Wirbel',k:'explosion',p:{r:5,warn:.7,spin:true,color:0xffffff,fx:0xd8e0ff},i:'360° · 5 yd'}],
  rules:[{n:'Hinken',k:'hinken',i:'unter 25 % HP: Tempo ×0,6, Ausholen ×1,3'}]},
 {id:'duriel',nr:35,name:'Duriel',from:'Diablo II',tier:'frueh',desc:'Made in der engen Grabkammer. Seine Heilige-Frost-Aura bremst dich dauerhaft.',
  model:{t:'maggot',p:{skin:0xb79a6a,armor:0x7a6040,accent:0x4a3a2a,eye:0xff4040,scale:1.45}},
  attacks:[{n:'Klauen',k:'kette',p:{hits:[.75,.5],r:4.5,ang:110},i:'2 Schläge · Kegel 110°'},{n:'Durchbruch',k:'ansturm',p:{len:10,w:3,warn:.6},i:'Linie 10 yd, breit'}],
  rules:[{n:'Enge Kammer',k:'arenaRadius',p:{r:10},i:'Arena 10 yd'},{n:'Heilige Frost-Aura',k:'slowAura',i:'Dauer-Slow 30 %'}]},
 {id:'shazzrah',nr:5,name:'Shazzrah',from:'WoW · Geschmolzener Kern',tier:'frueh',desc:'Arkan-Flammenwirker. Blinkt alle 8 s hinter dich und explodiert.',
  model:{t:'biped',p:{float:true,skin:0x6a4a8a,armor:0x3a2a5a,accent:0x8a5ad0,eye:0xd0a0ff,glow:0xb070ff,head:'horns',weapon:'staff',scale:1.7}},
  attacks:[{n:'Blinzeln + Explosion',k:'blink',p:{explode:6,warn:.6},i:'hinter dich · dann Ring 6 yd'},{n:'Arkane Explosion',k:'explosion',p:{r:6,warn:.6,color:0xb070ff},i:'6 yd · Ausholen 0,6 s'},{n:'Arkan-Geschosse',k:'faecher',p:{n:5,spread:50,color:0xc080ff},i:'5 Geschosse · 50°'}],rules:[]},
 {id:'graefin',nr:39,name:'Die Gräfin',from:'Diablo II',tier:'frueh',desc:'Loot-Boss im Turm. Wirft Feuer, hinterlässt Lachen. Garantierter Drop.',
  model:{t:'biped',p:{skin:0xd0b0a0,armor:0x5a1a2a,accent:0x9a2a3a,eye:0xff8a40,bulk:.85,head:'crown',weapon:'none',cape:0x3a0a18,scale:1.6}},
  attacks:[{n:'Feuersalve',k:'faecher',p:{n:5,spread:60,color:0xff7a2a},i:'5 Feuerbälle · 60°'},{n:'Feuerlachen',k:'pfuetze',p:{n:2,r:3.5,color:0xff5a1a,label:'Feuerlache'},i:'2 Lachen · 6 s'}],
  rules:[{n:'Garantierter Drop',k:'loot',i:'Magier: Waffe ab Grün · sonst Staub ×3'}]},
 {id:'lazarus',nr:33,name:'Erzbischof Lazarus',from:'Diablo',tier:'frueh',desc:'Teleportiert sich und zieht Feuerwände durch die Arena.',
  model:{t:'biped',p:{float:true,skin:0xc8b8a0,armor:0x5a1a1a,accent:0xb08a3a,eye:0xff6a2a,glow:0xff6a2a,head:'hood',weapon:'staff',scale:1.65}},
  attacks:[{n:'Teleport',k:'blink',p:{behind:5,color:0xff6a2a},i:'springt hinter dich'},{n:'Feuerwand',k:'feuerwand',p:{len:18,dur:4},i:'Linie quer durch dich · 4 s'},{n:'Feuerblitze',k:'faecher',p:{n:3,spread:30,speed:13,color:0xff6a2a},i:'3 schnelle Blitze'}],rules:[]},
 {id:'flickwerk',nr:11,name:'Flickwerk',from:'WoW · Naxxramas',tier:'frueh',desc:'Reiner Schadens-Check. Nach 60 s Enrage.',
  model:{t:'biped',p:{skin:0x9aa58a,armor:0x5a4a3a,accent:0x7a2a2a,eye:0xffe060,bulk:1.6,belly:true,head:'bare',weapon:'hook',weapon2:'hook',pauldrons:false,scale:1.9}},
  attacks:[{n:'Hasserfüllter Schlag',k:'kette',p:{hits:[.6,.6,.6],r:4,ang:70},i:'3 harte Schläge · Schaden ×1,5'}],
  rules:[{n:'Enrage nach 60 s',k:'enrage',p:{then:true},i:'Schaden ×3, Tempo ×1,5 (hier gerafft)'}]},
 // mittel
 {id:'gruul',nr:17,name:'Gruul',from:'WoW · Gruuls Unterschlupf',tier:'mittel',desc:'Wächst alle 30 s. Je länger der Kampf, desto größer seine Schläge.',
  model:{t:'biped',p:{skin:0x7a8a9a,armor:0x4a4038,accent:0x5a5a6a,eye:0xffa040,bulk:1.5,head:'bare',tusks:true,weapon:'none',scale:2.3}},
  attacks:[{n:'Fausthiebe',k:'kette',p:{hits:[.9,.7],r:5,ang:90},i:'2 Schläge · 5 yd'},{n:'Bodenstampfer',k:'slam',p:{r:6,warn:1.0},i:'6 yd'},{n:'Zerschmettern',k:'slam',p:{r:10,warn:1.4,gap:2},i:'10 yd · alle 20 s'}],
  rules:[{n:'Wachstum',k:'wachstum',i:'alle 30 s: Größe, Schaden, Radius +10 %'}]},
 {id:'lilith',nr:51,name:'Lilith',from:'Diablo IV',tier:'mittel',desc:'Blutdornen und Lachen, und die Arena zieht sich um dich zusammen.',
  model:{t:'biped',p:{skin:0x7a3a44,armor:0x2a0f18,accent:0xc0203a,eye:0xff3050,bulk:.85,head:'horns',wings:0x5a1020,weapon:'none',scale:1.9}},
  attacks:[{n:'Krallen',k:'kette',p:{hits:[.6,.5,.85],r:4,ang:100},i:'3 Schläge'},{n:'Blutdornen',k:'faecher',p:{n:7,spread:80,color:0xd0203a},i:'7 Dornen · 80°'},{n:'Blutlachen',k:'pfuetze',p:{n:3,r:3.5,color:0x9a1020,label:'Blutlache'},i:'3 Lachen · Schaden/s'}],
  rules:[{n:'Arena schrumpft',k:'arenaSchrumpft',i:'20 → 8 yd über 90 s · ab 50 % doppelt so schnell'}]},
 {id:'azmodan',nr:44,name:'Azmodan',from:'Diablo III',tier:'mittel',desc:'Herr der Sünde auf Spinnenbeinen. Langsame Riesenkugel, Leichenfelder.',
  model:{t:'spider',p:{skin:0x8a3a2a,armor:0x3a1a14,eye:0x9aff4a,glow:0x9aff4a,scale:1.6}},
  attacks:[{n:'Höllenkugel',k:'riesenkugel',p:{size:2.4,speed:5,r:7},i:'langsam · Explosion 7 yd'},{n:'Leichenfeld',k:'pfuetze',p:{n:3,r:3,color:0x6a8a3a,label:'Leichen'},i:'3 Felder'},{n:'Dämonenstampfer',k:'explosion',p:{r:7,warn:.9,color:0xff5a2a},i:'7 yd um ihn'}],rules:[]},
 {id:'abgrund',nr:62,name:'Abgrundwächter',from:'Dark Souls III',tier:'mittel',desc:'Drei Wächter. Einer hat rote Augen und greift auch die anderen an.',
  bodies:[{m:{t:'biped',p:{skin:0x3a3438,armor:0x26242a,accent:0x3a2a2a,eye:0xff6a3a,cape:0x5a1a1a,bulk:.95,head:'helm',weapon:'greatsword',weapon2:'katana',scale:1.45}},off:[0,-4]},
          {m:{t:'biped',p:{skin:0x3a3438,armor:0x26242a,accent:0x3a2a2a,eye:0xff6a3a,cape:0x5a1a1a,bulk:.95,head:'helm',weapon:'greatsword',weapon2:'katana',scale:1.45}},off:[-6,-6]},
          {m:{t:'biped',p:{skin:0x3a3438,armor:0x26242a,accent:0x3a2a2a,eye:0xff1a1a,cape:0x5a1a1a,bulk:.95,head:'helm',weapon:'greatsword',weapon2:'katana',scale:1.45}},off:[6,-6]}],
  attacks:[{n:'Doppelklinge',k:'kette',p:{hits:[.5,.4,.65],r:4,ang:100},i:'3 schnelle Schläge'},{n:'Sprung-Stoß',k:'ansturm',p:{len:13,warn:.55},i:'Linie 13 yd'},{n:'Feuerspur (P2)',k:'ring',p:{r:11,color:0xff6a1a},i:'Ring bis 11 yd'}],
  rules:[{n:'Bekämpfen sich',k:'bekaempfenSich',i:'der Rotäugige trifft auch die anderen'}]},
 {id:'hornet',nr:85,name:'Hornet',from:'Hollow Knight',tier:'mittel',desc:'Schnelle Duellantin. Sprintet, wirft die Nadel, Fadensturm.',
  model:{t:'biped',p:{skin:0x2a1a24,armor:0x9a1e2a,accent:0x7a1420,eye:0x1a1418,bulk:.7,head:'mask',weapon:'needle',pauldrons:false,cape:0x9a1e2a,scale:1.35}},
  attacks:[{n:'Sprint',k:'ansturm',p:{len:16,w:1.6,warn:.45},i:'Linie 16 yd · nur 0,45 s Warnung'},{n:'Nadelwurf',k:'faecher',p:{n:1,speed:18,size:.3,color:0xf2ede4},i:'1 schnelle Nadel'},{n:'Fadensturm',k:'explosion',p:{r:4.5,warn:.5,color:0xf2ede4,fx:0xffffff},i:'4,5 yd · 0,5 s'}],rules:[]},
 {id:'thaddius',nr:14,name:'Thaddius',from:'WoW · Naxxramas',tier:'mittel',desc:'Golem mit Tesla-Spulen. Wechselt die Polarität: falsche Ladung tut weh.',
  model:{t:'biped',p:{skin:0x4a6a5a,armor:0x3a4a44,accent:0x6a8a7a,eye:0x80e0ff,glow:0x60c8ff,bulk:1.7,head:'bare',coils:true,belly:true,weapon:'none',scale:2.1}},
  attacks:[{n:'Fäuste',k:'kette',p:{hits:[.9,.7],r:5,ang:90},i:'2 Schläge'},{n:'Blitzentladung',k:'explosion',p:{r:8,warn:1.0,color:0x60c8ff},i:'8 yd'}],
  rules:[{n:'Polarität',k:'polaritaet',i:'+/− wechselt · gleiche Ladung = Bonus'}]},
 {id:'ragnaros',nr:3,name:'Ragnaros',from:'WoW · Geschmolzener Kern',tier:'mittel',desc:'Feuerfürst aus der Lava. Taucht ab und schickt die Söhne der Flamme.',
  model:{t:'lavaTorso',p:{skin:0x8a2a10,armor:0x5a1a08,accent:0xff6a1a,eye:0xffee60,metal:0x3a2a20,scale:1.45}},
  attacks:[{n:'Sulfuras-Schläge',k:'kette',p:{hits:[1.0,.8],r:7,ang:120,color:0xff4a1a},i:'2 Schläge · 7 yd · 120°'},{n:'Zorn des Ragnaros',k:'ring',p:{r:10,color:0xff7a2a},i:'Knockback-Ring 10 yd'},{n:'Lavabrocken',k:'meteor',p:{n:5,r:3},i:'5 Einschläge'}],
  rules:[{n:'Abtauchen',k:'abtauchen',i:'unangreifbar, Söhne der Flamme'}]},
 {id:'chromaggus',nr:8,name:'Chromaggus',from:'WoW · Pechschwingenhort',tier:'mittel',desc:'Zweiköpfiger Hund. Pro Run werden zwei seiner fünf Atem gewürfelt.',
  model:{t:'quadruped',p:{skin:0x6a5a4a,eye:0xffd040,heads:2,horns:true,scale:2.0}},
  attacks:[{n:'Biss',k:'kette',p:{hits:[.6,.6],r:4.5,ang:80},i:'2 Bisse'},{n:'Frostbrand',k:'atem',p:{color:0x6ac8ff,len:15,ang:50},i:'Kegel 50° · 15 yd'},{n:'Ätzende Säure',k:'atem',p:{color:0x7aff3a,len:15,ang:50},i:'Kegel 50°'}],
  rules:[{n:'Zufalls-Atem',k:'zufallsAtem',i:'2 von 5 Atem pro Run'}]},
 {id:'wachritter',nr:88,name:'Wachritter',from:'Hollow Knight',tier:'mittel',desc:'Sechs Ritter, höchstens zwei wach. Fällt einer, erwacht der nächste.',
  bodies:[0,1,2,3,4,5].map(i=>({m:{t:'biped',p:{skin:0x2a2a38,armor:0x3a3a4c,accent:0x5a5a74,eye:0xfff0a0,bulk:1.35,head:'helm',weapon:'club',scale:1.35}},off:[(i-2.5)*3.4,-5-Math.abs(i-2.5)*.8],state:i<2?'active':'sleep'})),
  attacks:[{n:'Keulenschlag',k:'kette',p:{hits:[.8,.6],r:4,ang:90},i:'2 Schläge'},{n:'Einrollen',k:'ansturm',p:{len:14,w:2.6,warn:.6},i:'Linie 14 yd'}],
  rules:[{n:'Ablösung',k:'spawnUeberZeit',p:{max:2,label:'erwacht'},i:'max. 2 aktiv'}]},
 // verdorbene figuren (mittel)
 {id:'v-krieger',nr:'V',name:'Verdorbener Strichkrieger',from:'eigene Figur',tier:'mittel',evil:true,desc:'Der Strichkrieger als Boss. Wirbelwind, Smash, Donnerknall.',
  model:evil('krieger',{weapon:'greatsword',metal:0x3a3034,weaponGlow:0x8a1010}),
  attacks:[{n:'Wirbelwind',k:'explosion',p:{r:5,warn:.6,spin:true,color:0xff3030},i:'360° · 5 yd'},{n:'Smash',k:'slam',p:{r:5,warn:.9},i:'5 yd'},{n:'Donnerknall',k:'ring',p:{r:9,color:0xffd050},i:'Ring 9 yd'}],rules:[]},
 {id:'v-klinge',nr:'V',name:'Verdorbener Klingenstrich',from:'eigene Figur',tier:'mittel',evil:true,desc:'Zwei Katanas. Q-Kette, Strichschnitt, Blutwirbel.',
  model:evil('klinge',{weapon:'katana',weapon2:'katana',weaponGlow:0xff2a3a}),
  attacks:[{n:'Q-Kette',k:'kette',p:{hits:[.4,.4,.55],r:3.5,ang:120},i:'3 schnelle Schnitte'},{n:'Strichschnitt',k:'ansturm',p:{len:11,w:1.4,warn:.5},i:'Linie 11 yd'},{n:'Blutwirbel',k:'sog',p:{color:0xd0203a,explode:5},i:'zieht an, dann 5 yd'}],rules:[]},
 {id:'v-feuer',nr:'V',name:'Verdorbener Feuermagier',from:'eigene Figur',tier:'mittel',evil:true,desc:'Feuerball, Meteor, Benzin, Höllenfeuer.',
  model:evil('feuer',{weapon:'staff',glow:0xff6a1a,color:0x2a0e08}),
  attacks:[{n:'Feuerball',k:'faecher',p:{n:1,speed:14,size:.5,color:0xff6a1a},i:'1 schneller Ball'},{n:'Meteor',k:'meteor',p:{n:1,r:5,warn:1.3},i:'5 yd'},{n:'Benzin',k:'pfuetze',p:{n:1,r:5,color:0xd8b040,label:'Benzin'},i:'Fläche 5 yd'},{n:'Höllenfeuer',k:'explosion',p:{r:6,warn:.7,color:0xff4a1a},i:'6 yd um ihn'}],rules:[]},
 {id:'v-eis',nr:'V',name:'Verdorbener Eismagier',from:'eigene Figur',tier:'mittel',evil:true,desc:'Frost Nova, Blizzard, Eislanzen.',
  model:evil('eis',{weapon:'staff',glow:0x6ac8ff,color:0x0a1420}),
  attacks:[{n:'Frost Nova',k:'explosion',p:{r:7,warn:.5,color:0x6ac8ff},i:'7 yd · friert'},{n:'Blizzard',k:'meteor',p:{n:9,r:2,warn:.8,spread:5,stagger:.12,color:0x9ad8ff},i:'9 Einschläge'},{n:'Eislanzen',k:'faecher',p:{n:3,spread:24,speed:15,color:0xbfe8ff},i:'3 Lanzen'}],rules:[]},
 {id:'v-arkan',nr:'V',name:'Verdorbener Arkanmagier',from:'eigene Figur',tier:'mittel',evil:true,desc:'Schwebt, blinkt, Arkane Geschosse.',
  model:evil('arkan',{weapon:'staff',glow:0xc070ff,color:0x140a20,float:true}),
  attacks:[{n:'Blink + Explosion',k:'blink',p:{explode:5,warn:.5,color:0xc070ff},i:'hinter dich · 5 yd'},{n:'Arkane Geschosse',k:'faecher',p:{n:5,spread:14,speed:14,color:0xc070ff},i:'5 in enger Reihe'},{n:'Arkane Explosion',k:'explosion',p:{r:6,warn:.55,color:0xc070ff},i:'6 yd'}],rules:[]},
 // spät
 {id:'os',nr:55,name:'Ornstein & Smough',from:'Dark Souls',tier:'spaet',desc:'Duo. Stirbt einer, erbt der andere seine Kraft.',
  bodies:[{m:{t:'biped',p:{skin:0x8a7a5a,armor:0xc9a24a,accent:0xe0c060,eye:0xffe070,metal:0xffe9a0,bulk:.9,head:'lion',weapon:'spear',scale:1.7}},off:[-3.5,-4]},
          {m:{t:'biped',p:{skin:0x8a7a5a,armor:0xb08a3a,accent:0xd0a850,eye:0xffc060,bulk:1.8,belly:true,head:'helm',weapon:'hammer',scale:2.1}},off:[3.5,-5]}],
  attacks:[{n:'Speerstoß (Ornstein)',k:'ansturm',b:0,p:{len:13,w:1.6,warn:.55,color:0xffe070},i:'Linie 13 yd'},{n:'Hammersprung (Smough)',k:'slam',b:1,p:{r:6,warn:1.1},i:'6 yd'},{n:'Blitzspeer (Ornstein)',k:'faecher',b:0,p:{n:1,speed:16,size:.4,color:0xffe070},i:'1 Blitz'}],
  rules:[{n:'Erbt die Kraft',k:'erbtKraft',i:'Überlebender +30 %'}]},
 {id:'koenige',nr:59,name:'Die Vier Könige',from:'Dark Souls',tier:'spaet',desc:'Alle 50 s kommt ein König dazu. Wer zu langsam ist, kämpft gegen vier.',
  bodies:[0,1,2,3].map(i=>({m:{t:'biped',p:{skin:0x18141f,armor:0x221c2c,accent:0x3a2a54,eye:0xb890ff,glow:0x9a70ff,bulk:.85,head:'crown',weapon:'sword',weaponGlow:0x9a70ff,scale:2.0}},off:[(i-1.5)*4.5,-5-(i%2)*1.5],state:i===0?'active':'hidden'})),
  attacks:[{n:'Schwerthiebe',k:'kette',p:{hits:[.8,.6],r:5,ang:90,color:0x9a70ff},i:'2 Hiebe'},{n:'Dunkle Geschosse',k:'faecher',p:{n:6,spread:70,color:0x9a70ff},i:'6 Geschosse'},{n:'Abgrund-Explosion',k:'explosion',p:{r:8,warn:1.0,color:0x7a50d0},i:'8 yd'}],
  rules:[{n:'Neuer König',k:'spawnUeberZeit',p:{label:'ein König mehr'},i:'alle 50 s'}]},
 {id:'godrick',nr:76,name:'Godrick der Verpflanzte',from:'Elden Ring',tier:'spaet',desc:'Axt und Sturm. In Phase 2 näht er sich einen Drachenkopf an den Arm.',
  model:{t:'biped',p:{skin:0x9a8a6a,armor:0xb08a3a,accent:0x8a6a2a,eye:0xffd070,cape:0x6a6040,bulk:1.5,head:'crown',weapon:'axe',scale:2.0}},
  attacks:[{n:'Axthiebe',k:'kette',p:{hits:[.9,.6,1.1],r:5,ang:100},i:'3 Hiebe · letzter verzögert'},{n:'Sturmstampfer',k:'slam',p:{r:7,warn:1.0,fx:0xd0d8e0},i:'7 yd'},{n:'Sturmwelle',k:'ring',p:{r:10,color:0xd0d8e0},i:'Ring 10 yd'}],
  rules:[{n:'Drachenarm (P2)',k:'neuePhaseWaffe',i:'neuer Arm, Feueratem'}]},
 {id:'radahn',nr:78,name:'Radahn',from:'Elden Ring',tier:'spaet',desc:'Zwei Riesenklingen und Gravitation. Phase 2 kommt als Meteor.',
  model:{t:'biped',p:{skin:0x8a6a5a,armor:0x7a3a2a,accent:0x9a2a1a,eye:0xc090ff,cape:0x9a2a1a,bulk:1.6,head:'horns',weapon:'greatsword',weapon2:'greatsword',metal:0x9a8a7a,scale:2.3}},
  attacks:[{n:'Zwillingsklingen',k:'kette',p:{hits:[.9,.7],r:6,ang:120},i:'2 Hiebe · 6 yd'},{n:'Gravitation',k:'sog',p:{color:0xa070ff,explode:6},i:'zieht an, dann 6 yd'},{n:'Gravitationspfeile',k:'faecher',p:{n:5,spread:40,color:0xa070ff},i:'5 Pfeile'},{n:'Meteor-Sturz (P2)',k:'meteor',p:{n:1,r:9,warn:1.6,color:0xa070ff},i:'9 yd · 1,6 s'}],rules:[]},
 {id:'lich',nr:26,name:'Der Lichkönig',from:'WoW · Eiskronenzitadelle',tier:'spaet',desc:'Frostgram und Entweihen: Die Pfütze wächst, wenn sie dich trifft.',
  model:{t:'biped',p:{skin:0x5a6a7a,armor:0x3a4a5a,accent:0x5a6a8a,eye:0x80d8ff,cape:0x14203a,bulk:1.1,head:'lich',weapon:'greatsword',weaponGlow:0x6ac8ff,scale:2.0}},
  attacks:[{n:'Frostgram-Schläge',k:'kette',p:{hits:[.8,.6],r:5,ang:100,color:0x6ac8ff},i:'2 Schläge'},{n:'Heulender Frost',k:'explosion',p:{r:7,warn:.9,color:0x6ac8ff},i:'7 yd'}],
  rules:[{n:'Entweihen wächst',k:'pfuetzeWaechst',i:'Treffer = Pfütze ×1,4'}]},
 {id:'yogg',nr:23,name:'Yogg-Saron',from:'WoW · Ulduar',tier:'spaet',desc:'Alter Gott. Tentakel, Blick, und eine Sanity-Leiste, die sinkt.',
  model:{t:'blob',p:{skin:0x3a2a34,armor:0x2a3a22,eye:0xffd040,scale:1.3}},
  attacks:[{n:'Lunatischer Blick',k:'atem',p:{color:0xb060ff,len:18,ang:30},i:'Strahl 18 yd'},{n:'Psychose',k:'faecher',p:{n:12,spread:360,color:0x9a50d0,speed:8},i:'12 rundum'},{n:'Tentakelgriff',k:'sog',p:{color:0x5a8a3a},i:'zieht dich ran'}],
  rules:[{n:'Wahnsinn',k:'wahnsinn',i:'Sanity 0 = Steuerung gespiegelt'}]},
 {id:'atziri',nr:96,name:'Atziri',from:'Path of Exile',tier:'spaet',desc:'Königin mit Spiegelbildern. Nur eine ist echt.',
  model:{t:'biped',p:{skin:0xc8a890,armor:0x6a1a2a,accent:0xd0a040,eye:0xff8a40,bulk:.85,head:'crown',weapon:'staff',glow:0xffb050,cape:0x6a1a2a,scale:1.8}},
  attacks:[{n:'Flammenstoß',k:'explosion',p:{r:6,warn:1.3,color:0xff7a2a},i:'6 yd · lange Aufladung'},{n:'Blitzschlag',k:'faecher',p:{n:3,spread:30,speed:15,color:0xfff070},i:'3 Blitze'}],
  rules:[{n:'Spiegelbilder',k:'spiegelbilder',i:'4 Kopien, eine echt'}]},
 {id:'maven',nr:94,name:'Maven',from:'Path of Exile',tier:'spaet',desc:'Merk-Spiel: Felder leuchten, dann explodieren sie in derselben Reihenfolge.',
  model:{t:'biped',p:{float:true,skin:0x8aa0c0,armor:0x2a3a5a,accent:0x5a7ab0,eye:0xb0e0ff,glow:0xb0e0ff,head:'crown',wings:0x3a5a8a,weapon:'none',scale:2.0}},
  attacks:[{n:'Merk-Spiel',k:'muster',p:{n:5},i:'3×3 Felder · 5er-Folge'},{n:'Kristallsplitter',k:'faecher',p:{n:9,spread:120,color:0x7ae8ff},i:'9 Splitter'},{n:'Erinnerungswelle',k:'ring',p:{r:12,color:0x7ae8ff},i:'Ring 12 yd'}],rules:[]},
 {id:'gwyn',nr:61,name:'Gwyn',from:'Dark Souls',tier:'spaet',desc:'Verbrannter Lord. Seine Kombo ist parierbar: Perfekter Dodge öffnet ein Konter-Fenster.',
  model:{t:'biped',p:{skin:0x6a5a4a,armor:0x4a3a2a,accent:0x5a4030,eye:0xffa040,cape:0x2a2018,head:'crown',weapon:'greatsword',weaponGlow:0xff8a30,scale:1.8}},
  attacks:[{n:'Feuerkombo',k:'kette',p:{hits:[.7,.5,.5,.9],r:5,ang:100,color:0xff8a30},i:'4 Schläge'},{n:'Sprungschlag',k:'slam',p:{r:5,warn:.9,fx:0xff8a30},i:'5 yd'},{n:'Feuerstoß',k:'explosion',p:{r:5,warn:.7,color:0xff6a1a},i:'5 yd'}],
  rules:[{n:'Konter',k:'konter',i:'Perfekter Dodge → ×3 Schaden'}]},
 // final
 {id:'malenia',nr:79,name:'Malenia',from:'Elden Ring',tier:'final',desc:'Heilt sich bei jedem Treffer an dir. Der Wasservogeltanz trifft rundum.',
  model:{t:'biped',p:{skin:0xd8c0a8,armor:0x8a7a5a,accent:0xb09a6a,eye:0xff4060,cape:0x9a1a2a,bulk:.8,head:'helm',redHair:true,prosthetic:true,weapon:'katana',scale:1.8}},
  attacks:[{n:'Wasservogeltanz',k:'kette',p:{hits:[.9,.15,.15,.15,.6,.15,.15,.15],r:5,ang:360,color:0xff4060,gap:1.5},i:'8 Schläge rundum · 3 Wellen'},{n:'Klingenschnitte',k:'kette',p:{hits:[.6,.4],r:4,ang:90},i:'2 Schnitte'},{n:'Scharlachblüte',k:'explosion',p:{r:9,warn:1.5,color:0xd0203a},i:'9 yd · 1,5 s'}],
  rules:[{n:'Heilt bei Treffer',k:'heiltBeiTreffer',i:'+4 % pro Treffer an dir'}]},
 {id:'maliketh',nr:81,name:'Maliketh',from:'Elden Ring',tier:'final',desc:'Bestie mit der Klinge des Todes. Treffer senken dein maximales Leben.',
  model:{t:'biped',p:{skin:0x2a2428,armor:0x1a1a1f,accent:0x2a2a30,eye:0xff3030,cape:0x101014,bulk:1.0,head:'gnoll',weapon:'sword',weaponGlow:0xff2a2a,scale:2.0}},
  attacks:[{n:'Wilde Hiebe',k:'kette',p:{hits:[.4,.3,.4,.55],r:4.5,ang:100,color:0xff2a2a},i:'4 schnelle Hiebe'},{n:'Sprung',k:'slam',p:{r:5,warn:.8},i:'5 yd · kurze Warnung'},{n:'Todesklingen',k:'faecher',p:{n:5,spread:60,color:0xff2a2a},i:'5 Klingen'}],
  rules:[{n:'Zerstörung',k:'maxHpSenken',i:'jeder Treffer: max. Leben −10 %'}]},
 {id:'shaper',nr:93,name:'Shaper',from:'Path of Exile',tier:'final',desc:'Slams im Takt, Bullet Hell, und er hält die Zeit an.',
  model:{t:'biped',p:{float:true,skin:0x2a3a5a,armor:0x1a2a4a,accent:0x3a5a8a,eye:0x6ab0ff,glow:0x6ab0ff,head:'hood',weapon:'staff',scale:2.2}},
  attacks:[{n:'Slam-Rhythmus',k:'rhythmus',p:{beats:4,int:.65},i:'4 Takte · letzter groß'},{n:'Bullet Hell',k:'faecher',p:{n:16,spread:360,speed:7,color:0x6ab0ff,waves:2},i:'2 Wellen à 16'}],
  rules:[{n:'Zeitstopp',k:'zeitstopp',i:'alles friert 1,3 s'}]},
 {id:'asche',nr:66,name:'Seele der Asche',from:'Dark Souls III',tier:'final',desc:'Finale. Wechselt alle 25 % HP zwischen allen verdorbenen Figuren.',
  model:{t:'biped',p:{skin:0x4a3a30,armor:0x3a3330,accent:0x5a4030,eye:0xff8a30,cape:0x2a1a10,head:'crown',weapon:'greatsword',weaponGlow:0xff7a2a,scale:1.9}},
  attacks:[{n:'Ritter: Schwertkette',k:'kette',p:{hits:[.7,.5,.9],r:5,ang:100,color:0xff8a30},i:'3 Schläge'},{n:'Zauberer: Seelenpfeile',k:'faecher',p:{n:5,spread:40,color:0xffb060},i:'5 Pfeile'},{n:'Lanze: Sturmlauf',k:'ansturm',p:{len:15,warn:.6},i:'Linie 15 yd'}],
  rules:[{n:'Stilwechsel',k:'stilwechsel',i:'alle 25 % HP: nächste Figur'}]},
];
// Seele der Asche: Stilwechsel bei 75/50/25 % in dieser Reihenfolge
export const STYLES: any[] = [
 {name:'Ritter der Asche',model:BOSSES.find(b=>b.id==='asche').model,atk:{k:'kette',p:{hits:[.6,.6],r:5,ang:100}}},
 {name:'Strichkrieger',model:BOSSES.find(b=>b.id==='v-krieger').model,atk:{k:'explosion',p:{r:5,warn:.6,spin:true,color:0xff3030}}},
 {name:'Klingenstrich',model:BOSSES.find(b=>b.id==='v-klinge').model,atk:{k:'ansturm',p:{len:11,w:1.4,warn:.5}}},
 {name:'Feuermagier',model:BOSSES.find(b=>b.id==='v-feuer').model,atk:{k:'meteor',p:{n:3,r:4}}},
 {name:'Eismagier',model:BOSSES.find(b=>b.id==='v-eis').model,atk:{k:'explosion',p:{r:7,warn:.5,color:0x6ac8ff}}},
 {name:'Arkanmagier',model:BOSSES.find(b=>b.id==='v-arkan').model,atk:{k:'blink',p:{explode:5,color:0xc070ff}}},
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
for (const b of BOSSES) for (const a of b.attacks) a.p2 = /\(P2\)/.test(a.n);

// Prototyp aus v23 (Branch boss) als Roster-Eintrag: Modell = nächstes Mob-Modell der Zone, Angriffe wie bisher
export const PROTOTYPE = {
  id: 'prototyp', name: 'Prototyp-Boss', from: 'Frost Grind', tier: 'proto', desc: 'Der erste Boss: Mob der Zone, ×2,5 groß.', zoneModel: true,
  attacks: [
    { n: 'Schlag-Kette', k: 'kette', p: { hits: [.8, .5, 1.0], r: 6, ang: 90, gap: 1.2 } },
    { n: 'Sprung-Slam', k: 'slam', p: { r: 6, warn: 1.4, gap: 1.5, ringP2: 12 } },
    { n: 'Ansturm', k: 'ansturm', p: { len: 15, w: 3, warn: .7, gap: 1.0 } },
    { n: 'Geschoss-Fächer (P2)', k: 'faecher', p: { n: 5, spread: 60, speed: 8, size: .5, warn: .7, gap: .8 }, p2: true },
  ],
  rules: [],
};
export const ALL_BOSSES = [...BOSSES, PROTOTYPE];
export const bossById = id => ALL_BOSSES.find(b => b.id === id);
// Boss-Termine: Stufe nach Level. Verdorbene zählen zu mittel
export const TIER_OF_LEVEL = lv => lv >= 100 ? 'final' : lv >= 75 ? 'spaet' : lv >= 45 ? 'mittel' : 'frueh';
export const TIERS = [['frueh', 'Früh · Lvl 15/30'], ['mittel', 'Mittel · Lvl 45/60'], ['spaet', 'Spät · Lvl 75/90'], ['final', 'Final · Lvl 100']];
