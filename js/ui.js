// =====================================================================
//  ЭКРАН: КАРТА, ТЕКСТОВОЕ ОКНО, ОКНО ПЕРСОНАЖА
//  Здесь только рисование и клики. Правила игры — в других файлах.
// =====================================================================

// ----- Текстовое окно ---------------------------------------------------

// Напечатать строку в окно. cls — цвет: "good", "bad", "combat" и т.д.
function say(text, cls = "") {
  const log = document.getElementById("log");
  const line = document.createElement("div");
  line.textContent = text;
  if (cls) line.className = cls;
  log.appendChild(line);
  // Чтобы окно не тормозило, храним только последние 300 строк
  while (log.children.length > 300) log.removeChild(log.firstChild);
  log.scrollTop = log.scrollHeight;
}

function clearLog() {
  document.getElementById("log").innerHTML = "";
}

function renderAll() {
  renderMap();
  renderStats();
  renderActions();
}

// ----- Карта ------------------------------------------------------------

// Что делает клик по карте (выбирается кнопками над картой)
let brush = "walk";

const BRUSH_HINTS = {
  walk: "Кликни по соседней комнате, чтобы пойти туда.",
  room: "Кликни по пунктирной клетке, чтобы построить пустую комнату.",
  monster: "Кликни по пустой клетке или по комнате, чтобы добавить монстра.",
  friend: "Кликни по пустой клетке или по комнате, чтобы поселить друга.",
  treasure: "Кликни по пустой клетке или по комнате, чтобы спрятать клад.",
  delete: "Кликни по комнате, чтобы снести её.",
};

// Какой значок показать в комнате
function roomIcon(room) {
  const p = game.player;
  if (room.x === p.x && room.y === p.y) return p.emoji;
  if (room.monster) return MONSTERS[room.monster.id].emoji;
  if (room.npc) return NPCS[room.npc.id].emoji;
  if (room.items.length > 0 || room.gold > 0) return "💰";
  return "";
}

function renderMap() {
  const rooms = Object.values(game.rooms);
  const xs = rooms.map((r) => r.x);
  const ys = rooms.map((r) => r.y);
  // Рисуем на одну клетку шире со всех сторон — там можно строить
  const minX = Math.min(...xs) - 1, maxX = Math.max(...xs) + 1;
  const minY = Math.min(...ys) - 1, maxY = Math.max(...ys) + 1;

  const map = document.getElementById("map");
  map.style.gridTemplateColumns = `repeat(${maxX - minX + 1}, var(--cell))`;
  map.innerHTML = "";

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const cell = document.createElement("div");
      const room = getRoom(x, y);
      if (room) {
        cell.className = "cell room";
        if (getRoom(x + 1, y)) cell.classList.add("door-e");
        if (getRoom(x, y + 1)) cell.classList.add("door-s");
        if (x === game.player.x && y === game.player.y) {
          cell.classList.add("here");
          if (room.monster) cell.classList.add("danger");
        }
        cell.textContent = roomIcon(room);
        // В бою показываем монстра маленьким значком рядом с игроком
        if (cell.classList.contains("danger")) {
          const badge = document.createElement("span");
          badge.className = "badge";
          badge.textContent = MONSTERS[room.monster.id].emoji;
          cell.appendChild(badge);
        }
        cell.title = room.name;
      } else if (isBuildable(x, y)) {
        cell.className = "cell buildable";
        cell.title = "Здесь можно построить комнату";
      } else {
        cell.className = "cell void";
      }
      cell.addEventListener("click", () => onMapClick(x, y));
      map.appendChild(cell);
    }
  }

  const here = map.querySelector(".here");
  if (here) here.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function onMapClick(x, y) {
  const room = getRoom(x, y);
  const p = game.player;

  if (brush === "walk") {
    if (!room) return;
    if (room.x === p.x && room.y === p.y) return runCommand("look");
    // Ищем направление к соседней комнате
    const dir = Object.keys(DIRECTIONS).find((d) =>
      p.x + DIRECTIONS[d].dx === x && p.y + DIRECTIONS[d].dy === y);
    if (dir) return runCommand(DIRECTIONS[dir].short);
    say("Это слишком далеко. Ходи по одной комнате.", "bad");
  } else if (brush === "delete") {
    if (!room) return;
    destroyAt(x, y);
  } else if (room) {
    if (brush === "room") return say("Здесь уже есть комната.", "bad");
    addToRoom(room, brush);
  } else {
    buildAt(x, y, brush);
  }
  saveGame();
  renderAll();
}

function setupBrushes() {
  const buttons = document.querySelectorAll("#brushes button");
  for (const button of buttons) {
    button.addEventListener("click", () => {
      brush = button.dataset.brush;
      buttons.forEach((b) => b.classList.toggle("active", b === button));
      document.getElementById("brush-hint").textContent = BRUSH_HINTS[brush];
    });
  }
  document.getElementById("brush-hint").textContent = BRUSH_HINTS[brush];
}

// ----- «Что можно сделать» ----------------------------------------------

// Подпись на кнопке: к направлениям добавляем русское слово
function suggestionLabel(cmd) {
  const words = cmd.trim().split(" ");
  const dir = parseDirection(words[words.length - 1]);
  return dir ? `${cmd} (${DIRECTIONS[dir].ru})` : cmd.trim();
}

function renderActions() {
  const box = document.getElementById("actions");
  box.innerHTML = "";

  const room = currentRoom();
  const situation = document.createElement("div");
  situation.className = "situation";
  situation.textContent = inCombat()
    ? `⚔️ Бой! Противник: ${monsterLabel(room.monster)}. Что будешь делать?`
    : `📍 Ты в комнате «${room.name}». Что можно сделать:`;
  box.appendChild(situation);

  for (const command of COMMANDS) {
    const suggestions = command.suggest();
    if (suggestions.length === 0) continue;

    const row = document.createElement("div");
    row.className = "row";
    const what = document.createElement("span");
    what.className = "what";
    what.textContent = command.help;
    row.appendChild(what);

    for (const cmd of suggestions) {
      const button = document.createElement("button");
      button.textContent = suggestionLabel(cmd);
      if (cmd.endsWith(" ")) {
        // Не выполняем сразу — вставляем в строку, чтобы игрок дописал
        button.className = "fill";
        button.title = "Вставить в строку ввода и дописать";
        button.addEventListener("click", () => fillInput(cmd));
      } else {
        button.addEventListener("click", () => runCommand(cmd));
      }
      row.appendChild(button);
    }
    box.appendChild(row);
  }
}

// ----- Окно персонажа ---------------------------------------------------

function bar(cls, value, max, label) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  return `<div class="bar ${cls}"><div style="width:${percent}%"></div><span>${label} ${value}/${max}</span></div>`;
}

// Кнопка, которая выполняет команду (через data-cmd)
function cmdButton(cmd, text) {
  return `<button data-cmd="${cmd}">${text}</button>`;
}

function renderStats() {
  const p = game.player;
  let html = `<h2>${p.emoji} ${p.name} — уровень ${p.level}</h2>`;
  html += bar("hp", p.hp, maxHp(), "❤️ Здоровье");
  html += bar("mp", p.mp, maxMp(), "🔷 Мана");
  html += bar("xp", p.xp, xpToNextLevel(), "⭐ Опыт");

  if (inCombat()) {
    const monster = currentRoom().monster;
    html += `<h3>⚔️ Враг: ${monsterLabel(monster)}</h3>`;
    html += bar("hp", monster.hp, MONSTERS[monster.id].hp, "Здоровье");
  }

  const trainBtn = (stat) => (p.statPoints > 0 ? cmdButton(`train ${stat}`, "+1") : "");
  html += `<div class="stat-line"><span>💪 СИЛ (str): <b>${p.str}</b></span>${trainBtn("str")}</div>`;
  html += `<div class="stat-line"><span>🧠 ИНТ (int): <b>${p.int}</b></span>${trainBtn("int")}</div>`;
  if (p.statPoints > 0) html += `<div class="muted">Свободных очков: ${p.statPoints}</div>`;
  html += `<div class="stat-line"><span>🪙 Золото: <b>${p.gold}</b></span></div>`;
  html += `<div class="stat-line muted"><span>Атака +${equipmentBonus("attack")} · Защита +${equipmentBonus("defense")} · Магия +${equipmentBonus("magic")}</span></div>`;

  html += `<h3>✋ Снаряжение</h3>`;
  for (const [slot, label] of Object.entries(SLOTS)) {
    const id = p.equipment[slot];
    html += `<div class="item-line"><span>${label}: ${id ? itemLabel(id) : '<span class="muted">пусто</span>'}</span>`;
    if (id) html += `<span class="btns">${cmdButton(`remove ${ITEMS[id].name.toLowerCase()}`, "снять")}</span>`;
    html += `</div>`;
  }

  html += `<h3>🎒 Сумка</h3>`;
  if (p.inventory.length === 0) html += `<div class="muted">Пусто</div>`;
  for (const id of p.inventory) {
    const item = ITEMS[id];
    const name = item.name.toLowerCase();
    let btns = "";
    if (item.slot) btns += cmdButton(`equip ${name}`, "взять");
    if (item.heal || item.mana) btns += cmdButton(`use ${name}`, "выпить");
    btns += cmdButton(`drop ${name}`, "бросить");
    html += `<div class="item-line" title="${item.description}"><span>${itemLabel(id)}</span><span class="btns">${btns}</span></div>`;
  }

  html += `<h3>✨ Заклинания</h3>`;
  for (const id of p.spells) {
    const s = SPELLS[id];
    html += `<div class="item-line" title="${s.description}"><span>${s.emoji} ${s.name} <span class="muted">(${s.cost} маны)</span></span>`;
    html += `<span class="btns">${cmdButton(`cast ${id}`, "колдовать")}</span></div>`;
  }

  const stats = document.getElementById("stats");
  stats.innerHTML = html;
  stats.querySelectorAll("button[data-cmd]").forEach((b) =>
    b.addEventListener("click", () => runCommand(b.dataset.cmd)));
}

// ----- Строка ввода -----------------------------------------------------

const commandHistory = [];
let historyIndex = 0;

function fillInput(text) {
  const input = document.getElementById("command-input");
  input.value = text;
  input.focus();
}

function setupInput() {
  const form = document.getElementById("command-form");
  const input = document.getElementById("command-input");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value;
    input.value = "";
    if (text.trim()) {
      commandHistory.push(text);
      historyIndex = commandHistory.length;
    }
    runCommand(text);
  });

  // Стрелки вверх/вниз — прошлые команды
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp" && historyIndex > 0) {
      historyIndex -= 1;
      input.value = commandHistory[historyIndex];
      event.preventDefault();
    } else if (event.key === "ArrowDown") {
      historyIndex = Math.min(commandHistory.length, historyIndex + 1);
      input.value = commandHistory[historyIndex] || "";
      event.preventDefault();
    }
  });
}
