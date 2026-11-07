"use strict";
// 帧比特 3.5 · 桌宠 Bit
// 白色方块脑袋、两只竖条眼睛、头顶飘着一枚黄色光标方块。可以拖到屏幕任何位置；
// 创作者在打字、拖画布时它跟着「敲键盘」，AI 在生成时它转着光标「想事情」，一阵子没人动它就睡着。
// 点它呼出像素轮盘：对话 / 抚摸（五种）/ Bit 家园。

const PET = {
  el: null, mode: "idle", lastInput: Date.now(), lastWork: 0, wheel: "", anim: "", drag: null,
  chat: false, chatSig: "", chatBusy: false, look: { x: 0, y: 0, raf: 0 }, timers: {}, sayT: 0, fxT: 0, hungryAt: 0
};
const PET_SLEEP_MS = 75_000, PET_WORK_MS = 2600;
const PET_W = 92, PET_H = 104;

// 像素图标（8×8），补到画布的图标表里
Object.assign(ICONS, {
  chat: '<rect x="1" y="0" width="6" height="1"/><rect x="0" y="1" width="1" height="4"/><rect x="7" y="1" width="1" height="4"/><rect x="1" y="5" width="6" height="1"/><rect x="2" y="6" width="1" height="1"/><rect x="1" y="7" width="1" height="1"/><rect x="2" y="2" width="1" height="2"/><rect x="5" y="2" width="1" height="2"/>',
  heart: '<rect x="1" y="1" width="2" height="1"/><rect x="5" y="1" width="2" height="1"/><rect x="0" y="2" width="8" height="2"/><rect x="1" y="4" width="6" height="1"/><rect x="2" y="5" width="4" height="1"/><rect x="3" y="6" width="2" height="1"/>',
  house: '<rect x="3" y="0" width="2" height="1"/><rect x="2" y="1" width="4" height="1"/><rect x="1" y="2" width="6" height="1"/><rect x="0" y="3" width="8" height="1"/><rect x="1" y="4" width="1" height="4"/><rect x="6" y="4" width="1" height="4"/><rect x="1" y="7" width="6" height="1"/><rect x="3" y="5" width="2" height="2"/>',
  pat: '<rect x="1" y="1" width="1" height="3"/><rect x="3" y="0" width="1" height="4"/><rect x="5" y="1" width="1" height="3"/><rect x="7" y="3" width="1" height="2"/><rect x="1" y="4" width="6" height="2"/><rect x="2" y="6" width="4" height="1"/>',
  tickle: '<rect x="6" y="0" width="2" height="1"/><rect x="5" y="1" width="3" height="1"/><rect x="4" y="2" width="3" height="1"/><rect x="3" y="3" width="3" height="1"/><rect x="2" y="4" width="3" height="1"/><rect x="1" y="5" width="2" height="1"/><rect x="0" y="6" width="2" height="1"/><rect x="0" y="7" width="1" height="1"/>',
  lift: '<rect x="3" y="0" width="2" height="1"/><rect x="2" y="1" width="4" height="1"/><rect x="1" y="2" width="6" height="1"/><rect x="3" y="3" width="2" height="3"/><rect x="1" y="7" width="6" height="1"/>',
  pinch: '<rect x="0" y="2" width="1" height="4"/><rect x="1" y="1" width="1" height="1"/><rect x="1" y="6" width="1" height="1"/><rect x="7" y="2" width="1" height="4"/><rect x="6" y="1" width="1" height="1"/><rect x="6" y="6" width="1" height="1"/><rect x="3" y="3" width="2" height="2"/>',
  boop: '<rect x="3" y="0" width="2" height="8"/><rect x="0" y="3" width="8" height="2"/><rect x="1" y="1" width="1" height="1"/><rect x="6" y="1" width="1" height="1"/><rect x="1" y="6" width="1" height="1"/><rect x="6" y="6" width="1" height="1"/>',
  coin: '<rect x="2" y="0" width="4" height="1"/><rect x="1" y="1" width="1" height="1"/><rect x="6" y="1" width="1" height="1"/><rect x="0" y="2" width="1" height="4"/><rect x="7" y="2" width="1" height="4"/><rect x="1" y="6" width="1" height="1"/><rect x="6" y="6" width="1" height="1"/><rect x="2" y="7" width="4" height="1"/><rect x="3" y="2" width="2" height="4"/>',
  team: '<rect x="1" y="0" width="2" height="2"/><rect x="5" y="0" width="2" height="2"/><rect x="0" y="3" width="4" height="3"/><rect x="4" y="3" width="4" height="3"/><rect x="0" y="6" width="1" height="2"/><rect x="3" y="6" width="2" height="2"/><rect x="7" y="6" width="1" height="2"/>',
  remake: '<rect x="0" y="0" width="3" height="3"/><rect x="5" y="5" width="3" height="3"/><rect x="4" y="1" width="3" height="1"/><rect x="6" y="2" width="1" height="2"/><rect x="5" y="3" width="1" height="1"/><rect x="1" y="4" width="1" height="3"/><rect x="2" y="6" width="2" height="1"/><rect x="2" y="4" width="1" height="1"/>',
  mic: '<rect x="3" y="0" width="2" height="5"/><rect x="1" y="3" width="1" height="2"/><rect x="6" y="3" width="1" height="2"/><rect x="2" y="5" width="4" height="1"/><rect x="3" y="6" width="2" height="1"/><rect x="2" y="7" width="4" height="1"/>',
  back: '<rect x="2" y="1" width="1" height="1"/><rect x="1" y="2" width="1" height="1"/><rect x="0" y="3" width="8" height="2"/><rect x="1" y="5" width="1" height="1"/><rect x="2" y="6" width="1" height="1"/>',
  star: '<rect x="3" y="0" width="2" height="2"/><rect x="0" y="2" width="8" height="2"/><rect x="1" y="4" width="6" height="1"/><rect x="1" y="5" width="2" height="2"/><rect x="5" y="5" width="2" height="2"/><rect x="0" y="7" width="2" height="1"/><rect x="6" y="7" width="2" height="1"/>',
  sprout: '<rect x="3" y="3" width="2" height="5"/><rect x="0" y="1" width="3" height="1"/><rect x="1" y="2" width="2" height="1"/><rect x="5" y="0" width="3" height="1"/><rect x="5" y="1" width="2" height="1"/><rect x="2" y="2" width="1" height="1"/>'
});

const PET_ANIMS = [
  ["pat", "摸摸头", "pat", 2200, ["嘿嘿～", "再摸一下！", "头毛都乱啦"]],
  ["tickle", "挠痒痒", "tickle", 2000, ["哈哈哈别挠了！", "好痒好痒～", "认输认输！"]],
  ["lift", "举高高", "lift", 2300, ["飞起来啦！", "好高！看到整个画布了", "再来一次！"]],
  ["pinch", "捏捏脸", "pinch", 1800, ["唔……脸要变方了", "我本来就是方的！", "轻点轻点～"]],
  ["boop", "碰一碰", "boop", 1600, ["碰！", "击个掌～", "收到信号！"]]
];
const IDLE_LINES = ["今天拍点什么？", "我在这儿陪你～", "灵感正在加载……", "画布好大，我去转转", "要不要喝口水？"];
const WORK_LINES = ["一起加油！", "我也在敲键盘", "这一句写得好", "节奏不错！"];
const WAKE_LINES = ["啊，我醒着呢！", "哈——欠，回来啦", "刚刚梦到爆款了"];

function petHTML() {
  const face = `<b class="eye l"></b><b class="eye r"></b><b class="mouth"></b><b class="blush l"></b><b class="blush r"></b>`;
  return `<div class="pet-shadow"></div>
  <div class="pet-hop"><div class="pet-squash">
    <div class="pet-scene"><div class="pet-tilt"><div class="pet-cube" role="button" tabindex="0" aria-label="桌宠 Bit，点一下打开轮盘，按住拖动">
      <i class="f fr">${face}</i><i class="f bk"></i><i class="f rt"></i><i class="f lf"></i><i class="f tp"></i><i class="f bt"></i>
    </div></div></div>
    <div class="pet-cur"><div class="cur-spin"><i class="c fr"></i><i class="c bk"></i><i class="c rt"></i><i class="c lf"></i><i class="c tp"></i><i class="c bt"></i></div></div>
  </div></div>
  <div class="pet-laptop" aria-hidden="true"><i class="lid"></i><i class="base"></i><i class="keys"></i></div>
  <div class="pet-think" aria-hidden="true"><i></i><i></i><i></i></div>
  <div class="pet-zzz" aria-hidden="true"><span>Z</span><span>z</span><span>z</span></div>
  <div class="pet-hand" aria-hidden="true">${petHandSvg()}</div><div class="pet-hand two" aria-hidden="true">${petHandSvg()}</div>
  <div class="pet-say" role="status" aria-live="polite"></div>
  <div class="pet-wheel" aria-label="Bit 轮盘"></div>`;
}
function petHandSvg() {
  // 10×10 像素小手：白色、黑描边
  const rows = ["..KK.KK...", ".KWWKWWK..", ".KWWKWWKK.", ".KWWWWWWWK", "KKWWWWWWWK", "KWWWWWWWWK", "KWWWWWWWK.", ".KWWWWWWK.", "..KWWWWK..", "...KKKK..."];
  let out = ""; rows.forEach((r, y) => [...r].forEach((c, x) => { if (c !== ".") out += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c === "K" ? "#0B0B0B" : "#F4F4F2"}"/>`; }));
  return `<svg viewBox="0 0 10 10" shape-rendering="crispEdges">${out}</svg>`;
}

// ---------- 挂载与位置 ----------
function petBoot() {
  if (PET.el || !state) return;
  const el = document.createElement("div"); el.className = "pet"; el.dataset.mode = "idle"; el.innerHTML = petHTML();
  document.body.appendChild(el); PET.el = el;
  petPlace(); petApplyHidden();
  const cube = $(".pet-cube", el);
  cube.addEventListener("pointerdown", petPointerDown);
  cube.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); petToggleWheel(); } });
  el.addEventListener("contextmenu", ev => { ev.preventDefault(); petToggleWheel(); });
  // 创作者的动静
  document.addEventListener("keydown", ev => { if (!ev.metaKey && !ev.ctrlKey) petInput(true); else petInput(false); }, true);
  document.addEventListener("input", () => petInput(true), true);
  document.addEventListener("pointerdown", ev => { petInput(false); if (PET.wheel && !ev.target.closest(".pet")) petCloseWheel(); }, true);
  document.addEventListener("pointermove", ev => { PET.lastInput = Date.now(); if (ev.buttons && !PET.drag) PET.lastWork = Date.now(); petLook(ev); if (PET.mode === "sleep" && Date.now() - PET.fxT > 900) petWake(); }, { passive: true });
  document.addEventListener("wheel", () => { PET.lastInput = PET.lastWork = Date.now(); if (PET.mode === "sleep") petWake(); }, { passive: true });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { PET.lastInput = Date.now(); petTick(); } });
  window.addEventListener("resize", petPlace);
  PET.timers.tick = setInterval(petTick, 600);
  petScheduleBlink(); petScheduleIdle();
  setTimeout(() => { petDaily(); }, 1400);
  petTick();
}
function petApplyHidden() { if (PET.el) PET.el.hidden = Boolean(state.pet.hidden) || document.body.classList.contains("bh-open"); }
// 全屏工具（比如封面设计器）打开时，Bit 临时挪到不挡操作的地方；用户拖动后就听用户的
function petOverride(fn) { PET.override = fn || null; petPlace(); }
function petBox() {
  if (PET.override) { const o = PET.override(); return { x: clamp(Math.round(o.x), 4, innerWidth - PET_W - 4), y: clamp(Math.round(o.y), 4, innerHeight - PET_H - 4) }; }
  const pos = state.pet.pos; const W = innerWidth, H = innerHeight;
  const x = clamp(Math.round(pos.x * W - PET_W / 2), 4, W - PET_W - 4), y = clamp(Math.round(pos.y * H - PET_H / 2), 4, H - PET_H - 4);
  return { x, y };
}
function petPlace() {
  if (!PET.el) return; const b = petBox();
  PET.el.style.setProperty("--px", `${b.x}px`); PET.el.style.setProperty("--py", `${b.y}px`);
  PET.el.classList.toggle("on-left", b.x + PET_W / 2 < innerWidth / 2);
  PET.el.classList.toggle("on-top", b.y < 150);
  if (PET.chat) petChatPlace();
}

// ---------- 状态机：灵动 / 工作 / 思考 / 睡觉 ----------
function petInput(work) {
  PET.lastInput = Date.now(); if (work) PET.lastWork = Date.now();
  if (PET.mode === "sleep") petWake();
}
function aiBusy() {
  try { return genLock.size > 0 || jobs.size > 0 || polls.size > 0 || directorBusy || PET.chatBusy || (typeof REMAKE !== "undefined" && REMAKE.busy); } catch (_) { return false; }
}
function petTick() {
  if (!PET.el) return;
  const t = Date.now();
  let m = "idle";
  if (document.visibilityState === "hidden") m = "sleep";
  else if (aiBusy()) m = "think";
  else if (t - PET.lastWork < PET_WORK_MS) m = "work";
  else if (t - PET.lastInput > PET_SLEEP_MS && !PET.wheel && !PET.chat && !PET.anim && !PET.drag) m = "sleep";
  if (PET.drag || PET.anim) m = PET.mode === "sleep" ? "idle" : PET.mode;
  if (m !== PET.mode) petSetMode(m);
  // 饿了会提一句（每 4 分钟最多一次）
  if (m === "idle" && state.pet.stats.food < 25 && t - PET.hungryAt > 240_000 && !PET.chat) { PET.hungryAt = t; petSay("肚子咕咕叫……去家园喂喂我吧", 3600); }
}
function petSetMode(m) {
  const prev = PET.mode; PET.mode = m; PET.el.dataset.mode = m;
  if (prev === "sleep" && m !== "sleep") petFx("wake", 900);
  if (m === "sleep") { petCloseWheel(); PET.el.classList.remove("blink"); }
  if (m === "work" && prev === "idle" && Math.random() < .12) petSay(pick(WORK_LINES), 1800);
}
function petWake() {
  if (PET.mode !== "sleep") return;
  PET.lastInput = Date.now(); petSetMode(aiBusy() ? "think" : "idle");
  if (Math.random() < .5) petSay(pick(WAKE_LINES), 1800);
}
const pick = a => a[Math.floor(Math.random() * a.length)];
function petFx(name, ms) {
  if (!PET.el) return;
  PET.el.classList.remove(`fx-${name}`); void PET.el.offsetWidth; PET.el.classList.add(`fx-${name}`); PET.fxT = Date.now();
  clearTimeout(PET.timers[`fx-${name}`]); PET.timers[`fx-${name}`] = setTimeout(() => PET.el?.classList.remove(`fx-${name}`), ms);
}
function petScheduleBlink() {
  clearTimeout(PET.timers.blink);
  PET.timers.blink = setTimeout(() => {
    if (PET.el && PET.mode !== "sleep" && !PET.anim) { PET.el.classList.add("blink"); setTimeout(() => PET.el?.classList.remove("blink"), 150); if (Math.random() < .25) setTimeout(() => { PET.el?.classList.add("blink"); setTimeout(() => PET.el?.classList.remove("blink"), 120); }, 280); }
    petScheduleBlink();
  }, 2200 + Math.random() * 3800);
}
function petScheduleIdle() {
  clearTimeout(PET.timers.idle);
  PET.timers.idle = setTimeout(() => {
    if (PET.el && PET.mode === "idle" && !PET.anim && !PET.drag && !PET.wheel && !reduceMotion()) {
      const r = Math.random();
      if (r < .3) petFx("hop", 900); else if (r < .5) petFx("look", 1600); else if (r < .68) petFx("spin", 1100); else if (r < .84) petFx("wiggle", 900); else if (!PET.chat) petSay(pick(IDLE_LINES), 2400);
    }
    petScheduleIdle();
  }, 6000 + Math.random() * 9000);
}
// 眼睛和脑袋跟着鼠标
function petLook(ev) {
  PET.look.x = ev.clientX; PET.look.y = ev.clientY;
  if (PET.look.raf || !PET.el || PET.mode === "sleep") return;
  PET.look.raf = requestAnimationFrame(() => {
    PET.look.raf = 0; if (!PET.el) return;
    const b = petBox(); const cx = b.x + 46, cy = b.y + 52;
    const dx = PET.look.x - cx, dy = PET.look.y - cy;
    const kx = clamp(dx / 260, -1, 1), ky = clamp(dy / 220, -1, 1);
    const s = PET.el.style;
    s.setProperty("--ex", `${Math.round(kx * 4)}px`); s.setProperty("--ey", `${Math.round(ky * 3)}px`);
    s.setProperty("--ry", `${Math.round(-8 + kx * 30)}deg`); s.setProperty("--rx", `${Math.round(-10 - ky * 14)}deg`);
  });
}

// ---------- 拖动 / 点击 ----------
function petPointerDown(ev) {
  if (ev.button !== 0) return;
  ev.preventDefault(); ev.stopPropagation();
  const b = petBox();
  PET.drag = { sx: ev.clientX, sy: ev.clientY, ox: ev.clientX - b.x, oy: ev.clientY - b.y, moved: false, lx: ev.clientX, vt: Date.now() };
  const move = e => {
    const d = PET.drag; if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) < 5) return;
    if (!d.moved) { d.moved = true; PET.el.classList.add("is-drag"); petCloseWheel(); document.body.classList.add("pet-dragging"); if (PET.mode === "sleep") petWake(); }
    const x = clamp(e.clientX - d.ox, 4, innerWidth - PET_W - 4), y = clamp(e.clientY - d.oy, 4, innerHeight - PET_H - 4);
    PET.el.style.setProperty("--px", `${x}px`); PET.el.style.setProperty("--py", `${y}px`);
    const vx = e.clientX - d.lx; d.lx = e.clientX;
    PET.el.style.setProperty("--sw", `${clamp(-vx * 1.6, -22, 22)}deg`);
    state.pet.pos = { x: (x + PET_W / 2) / innerWidth, y: (y + PET_H / 2) / innerHeight };
    if (PET.chat) petChatPlace();
  };
  const up = () => {
    document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
    const d = PET.drag; PET.drag = null; document.body.classList.remove("pet-dragging");
    if (!PET.el) return;
    PET.el.classList.remove("is-drag"); PET.el.style.setProperty("--sw", "0deg");
    if (d?.moved) { PET.override = null; petPlace(); petFx("land", 600); save(); if (Math.random() < .3) petSay(pick(["这里视野不错", "就待这儿吧", "搬家完成！"]), 1600); }
    else petToggleWheel();
  };
  document.addEventListener("pointermove", move); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
}

// ---------- 像素轮盘 ----------
function petToggleWheel(kind = "main") {
  if (PET.mode === "sleep") { petWake(); return; }
  if (PET.wheel === kind) return petCloseWheel();
  petOpenWheel(kind);
}
function petOpenWheel(kind) {
  const w = $(".pet-wheel", PET.el); if (!w) return;
  const items = kind === "main"
    ? [["pet-chat", "chat", "对话"], ["pet-wheel-pet", "heart", "抚摸"], ["pet-home", "house", "家园"]]
    : PET_ANIMS.map(([k, label, ic]) => ["pet-anim", ic, label, k]).concat([["pet-wheel-back", "back", "返回"]]);
  // 轮盘朝屏幕中心展开
  const b = petBox(); const cx = b.x + 46, cy = b.y + 52;
  const base = Math.atan2(innerHeight / 2 - cy, innerWidth / 2 - cx);
  const spread = kind === "main" ? 1.75 : 3.1; const R = kind === "main" ? 94 : 106;
  w.innerHTML = items.map(([act, ic, label, arg], i) => {
    const a = base + (items.length === 1 ? 0 : (i / (items.length - 1) - .5) * spread);
    const x = Math.round(Math.cos(a) * R), y = Math.round(Math.sin(a) * R);
    return `<button class="pw-btn ${act === "pet-wheel-back" ? "back" : ""}" style="--x:${x}px;--y:${y}px;--i:${i}" data-act="${act}" ${arg ? `data-anim="${arg}"` : ""} aria-label="${attr(label)}">${icon(ic)}<span class="px">${esc(label)}</span></button>`;
  }).join("");
  PET.wheel = kind; PET.el.classList.add("wheel-on"); w.dataset.kind = kind;
  if (kind === "main") petFx("hop", 700);
}
function petCloseWheel() { if (!PET.el || !PET.wheel) return; PET.wheel = ""; PET.el.classList.remove("wheel-on"); const w = $(".pet-wheel", PET.el); if (w) w.innerHTML = ""; }

// ---------- 抚摸 ----------
function petPlay(kind) {
  const def = PET_ANIMS.find(a => a[0] === kind); if (!def || !PET.el) return;
  petCloseWheel();
  if (PET.anim) PET.el.classList.remove(`pa-${PET.anim}`);
  PET.anim = kind; void PET.el.offsetWidth; PET.el.classList.add(`pa-${kind}`);
  const b = petBox();
  const hearts = kind === "tickle" ? 0 : kind === "boop" ? 3 : 5;
  for (let i = 0; i < hearts; i++) setTimeout(() => petHeart(b.x + 30 + Math.random() * 36, b.y + 20), 260 + i * 260);
  if (kind === "tickle") for (let i = 0; i < 4; i++) setTimeout(() => petFloat(pick(["哈", "嘻", "哈哈"]), "giggle", b.x + 20 + Math.random() * 56, b.y + 10), 200 + i * 360);
  if (kind === "boop") setTimeout(() => burst(b.x + 46, b.y + 52, 10), 380);
  if (kind === "lift") setTimeout(() => burst(b.x + 46, b.y + 10, 12, "#FFD23F"), 900);
  clearTimeout(PET.timers.anim);
  PET.timers.anim = setTimeout(() => { PET.el?.classList.remove(`pa-${kind}`); PET.anim = ""; petSay(pick(def[4]), 2000); }, def[3]);
  petEvent("pat", 1, { anim: kind });
}
function petHeart(x, y) {
  if (reduceMotion()) return;
  const d = document.createElement("div"); d.className = "pet-heart"; d.innerHTML = icon("heart");
  d.style.left = `${x}px`; d.style.top = `${y}px`; document.body.appendChild(d);
  setTimeout(() => d.remove(), 1300);
}
function petFloat(text, cls = "", x = null, y = null) {
  if (!PET.el && x == null) return;
  const b = PET.el && !PET.el.hidden ? petBox() : { x: innerWidth - 120, y: innerHeight - 140 };
  const d = document.createElement("div"); d.textContent = text;
  if (x == null) {
    // 收入飘字放在 Bit 身边，一条条往上叠，不和气泡、彼此重叠
    const t = Date.now(); PET.floats = (PET.floats || []).filter(f => t - f < 1300); const k = PET.floats.length; PET.floats.push(t);
    const left = PET.el?.classList.contains("on-left");
    d.className = `pet-float side ${left ? "right" : ""} px ${cls}`;
    d.style.left = `${left ? b.x + PET_W + 4 : b.x + 6}px`; d.style.top = `${b.y + 46 - k * 26}px`;
  } else { d.className = `pet-float px ${cls}`; d.style.left = `${x}px`; d.style.top = `${y}px`; }
  document.body.appendChild(d); setTimeout(() => d.remove(), 1500);
}
function petSay(text, ms = 2600) {
  if (!PET.el || PET.el.hidden) return;
  const s = $(".pet-say", PET.el); if (!s) return;
  s.textContent = text; s.classList.remove("in"); void s.offsetWidth; s.classList.add("in");
  clearTimeout(PET.sayT); PET.sayT = setTimeout(() => s.classList.remove("in"), ms);
}
// 外部事件：生成成功、导出、升级时的小反应
function petReact(kind, text = "") {
  if (!PET.el || PET.el.hidden) return;
  if (PET.mode === "sleep") petWake();
  if (kind === "levelup") { petFx("spin", 1100); setTimeout(() => petFx("hop", 900), 500); const b = petBox(); burst(b.x + 46, b.y + 40, 18); setTimeout(() => burst(b.x + 46, b.y + 40, 14, "#FFD23F"), 260); }
  else petFx("hop", 900);
  if (text) petSay(text, kind === "levelup" ? 4200 : 2400);
}

// ---------- 对话 ----------
// 3.7：Bit 和 AI 编导是同一个人。在项目里点「对话」，直接打开右侧的 AI 编导面板（同一份对话记录），不再另开一个浮窗。
function petFocusDirector(text = "") {
  petCloseWheel(); if (PET.chat) petChatClose(true);
  const p = project(); if (!p) return;
  const showing = ui.panels.right && (p.view.mode === "flow" || ui.tab === "ai") && $("#ask");
  if (!showing) { ui.panels.right = true; if (p.view.mode === "canvas") ui.tab = "ai"; renderProject(); }
  requestAnimationFrame(() => {
    const ask = $("#ask"); if (!ask) return;
    if (text) ask.value = text;
    ask.focus({ preventScroll: true });
    const panel = ask.closest(".panel"); if (panel) { panel.classList.remove("bit-here"); void panel.offsetWidth; panel.classList.add("bit-here"); setTimeout(() => panel.classList.remove("bit-here"), 1300); }
  });
  petFx("hop", 700);
}
function petChatOpen() {
  if (petInProject()) { petFocusDirector(); return; }
  petCloseWheel();
  if (PET.chat) { petChatFocus(); return; }
  PET.chat = true;
  const box = document.createElement("div"); box.className = "pet-chat"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "和 AI 编导 Bit 对话");
  box.innerHTML = `<header class="pc-head"><span class="pc-ava" aria-hidden="true"><i></i><i></i></span><div class="pc-tt"><b class="px">AI 编导 Bit</b><span class="px faint" data-pc-ctx></span></div><button class="pc-x" data-act="pet-chat-close" aria-label="关闭对话">${icon("x")}</button></header>
    <div class="pc-log" data-pc-log role="log" aria-live="polite"></div>
    <div class="pc-sugs" data-pc-sugs></div>
    <form class="pc-input" data-pc-form><label class="sr" for="petAsk">给 Bit 的消息</label><textarea id="petAsk" rows="2" placeholder="和 Bit 说点什么…"></textarea><button class="pc-send" type="submit" aria-label="发送">${svgArrow}</button></form>`;
  document.body.appendChild(box);
  const ta = $("#petAsk", box);
  $("[data-pc-form]", box).addEventListener("submit", ev => { ev.preventDefault(); const v = ta.value.trim(); if (!v) return; ta.value = ""; petAsk(v); });
  ta.addEventListener("keydown", ev => {
    if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); ev.stopPropagation(); $("[data-pc-form]", box).requestSubmit(); }
    if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); petChatClose(); }
  });
  box.addEventListener("pointerdown", ev => ev.stopPropagation());
  PET.chatSig = ""; petChatRender(); petChatPlace();
  requestAnimationFrame(() => box.classList.add("in"));
  petChatFocus();
  clearInterval(PET.timers.chat); PET.timers.chat = setInterval(petChatRender, 450);
  petFx("hop", 700);
}
function petChatFocus() { setTimeout(() => $("#petAsk")?.focus({ preventScroll: true }), 40); }
function petChatClose(now = false) {
  PET.chat = false; clearInterval(PET.timers.chat);
  const box = $(".pet-chat"); if (!box) return;
  if (now || reduceMotion()) box.remove(); else { box.classList.remove("in"); setTimeout(() => box.remove(), 160); }
}
function petChatPlace() {
  const box = $(".pet-chat"); if (!box || !PET.el) return;
  const b = petBox(); const w = Math.min(360, innerWidth - 24), h = Math.min(480, innerHeight - 24);
  box.style.width = `${w}px`; box.style.height = `${h}px`;
  const left = b.x + PET_W / 2 > innerWidth / 2 ? b.x - w - 10 : b.x + PET_W + 10;
  const top = b.y + PET_H - h;
  box.style.left = `${clamp(left, 12, innerWidth - w - 12)}px`; box.style.top = `${clamp(top, 12, innerHeight - h - 12)}px`;
}
const petInProject = () => route.view === "project" && project();
function petMsgs() {
  const p = petInProject();
  if (p) return { list: p.chat.length ? p.chat : [{ role: "assistant", content: `在看「${p.title || "未命名项目"}」。${greeting(p)}`, local: true }], ctx: `正在看　${p.title || "未命名项目"}`, busy: directorBusy };
  const view = { home: "首页", library: "资料库", settings: "设置" }[route.view] || "首页";
  const list = state.pet.chat.length ? state.pet.chat : [{ role: "assistant", content: `嗨，我是 Bit！${state.projects.length ? `你有 ${state.projects.length} 个项目，想继续哪一个？也可以直接告诉我一个新选题，我帮你立项。` : "告诉我一个选题，我帮你开个新项目。"}`, local: true }];
  return { list, ctx: `在${view}`, busy: PET.chatBusy };
}
function petSuggestions() {
  const p = petInProject();
  if (p) return suggestions(p).slice(0, 2).map(([label, act]) => ({ label, act }));
  const last = state.projects.find(x => x.id === state.last?.projectId) || state.projects[0];
  return [last ? { label: `继续「${(last.title || "未命名").slice(0, 10)}」`, act: `open:${last.id}` } : null, { label: "打开资料库", act: "nav:library" }].filter(Boolean);
}
function petChatRender() {
  const box = $(".pet-chat"); if (!box) { clearInterval(PET.timers.chat); return; }
  // 浮窗开着时进了项目（比如让 Bit 立项）：把对话交给项目里的 AI 编导面板，接着聊
  if (petInProject()) { petFocusDirector(); return; }
  const { list, ctx, busy } = petMsgs();
  const last = list[list.length - 1];
  const sig = `${route.view}|${route.projectId}|${list.length}|${busy}|${last?.content?.length}|${last?.results?.length || 0}`;
  if (sig === PET.chatSig) return; PET.chatSig = sig;
  $("[data-pc-ctx]", box).textContent = ctx;
  const log = $("[data-pc-log]", box);
  log.innerHTML = list.slice(-30).map(m => `<div class="pc-msg ${m.role}"><div class="pc-b">${esc(m.content)}</div>${m.results?.length ? `<div class="pc-res">${m.results.map(r => `<span class="px">${esc(r)}</span>`).join("")}</div>` : ""}</div>`).join("") + (busy ? `<div class="pc-msg assistant thinking"><div class="pc-b"><span class="dots"><i></i><i></i><i></i></span>Bit 在想…</div></div>` : "");
  log.scrollTop = log.scrollHeight;
  const sugs = busy || last?.role === "user" ? [] : petSuggestions();
  $("[data-pc-sugs]", box).innerHTML = sugs.map(s => `<button class="pc-sug px" data-act="pet-sug" data-q="${attr(s.act)}">${esc(s.label)}</button>`).join("");
  const send = $(".pc-send", box); if (send) send.disabled = busy;
}
async function petAsk(text) {
  if (petInProject()) { await askDirector(text, { pet: true }); return; }
  const pc = state.pet.chat;
  pc.push({ role: "user", content: text, time: now() }); if (pc.length > 40) pc.splice(0, pc.length - 40);
  save(); petChatRender();
  const local = localActions(text).filter(a => ["navigate", "select_project"].includes(a.type));
  if (local.length) { const msg = { role: "assistant", content: "好的～", time: now(), results: [] }; pc.push(msg); for (const a of local) msg.results.push(await execAction(a, "")); save(); petChatRender(); return; }
  if (!apiState.connected) { pc.push({ role: "assistant", content: "我现在能帮你跳页面、打开项目。想让我写脚本、立项和出主意，预览版没有接入模型，AI 写作请用帧比特 Mac App。", time: now() }); save(); petChatRender(); return; }
  PET.chatBusy = true; petChatRender();
  try {
    const ctx = { title: "（未打开项目）", platform: "", petMode: true, noProject: true, view: route.view, availableProjects: state.projects.map(x => ({ id: x.id, title: x.title, platform: x.platform, next: nextStep(x)?.name || "已完成" })), directorConversation: pc.slice(-12).map(m => ({ role: m.role, content: m.content })) };
    const d = await postJson("/api/director", { project: ctx, account: {}, instruction: text });
    const r = d.result || {};
    const msg = { role: "assistant", content: r.reply || "嗯嗯，明白～", time: now(), results: [], model: d.model || "" };
    pc.push(msg); PET.chatBusy = false; save(); petChatRender();
    const had = new Set(state.projects.map(x => x.id));
    for (const a of (r.actions || []).filter(a => ["navigate", "select_project", "create_project"].includes(a.type))) msg.results.push(allowed(a, text) ? await execAction(a, "") : `没有明确要求，跳过了：${a.type}`);
    // 在首页让 Bit 立项：把这两句带进新项目的对话里，进项目后接着聊，不用再说一遍
    state.projects.filter(x => !had.has(x.id) && !x.chat.length).forEach(np => { np.chat.push({ role: "user", content: text, time: new Date(Date.now() - 10000).toISOString() }, { role: "assistant", content: msg.content, time: new Date(Date.now() - 9000).toISOString(), model: msg.model }); });
    save(); petChatRender();
    if (route.view === "project" && route.projectId && !had.has(route.projectId)) renderProject();
  } catch (e) { PET.chatBusy = false; pc.push({ role: "assistant", content: `这次没说上话：${e.message}`, time: now() }); save(); petChatRender(); }
}

Object.assign(EXT_ACTS, {
  "pet-chat": () => petChatOpen(),
  "pet-chat-close": () => petChatClose(),
  "pet-wheel-pet": () => petOpenWheel("pet"),
  "pet-wheel-back": () => petOpenWheel("main"),
  "pet-anim": el => petPlay(el.dataset.anim),
  "pet-home": () => { petCloseWheel(); openBitHome(); },
  "pet-sug": el => { const q = el.dataset.q; if (q.startsWith("open:")) go("project", q.slice(5)); else if (q.startsWith("nav:")) go(q.slice(4)); else EXT_ACTS["pet-quick"](q); setTimeout(() => { PET.chatSig = ""; petChatRender(); }, 60); },
  "pet-quick": q => { const [act, arg] = q.split(":"); if (act === "ai-style") aiStyle(); else if (act === "ai-run") generate(arg, ""); else if (act === "open-step") openStep(arg, { flow: true }); else if (act === "sync-cut") ACTS["sync-cut"](); else if (act === "export") doExport(arg); else if (act === "batch-images") batchImages(); else if (act === "open-cover") openCover(); },
  "pet-reset-pos": () => { state.pet.pos = { x: .95, y: .7 }; state.pet.hidden = false; save(); petApplyHidden(); petPlace(); petReact("hop", "回到老地方啦"); },
  "pet-toggle": () => { state.pet.hidden = !state.pet.hidden; save(); petApplyHidden(); if (!state.pet.hidden) petReact("hop", "我回来啦！"); if (route.view === "settings") renderSettings(); }
});
