// =====================================================================
//  ЭКРАН: РЕЖИМЫ, КАРТА И ПАНЕЛИ ПРИКЛЮЧЕНИЯ
//  Здесь только рисование. Правила игры — в других файлах.
//  Режим «Строитель» рисуется в builder.js.
//
//  В режиме «Приключение» нет кнопок — только текстовые команды,
//  как в настоящем MUD. Мышка нужна только строителю.
// =====================================================================

// "adventure" — приключение, "builder" — строитель
let mode = "adventure";

function setMode(newMode) {
  mode = newMode;
  document.getElementById("app").className = "mode-" + mode;
  document.querySelectorAll("#modes button").forEach((b) =>
    b.classList.toggle("active", b.dataset.mode === mode));

  if (mode === "adventure") {
    say("— Ты возвращаешься в подземелье —", "system");
    describeRoom();
    renderAll();
    document.getElementById("command-input").focus();
  } else {
    startBuilder();
    renderAll();
  }
}

function setupModes() {
  document.querySelectorAll("#modes button").forEach((b) =>
    b.addEventListener("click", () => {
      if (b.dataset.mode !== mode) setMode(b.dataset.mode);
    }));
}

function renderAll() {
  renderMap();
  if (mode === "adventure") {
    renderStats();
    renderActions();
  } else {
    renderEditor();
  }
}

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

// ----- Карта ------------------------------------------------------------

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
  // Рисуем на одну клетку шире со всех сторон — там строитель может строить
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
        const heroHere = x === game.player.x && y === game.player.y;
        if (heroHere) cell.classList.add("here");
        if (mode === "builder" && roomKey(x, y) === selectedKey) cell.classList.add("selected");
        cell.textContent = roomIcon(room);
        cell.title = room.name;
        // Если герой стоит рядом с монстром — показываем монстра маленьким значком
        if (heroHere && room.monster) {
          cell.classList.add("danger");
          const badge = document.createElement("span");
          badge.className = "badge";
          badge.textContent = MONSTERS[room.monster.id].emoji;
          cell.appendChild(badge);
        }
      } else if (mode === "builder" && isBuildable(x, y)) {
        cell.className = "cell buildable";
        cell.title = "Построить здесь комнату";
      } else {
        cell.className = "cell void";
      }
      // Кликать по карте можно только в режиме строителя
      if (mode === "builder") cell.addEventListener("click", () => onBuilderMapClick(x, y));
      map.appendChild(cell);
    }
  }

  document.getElementById("map-hint").textContent = mode === "builder"
    ? "Кликни по пунктирной клетке, чтобы построить комнату. Кликни по комнате, чтобы её настроить."
    : "Ты — это 🤺. Чтобы пойти куда-то, набери направление: n, s, e или w.";

  const here = map.querySelector(".here");
  if (here) here.scrollIntoView({ block: "nearest", inline: "nearest" });
}

// ----- «Что можно сделать» (только текст, без кнопок) --------------------

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
    for (const [i, text] of suggestions.entries()) {
      if (i > 0) row.append(", ");
      const code = document.createElement("code");
      code.textContent = text;
      row.appendChild(code);
    }
    row.append(" — " + command.help);
    box.appendChild(row);
  }
}

// ----- Окно героя -------------------------------------------------------

function bar(cls, value, max, label) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  return `<div class="bar ${cls}"><div style="width:${percent}%"></div><span>${label} ${value}/${max}</span></div>`;
}

function renderStats() {
  const p = game.player;
  let html = `<h2>${p.emoji} ${p.name} — уровень ${p.level}</h2>`;
  html += bar("hp", p.hp, maxHp(), "❤️ Здоровье");
  html += bar("xp", p.xp, xpToNextLevel(), "⭐ Опыт");

  if (inCombat()) {
    const monster = currentRoom().monster;
    html += `<h3>⚔️ Враг: ${monsterLabel(monster)}</h3>`;
    html += bar("hp", monster.hp, MONSTERS[monster.id].hp, "Здоровье");
  }

  html += `<div class="stat-line">🪙 Золото: <b>${p.gold}</b></div>`;
  html += `<div class="stat-line muted">Атака +${equipmentBonus("attack")} · Защита +${equipmentBonus("defense")}</div>`;

  // В квадратных скобках — слово, которое писать в командах
  const word = (id) => `<span class="kw">[${ITEMS[id].keyword}]</span>`;

  html += `<h3>✋ Снаряжение</h3>`;
  for (const [slot, label] of Object.entries(SLOTS)) {
    const id = p.equipment[slot];
    html += `<div class="item-line">${label}: ${id ? `${itemLabel(id)} ${word(id)}` : '<span class="muted">пусто</span>'}</div>`;
  }

  html += `<h3>🎒 Сумка</h3>`;
  if (p.inventory.length === 0) html += `<div class="muted">Пусто</div>`;
  for (const id of p.inventory) {
    html += `<div class="item-line" title="${ITEMS[id].description}">${itemLabel(id)} ${word(id)}</div>`;
  }

  document.getElementById("stats").innerHTML = html;
}

// ----- Строка ввода -----------------------------------------------------

const commandHistory = [];
let historyIndex = 0;

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
