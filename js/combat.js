// =====================================================================
//  БОЙ (пошаговый)
//  Бой идёт, пока в комнате с героем есть монстр.
//  Каждое действие героя в бою = один ход. После него ходит монстр.
// =====================================================================

const MISS_CHANCE = 0.1; // 10% промахов — и у героя, и у монстра

function inCombat() {
  const room = currentRoom();
  return !!(room && room.monster);
}

function monsterLabel(monster) {
  const t = MONSTERS[monster.id];
  return `${t.emoji} ${t.name}`;
}

// Удар: зависит от уровня и оружия, броня монстра уменьшает урон
function playerAttack() {
  const p = game.player;
  const monster = currentRoom().monster;
  const t = MONSTERS[monster.id];

  if (chance(MISS_CHANCE)) {
    say(`Ты замахиваешься... и промахиваешься!`, "combat");
  } else {
    const damage = Math.max(1, rand(1, 4) + p.level + equipmentBonus("attack") - t.defense);
    monster.hp -= damage;
    say(`Ты бьёшь: ${monsterLabel(monster)} получает ${damage} урона.`, "combat");
  }
  afterPlayerTurn();
}

// Вызывается после каждого хода героя в бою
function afterPlayerTurn() {
  const room = currentRoom();
  const monster = room.monster;
  if (!monster) return;
  if (monster.hp <= 0) {
    defeatMonster(room);
  } else {
    monsterTurn(room);
  }
}

// Ход монстра: щит уменьшает урон
function monsterTurn(room) {
  const p = game.player;
  const monster = room.monster;
  const t = MONSTERS[monster.id];

  if (chance(MISS_CHANCE)) {
    say(`${monsterLabel(monster)} промахивается!`, "combat");
    return;
  }
  const damage = Math.max(1, rand(Math.ceil(t.attack / 2), t.attack) - equipmentBonus("defense"));
  p.hp -= damage;
  say(`${monsterLabel(monster)} бьёт тебя: −${damage} здоровья.`, "bad");
  if (p.hp <= 0) playerDies(room);
}

function defeatMonster(room) {
  const p = game.player;
  const t = MONSTERS[room.monster.id];
  say(`🏆 Победа! ${t.emoji} ${t.name} повержен(а).`, "good");
  room.monster = null;

  const gold = rand(t.gold[0], t.gold[1]);
  if (gold > 0) {
    p.gold += gold;
    say(`Ты находишь ${gold} 🪙 золота.`, "good");
  }
  if (t.loot && chance(t.loot.chance)) {
    room.items.push(t.loot.item);
    say(`На пол что-то упало: ${itemLabel(t.loot.item)}. (take — подобрать)`, "good");
  }
  gainXp(t.xp);
}

// Герой не умирает насовсем: он просыпается у входа и теряет половину золота
function playerDies(room) {
  const p = game.player;
  room.monster.hp = MONSTERS[room.monster.id].hp; // монстр восстанавливается
  const lost = Math.floor(p.gold / 2);
  p.gold -= lost;
  p.hp = maxHp();
  say(`💫 Ты теряешь сознание... и просыпаешься у входа. Потеряно ${lost} 🪙.`, "bad");
  moveTo(0, 0);
}

// Побег: 50% шанс вернуться туда, откуда пришёл
function tryFlee() {
  const p = game.player;
  const room = currentRoom();
  if (!chance(0.5)) {
    say("Ты пытаешься убежать, но не успеваешь!", "bad");
    monsterTurn(room);
    return;
  }

  let target = getRoom(p.lastX, p.lastY);
  if (!target || target === room) {
    const exits = exitsOf(room);
    if (exits.length === 0) {
      say("Бежать некуда!", "bad");
      monsterTurn(room);
      return;
    }
    target = neighbor(room, pick(exits));
  }
  say("Ты убегаешь!", "combat");
  moveTo(target.x, target.y);
}
