"use strict";
// 帧比特 3.5 · 拆解复刻：拆一支成片的结构、节奏和镜头语言，再按新需求复刻。
// 画布里是「拆解复刻」节点；流程里是分镜脚本页下的附加项。抽帧和切镜检测都在本机浏览器里完成，
// 只把十来张关键帧和切点信息交给模型；不支持读图的模型会退回到按文字拆解。

const REMAKE = { busy: 0 };
const RM_BLANK = () => ({ videoUrl: "", name: "", desc: "", request: "", frames: [], cuts: [], duration: 0, breakdown: null, result: null, status: "", stage: "", progress: 0, error: "", model: "", output: "canvas" });
Object.assign(NODE_W, { remake: 320 });
FREE_TYPES.push("remake");
Object.assign(FREE_LABEL, { remake: "拆解复刻" });
Object.assign(TYPE_TAG, { remake: "REMAKE" });
Object.assign(TYPE_HINT, { remake: "拆解一支成片，再按需求复刻" });
Object.assign(BASES, { remake: RM_BLANK });
Object.assign(MAP_COLOR, { remake: "#FFD23F" });
OUT_OK.remake = ["text", "image", "video"];
OUT_OK.video = [...new Set([...(OUT_OK.video || []), "remake"])];
OUT_OK.image = [...new Set([...(OUT_OK.image || []), "remake"])];
OUT_OK.text = [...new Set([...(OUT_OK.text || []), "remake"])];
MENU_ORDER.remake = ["image", "text", "video"];
MENU_ORDER.video = ["remake"];
IN_TYPES.push("remake");
TAU.remake = 30;

// ---------- 抽帧 + 切镜检测（在浏览器里完成） ----------
async function rmExtract(url, onProg = () => {}) {
  const v = document.createElement("video"); v.muted = true; v.preload = "auto"; v.playsInline = true; v.src = url;
  await new Promise((res, rej) => { const to = setTimeout(() => rej(new Error("读取视频超时")), 20000); v.onloadeddata = () => { clearTimeout(to); res(); }; v.onerror = () => { clearTimeout(to); rej(new Error("这个视频在应用里解不开，换一个 MP4（H.264）试试")); }; });
  const dur = v.duration; if (!isFinite(dur) || dur <= 0) throw new Error("读不到视频时长");
  const seek = t => new Promise(res => { let done = false; const fin = () => { if (done) return; done = true; v.removeEventListener("seeked", fin); res(); }; v.addEventListener("seeked", fin); v.currentTime = clamp(t, 0, Math.max(0, dur - .05)); setTimeout(fin, 1800); });
  const sc = document.createElement("canvas"); sc.width = 24; sc.height = 24; const sg = sc.getContext("2d", { willReadFrequently: true });
  const N = clamp(Math.round(dur * 3), 20, 120), step = dur / N;
  const sig = () => { sg.drawImage(v, 0, 0, 24, 24); const d = sg.getImageData(0, 0, 24, 24).data; const out = new Float32Array(6 * 6 * 3); for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) { const i = (y * 24 + x) * 4, c = (Math.floor(y / 4) * 6 + Math.floor(x / 4)) * 3; out[c] += d[i]; out[c + 1] += d[i + 1]; out[c + 2] += d[i + 2]; } for (let k = 0; k < out.length; k++) out[k] /= 16 * 255; return out; };
  const diffs = []; let prev = null;
  for (let i = 0; i < N; i++) {
    const t = i * step + step / 2; await seek(t); const cur = sig();
    let d = 0; if (prev) { for (let k = 0; k < cur.length; k++) d += Math.abs(cur[k] - prev[k]); d /= cur.length; }
    diffs.push({ t, d }); prev = cur; onProg((i + 1) / N * .72);
  }
  const vals = diffs.slice(1).map(x => x.d); const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1); const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length || 1));
  const thr = Math.max(.085, mean + 1.5 * sd); const cuts = []; let last = 0;
  diffs.forEach(x => { if (x.d > thr && x.t - last >= .6) { const c = +(x.t - step / 2).toFixed(2); if (c > .3 && c < dur - .3) { cuts.push(c); last = x.t; } } });
  const bounds = [0, ...cuts, dur]; let times = bounds.slice(0, -1).map((a, i) => (a + bounds[i + 1]) / 2);
  if (times.length > 12) times = Array.from({ length: 12 }, (_, i) => times[Math.round(i * (times.length - 1) / 11)]);
  if (times.length < 6) { const extra = Array.from({ length: 8 }, (_, i) => (i + .5) * dur / 8); times = [...new Set([...times, ...extra].map(t => +t.toFixed(2)))].sort((a, b) => a - b).slice(0, 10); }
  const big = document.createElement("canvas"); const W = 360; big.width = W; big.height = Math.round(W * (v.videoHeight || 640) / (v.videoWidth || 360)); const bg = big.getContext("2d");
  const frames = [];
  for (let i = 0; i < times.length; i++) { await seek(times[i]); bg.drawImage(v, 0, 0, big.width, big.height); frames.push({ t: +times[i].toFixed(2), dataUrl: big.toDataURL("image/jpeg", .72) }); onProg(.72 + (i + 1) / times.length * .28); }
  v.removeAttribute("src"); v.load();
  return { duration: +dur.toFixed(2), cuts, frames, w: v.videoWidth, h: v.videoHeight };
}
async function urlToDataUrl(url) { const b = await (await fetch(url)).blob(); return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); }); }
// 把图片缩到 360 宽的 JPEG，减小请求体
async function shrinkImage(url) {
  const img = new Image(); img.src = url; await img.decode();
  const c = document.createElement("canvas"); const W = Math.min(360, img.naturalWidth || 360); c.width = W; c.height = Math.round(W * (img.naturalHeight || 1) / (img.naturalWidth || 1));
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", .72);
}
const fmtSec = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}${s % 1 >= .05 ? `.${Math.round((s % 1) * 10)}` : ""}`;

// ---------- 输入：画布节点或流程附加项 ----------
function rmContext(p, n) {
  if (!n) { p.remake = { ...RM_BLANK(), ...(p.remake || {}) }; return { p, t: p.remake, node: null, video: p.remake.videoUrl, refs: [], texts: [] }; }
  const c = contextOf(p, n);
  const upVideo = c.from.map(u => nodeVideo(u)).find(Boolean) || "";
  return { p, t: n.data, node: n, video: n.data.videoUrl || upVideo, refs: c.refs, texts: c.texts };
}
function rmRefresh(ctx) {
  const { p, node } = ctx;
  if (route.view !== "project" || route.projectId !== p.id) return;
  if (node) { canvasRefresh(p, node.id); if (isSel(node.id)) renderComposer(); if (ui.tab === "props" && ui.sel === node.id) { const body = $(".panel-body"); if (body) body.innerHTML = renderProps(p, node); } }
  else if (p.view.mode === "flow" && curStep(p) === "script") { const box = $("[data-rm-box]"); if (box) { box.outerHTML = rmFlowBlock(p); ddEnhance($("[data-rm-box]")); } else renderProject(); }
}
function rmInfoText(ctx) {
  const t = ctx.t;
  const lines = [];
  if (t.name) lines.push(`文件：${t.name}`);
  if (t.duration) lines.push(`时长：${t.duration} 秒`);
  if (t.cuts?.length || t.duration) lines.push(`检测到的镜头切换（秒）：${t.cuts?.length ? t.cuts.join("、") : "没有明显切换，可能是一镜到底"}`);
  if (t.frames?.length) lines.push(`关键帧时间点（秒，与图片顺序一致）：${t.frames.map(f => f.t).join("、")}`);
  if (t.desc) lines.push(`用户对原片的描述：${t.desc}`);
  if (ctx.texts.length) lines.push(`上游文字：${ctx.texts.join("；").slice(0, 800)}`);
  return lines.join("\n") || "（没有提供视频，只有文字描述）";
}
function rmBreakdownText(b) {
  if (!b) return "";
  return [`标题：${b.title}`, `概述：${b.summary}`, `钩子：${b.hook}`, `结构：${(b.structure || []).map(s => `${s.part}（${s.time}）${s.purpose}`).join(" → ")}`, `节奏：${b.rhythm}`, `画面：${b.visual}`, `声音：${b.audio}`, `逐镜：\n${(b.shots || []).map((s, i) => `${i + 1}. [${s.time}] ${s.shot}｜${s.camera}｜口播：${s.voice}｜字幕：${s.subtitle}｜作用：${s.purpose}`).join("\n")}`, `可借鉴：${(b.techniques || []).join("；")}`, `注意：${(b.cautions || []).join("；")}`].join("\n");
}

// ---------- 第一步：拆解 ----------
async function rmBreakdown(ctx) {
  if (!needText()) return false;
  const { p, t } = ctx;
  if (!ctx.video && !t.desc && !ctx.refs.length && !ctx.texts.length) { toast("先上传一支成片，或者写一句原片是什么", 3200, "err"); return false; }
  if (t.status) return false;
  REMAKE.busy++; t.error = "";
  const rj = { key: `rm1:${p.id}:${ctx.node?.id || "flow"}`, kind: "remake", label: "拆解原片", pid: p.id, nid: ctx.node?.id || "", phase: "读取画面", retry: () => rmBreakdown(rmContext(p, ctx.node ? nodeOf(p, ctx.node.id) : null)) };
  const j = jqStart(rj); t.startedAt = j.t0;
  try {
    let images = [];
    if (ctx.video && (!t.frames?.length || t.framesOf !== ctx.video)) {
      Object.assign(t, { status: "generating", stage: "读取画面、找切点", progress: 0 }); rmRefresh(ctx);
      try {
        let lastP = 0;
        const r = await rmExtract(ctx.video, k => { t.progress = k; if (k - lastP > .08) { lastP = k; const bar = $(`[data-rm-prog]`); if (bar) bar.style.width = `${Math.round(k * 100)}%`; } });
        t.stage = "保存关键帧"; rmRefresh(ctx);
        const saved = [];
        for (const f of r.frames) { try { const d = await postJson("/api/assets", { name: "remake-frame.jpg", dataUrl: f.dataUrl }); saved.push({ t: f.t, url: d.assetUrl }); } catch (_) { saved.push({ t: f.t, url: "" }); } }
        Object.assign(t, { duration: r.duration, cuts: r.cuts, frames: saved.filter(f => f.url), framesOf: ctx.video, ratio: r.w && r.h ? (r.w > r.h ? "16:9" : r.w === r.h ? "1:1" : "9:16") : "9:16" });
        images = r.frames.map(f => f.dataUrl);
      } catch (e) { toast(`${e.message}，这次只按文字拆解`, 4200, "err"); }
    } else if (t.frames?.length) { for (const f of t.frames.slice(0, 12)) { try { images.push(await shrinkImage(f.url)); } catch (_) {} } }
    if (!images.length && ctx.refs.length) { for (const u of ctx.refs.slice(0, 8)) { try { images.push(await shrinkImage(u)); } catch (_) {} } }
    Object.assign(t, { status: "generating", stage: images.length ? `AI 正在看 ${images.length} 张关键帧` : "AI 正在拆解", progress: 1 }); rmRefresh(ctx);
    jqPhase(j, t.stage);
    if (j.state === "cancel") throw Object.assign(new Error("已取消"), { code: "ABORTED" });
    const d = await postJson("/api/generate", { action: "remake_breakdown", area: ctx.node ? "text.canvas" : "text.writing", project: slimProject(p), account: account(p.accountId) || {}, selectedText: rmInfoText(ctx), instruction: [t.request && `复刻打算：${t.request}`].filter(Boolean).join("\n"), images }, { signal: j.signal });
    Object.assign(t, { breakdown: d.result, result: null, status: "", stage: "", model: d.model || "", error: "" });
    if (ctx.node && !ctx.node.title.startsWith("拆解")) ctx.node.title = `拆解 · ${String(d.result.title || "").slice(0, 16)}`;
    touch(p); rmRefresh(ctx); petEvent("text");
    if (ctx.node) requestAnimationFrame(() => burstNode(ctx.node.id, 14));
    jqEnd(j, `拆解完成：${(d.result.shots || []).length} 镜 · ${d.model || ""}`);
    return true;
  } catch (e) { const ab = jqFail(j, e); Object.assign(t, { status: "", stage: "", error: ab ? "" : e.message }); touch(p); rmRefresh(ctx); return false; }
  finally { REMAKE.busy--; }
}

// ---------- 第二步：复刻 ----------
async function rmRun(ctx, mode = "") {
  if (!needText()) return;
  const { p, t } = ctx; mode = mode || t.output || "canvas";
  if (!t.breakdown) { const ok = await rmBreakdown(ctx); if (!ok) return; }
  if (t.status) return;
  const j = jqStart({ key: `rm2:${p.id}:${ctx.node?.id || "flow"}`, kind: "remake", label: "复刻脚本", pid: p.id, nid: ctx.node?.id || "", phase: "按拆解写新的脚本", retry: () => rmRun(rmContext(p, ctx.node ? nodeOf(p, ctx.node.id) : null), mode) });
  REMAKE.busy++; Object.assign(t, { status: "generating", stage: "按拆解写新的脚本", startedAt: j.t0, error: "" }); rmRefresh(ctx);
  try {
    const want = [t.request || "", ctx.texts.length ? `参考上游文字：${ctx.texts.join("；").slice(0, 600)}` : "", `当前项目选题：${p.topic || p.title || "未设置"}`, styleBrief(p) ? `项目风格：${styleBrief(p)}` : "", p.platform ? `发布平台：${p.platform}` : ""].filter(Boolean).join("\n");
    const d = await postJson("/api/generate", { action: "remake_script", area: ctx.node ? "text.canvas" : "text.writing", project: slimProject(p), account: account(p.accountId) || {}, selectedText: rmBreakdownText(t.breakdown), instruction: want }, { signal: j.signal });
    const r = d.result || {};
    Object.assign(t, { result: r, status: "", stage: "", model: d.model || "" });
    petEvent("script");
    if (mode === "script") {
      if (!Array.isArray(r.script) || !r.script.length) throw new Error("模型没有返回脚本");
      snapshot(p, "拆解复刻写入脚本前"); applyScript(p, r.script); if (Array.isArray(r.rationale)) p.rationale = r.rationale.map(String);
      ensureStructure(p); touch(p);
      if (p.view.mode === "flow") { p.view.step = "script"; renderProject(); } else rmRefresh(ctx);
      jqEnd(j, `已写入分镜脚本：${p.script.length} 镜，原脚本存了一个版本`, { ms: 4200 });
    } else {
      const shots = (r.shots || []).filter(s => s && s.prompt).slice(0, 12);
      if (!shots.length) throw new Error("模型没有返回镜头");
      let from = ctx.node;
      if (!from) { if (p.view.mode !== "canvas") { p.view.mode = "canvas"; } from = addNode(p, "remake", freeSpot(p, { x: 0, y: (boundsOf(p).maxY || 0) + 120 }, 320, 320), { ...copy(t), status: "" }, `复刻 · ${String(r.title || "").slice(0, 14)}`); }
      const fb = boxOf(from);
      const tn = addNode(p, "text", { x: fb.x, y: fb.y + Math.max(fb.h, 320) + 60 }, { text: `${r.title || "复刻脚本"}\n\n${(r.script || []).map((x, i) => `${i + 1}. ${x.time}　${x.shot}\n   口播：${x.voice}${x.subtitle ? `\n   字幕：${x.subtitle}` : ""}`).join("\n")}` }, "复刻脚本");
      p.canvas.edges.push({ id: uid("edge"), from: from.id, to: tn.id });
      const made = layoutShots(p, from, shots.map(s => ({ ...s, prompt: s.prompt })));
      if (t.ratio && t.ratio !== "9:16") made.forEach(m => { m.data.ratio = t.ratio; m.w = nodeWidth(m); });
      touch(p); setSel(made.map(m => m.id), made[0].id);
      if (route.view === "project" && route.projectId === p.id) { renderProject(); requestAnimationFrame(() => { fitCanvas(p, true, true, [from, tn, ...made]); made.forEach((m, i) => setTimeout(() => burstNode(m.id, 6), 70 * i)); }); }
      jqEnd(j, `复刻好了：${made.length} 个镜头已铺到画布并全部选中，可以直接「生成 ${made.length} 个」`, { ms: 4600 });
    }
  } catch (e) { const ab = jqFail(j, e); Object.assign(t, { status: "", stage: "", error: ab ? "" : e.message }); touch(p); rmRefresh(ctx); }
  finally { REMAKE.busy--; }
}

// ---------- 画布节点 ----------
function rmStrip(t, max = 8) {
  const f = (t.frames || []).slice(0, max);
  if (!f.length) return "";
  const ar = { "16:9": "16 / 9", "1:1": "1 / 1" }[t.ratio] || "9 / 16"; const cols = t.ratio === "16:9" ? 3 : t.ratio === "1:1" ? 4 : max > 8 ? 5 : 4;
  return `<div class="rm-strip" style="--ar:${ar};grid-template-columns:repeat(${cols}, minmax(0, 1fr))">${f.map(x => `<span><img src="${attr(x.url)}" alt="" draggable="false"><em class="px">${fmtSec(x.t)}</em></span>`).join("")}</div>`;
}
function rmCutBar(t) {
  if (!t.duration) return "";
  return `<div class="rm-cuts" title="检测到 ${t.cuts.length} 处切镜"><i style="left:0"></i>${t.cuts.map(c => `<i style="left:${(c / t.duration * 100).toFixed(2)}%"></i>`).join("")}<span class="px">${fmtSec(t.duration)} · ${t.cuts.length + 1} 镜</span></div>`;
}
function rmNodeBody(p, n) {
  const d = n.data; const ctx = rmContext(p, n); const b = d.breakdown; const running = d.status === "generating";
  const media = rmStrip(d) || (ctx.video ? `<div class="cn-media-box" style="aspect-ratio:16 / 9"><video class="cn-media" src="${attr(ctx.video)}" muted playsinline preload="metadata"></video><span class="cn-badge px">${icon("remake")}${d.videoUrl ? "待拆解" : "来自上游"}</span></div>` : emptyState("remake", "上传或连入一支成片"));
  return `<div class="rm-body">${media}${rmCutBar(d)}
    ${running ? `<div class="cn-run"><div class="cn-prog"><i data-rm-prog style="width:${Math.round((d.progress || .05) * 100)}%"></i></div><span class="cn-run-t px"><b>${esc(d.stage || "处理中")}</b></span></div>` : ""}
    ${b ? `<div class="rm-sum"><b>${esc(b.title)}</b><p>${esc(String(b.summary || "").slice(0, 70))}</p><div class="rm-parts">${(b.structure || []).slice(0, 5).map(s => `<span class="px">${esc(s.part)}</span>`).join("")}</div></div>` : !running ? `<p class="rm-ph">${d.desc ? esc(d.desc.slice(0, 60)) : "拆出它的钩子、结构、节奏和镜头，再换成你的选题复刻一版"}</p>` : ""}
    ${d.result ? `<span class="rm-ok px">${icon("star")}已复刻 · ${(d.result.script || []).length} 镜</span>` : ""}
    ${d.error ? `<div class="cn-err">${esc(d.error)}</div>` : ""}</div>`;
}
function rmComposer(p, n) {
  const d = n.data; const id = attr(n.id); const ctx = rmContext(p, n); const running = d.status === "generating";
  const src = ctx.video ? `<div class="rm-src"><video src="${attr(ctx.video)}" muted preload="metadata"></video><span><b>${esc(d.name || (d.videoUrl ? "上传的成片" : "上游视频"))}</b><em class="px faint">${d.duration ? `${fmtSec(d.duration)} · ${d.cuts.length + 1} 镜 · ${d.frames.length} 帧` : "还没拆解"}</em></span><label class="cf-btn" title="换一支">${icon("upload")}换<input type="file" hidden accept="video/mp4,video/webm,video/quicktime" data-in="rm-upload" data-id="${id}"></label></div>`
    : `<div class="rm-src empty"><label class="cf-btn">${icon("upload")}上传成片<input type="file" hidden accept="video/mp4,video/webm,video/quicktime" data-in="rm-upload" data-id="${id}"></label><span class="px faint">或者把视频 / 图片节点连进来，也可以只写原片描述</span></div>`;
  return `<div class="cf t-remake">${ctxRow(p, n)}${src}
    <textarea class="cf-ta" data-in="node" data-field="desc" rows="2" placeholder="原片信息（可选）：讲了什么、哪里最打动你、想借鉴哪一段">${esc(d.desc || "")}</textarea>
    <textarea class="cf-ta" data-in="node" data-field="request" data-cf rows="2" placeholder="复刻需求：换成什么选题、人物、场景和语气…（不写就按当前项目的选题）">${esc(d.request || "")}</textarea>
    <div class="cf-row"><button class="cf-ai" data-act="rm-breakdown" data-id="${id}" ${running ? "disabled" : ""}>${icon("split")}${d.breakdown ? "重新拆解" : "拆解"}</button>${sel2("output", [["canvas", "复刻 → 铺到画布"], ["script", "复刻 → 写入分镜脚本"]], d.output || "canvas", "复刻结果放到哪里")}<span class="grow"></span><button class="cf-go" data-act="rm-run" data-id="${id}" ${running ? "disabled" : ""}>${running ? `<span class="spin"></span>${esc(d.stage || "处理中")}` : `${icon("go")}复刻`}</button></div>
    <div class="cf-foot"><span class="px faint">${d.model ? esc(d.model) : "抽帧和切镜在浏览器里完成，只把关键帧发给模型"}</span>${d.breakdown ? `<button class="cf-link" data-act="tab" data-tab="props">看完整拆解 →</button>` : ""}<span class="cf-tools"><button class="cf-ic" data-act="dup-node" data-id="${id}" title="复制 · ⌘D">${icon("dup")}</button><button class="cf-ic" data-act="delete-node" data-id="${id}" title="删除 · Delete">${icon("trash")}</button></span></div></div>`;
}
function rmBreakdownHTML(b, t) {
  if (!b) return "";
  const kv = (l, v) => v ? `<div class="kv"><span class="px faint">${l}</span><span>${esc(v)}</span></div>` : "";
  return `<div class="rm-full">
    <div class="sub"><span class="px faint">概述</span><p style="font-size:13px">${esc(b.summary)}</p></div>
    <div class="kv-list">${kv("钩子", b.hook)}${kv("节奏", b.rhythm)}${kv("画面", b.visual)}${kv("声音", b.audio)}</div>
    ${(b.structure || []).length ? `<div class="sub"><span class="px faint">结构</span><ol class="rm-struct">${b.structure.map(s => `<li><b class="px">${esc(s.part)}</b><span class="px faint">${esc(s.time)}</span><span>${esc(s.purpose)}</span></li>`).join("")}</ol></div>` : ""}
    ${(b.shots || []).length ? `<div class="sub"><span class="px faint">逐镜 ${b.shots.length}</span><div class="rm-shots">${b.shots.map((s, i) => { const fr = (t?.frames || []).find(f => { const m = String(s.time).match(/(\d+(?:\.\d+)?)/); return m && Math.abs(f.t - Number(m[1])) < 2.5; }); return `<div class="rm-shot">${fr ? `<img src="${attr(fr.url)}" alt="">` : `<i class="px">${String(i + 1).padStart(2, "0")}</i>`}<div><span class="px faint">${esc(s.time)} · ${esc(s.camera)}</span><b>${esc(s.shot)}</b>${s.voice ? `<span class="dim">口播：${esc(s.voice)}</span>` : ""}${s.subtitle ? `<span class="dim">字幕：${esc(s.subtitle)}</span>` : ""}<span class="px rm-why">${esc(s.purpose)}</span></div></div>`; }).join("")}</div></div>` : ""}
    ${(b.techniques || []).length ? `<div class="sub"><span class="px faint">可以借鉴</span><div class="rationale">${b.techniques.map(x => `<span>${esc(x)}</span>`).join("")}</div></div>` : ""}
    ${(b.cautions || []).length ? `<div class="sub"><span class="px faint">复刻时注意</span><div class="rm-caution">${b.cautions.map(x => `<span>${esc(x)}</span>`).join("")}</div></div>` : ""}
  </div>`;
}
function rmResultHTML(r) {
  if (!r) return "";
  return `<div class="sub"><span class="px faint">复刻结果 · ${esc(r.title || "")}</span><ol class="rm-res">${(r.script || []).map(x => `<li><span class="px faint">${esc(x.time)}</span><span>${esc(x.voice || x.shot)}</span></li>`).join("")}</ol>${(r.rationale || []).length ? `<div class="rationale">${r.rationale.map(x => `<span>${esc(x)}</span>`).join("")}</div>` : ""}</div>`;
}
function rmProps(p, n) {
  const d = n.data; const ctx = rmContext(p, n); const running = d.status === "generating";
  return `${head("创作节点", nodeTitle(p, n), d.breakdown ? `${(d.breakdown.shots || []).length} 镜拆解` : "拆解复刻")}<div class="props">
    ${ctx.video ? `<div class="media-prev"><video src="${attr(ctx.video)}" controls preload="metadata"></video></div>` : ""}${rmStrip(d, 12)}${rmCutBar(d)}
    ${d.error ? `<div class="err-box">${esc(d.error)}</div>` : ""}
    ${fld("节点名称", `<input data-in="node-title" value="${attr(nodeTitle(p, n))}" maxlength="40">`)}
    ${fld("原片信息", ta("node", 'data-field="desc"', d.desc || "", "讲了什么、哪里最打动你、想借鉴哪一段", 3))}
    ${fld("复刻需求", ta("node", 'data-field="request"', d.request || "", "换成什么选题、人物、场景和语气", 3))}
    ${rmBreakdownHTML(d.breakdown, d)}${rmResultHTML(d.result)}
  </div><div class="props-actions"><button class="btn line" data-act="rm-breakdown" data-id="${attr(n.id)}" ${running ? "disabled" : ""}>${d.breakdown ? "重新拆解" : "拆解"}</button><button class="btn primary" data-act="rm-run" data-id="${attr(n.id)}" data-mode="canvas" ${running ? "disabled" : ""}>复刻到画布</button><button class="btn line" data-act="rm-run" data-id="${attr(n.id)}" data-mode="script" ${running ? "disabled" : ""}>写入分镜脚本</button><button class="btn quiet" data-act="delete-node" data-id="${attr(n.id)}">删除</button></div>`;
}

// ---------- 流程：分镜脚本页的附加项 ----------
function rmFlowBlock(p) {
  const t = { ...RM_BLANK(), ...(p.remake || {}) }; const running = t.status === "generating";
  const vids = []; p.canvas.nodes.forEach(n => { const u = nodeVideo(n); if (u && !vids.some(v => v.url === u)) vids.push({ url: u, label: nodeTitle(p, n) }); });
  if (!t.open) return `<div class="blk rm-box closed" data-rm-box><button class="rm-toggle" data-act="rm-toggle"><span class="rm-ico">${icon("remake")}</span><span><b>拆解复刻</b><span class="px faint">照着一支成片的结构和节奏来写这一版${t.breakdown ? `　· 已拆解「${esc(String(t.breakdown.title || "").slice(0, 16))}」` : ""}</span></span><span class="px faint end">附加 ▾</span></button></div>`;
  return `<div class="blk rm-box" data-rm-box><button class="rm-toggle" data-act="rm-toggle"><span class="rm-ico">${icon("remake")}</span><span><b>拆解复刻</b><span class="px faint">上传一支成片，AI 拆出钩子、结构、节奏和镜头，再按你的选题复刻成新的分镜脚本</span></span><span class="px faint end">收起 ▴</span></button>
    <div class="rm-grid">
      <div class="rm-left">
        ${t.videoUrl ? `<div class="rm-src"><video src="${attr(t.videoUrl)}" muted preload="metadata" controls></video><span><b>${esc(t.name || "成片")}</b><em class="px faint">${t.duration ? `${fmtSec(t.duration)} · ${t.cuts.length + 1} 镜` : "还没拆解"}</em></span></div>` : ""}
        <div class="row-actions"><label class="btn line sm">${icon("upload")}${t.videoUrl ? "换一支成片" : "上传成片"}<input type="file" hidden accept="video/mp4,video/webm,video/quicktime" data-in="rm-flow-upload"></label>${vids.length ? `<select data-in="rm-flow-pick" data-dd-class="pill" aria-label="用项目里的视频"><option value="">用项目里的视频…</option>${vids.map(v => `<option value="${attr(v.url)}" ${v.url === t.videoUrl ? "selected" : ""}>${esc(v.label)}</option>`).join("")}</select>` : ""}${t.videoUrl ? `<button class="btn quiet sm" data-act="rm-flow-clear">移除</button>` : ""}</div>
        ${rmStrip(t, 10)}${rmCutBar(t)}
        ${fld("原片信息（可选）", `<textarea data-in="rm-field" data-field="desc" rows="2" placeholder="没有视频也可以：写下原片讲了什么、链接、最想借鉴哪一段">${esc(t.desc)}</textarea>`)}
        ${fld("复刻需求", `<textarea data-in="rm-field" data-field="request" rows="2" placeholder="换成什么选题、人物和语气；不写就按本项目的选题和风格画像">${esc(t.request)}</textarea>`)}
        <div class="row-actions"><button class="btn line sm" data-act="rm-flow-breakdown" ${running ? "disabled" : ""}>${running && !t.breakdown ? esc(t.stage || "拆解中") : t.breakdown ? "重新拆解" : "① 拆解这支片"}</button><button class="btn primary sm" data-act="rm-flow-run" ${running ? "disabled" : ""}>${running && t.breakdown ? esc(t.stage || "复刻中") : "② 复刻并写入脚本"}</button><button class="btn quiet sm" data-act="rm-flow-canvas" ${running ? "disabled" : ""}>复刻到画布</button></div>
        ${running ? `<div class="rm-progress"><i data-rm-prog style="width:${Math.round((t.progress || .05) * 100)}%"></i></div>` : ""}
        ${t.error ? `<div class="err-box">${esc(t.error)}</div>` : ""}
      </div>
      <div class="rm-right">${t.breakdown ? `<b class="rm-title">${esc(t.breakdown.title)}</b>${rmBreakdownHTML(t.breakdown, t)}` : `<div class="rm-empty"><span class="px faint">拆解结果会出现在这里</span><span class="dim">抽帧和切镜检测在浏览器里完成，只把十来张关键帧交给模型。复刻只借鉴结构、节奏和镜头语言，台词和画面都会换成新的。</span></div>`}</div>
    </div></div>`;
}
const rmFlowCtx = () => { const p = project(); return p ? rmContext(p, null) : null; };
Object.assign(EXT_ACTS, {
  "rm-breakdown": el => { const p = project(); const n = nodeOf(p, el.dataset.id); if (n) rmBreakdown(rmContext(p, n)); },
  "rm-run": el => { const p = project(); const n = nodeOf(p, el.dataset.id); if (n) rmRun(rmContext(p, n), el.dataset.mode || n.data.output); },
  "rm-toggle": () => { const p = project(); p.remake = { ...RM_BLANK(), ...(p.remake || {}) }; p.remake.open = !p.remake.open; save(); const box = $("[data-rm-box]"); if (box) { box.outerHTML = rmFlowBlock(p); ddEnhance($("[data-rm-box]")); } },
  "rm-flow-breakdown": () => { const c = rmFlowCtx(); if (c) rmBreakdown(c); },
  "rm-flow-run": () => { const c = rmFlowCtx(); if (c) rmRun(c, "script"); },
  "rm-flow-canvas": () => { const c = rmFlowCtx(); if (c) rmRun(c, "canvas"); },
  "rm-flow-clear": () => { const p = project(); Object.assign(p.remake, { videoUrl: "", name: "", frames: [], cuts: [], duration: 0, framesOf: "" }); touch(p); rmRefresh(rmFlowCtx()); }
});
Object.assign(EXT_INS, {
  "rm-upload": async (el, t) => {
    if (t !== "change" || !el.files?.[0]) return;
    const p = project(); const n = nodeOf(p, el.dataset.id); if (!n) return; const f = el.files[0]; el.value = "";
    toast("正在保存…");
    try { const d = await uploadAsset(f, 70_000_000); if (d.mediaType !== "video") throw new Error("这里需要一个视频文件"); Object.assign(n.data, { videoUrl: d.assetUrl, name: f.name, frames: [], cuts: [], duration: 0, breakdown: null, result: null, framesOf: "", error: "" }); if (!n.title || n.title.startsWith("拆解复刻")) n.title = `拆解 · ${f.name.replace(/\.[^.]+$/, "").slice(0, 16)}`; touch(p); canvasRefresh(p, n.id); renderComposer(); toast("成片已放进节点，点「拆解」开始"); }
    catch (e) { toast(e.message, 5000, "err"); }
  },
  "rm-field": (el, t) => { if (t !== "input") return; const p = project(); p.remake = { ...RM_BLANK(), ...(p.remake || {}) }; p.remake[el.dataset.field] = el.value; touch(p); },
  "rm-flow-upload": async (el, t) => {
    if (t !== "change" || !el.files?.[0]) return;
    const p = project(); const f = el.files[0]; el.value = "";
    toast("正在保存…");
    try { const d = await uploadAsset(f, 70_000_000); if (d.mediaType !== "video") throw new Error("这里需要一个视频文件"); p.remake = { ...RM_BLANK(), ...(p.remake || {}), videoUrl: d.assetUrl, name: f.name, frames: [], cuts: [], duration: 0, framesOf: "", breakdown: null, open: true }; touch(p); rmRefresh(rmFlowCtx()); toast("成片已上传，点「拆解这支片」"); }
    catch (e) { toast(e.message, 5000, "err"); }
  },
  "rm-flow-pick": (el, t) => { if (t !== "change" || !el.value) return; const p = project(); p.remake = { ...RM_BLANK(), ...(p.remake || {}), videoUrl: el.value, name: "项目里的视频", frames: [], cuts: [], duration: 0, framesOf: "", breakdown: null, open: true }; touch(p); rmRefresh(rmFlowCtx()); }
});
