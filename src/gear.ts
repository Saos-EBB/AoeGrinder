// Übergang (ARCH-06): gear.ts ist nach src/gear/ geschnitten. Alte Importe './gear' gehen hierüber, bis die Aufrufer umgestellt sind.
export * from './gear/data';
export * from './gear/sets';
export { cleanGear } from './gear/rules';
export * from './gear/inventory';
export * from './gear/roll';
export * from './gear/shown';
export * from './gear/text';

