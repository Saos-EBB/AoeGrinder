// Kleine DOM-Helfer, einzige Quelle. Keine Spiel-Imports.

// Text für innerHTML entschärfen (& < > ")
export const esc = (s: unknown) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Zahl 0xRRGGBB → CSS '#rrggbb'
export const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

// HTML-Schnipsel → sein erstes Element (Dev-Blöcke)
export const html = (s: string) => { const d = document.createElement('div'); d.innerHTML = s; return d.firstElementChild as HTMLElement; };

// Element mit Klasse und Text, typisiert nach Tag
export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => Object.assign(document.createElement(tag), { className: cls, textContent: text });
