import { player } from '../state';
import { heightAt, collide } from '../world';
import { blinkFx } from '../fx/spellFx';

export const blink = {
  name: 'Blink', cls: 'arcane', desc: '20 yd vorwärts, löst Betäubung.', ranks: ['mana'], tags: ['Arkan', 'Bewegung'],
  mana: 80, cd: 15000, dist: 20,   // Mana PH
  effect() {
    const from = player.pos.clone();
    player.pos.x += Math.sin(player.facing) * blink.dist;
    player.pos.z += Math.cos(player.facing) * blink.dist;
    collide(player.pos, 0.45);
    player.pos.y = heightAt(player.pos.x, player.pos.z);
    player.grounded = true;
    player.vel.set(0, 0, 0);
    blinkFx(from, player.pos);
  },
};
