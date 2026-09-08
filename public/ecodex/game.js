// ---------- 사운드 (서바이벌 게임과 같은 방식: 오디오 파일 없이 직접 합성) ----------
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function playTone(freqStart, freqEnd, duration, type, volume) {
  const ac = getAudioCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), ac.currentTime + duration);
  gain.gain.setValueAtTime(volume, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + duration);
}
const sfx = {
  attack: () => playTone(500, 150, 0.1, 'square', 0.08),
  captureSuccess: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => playTone(f, f, 0.15, 'triangle', 0.1), i * 90)),
  captureFail: () => playTone(200, 120, 0.2, 'sawtooth', 0.08),
  levelup: () => [392, 523, 659, 784].forEach((f, i) => setTimeout(() => playTone(f, f, 0.15, 'triangle', 0.1), i * 80)),
  defeat: () => [300, 220, 150].forEach((f, i) => setTimeout(() => playTone(f, f * 0.7, 0.25, 'sawtooth', 0.1), i * 150)),
};

// ---------- 맵 (마을과 풀숲을 별도 맵으로 분리) ----------
const TILE = 48;

const MAPS = {
  village: {
    rows: [
      '###############',
      '#HH........HH.#',
      '#HH........HH.#',
      '#.............#',
      '#.............#',
      '#.............#',
      '#######.#######',
      '#.........HHH.#',
      '#.........HHH.#',
      '#######>#######',
    ],
    startX: 7, startY: 2,
    exits: { '>': { map: 'wild', x: 7, y: 8 } },
    npcs: [
      {
        id: 'elder', gx: 7, gy: 6, icon: '🧓', type: 'warning', name: '마을 어르신', disappearAfter: true,
        lines: '거기부터는 풀숲이야. 무섭게 구는 동식물들이 살고 있으니 무기 없이 함부로 들어가지 말게. 준비됐으면 다녀오게나!',
      },
      {
        id: 'shopkeeper', gx: 3, gy: 5, icon: '🧑‍🌾', type: 'shop', name: '상인',
        lines: '어서 오게. 회복 물약이랑 포획 도구들을 팔고 있다네.',
      },
    ],
  },
  wild: {
    rows: [
      '#######^#######',
      '#.............#',
      '#..,,,,,......#',
      '#..,,,,,......#',
      '#..,,,,,..,,,.#',
      '#.........,,,.#',
      '#.........,,,.#',
      '#.............#',
      '#.............#',
      '#######<#######',
    ],
    exits: {
      '<': { map: 'village', x: 7, y: 8 },
      '^': { map: 'river', x: 7, y: 8 },
    },
    npcs: [],
  },
  river: {
    rows: [
      '###############',
      '#~~~~~~~~~~~~~#',
      '#~~rrrrrrrrr~~#',
      '#~~rrrrrrrrr~~#',
      '#.............#',
      '#.rrrrrrrrrrr.#',
      '#.rrrrrrrrrrr.#',
      '#.............#',
      '#.............#',
      '#######<#######',
    ],
    exits: { '<': { map: 'wild', x: 7, y: 1 } },
    npcs: [
      {
        id: 'fisher_spot', gx: 2, gy: 2, icon: '🎣', type: 'fishing', name: '낚시 포인트',
        lines: '',
      },
    ],
  },
};

function currentMap() { return MAPS[player.mapId] || MAPS.village; }

function tileAt(gx, gy) {
  const rows = currentMap().rows;
  if (gy < 0 || gy >= rows.length || gx < 0 || gx >= rows[0].length) return '#';
  return rows[gy][gx];
}
function isWalkable(gx, gy) {
  const t = tileAt(gx, gy);
  return t !== '#' && t !== 'H' && t !== '~';
}

// ---------- 종 정의 (실제 환경부 지정 생태계교란 생물 기준) ----------
const SPECIES = [
  { id: 'nutria', name: '뉴트리아', icon: '🦫', type: 'animal', map: 'wild', maxHp: 30, atk: 3, exp: 20, gold: 10,
    desc: '남미 원산의 대형 설치류로, 습지 식물과 농작물을 마구 먹어치우고 제방에 굴을 파 생태계와 시설물에 피해를 줍니다.' },
  { id: 'bullfrog', name: '황소개구리', icon: '🐸', type: 'animal', map: 'wild', maxHp: 22, atk: 3, exp: 15, gold: 8,
    desc: '북아메리카 원산의 대형 개구리로, 토종 개구리·어류·곤충을 가리지 않고 잡아먹어 하천 생태계를 교란합니다.' },
  { id: 'sicyos', name: '가시박', icon: '🌿', type: 'plant', map: 'wild', maxHp: 18, atk: 0, thorn: 2, exp: 12, gold: 5,
    desc: '북아메리카 원산의 덩굴식물로, 다른 식물을 뒤덮어 광합성을 막아 고사시킵니다. 줄기에 가시가 있어 다룰 때 주의가 필요합니다.' },

  // ---- 들판 곤충류 (기존 wild 맵에 합류) ----
  { id: 'lanternfly', name: '꽃매미', icon: '🦋', type: 'animal', map: 'wild', maxHp: 14, atk: 2, exp: 10, gold: 5,
    desc: '중국 원산의 매미충으로, 포도나무·과수의 즙을 빨아먹고 끈끈한 분비물로 그을음병을 유발해 농작물에 큰 피해를 줍니다.' },
  { id: 'fireant_red', name: '붉은불개미', icon: '🐜', type: 'animal', map: 'wild', maxHp: 15, atk: 4, exp: 12, gold: 6,
    desc: '남미 원산의 독침 개미로, 사람과 가축을 쏘아 알레르기 쇼크를 일으킬 수 있고 토착 곤충 생태계를 위협해 항만에서 집중 방역 대상입니다.' },
  { id: 'hornet_yl', name: '등검은말벌', icon: '🐝', type: 'animal', map: 'wild', maxHp: 16, atk: 4, exp: 13, gold: 7,
    desc: '아시아 원산의 말벌로, 꿀벌을 집단으로 습격해 양봉 농가에 큰 피해를 주고 토종 벌 개체수를 위협합니다.' },
  { id: 'planthopper_us', name: '미국선녀벌레', icon: '🦟', type: 'animal', map: 'wild', maxHp: 12, atk: 2, exp: 8, gold: 4,
    desc: '북미 원산의 매미충으로, 여러 과수와 정원수의 수액을 빨아먹고 하얀 밀랍 분비물로 그을음병을 퍼뜨립니다.' },
  { id: 'brownwing_bug', name: '갈색날개벌레', icon: '🪲', type: 'animal', map: 'wild', maxHp: 13, atk: 3, exp: 9, gold: 5,
    desc: '외래 노린재류 곤충으로, 과수와 농작물의 즙을 빨아먹어 상품성을 떨어뜨리는 농업 해충입니다.' },
  { id: 'planthopper_brown', name: '갈색날개매미충', icon: '🦗', type: 'animal', map: 'wild', maxHp: 13, atk: 3, exp: 10, gold: 5,
    desc: '나뭇가지에 알을 낳고 수액을 빨아먹어 과수원에 피해를 주며, 번식력이 강해 빠르게 확산되는 매미충입니다.' },
  { id: 'crazyant_long', name: '긴다리비틀개미', icon: '🐜', type: 'animal', map: 'wild', maxHp: 14, atk: 3, exp: 11, gold: 6,
    desc: '열대 원산의 개미로, 거대한 군집을 이루어 토착 곤충과 소형 동물을 밀어내고 개미산을 뿌려 주변 생태계를 교란합니다.' },
  { id: 'locust_pectin', name: '빗살무늬미주메뚜기', icon: '🦗', type: 'animal', map: 'wild', maxHp: 18, atk: 3, exp: 13, gold: 7,
    desc: '아메리카 대륙 원산의 메뚜기로, 무리를 지어 농작물과 초지를 갉아먹어 큰 피해를 줍니다.' },
  { id: 'ant_argentine', name: '아르헨티나개미', icon: '🐜', type: 'animal', map: 'wild', maxHp: 13, atk: 2, exp: 9, gold: 5,
    desc: '남미 원산의 개미로, 서로 다른 군집끼리 싸우지 않고 거대한 슈퍼콜로니를 이루어 토착 개미와 곤충을 몰아냅니다.' },
  { id: 'fireant_tropical', name: '열대불개미', icon: '🐜', type: 'animal', map: 'wild', maxHp: 15, atk: 4, exp: 12, gold: 6,
    desc: '열대 지방 원산의 독침 개미로, 붉은불개미와 마찬가지로 사람을 쏘아 피해를 주고 토착 곤충 생태계를 위협합니다.' },
  { id: 'crazyant_tropical', name: '열대긴수염개미', icon: '🐜', type: 'animal', map: 'wild', maxHp: 14, atk: 3, exp: 11, gold: 6,
    desc: '빠르게 확산하는 열대 원산의 개미로, 토착 개미 군집을 밀어내고 다른 곤충을 잡아먹어 생태계 균형을 무너뜨립니다.' },

  // ---- 강가 파충류·갑각류 (신규 river 맵) ----
  { id: 'turtle_redear', name: '붉은귀거북', icon: '🐢', type: 'animal', map: 'river', maxHp: 24, atk: 2, exp: 16, gold: 9,
    desc: '애완용으로 들여왔다가 하천에 버려진 거북으로, 잡식성이라 토종 수생 동식물을 닥치는 대로 먹어치우고 토종 거북의 서식지를 빼앗습니다.' },
  { id: 'turtle_river_cooter', name: '리버쿠터', icon: '🐢', type: 'animal', map: 'river', maxHp: 26, atk: 2, exp: 17, gold: 9,
    desc: '북미 원산의 애완용 거북이 유기되어 하천에 정착한 것으로, 토종 거북과 먹이·서식지를 두고 경쟁합니다.' },
  { id: 'turtle_chinese_stripe', name: '중국줄무늬목거북', icon: '🐢', type: 'animal', map: 'river', maxHp: 22, atk: 2, exp: 16, gold: 9,
    desc: '애완용으로 수입되었다가 유기된 거북으로, 토종 거북과 교잡할 위험이 있어 고유종의 유전적 순수성을 위협합니다.' },
  { id: 'turtle_alligator_snapper', name: '악어거북', icon: '🐊', type: 'animal', map: 'river', maxHp: 35, atk: 5, exp: 25, gold: 15,
    desc: '북미 원산의 대형 육식 거북으로, 강한 턱 힘으로 물고기와 작은 동물을 가리지 않고 잡아먹는 최상위 포식자입니다.' },
  { id: 'turtle_florida_redbelly', name: '플로리다레드벨리쿠터', icon: '🐢', type: 'animal', map: 'river', maxHp: 25, atk: 2, exp: 17, gold: 9,
    desc: '플로리다 원산의 애완용 거북이 유기되어 퍼진 것으로, 왕성한 식성으로 토종 수생식물과 소형 동물을 위협합니다.' },
  { id: 'turtle_snapping', name: '늑대거북', icon: '🐢', type: 'animal', map: 'river', maxHp: 32, atk: 5, exp: 22, gold: 13,
    desc: '북미 원산의 공격적인 육식 거북으로, 물고기·개구리·물새 새끼까지 잡아먹어 하천 생태계 먹이사슬을 교란합니다.' },
  { id: 'crayfish_us', name: '미국가재', icon: '🦞', type: 'animal', map: 'river', maxHp: 20, atk: 3, exp: 15, gold: 8,
    desc: '북미 원산의 가재로, 토종 가재를 몰아내고 논둑에 굴을 파 농업시설을 훼손하며 잡식성으로 수생 생태계를 교란합니다.' },

  // ---- 어류 (강가 낚시터에서만 낚시로 포획) ----
  { id: 'bluegill', name: '파랑볼우럭(블루길)', icon: '🐟', type: 'fish', map: 'river', exp: 16, gold: 9,
    desc: '1969년 식량 자원으로 들여온 북미산 물고기로, 토종 어류의 알과 새끼, 수서곤충까지 닥치는 대로 잡아먹는 탐식성 포식자입니다.' },
  { id: 'bass_largemouth', name: '큰입배스', icon: '🐠', type: 'fish', map: 'river', exp: 20, gold: 12,
    desc: '1973년 낚시 자원으로 도입된 북미산 대형 육식 어류로, 저수지와 강의 토종 어류를 위협하는 최상위 포식자입니다.' },
  { id: 'trout_brown', name: '갈색송어', icon: '🐟', type: 'fish', map: 'river', exp: 24, gold: 15,
    desc: '낚시용으로 방류된 유럽·서아시아 원산의 육식성 송어로, 차가운 계류에서 토종 어류와 수서생물을 위협합니다.' },
];

// 이번 판에서 이미 대사를 마치고 사라진 NPC는 화면/충돌 판정에서 제외한다.
function visibleNpcs() {
  const dismissed = player.dismissedNpcs || [];
  return currentMap().npcs.filter((n) => !dismissed.includes(n.id));
}

const SAVE_KEY = 'ecodex_save';

let player, dex, battle;
let gameMode = 'title'; // 'title' | 'field' | 'battle' | 'dex' | 'clear'
let canMove = true;
let battleLocked = false;

const fieldCanvas = document.getElementById('field-canvas');
const fctx = fieldCanvas.getContext('2d');

function initDex() {
  const d = {};
  SPECIES.forEach((s) => { d[s.id] = { met: false, caught: false }; });
  return d;
}

function newGame() {
  player = {
    mapId: 'village', gx: MAPS.village.startX, gy: MAPS.village.startY,
    level: 1, xp: 0, xpToNext: 20, maxHp: 30, hp: 30, atk: 8,
    gold: 15, nets: 3, plantTools: 3, potions: 1, bait: 3, dismissedNpcs: [],
  };
  dex = initDex();
  saveGame();
}

// 옛 저장 파일과의 호환: 새로 추가된 종/자원이 없으면 기본값으로 채운다.
function patchSaveCompat() {
  SPECIES.forEach((s) => { if (!dex[s.id]) dex[s.id] = { met: false, caught: false }; });
  if (player.bait === undefined) player.bait = 0;
}

function saveGame() {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ player, dex }));
}
function loadGame() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; }
}

// ---------- 화면 전환 ----------
function enterField() {
  gameMode = 'field';
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('clear-screen').classList.add('hidden');
  document.getElementById('field-screen').classList.remove('hidden');
  renderField();
}

document.getElementById('new-game-btn').addEventListener('click', () => {
  newGame();
  enterField();
});
document.getElementById('continue-btn').addEventListener('click', () => {
  const s = loadGame();
  if (!s) return;
  player = s.player;
  dex = s.dex;
  patchSaveCompat();
  enterField();
});

const savedGame = loadGame();
document.getElementById('continue-btn').classList.toggle('hidden', !savedGame);

// ---------- 필드 이동/렌더링 ----------
function drawEmoji(ch, x, y, size) {
  fctx.font = `${size}px sans-serif`;
  fctx.textAlign = 'center';
  fctx.textBaseline = 'middle';
  fctx.fillText(ch, x, y);
}

function renderField() {
  const rows = currentMap().rows;
  const mapH = rows.length, mapW = rows[0].length;
  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      const t = tileAt(x, y);
      fctx.fillStyle = t === '#' ? '#3a5230' : t === 'H' ? '#4a3b2a' : t === ',' ? '#4f7a3a'
        : t === '~' ? '#2b5c78' : t === 'r' ? '#5c6b3a' : '#3f5d34';
      fctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      fctx.strokeStyle = 'rgba(0,0,0,0.15)';
      fctx.strokeRect(x * TILE, y * TILE, TILE, TILE);
      if (t === '#') drawEmoji('🌳', x * TILE + TILE / 2, y * TILE + TILE / 2, 28);
      else if (t === 'H') drawEmoji('🏠', x * TILE + TILE / 2, y * TILE + TILE / 2, 32);
      else if (t === ',') drawEmoji('🌾', x * TILE + TILE / 2, y * TILE + TILE / 2, 24);
      else if (t === '~') drawEmoji('🌊', x * TILE + TILE / 2, y * TILE + TILE / 2, 22);
      else if (t === 'r') drawEmoji('🐾', x * TILE + TILE / 2, y * TILE + TILE / 2, 18);
      else if (t === '>' || t === '<' || t === '^') drawEmoji('🚪', x * TILE + TILE / 2, y * TILE + TILE / 2, 26);
    }
  }
  for (const npc of visibleNpcs()) drawEmoji(npc.icon, npc.gx * TILE + TILE / 2, npc.gy * TILE + TILE / 2, 30);
  drawEmoji('🧑', player.gx * TILE + TILE / 2, player.gy * TILE + TILE / 2, 30);
  updateFieldHud();
}

function updateFieldHud() {
  document.getElementById('hud-level').textContent = `Lv.${player.level}`;
  document.getElementById('hud-hp').textContent = `체력 ${player.hp}/${player.maxHp}`;
  document.getElementById('hud-gold').textContent = `골드 ${player.gold}`;
  const caught = SPECIES.filter((s) => dex[s.id].caught).length;
  document.getElementById('hud-dex').textContent = `도감 ${caught}/${SPECIES.length}`;
}

window.addEventListener('keydown', (e) => {
  if (gameMode !== 'field' || !canMove) return;
  const k = e.key.toLowerCase();
  let dx = 0, dy = 0;
  if (k === 'arrowup' || k === 'w') dy = -1;
  else if (k === 'arrowdown' || k === 's') dy = 1;
  else if (k === 'arrowleft' || k === 'a') dx = -1;
  else if (k === 'arrowright' || k === 'd') dx = 1;
  else return;

  const nx = player.gx + dx, ny = player.gy + dy;
  const npc = visibleNpcs().find((n) => n.gx === nx && n.gy === ny);
  if (npc) { interactNPC(npc); return; }

  const exitTarget = (currentMap().exits || {})[tileAt(nx, ny)];
  if (exitTarget) {
    changeMap(exitTarget);
    return;
  }

  if (!isWalkable(nx, ny)) return;
  player.gx = nx; player.gy = ny;
  canMove = false;
  setTimeout(() => { canMove = true; }, 150);
  renderField();
  saveGame();
  maybeEncounter();
});

// 다른 맵(마을 ⇄ 풀숲)으로 넘어간다.
function changeMap(exitTo) {
  player.mapId = exitTo.map;
  player.gx = exitTo.x;
  player.gy = exitTo.y;
  canMove = false;
  setTimeout(() => { canMove = true; }, 200);
  renderField();
  saveGame();
}

// ---------- NPC 상호작용 ----------
let activeDialogueNpc = null;

function interactNPC(npc) {
  if (npc.type === 'shop') { openShop(); return; }
  if (npc.type === 'fishing') { openFishing(); return; }
  showDialogue(npc);
}

function showDialogue(npc) {
  activeDialogueNpc = npc;
  gameMode = 'dialogue';
  document.getElementById('dialogue-name').textContent = npc.name;
  document.getElementById('dialogue-text').textContent = npc.lines;
  document.getElementById('dialogue-screen').classList.remove('hidden');
}
document.getElementById('dialogue-close-btn').addEventListener('click', () => {
  document.getElementById('dialogue-screen').classList.add('hidden');
  gameMode = 'field';
  if (activeDialogueNpc && activeDialogueNpc.disappearAfter) {
    player.dismissedNpcs = player.dismissedNpcs || [];
    if (!player.dismissedNpcs.includes(activeDialogueNpc.id)) player.dismissedNpcs.push(activeDialogueNpc.id);
    saveGame();
    renderField();
  }
  activeDialogueNpc = null;
});

// ---------- 상점 ----------
const SHOP_PRICES = { potion: 8, net: 5, planttool: 5, bait: 4 };

function openShop() {
  gameMode = 'shop';
  document.getElementById('shop-msg').textContent = '';
  document.getElementById('shop-gold').textContent = player.gold;
  document.getElementById('shop-screen').classList.remove('hidden');
}
document.getElementById('close-shop-btn').addEventListener('click', () => {
  document.getElementById('shop-screen').classList.add('hidden');
  gameMode = 'field';
});
document.querySelectorAll('#shop-screen [data-item]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const item = btn.dataset.item;
    const price = SHOP_PRICES[item];
    if (player.gold < price) {
      document.getElementById('shop-msg').textContent = '골드가 부족합니다.';
      return;
    }
    player.gold -= price;
    if (item === 'potion') player.potions += 1;
    else if (item === 'net') player.nets += 1;
    else if (item === 'planttool') player.plantTools += 1;
    else if (item === 'bait') player.bait += 1;
    document.getElementById('shop-gold').textContent = player.gold;
    document.getElementById('shop-msg').textContent = '구매했습니다!';
    updateFieldHud();
    saveGame();
  });
});

// ---------- 낚시 ----------
let fishingAnim = null;
let fishingPos = 0;
const FISHING_ZONE = { start: 40, end: 60 }; // % 위치 기준 성공 구간

function openFishing() {
  const remaining = SPECIES.filter((s) => s.type === 'fish' && !dex[s.id].caught);
  if (remaining.length === 0) { showDialogue({ name: '낚시 포인트', lines: '더 이상 낚을 물고기가 없습니다.' }); return; }
  if (player.bait <= 0) { showDialogue({ name: '낚시 포인트', lines: '미끼가 없습니다! 마을 상점에서 구매하세요.' }); return; }
  gameMode = 'fishing';
  document.getElementById('fishing-msg').textContent = '';
  document.getElementById('fishing-bait').textContent = player.bait;
  const zone = document.getElementById('fishing-zone');
  zone.style.left = FISHING_ZONE.start + '%';
  zone.style.width = (FISHING_ZONE.end - FISHING_ZONE.start) + '%';
  document.getElementById('fishing-screen').classList.remove('hidden');
  startFishingAnim();
}

function startFishingAnim() {
  const startTime = performance.now();
  function tick(now) {
    const t = (now - startTime) / 1000;
    fishingPos = (Math.sin(t * 3) + 1) / 2 * 100;
    document.getElementById('fishing-marker').style.left = fishingPos + '%';
    fishingAnim = requestAnimationFrame(tick);
  }
  fishingAnim = requestAnimationFrame(tick);
}

function stopFishingAnim() {
  if (fishingAnim) cancelAnimationFrame(fishingAnim);
  fishingAnim = null;
}

function endFishing() {
  stopFishingAnim();
  document.getElementById('fishing-screen').classList.add('hidden');
  gameMode = 'field';
  renderField();
  checkWinCondition();
}

document.getElementById('close-fishing-btn').addEventListener('click', endFishing);

document.getElementById('fishing-reel-btn').addEventListener('click', () => {
  if (gameMode !== 'fishing' || player.bait <= 0) return;
  stopFishingAnim();
  player.bait -= 1;
  document.getElementById('fishing-bait').textContent = player.bait;
  const hit = fishingPos >= FISHING_ZONE.start && fishingPos <= FISHING_ZONE.end;
  if (hit) {
    const remaining = SPECIES.filter((s) => s.type === 'fish' && !dex[s.id].caught);
    const species = remaining[Math.floor(Math.random() * remaining.length)];
    dex[species.id].met = true;
    dex[species.id].caught = true;
    sfx.captureSuccess();
    player.gold += species.gold;
    gainExp(species.exp);
    document.getElementById('fishing-msg').textContent = `손맛! ${species.name}을(를) 낚았다! (골드 ${species.gold})`;
    updateFieldHud();
    saveGame();
    setTimeout(endFishing, 900);
    return;
  }
  sfx.captureFail();
  document.getElementById('fishing-msg').textContent = '아쉽지만 놓쳤다...';
  saveGame();
  const stillHasFish = SPECIES.some((s) => s.type === 'fish' && !dex[s.id].caught);
  if (player.bait > 0 && stillHasFish) {
    setTimeout(startFishingAnim, 700);
  }
});

function maybeEncounter() {
  const t = tileAt(player.gx, player.gy);
  if (t !== ',' && t !== 'r') return;
  const remaining = SPECIES.filter((s) => s.map === player.mapId && s.type !== 'fish' && !dex[s.id].caught);
  if (remaining.length === 0) return; // 다 잡았으면 더 이상 안 나타남
  if (Math.random() < 0.22) {
    const species = remaining[Math.floor(Math.random() * remaining.length)];
    startBattle(species.id);
  }
}

document.getElementById('inventory-btn').addEventListener('click', () => {
  if (gameMode !== 'field') return;
  openInventory();
});
document.getElementById('close-inventory-btn').addEventListener('click', () => {
  document.getElementById('inventory-screen').classList.add('hidden');
  gameMode = 'field';
});

function openInventory() {
  gameMode = 'inventory';
  const rows = [
    ['💰 골드', player.gold],
    ['🧪 회복 물약', player.potions],
    ['🥅 그물 (동물 포획용)', player.nets],
    ['✂️ 채집 도구 (식물 채집용)', player.plantTools],
    ['🪱 미끼 (낚시용)', player.bait],
  ];
  document.getElementById('inventory-list').innerHTML = rows
    .map(([label, count]) => `<div class="inv-row"><span>${label}</span><span>${count}</span></div>`)
    .join('');
  document.getElementById('inventory-screen').classList.remove('hidden');
}

document.getElementById('dex-btn').addEventListener('click', () => {
  if (gameMode !== 'field') return;
  openDex();
});
document.getElementById('close-dex-btn').addEventListener('click', () => {
  document.getElementById('dex-screen').classList.add('hidden');
  gameMode = 'field';
});

function openDex() {
  gameMode = 'dex';
  const html = SPECIES.map((s) => {
    const d = dex[s.id];
    if (!d.met) {
      return `<div class="dex-card"><div class="icon">❓</div><div class="info"><div class="title">???</div><div class="desc">아직 만나지 못했습니다.</div></div></div>`;
    }
    const typeLabel = s.type === 'plant' ? '식물' : s.type === 'fish' ? '어류' : '동물';
    const status = d.caught ? '✅ 포획 완료' : '👀 목격함 (아직 포획하지 못함)';
    const desc = d.caught ? `<br>${s.desc}` : '';
    return `<div class="dex-card ${d.caught ? 'caught' : ''}"><div class="icon">${s.icon}</div><div class="info"><div class="title">${s.name} (${typeLabel})</div><div class="desc">${status}${desc}</div></div></div>`;
  }).join('');
  document.getElementById('dex-list').innerHTML = html;
  document.getElementById('dex-screen').classList.remove('hidden');
}

// ---------- 전투 ----------
function logBattle(msg) {
  const el = document.getElementById('battle-log');
  const line = document.createElement('div');
  line.textContent = msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function startBattle(speciesId) {
  const species = SPECIES.find((s) => s.id === speciesId);
  dex[speciesId].met = true;
  battle = { species, hp: species.maxHp, maxHp: species.maxHp };
  battleLocked = false;
  gameMode = 'battle';
  document.getElementById('battle-log').innerHTML = '';
  document.getElementById('battle-screen').classList.remove('hidden');
  document.getElementById('cmd-capture').textContent = species.type === 'plant' ? '채집' : '포획';
  logBattle(`야생의 ${species.name}이(가) 나타났다!`);
  renderBattle();
  saveGame();
}

function renderBattle() {
  document.getElementById('enemy-sprite').textContent = battle.species.icon;
  document.getElementById('enemy-name').textContent = `${battle.species.name} (${battle.species.type === 'plant' ? '식물' : '동물'})`;
  document.getElementById('enemy-hp-bar').style.width = `${Math.max(0, (battle.hp / battle.maxHp) * 100)}%`;
  document.getElementById('player-hp-bar').style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
}

function endBattle() {
  document.getElementById('battle-screen').classList.add('hidden');
  battle = null;
  gameMode = 'field';
  saveGame();
  renderField();
}

function gainExp(amount) {
  player.xp += amount;
  logBattle(`경험치 ${amount} 획득!`);
  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level += 1;
    player.maxHp += 5;
    player.hp = player.maxHp;
    player.atk += 2;
    player.xpToNext = Math.floor(player.xpToNext * 1.3 + 10);
    logBattle(`레벨 업! Lv.${player.level}`);
    sfx.levelup();
  }
}

// 처치(captured=false)와 포획/채집 성공(captured=true) 공통 처리
function resolveVictory(captured) {
  if (captured) {
    dex[battle.species.id].caught = true;
    sfx.captureSuccess();
  }
  gainExp(battle.species.exp);
  player.gold += battle.species.gold;
  logBattle(`골드 ${battle.species.gold} 획득!`);
  updateFieldHud();
  renderBattle();
  setTimeout(() => {
    endBattle();
    checkWinCondition();
  }, 900);
}

function resolveEnemyTurn() {
  if (!battle) return;
  if (battle.species.type === 'animal') {
    const dmg = Math.max(1, Math.round(battle.species.atk * (0.8 + Math.random() * 0.4)));
    player.hp -= dmg;
    logBattle(`${battle.species.name}의 반격! ${dmg}의 피해를 입었다.`);
  } else if (battle.species.thorn) {
    player.hp -= battle.species.thorn;
    logBattle(`가시에 찔려 ${battle.species.thorn}의 피해를 입었다.`);
  }
  renderBattle();
  if (player.hp <= 0) {
    handleDefeat();
    return;
  }
  battleLocked = false;
}

function handleDefeat() {
  sfx.defeat();
  logBattle('쓰러졌다... 마을로 돌아간다.');
  player.hp = player.maxHp;
  setTimeout(() => {
    player.mapId = 'village';
    player.gx = MAPS.wild.exits['<'].x;
    player.gy = MAPS.wild.exits['<'].y;
    endBattle();
  }, 1000);
}

function checkWinCondition() {
  if (SPECIES.every((s) => dex[s.id].caught)) {
    setTimeout(() => {
      document.getElementById('field-screen').classList.add('hidden');
      document.getElementById('clear-screen').classList.remove('hidden');
      gameMode = 'clear';
    }, 300);
  }
}

document.getElementById('cmd-attack').addEventListener('click', () => {
  if (gameMode !== 'battle' || battleLocked) return;
  battleLocked = true;
  const dmg = Math.max(1, Math.round(player.atk * (0.8 + Math.random() * 0.4)));
  battle.hp -= dmg;
  sfx.attack();
  logBattle(`공격! ${battle.species.name}에게 ${dmg}의 피해.`);
  renderBattle();
  if (battle.hp <= 0) {
    logBattle(`${battle.species.name}을(를) 물리쳤다! (도감에는 등록되지 않음)`);
    resolveVictory(false);
    return;
  }
  setTimeout(resolveEnemyTurn, 500);
});

document.getElementById('cmd-capture').addEventListener('click', () => {
  if (gameMode !== 'battle' || battleLocked) return;
  const isPlant = battle.species.type === 'plant';
  const verb = isPlant ? '채집' : '포획';
  const toolName = isPlant ? '채집 도구' : '그물';
  if ((isPlant ? player.plantTools : player.nets) <= 0) {
    logBattle(`${toolName}이(가) 없습니다! 마을 상점에서 구매하세요.`);
    return;
  }
  battleLocked = true;
  if (isPlant) player.plantTools -= 1; else player.nets -= 1;
  const ratio = battle.hp / battle.maxHp;
  const successRate = Math.min(0.9, Math.max(0.1, 0.9 - ratio * 0.7));
  if (Math.random() < successRate) {
    logBattle(`${verb} 성공! ${battle.species.name}이(가) 도감에 등록되었다.`);
    resolveVictory(true);
  } else {
    sfx.captureFail();
    logBattle(`${verb} 실패... 도구가 소모되었다.`);
    setTimeout(resolveEnemyTurn, 500);
  }
});

document.getElementById('cmd-item').addEventListener('click', () => {
  if (gameMode !== 'battle' || battleLocked) return;
  if (player.potions <= 0) {
    logBattle('회복 물약이 없습니다! 마을 상점에서 구매하세요.');
    return;
  }
  battleLocked = true;
  player.potions -= 1;
  const healed = Math.min(15, player.maxHp - player.hp);
  player.hp += healed;
  logBattle(`회복 물약 사용! 체력을 ${healed} 회복했다.`);
  renderBattle();
  setTimeout(resolveEnemyTurn, 500);
});

document.getElementById('cmd-flee').addEventListener('click', () => {
  if (gameMode !== 'battle' || battleLocked) return;
  battleLocked = true;
  if (Math.random() < 0.7) {
    logBattle('무사히 도망쳤다.');
    setTimeout(endBattle, 700);
  } else {
    logBattle('도망에 실패했다!');
    setTimeout(resolveEnemyTurn, 500);
  }
});

document.getElementById('restart-btn').addEventListener('click', () => {
  localStorage.removeItem(SAVE_KEY);
  document.getElementById('clear-screen').classList.add('hidden');
  document.getElementById('continue-btn').classList.add('hidden');
  document.getElementById('title-screen').classList.remove('hidden');
  gameMode = 'title';
});
