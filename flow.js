"use strict";
// 帧比特 3.2 · 编导流程：九个步骤页面（和画布共用同一份数据）

const STYLE_GROUPS = [
  ["定位", ["positioning", "contentType", "audience", "platformTone", "discovery"]],
  ["表达", ["voice", "duration", "pace", "structure", "hook", "cta"]],
  ["画面与边界", ["visual", "cover", "risk"]]
];
const two = i => String(i + 1).padStart(2, "0");
const empty = (t, act = "") => `<div class="empty-card"><span class="px faint">${t}</span>${act}</div>`;

function curStep(p) { return stepKey(p.view.step || nextStep(p)?.key || "topic"); }
function stepMeta(key) { const i = STEPS.findIndex(([k]) => k === key); return { i, key, name: STEPS[i][1], desc: STEPS[i][2], prev: STEPS[i - 1], next: STEPS[i + 1] }; }

function renderFlow(p, key) {
  const m = stepMeta(key); const o = outline(p).find(s => s.key === key);
  const page = { topic: pageTopic, style: pageStyle, script: pageScript, visual: pageVisual, cut: pageCut, package: pagePackage, review: pageReview, cover: pageCover, deliver: pageDeliver }[key](p);
  const primary = { style: `<button class="btn line" data-act="ai-style">AI 起草画像</button>`, script: `<button class="btn line" data-act="ai-run" data-kind="script">${p.script.length ? "重写整版" : "AI 生成脚本"}</button>`, visual: p.script.length ? `<button class="btn line" data-act="batch-images">生成缺少的画面</button>` : "", cut: `<button class="btn line" data-act="sync-cut">按分镜同步</button>`, package: `<button class="btn line" data-act="ai-run" data-kind="packaging">${p.titles.length ? "重新生成" : "AI 生成包装"}</button>`, review: `<button class="btn line" data-act="ai-run" data-kind="review">${p.review.length ? "重新审稿" : "AI 审稿"}</button>`, cover: `<button class="btn line" data-act="open-cover">打开设计器</button>`, deliver: `<button class="btn line" data-act="export" data-kind="pack">导出完整内容包</button>` }[key] || "";
  return `<section class="flow" data-flow aria-label="编导流程">
    <div class="flow-scroll" data-flow-scroll>
      <article class="flow-page" data-stagger>
        <header class="page-head">
          <span class="px faint">STEP ${two(m.i)} / ${two(STEPS.length - 1)}</span>
          <h1 class="px-48">${m.name}</h1>
          <p class="dim">${m.desc}</p>
          ${o?.st ? `<span class="chip ${o.done ? "ok" : ""}">${o.done ? "<i class=\"tick\"></i>" : ""}${esc(o.st)}</span>` : ""}
        </header>
        ${page}
      </article>
    </div>
    <footer class="flow-foot">
      ${m.prev ? `<button class="btn quiet" data-act="open-step" data-flow="1" data-step="${m.prev[0]}">← ${m.prev[1]}</button>` : `<span></span>`}
      <div class="foot-mid">${primary}</div>
      ${m.next ? `<button class="btn primary" data-act="open-step" data-flow="1" data-step="${m.next[0]}">下一步：${m.next[1]} →</button>` : `<button class="btn primary" data-act="go" data-to="home">回到首页</button>`}
    </footer>
  </section>`;
}

// ---------- 01 选题立项 ----------
function pageTopic(p) {
  const acc = account(p.accountId); const pf = PLATFORM_PROFILES[p.platform] || {};
  return `<div class="blk"><label class="sr" for="fTopic">选题</label><textarea id="fTopic" class="big-input" data-in="p-field" data-field="topic" rows="2" placeholder="一句话说清这条内容要讲什么">${esc(p.topic)}</textarea></div>
  <div class="blk grid2">
    ${fld("平台", `<select data-in="p-field" data-field="platform">${Object.keys(PLATFORM_PROFILES).map(k => `<option ${k === p.platform ? "selected" : ""}>${k}</option>`).join("")}</select>`)}
    ${fld("账号 DNA", `<select data-in="p-field" data-field="accountId"><option value="">不指定</option>${state.accounts.map(a => `<option value="${attr(a.id)}" ${a.id === p.accountId ? "selected" : ""}>${esc(a.name || "未命名账号")}</option>`).join("")}</select>`, `<a href="#" data-act="go" data-to="library">${state.accounts.length ? "管理" : "新建"}</a>`)}
  </div>
  <div class="blk">${fld("补充说明", ta("p-field", 'data-field="brief"', p.brief, "想表达的观点、手里的事实和案例、不能出现的内容", 4))}</div>
  ${ipCastField(p)}
  ${acc ? `<div class="blk"><span class="px faint">账号 DNA · ${esc(acc.name)}</span><div class="paper-card">${ACCOUNT_FIELDS.filter(([k]) => !["name", "platform"].includes(k) && acc[k]).map(([k, l]) => `<div class="kv"><span class="px">${l}</span><span>${esc(acc[k])}</span></div>`).join("") || `<p class="dim" style="font-size:13px">这个账号还没填内容，去资料库补充后，AI 会按它来写。</p>`}</div></div>` : ""}
  <div class="blk"><span class="px faint">${esc(p.platform)} 的平台习惯（AI 只把它当边界参考）</span><div class="kv-list">${[["原生表达", pf.nativeTone], ["分发", pf.discovery], ["封面", pf.cover], ["风险", pf.risk]].filter(x => x[1]).map(([l, v]) => `<div class="kv"><span class="px faint">${l}</span><span class="dim">${esc(v)}</span></div>`).join("")}</div></div>`;
}

// ---------- 02 风格画像 ----------
function pageStyle(p) {
  const s = p.style;
  return `<div class="blk ai-box">
    ${fld("大致思路（给 AI 起草用，可以不写）", ta("p-field", 'data-field="styleIdea"', p.styleIdea || "", "比如：面向刚当上主管的人，专业但不端着，60 秒，别像培训课", 2))}
    <div class="row-actions"><button class="btn primary sm" data-act="ai-style">${styleFilledCount(s) ? "AI 重新起草" : "AI 起草画像"}</button>${state.styles.length ? `<select data-in="apply-style" data-dd-class="pill" aria-label="套用已记住的画像"><option value="">套用已记住的画像</option>${state.styles.map(x => `<option value="${attr(x.id)}">${esc(x.name)}</option>`).join("")}</select>` : ""}<span class="px faint end">已填 ${styleFilledCount(s)} / ${STYLE_KEYS.length}</span></div>
  </div>
  ${STYLE_GROUPS.map(([g, keys]) => `<div class="blk"><span class="px faint">${g}</span><div class="style-grid">${keys.map(k => { const [, label, ph] = STYLE_FIELDS.find(f => f[0] === k); return `<label class="sfield ${s[k] ? "filled" : ""}"><span class="px">${label}</span><textarea data-in="style" data-key="${k}" rows="2" placeholder="${attr(ph)}">${esc(s[k])}</textarea></label>`; }).join("")}</div></div>`).join("")}
  <div class="blk row-actions"><button class="btn primary" data-act="remember-style">${p.styleSavedAt ? "更新记住的画像" : "记住这份画像"}</button><span class="px faint">${p.styleSavedAt ? `已记住　${fmtTime(p.styleSavedAt)}　下个项目可以直接套用` : "记住后，资料库里能找到，下个项目可以一键套用"}</span></div>`;
}

// ---------- 03 分镜脚本 ----------
function pageScript(p) {
  const secs = scriptSeconds(p.script);
  return `<div class="blk ai-box">
    ${fld("这一次的要求", ta("ui-instr", "", ui.instr || "", "比如：观点更克制，加一个真实生活场景", 2))}
    <div class="row-actions"><button class="btn primary sm" data-act="ai-run" data-kind="script">${p.script.length ? "重写整版脚本" : "AI 生成脚本"}</button><button class="btn line sm" data-act="ai-run" data-kind="full">脚本 + 包装 + 审稿</button><span class="px faint end">${p.script.length ? `${p.script.length} 镜${secs ? `　约 ${secs} 秒` : ""}` : ""}</span></div>
  </div>
  ${rmFlowBlock(p)}
  <div class="blk shot-list" data-stagger>${p.script.map((r, i) => `<div class="shot-row" data-row="${attr(r.id)}">
      <div class="shot-no"><b class="px-24">${two(i)}</b><input class="mini" data-in="shot" data-id="${attr(r.id)}" data-key="time" value="${attr(r.time)}" placeholder="00:00-00:03" aria-label="时间">${r.imageUrl ? `<button class="thumb" data-act="open-step" data-flow="1" data-step="visual" aria-label="查看画面"><img src="${attr(r.imageUrl)}" alt=""></button>` : ""}</div>
      <div class="shot-fields">
        <label class="sfield"><span class="px">画面</span><textarea data-in="shot" data-id="${attr(r.id)}" data-key="shot" rows="2" placeholder="景别、主体、动作、光线">${esc(r.shot)}</textarea></label>
        <label class="sfield"><span class="px">口播<a href="#" data-act="rewrite-shot" data-id="${attr(r.id)}">AI 重写</a></span><textarea data-in="shot" data-id="${attr(r.id)}" data-key="voice" rows="2" placeholder="这一镜说什么">${esc(r.voice)}</textarea></label>
        <label class="sfield"><span class="px">字幕</span><input data-in="shot" data-id="${attr(r.id)}" data-key="subtitle" value="${attr(r.subtitle)}" placeholder="屏幕上的关键字"></label>
        <label class="sfield"><span class="px">备注</span><input data-in="shot" data-id="${attr(r.id)}" data-key="note" value="${attr(r.note)}" placeholder="这一镜的作用"></label>
      </div>
      <div class="shot-tools"><button class="btn quiet sm icon" title="上移" data-act="move-shot" data-id="${attr(r.id)}" data-dir="-1" ${i ? "" : "disabled"}>↑</button><button class="btn quiet sm icon" title="下移" data-act="move-shot" data-id="${attr(r.id)}" data-dir="1" ${i < p.script.length - 1 ? "" : "disabled"}>↓</button><button class="btn quiet sm icon" title="删除这一镜" data-act="del-shot" data-id="${attr(r.id)}">×</button></div>
    </div>`).join("") || empty("还没有脚本。让 AI 按风格画像生成，或者自己一镜一镜写。")}</div>
  <div class="blk"><button class="btn line sm" data-act="add-shot">添加镜头</button></div>
  ${p.rationale.length ? `<div class="blk"><span class="px faint">这次生成的依据</span><div class="rationale">${p.rationale.map(x => `<span>${esc(x)}</span>`).join("")}</div></div>` : ""}`;
}

// ---------- 04 画面 ----------
function shotVideo(p, r) { return p.canvas.nodes.find(n => n.type === "video" && n.data.shotId === r.id); }
function pageVisual(p) {
  if (!p.script.length) return empty("先写分镜脚本，这里会按脚本逐镜排好画面位。", `<button class="btn line sm" data-act="open-step" data-flow="1" data-step="script">去写脚本</button>`);
  const vertical = !["B站"].includes(p.platform);
  const free = p.canvas.nodes.filter(n => ["image", "upload", "video"].includes(n.type) && !n.data.shotId && (nodeImage(p, n) || nodeVideo(n)));
  return `<div class="blk board ${vertical ? "v" : ""}" data-stagger>${p.script.map((r, i) => {
    const v = shotVideo(p, r); const running = r.imageStatus === "generating"; const vRun = v && RUN.includes(v.data.status);
    return `<div class="board-card">
      ${frame(r.imageUrl, v?.data.videoUrl, { running: running || vRun, error: r.imageError || v?.data.error, vertical, empty: "还没有画面", status: vRun ? runStatus(v) : "等模型出图", t0: vRun ? (v.data.startedAt || v.data.pollStartedAt) : r.imageStartedAt })}
      <div class="bc-meta"><span class="px">分镜 ${two(i)}</span>${ipShotBadge(p, r.shot)}<span class="px faint">${esc(r.time)}</span></div>
      <p class="bc-txt">${esc(r.voice || r.shot || "（空镜头）")}</p>
      <div class="bc-acts">
        <button class="btn line sm" data-act="shot-image" data-id="${attr(r.id)}" ${running ? "disabled" : ""}>${running ? "生成中" : r.imageUrl ? "重画" : "生成画面"}</button>
        <label class="btn quiet sm" title="上传图片替换">上传<input type="file" hidden accept="image/png,image/jpeg,image/webp" data-in="shot-upload" data-id="${attr(r.id)}"></label>
        <button class="btn quiet sm" data-act="flow-video" data-id="${attr(r.id)}" ${vRun ? "disabled" : ""}>${vRun ? (v.data.status === "InQueue" ? "排队中" : "视频生成中") : v?.data.videoUrl ? "重做视频" : "做成视频"}</button>
        ${v?.data.status === "poll_error" ? `<button class="btn quiet sm" data-act="resume-video" data-id="${attr(v.id)}">继续查询</button>` : ""}
      </div>
    </div>`; }).join("")}</div>
  ${free.length ? `<div class="blk"><span class="px faint">画布里的其他素材</span><div class="tiles">${free.map(n => `<button class="tile" data-act="canvas-node" data-id="${attr(n.id)}">${frame(nodeImage(p, n), nodeVideo(n))}<span class="px faint">${FREE_LABEL[n.type]}</span></button>`).join("")}</div></div>` : ""}
  <p class="px faint">画面用于封面背景、做图生视频的参考图；网页版不能生成画面和视频：可以在画布里上传自己的素材，要生成请用帧比特 Mac App。</p>`;
}

// ---------- 05 成片 ----------
function pageCut(p) {
  const cut = nodeByType(p, "cut"); const clips = cut?.data.clips || [];
  const total = clips.reduce((a, c) => a + Math.max(0, Number(c.out) - Number(c.in)), 0);
  if (!clips.length) return empty("还没有片段。在「画面」里把分镜做成视频，再点「按分镜同步」，它们会按顺序排进来。", `<div class="row-actions"><button class="btn line sm" data-act="sync-cut">按分镜同步</button><button class="btn quiet sm" data-act="open-step" data-flow="1" data-step="visual">去做视频</button></div>`);
  return `<div class="blk player"><video data-cut-player src="${attr(clips[0].url)}" controls preload="metadata"></video><div class="row-actions"><button class="btn primary sm" data-act="play-cut">播放全片</button><span class="px faint">${clips.length} 段　约 ${total.toFixed(1)} 秒</span><button class="btn quiet sm end" data-act="export" data-kind="edl">导出粗剪单</button></div></div>
  <div class="blk timeline">${clips.map(c => `<i style="flex:${Math.max(.4, Number(c.out) - Number(c.in))}" title="${attr(c.title)}"></i>`).join("")}</div>
  <div class="blk clip-list" data-stagger>${clips.map((c, i) => `<div class="clip-row"><span class="px faint">${two(i)}</span><input class="input" data-in="clip" data-index="${i}" data-field="title" value="${attr(c.title)}" aria-label="片段名"><label class="num"><span class="px faint">入</span><input class="input" type="number" min="0" step="0.1" data-in="clip" data-index="${i}" data-field="in" value="${Number(c.in)}"></label><label class="num"><span class="px faint">出</span><input class="input" type="number" min="0.1" step="0.1" data-in="clip" data-index="${i}" data-field="out" value="${Number(c.out)}"></label><span class="tools"><button class="btn quiet sm icon" data-act="clip-move" data-index="${i}" data-dir="-1" title="前移" ${i ? "" : "disabled"}>↑</button><button class="btn quiet sm icon" data-act="clip-move" data-index="${i}" data-dir="1" title="后移" ${i < clips.length - 1 ? "" : "disabled"}>↓</button><button class="btn quiet sm icon" data-act="clip-del" data-index="${i}" title="移除">×</button></span></div>`).join("")}</div>`;
}

// ---------- 06 标题包装 ----------
function listBlock(p, key, label, ph) {
  return `<div class="blk"><span class="px faint head-row">${label}<a href="#" data-act="add-item" data-key="${key}">添加</a></span><div class="list-edit big" data-stagger>${p[key].map((v, i) => `<div class="row"><i>${i + 1}</i><input class="input" data-in="list" data-key="${key}" data-index="${i}" value="${attr(v)}" placeholder="${attr(ph)}"><span class="tools"><button class="btn quiet sm" data-act="copy-text" data-text="${attr(v)}">复制</button><button class="btn quiet sm" data-act="rewrite-item" data-key="${key}" data-index="${i}">AI 改</button><button class="btn quiet sm icon" title="删除" data-act="del-item" data-key="${key}" data-index="${i}">×</button></span></div>`).join("") || `<p class="dim" style="font-size:13px">还没有。可以让 AI 按脚本生成，也可以点「添加」自己写。</p>`}</div></div>`;
}
function pagePackage(p) {
  return `<div class="blk ai-box">
    ${fld("这一次的要求", ta("ui-instr", "", ui.instr || "", "比如：标题更克制，封面字不超过 8 个字", 2))}
    <div class="row-actions"><button class="btn primary sm" data-act="ai-run" data-kind="packaging">${p.titles.length ? "重新生成包装" : "AI 生成标题包装"}</button><span class="px faint end">${p.script.length ? "按脚本和账号调性生成" : "先写脚本效果更好"}</span></div>
  </div>
  ${listBlock(p, "titles", "标题", "一个标题")}${listBlock(p, "coverWords", "封面字", "6–10 个字")}
  <div class="blk">${fld("发布文案", ta("p-field", 'data-field="publishCopy"', p.publishCopy, "简介、话题标签、引导互动的一句话", 5), `<span><a href="#" data-act="copy-text" data-field="publishCopy">复制</a>　<a href="#" data-act="rewrite-field" data-field="publishCopy">AI 重写</a></span>`)}</div>
  <div class="blk">${fld("封面方案", ta("p-field", 'data-field="coverPlan"', p.coverPlan, "主体、构图、色彩和字的位置；封面设计器和背景生成会用到它", 3))}</div>`;
}

// ---------- 07 审稿 ----------
function pageReview(p) {
  const n = lv => p.review.filter(r => r.level === lv).length;
  if (!p.review.length) return empty(p.script.length ? "还没审过。AI 会检查事实、平台风险、账号调性、结构和表达，结论仍需你最后确认。" : "先写脚本，再来审稿。", p.script.length ? `<button class="btn primary sm" data-act="ai-run" data-kind="review">AI 审稿</button>` : `<button class="btn line sm" data-act="open-step" data-flow="1" data-step="script">去写脚本</button>`);
  return `<div class="blk review-sum"><div class="counts"><span class="cnt must"><b class="px-36">${n("必须修改")}</b><span class="px">必须修改</span></span><span class="cnt warn"><b class="px-36">${n("需注意")}</b><span class="px">需注意</span></span><span class="cnt ok"><b class="px-36">${n("通过")}</b><span class="px">通过</span></span></div>${p.reviewSummary ? `<p>${esc(p.reviewSummary)}</p>` : ""}</div>
  <div class="blk review-list" data-stagger>${p.review.map((r, i) => `<div class="review-item ${r.level === "必须修改" ? "must" : r.level === "需注意" ? "warn" : ""}"><span class="px lv">${esc(r.level)}</span><span>${esc(r.issue)}</span><span class="dim">${esc(r.fix)}</span>${r.level !== "通过" ? `<button class="btn line sm" style="align-self:flex-start" data-act="review-fix" data-index="${i}">按建议改脚本</button>` : ""}</div>`).join("")}</div>`;
}

// ---------- 08 封面 ----------
function pageCover(p) {
  const imgs = [...p.script.map(r => r.imageUrl), ...p.canvas.nodes.map(n => n.type !== "shot" ? nodeImage(p, n) : "")].filter(Boolean);
  const uniq = [...new Set(imgs)];
  return `<div class="blk cover-row">
    <div>${coverMini(p) || `<button class="cover-empty" data-act="open-cover"><span class="px">还没有封面</span><span class="px faint">打开设计器，从版式开始</span></button>`}</div>
    <div class="cover-side">
      <div class="row-actions"><button class="btn primary" data-act="open-cover">${p.coverDesign?.elements?.length ? "继续设计" : "开始设计"}</button>${p.coverDesign?.elements?.length ? `<button class="btn line" data-act="export" data-kind="cover">导出 PNG</button>` : ""}</div>
      ${p.coverDesign?.elements?.length ? `<span class="px faint">${esc(p.coverDesign.preset || "9:16")} · ${p.coverDesign.width} × ${p.coverDesign.height}　${(() => { const w = cdWarnings(ensureDesign(p)); return w.length ? `<span class="warn-t">${w.length} 处文字压到平台界面</span>` : "安全区内"; })()}</span>` : ""}
      ${p.coverWords.length ? `<div><span class="px faint">封面字候选</span><div class="chips">${p.coverWords.map(w => `<span class="chip">${esc(w)}</span>`).join("")}</div></div>` : ""}
      ${p.coverPlan ? `<div><span class="px faint">封面方案</span><p class="dim" style="font-size:13px">${esc(p.coverPlan)}</p></div>` : ""}
      ${uniq.length ? `<div><span class="px faint">用画面做背景</span><div class="bg-picks">${uniq.slice(0, 12).map(u => `<button data-act="flow-cover-bg" data-url="${attr(u)}" class="${p.coverDesign?.backgroundImage === u ? "on" : ""}"><img src="${attr(u)}" alt=""></button>`).join("")}</div></div>` : ""}
    </div>
  </div>`;
}

// ---------- 09 交付 ----------
const EXPORTS = [["pack", "完整内容包", "画像、脚本、包装、审稿全部内容"], ["shoot", "拍摄包", "给摄影和出镜：逐镜画面与口播"], ["edit", "剪辑包", "给剪辑：画面、字幕、备注"], ["audit", "审核包", "风险边界与审稿意见"], ["publish", "发布包", "标题、封面字、发布文案"], ["cover", "封面 PNG", "1080 × 1920 封面图"], ["edl", "粗剪单", "成片片段与出入点"], ["workflow", "画布 JSON", "整张画布的节点与连线"]];
function pageDeliver(p) {
  const o = outline(p).filter(s => s.key !== "deliver");
  return `<div class="blk"><span class="px faint">检查清单</span><div class="checklist" data-stagger>${o.map(s => `<button class="${s.done ? "done" : ""}" data-act="open-step" data-flow="1" data-step="${s.key}"><i class="box"></i><span class="px">${s.no}</span><span>${s.name}</span><span class="px faint end">${esc(s.st || "未开始")}</span></button>`).join("")}</div></div>
  ${teamCardHTML(p)}
  <div class="blk"><span class="px faint">导出</span><div class="export-grid" data-stagger>${EXPORTS.map(([k, l, d]) => { const t = p.exports?.[k]; const off = (k === "cover" && !p.coverDesign?.elements?.length) || (k === "edl" && !(nodeByType(p, "cut")?.data.clips || []).length); const dd = k === "cover" && p.coverDesign?.width ? `${p.coverDesign.width} × ${p.coverDesign.height} 封面图` : d; return `<button class="export-card" data-act="export" data-kind="${k}" ${off ? "disabled" : ""}><span class="px">${l}</span><span class="dim">${dd}</span><span class="px faint">${t ? `已导出　${when(t)}` : off ? "还没有内容" : "导出"}</span></button>`; }).join("")}</div></div>
  <div class="blk"><span class="px faint head-row">版本<a href="#" data-act="save-version">存一个版本</a></span><div>${p.versions.slice().reverse().slice(0, 12).map(v => `<div class="ver-row"><span>${esc(v.name)}</span><span class="px faint">${fmtTime(v.time)}</span><button class="btn quiet sm" data-act="restore-version" data-id="${attr(v.id)}">恢复</button></div>`).join("") || `<p class="dim" style="font-size:13px">AI 每次改动内容之前会自动存一个版本，最多 20 个。</p>`}</div></div>`;
}
