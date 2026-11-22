// =====================================================================
//  МИР: КОМНАТЫ НА КАРТЕ
//  Карта — это сетка. У каждой комнаты есть координаты x и y.
//  x растёт на восток (вправо), y растёт на юг (вниз).
//  Соседние комнаты всегда соединены проходом.
// =====================================================================

const DIRECTIONS = {
  north: { dx: 0, dy: -1, short: "n", ru: "север" },
  south: { dx: 0, dy: 1, short: "s", ru: "юг" },
  east: { dx: 1, dy: 0, short: "e", ru: "восток" },
  west: { dx: -1, dy: 0, short: "w", ru: "запад" },
};

// Превращает "n", "north" и т.п. в "north". Если не направление — null.
function parseDirection(word) {
  if (!word) return null;
  word = word.toLowerCase();
  for (const [dir, info] of Object.entries(DIRECTIONS)) {
    if (word === dir || word === info.short) return dir;
  }
  return null;
}

function roomKey(x, y) {
  return x + "," + y;
}

function getRoom(x, y) {
  return game.rooms[roomKey(x, y)] || null;
}

function currentRoom() {
  return getRoom(game.player.x, game.player.y);
}

// Комната в соседней клетке по направлению (или null)
function neighbor(room, dir) {
  const d = DIRECTIONS[dir];
  return getRoom(room.x + d.dx, room.y + d.dy);
}

// Список направлений, куда можно пройти из комнаты
function exitsOf(room) {
  return Object.keys(DIRECTIONS).filter((dir) => neighbor(room, dir));
}

// Можно ли построить комнату в этой клетке?
// Да, если клетка пустая и рядом есть хотя бы одна комната.
function isBuildable(x, y) {
  if (getRoom(x, y)) return false;
  return Object.values(DIRECTIONS).some((d) => getRoom(x + d.dx, y + d.dy));
}

// ----- Создание ---------------------------------------------------------

// Новая пустая комната со случайным названием и описанием
function createRoom(x, y) {
  const room = {
    x, y,
    name: pick(ROOM_NAMES),
    description: pick(ROOM_DESCRIPTIONS),
    monster: null, // { id, hp }
    npc: null,     // { id, talks, giftGiven }
    items: [],     // список id предметов на полу
    gold: 0,
  };
  game.rooms[roomKey(x, y)] = room;
  return room;
}

function makeMonster(id) {
  return { id, hp: MONSTERS[id].hp };
}

function makeNpc(id) {
  return { id, talks: 0, giftGiven: false };
}

// ----- Удаление ---------------------------------------------------------

// Проверяет, можно ли снести комнату. Возвращает текст ошибки или null.
function whyCantDelete(x, y) {
  const room = getRoom(x, y);
  if (!room) return "Там нет комнаты.";
  if (x === 0 && y === 0) return "Входной зал сносить нельзя.";
  if (x === game.player.x && y === game.player.y) return "Здесь стоит герой — сначала переставь его.";
  if (!staysConnectedWithout(x, y)) return "Тогда часть подземелья окажется отрезанной.";
  return null;
}

// Останутся ли все комнаты достижимыми от входа, если убрать (x, y)?
// Это «поиск в ширину»: обходим комнаты от входа и считаем, сколько нашли.
function staysConnectedWithout(x, y) {
  const skip = roomKey(x, y);
  const seen = new Set(["0,0"]);
  const queue = [[0, 0]];
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    for (const d of Object.values(DIRECTIONS)) {
      const key = roomKey(cx + d.dx, cy + d.dy);
      if (key !== skip && game.rooms[key] && !seen.has(key)) {
        seen.add(key);
        queue.push([cx + d.dx, cy + d.dy]);
      }
    }
  }
  return seen.size === Object.keys(game.rooms).length - 1;
}

function deleteRoom(x, y) {
  delete game.rooms[roomKey(x, y)];
}
