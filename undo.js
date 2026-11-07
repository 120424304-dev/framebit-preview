"use strict";
// 帧比特 3.7 · 撤销 / 重做（⌘Z / ⇧⌘Z）
// 每个项目一条历史：改动停下来 0.6 秒记一步，最多 80 步，只在这次打开期间有效（关掉应用就清空；长期的回退用「版本」）。
// 不进历史的东西：对话、版本、导出记录、画布视角，以及生成任务的状态和生成出来的图片 / 视频 / 配乐——
// 撤销不会把正在生成的任务弄丢，也不会把已经生成好的素材从节点上拿掉。

const UNDO = { stacks: new Map(), pending: new Set(), timer: 0, busy: false, max: 80, chars: 6_000_000 };
const UNDO_TOP = ["versions", "chat", "updatedAt", "createdAt", "view", "exports", "team", "remake", "_autoTitle", "coverLastError"];
const UNDO_NODE = ["status", "startedAt", "error", "requestId", "pollStartedAt", "pollErrors", "modelUsed", "prevVideoUrl", "prevText", "stage", "progress", "images", "imageUrl", "pick", "videoUrl", "tracks", "track", "audioUrl"];
const UNDO_ROW = ["imageUrl", "imageStatus", "imageError", "imageModel", "imageStartedAt"];

function undoStrip(p) {
  const o = {};
  for (const k of Object.keys(p)) if (!UNDO_TOP.includes(k)) o[k] = p[k];
  const c = p.canvas || {};
  o.canvas = { ...c, viewport: undefined, nodes: (c.nodes || []).map(n => { const data = {}; for (const k of Object.keys(n.data || {})) if (!UNDO_NODE.includes(k)) data[k] = n.data[k]; return { ...n, data }; }) };
  delete o.canvas.viewport;
  o.script = (p.script || []).map(r => { const x = { ...r }; UNDO_ROW.forEach(k => delete x[k]); return x; });
  return o;
}
// full：真正存下来的一步（含素材地址，删掉的节点撤销回来时素材还在）；cmp：去掉任务状态和素材后用来判断「有没有改动」
function undoFull(p) {
  const o = {};
  for (const k of Object.keys(p)) if (!UNDO_TOP.includes(k)) o[k] = p[k];
  o.canvas = { ...p.canvas }; delete o.canvas.viewport;
  return JSON.stringify(o);
}
const undoSer = p => JSON.stringify(undoStrip(p));
const undoMark = p => ({ full: undoFull(p), cmp: undoSer(p) });
function undoStack(p) {
  let st = UNDO.stacks.get(p.id);
  if (!st) { st = { base: undoMark(p), undo: [], redo: [] }; UNDO.stacks.set(p.id, st); }
  return st;
}
// 打开项目时先记下起点，第一笔改动才能撤销
function undoEnsure(p) { if (p?.id) undoStack(p); }

// touch(p) 会调到这里；停 0.6 秒后合并成一步
function undoNote(p) {
  if (UNDO.busy || !p?.id || !state?.projects?.includes(p)) return;
  undoStack(p); UNDO.pending.add(p.id);
  clearTimeout(UNDO.timer); UNDO.timer = setTimeout(undoFlush, 600);
  if (route.view === "project" && route.projectId === p.id) undoPaint();
}
function undoFlush() {
  clearTimeout(UNDO.timer);
  for (const id of UNDO.pending) {
    const p = state.projects.find(x => x.id === id); const st = UNDO.stacks.get(id); if (!p || !st) continue;
    const cmp = undoSer(p);
    if (cmp === st.base.cmp) { st.base.full = undoFull(p); continue; }
    st.undo.push(st.base.full); st.base = { full: undoFull(p), cmp }; st.redo = [];
    undoTrim(st);
  }
  UNDO.pending.clear(); undoPaint();
}
function undoTrim(st) {
  while (st.undo.length > UNDO.max) st.undo.shift();
  let total = st.undo.reduce((a, x) => a + x.length, 0);
  while (st.undo.length > 4 && total > UNDO.chars) total -= st.undo.shift().length;
}

// ---------- 原地还原：节点、镜头、风格这些对象保持同一个引用，正在跑的任务回来时还能写进去 ----------
const isObj = v => v && typeof v === "object" && !Array.isArray(v);
function undoSyncObj(live, snap, keep = []) {
  for (const k of Object.keys(live)) if (!(k in snap) && !keep.includes(k)) delete live[k];
  for (const [k, v] of Object.entries(snap)) {
    if (keep.includes(k)) continue;
    if (isObj(v) && isObj(live[k])) undoSyncObj(live[k], v);
    else live[k] = v;
  }
}
function undoSyncList(live, snap, sync) {
  const byId = new Map((live || []).map(x => [x.id, x]));
  return (snap || []).map(s => { const l = byId.get(s.id); if (!l) return s; sync(l, s); return l; });
}
function undoApply(p, target) {
  const snap = JSON.parse(target);
  const beforeNodes = new Map(p.canvas.nodes.map(n => [n.id, n])); const beforeRows = new Set(p.script.map(r => r.id));
  const snapNodes = snap.canvas?.nodes || [];
  // 被这一步拿掉、而且有内容的节点，放进纸篓（和手动删除一样能找回）
  const snapIds = new Set(snapNodes.map(n => n.id));
  const removed = p.canvas.nodes.filter(n => !snapIds.has(n.id) && !LOCKED_TYPES.includes(n.type) && undoHasContent(n));
  removed.forEach(n => { try { trashNode(p, n); } catch (_) {} });
  // 顶层字段
  const keepTop = [...UNDO_TOP, "canvas", "script", "id"];
  for (const k of Object.keys(p)) if (!(k in snap) && !keepTop.includes(k)) delete p[k];
  for (const [k, v] of Object.entries(snap)) {
    if (keepTop.includes(k)) continue;
    if (isObj(v) && isObj(p[k])) undoSyncObj(p[k], v); else p[k] = v;
  }
  // 画布
  const { nodes: _n, edges, ...restCanvas } = snap.canvas || {};
  Object.entries(restCanvas).forEach(([k, v]) => { if (k !== "viewport") p.canvas[k] = v; });
  p.canvas.nodes = undoSyncList(p.canvas.nodes, snapNodes, (l, s) => {
    const { data, ...rest } = s;
    undoSyncObj(l, rest, ["data"]);
    undoSyncObj(l.data, data || {}, UNDO_NODE);
  });
  p.canvas.edges = edges || [];
  // 拿回来的节点如果当时正在生成：视频 / 配乐有任务号，可以「继续查询」取回结果，不会重复扣费；其他的清掉状态
  p.canvas.nodes.filter(n => !beforeNodes.has(n.id)).forEach(n => {
    const d = n.data || {};
    const job = JQ.list.find(j => j.state === "run" && j.pid === p.id && j.nid === n.id && !j.poll);
    if (job) { Object.assign(d, { status: ["video", "audio"].includes(job.kind) ? "submitting" : "generating", startedAt: job.t0, error: "" }); return; } // 这个节点的生成还在等结果：保持「生成中」，结果回来会写进来
    if (RUN.includes(d.status) || d.status === "generating") {
      if (d.requestId && (n.type === "video" || n.type === "audio")) Object.assign(d, { status: "poll_error", error: "撤销后拿回的节点：任务可能已经在平台上完成了，点「继续查询」取回，不会重复扣费。" });
      else Object.assign(d, { status: "", error: "" });
    }
  });
  // 脚本
  p.script = undoSyncList(p.script, snap.script || [], (l, s) => undoSyncObj(l, s, UNDO_ROW)).map(r => beforeRows.has(r.id) ? r : shotRow(r));
  // 从纸篓里拿回来的节点 / 镜头，纸篓里那份就不要了
  const back = new Set(p.canvas.nodes.filter(n => !beforeNodes.has(n.id)).map(n => n.id));
  const backRows = new Set(p.script.filter(r => !beforeRows.has(r.id)).map(r => r.id));
  if (back.size || backRows.size) (state.trash || []).filter(t => t.from?.pid === p.id && ((t.payload?.node && back.has(t.payload.node.id)) || (t.payload?.row && backRows.has(t.payload.row.id)))).map(t => t.id).forEach(id => { try { trashDrop(id); } catch (_) {} });
  return { removed: removed.length };
}
// 只有带着生成好 / 上传的素材的节点才进纸篓；只有文字的节点用「重做」就能拿回来，不往纸篓里塞
function undoHasContent(n) {
  const d = n.data || {};
  return Boolean(d.imageUrl || d.images?.length || d.videoUrl || d.audioUrl || d.tracks?.length || d.clips?.length);
}

// ---------- 这一步做了什么（给提示用） ----------
function undoDescribe(before, after) {
  const a = undoStrip(JSON.parse(before)), b = undoStrip(JSON.parse(after));
  const na = a.canvas?.nodes || [], nb = b.canvas?.nodes || [];
  if (nb.length > na.length) return `添加 ${nb.length - na.length} 个节点`;
  if (nb.length < na.length) return `删除 ${na.length - nb.length} 个节点`;
  const ra = a.script || [], rb = b.script || [];
  if (rb.length > ra.length) return `添加 ${rb.length - ra.length} 个镜头`;
  if (rb.length < ra.length) return `删除 ${ra.length - rb.length} 个镜头`;
  const ea = a.canvas?.edges || [], eb = b.canvas?.edges || [];
  if (eb.length > ea.length) return "连线";
  if (eb.length < ea.length) return "删除连线";
  const pos = new Map(na.map(n => [n.id, n]));
  if (nb.some(n => { const o = pos.get(n.id); return o && (o.x !== n.x || o.y !== n.y); })) return "移动节点";
  if (nb.some(n => { const o = pos.get(n.id); return o && (o.w !== n.w || o.title !== n.title || JSON.stringify(o.data) !== JSON.stringify(n.data)); })) return "修改节点";
  if (JSON.stringify(ra) !== JSON.stringify(rb)) return ra.map(r => r.id).join() !== rb.map(r => r.id).join() ? "调整镜头顺序" : "修改脚本";
  if (["title", "topic", "platform", "accountId", "brief"].some(k => a[k] !== b[k])) return "修改项目信息";
  if (JSON.stringify(a.style) !== JSON.stringify(b.style)) return "修改风格";
  if (JSON.stringify(a.cast) !== JSON.stringify(b.cast)) return "调整出镜 IP";
  if (JSON.stringify(a.coverDesign) !== JSON.stringify(b.coverDesign) || ["coverImageUrl", "coverMainText", "coverSubText", "coverEyebrow", "coverBackgroundPrompt", "coverPlan"].some(k => a[k] !== b[k])) return "修改封面";
  if (JSON.stringify([a.titles, a.coverWords, a.publishCopy]) !== JSON.stringify([b.titles, b.coverWords, b.publishCopy])) return "修改发布文案";
  return "上一步修改";
}

// ---------- 撤销 / 重做 ----------
function undoStep(dir = -1) {
  const p = project(); if (!p) return;
  undoNote(p); undoFlush();
  const st = undoStack(p); const from = dir < 0 ? st.undo : st.redo; const to = dir < 0 ? st.redo : st.undo;
  if (!from.length) { toast(dir < 0 ? "没有可以撤销的了" : "没有可以重做的了", 1600, "", { key: "undo", log: false }); return; }
  const target = from.pop();
  const what = dir < 0 ? undoDescribe(target, st.base.full) : undoDescribe(st.base.full, target);
  to.push(st.base.full);
  UNDO.busy = true;
  let res = { removed: 0 };
  try { res = undoApply(p, target); ensureStructure(p); }
  catch (e) { console.error(e); toast(`没能${dir < 0 ? "撤销" : "重做"}：${e.message}`, 5000, "err"); }
  st.base = undoMark(p);
  p.updatedAt = now(); save();
  UNDO.busy = false;
  const alive = new Set(p.canvas.nodes.map(n => n.id));
  if (typeof selIds === "function" && selIds().some(id => !alive.has(id))) setSel(selIds().filter(id => alive.has(id)));
  if (ui.edgeSel && !p.canvas.edges.some(e => e.id === ui.edgeSel)) ui.edgeSel = "";
  renderProject();
  toast(`${dir < 0 ? "已撤销" : "已重做"}：${what}${res.removed ? `（带素材的 ${res.removed} 个节点也放进了纸篓）` : ""}`, 2600, "", { key: "undo", log: false, action: { label: dir < 0 ? "重做 ⇧⌘Z" : "撤销 ⌘Z", fn: () => undoStep(-dir) } });
}
function undoBtns(p) {
  const st = p && UNDO.stacks.get(p.id);
  const u = Boolean(st?.undo.length || UNDO.pending.has(p?.id)), r = Boolean(st?.redo.length);
  return `<span class="undo-btns"><button class="btn quiet sm icon" data-act="undo" title="撤销 ⌘Z" aria-label="撤销" ${u ? "" : "disabled"}>${icon("undo")}</button><button class="btn quiet sm icon" data-act="redo" title="重做 ⇧⌘Z" aria-label="重做" ${r ? "" : "disabled"}>${icon("redo")}</button></span>`;
}
function undoPaint() {
  const p = route.view === "project" ? project() : null; if (!p) return;
  const st = UNDO.stacks.get(p.id);
  const u = $("[data-act='undo']"), r = $("[data-act='redo']");
  if (u) u.disabled = !(st?.undo.length || UNDO.pending.has(p.id));
  if (r) r.disabled = !st?.redo.length;
}

Object.assign(EXT_ACTS, {
  undo: () => undoStep(-1),
  redo: () => undoStep(1)
});
