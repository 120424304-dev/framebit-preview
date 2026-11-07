"use strict";
// 帧比特 3.5.1 · Bit 家园：成长值与 bitcoin + 2.5D 体素小岛（种地 / 养动物 / 养鱼钓鱼 / 布置小屋）
// 成长值只来自「交付导出」；bitcoin 来自每日登录、日常创作、每日委托和家园里的小事。创作越多，家园越热闹。
// 画面由 bhvox.js 的体素渲染器画出：和桌宠 Bit 一样的白色方块、黑色描边、浅薄荷绿和少量亮色。

// ---------- 数值表 ----------
const LEVEL_XP = L => 15 * (L - 1) * (L + 2); // 到达 L 级需要的累计成长值
const RANKS = [[1, "像素学徒"], [3, "分镜新手"], [5, "片场助理"], [7, "副导演"], [10, "导演"], [14, "金牌编导"], [20, "传奇制片人"]];
const EXPORT_XP = { pack: 40, shoot: 15, edit: 15, audit: 15, publish: 15, cover: 15, edl: 10, workflow: 5 };
const EXPORT_NAME = { pack: "完整内容包", shoot: "拍摄包", edit: "剪辑包", audit: "审核包", publish: "发布包", cover: "封面", edl: "粗剪单", workflow: "画布工作流" };
const CREATE_COINS = { script: 3, image: 1, video: 4, audio: 2, text: 1, export: 5 };
const DAILY_CREATE_CAP = 80;
const TASKS = [
  { k: "export", name: "导出一次交付物料", need: 1, coins: 20, xp: 5, make: true },
  { k: "image", name: "生成 3 张画面", need: 3, coins: 12, xp: 3, make: true },
  { k: "script", name: "让 AI 写一版脚本", need: 1, coins: 12, xp: 3, make: true },
  { k: "video", name: "生成 1 段视频", need: 1, coins: 15, xp: 4, make: true },
  { k: "text", name: "AI 润色、拆分或拆解一次", need: 1, coins: 10, xp: 2, make: true },
  { k: "pat", name: "摸摸 Bit 3 次", need: 3, coins: 8, xp: 2 },
  { k: "harvest", name: "在家园收获 2 次", need: 2, coins: 10, xp: 2 },
  { k: "feed", name: "喂 Bit 吃一次东西", need: 1, coins: 8, xp: 2 },
  { k: "collect", name: "收集 1 个动物产物", need: 1, coins: 10, xp: 2 }
];
const CROPS = {
  carrot: { name: "萝卜", seed: 5, grow: 8, sell: 9, food: 12, lv: 1, c: "#FF8A3D" },
  tomato: { name: "番茄", seed: 10, grow: 20, sell: 18, food: 16, lv: 2, c: "#E8483B" },
  strawberry: { name: "草莓", seed: 16, grow: 40, sell: 30, food: 20, lv: 3, c: "#FF4F7B" },
  pumpkin: { name: "南瓜", seed: 24, grow: 90, sell: 48, food: 30, lv: 5, c: "#F29A1F" },
  sunflower: { name: "向日葵", seed: 30, grow: 180, sell: 62, food: 10, lv: 7, c: "#FFD23F" }
};
const ANIMALS = {
  chick: { name: "小鸡", price: 40, lv: 1, every: 30, product: "egg" },
  duck: { name: "鸭子", price: 70, lv: 3, every: 45, product: "duckegg" },
  bunny: { name: "兔子", price: 90, lv: 4, every: 60, product: "fur" },
  sheep: { name: "小羊", price: 160, lv: 8, every: 90, product: "wool" }
};
const GOODS = { egg: { name: "鸡蛋", sell: 12, food: 14 }, duckegg: { name: "鸭蛋", sell: 20, food: 18 }, fur: { name: "兔毛", sell: 32 }, wool: { name: "羊毛", sell: 55 } };
const FISH = {
  crucian: { name: "鲫鱼", price: 12, lv: 1, grow: 40, sell: 24, food: 22 },
  goldfish: { name: "金鱼", price: 20, lv: 2, grow: 60, sell: 40, score: 2 },
  koi: { name: "锦鲤", price: 30, lv: 3, grow: 120, sell: 66, score: 4 }
};
const FACILITIES = {
  farm2: { name: "扩建农田", price: 200, lv: 3, desc: "再开一排 6 块地" },
  pen: { name: "扩建围栏", price: 120, lv: 2, desc: "围栏多住 1 只（最多 6 只）" },
  pond: { name: "扩建池塘", price: 100, lv: 2, desc: "池塘多养 1 条（最多 6 条）" },
  sprinkler: { name: "洒水器", price: 300, lv: 4, desc: "农田一直保持湿润，长得快 50%" },
  windmill: { name: "风车", price: 500, lv: 6, desc: "所有作物再快 20%，家园评分 +10" }
};
const FURNI = {
  bed: { name: "小床", price: 80, lv: 1, score: 5, fp: [1, 2], note: "晚上 Bit 会回床上睡觉" },
  desk: { name: "书桌", price: 90, lv: 1, score: 5, fp: [2, 1], note: "Bit 会坐在这里陪你写稿" },
  lamp2: { name: "台灯", price: 35, lv: 1, score: 2, fp: [1, 1], note: "晚上会亮" },
  plant: { name: "绿植", price: 30, lv: 1, score: 2, fp: [1, 1] },
  rug: { name: "地毯", price: 50, lv: 2, score: 3, fp: [2, 2], note: "可以把家具摆在上面" },
  poster: { name: "电影立牌", price: 40, lv: 2, score: 3, fp: [1, 1] },
  shelf: { name: "书架", price: 110, lv: 3, score: 6, fp: [1, 1] },
  tv: { name: "电视", price: 180, lv: 5, score: 8, fp: [2, 1], note: "Bit 会坐下来看片" },
  camera: { name: "摄影机", price: 260, lv: 6, score: 10, fp: [1, 1] },
  trophy: { name: "金奖杯", price: 400, lv: 10, score: 16, fp: [1, 1], note: "导演段位的证明" }
};
const DECOR = {
  flowers: { name: "花丛", price: 25, lv: 1, score: 2, fp: [1, 1], walk: true },
  bush: { name: "灌木", price: 15, lv: 1, score: 1, fp: [1, 1] },
  tree: { name: "小树", price: 50, lv: 1, score: 3, fp: [1, 1] },
  lamp: { name: "路灯", price: 40, lv: 1, score: 3, fp: [1, 1], note: "晚上会亮" },
  rock: { name: "石头", price: 10, lv: 1, score: 1, fp: [1, 1] },
  bench: { name: "长椅", price: 60, lv: 2, score: 4, fp: [2, 1], note: "Bit 会坐下来歇一会儿" },
  pinktree: { name: "樱花树", price: 90, lv: 3, score: 5, fp: [1, 1], note: "会飘花瓣" },
  lightstand: { name: "片场灯架", price: 120, lv: 4, score: 6, fp: [1, 1], note: "晚上会亮" },
  fountain: { name: "小喷泉", price: 220, lv: 5, score: 9, fp: [1, 1], note: "点一下溅水花" },
  mailbox: { name: "邮箱", price: 45, lv: 2, score: 3, fp: [1, 1], hidden: true }
};
const SHOP_TABS = [["seed", "种子"], ["animal", "家禽"], ["fish", "鱼苗"], ["facility", "设施"], ["furni", "家具"], ["decor", "装饰"]];

// ---------- 成长与 bitcoin ----------
const petLevel = (xp = state.pet.xp) => { let L = 1; while (xp >= LEVEL_XP(L + 1)) L++; return L; };
const petRank = (L = petLevel()) => [...RANKS].reverse().find(([lv]) => L >= lv)[1];
function petEarn({ xp = 0, coins = 0, why = "" }) {
  const pt = state.pet; const before = petLevel();
  pt.xp += xp; pt.coins += coins;
  if (xp || coins) { pt.history.push({ t: now(), xp, coins, why }); if (pt.history.length > 80) pt.history.splice(0, pt.history.length - 80); }
  const after = petLevel();
  const fl = (t, c) => BH.open ? bhHudFloat(t, c) : petFloat(t, c);
  if (xp) fl(`+${xp} 成长值`, "xp");
  if (coins) setTimeout(() => fl(`+${coins} ₿`, "coin"), xp ? 380 : 0);
  if (after > before) setTimeout(() => petLevelUp(after), 600);
  save(); bhRefreshHud();
}
function petLevelUp(L) {
  const rank = petRank(L); const rankUp = petRank(L - 1) !== rank;
  petReact("levelup", rankUp ? `升到 Lv.${L}，段位变成「${rank}」啦！` : `升到 Lv.${L} 啦！`);
  const b = document.createElement("div"); b.className = "lvup"; b.setAttribute("role", "status");
  b.innerHTML = `<span class="px">LEVEL UP</span><b class="px-36">Lv.${L}</b><span class="px">${esc(rank)}${rankUp ? "　· 新段位" : ""}</span>${bhUnlocksAt(L).length ? `<em class="px">解锁：${esc(bhUnlocksAt(L).join("、"))}</em>` : ""}`;
  document.body.appendChild(b); setTimeout(() => b.classList.add("out"), 2600); setTimeout(() => b.remove(), 3000);
  state.pet.seenLevel = L; save();
}
function bhUnlocksAt(L) {
  const out = [];
  Object.values(CROPS).forEach(c => c.lv === L && out.push(`${c.name}种子`));
  [ANIMALS, FISH, FACILITIES, FURNI, DECOR].forEach(t => Object.values(t).forEach(x => x.lv === L && !x.hidden && out.push(x.name)));
  return out;
}
function petDailyReset() {
  const pt = state.pet; const today = dayKey();
  if (pt.daily.date === today) { if (!pt.daily.pick?.length) pt.daily.pick = bhPickTasks(today); return false; }
  pt.daily = { date: today, coins: 0, tasks: {}, claimed: {}, pets: 0, pick: bhPickTasks(today) };
  return true;
}
function bhPickTasks(today) {
  let h = 0; for (const c of today) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => { h = (h * 1103515245 + 12345) >>> 0; return (h >>> 8) / 16777216; };
  const make = TASKS.filter(t => t.make), home = TASKS.filter(t => !t.make);
  const a = make[Math.floor(rnd() * make.length)], b = home[Math.floor(rnd() * home.length)];
  const rest = TASKS.filter(t => t !== a && t !== b); const c = rest[Math.floor(rnd() * rest.length)];
  return [a.k, b.k, c.k];
}
// 每天第一次打开：签到 + 连续登录奖励
function petDaily() {
  const pt = state.pet; const today = dayKey();
  petStatsUpdate();
  if (pt.lastLogin === today) { petDailyReset(); return; }
  const y = new Date(); y.setDate(y.getDate() - 1);
  pt.streak = pt.lastLogin === dayKey(y) ? pt.streak + 1 : 1;
  pt.lastLogin = today; petDailyReset();
  const bonus = Math.min(30, (pt.streak - 1) * 5);
  petEarn({ coins: 20 + bonus, why: pt.streak > 1 ? `每日登录 · 连续 ${pt.streak} 天` : "每日登录" });
  petSay(pt.streak > 1 ? `早呀！连续第 ${pt.streak} 天见面，送你 ${20 + bonus} ₿` : `欢迎回来！今天的 20 ₿ 放进家园啦`, 4200);
}
// 创作事件：script / image / video / audio / text / export / pat / harvest / feed / collect
function petEvent(kind, n = 1, extra = {}) {
  if (!state?.pet) return;
  const pt = state.pet; petDailyReset();
  const d = pt.daily; d.tasks[kind] = (d.tasks[kind] || 0) + n;
  if (kind === "pat") { pt.stats.mood = clamp(pt.stats.mood + 6, 0, 100); d.pets += 1; }
  const per = CREATE_COINS[kind] || 0;
  if (per) {
    const give = Math.min(per * n, Math.max(0, DAILY_CREATE_CAP - d.coins));
    if (give > 0) { d.coins += give; pt.coins += give; pt.history.push({ t: now(), xp: 0, coins: give, why: { script: "AI 写脚本", image: "生成画面", video: "生成视频", audio: "生成配乐", text: "AI 文本", export: "导出" }[kind] }); if (pt.history.length > 80) pt.history.splice(0, pt.history.length - 80); setTimeout(() => BH.open ? bhHudFloat(`+${give} ₿`, "coin") : petFloat(`+${give} ₿`, "coin"), 200); }
    if (kind !== "export" && PET.el && PET.mode !== "sleep") petReact("hop", give && Math.random() < .35 ? pick(["做得好！", "又多了一点素材", "Bit 存起来啦"]) : "");
  }
  // 委托完成提示
  (d.pick || []).forEach(k => { const t = TASKS.find(x => x.k === k); if (t && k === kind && (d.tasks[k] || 0) >= t.need && (d.tasks[k] || 0) - n < t.need) setTimeout(() => petSay(`委托「${t.name}」完成，去家园领奖励吧`, 3200), 900); });
  save(); bhRefreshHud(); if (BH.open && BH.tab === "tasks") bhRenderSide();
}
// 交付导出给成长值：同一项目同一种导出每天只算一次
function petOnExport(p, kind) {
  if (!EXPORT_XP[kind]) return;
  const key = `${p.id}:${kind}:${dayKey()}`; const pt = state.pet;
  petEvent("export");
  if (pt.keys.includes(key)) { petSay("这份今天已经算过成长值啦", 1800); return; }
  pt.keys.push(key); if (pt.keys.length > 240) pt.keys.splice(0, pt.keys.length - 240);
  petEarn({ xp: EXPORT_XP[kind], why: `交付「${(p.title || "未命名").slice(0, 14)}」· ${EXPORT_NAME[kind]}` });
  petReact("hop", kind === "pack" ? "整包交付！成长值 +40" : `交付成功，成长值 +${EXPORT_XP[kind]}`);
}
// 体力、饱腹、心情随真实时间变化（不会降到 0，Bit 不会因为你忙而出事）
function petStatsUpdate() {
  const s = state.pet.stats; const t = Date.now(); const last = new Date(s.at).getTime() || t;
  const hrs = clamp((t - last) / 3.6e6, 0, 24); if (hrs < 1 / 120) return;
  const h = new Date().getHours(); const night = h >= 23 || h < 7;
  s.food = clamp(s.food - 7 * hrs, 5, 100); s.mood = clamp(s.mood - 4 * hrs + bhRating() / 60 * hrs, 5, 100);
  s.energy = clamp(s.energy + (night ? 14 : -4) * hrs, 5, 100); s.at = now();
}

// ---------- 家园世界：16×14 格的小岛，每格 8×8 体素 ----------
const HTW = 16, HTH = 14, HTS = 8, WXV = HTW * HTS, WYV = HTH * HTS, GZ = 5, BZ = -5;
const VBW = 496, VBH = 344, VOY = 84; // 渲染缓冲尺寸与原点
const tileId = (tx, ty) => 1 + ty * HTW + tx;
const PID = { plot: 1000, animal: 1100, fish: 1200, decor: 1300, furni: 1400, wall: 1500, mailbox: 1501, windmill: 1502, pond: 1503, trough: 1504, sprinkler: 1505, dock: 1506, fence: 1507, scarecrow: 1508, millspot: 1509, sprspot: 1510, sign: 1511, prod: 1600, bit: 1700 };
const ROADS = new Set();
for (let x = 5; x < HTW; x++) ROADS.add(x + 4 * HTW);
for (let y = 4; y < HTH; y++) ROADS.add(6 + y * HTW);
ROADS.add(5 + 2 * HTW); ROADS.add(5 + 3 * HTW);
const FIXED = [
  { k: "tree", tx: 15, ty: 0, seed: 3, big: true }, { k: "pinktree", tx: 0, ty: 6, seed: 2 }, { k: "tree", tx: 15, ty: 13, seed: 5 },
  { k: "tree", tx: 10, ty: 13, seed: 9 }, { k: "bush", tx: 0, ty: 5, seed: 1 }, { k: "bush", tx: 12, ty: 13, seed: 4 },
  { k: "rock", tx: 0, ty: 13, seed: 2 }, { k: "rock", tx: 13, ty: 10, seed: 6 }, { k: "flowers", tx: 9, ty: 13, seed: 3 }, { k: "sign", tx: 7, ty: 12 }
];
const FIXED_AT = new Set(FIXED.map(f => f.tx + f.ty * HTW));
const POND_C = { x: 28, y: 84, rw: 15.2, rs: 18.4 };
const DOCK = { x0: 33, x1: 47, y0: 82, y1: 85 };
const PEN_V = { x0: 89, x1: 126, y0: 41, y1: 70, gate0: 104, gate1: 111 };
const PEN_IN = { x0: 92, x1: 121, y0: 44, y1: 65 };
const FRONT = [[0, 1], [-1, 0], [0, -1], [1, 0]];

function tileKind(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= HTW || ty >= HTH) return "void";
  if (tx <= 4 && ty <= 4) return "house";
  if (ROADS.has(tx + ty * HTW)) return "path";
  if (tx >= 7 && tx <= 12 && ty >= 1 && ty <= 2) return "farm";
  if (tx >= 11 && ty >= 5 && ty <= 8) return "pen";
  if (tx >= 1 && tx <= 5 && ty >= 8 && ty <= 12) return ty === 10 && tx >= 4 ? "dock" : "pond";
  if (tx >= 14 && ty >= 11 && ty <= 12) return "windmill";
  if (tx === 5 && ty === 5) return "mailbox";
  if (tx === 13 && ty === 1) return "sprinkler";
  if (tx === 13 && ty === 2) return "scarecrow";
  if (FIXED_AT.has(tx + ty * HTW)) return "scenery";
  return "grass";
}
const plotTile = i => ({ x: 7 + (i % 6), y: 1 + Math.floor(i / 6) });
const fpOf = (def, r) => { const f = def?.fp || [1, 1]; return r % 2 ? [f[1], f[0]] : [f[0], f[1]]; };
function bhIsland(x, y) {
  const R = 6; const cx = x < R ? R : x > WXV - 1 - R ? WXV - 1 - R : x, cy = y < R ? R : y > WYV - 1 - R ? WYV - 1 - R : y;
  return (x - cx) ** 2 + (y - cy) ** 2 <= R * R + 1;
}
function bhRating() {
  const h = state?.pet?.home; if (!h) return 0;
  return h.furniture.reduce((a, f) => a + (FURNI[f.kind]?.score || 0), 0) + h.decor.reduce((a, d) => a + (DECOR[d.kind]?.score || 0), 0) + h.animals.length * 4 + h.fish.reduce((a, f) => a + 1 + (FISH[f.kind]?.score || 0), 0) + (h.owned.windmill ? 10 : 0) + (h.owned.sprinkler ? 4 : 0) + h.plots.filter(p => p.crop).length;
}
const home = () => state.pet.home;
function bhEnsurePlots() {
  const h = home(); const n = h.owned.farm2 ? 12 : 6;
  for (let i = 0; i < n; i++) if (!h.plots[i]) h.plots[i] = { i, crop: "", prog: 0, at: Date.now(), wet: 0 };
  h.plots = h.plots.slice(0, n).map((p, i) => ({ i, crop: "", prog: 0, at: Date.now(), wet: 0, ...p, i }));
}
// 作物生长：按真实时间推进；浇过水的时段长得快 50%，风车再快 20%
function bhGrow() {
  const h = home(); const t = Date.now(); const mill = h.owned.windmill ? 1.2 : 1;
  h.plots.forEach(p => {
    if (!p.crop || p.prog >= 1) { p.at = t; return; }
    const c = CROPS[p.crop]; const dt = Math.max(0, t - (p.at || t)) / 60000;
    const wetUntil = h.owned.sprinkler ? Infinity : (p.wet || 0);
    const wetMin = Math.max(0, Math.min(t, wetUntil) - (p.at || t)) / 60000;
    p.prog = Math.min(1, p.prog + ((dt - wetMin) + wetMin * 1.5) * mill / c.grow);
    p.at = t;
  });
}
const cropStage = p => !p.crop ? -1 : p.prog >= 1 ? 3 : p.prog > .55 ? 2 : p.prog > .12 ? 1 : 0;
const plotWet = p => home().owned.sprinkler || (p.wet || 0) > Date.now();
const minsLeft = p => { const c = CROPS[p.crop]; if (!c) return 0; const sp = (plotWet(p) ? 1.5 : 1) * (home().owned.windmill ? 1.2 : 1); return Math.max(1, Math.ceil((1 - p.prog) * c.grow / sp)); };
const animalReady = a => Date.now() - (a.last || 0) >= ANIMALS[a.kind].every * 60000;
const fishGrown = f => Date.now() - new Date(f.at).getTime() >= FISH[f.kind].grow * 60000;
const fmtMin = m => m >= 60 ? `${Math.floor(m / 60)} 小时 ${m % 60 ? `${m % 60} 分` : ""}`.trim() : `${m} 分钟`;
const dayPhase = () => { if (BH.forcePhase) return BH.forcePhase; const h = new Date().getHours() + new Date().getMinutes() / 60; return h >= 6.5 && h < 17.5 ? "day" : h >= 17.5 && h < 19.5 ? "dusk" : h >= 5.5 && h < 6.5 ? "dawn" : "night"; };
// 天气：每 2 小时一段，按日期算出来，所有人看到的一样；下雨会自动浇地
function bhWeather() {
  if (BH.forceWeather) return BH.forceWeather;
  const d = new Date(); const key = `${dayKey(d)}:${Math.floor(d.getHours() / 2)}`; let h = 7; for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const r = vxHash(h, 11); return r < .16 ? "rain" : r < .44 ? "cloud" : "sun";
}

// 占地：家具在小屋里，装饰在草地上
function bhOccupancy(skipId = "") {
  const h = home(); const occ = new Map();
  h.furniture.forEach(f => { if (f.id === skipId || !FURNI[f.kind]) return; const [w, d] = fpOf(FURNI[f.kind], f.r || 0); for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) { const k = (f.x + i) + (f.y + j) * HTW; const o = occ.get(k) || {}; if (f.kind === "rug") o.rug = f.id; else o.item = { type: "furni", id: f.id, kind: f.kind }; occ.set(k, o); } });
  h.decor.forEach(f => { if (f.id === skipId || !DECOR[f.kind]) return; const [w, d] = fpOf(DECOR[f.kind], f.r || 0); for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) { const k = (f.x + i) + (f.y + j) * HTW; const o = occ.get(k) || {}; o.item = { type: "decor", id: f.id, kind: f.kind, walk: Boolean(DECOR[f.kind].walk) }; occ.set(k, o); } });
  return occ;
}
function bhCanPlace(pl, x, y, r = 0) {
  const def = pl.type === "furni" ? FURNI[pl.kind] : DECOR[pl.kind]; if (!def) return false;
  const [w, d] = fpOf(def, r); const occ = bhOccupancy(pl.id || "");
  for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) {
    const tx = x + i, ty = y + j; const k = tileKind(tx, ty); const o = occ.get(tx + ty * HTW);
    if (pl.type === "furni") { if (k !== "house" || (tx === 4 && ty === 2)) return false; if (pl.kind === "rug" ? o?.rug : o?.item) return false; }
    else { if (k !== "grass" || o?.item) return false; }
  }
  return true;
}
// 找一个能放下的位置（迁移旧存档、从仓库自动摆放时用）
function bhFindSpot(type, kind) {
  const pl = { type, kind };
  const order = [];
  if (type === "furni") { [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [2, 2], [1, 2], [2, 1], [3, 2], [1, 1], [3, 1], [1, 3], [2, 3], [3, 3], [4, 1], [4, 3]].forEach(p => order.push(p)); }
  else for (let y = 0; y < HTH; y++) for (let x = 0; x < HTW; x++) order.push([x, y]);
  if (type === "decor") order.sort((a, b) => (Math.abs(a[0] - 8.5) + Math.abs(a[1] - 8)) - (Math.abs(b[0] - 8.5) + Math.abs(b[1] - 8)));
  for (const r of [0, 1]) for (const [x, y] of order) if (bhCanPlace(pl, x, y, r)) return { x, y, r };
  return null;
}
// 3.5.0 及更早的平面地图坐标换成 2.5D 小岛：家具和装饰重新摆一遍，放不下的回仓库
function bhMigrate() {
  const h = home(); if (h.layout >= 2) return;
  const furn = h.furniture.splice(0), dec = h.decor.splice(0); let refund = 0;
  furn.forEach(f => { if (!FURNI[f.kind]) return; const s = bhFindSpot("furni", f.kind); if (s) h.furniture.push({ id: f.id || uid("hi"), kind: f.kind, ...s }); else h.inv[`u_${f.kind}`] = (h.inv[`u_${f.kind}`] || 0) + 1; });
  dec.forEach(d => { if (d.kind === "mailbox") { refund += DECOR.mailbox.price; return; } if (!DECOR[d.kind]) return; const s = bhFindSpot("decor", d.kind); if (s) h.decor.push({ id: d.id || uid("hi"), kind: d.kind, ...s }); else h.inv[`d_${d.kind}`] = (h.inv[`d_${d.kind}`] || 0) + 1; });
  if (refund) { state.pet.coins += refund; state.pet.history.push({ t: now(), xp: 0, coins: refund, why: "家园改建：邮箱改成固定信箱，退回" }); }
  h.layout = 2; save();
}

// ---------- 静态世界：地面、小屋、农田、围栏、池塘、风车、家具和装饰 ----------
const NZ = VXEngine.makeNoise();
const GRASS = { base: 0xBCD6B3, light: 0xC9E0C0, dark: 0xADCBA4, speck: 0xA4C49B, hi: 0xD7EAD0 };
function bhWallBack(side) {
  const n = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }[side]; const [a, b] = BH.E.trDir(n[0], n[1]); return a < 0 || b < 0;
}
function bhBuildStatic() {
  const E = BH.E; const h = home(); E.setWorld(WXV, WYV, BH.rot, VOY);
  const L = []; const pidS = new Map(); const lights = [];
  const V = (x, y, z, c, g, p) => { L.push(x, y, z, c, g, p, 0); };
  const placeModel = (m, ox, oy, oz, g, p, r = 0, FW = 8, FD = 8) => { const v = m.v; for (let k = 0; k < v.length; k += 4) { const [x, y] = vmRot(v[k], v[k + 1], FW, FD, r); V(ox + x, oy + y, oz + v[k + 2], v[k + 3], g, p); } };
  const farm2 = Boolean(h.owned.farm2);
  // 地表
  const N = WXV * WYV; const HH = new Int8Array(N).fill(-99), CT = new Uint32Array(N), PK = new Uint16Array(N), KD = new Uint8Array(N);
  const pads = [[19, 78, 2.2], [33, 91, 1.8], [18, 90, 1.6], [37, 76, 1.5]];
  for (let y = 0; y < WYV; y++) for (let x = 0; x < WXV; x++) {
    if (!bhIsland(x, y)) continue;
    const tx = x >> 3, ty = y >> 3, lx = x & 7, ly = y & 7, i = x + y * WXV; const kind = tileKind(tx, ty);
    const n = NZ[(y & 63) * 64 + (x & 63)], r = vxHash(x, y, 3);
    let hh = GZ, kd = 1, pk = tileId(tx, ty);
    let c = n > .6 ? GRASS.light : n < .38 ? GRASS.dark : GRASS.base; if (r < .07) c = GRASS.speck; else if (r > .986) c = GRASS.hi;
    if (kind === "path") { kd = 2; const seam = (x % 4 === 0) || ((y + ((x >> 2) % 2) * 2) % 4 === 0); const s = vxHash(x >> 2, (y + ((x >> 2) % 2) * 2) >> 2, 5); c = seam ? 0xCFC9B9 : s < .33 ? 0xEAE6DC : s < .66 ? 0xE2DDD0 : 0xEFEBE2; }
    else if (kind === "house") { hh = 6; if (x === 0 || y === 0 || x === 39 || y === 39) { kd = 9; c = 0xCFCAC0; } else { kd = 3; const row = Math.floor((y - 1) / 3); const joint = (x + row * 13) % 17 === 0; c = joint || (y - 1) % 3 === 2 ? 0xCDB58A : row % 2 ? 0xE4D0AA : 0xDCC69D; } }
    else if (kind === "farm") {
      const pi = (tx - 7) + (ty - 1) * 6; pk = PID.plot + pi;
      if (pi < 6 || farm2) { hh = 6; const frame = lx === 0 || ly === 0 || lx === 7 || ly === 7; const pl = h.plots[pi]; const wet = pl && plotWet(pl); if (frame) { kd = 4; c = (lx === 0 || lx === 7) && (ly === 0 || ly === 7) ? 0xA47E51 : 0xC9A57A; } else { kd = 5; c = wet ? (ly % 2 ? 0x6B5444 : 0x5F4A3C) : (ly % 2 ? 0x9A7B63 : 0x8E715A); if (wet && r < .04) c = 0x8FA6C8; } }
    }
    else if (kind === "pen") { kd = 8; c = n > .55 ? 0xC4DBB0 : 0xB8D3A6; if (r < .05) c = 0xE6D28F; else if (r < .07) c = 0xDAC47C; }
    else if (kind === "pond" || kind === "dock") {
      const d = Math.hypot(x + .5 - POND_C.x, y + .5 - POND_C.y) + (n - .5) * 2.4;
      if (d < POND_C.rw) { hh = 3; kd = 7; pk = PID.pond; const deep = POND_C.rw - d; c = MAT(2, deep < 1.6 ? 0xA8CBFF : deep < 4.5 ? 0x8FB6FF : deep < 8 ? 0x7FA8FB : 0x7299F0); for (const [px, py, pr] of pads) { const q = Math.hypot(x + .5 - px, y + .5 - py); if (q < pr && !(q > pr - .9 && Math.abs(Math.atan2(y - py, x - px) - .6) < .45)) c = q < pr - 1 ? 0x7CC38A : 0x6AB57A; } }
      else if (d < POND_C.rs) { hh = 4; kd = 6; c = r < .5 ? 0xEFE3BE : 0xE6D8AE; if (r > .97) c = 0xD9C9A0; }
    }
    HH[i] = hh; CT[i] = c; PK[i] = pk; KD[i] = kd;
  }
  const side = (kd, z, top, x, y) => {
    const r = vxHash(x, y, z);
    if (kd === 3 || kd === 9) return z === 6 ? (z % 2 ? 0xC4BEB2 : 0xCFCAC0) : 0x9A8571;
    if (kd === 4 || kd === 5) return z === 6 ? 0xB8925F : 0x9A8571;
    if (kd === 6) return z >= 3 ? 0xDCCD9F : 0x9A8571;
    if (z === top - 1 && kd !== 7) return kd === 2 ? 0xC9C3B3 : r < .55 ? 0xA3C49A : 0x9F8A75;
    if (z >= 0) return r < .1 ? 0xA89380 : (z % 3 === 0 ? 0x8E7A66 : 0x9A8571);
    return r < .12 ? 0x77726D : (z % 2 ? 0x6A6662 : 0x625E5A);
  };
  for (let y = 0; y < WYV; y++) for (let x = 0; x < WXV; x++) {
    const i = x + y * WXV; const top = HH[i]; if (top < -50) continue;
    let lo = top; const nb = (xx, yy) => (xx < 0 || yy < 0 || xx >= WXV || yy >= WYV) ? BZ - 1 : HH[xx + yy * WXV] < -50 ? BZ - 1 : HH[xx + yy * WXV];
    lo = Math.min(nb(x - 1, y), nb(x + 1, y), nb(x, y - 1), nb(x, y + 1));
    for (let z = Math.max(BZ, Math.min(lo + 1, top)); z <= top; z++) V(x, y, z, z === top ? CT[i] : side(KD[i], z, top, x, y), 1, PK[i]);
  }
  // 草地上的小草和野花（只是地面的点缀）
  for (let y = 1; y < WYV - 1; y++) for (let x = 1; x < WXV - 1; x++) { const i = x + y * WXV; if (KD[i] !== 1 || HH[i] !== GZ) continue; const tk = tileKind(x >> 3, y >> 3); if (tk !== "grass" && tk !== "scenery") continue; const r = vxHash(x, y, 9); if (r < .022) V(x, y, 6, r < .004 ? 0xFFFFFF : r < .007 ? VPAL.YEL : 0x9DC394, 1, PK[i]); }
  // 小屋：靠后的两面墙是完整高墙（带窗、相框），朝向镜头的两面只留矮墙，能看见屋里
  const walls = { N: bhWallBack("N"), S: bhWallBack("S"), W: bhWallBack("W"), E: bhWallBack("E") };
  const wallH = s => walls[s] ? 24 : 9;
  const ring = [];
  for (let x = 0; x < 40; x++) { ring.push([x, 0, ["N", ...(x === 0 ? ["W"] : x === 39 ? ["E"] : [])], x]); ring.push([x, 39, ["S", ...(x === 0 ? ["W"] : x === 39 ? ["E"] : [])], x]); }
  for (let y = 1; y < 39; y++) { ring.push([0, y, ["W"], y]); ring.push([39, y, ["E"], y]); }
  ring.forEach(([x, y, sides, a]) => {
    const top = Math.max(...sides.map(wallH)); const main = sides.length > 1 ? sides.find(s => walls[s]) || sides[0] : sides[0]; const back = walls[main];
    for (let z = 7; z <= top; z++) {
      if (main === "E" && sides.length === 1 && a >= 17 && a <= 22 && z <= (back ? 18 : 9)) continue; // 门洞
      let c = z === 7 ? 0xC2A47E : z === top ? 0xD9D4C8 : (a % 8 === 0 && back ? 0xEFECE5 : 0xF7F5F0);
      if (back && sides.length === 1) {
        const win = (a >= 9 && a <= 14) || (a >= 25 && a <= 30);
        if (win && z >= 12 && z <= 18) { const inner = (a >= 10 && a <= 13) || (a >= 26 && a <= 29); c = inner && z >= 13 && z <= 17 ? (z === 15 || a === 11 || a === 27 ? 0xC9A57A : MAT(6, 0xBFD8FF)) : 0xC9A57A; }
        if (main !== "E" && a >= 16 && a <= 23 && z >= 12 && z <= 19) {
          if (a === 16 || a === 23 || z === 12 || z === 19) c = 0x2A2C30;
          else if (main === "W") { c = 0xC7DEC4; if (a >= 18 && a <= 22 && z >= 14 && z <= 17) c = 0xF4F4F2; if ((a === 19 || a === 21) && (z === 15 || z === 16)) c = 0x2A2C30; if (a === 22 && z === 18) c = VPAL.YEL; }
          else { c = z <= 14 || (z === 15 && a <= 20) || (z === 16 && a <= 18) ? (z <= 13 ? 0x74B982 : 0x8FD48F) : 0xBFD8FF; if (a === 21 && z === 17) c = VPAL.YEL; if (a === 18 && z === 17) c = 0xFFFFFF; }
        }
        if (main === "E" && (a === 16 || a === 23) && z <= 19) c = 0xB8925F;
        if (main === "E" && a > 16 && a < 23 && z === 19) c = 0xB8925F;
      }
      V(x, y, z, c, 2, PID.wall);
    }
  });
  for (let y = 17; y <= 22; y++) for (let x = 40; x <= 43; x++) V(x, y, 6, (y % 2) ? 0xC9774E : 0xB8673F, 1, tileId(5, 2));
  // 农田边上的稻草人、洒水器位置
  placeModel(VXM.scarecrow(), 104, 16, 6, 14, PID.scarecrow); pidS.set(PID.scarecrow, { type: "scarecrow" });
  if (h.owned.sprinkler) { placeModel(VXM.sprinkler(), 104, 8, 6, 11, PID.sprinkler); pidS.set(PID.sprinkler, { type: "sprinkler" }); }
  else { placeModel(VXM.stakes(), 104, 8, 6, 11, PID.sprspot); pidS.set(PID.sprspot, { type: "sprspot" }); }
  if (!farm2) { // 第二排地：木桩和绳子圈出来，提示可以扩建
    const x0 = 57, x1 = 102, y0 = 17, y1 = 22;
    for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1], [80, y0], [80, y1]]) for (let z = 6; z <= 8; z++) V(x, y, z, z === 8 ? VPAL.YEL : 0xA47E51, 3, PID.plot + 6 + Math.min(5, Math.floor((x - 56) / 8)));
    for (let x = x0 + 1; x < x1; x++) { V(x, y0, 8, 0xEFE6CC, 3, PID.plot + 6 + Math.floor((x - 56) / 8)); V(x, y1, 8, 0xEFE6CC, 3, PID.plot + 6 + Math.floor((x - 56) / 8)); }
    for (let y = y0 + 1; y < y1; y++) { V(x0, y, 8, 0xEFE6CC, 3, PID.plot + 6); V(x1, y, 8, 0xEFE6CC, 3, PID.plot + 11); }
  }
  // 作物
  h.plots.forEach(p => { if (!p.crop) return; const st = cropStage(p); const t = plotTile(p.i); placeModel(VXM.crop(p.crop, st), t.x * 8, t.y * 8, 7, st === 0 ? 1 : 40 + p.i, PID.plot + p.i); });
  for (let i = 0; i < 12; i++) pidS.set(PID.plot + i, { type: "plot", i });
  // 围栏、食槽、草垛
  const P = PEN_V;
  for (let x = P.x0; x <= P.x1; x++) for (const y of [P.y0, P.y1]) { if (y === P.y0 && x >= P.gate0 && x <= P.gate1) continue; const post = (x - P.x0) % 4 === 0 || x === P.x1; for (let z = 6; z <= (post ? 9 : 9); z++) if (post || z === 7 || z === 9) V(x, y, z, post ? (z === 9 ? 0xFFFFFF : 0xE7E2D6) : 0xF6F4EE, 4, PID.fence); }
  for (let y = P.y0 + 1; y < P.y1; y++) for (const x of [P.x0, P.x1]) { const post = (y - P.y0) % 4 === 0; for (let z = 6; z <= 9; z++) if (post || z === 7 || z === 9) V(x, y, z, post ? (z === 9 ? 0xFFFFFF : 0xE7E2D6) : 0xF6F4EE, 4, PID.fence); }
  for (const x of [P.gate0 - 1, P.gate1 + 1]) { for (let z = 6; z <= 11; z++) V(x, P.y0, z, z === 11 ? VPAL.YEL : 0xE7E2D6, 4, PID.fence); }
  pidS.set(PID.fence, { type: "fence" });
  placeModel(VXM.trough(), 113, 50, 6, 5, PID.trough); pidS.set(PID.trough, { type: "trough" });
  placeModel(VXM.hay(), 117, 59, 6, 6, PID.fence);
  // 池塘：栈桥、芦苇、荷花
  for (let x = DOCK.x0; x <= DOCK.x1; x++) for (let y = DOCK.y0; y <= DOCK.y1; y++) { const g = HH[x + y * WXV]; if (g >= 5) continue; V(x, y, 5, x % 3 === 0 ? 0xA47E51 : y % 2 ? 0xC9A57A : 0xBF9A6C, 7, PID.dock); }
  for (const [x, y] of [[33, 82], [33, 85], [38, 82], [38, 85]]) V(x, y, 4, 0x8A6A4E, 7, PID.dock);
  pidS.set(PID.dock, { type: "dock" }); pidS.set(PID.pond, { type: "pond" });
  for (let y = 60; y < 108; y++) for (let x = 6; x < 52; x++) { const i = x + y * WXV; if (KD[i] !== 6) continue; const r = vxHash(x, y, 21); if (r < .028 && !(y >= DOCK.y0 - 1 && y <= DOCK.y1 + 1 && x >= DOCK.x0)) { const hgt = 1 + ((r * 1000) | 0) % 3; const cat = r < .009; for (let z = 5; z < 5 + hgt; z++) V(x, y, z, z === 5 ? 0x7DBE86 : 0x95CF98, 8, PID.pond); V(x, y, 5 + hgt, cat ? 0x9C7450 : 0xB4DDB0, 8, PID.pond); if (cat) V(x, y, 6 + hgt, 0x9C7450, 8, PID.pond); } }
  V(37, 76, 4, VPAL.PNK, 8, PID.pond); V(38, 76, 4, 0xFFB8D4, 8, PID.pond); V(37, 77, 4, 0xFFB8D4, 8, PID.pond);
  // 信箱
  placeModel(VXM.mailbox(bhMailUnread()), 40, 40, 6, 9, PID.mailbox); pidS.set(PID.mailbox, { type: "mailbox" });
  // 风车
  if (h.owned.windmill) { placeModel(VXM.windmillTower(), 112, 88, 6, 12, PID.windmill, 0, 16, 16); pidS.set(PID.windmill, { type: "windmill" }); lights.push({ x: 120, y: 101, z: 18, r: 16 }); }
  else { placeModel(VXM.sign(), 116, 92, 6, 12, PID.millspot); for (const [x, y] of [[113, 89], [126, 89], [113, 102], [126, 102]]) V(x, y, 6, 0xC9C4B8, 12, PID.millspot); pidS.set(PID.millspot, { type: "millspot" }); }
  // 固定风景
  FIXED.forEach((f, k) => { const m = f.k === "sign" ? VXM.sign() : f.k === "tree" ? VXM.tree(f.seed, f.big) : VXM.decor(f.k, f.seed); placeModel(m, f.tx * 8, f.ty * 8, 6, 20 + k, f.k === "sign" ? PID.sign : 0); });
  pidS.set(PID.sign, { type: "sign" });
  // 家具
  h.furniture.forEach((f, k) => {
    const def = FURNI[f.kind]; if (!def) return; const r = f.r || 0; const FW = def.fp[0] * 8, FD = def.fp[1] * 8;
    placeModel(VXM.furni(f.kind), f.x * 8, f.y * 8, 7, 100 + k, PID.furni + k, r, FW, FD); pidS.set(PID.furni + k, { type: "furni", id: f.id });
    if (f.kind === "lamp2") lights.push({ ...bhItemPt(f, def, 4, 4), z: 15, r: 30 });
    if (f.kind === "tv") lights.push({ ...bhItemPt(f, def, 8, 6), z: 12, r: 22, tv: true });
    if (f.kind === "desk") lights.push({ ...bhItemPt(f, def, 6, 3), z: 14, r: 16, cool: true });
  });
  // 装饰
  h.decor.forEach((d, k) => {
    const def = DECOR[d.kind]; if (!def) return; const r = d.r || 0; const FW = def.fp[0] * 8, FD = def.fp[1] * 8; let seed = 1; for (const ch of String(d.id)) seed = (seed * 31 + ch.charCodeAt(0)) % 97;
    placeModel(VXM.decor(d.kind, seed), d.x * 8, d.y * 8, 6, 200 + k, PID.decor + k, r, FW, FD); pidS.set(PID.decor + k, { type: "decor", id: d.id });
    if (d.kind === "lamp" && !d.off) lights.push({ ...bhItemPt(d, def, 3.5, 3.5), z: 18, r: 34 });
    if (d.kind === "lightstand" && !d.off) lights.push({ ...bhItemPt(d, def, 4, 3), z: 19, r: 40 });
  });
  pidS.set(PID.wall, { type: "house" });
  // 小屋里有一盏吸顶暖光，窗户也会亮
  lights.push({ x: 20, y: 20, z: 16, r: 46, room: true });
  E.buildStatic(L);
  BH.pidS = pidS; BH.lightsW = lights; BH.staticN = L.length / 7;
  BH.lightsS = lights.map(l => { const [sx, sy] = E.project(l.x, l.y, l.z); return { ...l, sx, sy }; });
  bhGridBuild();
}
// 物件模型坐标 → 世界坐标（连续值，用来放 Bit、灯光）
function bhItemPt(it, def, mx, my) {
  const FW = def.fp[0] * 8, FD = def.fp[1] * 8; const r = it.r || 0;
  const [x, y] = r === 0 ? [mx, my] : r === 1 ? [FD - my, mx] : r === 2 ? [FW - mx, FD - my] : [my, FW - mx];
  return { x: it.x * 8 + x, y: it.y * 8 + y };
}
function bhSignature() {
  const h = home(); const t = Date.now();
  return [BH.rot, h.owned.farm2 ? 1 : 0, h.owned.sprinkler ? 1 : 0, h.owned.windmill ? 1 : 0, bhMailUnread() ? 1 : 0, BH.ver,
    h.plots.map(p => `${p.crop}${cropStage(p)}${plotWet(p) ? "w" : ""}`).join(","), h.decor.map(d => d.off ? 1 : 0).join("")].join("|") + (t ? "" : "");
}

// ---------- 行走网格：Bit 用 BFS 找路，只能从门进出小屋 ----------
function bhGridBuild() {
  const g = new Uint8Array(HTW * HTH); const occ = bhOccupancy();
  for (let ty = 0; ty < HTH; ty++) for (let tx = 0; tx < HTW; tx++) {
    const k = tileKind(tx, ty); let w = k === "path" || k === "grass" || k === "house" || k === "dock";
    const o = occ.get(tx + ty * HTW); if (o?.item && !o.item.walk) w = false;
    g[tx + ty * HTW] = w ? 1 : 0;
  }
  BH.grid = g;
}
const inHouse = (tx, ty) => tx <= 4 && ty <= 4;
function bhPass(ax, ay, bx, by) {
  if (inHouse(ax, ay) !== inHouse(bx, by)) return (ax === 4 && ay === 2 && bx === 5 && by === 2) || (bx === 4 && by === 2 && ax === 5 && ay === 2);
  return true;
}
function bhPath(sx, sy, gx, gy) {
  const g = BH.grid; if (!g) return null; const S = sx + sy * HTW, G = gx + gy * HTW; if (S === G) return [];
  const prev = new Int16Array(HTW * HTH).fill(-1); prev[S] = S; const q = [S];
  while (q.length) { const c = q.shift(); if (c === G) break; const cx = c % HTW, cy = (c / HTW) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= HTW || ny >= HTH) continue; const n = nx + ny * HTW; if (prev[n] !== -1 || !(g[n] || n === G) || !bhPass(cx, cy, nx, ny)) continue; prev[n] = c; q.push(n); } }
  if (prev[G] === -1) return null;
  const out = []; let c = G; while (c !== S) { out.push(c); c = prev[c]; } return out.reverse();
}
// 离目标最近、能走到的格子
function bhNear(tx, ty, fromX, fromY) {
  const g = BH.grid; let best = null, bd = 1e9;
  for (let r = 0; r <= 3 && !best; r++) for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
    if (x < 0 || y < 0 || x >= HTW || y >= HTH || !g[x + y * HTW]) continue; if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) !== r) continue;
    const p = bhPath(fromX, fromY, x, y); if (!p) continue; const d = p.length + (Math.abs(x - tx) + Math.abs(y - ty)) * .1; if (d < bd) { bd = d; best = { x, y }; }
  }
  return best;
}
const tileZ = (tx, ty) => tileKind(tx, ty) === "house" ? 7 : 6;

// ---------- 运行时状态 ----------
const BH = {
  open: false, tab: "shop", shop: "seed", drawer: true, raf: 0, lastT: 0, lastDraw: 0, lastSim: 0, t: 0,
  E: null, off: null, octx: null, cv: null, ctx: null, view: { s: 1, offX: 0, offY: 0, dpr: 1 },
  rot: 0, flip: null, zoom: 0, pan: { x: 0, y: 0 }, ver: 0, sig: "", pidS: new Map(), pidD: new Map(),
  tool: "hand", seed: "", placing: null, hover: 0, hoverAt: null, pointer: null, press: null, sweep: null, drag: null,
  bit: null, mobs: new Map(), fishes: new Map(), parts: [], rain: [], flies: [], feed: null, fishing: null, marker: null,
  pop: null, popPid: 0, forcePhase: "", forceWeather: "", weather: "sun", lightsS: [], grid: null, audio: null, spaceDown: false
};
const TOOLS = [["hand", "互动", "1"], ["seed", "播种", "2"], ["water", "浇水", "3"], ["harvest", "收获", "4"], ["build", "布置", "5"]];
const TOOL_TIPS = { hand: "点作物收获、点动物收集或摸摸它，点空地让 Bit 走过去", seed: "按住拖过空地，一口气种一排", water: "按住拖过农田，一路浇过去", harvest: "按住拖过成熟的作物，连收有奖励", build: "点家具或装饰拿起来，R 旋转，再点一下放下" };

// ---------- 音效：WebAudio 合成的小方波，不用麦克风 ----------
function bhSfx(kind, k = 0) {
  if (home().sound === false) return;
  try {
    if (!BH.audio) BH.audio = new (window.AudioContext || window.webkitAudioContext)();
    const ac = BH.audio; if (ac.state === "suspended") ac.resume();
    const t0 = ac.currentTime; const out = ac.createGain(); out.gain.value = .09; out.connect(ac.destination);
    const tone = (f, at, dur, type = "square", vol = 1, slide = 0) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0 + at); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t0 + at + dur); g.gain.setValueAtTime(0, t0 + at); g.gain.linearRampToValueAtTime(vol, t0 + at + .008); g.gain.exponentialRampToValueAtTime(.001, t0 + at + dur); o.connect(g); g.connect(out); o.start(t0 + at); o.stop(t0 + at + dur + .02); };
    const noise = (at, dur, vol = .6, hp = 1200) => { const n = ac.createBufferSource(); const b = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); n.buffer = b; const f = ac.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp; const g = ac.createGain(); g.gain.value = vol; n.connect(f); f.connect(g); g.connect(out); n.start(t0 + at); };
    const semi = n => 440 * 2 ** (n / 12);
    if (kind === "plant") { tone(semi(-5), 0, .07, "triangle", .9); tone(semi(2), .05, .08, "triangle", .7); }
    else if (kind === "water") { noise(0, .22, .5, 2400); tone(semi(7), 0, .12, "sine", .3, -200); }
    else if (kind === "harvest") { const b = Math.min(12, k * 2); tone(semi(3 + b), 0, .06, "square", .7); tone(semi(10 + b), .05, .09, "square", .6); }
    else if (kind === "coin") { tone(semi(14), 0, .06, "square", .6); tone(semi(19), .06, .14, "square", .6); }
    else if (kind === "pop") tone(semi(5), 0, .05, "triangle", .8, 300);
    else if (kind === "pet") { tone(semi(12), 0, .06, "triangle", .8); tone(semi(16), .07, .06, "triangle", .8); tone(semi(19), .14, .1, "triangle", .7); }
    else if (kind === "err") tone(semi(-14), 0, .14, "square", .6, -40);
    else if (kind === "place") { tone(semi(-2), 0, .05, "square", .7); noise(.02, .06, .4, 600); }
    else if (kind === "rotate") tone(semi(0), 0, .09, "triangle", .6, 220);
    else if (kind === "splash") noise(0, .3, .7, 900);
    else if (kind === "bite") { tone(semi(17), 0, .05, "square", .9); tone(semi(17), .09, .05, "square", .9); }
    else if (kind === "catch") { [0, 4, 7, 12].forEach((n, i) => tone(semi(7 + n), i * .06, .09, "square", .6)); }
    else if (kind === "mail") { tone(semi(9), 0, .08, "triangle", .7); tone(semi(14), .1, .12, "triangle", .7); }
    else if (kind === "eat") { noise(0, .05, .5, 3000); noise(.12, .05, .5, 3000); tone(semi(4), .2, .08, "triangle", .6); }
    else if (kind === "click") tone(semi(12), 0, .025, "square", .4);
    else if (kind === "snore") tone(semi(-10), 0, .5, "sine", .3, -30);
  } catch (_) { /* 没有音频设备时静默 */ }
}

// ---------- 粒子（世界坐标） ----------
const PATS = {
  heart: [".KK.KK.", "KPPKPPK", "KPPPPPK", ".KPPPK.", "..KPK..", "...K..."],
  z: ["KKKK", "..K.", ".K..", "KKKK"],
  bang: [".KKKKK.", "KYYKYYK", "KYYKYYK", "KYYKYYK", "KYYYYYK", "KYYKYYK", ".KKKKK.", "..KK...", "..K...."],
  food: [".KKKKKK.", "KWWWWWWK", "KWWOOWWK", "KWOOOOWK", "KWWOOWWK", ".KKKKKK.", "...KK...", "....K..."],
  note: ["..KK", "..KY", "..K.", "KKK.", "KYK.", "KK.."],
  drop: [".K.", "KBK", "KBK", ".K."],
  spark: [".W.", "WYW", ".W."],
  coin: [".KK.", "KYYK", "KYYK", ".KK."]
};
const PATC = { K: 0x0E0E0E, P: 0xFF7EB0, Y: 0xFFD23F, W: 0xFFFFFF, B: 0x7BA4FF, O: 0xFF9F43 };
function bhPart(o) { if (reduceMotion() && !o.keep) return; BH.parts.push({ vx: 0, vy: 0, vz: 0, g: 0, life: 1, age: 0, ...o }); if (BH.parts.length > 420) BH.parts.splice(0, BH.parts.length - 420); }
function bhBurst(x, y, z, n, colors, sp = 6, up = 8) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = sp * (.4 + Math.random() * .8); bhPart({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: up * (.6 + Math.random() * .6), g: 26, life: .6 + Math.random() * .4, c: colors[i % colors.length], size: Math.random() < .3 ? 2 : 1 }); } }
function bhPartsStep(dt) {
  const s = dt / 1000; const P = BH.parts;
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.age += s; if (p.age >= p.life) { P.splice(i, 1); continue; } p.x += p.vx * s; p.y += p.vy * s; p.z += p.vz * s; p.vz -= p.g * s; if (p.floor != null && p.z < p.floor) { p.z = p.floor; p.vz = 0; p.vx *= .5; p.vy *= .5; } }
}
function bhPat(sx, sy, rows) { const E = BH.E; rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const ch = r[x]; if (ch === ".") continue; E.part(sx + x, sy + y, PATC[ch], 1); } }); }

// ---------- Bit ----------
function bhBitInit() {
  const b = { x: 2.5 * 8, y: 2.5 * 8, z: 7, face: 0, st: "idle", wait: 1200, path: [], after: null, hop: 0, hopV: 0, expr: "normal", blinkAt: performance.now() + 2000, look: null, last: 0, sayEl: null, waterCd: 0 };
  BH.bit = b; return b;
}
const faceOf = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
const bitTile = () => ({ x: clamp(Math.floor(BH.bit.x / 8), 0, HTW - 1), y: clamp(Math.floor(BH.bit.y / 8), 0, HTH - 1) });
// 让 Bit 走到某个格子（或某个精确点），到了以后进入 after 状态
function bhGo(tx, ty, after = null, exact = null) {
  const b = BH.bit; if (!b) return false; const s = bitTile();
  let goal = { x: tx, y: ty };
  if (!BH.grid[tx + ty * HTW]) { goal = bhNear(tx, ty, s.x, s.y); if (!goal) return false; }
  const p = bhPath(s.x, s.y, goal.x, goal.y); if (!p) return false;
  b.path = p.map(i => ({ x: (i % HTW) * 8 + 4, y: Math.floor(i / HTW) * 8 + 4, z: tileZ(i % HTW, Math.floor(i / HTW)) }));
  if (exact) b.path.push(exact);
  b.st = "walk"; b.after = after; return true;
}
function bhBitSay(text, ms = 2600) {
  const fx = $(".bh-fx"); if (!fx || !BH.bit) return; const b = BH.bit;
  if (!b.sayEl) { b.sayEl = document.createElement("div"); b.sayEl.className = "bh-say px"; fx.appendChild(b.sayEl); }
  b.sayEl.textContent = text; b.sayEl.classList.remove("in"); void b.sayEl.offsetWidth; b.sayEl.classList.add("in");
  clearTimeout(b.sayT); b.sayT = setTimeout(() => b.sayEl?.classList.remove("in"), ms);
}
function bhFurniOf(kind) { return home().furniture.find(f => f.kind === kind); }
function bhBitThink() {
  const b = BH.bit; const h = home(); const s = state.pet.stats; const ph = dayPhase(); const t = performance.now();
  const bed = bhFurniOf("bed"), desk = bhFurniOf("desk"), tv = bhFurniOf("tv"); const bench = h.decor.find(d => d.kind === "bench");
  if (ph === "night" || s.energy < 18) {
    if (bed && bhGoBed(bed)) return;
    b.st = "sleep"; b.wait = 20000; return;
  }
  if (s.food < 28 && Math.random() < .3) { b.st = "idle"; b.wait = 3000; bhBitSay(pick(["肚子有点饿……", "想吃点东西", "仓库里有吃的吗？"]), 2600); b.think = "food"; return; }
  b.think = "";
  const dry = !h.owned.sprinkler && BH.weather !== "rain" ? h.plots.filter(p => p.crop && cropStage(p) < 3 && !plotWet(p)) : [];
  if (dry.length && t > b.waterCd && Math.random() < .45) { const p = pick(dry); const tl = plotTile(p.i); const ty = tl.y === 1 ? 0 : 3; if (bhGo(tl.x, ty, { st: "water", plot: p.i, wait: 1800 })) return; }
  if (desk && ph !== "night" && Math.random() < .22) { const def = FURNI.desk; const pt = bhItemPt(desk, def, 8, 12); const f = FRONT[desk.r || 0]; if (bhGo(Math.floor(pt.x / 8), Math.floor(pt.y / 8), { st: "work", wait: 9000 + Math.random() * 7000, face: faceOf(-f[0], -f[1]) })) return; }
  if (tv && Math.random() < .12) { const def = FURNI.tv; const pt = bhItemPt(tv, def, 8, 16); const f = FRONT[tv.r || 0]; if (bhGo(Math.floor(pt.x / 8), Math.floor(pt.y / 8), { st: "tv", wait: 7000 + Math.random() * 5000, face: faceOf(-f[0], -f[1]) })) return; }
  if (bench && Math.random() < .14 && bhGoBench(bench)) return;
  // 随便逛逛：田边、池塘边、围栏门口、自己的装饰旁边、屋里
  const spots = [[7, 0], [9, 0], [11, 0], [8, 3], [10, 3], [12, 3], [6, 9], [6, 11], [13, 4], [14, 4], [5, 6], [3, 6], [2, 7], [8, 7], [9, 10], [2, 2], [1, 3], [3, 1], [8, 5]];
  h.decor.forEach(d => spots.push([clamp(d.x + (Math.random() < .5 ? -1 : 1), 0, HTW - 1), d.y + 1]));
  const sp = pick(spots); bhGo(sp[0], sp[1], { st: Math.random() < .3 ? "happy" : "idle", wait: 1800 + Math.random() * 3600 });
}
function bhGoBed(bed) {
  const def = FURNI.bed; const pt = bhItemPt(bed, def, 4, 6); const f = FRONT[bed.r || 0];
  const tx = Math.floor(pt.x / 8), ty = Math.floor(pt.y / 8);
  return bhGo(tx, ty, { st: "sleep", wait: 20000, face: faceOf(f[0], f[1]) }, { x: pt.x, y: pt.y, z: 10, hop: true });
}
function bhGoBench(bench) {
  const def = DECOR.bench; const pt = bhItemPt(bench, def, 8, 4); const f = FRONT[bench.r || 0];
  return bhGo(Math.floor(pt.x / 8), Math.floor(pt.y / 8), { st: "sit", wait: 6000 + Math.random() * 5000, face: faceOf(f[0], f[1]) }, { x: pt.x, y: pt.y, z: 10, hop: true });
}
function bhBitUpdate(dt) {
  const b = BH.bit; if (!b) return; const s = dt / 1000; const t = performance.now();
  // 跳一下
  if (b.hop > 0 || b.hopV) { b.hopV -= 60 * s; b.hop += b.hopV * s; if (b.hop <= 0) { b.hop = 0; b.hopV = 0; } }
  if (t > b.blinkAt) { b.blink = t + 130; b.blinkAt = t + 2400 + Math.random() * 3200; }
  if (b.st === "walk") {
    const p = b.path[0];
    if (!p) { const a = b.after || { st: "idle", wait: 2000 }; b.after = null; b.st = a.st; b.wait = a.wait ?? 2000; if (a.face != null) b.face = a.face; b.act = a; bhBitArrive(a); return; }
    const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy);
    if (p.z != null) b.z += (p.z - b.z) * Math.min(1, s * (p.hop ? 6 : 12));
    if (d < .6) { b.path.shift(); if (p.hop && !b.hop) { b.hopV = 16; b.hop = .01; } return; }
    const k = Math.min(1, 15 * s / d); b.x += dx * k; b.y += dy * k; b.face = faceOf(dx, dy);
    b.step = (b.step || 0) + 15 * s * k * d / Math.max(.01, 15 * s);
    return;
  }
  // 状态动作
  if (b.st === "water" && b.act) { b.act.t = (b.act.t || 0) + dt; const tl = plotTile(b.act.plot); if (Math.random() < .5) bhPart({ x: tl.x * 8 + 1 + Math.random() * 6, y: tl.y * 8 + 1 + Math.random() * 6, z: 13, vz: -14, g: 10, life: .45, c: 0x9FC4FF, floor: 7 }); }
  if (b.st === "sleep" && Math.random() < s * .6) bhPart({ x: b.x + 2, y: b.y - 2, z: b.z + 8, vx: 1.5, vy: -1.5, vz: 4, life: 1.6, pat: "z" });
  if (b.st === "work" && Math.random() < s * 3) bhPart({ x: b.x + (Math.random() - .5) * 4, y: b.y + (Math.random() - .5) * 4, z: b.z + 6.5, vz: 4, life: .35, c: pick([0xC7DEC4, 0xFFFFFF, 0x9FC0FF]) });
  if (b.st === "fish") return bhFishUpdate(dt);
  if (state.pet.stats.food < 25 && b.st !== "sleep" && b.st !== "eat" && t > (b.thinkAt || 0)) { b.thinkAt = t + 4200; bhPart({ x: b.x, y: b.y, z: b.z + 10, vz: 1, g: 0, life: 1.6, pat: "food", keep: true }); }
  b.wait -= dt;
  // 闲着的时候盯着鼠标
  if ((b.st === "idle" || b.st === "happy") && BH.hoverAt && !BH.press) { const dx = BH.hoverAt.x - b.x, dy = BH.hoverAt.y - b.y; if (Math.hypot(dx, dy) < 70 && Math.hypot(dx, dy) > 4) b.face = faceOf(dx, dy); }
  if (b.st === "happy" && !b.hop && Math.random() < s * 2.4) { b.hopV = 14; b.hop = .01; }
  if (b.wait <= 0) {
    if (b.st === "water" && b.act) { const p = home().plots[b.act.plot]; if (p && p.crop && !plotWet(p)) { bhGrow(); p.wet = Date.now() + 30 * 60000; save(); bhFloatW(plotTile(p.i).x * 8 + 4, plotTile(p.i).y * 8 + 4, 12, "Bit 帮你浇了水", "water"); } b.waterCd = t + 60000; }
    if (b.st === "sleep" && (dayPhase() === "night" || state.pet.stats.energy < 30)) { b.wait = 15000; return; }
    if (b.st === "sleep" || b.st === "sit") { b.z = tileZ(...Object.values(bitTile())); const tl = bitTile(); if (!BH.grid[tl.x + tl.y * HTW]) { const n = bhNear(tl.x, tl.y, tl.x, tl.y); if (n) { b.x = n.x * 8 + 4; b.y = n.y * 8 + 4; } } }
    b.act = null; bhBitThink();
  }
}
function bhBitArrive(a) {
  const b = BH.bit;
  if (a.st === "happy") { b.hopV = 15; b.hop = .01; }
  if (a.st === "water") bhSfx("water");
  if (a.st === "fish") bhFishStart();
  if (a.st === "tv") bhBitSay(pick(["今天的片子真好看", "这个镜头可以学", "转场好丝滑"]), 2400);
  if (a.st === "work") bhBitSay(pick(["我也写一会儿稿", "帮你记点灵感", "敲敲敲……"]), 2200);
}
function bhBitPat() {
  const b = BH.bit; if (!b) return;
  if (b.st === "sleep") { b.wait = 2500; bhBitSay(pick(["嗯……？", "再睡五分钟……", "Zzz……被摸醒了"]), 2000); bhSfx("snore"); return; }
  b.st = "happy"; b.wait = 2000; b.path = []; b.hopV = 16; b.hop = .01; b.expr = "happy";
  bhPart({ x: b.x, y: b.y, z: b.z + 9, vz: 6, g: 0, life: 1.1, pat: "heart", keep: true });
  bhSfx("pet"); petEvent("pat"); bhRefreshHud();
  const now2 = Date.now(); if (now2 - (b.lastLine || 0) > 2500) { b.lastLine = now2; bhBitSay(pick(PET_ANIMS[0][4].concat(["嘿嘿", "家园真舒服", "再摸一下！"])), 1800); }
}
function bhFeed(k) {
  const h = home(); if (!(h.inv[k] > 0)) return false;
  const food = CROPS[k]?.food || GOODS[k]?.food || FISH[k.replace(/^f_/, "")]?.food || 0; if (!food) return false;
  const s = state.pet.stats; if (s.food >= 98) { bhBitSay("吃饱啦，留着下次吧", 1800); bhSfx("err"); return false; }
  h.inv[k] -= 1; s.food = clamp(s.food + food, 0, 100); s.mood = clamp(s.mood + 3, 0, 100);
  const b = BH.bit; if (b) { b.st = "eat"; b.wait = 1500; b.path = []; b.expr = "happy"; b.hopV = 10; b.hop = .01; bhBurst(b.x, b.y, b.z + 6, 8, [0xFFD23F, 0xFF9F43, 0xFFFFFF], 5, 6); bhFloatW(b.x, b.y, b.z + 10, `饱腹 +${food}`, "good"); bhBitSay(pick(["好吃！", "嗯嗯嗯～", "谢谢款待"]), 1600); }
  bhSfx("eat"); petEvent("feed"); save(); bhRenderSide(); bhRenderQuick(); return true;
}

// ---------- 钓鱼：Bit 走到栈桥，浮漂一沉就点一下 ----------
const FISH_CAP = 6;
function bhFishLeft() { const h = home(); const d = dayKey(); if (h.fishing?.date !== d) h.fishing = { date: d, n: 0 }; return FISH_CAP - h.fishing.n; }
function bhFishGo() {
  if (bhFishLeft() <= 0) { bhBitSay("今天的鱼都睡了，明天再来", 2200); bhSfx("err"); return; }
  if (BH.bit.st === "fish") return;
  if (!bhGo(4, 10, { st: "fish", wait: 1e9, face: faceOf(-1, 0) }, { x: 36.5, y: 83.5, z: 6 })) bhToast("Bit 走不过去");
}
function bhFishStart() { BH.fishing = { phase: "cast", t: 0, bob: { x: 22 + Math.random() * 6, y: 80 + Math.random() * 6 }, biteAt: 2600 + Math.random() * 4200 }; bhSfx("pop"); }
function bhFishUpdate(dt) {
  const f = BH.fishing; const b = BH.bit; if (!f) { b.st = "idle"; b.wait = 1000; return; }
  f.t += dt;
  if (f.phase === "cast" && f.t > 500) { f.phase = "wait"; f.t = 0; bhSfx("splash"); bhBurst(f.bob.x, f.bob.y, 4, 6, [0xFFFFFF, 0xBFD8FF], 4, 6); }
  else if (f.phase === "wait" && f.t > f.biteAt) { f.phase = "bite"; f.t = 0; bhSfx("bite"); bhPart({ x: b.x, y: b.y, z: b.z + 10, vz: 0, g: 0, life: 1.3, pat: "bang", keep: true }); }
  else if (f.phase === "bite" && f.t > 1300) { f.phase = "miss"; f.t = 0; bhBitSay(pick(["哎呀，跑掉了", "下次一定！", "差一点点"]), 1800); }
  else if ((f.phase === "miss" || f.phase === "got") && f.t > 1400) { BH.fishing = null; b.st = "idle"; b.wait = 1500; }
}
function bhFishCatch() {
  const f = BH.fishing; if (!f) return false;
  if (f.phase === "wait") { f.phase = "miss"; f.t = 0; bhBitSay("还没咬钩呢", 1500); return true; }
  if (f.phase !== "bite") return false;
  const h = home(); bhFishLeft(); h.fishing.n += 1;
  const r = Math.random(); const kind = r < .08 ? "koi" : r < .3 ? "goldfish" : "crucian";
  h.inv[`f_${kind}`] = (h.inv[`f_${kind}`] || 0) + 1; f.phase = "got"; f.t = 0; f.kind = kind;
  bhBurst(f.bob.x, f.bob.y, 4, 12, [0xFFFFFF, 0x9FC4FF, VPAL.YEL], 7, 12); bhSfx("catch");
  bhFloatW(BH.bit.x, BH.bit.y, BH.bit.z + 12, `钓到${FISH[kind].name}！`, "good"); bhBitSay(kind === "koi" ? "锦鲤！今天要转运了" : "上钩啦！", 2000);
  petEvent("harvest"); save(); bhRenderSide(); bhRenderQuick(); return true;
}

// ---------- 动物与鱼 ----------
const MOB_SPEED = { chick: 6, duck: 5, bunny: 9, sheep: 3.5 };
const MOB_C = { chick: [1, 1], duck: [1.5, 1], bunny: [1, 1], sheep: [3, 1.5] };
function bhMob(a) {
  let m = BH.mobs.get(a.id);
  if (!m) { m = { x: PEN_IN.x0 + Math.random() * (PEN_IN.x1 - PEN_IN.x0), y: PEN_IN.y0 + Math.random() * (PEN_IN.y1 - PEN_IN.y0), tx: 0, ty: 0, wait: Math.random() * 3000, dir: (Math.random() * 4) | 0, hop: 0, hopV: 0, prod: null }; m.tx = m.x; m.ty = m.y; BH.mobs.set(a.id, m); }
  return m;
}
function bhMobsStep(dt) {
  const s = dt / 1000;
  if (dayPhase() === "night" && Math.random() < s * .5) { const a = pick(home().animals); const m = a && BH.mobs.get(a.id); if (m && m.wait > 0) bhPart({ x: m.x, y: m.y, z: 11, vx: 1, vy: -1, vz: 3, g: 0, life: 1.4, pat: "z" }); }
  home().animals.forEach(a => {
    const m = bhMob(a); const sp = MOB_SPEED[a.kind] || 5;
    if (m.hop > 0 || m.hopV) { m.hopV -= 50 * s; m.hop += m.hopV * s; if (m.hop <= 0) { m.hop = 0; m.hopV = 0; } }
    if (animalReady(a) && !m.prod) { m.prod = { x: clamp(m.x + 3, PEN_IN.x0, PEN_IN.x1), y: clamp(m.y + 1, PEN_IN.y0, PEN_IN.y1) }; }
    if (!animalReady(a)) m.prod = null;
    if (m.wait > 0) { m.wait -= dt; return; }
    const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
    if (d < .5) { m.wait = dayPhase() === "night" ? 9000 + Math.random() * 9000 : 900 + Math.random() * 3600; if (dayPhase() === "night" && Math.random() < .5) bhPart({ x: m.x, y: m.y, z: 11, vx: 1, vy: -1, vz: 3, g: 0, life: 1.4, pat: "z" }); if (BH.troughUntil > performance.now()) { m.tx = 112 + Math.random() * 8; m.ty = 47 + Math.random() * 8; } else { m.tx = PEN_IN.x0 + Math.random() * (PEN_IN.x1 - PEN_IN.x0); m.ty = PEN_IN.y0 + Math.random() * (PEN_IN.y1 - PEN_IN.y0); } return; }
    const k = Math.min(1, sp * s / d); m.x += dx * k; m.y += dy * k; m.dir = faceOf(dx, dy);
    if (a.kind === "bunny" && !m.hop) { m.hopV = 12; m.hop = .01; }
    if ((a.kind === "chick" || a.kind === "duck") && !m.hop && Math.random() < s * 2) { m.hopV = 5; m.hop = .01; }
  });
}
function bhFishMob(f) {
  let m = BH.fishes.get(f.id);
  if (!m) { const a = Math.random() * Math.PI * 2, r = Math.random() * 10; m = { x: POND_C.x + Math.cos(a) * r, y: POND_C.y + Math.sin(a) * r, ang: Math.random() * 6.28, sp: 3 + Math.random() * 2, tx: 0, ty: 0, wait: 0 }; m.tx = m.x; m.ty = m.y; BH.fishes.set(f.id, m); }
  return m;
}
function bhFishesStep(dt) {
  const s = dt / 1000; const fd = BH.feed && BH.feed.until > performance.now() ? BH.feed : null;
  home().fish.forEach(f => {
    const m = bhFishMob(f);
    if (fd) { m.tx = fd.x + (Math.random() - .5) * 3; m.ty = fd.y + (Math.random() - .5) * 3; m.wait = 0; }
    if (m.wait > 0) { m.wait -= dt; return; }
    const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
    if (d < .6) { m.wait = 600 + Math.random() * 2200; for (let k = 0; k < 8; k++) { const a = Math.random() * Math.PI * 2, r = Math.random() * 11; const x = POND_C.x + Math.cos(a) * r, y = POND_C.y + Math.sin(a) * r; if (!(x > DOCK.x0 - 2 && y > DOCK.y0 - 2 && y < DOCK.y1 + 2)) { m.tx = x; m.ty = y; break; } } return; }
    const want = Math.atan2(dy, dx); let da = want - m.ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; m.ang += clamp(da, -3 * s, 3 * s);
    const sp = (fd ? 7 : m.sp) * s; m.x += Math.cos(m.ang) * sp; m.y += Math.sin(m.ang) * sp;
    const r = Math.hypot(m.x - POND_C.x, m.y - POND_C.y); if (r > 12) { m.x = POND_C.x + (m.x - POND_C.x) * 12 / r; m.y = POND_C.y + (m.y - POND_C.y) * 12 / r; m.tx = POND_C.x; m.ty = POND_C.y; }
  });
}
const FISH_COL = { crucian: [0xA3A98F, 0x8C927A], goldfish: [0xFF8A3D, 0xFFC08A], koi: [0xF8F6F0, 0xE8483B] };
function bhFishVox(kind, ang) {
  const out = []; const c = Math.cos(ang), s = Math.sin(ang); const cols = FISH_COL[kind] || FISH_COL.crucian; const seen = new Set();
  for (let u = -3.5; u <= 2.5; u += .5) for (const v of u > 1.5 ? [0] : u < -2.6 ? [-1, 0, 1] : u < -1.6 ? [0] : [-.5, .5]) {
    const x = Math.round(u * c - v * s), y = Math.round(u * s + v * c); const k = `${x},${y}`; if (seen.has(k)) continue; seen.add(k);
    let col = cols[0]; if (u < -2.6) col = cols[1]; if (kind === "koi" && u > -1 && u < 1.5 && (x + y) % 2) col = cols[1]; if (kind === "goldfish" && u < -2) col = cols[1];
    out.push(x, y, vxMix(col, 0x7FA8FB, .28));
  }
  return out;
}

// ---------- 模拟：每帧的移动 + 每秒的生长、天气 ----------
function bhSimSecond() {
  const h = home(); bhGrow();
  const ph = dayPhase(); if (ph !== BH.phase) { BH.phase = ph; bhRefreshHud(); }
  const w = bhWeather(); if (w !== BH.weather) { BH.weather = w; bhRefreshHud(); if (w === "rain") bhBitSay("下雨啦，作物喝饱水了", 2400); }
  if (BH.weather === "rain") { let n = 0; h.plots.forEach(p => { if (p.crop && cropStage(p) < 3 && (p.wet || 0) < Date.now() + 5 * 60000) { p.wet = Date.now() + 30 * 60000; n++; } }); if (n) save(); }
  const sig = bhSignature(); if (sig !== BH.sig) { BH.sig = sig; bhBuildStatic(); }
  if (Math.random() < .25) petStatsUpdate();
}
function bhSim(dt) {
  bhBitUpdate(dt); bhMobsStep(dt); bhFishesStep(dt); bhPartsStep(dt);
  const s = dt / 1000; const t = performance.now(); const h = home(); const night = dayPhase() === "night";
  // 成熟作物闪一下
  if (Math.random() < s * 2.2) { const ripe = h.plots.filter(p => cropStage(p) === 3); if (ripe.length) { const p = pick(ripe); const tl = plotTile(p.i); bhPart({ x: tl.x * 8 + 1 + Math.random() * 6, y: tl.y * 8 + 1 + Math.random() * 6, z: 10 + Math.random() * 4, vz: 2, g: 0, life: .7, pat: "spark" }); } }
  if (h.owned.sprinkler && Math.random() < s * 14) { const a = Math.random() * Math.PI * 2; bhPart({ x: 108, y: 12, z: 14, vx: Math.cos(a) * 14 - 8, vy: Math.sin(a) * 6, vz: 10, g: 30, life: .9, c: 0xBFD8FF, floor: 7 }); }
  if (h.owned.windmill === undefined) { /* nothing */ }
  // 夜里有萤火虫，晴天有蝴蝶
  const wantFlies = night ? 9 : BH.weather === "sun" && dayPhase() === "day" ? 3 : 0;
  while (BH.flies.length < wantFlies) BH.flies.push({ x: 20 + Math.random() * 90, y: 30 + Math.random() * 75, z: 8 + Math.random() * 6, a: Math.random() * 6, fire: night, ph: Math.random() * 6 });
  if (BH.flies.length > wantFlies) BH.flies.length = wantFlies;
  BH.flies.forEach(f => { f.fire = night; f.a += (Math.random() - .5) * s * 4; f.x = clamp(f.x + Math.cos(f.a) * s * (night ? 3 : 7), 4, WXV - 4); f.y = clamp(f.y + Math.sin(f.a) * s * (night ? 3 : 7), 4, WYV - 4); f.z = 9 + Math.sin(t / 700 + f.ph) * 3; f.ph += s; });
  // 樱花树掉花瓣
  if (!night && Math.random() < s * 1.2) bhPart({ x: 2 + Math.random() * 6, y: 50 + Math.random() * 6, z: 16, vx: 2 + Math.random() * 2, vy: 1, vz: -2.5, g: 0, life: 3, c: pick([0xFFC2DA, 0xFFD6E6]), floor: 6 });
  if (BH.fishing && BH.fishing.phase === "bite" && Math.random() < s * 8) bhBurst(BH.fishing.bob.x, BH.fishing.bob.y, 4, 1, [0xFFFFFF], 3, 4);
}

// ---------- 每一帧 ----------
const PHASE_TINT = { day: [1, 1, 1], dawn: [.98, .92, .92], dusk: [1, .89, .8], night: [.4, .48, .76] };
function bhFrame(t) {
  if (!BH.open) return;
  BH.raf = requestAnimationFrame(bhFrame);
  if (document.hidden || t - BH.lastDraw < 30) return;
  const dt = Math.min(90, t - (BH.lastT || t)); BH.lastT = t; BH.lastDraw = t; BH.t = t;
  if (t - BH.lastSim > 1000) { BH.lastSim = t; bhSimSecond(); }
  bhSim(dt);
  bhRender(t);
  bhUpdateOverlays();
}
function bhRender(t) {
  const E = BH.E; const h = home(); const ph = dayPhase(); const night = ph === "night"; const pidD = new Map();
  E.beginFrame();
  // Bit
  const b = BH.bit;
  if (b) {
    const bx = Math.round(b.x - 3), by = Math.round(b.y - 3); const bob = b.st === "walk" ? (Math.floor(BH.t / 140) % 2) : b.st === "work" ? (Math.floor(BH.t / 220) % 2) : 0;
    const bz = Math.round(b.z + b.hop + bob * .6);
    E.shadow(bx, by, 6, 6, Math.round(b.z) - 1, .62);
    const expr = b.st === "sleep" ? "sleep" : (b.blink && BH.t < b.blink) ? "blink" : (b.st === "happy" || b.st === "eat") ? "happy" : "normal";
    E.model(VXM.bit(b.face, expr), bx, by, bz, PID.bit, PID.bit);
    // 头顶的黄色光标方块（睡觉时掉在脚边）
    const [cx, cy] = bhInvDir(3, -3);
    if (b.st === "sleep") E.model(VXM.cursor(), Math.round(b.x + cx * 1.6 - 1), Math.round(b.y + cy * 1.6 - 1), Math.round(b.z), PID.bit, PID.bit);
    else E.model(VXM.cursor(), Math.round(b.x + cx - 1), Math.round(b.y + cy - 1), bz + 8 + Math.round(Math.sin(BH.t / 380) * .9 + .4), PID.bit, PID.bit);
    if (b.st === "water" && b.act) { const [fx, fy] = FRONT_FACE[b.face]; E.model(VXM.can(), Math.round(b.x + fx * 4 - 1), Math.round(b.y + fy * 4 - 1), bz + 3, PID.bit, PID.bit); }
    pidD.set(PID.bit, { type: "bit" });
  }
  // 动物和产物
  h.animals.forEach((a, k) => {
    const m = bhMob(a); const [cx, cy] = MOB_C[a.kind] || [1, 1]; const mdl = VXM[a.kind]?.(0); if (!mdl) return;
    const x = Math.round(m.x - cx), y = Math.round(m.y - cy);
    E.shadow(x, y, Math.ceil(cx * 2 + 1), Math.ceil(cy * 2 + 1), GZ, .7);
    E.model(mdl, x, y, 6 + Math.round(m.hop), PID.animal + k, PID.animal + k, m.dir, cx, cy); pidD.set(PID.animal + k, { type: "animal", id: a.id });
    if (m.prod) { const g = ANIMALS[a.kind].product; E.model(VXM[g](), Math.round(m.prod.x), Math.round(m.prod.y), 6, PID.prod + k, PID.prod + k); pidD.set(PID.prod + k, { type: "prod", id: a.id }); if (Math.random() < .03) bhPart({ x: m.prod.x + 1, y: m.prod.y + 1, z: 9, vz: 3, life: .5, pat: "spark" }); }
  });
  // 鱼
  h.fish.forEach((f, k) => { const m = bhFishMob(f); const v = bhFishVox(f.kind, m.ang); const fx = Math.round(m.x), fy = Math.round(m.y); for (let i = 0; i < v.length; i += 3) E.put(fx + v[i], fy + v[i + 1], 3, v[i + 2], PID.fish + k, PID.fish + k, 2, 1); pidD.set(PID.fish + k, { type: "fish", id: f.id }); });
  // 风车叶片
  if (h.owned.windmill) {
    const th = BH.t / 1000 * .9; const seen = new Set();
    for (let k = 0; k < 4; k++) { const a = th + k * Math.PI / 2; const ca = Math.cos(a), sa = Math.sin(a);
      for (let s = 1; s <= 11; s += .5) for (let w = 0; w <= (s > 3 ? 3 : 0); w++) { const x = Math.round(120 + ca * s - sa * w * .9), z = Math.round(25 + sa * s + ca * w * .9); const key = x * 100 + z; if (seen.has(key)) continue; seen.add(key); E.put(x, 104, z, w === 0 ? 0x8A6A4E : (Math.round(s) % 4 === 0 ? 0xDAD5CA : 0xF6F4EE), PID.windmill, PID.windmill); } }
    E.put(120, 104, 25, 0x3A3D42, PID.windmill, PID.windmill);
  }
  // 浮漂与钓线
  if (BH.fishing && b && b.st === "fish") {
    const f = BH.fishing; const [dx, dy] = FRONT_FACE[b.face]; const bz = Math.round(b.z);
    for (let i = 0; i < 5; i++) E.put(Math.round(b.x + dx * (3 + i)), Math.round(b.y + dy * (3 + i)), bz + 3 + i, i === 4 ? 0x3A3D42 : 0x8A6A4E, PID.bit, PID.bit);
    if (f.phase !== "cast" || f.t > 250) { const tx = b.x + dx * 8, ty = b.y + dy * 8, tz = bz + 8; const [x0, y0] = E.project(tx, ty, tz), [x1, y1] = E.project(f.bob.x + .5, f.bob.y + .5, 4); const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)); for (let i = 1; i < n; i += 2) { const k = i / n; E.part(Math.round(x0 + (x1 - x0) * k), Math.round(y0 + (y1 - y0) * k + Math.sin(k * Math.PI) * 5), 0xEDEDED, 1); } }
  }
  if (BH.fishing && b) { const f = BH.fishing; const dip = f.phase === "bite" ? (Math.floor(BH.t / 120) % 2) : 0; E.put(Math.round(f.bob.x), Math.round(f.bob.y), 3 - dip + 1, VPAL.RED, PID.bit, PID.bit); E.put(Math.round(f.bob.x), Math.round(f.bob.y), 3 - dip, 0xFFFFFF, PID.bit, PID.bit); }
  // 拖动食物时的预览、放置家具时的幽灵
  if (BH.placing && BH.placing.at) bhRenderGhost();
  if (!BH.placing && BH.tool === "hand" && !BH.press && !BH.drag) { const o = bhObj(BH.hover); if (o?.type === "tile" && BH.grid?.[o.tx + o.ty * HTW]) { const z = tileZ(o.tx, o.ty) - 1, x0 = o.tx * 8, y0 = o.ty * 8; for (const [cx, cy] of [[0, 0], [7, 0], [0, 7], [7, 7]]) { const dx = cx ? -1 : 1, dy = cy ? -1 : 1; E.ghost(x0 + cx, y0 + cy, z, 0xFFFFFF); E.ghost(x0 + cx + dx, y0 + cy, z, 0xFFFFFF); E.ghost(x0 + cx, y0 + cy + dy, z, 0xFFFFFF); E.ghost(x0 + cx + 2 * dx, y0 + cy, z, 0xFFFFFF); E.ghost(x0 + cx, y0 + cy + 2 * dy, z, 0xFFFFFF); } } }
  if (BH.marker && BH.marker.until > BH.t) { const m = BH.marker; E.ghost(m.x - 1, m.y - 1, m.z, VPAL.YEL); E.ghost(m.x, m.y - 1, m.z, VPAL.YEL); E.ghost(m.x - 1, m.y, m.z, VPAL.YEL); E.ghost(m.x, m.y, m.z, VPAL.YEL); }
  BH.pidD = pidD;
  // 粒子
  for (const p of BH.parts) {
    const [sx, sy] = E.project(p.x, p.y, p.z);
    if (p.pat) { const rows = PATS[p.pat]; const fade = p.age > p.life * .75 && (Math.floor(BH.t / 60) % 2); if (!fade) bhPat(Math.round(sx - rows[0].length / 2), Math.round(sy - rows.length), rows); }
    else E.part(Math.round(sx), Math.round(sy), p.c, p.size || 1);
  }
  // 萤火虫 / 蝴蝶
  const lights = [];
  BH.flies.forEach((f, i) => { const [sx, sy] = E.project(f.x, f.y, f.z); if (f.fire) { const on = Math.sin(BH.t / 300 + f.ph * 3) > -.2; if (on) { E.part(Math.round(sx), Math.round(sy), 0xE9FF9A, 1); lights.push({ x: sx, y: sy, r: 7 }); } } else { const flap = Math.floor(BH.t / 110 + i) % 2; const c = [0xFFFFFF, VPAL.YEL, 0xFFB8D4][i % 3]; E.part(Math.round(sx) - 1, Math.round(sy) - flap, c, 1); E.part(Math.round(sx) + 1, Math.round(sy) - flap, c, 1); E.part(Math.round(sx), Math.round(sy), 0x2A2C30, 1); } });
  // 雨
  if (BH.weather === "rain" && !reduceMotion()) {
    while (BH.rain.length < 110) BH.rain.push({ x: Math.random() * VBW, y: Math.random() * VBH, sp: 220 + Math.random() * 120 });
    BH.rain.forEach(r => { r.y += r.sp * .033; r.x -= r.sp * .012; if (r.y > VBH || r.x < 0) { if (Math.random() < .5) { const px = Math.round(r.x), py = Math.round(r.y - VBH * Math.random() * .4); E.part(px, py, 0xDDEBFF, 1); } r.y = -6; r.x = Math.random() * VBW * 1.1; } const x = Math.round(r.x), y = Math.round(r.y); E.part(x, y, 0xBFD8FF, 1); E.part(x + 1, y - 2, 0x9FC0F0, 1); E.part(x + 2, y - 4, 0x86A6D8, 1); });
  } else BH.rain.length = 0;
  // 灯光
  const lightOn = night || ph === "dusk";
  if (lightOn) BH.lightsS.forEach(l => { if (l.room && !(night || ph === "dusk")) return; const flick = l.tv ? (.85 + Math.random() * .3) : 1; lights.push({ x: l.sx, y: l.sy, r: l.r * flick * (night ? 1 : .7) }); });
  let tint = PHASE_TINT[ph] || PHASE_TINT.day;
  if (BH.weather === "rain") tint = tint.map((v, i) => v * [.8, .84, .92][i]); else if (BH.weather === "cloud") tint = tint.map((v, i) => v * [.95, .96, .99][i]);
  const hov = bhHoverRing();
  E.compose({ tint, t: BH.t / 1000, night: lightOn, lights, cloud: BH.weather !== "sun" ? 1 : 0, hover: hov.pid, hoverColor: hov.color, sel: BH.popPid || 0 });
  bhBlit();
}
const FRONT_FACE = [[1, 0], [0, 1], [-1, 0], [0, -1]];
// 旋转后坐标的方向 → 世界方向（用来把光标方块放在屏幕右上方）
function bhInvDir(a, b) { const r = BH.rot; return r === 0 ? [a, b] : r === 1 ? [b, -a] : r === 2 ? [-a, -b] : [-b, a]; }
function bhRenderGhost() {
  const E = BH.E; const pl = BH.placing; const def = pl.type === "furni" ? FURNI[pl.kind] : DECOR[pl.kind]; if (!def) return;
  const { x, y } = pl.at; const r = pl.r || 0; const ok = bhCanPlace(pl, x, y, r); const [w, d] = fpOf(def, r);
  const gz = pl.type === "furni" ? 6 : GZ; const col = ok ? 0x3DD68C : 0xFF5A5F;
  for (let j = 0; j < d * 8; j++) for (let i = 0; i < w * 8; i++) if (i === 0 || j === 0 || i === w * 8 - 1 || j === d * 8 - 1 || (i + j) % 4 === 0) E.ghost(x * 8 + i, y * 8 + j, gz, col);
  const m = pl.type === "furni" ? VXM.furni(pl.kind) : VXM.decor(pl.kind, 7); const FW = def.fp[0] * 8, FD = def.fp[1] * 8; const v = m.v;
  for (let k = 0; k < v.length; k += 4) { const [mx, my] = vmRot(v[k], v[k + 1], FW, FD, r); E.ghost(x * 8 + mx, y * 8 + my, gz + 1 + v[k + 2], ok ? v[k + 3] & 0xFFFFFF : 0xFF8A8C); }
}
function bhHoverRing() {
  const p = BH.hover; if (!p || BH.placing || BH.drag) return { pid: BH.dragOverBit ? PID.bit : 0 };
  const o = bhObj(p); if (!o) return { pid: 0 };
  const t = BH.tool;
  if (t === "build") return { pid: o.type === "furni" || o.type === "decor" ? p : 0, color: 0xFFFFFF };
  if (t !== "hand") return { pid: o.type === "plot" ? p : 0, color: t === "water" ? 0x9FC4FF : t === "seed" ? 0xC7DEC4 : VPAL.YEL };
  if (["plot", "animal", "prod", "fish", "bit", "mailbox", "dock", "decor", "furni", "trough", "windmill", "millspot", "sprspot", "sprinkler", "scarecrow", "sign"].includes(o.type)) return { pid: p, color: VPAL.YEL };
  return { pid: 0 };
}
const bhObj = p => BH.pidD.get(p) || BH.pidS.get(p) || (p > 0 && p <= HTW * HTH ? { type: "tile", tx: (p - 1) % HTW, ty: Math.floor((p - 1) / HTW) } : null);
// 把缓冲画到屏幕上：整数倍放大，保持像素锐利；旋转时左右翻一下
function bhBlit() {
  const cv = BH.cv, ctx = BH.ctx; if (!cv) return; const v = BH.view;
  BH.octx.putImageData(BH.E.img, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = BH.bgPat || "#050505"; ctx.fillRect(0, 0, cv.width, cv.height);
  let sx = 1; if (BH.flip) { const p = (BH.t - BH.flip.t0) / 260; if (p >= 1) BH.flip = null; else { if (p >= .5 && !BH.flip.done) { BH.flip.done = true; BH.rot = (BH.rot + BH.flip.dir + 4) % 4; bhBuildStatic(); BH.sig = bhSignature(); } sx = Math.max(.04, Math.abs(Math.cos(p * Math.PI))); } }
  const w = VBW * v.s, hgt = VBH * v.s; const x = v.offX + (w - w * sx) / 2;
  ctx.drawImage(BH.off, 0, 0, VBW, VBH, Math.round(x), Math.round(v.offY), Math.round(w * sx), hgt);
}
function bhMakeBg() {
  const dpr = BH.view.dpr; const cs = getComputedStyle(document.documentElement); const light = document.documentElement.dataset.theme === "light";
  const c = document.createElement("canvas"); const step = Math.round(24 * dpr); c.width = c.height = step; const x = c.getContext("2d");
  x.fillStyle = light ? "#E4E4E4" : "#050505"; x.fillRect(0, 0, step, step); x.fillStyle = light ? "#CBCBCB" : "#1F1F1F"; const d = Math.max(1, Math.round(dpr * 1.5)); x.fillRect(0, 0, d, d);
  BH.bgPat = BH.ctx.createPattern(c, "repeat"); void cs;
}
// 视图：算出最合适的整数倍缩放，岛放在抽屉左边的空间正中
function bhFit(keepZoom = false) {
  const st = $(".bh-stage"); const cv = BH.cv; if (!st || !cv) return;
  const dpr = window.devicePixelRatio || 1; const r = st.getBoundingClientRect();
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); BH.ctx = cv.getContext("2d"); BH.view.dpr = dpr;
  const drawer = BH.drawer && r.width > 900 ? 372 : 0; const top = 78, bottom = 104;
  const aw = (r.width - drawer - 32) * dpr, ah = (r.height - top - bottom) * dpr;
  const fit = Math.max(1, Math.floor(Math.min(aw / VBW, ah / VBH) * (dpr === 1 ? 2 : 1)) / (dpr === 1 ? 2 : 1));
  BH.fitS = fit; if (!keepZoom || !BH.zoom) BH.zoom = fit;
  const s = BH.zoom; BH.view.s = s;
  BH.view.offX = Math.round((16 * dpr) + (aw - VBW * s) / 2 + BH.pan.x * dpr);
  BH.view.offY = Math.round(top * dpr + (ah - VBH * s) / 2 + BH.pan.y * dpr);
  bhMakeBg(); bhPopClose();
}
function bhZoom(dir, cx, cy) {
  const v = BH.view; const fit = BH.fitS || 1; const steps = []; for (let s = Math.max(1, fit - 1); s <= fit * 3; s += fit >= 3 ? 1 : .5) steps.push(s);
  let i = steps.findIndex(s => s >= BH.zoom - .01); if (i < 0) i = steps.length - 1; const ni = clamp(i + dir, 0, steps.length - 1); if (steps[ni] === BH.zoom) return;
  const st = $(".bh-stage").getBoundingClientRect(); const px = (cx ?? st.width / 2) * v.dpr, py = (cy ?? st.height / 2) * v.dpr;
  const bx = (px - v.offX) / v.s, by = (py - v.offY) / v.s; BH.zoom = steps[ni];
  bhFit(true); const nx = v.offX + bx * v.s, ny = v.offY + by * v.s; BH.pan.x += (px - nx) / v.dpr; BH.pan.y += (py - ny) / v.dpr; bhFit(true);
}
function bhRotate(dir) { if (BH.flip) return; bhPopClose(); bhSfx("rotate"); if (reduceMotion()) { BH.rot = (BH.rot + dir + 4) % 4; bhBuildStatic(); BH.sig = bhSignature(); return; } BH.flip = { t0: BH.t || performance.now(), dir, done: false }; }
// 屏幕 ↔ 缓冲 ↔ 世界
function bhPtr(ev) { const r = BH.cv.getBoundingClientRect(); const v = BH.view; const cx = ev.clientX - r.left, cy = ev.clientY - r.top; return { cx, cy, bx: (cx * v.dpr - v.offX) / v.s, by: (cy * v.dpr - v.offY) / v.s }; }
function bhToCss(bx, by) { const v = BH.view; return { x: (v.offX + bx * v.s) / v.dpr, y: (v.offY + by * v.s) / v.dpr }; }
function bhWorldCss(x, y, z) { const [sx, sy] = BH.E.project(x, y, z); return bhToCss(sx, sy); }
function bhGroundAt(bx, by, z = GZ) { const [x, y] = BH.E.unproject(bx, by, z); return { x, y, tx: Math.floor(x / 8), ty: Math.floor(y / 8) }; }

// ---------- 界面用的小模型和像素图标 ----------
const hex = c => parseInt(String(c).slice(1), 16);
Object.assign(VXM, {
  can() { return this.get("can", () => new VM().box(0, 0, 0, 3, 2, 3, (i, j, k) => k === 2 ? 0x9FC0FF : VPAL.BLU).add(3, 0, 2, VPAL.BLU).add(4, 0, 3, 0x9FC0FF).add(1, 0, 3, 0x3A3D42).add(1, 1, 3, 0x3A3D42)); },
  packet(kind) { return this.get(`packet:${kind}`, () => { const c = hex(CROPS[kind]?.c || "#8FD48F"); const m = new VM().box(0, 0, 0, 5, 2, 6, (i, j, k) => k === 5 ? 0xD9C08E : 0xEFE0BC); m.box(1, 1, 1, 3, 1, 3, c); m.set(2, 1, 4, 0x6FBF6F); m.set(2, 1, 2, vxMix(c, 0xFFFFFF, .35)); return m; }); },
  fishIco(kind) { return this.get(`fishico:${kind}`, () => { const [a, b] = FISH_COL[kind] || FISH_COL.crucian; const m = new VM().box(1, 0, 0, 5, 2, 3, (i, j, k) => kind === "koi" && (i + k) % 3 === 0 ? b : a); m.box(0, 0, 0, 1, 2, 1, b).box(0, 0, 2, 1, 2, 1, b); m.set(5, 1, 2, VPAL.black).set(5, 0, 2, VPAL.black); m.add(6, 0, 1, a).add(6, 1, 1, a); return m; }); },
  bedIco() { return this.get("bedico", () => new VM().box(0, 0, 0, 8, 6, 2, (i, j, k) => i === 0 || j === 0 || i === 7 || j === 5 ? (k ? 0xC9A57A : 0xA47E51) : k ? 0x8E715A : 0x7A6050).add(3, 2, 2, 0x8FD48F).add(3, 2, 3, 0x6FBF6F).add(4, 3, 2, 0x8FD48F)); },
  fenceIco() { return this.get("fenceico", () => { const m = new VM(); [0, 4, 8].forEach(x => m.box(x, 0, 0, 1, 1, 5, 0xE7E2D6).add(x, 0, 5, 0xFFFFFF)); m.box(1, 0, 1, 7, 1, 1, 0xF6F4EE).box(1, 0, 3, 7, 1, 1, 0xF6F4EE); return m; }); },
  pondIco() { return this.get("pondico", () => new VM().box(0, 0, 0, 8, 8, 1, (i, j) => Math.hypot(i - 3.5, j - 3.5) < 2.8 ? MAT(2, 0x8FB6FF) : 0xEFE3BE).add(2, 2, 1, 0x7CC38A).add(6, 1, 1, 0x6FB27A).add(6, 1, 2, 0x8FD48F)); },
  millIco() { return this.get("millico", () => { const m = new VM().box(1, 1, 0, 4, 4, 8, VPAL.wall); m.box(1, 1, 8, 4, 4, 1, 0xE0765A).box(2, 2, 9, 2, 2, 1, 0xCC5F48); for (let s = -4; s <= 4; s++) { m.add(3 + s, 5, 6, 0xF6F4EE); m.add(3, 5, 6 + s, 0xF6F4EE); } m.set(3, 5, 6, 0x8A6A4E); return m; }); }
});
function bhIcoModel(type, kind) {
  if (type === "seed") return VXM.packet(kind);
  if (type === "crop") return VXM.crop(kind, 3);
  if (type === "animal") return VXM[kind]?.(0);
  if (type === "fish" || type === "fishc") return VXM.fishIco(kind);
  if (type === "good") return VXM[kind]?.();
  if (type === "furni") return VXM.furni(kind);
  if (type === "decor") return VXM.decor(kind, 7);
  if (type === "facility") return { farm2: VXM.bedIco(), pen: VXM.fenceIco(), pond: VXM.pondIco(), sprinkler: VXM.sprinkler(), windmill: VXM.millIco() }[kind];
  return null;
}
function bhIco(type, kind, box = 44) {
  const key = `${type}:${kind}:${box}`; if (BH.icons?.has(key)) return BH.icons.get(key);
  const m = bhIcoModel(type, kind); if (!m) return "";
  const url = vxIcon(m); const img = new Image(); img.src = url;
  const v = m.v; let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9; for (let k = 0; k < v.length; k += 4) { x0 = Math.min(x0, v[k]); x1 = Math.max(x1, v[k]); y0 = Math.min(y0, v[k + 1]); y1 = Math.max(y1, v[k + 1]); z0 = Math.min(z0, v[k + 2]); z1 = Math.max(z1, v[k + 2]); }
  const wx = x1 - x0 + 1, wy = y1 - y0 + 1, wz = z1 - z0 + 1; const W = 2 * (wx + wy) + 6, H = wx + wy + 2 * wz + 6;
  const M = Math.max(W, H); let s = clamp(Math.floor(box / M * 2) / 2, 1, 3); if (M > box * 1.15) s = Math.max(.5, Math.floor(box / M * 4) / 4);
  const html = `<img class="bh-ico" src="${url}" width="${Math.round(W * s)}" height="${Math.round(H * s)}" alt="">`;
  (BH.icons ||= new Map()).set(key, html); return html;
}
const BH_PXC = { K: "#0B0B0B", W: "#F4F4F2", w: "#D6D6D2", Y: "#FFD23F", B: "#7BA4FF", L: "#BFD8FF", N: "#8A6A4E", n: "#C9A57A", G: "#6FBF6F", g: "#9DD7A8", S: "#DCE0E6", s: "#9AA0A8", P: "#EFE0BC", p: "#D9C08E", O: "#FF9F43", R: "#FF5A5F", M: "#C7DEC4", E: "#FF7EB0" };
const BH_ART = {
  hand: ["....KK......", "...KWWK.....", "...KWWK.....", "...KWWKKK...", "...KWWKWWKK.", ".KKKWWKWWKWK", "KWWKWWWWWKWK", "KWWWWWWWWWWK", ".KWWWWWWWWWK", "..KWWWWWWWK.", "...KYYYYYK..", "...KKKKKKK.."],
  seed: ["..KKKKKKKK..", "..KppppppK..", "..KKKKKKKK..", "..KPPPPPPK..", "..KPPGGPPK..", "..KPGGGGPK..", "..KPPGGPPK..", "..KPPPGPPK..", "..KPPPGPPK..", "..KPPPPPPK..", "..KKKKKKKK..", "............"],
  water: ["............", "......KKKK..", ".....K....K.", "K...KKKKKKKK", "KK.KBBBBBBBK", ".KKBLLBBBBBK", "..KBBBBBBBBK", "...KBBBBBBBK", "....KBBBBBBK", "....KBBBBBBK", "....KKKKKKKK", "............"],
  harvest: ["...KKKKKK...", ".KKSSSSSSK..", "KSSKKKKKSK..", "KKK....KNK..", ".......KNK..", "......KNK...", "......KNK...", ".....KNK....", ".....KNK....", "....KNK.....", "....KKK.....", "............"],
  build: ["..KKKKKKK...", ".KSSSSSSSK..", ".KSSSSSSSKK.", ".KsssssssK..", "..KKKKNKK...", ".....KNK....", ".....KNK....", ".....KNK....", ".....KNK....", ".....KNK....", ".....KKK....", "............"],
  food: ["..KK.KK.", ".KOOKOOK", "KOOOOOOK", "KOOOOOOK", ".KOOOOK.", "..KKKK.."],
  mood: [".KK.KK.", "KEEKEEK", "KEEEEEK", ".KEEEK.", "..KEK..", "...K..."],
  energy: ["...KKK", "..KYYK", ".KYYK.", "KYYYYK", ".KKYK.", "..KYK.", "..KK.."],
  rotl: ["..CCCC..", ".C....C.", "C......C", "C.......", "CCC.....", ".CC.....", "..C....."],
  rotr: ["..CCCC..", ".C....C.", "C......C", ".......C", ".....CCC", ".....CC.", ".....C.."],
  sound: ["...C....", "..CC..C.", "CCCC.C..", "CCCC.C.C", "CCCC.C.C", "CCCC.C..", "..CC..C.", "...C...."],
  mute: ["...C....", "..CC....", "CCCC.C.C", "CCCC..C.", "CCCC..C.", "CCCC.C.C", "..CC....", "...C...."],
  sun: ["...Y...", ".Y...Y.", "...Y...", "Y.YYY.Y", "...Y...", ".Y...Y.", "...Y..."],
  cloud: [".......", "..WWW..", ".WWWWW.", "WWWWWWW", ".......", ".......", "......."],
  rain: ["..WWW..", ".WWWWW.", "WWWWWWW", ".......", ".L.L.L.", "L.L.L..", "......."],
  moon: ["..YYY..", ".YY....", "YY.....", "YY.....", "YY.....", ".YY....", "..YYY.."],
  star: ["...Y...", "...Y...", "YYYYYYY", ".YYYYY.", "..YYY..", ".YY.YY.", "Y.....Y"],
  coin: [".KKKK.", "KYYYYK", "KYKKYK", "KYYYYK", "KYKKYK", "KYYYYK", ".KKKK."]
};
function bhPx(name, scale = 2) {
  const rows = BH_ART[name]; if (!rows) return ""; const h = rows.length, w = rows[0].length; let r = "";
  rows.forEach((row, y) => { let x = 0; while (x < row.length) { const ch = row[x]; if (ch === ".") { x++; continue; } let e = x; while (e < row.length && row[e] === ch) e++; r += `<rect x="${x}" y="${y}" width="${e - x}" height="1" fill="${BH_PXC[ch] || "currentColor"}"/>`; x = e; } });
  return `<svg class="bhpx" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
}
let BH_CURS = null;
function bhCursors() {
  if (BH_CURS) return BH_CURS; BH_CURS = {};
  const mk = (rows, hot) => { const s = 2; const w = rows[0].length, h = rows.length; const c = document.createElement("canvas"); c.width = w * s; c.height = h * s; const x = c.getContext("2d"); rows.forEach((row, y) => [...row].forEach((ch, i) => { const col = BH_PXC[ch]; if (!col) return; x.fillStyle = col; x.fillRect(i * s, y * s, s, s); })); return `url("${c.toDataURL()}") ${hot[0] * s} ${hot[1] * s}, crosshair`; };
  BH_CURS.seed = mk(BH_ART.seed, [5, 10]); BH_CURS.water = mk(BH_ART.water, [0, 3]); BH_CURS.harvest = mk(BH_ART.harvest, [1, 3]); BH_CURS.build = mk(BH_ART.build, [6, 2]);
  return BH_CURS;
}

// ---------- HUD ----------
const PHASE_NAME = { day: "白天", dusk: "傍晚", dawn: "清晨", night: "夜晚" };
const WEATHER_NAME = { sun: "晴", cloud: "多云", rain: "下雨" };
function bhHudHTML() {
  const pt = state.pet; const s = pt.stats; const L = petLevel(), cur = LEVEL_XP(L), next = LEVEL_XP(L + 1); const ph = dayPhase();
  const meter = (k, l, v) => `<div class="bh-meter ${k}" title="${l} ${Math.round(v)}">${bhPx(k)}<span class="bp-bar ${k}"><i style="width:${Math.round(v)}%"></i></span></div>`;
  const wIco = BH.weather === "rain" ? "rain" : BH.weather === "cloud" ? "cloud" : ph === "night" ? "moon" : "sun";
  return `<div class="bh-card bh-me"><button class="bh-ava" data-act="bh-bitcard" aria-label="Bit 的状态"><i></i><i></i></button>
      <div class="bh-me-t"><b class="px">Bit 的家园</b><span class="px">Lv.${L} ${esc(petRank(L))}</span><span class="bp-bar xp" title="成长值 ${pt.xp - cur}/${next - cur}"><i style="width:${Math.round((pt.xp - cur) / (next - cur) * 100)}%"></i></span></div>
      <div class="bh-meters">${meter("food", "饱腹", s.food)}${meter("mood", "心情", s.mood)}${meter("energy", "精力", s.energy)}</div></div>
    <div class="bh-chips">
      <span class="bh-chip px" title="天气和时间">${bhPx(wIco)}${WEATHER_NAME[BH.weather] || "晴"} · ${PHASE_NAME[ph]} ${new Date().toTimeString().slice(0, 5)}</span>
      <span class="bh-chip px" title="家园评分">${bhPx("star")}${bhRating()}</span>
      <span class="bh-chip coin px" title="bitcoin">${bhPx("coin")}<b data-coins>${pt.coins}</b></span>
      <button class="bh-chip ico" data-act="bh-sound" title="${home().sound === false ? "打开音效" : "关闭音效"}" aria-label="音效">${bhPx(home().sound === false ? "mute" : "sound")}</button>
      <button class="bh-x px" data-act="bh-close" aria-label="离开家园">离开 <kbd>Esc</kbd></button>
    </div>`;
}
function bhRefreshHud() { if (!BH.open) return; const h = $(".bh-hud"); if (h) h.innerHTML = bhHudHTML(); const t = $(".bh-tabs [data-tab='tasks']"); if (t) t.classList.toggle("has-new", bhTaskReady()); }
function bhDockHTML() {
  return `<div class="bh-tools" role="toolbar" aria-label="工具">${TOOLS.map(([k, l, key]) => `<button class="bh-tool ${BH.tool === k ? "on" : ""}" data-act="bh-tool" data-tool="${k}" title="${l}（${key}）">${bhPx(k)}<span class="px">${l}</span><kbd>${key}</kbd></button>`).join("")}</div>
    <span class="bh-sep"></span><div class="bh-quick" aria-label="快捷栏"></div><span class="bh-sep"></span>
    <div class="bh-view"><button class="bh-vbtn" data-act="bh-rot" data-dir="-1" title="向左转（Q）">${bhPx("rotl")}</button><button class="bh-vbtn" data-act="bh-rot" data-dir="1" title="向右转（E）">${bhPx("rotr")}</button><button class="bh-vbtn px" data-act="bh-zoom" data-dir="-1" title="缩小（-）">−</button><button class="bh-vbtn px" data-act="bh-zoom" data-dir="1" title="放大（+）">+</button></div>`;
}
function bhRenderQuick() {
  if (!BH.open) return; const el = $(".bh-quick"); if (!el) return; const h = home();
  const seeds = Object.keys(CROPS).filter(k => (h.inv[`s_${k}`] || 0) > 0);
  const foods = [...Object.keys(CROPS).filter(k => CROPS[k].food && h.inv[k] > 0).map(k => [k, "crop", k, CROPS[k].name]), ...Object.keys(GOODS).filter(k => GOODS[k].food && h.inv[k] > 0).map(k => [k, "good", k, GOODS[k].name]), ...Object.keys(FISH).filter(k => FISH[k].food && h.inv[`f_${k}`] > 0).map(k => [`f_${k}`, "fishc", k, FISH[k].name])];
  if (BH.seed && !seeds.includes(BH.seed)) BH.seed = "";
  el.innerHTML = (seeds.length ? `<span class="bh-qlab px">种子</span>${seeds.map(k => `<button class="bh-slot ${BH.seed === k && BH.tool === "seed" ? "on" : ""}" data-act="bh-seed" data-k="${k}" title="${CROPS[k].name}种子 · ${fmtMin(CROPS[k].grow)}成熟">${bhIco("seed", k, 40)}<em class="px">${h.inv[`s_${k}`]}</em></button>`).join("")}` : `<span class="bh-qlab px">没有种子</span><button class="bh-slot add px" data-act="bh-shop" data-shop="seed" title="去商店买种子">+</button>`)
    + `<span class="bh-qgap"></span>` + (foods.length ? `<span class="bh-qlab px">喂 Bit</span>${foods.slice(0, 6).map(([k, t, kind, n]) => `<button class="bh-slot food" data-food="${k}" title="${n}：点一下喂，或者拖到 Bit 身上">${bhIco(t, kind, 40)}<em class="px">${h.inv[k]}</em></button>`).join("")}` : `<span class="bh-qlab px">还没有吃的</span>`);
}

// ---------- 抽屉：商店 / 仓库 / 委托 / 成长 ----------
function bhShopItems(tab) {
  const h = home(); const L = petLevel();
  const row = (type, kind, d, price, extra = "") => ({ type, kind, name: d.name, price, lv: d.lv || 1, locked: L < (d.lv || 1), extra });
  if (tab === "seed") return Object.entries(CROPS).map(([k, c]) => row("seed", k, c, c.seed, `${fmtMin(c.grow)}成熟 · 卖 ${c.sell}₿${k === "tomato" || k === "strawberry" ? " · 一次收 2 个" : ""}`));
  if (tab === "animal") return Object.entries(ANIMALS).map(([k, a]) => row("animal", k, a, a.price, `每 ${fmtMin(a.every)}产${GOODS[a.product].name}（${GOODS[a.product].sell}₿）`));
  if (tab === "fish") return Object.entries(FISH).map(([k, f]) => row("fish", k, f, f.price, `${fmtMin(f.grow)}长大 · 卖 ${f.sell}₿`));
  if (tab === "facility") return Object.entries(FACILITIES).map(([k, f]) => { const done = k === "farm2" || k === "sprinkler" || k === "windmill" ? h.owned[k] : k === "pen" ? h.size.pen >= 6 : h.size.pond >= 6; return { ...row("facility", k, f, f.price, k === "pen" ? `${f.desc}　现在 ${h.size.pen} 只` : k === "pond" ? `${f.desc}　现在 ${h.size.pond} 条` : f.desc), done }; });
  if (tab === "furni") return Object.entries(FURNI).map(([k, f]) => row("furni", k, f, f.price, `评分 +${f.score} · 占 ${f.fp[0]}×${f.fp[1]} 格${f.note ? ` · ${f.note}` : ""}`));
  return Object.entries(DECOR).filter(([, f]) => !f.hidden).map(([k, f]) => row("decor", k, f, f.price, `评分 +${f.score}${f.fp[0] > 1 ? ` · 占 ${f.fp[0]}×${f.fp[1]} 格` : ""}${f.note ? ` · ${f.note}` : ""}`));
}
function bhSideHTML() {
  const h = home(); const pt = state.pet;
  if (BH.tab === "shop") {
    const items = bhShopItems(BH.shop);
    return `<nav class="bh-sub" role="tablist">${SHOP_TABS.map(([k, l]) => `<button role="tab" class="${BH.shop === k ? "on" : ""}" data-act="bh-shop" data-shop="${k}">${l}</button>`).join("")}</nav>
      <div class="bh-list">${items.map(it => `<div class="bh-row ${it.locked ? "locked" : ""} ${it.done ? "done" : ""}"><span class="bh-ico-box">${bhIco(it.type, it.kind)}</span><div class="bh-row-t"><b>${esc(it.name)}</b><span class="px faint">${esc(it.extra)}</span></div><div class="bh-row-a">${it.done ? `<span class="px faint">已拥有</span>` : it.locked ? `<span class="px lock">Lv.${it.lv} 解锁</span>` : `<button class="bh-buy" data-act="bh-buy" data-type="${it.type}" data-kind="${it.kind}" ${pt.coins < it.price ? "disabled" : ""}>${bhPx("coin", 1.5)}<span class="px">${it.price}</span></button>${it.type === "seed" ? `<button class="bh-buy x5" data-act="bh-buy" data-type="seed" data-kind="${it.kind}" data-n="5" ${pt.coins < it.price * 5 ? "disabled" : ""} title="买 5 包"><span class="px">×5</span></button>` : ""}`}</div></div>`).join("")}</div>
      <p class="bh-tip px faint">${{ seed: "选好种子，用「播种」工具拖过空地一口气种一排", animal: `围栏 ${h.animals.length}/${h.size.pen}，动物脚边出现产物时点一下收集`, fish: `池塘 ${h.fish.length}/${h.size.pond}，点水面撒鱼食，鱼会游过来`, facility: "扩建和设施永久生效，会出现在岛上", furni: "买下后直接拿在手上，放进小屋，R 旋转", decor: "买下后放在空草地上，R 旋转；晚上路灯和灯架会亮" }[BH.shop]}</p>`;
  }
  if (BH.tab === "bag") {
    const groups = [
      ["作物", Object.keys(CROPS).filter(k => h.inv[k] > 0).map(k => ({ k, type: "crop", kind: k, name: CROPS[k].name, n: h.inv[k], sell: CROPS[k].sell, food: CROPS[k].food }))],
      ["产物与鱼获", [...Object.keys(GOODS).filter(k => h.inv[k] > 0).map(k => ({ k, type: "good", kind: k, name: GOODS[k].name, n: h.inv[k], sell: GOODS[k].sell, food: GOODS[k].food })), ...Object.keys(FISH).filter(k => h.inv[`f_${k}`] > 0).map(k => ({ k: `f_${k}`, type: "fishc", kind: k, name: FISH[k].name, n: h.inv[`f_${k}`], sell: FISH[k].sell, food: FISH[k].food }))]],
      ["种子", Object.keys(CROPS).filter(k => h.inv[`s_${k}`] > 0).map(k => ({ k: `s_${k}`, type: "seed", kind: k, name: `${CROPS[k].name}种子`, n: h.inv[`s_${k}`], seed: true }))],
      ["家具与装饰", [...Object.keys(FURNI).filter(k => h.inv[`u_${k}`] > 0).map(k => ({ k: `u_${k}`, type: "furni", kind: k, name: FURNI[k].name, n: h.inv[`u_${k}`], place: "furni" })), ...Object.keys(DECOR).filter(k => h.inv[`d_${k}`] > 0 && !DECOR[k].hidden).map(k => ({ k: `d_${k}`, type: "decor", kind: k, name: DECOR[k].name, n: h.inv[`d_${k}`], place: "decor" }))]]
    ];
    const any = groups.some(([, l]) => l.length); const sellable = groups[0][1].concat(groups[1][1]).reduce((a, it) => a + it.sell * it.n, 0);
    return `<div class="bh-list">${any ? groups.filter(([, l]) => l.length).map(([g, l]) => `<span class="bh-group px faint">${g}</span>${l.map(it => `<div class="bh-row"><span class="bh-ico-box">${bhIco(it.type, it.kind)}</span><div class="bh-row-t"><b>${esc(it.name)}　<span class="px">×${it.n}</span></b><span class="px faint">${it.sell ? `卖 ${it.sell}₿` : ""}${it.food ? `${it.sell ? " · " : ""}饱腹 +${it.food}` : ""}${it.seed ? "在快捷栏里选中后播种" : ""}${it.place ? "放进家园" : ""}</span></div><div class="bh-row-a">${it.food ? `<button class="btn line sm" data-act="bh-feed" data-k="${it.k}">喂</button>` : ""}${it.sell ? `<button class="btn line sm" data-act="bh-sell" data-k="${it.k}">卖 1</button>${it.n > 1 ? `<button class="btn quiet sm" data-act="bh-sell" data-k="${it.k}" data-all="1">全卖</button>` : ""}` : ""}${it.seed ? `<button class="btn line sm" data-act="bh-seed" data-k="${it.kind}">选中</button>` : ""}${it.place ? `<button class="btn primary sm" data-act="bh-place-inv" data-type="${it.place}" data-kind="${it.kind}">摆放</button>` : ""}</div></div>`).join("")}`).join("") : `<p class="empty-line">仓库是空的。去商店买点种子，或者收收作物和鸡蛋。</p>`}</div>${sellable ? `<p class="bh-tip"><button class="btn line sm" data-act="bh-sellall">全部卖掉 · +${sellable} ₿</button></p>` : ""}`;
  }
  if (BH.tab === "tasks") {
    petDailyReset();
    const d = pt.daily;
    return `<div class="bh-list"><div class="bh-streak"><span class="px faint">连续登录</span><b class="px-36">${pt.streak}</b><span class="px faint">天　明天再来 +${20 + Math.min(30, pt.streak * 5)} ₿</span></div>
      <span class="bh-group px faint">今日委托</span>${(d.pick || []).map(k => { const t = TASKS.find(x => x.k === k); if (!t) return ""; const v = Math.min(t.need, d.tasks[k] || 0); const done = v >= t.need; const got = d.claimed[k]; return `<div class="bh-task ${done ? "done" : ""} ${got ? "got" : ""}"><div class="bh-row-t"><b>${esc(t.name)}</b><div class="bp-bar"><i style="width:${Math.round(v / t.need * 100)}%"></i></div><span class="px faint">${v}/${t.need}　奖励 ${t.coins}₿ + ${t.xp} 成长值</span></div>${got ? `<span class="px faint">已领取</span>` : `<button class="btn ${done ? "primary" : "line"} sm" data-act="bh-claim" data-k="${k}" ${done ? "" : "disabled"}>领取</button>`}</div>`; }).join("")}
      <span class="bh-group px faint">今天的创作收入</span><div class="bh-cap"><div class="bp-bar coin"><i style="width:${Math.round(Math.min(1, d.coins / DAILY_CREATE_CAP) * 100)}%"></i></div><span class="px faint">${d.coins} / ${DAILY_CREATE_CAP} ₿　写脚本 +3 · 出图 +1 · 视频 +4 · 配乐 +2 · 导出 +5</span></div>
      <span class="bh-group px faint">家园小事</span><div class="bh-cap"><span class="px faint">信箱：${bhMailUnread() ? "有一封新信" : "今天的信已读"}　·　钓鱼：今天还能钓 ${Math.max(0, bhFishLeft())} 条</span></div></div>`;
  }
  const L = petLevel(), cur = LEVEL_XP(L), next = LEVEL_XP(L + 1);
  return `<div class="bh-list"><div class="bh-lv"><div class="bh-badge"><span class="px">Lv</span><b class="px-36">${L}</b></div><div><b class="px">${esc(petRank(L))}</b><div class="bp-bar xp"><i style="width:${Math.round((pt.xp - cur) / (next - cur) * 100)}%"></i></div><span class="px faint">${pt.xp - cur} / ${next - cur} 成长值　累计 ${pt.xp}</span></div></div>
    <span class="bh-group px faint">段位</span><ol class="bh-ranks">${RANKS.map(([lv, n], i) => { const end = RANKS[i + 1] ? RANKS[i + 1][0] - 1 : null; const on = L >= lv && (!end || L <= end); return `<li class="${on ? "on" : L > (end || 999) ? "past" : ""}"><span class="px">Lv.${lv}${end ? `–${end}` : "+"}</span><b>${n}</b></li>`; }).join("")}</ol>
    <span class="bh-group px faint">怎么长大</span><p class="bh-how">每次在交付页导出物料，Bit 都会获得成长值：完整内容包 +40，拍摄 / 剪辑 / 审核 / 发布包和封面各 +15，粗剪单 +10，画布工作流 +5。同一个项目的同一种导出，每天只算一次。</p>
    <span class="bh-group px faint">最近</span><div class="bh-hist">${pt.history.slice(-14).reverse().map(x => `<div><span>${esc(x.why || "")}</span><b class="px">${x.xp ? `+${x.xp} 成长` : ""}${x.xp && x.coins ? " · " : ""}${x.coins ? `+${x.coins} ₿` : ""}</b><em class="px faint">${when(x.t)}</em></div>`).join("") || `<p class="dim" style="font-size:13px">还没有记录。导出第一份交付物料试试。</p>`}</div></div>`;
}
function bhTaskReady() { const d = state.pet.daily; return (d.pick || []).some(k => { const t = TASKS.find(x => x.k === k); return t && !d.claimed[k] && (d.tasks[k] || 0) >= t.need; }); }
function bhRenderSide() {
  if (!BH.open) return; const el = $(".bh-panel"); if (!el) return;
  const sc = $(".bh-list", el)?.scrollTop || 0; el.innerHTML = bhSideHTML();
  $$(".bh-tabs [data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === BH.tab));
  const l = $(".bh-list", el); if (l) l.scrollTop = sc;
  bhRefreshHud(); bhRenderQuick();
}

// ---------- 飘字、气泡、提示、弹层 ----------
function bhFloatCss(x, y, text, cls = "") { const fx = $(".bh-fx"); if (!fx) return; const d = document.createElement("div"); d.className = `bh-float px ${cls}`; d.textContent = text; d.style.left = `${x}px`; d.style.top = `${y}px`; fx.appendChild(d); setTimeout(() => d.remove(), 1300); }
function bhFloatW(x, y, z, text, cls = "") { const p = bhWorldCss(x, y, z); bhFloatCss(p.x, p.y, text, cls); }
function bhHudFloat(text, cls = "") { const c = $(".bh-chip.coin"); const fx = $(".bh-fx"); if (!c || !fx) return; const r = c.getBoundingClientRect(), f = fx.getBoundingClientRect(); bhFloatCss(r.left - f.left + r.width / 2, r.bottom - f.top + 6, text, `hud ${cls}`); }
function bhFly(html, from, toSel) {
  const fx = $(".bh-fx"); const to = $(toSel); if (!fx || !to || reduceMotion() || !Element.prototype.animate) return; const f = fx.getBoundingClientRect(), r = to.getBoundingClientRect();
  const d = document.createElement("div"); d.className = "bh-fly"; d.innerHTML = html; fx.appendChild(d);
  const tx = r.left - f.left + r.width / 2, ty = r.top - f.top + r.height / 2; const mx = (from.x + tx) / 2, my = Math.min(from.y, ty) - 60;
  d.animate([{ transform: `translate(${from.x}px,${from.y}px) translate(-50%,-50%) scale(1)` }, { transform: `translate(${mx}px,${my}px) translate(-50%,-50%) scale(1.15)`, offset: .45 }, { transform: `translate(${tx}px,${ty}px) translate(-50%,-50%) scale(.5)`, opacity: .6 }], { duration: 640, easing: "steps(12)" }).onfinish = () => { d.remove(); to.classList.remove("ping"); void to.offsetWidth; to.classList.add("ping"); };
}
function bhToast(text) { toast(text, 2400); }
function bhToolHint(text, ms = 2200) { const el = $(".bh-hint"); if (!el) return; el.textContent = text; el.classList.add("on"); clearTimeout(BH.hintT); BH.hintT = setTimeout(() => el.classList.remove("on"), ms); }
function bhTipHTML(o, pid) {
  const h = home(); if (!o) return "";
  if (o.type === "plot") { const pl = h.plots[o.i]; if (!pl) return `<b>未开垦</b><span>在商店「设施」扩建农田（Lv.${FACILITIES.farm2.lv}）</span>`; if (!pl.crop) return `<b>空地</b><span>${BH.seed ? `点一下种${CROPS[BH.seed].name}` : "选一种种子播种"}</span>`; const st = cropStage(pl); const c = CROPS[pl.crop]; return st === 3 ? `<b>${c.name} · 成熟了</b><span>点一下收获</span>` : `<b>${c.name} · ${Math.round(pl.prog * 100)}%</b><span>还要约 ${fmtMin(minsLeft(pl))}${plotWet(pl) ? " · 湿润" : " · 有点干"}</span>`; }
  if (o.type === "animal") { const a = h.animals.find(x => x.id === o.id); if (!a) return ""; const d = ANIMALS[a.kind]; const left = Math.max(1, Math.ceil((d.every * 60000 - (Date.now() - (a.last || 0))) / 60000)); return `<b>${esc(a.name || d.name)}</b><span>${animalReady(a) ? `${GOODS[d.product].name}好了，点一下收集` : `${fmtMin(left)}后产${GOODS[d.product].name} · 点一下摸摸`}</span>`; }
  if (o.type === "prod") { const a = h.animals.find(x => x.id === o.id); return a ? `<b>${GOODS[ANIMALS[a.kind].product].name}</b><span>点一下收集</span>` : ""; }
  if (o.type === "fish") { const f = h.fish.find(x => x.id === o.id); if (!f) return ""; const d = FISH[f.kind]; return `<b>${d.name}</b><span>${fishGrown(f) ? "长大了，右键可以捞起来" : `还要 ${fmtMin(Math.max(1, Math.ceil((d.grow * 60000 - (Date.now() - new Date(f.at).getTime())) / 60000)))}长大`}</span>`; }
  if (o.type === "bit") { const s = state.pet.stats; const st = BH.bit?.st; return `<b>Bit · Lv.${petLevel()} · ${st === "sleep" ? "睡着了" : st === "fish" ? "在钓鱼" : st === "work" ? "在写稿" : `饱腹 ${Math.round(s.food)}`}</b><span>点一下摸摸 · 拖食物来喂 · 右键看状态</span>`; }
  if (o.type === "furni" || o.type === "decor") { const list = o.type === "furni" ? h.furniture : h.decor; const it = list.find(x => x.id === o.id); const d = (o.type === "furni" ? FURNI : DECOR)[it?.kind]; return d ? `<b>${d.name} · 评分 +${d.score}</b><span>${BH.tool === "build" ? "点一下拿起来移动" : bhUseHint(it.kind)}</span>` : ""; }
  const T = { mailbox: bhMailUnread() ? ["信箱 · 有新信", "点一下看看"] : ["信箱", "今天的信已经读过了"], dock: ["栈桥", `点一下让 Bit 去钓鱼 · 今天还能钓 ${Math.max(0, bhFishLeft())} 条`], pond: ["池塘", h.fish.length ? "点水面撒鱼食" : "去商店买点鱼苗"], trough: ["食槽", "点一下添草料，动物会过来吃"], fence: ["围栏", `住着 ${h.animals.length}/${h.size.pen} 只`], windmill: ["风车", "所有作物再快 20%"], millspot: ["风车用地", `Lv.${FACILITIES.windmill.lv} 可以在设施里建风车`], sprspot: ["洒水器位置", `Lv.${FACILITIES.sprinkler.lv} 可以在设施里装洒水器`], sprinkler: ["洒水器", "农田一直保持湿润"], scarecrow: ["稻草人", "帮你看着农田"], sign: ["Bit 家园", `评分 ${bhRating()} · 来过 ${h.visits} 次`] }[o.type];
  if (T) return `<b>${T[0]}</b><span>${T[1]}</span>`;
  if (o.type === "tile" && BH.tool === "hand" && BH.grid?.[o.tx + o.ty * HTW]) return "";
  return "";
}
function bhUseHint(kind) { return { lamp: "点一下开关灯", lightstand: "点一下开关灯", lamp2: "点一下开关灯", bench: "点一下让 Bit 坐一会儿", bed: "点一下让 Bit 睡个午觉", desk: "点一下让 Bit 写会儿稿", tv: "点一下打开电视", camera: "点一下拍张照", fountain: "点一下溅点水花", flowers: "点一下闻闻花", tree: "点一下摇摇树", pinktree: "点一下摇摇树", bush: "点一下拨拨草", trophy: "金光闪闪" }[kind] || "右键可以移动或收起"; }
function bhTipUpdate(ev) {
  const tip = $(".bh-tip-f"); if (!tip) return; const o = bhObj(BH.hover);
  const html = BH.press?.pan || BH.drag || BH.pop || BH.placing ? "" : bhTipHTML(o, BH.hover);
  if (!html) { tip.classList.remove("on"); BH.tipHTML = ""; return; }
  if (html !== BH.tipHTML) { tip.innerHTML = html; BH.tipHTML = html; }
  if (ev) { const f = $(".bh-fx").getBoundingClientRect(); const x = ev.clientX - f.left + 16, y = ev.clientY - f.top + 18; tip.style.transform = `translate(${Math.min(x, f.width - tip.offsetWidth - 8)}px, ${Math.min(y, f.height - tip.offsetHeight - 8)}px)`; }
  tip.classList.add("on");
}
function bhPopOpen(pid, html) {
  const fx = $(".bh-fx"); if (!fx) return; bhPopClose();
  const el = document.createElement("div"); el.className = "bh-pop"; el.innerHTML = html; fx.appendChild(el);
  const box = BH.E.boxOf(pid); const f = fx.getBoundingClientRect(); let ax = f.width / 2, ay = f.height / 2;
  if (box) { const a = bhToCss((box[0] + box[2]) / 2, box[1]); ax = a.x; ay = a.y; }
  const w = el.offsetWidth, hh = el.offsetHeight; let top = ay - hh - 12; if (top < 80) top = ay + 40;
  el.style.left = `${clamp(ax - w / 2, 12, f.width - w - 12)}px`; el.style.top = `${clamp(top, 72, f.height - hh - 110)}px`;
  BH.pop = el; BH.popPid = pid; $(".bh-tip-f")?.classList.remove("on"); requestAnimationFrame(() => el.classList.add("in"));
}
function bhPopClose() { $$(".bh-pop").forEach(e => e.remove()); BH.pop = null; BH.popPid = 0; }
function bhUpdateOverlays() {
  const b = BH.bit; if (b?.sayEl) { const p = bhWorldCss(b.x, b.y, b.z + 13 + b.hop); b.sayEl.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`; }
  if (BH.tipHTML && BH.t - (BH.tipAt || 0) > 500) { BH.tipAt = BH.t; const html = bhTipHTML(bhObj(BH.hover), BH.hover); const tip = $(".bh-tip-f"); if (tip && html && html !== BH.tipHTML) { tip.innerHTML = html; BH.tipHTML = html; } }
}
// 弹层内容
function bhPopPlot(pl) {
  const h = home();
  if (!pl.crop) {
    const seeds = Object.keys(CROPS).filter(k => (h.inv[`s_${k}`] || 0) > 0);
    return `<b class="px">空地</b>${seeds.length ? `<p>选一种种子种下（也可以在下面的快捷栏选中种子，再用「播种」工具拖一排）：</p><div class="bp-grid">${seeds.map(k => `<button class="bp-item" data-act="bh-plant" data-i="${pl.i}" data-crop="${k}">${bhIco("seed", k, 28)}<span>${CROPS[k].name}</span><em class="px">×${h.inv[`s_${k}`]} · ${fmtMin(CROPS[k].grow)}</em></button>`).join("")}</div>` : `<p>仓库里没有种子了。</p>`}<div class="bp-acts"><button class="btn line sm" data-act="bh-shop" data-shop="seed">去买种子</button></div>`;
  }
  const c = CROPS[pl.crop]; const wet = plotWet(pl);
  return `<b class="px">${c.name}</b><div class="bp-bar"><i style="width:${Math.round(pl.prog * 100)}%"></i></div><p>${Math.round(pl.prog * 100)}%　还要约 ${fmtMin(minsLeft(pl))}${wet ? "　· 湿润中" : ""}</p><div class="bp-acts">${h.owned.sprinkler ? `<span class="px faint">洒水器在帮忙浇水</span>` : wet ? `<span class="px faint">刚浇过水，长得快 50%</span>` : `<button class="btn primary sm" data-act="bh-water" data-i="${pl.i}">浇水</button>`}<button class="btn quiet sm" data-act="bh-dig" data-i="${pl.i}">铲掉</button></div>`;
}
function bhPopBit() {
  const s = state.pet.stats; const h = home();
  const foods = [...Object.keys(CROPS).filter(k => CROPS[k].food && h.inv[k] > 0).map(k => [k, "crop", k, CROPS[k].name, CROPS[k].food]), ...Object.keys(GOODS).filter(k => GOODS[k].food && h.inv[k] > 0).map(k => [k, "good", k, GOODS[k].name, GOODS[k].food]), ...Object.keys(FISH).filter(k => FISH[k].food && h.inv[`f_${k}`] > 0).map(k => [`f_${k}`, "fishc", k, FISH[k].name, FISH[k].food])];
  const bar = (l, v, c) => `<div class="bp-stat"><span class="px">${l}</span><div class="bp-bar ${c}"><i style="width:${Math.round(v)}%"></i></div><em class="px">${Math.round(v)}</em></div>`;
  return `<b class="px">Bit · Lv.${petLevel()} ${esc(petRank())}</b>${bar("饱腹", s.food, "food")}${bar("心情", s.mood, "mood")}${bar("精力", s.energy, "energy")}${foods.length ? `<p>喂点什么？</p><div class="bp-grid">${foods.slice(0, 6).map(([k, t, kind, n, v]) => `<button class="bp-item" data-act="bh-feed" data-k="${k}">${bhIco(t, kind, 28)}<span>${n}</span><em class="px">饱腹 +${v}</em></button>`).join("")}</div>` : `<p>仓库里没有吃的。种点萝卜或者养只小鸡吧。</p>`}<div class="bp-acts"><button class="btn line sm" data-act="bh-pat">摸摸 Bit</button><button class="btn quiet sm" data-act="bh-call">叫它过来</button><button class="btn quiet sm" data-act="bh-fish">去钓鱼</button></div>`;
}
function bhPopItem(type, it) {
  if (!it) return ""; const d = (type === "furni" ? FURNI : DECOR)[it.kind];
  return `<b class="px">${d.name}</b><p>家园评分 +${d.score}${d.note ? `　· ${esc(d.note)}` : ""}</p><div class="bp-acts"><button class="btn line sm" data-act="bh-move" data-type="${type}" data-id="${attr(it.id)}">移动</button><button class="btn line sm" data-act="bh-rotate-item" data-type="${type}" data-id="${attr(it.id)}">旋转</button><button class="btn quiet sm" data-act="bh-store" data-type="${type}" data-id="${attr(it.id)}">收进仓库</button></div>`;
}
function bhPopAnimal(a) {
  const d = ANIMALS[a.kind];
  return `<b class="px">${esc(a.name || d.name)}</b><p>每 ${fmtMin(d.every)}产一个${GOODS[d.product].name}。</p><div class="bp-acts"><button class="btn line sm" data-act="bh-rename-animal" data-id="${attr(a.id)}">起名</button></div>`;
}
function bhPopFish(f) {
  const d = FISH[f.kind];
  return `<b class="px">${d.name}</b><p>${fishGrown(f) ? `长大了，可以捞起来（卖 ${d.sell} ₿${d.food ? " 或喂 Bit" : ""}），也可以继续养着加评分。` : "还小，再养一阵子。"}</p><div class="bp-acts">${fishGrown(f) ? `<button class="btn primary sm" data-act="bh-catch" data-id="${attr(f.id)}">捞起</button>` : ""}</div>`;
}

// ---------- 信箱：每天一封信，带一点小礼物 ----------
const LETTERS = [
  ["来自 Bit 家园管理处", "今天的风很适合晒稿子。记得给作物浇水，也给自己倒杯水。"],
  ["一张便签", "听说池塘里的鱼会认人。常去撒点鱼食，它们会游过来打招呼。"],
  ["邻居的问候", "你的小屋越来越像片场了！晚上路灯亮起来的时候特别好看。"],
  ["灵感快递", "好选题常常藏在日常里。今天试试从一个小物件讲起？"],
  ["Bit 写给你", "谢谢你今天也来看我。我把门口扫干净了，等你回来。"],
  ["天气预报", "据说今天会有好天气，也可能会下雨。下雨的话，作物会自己喝饱水。"],
  ["钓鱼协会", "栈桥那边最近常有锦鲤出没，浮漂一沉就要立刻点！"],
  ["创作小贴士", "导出一次完整内容包，Bit 能长一大截成长值。"]
];
function bhMailUnread() { const h = state?.pet?.home; return Boolean(h) && h.mail?.date !== dayKey(); }
function bhMailToday() {
  let s = 0; for (const c of dayKey()) s = (s * 31 + c.charCodeAt(0)) >>> 0; const L = LETTERS[s % LETTERS.length];
  const crops = Object.keys(CROPS).filter(k => CROPS[k].lv <= petLevel()); const seed = crops[s % crops.length];
  return { from: L[0], text: L[1], coins: 8 + (s % 13), seed, n: 1 + (s % 2) };
}
function bhPopMail() {
  const m = bhMailToday();
  return `<div class="bh-letter"><span class="px faint">${esc(m.from)}</span><p>${esc(m.text)}</p><div class="bh-gift">${bhPx("coin")}<b class="px">${m.coins} ₿</b><span class="px faint">+</span>${bhIco("seed", m.seed, 24)}<b class="px">${CROPS[m.seed].name}种子 ×${m.n}</b></div></div><div class="bp-acts"><button class="btn primary sm" data-act="bh-mail-take">收下</button></div>`;
}

// ---------- 农田操作 ----------
function bhPlant(pl, k) {
  const h = home(); if (!pl || pl.crop || !(h.inv[`s_${k}`] > 0) || petLevel() < CROPS[k].lv) return false;
  h.inv[`s_${k}`] -= 1; Object.assign(pl, { crop: k, prog: 0, at: Date.now(), wet: BH.weather === "rain" ? Date.now() + 30 * 60000 : 0 });
  const t = plotTile(pl.i); bhBurst(t.x * 8 + 4, t.y * 8 + 4, 7, 5, [0x8E715A, 0x6FBF6F], 3, 5); bhSfx("plant", BH.sweep?.n || 0);
  if (!BH.sweep || BH.sweep.n < 1) bhFloatW(t.x * 8 + 4, t.y * 8 + 4, 10, `种下${CROPS[k].name}`, "good");
  BH.sig = ""; save(); bhRenderQuick(); return true;
}
function bhWater(pl) {
  if (!pl?.crop || cropStage(pl) >= 3 || plotWet(pl)) return false;
  bhGrow(); pl.wet = Date.now() + 30 * 60000; const t = plotTile(pl.i);
  for (let i = 0; i < 10; i++) bhPart({ x: t.x * 8 + 1 + Math.random() * 6, y: t.y * 8 + 1 + Math.random() * 6, z: 14 + Math.random() * 3, vz: -10, g: 18, life: .5, c: pick([0x9FC4FF, 0xBFD8FF, 0xFFFFFF]), floor: 7 });
  bhSfx("water"); if (!BH.sweep || BH.sweep.n < 1) bhFloatW(t.x * 8 + 4, t.y * 8 + 4, 10, "浇好了", "water"); BH.sig = ""; save(); return true;
}
function bhHarvest(pl) {
  const c = CROPS[pl.crop]; if (!c || cropStage(pl) !== 3) return false; const h = home(); const t = plotTile(pl.i);
  const n = pl.crop === "tomato" || pl.crop === "strawberry" ? 2 : 1;
  h.inv[pl.crop] = (h.inv[pl.crop] || 0) + n; Object.assign(pl, { crop: "", prog: 0, at: Date.now(), wet: 0 });
  const combo = BH.sweep ? ++BH.sweep.harv : 1;
  bhBurst(t.x * 8 + 4, t.y * 8 + 4, 9, 10, [hex(c.c), 0xFFFFFF, 0x8FD48F], 6, 10); bhSfx("harvest", combo);
  bhFloatW(t.x * 8 + 4, t.y * 8 + 4, 12, combo > 1 ? `+${n} ${c.name}　×${combo}` : `+${n} ${c.name}`, "good");
  const p = bhWorldCss(t.x * 8 + 4, t.y * 8 + 4, 10); bhFly(bhIco("crop", pl.crop || Object.keys(CROPS).find(k => CROPS[k] === c), 28), p, ".bh-tabs [data-tab='bag']");
  petEvent("harvest"); BH.sig = ""; save(); bhRenderQuick(); return true;
}
function bhPlotAct(i, tool, click) {
  const h = home(); const pl = h.plots[i];
  if (!pl) { if (click) bhPopOpen(PID.plot + i, `<b class="px">还没开垦</b><p>在商店「设施」里购买「扩建农田」（Lv.${FACILITIES.farm2.lv}），这一排 6 块地就能种了。</p><div class="bp-acts"><button class="btn line sm" data-act="bh-shop" data-shop="facility">去看看</button></div>`); return false; }
  const st = cropStage(pl);
  if (tool === "harvest") return bhHarvest(pl);
  if (tool === "water") return bhWater(pl);
  if (tool === "seed") { if (st >= 0) return false; let k = BH.seed && h.inv[`s_${BH.seed}`] > 0 ? BH.seed : Object.keys(CROPS).find(x => h.inv[`s_${x}`] > 0 && petLevel() >= CROPS[x].lv); if (!k) { if (click) { bhToolHint("没有种子了，去商店买一点"); bhSfx("err"); } return false; } BH.seed = k; return bhPlant(pl, k); }
  if (!click) return false;
  if (st === 3) return bhHarvest(pl);
  if (st < 0) { if (BH.seed && h.inv[`s_${BH.seed}`] > 0) return bhPlant(pl, BH.seed); bhPopOpen(PID.plot + i, bhPopPlot(pl)); return false; }
  bhPopOpen(PID.plot + i, bhPopPlot(pl)); return false;
}
function bhCollect(a) {
  const g = ANIMALS[a.kind].product; const h = home(); const m = BH.mobs.get(a.id); a.last = Date.now();
  h.inv[g] = (h.inv[g] || 0) + 1; const at = m?.prod || m || { x: 110, y: 55 };
  bhBurst(at.x + 1, at.y + 1, 8, 8, [0xFFFFFF, VPAL.YEL], 5, 9); bhFloatW(at.x, at.y, 11, `+1 ${GOODS[g].name}`, "good"); bhSfx("coin");
  bhFly(bhIco("good", g, 28), bhWorldCss(at.x, at.y, 8), ".bh-tabs [data-tab='bag']");
  if (m) { m.prod = null; m.hopV = 12; m.hop = .01; }
  petEvent("collect"); save(); bhRenderQuick();
}
function bhPetAnimal(a) {
  const m = BH.mobs.get(a.id); if (!m) return; m.wait = 1600; m.hopV = 14; m.hop = .01;
  bhPart({ x: m.x, y: m.y, z: 13, vz: 5, g: 0, life: 1, pat: "heart", keep: true }); bhSfx("pet");
  const d = state.pet.daily; d.petA = (d.petA || 0) + 1; if (d.petA <= 20) state.pet.stats.mood = clamp(state.pet.stats.mood + 1, 0, 100);
  bhRefreshHud();
}
// ---------- 摆放 ----------
function bhStartPlace(type, kind, opts = {}) {
  bhPopClose(); BH.placing = { type, kind, id: opts.id || "", r: opts.r || 0, orig: opts.orig || null, at: BH.placeHover || null };
  bhToolHint(`${type === "furni" ? `把「${FURNI[kind].name}」放进小屋` : `把「${DECOR[kind].name}」放到空草地上`}　R 旋转 · 右键 / Esc 取消`, 4200);
  bhCursor();
}
function bhPickUp(type, id) {
  const h = home(); const list = type === "furni" ? h.furniture : h.decor; const it = list.find(x => x.id === id); if (!it) return;
  list.splice(list.indexOf(it), 1); BH.ver++; BH.sig = ""; bhSfx("pop");
  bhStartPlace(type, it.kind, { id: it.id, r: it.r || 0, orig: { ...it } });
}
function bhEndPlace(cancel = true) {
  const pl = BH.placing; if (!pl) return; BH.placing = null; const h = home();
  if (cancel) { if (pl.orig) { (pl.type === "furni" ? h.furniture : h.decor).push(pl.orig); } else { const k = `${pl.type === "furni" ? "u" : "d"}_${pl.kind}`; h.inv[k] = (h.inv[k] || 0) + 1; toast("已收进仓库，随时可以再放出来", 2000); } BH.ver++; BH.sig = ""; save(); bhRenderSide(); }
  $(".bh-hint")?.classList.remove("on"); bhCursor();
}
function bhPlaceAt() {
  const pl = BH.placing; if (!pl?.at) return; const { x, y } = pl.at; const h = home();
  if (!bhCanPlace(pl, x, y, pl.r)) { bhSfx("err"); bhToolHint(pl.type === "furni" ? "家具只能放在小屋里空着的地方（门口要留出来）" : "装饰要放在空草地上，不能压住路、田、围栏和池塘"); return; }
  (pl.type === "furni" ? h.furniture : h.decor).push({ id: pl.id || uid("hi"), kind: pl.kind, x, y, r: pl.r || 0 });
  BH.placing = null; BH.ver++; BH.sig = ""; bhSfx("place");
  const def = pl.type === "furni" ? FURNI[pl.kind] : DECOR[pl.kind]; const [w, d] = fpOf(def, pl.r || 0);
  bhBurst(x * 8 + w * 4, y * 8 + d * 4, 7, 10, [0xFFFFFF, 0xC7DEC4, VPAL.YEL], 8, 6); bhFloatW(x * 8 + w * 4, y * 8 + d * 4, 14, "放好了", "good");
  $(".bh-hint")?.classList.remove("on"); save(); bhRefreshHud(); bhRenderSide(); bhCursor();
}
// ---------- 物件互动（互动工具点一下） ----------
function bhUseItem(type, id, pid) {
  const h = home(); const list = type === "furni" ? h.furniture : h.decor; const it = list.find(x => x.id === id); if (!it) return;
  const def = (type === "furni" ? FURNI : DECOR)[it.kind]; const c = bhItemPt(it, def, def.fp[0] * 4, def.fp[1] * 4); const z = type === "furni" ? 8 : 7;
  const k = it.kind;
  if (k === "lamp" || k === "lightstand" || k === "lamp2") { it.off = !it.off; BH.sig = ""; BH.ver++; bhSfx("click"); bhFloatW(c.x, c.y, z + 12, it.off ? "关灯" : "开灯"); save(); return; }
  if (k === "bench") { if (!bhGoBench(it)) bhSfx("err"); return; }
  if (k === "bed") { const b = BH.bit; if (bhGoBed(it)) { b.after.wait = 8000; bhBitSay("睡个午觉……", 1600); } return; }
  if (k === "desk") { const pt = bhItemPt(it, def, 8, 12); const f = FRONT[it.r || 0]; if (!bhGo(Math.floor(pt.x / 8), Math.floor(pt.y / 8), { st: "work", wait: 9000, face: faceOf(-f[0], -f[1]) })) bhSfx("err"); return; }
  if (k === "tv") { const pt = bhItemPt(it, def, 8, 16); const f = FRONT[it.r || 0]; if (!bhGo(Math.floor(pt.x / 8), Math.floor(pt.y / 8), { st: "tv", wait: 8000, face: faceOf(-f[0], -f[1]) })) bhSfx("err"); bhSfx("click"); return; }
  if (k === "camera") { bhBurst(c.x, c.y, z + 9, 14, [0xFFFFFF, 0xFFF6D8], 12, 4); bhSfx("bite"); bhBitSay("咔嚓！笑一个", 1500); return; }
  if (k === "fountain") { bhBurst(c.x, c.y, z + 6, 16, [0xBFD8FF, 0xFFFFFF, 0x9FC4FF], 6, 16); bhSfx("splash"); return; }
  if (k === "tree" || k === "pinktree" || k === "bush" || k === "plant") { const cols = k === "pinktree" ? [0xFFC2DA, 0xFFD6E6] : [0x86C893, 0x9DD7A8, 0x74B982]; for (let i = 0; i < 10; i++) bhPart({ x: c.x + (Math.random() - .5) * 8, y: c.y + (Math.random() - .5) * 8, z: z + 8 + Math.random() * 6, vx: (Math.random() - .5) * 4, vy: (Math.random() - .5) * 4, vz: -3, g: 2, life: 2, c: pick(cols), floor: 6 }); bhSfx("splash"); return; }
  if (k === "flowers") { BH.flies.push({ x: c.x, y: c.y, z: 9, a: Math.random() * 6, fire: false, ph: 0 }); bhPart({ x: c.x, y: c.y, z: z + 5, vz: 4, life: 1, pat: "heart", keep: true }); bhSfx("pet"); return; }
  bhBurst(c.x, c.y, z + 8, 8, [VPAL.YEL, 0xFFFFFF], 5, 6); bhSfx("pop");
}
function bhClick(pid, ev, ptr) {
  const h = home(); const tool = BH.tool; const o = bhObj(pid);
  if (BH.placing) { bhPlaceAt(); return; }
  if (BH.fishing && bhFishCatch()) return;
  bhPopClose();
  if (tool === "build") { if (o && (o.type === "furni" || o.type === "decor")) bhPickUp(o.type, o.id); else bhToolHint("「布置」工具：点家具或装饰把它拿起来，再点一下放下"); return; }
  if (!o) return;
  if (o.type === "plot") { bhPlotAct(o.i, tool, true); return; }
  if (o.type === "animal" || o.type === "prod") { const a = h.animals.find(x => x.id === o.id); if (!a) return; if (animalReady(a)) bhCollect(a); else if (o.type === "animal") bhPetAnimal(a); return; }
  if (o.type === "bit") { bhBitPat(); return; }
  if (tool !== "hand") return;
  if (o.type === "fish" || o.type === "pond") { const g = bhGroundAt(ptr.bx, ptr.by, 3); bhFeedFish(g.x, g.y); return; }
  if (o.type === "dock") { bhFishGo(); return; }
  if (o.type === "mailbox") { if (bhMailUnread()) { bhSfx("mail"); bhPopOpen(pid, bhPopMail()); } else { bhPopOpen(pid, `<b class="px">信箱</b><p>今天的信已经读过了，明天再来看看。</p>`); } return; }
  if (o.type === "trough") { BH.troughUntil = performance.now() + 9000; home().animals.forEach(a => { const m = bhMob(a); m.wait = 0; m.tx = 111 + Math.random() * 9; m.ty = 46 + Math.random() * 9; }); bhBurst(116, 51, 9, 10, [VPAL.hay[0], VPAL.hay[1]], 4, 8); bhSfx("place"); bhToolHint(h.animals.length ? "添好草料了，大家都过来吃" : "围栏里还没有动物，去商店买一只吧"); return; }
  if (o.type === "furni" || o.type === "decor") { bhUseItem(o.type, o.id, pid); return; }
  if (o.type === "fence") { bhPopOpen(pid, `<b class="px">围栏</b><p>住着 ${h.animals.length}/${h.size.pen} 只动物。产物出现在它们脚边时点一下收集，点动物可以摸摸它。</p><div class="bp-acts"><button class="btn line sm" data-act="bh-shop" data-shop="animal">买家禽</button><button class="btn quiet sm" data-act="bh-shop" data-shop="facility">扩建</button></div>`); return; }
  if (o.type === "windmill") { bhPopOpen(pid, `<b class="px">风车</b><p>所有作物再长快 20%，家园评分 +10。</p>`); return; }
  if (o.type === "millspot" || o.type === "sprspot") { const k = o.type === "millspot" ? "windmill" : "sprinkler"; const f = FACILITIES[k]; bhPopOpen(pid, `<b class="px">${f.name}用地</b><p>${f.desc}。Lv.${f.lv} 解锁，${f.price} ₿。</p><div class="bp-acts"><button class="btn line sm" data-act="bh-shop" data-shop="facility">去设施看看</button></div>`); return; }
  if (o.type === "sprinkler") { bhPopOpen(pid, `<b class="px">洒水器</b><p>农田一直保持湿润，长得快 50%。</p>`); return; }
  if (o.type === "scarecrow") { bhBurst(108, 20, 16, 6, [0xEAD9A0, VPAL.YEL], 5, 6); bhSfx("pop"); bhBitSay("稻草人今天也很尽职", 1600); return; }
  if (o.type === "sign") { bhPopOpen(pid, `<b class="px">Bit 家园</b><p>家园评分 ${bhRating()}　·　来过 ${h.visits} 次<br>${h.animals.length} 只动物　·　${h.fish.length} 条鱼　·　${h.furniture.length + h.decor.length} 件家具和装饰</p>`); return; }
  if (o.type === "tile" || o.type === "house") {
    const g = o.type === "tile" ? { tx: o.tx, ty: o.ty } : bhGroundAt(ptr.bx, ptr.by, 6);
    if (BH.bit?.st === "sleep") { bhBitSay(pick(["Zzz……", "（睡得正香）"]), 1400); return; }
    if (g.tx >= 0 && g.ty >= 0 && g.tx < HTW && g.ty < HTH && BH.grid[g.tx + g.ty * HTW]) { if (BH.fishing) BH.fishing = null; if (bhGo(g.tx, g.ty, { st: "idle", wait: 3500 })) { BH.marker = { x: g.tx * 8 + 4, y: g.ty * 8 + 4, z: tileZ(g.tx, g.ty) - 1 + 1, until: BH.t + 900 }; bhSfx("click"); } }
  }
}
function bhFeedFish(x, y) {
  const h = home(); if (!h.fish.length) { bhToolHint("池塘里还没有鱼，去商店买点鱼苗"); }
  const d = Math.hypot(x - POND_C.x, y - POND_C.y); if (d > 12) { x = POND_C.x + (x - POND_C.x) * 12 / d; y = POND_C.y + (y - POND_C.y) * 12 / d; }
  BH.feed = { x, y, until: performance.now() + 4500 };
  for (let i = 0; i < 7; i++) bhPart({ x: x + (Math.random() - .5) * 4, y: y + (Math.random() - .5) * 4, z: 9 + Math.random() * 3, vz: -2, g: 22, life: .7, c: pick([0xB8925F, 0xD9C08E]), floor: 3 });
  setTimeout(() => { if (BH.open) bhBurst(x, y, 3, 5, [0xFFFFFF, 0xBFD8FF], 3, 5); }, 350);
  bhSfx("splash"); const day = state.pet.daily; day.fishFeed = (day.fishFeed || 0) + 1; if (day.fishFeed <= 10) state.pet.stats.mood = clamp(state.pet.stats.mood + 1, 0, 100);
}

// ---------- 指针、滚轮、键盘 ----------
function bhCursor() {
  const cv = BH.cv; if (!cv) return; const C = bhCursors();
  if (BH.press?.pan) { cv.style.cursor = "var(--cur-grabbing, grabbing)"; return; }
  if (BH.placing) { cv.style.cursor = "var(--cur-move, move)"; return; }
  if (BH.tool !== "hand") { cv.style.cursor = C[BH.tool] || "crosshair"; return; }
  const o = bhObj(BH.hover); const can = o && o.type !== "tile" && o.type !== "house" && bhHoverRing().pid;
  cv.style.cursor = can ? "var(--cur-pointer, pointer)" : (o?.type === "tile" && BH.grid?.[o.tx + o.ty * HTW]) ? "var(--cur-default, default)" : "var(--cur-default, default)";
}
function bhPointerMove(ev) {
  if (!BH.open) return; const p = bhPtr(ev); BH.pointer = p;
  const pid = BH.E.pick(Math.floor(p.bx), Math.floor(p.by));
  if (pid !== BH.hover) { BH.hover = pid; bhCursor(); }
  const gz = BH.placing?.type === "furni" ? 6 : GZ; const g = bhGroundAt(p.bx, p.by, gz); BH.hoverAt = { x: g.x, y: g.y };
  if (BH.placing) { const def = BH.placing.type === "furni" ? FURNI[BH.placing.kind] : DECOR[BH.placing.kind]; const [w, d] = fpOf(def, BH.placing.r || 0); BH.placing.at = { x: Math.round(g.x / 8 - w / 2), y: Math.round(g.y / 8 - d / 2) }; BH.placeHover = BH.placing.at; }
  const pr = BH.press;
  if (pr) {
    const dx = ev.clientX - pr.x, dy = ev.clientY - pr.y;
    if (pr.pan || (!BH.sweep && !BH.placing && Math.hypot(dx, dy) > 5)) { if (!pr.pan) { pr.pan = true; bhPopClose(); bhCursor(); } BH.pan.x += ev.clientX - pr.lx; BH.pan.y += ev.clientY - pr.ly; bhFit(true); }
    pr.lx = ev.clientX; pr.ly = ev.clientY;
    if (BH.sweep) { const o = bhObj(pid); if (o?.type === "plot" && !BH.sweep.done.has(o.i)) { BH.sweep.done.add(o.i); if (bhPlotAct(o.i, BH.sweep.tool, false)) BH.sweep.n++; } }
  }
  bhTipUpdate(ev);
}
function bhPointerDown(ev) {
  if (!BH.open) return; BH.cv.setPointerCapture?.(ev.pointerId); const p = bhPtr(ev); const pid = BH.E.pick(Math.floor(p.bx), Math.floor(p.by)); BH.hover = pid;
  if (BH.audio?.state === "suspended") BH.audio.resume();
  if (ev.button === 1 || (ev.button === 0 && BH.spaceDown)) { BH.press = { x: ev.clientX, y: ev.clientY, lx: ev.clientX, ly: ev.clientY, pan: true }; bhCursor(); return; }
  if (ev.button !== 0) return;
  BH.press = { x: ev.clientX, y: ev.clientY, lx: ev.clientX, ly: ev.clientY, pid, pan: false };
  const o = bhObj(pid);
  if (["seed", "water", "harvest"].includes(BH.tool) && !BH.placing && !(BH.fishing?.phase === "bite")) {
    BH.sweep = { tool: BH.tool, done: new Set(), n: 0, harv: 0 }; bhPopClose();
    if (o?.type === "plot") { BH.sweep.done.add(o.i); if (bhPlotAct(o.i, BH.tool, false)) BH.sweep.n++; else BH.sweep.firstMiss = o.i; }
  }
}
function bhPointerUp(ev) {
  if (!BH.open) return; const pr = BH.press; BH.press = null; const sw = BH.sweep; BH.sweep = null;
  if (sw) {
    if (sw.harv >= 4) { const bonus = Math.min(6, sw.harv - 3); petEarn({ coins: bonus, why: `连收 ${sw.harv} 块地` }); bhToolHint(`连收 ${sw.harv} 块！奖励 ${bonus} ₿`, 2400); bhSfx("coin"); }
    if (!sw.n && sw.firstMiss != null && !pr?.pan) bhPlotAct(sw.firstMiss, sw.tool, true);
    else if (!sw.n && pr && !pr.pan) { const o = bhObj(pr.pid); if (o && o.type !== "plot" && o.type !== "tile" && o.type !== "house") bhClick(pr.pid, ev, bhPtr(ev)); }
    bhCursor(); return;
  }
  if (!pr || pr.pan) { bhCursor(); return; }
  bhClick(pr.pid, ev, bhPtr(ev));
}
function bhContext(ev) {
  ev.preventDefault(); if (BH.placing) { bhEndPlace(true); return; }
  const p = bhPtr(ev); const pid = BH.E.pick(Math.floor(p.bx), Math.floor(p.by)); const o = bhObj(pid); const h = home();
  if (o?.type === "furni" || o?.type === "decor") { bhPopOpen(pid, bhPopItem(o.type, (o.type === "furni" ? h.furniture : h.decor).find(x => x.id === o.id))); return; }
  if (o?.type === "animal") { const a = h.animals.find(x => x.id === o.id); if (a) bhPopOpen(pid, bhPopAnimal(a)); return; }
  if (o?.type === "fish") { const f = h.fish.find(x => x.id === o.id); if (f) bhPopOpen(pid, bhPopFish(f)); return; }
  if (o?.type === "bit") { bhPopOpen(pid, bhPopBit()); return; }
  if (o?.type === "plot" && h.plots[o.i]) { bhPopOpen(pid, bhPopPlot(h.plots[o.i])); return; }
  bhPopClose();
}
function bhWheel(ev) {
  ev.preventDefault(); const r = BH.cv.getBoundingClientRect();
  if (ev.ctrlKey || ev.metaKey) { BH.wheelAcc = (BH.wheelAcc || 0) + ev.deltaY; if (Math.abs(BH.wheelAcc) > 40) { bhZoom(BH.wheelAcc < 0 ? 1 : -1, ev.clientX - r.left, ev.clientY - r.top); BH.wheelAcc = 0; } return; }
  BH.pan.x -= ev.deltaX; BH.pan.y -= ev.deltaY; bhFit(true); bhPopClose();
}
function bhKey(ev) {
  if (!BH.open || ev.metaKey || ev.ctrlKey || ev.altKey || typing(ev.target)) return;
  const k = ev.key.toLowerCase();
  if (k === " ") { ev.preventDefault(); if (BH.fishing) { bhFishCatch(); return; } BH.spaceDown = true; return; }
  if (/^[1-5]$/.test(k)) { bhSetTool(TOOLS[+k - 1][0]); return; }
  if (k === "q") return bhRotate(-1);
  if (k === "e") return bhRotate(1);
  if (k === "r" && BH.placing) { BH.placing.r = ((BH.placing.r || 0) + 1) % 4; bhSfx("rotate"); return; }
  if (k === "=" || k === "+") return bhZoom(1);
  if (k === "-" || k === "_") return bhZoom(-1);
  if (k === "0") { BH.pan = { x: 0, y: 0 }; BH.zoom = 0; bhFit(); return; }
  if (k === "b") return bhToggleDrawer();
  if ((k === "delete" || k === "backspace") && BH.placing) { const pl = BH.placing; BH.placing = null; const key = `${pl.type === "furni" ? "u" : "d"}_${pl.kind}`; home().inv[key] = (home().inv[key] || 0) + 1; BH.ver++; BH.sig = ""; save(); bhRenderSide(); $(".bh-hint")?.classList.remove("on"); toast("收进仓库了", 1600); return; }
  const ar = { arrowleft: [40, 0], arrowright: [-40, 0], arrowup: [0, 40], arrowdown: [0, -40] }[k]; if (ar) { ev.preventDefault(); BH.pan.x += ar[0]; BH.pan.y += ar[1]; bhFit(true); }
}
function bhKeyUp(ev) { if (ev.key === " ") BH.spaceDown = false; }
function bhSetTool(t) {
  if (!TOOLS.some(([k]) => k === t)) return; if (BH.placing && t !== "build") bhEndPlace(true);
  BH.tool = t; $$(".bh-tool").forEach(b => b.classList.toggle("on", b.dataset.tool === t)); bhToolHint(TOOL_TIPS[t]); bhCursor(); bhRenderQuick(); bhSfx("click"); bhPopClose();
}
function bhToggleDrawer() { BH.drawer = !BH.drawer; $(".bh")?.classList.toggle("fold", !BH.drawer); BH.pan = { x: 0, y: 0 }; BH.zoom = 0; bhFit(); }
// 拖动食物喂 Bit
function bhDragStart(ev) {
  const slot = ev.target.closest(".bh-slot.food"); if (!slot || ev.button !== 0) return; ev.preventDefault();
  BH.drag = { k: slot.dataset.food, x: ev.clientX, y: ev.clientY, moved: false, el: null, html: slot.querySelector(".bh-ico")?.outerHTML || "" };
  window.addEventListener("pointermove", bhDragMove); window.addEventListener("pointerup", bhDragEnd, { once: true });
}
function bhDragMove(ev) {
  const d = BH.drag; if (!d) return;
  if (!d.moved && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 4) { d.moved = true; d.el = document.createElement("div"); d.el.className = "bh-drag"; d.el.innerHTML = d.html; $(".bh").appendChild(d.el); }
  if (d.el) d.el.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px) translate(-50%, -60%)`;
  const r = BH.cv.getBoundingClientRect(); const v = BH.view; const bx = ((ev.clientX - r.left) * v.dpr - v.offX) / v.s, by = ((ev.clientY - r.top) * v.dpr - v.offY) / v.s;
  BH.dragOverBit = BH.E.pick(Math.floor(bx), Math.floor(by)) === PID.bit;
}
function bhDragEnd() {
  const d = BH.drag; BH.drag = null; window.removeEventListener("pointermove", bhDragMove); d?.el?.remove(); const over = BH.dragOverBit; BH.dragOverBit = false; if (!d) return;
  if (!d.moved || over) { if (!d.moved && BH.bit) { const b = BH.bit; if (b.st === "sleep") { bhBitSay("睡着呢，明天再喂吧", 1600); return; } } bhFeed(d.k); }
}

// ---------- 打开 / 关闭 ----------
function openBitHome() {
  if (BH.open) return;
  petStatsUpdate(); petDailyReset(); bhEnsurePlots(); bhMigrate(); bhGrow();
  BH.open = true; BH.mobs.clear(); BH.fishes.clear(); BH.parts = []; BH.flies = []; BH.rain = []; BH.placing = null; BH.pan = { x: 0, y: 0 }; BH.zoom = 0; BH.fishing = null; BH.weather = bhWeather();
  if (!BH.E) { BH.E = new VXEngine(VBW, VBH); BH.off = document.createElement("canvas"); BH.off.width = VBW; BH.off.height = VBH; BH.octx = BH.off.getContext("2d"); }
  bhBitInit(); if (dayPhase() === "night" && bhFurniOf("bed")) { const bed = bhFurniOf("bed"); const pt = bhItemPt(bed, FURNI.bed, 4, 6); Object.assign(BH.bit, { x: pt.x, y: pt.y, z: 10, st: "sleep", wait: 15000 }); }
  document.body.classList.add("bh-open"); petApplyHidden(); petChatClose();
  const el = document.createElement("div"); el.className = `bh ${BH.drawer ? "" : "fold"}`; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Bit 家园");
  el.innerHTML = `<div class="bh-stage"><canvas class="bh-cv" aria-label="Bit 家园：2.5D 小岛。用下方工具种地、浇水、收获，点动物和 Bit 互动"></canvas><div class="bh-fx"><div class="bh-tip-f px"></div></div></div>
    <header class="bh-hud">${bhHudHTML()}</header>
    <div class="bh-hint px" role="status"></div>
    <aside class="bh-drawer"><nav class="bh-tabs" role="tablist">${[["shop", "商店"], ["bag", "仓库"], ["tasks", "委托"], ["grow", "成长"]].map(([k, l]) => `<button role="tab" data-act="bh-tab" data-tab="${k}" class="${BH.tab === k ? "on" : ""}">${l}</button>`).join("")}<button class="bh-fold" data-act="bh-drawer" title="收起（B）" aria-label="收起抽屉">»</button></nav><div class="bh-panel"></div></aside>
    <button class="bh-unfold px" data-act="bh-drawer" title="展开（B）">«　商店</button>
    <footer class="bh-dock">${bhDockHTML()}</footer>`;
  document.body.appendChild(el);
  BH.cv = $(".bh-cv", el); BH.ctx = BH.cv.getContext("2d");
  BH.cv.addEventListener("pointermove", bhPointerMove); BH.cv.addEventListener("pointerdown", bhPointerDown); BH.cv.addEventListener("pointerup", bhPointerUp); BH.cv.addEventListener("pointercancel", () => { BH.press = null; BH.sweep = null; });
  BH.cv.addEventListener("pointerleave", () => { BH.hover = 0; BH.hoverAt = null; $(".bh-tip-f")?.classList.remove("on"); BH.tipHTML = ""; });
  BH.cv.addEventListener("contextmenu", bhContext); BH.cv.addEventListener("wheel", bhWheel, { passive: false });
  $(".bh-dock", el).addEventListener("pointerdown", bhDragStart);
  el.addEventListener("pointerdown", ev => { if (!ev.target.closest(".bh-pop") && ev.target !== BH.cv) bhPopClose(); ev.stopPropagation(); });
  document.addEventListener("keydown", bhKey); document.addEventListener("keyup", bhKeyUp);
  window.addEventListener("resize", bhResize);
  bhBuildStatic(); BH.sig = bhSignature(); bhFit(); bhRenderSide();
  EXT_ESC.push(bhEscape);
  requestAnimationFrame(() => el.classList.add("in"));
  BH.lastT = 0; BH.lastDraw = 0; BH.raf = requestAnimationFrame(bhFrame);
  BH.hudT = setInterval(() => { petStatsUpdate(); bhRefreshHud(); }, 20000);
  state.pet.home.visits += 1; save();
  setTimeout(() => { if (!BH.open) return; bhBitSay(dayPhase() === "night" ? "Zzz……" : bhMailUnread() ? "信箱里有一封新信！" : pick(["欢迎回家！", "今天也来种点什么吧", "我把院子扫干净啦"]), 2600); bhToolHint("1–5 切换工具 · Q / E 旋转视角 · ⌘ + 滚轮缩放 · 拖动空白处平移", 4200); }, 500);
}
function bhResize() { bhFit(true); }
function bhEscape() { if (BH.placing) { bhEndPlace(true); return; } if (BH.pop) { bhPopClose(); return; } closeBitHome(); }
function closeBitHome() {
  if (!BH.open) return;
  if (BH.placing) bhEndPlace(true);
  BH.open = false; cancelAnimationFrame(BH.raf); clearInterval(BH.hudT); window.removeEventListener("resize", bhResize);
  document.removeEventListener("keydown", bhKey); document.removeEventListener("keyup", bhKeyUp);
  const i = EXT_ESC.indexOf(bhEscape); if (i >= 0) EXT_ESC.splice(i, 1);
  const el = $(".bh"); document.body.classList.remove("bh-open"); petApplyHidden();
  if (BH.bit?.sayEl) BH.bit.sayEl = null;
  if (el) { if (reduceMotion()) el.remove(); else { el.classList.remove("in"); el.classList.add("out"); setTimeout(() => el.remove(), 200); } }
  save();
}
function bhSpend(price) { if (state.pet.coins < price) { toast(`bitcoin 不够，还差 ${price - state.pet.coins} ₿。多创作、多交付就能攒到`, 3200, "err"); bhSfx("err"); return false; } state.pet.coins -= price; return true; }
function bhBuy(type, kind, n = 1) {
  const h = home(); const L = petLevel();
  const def = { seed: CROPS[kind], animal: ANIMALS[kind], fish: FISH[kind], facility: FACILITIES[kind], furni: FURNI[kind], decor: DECOR[kind] }[type]; if (!def) return;
  if (L < (def.lv || 1)) return toast(`Lv.${def.lv} 才能买`, 2400, "err");
  const price = (type === "seed" ? def.seed : def.price) * n;
  if (type === "animal" && h.animals.length >= h.size.pen) return toast("围栏住满了，先在设施里扩建围栏", 3000, "err");
  if (type === "fish" && h.fish.length >= h.size.pond) return toast("池塘满了，先扩建池塘，或者把长大的鱼捞起来", 3000, "err");
  if (type === "facility" && ((["farm2", "sprinkler", "windmill"].includes(kind) && h.owned[kind]) || (kind === "pen" && h.size.pen >= 6) || (kind === "pond" && h.size.pond >= 6))) return;
  if (!bhSpend(price)) return;
  bhSfx("coin");
  if (type === "seed") { h.inv[`s_${kind}`] = (h.inv[`s_${kind}`] || 0) + n; BH.seed = kind; bhToolHint(`买了 ${n} 包${def.name}种子，已选中。按 2 用「播种」拖过空地`, 3000); }
  if (type === "animal") { const k = h.animals.filter(a => a.kind === kind).length + 1; h.animals.push({ id: uid("an"), kind, name: `${def.name}${k > 1 ? ` ${k}` : ""}`, last: Date.now() }); bhToolHint(`${def.name}住进了围栏`); }
  if (type === "fish") { h.fish.push({ id: uid("fi"), kind, at: now() }); bhToolHint(`${def.name}游进了池塘`); bhBurst(POND_C.x, POND_C.y, 3, 8, [0xFFFFFF, 0xBFD8FF], 5, 8); }
  if (type === "facility") { if (kind === "pen") h.size.pen += 1; else if (kind === "pond") h.size.pond += 1; else h.owned[kind] = true; if (kind === "farm2") bhEnsurePlots(); BH.sig = ""; bhToolHint(`${def.name}完成`); }
  save(); bhRenderSide();
  if (type === "furni" || type === "decor") { if (BH.tool !== "build") { BH.tool = "build"; $$(".bh-tool").forEach(b => b.classList.toggle("on", b.dataset.tool === "build")); } bhStartPlace(type, kind); }
}
Object.assign(EXT_ACTS, {
  "bh-close": () => closeBitHome(),
  "bh-tab": el => { BH.tab = el.dataset.tab; bhRenderSide(); bhSfx("click"); },
  "bh-shop": el => { BH.tab = "shop"; BH.shop = el.dataset.shop; if (!BH.drawer) bhToggleDrawer(); bhPopClose(); bhRenderSide(); },
  "bh-buy": el => bhBuy(el.dataset.type, el.dataset.kind, Number(el.dataset.n) || 1),
  "bh-tool": el => bhSetTool(el.dataset.tool),
  "bh-seed": el => { BH.seed = el.dataset.k; bhSetTool("seed"); },
  "bh-rot": el => bhRotate(Number(el.dataset.dir) || 1),
  "bh-zoom": el => bhZoom(Number(el.dataset.dir) || 1),
  "bh-sound": () => { const h = home(); h.sound = h.sound === false; save(); bhRefreshHud(); bhSfx("click"); },
  "bh-drawer": () => bhToggleDrawer(),
  "bh-bitcard": () => { bhPopOpen(PID.bit, bhPopBit()); },
  "bh-plant": el => { const pl = home().plots[+el.dataset.i]; bhPopClose(); BH.seed = el.dataset.crop; bhPlant(pl, el.dataset.crop); },
  "bh-water": el => { bhWater(home().plots[+el.dataset.i]); bhPopClose(); },
  "bh-dig": el => { const pl = home().plots[+el.dataset.i]; if (!pl) return; Object.assign(pl, { crop: "", prog: 0, wet: 0 }); BH.sig = ""; bhPopClose(); bhSfx("place"); save(); },
  "bh-rename-animal": el => { const a = home().animals.find(x => x.id === el.dataset.id); const pop = $(".bh-pop"); if (!a || !pop) return; pop.innerHTML = `<b class="px">给它起个名字</b><input class="input" data-bh-name maxlength="8" value="${attr(a.name || "")}"><div class="bp-acts"><button class="btn primary sm" data-act="bh-rename-save" data-id="${attr(a.id)}">好了</button></div>`; const i = $("[data-bh-name]", pop); i.focus(); i.select(); i.addEventListener("keydown", ev => { ev.stopPropagation(); if (ev.key === "Enter") EXT_ACTS["bh-rename-save"]({ dataset: { id: a.id } }); if (ev.key === "Escape") bhPopClose(); }); },
  "bh-rename-save": el => { const a = home().animals.find(x => x.id === el.dataset.id); const v = $("[data-bh-name]")?.value.trim(); if (a && v) { a.name = v.slice(0, 8); save(); } bhPopClose(); },
  "bh-catch": el => { const h = home(); const fi = h.fish.find(x => x.id === el.dataset.id); if (!fi || !fishGrown(fi)) return; h.fish = h.fish.filter(x => x !== fi); BH.fishes.delete(fi.id); h.inv[`f_${fi.kind}`] = (h.inv[`f_${fi.kind}`] || 0) + 1; bhPopClose(); toast(`捞起了${FISH[fi.kind].name}，在仓库里`, 2000); bhSfx("catch"); petEvent("harvest"); save(); bhRenderSide(); },
  "bh-feed": el => { bhPopClose(); bhFeed(el.dataset.k); },
  "bh-pat": () => { bhPopClose(); bhBitPat(); },
  "bh-call": () => { bhPopClose(); const b = BH.bit; if (!b) return; if (b.st === "sleep") { bhBitPat(); return; } BH.fishing = null; if (bhGo(8, 6, { st: "happy", wait: 3000 })) bhBitSay("来啦！", 1400); },
  "bh-fish": () => { bhPopClose(); bhFishGo(); },
  "bh-sell": el => {
    const h = home(); const k = el.dataset.k; const n = el.dataset.all ? h.inv[k] || 0 : 1; if (!(h.inv[k] >= n) || !n) return;
    const price = CROPS[k]?.sell || GOODS[k]?.sell || FISH[k.replace(/^f_/, "")]?.sell || 0;
    h.inv[k] -= n; state.pet.coins += price * n; state.pet.history.push({ t: now(), xp: 0, coins: price * n, why: "家园出售" });
    bhSfx("coin"); bhHudFloat(`+${price * n} ₿`, "coin"); save(); bhRenderSide();
  },
  "bh-sellall": () => {
    const h = home(); let sum = 0; const keys = [...Object.keys(CROPS), ...Object.keys(GOODS), ...Object.keys(FISH).map(k => `f_${k}`)];
    keys.forEach(k => { const n = h.inv[k] || 0; if (!n) return; const price = CROPS[k]?.sell || GOODS[k]?.sell || FISH[k.replace(/^f_/, "")]?.sell || 0; sum += price * n; h.inv[k] = 0; });
    if (!sum) return; state.pet.coins += sum; state.pet.history.push({ t: now(), xp: 0, coins: sum, why: "家园出售" }); bhSfx("coin"); bhHudFloat(`+${sum} ₿`, "coin"); save(); bhRenderSide();
  },
  "bh-place-inv": el => { const h = home(); const k = `${el.dataset.type === "furni" ? "u" : "d"}_${el.dataset.kind}`; if (!(h.inv[k] > 0)) return; h.inv[k] -= 1; save(); bhRenderSide(); if (BH.tool !== "build") { BH.tool = "build"; $$(".bh-tool").forEach(b => b.classList.toggle("on", b.dataset.tool === "build")); } bhStartPlace(el.dataset.type, el.dataset.kind); },
  "bh-move": el => { bhPopClose(); if (BH.tool !== "build") { BH.tool = "build"; $$(".bh-tool").forEach(b => b.classList.toggle("on", b.dataset.tool === "build")); } bhPickUp(el.dataset.type, el.dataset.id); },
  "bh-rotate-item": el => { const h = home(); const list = el.dataset.type === "furni" ? h.furniture : h.decor; const it = list.find(x => x.id === el.dataset.id); if (!it) return; const nr = ((it.r || 0) + 1) % 4; const keep = it.r; list.splice(list.indexOf(it), 1); const ok = bhCanPlace({ type: el.dataset.type, kind: it.kind }, it.x, it.y, nr); it.r = ok ? nr : keep; list.push(it); if (!ok) { bhSfx("err"); bhToolHint("转不过来，旁边没有空位"); } else bhSfx("rotate"); BH.ver++; BH.sig = ""; save(); bhPopClose(); },
  "bh-store": el => { const h = home(); const list = el.dataset.type === "furni" ? "furniture" : "decor"; const it = h[list].find(x => x.id === el.dataset.id); if (!it) return; h[list] = h[list].filter(x => x !== it); const k = `${el.dataset.type === "furni" ? "u" : "d"}_${it.kind}`; h.inv[k] = (h.inv[k] || 0) + 1; BH.ver++; BH.sig = ""; bhPopClose(); bhSfx("pop"); save(); bhRenderSide(); },
  "bh-claim": el => { const d = state.pet.daily; const t = TASKS.find(x => x.k === el.dataset.k); if (!t || d.claimed[t.k] || (d.tasks[t.k] || 0) < t.need) return; d.claimed[t.k] = true; bhSfx("coin"); petEarn({ coins: t.coins, xp: t.xp, why: `委托：${t.name}` }); bhRenderSide(); },
  "bh-mail-take": () => { const h = home(); if (!bhMailUnread()) return; const m = bhMailToday(); h.mail = { date: dayKey() }; h.inv[`s_${m.seed}`] = (h.inv[`s_${m.seed}`] || 0) + m.n; BH.sig = ""; bhPopClose(); bhSfx("coin"); petEarn({ coins: m.coins, why: `信箱：${m.from}` }); bhRenderSide(); bhBitSay("是好消息吗？", 1600); }
});
