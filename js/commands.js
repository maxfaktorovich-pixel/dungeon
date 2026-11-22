// =====================================================================
//  КОМАНДЫ
//  Команды пишутся по-английски, как в настоящих MUD-ах 90-х.
//  Каждая команда — запись в списке COMMANDS:
//    name    — главное слово команды
//    aliases — другие слова, которые делают то же самое
//    usage   — как писать команду (для подсказки)
//    help    — что команда делает (по-русски)
//    suggest — функция: какие готовые варианты команды показать
//              в окне «Что можно сделать». Пустой список = не показывать.
//              Если вариант кончается пробелом ("name "), кнопка не
//              выполняет команду, а вставляет её в строку ввода.
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
    say(`Здесь есть друг: ${n.emoji} ${n.name}. (talk — поговорить)`, "friend");
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
    say("Выходов нет. Построй новую комнату: build north", "exits");
  }
}

// Названия видов комнат для строительства
const ROOM_KINDS = {
  room: "пустая комната",
  monster: "комната с монстром",
  friend: "комната с другом",
  treasure: "сокровищница",
};

// Построить комнату в любой клетке рядом с подземельем
function buildAt(x, y, kind) {
  if (getRoom(x, y)) return say("Здесь уже есть комната.", "bad");
  if (!isBuildable(x, y)) return say("Строить можно только рядом с другими комнатами.", "bad");
  const room = createRoom(x, y, kind);
  say(`🧱 Построено: ${ROOM_KINDS[kind]} «${room.name}».`, "build");
}

// Добавить монстра/друга/сокровище в уже построенную комнату
function addToRoom(room, kind) {
  if (kind === "monster" && room.monster) return say("Здесь уже есть монстр.", "bad");
  fillRoom(room, kind);
  if (kind === "monster") say(`👹 В комнату «${room.name}» пришёл монстр: ${monsterLabel(room.monster)}.`, "build");
  if (kind === "friend") say(`🙂 В комнате «${room.name}» теперь живёт: ${NPCS[room.npc.id].emoji} ${NPCS[room.npc.id].name}.`, "build");
  if (kind === "treasure") say(`💰 В комнате «${room.name}» появились сокровища.`, "build");
}

function destroyAt(x, y) {
  const reason = whyCantDelete(x, y);
  if (reason) return say(reason, "bad");
  const name = getRoom(x, y).name;
  deleteRoom(x, y);
  say(`💥 Комната «${name}» снесена.`, "build");
}

// Подсказка: какие свободные направления есть для строительства
function freeDirections() {
  const room = currentRoom();
  return Object.keys(DIRECTIONS).filter((dir) => !neighbor(room, dir));
}

// ----- Список команд ----------------------------------------------------

const COMMANDS = [
  // ---------- Бой ----------
  {
    name: "attack", aliases: ["a", "kill", "hit"],
    usage: "attack",
    help: "Ударить врага оружием (зависит от СИЛ).",
    suggest: () => (inCombat() ? ["attack"] : []),
    run() {
      if (!inCombat()) return say("Здесь некого атаковать.", "bad");
      playerAttack();
    },
  },
  {
    name: "cast", aliases: ["c"],
    usage: "cast <заклинание>",
    help: "Сотворить заклинание (зависит от ИНТ, тратит ману).",
    suggest: () => game.player.spells
      .filter((id) => SPELLS[id].kind === "heal" || inCombat())
      .filter((id) => game.player.mp >= SPELLS[id].cost)
      .map((id) => "cast " + id),
    run(args) {
      const query = args.join(" ");
      if (!query) return say("Какое заклинание? Например: cast fireball", "bad");
      const spellId = findSpell(query);
      if (!spellId) return say("Ты не знаешь такого заклинания.", "bad");
      castSpell(spellId);
    },
  },
  {
    name: "flee", aliases: ["run"],
    usage: "flee",
    help: "Попробовать убежать из боя (50% шанс).",
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
    help: "Пойти в соседнюю комнату.",
    suggest: () => (inCombat() ? [] : exitsOf(currentRoom()).map((d) => DIRECTIONS[d].short)),
    run(args) {
      const dir = parseDirection(args[0]);
      if (!dir) return say("Куда? Например: go north (или просто n)", "bad");
      if (inCombat()) return say("Враг не даёт пройти! Сражайся (attack) или беги (flee).", "bad");
      const next = neighbor(currentRoom(), dir);
      if (!next) return say(`На ${DIRECTIONS[dir].ru} хода нет. Можно построить: build ${dir}`, "bad");
      moveTo(next.x, next.y);
    },
  },
  {
    name: "look", aliases: ["l"],
    usage: "look",
    help: "Осмотреться в комнате.",
    suggest: () => ["look"],
    run() { describeRoom(); },
  },

  // ---------- Друзья и предметы ----------
  {
    name: "talk", aliases: ["say", "chat"],
    usage: "talk",
    help: "Поговорить с другом в комнате.",
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
        game.player.mp = maxMp();
        say("✨ Здоровье и мана полностью восстановлены.", "good");
      }
    },
  },
  {
    name: "take", aliases: ["get", "pick"],
    usage: "take",
    help: "Подобрать всё, что лежит на полу.",
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
    help: "Выпить зелье. В бою это тратит ход.",
    suggest: () => {
      const words = game.player.inventory
        .filter((id) => ITEMS[id].heal || ITEMS[id].mana)
        .map((id) => "use " + itemWord(id));
      return [...new Set(words)]; // без повторов
    },
    run(args) {
      if (useItem(args.join(" ")) && inCombat()) afterPlayerTurn();
    },
  },
  {
    name: "equip", aliases: ["wield", "wear"],
    usage: "equip <предмет>",
    help: "Взять в руку меч, посох или щит.",
    suggest: () => (inCombat() ? [] : game.player.inventory
      .filter((id) => ITEMS[id].slot)
      .map((id) => "equip " + ITEMS[id].name.toLowerCase())),
    run(args) {
      if (inCombat()) return say("В бою некогда переодеваться!", "bad");
      equip(args.join(" "));
    },
  },
  {
    name: "remove", aliases: ["unequip", "unwield"],
    usage: "remove <предмет>",
    help: "Убрать предмет из руки в сумку.",
    suggest: () => [],
    run(args) {
      if (inCombat()) return say("В бою некогда переодеваться!", "bad");
      unequip(args.join(" "));
    },
  },
  {
    name: "drop", aliases: [],
    usage: "drop <предмет>",
    help: "Бросить предмет на пол.",
    suggest: () => [],
    run(args) {
      const p = game.player;
      const index = findItem(p.inventory, args.join(" "));
      if (index === -1) return say("У тебя нет такого предмета.", "bad");
      const [id] = p.inventory.splice(index, 1);
      currentRoom().items.push(id);
      say(`Ты бросаешь на пол: ${itemLabel(id)}.`);
    },
  },
  {
    name: "train", aliases: [],
    usage: "train str  или  train int",
    help: "Потратить очко характеристик на СИЛ или ИНТ.",
    suggest: () => (game.player.statPoints > 0 ? ["train str", "train int"] : []),
    run(args) {
      const p = game.player;
      const stat = (args[0] || "").toLowerCase();
      if (p.statPoints <= 0) return say("Нет свободных очков. Получи новый уровень!", "bad");
      if (stat !== "str" && stat !== "int") return say("Что тренировать? train str или train int", "bad");
      p[stat] += 1;
      p.statPoints -= 1;
      say(`${stat === "str" ? "💪 СИЛ" : "🧠 ИНТ"} теперь ${p[stat]}.`, "good");
    },
  },

  // ---------- Строительство ----------
  {
    name: "build", aliases: ["dig"],
    usage: "build <направление> [room|monster|friend|treasure]",
    help: "Построить новую комнату рядом.",
    suggest: () => (inCombat() ? [] : freeDirections().map((d) => "build " + d)),
    run(args) {
      const dir = parseDirection(args[0]);
      if (!dir) return say("В какую сторону? Например: build north monster", "bad");
      const kind = (args[1] || "room").toLowerCase();
      if (!ROOM_KINDS[kind]) return say("Можно строить: room, monster, friend, treasure", "bad");
      const room = currentRoom();
      const d = DIRECTIONS[dir];
      buildAt(room.x + d.dx, room.y + d.dy, kind);
    },
  },
  {
    name: "destroy", aliases: ["wreck"],
    usage: "destroy <направление>",
    help: "Снести соседнюю комнату.",
    suggest: () => [],
    run(args) {
      const dir = parseDirection(args[0]);
      if (!dir) return say("В какую сторону? Например: destroy east", "bad");
      const room = currentRoom();
      const d = DIRECTIONS[dir];
      destroyAt(room.x + d.dx, room.y + d.dy);
    },
  },
  {
    name: "name", aliases: ["rename"],
    usage: "name <название>",
    help: "Придумать название комнате, где ты стоишь.",
    suggest: () => (inCombat() ? [] : ["name "]),
    run(args) {
      const text = args.join(" ").trim();
      if (!text) return say("Напиши название: name Логово дракона", "bad");
      currentRoom().name = text;
      say(`Теперь эта комната называется «${text}».`, "build");
    },
  },
  {
    name: "describe", aliases: ["desc"],
    usage: "describe <описание>",
    help: "Придумать описание комнате, где ты стоишь.",
    suggest: () => (inCombat() ? [] : ["describe "]),
    run(args) {
      const text = args.join(" ").trim();
      if (!text) return say("Напиши описание: describe Тут очень страшно.", "bad");
      currentRoom().description = text;
      say("Описание комнаты изменено.", "build");
    },
  },

  // ---------- Разное ----------
  {
    name: "help", aliases: ["?", "commands"],
    usage: "help",
    help: "Показать все команды.",
    suggest: () => ["help"],
    run() {
      say("Все команды:", "title");
      for (const c of COMMANDS) {
        say(`  ${c.usage.padEnd(48)} ${c.help}`, "system");
      }
      say("Направления: north (n) — север, south (s) — юг, east (e) — восток, west (w) — запад.", "system");
    },
  },
  {
    name: "reset", aliases: [],
    usage: "reset",
    help: "Начать игру заново (всё подземелье пропадёт!).",
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
