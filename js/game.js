// =====================================================================
//  СОСТОЯНИЕ ИГРЫ, СОХРАНЕНИЕ И МАЛЕНЬКИЕ ПОМОЩНИКИ
// =====================================================================

// Случайное целое число от min до max (включительно)
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Случайный элемент из списка
function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// true с вероятностью p (например, chance(0.3) — в 30% случаев)
function chance(p) {
  return Math.random() < p;
}

// ----- Сохранение -------------------------------------------------------
// Игра сохраняется в браузере (localStorage) после каждой команды.
// ВАЖНО: если ты меняешь, как устроены данные в `game` (например, добавляешь
// новое поле игроку), увеличь SAVE_VERSION — иначе старое сохранение может
// сломать игру. При новой версии игра просто начнётся заново.
const SAVE_KEY = "dungeon-builder-save";
const SAVE_VERSION = 3;

// Всё, что меняется во время игры, лежит здесь
let game = null;

function newGame() {
  game = {
    version: SAVE_VERSION,
    player: newPlayer(),
    rooms: {}, // ключ — "x,y", значение — комната
  };
  buildStartingDungeon();
}

// Первые комнаты, с которых начинается каждая новая игра.
// Чем дальше от входа, тем опаснее:
//   север  — склеп со скелетом и библиотека с призраком;
//   запад  — хижина отшельника и кладовая с летучей мышью;
//   восток — гоблины, мост, орк... и логово дракона в самом конце!
//
// Как читать запись: addRoom(x, y, "Название", "Описание", { что внутри })
//   monster — id монстра из MONSTERS, npc — id друга из NPCS,
//   items — предметы на полу, gold — золото на полу.
function buildStartingDungeon() {
  // ----- Центр -----
  addRoom(0, 0, "Входной зал",
    "Сюда падает немного света с поверхности. Отсюда начинается подземелье.");
  addRoom(0, -1, "Часовня",
    "Тихое место со свечами. Здесь безопасно.", { npc: "healer" });
  addRoom(-1, 0, "Кузница",
    "Жарко! В горне ещё тлеют угли.", { npc: "smith" });
  addRoom(1, 0, "Крысиный погреб",
    "Пахнет старым сыром. Что-то шуршит в темноте.", { monster: "rat" });
  addRoom(1, 1, "Маленькая сокровищница",
    "В углу стоит старый сундук.", { items: ["health_potion"], gold: 7 });

  // ----- Запад -----
  addRoom(-2, 0, "Хижина отшельника",
    "Кто-то устроил себе дом прямо в подземелье. Пахнет травами.", { npc: "wizard" });
  addRoom(-2, 1, "Старая кладовая",
    "Пыльные полки до потолка. Под потолком кто-то висит вниз головой...",
    { monster: "bat", items: ["health_potion"] });

  // ----- Север -----
  addRoom(0, -2, "Коридор свечей",
    "Вдоль стен горят свечи. Кто их зажигает — непонятно.");
  addRoom(-1, -2, "Склеп",
    "Каменные гробы стоят рядами. Крышка одного из них сдвинута.",
    { monster: "skeleton", gold: 10 });
  addRoom(1, -2, "Грибная пещера",
    "Пол усыпан светящимися грибами. Что-то зелёное булькает в углу.",
    { monster: "slime", items: ["health_potion"] });
  addRoom(0, -3, "Тихая библиотека",
    "Старые книги, паутина и холодок по спине.", { npc: "ghost" });

  // ----- Восток -----
  addRoom(2, 0, "Тёмный тоннель",
    "Узкий проход. Под ногами хрустят кости.", { monster: "goblin" });
  addRoom(3, 0, "Лагерь гоблинов",
    "Костёр, драные палатки и куча награбленного.",
    { monster: "goblin", items: ["iron_sword"], gold: 8 });
  addRoom(3, 1, "Каменный мост",
    "Мост над пропастью. Снизу доносится далёкий рёв.", { npc: "cat" });
  addRoom(3, 2, "Логово орка",
    "Повсюду разбросаны кости и сломанное оружие.",
    { monster: "orc", items: ["iron_shield"], gold: 15 });
  addRoom(3, 3, "Логово дракона",
    "Огромная пещера, полная золота. Здесь жарко, как в печке.",
    { monster: "dragon", items: ["health_potion", "health_potion"], gold: 100 });
}

// Создаёт комнату с заданным названием, описанием и содержимым
function addRoom(x, y, name, description, stuff = {}) {
  const room = createRoom(x, y);
  room.name = name;
  room.description = description;
  if (stuff.monster) room.monster = makeMonster(stuff.monster);
  if (stuff.npc) room.npc = makeNpc(stuff.npc);
  if (stuff.items) room.items.push(...stuff.items);
  if (stuff.gold) room.gold = stuff.gold;
  return room;
}

function saveGame() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(game));
}

// Возвращает true, если удалось загрузить сохранение
function loadGame() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (data && data.version === SAVE_VERSION) {
      game = data;
      return true;
    }
  } catch (e) {
    console.warn("Не получилось загрузить сохранение:", e);
  }
  return false;
}
