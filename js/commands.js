// =====================================================================
//  КОМАНДЫ ПРИКЛЮЧЕНИЯ
//  Команды пишутся по-английски, как в настоящих MUD-ах 90-х.
//  Каждая команда — запись в списке COMMANDS:
//    name    — главное слово команды
//    aliases — другие слова, которые делают то же самое
//    usage   — как писать команду (для help)
//    help    — что команда делает (по-русски)
//    suggest — функция: какие варианты команды подходят прямо сейчас.
//              Они показываются в подсказке «Что можно сделать».
//              Пустой список = сейчас команда не нужна.
//    run     — функция, которая выполняет команду (args — слова после команды)
//  Чтобы добавить команду — скопируй похожую и поменяй!
// =====================================================================

// ----- Общие действия ---------------------------------------------------

// Перейти в комнату (x, y) и осмотреться
function moveTo(x, y) {
  const p = game.player;
  p.lastX = p.x;
  p.lastY = p.y;
  p.x = x;
  p.y = y;
  describeRoom();
}

// Рассказать, что видно в текущей комнате
function describeRoom() {
  const room = currentRoom();
  say(`== ${room.name} ==`, "title");
  say(room.description);

  if (room.monster) {
    const t = MONSTERS[room.monster.id];
    say(`⚔️ Здесь враг: ${monsterLabel(room.monster)} (здоровье ${room.monster.hp}/${t.hp}). Он не даёт пройти!`, "bad");
  }
  if (room.npc) {
    const n = NPCS[room.npc.id];
    say(`Здесь есть друг: ${n.emoji} ${n.name}.`, "friend");
  }
  if (room.items.length > 0) {
    say(`На полу лежит: ${room.items.map(itemLabel).join(", ")}.`, "loot");
  }
  if (room.gold > 0) {
    say(`На полу блестит ${room.gold} 🪙 золота.`, "loot");
  }

  const exits = exitsOf(room);
  if (exits.length > 0) {
    say("Выходы: " + exits.map((d) => `${d} (${DIRECTIONS[d].ru})`).join(", "), "exits");
  } else {
    say("Выходов нет.", "exits");
  }
}

// Английское слово для предмета в подсказках: "iron sword", "potion"
function itemWord(id) {
  return ITEMS[id].keyword;
}

// Убирает повторы из списка
function unique(list) {
  return [...new Set(list)];
}

// ----- Список команд ----------------------------------------------------

const COMMANDS = [
  // ---------- Бой ----------
  {
    name: "attack", aliases: ["a", "kill", "hit"],
    usage: "attack",
    help: "ударить врага",
    suggest: () => (inCombat() ? ["attack"] : []),
    run() {
      if (!inCombat()) return say("Здесь некого атаковать.", "bad");
      playerAttack();
    },
  },
  {
    name: "flee", aliases: ["run"],
    usage: "flee",
    help: "попробовать убежать из боя (50% шанс)",
    suggest: () => (inCombat() ? ["flee"] : []),
    run() {
      if (!inCombat()) return say("Тебе не от кого убегать.", "bad");
      tryFlee();
    },
  },

  // ---------- Передвижение ----------
  {
    name: "go", aliases: ["walk", "move"],
    usage: "go <направление>  или просто n, s, e, w",
    help: "пойти в соседнюю комнату",
    suggest: () => (inCombat() ? [] : exitsOf(currentRoom()).map((d) => `${DIRECTIONS[d].short} (${DIRECTIONS[d].ru})`)),
    run(args) {
      const dir = parseDirection(args[0]);
      if (!dir) return say("Куда? Например: go north (или просто n)", "bad");
      if (inCombat()) return say("Враг не даёт пройти! Сражайся (attack) или беги (flee).", "bad");
      const next = neighbor(currentRoom(), dir);
      if (!next) return say(`На ${DIRECTIONS[dir].ru} хода нет.`, "bad");
      moveTo(next.x, next.y);
    },
  },
  {
    name: "look", aliases: ["l"],
    usage: "look",
    help: "осмотреться",
    suggest: () => ["look"],
    run() { describeRoom(); },
  },

  // ---------- Друзья и предметы ----------
  {
    name: "talk", aliases: ["say", "chat"],
    usage: "talk",
    help: "поговорить с другом",
    suggest: () => (currentRoom().npc && !inCombat() ? ["talk"] : []),
    run() {
      const room = currentRoom();
      if (!room.npc) return say("Здесь не с кем поговорить.", "bad");
      if (inCombat()) return say("Сейчас не до разговоров!", "bad");
      const npc = room.npc;
      const t = NPCS[npc.id];
      say(`${t.emoji} ${t.name}: «${t.lines[npc.talks % t.lines.length]}»`, "friend");
      npc.talks += 1;

      if (t.gift && !npc.giftGiven) {
        npc.giftGiven = true;
        game.player.inventory.push(t.gift);
        say(`Ты получаешь: ${itemLabel(t.gift)}!`, "good");
      }
      if (t.service === "heal") {
        game.player.hp = maxHp();
        say("✨ Здоровье полностью восстановлено.", "good");
      }
    },
  },
  {
    name: "take", aliases: ["get", "pick"],
    usage: "take",
    help: "подобрать всё с пола",
    suggest: () => {
      const room = currentRoom();
      return !inCombat() && (room.items.length > 0 || room.gold > 0) ? ["take"] : [];
    },
    run() {
      const room = currentRoom();
      if (inCombat()) return say("Сначала разберись с врагом!", "bad");
      if (room.items.length === 0 && room.gold === 0) return say("Тут нечего брать.", "bad");
      for (const id of room.items) {
        game.player.inventory.push(id);
        say(`Ты подбираешь: ${itemLabel(id)}.`, "good");
      }
      room.items = [];
      if (room.gold > 0) {
        game.player.gold += room.gold;
        say(`Ты подбираешь ${room.gold} 🪙 золота.`, "good");
        room.gold = 0;
      }
    },
  },
  {
    name: "use", aliases: ["drink", "quaff"],
    usage: "use <предмет>",
    help: "выпить зелье (в бою это тратит ход)",
    suggest: () => unique(game.player.inventory
      .filter((id) => ITEMS[id].heal && game.player.hp < maxHp())
      .map((id) => "use " + itemWord(id))),
    run(args) {
      if (useItem(args.join(" ")) && inCombat()) afterPlayerTurn();
    },
  },
  {
    name: "equip", aliases: ["wield", "wear"],
    usage: "equip <предмет>",
    help: "взять в руку меч или щит",
    suggest: () => (inCombat() ? [] : unique(game.player.inventory
      .filter((id) => ITEMS[id].slot)
      .map((id) => "equip " + itemWord(id)))),
    run(args) {
      if (inCombat()) return say("В бою некогда переодеваться!", "bad");
      equip(args.join(" "));
    },
  },
  {
    name: "remove", aliases: ["unequip", "unwield"],
    usage: "remove <предмет>",
    help: "убрать предмет из руки в сумку",
    suggest: () => [],
    run(args) {
      if (inCombat()) return say("В бою некогда переодеваться!", "bad");
      unequip(args.join(" "));
    },
  },
  {
    name: "drop", aliases: [],
    usage: "drop <предмет>",
    help: "бросить предмет на пол",
    suggest: () => [],
    run(args) {
      const p = game.player;
      const index = findItem(p.inventory, args.join(" "));
      if (index === -1) return say("У тебя в сумке нет такого предмета.", "bad");
      const [id] = p.inventory.splice(index, 1);
      currentRoom().items.push(id);
      say(`Ты бросаешь на пол: ${itemLabel(id)}.`);
    },
  },
  {
    name: "inventory", aliases: ["i", "inv"],
    usage: "inventory  или  i",
    help: "посмотреть, что в сумке и в руках",
    suggest: () => [],
    run() {
      const p = game.player;
      for (const [slot, label] of Object.entries(SLOTS)) {
        const id = p.equipment[slot];
        say(`${label}: ${id ? `${itemLabel(id)} [${itemWord(id)}]` : "пусто"}`);
      }
      if (p.inventory.length === 0) return say("Сумка пуста.");
      say("В сумке:");
      for (const id of p.inventory) say(`  ${itemLabel(id)} [${itemWord(id)}]`);
    },
  },

  // ---------- Разное ----------
  {
    name: "help", aliases: ["?", "commands"],
    usage: "help",
    help: "показать все команды",
    suggest: () => ["help"],
    run() {
      say("Все команды:", "title");
      for (const c of COMMANDS) {
        say(`  ${c.usage} — ${c.help}`, "system");
      }
      say("Направления: north (n) — север, south (s) — юг, east (e) — восток, west (w) — запад.", "system");
    },
  },
  {
    name: "reset", aliases: [],
    usage: "reset",
    help: "начать игру заново (всё подземелье пропадёт!)",
    suggest: () => [],
    run() {
      if (!confirm("Точно начать заново? Всё подземелье пропадёт!")) return;
      newGame();
      clearLog();
      say("Новая игра началась!", "title");
      describeRoom();
    },
  },
];

// Найти команду по слову (по имени или по другому слову)
function findCommand(word) {
  return COMMANDS.find((c) => c.name === word || c.aliases.includes(word)) || null;
}

// Главная функция: выполнить строку, которую ввёл игрок
function runCommand(text) {
  text = text.trim();
  if (!text) return;
  say("> " + text, "echo");

  let [word, ...args] = text.split(/\s+/);
  word = word.toLowerCase();

  // Просто направление ("n", "north") — значит "go n"
  if (parseDirection(word)) {
    args = [word];
    word = "go";
  }

  const command = findCommand(word);
  if (command) {
    command.run(args);
  } else {
    say("Не понимаю такую команду. Набери help, чтобы увидеть все команды.", "bad");
  }

  saveGame();
  renderAll();
}
