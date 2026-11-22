// =====================================================================
//  ИГРОК: ХАРАКТЕРИСТИКИ, ОПЫТ, ИНВЕНТАРЬ, СНАРЯЖЕНИЕ
//  СИЛ (str) — урон мечом и здоровье
//  ИНТ (int) — сила заклинаний и мана
// =====================================================================

function newPlayer() {
  const p = {
    name: "Герой",
    emoji: "🤺",
    level: 1,
    xp: 0,
    statPoints: 0,
    str: 3,
    int: 2,
    gold: 5,
    x: 0, y: 0,         // где стоит игрок
    lastX: 0, lastY: 0, // откуда пришёл (туда убегаем из боя)
    inventory: ["health_potion"],
    equipment: { mainHand: "rusty_sword", offHand: null },
    spells: ["fireball", "heal"],
  };
  p.hp = maxHp(p);
  p.mp = maxMp(p);
  return p;
}

// Максимум здоровья и маны считается из уровня и характеристик
function maxHp(p = game.player) {
  return 10 + p.level * 5 + p.str * 2;
}

function maxMp(p = game.player) {
  return p.int * 3 + p.level * 2;
}

function xpToNextLevel(p = game.player) {
  return p.level * 10;
}

// Сумма бонуса (attack, defense или magic) от всего, что в руках
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
    p.statPoints += 2;
    p.hp = maxHp();
    p.mp = maxMp();
    say(`🎉 НОВЫЙ УРОВЕНЬ ${p.level}! Здоровье и мана восстановлены.`, "good");
    say(`У тебя ${p.statPoints} очк. характеристик. Набери: train str или train int`, "good");
  }
}

// Ищет предмет в списке id по запросу: "sword", "меч", "iron_sword"...
// Возвращает позицию в списке или -1.
function findItem(list, query) {
  query = query.toLowerCase().trim();
  if (!query) return -1;
  return list.findIndex((id) => {
    const item = ITEMS[id];
    return id === query ||
      item.keyword === query ||
      item.name.toLowerCase().includes(query);
  });
}

function itemLabel(id) {
  return `${ITEMS[id].emoji} ${ITEMS[id].name}`;
}

// Какую команду писать для предмета: "sword", "potion"...
function itemWord(id) {
  return ITEMS[id].keyword || id;
}

function equip(query) {
  const p = game.player;
  const index = findItem(p.inventory, query);
  if (index === -1) return say("У тебя нет такого предмета.", "bad");
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
      return true;
    }
  }
  say("У тебя в руках нет такого предмета.", "bad");
  return false;
}

// Выпить зелье. Возвращает true, если получилось.
function useItem(query) {
  const p = game.player;
  const index = findItem(p.inventory, query);
  if (index === -1) { say("У тебя нет такого предмета.", "bad"); return false; }
  const id = p.inventory[index];
  const item = ITEMS[id];
  if (!item.heal && !item.mana) {
    say(`${itemLabel(id)} нельзя использовать. Может, его надо взять в руку (equip)?`, "bad");
    return false;
  }
  const healUseless = !item.heal || p.hp >= maxHp();
  const manaUseless = !item.mana || p.mp >= maxMp();
  if (healUseless && manaUseless) {
    say("Сейчас это зелье тебе не нужно — побереги его.", "bad");
    return false;
  }
  p.inventory.splice(index, 1);
  if (item.heal) {
    const before = p.hp;
    p.hp = Math.min(maxHp(), p.hp + item.heal);
    say(`Ты выпиваешь: ${itemLabel(id)}. +${p.hp - before} здоровья.`, "good");
  }
  if (item.mana) {
    const before = p.mp;
    p.mp = Math.min(maxMp(), p.mp + item.mana);
    say(`Ты выпиваешь: ${itemLabel(id)}. +${p.mp - before} маны.`, "good");
  }
  return true;
}

// Ищет заклинание по запросу: "fireball", "fire", "огонь"...
function findSpell(query) {
  query = query.toLowerCase().trim();
  if (!query) return null;
  return game.player.spells.find((id) =>
    id.startsWith(query) || SPELLS[id].name.toLowerCase().includes(query)
  ) || null;
}
