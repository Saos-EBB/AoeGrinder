// Desktop oder Handy: wählt der Startbildschirm (boot.ts), bevor das Spiel lädt. Eigenes Modul ohne Imports, damit es nirgends zirkulär wird.
export const device = {
  mobile: false,
  rotated: false,   // Handy hochkant ohne Querformat-Sperre: die ganze Seite liegt um 90° gedreht (CSS html.rot)
};
export const detectedMobile = () => matchMedia('(hover: none) and (pointer: coarse)').matches;

// Sichtbare Spielfläche, bei gedrehter Seite vertauscht
export const viewW = () => device.rotated ? innerHeight : innerWidth;
export const viewH = () => device.rotated ? innerWidth : innerHeight;

// Bildschirmpunkt → Punkt in der (evtl. gedrehten) Seite
export const toView = (x: number, y: number) => device.rotated ? { x: y, y: innerWidth - x } : { x, y };

export function updateRotation() {
  device.rotated = device.mobile && innerHeight > innerWidth;
  document.documentElement.classList.toggle('rot', device.rotated);
}

// Vollbild und Querformat brauchen eine Nutzergeste. Wo die Sperre fehlt (iPhone, iframe), dreht updateRotation die Seite.
export function goFullscreen() {
  const el: any = document.documentElement;
  if (document.fullscreenElement || (document as any).webkitFullscreenElement) return;
  const req = el.requestFullscreen?.bind(el) || el.webkitRequestFullscreen?.bind(el);
  if (!req) return;
  Promise.resolve(req({ navigationUI: 'hide' }))
    .then(() => (screen.orientation as any)?.lock?.('landscape'))
    .catch(() => { /* ohne Erlaubnis bleibt es beim Fenster */ })
    .finally(updateRotation);
}
