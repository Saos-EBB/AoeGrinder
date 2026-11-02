// Nächstes Ziel für Zielzauber
import { player } from '../state';
import { dist2d } from '../util';
import { mobsInRadius } from './core';

export const nearestTarget = range => mobsInRadius(player.pos, range, Infinity).sort((a, b) => dist2d(a.pos, player.pos) - dist2d(b.pos, player.pos))[0];
