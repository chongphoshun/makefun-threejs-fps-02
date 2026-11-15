// Economy: the shop. One job: turn money into kit. It owns the price list, the
// freeze-time buy, and the kill reward — the match itself (rounds, payouts, the
// wallet number) still lives in game.js; this is only the spending side of it.
import { WEAPONS, WEAPON_ORDER, ARMOR_PRICE, HELMET_PRICE } from './weapons.js';

export function createEconomy({ game, weapons, hud, audio }) {
  function priceOf(id) {
    if (id === 'armor') return ARMOR_PRICE;
    if (id === 'helmet') return HELMET_PRICE;
    return WEAPONS[id].price;
  }

  function refreshBuyMenu() {
    for (const item of [...WEAPON_ORDER, 'armor', 'helmet']) hud.buyAfford(item, game.state.money);
  }

  // A buy only lands during the freeze; a failed spend clicks dry, a good one clicks
  // and refreshes the money, the ammo readout and every item's afford state.
  function tryBuy(id) {
    if (game.state.phase !== 'freeze') return;
    if (!game.spend(priceOf(id))) { audio.dry(); return; }
    if (id === 'armor') weapons.buyArmor();
    else if (id === 'helmet') weapons.buyHelmet();
    else weapons.buy(id);
    audio.click();
    hud.setMoney(game.state.money);
    hud.setAmmo(weapons.ammo[weapons.state.current].mag, weapons.ammo[weapons.state.current].reserve, WEAPONS[weapons.state.current].name.toUpperCase());
    refreshBuyMenu();
  }

  function killReward() {
    game.addKillMoney();
    hud.setMoney(game.state.money);
  }

  return { priceOf, tryBuy, killReward, refreshBuyMenu, balance: () => game.state.money };
}
