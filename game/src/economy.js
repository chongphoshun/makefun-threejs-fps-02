// Economy: the shop. One job: turn money into kit. It owns the price list, the
import { WEAPONS, WEAPON_ORDER, ARMOR_PRICE, HELMET_PRICE, KIT_PRICE } from './weapons.js';

export function createEconomy({ game, weapons, hud, audio }) {
  function priceOf(id) {
    if (id === 'armor') return ARMOR_PRICE;
    if (id === 'helmet') return HELMET_PRICE;
    if (id === 'kit') return KIT_PRICE;
    return WEAPONS[id].price;
  }

  function ownedOf(id) {
    if (id === 'armor') return weapons.state.armor > 0;
    if (id === 'helmet') return weapons.state.helmet;
    if (id === 'kit') return weapons.state.kit;
    if (WEAPONS[id].kind === 'grenade') return false;
    return weapons.state.owned.has(id);
  }

  function refreshBuyMenu() {
    for (const item of [...WEAPON_ORDER, 'armor', 'helmet', 'kit']) {
      hud.buyAfford(item, game.state.money, ownedOf(item));
    }
  }

  function tryBuy(id) {
    if (game.state.phase !== 'freeze') return;
    if (ownedOf(id)) return;
    if (id === 'armor' && weapons.state.armor >= 100) return;
    if (!game.spend(priceOf(id))) { audio.dry(); return; }
    if (id === 'armor') weapons.buyArmor();
    else if (id === 'helmet') weapons.buyHelmet();
    else if (id === 'kit') weapons.buyKit();
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
