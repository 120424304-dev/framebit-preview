"use strict";
// 帧比特网页版 · 在原有界面上的网页版调整（在 main.js 之后载入）
(() => {
  const W = window.FRAMEBIT_WEB;
  const HOSTED = W.hosted;
  const STATIC = W.static;
  const PLAIN_DL = HOSTED || STATIC; // 普通网站：浏览器自己的下载就能用
  const MEDIA_NAME = { image: "图片", video: "视频", audio: "配乐" };

  // ---------- Claude 能力：结果出来后刷新一次连接状态（只有挂在 Claude 上的版本用） ----------
  if (!HOSTED && !STATIC) W.getSample().then(async () => {
    const before = apiState.connected;
    await health();
    if (typeof state !== "undefined" && state && before !== apiState.connected) render();
  });

  // ---------- 生图 / 生视频 / 配乐 ----------
  function noMedia(kind) {
    toast(HOSTED ? `这个站点还没有开通${MEDIA_NAME[kind]}生成，请联系站长` : STATIC ? `预览版不能生成${MEDIA_NAME[kind]}，完整功能请用帧比特 Mac App。这里可以把自己的${MEDIA_NAME[kind]}上传到节点上。` : `网页版不能生成${MEDIA_NAME[kind]}，这一步请在帧比特 Mac App 里做。网页版里可以把自己的${MEDIA_NAME[kind]}上传到节点上。`, 5200, "err", { key: "web-media", sticky: false });
    return false;
  }
  needImage = () => (HOSTED && caps().image) || noMedia("image");
  needVideo = () => (HOSTED && caps().video) || noMedia("video");
  needAudio = () => (HOSTED && caps().audio) || noMedia("audio");
  needText = function () {
    if (apiState.connected) return true;
    if (STATIC) { toast("这个预览没有接入模型，AI 写作请用帧比特 Mac App；这里可以手动写脚本、整理画布、建 IP、上传素材", 5200, "err", { sticky: false }); return false; }
    openApi();
    toast(HOSTED ? (apiState.offline ? "连不上站点服务，稍后刷新再试" : "这个站点还没有配置模型密钥，AI 功能暂时不能用") : W.denied ? "你没有允许这个页面使用 Claude。刷新页面后再试，在确认框里选允许" : "AI 写作和 AI 编导要登录 Claude 才能用。不登录也可以手动写脚本、整理画布、建 IP、上传素材", 5200, "err", { sticky: false });
    return false;
  };
  if (!HOSTED) loadModels = async () => {};

  // ---------- 「连接模型」换成网页版说明 ----------
  openApi = function () {
    const d = $("#webDialog"); if (!d) return;
    const h = HOSTED ? apiState : W.health(); const c = h.capabilities || {};
    $("#webStatus").innerHTML = (HOSTED ? [
      ["AI 写作、AI 编导", c.text ? `可以用 · ${h.routing?.text || "站点提供"}` : h.offline ? "连不上站点" : "站点没有开通", Boolean(c.text)],
      ["生成图片", c.image ? `可以用 · ${h.routing?.image || "站点提供"}` : "站点没有开通", Boolean(c.image)],
      ["生成视频", c.video ? `可以用 · ${h.routing?.video || "站点提供"}` : "站点没有开通", Boolean(c.video)],
      ["生成配乐", c.audio ? `可以用 · ${h.routing?.audio || "站点提供"}` : "站点没有开通", Boolean(c.audio)],
      ["保存项目", W.idbOk ? "保存在这个浏览器里" : "这个浏览器不能保存，关掉页面会丢", W.idbOk]
    ] : STATIC ? [
      ["界面、编导流程、画布、IP 工作台", "可以体验", true],
      ["上传自己的图片、视频、音频", "可以", true],
      ["AI 写作、AI 编导", "预览版不提供", false],
      ["生成图片、视频、配乐", "预览版不提供", false],
      ["保存项目", W.idbOk ? "保存在这个浏览器里" : "这个浏览器不能保存，关掉页面会丢", W.idbOk]
    ] : [
      ["AI 写作、AI 编导", h.connected ? "可以用 · Claude" : W.denied ? "没有允许使用 Claude" : "登录 Claude 后可用", h.connected],
      ["读图（拆解复刻、一致性检查）", W.limits?.images ? "可以用" : "只按文字处理", Boolean(W.limits?.images)],
      ["生成图片、视频、配乐", "网页版不提供", false],
      ["保存项目", W.idbOk ? "保存在这个浏览器里" : "这个浏览器不能保存，关掉页面会丢", W.idbOk]
    ]).map(([k, v, ok]) => `<div class="web-row"><span>${esc(k)}</span><span class="px ${ok ? "ok" : "no"}"><i></i>${esc(v)}</span></div>`).join("");
    if (!d.open) d.showModal();
  };
  configureApi = async () => { openApi(); return HOSTED ? apiState : W.health(); };

  // ---------- 上传：直接把文件存进浏览器，不转 base64 ----------
  const EXT_TYPE = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", ogg: "audio/ogg" };
  uploadAsset = async function (file, max = 50_000_000) {
    if (!file) throw new Error("没有选择文件");
    if (file.size > max) throw new Error(`单个文件不能超过 ${Math.round(max / 1e6)}MB`);
    const ext = String(file.name || "").split(".").pop().toLowerCase();
    const blob = file.type ? file : new Blob([file], { type: EXT_TYPE[ext] || "" });
    return W.storeAsset(blob, file.name || "asset");
  };

  // ---------- 下载：页面不能自己触发下载，改用查看器的保存确认 ----------
  async function saveBlob(name, data) {
    if (PLAIN_DL) { origDownload(name, data instanceof Blob ? data : new Blob([data])); return true; }
    const dl = window.claude?.use ? await window.claude.use("downloads").catch(() => null) : null;
    if (!dl) { toast("这个预览里暂时不能保存文件", 4400, "err", { sticky: false }); return false; }
    try { await dl.save({ filename: String(name).replace(/[\\/:*?"<>|]/g, "-"), data }); return true; }
    catch (e) {
      if (e?.code === "declined") return false;
      toast(e?.code === "too_large" ? "文件太大，保存不了" : e?.code === "rejected_extension" ? "这种文件类型不能保存" : `保存失败：${e?.message || e?.code || "未知原因"}`, 4400, "err", { sticky: false });
      return false;
    }
  }
  W.saveBlob = saveBlob;
  const origDownload = download;
  if (!PLAIN_DL) download = function (name, content, type = "text/plain;charset=utf-8") {
    saveBlob(name, content instanceof Blob ? content : new Blob([content], { type }));
  };
  async function blobForUrl(url) {
    if (/^data:/.test(url)) return W.dataUrlBlob(url);
    if (/^blob:/.test(url)) { const a = await W.assetByUrl(url); if (a?.blob) return a.blob; }
    return null;
  }
  const EXT_OF = t => ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/mp4": "m4a", "audio/ogg": "ogg" }[t] || "bin");
  // 页面里所有 <a download>（节点菜单「下载」、资料库素材、配乐下载）都走这里
  document.addEventListener("click", async ev => {
    const a = ev.target.closest?.("a[download]"); if (!a || PLAIN_DL) return;
    ev.preventDefault(); ev.stopPropagation();
    const url = a.getAttribute("href") || "";
    const blob = await blobForUrl(url).catch(() => null);
    if (!blob) { toast("这个素材不在这个浏览器里（可能是从 Mac 版导入的），没法保存", 4400, "err", { sticky: false }); return; }
    const asset = /^blob:/.test(url) ? await W.assetByUrl(url) : null;
    const base = (a.getAttribute("download") || asset?.name || "帧比特素材").replace(/\.[a-z0-9]+$/i, "");
    saveBlob(`${base}.${EXT_OF(blob.type)}`, blob);
  }, true);

  // ---------- 备份：导出时把素材一起打包进 JSON，导入时还原成浏览器里的素材 ----------
  const readDataUrl = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  ACTS["export-data"] = async () => {
    if (recoveryMode) { download(`帧比特-原始数据-${new Date().toISOString().slice(0, 10)}.json`, recoveryRaw, "application/json"); return; }
    let text = JSON.stringify(state, null, 2);
    const urls = [...new Set(text.match(/blob:[^"\s]+/g) || [])];
    if (urls.length) toast(`正在把 ${urls.length} 个素材打包进备份…`, 2400);
    let missing = 0;
    for (const u of urls) {
      const blob = await blobForUrl(u).catch(() => null);
      if (!blob) { missing++; continue; }
      text = text.split(u).join(await readDataUrl(blob));
    }
    const ok = await saveBlob(`帧比特网页版-备份-${new Date().toISOString().slice(0, 10)}.json`, new Blob([text], { type: "application/json" }));
    if (ok) toast(`备份已导出${urls.length ? `，含 ${urls.length - missing} 个素材` : ""}`, 3200);
  };
  INS["import-data"] = (el, t) => {
    if (t !== "change" || !el.files?.[0]) return;
    const f = el.files[0];
    f.text().then(async text => {
      const datas = [...new Set(text.match(/data:(?:image|video|audio)\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g) || [])];
      if (datas.length) toast(`正在还原 ${datas.length} 个素材…`, 2400);
      for (const d of datas) {
        try { const r = await W.storeAsset(W.dataUrlBlob(d), "导入素材"); text = text.split(d).join(r.assetUrl); } catch (_) {}
      }
      const fromMac = (text.match(/"\/generated\/[^"]+"/g) || []).length;
      applyImported(JSON.parse(text), "导入完成");
      if (fromMac) toast(`有 ${fromMac} 处图片 / 视频来自 Mac 版的本机文件夹，网页版读不到，需要重新上传`, 6000, "err");
    }).catch(e => toast(`导入失败：${e.message}`, 5000, "err")).finally(() => { el.value = ""; });
  };
  ACTS["reveal"] = () => toast("网页版的数据存在这个浏览器里，没有文件夹。需要拿出来时，在设置里导出备份", 4400);
  ACTS["web-about"] = () => openApi();

  // ---------- 设置页里的网页版说明 ----------
  window.webSettingsSection = function () {
    if (HOSTED) {
      const c = apiState.capabilities || {};
      return `<div class="set-sec"><h2 class="px">网页版</h2>
      <p style="font-size:13px;color:var(--muted);line-height:1.7">这是帧比特的网页版，界面和 Mac 版一样。AI 写作、生图、生视频和配乐由这个站点提供，用的是站长配置的模型平台；你的项目和素材只存在你自己的浏览器里，站长和其他访客都看不到。</p>
      <div class="web-status">${[["AI 写作和 AI 编导", c.text ? "可以用" : "没有开通", Boolean(c.text)], ["生图 / 生视频 / 配乐", [c.image && "图片", c.video && "视频", c.audio && "配乐"].filter(Boolean).join("、") || "没有开通", Boolean(c.image || c.video || c.audio)], ["数据保存", W.idbOk ? "这个浏览器" : "不能保存", W.idbOk]].map(([k, v, ok]) => `<div class="web-row"><span>${esc(k)}</span><span class="px ${ok ? "ok" : "no"}"><i></i>${esc(v)}</span></div>`).join("")}</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px"><button class="btn line sm" data-act="web-about">网页版说明</button>${apiState.passRequired ? `<button class="btn line sm" data-act="web-pass-reset">重新输入访问口令</button>` : ""}</div></div>`;
    }
    if (STATIC) return `<div class="set-sec"><h2 class="px">预览版</h2>
      <p style="font-size:13px;color:var(--muted);line-height:1.7">这是帧比特的临时预览，界面和 Mac 版 ${APP_VERSION} 一样。可以体验编导流程、画布、IP 工作台、Bit，也可以上传自己的素材；AI 写作和生成图片、视频、配乐需要帧比特 Mac App。</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px"><button class="btn line sm" data-act="web-about">预览版说明</button></div></div>`;
    const h = W.health();
    return `<div class="set-sec"><h2 class="px">网页版</h2>
      <p style="font-size:13px;color:var(--muted);line-height:1.7">这是帧比特的临时预览版，界面和 Mac 版一样，不登录也能体验编导流程、画布、IP 工作台和上传素材。AI 写作、审稿、风格画像、IP 设定和 AI 编导用 Claude 来写，需要登录 Claude（用的是你自己的 Claude 账号，第一次使用时会请你确认）；生成图片、视频和配乐只在 Mac 版里有。</p>
      <div class="web-status">${[["AI 写作和 AI 编导", h.connected ? "Claude" : W.denied ? "没有允许" : "登录 Claude 后可用", h.connected], ["生图 / 生视频 / 配乐", "Mac 版", false], ["数据保存", W.idbOk ? "这个浏览器" : "不能保存", W.idbOk]].map(([k, v, ok]) => `<div class="web-row"><span>${esc(k)}</span><span class="px ${ok ? "ok" : "no"}"><i></i>${esc(v)}</span></div>`).join("")}</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px"><button class="btn line sm" data-act="web-about">网页版说明</button></div></div>`;
  };
  ACTS["web-pass-reset"] = () => { try { localStorage.removeItem("framebit_pass"); } catch (_) {} flushSave(true).finally(() => location.reload()); };

  // ---------- 窄屏提示 ----------
  const narrow = $("#webNarrow");
  try { if (sessionStorage.getItem("fb-web-narrow-ok") === "1") narrow?.remove(); } catch (_) {}
  narrow?.querySelector("button")?.addEventListener("click", () => { narrow.remove(); try { sessionStorage.setItem("fb-web-narrow-ok", "1"); } catch (_) {} });

  // ---------- 数据只能存在内存里时，提醒一次 ----------
  W.ready.then(() => { if (!W.idbOk) setTimeout(() => toast("这个浏览器不能保存数据（可能是无痕窗口或关掉了网站数据），关掉页面后内容会丢。需要保留时在设置里导出备份", 8000, "err"), 2500); });
})();
