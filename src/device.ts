// Handy oder Tablet erkennen. ?mobile=1 erzwingt das Layout zum Testen am Desktop. Eigenes Modul ohne Imports, damit es nirgends zirkulär wird.
export const isMobile = /[?&]mobile=1/.test(location.search) ||
  matchMedia('(hover: none) and (pointer: coarse)').matches;
