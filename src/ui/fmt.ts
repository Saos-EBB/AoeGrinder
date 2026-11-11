// Anzeige-Formatierer für Zeit, Ganzzahlen und Multiplikatoren. Einzige Quelle, keine Spiel-Imports (nur i18n für fmtNum).
// Kevins Entscheidungen 11.11.: Split-Differenz immer mit Zehntel (+m:ss.t), Tausenderpunkt fest (1.234) auch auf Englisch.

import { fmtNum } from '../i18n';

// m:ss, mit tenths m:ss.t (abgeschnitten, nicht gerundet)
export const fmtTime = (ms: number, tenths = false) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}${tenths ? `.${Math.floor(ms / 100) % 10}` : ''}`;

// Split-Differenz: +m:ss.t bzw. −m:ss.t (echtes Minuszeichen)
export const fmtDiff = (ms: number) => `${ms < 0 ? '−' : '+'}${fmtTime(Math.abs(ms), true)}`;

// Ganzzahl mit Tausenderpunkt, in jeder Sprache gleich
export const fmtInt = (n: number) => Math.round(n).toLocaleString('de-DE', { maximumFractionDigits: 0 });

// Punkte-/Staub-Multiplikator: ×1,5 (DE) / ×1.5 (EN), höchstens 2 Nachkommastellen
export const fmtMult = (v: number) => `×${fmtNum(Math.round(v * 100) / 100)}`;
