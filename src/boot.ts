// Startbildschirm: Desktop oder Handy. Erst danach lädt das Spiel, damit Layout und Steuerung von Anfang an passen.

import { device, detectedMobile, goFullscreen, updateRotation } from './device';
import { translateDom, t } from './i18n';

translateDom();   // statisches HTML in index.html, vor allem anderen

const box = document.getElementById('deviceModal')!;
const pick = async (mobile: boolean) => {
  device.mobile = mobile;
  box.remove();
  if (mobile) {
    document.body.classList.add('mobile');
    addEventListener('resize', updateRotation);     // vor dem Resize in render.ts registriert, damit der die neue Lage liest
    updateRotation();
    goFullscreen();
  }
  await import('./main');
};
// Handy ist abgekoppelt, bis Desktop fertig ist: Knopf sichtbar, aber aus (index.html). Der Handy-Code bleibt, erreichbar nur über ?mobile=1 (Dev/Tests).
// Auf einem Touch-Gerät statt der Frage ein Hinweis, kein Start. Eine gespeicherte Handy-Wahl gibt es nicht, Desktop startet immer als Desktop.
document.getElementById('pickDesktop')!.addEventListener('click', () => pick(false));
const auto = /[?&]mobile=([01])/.exec(location.search);   // ?mobile=1 oder 0 überspringt die Frage (Tests, Dev-Weg zum Handy-Modus)
if (auto) pick(auto[1] === '1');
else if (detectedMobile()) {
  box.querySelector('.row2')!.remove();
  box.querySelector('p')!.replaceWith(...[t('device.wip'), t('device.usePc')].map(text => Object.assign(document.createElement('p'), { className: 'wipNote', textContent: text })));
} else document.getElementById('pickDesktop')!.classList.add('navSel');
