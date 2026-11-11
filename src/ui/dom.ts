// Kleine DOM-Helfer, einzige Quelle. Keine Spiel-Imports.

// Text für innerHTML entschärfen (& < > ")
export const esc = (s: unknown) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Zahl 0xRRGGBB → CSS '#rrggbb'
export const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

// HTML-Schnipsel → sein erstes Element (Dev-Blöcke)
export const html = (s: string) => { const d = document.createElement('div'); d.innerHTML = s; return d.firstElementChild as HTMLElement; };

// Element mit Klasse und Text, typisiert nach Tag
export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => Object.assign(document.createElement(tag), { className: cls, textContent: text });

// Diff-Cache für put/fillTo (ui/hud.ts, ui/hud/elements.ts): zuletzt geschriebener Text bzw. Wert von --v je Element.
// Eine Map für beide Module, wie vorher das gemeinsame Expando el._t / el._v (KOMP-20)
export const lastText = new WeakMap<Element, string>();
export const lastVar = new WeakMap<Element, string>();
