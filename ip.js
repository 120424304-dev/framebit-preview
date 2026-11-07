"use strict";
// 帧比特 3.6 · IP 工作台
// IP 是跨项目的长期资产：先定设定，再定妆、出三视图、做表情，每一步锁定后才进入下一步。
// 建好以后，在任何项目里把它设为「出镜 IP」：脚本用它的口吻写，画面描述里出现它的名字时，
// 生图会自动带上它的「锚点」（定妆照 + 三视图 + 固定外观描述 + 避免项）。画布里还有一个「IP 角色」节点，
// 连到图片 / 视频 / 文本节点就能把形象和口吻带过去。

const IPW = { id: "", tab: "profile", start: "idea", kind: "virtual", draft: { idea: "", note: "", accountId: "", materials: [], consent: false }, busy: new Set(), del: "", delT: 0, topicIdea: "", exprAdd: "", checkOpen: "" };
const IP_TABS = [["profile", "设定"], ["portrait", "定妆"], ["sheet", "三视图"], ["expr", "表情"], ["works", "作品"], ["anchor", "锚点"]];
const IP_KIND_LABEL = Object.fromEntries(IP_KINDS);
const IP_STARTS = [
  ["idea", "一句话创建", "说一句你想要的角色，AI 起草完整设定"],
  ["material", "从素材创建", "上传几张照片或一段视频，提炼出人设和形象"],
  ["dna", "从账号 DNA 推导", "按账号的定位和受众，反推一个合适的 IP"]
];

// 像素图标（8×8）
Object.assign(ICONS, {
  ip: '<rect x="2" y="0" width="4" height="1"/><rect x="2" y="1" width="1" height="2"/><rect x="5" y="1" width="1" height="2"/><rect x="2" y="3" width="4" height="1"/><rect x="3" y="2" width="1" height="1"/><rect x="1" y="5" width="6" height="1"/><rect x="0" y="6" width="1" height="1"/><rect x="7" y="6" width="1" height="1"/><rect x="2" y="6" width="4" height="1"/><rect x="2" y="7" width="1" height="1"/><rect x="5" y="7" width="1" height="1"/><rect x="6" y="0" width="2" height="2"/>',
  lock: '<rect x="2" y="0" width="4" height="1"/><rect x="1" y="1" width="1" height="3"/><rect x="6" y="1" width="1" height="3"/><rect x="0" y="4" width="8" height="4"/>'
});

// ---------- 基础 ----------
const ipNow = () => ipById(IPW.id);
const ipLocked = (ip, k) => Boolean(ip?.locks?.[k]);
const ipStageIndex = k => IP_STAGES.findIndex(([x]) => x === k);
function ipReady(ip, k) { const i = ipStageIndex(k); return i <= 0 || ipLocked(ip, IP_STAGES[i - 1][0]); }
function ipDoneCount(ip) { return IP_STAGES.filter(([k]) => ipLocked(ip, k)).length; }
function ipStatus(ip) { const n = ipDoneCount(ip); return n === IP_STAGES.length ? "已建档" : `建档中 ${n}/${IP_STAGES.length}`; }
function ipTouch(ip) { ip.updatedAt = now(); save(); }
// 固定外观描述：锚点里手写的优先，其次是设定里的外观
function ipAnchorText(ip) {
  const look = (ip.anchor.prompt || ip.profile.look || "").trim();
  const pal = ip.profile.palette?.length ? `主色 ${ip.profile.palette.join(" ")}` : "";
  return [look, pal].filter(Boolean).join("，");
}
function ipRefs(ip) { return [ip.portrait, ip.anchor.useSheet !== false ? ip.sheet : "", ...(ip.anchor.refs || [])].filter(Boolean).slice(0, 4); }
function ipWorks(ip) {
  return state.projects.filter(p => (p.cast || []).includes(ip.id) || p.canvas.nodes.some(n => n.type === "ip" && n.data.ipId === ip.id));
}
// 生图前调用：文字里提到了出镜 IP 的名字，就把它的锚点加进提示词、定妆照和三视图作为参考图
function ipInject(p, text, force = []) {
  const cast = [...new Set([...(p?.cast || []), ...force])].map(ipById).filter(Boolean);
  const hit = cast.filter(ip => ip.name && (force.includes(ip.id) || String(text || "").includes(ip.name)) && (ipAnchorText(ip) || ipRefs(ip).length));
  if (!hit.length) return { prompt: text, refs: [], ips: [] };
  const add = hit.map(ip => `「${ip.name}」的固定形象：${ipAnchorText(ip) || "以参考图为准"}${ip.anchor.negative ? `；避免：${ip.anchor.negative}` : ""}`).join("\n");
  return { prompt: `${text || ""}\n${add}\n角色形象必须和参考图里的同一个角色保持一致（脸、发型、服装、配色、配饰）。`.trim(), refs: [...new Set(hit.flatMap(ipRefs))].slice(0, 4), ips: hit };
}
function ipProfileText(ip) {
  const pr = ip.profile;
  return [`名字：${ip.name}`, `类型：${IP_KIND_LABEL[ip.kind]}`, pr.tagline && `一句话：${pr.tagline}`, pr.personality && `性格：${pr.personality}`, pr.voice && `说话方式：${pr.voice}`, pr.catchphrases.length && `口头禅：${pr.catchphrases.join(" / ")}`, pr.look && `外观：${pr.look}`, pr.rules.length && `禁忌：${pr.rules.join("；")}`, pr.backstory && `背景：${pr.backstory}`].filter(Boolean).join("\n");
}
// 本机图片 → 压缩后的 JPEG data URL（给读图模型用）
function ipThumb(src, max = 640) {
  return new Promise((res, rej) => {
    const im = new Image(); im.onload = () => { const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)); const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k)); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", .82)); };
    im.onerror = () => rej(new Error("图片读取失败")); im.src = src;
  });
}
async function ipBusy(key, fn) {
  if (IPW.busy.has(key)) return; IPW.busy.add(key); ipRefresh();
  try { return await fn(); } finally { IPW.busy.delete(key); ipRefresh(); }
}
function ipRefresh() { if (route.view === "ip") renderIp(); }
const busyOn = k => IPW.busy.has(k);
const spinBtn = (on, label, busyLabel) => on ? `<span class="spin"></span>${busyLabel}` : label;

// ---------- 页面 ----------
function renderIp() {
  document.documentElement.dataset.theme = state.theme === "light" ? "light" : "dark";
  const ip = ipNow(); if (IPW.id && !ip) IPW.id = "";
  const scroll = $(".view")?.scrollTop || 0; const same = renderIp.last === (ip ? `ip:${ip.id}:${IPW.tab}` : "ip:list");
  $("#view").innerHTML = `${topNav("ip")}<div class="view" style="flex:1"><div class="ipw ${ip ? "page" : ""}">${ip ? ipPageHTML(ip) : ipListHTML()}</div></div>`;
  renderIp.last = ip ? `ip:${ip.id}:${IPW.tab}` : "ip:list";
  if (same) { const v = $(".view"); if (v) v.scrollTop = scroll; }
  afterRender(renderIp.last);
}

function ipPortraitBox(ip, cls = "") {
  return `<div class="ip-frame ${cls}">${ip?.portrait ? `<img src="${attr(ip.portrait)}" alt="${attr(ip.name)}的定妆照">` : `<div class="ip-ph" aria-hidden="true"><i class="h"><b></b><b></b></i><i class="c"></i><i class="b"></i></div>`}<i class="cn tl"></i><i class="cn tr"></i><i class="cn bl"></i><i class="cn br"></i></div>`;
}
function ipPips(ip) { return `<span class="ip-pips" aria-label="${ipStatus(ip)}">${IP_STAGES.map(([k, l]) => `<i class="${ipLocked(ip, k) ? "on" : ""}" title="${l}"></i>`).join("")}</span>`; }

function ipListHTML() {
  const list = (state.ips || []).slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const d = IPW.draft; const st = IPW.start;
  const kindSeg = `<div class="seg ip-kind" data-seg="ip-kind">${IP_KINDS.map(([k, l]) => `<button type="button" class="${IPW.kind === k ? "on" : ""}" data-act="ip-kind" data-kind="${k}">${l}</button>`).join("")}</div>`;
  const body = st === "idea"
    ? `<textarea data-in="ip-draft" data-key="idea" rows="3" placeholder="${IPW.kind === "creator" ? "介绍一下你自己：做什么内容、什么性格、镜头前什么样子" : IPW.kind === "brand" ? "介绍品牌或产品，以及希望吉祥物是什么样的" : "比如：一只爱算账的柚子，职场吐槽担当，说话很冲但心软"}">${esc(d.idea)}</textarea>`
    : st === "material"
      ? `<div class="ip-mats">${d.materials.map((m, i) => `<div class="ip-mat">${m.kind === "video" ? `<video src="${attr(m.url)}" muted preload="metadata"></video><span class="px">视频 · 抽 ${m.frames?.length || 0} 帧</span>` : `<img src="${attr(m.url)}" alt="">`}<button class="x" data-act="ip-mat-del" data-i="${i}" aria-label="移除">${icon("x")}</button></div>`).join("")}${d.materials.length < 4 ? `<label class="ip-mat add"><input type="file" hidden multiple accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime" data-in="ip-mat">${icon("plus")}<span class="px">图片或视频</span></label>` : ""}</div>
         <textarea data-in="ip-draft" data-key="note" rows="2" placeholder="补充说明（可以不写）：这是谁、想保留哪些特点">${esc(d.note)}</textarea>`
      : `<div class="ip-dna"><label class="pick">账号 DNA<select data-in="ip-draft" data-key="accountId"><option value="">选一个账号</option>${state.accounts.map(a => `<option value="${attr(a.id)}" ${a.id === d.accountId ? "selected" : ""}>${esc(a.name || "未命名账号")}</option>`).join("")}</select></label>${state.accounts.length ? "" : `<a href="#" class="px" data-act="go" data-to="library">还没有账号 DNA，去资料库建一个 →</a>`}</div>
         <textarea data-in="ip-draft" data-key="idea" rows="2" placeholder="补充想法（可以不写）：比如想要动物形象、偏可爱还是偏毒舌">${esc(d.idea)}</textarea>`;
  const consent = IPW.kind === "creator" ? `<label class="ip-consent"><input type="checkbox" data-in="ip-draft" data-key="consent" ${d.consent ? "checked" : ""}><span>这是我本人，或者我已经拿到本人授权，可以用他的形象和人设做内容</span></label>` : "";
  return `<section class="ipw-hero" data-stagger>
      <span class="badge px dim"><span class="dot"></span>IP 是跨项目的长期资产</span>
      <h1 class="px-96">IP 工作台</h1>
      <p class="ipw-sub dim">定好设定、定妆照、三视图和表情，把它设成项目的「出镜 IP」：脚本会用它的口吻写，画面里提到它的名字，生图就自动套用它的固定形象。</p>
      <div class="ipw-starts" role="tablist" aria-label="怎么开始">${IP_STARTS.map(([k, l, h], i) => `<button role="tab" class="ipw-start ${st === k ? "on" : ""}" data-act="ip-start" data-start="${k}" aria-selected="${st === k}"><span class="px faint">0${i + 1}</span><b class="px">${l}</b><span>${h}</span></button>`).join("")}</div>
      <div class="composer ip-new">${body}
        <div class="row">${kindSeg}${consent}<button class="btn primary ip-go" data-act="ip-create" ${busyOn("create") ? "disabled" : ""}>${spinBtn(busyOn("create"), "AI 起草设定 →", "起草中")}</button></div>
      </div>
    </section>
    <section class="ipw-list" aria-label="我的 IP">
      <div class="list-head"><h2 class="px dim">我的 IP</h2><span class="px faint">${list.length}</span></div>
      ${list.length ? `<div class="ip-grid" data-stagger>${list.map(ip => { const w = ipWorks(ip).length; return `<button class="ip-card" data-act="ip-open" data-id="${attr(ip.id)}">${ipPortraitBox(ip)}<span class="ip-card-t"><b class="px-24">${esc(ip.name || "未命名")}</b><span class="px faint">${IP_KIND_LABEL[ip.kind]}${w ? ` · ${w} 个作品` : ""}</span></span><span class="ip-card-s">${esc(ip.profile.tagline || "还没写一句话介绍")}</span><span class="ip-card-f">${ipPips(ip)}<span class="px ${ipDoneCount(ip) === 4 ? "" : "faint"}">${ipStatus(ip)}</span></span></button>`; }).join("")}</div>`
        : `<p class="empty-line">还没有 IP。从上面三种方式里挑一个开始，几分钟就能建好第一个角色。</p>`}
    </section>`;
}

function ipPageHTML(ip) {
  const tab = IPW.tab; const w = ipWorks(ip);
  const rail = IP_STAGES.map(([k, l], i) => { const lk = ipLocked(ip, k), ready = ipReady(ip, k); return `<li class="${tab === k ? "on" : ""} ${lk ? "done" : ""}"><button data-act="ip-tab" data-tab="${k}" ${ready || lk ? "" : 'aria-disabled="true"'}><span class="px faint">0${i + 1}</span><b>${l}</b><span class="px st">${lk ? `${icon("lock")}已锁定` : ready ? "进行中" : "未开始"}</span></button></li>`; }).join("");
  const page = { profile: ipTabProfile, portrait: ipTabPortrait, sheet: ipTabSheet, expr: ipTabExpr, works: ipTabWorks, anchor: ipTabAnchor }[tab] || ipTabProfile;
  return `<div class="ip-top"><button class="btn quiet sm" data-act="ip-back">← IP 工作台</button><span class="px faint">${esc(ipStatus(ip))}　更新于 ${when(ip.updatedAt)}</span></div>
    <div class="ip-layout">
      <aside class="ip-side">
        ${ipPortraitBox(ip, "big")}
        <div class="ip-id"><input class="ip-name px-36" data-in="ip-name" value="${attr(ip.name)}" maxlength="20" aria-label="IP 名字" ${ipLocked(ip, "profile") ? "readonly" : ""}><span class="chip">${IP_KIND_LABEL[ip.kind]}</span></div>
        <p class="ip-tag">${esc(ip.profile.tagline || "")}</p>
        ${ip.profile.palette.length ? `<div class="ip-pal">${ip.profile.palette.map(c => `<i style="background:${attr(c)}" title="${attr(c)}"></i>`).join("")}</div>` : ""}
        <ol class="ip-rail">${rail}</ol>
        <div class="ip-side-acts">
          <button class="btn ${ipDoneCount(ip) === 4 ? "primary" : "line"} sm" data-act="ip-tab" data-tab="works">用它立项${w.length ? ` · ${w.length}` : ""}</button>
          <button class="btn line sm" data-act="ip-tab" data-tab="anchor">锚点</button>
          <button class="btn quiet sm" data-act="ip-del" data-id="${attr(ip.id)}">${IPW.del === ip.id ? "再点一次删除" : "删除"}</button>
        </div>
      </aside>
      <main class="ip-main">
        <nav class="seg ip-tabs" data-seg="ip-tab" aria-label="IP 分页">${IP_TABS.map(([k, l]) => `<button class="${tab === k ? "on" : ""}" data-act="ip-tab" data-tab="${k}">${l}</button>`).join("")}</nav>
        <section class="ip-pane" data-stagger>${page(ip)}</section>
      </main>
    </div>`;
}
function ipLockBar(ip, k, nextLabel) {
  const lk = ipLocked(ip, k); const i = ipStageIndex(k); const next = IP_STAGES[i + 1];
  return `<div class="ip-lockbar ${lk ? "on" : ""}">${lk ? `<span class="px">${icon("lock")}${IP_STAGES[i][1]}已锁定 · ${fmtTime(ip.locks[k])}</span><span class="grow"></span><button class="btn quiet sm" data-act="ip-unlock" data-k="${k}">解锁修改</button>${next ? `<button class="btn primary sm" data-act="ip-tab" data-tab="${next[0]}">去${next[1]} →</button>` : `<button class="btn primary sm" data-act="ip-tab" data-tab="works">用它立项 →</button>`}`
    : `<span class="px faint">锁定以后，后面的步骤和项目里都会以这一版为准</span><span class="grow"></span><button class="btn primary sm" data-act="ip-lock" data-k="${k}">${nextLabel}</button>`}</div>`;
}
function ipNeed(ip, k, what) { const i = ipStageIndex(k); const prev = IP_STAGES[i - 1]; return ipReady(ip, k) ? "" : `<div class="empty-card"><span class="px faint">先锁定「${prev[1]}」，再${what}。</span><button class="btn line sm" data-act="ip-tab" data-tab="${prev[0]}">去${prev[1]}</button></div>`; }

// 01 设定
function ipTabProfile(ip) {
  const pr = ip.profile; const lk = ipLocked(ip, "profile"); const ro = lk ? "readonly" : "";
  const f = (k, label, ph, rows = 2, val = pr[k]) => `<label class="sfield ${String(val || "").trim() ? "filled" : ""}"><span class="px">${label}</span><textarea data-in="ip-prof" data-key="${k}" rows="${rows}" placeholder="${attr(ph)}" ${ro}>${esc(Array.isArray(val) ? val.join(k === "rules" ? "\n" : " / ") : val || "")}</textarea></label>`;
  return `<div class="blk ai-box ${lk ? "dim-box" : ""}">
      <label class="field"><span>想改哪里（给 AI 用，可以不写）</span><textarea data-in="ip-misc" data-key="regen" rows="2" placeholder="比如：口头禅更接地气一点，外观加一个标志性配饰" ${ro}>${esc(IPW.regen || "")}</textarea></label>
      <div class="row-actions"><button class="btn line sm" data-act="ip-regen" ${lk || busyOn("profile") ? "disabled" : ""}>${spinBtn(busyOn("profile"), "AI 重新起草设定", "起草中")}</button><span class="px faint end">${ip.origin.mode === "material" ? `参考了 ${ip.origin.materials.length} 份素材` : ip.origin.mode === "dna" && account(ip.origin.accountId) ? `按账号「${esc(account(ip.origin.accountId).name)}」推导` : "一句话创建"}</span></div>
    </div>
    <div class="blk"><span class="px faint">人设</span><div class="style-grid">
      ${f("tagline", "一句话介绍", "20 字以内，能当账号简介", 1)}${f("personality", "性格", "3-5 个具体特质")}
      ${f("voice", "说话方式", "语速、句式、用词习惯")}${f("catchphrases", "口头禅", "用 / 或逗号隔开", 2)}
      ${f("relations", "和观众的关系", "比如：同一个工位的老同事", 1)}${f("rules", "禁忌", "每行一条：这个 IP 绝不做、绝不说的事", 3)}
    </div></div>
    <div class="blk"><span class="px faint">背景故事</span>${f("backstory", "背景", "80-160 字", 4)}</div>
    <div class="blk"><span class="px faint">形象（会被反复用来保证每张图是同一个角色）</span><div class="style-grid">
      ${f("look", "固定外观", "体型、脸、发型、服装、标志性配饰，越具体越好", 4)}${f("outfits", "常用服装", "用 / 或逗号隔开", 4)}
    </div>
    <div class="ip-pal-edit"><span class="px faint">主色</span>${pr.palette.map((c, i) => `<label class="sw" style="--c:${attr(c)}"><input type="color" value="${attr(c)}" data-in="ip-pal" data-i="${i}" ${lk ? "disabled" : ""}><span class="px">${esc(c.toUpperCase())}</span></label>`).join("")}${!lk && pr.palette.length < 6 ? `<button class="btn quiet sm" data-act="ip-pal-add">+ 加一个颜色</button>` : ""}${!lk && pr.palette.length ? `<button class="btn quiet sm" data-act="ip-pal-pop">− 去掉最后一个</button>` : ""}</div></div>
    ${pr.ideas.length ? `<div class="blk"><span class="px faint">AI 建议的内容方向</span><div class="rationale">${pr.ideas.map(x => `<span>${esc(x)}</span>`).join("")}</div></div>` : ""}
    ${ipLockBar(ip, "profile", "锁定设定，开始定妆 →")}`;
}
// 02 定妆
function ipTabPortrait(ip) {
  const need = ipNeed(ip, "portrait", "定妆"); if (need) return need;
  const lk = ipLocked(ip, "portrait"); const b = busyOn("portrait");
  const mats = ip.origin.mode === "material" ? ip.origin.materials.filter(u => !/\.(mp4|mov)$/i.test(u)) : [];
  return `<div class="blk ai-box"><div class="row-actions"><button class="btn primary sm" data-act="ip-gen" data-k="portrait" ${lk || b ? "disabled" : ""}>${spinBtn(b, ip.portraits.length ? "再来 4 张" : "生成 4 张定妆照", "生成中")}</button>
      <label class="btn line sm ${lk ? "disabled" : ""}">上传定妆照<input type="file" hidden accept="image/png,image/jpeg,image/webp" data-in="ip-upload" data-k="portrait" ${lk ? "disabled" : ""}></label>
      <span class="px faint end">会调用 4 次生图${mats.length ? ` · 参考 ${mats.length} 张素材` : ""}</span></div>
      <p class="px faint">按设定里的固定外观出全身定妆照。挑一张最像的锁定，之后所有画面都以它为准。${ip.kind === "creator" ? "真人博主也可以直接上传一张本人的标准照。" : ""}</p></div>
    ${ipGrid(ip, ip.portraits, ip.portrait, "portrait", "3 / 4", b ? 4 : 0)}
    ${ip.portrait ? ipLockBar(ip, "portrait", "锁定定妆照，做三视图 →") : ""}`;
}
// 03 三视图
function ipTabSheet(ip) {
  const need = ipNeed(ip, "sheet", "出三视图"); if (need) return need;
  const lk = ipLocked(ip, "sheet"); const b = busyOn("sheet");
  return `<div class="blk ai-box"><div class="row-actions"><button class="btn primary sm" data-act="ip-gen" data-k="sheet" ${lk || b ? "disabled" : ""}>${spinBtn(b, ip.sheets.length ? "再来 2 张" : "生成三视图", "生成中")}</button><label class="btn line sm ${lk ? "disabled" : ""}">上传三视图<input type="file" hidden accept="image/png,image/jpeg,image/webp" data-in="ip-upload" data-k="sheet" ${lk ? "disabled" : ""}></label><span class="px faint end">以定妆照为参考 · 会调用 2 次生图</span></div>
      <p class="px faint">正面、侧面、背面并排。三视图会和定妆照一起作为参考图，转身、侧脸的镜头会更稳。</p></div>
    ${ipGrid(ip, ip.sheets, ip.sheet, "sheet", "16 / 9", b ? 2 : 0)}
    ${ip.sheet ? ipLockBar(ip, "sheet", "锁定三视图，做表情 →") : ""}`;
}
function ipGrid(ip, list, chosen, k, ratio, pending) {
  if (!list.length && !pending) return `<div class="empty-card"><span class="px faint">还没有${k === "portrait" ? "定妆照" : "三视图"}。</span></div>`;
  const lk = ipLocked(ip, k);
  return `<div class="ip-cands ${k}">${Array.from({ length: pending }, () => `<div class="ip-cand ghost" style="aspect-ratio:${ratio}"><span class="spin"></span></div>`).join("")}${list.map(u => `<div class="ip-cand ${u === chosen ? "on" : ""}" style="aspect-ratio:${ratio}"><img src="${attr(u)}" alt="" loading="lazy">${u === chosen ? `<span class="tag px">${lk ? `${icon("lock")}已锁定` : "选中"}</span>` : ""}
      <div class="ip-cand-acts">${lk ? "" : `<button class="btn ${u === chosen ? "primary" : "line"} sm" data-act="ip-pick" data-k="${k}" data-url="${attr(u)}">${u === chosen ? "已选" : "选这张"}</button>`}${k !== "portrait" && ip.portrait ? ipCheckBtn(ip, u) : ""}${lk ? "" : `<button class="btn quiet sm icon" data-act="ip-drop" data-k="${k}" data-url="${attr(u)}" title="删掉这张" aria-label="删掉这张">${icon("x")}</button>`}</div>${ipCheckNote(ip, u)}</div>`).join("")}</div>`;
}
function ipCheckBtn(ip, url) { const c = ip.checks?.[url]; const b = busyOn(`check:${url}`); return `<button class="btn quiet sm ip-chk ${c ? (c.score >= 90 ? "ok" : c.score >= 70 ? "mid" : "bad") : ""}" data-act="ip-check" data-url="${attr(url)}" ${b ? "disabled" : ""} title="和定妆照对比，看是不是同一个角色">${b ? `<span class="spin"></span>比对中` : c ? `一致性 ${c.score}` : "一致性检查"}</button>`; }
function ipCheckNote(ip, url) { const c = ip.checks?.[url]; if (!c || IPW.checkOpen !== url) return ""; return `<div class="ip-chk-note"><b class="px">${esc(c.verdict)}</b>${c.issues?.length ? `<ul>${c.issues.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div>`; }
// 04 表情
function ipTabExpr(ip) {
  const need = ipNeed(ip, "expr", "做表情"); if (need) return need;
  const lk = ipLocked(ip, "expr"); const todo = ip.expressions.filter(e => !e.url).length; const running = ip.expressions.some(e => busyOn(`expr:${e.id}`));
  return `<div class="blk ai-box"><div class="row-actions"><button class="btn primary sm" data-act="ip-expr-all" ${lk || running || !ip.expressions.length ? "disabled" : ""}>${running ? `<span class="spin"></span>生成中` : todo ? `生成 ${todo} 个表情` : "全部重画"}</button><button class="btn line sm" data-act="ip-expr-export" ${ip.expressions.some(e => e.url) ? "" : "disabled"}>导出表情包拼图</button><span class="px faint end">以定妆照为参考 · 每个表情调用 1 次生图</span></div>
      <div class="ip-expr-names">${ip.expressions.map(e => `<span class="chip">${esc(e.name)}${lk ? "" : `<button data-act="ip-expr-del" data-id="${attr(e.id)}" aria-label="去掉${attr(e.name)}">${icon("x")}</button>`}</span>`).join("")}${!lk && ip.expressions.length < 16 ? `<span class="ip-expr-add"><input data-in="ip-misc" data-key="exprAdd" value="${attr(IPW.exprAdd)}" placeholder="加一个表情" maxlength="8"><button class="btn quiet sm" data-act="ip-expr-add">添加</button></span>` : ""}</div></div>
    <div class="ip-expr-grid">${ip.expressions.map(e => { const b = busyOn(`expr:${e.id}`); return `<div class="ip-expr ${e.url ? "" : "empty"}"><div class="ip-expr-img">${e.url ? `<img src="${attr(e.url)}" alt="${attr(e.name)}" loading="lazy">` : b ? `<span class="spin"></span>` : `<span class="px faint">${e.error ? "失败了" : "未生成"}</span>`}</div><div class="ip-expr-f"><b class="px">${esc(e.name)}</b>${lk ? "" : `<button class="btn quiet sm" data-act="ip-expr-one" data-id="${attr(e.id)}" ${b ? "disabled" : ""}>${e.url ? "重画" : "生成"}</button>`}${e.url && ip.portrait ? ipCheckBtn(ip, e.url) : ""}</div>${e.url ? ipCheckNote(ip, e.url) : ""}</div>`; }).join("")}</div>
    ${ip.expressions.some(e => e.url) ? ipLockBar(ip, "expr", "锁定表情，完成建档 →") : ""}`;
}
// 作品：用 IP 立项
function ipTabWorks(ip) {
  const w = ipWorks(ip); const b = busyOn("topics");
  return `<div class="blk ai-box"><span class="px faint">用「${esc(ip.name || "这个 IP")}」开一个新项目，它会被设成出镜 IP</span>
      <div class="ip-quick"><input data-in="ip-misc" data-key="topicIdea" value="${attr(IPW.topicIdea)}" placeholder="自己写一个选题，比如：${esc(ip.name || "它")}带你拆一支爆款"><button class="btn primary sm" data-act="ip-project" data-title="">立项</button></div>
      <div class="row-actions"><button class="btn line sm" data-act="ip-topics" ${b ? "disabled" : ""}>${spinBtn(b, ip.topics.length ? "换一批选题" : "让 AI 想 6 个选题", "构思中")}</button>${ipDoneCount(ip) < 4 ? `<span class="px faint end">还没建完档也能立项，没锁定的形象不会用作参考图</span>` : ""}</div>
      ${ip.topics.length ? `<div class="ip-topics">${ip.topics.map((t, i) => `<div class="ip-topic"><span class="px faint">${String(i + 1).padStart(2, "0")} · ${esc(t.format || "")}</span><b>${esc(t.title)}</b><p>${esc(t.hook || "")}</p><button class="btn line sm" data-act="ip-project" data-title="${attr(t.title)}" data-hook="${attr(t.hook || "")}">用这个立项 →</button></div>`).join("")}</div>` : ""}
    </div>
    <div class="blk"><span class="px faint">出镜作品 · ${w.length}</span>${w.length ? `<div class="ip-works">${w.map(p => { const cur = outline(p).find(s => s.current); const th = p.script.find(r => r.imageUrl)?.imageUrl || p.coverDesign?.backgroundImage || ""; return `<button class="ip-work" data-act="open-project" data-id="${attr(p.id)}"><span class="th">${th ? `<img src="${attr(th)}" alt="">` : ""}</span><span class="t">${esc(p.title || "未命名项目")}</span><span class="px faint">${esc(p.platform)} · ${cur ? `下一步 ${cur.name}` : "全部完成"} · ${when(p.updatedAt)}</span></button>`; }).join("")}</div>` : `<p class="empty-line">还没有作品。立项后，项目里的脚本、画面和封面都会出现在这里。</p>`}</div>`;
}
// 锚点
function ipTabAnchor(ip) {
  const a = ip.anchor; const refs = ipRefs(ip);
  return `<div class="blk"><div class="paper-card ip-explain"><b class="px">锚点怎么用</b><p>在项目里把它设成「出镜 IP」后，脚本会用它的口吻写，并在它出镜的镜头里写上名字「${esc(ip.name || "…")}」。之后任何生图（分镜画面、封面背景、画布图片节点），只要文字里出现这个名字，就会自动带上下面这组锚点；画布里把「IP 角色」节点连到图片 / 视频节点也一样。</p></div></div>
    <div class="blk"><div class="style-grid one">
      <label class="sfield ${a.prompt ? "filled" : ""}"><span class="px">固定外观描述（留空就用设定里的外观）</span><textarea data-in="ip-anchor" data-key="prompt" rows="4" placeholder="${attr(ip.profile.look || "只写外观、画风和固定特征，不写动作和场景")}">${esc(a.prompt)}</textarea></label>
      <label class="sfield ${a.negative ? "filled" : ""}"><span class="px">避免</span><textarea data-in="ip-anchor" data-key="negative" rows="2" placeholder="比如：不要眼镜，不要写实人脸">${esc(a.negative)}</textarea></label>
    </div></div>
    <div class="blk"><span class="px faint">参考图（最多 4 张，按顺序使用）</span><div class="ip-refs">
      ${ip.portrait ? `<div class="ip-ref"><img src="${attr(ip.portrait)}" alt=""><span class="px">定妆照</span></div>` : `<div class="ip-ref none"><span class="px faint">定妆照未锁定</span></div>`}
      ${ip.sheet ? `<div class="ip-ref wide ${a.useSheet === false ? "off" : ""}"><img src="${attr(ip.sheet)}" alt=""><label class="px"><input type="checkbox" data-in="ip-usesheet" ${a.useSheet === false ? "" : "checked"}>三视图</label></div>` : ""}
      ${(a.refs || []).map((u, i) => `<div class="ip-ref"><img src="${attr(u)}" alt=""><button class="x" data-act="ip-ref-del" data-i="${i}" aria-label="移除">${icon("x")}</button><span class="px">补充参考</span></div>`).join("")}
      ${refs.length < 4 ? `<label class="ip-ref add">${icon("plus")}<span class="px">补充参考图</span><input type="file" hidden accept="image/png,image/jpeg,image/webp" data-in="ip-upload" data-k="ref"></label>` : ""}
    </div></div>
    <div class="blk"><span class="px faint">实际加进提示词的内容</span><pre class="ip-pre">${esc(ipInject({ cast: [ip.id] }, `（你的画面描述，里面提到了「${ip.name || "名字"}」）`).prompt)}</pre></div>`;
}

// ---------- AI ----------
// 3.7：IP 工作台的生成也进任务中心；你在别的页面时，完成提示带「去看看」
function ipJob(ip, key, kind, label, tab, retry) {
  return jqStart({ key: `ip:${ip?.id || "new"}:${key}`, kind, label: ip?.name ? `${ip.name} · ${label}` : label, ipId: ip?.id || "", phase: kind === "image" ? "等模型出图" : "模型在写", retry,
    where: () => route.view === "ip" && (!ip || IPW.id === ip.id) && !jqCovered(),
    go: () => { if (ip && (state.ips || []).some(x => x.id === ip.id)) { IPW.id = ip.id; if (tab) IPW.tab = tab; } go("ip"); } });
}
async function ipCreate() {
  if (!needText()) return;
  const d = IPW.draft; const st = IPW.start; const kind = IPW.kind;
  if (st === "idea" && !d.idea.trim()) { $("[data-key='idea']")?.focus(); return toast("先用一句话说说这个 IP", 2400, "err"); }
  if (st === "material" && !d.materials.length) return toast("先上传至少一张图片或一段视频", 2600, "err");
  if (st === "dna" && !account(d.accountId)) return toast("先选一个账号 DNA", 2400, "err");
  if (kind === "creator" && !d.consent) return toast("真人博主需要先确认是本人或已获授权", 3200, "err");
  await ipBusy("create", async () => {
    try {
      const images = [];
      for (const m of d.materials) { if (m.kind === "video") images.push(...(m.frames || []).slice(0, 4)); else images.push(await ipThumb(m.url)); }
      const acc = st === "dna" ? account(d.accountId) : null;
      var j = ipJob(null, "create", "ip", "起草 IP 设定", "profile", () => ipCreate());
      const r = await postJson("/api/generate", { action: "ip_profile", project: { ipKind: kind, platform: acc?.platform || "抖音" }, account: acc || {}, instruction: st === "material" ? d.note : d.idea, selectedText: st === "material" ? `用户上传了 ${d.materials.length} 份素材（${d.materials.map(m => m.kind === "video" ? "视频" : "图片").join("、")}），请从画面里提炼外观和气质${d.note ? `；补充：${d.note}` : ""}` : "", images: images.slice(0, 8) }, { signal: j.signal });
      const ip = blankIp(kind); ip.consent = kind === "creator";
      ip.origin = { mode: st, idea: d.idea, accountId: d.accountId, materials: d.materials.map(m => m.url) };
      ipApplyProfile(ip, r.result);
      ip.expressions = (r.result.expressions?.length ? r.result.expressions : IP_EXPR_DEFAULT).slice(0, 8).map(name => ({ id: uid("ex"), name: String(name).slice(0, 8), url: "", status: "" }));
      state.ips = [ip, ...(state.ips || [])]; IPW.draft = { idea: "", note: "", accountId: "", materials: [], consent: false };
      IPW.id = ip.id; IPW.tab = "profile"; save();
      j.ipId = ip.id; j.go = () => { IPW.id = ip.id; IPW.tab = "profile"; go("ip"); };
      jqEnd(j, `「${ip.name}」的设定起草好了，改到满意再锁定`); petEvent("text");
    } catch (e) { if (j) jqFail(j, e); else toast(e.message, 6000, "err"); }
  });
}
function ipApplyProfile(ip, r = {}) {
  if (r.name) ip.name = String(r.name).slice(0, 20);
  const pr = ip.profile;
  ["tagline", "personality", "backstory", "voice", "relations", "look"].forEach(k => { if (typeof r[k] === "string" && r[k].trim()) pr[k] = r[k].trim(); });
  ["catchphrases", "rules", "outfits", "ideas"].forEach(k => { if (Array.isArray(r[k]) && r[k].length) pr[k] = r[k].map(String).filter(Boolean).slice(0, 10); });
  if (Array.isArray(r.palette)) { const pal = r.palette.map(String).filter(c => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 6); if (pal.length) pr.palette = pal; }
  if (typeof r.prompt === "string" && r.prompt.trim()) ip.anchor.prompt = r.prompt.trim();
  if (typeof r.negative === "string") ip.anchor.negative = r.negative.trim();
  ip.updatedAt = now();
}
async function ipRegen(ip) {
  if (!needText() || ipLocked(ip, "profile")) return;
  await ipBusy("profile", async () => {
    const j = ipJob(ip, "profile", "ip", "重新起草设定", "profile", () => ipRegen(ip));
    try {
      const r = await postJson("/api/generate", { action: "ip_profile", project: { ipKind: ip.kind, platform: account(ip.origin.accountId)?.platform || "抖音" }, account: account(ip.origin.accountId) || {}, instruction: IPW.regen || "在保留核心设定的前提下，让它更鲜明、更好记", selectedText: `现有设定（在这个基础上修改，名字没有要求就不要改）：\n${ipProfileText(ip)}` }, { signal: j.signal });
      const keep = ip.name; ipApplyProfile(ip, r.result); if (!/名字|改名|换个名/.test(IPW.regen || "")) ip.name = keep;
      IPW.regen = ""; ipTouch(ip); jqEnd(j, "设定已更新"); petEvent("text");
    } catch (e) { jqFail(j, e); }
  });
}
function ipPrompt(ip, k, extra = "") {
  const look = ipAnchorText(ip) || ip.profile.look || ip.name; const neg = ip.anchor.negative ? `\n避免：${ip.anchor.negative}` : "";
  if (k === "portrait") return `IP 角色定妆照：${look}。全身站姿，正面略侧，表情自然，干净的浅色纯色背景，角色居中，完整展示发型、服装和配饰。${neg}`;
  if (k === "sheet") return `IP 角色三视图（character turnaround sheet）：${look}。同一个角色的正面、侧面、背面三个全身像从左到右并排，纯白背景，三个视图大小和比例完全一致，和参考图是同一个角色。不要任何文字和标注。${neg}`;
  return `IP 角色表情包：${look}。表情 / 动作：「${extra}」，夸张、清楚、一眼能看懂。半身特写，纯色浅背景，角色居中，适合做聊天表情。和参考图是同一个角色。${neg}`;
}
async function ipGen(ip, k) {
  if (!needImage()) return;
  if (!ipReady(ip, k) || ipLocked(ip, k)) return;
  const count = k === "portrait" ? 4 : 2;
  await ipBusy(k, async () => {
    const j = ipJob(ip, k, "image", k === "portrait" ? "定妆照" : "三视图", k, () => ipGen(ip, k));
    try {
      const refs = k === "portrait" ? (ip.origin.mode === "material" ? ip.origin.materials.filter(u => !/\.(mp4|mov)$/i.test(u)).slice(0, 3) : []) : [ip.portrait];
      const d = await postJson("/api/image", { area: "image.canvas", prompt: ipPrompt(ip, k), ratio: k === "portrait" ? "3:4" : "16:9", count, refs, requestedModel: "auto" }, { signal: j.signal });
      const imgs = (d.images?.length ? d.images : [d.imageUrl]).filter(Boolean);
      const key = k === "portrait" ? "portraits" : "sheets";
      ip[key] = [...imgs, ...ip[key].filter(u => !imgs.includes(u))].slice(0, 12);
      if (!ip[k]) ip[k] = imgs[0] || "";
      ipTouch(ip); jqEnd(j, `${k === "portrait" ? "定妆照" : "三视图"}出了 ${imgs.length} 张 · ${d.model}${d.partial ? ` · ${d.partial}` : ""}`, { ms: 3200 }); petEvent("image", imgs.length);
    } catch (e) { jqFail(j, e); }
  });
}
async function ipGenExpr(ip, ids) {
  if (!needImage() || !ip.portrait) return;
  const list = ip.expressions.filter(e => ids.includes(e.id) && !busyOn(`expr:${e.id}`)); if (!list.length) return;
  let i = 0; let ok = 0;
  const one = async e => ipBusy(`expr:${e.id}`, async () => {
    const j = ipJob(ip, `expr:${e.id}`, "image", `表情「${e.name}」`, "expr", () => ipGenExpr(ip, [e.id]));
    try { const d = await postJson("/api/image", { area: "image.canvas", prompt: ipPrompt(ip, "expr", e.name), ratio: "1:1", count: 1, refs: ipRefs(ip).slice(0, 2), requestedModel: "auto" }, { signal: j.signal }); e.url = d.imageUrl || d.images?.[0] || ""; e.error = ""; ok++; ipTouch(ip); jqEnd(j, list.length === 1 ? `表情「${e.name}」画好了` : ""); }
    catch (err) { const ab = jqFail(j, err, { quiet: list.length > 1 }); e.error = ab ? "" : err.message; ipTouch(ip); }
  });
  const worker = async () => { while (i < list.length) await one(list[i++]); };
  await Promise.all([worker(), worker()]);
  if (list.length > 1) toast(ok === list.length ? `${ok} 个表情都画好了` : `画好 ${ok} 个，${list.length - ok} 个没成功，可以单独重画`, 3200, ok === list.length ? "" : "err");
  if (ok) petEvent("image", ok);
}
async function ipCheck(ip, url) {
  if (!needText() || !ip.portrait) return;
  if (ip.checks?.[url]) { IPW.checkOpen = IPW.checkOpen === url ? "" : url; return ipRefresh(); }
  await ipBusy(`check:${url}`, async () => {
    try {
      var j = ipJob(ip, `check:${url}`, "ip", "一致性检查", IPW.tab, () => ipCheck(ip, url));
      const images = [await ipThumb(ip.portrait, 768), await ipThumb(url, 768)];
      const r = await postJson("/api/generate", { action: "ip_check", project: { ipKind: ip.kind }, account: {}, selectedText: ipProfileText(ip), images }, { signal: j.signal });
      ip.checks = { ...(ip.checks || {}), [url]: { score: clamp(Number(r.result.score) || 0, 0, 100), verdict: String(r.result.verdict || ""), issues: (r.result.issues || []).map(String).slice(0, 6), at: now() } };
      IPW.checkOpen = url; ipTouch(ip);
      const s = ip.checks[url].score; jqEnd(j, ""); toast(s >= 90 ? `一致性 ${s}：基本是同一个角色` : s >= 70 ? `一致性 ${s}：有小偏差，可以重画` : `一致性 ${s}：不太像，建议重画`, 3600, s >= 70 ? "" : "err");
    } catch (e) { if (j) jqFail(j, e); else toast(e.message, 6000, "err"); }
  });
}
async function ipTopics(ip) {
  if (!needText()) return;
  await ipBusy("topics", async () => {
    const j = ipJob(ip, "topics", "ip", "AI 想选题", "works", () => ipTopics(ip));
    try {
      const acc = account(ip.origin.accountId);
      const r = await postJson("/api/generate", { action: "ip_topics", project: { ipKind: ip.kind, platform: acc?.platform || "抖音" }, account: acc || {}, selectedText: ipProfileText(ip), instruction: "" }, { signal: j.signal });
      ip.topics = (r.result.topics || []).filter(t => t && t.title).slice(0, 8).map(t => ({ title: String(t.title), hook: String(t.hook || ""), format: String(t.format || "") }));
      ipTouch(ip); jqEnd(j, jqHere(j) ? "" : `${ip.name} 的 ${ip.topics.length} 个选题想好了`); petEvent("text");
    } catch (e) { jqFail(j, e); }
  });
}
function ipNewProject(ip, title, hook = "") {
  const t = (title || IPW.topicIdea || "").trim(); if (!t) { $("[data-key='topicIdea']")?.focus(); return toast("先写一个选题，或者点 AI 想的选题", 2600, "err"); }
  const acc = account(ip.origin.accountId);
  const p = blankProject(t, acc?.platform && PLATFORM_PROFILES[acc.platform] ? acc.platform : "抖音", acc ? acc.id : "");
  p.cast = [ip.id]; if (hook) p.brief = `开场钩子参考（${ip.name} 的口吻）：${hook}`;
  ensureStructure(p); p.view.step = "style";
  state.projects.unshift(p); IPW.topicIdea = ""; save();
  go("project", p.id); toast(`已立项，「${ip.name}」是这个项目的出镜 IP`);
}
// 表情包拼图（PNG）
async function ipExportExpr(ip) {
  const list = ip.expressions.filter(e => e.url); if (!list.length) return;
  const cols = Math.min(4, list.length), rows = Math.ceil(list.length / cols), cell = 256, pad = 20, lab = 34, head = 92;
  const c = document.createElement("canvas"); c.width = pad + cols * (cell + pad); c.height = head + rows * (cell + lab + pad) + pad; const g = c.getContext("2d");
  g.fillStyle = "#F4F4F2"; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#0B0B0B"; g.fillRect(0, 0, c.width, 6);
  try { await document.fonts?.load?.('24px "Fusion Pixel"'); } catch (_) {}
  g.font = '28px "Fusion Pixel", "PingFang SC", sans-serif'; g.textBaseline = "top"; g.fillText(`${ip.name || "IP"} 表情包`, pad, 28);
  g.font = '14px "Fusion Pixel", "PingFang SC", sans-serif'; g.fillStyle = "#6E6E6E"; g.fillText(`${list.length} 个表情 · 帧比特 IP 工作台`, pad, 64);
  const load = u => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = u; });
  for (let i = 0; i < list.length; i++) {
    const x = pad + (i % cols) * (cell + pad), y = head + Math.floor(i / cols) * (cell + lab + pad);
    g.fillStyle = "#FFFFFF"; g.fillRect(x, y, cell, cell); g.strokeStyle = "#0B0B0B"; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
    const im = await load(list[i].url); if (im) { const k = Math.min((cell - 8) / im.naturalWidth, (cell - 8) / im.naturalHeight); const w = im.naturalWidth * k, h = im.naturalHeight * k; g.drawImage(im, x + (cell - w) / 2, y + (cell - h) / 2, w, h); }
    g.fillStyle = "#0B0B0B"; g.font = '16px "Fusion Pixel", "PingFang SC", sans-serif'; g.fillText(list[i].name, x, y + cell + 10);
  }
  c.toBlob(b => { if (b) { download(`${ip.name || "IP"}-表情包.png`, b); toast("表情包拼图已导出"); } }, "image/png");
}

// ---------- 删除 / 纸篓 ----------
function ipDelete(id) {
  const ip = ipById(id); if (!ip) return;
  if (IPW.del !== id) { IPW.del = id; clearTimeout(IPW.delT); IPW.delT = setTimeout(() => { IPW.del = ""; ipRefresh(); }, 3500); return ipRefresh(); }
  IPW.del = "";
  trashPush({ kind: ip.portrait ? "image" : "text", name: `IP · ${ip.name || "未命名"}`, preview: ip.portrait || ip.profile.tagline || "", from: { pid: "", title: "IP 工作台" }, payload: { type: "ip", ip: copy(ip) } });
  state.ips = state.ips.filter(x => x.id !== id);
  state.projects.forEach(p => { p.cast = (p.cast || []).filter(x => x !== id); });
  IPW.id = ""; save(); renderIp(); toast(`「${ip.name || "这个 IP"}」移到纸篓了，可以还原`);
}

// ---------- 项目里：出镜 IP ----------
function ipCastField(p) {
  const all = state.ips || [];
  return `<div class="blk"><span class="px faint">出镜 IP（最多 3 个，第一个是主角）</span>${all.length ? `<div class="ip-cast">${all.map(ip => { const on = (p.cast || []).includes(ip.id); const i = (p.cast || []).indexOf(ip.id); return `<button class="ip-cast-c ${on ? "on" : ""}" data-act="ip-cast" data-id="${attr(ip.id)}" aria-pressed="${on}">${ip.portrait ? `<img src="${attr(ip.portrait)}" alt="">` : `<i class="ph"></i>`}<span><b>${esc(ip.name || "未命名")}</b><em class="px">${on ? (i === 0 ? "主角" : "配角") : IP_KIND_LABEL[ip.kind]}</em></span></button>`; }).join("")}<a href="#" class="px ip-cast-go" data-act="go" data-to="ip">管理 IP →</a></div>
    ${(p.cast || []).length ? `<p class="px faint">脚本会用 IP 的口吻写，它出镜的镜头会写上名字；生成画面时提到名字，会自动套用它的定妆照和三视图。</p>` : ""}` : `<div class="empty-card"><span class="px faint">还没有 IP。在 IP 工作台建一个角色或人设，就能让它在项目里出镜。</span><button class="btn line sm" data-act="go" data-to="ip">去 IP 工作台</button></div>`}</div>`;
}
function ipShotBadge(p, text) { const inj = ipInject(p, text); return inj.ips.length ? `<span class="ip-badge px" title="生成画面时会带上 ${attr(inj.ips.map(x => x.name).join("、"))} 的定妆照和三视图">${icon("ip")}${esc(inj.ips.map(x => x.name).join("、"))}</span>` : ""; }

// ---------- 画布：IP 角色节点 ----------
Object.assign(NODE_W, { ip: 220 });
FREE_TYPES.push("ip");
Object.assign(FREE_LABEL, { ip: "IP 角色" });
Object.assign(TYPE_TAG, { ip: "IP" });
Object.assign(TYPE_HINT, { ip: "连到图片 / 视频 / 文本，带上 IP 的形象和口吻" });
// 新建节点时默认选项目的主角 IP；读存档时 state 还没就绪，只给空值
Object.assign(BASES, { ip: () => ({ ipId: (state && route.view === "project" ? project()?.cast?.[0] : "") || state?.ips?.[0]?.id || "" }) });
Object.assign(MAP_COLOR, { ip: "#C7DEC4" });
OUT_OK.ip = ["image", "video", "text"];
MENU_ORDER.ip = ["image", "video", "text"];
TAU.ip = 10;
function ipNodeMeta(p, n) { const ip = ipById(n.data.ipId); return ip ? IP_KIND_LABEL[ip.kind] : ""; }
function ipNodeBody(p, n) {
  const ip = ipById(n.data.ipId);
  if (!ip) return `<div class="cn-ip none">${(state.ips || []).length ? `<span class="px faint">选中这个节点，在下面挑一个 IP</span>` : `<span class="px faint">还没有 IP，先去 IP 工作台建一个</span>`}</div>`;
  return `<div class="cn-ip">${ip.portrait ? `<img class="cn-media" src="${attr(ip.portrait)}" alt="" draggable="false">` : `<div class="ip-ph sm" aria-hidden="true"><i class="h"><b></b><b></b></i><i class="c"></i><i class="b"></i></div>`}<div class="cn-ip-t"><b class="px">${esc(ip.name)}</b><span>${esc(ip.profile.tagline || "")}</span><span class="px faint">${ipRefs(ip).length} 张参考图 · ${ipStatus(ip)}</span></div></div>`;
}
function ipComposer(p, n) {
  const ip = ipById(n.data.ipId); const id = attr(n.id);
  return `<div class="cf t-ip"><div class="cf-row"><select data-in="node" data-field="ipId" data-dd-class="cfdd ipdd" aria-label="选择 IP"><option value="">选一个 IP</option>${(state.ips || []).map(x => `<option value="${attr(x.id)}" ${x.id === n.data.ipId ? "selected" : ""}>${esc(x.name || "未命名")}</option>`).join("")}</select><span class="grow"></span>${ip ? `<button class="cf-btn" data-act="ip-open" data-id="${attr(ip.id)}">${icon("ip")}打开 IP 主页</button>` : `<button class="cf-btn" data-act="go" data-to="ip">去 IP 工作台</button>`}</div>
    <div class="cf-foot"><span class="px faint">${ip ? "连到图片 / 视频节点：带上定妆照和三视图做参考；连到文本节点：润色时用它的口吻" : "IP 节点不生成内容，它把形象和口吻传给下游"}</span><button class="cf-link" data-act="cn-out-menu" data-id="${id}">接一个下游节点</button></div></div>`;
}
function ipProps(p, n) {
  const ip = ipById(n.data.ipId);
  return `<div class="props"><span class="px faint">IP 角色节点</span>${ip ? `${ipPortraitBox(ip)}<b class="px-24">${esc(ip.name)}</b><p class="dim" style="font-size:13px">${esc(ip.profile.tagline)}</p><pre class="ip-pre">${esc(ipAnchorText(ip))}</pre><button class="btn line sm" data-act="ip-open" data-id="${attr(ip.id)}">打开 IP 主页</button>` : `<p class="dim" style="font-size:13px">还没选 IP。</p>`}<button class="btn quiet" data-act="delete-node" data-id="${attr(n.id)}">删除节点</button></div>`;
}

// ---------- 事件 ----------
Object.assign(EXT_ACTS, {
  "ip-start": el => { IPW.start = el.dataset.start; renderIp(); },
  "ip-kind": el => { IPW.kind = el.dataset.kind; renderIp(); },
  "ip-create": () => ipCreate(),
  "ip-open": el => { IPW.id = el.dataset.id; IPW.tab = (() => { const ip = ipById(el.dataset.id); if (!ip) return "profile"; const k = IP_STAGES.find(([x]) => !ipLocked(ip, x)); return k ? k[0] : "works"; })(); IPW.checkOpen = ""; if (route.view !== "ip") go("ip"); else renderIp(); },
  "ip-back": () => { IPW.id = ""; renderIp(); },
  "ip-tab": el => { const ip = ipNow(); if (!ip) return; const k = el.dataset.tab; if (ipStageIndex(k) > 0 && !ipReady(ip, k) && !ipLocked(ip, k)) { toast(`先锁定「${IP_STAGES[ipStageIndex(k) - 1][1]}」`, 2400, "err"); } IPW.tab = k; IPW.checkOpen = ""; renderIp(); },
  "ip-regen": () => { const ip = ipNow(); if (ip) ipRegen(ip); },
  "ip-lock": el => {
    const ip = ipNow(); if (!ip) return; const k = el.dataset.k;
    if (k === "profile" && !ip.name.trim()) return toast("先给它起个名字", 2400, "err");
    if (k === "profile" && !ipAnchorText(ip)) return toast("先写固定外观，定妆要靠它", 2600, "err");
    if (k === "portrait" && !ip.portrait) return toast("先选一张定妆照", 2400, "err");
    if (k === "sheet" && !ip.sheet) return toast("先选一张三视图", 2400, "err");
    if (k === "expr" && !ip.expressions.some(e => e.url)) return toast("至少画好一个表情", 2400, "err");
    ip.locks[k] = now(); ipTouch(ip);
    const next = IP_STAGES[ipStageIndex(k) + 1]; IPW.tab = next ? next[0] : "works";
    renderIp(); toast(next ? `已锁定，接着做${next[1]}` : `「${ip.name}」建档完成，可以用它立项了`); petEvent("text");
  },
  "ip-unlock": el => { const ip = ipNow(); if (!ip) return; delete ip.locks[el.dataset.k]; ipTouch(ip); renderIp(); toast(el.dataset.k === "profile" ? "已解锁。改了外观以后，定妆照和三视图可能需要重做" : "已解锁，可以修改了", 3200); },
  "ip-gen": el => { const ip = ipNow(); if (ip) ipGen(ip, el.dataset.k); },
  "ip-pick": el => { const ip = ipNow(); if (!ip || ipLocked(ip, el.dataset.k)) return; ip[el.dataset.k] = el.dataset.url; ipTouch(ip); renderIp(); },
  "ip-drop": el => { const ip = ipNow(); if (!ip || ipLocked(ip, el.dataset.k)) return; const key = el.dataset.k === "portrait" ? "portraits" : "sheets"; ip[key] = ip[key].filter(u => u !== el.dataset.url); if (ip[el.dataset.k] === el.dataset.url) ip[el.dataset.k] = ip[key][0] || ""; ipTouch(ip); renderIp(); },
  "ip-check": el => { const ip = ipNow(); if (ip) ipCheck(ip, el.dataset.url); },
  "ip-expr-all": () => { const ip = ipNow(); if (!ip) return; const todo = ip.expressions.filter(e => !e.url); ipGenExpr(ip, (todo.length ? todo : ip.expressions).map(e => e.id)); },
  "ip-expr-one": el => { const ip = ipNow(); if (ip) ipGenExpr(ip, [el.dataset.id]); },
  "ip-expr-del": el => { const ip = ipNow(); if (!ip || ipLocked(ip, "expr")) return; ip.expressions = ip.expressions.filter(e => e.id !== el.dataset.id); ipTouch(ip); renderIp(); },
  "ip-expr-add": () => { const ip = ipNow(); const v = IPW.exprAdd.trim(); if (!ip || !v) return; if (ip.expressions.some(e => e.name === v)) return toast("已经有这个表情了", 2000); ip.expressions.push({ id: uid("ex"), name: v.slice(0, 8), url: "", status: "" }); IPW.exprAdd = ""; ipTouch(ip); renderIp(); setTimeout(() => $("[data-key='exprAdd']")?.focus(), 0); },
  "ip-expr-export": () => { const ip = ipNow(); if (ip) ipExportExpr(ip); },
  "ip-topics": () => { const ip = ipNow(); if (ip) ipTopics(ip); },
  "ip-project": el => { const ip = ipNow(); if (ip) ipNewProject(ip, el.dataset.title, el.dataset.hook); },
  "ip-del": el => ipDelete(el.dataset.id),
  "ip-pal-add": () => { const ip = ipNow(); if (!ip) return; ip.profile.palette.push("#FFD23F"); ipTouch(ip); renderIp(); },
  "ip-pal-pop": () => { const ip = ipNow(); if (!ip) return; ip.profile.palette.pop(); ipTouch(ip); renderIp(); },
  "ip-ref-del": el => { const ip = ipNow(); if (!ip) return; ip.anchor.refs.splice(+el.dataset.i, 1); ipTouch(ip); renderIp(); },
  "ip-mat-del": el => { IPW.draft.materials.splice(+el.dataset.i, 1); renderIp(); },
  "ip-cast": el => {
    const p = project(); if (!p) return; const id = el.dataset.id; const on = p.cast.includes(id);
    if (!on && p.cast.length >= 3) return toast("一个项目最多 3 个出镜 IP", 2400, "err");
    p.cast = on ? p.cast.filter(x => x !== id) : [...p.cast, id]; touch(p); renderProject();
    if (!on) toast(`「${ipById(id)?.name || "IP"}」会出镜。重新生成脚本时会用它的口吻`, 3200);
  }
});
Object.assign(EXT_INS, {
  "ip-draft": (el, t) => { const k = el.dataset.key; if (el.type === "checkbox") { if (t === "change") IPW.draft[k] = el.checked; return; } if (el.tagName === "SELECT" ? t === "change" : t === "input") IPW.draft[k] = el.value; },
  "ip-misc": (el, t) => { if (t !== "input") return; const k = el.dataset.key; if (k === "regen") IPW.regen = el.value; else IPW[k] = el.value; },
  "ip-name": (el, t) => { if (t !== "input") return; const ip = ipNow(); if (!ip || ipLocked(ip, "profile")) return; ip.name = el.value.trim().slice(0, 20); ipTouch(ip); },
  "ip-prof": (el, t) => {
    if (t !== "input") return; const ip = ipNow(); if (!ip || ipLocked(ip, "profile")) return; const k = el.dataset.key;
    ip.profile[k] = ["catchphrases", "outfits"].includes(k) ? el.value.split(/[，,、/]/).map(x => x.trim()).filter(Boolean) : k === "rules" ? el.value.split("\n").map(x => x.trim()).filter(Boolean) : el.value;
    el.closest(".sfield")?.classList.toggle("filled", Boolean(el.value.trim())); ipTouch(ip);
  },
  "ip-pal": (el, t) => { const ip = ipNow(); if (!ip || ipLocked(ip, "profile")) return; ip.profile.palette[+el.dataset.i] = el.value.toUpperCase(); const sw = el.closest(".sw"); if (sw) { sw.style.setProperty("--c", el.value); const s = sw.querySelector("span"); if (s) s.textContent = el.value.toUpperCase(); } if (t === "change") ipTouch(ip); },
  "ip-anchor": (el, t) => { if (t !== "input") return; const ip = ipNow(); if (!ip) return; ip.anchor[el.dataset.key] = el.value; el.closest(".sfield")?.classList.toggle("filled", Boolean(el.value.trim())); ipTouch(ip); const pre = $(".ip-pre"); if (pre) pre.textContent = ipInject({ cast: [ip.id] }, `（你的画面描述，里面提到了「${ip.name || "名字"}」）`).prompt; },
  "ip-usesheet": (el, t) => { if (t !== "change") return; const ip = ipNow(); if (!ip) return; ip.anchor.useSheet = el.checked; ipTouch(ip); renderIp(); },
  "ip-upload": async (el, t) => {
    if (t !== "change" || !el.files?.[0]) return; const ip = ipNow(); if (!ip) return; const k = el.dataset.k;
    try {
      const d = await uploadAsset(el.files[0], 20_000_000); if (d.mediaType !== "image") throw new Error("这里只能放图片");
      if (k === "portrait") { ip.portraits = [d.assetUrl, ...ip.portraits].slice(0, 12); ip.portrait = d.assetUrl; }
      else if (k === "sheet") { ip.sheets = [d.assetUrl, ...ip.sheets].slice(0, 8); ip.sheet = d.assetUrl; }
      else { ip.anchor.refs = [...ip.anchor.refs, d.assetUrl].slice(0, 2); }
      ipTouch(ip); renderIp(); toast("已上传");
    } catch (e) { toast(e.message, 5000, "err"); } finally { el.value = ""; }
  },
  "ip-mat": async (el, t) => {
    if (t !== "change" || !el.files?.length) return;
    const files = [...el.files].slice(0, 4 - IPW.draft.materials.length);
    for (const f of files) {
      try {
        const d = await uploadAsset(f, 200_000_000);
        if (d.mediaType === "video") { toast("正在从视频里抽帧…", 2000); const r = await rmExtract(d.assetUrl); IPW.draft.materials.push({ url: d.assetUrl, kind: "video", frames: (r.frames || []).map(x => x.dataUrl || x).filter(x => typeof x === "string").slice(0, 4) }); }
        else if (d.mediaType === "image") IPW.draft.materials.push({ url: d.assetUrl, kind: "image" });
        else throw new Error("只能放图片或视频");
      } catch (e) { toast(e.message, 5000, "err"); }
    }
    el.value = ""; renderIp();
  }
});
