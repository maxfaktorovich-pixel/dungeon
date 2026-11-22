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
const SAVE_VERSION = 1;

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

// Первые комнаты, с которых начинается каждая новая игра
function buildStartingDungeon() {
  const hall = createRoom(0, 0, "room");
  hall.name = "Входной зал";
  hall.description = "Сюда падает немного света с поверхности. Отсюда начинается подземелье.";

  const chapel = createRoom(0, -1, "room");
  chapel.name = "Часовня";
  chapel.description = "Тихое место со свечами. Здесь безопасно.";
  chapel.npc = makeNpc("healer");

  const forge = createRoom(-1, 0, "room");
  forge.name = "Кузница";
  forge.description = "Жарко! В горне ещё тлеют угли.";
  forge.npc = makeNpc("smith");

  const cellar = createRoom(1, 0, "room");
  cellar.name = "Крысиный погреб";
  cellar.description = "Пахнет старым сыром. Что-то шуршит в темноте.";
  cellar.monster = makeMonster("rat");

  const vault = createRoom(1, 1, "treasure");
  vault.name = "Маленькая сокровищница";
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
