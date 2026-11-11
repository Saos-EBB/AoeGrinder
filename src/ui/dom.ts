// Kleine DOM-Helfer, einzige Quelle. Keine Spiel-Imports.

// Text für innerHTML entschärfen (& < > ")
export const esc = (s: unknown) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Zahl 0xRRGGBB → CSS '#rrggbb'
export const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

// Element mit Klasse und Text, typisiert nach Tag
export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => Object.assign(document.createElement(tag), { className: cls, textContent: text });
