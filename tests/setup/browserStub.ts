// Minimaler Browser-Ersatz für Module, die beim Laden DOM, Canvas, localStorage oder location anfassen (ARCH-04).
// Nur für Tests: document ist ein „alles-geht“-Proxy (createElement('canvas').getContext('2d')… liefert wieder den Proxy),
// localStorage ein Map-Speicher, location ohne Suchteil. Reicht für meta.ts; render.ts (WebGLRenderer) lädt damit NICHT.
// Als erster Import in die Testdatei, damit die Globals vor dem Spiel-Modul stehen.
const g = globalThis as any;
const any: any = new Proxy(function () { /* egal */ }, {
  get: (_t, k) => k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : any,
  apply: () => any, construct: () => any, set: () => true,
});
const store = new Map<string, string>();
export const fakeStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};
g.localStorage = fakeStorage;
g.location ??= { search: '', hash: '', href: 'http://localhost/' };
g.document ??= any;
g.window ??= g;
g.addEventListener ??= () => { /* egal */ };
g.dispatchEvent ??= () => true;
g.matchMedia ??= () => any;
g.requestAnimationFrame ??= () => 0;
