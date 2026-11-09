// Objekt-System (map-umbau-2 Phase 3/4): Kern + alle Arten. main.ts ruft syncObjects (jeden Frame) und updateObjects (nur im Spiel).
import { syncObjects, updateObjects as updateAll } from './objects';
import './shrines';
import './chests';
import './barrels';
import { updateThief } from './thief';
import { updateThemeObjects } from './themeObjects';

export { syncObjects };
export function updateObjects(dt: number) {
  updateAll(dt);
  updateThief();
  updateThemeObjects();
}
