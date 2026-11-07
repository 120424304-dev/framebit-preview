"use strict";
// 帧比特 3.4 · 画布生成：图片 / 视频 / 音频节点生成，文本润色、提示词扩写、拆分镜头
// 每类任务走设置里「模型分配」对应的功能区：画布文本 / 画布生图 / 画布生视频 / 画布配乐

const slimProject = p => ({ title: p.title, topic: p.topic, platform: p.platform, styleProfile: { visual: p.style.visual, voice: p.style.voice, pace: p.style.pace }, cast: castPayload(p) });
function needAudio() { if (caps().audio) return true; openApi("toapis"); toast("配乐生成需要连接 ToAPIs（Suno），已连接的其他平台不受影响", 4600, "err"); return false; }
const nodeNow = (pid, nid) => { const p = state.projects.find(x => x.id === pid); return { p, n: p && nodeOf(p, nid) }; };
function canvasDone(p, n, ok) { if (!canvasRefresh(p, n.id) && route.view === "project" && route.projectId === p.id) renderProject(); if (ok) requestAnimationFrame(() => burstNode(n.id, 16)); }

// 统一入口：⌘Enter 或面板上的「生成」
async function cnRun(id) {
  const p = project(); const n = nodeOf(p, id); if (!n) return;
  if (n.type === "image") return runImage(id);
  if (n.type === "video") return runVideo(id);
  if (n.type === "audio") return runAudio(id);
  if (n.type === "text") return cnPolish(id);
  if (n.type === "shot") return shotImage(n.data.shotId);
  if (n.type === "remake") return rmRun(rmContext(p, n));
}
async function cnRunMany(ids) {
  const p = project(); const list = ids.map(id => nodeOf(p, id)).filter(n => n && ["image", "video", "audio"].includes(n.type) && !isRunning(p, n));
  if (!list.length) return toast("选中的节点都在生成中");
  toast(`开始生成 ${list.length} 个节点`, 2200);
  let i = 0; const worker = async () => { while (i < list.length) { const n = list[i++]; await cnRun(n.id); } };
  await Promise.all([worker(), worker()]);
}

// ---------- 图片 ----------
async function runImage(nodeId) {
  if (!needImage()) return;
  const p = project(); let n = nodeOf(p, nodeId); if (!n || n.type !== "image") return;
  const key = `img:${nodeId}`; if (jobs.has(key)) return;
  const c = contextOf(p, n);
  const own = (n.data.prompt || "").trim();
  const inj = ipInject(p, [own, ...c.texts].filter(Boolean).join("\n"));
  const prompt = inj.prompt; c.refs = [...new Set([...c.refs, ...inj.refs])];
  if (!prompt && !c.refs.length) { toast("先写提示词，或连一个文本节点进来", 3000, "err"); $(".cv-layer .cf [data-cf]")?.focus(); return; }
  jobs.add(key);
  const j = jqStart({ key: `img:${p.id}:${n.id}`, kind: "image", label: nodeTitle(p, n), pid: p.id, nid: n.id, phase: "等模型出图", retry: () => runImage(nodeId) });
  Object.assign(n.data, { status: "generating", error: "", startedAt: j.t0 }); canvasDone(p, n);
  try {
    const d = await postJson("/api/image", { area: "image.canvas", prompt: prompt || "保持参考图的主体与风格，重新构图", ratio: ratioOf(n), count: Number(n.data.count) || 1, resolution: n.data.resolution || "", refs: c.refs, requestedModel: n.data.model || "auto", topic: p.topic }, { signal: j.signal });
    n = nodeOf(p, nodeId) || n; // 等待期间撤销 / 重做过：结果写进现在画布上的那个节点
    if (d.partial) toast(d.partial, 3600, "err");
    const imgs = (d.images?.length ? d.images : [d.imageUrl]).filter(Boolean);
    n.data.images = [...imgs, ...(n.data.images || []).filter(u => !imgs.includes(u))].slice(0, 12);
    Object.assign(n.data, { pick: 0, imageUrl: n.data.images[0] || "", status: "done", modelUsed: d.model, error: "" });
    touch(p); jqEnd(j, `生成了 ${imgs.length} 张 · ${d.model}`); petEvent("image", imgs.length);
    canvasDone(p, n, true);
  } catch (e) { n = nodeOf(p, nodeId) || n; n.data.status = ""; n.data.error = jqFail(j, e) ? "" : e.message; touch(p); canvasDone(p, n); }
  finally { jobs.delete(key); }
}

// ---------- 视频（分镜视频也走这里：分镜的视频节点用「分镜视频」功能区） ----------
async function runVideo(nodeId) {
  if (!needVideo()) return;
  const p = project(); const n = nodeOf(p, nodeId); if (!n) return;
  if (RUN.includes(n.data.status)) return toast("这个视频已经在生成");
  const c = contextOf(p, n);
  const ratio = ratioOf(n);
  const j = jqStart({ key: `v:${p.id}:${n.id}`, kind: "video", label: nodeTitle(p, n), pid: p.id, nid: n.id, phase: "提交中", retry: () => runVideo(nodeId) });
  n.data.status = "submitting"; n.data.error = ""; n.data.startedAt = j.t0;
  if (n.data.source === "upload") delete n.data.source;
  const prev = n.data.videoUrl; n.data.videoUrl = "";
  canvasDone(p, n); if (p.view.mode !== "canvas") renderProject();
  try {
    const d = await postJson("/api/video-submit", {
      area: n.data.shotId ? "video.shot" : "video.canvas",
      requestedModel: n.data.model || "auto", prompt: ipInject(p, promptFor(p, n)).prompt, negativePrompt: n.data.negativePrompt,
      ratio, duration: Number(n.data.duration) || 5, imageSize: RATIO_SIZE[ratio] || n.data.imageSize || "720x1280",
      resolution: n.data.resolution || "", audio: n.data.audio !== false,
      ...ipVideoFrames(p, n, c)
    }, { signal: j.signal });
    Object.assign(n.data, { requestId: d.requestId, status: d.status || "InQueue", modelUsed: d.model, pollStartedAt: Date.now(), pollErrors: 0, prevVideoUrl: prev || "" });
    touch(p); canvasDone(p, n); if (p.view.mode !== "canvas") renderProject();
    toast("视频任务已提交，生成完会自动存进这个浏览器", 4000);
    pollVideo(p.id, n.id);
  } catch (e) { n.data.status = ""; n.data.error = jqFail(j, e) ? "" : e.message; n.data.videoUrl = prev || ""; touch(p); canvasDone(p, n); if (p.view.mode !== "canvas") renderProject(); }
}

// IP 角色节点连进视频：没有别的上游图片、模型支持参考图时，把定妆照和三视图作为参考图；否则只用文字锚点
function ipVideoFrames(p, n, c) {
  const base = { frameMode: n.data.frameMode || "auto", image: c.refs[0] || "", lastImage: n.data.shotId ? "" : (c.refs[1] || ""), images: n.data.shotId ? c.refs.slice(0, 1) : c.refs };
  const ipr = c.ipRefs || []; if (!ipr.length || c.refs.length || n.data.shotId) return base;
  const spec = specFor("video", n); if (!spec?.frames?.includes("refs")) return base;
  return { frameMode: "refs", image: "", lastImage: "", images: ipr.slice(0, spec.maxRefs || 4) };
}

// ---------- 音频 ----------
async function runAudio(nodeId) {
  if (!needAudio()) return;
  const p = project(); const n = nodeOf(p, nodeId); if (!n || n.type !== "audio") return;
  if (RUN.includes(n.data.status)) return toast("这段配乐已经在生成");
  const c = contextOf(p, n);
  const prompt = [(n.data.prompt || "").trim(), ...c.texts].filter(Boolean).join("；").slice(0, 400);
  if (!prompt) { toast("先写一句配乐描述，或连一个文本节点进来", 3000, "err"); $(".cv-layer .cf [data-cf]")?.focus(); return; }
  const j = jqStart({ key: `a:${p.id}:${n.id}`, kind: "audio", label: nodeTitle(p, n), pid: p.id, nid: n.id, phase: "提交中", retry: () => runAudio(nodeId) });
  Object.assign(n.data, { status: "submitting", error: "", startedAt: j.t0 }); canvasDone(p, n);
  try {
    const instrumental = !(n.data.instrumental === false || n.data.instrumental === "0");
    const d = await postJson("/api/audio-submit", { prompt, instrumental, version: n.data.version || "v6", requestedModel: n.data.model || "auto" }, { signal: j.signal });
    Object.assign(n.data, { requestId: d.requestId, status: d.status || "InQueue", modelUsed: d.model, pollStartedAt: Date.now(), pollErrors: 0 });
    touch(p); canvasDone(p, n); toast("配乐任务已提交，通常 1–3 分钟", 3600);
    pollAudio(p.id, n.id);
  } catch (e) { n.data.status = ""; n.data.error = jqFail(j, e) ? "" : e.message; touch(p); canvasDone(p, n); }
}
function pollAudio(pid, nid) {
  const key = `a:${pid}:${nid}`; if (polls.has(key)) return;
  const tok = {}; POLL_TOK.set(key, tok);
  const live = () => POLL_TOK.get(key) === tok;
  const stop = () => { clearTimeout(polls.get(key)); polls.delete(key); POLL_TOK.delete(key); };
  const n0 = nodeNow(pid, nid);
  jqStart({ key, kind: "audio", label: n0.n ? nodeTitle(n0.p, n0.n) : "配乐", pid, nid, poll: true, t0: n0.n?.data.startedAt || n0.n?.data.pollStartedAt, phase: runPhase(n0.n?.data.status), retry: () => runAudio(nid),
    cancel: () => { stop(); const { p, n } = nodeNow(pid, nid); if (n && RUN.includes(n.data.status)) { n.data.status = "poll_error"; n.data.error = "已停止查询。任务可能还在平台上运行，点「继续查询」取回，不会重复扣费。"; save(); canvasDone(p, n); } } });
  const lost = (p, n) => jqFail(key, n.data.error, { retry: () => resumeAudio(pid, nid), retryLabel: "继续查询" });
  const tick = async () => {
    if (!live()) return;
    const { p, n } = nodeNow(pid, nid);
    if (!n?.data.requestId || !RUN.includes(n.data.status)) { stop(); jqFail(key, "节点已经不在了或任务被重置", { quiet: true }); return; }
    if (Date.now() - Number(n.data.pollStartedAt || Date.now()) > 20 * 60_000) { n.data.status = "poll_error"; n.data.error = "查询超过 20 分钟。任务可能还在平台上运行，可以点「继续查询」。"; stop(); save(); canvasDone(p, n); lost(p, n); return; }
    if (document.visibilityState === "hidden") { polls.set(key, setTimeout(tick, 12000)); return; }
    try {
      const d = await postJson("/api/audio-status", { requestId: n.data.requestId });
      if (!live()) return;
      const st = /^(succeed|success|completed)$/i.test(d.status) ? "Succeed" : /^(failed|fail|error)$/i.test(d.status) ? "Failed" : /progress/i.test(d.status) ? "InProgress" : "InQueue";
      const changed = st !== n.data.status; n.data.status = st; n.data.pollErrors = 0;
      if (st === "Succeed") { n.data.tracks = d.tracks || []; n.data.track = 0; n.data.audioUrl = n.data.tracks[0]?.url || ""; n.data.error = ""; stop(); save(); canvasDone(p, n, true); jqEnd(key, "配乐已生成"); petEvent("audio"); return; }
      if (st === "Failed") { n.data.error = d.reason || "配乐生成失败"; stop(); save(); canvasDone(p, n); jqFail(key, n.data.error, { retryLabel: "重新生成" }); return; }
      jqPhase(key, runPhase(st));
      if (changed) { save(); canvasDone(p, n); }
    } catch (e) {
      if (!live()) return;
      n.data.pollErrors = (n.data.pollErrors || 0) + 1; n.data.error = e.message;
      if (n.data.pollErrors >= 3) { n.data.status = "poll_error"; stop(); save(); canvasDone(p, n); lost(p, n); return; }
      polls.set(key, setTimeout(tick, 5000 * (n.data.pollErrors + 1))); return;
    }
    polls.set(key, setTimeout(tick, 5000));
  };
  polls.set(key, setTimeout(tick, 1500));
}
function resumeAudio(pid, nid) {
  const { p, n } = nodeNow(pid, nid); if (!n?.data.requestId) return;
  Object.assign(n.data, { status: "InQueue", error: "", pollErrors: 0, pollStartedAt: Date.now() }); touch(p); canvasDone(p, n);
  if (route.view === "project" && route.projectId === pid) renderComposer();
  pollAudio(pid, nid);
}
function playAudio(id) {
  const el = $(`[data-node="${CSS.escape(id)}"] audio`); const btn = $(`[data-node="${CSS.escape(id)}"] .cn-play`); if (!el || !btn) return;
  $$(".cnode audio").forEach(a => { if (a !== el && !a.paused) { a.pause(); a.closest(".cnode")?.classList.remove("playing"); } });
  const card = el.closest(".cnode");
  if (el.paused) {
    el.play().catch(() => toast("这个音频无法播放", 3000, "err"));
    card.classList.add("playing"); btn.innerHTML = icon("pause");
    const dur = card.querySelector("[data-dur]");
    el.ontimeupdate = () => { const f = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`; if (dur) dur.textContent = `${f(el.currentTime)} / ${f(el.duration || 0)}`; card.style.setProperty("--played", `${(el.currentTime / (el.duration || 1)) * 100}%`); };
    el.onended = () => { card.classList.remove("playing"); btn.innerHTML = icon("play"); };
  } else { el.pause(); card.classList.remove("playing"); btn.innerHTML = icon("play"); }
}

// ---------- 文本：润色、扩写提示词、拆分镜头 ----------
async function canvasText(action, selectedText, instruction, signal) {
  const p = project();
  const d = await postJson("/api/generate", { action, area: "text.canvas", project: slimProject(p), account: account(p.accountId) || {}, selectedText, instruction }, { signal });
  return d;
}
// 任务回来时你可能已经去了别的项目：只在还看着这个项目时刷新输入框
function cnComposerIf(p) { if (route.view === "project" && route.projectId === p.id && p.view.mode === "canvas") renderComposer(); }
async function cnPolish(id) {
  if (!needText()) return;
  const p = project(); let n = nodeOf(p, id); if (!n || n.type !== "text") return;
  const text = (n.data.text || "").trim(); if (!text) { toast("先写几句，再让 AI 润色", 2600, "err"); $(".cv-layer .cf [data-cf]")?.focus(); return; }
  const c = contextOf(p, n);
  const j = jqStart({ key: `txt:${p.id}:${n.id}`, kind: "text", label: `${nodeTitle(p, n)} · 润色`, pid: p.id, nid: n.id, retry: () => cnPolish(id) });
  Object.assign(n.data, { status: "generating", error: "", startedAt: j.t0 }); canvasDone(p, n); renderComposer();
  try {
    const d = await canvasText("canvas_polish", text, c.texts.length ? `参考上游：${c.texts.join("；").slice(0, 600)}` : "", j.signal);
    n = nodeOf(p, id) || n;
    const out = String(d.result?.text || "").trim(); if (!out) throw new Error("模型没有返回润色结果");
    Object.assign(n.data, { prevText: n.data.text, text: out, status: "", modelUsed: d.model });
    touch(p); jqEnd(j, `已润色 · ${d.model}`); canvasDone(p, n, true); cnComposerIf(p); petEvent("text");
  } catch (e) { n = nodeOf(p, id) || n; n.data.status = ""; n.data.error = jqFail(j, e) ? "" : e.message; touch(p); canvasDone(p, n); cnComposerIf(p); }
}
async function cnEnhance(id) {
  if (!needText()) return;
  const p = project(); const n = nodeOf(p, id); if (!n || !["image", "video", "audio"].includes(n.type)) return;
  const c = contextOf(p, n);
  const btn = $(`.cv-layer [data-act="cn-enhance"]`); busy(btn, true, "写作中");
  const j = jqStart({ key: `enh:${p.id}:${n.id}`, kind: "text", label: `${nodeTitle(p, n)} · 写提示词`, pid: p.id, nid: n.id, retry: () => cnEnhance(id) });
  try {
    const kind = { image: "图片生成", video: "视频生成", audio: "音乐配乐生成" }[n.type];
    const d = await canvasText("canvas_prompt", n.data.prompt || "", `${kind}。${c.texts.length ? `上游文字：${c.texts.join("；").slice(0, 800)}。` : ""}${c.refs.length ? "有上游参考图，提示词要和参考图一致。" : ""}项目画面语言：${p.style.visual || "未设置"}`, j.signal);
    const out = String(d.result?.prompt || "").trim(); if (!out) throw new Error("模型没有返回提示词");
    const ta = $(".cv-layer .cf [data-field='prompt']");
    n.data.prompt = out; touch(p);
    if (ta) { ta.value = out; ta.classList.remove("flash"); void ta.offsetWidth; ta.classList.add("flash"); }
    jqEnd(j, `提示词已写好 · ${d.model}`);
  } catch (e) { jqFail(j, e); }
  finally { busy(btn, false); }
}
// 0.1.2 的「拆分镜头」：一段文字 → 若干图片节点，按网格排开并从文本节点连出
async function cnSplit(id) {
  if (!needText()) return;
  const p = project(); let n = nodeOf(p, id); if (!n || n.type !== "text") return;
  const text = (n.data.text || "").trim(); if (!text) { toast("先写一段创意或脚本，再拆分镜头", 2800, "err"); $(".cv-layer .cf [data-cf]")?.focus(); return; }
  const j = jqStart({ key: `split:${p.id}:${n.id}`, kind: "text", label: `${nodeTitle(p, n)} · 拆分镜头`, pid: p.id, nid: n.id, retry: () => cnSplit(id) });
  Object.assign(n.data, { status: "generating", error: "", startedAt: j.t0 }); canvasDone(p, n); renderComposer();
  try {
    const d = await canvasText("canvas_split", text, "", j.signal);
    n = nodeOf(p, id) || n;
    const shots = (d.result?.shots || []).filter(s => s && s.prompt).slice(0, 12);
    if (!shots.length) throw new Error("模型没有拆出镜头，换个说法再试");
    n.data.status = "";
    const made = layoutShots(p, n, shots);
    touch(p);
    if (route.view === "project" && route.projectId === p.id) { setSel(made.map(x => x.id), made[0].id); renderProject(); requestAnimationFrame(() => { fitCanvas(p, true, true, [n, ...made]); made.forEach((m, i) => setTimeout(() => burstNode(m.id, 6), 80 * i)); }); }
    jqEnd(j, `拆成 ${made.length} 个镜头${route.projectId === p.id ? `，已全部选中，可以直接「生成 ${made.length} 个」` : ""}`, { ms: 4200 }); petEvent("text");
  } catch (e) { n = nodeOf(p, id) || n; n.data.status = ""; n.data.error = jqFail(j, e) ? "" : e.message; touch(p); canvasDone(p, n); cnComposerIf(p); }
}
function layoutShots(p, from, shots) {
  const cols = shots.length <= 4 ? 2 : 3;
  const b = boxOf(from);
  const w = nodeWidth({ type: "image", data: { ratio: "9:16" } });
  const gw = cols * (w + 48), gh = Math.ceil(shots.length / cols) * 470;
  const { x: x0, y: y0 } = freeRect(p, b.x + b.w + 120, b.y - 40, gw, gh);
  return shots.map((s, i) => {
    const title = `${String(i + 1).padStart(2, "0")} ${String(s.name || "镜头").slice(0, 10)}${s.size ? ` · ${String(s.size).slice(0, 4)}` : ""}`;
    const node = addNode(p, "image", { x: x0 + (i % cols) * (w + 48), y: y0 + Math.floor(i / cols) * 470 }, { prompt: [s.prompt, s.camera && `运镜：${s.camera}`].filter(Boolean).join("，"), ratio: "9:16" }, title);
    p.canvas.edges.push({ id: uid("edge"), from: from.id, to: node.id });
    return node;
  });
}
