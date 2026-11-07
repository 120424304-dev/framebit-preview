"use strict";
// 帧比特 3.3 · 首页、资料库、设置、模型连接

const lib = { tab: "accounts", accId: "", draft: null };
const pendingDelete = { id: "", t: null };

function go(view, projectId = "") {
  if (cd.open) closeCover();
  route = { view, projectId: view === "project" ? projectId : route.projectId };
  ui.exportOpen = false; ui.menu = null; ddClose(true);
  if (view === "project") { ui.sel = ""; ui.tab = "ai"; }
  const last = { view: view === "project" ? "project" : "home", projectId: view === "project" ? projectId : "" };
  if (state.last?.view !== last.view || state.last?.projectId !== last.projectId) { state.last = last; save(); }
  render();
}
function render() {
  if (route.view === "project" && project()) { renderProject(); return; }
  if (route.view === "project") route.view = "home";
  if (route.view === "ip") { renderIp(); return; }
  if (route.view === "library") renderLibrary();
  else if (route.view === "settings") { renderSettings(); return; }
  else renderHome();
}
function afterRender(key) { indicators($("#view")); motion(key, $("#view")); }
function topNav(active, light = false) {
  const connected = (apiState.connectedProviders || []).length;
  return `<header class="topbar"><a href="#" class="brand" data-act="go" data-to="home"><i></i><span>帧比特</span></a>
    <nav class="seg" data-seg="nav" aria-label="主导航">${[["home", "首页"], ["ip", "IP 工作台"], ["library", "资料库"], ["settings", "设置"]].map(([k, l]) => `<a href="#" class="${active === k ? "on" : ""}" data-act="go" data-to="${k}" ${active === k ? 'aria-current="page"' : ""}>${l}</a>`).join("")}</nav>
    ${connected ? `<button class="btn line sm" data-act="open-api"><span class="dot on"></span>${connected > 1 ? `${connected} 个平台` : esc(apiState.providerLabel)}</button>` : `<button class="btn primary sm" data-act="open-api">预览版说明</button>`}
    ${jqBtn()}${trashBtn()}
  </header>`;
}

// ---------- 首页 ----------
function createProject(topic, platform = "抖音", accountId = "", cast = []) {
  const p = blankProject(topic.trim(), PLATFORM_PROFILES[platform] ? platform : "抖音", accountId);
  p.cast = cast.filter(id => ipById(id)).slice(0, 3);
  ensureStructure(p);
  if (p.topic) p.view.step = "style";
  state.projects.unshift(p); save();
  go("project", p.id);
  if (p.topic) toast("已立项。下一步定风格画像，也可以随时回到「选题立项」修改");
  return p;
}
function renderHome() {
  document.documentElement.dataset.theme = state.theme === "light" ? "light" : "dark";
  const list = state.projects.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const accOpts = `<option value="">暂不指定</option>${state.accounts.map(a => `<option value="${attr(a.id)}">${esc(a.name || "未命名账号")}</option>`).join("")}<option value="__new">新建账号 DNA…</option>`;
  $("#view").innerHTML = `${topNav("home")}<div class="view" style="flex:1"><div class="home">
    <section class="home-hero" data-stagger>
      <span class="badge px dim"><span class="dot"></span>预览版 · 项目只存在这个浏览器里</span>
      <h1 class="px-96">今天拍什么？</h1>
      <form class="composer" data-submit="new-project">
        <label for="topic" class="sr">选题</label>
        <textarea id="topic" placeholder="一句话说出选题，AI 编导会接着帮你定风格、写脚本"></textarea>
        <div class="row">
          <label class="pick">平台<select id="newPlatform">${Object.keys(PLATFORM_PROFILES).map(k => `<option>${k}</option>`).join("")}</select></label>
          <label class="pick">账号<select id="newAccount" data-in="new-account">${accOpts}</select></label>
          ${(state.ips || []).length ? `<label class="pick">出镜 IP<select id="newIp"><option value="">不指定</option>${state.ips.map(x => `<option value="${attr(x.id)}">${esc(x.name || "未命名")}</option>`).join("")}</select></label>` : ""}
          <button class="send" type="submit" aria-label="开始">${svgArrow}</button>
        </div>
      </form>
    </section>
    ${(apiState.connectedProviders || []).length ? "" : `<div class="notice">这是帧比特的预览版：编导流程、画布、IP 工作台都可以直接体验，项目只存在你自己的浏览器里。AI 写作和生成图片、视频、配乐需要帧比特 Mac App。<button class="btn line sm" data-act="open-api">预览版说明</button></div>`}
    ${(() => { const lp = state.projects.find(x => x.id === state.last?.projectId) || list[0]; if (!lp) return ""; const nx = nextStep(lp); return `<button class="continue" data-act="open-project" data-id="${attr(lp.id)}"><span class="px faint">继续</span><span class="t">${esc(lp.title || "未命名项目")}</span><span class="px dim">${nx ? `下一步　${nx.no} ${nx.name}` : "全部完成，可以导出"}</span><span class="rail-progress mini" aria-hidden="true">${outline(lp).map(x => `<i class="${x.done ? "on" : ""}"></i>`).join("")}</span><span class="arrow">→</span></button>`; })()}
    <section class="home-list" aria-label="项目">
      <div class="list-head"><h2 class="px dim">项目</h2><span class="px faint">${list.length}</span><button class="btn quiet sm end" data-act="blank-project">空白项目</button></div>
      <div data-stagger>${list.length ? list.map(p => { const cur = outline(p).find(s => s.current); return `<div class="project-row" role="link" tabindex="0" data-act="open-project" data-id="${attr(p.id)}"><span class="t">${esc(p.title || "未命名项目")}</span><span class="px faint">${esc(p.platform)}</span><span class="px dim c3">${cur ? `下一步　${cur.name}` : "全部完成"}</span><span class="rail-progress mini c5" aria-hidden="true">${outline(p).map(x => `<i class="${x.done ? "on" : ""}"></i>`).join("")}</span><span class="px faint c4">${when(p.updatedAt)}</span><span class="acts"><button class="btn quiet sm" data-act="dup-project" data-id="${attr(p.id)}">复制</button><button class="btn quiet sm" data-act="del-project" data-id="${attr(p.id)}">${pendingDelete.id === p.id ? "确认删除" : "删除"}</button></span></div>`; }).join("") : `<p class="empty-line">还没有项目。写下第一个选题，它会出现在这里，下次打开从停下的地方继续。</p>`}</div>
    </section>
  </div></div>`;
  heroFx($(".home"));
  afterRender("home");
}
function delProject(id) {
  if (pendingDelete.id !== id) { pendingDelete.id = id; clearTimeout(pendingDelete.t); pendingDelete.t = setTimeout(() => { pendingDelete.id = ""; if (route.view === "home") renderHome(); }, 3500); renderHome(); return; }
  pendingDelete.id = ""; const dp = state.projects.find(p => p.id === id); if (dp) trashProject(dp); state.projects = state.projects.filter(p => p.id !== id); save(); renderHome(); toast("项目已移到纸篓，右上角纸篓里可以还原");
}
function dupProject(id) {
  const src = state.projects.find(p => p.id === id); if (!src) return;
  const c = normalizeProject({ ...copy(src), id: uid("p"), title: `${src.title}（副本）`, versions: [], chat: [], createdAt: now(), updatedAt: now() });
  state.projects.unshift(c); save(); renderHome(); toast("已复制");
}

// ---------- 资料库（浅灰纸面） ----------
function renderLibrary() {
  document.documentElement.dataset.theme = state.theme === "light" ? "light" : "dark";
  const assets = [];
  state.projects.forEach(p => { p.script.forEach((r, i) => r.imageUrl && assets.push({ url: r.imageUrl, kind: "image", label: `${p.title} / 分镜 ${i + 1}` })); p.canvas.nodes.forEach(n => { const im = nodeImage(p, n), v = nodeVideo(n); if (n.type !== "shot" && im) assets.push({ url: im, kind: "image", label: p.title }); if (v) assets.push({ url: v, kind: "video", label: p.title }); }); if (p.coverDesign?.backgroundImage) assets.push({ url: p.coverDesign.backgroundImage, kind: "image", label: `${p.title} / 封面` }); });
  const uniq = assets.filter((a, i) => assets.findIndex(b => b.url === a.url) === i);
  const counts = { accounts: state.accounts.length, styles: state.styles.length, assets: uniq.length };
  let main = "";
  if (lib.tab === "accounts") {
    const a = state.accounts.find(x => x.id === lib.accId) || lib.draft || (lib.draft = blankAccount());
    const isNew = !state.accounts.some(x => x.id === a.id);
    main = `${state.accounts.length ? `<div class="acc-list">${state.accounts.map(x => `<button class="${x.id === a.id ? "on" : ""}" data-act="lib-acc" data-id="${attr(x.id)}"><span>${esc(x.name || "未命名账号")}</span><span class="px faint">${esc(x.platform)}　${state.projects.filter(p => p.accountId === x.id).length} 个项目</span></button>`).join("")}<button data-act="lib-acc-new"><span>新建账号 DNA</span><span class="px faint">+</span></button></div>` : ""}
      <div class="sheet"><div class="holes" aria-hidden="true">${"<i></i>".repeat(5)}</div><form class="body" data-submit="save-account">
        <div class="sheet-head"><h2 class="px-24">${isNew ? "新建账号 DNA" : esc(a.name || "未命名账号")}</h2><span class="px faint">${isNew ? (state.accounts.length ? "" : "还没有账号") : "修改后点保存"}</span></div>
        ${ACCOUNT_FIELDS.map(([k, l, ph]) => `<label class="line-field"><span>${l}</span>${k === "platform" ? `<select data-acc="${k}">${Object.keys(PLATFORM_PROFILES).map(x => `<option ${x === a.platform ? "selected" : ""}>${x}</option>`).join("")}</select>` : `<input data-acc="${k}" value="${attr(a[k] || "")}" placeholder="${attr(ph)}">`}</label>`).join("")}
        <div class="sheet-foot"><button class="btn primary" type="submit">保存账号 DNA</button>${isNew ? "" : `<button class="btn danger" type="button" data-act="lib-acc-del" data-id="${attr(a.id)}">删除</button>`}</div>
      </form></div>`;
  } else if (lib.tab === "styles") {
    main = state.styles.length ? state.styles.map(s => `<div class="style-card"><div class="row"><b class="px">${esc(s.name)}</b><span class="px faint">${esc(s.platform)}　${fmtTime(s.savedAt)}</span><button class="btn quiet sm end" data-act="lib-style-del" data-id="${attr(s.id)}">删除</button></div><p style="font-size:13px;color:var(--muted)">${esc([s.style.audience, s.style.voice, s.style.duration].filter(Boolean).join("；"))}</p></div>`).join("") : `<p class="empty-line">还没有记住的风格画像。在项目里填好画像后点「记住这份画像」，它会出现在这里，下个项目可以直接套用。</p>`;
  } else {
    main = `${uniq.length ? `<div class="tiles">${uniq.map(a => `<a class="tile" href="${attr(a.url)}" download><div class="frame">${a.kind === "video" ? `<video src="${attr(a.url)}" muted preload="metadata"></video>` : `<img src="${attr(a.url)}" alt="">`}</div><span class="px faint">${esc(a.label)}</span></a>`).join("")}</div>` : `<p class="empty-line">还没有素材。项目里生成或上传的图片、视频会自动出现在这里。</p>`}`;
  }
  $("#view").innerHTML = `<div class="theme-light" style="flex:1;display:flex;flex-direction:column;min-height:0;background:var(--bg);color:var(--text)">${topNav("library", true)}<div class="view"><div class="doc">
    <section class="doc-side"><h1 class="px-48 doc-title">资料库</h1><p class="px doc-note">账号 DNA、风格画像和素材在这里统一管理，每个项目都能直接复用。</p>
      <nav class="doc-nav" aria-label="资料类型">${[["accounts", "账号 DNA"], ["styles", "风格画像"], ["assets", "素材"]].map(([k, l]) => `<button class="${lib.tab === k ? "on" : ""}" data-act="lib-tab" data-tab="${k}"><span>${l}</span><span class="faint">${counts[k]}</span></button>`).join("")}</nav></section>
    <section class="doc-main" data-stagger>${main}</section></div></div></div>`;
  afterRender(`library:${lib.tab}:${lib.accId}`);
}

// ---------- 设置 ----------
async function renderSettings() {
  document.documentElement.dataset.theme = state.theme === "light" ? "light" : "dark";
  let backups = []; try { backups = (await (await fetch("/api/backups")).json()).backups || []; } catch (_) {}
  let routes = null; if ((apiState.connectedProviders || []).length) { try { routes = await (await fetch("/api/routes")).json(); } catch (_) {} }
  const conn = new Set(apiState.connectedProviders || []);
  $("#view").innerHTML = `<div class="theme-light" style="flex:1;display:flex;flex-direction:column;min-height:0;background:var(--bg);color:var(--text)">${topNav("settings", true)}<div class="view"><div class="doc">
    <section class="doc-side"><h1 class="px-48 doc-title">设置</h1><p class="px doc-note">帧比特 ${APP_VERSION} 网页版。项目和素材只保存在这个浏览器里。</p></section>
    <section class="doc-main" data-stagger>
      ${webSettingsSection()}
      <div class="set-sec"><h2 class="px">数据</h2><p style="font-size:13px;color:var(--muted)">项目自动保存在这个浏览器里，每 10 分钟留一份自动备份，最多 8 份。换电脑、换浏览器或清理网站数据之前，先导出备份；导出的备份里包含素材。</p><div style="display:flex;flex-wrap:wrap;gap:8px"><button class="btn line sm" data-act="export-data">导出备份</button><label class="btn line sm" style="cursor:var(--cur-pointer, pointer)">导入备份<input type="file" hidden accept="application/json" data-in="import-data"></label></div>
        ${backups.length ? `<div>${backups.slice(0, 12).map(b => `<div class="ver-row"><span>${fmtTime(b.savedAt)}</span><span class="px faint">${Math.max(1, Math.round(b.size / 1024))} KB</span><button class="btn quiet sm" data-act="restore-backup" data-name="${attr(b.name)}">恢复</button></div>`).join("")}</div>` : `<p class="faint" style="font-size:13px">还没有自动备份。</p>`}</div>
      <div class="set-sec"><h2 class="px">桌宠 Bit</h2><p style="font-size:13px;color:var(--muted)">Lv.${petLevel()} ${esc(petRank())}　·　${state.pet.coins} bitcoin　·　家园评分 ${bhRating()}。导出交付物料会给 Bit 成长值，每天登录和创作会攒 bitcoin。</p><div style="display:flex;flex-wrap:wrap;gap:8px"><button class="btn line sm" data-act="pet-toggle">${state.pet.hidden ? "让 Bit 出来" : "先把 Bit 收起来"}</button><button class="btn line sm" data-act="pet-home">打开 Bit 家园</button><button class="btn quiet sm" data-act="pet-reset-pos">把 Bit 放回右下角</button></div></div>
      <div class="set-sec"><h2 class="px">外观</h2><div class="seg" data-seg="theme"><button class="${state.theme !== "light" ? "on" : ""}" data-act="theme" data-theme="dark">深色</button><button class="${state.theme === "light" ? "on" : ""}" data-act="theme" data-theme="light">浅色</button></div><p class="faint" style="font-size:12px">资料库和设置始终使用浅灰纸面。</p></div>
      <div class="set-sec"><h2 class="px">快捷键</h2><div class="keys">${[["⌘K", "命令面板：跳到步骤、打开项目、运行 AI、导出"], ["⌘E", "在流程和画布之间切换"], ["⌘[ / ⌘]", "上一步 / 下一步"], ["⌘S", "立即保存"], ["F", "专注：收起两侧面板"], ["⌘Enter", "发送给 AI 编导"], ["Delete", "删除画布上选中的节点或连线"], ["⌘0", "画布适应窗口"], ["V / H", "画布：选择 / 抓手；按住空格临时拖动"], ["⌘D / ⌘A", "画布：复制选中节点 / 全选"], ["⌘Enter", "画布：在生成面板里直接生成"], ["双击空白处", "画布：添加节点（1–4 快速选择）"], ["点 Bit", "打开轮盘：对话 / 抚摸 / 家园；按住可以拖动"]].map(([k, d]) => `<div class="kv"><span class="kbd">${k}</span><span class="dim">${d}</span></div>`).join("")}</div></div>
      <div class="set-sec"><h2 class="px">关于</h2><p style="font-size:13px;color:var(--muted)">帧比特 ${APP_VERSION}。界面字体 Fusion Pixel 12px，SIL Open Font License 1.1。</p></div>
    </section></div></div></div>`;
  afterRender("settings");
}
// 模型分配：每个功能区单独指定平台和模型；「自动」按已连接的平台自动选择
function routesSection(r) {
  if (!r?.areas) return `<div class="set-sec"><h2 class="px">模型分配</h2><p style="font-size:13px;color:var(--muted)">连接一个模型平台后，可以在这里给编导对话、写作、审稿、画布文本、分镜画面、画布生图、封面背景、分镜视频、画布生视频和画布配乐分别指定模型。推荐 ToAPIs，一个 Key 覆盖全部功能区。</p><button class="btn line sm" style="align-self:flex-start" data-act="open-api" data-provider="toapis">连接 ToAPIs</button></div>`;
  const groups = [...new Set(r.areas.map(a => a.group))];
  const sel = a => {
    const opts = r.options?.[a.kind] || [];
    const cur = a.route?.provider && a.route.provider !== "auto" ? `${a.route.provider}|${a.route.model || "auto"}` : "auto";
    const lab = m => { const sp = r.specs?.[a.kind]?.[m]; const t = sp?.label || (a.kind === "text" ? r.specs?.text?.[m] : ""); return t ? `${t}　${m}` : m; };
    const eff = a.effective?.label ? `自动（${a.effective.label}${a.effective.auto ? ` · ${lab(a.effective.auto).split("　")[0]}` : ""}）` : "自动";
    const body = opts.map(o => `<optgroup label="${attr(o.label)}"><option value="${attr(o.provider)}|auto">${esc(o.label)} · 自动选择</option>${o.models.map(m => `<option value="${attr(`${o.provider}|${m}`)}">${esc(lab(m))}${o.provider === a.effective?.provider && m === a.effective?.auto ? "　· 自动时使用" : ""}</option>`).join("")}</optgroup>`).join("");
    const html = `<select data-in="route" data-area="${attr(a.key)}" aria-label="${attr(a.label)}模型"><option value="auto">${esc(eff)}</option>${body}</select>`;
    return opts.length ? html.replace(`value="${attr(cur)}"`, `value="${attr(cur)}" selected`) : `<span class="faint" style="font-size:12px">还没有连接支持${{ text: "语言", image: "生图", video: "生视频", audio: "音乐" }[a.kind]}的平台</span>`;
  };
  return `<div class="set-sec routes"><h2 class="px">模型分配</h2><p style="font-size:13px;color:var(--muted)">每个功能区用哪个平台的哪个模型。选「自动」时按已连接的平台挑选；手动指定的平台断开后，会自动回落到可用平台。</p>
    ${groups.map(g => `<div class="route-grp"><span class="px faint">${esc(g)}</span>${r.areas.filter(a => a.group === g).map(a => `<div class="route-row"><span class="rl"><b>${esc(a.label)}</b><em>${esc(a.hint)}</em></span>${sel(a)}</div>`).join("")}</div>`).join("")}
  </div>`;
}
async function saveRoute(area, value) {
  const [provider, model] = value === "auto" ? ["auto", "auto"] : value.split("|");
  try {
    const r = await postJson("/api/routes", { routes: { [area]: { provider, model: model || "auto" } } });
    const a = r.areas.find(x => x.key === area);
    toast(`${a.label}：${a.route.provider === "auto" ? `自动（${a.effective.label || "未连接"}）` : `${a.effective.label} · ${a.route.model === "auto" ? "自动选择" : a.route.model}`}`);
    await health(); await loadModels(true);
  } catch (e) { toast(e.message, 5000, "err"); }
}
const pendingRestore = { name: "" };
async function restoreBackup(name, btn) {
  if (pendingRestore.name !== name) { pendingRestore.name = name; btn.textContent = "确认恢复"; return; }
  pendingRestore.name = "";
  try { const rec = await (await fetch(`/api/backups/${encodeURIComponent(name)}`)).json(); applyImported(rec.state || rec, "已恢复备份"); }
  catch (e) { toast(`恢复失败：${e.message}`, 5000, "err"); }
}
function applyImported(raw, msg) {
  state = normalizeState(raw); state.theme ||= "dark";
  recoveryMode = false; storageConflict = false; $("#conflict").classList.remove("show");
  saveQ.dirty = true; flushSave(true); go("home"); toast(`${msg}，共 ${state.projects.length} 个项目`);
}

// ---------- 模型连接 ----------
function openApi(provider = "") {
  $("#providerInput").value = provider || ((apiState.connectedProviders || []).length ? apiState.provider : "toapis") || "toapis";
  delete $("#regionInput").dataset.touched;
  $("#apiMessage").textContent = ""; $("#apiKey").value = "";
  $("#rememberKeys").checked = Boolean(apiState.rememberKeys);
  updateProviderForm();
  if (!$("#apiDialog").open) $("#apiDialog").showModal();
  setTimeout(() => $("#apiKey").focus(), 30);
}
function updateProviderForm() {
  const id = $("#providerInput").value; const c = PROVIDER_CONFIG[id] || PROVIDER_CONFIG.openai; const conn = new Set(apiState.connectedProviders || []);
  $("#provTabs").innerHTML = Object.entries(PROVIDER_CONFIG).map(([k, v]) => `<button type="button" class="${k === id ? "on" : ""}" data-act="pick-provider" data-provider="${k}"><span class="dot ${conn.has(k) ? "on" : ""}"></span>${esc(v.label.replace(" API", ""))}</button>`).join("");
  $("#apiKeyLabel").textContent = c.keyLabel;
  $("#apiKey").placeholder = conn.has(id) ? "已连接。留空保持当前密钥，或粘贴新的替换" : "粘贴平台生成的 API Key";
  const reg = $("#provRegion"); reg.hidden = !c.regions;
  let link = c.link;
  if (c.regions) {
    const cur = $("#regionInput").dataset.touched ? $("#regionInput").value : (apiState.toapisRegion || "global");
    $("#regionInput").value = cur;
    $("#regionSeg").innerHTML = Object.entries(c.regions).map(([k, [label, base]]) => `<button type="button" class="${k === cur ? "on" : ""}" data-act="pick-region" data-region="${k}">${esc(label)}<span class="faint">${esc(base.replace("https://", ""))}</span></button>`).join("");
    link = c.link.replace("https://toapis.com", c.regions[cur][1]);
  }
  $("#provHint").innerHTML = `<span>${esc(c.hint)}</span><a href="${attr(link)}" target="_blank" rel="noreferrer">${esc(c.linkLabel)} ↗</a>${c.regions ? `<span class="faint" style="font-size:12px">在控制台登录并创建令牌后，复制粘贴到下面。帧比特不会替你登录或读取浏览器里的任何信息。</span>` : ""}`;
  $("#disconnectApi").hidden = !conn.has(id);
}
async function configureApi(body) { apiState = await postJson("/api/config", body); modelCache.key = ""; await loadModels(); return apiState; }
async function health() {
  try { apiState = await (await fetch("/api/health")).json(); } catch (_) { apiState = { connected: false, connectedProviders: [], capabilities: {} }; }
  loadModels();
}
