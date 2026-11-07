"use strict";
// 帧比特 3.7 · 任务中心
// 所有交给模型的生成任务都登记在这里：能看到在跑什么、等了多久、平台给的真实状态；可以取消、失败了可以重试。
// 任务完成时如果你不在那一页，提示里会带「去看看」。另一栏「消息」记着这次打开以来的所有提示。
// 「取消」只是停止等待：已经交给平台的请求可能仍会完成并计费，这一点在面板里写明。

const JQ = { list: [], seq: 0, open: false, tab: "jobs", msgs: [], errSeen: 0, ticker: 0 };
const JQ_KIND = { image: "图片", video: "视频", audio: "配乐", text: "文字", shot: "分镜画面", cover: "封面", ip: "IP", script: "AI 写作", remake: "拆解复刻", team: "协作纪要", style: "风格" };
const JQ_ICON = { image: "image", video: "video", audio: "audio", text: "text", shot: "shot", cover: "image", ip: "ip", script: "script", remake: "split", team: "text", style: "style" };
Object.assign(ICONS, {
  bell: '<rect x="3" y="0" width="2" height="1"/><rect x="2" y="1" width="4" height="1"/><rect x="1" y="2" width="1" height="3"/><rect x="6" y="2" width="1" height="3"/><rect x="2" y="2" width="4" height="1" opacity=".35"/><rect x="0" y="5" width="8" height="1"/><rect x="3" y="6" width="2" height="1"/>',
  undo: '<rect x="2" y="1" width="1" height="1"/><rect x="1" y="2" width="2" height="1"/><rect x="0" y="3" width="6" height="1"/><rect x="1" y="4" width="2" height="1"/><rect x="6" y="4" width="1" height="2"/><rect x="2" y="5" width="1" height="1"/><rect x="3" y="6" width="3" height="1"/>',
  redo: '<rect x="5" y="1" width="1" height="1"/><rect x="5" y="2" width="2" height="1"/><rect x="2" y="3" width="6" height="1"/><rect x="5" y="4" width="2" height="1"/><rect x="1" y="4" width="1" height="2"/><rect x="5" y="5" width="1" height="1"/><rect x="2" y="6" width="3" height="1"/>'
});

const jqOf = j => typeof j === "string" ? JQ.list.find(x => x.key === j && x.state === "run") : j && typeof j === "object" ? j : null;
const jqRunning = () => JQ.list.filter(j => j.state === "run");
function jqElapsed(t0, t1 = Date.now()) {
  const s = Math.max(0, Math.floor((t1 - Number(t0 || t1)) / 1000));
  return s < 60 ? `${s} 秒` : `${Math.floor(s / 60)} 分 ${String(s % 60).padStart(2, "0")} 秒`;
}

// ---------- 登记 ----------
// key 相同、还在跑的任务会被复用（视频提交后转入轮询、重启后继续查询，都算同一个任务）
function jqStart(o = {}) {
  const old = o.key ? JQ.list.find(j => j.key === o.key && j.state === "run") : null;
  if (old) { ["label", "phase", "cancel", "cancelTip", "retry", "retryLabel", "where", "go", "poll", "nid", "ipId"].forEach(k => { if (o[k] !== undefined) old[k] = o[k]; }); jqPaint(); return old; }
  const j = { id: ++JQ.seq, key: o.key || `j${JQ.seq}`, kind: o.kind || "text", label: o.label || JQ_KIND[o.kind] || "生成", pid: o.pid || "", nid: o.nid || "", ipId: o.ipId || "", t0: Number(o.t0) || Date.now(), phase: o.phase || "生成中", state: "run", poll: Boolean(o.poll), cancel: o.cancel || null, cancelTip: o.cancelTip || "", retry: o.retry || null, retryLabel: o.retryLabel || "", where: o.where || null, go: o.go || null, ctrl: new AbortController(), error: "", note: "" };
  j.signal = j.ctrl.signal;
  JQ.list.unshift(j);
  const done = JQ.list.filter(x => x.state !== "run"); if (done.length > 30) { const drop = new Set(done.slice(30)); JQ.list = JQ.list.filter(x => !drop.has(x)); }
  jqPaint(); jqTick(); return j;
}
function jqPhase(j, phase) { j = jqOf(j); if (!j || j.state !== "run" || j.phase === phase) return; j.phase = phase; jqPaint(); }
function jqEnd(j, msg = "", opt = {}) {
  j = jqOf(j);
  if (!j) { if (msg) toast(msg, opt.ms || 2600); return; }
  if (j.state === "done") return;
  Object.assign(j, { state: "done", t1: Date.now(), note: msg || "完成" });
  const away = !jqHere(j);
  if (msg) toast(msg, away ? 5200 : (opt.ms || 2600), "", away && jqCanGo(j) ? { action: { label: "去看看", fn: () => jqGo(j) } } : {});
  jqPaint();
}
// 返回 true 表示是你自己取消的（调用方不用再报错）
function jqFail(j, e, opt = {}) {
  const aborted = e?.code === "ABORTED" || e?.name === "AbortError";
  const msg = typeof e === "string" ? e : (e?.message || "没有成功");
  j = jqOf(j);
  if (!j) { if (!aborted && !opt.quiet) toast(msg, opt.ms || 6000, "err"); return aborted; }
  if (aborted || j.state === "cancel") { j.state = "cancel"; j.t1 = j.t1 || Date.now(); jqPaint(); return true; }
  if (opt.retry) j.retry = opt.retry;
  if (opt.retryLabel) j.retryLabel = opt.retryLabel;
  Object.assign(j, { state: "err", t1: Date.now(), error: msg });
  if (!opt.quiet) toast(msg, opt.ms || 6000, "err", j.retry ? { action: { label: j.retryLabel || "重试", fn: () => jqRetry(j.id) } } : {});
  jqPaint(); return false;
}
function jqCancel(id) {
  const j = JQ.list.find(x => x.id === id); if (!j || j.state !== "run") return;
  Object.assign(j, { state: "cancel", t1: Date.now() });
  try { j.ctrl.abort(); } catch (_) {}
  try { j.cancel?.(j); } catch (e) { console.error(e); }
  toast(j.poll ? "已停止查询。平台上的任务不受影响，之后可以在节点上「继续查询」" : "已停止等待。已经交给平台的请求可能仍会完成并计费", 4200);
  jqPaint();
}
function jqRetry(id) {
  const j = JQ.list.find(x => x.id === id); if (!j?.retry) return;
  if (j.pid && !state.projects.some(p => p.id === j.pid)) { toast("这个项目已经不在了", 2600, "err"); return; }
  const run = () => { JQ.list = JQ.list.filter(x => x !== j); jqPaint(); try { j.retry(); } catch (e) { toast(e.message, 5000, "err"); } };
  if (j.go) { jqClose(); jqUncover(); j.go(); setTimeout(run, 80); return; }
  if (j.pid && (route.view !== "project" || route.projectId !== j.pid)) { jqClose(); jqUncover(); go("project", j.pid); setTimeout(run, 80); return; }
  run();
}
function jqClearDone() { JQ.list = JQ.list.filter(j => j.state === "run"); jqPaint(); }

// ---------- 你在不在那一页 ----------
const jqCovered = () => Boolean((typeof BH !== "undefined" && BH.open) || (typeof TR !== "undefined" && TR.open) || (typeof TW !== "undefined" && TW.open) || (typeof cd !== "undefined" && cd.open));
function jqHere(j) {
  if (document.visibilityState === "hidden") return false;
  if (j.where) return j.where();
  if (!j.pid) return true;
  return route.view === "project" && route.projectId === j.pid && !jqCovered();
}
const jqCanGo = j => Boolean(j.go || (j.pid && state.projects.some(p => p.id === j.pid)));
function jqUncover() {
  if (typeof BH !== "undefined" && BH.open) closeBitHome();
  if (typeof TR !== "undefined" && TR.open) closeTrash();
  if (typeof TW !== "undefined" && TW.open) closeTeam();
}
function jqGo(j) {
  jqClose(); jqUncover();
  if (j.go) { j.go(); return; }
  if (!j.pid) return;
  if (route.view !== "project" || route.projectId !== j.pid) go("project", j.pid);
  const p = project(); const n = j.nid && p && nodeOf(p, j.nid);
  if (n && p.view.mode === "canvas") setTimeout(() => selectNode(n.id, { center: true }), 60);
  else if (j.kind === "shot") setTimeout(() => openStep("visual", { flow: true }), 30);
}

// ---------- 消息记录 ----------
function jqLog(msg, kind = "") {
  JQ.msgs.unshift({ t: Date.now(), msg: String(msg), kind });
  if (JQ.msgs.length > 80) JQ.msgs.length = 80;
  if (JQ.open && JQ.tab === "msgs") { if (kind === "err") JQ.errSeen = JQ.msgs.filter(m => m.kind === "err").length; jqRenderBody(); }
  else jqPaintBtn();
}
const jqErrUnseen = () => JQ.msgs.filter(m => m.kind === "err").length - JQ.errSeen;

// ---------- 顶栏按钮 ----------
function jqBtn() {
  const n = jqRunning().length; const err = jqErrUnseen() > 0;
  return `<button class="btn quiet sm icon jq-btn ${n ? "busy" : ""} ${err ? "has-err" : ""}" data-act="jq-open" title="任务中心 · 生成任务和消息" aria-label="任务中心${n ? `，${n} 个任务在跑` : ""}" aria-expanded="${JQ.open}">${icon("bell")}<i class="jq-n px" ${n ? "" : "hidden"}>${n}</i></button>`;
}
function jqPaintBtn() {
  const n = jqRunning().length; const err = jqErrUnseen() > 0;
  $$(".jq-btn").forEach(b => {
    b.classList.toggle("busy", n > 0); b.classList.toggle("has-err", err); b.setAttribute("aria-expanded", String(JQ.open));
    b.setAttribute("aria-label", `任务中心${n ? `，${n} 个任务在跑` : ""}`);
    const i = b.querySelector(".jq-n"); if (i) { i.textContent = n; i.hidden = !n; }
  });
}
function jqPaint() { jqPaintBtn(); if (JQ.open) jqRenderBody(); }

// ---------- 面板 ----------
function jqOpen(tab) {
  if (tab) JQ.tab = tab;
  let el = $("#jq");
  if (!el) {
    el = document.createElement("div"); el.id = "jq"; el.className = "jq"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "任务中心");
    document.body.appendChild(el);
    el.addEventListener("click", jqClick);
    el.addEventListener("pointerdown", ev => ev.stopPropagation());
  }
  JQ.open = true; jqPlace(); jqRenderBody(); jqPaintBtn();
  requestAnimationFrame(() => el.classList.add("in"));
}
function jqClose() {
  if (!JQ.open) return;
  JQ.open = false; const el = $("#jq"); if (el) el.classList.remove("in");
  jqPaintBtn();
}
function jqPlace() {
  const el = $("#jq"); if (!el) return;
  const b = [...$$(".jq-btn")].find(x => x.offsetParent); const r = b?.getBoundingClientRect();
  const w = Math.min(380, innerWidth - 24);
  el.style.width = `${w}px`;
  el.style.top = `${Math.round((r ? r.bottom : 52) + 8)}px`;
  el.style.left = `${Math.round(clamp((r ? r.right : innerWidth - 12) - w, 12, innerWidth - w - 12))}px`;
}
function jqRow(j) {
  const p = j.pid && state.projects.find(x => x.id === j.pid);
  const where = p ? (p.title || "未命名项目") : j.ipId ? (ipById?.(j.ipId)?.name || "IP 工作台") : "";
  const st = j.state === "run" ? `<b>${esc(j.phase)}</b> · 已等 <em data-el0="${j.t0}">${jqElapsed(j.t0)}</em>` : j.state === "done" ? `完成 · 用时 ${jqElapsed(j.t0, j.t1)}` : j.state === "cancel" ? "已取消" : `<span class="jq-err">${esc(j.error)}</span>`;
  const acts = [
    j.state === "run" ? `<button class="btn quiet sm" data-jq="cancel" data-id="${j.id}" title="${attr(j.cancelTip || (j.poll ? "停止查询；平台上的任务不受影响，之后可以继续查询" : "停止等待；已经交给平台的请求可能仍会完成并计费"))}">${j.poll ? "停止查询" : "取消"}</button>` : "",
    j.state === "err" && j.retry ? `<button class="btn line sm" data-jq="retry" data-id="${j.id}">${esc(j.retryLabel || "重试")}</button>` : "",
    j.state !== "cancel" && jqCanGo(j) && !(j.state === "run" && jqHere(j)) ? `<button class="btn quiet sm" data-jq="go" data-id="${j.id}">去看看</button>` : ""
  ].join("");
  return `<div class="jq-row ${j.state}"><span class="jq-ic" aria-hidden="true">${icon(JQ_ICON[j.kind] || "spark")}${j.state === "run" ? `<i class="jq-spin"></i>` : ""}</span>
    <div class="jq-main"><div class="jq-t"><b>${esc(j.label)}</b>${where ? `<span class="faint">${esc(where)}</span>` : ""}</div><div class="jq-s px">${st}</div></div>
    <div class="jq-acts">${acts}</div></div>`;
}
function jqRenderBody() {
  const el = $("#jq"); if (!el) return;
  const run = jqRunning(), rest = JQ.list.filter(j => j.state !== "run");
  if (JQ.tab === "msgs") JQ.errSeen = JQ.msgs.filter(m => m.kind === "err").length;
  const tabs = `<div class="seg jq-tabs" role="tablist"><button role="tab" class="${JQ.tab === "jobs" ? "on" : ""}" aria-selected="${JQ.tab === "jobs"}" data-jq="tab" data-tab="jobs">任务${run.length ? ` ${run.length}` : ""}</button><button role="tab" class="${JQ.tab === "msgs" ? "on" : ""}" aria-selected="${JQ.tab === "msgs"}" data-jq="tab" data-tab="msgs">消息${JQ.msgs.length ? ` ${JQ.msgs.length}` : ""}</button></div>`;
  let body = "";
  if (JQ.tab === "jobs") {
    body = run.length || rest.length
      ? `${run.length ? `<div class="jq-sec px faint">正在进行</div>${run.map(jqRow).join("")}` : ""}${rest.length ? `<div class="jq-sec px faint">最近<button class="jq-clear" data-jq="clear">清除</button></div>${rest.map(jqRow).join("")}` : ""}`
      : `<div class="jq-empty"><span class="px">现在没有任务</span><span class="faint">生成图片、视频、配乐、文字时，会在这里看到它们在等什么、等了多久。</span></div>`;
  } else {
    const f = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
    body = JQ.msgs.length ? `<div class="jq-sec px faint">这次打开以来的提示<button class="jq-clear" data-jq="clear-msgs">清空</button></div>${JQ.msgs.map(m => `<div class="jq-msg ${m.kind === "err" ? "err" : ""}"><span class="px faint">${f(m.t)}</span><span>${esc(m.msg)}</span></div>`).join("")}`
      : `<div class="jq-empty"><span class="px">还没有消息</span><span class="faint">提示条消失之后，可以在这里再看一遍。</span></div>`;
  }
  el.innerHTML = `<div class="jq-head">${tabs}<button class="btn quiet sm icon" data-jq="close" aria-label="关闭">${icon("x")}</button></div><div class="jq-body">${body}</div>${JQ.tab === "jobs" ? `<div class="jq-foot faint">「取消」只是停止等待；已经交给平台的请求可能仍会完成并计费。视频和配乐可以停止查询，之后在节点上继续查询，不会重复扣费。</div>` : ""}`;
  jqPaintBtn();
}
function jqClick(ev) {
  const b = ev.target.closest("[data-jq]"); if (!b) return;
  const id = Number(b.dataset.id); const j = JQ.list.find(x => x.id === id);
  const k = b.dataset.jq;
  if (k === "close") jqClose();
  else if (k === "tab") { JQ.tab = b.dataset.tab; jqRenderBody(); }
  else if (k === "cancel") jqCancel(id);
  else if (k === "retry") jqRetry(id);
  else if (k === "go" && j) jqGo(j);
  else if (k === "clear") jqClearDone();
  else if (k === "clear-msgs") { JQ.msgs = []; JQ.errSeen = 0; jqRenderBody(); }
}

// ---------- 等待时间（替代原来按经验估的进度条） ----------
// 页面上任何 [data-el0="开始时间戳"] 的元素，每秒刷新成「已等多久」
function jqTick() {
  clearTimeout(JQ.ticker);
  const els = $$("[data-el0]");
  const t = Date.now();
  els.forEach(e => { const v = jqElapsed(e.dataset.el0, t); if (e.textContent !== v) e.textContent = v; });
  if (els.length || jqRunning().length) JQ.ticker = setTimeout(jqTick, 1000);
}

Object.assign(EXT_ACTS, {
  "jq-open": () => JQ.open ? jqClose() : jqOpen()
});
document.addEventListener("pointerdown", ev => { if (JQ.open && !ev.target.closest?.("#jq, .jq-btn")) jqClose(); }, true);
window.addEventListener("resize", () => { if (JQ.open) jqPlace(); });
window.addEventListener("keydown", ev => { if (JQ.open && ev.key === "Escape" && !document.querySelector("dialog[open]")) { ev.preventDefault(); ev.stopImmediatePropagation(); jqClose(); } }, true);
