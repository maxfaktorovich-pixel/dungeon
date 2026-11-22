// =====================================================================
//  ГЕРОЙ: ЗДОРОВЬЕ, ОПЫТ, СУМКА, СНАРЯЖЕНИЕ
// =====================================================================

function newPlayer() {
  const p = {
    name: "Герой",
    emoji: "🤺",
    level: 1,
    xp: 0,
    gold: 5,
    x: 0, y: 0,         // где стоит герой
    lastX: 0, lastY: 0, // откуда пришёл (туда убегаем из боя)
    inventory: ["health_potion"],
    equipment: { mainHand: "rusty_sword", offHand: null },
  };
  p.hp = maxHp(p);
  return p;
}

// Максимум здоровья растёт с уровнем
function maxHp(p = game.player) {
  return 15 + p.level * 5;
}

function xpToNextLevel(p = game.player) {
  return p.level * 10;
}

// Сумма бонуса (attack или defense) от всего, что в руках
function equipmentBonus(stat) {
  let total = 0;
  for (const id of Object.values(game.player.equipment)) {
    if (id && ITEMS[id][stat]) total += ITEMS[id][stat];
  }
  return total;
}

function gainXp(amount) {
  const p = game.player;
  p.xp += amount;
  say(`+${amount} опыта.`, "good");
  while (p.xp >= xpToNextLevel()) {
    p.xp -= xpToNextLevel();
    p.level += 1;
    p.hp = maxHp();
    say(`🎉 НОВЫЙ УРОВЕНЬ ${p.level}! Здоровья стало больше, удар — сильнее.`, "good");
  }
}

// Ищет предмет в списке id по запросу: "sword", "iron sword", "меч"...
// Возвращает позицию в списке или -1.
function findItem(list, query) {
  query = query.toLowerCase().trim();
  if (!query) return -1;
  return list.findIndex((id) => {
    const item = ITEMS[id];
    return id === query ||
      item.keyword === query ||
      item.keyword.split(" ").includes(query) ||
      item.name.toLowerCase().includes(query);
  });
}

function itemLabel(id) {
  return `${ITEMS[id].emoji} ${ITEMS[id].name}`;
}

function equip(query) {
  const p = game.player;
  const index = findItem(p.inventory, query);
  if (index === -1) return say("У тебя в сумке нет такого предмета.", "bad");
  const id = p.inventory[index];
  const slot = ITEMS[id].slot;
  if (!slot) return say(`${itemLabel(id)} нельзя взять в руку.`, "bad");

  p.inventory.splice(index, 1);
  const old = p.equipment[slot];
  if (old) {
    p.inventory.push(old);
    say(`Ты убираешь в сумку: ${itemLabel(old)}.`);
  }
  p.equipment[slot] = id;
  say(`Теперь в руке (${SLOTS[slot].toLowerCase()}): ${itemLabel(id)}.`, "good");
}

function unequip(query) {
  const p = game.player;
  for (const slot of Object.keys(p.equipment)) {
    const id = p.equipment[slot];
    if (id && findItem([id], query) === 0) {
      p.equipment[slot] = null;
      p.inventory.push(id);
      say(`Ты убираешь в сумку: ${itemLabel(id)}.`);
      return;
    }
  }
  say("У тебя в руках нет такого предмета.", "bad");
}

// Выпить зелье. Возвращает true, если получилось.
function useItem(query) {
  const p = game.player;
  const index = findItem(p.inventory, query);
  if (index === -1) { say("У тебя в сумке нет такого предмета.", "bad"); return false; }
  const id = p.inventory[index];
  const item = ITEMS[id];
  if (!item.heal) {
    say(`${itemLabel(id)} нельзя выпить. Может, его надо взять в руку (equip)?`, "bad");
    return false;
  }
  if (p.hp >= maxHp()) {
    say("Ты и так полностью здоров(а) — побереги зелье.", "bad");
    return false;
  }
  p.inventory.splice(index, 1);
  const before = p.hp;
  p.hp = Math.min(maxHp(), p.hp + item.heal);
  say(`Ты выпиваешь: ${itemLabel(id)}. +${p.hp - before} здоровья.`, "good");
  return true;
}
