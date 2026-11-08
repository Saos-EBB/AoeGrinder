// Stichwörter und Prozentwerte im Text farbig. Farben aus EINER Tabelle (COLORS.keyword), für Karten und Hover-Karten.
import { COLORS } from './colors';

export function markWords(text: string) {
  let out = text.replace(/[+−-]?\d+(?:[,.]\d+)? %/g, m => `<span class="pct">${m}</span>`);
  for (const [word, color] of Object.entries(COLORS.keyword)) out = out.replace(new RegExp(`\\b${word}\\b`, 'g'), `<b style="color:${color}">${word}</b>`);
  return out;
}
