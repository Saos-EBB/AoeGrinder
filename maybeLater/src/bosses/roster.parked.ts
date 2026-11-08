// Geparkt am 2026-11-08 aus src/bosses/roster.ts: verdorbene Arkan- und Klingen-Figur als Boss, dazu ihre Stile der Seele der Asche.
// Reihenfolge in STYLES war: 0 Asche, 1 Krieger, 2 Klinge, 3 Feuer, 4 Eis, 5 Arkan.

// BOSSES (nach v-krieger bzw. v-eis)
 {id:'v-klinge',nr:'V',name:t('boss.v-klinge.name'),from:t('boss.v-klinge.from'),tier:'mittel',evil:true,desc:t('boss.v-klinge.desc'),
  model:evil('klinge',{weapon:'katana',weapon2:'katana',weaponGlow:0xff2a3a}),
  attacks:[{n:t('boss.v-klinge.attacks.0.n'),k:'kette',p:{hits:[.4,.4,.55],r:3.5,ang:120},i:t('boss.v-klinge.attacks.0.i')},{n:t('boss.v-klinge.attacks.1.n'),k:'ansturm',p:{len:11,w:1.4,warn:.5},i:t('boss.v-klinge.attacks.1.i')},{n:t('boss.v-klinge.attacks.2.n'),k:'sog',p:{color:0xd0203a,explode:5},i:t('boss.v-klinge.attacks.2.i')}],rules:[]},
 {id:'v-arkan',nr:'V',name:t('boss.v-arkan.name'),from:t('boss.v-arkan.from'),tier:'mittel',evil:true,desc:t('boss.v-arkan.desc'),
  model:evil('arkan',{weapon:'staff',glow:0xc070ff,color:0x140a20,float:true}),
  attacks:[{n:t('boss.v-arkan.attacks.0.n'),k:'blink',p:{explode:5,warn:.5,color:0xc070ff},i:t('boss.v-arkan.attacks.0.i')},{n:t('boss.v-arkan.attacks.1.n'),k:'faecher',p:{n:5,spread:14,speed:14,color:0xc070ff},i:t('boss.v-arkan.attacks.1.i')},{n:t('boss.v-arkan.attacks.2.n'),k:'explosion',p:{r:6,warn:.55,color:0xc070ff},i:t('boss.v-arkan.attacks.2.i')}],rules:[]},

// STYLES
 {name:t('boss.styles.2.name'),model:BOSSES.find(b=>b.id==='v-klinge').model,atk:{k:'ansturm',p:{len:11,w:1.4,warn:.5}}},
 {name:t('boss.styles.5.name'),model:BOSSES.find(b=>b.id==='v-arkan').model,atk:{k:'blink',p:{explode:5,color:0xc070ff}}},
