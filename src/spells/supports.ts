// Supports wirken auf alle Spells mit einem der Tags, je Support 1× pro Run. Wirkung in core.ts und formulas.ts.

export const SUPPORTS = [
  { id: 'echo', name: 'Echo', tags: ['Fläche', 'Nova'], desc: 'Wiederholt nach 0,5 s mit 70 % Schaden, +50 % Mana. Kein Kanal.' },
  { id: 'bigEcho', name: 'Großes Echo', tags: ['Fläche', 'Nova'], desc: '2 Wiederholungen, jede größer und stärker. Kein Kanal.' },
  { id: 'focus', name: 'Konzentration', tags: ['Fläche'], desc: '−30 % Fläche, +40 % Schaden.' },
  { id: 'wide', name: 'Weite', tags: ['Fläche'], desc: '+30 % Fläche, −10 % Schaden.' },
  { id: 'potency', name: 'Wirksamkeit', tags: ['Kanal'], desc: 'Kanäle und Dauereffekte: +40 % Dauer, +20 % Schaden über Zeit.' },
  { id: 'chain', name: 'Kette', tags: ['Geschoss'], desc: 'Springt nach Treffer zu 2 weiteren.' },
  { id: 'boneChill', name: 'Knochenkälte', tags: ['Frost'], desc: 'Verlangsamte Gegner nehmen +15 % Schaden.' },
  { id: 'blood', name: 'Blutopfer', tags: ['Dunkel', 'Feuer'], desc: 'Leben statt Mana.' },
];
