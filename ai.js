"use strict";
// 帧比特 3.2 · AI：编导生成、图片/视频任务、局部重写、AI 编导动作、导出

const modelCache = { key: "", image: [], video: [], audio: [], options: null, effective: {} };
let directorBusy = false;
let rewriteTarget = null;
const genLock = new Set();

function needText() { if (apiState.connected) return true; openApi(); toast("先连接一个文本模型平台", 3200, "err"); return false; }

async function loadModels(force = false) {
  const key = (apiState.connectedProviders || []).join(",");
  if (modelCache.key === key && !force) return; modelCache.key = key;
  try { const d = await (await fetch("/api/models")).json(); modelCache.image = d.image || []; modelCache.video = d.video || []; modelCache.audio = d.audio || []; } catch (_) {}
  if (!key) { modelCache.options = null; modelCache.effective = {}; return; }
  try {
    const r = await (await fetch("/api/routes")).json();
    modelCache.options = r.options || null; modelCache.routes = r;
    const eff = k => r.areas?.find(a => a.key === k)?.effective;
    modelCache.effective = { text: eff("text.canvas"), image: eff("image.canvas"), video: eff("video.canvas"), audio: eff("audio.canvas") };
    modelCache.byArea = Object.fromEntries((r.areas || []).map(a => [a.key, a.effective]));
    if (route.view === "project" && project()?.view.mode === "canvas") renderComposer();
  } catch (_) {}
}

function applyScript(p, rows) {
  const old = p.script;
  p.script = rows.slice(0, 100).map((r, i) => {
    const prev = old[i];
    const keepImg = prev && prev.shot === String(r.shot || "");
    return shotRow({ ...r, id: prev?.id, imageUrl: keepImg ? prev.imageUrl : "", imageModel: keepImg ? prev.imageModel : "" });
  });
}

async function generate(kind, instruction = "", btn = null) {
  if (!needText()) return;
  const p = project(); if (!p) return;
  if (genLock.has(p.id)) return toast("这个项目已有 AI 任务在运行", 3000, "err");
  genLock.add(p.id); busy(btn, true, "生成中"); setSave("", "AI 生成中");
  snapshot(p, { full: "生成脚本、包装和审稿前", script: "生成脚本前", packaging: "生成包装前", review: "审稿前" }[kind] || "AI 生成前");
  const j = jqStart({ key: `gen:${p.id}`, kind: "script", label: { full: "脚本、包装和审稿", script: "分镜脚本", packaging: "标题与包装", review: "AI 审稿" }[kind] || "AI 写作", pid: p.id, phase: "模型在写", retry: () => generate(kind, instruction) });
  try {
    const d = await postJson("/api/generate", { action: kind, project: serverProject(p), account: account(p.accountId) || {}, instruction }, { signal: j.signal });
    const r = d.result || {};
    if (Array.isArray(r.script)) applyScript(p, r.script);
    ["titles", "coverWords"].forEach(k => { if (Array.isArray(r[k])) p[k] = r[k].map(String); });
    ["publishCopy", "coverPlan"].forEach(k => { if (typeof r[k] === "string") p[k] = r[k]; });
    if (Array.isArray(r.review)) { p.review = r.review; p.reviewSummary = r.summary || ""; }
    if (Array.isArray(r.rationale)) p.rationale = r.rationale.map(String);
    if (!p.coverMainText && p.coverWords[0]) p.coverMainText = p.coverWords[0];
    ensureStructure(p);
    touch(p);
    const here = route.view === "project" && route.projectId === p.id;
    if (here) reveal(p, kind === "packaging" ? "package" : kind === "review" ? "review" : "script", kind === "packaging" || kind === "review" ? "publish" : "script");
    if (here && p.view.mode === "canvas" && (kind === "script" || kind === "full")) setTimeout(() => fitCanvas(p, true), 60);
    jqEnd(j, `${j.label}完成：${d.providerLabel || ""} ${d.model || ""}`.trim());
    petEvent(kind === "script" || kind === "full" ? "script" : "text");
    return true;
  } catch (e) {
    p.versions.pop(); jqFail(j, e); return false;
  } finally { genLock.delete(p.id); busy(btn, false); setSave("", "已保存"); }
}

async function aiStyle(btn = null) {
  if (!needText()) return;
  const p = project(); if (!p) return;
  const base = platformProfile(p.platform);
  busy(btn, true, "起草中");
  const j = jqStart({ key: `style:${p.id}`, kind: "style", label: "风格画像", pid: p.id, phase: "模型在写", retry: () => aiStyle() });
  try {
    const d = await postJson("/api/generate", { action: "style_map", project: serverProject(p), account: account(p.accountId) || {}, instruction: `选题：${p.topic}\n用户的大致思路：${p.styleIdea || "（没写，按选题和平台判断）"}\n平台参考（只作边界）：${base.nativeTone}；${base.discovery}；封面：${base.cover}；风险：${base.risk}` }, { signal: j.signal });
    const r = d.result || {};
    snapshot(p, "AI 起草风格画像前");
    STYLE_KEYS.forEach(k => { if (typeof r[k] === "string" && r[k].trim()) p.style[k] = r[k].trim(); });
    p.styleSavedAt = "";
    ensureStructure(p, "style"); touch(p);
    if (route.view === "project" && route.projectId === p.id) reveal(p, "style", "style");
    jqEnd(j, "画像起草好了，改完记得点「记住这份画像」"); petEvent("text");
  } catch (e) { jqFail(j, e); }
  finally { busy(btn, false); }
}
function platformProfile(name) { return PLATFORM_PROFILES[name] || PLATFORM_PROFILES["抖音"]; }

function rememberStyle() {
  const p = project(); if (!p) return;
  if (!p.style.positioning || !p.style.contentType) return toast("至少填好账号定位和内容类型", 3200, "err");
  const t = now();
  const rec = { id: p.styleMemoryId || uid("style"), name: `${p.style.positioning} / ${p.style.contentType}`.slice(0, 40), platform: p.platform, savedAt: t, style: copy(p.style) };
  state.styles = [rec, ...state.styles.filter(x => x.id !== rec.id)].slice(0, 50);
  p.styleMemoryId = rec.id; p.styleSavedAt = t;
  touch(p); renderProject(); toast("已记住，资料库里可以找到，下个项目能直接套用");
}

// ---------- 局部重写 ----------
function openRewrite(target, text) { rewriteTarget = target; $("#rwOriginal").value = text || ""; $("#rwInstr").value = ""; $("#rewriteDialog").showModal(); setTimeout(() => $("#rwInstr").focus(), 30); }
async function runRewrite(btn) {
  if (!needText()) { $("#rewriteDialog").close(); return; }
  const p = project(); if (!p || !rewriteTarget) return;
  busy(btn, true, "重写中");
  try {
    const d = await postJson("/api/generate", { action: "rewrite", project: serverProject(p), account: account(p.accountId) || {}, selectedText: $("#rwOriginal").value, instruction: $("#rwInstr").value });
    snapshot(p, "局部重写前");
    const t = rewriteTarget, val = d.result.rewritten;
    if (t.type === "shot") { const r = p.script.find(x => x.id === t.id); if (r) r.voice = val; }
    if (t.type === "item") p[t.key][t.index] = val;
    if (t.type === "field") p[t.key] = val;
    touch(p); $("#rewriteDialog").close(); renderProject(); toast("已替换为重写后的版本");
  } catch (e) { toast(e.message, 5000, "err"); }
  finally { busy(btn, false); }
}

// ---------- 图片 ----------
function needImage() { if (caps().image) return true; openApi("toapis"); toast("先连接能生图的平台（ToAPIs、SiliconFlow 或 OpenAI），已连接的文本平台不受影响", 4600, "err"); return false; }
async function imageCall(p, prompt, model = "auto", extra = {}) {
  // 3.6：画面描述里提到出镜 IP 的名字，就带上它的锚点和参考图；3.7：extra.signal 用来取消
  const { signal, ...rest } = extra;
  const inj = ipInject(p, prompt);
  return postJson("/api/cover-image", { topic: p.topic || p.title, prompt: inj.prompt, coverPlan: p.coverPlan, styleLabel: p.style.visual || "电影纪实", styleProfile: serverProject(p).styleProfile, requestedModel: model, ...rest, refs: [...new Set([...(rest.refs || []), ...inj.refs])] }, { signal });
}
async function shotImage(shotId, opt = {}) {
  if (!needImage()) return;
  const p = opt.p || project(); let r = p?.script.find(x => x.id === shotId); if (!r) return;
  const key = `img:${shotId}`; if (jobs.has(key)) return; jobs.add(key);
  const no = p.script.indexOf(r) + 1;
  const j = jqStart({ key: `shot:${p.id}:${shotId}`, kind: "shot", label: `第 ${no} 镜 · 分镜画面`, pid: p.id, nid: shotNode(p, shotId)?.id || "", phase: "等模型出图", retry: () => shotImage(shotId) });
  r.imageStatus = "generating"; r.imageError = ""; r.imageStartedAt = j.t0; renderProject();
  try {
    const d = await imageCall(p, [r.shot, r.subtitle && `画面里不要出现文字`, p.style.visual].filter(Boolean).join("。"), "auto", { area: "image.shot", signal: j.signal });
    r = p.script.find(x => x.id === shotId) || r;
    r.imageUrl = d.imageUrl; r.imageModel = d.model; r.imageStatus = "";
    touch(p); jqEnd(j, opt.quiet ? "" : `第 ${no} 镜画面已生成：${d.model}`); petEvent("image");
  } catch (e) { r = p.script.find(x => x.id === shotId) || r; r.imageStatus = ""; r.imageError = jqFail(j, e, { quiet: opt.quiet }) ? "" : e.message; touch(p); }
  finally { jobs.delete(key); if (route.view === "project" && route.projectId === p.id && !cd.open) renderProject(); }
}
async function batchImages() {
  if (!needImage()) return;
  const p = project(); if (!p) return;
  const todo = p.script.filter(r => !r.imageUrl && r.imageStatus !== "generating");
  if (!todo.length) return toast(p.script.length ? "每一镜都有画面了" : "先写分镜脚本");
  toast(`开始生成 ${todo.length} 镜画面`, 2400);
  // 3.7：批量时每一镜不单独弹提示，结束时汇总一条；你不在这个项目时带「去看看」
  let i = 0; const worker = async () => { while (i < todo.length) { const r = todo[i++]; if (state.projects.includes(p)) await shotImage(r.id, { quiet: true, p }); } };
  await Promise.all([worker(), worker()]);
  const left = p.script.filter(r => !r.imageUrl).length;
  const away = !(route.view === "project" && route.projectId === p.id) || jqCovered();
  toast(left ? `「${p.title || "这个项目"}」还有 ${left} 镜没生成成功，可以在任务中心里重试` : `「${p.title || "这个项目"}」全部画面已生成`, left ? 6000 : 3200, left ? "err" : "", away ? { action: { label: "去看看", fn: () => { jqUncover(); go("project", p.id); setTimeout(() => openStep("visual", { flow: true }), 30); } } } : {});
}
async function flowVideo(shotId) {
  if (!needVideo()) return;
  const n = shotVideoNode(shotId); if (n) await runVideo(n.id);
}

// ---------- 视频 ----------
function needVideo() { if (caps().video) return true; openApi("toapis"); toast("视频生成需要连接 ToAPIs 或 SiliconFlow，已连接的文本平台不受影响", 4600, "err"); return false; }
function shotVideoNode(shotId) {
  const p = project(); const r = p.script.find(x => x.id === shotId); if (!r) return null;
  let n = p.canvas.nodes.find(x => x.type === "video" && x.data.shotId === shotId);
  if (!n) {
    const s = shotNode(p, shotId);
    const maxX = Math.max(...p.canvas.nodes.filter(x => x.type === "shot").map(x => x.x + x.w));
    const i = p.script.findIndex(x => x.id === shotId);
    n = addNode(p, "video", freeSpot(p, { x: maxX + 80 + (i % 3) * 270, y: s ? s.y : 0 }, 240, 460, true), { shotId, prompt: "", model: "auto", ratio: "9:16", duration: 5, imageSize: "720x1280", negativePrompt: "文字，水印，画面闪烁，肢体畸变", status: "", videoUrl: "", requestId: "" });
    ensureStructure(p); touch(p);
  }
  return n;
}
function pollVideo(pid, nid) {
  const key = `${pid}:${nid}`, jk = `v:${pid}:${nid}`; if (polls.has(key)) return;
  const tok = {}; POLL_TOK.set(key, tok);
  const live = () => POLL_TOK.get(key) === tok;
  const stop = () => { clearTimeout(polls.get(key)); polls.delete(key); POLL_TOK.delete(key); };
  const refresh = () => { save(); if (route.view === "project" && route.projectId === pid) renderProject(); };
  const find = () => { const p = state.projects.find(x => x.id === pid); return { p, n: p && nodeOf(p, nid) }; };
  const n0 = find();
  jqStart({ key: jk, kind: "video", label: n0.n ? nodeTitle(n0.p, n0.n) : "视频", pid, nid, poll: true, t0: n0.n?.data.startedAt || n0.n?.data.pollStartedAt, phase: runPhase(n0.n?.data.status), retry: () => runVideo(nid),
    cancel: () => { stop(); const { n } = find(); if (n && RUN.includes(n.data.status)) { n.data.status = "poll_error"; n.data.error = "已停止查询。任务可能还在平台上运行，点「继续查询」取回，不会重复扣费。"; refresh(); } } });
  const lost = n => jqFail(jk, n.data.error, { retry: () => resumeVideo(pid, nid), retryLabel: "继续查询" });
  const tick = async () => {
    if (!live()) return;
    const { p, n } = find();
    if (!n?.data.requestId || !RUN.includes(n.data.status)) { stop(); jqFail(jk, "节点已经不在了或任务被重置", { quiet: true }); return; }
    if (Date.now() - Number(n.data.pollStartedAt || Date.now()) > 30 * 60_000) { n.data.status = "poll_error"; n.data.error = "查询超过 30 分钟。任务可能还在平台上运行，可以点「继续查询」，不会重复扣费。"; stop(); refresh(); lost(n); return; }
    if (document.visibilityState === "hidden") { polls.set(key, setTimeout(tick, 12000)); return; }
    try {
      const d = await postJson("/api/video-status", { requestId: n.data.requestId });
      if (!live()) return;
      const st = /^(succeed|success|completed)$/i.test(d.status) ? "Succeed" : /^(failed|fail|error)$/i.test(d.status) ? "Failed" : /progress/i.test(d.status) ? "InProgress" : "InQueue";
      const changed = st !== n.data.status; n.data.status = st; n.data.pollErrors = 0;
      if (st === "Succeed") { n.data.videoUrl = d?.results?.videos?.[0]?.url || ""; n.data.error = ""; n.data.prevVideoUrl = ""; stop(); refresh(); requestAnimationFrame(() => burstNode(n.id, 16)); jqEnd(jk, "视频已生成"); petEvent("video"); return; }
      if (st === "Failed") { n.data.error = d.reason || "视频生成失败"; if (!n.data.videoUrl && n.data.prevVideoUrl) n.data.videoUrl = n.data.prevVideoUrl; stop(); refresh(); jqFail(jk, n.data.error, { retryLabel: "重新生成" }); return; }
      jqPhase(jk, runPhase(st));
      if (changed) refresh();
    } catch (e) {
      if (!live()) return;
      n.data.pollErrors = (n.data.pollErrors || 0) + 1; n.data.error = e.message;
      if (n.data.pollErrors >= 3) { n.data.status = "poll_error"; stop(); refresh(); lost(n); return; }
      polls.set(key, setTimeout(tick, 5000 * (n.data.pollErrors + 1))); return;
    }
    polls.set(key, setTimeout(tick, 5000));
  };
  polls.set(key, setTimeout(tick, 1200));
}
function resumeVideo(pid, nid) {
  const p = state.projects.find(x => x.id === pid); const n = p && nodeOf(p, nid); if (!n?.data.requestId) return;
  Object.assign(n.data, { status: "InQueue", error: "", pollErrors: 0, pollStartedAt: Date.now() }); touch(p);
  if (route.view === "project" && route.projectId === pid) renderProject();
  pollVideo(pid, nid);
}

// ---------- 导出 ----------
function packText(p, kind) {
  const s = p.style;
  const head = `项目：${p.title}\n选题：${p.topic}\n平台：${p.platform}\n账号：${account(p.accountId)?.name || "未指定"}\n定位：${s.positioning}\n内容类型：${s.contentType}\n受众：${s.audience}\n语气：${s.voice}\n时长节奏：${s.duration}，${s.pace}\n结构：${s.structure}\n画面语言：${s.visual}${(p.cast || []).map(ipById).filter(Boolean).map((ip, i) => `\n出镜 IP${i ? "（配角）" : "（主角）"}：${ip.name}｜${ip.profile.tagline}｜外观：${ipAnchorText(ip)}${ip.profile.catchphrases.length ? `｜口头禅：${ip.profile.catchphrases.join(" / ")}` : ""}${ip.profile.rules.length ? `｜禁忌：${ip.profile.rules.join("；")}` : ""}`).join("")}`;
  const script = p.script.map((r, i) => `镜头 ${i + 1}｜${r.time}\n画面：${r.shot}\n口播：${r.voice}\n字幕：${r.subtitle}\n备注：${r.note}`).join("\n\n");
  return {
    pack: `帧比特 完整内容包\n${head}\n\n【分镜脚本】\n${script}\n\n【标题】\n${p.titles.join("\n")}\n\n【封面字】\n${p.coverWords.join(" / ")}\n\n【封面方案】\n${p.coverPlan}\n\n【发布文案】\n${p.publishCopy}\n\n【审稿】\n${p.review.map(r => `${r.level}：${r.issue} → ${r.fix}`).join("\n")}`,
    shoot: `帧比特 拍摄包\n${head}\n\n${script}`,
    edit: `帧比特 剪辑包\n${head}\n\n${p.script.map((r, i) => `镜头 ${i + 1}｜${r.time}\n画面：${r.shot}\n字幕：${r.subtitle}\n备注：${r.note}`).join("\n\n")}`,
    audit: `帧比特 审核包\n${head}\n风险边界：${s.risk}\n\n${p.review.map(r => `${r.level}\n问题：${r.issue}\n建议：${r.fix}`).join("\n\n") || "尚未审稿"}`,
    publish: `帧比特 发布包\n${head}\n互动：${s.cta}\n\n标题：\n${p.titles.join("\n")}\n\n封面字：${p.coverWords.join(" / ")}\n\n发布文案：\n${p.publishCopy}`
  }[kind];
}
async function doExport(kind) {
  const p = project(); if (!p) return;
  ui.exportOpen = false;
  const names = { pack: "完整内容包", shoot: "拍摄包", edit: "剪辑包", audit: "审核包", publish: "发布包" };
  p.exports = { ...(p.exports || {}), [kind]: now() }; touch(p);
  let ok = true;
  if (names[kind]) { download(`${p.title}-${names[kind]}.txt`, packText(p, kind)); toast(`已导出${names[kind]}`); }
  else if (kind === "cover") { ok = await downloadCover(p) !== false; }
  else if (kind === "edl") {
    const cut = nodeByType(p, "cut"); const clips = cut?.data.clips || [];
    download(`${p.title}-粗剪单.txt`, ["帧比特 粗剪单", `项目：${p.title}`, `导出时间：${new Date().toLocaleString("zh-CN")}`, "", ...(clips.length ? clips.map((c, i) => `${String(i + 1).padStart(2, "0")}  ${c.title}  入 ${Number(c.in).toFixed(1)}s  出 ${Number(c.out).toFixed(1)}s  ${c.url}`) : ["还没有片段。"])].join("\n"));
  } else if (kind === "workflow") download(`${p.title}-画布.json`, JSON.stringify({ project: p.title, exportedAt: now(), canvas: p.canvas }, null, 2), "application/json");
  if (ok) petOnExport(p, kind);
  if (route.view === "project") renderProject();
}
function playCut() {
  const p = project(); const cut = nodeByType(p, "cut"); const clips = cut?.data.clips || []; const v = $("[data-cut-player]");
  if (!v || !clips.length) return;
  let i = 0;
  const next = () => {
    if (i >= clips.length) { v.ontimeupdate = v.onended = null; return; }
    const c = clips[i++]; v.src = c.url; v.load();
    v.onloadedmetadata = () => { v.currentTime = Math.min(Number(c.in || 0), Math.max(0, v.duration - .1)); v.play().catch(() => {}); };
    v.ontimeupdate = () => { if (v.currentTime >= Math.min(Number(c.out || v.duration), v.duration || 5)) next(); };
    v.onended = next;
  };
  next();
}

// ---------- AI 编导 ----------
function localActions(text) {
  const a = (type, target = "", value = "") => ({ type, target, field: "", value, instruction: "" });
  const out = [];
  if (text.length > 16) return out; // 长句交给 AI 编导理解，本地只处理简短的跳转指令
  if (/(全屏|专注).*(画布)|(画布).*(全屏|专注)/.test(text)) out.push(a("fullscreen_canvas"));
  else if (/(切到|切换到|打开|去|回到).*(画布)/.test(text)) out.push(a("mode", "canvas"));
  else if (/(切到|切换到|打开|去|回到).*(流程)/.test(text)) out.push(a("mode", "flow"));
  const st = text.match(/(?:打开|去|跳到|切到|回到)(?:第?\s*\d+\s*步|.*?(选题|风格画像|画像|脚本|画面|成片|标题|包装|审稿|封面|交付))/);
  if (st?.[1]) out.push(a("set_stage", { 选题: "topic", 风格画像: "style", 画像: "style", 脚本: "script", 画面: "visual", 成片: "cut", 标题: "package", 包装: "package", 审稿: "review", 封面: "cover", 交付: "deliver" }[st[1]]));
  const m = text.match(/(?:新增|添加|创建).*(文本|图片|视频|音频|配乐|素材).*节点/);
  if (m) out.push(a("add_node", { 文本: "text", 图片: "image", 视频: "video", 音频: "audio", 配乐: "audio", 素材: "upload" }[m[1]]));
  [[/(打开|回到|去).*(首页)/, "home"], [/(打开|去).*(资料库|账号|DNA)/i, "library"], [/(打开|去).*(设置)/, "settings"]].forEach(([re, t]) => { if (re.test(text)) out.push(a("navigate", t)); });
  return out;
}
function allowed(action, text) {
  const explicit = /(直接|现在|立即).*(改|更新|替换|写入|应用|调整|设置|完善|填|重写|生成|执行)|帮我(改|修改|更新|调整|重写|生成|执行|写|做|起草|填)|请(修改|更新|调整|重写|生成|执行|写|做)/.test(text);
  const advice = /(分析|建议|怎么|如何|应该|先别|不要执行|不要改|只看|评估|看看)/.test(text) && !explicit;
  const mutating = ["update_project", "update_style", "update_script", "update_packaging", "update_account", "create_project", "add_node", "update_node", "connect_nodes", "delete_node", "run_ai", "run_canvas", "sync_timeline", "export"];
  // 3.7：选题本身常带「怎么 / 如何」（比如「主管怎么开第一次周会」），立项先按立项的说法判断，不被当成「只要建议」
  if (action.type === "create_project" && /(新建|创建|立项|开(个|一个|一下)?(新)?(项目|选题))/.test(text)) return true;
  if (advice && mutating.includes(action.type)) return false;
  if (action.type === "delete_node") return /(删除|移除|删掉)/.test(text);
  if (["run_ai", "run_canvas"].includes(action.type)) return /(生成|重写|审稿|运行|制作|出图|做成|起草|写)/.test(text);
  if (action.type === "export") return /(导出|下载)/.test(text);
  if (action.type === "create_project") return /(新建|创建|开).*(项目|选题)/.test(text);
  return true;
}
async function execAction(a, pid) {
  const p = state.projects.find(x => x.id === pid) || project();
  const need = () => { if (!p) throw new Error("没有打开的项目"); };
  const findNode = () => p.canvas.nodes.find(n => n.id === a.target || n.type === a.target);
  switch (a.type) {
    case "navigate": go(["home", "library", "settings"].includes(a.target) ? a.target : "project", p?.id); return "已打开";
    case "set_stage": need(); openStep(stepKey(a.target), { flow: true }); return `已打开「${stepMeta(stepKey(a.target)).name}」`;
    case "select_project": { const t = state.projects.find(x => x.id === a.target || x.title === a.target); if (!t) return "没有找到这个项目"; go("project", t.id); return `已打开「${t.title}」`; }
    case "update_project": need(); if (!["title", "topic", "platform", "brief", "coverMainText", "coverSubText", "coverBackgroundPrompt", "coverPlan", "publishCopy"].includes(a.field)) return "跳过了不支持的字段"; snapshot(p, "AI 编导修改前"); p[a.field] = a.field === "platform" && !PLATFORM_PROFILES[a.value] ? p.platform : a.value; touch(p); return `已更新${a.field}`;
    case "update_style": need(); if (!STYLE_KEYS.includes(a.field)) return "跳过了不支持的画像字段"; snapshot(p, "AI 编导修改画像前"); p.style[a.field] = a.value; p.styleSavedAt = ""; ensureStructure(p); touch(p); return `已更新画像：${STYLE_FIELDS.find(([k]) => k === a.field)[1]}`;
    case "update_script": { need(); let rows; try { rows = JSON.parse(a.value || "[]"); } catch (_) { return "分镜格式不对"; } if (!Array.isArray(rows) || !rows.length) return "没有可用的分镜"; snapshot(p, "AI 编导修改脚本前"); applyScript(p, rows); ensureStructure(p); touch(p); return `已更新 ${p.script.length} 镜`; }
    case "update_packaging": { need(); let v; try { v = JSON.parse(a.value || "{}"); } catch (_) { return "包装格式不对"; } snapshot(p, "AI 编导修改包装前"); if (Array.isArray(v.titles)) p.titles = v.titles.map(String); if (Array.isArray(v.coverWords)) p.coverWords = v.coverWords.map(String); if (typeof v.publishCopy === "string") p.publishCopy = v.publishCopy; if (typeof v.coverPlan === "string") p.coverPlan = v.coverPlan; ensureStructure(p); touch(p); return "已更新发布物料"; }
    case "update_account": { const acc = account(p?.accountId); if (!acc || !ACCOUNT_FIELDS.some(([k]) => k === a.field)) return "这个项目没有指定账号，或字段不支持"; acc[a.field] = a.value; save(); return "已更新账号 DNA"; }
    case "create_project": { let v = {}; try { v = JSON.parse(a.value || "{}"); } catch (_) {} const topic = String(v.topic || v.title || "").trim(); if (!topic) return "缺少选题"; const np = createProject(topic, v.platform, ""); return `已新建「${np.title}」`; }
    case "add_node": { need(); const t = { note: "text", upload: "image", prompt: "text", music: "audio" }[a.target] || a.target; if (![...FREE_TYPES, "cut"].includes(t)) return "不支持的节点"; if (t === "cut") { ensureStructure(p, "cut"); touch(p); return "已显示成片节点"; } if (p.view.mode !== "canvas") { p.view.mode = "canvas"; save(); } addFreeNode(t); return `已添加${FREE_LABEL[t]}节点`; }
    case "update_node": { need(); const n = findNode(); if (!n || !["text", "prompt", "model", "imageSize", "negativePrompt", "ratio", "duration", "title"].includes(a.field)) return "没有找到可修改的节点或字段"; if (a.field === "title") n.title = String(a.value).slice(0, 40); else n.data[a.field] = a.value; touch(p); return "已修改节点"; }
    case "connect_nodes": { need(); let v; try { v = JSON.parse(a.value || "{}"); } catch (_) { return "连线格式不对"; } const f = p.canvas.nodes.find(n => n.id === v.from || n.type === v.from), t = p.canvas.nodes.find(n => n.id === v.to || n.type === v.to); if (!f || !t) return "没有找到要连接的节点"; connect(p, f, t); return "已连接"; }
    case "delete_node": need(); deleteNode(p, a.target); return "已删除";
    case "run_ai": need(); if (a.target === "style") { await aiStyle(); return "已起草风格画像"; } await generate(["full", "script", "packaging", "review"].includes(a.target) ? a.target : "full", a.instruction || ""); return "已运行";
    case "run_canvas": {
      need(); const idx = Number(a.value) - 1; const row = Number.isInteger(idx) && idx >= 0 ? p.script[idx] : null;
      if (a.target === "audio") { const n = nodeOf(p, ui.sel)?.type === "audio" ? nodeOf(p, ui.sel) : p.canvas.nodes.find(x => x.type === "audio"); if (!n) return "还没有音频节点"; await runAudio(n.id); return "已提交配乐任务"; }
      if (a.target === "video") { const n = row ? shotVideoNode(row.id) : (nodeOf(p, ui.sel)?.type === "video" ? nodeOf(p, ui.sel) : p.canvas.nodes.find(x => x.type === "video")); if (!n) return "还没有视频节点"; await runVideo(n.id); return "已提交视频任务"; }
      if (row) { await shotImage(row.id); return `已为分镜 ${idx + 1} 生成画面`; }
      const n = nodeOf(p, ui.sel)?.type === "image" ? nodeOf(p, ui.sel) : p.canvas.nodes.find(x => x.type === "image"); if (!n) return "还没有图片节点"; await runImage(n.id); return "已生成图片";
    }
    case "sync_timeline": { need(); const r = syncCut(p); return r.total ? `已排入 ${r.added} 段` : "还没有生成好的视频"; }
    case "mode": need(); setMode(a.target === "canvas" ? "canvas" : "flow"); return a.target === "canvas" ? "已切到画布" : "已切到流程";
    case "fullscreen_canvas": ui.panels = { left: false, right: false }; if (route.view === "project") setMode("canvas"); return "已切到画布并收起两侧面板";
    case "export": need(); await doExport({ pack: "pack", shoot: "shoot", edit: "edit", audit: "audit", publish: "publish", cover: "cover", workflow: "workflow", edl: "edl" }[a.target] || "pack"); return "已导出";
    default: return "跳过了未知动作";
  }
}
async function askDirector(text, opts = {}) {
  text = String(text || "").trim(); if (!text || directorBusy) return;
  const p = project(); if (!p) return;
  p.chat.push({ role: "user", content: text, time: now() }); if (p.chat.length > 80) p.chat.splice(0, p.chat.length - 80);
  touch(p); renderProject();
  const local = localActions(text);
  if (local.length) {
    const msg = { role: "assistant", content: "好的。", time: now(), results: [] }; p.chat.push(msg);
    for (const a of local) msg.results.push(await execAction(a, p.id));
    touch(p); if (route.view === "project") renderProject(); return;
  }
  if (!apiState.connected) { p.chat.push({ role: "assistant", content: "现在我可以帮你开关面板、添加节点、跳转页面。要写脚本、改内容或审稿，预览版没有接入模型，AI 写作请用帧比特 Mac App。", time: now() }); touch(p); renderProject(); return; }
  directorBusy = true; renderProject();
  try {
    const ctx = { ...serverProject(p), outline: outline(p).map(s => ({ step: s.key, name: s.name, done: s.done, status: s.st })), canvas: { nodes: p.canvas.nodes.map(n => ({ id: n.id, type: n.type, shot: n.type === "shot" ? p.script.findIndex(r => r.id === n.data.shotId) + 1 : undefined, hasImage: Boolean(nodeImage(p, n)), hasVideo: Boolean(nodeVideo(n)), status: n.data.status || "" })) }, availableProjects: state.projects.map(x => ({ id: x.id, title: x.title })), directorConversation: p.chat.slice(-12).map(m => ({ role: m.role, content: m.content })), petMode: Boolean(opts.pet) };
    const d = await postJson("/api/director", { project: ctx, account: account(p.accountId) || {}, instruction: text });
    const r = d.result || {};
    const msg = { role: "assistant", content: r.reply || "明白。", time: now(), results: [], model: d.model || "" };
    p.chat.push(msg); directorBusy = false; touch(p); renderProject();
    for (const a of (r.actions || [])) { msg.results.push(allowed(a, text) ? await execAction(a, p.id) : `没有明确要求，跳过了：${a.type}`); touch(p); }
    if (route.view === "project") renderProject();
  } catch (e) { directorBusy = false; p.chat.push({ role: "assistant", content: `这次没有完成：${e.message}`, time: now() }); touch(p); renderProject(); }
}
