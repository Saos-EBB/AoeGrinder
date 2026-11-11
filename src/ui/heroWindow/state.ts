// Gemeinsamer Zustand des Charakterfensters (E10, aus heroWindow.ts): aktiver Tab, Auswahl, Rückruf beim Schließen, NEU-Grenzen, Filterleiste, Shift.
import { $ } from '../../util';
import { heroModel } from '../../models/heroModel';
import { isMageFigure } from '../../gear/inventory';
import type { Slot } from '../../gear/data';
import { uiSettings } from '../uiSettings';

export type Tab = 'waffen' | Slot | 'kosmetik';
export type Kind = 'w' | 'g' | 'k';
export const hw = {
  onClose: null as (() => void) | null,
  tab: ((uiSettings.heroTab as Tab) || 'waffen') as Tab,
  seenW: 0, seenG: 0,
  sel: null as string | null,   // gewählter Eintrag im aktiven Tab (Tastatur/Pad, Klick)
  barKind: null as Kind | null,
  shift: false,
};
export const heroOpen = () => $('heroModal').classList.contains('show');
export const inRun = () => !$('startModal').classList.contains('show');
export const viewOnly = inRun;
export const mageGear = () => isMageFigure(heroModel.figureId);
