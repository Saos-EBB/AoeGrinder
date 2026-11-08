// Übersetzung DE/EN. t('spell.fireball.name', { n: 3 }) sucht in der aktiven Sprache, dann in DE, sonst kommt der Key selbst.
// Platzhalter: {n} aus vars (Zahlen mit Komma oder Punkt je Sprache), @{key} setzt einen anderen Eintrag ein (Namen in Beschreibungen).
// Die Sprache gilt ab dem Laden der Seite; Umschalten speichert und lädt neu, weil viele Texte beim Import entstehen.

import { de } from './de';
import { en } from './en';

export type Lang = 'de' | 'en';
export const LANGS: [Lang, string][] = [['de', 'Deutsch'], ['en', 'English']];
const STORE = 'frostgrind.lang';
const DICTS: Record<Lang, Record<string, string>> = { de, en };

export const lang: Lang = (() => { try { const l = localStorage.getItem(STORE); return l === 'en' ? 'en' : 'de'; } catch { return 'de'; } })();
document.documentElement.lang = lang;

export function setLang(l: Lang) {
  if (l === lang) return;
  try { localStorage.setItem(STORE, l); } catch { /* kein Storage: bleibt bei DE */ }
  location.reload();
}

const warned = new Set<string>();
const warn = (key: string, msg: string) => { if (warned.has(key)) return; warned.add(key); console.warn(`[i18n] ${msg}: ${key}`); };

// Zahl in der Schreibweise der Sprache, ohne Tausenderpunkt (wie bisher im Spiel)
export const num = (v: number, digits = 2) => v.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: digits, useGrouping: false });

export const has = (key: string) => key in DICTS[lang] || key in de;

export function t(key: string, vars?: Record<string, string | number>): string {
  let s = DICTS[lang][key];
  if (s === undefined) {
    s = de[key];
    if (s === undefined) { warn(key, 'fehlt'); return key; }
    if (lang !== 'de') warn(key, `fehlt in ${lang}`);
  }
  if (s.includes('@{')) s = s.replace(/@\{([\w.\-]+)\}/g, (_, k) => t(k));
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => k in vars ? (typeof vars[k] === 'number' ? num(vars[k] as number) : String(vars[k])) : m);
  return s;
}

// Statisches HTML: data-i18n setzt textContent, data-i18n-title / -placeholder / -aria die Attribute
export function translateDom(root: ParentNode = document) {
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) el.textContent = t(el.dataset.i18n!);
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml!);
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle!);
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-placeholder]')) el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder!));
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria!));
}
