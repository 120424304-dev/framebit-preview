"use strict";
// 帧比特 3.2 · 项目页：流程（九步）/ 画布 两个区，右侧 AI 编导与属性

const STEP_NODE = { topic: "topic", style: "style", script: "script", visual: "shot", cut: "cut", package: "publish", review: "publish", cover: "publish", deliver: "" };
const NODE_STEP = { topic: "topic", style: "style", script: "script", shot: "visual", video: "visual", cut: "cut", publish: "package" };

function projectClass() {
  const { left, right } = ui.panels;
  return left && right ? "" : !left && !right ? "focus" : !left ? "no-left" : "no-right";
}

const titleEm = t => Math.max(8, [...(t || "")].reduce((n, c) => n + (/[⺀-￿]/.test(c) ? 1 : .56), 1.5));
function renderProject() {
  const p = project(); if (!p) { go("home"); return; }
  ensureStructure(p);
  const mode = p.view.mode === "canvas" ? "canvas" : "flow";
  const step = curStep(p);
  const steps = outline(p);
  const selNode = nodeOf(p, ui.sel);
  const railOn = mode === "flow" ? step : selNode ? NODE_STEP[selNode.type] || "" : "";
  const doneN = steps.filter(s => s.done).length;
  const motionKey = `${p.id}|${mode}|${mode === "flow" ? step : ""}`;
  const keep = motionKey === lastMotionKey;
  const fs = keep ? $("[data-flow-scroll]")?.scrollTop : 0;
  const pb = $(".panel-body")?.scrollTop;
  const panelTab = mode === "flow" ? "ai" : ui.tab;
  undoEnsure(p);
  $("#view").innerHTML = `
  <header class="topbar thin">
    <a href="#" class="brand" data-act="go" data-to="home"><i></i><span>帧比特</span></a>
    <span class="px faint">/</span>
    <label class="sr" for="ptitle">项目名称</label>
    <input id="ptitle" class="title-input" data-in="p-field" data-field="title" value="${attr(p.title)}" style="width:${titleEm(p.title)}em">
    <span class="chip">${esc(p.platform)}</span>
    <nav class="seg mode-seg" data-seg="mode" aria-label="工作区"><button class="${mode === "flow" ? "on" : ""}" data-act="mode" data-mode="flow" title="⌘E 切换">流程</button><button class="${mode === "canvas" ? "on" : ""}" data-act="mode" data-mode="canvas" title="⌘E 切换">画布</button></nav>
    <span id="saveState" class="save-state">已保存</span>
    <button class="btn quiet sm kbd-btn" data-act="palette" title="命令面板">⌘K</button>
    ${undoBtns(p)}
    <button class="btn quiet sm" data-act="versions">版本 ${p.versions.length}</button>
    <div class="menu-wrap"><button class="btn line sm" data-act="export-menu" aria-expanded="${ui.exportOpen}">导出</button>${ui.exportOpen ? exportMenu() : ""}</div>
    <button class="btn quiet sm icon" data-act="toggle-panel" title="${ui.panels.right ? "收起" : "展开"} AI 编导 Bit" aria-label="AI 编导面板">${ui.panels.right ? "▸" : "◂"}</button>
    ${jqBtn()}${trashBtn()}
  </header>
  <div class="project mode-${mode} ${projectClass()}">
    <aside class="outline rail" aria-label="编导流程">
      <div class="rail-head"><span class="px faint">编导流程</span><span class="px faint">${doneN}/${steps.length}</span></div>
      <div class="rail-progress" aria-hidden="true">${steps.map(s => `<i class="${s.done ? "on" : ""}"></i>`).join("")}</div>
      <ol>${steps.map(s => `<li class="${s.done ? "done" : ""} ${s.current ? "current" : ""} ${railOn === s.key ? "on" : ""}"><button data-act="open-step" data-step="${s.key}" title="${attr(s.desc)}"><span class="no">${s.no}</span><span class="name">${s.name}</span><span class="st">${s.done ? '<i class="tick"></i>' : ""}${esc(s.st)}</span></button></li>`).join("")}</ol>
      <div class="foot"><span class="px faint">账号 DNA</span><span>${p.accountId && account(p.accountId) ? esc(account(p.accountId).name || "未命名账号") : "未指定"}</span><button class="btn quiet sm" style="align-self:flex-start;padding:0" data-act="open-step" data-flow="1" data-step="topic">更改</button></div>
    </aside>
    ${mode === "flow" ? renderFlow(p, step) : renderStage(p)}
    <aside class="panel" aria-label="AI 编导${mode === "canvas" ? "与属性" : ""}">
      <div class="panel-tabs">${mode === "canvas" ? `<div class="seg" data-seg="panel" role="tablist"><button role="tab" class="${panelTab === "ai" ? "on" : ""}" aria-selected="${panelTab === "ai"}" data-act="tab" data-tab="ai">AI 编导 Bit</button><button role="tab" class="${panelTab === "props" ? "on" : ""}" aria-selected="${panelTab === "props"}" data-act="tab" data-tab="props">属性</button></div>` : `<span class="px">AI 编导 Bit</span><span class="px faint end">正在看　${esc(stepMeta(step).name)}</span>`}</div>
      <div class="panel-body">${panelTab === "ai" ? renderChat(p) : renderProps(p, selNode)}</div>
      ${panelTab === "ai" ? renderChatInput(p) : ""}
    </aside>
  </div>`;
  if (mode === "canvas") bindStage();
  if (keep && fs) { const el = $("[data-flow-scroll]"); if (el) el.scrollTop = fs; }
  const body = $(".panel-body");
  if (body) { if (panelTab === "ai") body.scrollTop = body.scrollHeight; else if (pb && keep) body.scrollTop = pb; }
  indicators($("#view")); motion(motionKey, $("#view")); typewriter(); paintCoverMinis($("#view")); trashBadge(); jqTick();
  if (!freshNodes.size) return;
  setTimeout(() => freshNodes.clear(), 700);
}

function exportMenu() {
  return `<div class="menu" role="menu">
    <button data-act="export" data-kind="pack">完整内容包</button><button data-act="export" data-kind="shoot">拍摄包</button><button data-act="export" data-kind="edit">剪辑包</button><button data-act="export" data-kind="audit">审核包</button><button data-act="export" data-kind="publish">发布包</button>
    <hr><button data-act="export" data-kind="cover">封面 PNG</button><button data-act="export" data-kind="edl">粗剪单</button><button data-act="export" data-kind="workflow">画布工作流 JSON</button>
    <hr><button data-act="open-step" data-flow="1" data-step="deliver">打开交付页…</button></div>`;
}

function setMode(mode) {
  const p = project(); if (!p) return;
  p.view.mode = mode === "canvas" ? "canvas" : "flow"; ui.menu = null;
  save(); renderProject();
  if (p.view.mode === "canvas" && !p.canvas.viewport.fitted) { p.canvas.viewport.fitted = true; requestAnimationFrame(() => fitCanvas(p, true, true)); }
}

// 流程模式：打开步骤页面；画布模式：选中并居中对应节点
function openStep(key, { flow = false } = {}) {
  const p = project(); if (!p) return;
  key = stepKey(key);
  if (p.view.mode === "canvas" && !flow) {
    const type = STEP_NODE[key];
    if (!type) { setMode("flow"); return openStep(key, { flow: true }); }
    if (["style", "script", "publish", "cut"].includes(type)) ensureStructure(p, type);
    let n = type === "shot" ? (nodeOf(p, ui.sel)?.type === "shot" ? nodeOf(p, ui.sel) : p.canvas.nodes.find(x => x.type === "shot")) : nodeByType(p, type);
    if (!n && type === "shot") { n = nodeByType(p, "script") || (ensureStructure(p, "script"), nodeByType(p, "script")); toast("先写脚本，分镜会按脚本逐句生成"); }
    touch(p);
    if (n) selectNode(n.id, { center: true });
    return;
  }
  if (p.view.step !== key) ui.instr = "";
  p.view.mode = "flow"; p.view.step = key; ui.exportOpen = false;
  save(); renderProject();
  $("[data-flow-scroll]")?.scrollTo({ top: 0 });
}
// AI 完成一项工作后，把人带到看得见结果的地方
function reveal(p, key, nodeType = "") {
  if (route.view !== "project" || route.projectId !== p.id) return;
  if (p.view.mode === "canvas") { const n = nodeType && nodeByType(p, nodeType); if (n) selectNode(n.id, { center: true }); else renderProject(); }
  else { if (key && p.view.step !== key) { p.view.step = key; save(); } renderProject(); }
}

// ---------- 属性 ----------
const fld = (label, html, extra = "") => `<label class="field"><span>${label}${extra}</span>${html}</label>`;
const ta = (inName, attrs, value, ph = "", rows = 3) => `<textarea data-in="${inName}" ${attrs} rows="${rows}" placeholder="${attr(ph)}">${esc(value)}</textarea>`;
const inp = (inName, attrs, value, ph = "") => `<input data-in="${inName}" ${attrs} value="${attr(value)}" placeholder="${attr(ph)}">`;
const head = (eyebrow, title, sub = "", step = "") => `<div class="props-head"><span class="px faint">${esc(eyebrow)}</span><h2 class="px-36">${esc(title)}</h2>${sub ? `<span class="px faint">${esc(sub)}</span>` : ""}${step ? `<button class="btn line sm" style="align-self:flex-start;margin-top:6px" data-act="open-step" data-flow="1" data-step="${step}">在流程中编辑 →</button>` : ""}</div>`;
const modelSel = (kind, val, n = null) => modelOptions(kind, val, n).replace(' data-dd-class="cfdd model"', "");

function renderProps(p, n) {
  if (!n) return `${head("属性", "未选中")}<div class="props"><p class="dim" style="font-size:13px">点画布上的节点，或者点左侧流程里的一步，这里会显示它的内容和可以做的事。</p></div>`;
  const s = p.style;
  if (n.type === "topic") return `${head("01", "选题立项", "", "topic")}<div class="props">
    ${fld("选题", ta("p-field", 'data-field="topic"', p.topic, "一句话说清这条内容要讲什么", 3))}
    ${fld("平台", `<select data-in="p-field" data-field="platform">${Object.keys(PLATFORM_PROFILES).map(k => `<option ${k === p.platform ? "selected" : ""}>${k}</option>`).join("")}</select>`)}
    ${fld("账号 DNA", `<select data-in="p-field" data-field="accountId"><option value="">不指定</option>${state.accounts.map(a => `<option value="${attr(a.id)}" ${a.id === p.accountId ? "selected" : ""}>${esc(a.name || "未命名账号")}</option>`).join("")}</select>`, state.accounts.length ? "" : `<a href="#" data-act="go" data-to="library">新建</a>`)}
    ${fld("补充说明", ta("p-field", 'data-field="brief"', p.brief, "想表达的观点、手里的事实和案例、不能出现的内容", 4))}
  </div>`;
  if (n.type === "style") return `${head("02", "风格画像", p.styleSavedAt ? `已记住　${fmtTime(p.styleSavedAt)}` : `已填 ${styleFilledCount(s)} / ${STYLE_KEYS.length}`, "style")}<div class="props">
    ${fld("大致思路（给 AI 起草用）", ta("p-field", 'data-field="styleIdea"', p.styleIdea || "", "比如：面向刚当上主管的人，专业但不端着，60 秒，别像培训课", 3))}
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn line sm" data-act="ai-style">AI 起草画像</button>${state.styles.length ? `<select data-in="apply-style" data-dd-class="pill" aria-label="套用已记住的画像"><option value="">套用已记住的画像</option>${state.styles.map(x => `<option value="${attr(x.id)}">${esc(x.name)}</option>`).join("")}</select>` : ""}</div>
    ${STYLE_FIELDS.map(([k, label, ph]) => fld(label, ta("style", `data-key="${k}"`, s[k], ph, 2))).join("")}
  </div><div class="props-actions"><button class="btn primary" data-act="remember-style">${p.styleSavedAt ? "更新记住的画像" : "记住这份画像"}</button></div>`;
  if (n.type === "script") return `${head("03", "分镜脚本", p.script.length ? `${p.script.length} 镜${scriptSeconds(p.script) ? `，约 ${scriptSeconds(p.script)} 秒` : ""}` : "还没有脚本", "script")}<div class="props">
    ${fld("这一次的要求", ta("ui-instr", "", ui.instr || "", "比如：观点更克制，加一个真实生活场景", 2))}
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn line sm" data-act="ai-run" data-kind="script">${p.script.length ? "重写整版脚本" : "生成脚本"}</button><button class="btn line sm" data-act="ai-run" data-kind="full">脚本 + 包装 + 审稿</button></div>
    <div class="sub"><span class="px faint">逐镜</span><div class="list-edit">${p.script.map((r, i) => `<div class="row"><i>${String(i + 1).padStart(2, "0")}</i><button style="text-align:left;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" data-act="select-shot" data-id="${attr(r.id)}">${esc(r.voice || r.shot || "（空镜头）")}</button><span class="tools"><button class="btn quiet sm icon" title="上移" data-act="move-shot" data-id="${attr(r.id)}" data-dir="-1" ${i ? "" : "disabled"}>↑</button><button class="btn quiet sm icon" title="下移" data-act="move-shot" data-id="${attr(r.id)}" data-dir="1" ${i < p.script.length - 1 ? "" : "disabled"}>↓</button></span></div>`).join("") || `<p class="dim" style="font-size:13px">可以让 AI 生成，也可以一镜一镜手写。</p>`}</div><button class="btn line sm" style="align-self:flex-start" data-act="add-shot">添加镜头</button></div>
    ${p.rationale.length ? `<div class="sub"><span class="px faint">这次生成的依据</span><div class="rationale">${p.rationale.map(x => `<span>${esc(x)}</span>`).join("")}</div></div>` : ""}
  </div>`;
  if (n.type === "shot") {
    const r = shotOf(p, n); const i = p.script.indexOf(r);
    if (!r) return "";
    return `${head("04 画面 · 分镜", String(i + 1).padStart(2, "0"), r.time ? `${r.time}` : "", "visual")}<div class="props">
      ${r.imageUrl ? `<div class="media-prev"><img src="${attr(r.imageUrl)}" alt="分镜画面"></div>` : ""}${r.imageError ? `<div class="err-box">${esc(r.imageError)}</div>` : ""}
      ${fld("时间", inp("shot", `data-id="${attr(r.id)}" data-key="time"`, r.time, "00:00-00:03"))}
      ${fld("画面", ta("shot", `data-id="${attr(r.id)}" data-key="shot"`, r.shot, "景别、主体、动作、光线", 3))}
      ${fld("口播", ta("shot", `data-id="${attr(r.id)}" data-key="voice"`, r.voice, "这一镜说什么", 3), `<a href="#" data-act="rewrite-shot" data-id="${attr(r.id)}">AI 重写</a>`)}
      ${fld("字幕", inp("shot", `data-id="${attr(r.id)}" data-key="subtitle"`, r.subtitle, "屏幕上的关键字"))}
      ${fld("备注", inp("shot", `data-id="${attr(r.id)}" data-key="note"`, r.note, "这一镜的作用"))}
    </div><div class="props-actions"><button class="btn primary" data-act="shot-image" data-id="${attr(r.id)}" ${r.imageStatus === "generating" ? "disabled" : ""}>${r.imageUrl ? "重新生成画面" : "生成画面"}</button><button class="btn line" data-act="shot-video" data-id="${attr(r.id)}">做成视频</button><label class="btn quiet" style="cursor:var(--cur-pointer, pointer)">上传<input type="file" hidden accept="image/png,image/jpeg,image/webp" data-in="shot-upload" data-id="${attr(r.id)}"></label><button class="btn quiet" data-act="delete-node" data-id="${attr(n.id)}">删除</button></div>`;
  }
  if (n.type === "publish") {
    const list = (key, label) => `<div class="sub"><span class="px faint" style="display:flex;justify-content:space-between">${label}<a href="#" data-act="add-item" data-key="${key}">添加</a></span><div class="list-edit">${p[key].map((v, i) => `<div class="row"><i>${i + 1}</i><input class="input" data-in="list" data-key="${key}" data-index="${i}" value="${attr(v)}"><span class="tools"><button class="btn quiet sm icon" title="AI 重写" data-act="rewrite-item" data-key="${key}" data-index="${i}">改</button><button class="btn quiet sm icon" title="删除" data-act="del-item" data-key="${key}" data-index="${i}">×</button></span></div>`).join("") || `<p class="dim" style="font-size:13px">还没有。</p>`}</div></div>`;
    return `${head("06–08", "发布物料", "标题包装、审稿、封面", "package")}<div class="props">
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn line sm" data-act="ai-run" data-kind="packaging">${p.titles.length ? "重新生成包装" : "生成标题包装"}</button><button class="btn line sm" data-act="ai-run" data-kind="review">运行审稿</button></div>
      ${list("titles", "标题")}${list("coverWords", "封面字")}
      ${fld("发布文案", ta("p-field", 'data-field="publishCopy"', p.publishCopy, "", 4), `<a href="#" data-act="rewrite-field" data-field="publishCopy">AI 重写</a>`)}
      ${fld("封面方案", ta("p-field", 'data-field="coverPlan"', p.coverPlan, "主体、构图、色彩和字的位置", 3))}
      <div class="sub"><span class="px faint">封面</span><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn line sm" data-act="open-cover">${p.coverDesign?.elements?.length ? "继续设计封面" : "设计封面"}</button>${p.coverDesign?.elements?.length ? `<button class="btn quiet sm" data-act="export" data-kind="cover">导出 PNG</button>` : ""}</div></div>
      <div class="sub"><span class="px faint">审稿</span>${p.reviewSummary ? `<p style="font-size:13px">${esc(p.reviewSummary)}</p>` : ""}${p.review.map((r, i) => `<div class="review-item ${r.level === "必须修改" ? "must" : r.level === "需注意" ? "warn" : ""}"><span class="px lv">${esc(r.level)}</span><span>${esc(r.issue)}</span><span class="dim">${esc(r.fix)}</span>${r.level !== "通过" ? `<button class="btn quiet sm" style="align-self:flex-start;padding:0" data-act="review-fix" data-index="${i}">按建议改脚本</button>` : ""}</div>`).join("") || `<p class="dim" style="font-size:13px">还没审过。审稿会检查事实、平台风险、账号调性、结构和表达，结论仍需人工确认。</p>`}</div>
    </div>`;
  }
  if (n.type === "cut") {
    const clips = n.data.clips || [];
    return `${head("05", "成片", clips.length ? `${clips.length} 段` : "", "cut")}<div class="props">
      ${clips.length ? `<div class="media-prev"><video data-cut-player src="${attr(clips[0].url)}" controls preload="metadata"></video></div>` : `<p class="dim" style="font-size:13px">分镜做成视频以后，点「按分镜同步」会把它们按顺序排进来。也可以把视频节点直接拖线连到这里。</p>`}
      <div class="list-edit">${clips.map((c, i) => `<div class="row" style="grid-template-columns:22px minmax(0,1fr) 56px 56px auto"><i>${i + 1}</i><input class="input" data-in="clip" data-index="${i}" data-field="title" value="${attr(c.title)}" aria-label="片段名"><input class="input" type="number" min="0" step="0.1" data-in="clip" data-index="${i}" data-field="in" value="${Number(c.in)}" aria-label="入点秒"><input class="input" type="number" min="0.1" step="0.1" data-in="clip" data-index="${i}" data-field="out" value="${Number(c.out)}" aria-label="出点秒"><span class="tools"><button class="btn quiet sm icon" data-act="clip-move" data-index="${i}" data-dir="-1" title="前移">↑</button><button class="btn quiet sm icon" data-act="clip-del" data-index="${i}" title="移除">×</button></span></div>`).join("")}</div>
    </div><div class="props-actions"><button class="btn primary" data-act="sync-cut">按分镜同步</button><button class="btn line" data-act="play-cut" ${clips.length ? "" : "disabled"}>播放</button><button class="btn quiet" data-act="export" data-kind="edl">粗剪单</button></div>`;
  }
  const tools = `<button class="btn quiet" data-act="dup-node" data-id="${attr(n.id)}">复制</button><button class="btn quiet" data-act="delete-node" data-id="${attr(n.id)}">删除</button>`;
  const ctx = (() => { const c = contextOf(p, n); return c.from.length ? `<div class="sub"><span class="px faint">上游输入</span><div class="rationale">${c.from.map(u => `<span>${esc(nodeTitle(p, u))}</span>`).join("")}</div></div>` : ""; })();
  const nameField = fld("节点名称", `<input data-in="node-title" value="${attr(nodeTitle(p, n))}" maxlength="40">`);
  if (n.type === "remake") return rmProps(p, n);
  if (n.type === "ip") return ipProps(p, n);
  if (n.type === "text") return `${head("创作节点", nodeTitle(p, n), "文本")}<div class="props">${nameField}${fld("内容", ta("node", 'data-field="text"', n.data.text, "写提示词、灵感、脚本或台词", 10))}${ctx}<p class="dim" style="font-size:12px">连到图片、视频或音频节点，这段文字会作为提示词；「拆分镜头」会把它拆成一组图片节点。</p></div><div class="props-actions"><button class="btn primary" data-act="cn-polish" data-id="${attr(n.id)}">AI 润色</button><button class="btn line" data-act="cn-split" data-id="${attr(n.id)}">拆分镜头</button>${tools}</div>`;
  if (n.type === "image") return `${head("创作节点", nodeTitle(p, n), n.data.images?.length ? `${n.data.images.length} 张` : "图片")}<div class="props">
    ${nodeImage(p, n) ? `<div class="media-prev"><img src="${attr(nodeImage(p, n))}" alt="生成的图片"></div>` : ""}${n.data.error ? `<div class="err-box">${esc(n.data.error)}</div>` : ""}
    ${nameField}${fld("提示词", ta("node", 'data-field="prompt"', n.data.prompt, "主体、动作、场景、光线、镜头", 4))}${ctx}
    ${fld("模型", modelSel("image", n.data.model, n))}
  </div><div class="props-actions"><button class="btn primary" data-act="run-image" data-id="${attr(n.id)}" ${n.data.status === "generating" ? "disabled" : ""}>${n.data.images?.length ? "再生成" : "生成图片"}</button>${nodeImage(p, n) ? `<button class="btn line" data-act="as-cover-bg" data-id="${attr(n.id)}">设为封面背景</button>` : ""}${tools}</div>`;
  if (n.type === "video") {
    const shot = shotOf(p, n);
    return `${head(shot ? `分镜 ${String(p.script.indexOf(shot) + 1).padStart(2, "0")}` : "创作节点", nodeTitle(p, n), n.data.requestId ? `任务 ${n.data.requestId.replace(/^toapis:/, "").slice(0, 18)}` : "")}<div class="props">
      ${n.data.videoUrl ? `<div class="media-prev"><video src="${attr(n.data.videoUrl)}" controls preload="metadata"></video></div>` : refImage(p, n) ? `<div class="media-prev"><img src="${attr(refImage(p, n))}" alt="参考图"></div><span class="px faint">有上游图片，会用图生视频</span>` : ""}
      ${n.data.error ? `<div class="err-box">${esc(n.data.error)}</div>` : ""}
      ${shot ? "" : nameField}${fld("镜头提示词", ta("node", 'data-field="prompt"', n.data.prompt, `留空则用：${promptFor(p, { ...n, data: { ...n.data, prompt: "" } }).slice(0, 40)}`, 4))}${ctx}
      ${fld("模型", modelSel("video", n.data.model, n))}
      ${(() => { const sp = specFor("video", n); const list = sp ? ratioOpts(sp.ratios) : VIDEO_RATIOS; return list.length ? fld("画幅", `<select data-in="node" data-field="ratio">${list.map(([v, l]) => `<option value="${v}" ${ratioOf(n) === v ? "selected" : ""}>${l}</option>`).join("")}</select>`) : ""; })()}
      ${fld("不要出现", inp("node", 'data-field="negativePrompt"', n.data.negativePrompt || "", "文字，水印"))}
    </div><div class="props-actions"><button class="btn primary" data-act="run-video" data-id="${attr(n.id)}" ${RUN.includes(n.data.status) ? "disabled" : ""}>${RUN.includes(n.data.status) ? "生成中" : n.data.videoUrl ? "重新生成" : "生成视频"}</button>${n.data.status === "poll_error" ? `<button class="btn line" data-act="resume-video" data-id="${attr(n.id)}">继续查询</button>` : ""}${n.data.videoUrl ? `<button class="btn line" data-act="sync-cut">加入成片</button>` : ""}${tools}</div>`;
  }
  if (n.type === "audio") return `${head("创作节点", nodeTitle(p, n), "音频")}<div class="props">
    ${nodeAudio(n) ? `<audio src="${attr(nodeAudio(n))}" controls preload="metadata" style="width:100%"></audio>` : ""}${n.data.error ? `<div class="err-box">${esc(n.data.error)}</div>` : ""}
    ${nameField}${fld("配乐描述", ta("node", 'data-field="prompt"', n.data.prompt, "情绪、风格、乐器、速度", 4))}${ctx}
    ${fld("模型", modelSel("audio", n.data.model, n))}
  </div><div class="props-actions"><button class="btn primary" data-act="cn-run" data-id="${attr(n.id)}" ${RUN.includes(n.data.status) ? "disabled" : ""}>${RUN.includes(n.data.status) ? "生成中" : nodeAudio(n) ? "再生成" : "生成配乐"}</button>${nodeAudio(n) ? `<a class="btn line" href="${attr(nodeAudio(n))}" download>下载</a>` : ""}${tools}</div>`;
  return "";
}

// ---------- AI 编导面板 ----------
function chatStep(p) { return p.view.mode === "flow" ? curStep(p) : nextStep(p)?.key || ""; }
function greeting(p) {
  const k = chatStep(p);
  return {
    topic: "先把选题说清楚：讲什么、给哪个平台、用哪个账号。补充说明里写上你手里的事实和案例，后面每一步我都会参考。",
    style: "下一步是风格画像：给谁看、用什么语气、大概多长、前三秒怎么开场。可以直接告诉我想法，也可以让我先按平台习惯起草一版。",
    script: "风格定了就写脚本。我会按画像写出逐镜的画面、口播和字幕，你可以逐句改，也可以只让我重写某一句。",
    visual: "脚本里的每一镜都有一个画面位。可以逐镜生成画面、上传自己拍的素材，再挑几镜做成视频。",
    cut: "视频生成后，按分镜顺序排进成片，可以调整每段的出入点，导出粗剪单交给剪辑。",
    package: "标题、封面字和发布文案。我会按脚本和账号调性生成几组候选，挑一组改。",
    review: "发布前过一遍审稿：事实、平台风险、账号调性、结构和表达。结论需要你最后确认。",
    cover: "封面在设计器里排：选版式、换背景、改字。背景可以直接用分镜画面。",
    deliver: "最后导出：拍摄包给摄影，剪辑包给剪辑，审核包给审核，发布包给运营。"
  }[k] || "这条内容的每一步都有了。可以导出物料，或者继续打磨任何一步。";
}
function suggestions(p) {
  const k = chatStep(p);
  const o = outline(p).find(s => s.key === k); const m = k && stepMeta(k);
  const base = suggestionsFor(k);
  return o?.done && m?.next ? [[`去下一步：${m.next[1]}`, `open-step:${m.next[0]}`], ...base].slice(0, 3) : base;
}
function suggestionsFor(k) {
  return { topic: [["写好了，去定风格", "open-step:style"]], style: [["起草风格画像", "ai-style"], ["我自己填写", "open-step:style"]], script: [["生成脚本", "ai-run:script"], ["脚本 + 包装 + 审稿", "ai-run:full"]], visual: [["生成缺少的画面", "batch-images"], ["打开画面", "open-step:visual"]], cut: [["按分镜同步", "sync-cut"]], package: [["生成标题包装", "ai-run:packaging"]], review: [["运行审稿", "ai-run:review"]], cover: [["打开封面设计器", "open-cover"]], deliver: [["导出完整内容包", "export:pack"]] }[k] || [];
}
function renderChat(p) {
  const msgs = p.chat.length ? p.chat : [{ role: "assistant", content: greeting(p), local: true }];
  const last = p.chat[p.chat.length - 1];
  const opts = (!p.chat.length || last?.role === "assistant") ? suggestions(p) : [];
  const fresh = m => m.role === "assistant" && !m.local && m.time && Date.now() - new Date(m.time).getTime() < 8000;
  return `<div class="chat" role="log" aria-live="polite">${msgs.map((m, i) => {
    const anim = fresh(m) && !typed.has(m.time) ? "new" : "";
    const body = fresh(m) && (typed.get(m.time) ?? 0) < m.content.length ? `<div class="body" data-tw="${attr(m.time)}" data-full="${attr(m.content)}">${esc(m.content.slice(0, typed.get(m.time) || 0))}</div>` : `<div class="body">${esc(m.content)}</div>`;
    return `<div class="msg ${m.role} ${anim}"><span class="who">${m.role === "user" ? "你" : "Bit"}</span>${body}${m.results?.length ? `<div class="done">${m.results.map(r => `<span>${esc(r)}</span>`).join("")}</div>` : ""}${m.model ? `<span class="px faint">${esc(m.model)}</span>` : ""}${i === msgs.length - 1 && opts.length ? `<div class="opts">${opts.map(([label, act], k) => `<button class="btn ${k ? "line" : "primary"} sm" data-act="quick" data-q="${attr(act)}">${label}</button>`).join("")}</div>` : ""}</div>`;
  }).join("")}${directorBusy ? `<div class="msg assistant thinking"><span class="who">Bit</span><div class="body"><span class="dots" aria-label="正在思考"><i></i><i></i><i></i></span>正在读项目</div></div>` : ""}</div>`;
}
function renderChatInput(p) {
  return `<div class="chat-input"><form class="composer" data-submit="ask"><label for="ask" class="sr">给 AI 编导的消息</label><textarea id="ask" placeholder="${attr(apiState.connected ? "说说你想改什么，比如：第二镜加一个更具体的场景" : "连接模型后，AI 编导才能写脚本和改内容")}"></textarea><div class="row"><span class="px faint">⌘ Enter 发送</span><button class="send" type="submit" aria-label="发送" ${directorBusy ? "disabled" : ""}>${svgArrow}</button></div></form></div>`;
}
