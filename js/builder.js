// =====================================================================
//  РЕЖИМ «СТРОИТЕЛЬ»
//  Здесь строят подземелье мышкой: кликаешь по карте, выбираешь комнату
//  и настраиваешь её в редакторе справа.
// =====================================================================

// Какая комната выбрана в редакторе (ключ "x,y")
let selectedKey = "0,0";

function selectedRoom() {
  return game.rooms[selectedKey] || null;
}

// При входе в режим строителя выбираем комнату, где стоит герой
function startBuilder() {
  selectedKey = roomKey(game.player.x, game.player.y);
  builderMessage = "";
}

// Короткое сообщение строителю («Комната построена» и т.п.)
let builderMessage = "";

function onBuilderMapClick(x, y) {
  if (getRoom(x, y)) {
    selectedKey = roomKey(x, y);
    builderMessage = "";
  } else if (isBuildable(x, y)) {
    const room = createRoom(x, y);
    selectedKey = roomKey(x, y);
    builderMessage = `🧱 Построена комната «${room.name}».`;
    saveGame();
  } else {
    return;
  }
  renderAll();
}

// Список вариантов для выпадающего меню
function options(entries, selected) {
  let html = `<option value="">— никого —</option>`;
  for (const [value, text] of entries) {
    html += `<option value="${value}" ${value === selected ? "selected" : ""}>${text}</option>`;
  }
  return html;
}

function renderEditor() {
  const box = document.getElementById("editor");
  const room = selectedRoom();
  if (!room) {
    box.innerHTML = `<p class="muted">Выбери комнату на карте.</p>`;
    return;
  }

  const heroHere = room.x === game.player.x && room.y === game.player.y;
  const deleteProblem = whyCantDelete(room.x, room.y);

  const monsterChoices = Object.entries(MONSTERS).map(([id, m]) =>
    [id, `${m.emoji} ${m.name} — ур. ${m.level}, ❤️${m.hp}, ⚔️${m.attack}`]);
  const friendChoices = Object.entries(NPCS).map(([id, n]) => [id, `${n.emoji} ${n.name}`]);
  const itemChoices = Object.entries(ITEMS).map(([id, item]) =>
    `<option value="${id}">${item.emoji} ${item.name}</option>`).join("");

  // Название и описание вставляем позже через .value — так безопаснее
  box.innerHTML = `
    <h2 id="ed-title"></h2>
    <div class="muted">Клетка (${room.x}, ${room.y})${heroHere ? " · здесь стоит герой 🤺" : ""}</div>
    <div id="ed-message">${builderMessage}</div>

    <label>Название</label>
    <input id="ed-name" maxlength="40">

    <label>Описание</label>
    <textarea id="ed-desc" rows="3" maxlength="300"></textarea>

    <label>👹 Монстр</label>
    <select id="ed-monster">${options(monsterChoices, room.monster && room.monster.id)}</select>

    <label>🙂 Друг</label>
    <select id="ed-friend">${options(friendChoices, room.npc && room.npc.id)}</select>

    <label>💰 Предметы на полу</label>
    <div id="ed-items">
      ${room.items.length === 0 ? '<div class="muted">Ничего нет</div>' : ""}
      ${room.items.map((id, i) =>
        `<div class="item-line">${itemLabel(id)} <button data-remove="${i}" title="Убрать">✕</button></div>`).join("")}
    </div>
    <div class="ed-row">
      <select id="ed-item">${itemChoices}</select>
      <button id="ed-add-item">+ Положить</button>
    </div>

    <label>🪙 Золото на полу</label>
    <input id="ed-gold" type="number" min="0" max="999">

    <div class="ed-row ed-buttons">
      <button id="ed-hero" ${heroHere ? "disabled" : ""}>🤺 Поставить героя сюда</button>
      <button id="ed-delete" class="danger-btn" ${deleteProblem ? "disabled" : ""}
        title="${deleteProblem || "Снести эту комнату"}">💥 Снести комнату</button>
    </div>
    ${deleteProblem ? `<div class="muted small">Снести нельзя: ${deleteProblem}</div>` : ""}
  `;

  document.getElementById("ed-title").textContent = `🧱 ${room.name}`;
  const nameInput = document.getElementById("ed-name");
  const descInput = document.getElementById("ed-desc");
  const goldInput = document.getElementById("ed-gold");
  nameInput.value = room.name;
  descInput.value = room.description;
  goldInput.value = room.gold;

  // --- Что происходит, когда строитель что-то меняет ---

  nameInput.addEventListener("input", () => {
    room.name = nameInput.value.trim() || "Безымянная комната";
    document.getElementById("ed-title").textContent = `🧱 ${room.name}`;
    saveGame();
    renderMap();
  });

  descInput.addEventListener("input", () => {
    room.description = descInput.value;
    saveGame();
  });

  document.getElementById("ed-monster").addEventListener("change", (e) => {
    room.monster = e.target.value ? makeMonster(e.target.value) : null;
    changed("Монстр обновлён.");
  });

  document.getElementById("ed-friend").addEventListener("change", (e) => {
    room.npc = e.target.value ? makeNpc(e.target.value) : null;
    changed("Друг обновлён.");
  });

  box.querySelectorAll("button[data-remove]").forEach((b) =>
    b.addEventListener("click", () => {
      room.items.splice(Number(b.dataset.remove), 1);
      changed("Предмет убран.");
    }));

  document.getElementById("ed-add-item").addEventListener("click", () => {
    const id = document.getElementById("ed-item").value;
    room.items.push(id);
    changed(`Положено: ${itemLabel(id)}.`);
  });

  goldInput.addEventListener("change", () => {
    room.gold = Math.max(0, Math.floor(Number(goldInput.value) || 0));
    changed("Золото обновлено.");
  });

  document.getElementById("ed-hero").addEventListener("click", () => {
    const p = game.player;
    p.x = p.lastX = room.x;
    p.y = p.lastY = room.y;
    changed("🤺 Герой теперь стоит здесь.");
  });

  document.getElementById("ed-delete").addEventListener("click", () => {
    const name = room.name;
    deleteRoom(room.x, room.y);
    selectedKey = roomKey(game.player.x, game.player.y);
    changed(`💥 Комната «${name}» снесена.`);
  });
}

// Сохранить, показать сообщение и всё перерисовать
function changed(message) {
  builderMessage = message;
  saveGame();
  renderAll();
}
