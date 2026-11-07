"use strict";
// 帧比特 3.2 · 事件委托、快捷键、启动

const P = () => project();
const selNode = () => nodeOf(P(), ui.sel);

const ACTS = {
  "go": el => go(el.dataset.to),
  "open-project": el => go("project", el.dataset.id),
  "blank-project": () => createProject("", "抖音", ""),
  "dup-project": (el, ev) => { ev.stopPropagation(); dupProject(el.dataset.id); },
  "del-project": (el, ev) => { ev.stopPropagation(); delProject(el.dataset.id); },
  "open-api": el => openApi(el.dataset.provider || ""),
  "pick-region": el => { $("#regionInput").value = el.dataset.region; $("#regionInput").dataset.touched = "1"; updateProviderForm(); },
  "pick-provider": el => { $("#providerInput").value = el.dataset.provider; $("#apiMessage").textContent = ""; $("#apiKey").value = ""; updateProviderForm(); $("#apiKey").focus(); },
  "theme": el => { state.theme = el.dataset.theme; save(); render(); },
  "export-data": () => download(recoveryMode ? `帧比特-原始数据-${new Date().toISOString().slice(0, 10)}.json` : `帧比特-备份-${new Date().toISOString().slice(0, 10)}.json`, recoveryMode ? recoveryRaw : JSON.stringify(state, null, 2), "application/json"),
  "reveal": async el => { try { const d = await postJson("/api/reveal", { target: el.dataset.target }); if (!d.ok) toast(`文件夹位置：${d.path}`, 6000); } catch (e) { toast(e.message, 4000, "err"); } },
  "restore-backup": el => restoreBackup(el.dataset.name, el),
  "lib-tab": el => { lib.tab = el.dataset.tab; renderLibrary(); },
  "lib-acc": el => { lib.accId = el.dataset.id; lib.draft = null; renderLibrary(); },
  "lib-acc-new": () => { lib.accId = ""; lib.draft = blankAccount(); renderLibrary(); },
  "lib-acc-del": el => { const id = el.dataset.id; const used = state.projects.filter(p => p.accountId === id).length; state.accounts = state.accounts.filter(a => a.id !== id); state.projects.forEach(p => { if (p.accountId === id) p.accountId = ""; }); lib.accId = ""; lib.draft = null; save(); renderLibrary(); toast(used ? `账号已删除，${used} 个项目改为不指定账号` : "账号已删除"); },
  "lib-style-del": el => { state.styles = state.styles.filter(s => s.id !== el.dataset.id); save(); renderLibrary(); },

  // 项目
  "tab": el => { ui.tab = el.dataset.tab; renderProject(); },
  "open-step": el => openStep(el.dataset.step, { flow: el.dataset.flow === "1" }),
  "mode": el => setMode(el.dataset.mode),
  "palette": () => paletteOpen(),
  "toggle-panel": () => { ui.panels.right = !ui.panels.right; renderProject(); },
  "batch-images": () => batchImages(),
  "flow-video": el => flowVideo(el.dataset.id),
  "del-shot": el => { const p = P(); const n = shotNode(p, el.dataset.id); if (n) deleteNode(p, n.id); else { snapshot(p, "删除镜头前"); const r = p.script.find(x => x.id === el.dataset.id); if (r) trashShot(p, r); p.script = p.script.filter(r => r.id !== el.dataset.id); ensureStructure(p); touch(p); renderProject(); } },
  "canvas-node": el => { setMode("canvas"); requestAnimationFrame(() => selectNode(el.dataset.id, { center: true })); },
  "flow-cover-bg": el => { const p = P(); ensureDesign(p).backgroundImage = el.dataset.url; p.coverImageUrl = el.dataset.url; touch(p); renderProject(); toast("已设为封面背景"); },
  "copy-text": async el => { const v = el.dataset.field ? P()[el.dataset.field] : el.dataset.text; if (!v) return toast("没有可复制的内容", 2000, "err"); try { await navigator.clipboard.writeText(v); toast("已复制"); } catch (_) { const t = document.createElement("textarea"); t.value = v; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); toast("已复制"); } },
  "save-version": () => { const p = P(); snapshot(p, "手动保存"); touch(p); renderProject(); toast("已存为一个版本"); },
  "dup-node": el => duplicateNodes(P(), [el.dataset.id]),
  "export-menu": () => { ui.exportOpen = !ui.exportOpen; renderProject(); },
  "export": el => doExport(el.dataset.kind),
  "versions": () => openVersions(),
  "restore-version": el => { const p = P(); if (restoreVersion(p, el.dataset.id)) { touch(p); $("#versionsDialog").close(); setSel([]); renderProject(); toast("已恢复，恢复前的状态也存成了一个版本"); } },
  "add-node": el => addFreeNode(el.dataset.type),
  "menu-add": el => menuAdd(el.dataset.type),
  // 画布 3.4
  "cv-tool": el => { ui.tool = el.dataset.tool; const st = $("[data-stage]"); if (st) { st.classList.toggle("tool-hand", ui.tool === "hand"); st.classList.toggle("tool-select", ui.tool === "select"); } $$(".cv-tools [data-act='cv-tool']").forEach(b => b.classList.toggle("on", b.dataset.tool === ui.tool)); },
  "cv-zoom": el => { const p = P(); const st = $("[data-stage]"); if (!st) return; const r = st.getBoundingClientRect(); const d = Number(el.dataset.d); const v = p.canvas.viewport; const to = d === 0 ? 1 : clamp(v.zoom * (d > 0 ? 1.25 : .8), .15, 2.5); const wx = (r.width / 2 - v.x) / v.zoom, wy = (r.height / 2 - v.y) / v.zoom; tweenViewport(p, { zoom: to, x: r.width / 2 - wx * to, y: r.height / 2 - wy * to }, 260); save(); },
  "cn-pick": el => { const p = P(); const n = nodeOf(p, el.dataset.id); if (!n) return; n.data.pick = +el.dataset.i; n.data.imageUrl = n.data.images[n.data.pick] || ""; touch(p); canvasRefresh(p, n.id); },
  "cn-track": el => { const p = P(); const n = nodeOf(p, el.dataset.id); if (!n) return; n.data.track = +el.dataset.i; n.data.audioUrl = n.data.tracks[n.data.track]?.url || n.data.audioUrl; touch(p); canvasRefresh(p, n.id); },
  "cn-play": el => playAudio(el.dataset.id),
  "cn-run": el => cnRun(el.dataset.id),
  "cn-run-many": () => cnRunMany(selIds()),
  "cn-enhance": el => cnEnhance(el.dataset.id),
  "cn-polish": el => cnPolish(el.dataset.id),
  "cn-split": el => cnSplit(el.dataset.id),
  "cn-undo-text": el => { const p = P(); const n = nodeOf(p, el.dataset.id); if (!n?.data.prevText) return; [n.data.text, n.data.prevText] = [n.data.prevText, ""]; touch(p); canvasRefresh(p, n.id); renderComposer(); toast("已撤销润色", 1600); },
  "cn-out-menu": el => { const p = P(); const n = nodeOf(p, el.dataset.id); if (n) openAddMenu(p, n, "down", null); },
  "cn-focus": el => { const p = P(); const n = nodeOf(p, el.dataset.id); if (!n) return; pickSel(n.id); centerOn(p, n); },
  "cn-dup": () => duplicateNodes(P(), selIds()),
  "cn-del-sel": () => deleteNodes(P(), selIds()),
  "cn-rename": el => { const t = $(`[data-rename="${CSS.escape(el.dataset.id)}"]`); if (t) renameNode(P(), t); },
  "cn-select-all": () => { const p = P(); setSel(p.canvas.nodes.map(n => n.id), ui.sel || p.canvas.nodes[0]?.id); syncSelection(); },
  "edge-del": el => deleteEdge(P(), el.dataset.id),
  "resume-audio": el => resumeAudio(P().id, el.dataset.id),
  "fit": () => fitCanvas(P()),
  "toggle-focus": () => { const on = ui.panels.left || ui.panels.right; ui.panels = { left: !on, right: !on }; renderProject(); },
  "delete-node": el => deleteNodes(P(), isSel(el.dataset.id) && selIds().length > 1 ? selIds() : [el.dataset.id]),
  "quick": el => { const [act, arg] = el.dataset.q.split(":"); if (act === "ai-style") aiStyle(el); else if (act === "ai-run") generate(arg, "", el); else if (act === "open-step") openStep(arg, { flow: true }); else if (act === "sync-cut") ACTS["sync-cut"](); else if (act === "export") doExport(arg); else if (act === "batch-images") batchImages(); else if (act === "open-cover") openCover(); },
  "ai-style": el => aiStyle(el),
  "ai-run": el => generate(el.dataset.kind, ui.instr || "", el),
  "remember-style": () => rememberStyle(),
  "select-shot": el => { const n = shotNode(P(), el.dataset.id); if (n) selectNode(n.id, { center: true }); },
  "move-shot": el => { const p = P(); const i = p.script.findIndex(r => r.id === el.dataset.id); const j = i + Number(el.dataset.dir); if (i < 0 || j < 0 || j >= p.script.length) return; [p.script[i], p.script[j]] = [p.script[j], p.script[i]]; touch(p); renderProject(); },
  "add-shot": () => { const p = P(); p.script.push(shotRow({})); ensureStructure(p); touch(p); const n = shotNode(p, p.script[p.script.length - 1].id); if (p.view.mode === "canvas") selectNode(n.id, { center: true }); else { renderProject(); const rows = $$(".shot-row"); rows.at(-1)?.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "center" }); rows.at(-1)?.querySelector("textarea")?.focus({ preventScroll: true }); } },
  "rewrite-shot": el => { const r = P().script.find(x => x.id === el.dataset.id); openRewrite({ type: "shot", id: el.dataset.id }, r?.voice); },
  "rewrite-item": el => openRewrite({ type: "item", key: el.dataset.key, index: +el.dataset.index }, P()[el.dataset.key][+el.dataset.index]),
  "rewrite-field": el => openRewrite({ type: "field", key: el.dataset.field }, P()[el.dataset.field]),
  "add-item": el => { const p = P(); p[el.dataset.key].push(""); touch(p); renderProject(); $$(`[data-in="list"][data-key="${el.dataset.key}"]`).at(-1)?.focus(); },
  "del-item": el => { const p = P(); p[el.dataset.key].splice(+el.dataset.index, 1); touch(p); renderProject(); },
  "review-fix": el => generate("script", `根据审稿建议修改脚本：${P().review[+el.dataset.index].fix}`, el),
  "shot-image": el => shotImage(el.dataset.id),
  "shot-video": el => { const n = shotVideoNode(el.dataset.id); if (n) { selectNode(n.id, { center: true }); } },
  "run-image": el => runImage(el.dataset.id),
  "run-video": el => runVideo(el.dataset.id),
  "resume-video": el => resumeVideo(P().id, el.dataset.id),
  "as-cover-bg": el => { const p = P(); const n = nodeOf(p, el.dataset.id); const url = nodeImage(p, n); if (!url) return; n.data.imageUrl ||= url; ensureDesign(p).backgroundImage = url; p.coverImageUrl = n.data.imageUrl; ensureStructure(p, "publish"); touch(p); toast("已设为封面背景"); renderProject(); },
  "sync-cut": () => { const p = P(); const r = syncCut(p); if (p.view.mode === "canvas") selectNode(r.cut.id, { center: true }); else renderProject(); toast(r.total ? (r.added ? `已按分镜排入 ${r.added} 段` : "时间线已经是最新的") : "还没有生成好的视频", 3000, r.total ? "" : "err"); },
  "play-cut": () => playCut(),
  "clip-move": el => { const p = P(); const c = nodeByType(p, "cut").data.clips; const i = +el.dataset.index, j = i + Number(el.dataset.dir); if (j < 0 || j >= c.length) return; [c[i], c[j]] = [c[j], c[i]]; touch(p); renderProject(); },
  "clip-del": el => { const p = P(); nodeByType(p, "cut").data.clips.splice(+el.dataset.index, 1); touch(p); renderProject(); },
  "open-cover": () => openCover(),

  // 封面
  "cd-close": () => closeCover(),
  "cd-tool": el => { cd.tool = el.dataset.tool; renderCover(); },
  "cd-template": el => { const p = P(); const d = ensureDesign(p); cdPush(p); d.elements = templateEls(p, el.dataset.t); d.background = el.dataset.t === "paper" ? "#EDEDED" : "#111111"; cd.sel = ""; touch(p); renderCover(); },
  "cd-add": el => cdAdd(el.dataset.type, el.dataset.preset),
  "cd-select": el => { cd.sel = el.dataset.id; renderCover(); },
  "cd-undo": () => cdRestore("undo"), "cd-redo": () => cdRestore("redo"),
  "cd-dup": () => { const p = P(); const d = ensureDesign(p); const s = cdEl(p); if (!s) return; cdPush(p); const c = { ...copy(s), id: uid("layer"), x: +s.x + 28, y: +s.y + 28, z: Math.max(...d.elements.map(e => +e.z)) + 1 }; d.elements.push(c); cd.sel = c.id; touch(p); renderCover(); },
  "cd-del": () => { const p = P(); const d = ensureDesign(p); if (!cd.sel) return; cdPush(p); d.elements = d.elements.filter(e => e.id !== cd.sel); cd.sel = ""; touch(p); renderCover(); },
  "cd-grid": () => { const d = ensureDesign(P()); d.showGrid = !d.showGrid; touch(P()); renderCover(); },
  "cd-zoom": el => { cd.zoom = clamp(cd.zoom + Number(el.dataset.d) * .04, .15, .7); renderCover(); },
  "cd-fit": () => cdFit(),
  "cd-layer": el => { const p = P(); const d = ensureDesign(p); const e = cdEl(p); if (!e) return; const o = d.elements.slice().sort((a, b) => a.z - b.z); const i = o.indexOf(e); const j = el.dataset.dir === "fwd" ? i + 1 : i - 1; if (j < 0 || j >= o.length) return; cdPush(p); [e.z, o[j].z] = [o[j].z, e.z]; touch(p); renderCover(); },
  "cd-visible": () => { const p = P(); const e = cdEl(p); if (!e) return; cdPush(p); e.visible = e.visible === false; touch(p); renderCover(); },
  "cd-gen-bg": el => cdGenBg(el),
  "cd-clear-bg": () => { const p = P(); cdPush(p); ensureDesign(p).backgroundImage = ""; touch(p); renderCover(); },
  "cd-set-bg": el => { const p = P(); cdPush(p); ensureDesign(p).backgroundImage = el.dataset.url; touch(p); renderCover(); }
};

const INS = {
  "new-account": (el, t) => { if (t === "change" && el.value === "__new") { el.value = ""; ddSync(el); go("library"); lib.tab = "accounts"; lib.draft = blankAccount(); lib.accId = ""; renderLibrary(); } },
  "route": (el, t) => { if (t === "change") saveRoute(el.dataset.area, el.value); },
  "remember-keys": async (el, t) => { if (t !== "change") return; try { await configureApi({ rememberKeys: el.checked }); toast(el.checked ? "已开启：在本机记住密钥" : "已关闭，本机保存的密钥已删除"); } catch (e) { toast(e.message, 4000, "err"); } },
  "import-data": (el, t) => { if (t !== "change" || !el.files?.[0]) return; const r = new FileReader(); r.onload = () => { try { applyImported(JSON.parse(r.result), "导入完成"); } catch (e) { toast(`导入失败：${e.message}`, 5000, "err"); } finally { el.value = ""; } }; r.readAsText(el.files[0]); },
  "p-field": (el, t) => {
    const p = P(); const f = el.dataset.field;
    if (el.tagName === "SELECT" ? t !== "change" : t !== "input") return;
    p[f] = el.value;
    if (f === "topic" && (!p.title || p.title === p._autoTitle)) { p.title = el.value.slice(0, 40); p._autoTitle = p.title; const ti = $("#ptitle"); if (ti) { ti.value = p.title; ti.style.width = titleEm(p.title) + "em"; } }
    if (f === "title") el.style.width = titleEm(el.value) + "em";
    touch(p);
    if (el.tagName === "SELECT" || f === "title") { if (f !== "title") renderProject(); } else refreshNode(p, f === "topic" ? "topic" : f === "publishCopy" || f === "coverPlan" ? "publish" : "");
  },
  "style": (el, t) => { if (t !== "input") return; const p = P(); p.style[el.dataset.key] = el.value; p.styleSavedAt = ""; touch(p); refreshNode(p, "style"); },
  "apply-style": (el, t) => { if (t !== "change" || !el.value) return; const p = P(); const s = state.styles.find(x => x.id === el.value); if (!s) return; snapshot(p, "套用画像前"); p.style = { ...emptyStyle(), ...copy(s.style) }; p.styleMemoryId = s.id; p.styleSavedAt = s.savedAt; touch(p); renderProject(); toast(`已套用「${s.name}」`); },
  "ui-instr": (el, t) => { if (t === "input") ui.instr = el.value; },
  "shot": (el, t) => { if (t !== "input") return; const p = P(); const r = p.script.find(x => x.id === el.dataset.id); if (!r) return; r[el.dataset.key] = el.value; touch(p); refreshNode(p, "shot", shotNode(p, r.id)?.id); refreshNode(p, "script"); },
  "list": (el, t) => { if (t !== "input") return; const p = P(); p[el.dataset.key][+el.dataset.index] = el.value; touch(p); refreshNode(p, "publish"); },
  "node": (el, t) => {
    const p = P(); const n = selNode(); if (!n) return; if (el.tagName === "SELECT" ? t !== "change" : t !== "input") return;
    const f = el.dataset.field; let v = el.value;
    if (["count", "duration"].includes(f)) v = Number(v) || 1;
    if (f === "instrumental" || f === "audio") v = v !== "0";
    n.data[f] = v;
    if (f === "ipId") { touch(p); refreshNode(p, "", n.id); renderComposer(); if (ui.tab === "props") { const body = $(".panel-body"); if (body) body.innerHTML = renderProps(p, n); } return; }
    if (f === "model" || f === "frameMode") { normalizeNodeForModel(n); touch(p); refreshNode(p, "", n.id); renderComposer(); if (ui.tab === "props") { const body = $(".panel-body"); if (body) body.innerHTML = renderProps(p, n); } return; }
    if (f === "ratio" && n.type === "video") n.data.imageSize = RATIO_SIZE[v] || n.data.imageSize;
    // 浮动面板和右侧属性里的同一个字段保持一致
    $$(`[data-in="node"][data-field="${f}"]`).forEach(x => { if (x !== el && x.tagName === "TEXTAREA" && x.value !== el.value) x.value = el.value; });
    touch(p); refreshNode(p, "", n.id);
  },
  "node-title": (el, t) => { if (t !== "input") return; const p = P(); const n = selNode(); if (!n) return; n.title = el.value.slice(0, 40); touch(p); const nm = $(`[data-node="${CSS.escape(n.id)}"] .cn-name`); if (nm) nm.textContent = nodeTitle(p, n); },
  "cv-upload": (el, t) => { if (t !== "change" || !el.files?.length) return; const files = [...el.files]; el.value = ""; const m = ui.menu; closeMenu(); uploadToCanvas(files, m && m.wx != null ? { x: m.wx, y: m.wy } : null); },
  "cn-upload": async (el, t) => {
    if (t !== "change" || !el.files?.[0]) return;
    const p = P(); const n = nodeOf(p, el.dataset.id); if (!n) return;
    toast("正在保存…");
    try {
      const d = await uploadAsset(el.files[0]);
      if (d.mediaType !== n.type) throw new Error(`这里需要${FREE_LABEL[n.type]}文件`);
      if (n.type === "image") { n.data.images = [d.assetUrl, ...(n.data.images || [])].slice(0, 12); n.data.pick = 0; n.data.imageUrl = d.assetUrl; }
      if (n.type === "video") Object.assign(n.data, { videoUrl: d.assetUrl, status: "Succeed", error: "", source: "upload" });
      if (n.type === "audio") Object.assign(n.data, { audioUrl: d.assetUrl, tracks: [], error: "" });
      touch(p); canvasRefresh(p, n.id); renderComposer(); toast("已替换为上传的文件");
    } catch (e) { toast(e.message, 5000, "err"); }
  },
  "node-upload": async (el, t) => {
    if (t !== "change" || !el.files?.[0]) return;
    const p = P(); const id = el.closest("[data-node]")?.dataset.node || ui.sel; const n = nodeOf(p, id); if (!n) return;
    toast("正在保存…");
    try { const d = await uploadAsset(el.files[0]); Object.assign(n.data, { assetUrl: d.assetUrl, mediaType: d.mediaType, name: el.files[0].name }); touch(p); renderProject(); toast("素材已加入画布"); } catch (e) { toast(e.message, 5000, "err"); }
  },
  "shot-upload": async (el, t) => {
    if (t !== "change" || !el.files?.[0]) return;
    const p = P(); const r = p.script.find(x => x.id === el.dataset.id); if (!r) return;
    try { const d = await uploadAsset(el.files[0], 20_000_000); if (d.mediaType !== "image") throw new Error("这里只能放图片"); r.imageUrl = d.assetUrl; r.imageError = ""; r.imageModel = "上传"; touch(p); renderProject(); toast("画面已替换"); } catch (e) { toast(e.message, 5000, "err"); }
  },
  "clip": (el, t) => { if (t !== "change") return; const p = P(); const c = nodeByType(p, "cut")?.data.clips?.[+el.dataset.index]; if (!c) return; const f = el.dataset.field; c[f] = f === "title" ? el.value : Math.max(f === "in" ? 0 : .1, Number(el.value || 0)); touch(p); refreshNode(p, "cut"); },
  // 封面
  "cd-upload": async (el, t) => { if (t !== "change" || !el.files?.[0]) return; try { const d = await uploadAsset(el.files[0], 20_000_000); cdAdd("image", d.assetUrl); } catch (e) { toast(e.message, 4000, "err"); } },
  "cd-bg": (el, t) => { const p = P(); if (t === "input") { ensureDesign(p).background = el.value; const b = $("[data-artboard]"); if (b) b.style.backgroundColor = el.value; touch(p); } },
  "cd-prompt": (el, t) => { if (t !== "input") return; const p = P(); p.coverBackgroundPrompt = el.value; touch(p); },
  "cd-prop": (el, t) => { const p = P(); const e = cdEl(p); if (!e) return; const f = el.dataset.prop; if (t === "input" && cdBefore === "") cdBefore = JSON.stringify(ensureDesign(p)); e[f] = ["x", "y", "w", "h", "rotation", "opacity", "fontSize", "fontWeight", "borderRadius"].includes(f) ? Number(el.value) : el.value; touch(p); cdSync(e); if (t === "change") { if (cdBefore) cdPush(p, cdBefore); cdBefore = ""; if (f === "text") renderCover(); } }
};
let cdBefore = "";
Object.assign(ACTS, EXT_ACTS); Object.assign(INS, EXT_INS);

// 局部刷新节点，避免输入时整页重绘丢失焦点
function refreshNode(p, type, id = "") {
  const n = id ? nodeOf(p, id) : type ? nodeByType(p, type) : null; if (!n) return;
  const el = $(`[data-node="${CSS.escape(n.id)}"]`); if (!el) return;
  const tmp = document.createElement("div"); tmp.innerHTML = renderNode(p, n); const fresh = tmp.firstElementChild;
  fresh.classList.remove("fresh");
  el.replaceWith(fresh); drawEdges(); placeComposer(); tickProgress();
}

function openVersions() {
  const p = P();
  $("#versionsBody").innerHTML = p.versions.length ? p.versions.slice().reverse().map(v => `<div class="ver-row"><span>${esc(v.name)}</span><span class="px faint">${fmtTime(v.time)}</span><button class="btn quiet sm" data-act="restore-version" data-id="${attr(v.id)}">恢复</button></div>`).join("") : `<p class="dim" style="font-size:13px">还没有版本。AI 每次改动内容之前，会自动存一个版本，最多 20 个。</p>`;
  $("#versionsDialog").showModal();
}

const typing = t => ["INPUT", "TEXTAREA", "SELECT"].includes(t?.tagName) || t?.isContentEditable;

function install() {
  document.addEventListener("click", ev => {
    if (ui.exportOpen && !ev.target.closest(".menu-wrap")) { ui.exportOpen = false; if (route.view === "project") renderProject(); }
    const inMenu = ev.target.closest(".node-menu");
    if (ui.menu && !inMenu && Date.now() - (ui.menu.at || 0) > 250) { ui.menu = null; $$(".node-menu").forEach(m => m.remove()); }
    const el = ev.target.closest("[data-act]"); if (!el || el.disabled) return;
    const fn = ACTS[el.dataset.act]; if (!fn) return;
    if (el.tagName === "A") ev.preventDefault();
    fn(el, ev);
    if (inMenu && !el.closest("label")) { ui.menu = null; inMenu.remove(); }
  });
  ["input", "change"].forEach(t => document.addEventListener(t, ev => { const el = ev.target.closest?.("[data-in]"); if (el && INS[el.dataset.in]) INS[el.dataset.in](el, t, ev); }));
  document.addEventListener("submit", ev => {
    const f = ev.target.closest("[data-submit]"); if (!f) return; ev.preventDefault();
    const k = f.dataset.submit;
    if (k === "new-project") { const topic = $("#topic").value.trim(); if (!topic) { $("#topic").focus(); return toast("先写一句选题", 2400, "err"); } createProject(topic, $("#newPlatform").value, $("#newAccount").value === "__new" ? "" : $("#newAccount").value, $("#newIp")?.value ? [$("#newIp").value] : []); }
    if (k === "ask") { const ta = $("#ask"); const v = ta.value; ta.value = ""; askDirector(v); }
    if (k === "save-account") {
      const a = state.accounts.find(x => x.id === lib.accId) || lib.draft;
      $$("[data-acc]", f).forEach(i => { a[i.dataset.acc] = i.value.trim(); });
      if (!a.name) return toast("先填账号名称", 2400, "err");
      if (!state.accounts.includes(a)) state.accounts.push(a);
      lib.accId = a.id; lib.draft = null; save(); renderLibrary(); toast("账号 DNA 已保存，选项目时可以指定它");
    }
  });
  document.addEventListener("keydown", ev => {
    const mod = ev.metaKey || ev.ctrlKey;
    if (mod && ev.key.toLowerCase() === "k") { ev.preventDefault(); PAL.open ? paletteClose() : paletteOpen(); return; }
    if (PAL.open) return;
    if (route.view === "project" && !cd.open && mod && ev.key.toLowerCase() === "e") { ev.preventDefault(); setMode(P().view.mode === "canvas" ? "flow" : "canvas"); return; }
    if (route.view === "project" && !cd.open && mod && (ev.key === "[" || ev.key === "]")) { ev.preventDefault(); const i = STEPS.findIndex(([k]) => k === curStep(P())); const j = clamp(i + (ev.key === "]" ? 1 : -1), 0, STEPS.length - 1); openStep(STEPS[j][0], { flow: true }); return; }
    if (ev.target.closest?.("[data-act='open-project']") === ev.target && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); go("project", ev.target.dataset.id); return; }
    if (ev.target.id === "ask" && ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); ev.target.closest("form").requestSubmit(); return; }
    if (ev.key === "Enter" && mod && ev.target.closest?.(".cv-layer .cf")) { ev.preventDefault(); const go = $(".cv-layer .cf .cf-go:not(:disabled)"); go?.click(); return; }
    if (ev.target.id === "topic" && ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); ev.target.closest("form").requestSubmit(); return; }
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "s") { ev.preventDefault(); flushSave(true).then(ok => ok && toast("已保存到这个浏览器")); return; }
    if (ev.key === "Escape") {
      if (document.querySelector("dialog[open]")) return;
      if (EXT_ESC.length) { ev.preventDefault(); EXT_ESC[EXT_ESC.length - 1](); return; }
      if (PET.wheel) { petCloseWheel(); return; }
      if (cd.open) { cd.sel ? (cd.sel = "", renderCover()) : closeCover(); return; }
      if (ui.menu) { closeMenu(); return; }
      if (ui.exportOpen) { ui.exportOpen = false; renderProject(); return; }
      if (route.view === "project" && P().view.mode === "canvas" && ev.target.closest?.(".cv-layer .cf")) { ev.target.blur(); return; }
      if (route.view === "project" && (selIds().length || ui.edgeSel) && P().view.mode === "canvas") { setSel([]); syncSelection(); return; }
      if (route.view === "project" && !(ui.panels.left && ui.panels.right)) { ui.panels = { left: true, right: true }; renderProject(); return; }
    }
    if (EXT_ESC.length) return;
    if (typing(ev.target) || document.querySelector("dialog[open]")) return;
    if (cd.open) {
      const mod = ev.metaKey || ev.ctrlKey;
      if (mod && ev.key.toLowerCase() === "z") { ev.preventDefault(); cdRestore(ev.shiftKey ? "redo" : "undo"); return; }
      if (mod && ev.key.toLowerCase() === "d") { ev.preventDefault(); ACTS["cd-dup"](); return; }
      if ((ev.key === "Delete" || ev.key === "Backspace") && cd.sel) { ev.preventDefault(); ACTS["cd-del"](); return; }
      const e = cd.sel && cdEl(P()); const st = ev.shiftKey ? 10 : 1; const ar = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[ev.key];
      if (e && ar) { ev.preventDefault(); e.x += ar[0]; e.y += ar[1]; cdSync(e); touch(P()); }
      return;
    }
    if (route.view === "project") {
      const canvas = P().view.mode === "canvas";
      if (mod && ev.key.toLowerCase() === "z") { ev.preventDefault(); undoStep(ev.shiftKey ? 1 : -1); return; }
      if (mod && ev.key.toLowerCase() === "y") { ev.preventDefault(); undoStep(1); return; }
      if (canvas && ui.menu && /^[1-9]$/.test(ev.key)) { const items = $$(".node-menu .add-item[data-act]"); const b = items[+ev.key - 1]; if (b) { ev.preventDefault(); b.click(); } return; }
      if (canvas && (ev.key === "Delete" || ev.key === "Backspace") && ui.edgeSel) { ev.preventDefault(); deleteEdge(P(), ui.edgeSel); return; }
      if (canvas && (ev.key === "Delete" || ev.key === "Backspace") && selIds().length) { ev.preventDefault(); deleteNodes(P(), selIds()); return; }
      if (canvas && mod && ev.key.toLowerCase() === "d") { ev.preventDefault(); if (selIds().length) duplicateNodes(P(), selIds()); return; }
      if (canvas && mod && ev.key.toLowerCase() === "a") { ev.preventDefault(); ACTS["cn-select-all"](); return; }
      if (canvas && !mod && ev.key.toLowerCase() === "v") { ACTS["cv-tool"]({ dataset: { tool: "select" } }); return; }
      if (canvas && !mod && ev.key.toLowerCase() === "h") { ACTS["cv-tool"]({ dataset: { tool: "hand" } }); return; }
      if (canvas && ev.key === " " && !ui.space) { ev.preventDefault(); ui.space = true; $("[data-stage]")?.classList.add("space"); return; }
      if (canvas && !mod && ev.key === "Enter" && ui.sel) { const t = $(".cv-layer .cf [data-cf]"); if (t) { ev.preventDefault(); t.focus(); return; } }
      if (ev.key.toLowerCase() === "f" && !mod) { ACTS["toggle-focus"](); return; }
      if (canvas && mod && (ev.key === "0" || ev.key === "1")) { ev.preventDefault(); fitCanvas(P()); }
    }
  });
  $("#apiForm").onsubmit = async ev => {
    ev.preventDefault();
    if (ev.submitter?.value === "cancel") { $("#apiDialog").close(); return; }
    const id = $("#providerInput").value, key = $("#apiKey").value.trim(), remember = $("#rememberKeys").checked;
    if (!key && !(apiState.connectedProviders || []).includes(id)) { $("#apiMessage").textContent = "第一次连接这个平台，需要填 API Key"; return; }
    const b = $("#saveApi"); busy(b, true, "连接中"); $("#apiMessage").textContent = "";
    try { await configureApi({ provider: id, apiKey: key || undefined, validate: true, rememberKeys: remember, ...(PROVIDER_CONFIG[id]?.regions ? { region: $("#regionInput").value } : {}) }); $("#apiDialog").close(); render(); toast(`${apiState.providerLabel} 已连接`); }
    catch (e) { $("#apiMessage").textContent = e.message; } finally { busy(b, false); }
  };
  $("#disconnectApi").onclick = async () => { try { await configureApi({ provider: $("#providerInput").value, apiKey: "", validate: false, rememberKeys: $("#rememberKeys").checked }); $("#apiDialog").close(); render(); toast("已断开这个平台"); } catch (e) { $("#apiMessage").textContent = e.message; } };
  $("#rwForm").onsubmit = ev => { ev.preventDefault(); if (ev.submitter?.value === "cancel") { $("#rewriteDialog").close(); return; } runRewrite($("#rwRun")); };
  $$("[data-rw]").forEach(b => b.onclick = () => { $("#rwInstr").value = b.dataset.rw; });
  $("#conflictReload").onclick = () => recoveryMode ? ACTS["export-data"]() : location.reload();
  $("#conflictForce").onclick = () => { recoveryMode = false; storageConflict = false; $("#conflict").classList.remove("show"); saveQ.dirty = true; flushSave(true).then(ok => ok && toast("已用这个窗口的内容保存，旧数据进了自动备份")); };
  window.addEventListener("resize", () => { if (route.view === "project") applyViewport(); });
  document.addEventListener("keyup", ev => { if (ev.key === " " && ui.space) { ui.space = false; $("[data-stage]")?.classList.remove("space"); } });
  window.addEventListener("blur", () => { if (ui.space) { ui.space = false; $("[data-stage]")?.classList.remove("space"); } });
  window.addEventListener("beforeunload", flushOnExit);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushSave(); });
}

async function boot() {
  // 启动动画先跑起来，数据在它背后加载
  window.SPLASHING = true; document.body.classList.add("splashing");
  try { const th = JSON.parse(localStorage.getItem(LOCAL_MIRROR_KEY) || "null")?.theme; if (th === "light" || th === "dark") document.documentElement.dataset.theme = th; } catch (_) {}
  try { await Promise.race([document.fonts.load('48px "Fusion Pixel"'), new Promise(r => setTimeout(r, 400))]); } catch (_) {}
  try { installCursors(); } catch (_) {}
  const sp = Splash.start(); $("#boot")?.remove();
  install(); installUI();
  const { loaded, migrated, error } = await loadInitialState();
  state = loaded; state.theme ||= "dark";
  document.documentElement.dataset.theme = state.theme;
  await health();
  // 从上次停下的地方继续
  if (state.last?.view === "project" && state.projects.some(x => x.id === state.last.projectId)) route = { view: "project", projectId: state.last.projectId };
  render();
  await sp.handoff();
  try { installCursorFx(); petBoot(); } catch (e) { console.error(e); }
  if (recoveryMode) { $("#conflictReload").textContent = "导出原始数据"; $("#conflictForce").textContent = "以空白数据继续"; showConflict(`项目数据无法读取（${error || "格式错误"}），原始数据没有被覆盖。`); }
  else if (migrated && serverOnline) { saveQ.dirty = true; flushSave(true).then(ok => { if (ok && state.projects.length) toast(`已把原有的 ${state.projects.length} 个项目迁移到新版`, 4200); }); }
  else if (!serverOnline) setSave("err", "本机服务未连接");
}
boot();
