// Startbildschirm: Desktop oder Handy. Erst danach lädt das Spiel, damit Layout und Steuerung von Anfang an passen.

import { device, detectedMobile, goFullscreen, updateRotation } from './device';

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
document.getElementById('pickDesktop')!.addEventListener('click', () => pick(false));
document.getElementById('pickMobile')!.addEventListener('click', () => pick(true));
const auto = /[?&]mobile=([01])/.exec(location.search);   // ?mobile=1 oder 0 überspringt die Frage (Tests)
if (auto) pick(auto[1] === '1');
else document.getElementById(detectedMobile() ? 'pickMobile' : 'pickDesktop')!.classList.add('navSel');
