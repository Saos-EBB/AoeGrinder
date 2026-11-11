// Schaden, Mana und Regeneration des Spielers (ARCH-06, aus player.ts).
import { state, player } from '../state';
import { CFG, SPELLS, mods } from '../config';
import { maxHp, maxMana, manaRegenPerTick } from '../formulas';
import { combatText, hurtNumber } from '../feedback';
import { stopChannel, stopDrink } from '../spells';
import { rumble } from '../gamepad';
import { modValue } from '../modifiers';
import { iceBlocked } from '../spells/iceblock';
import { dodgeIframes, perfectDodge } from '../dodge';
import { W, addTrauma } from '../wucht';
import { hitstop } from '../fx/impact';
import { warriorRevive, rageOnHit, takenMul, warriorUntouchable, warriorUndying } from '../realMen';
import { phoenixRevive } from '../spells/phoenix';
import { eggRevive } from '../legends';
import { buffRegenMul } from '../buffs';
import { t } from '../i18n';
import { emit } from '../hooks';
import { die } from '../run';

export function damagePlayer(amount, dot = false, source = '') {
  if (player.dead || warriorUntouchable() || iceBlocked() || player.invulnUntil > state.now) return;   // invulnUntil: Phönix
  if (!dot && dodgeIframes()) { perfectDodge(); return; }   // Dodge: Angriffe und Geschosse gehen durch (perfekt), Gift und Lava nicht
  amount = Math.max(1, Math.round(amount * takenMul()));
  if (player.shield > 0 && player.shieldUntil > state.now) {   // Eisbarriere (spells/icebarrier.ts)
    const a = Math.min(player.shield, amount);
    player.shield -= a; amount -= a;
    if (player.shield <= 0) player.onShieldBreak?.();
    if (amount <= 0) { combatText(player.pos, t('msg.absorbed'), 'miss', 2.6); return; }
  }
  player.hp -= amount;
  emit('hit');   // Figur: Leben verloren (figEvents.ts)
  hurtNumber(player.pos, amount);   // Anzeige im Zahlen-Stil (ui/dmgNumbers.ts)
  if (player.hp < 1 && warriorUndying()) player.hp = 1;   // Letzter Atem
  // Todesursache: hitPlayer setzt attackAt direkt vor dem Schaden
  player.lastHitBy = source || (dot ? t('fx.poison') : state.mobs.find(m => m.attackAt === state.now)?.type.name ?? t('cause.lava'));
  player.lastCombat = state.now;
  combatText(player.pos, amount, 'hurt', 2.6);
  addTrauma(amount / maxHp() * W.shake.hurtK);   // Wucht: eigener Schaden wackelt
  if (amount >= maxHp() * W.hitstop.hurtPct) hitstop(W.hitstop.hurtMs);
  if (amount > maxHp() * 0.05) rumble(0.7, 0.4, 180);   // PH: Rumble-Werte
  if (!dot) rageOnHit();
  if (!dot) {                            // Gift-Ticks brechen weder Trinken noch Channel
    if (player.drink && !player.drink.keepOnHit) stopDrink();
    pushbackChannel();
  }
  if (player.hp <= 0 && !phoenixRevive() && !eggRevive() && !warriorRevive()) die();   // Phönix zuerst, dann Murky-Ei (legends.ts), dann Ruhm im Tod (Sions Axt)
}

// Channel-Pushback: 1000, 800, 600, 400, 200, 200 ... ms (Spell::DelayedChannel)
function pushbackChannel() {
  const ch = player.channel;
  if (!ch) return;
  const delay = ch.delays < 5 ? 1000 - ch.delays * 200 : 200;
  ch.delays++;
  ch.end -= delay;
  if (ch.end <= state.now) stopChannel();
}

export function spendMana(cost) {
  if (cost <= 0) return;
  player.mana -= cost;
  player.lastManaUse = state.now;              // startet die 5-Sekunden-Regel
}

export function regenerate(dt) {
  if (state.now >= player.nextRegen) {         // Tick alle 2 s
    player.nextRegen += CFG.regenTick;
    let mana = manaRegenPerTick();
    if (state.now - player.lastManaUse < CFG.fiveSecRule) mana *= mods.castRegen;
    mana *= buffRegenMul();   // Schrein des Manas (objects/shrines.ts)
    if (!player.rageMax) player.mana = Math.min(maxMana(), player.mana + mana);   // Wut regeneriert nicht
    if (state.now - player.lastCombat > CFG.hpRegenCalm && !modValue('lifeCost')) player.hp = Math.min(maxHp(), player.hp + maxHp() * CFG.hpRegen);  // CFG.hpRegen (auch heroStats.ts); Blutmagier heilt nur über Infekt, Saugen, Lachen
  }
  if (player.drink?.custom) {            // Getränk des ?-Magiers: wirkt erst, wenn er sitzen bleibt (random.ts)
    if (state.now >= player.drink.end) { const done = player.drink.onDone; stopDrink(); done(); }
  } else if (player.drink) {             // PH: 90 % Mana + 50 % HP über 18 s
    player.mana = Math.min(maxMana(), player.mana + maxMana() * 0.9 * dt / SPELLS.drink.dur);
    player.hp = Math.min(maxHp(), player.hp + maxHp() * (player.drink.hp ?? 0.5) * dt / (player.drink.dur ?? SPELLS.drink.dur));   // Essen: eigene Werte
    const full = player.mana >= maxMana() && player.hp >= maxHp();
    if (state.now >= player.drink.end || full) stopDrink();
  }
}
