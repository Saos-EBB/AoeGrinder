// Dauern des Strichkriegers in ms (Spielregeln: REALMEN in realMen.ts). Eigene Datei, damit die Moves (actions.ts) sie ohne Kreis lesen.
export const STRICH_TIMING = {
  q: [520, 480, 500, 820], e: 950, leap: { ms: 1300, move: { from: 0.22, to: 0.66 } }, exec: 1400, cry: 1000, last: 1500,   // PH
  // Pro Waffe: Dauer der Schläge, von E und Maus 4. pose: welche Schwert-Pose ein Schlag nutzt (Axt: der Spalthieb ist der Sprung-Smash ohne Sprung)
  weapons: {
    sword: { q: [520, 480, 500, 820], pose: [0, 1, 2, 3], e: 950, exec: 1400, spin: 420 },   // spin: letzter Schlag der Schlagfolge (v31), Pose des Querschlags
    axe: { q: [560, 520, 750], pose: [0, 1, 3], e: 700, exec: 1400 },
    mace: { q: [450, 450, 450, 450], pose: [0, 1, 2, 0], e: 950, exec: 1100 },   // Tempo +30 % gibt das Spiel über anim.rate
  },
};
