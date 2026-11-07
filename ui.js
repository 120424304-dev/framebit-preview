"use strict";
// 帧比特 3.2 · 交互层：统一下拉、取色、提示、滑动指示、视口动画、命令面板

const reduceMotion = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (_) { return false; } };

// ---------- 统一下拉：把所有 <select> 换成自绘弹层，原 select 保留做数据源 ----------
const DD = { pop: null, btn: null, idx: -1, q: "", qt: null };
const ddLabel = sel => sel.options[sel.selectedIndex]?.textContent || "";
function ddSync(sel) {
  const b = sel?._dd; if (!b) return;
  const v = b.querySelector(".v"); const t = ddLabel(sel) || "请选择";
  if (v.textContent !== t) v.textContent = t; // 只在变化时写入，避免 MutationObserver 自激
  if (b.classList.contains("empty") !== !sel.value) b.classList.toggle("empty", !sel.value);
  if (b.disabled !== sel.disabled) b.disabled = sel.disabled;
}
function ddEnhance(root = document) {
  root.querySelectorAll("select:not([data-native])").forEach(sel => {
    if (sel._dd?.isConnected) { ddSync(sel); return; }
    const b = document.createElement("button");
    b.type = "button"; b.className = `dd ${sel.dataset.ddClass || ""}`.trim();
    b.setAttribute("aria-haspopup", "listbox"); b.setAttribute("aria-expanded", "false");
    const lab = sel.getAttribute("aria-label") || sel.closest("label")?.firstChild?.textContent?.trim(); if (lab) b.setAttribute("aria-label", lab);
    b.innerHTML = `<span class="v"></span><i class="chev" aria-hidden="true"></i>`;
    sel.classList.add("dd-src"); sel.tabIndex = -1; sel.setAttribute("aria-hidden", "true");
    sel.after(b); sel._dd = b; b._sel = sel; ddSync(sel);
  });
}
function ddPlace(pop, anchor, minW = 160) {
  const r = anchor.getBoundingClientRect();
  const w = Math.max(r.width, minW); pop.style.minWidth = `${w}px`;
  const h = Math.min(pop.scrollHeight, 320); const below = innerHeight - r.bottom - 10;
  const up = below < h && r.top > below;
  pop.style.left = `${clamp(r.left, 8, innerWidth - pop.offsetWidth - 8)}px`;
  pop.style.top = `${up ? Math.max(8, r.top - h - 6) : r.bottom + 6}px`;
  pop.style.maxHeight = `${Math.max(120, up ? r.top - 14 : below)}px`;
  pop.classList.toggle("up", up);
}
function ddOpen(b) {
  ddClose(true); cpClose(true);
  const sel = b._sel; if (!sel || sel.disabled) return;
  const pop = document.createElement("div"); pop.className = `dd-pop ${b.closest(".theme-light") ? "theme-light" : ""}`; pop.setAttribute("role", "listbox");
  let grp = null;
  const many = sel.options.length > 12;
  pop.innerHTML = (many ? `<input class="dd-q" type="text" placeholder="搜索 ${sel.options.length} 项…" spellcheck="false" aria-label="搜索选项">` : "") + [...sel.options].map((o, i) => {
    const g = o.parentElement?.tagName === "OPTGROUP" ? o.parentElement.label : null;
    const head = g !== grp && g ? `<span class="dd-grp">${esc(g)}</span>` : ""; grp = g;
    return `${head}<button type="button" role="option" tabindex="-1" data-i="${i}" class="${i === sel.selectedIndex ? "on" : ""}" aria-selected="${i === sel.selectedIndex}" ${o.disabled ? "disabled" : ""}><span>${esc(o.textContent)}</span><i class="ck" aria-hidden="true"></i></button>`;
  }).join("");
  document.body.appendChild(pop); ddPlace(pop, b, many ? 240 : 160);
  const q = $(".dd-q", pop);
  if (q) {
    setTimeout(() => q.focus({ preventScroll: true }), 20);
    q.addEventListener("input", () => {
      const v = q.value.trim().toLowerCase();
      $$("[data-i]", pop).forEach(x => { x.hidden = Boolean(v) && !x.textContent.toLowerCase().includes(v); });
      $$(".dd-grp", pop).forEach(h => { let n = h.nextElementSibling, any = false; while (n && n.matches("[data-i]")) { if (!n.hidden) any = true; n = n.nextElementSibling; } h.hidden = !any; });
      const first = $$("[data-i]", pop).findIndex(x => !x.hidden); if (first >= 0) ddHi(first);
    });
    q.addEventListener("keydown", e => {
      if (e.key === "ArrowDown") { e.preventDefault(); ddMove(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); ddMove(-1); }
      else if (e.key === "Enter") { e.preventDefault(); ddPick(+$$("[data-i]", pop)[DD.idx].dataset.i); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); ddClose(); b.focus(); }
      else if (e.key === "Tab") ddClose(true);
    });
  }
  Object.assign(DD, { pop, btn: b, idx: sel.selectedIndex, q: "" });
  b.setAttribute("aria-expanded", "true"); b.classList.add("open");
  requestAnimationFrame(() => pop.classList.add("in"));
  ddHi(DD.idx);
  pop.addEventListener("pointerdown", e => { if (!e.target.closest(".dd-q")) e.preventDefault(); });
  pop.addEventListener("click", e => { const o = e.target.closest("[data-i]"); if (o && !o.disabled) ddPick(+o.dataset.i); });
  pop.addEventListener("pointermove", e => { const o = e.target.closest("[data-i]"); if (o) ddHi(+o.dataset.i, false); });
}
function ddHi(i, scroll = true) {
  if (!DD.pop) return; const items = $$("[data-i]", DD.pop); if (!items.length) return;
  DD.idx = clamp(i, 0, items.length - 1);
  items.forEach((x, k) => x.classList.toggle("hi", k === DD.idx));
  if (scroll) items[DD.idx]?.scrollIntoView({ block: "nearest" });
}
function ddMove(d) {
  const items = $$("[data-i]", DD.pop); let i = DD.idx;
  for (let k = 0; k < items.length; k++) { i = (i + d + items.length) % items.length; if (!items[i].disabled && !items[i].hidden) break; }
  ddHi(i);
}
function ddPick(i) {
  const b = DD.btn, sel = b?._sel; ddClose();
  if (!sel?.isConnected) return;
  if (sel.selectedIndex !== i) {
    sel.selectedIndex = i; ddSync(sel);
    sel.dispatchEvent(new Event("input", { bubbles: true }));
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }
  const again = sel._dd; if (again?.isConnected) again.focus({ preventScroll: true });
}
function ddClose(now = false) {
  const { pop, btn } = DD; if (!pop) return;
  DD.pop = null; DD.btn = null;
  btn?.setAttribute("aria-expanded", "false"); btn?.classList.remove("open");
  if (now || reduceMotion()) pop.remove(); else { pop.classList.remove("in"); pop.classList.add("out"); setTimeout(() => pop.remove(), 140); }
}
function ddKey(ev) {
  const t = ev.target;
  if (DD.pop && DD.btn === t) {
    if (ev.key === "ArrowDown") { ev.preventDefault(); ddMove(1); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); ddMove(-1); }
    else if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ddPick(DD.idx); }
    else if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); ddClose(); }
    else if (ev.key === "Tab") ddClose(true);
    else if (ev.key.length === 1) {
      DD.q += ev.key.toLowerCase(); clearTimeout(DD.qt); DD.qt = setTimeout(() => { DD.q = ""; }, 600);
      const items = $$("[data-i]", DD.pop); const k = items.findIndex(x => x.textContent.toLowerCase().startsWith(DD.q)); if (k >= 0) ddHi(k);
    }
    return true;
  }
  if (t?.classList?.contains("dd") && ["ArrowDown", "ArrowUp", "Enter", " "].includes(ev.key)) { ev.preventDefault(); ddOpen(t); return true; }
  return false;
}

// ---------- 统一取色 ----------
const SWATCHES = ["#000000", "#111111", "#262626", "#3D3D3D", "#6E6E6E", "#A1A1A1", "#C9C9C9", "#EDEDED", "#FFFFFF", "#C7DEC4", "#8FB58A", "#2F4A35", "#FF7A6E", "#B3261E", "#D9C7B8", "#2B3A55"];
const CP = { pop: null, input: null };
function cpEnhance(root = document) {
  root.querySelectorAll('input[type="color"]:not([data-native])').forEach(inp => {
    if (inp._cp?.isConnected) { cpSync(inp); return; }
    const b = document.createElement("button"); b.type = "button"; b.className = "swatch-btn";
    b.innerHTML = `<i></i><span class="px"></span>`; b.setAttribute("aria-label", "选择颜色");
    inp.classList.add("dd-src"); inp.tabIndex = -1; inp.after(b); inp._cp = b; b._inp = inp; cpSync(inp);
  });
}
function cpSync(inp) { const b = inp._cp; if (!b) return; const i = b.querySelector("i"), sp = b.querySelector("span"), v = inp.value.toUpperCase(); if (sp.textContent !== v) { sp.textContent = v; i.style.background = inp.value; } }
function cpOpen(b) {
  ddClose(true); cpClose(true);
  const inp = b._inp; const pop = document.createElement("div"); pop.className = `dd-pop cp-pop ${b.closest(".theme-light") ? "theme-light" : ""}`;
  pop.innerHTML = `<div class="sw">${SWATCHES.map(c => `<button type="button" data-c="${c}" style="background:${c}" class="${c.toLowerCase() === inp.value.toLowerCase() ? "on" : ""}" aria-label="${c}"></button>`).join("")}</div><label class="hex"><span class="px faint">HEX</span><input value="${attr(inp.value.toUpperCase())}" maxlength="7" spellcheck="false"></label>`;
  document.body.appendChild(pop); ddPlace(pop, b, 212);
  Object.assign(CP, { pop, input: inp });
  requestAnimationFrame(() => pop.classList.add("in"));
  const set = (c, commit) => { inp.value = c; cpSync(inp); inp.dispatchEvent(new Event("input", { bubbles: true })); if (commit) inp.dispatchEvent(new Event("change", { bubbles: true })); $$("[data-c]", pop).forEach(x => x.classList.toggle("on", x.dataset.c.toLowerCase() === c.toLowerCase())); };
  pop.addEventListener("click", e => { const s = e.target.closest("[data-c]"); if (s) { set(s.dataset.c, true); $(".hex input", pop).value = s.dataset.c; } });
  const hex = $(".hex input", pop);
  hex.addEventListener("input", () => { let v = hex.value.trim(); if (!v.startsWith("#")) v = `#${v}`; if (/^#[0-9a-f]{6}$/i.test(v)) set(v, false); });
  hex.addEventListener("change", () => { if (/^#[0-9a-f]{6}$/i.test(inp.value)) inp.dispatchEvent(new Event("change", { bubbles: true })); });
  hex.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cpClose(); b.focus(); } });
}
function cpClose(now = false) {
  const { pop } = CP; if (!pop) return; CP.pop = null; CP.input = null;
  if (now || reduceMotion()) pop.remove(); else { pop.classList.remove("in"); pop.classList.add("out"); setTimeout(() => pop.remove(), 140); }
}

// ---------- 自绘提示（替代系统 title 提示） ----------
const TIP = { el: null, t: null, target: null };
function tipShow(el) {
  const text = el.dataset.tip; if (!text) return;
  TIP.target = el; clearTimeout(TIP.t);
  TIP.t = setTimeout(() => {
    if (TIP.target !== el || !el.isConnected) return;
    if (!TIP.el) { TIP.el = document.createElement("div"); TIP.el.className = "tip"; TIP.el.setAttribute("role", "tooltip"); document.body.appendChild(TIP.el); }
    TIP.el.textContent = text; TIP.el.classList.remove("in");
    const r = el.getBoundingClientRect(); const w = TIP.el.offsetWidth, h = TIP.el.offsetHeight;
    const top = r.bottom + 8 + h > innerHeight ? r.top - h - 8 : r.bottom + 8;
    TIP.el.style.left = `${clamp(r.left + r.width / 2 - w / 2, 8, innerWidth - w - 8)}px`; TIP.el.style.top = `${top}px`;
    requestAnimationFrame(() => TIP.el?.classList.add("in"));
  }, 380);
}
function tipHide() { clearTimeout(TIP.t); TIP.target = null; TIP.el?.classList.remove("in"); }

// ---------- 滑动指示：分段控件与流程导航 ----------
const IND = new Map();
function slideTo(key, ind, box, axis) {
  const prev = IND.get(key); IND.set(key, box);
  const apply = b => { ind.style.transform = axis === "y" ? `translateY(${b.y}px)` : `translateX(${b.x}px)`; ind.style[axis === "y" ? "height" : "width"] = `${axis === "y" ? b.h : b.w}px`; };
  if (prev && !reduceMotion() && (prev.x !== box.x || prev.y !== box.y || prev.w !== box.w || prev.h !== box.h)) {
    ind.style.transition = "none"; apply(prev); ind.getBoundingClientRect(); ind.style.transition = ""; apply(box);
  } else { ind.style.transition = "none"; apply(box); ind.getBoundingClientRect(); ind.style.transition = ""; }
}
function indicators(root = document) {
  $$(".seg", root).forEach((seg, i) => {
    const on = seg.querySelector(":scope > .on"); let ind = seg.querySelector(":scope > .seg-ind");
    if (!on) { ind?.remove(); return; }
    if (!ind) { ind = document.createElement("i"); ind.className = "seg-ind"; ind.setAttribute("aria-hidden", "true"); seg.prepend(ind); }
    seg.classList.add("has-ind");
    slideTo(`seg:${seg.dataset.seg || i}`, ind, { x: on.offsetLeft, w: on.offsetWidth }, "x");
  });
  const rail = $(".rail ol", root);
  if (rail) {
    const on = rail.querySelector("li.on"); let ind = rail.querySelector(".rail-ind");
    if (!ind) { ind = document.createElement("i"); ind.className = "rail-ind"; ind.setAttribute("aria-hidden", "true"); rail.prepend(ind); }
    ind.hidden = !on; if (on) slideTo("rail", ind, { y: on.offsetTop, h: on.offsetHeight }, "y");
  }
}

// ---------- 入场动画（只在页面、步骤或模式切换时播放） ----------
let lastMotionKey = "";
function motion(key, root) {
  if (!root) return;
  if (window.SPLASHING) { lastMotionKey = key; return; } // 启动动画结束时再统一入场
  const changed = key !== lastMotionKey; lastMotionKey = key;
  if (!changed || reduceMotion()) return;
  $$("[data-stagger]", root).forEach(c => { [...c.children].forEach((el, i) => el.style.setProperty("--i", Math.min(i, 14))); c.classList.remove("enter"); c.getBoundingClientRect(); c.classList.add("enter"); });
}

// ---------- 画布视口动画 ----------
let vpAnim = 0;
function tweenViewport(p, to, ms = 360) {
  cancelAnimationFrame(vpAnim);
  const v = p.canvas.viewport;
  if (reduceMotion()) { Object.assign(v, to); applyViewport(); return; }
  const from = { ...v }; const t0 = performance.now();
  const step = t => {
    const k = Math.min(1, (t - t0) / ms); const e = 1 - Math.pow(1 - k, 3);
    v.x = from.x + (to.x - from.x) * e; v.y = from.y + (to.y - from.y) * e; v.zoom = from.zoom + (to.zoom - from.zoom) * e;
    applyViewport();
    if (k < 1) vpAnim = requestAnimationFrame(step); else { v.x = Math.round(to.x); v.y = Math.round(to.y); }
  };
  vpAnim = requestAnimationFrame(step);
}
const stopViewportTween = () => cancelAnimationFrame(vpAnim);

// ---------- AI 回复逐字出现 ----------
const typed = new Map();
function typewriter() {
  $$("[data-tw]").forEach(el => {
    const key = el.dataset.tw; const full = el.dataset.full || "";
    let n = typed.get(key) ?? 0;
    if (n >= full.length || reduceMotion()) { el.textContent = full; typed.set(key, full.length); return; }
    clearInterval(el._t);
    el._t = setInterval(() => {
      if (!el.isConnected) { clearInterval(el._t); return; }
      n = Math.min(full.length, n + Math.max(2, Math.ceil(full.length / 90)));
      el.textContent = full.slice(0, n); typed.set(key, n);
      const b = el.closest(".panel-body"); if (b) b.scrollTop = b.scrollHeight;
      if (n >= full.length) clearInterval(el._t);
    }, 18);
  });
}

// ---------- 命令面板 ⌘K ----------
const PAL = { open: false, idx: 0, items: [] };
function paletteItems() {
  const out = []; const add = (label, hint, run, kw = "") => out.push({ label, hint, run, kw });
  const p = route.view === "project" ? project() : null;
  if (p) {
    outline(p).forEach(s => add(`${s.no} ${s.name}`, s.st || "流程", () => openStep(s.key, { flow: true }), s.desc));
    add(p.view.mode === "canvas" ? "切换到流程" : "切换到画布", "⌘E", () => setMode(p.view.mode === "canvas" ? "flow" : "canvas"), "canvas flow 模式");
    add("AI 起草风格画像", "AI", () => aiStyle(), "风格 画像");
    add("AI 生成脚本", "AI", () => generate("script"), "脚本");
    add("AI 一次生成脚本、包装和审稿", "AI", () => generate("full"), "全部");
    add("AI 生成标题包装", "AI", () => generate("packaging"), "标题");
    add("AI 审稿", "AI", () => generate("review"), "审稿 vibe check");
    add("为所有分镜生成画面", "AI", () => batchImages(), "画面 出图");
    add("打开封面设计器", "封面", () => openCover(), "封面");
    [["pack", "完整内容包"], ["shoot", "拍摄包"], ["edit", "剪辑包"], ["audit", "审核包"], ["publish", "发布包"], ["cover", "封面 PNG"], ["edl", "粗剪单"]].forEach(([k, l]) => add(`导出${l}`, "导出", () => doExport(k), "导出 下载"));
    add("存一个版本", "版本", () => { snapshot(p, "手动保存"); touch(p); renderProject(); toast("已存为一个版本"); }, "版本 保存");
  }
  add("新建项目", "首页", () => { go("home"); setTimeout(() => $("#topic")?.focus(), 30); }, "new 新建 选题");
  state.projects.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 12).forEach(x => { if (x.id !== p?.id) add(`打开「${x.title || "未命名项目"}」`, "项目", () => go("project", x.id), x.topic); });
  add("首页", "前往", () => go("home"), "home");
  add("资料库", "前往", () => go("library"), "账号 DNA 风格 素材");
  add("设置", "前往", () => go("settings"), "模型 备份");
  add("连接模型平台", "设置", () => openApi(), "api key 模型");
  add(state.theme === "light" ? "切换到深色" : "切换到浅色", "外观", () => { state.theme = state.theme === "light" ? "dark" : "light"; save(); render(); }, "主题 颜色");
  return out;
}
function paletteOpen() {
  if (PAL.open) return; PAL.open = true; PAL.idx = 0;
  ddClose(true); cpClose(true); tipHide();
  const el = document.createElement("div"); el.className = "palette"; el.id = "palette";
  el.innerHTML = `<div class="pal-box" role="dialog" aria-label="命令"><input id="palIn" placeholder="跳到步骤、打开项目、运行 AI、导出…" autocomplete="off" spellcheck="false"><div class="pal-list" role="listbox"></div><div class="pal-foot px faint"><span>↑↓ 选择</span><span>Enter 执行</span><span>Esc 关闭</span></div></div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("in"));
  const inp = $("#palIn"); inp.focus();
  const draw = () => {
    const q = inp.value.trim().toLowerCase();
    PAL.items = paletteItems().filter(x => !q || `${x.label} ${x.hint} ${x.kw}`.toLowerCase().includes(q)).slice(0, 40);
    PAL.idx = clamp(PAL.idx, 0, Math.max(0, PAL.items.length - 1));
    $(".pal-list", el).innerHTML = PAL.items.map((x, i) => `<button type="button" role="option" data-pi="${i}" class="${i === PAL.idx ? "hi" : ""}"><span>${esc(x.label)}</span><span class="px faint">${esc(x.hint)}</span></button>`).join("") || `<p class="faint" style="padding:14px 16px;font-size:13px">没有匹配的命令</p>`;
    $(".pal-list .hi", el)?.scrollIntoView({ block: "nearest" });
  };
  draw();
  inp.addEventListener("input", () => { PAL.idx = 0; draw(); });
  inp.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); PAL.idx = (PAL.idx + 1) % Math.max(1, PAL.items.length); draw(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); PAL.idx = (PAL.idx - 1 + PAL.items.length) % Math.max(1, PAL.items.length); draw(); }
    else if (e.key === "Enter") { e.preventDefault(); paletteRun(PAL.idx); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); paletteClose(); }
  });
  el.addEventListener("pointerdown", e => { if (e.target === el) paletteClose(); });
  el.addEventListener("pointermove", e => { const b = e.target.closest("[data-pi]"); if (b && +b.dataset.pi !== PAL.idx) { PAL.idx = +b.dataset.pi; $$("[data-pi]", el).forEach(x => x.classList.toggle("hi", +x.dataset.pi === PAL.idx)); } });
  el.addEventListener("click", e => { const b = e.target.closest("[data-pi]"); if (b) paletteRun(+b.dataset.pi); });
}
function paletteRun(i) { const it = PAL.items[i]; paletteClose(); if (it) setTimeout(() => it.run(), 0); }
function paletteClose() {
  const el = $("#palette"); PAL.open = false; if (!el) return;
  if (reduceMotion()) el.remove(); else { el.classList.remove("in"); setTimeout(() => el.remove(), 160); }
}

// ---------- 安装 ----------
function installUI() {
  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; queueMicrotask(() => { queued = false; ddEnhance(); cpEnhance(); }); }).observe(document.body, { childList: true, subtree: true });
  ddEnhance(); cpEnhance();
  document.addEventListener("click", ev => {
    const dd = ev.target.closest(".dd"); if (dd) { ev.preventDefault(); DD.btn === dd ? ddClose() : ddOpen(dd); return; }
    const sw = ev.target.closest(".swatch-btn"); if (sw) { ev.preventDefault(); CP.pop && CP.input === sw._inp ? cpClose() : cpOpen(sw); return; }
    // 点 label 里的文字时，打开它里面的下拉，而不是去聚焦隐藏的原生 select
    const lab = ev.target.closest("label"); const src = lab?.querySelector(":scope select.dd-src, :scope input.dd-src");
    if (src && !ev.target.closest("input,textarea,button")) { ev.preventDefault(); const b = src._dd || src._cp; if (b) (src._dd ? ddOpen : cpOpen)(b); }
  }, true);
  document.addEventListener("pointerdown", ev => {
    if (DD.pop && !ev.target.closest(".dd-pop") && ev.target.closest(".dd") !== DD.btn) ddClose();
    if (CP.pop && !ev.target.closest(".cp-pop") && ev.target.closest(".swatch-btn") !== CP.input?._cp) cpClose();
    tipHide();
  }, true);
  document.addEventListener("keydown", ev => { if (ddKey(ev)) ev.stopPropagation(); }, true);
  document.addEventListener("scroll", ev => { if (DD.pop && !ev.target.closest?.(".dd-pop")) ddClose(true); if (CP.pop && !ev.target.closest?.(".cp-pop")) cpClose(true); tipHide(); }, true);
  addEventListener("resize", () => { ddClose(true); cpClose(true); tipHide(); });
  document.addEventListener("mouseover", ev => {
    const el = ev.target.closest?.("[title], [data-tip]"); if (!el) return;
    if (el.hasAttribute("title")) { const t = el.getAttribute("title"); if (!t) return; if (!el.getAttribute("aria-label") && !el.textContent.trim()) el.setAttribute("aria-label", t); el.dataset.tip = t; el.removeAttribute("title"); }
    if (TIP.target !== el) tipShow(el);
  });
  document.addEventListener("mouseout", ev => { if (TIP.target && !TIP.target.contains(ev.relatedTarget)) tipHide(); });
}
