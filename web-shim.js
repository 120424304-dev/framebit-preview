"use strict";
// 帧比特网页版 · 把 Mac 版本地服务（server.mjs）做的事搬进浏览器
// - 项目数据：存在这个浏览器的 IndexedDB 里（每 10 分钟留一份自动备份，最多 8 份）
// - 上传的素材：存成文件放在 IndexedDB，页面里用 blob: 地址显示；每次打开时换成新的地址
// - AI 写作、AI 编导：通过 Claude（页面的 sample 能力，用打开页面的人自己的 Claude 账号）
// - 生图、生视频、配乐：网页版不提供，返回明确的说明
(() => {
  // 两种网页版：artifact = 挂在 Claude 上（AI 用访客自己的 Claude）；hosted = 独立网站（AI 走站点服务，用站长的 ToAPIs Key）
  const HOSTED = window.FRAMEBIT_WEB_MODE === "hosted";
  // static = 放在 GitHub Pages 这类静态托管上的预览：没有模型，只能体验界面和手动编辑
  const STATIC = window.FRAMEBIT_WEB_MODE === "static";
  const WEB = window.FRAMEBIT_WEB = { hosted: HOSTED, static: STATIC, ready: null, idb: null, idbOk: false, remap: new Map(), sample: undefined, limits: null, version: "3.7.0-web" };
  const JSONH = { "Content-Type": "application/json; charset=utf-8" };

  // ---------- 主题：查看器可能在根元素上写 data-theme，这里以帧比特自己的设置为准 ----------
  try {
    const th = JSON.parse(localStorage.getItem("framebit_state_v1") || "null")?.theme;
    document.documentElement.dataset.theme = th === "light" ? "light" : "dark";
  } catch (_) { document.documentElement.dataset.theme = "dark"; }
  document.documentElement.lang = "zh-CN";
  new MutationObserver(() => {
    const want = (typeof state !== "undefined" && state?.theme === "light") ? "light" : "dark";
    if (document.documentElement.dataset.theme !== want && typeof state !== "undefined" && state) document.documentElement.dataset.theme = want;
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // ---------- IndexedDB ----------
  function idbOpen() {
    return new Promise((resolve, reject) => {
      let r; try { r = indexedDB.open("framebit-web", 1); } catch (e) { reject(e); return; }
      r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv"); if (!d.objectStoreNames.contains("assets")) d.createObjectStore("assets"); };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error("IndexedDB 打不开"));
      r.onblocked = () => reject(new Error("IndexedDB 被另一个页面占用"));
    });
  }
  function tx(store, mode, fn) {
    if (!WEB.idb) return Promise.reject(new Error("这个浏览器不能保存数据"));
    return new Promise((resolve, reject) => {
      let out;
      try {
        const t = WEB.idb.transaction(store, mode); const st = t.objectStore(store);
        const req = fn(st); if (req) req.onsuccess = () => { out = req.result; };
        t.oncomplete = () => resolve(out); t.onerror = t.onabort = () => reject(t.error || new Error("保存失败"));
      } catch (e) { reject(e); }
    });
  }
  const kvGet = k => tx("kv", "readonly", s => s.get(k));
  const kvPut = (k, v) => tx("kv", "readwrite", s => s.put(v, k));
  const kvDel = k => tx("kv", "readwrite", s => s.delete(k));
  const kvKeys = () => tx("kv", "readonly", s => s.getAllKeys());

  // ---------- 素材 ----------
  const MEDIA = { "image/png": "image", "image/jpeg": "image", "image/webp": "image", "image/gif": "image", "video/mp4": "video", "video/webm": "video", "video/quicktime": "video", "audio/mpeg": "audio", "audio/mp3": "audio", "audio/wav": "audio", "audio/x-wav": "audio", "audio/wave": "audio", "audio/mp4": "audio", "audio/x-m4a": "audio", "audio/ogg": "audio" };
  async function storeAsset(blob, name = "asset") {
    const type = blob.type || "application/octet-stream";
    if (!MEDIA[type]) throw Object.assign(new Error("只支持 PNG、JPEG、WebP、MP4、WebM、MOV、MP3、WAV 或 M4A 素材"), { status: 400 });
    if (!blob.size) throw Object.assign(new Error("上传素材为空"), { status: 400 });
    const id = `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const url = URL.createObjectURL(blob);
    if (WEB.idbOk) {
      try { await tx("assets", "readwrite", s => s.put({ id, blob, name: String(name).slice(0, 80), type, url, size: blob.size, at: Date.now() }, id)); }
      catch (e) { if (/quota/i.test(String(e?.name || e?.message))) throw Object.assign(new Error("浏览器存储空间不够了：去纸篓永久清理一些素材，或者导出备份后清掉旧项目"), { status: 507 }); throw e; }
    }
    return { assetUrl: url, mediaType: MEDIA[type], contentType: type, name };
  }
  WEB.storeAsset = storeAsset;
  async function loadAssets() {
    if (!WEB.idbOk) return;
    const all = await tx("assets", "readonly", s => s.getAll()) || [];
    const fresh = [];
    for (const a of all) {
      if (!a?.blob) continue;
      const url = URL.createObjectURL(a.blob);
      if (a.url && a.url !== url) WEB.remap.set(a.url, url);
      fresh.push({ ...a, url });
    }
    if (fresh.length) await tx("assets", "readwrite", s => { fresh.forEach(a => s.put(a, a.id)); return null; });
  }
  async function assetByUrl(url) {
    if (!WEB.idbOk) return null;
    const all = await tx("assets", "readonly", s => s.getAll()) || [];
    return all.find(a => a.url === url) || null;
  }
  WEB.assetByUrl = assetByUrl;
  function dataUrlBlob(u) {
    const m = /^data:([^;,]+);base64,(.*)$/s.exec(String(u || ""));
    if (!m) throw Object.assign(new Error("素材格式不对"), { status: 400 });
    const bin = atob(m[2].replace(/\s/g, "")); const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: m[1] });
  }
  WEB.dataUrlBlob = dataUrlBlob;
  const remapText = text => { if (!WEB.remap.size) return text; let t = text; for (const [a, b] of WEB.remap) t = t.split(a).join(b); return t; };

  // ---------- 项目数据 ----------
  let lastBackupAt = 0;
  async function readState() {
    if (!WEB.idbOk) return null;
    const rec = await kvGet("state");
    if (!rec?.state) return null;
    if (!WEB.remap.size) return rec;
    return { ...rec, state: JSON.parse(remapText(JSON.stringify(rec.state))) };
  }
  async function writeState(body) {
    const incoming = body?.state;
    if (!incoming || typeof incoming !== "object" || !Array.isArray(incoming.accounts) || !Array.isArray(incoming.projects)) throw Object.assign(new Error("项目数据结构不完整，已拒绝保存"), { status: 400 });
    if (!WEB.idbOk) { WEB.memRevision = (WEB.memRevision || 0) + 1; return { ok: true, revision: WEB.memRevision, savedAt: new Date().toISOString(), memoryOnly: true }; }
    const current = await kvGet("state");
    const currentRevision = Number(current?.revision || 0), baseRevision = Number(body.baseRevision || 0), writer = String(body.writer || "");
    if (current && currentRevision > baseRevision && current.writer && current.writer !== writer && !body.force) throw Object.assign(new Error("另一个标签页已经保存了更新的项目数据"), { status: 409, revision: currentRevision });
    const now = Date.now();
    if (current && now - lastBackupAt > 10 * 60_000) {
      try {
        await kvPut(`bk:${new Date(now).toISOString()}`, current); lastBackupAt = now;
        const keys = (await kvKeys()).filter(k => String(k).startsWith("bk:")).sort().reverse();
        for (const k of keys.slice(8)) await kvDel(k);
      } catch (_) {}
    }
    const record = { state: incoming, revision: Math.max(currentRevision, baseRevision) + 1, writer, savedAt: new Date(now).toISOString() };
    record.state.revision = record.revision;
    try { await kvPut("state", record); }
    catch (e) { throw Object.assign(new Error(/quota/i.test(String(e?.name || e?.message)) ? "浏览器存储空间不够了，先导出备份，再清理纸篓或旧项目" : `保存失败：${e.message}`), { status: 507 }); }
    return { ok: true, revision: record.revision, savedAt: record.savedAt };
  }
  async function listBackups() {
    if (!WEB.idbOk) return [];
    const keys = (await kvKeys()).filter(k => String(k).startsWith("bk:")).sort().reverse();
    const out = [];
    for (const k of keys) { const rec = await kvGet(k); out.push({ name: k.slice(3), size: JSON.stringify(rec || {}).length, savedAt: rec?.savedAt || k.slice(3) }); }
    return out;
  }

  // ---------- Claude ----------
  async function getSample() {
    if (STATIC) { WEB.sample = null; return null; }
    if (WEB.sample !== undefined) return WEB.sample;
    if (!window.claude?.use) { WEB.sample = null; return null; }
    try { WEB.sample = await window.claude.use("sample"); } catch (_) { WEB.sample = null; }
    if (WEB.sample) { try { WEB.limits = await WEB.sample.limits(); } catch (_) { WEB.limits = null; } }
    return WEB.sample;
  }
  WEB.getSample = getSample;
  const SAMPLE_ERR = {
    not_granted: [403, "你没有允许这个页面使用 Claude。刷新页面后再点一次，在弹出的确认里选允许"],
    sampling_disabled: [403, "AI 写作要登录 Claude 才能用"],
    capability_disabled: [403, "这个页面现在不能使用 Claude"],
    capability_removed: [403, "这个页面现在不能使用 Claude"],
    not_declared: [403, "这个页面没有开通 Claude 能力"],
    session_expired: [401, "要登录 Claude 才能用 AI 写作；已经登录的话，刷新页面再试"],
    rate_limited: [429, "Claude 请求太频繁了，等一会儿再试"],
    queue_overflow: [429, "同时在跑的 AI 任务太多了，等前面的完成再试"],
    prompt_too_large: [413, "这次要发给 Claude 的内容太长了，删减一些再试"],
    refused: [422, "Claude 没有完成这个请求，换个说法再试"],
    empty_completion: [502, "Claude 这次没有返回内容，再试一次"],
    invalid_json: [502, "Claude 返回的内容格式不对，再试一次"],
    upstream_error: [502, "Claude 暂时不可用，稍后再试"],
    images_unavailable: [400, "这个页面现在不能把图片发给 Claude"],
    image_rejected: [400, "有一张图片 Claude 读不了"],
    transform_error: [502, "Claude 返回的内容处理失败，再试一次"]
  };
  // 按 Schema 补齐缺的字段（Claude 偶尔会漏掉空字段），并把类型校正过来
  function conform(schema, v) {
    if (!schema) return v;
    if (schema.type === "object") {
      const o = v && typeof v === "object" && !Array.isArray(v) ? v : {};
      const out = {};
      for (const [k, s] of Object.entries(schema.properties || {})) out[k] = conform(s, o[k]);
      return out;
    }
    if (schema.type === "array") return (Array.isArray(v) ? v : v == null || v === "" ? [] : [v]).map(x => conform(schema.items, x));
    if (schema.type === "string") { const s = v == null ? "" : typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v); return schema.enum && !schema.enum.includes(s) ? schema.enum[0] : s; }
    if (schema.type === "integer" || schema.type === "number") { const n = Number(v); return Number.isFinite(n) ? (schema.type === "integer" ? Math.round(n) : n) : 0; }
    if (schema.type === "boolean") return Boolean(v);
    return v;
  }
  const QUICK = new Set(["rewrite", "canvas_prompt", "canvas_polish"]);
  const WEB_NOTE = "（当前是帧比特网页版：只能写文字，不能生成图片、视频和配乐。不要返回 run_canvas 动作；用户要求生成画面、视频或配乐时，告诉他这一步要在帧比特 Mac App 里做。）";
  async function runText(body, signal) {
    const P = window.FB_PROMPTS;
    const sample = await getSample();
    if (!sample) throw Object.assign(new Error(STATIC ? "这个预览没有接入模型，AI 写作请用帧比特 Mac App；这里可以手动写脚本、整理画布、建 IP、上传素材" : "AI 写作和 AI 编导要登录 Claude 才能用"), { status: 503, code: "NO_CLAUDE" });
    const action = P.SCHEMAS[body.action] ? body.action : "full";
    let instruction = body.instruction || "";
    // 读图：页面声明了 images 时，把关键帧 / 定妆照等一起发给 Claude
    let images = [];
    const urls = P.visionImages(body);
    if (urls.length) {
      const max = WEB.limits?.images?.maxCount || 0;
      if (max) images = urls.slice(0, max).map(u => { try { return dataUrlBlob(u); } catch (_) { return null; } }).filter(Boolean);
      if (!images.length) instruction = `${instruction}\n（这次没法读图，只能根据文字信息完成）`;
    }
    if (action === "director") instruction = `${instruction}\n${WEB_NOTE}`;
    const prompt = [P.developerFor(action), P.promptFor(action, body.project || {}, body.account || {}, instruction, body.selectedText || ""), P.structuredPrompt(action)].join("\n\n");
    let raw;
    try {
      raw = await sample.json(prompt, { signal, cache: false, modelTier: QUICK.has(action) ? "quick" : "default", ...(images.length ? { images } : {}) });
    } catch (e) {
      if (e?.code === "cancelled" || signal?.aborted) throw new DOMException("已取消", "AbortError");
      if (e?.code === "not_granted" || e?.code === "sampling_disabled") WEB.denied = true;
      const [status, msg] = SAMPLE_ERR[e?.code] || [502, e?.message || "Claude 暂时不可用"];
      throw Object.assign(new Error(msg), { status, code: e?.code || "" });
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Object.assign(new Error("Claude 返回的数据结构不对，再试一次"), { status: 502 });
    return { result: conform(P.SCHEMAS[action], raw), model: "Claude", provider: "claude", providerLabel: "Claude", area: body.area || "" };
  }

  // ---------- 连接状态（对应 /api/health） ----------
  function health() {
    const text = !STATIC && Boolean(window.claude?.use) && WEB.sample !== null && !WEB.denied;
    return {
      ok: true, web: true, connected: text, provider: "claude", providerLabel: "Claude", model: "Claude",
      connectedProviders: text ? ["claude"] : [], connectedProviderLabels: text ? ["Claude"] : [],
      capabilities: { text, image: false, video: false, audio: false }, rememberKeys: false, toapisRegion: "global", mock: false,
      storage: WEB.idbOk ? "indexeddb" : "memory",
      routing: { text: text ? "Claude（网页版）" : STATIC ? "预览版不提供" : "登录 Claude 后可用", image: "网页版不提供", video: "网页版不提供", audio: "网页版不提供" }
    };
  }
  WEB.health = health;

  const NO_MEDIA = "网页版不能生成图片、视频和配乐。这一步请在帧比特 Mac App 里做；网页版里可以上传自己的素材。";
  const routes = {
    "GET /api/health": async () => [200, health()],
    "POST /api/config": async () => [200, health()],
    "GET /api/models": async () => [200, { text: [], image: [], video: [], audio: [] }],
    "GET /api/routes": async () => [200, { areas: [], options: {}, specs: {} }],
    "POST /api/routes": async () => [200, { areas: [], options: {}, specs: {} }],
    "GET /api/state": async () => [200, (await readState()) || { state: null, revision: 0 }],
    "PUT /api/state": async b => [200, await writeState(b)],
    "POST /api/state": async b => [200, await writeState(b)],
    "GET /api/backups": async () => [200, { backups: await listBackups() }],
    "POST /api/generate": async (b, sig) => [200, await runText(b, sig)],
    "POST /api/director": async (b, sig) => [200, await runText({ ...b, action: "director" }, sig)],
    "POST /api/assets": async b => [200, await storeAsset(dataUrlBlob(b.dataUrl), b.name)],
    "POST /api/reveal": async () => [200, { ok: false, path: "这个浏览器的网站数据（网页版没有文件夹）" }],
    "POST /api/trash/purge": async b => {
      let removed = 0, bytes = 0;
      if (WEB.idbOk) {
        const want = new Set((Array.isArray(b.files) ? b.files : []).map(String));
        const all = await tx("assets", "readonly", s => s.getAll()) || [];
        const kill = all.filter(a => want.has(a.url));
        if (kill.length) await tx("assets", "readwrite", s => { kill.forEach(a => s.delete(a.id)); return null; });
        kill.forEach(a => { removed++; bytes += a.size || 0; try { URL.revokeObjectURL(a.url); } catch (_) {} });
      }
      return [200, { ok: true, removed, bytes }];
    }
  };
  ["/api/image", "/api/cover-image", "/api/video-submit", "/api/video-status", "/api/audio-submit", "/api/audio-status"].forEach(p => { routes[`POST ${p}`] = async () => [501, { error: NO_MEDIA, code: "WEB_NO_MEDIA" }]; });

  const origFetch = window.fetch.bind(window);

  // ---------- 独立网站模式：模型请求交给站点自己的服务（用站长的 ToAPIs Key），数据仍然只在访客浏览器里 ----------
  if (HOSTED) {
    const PASS_KEY = "framebit_pass";
    const getPass = () => { try { return localStorage.getItem(PASS_KEY) || WEB.pass || ""; } catch (_) { return WEB.pass || ""; } };
    const setPass = v => { WEB.pass = v; try { localStorage.setItem(PASS_KEY, v); } catch (_) {} };
    const MEDIA_IN = new Set(["/api/image", "/api/cover-image", "/api/video-submit"]);
    const MEDIA_OUT = new Set(["/api/image", "/api/cover-image", "/api/video-status", "/api/audio-status"]);
    const readDataUrl = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
    // 发给服务的参考图：浏览器里的 blob: 地址换成图片数据
    async function inlineBlobs(payload) {
      let text = JSON.stringify(payload);
      const urls = [...new Set(text.match(/blob:[^"\\\s]+/g) || [])];
      for (const u of urls) {
        const a = await assetByUrl(u).catch(() => null);
        if (a?.blob && /^image\//.test(a.type)) text = text.split(u).join(await readDataUrl(a.blob));
      }
      return text;
    }
    // 服务生成的图片、视频、配乐：马上存进访客浏览器（服务器上的文件几个小时后会清掉）
    async function localize(data) {
      let text = JSON.stringify(data);
      const paths = [...new Set(text.match(/\/generated\/[^"\\?#\s]+/g) || [])];
      for (const pth of paths) {
        try {
          const r = await origFetch(pth, { headers: { "x-framebit-pass": getPass() } });
          if (!r.ok) continue;
          const blob = await r.blob();
          const typed = blob.type && MEDIA[blob.type] ? blob : new Blob([blob], { type: r.headers.get("content-type") || "" });
          const saved = await storeAsset(typed, pth.split("/").pop());
          text = text.split(pth).join(saved.assetUrl);
        } catch (_) {}
      }
      return JSON.parse(text);
    }
    async function call(method, pth, payload, signal) {
      const body = method === "GET" ? undefined : (MEDIA_IN.has(pth) ? await inlineBlobs(payload) : JSON.stringify(payload ?? {}));
      const r = await origFetch(pth, { method, signal, headers: { "Content-Type": "application/json", "x-framebit-pass": getPass() }, body });
      let data = await r.json().catch(() => ({}));
      if (r.ok && MEDIA_OUT.has(pth)) data = await localize(data);
      return [r.status, data];
    }
    // 访问口令：没有或不对时弹窗，验证通过才继续
    let asking = null;
    function askPass(wrong = false) {
      if (asking) return asking;
      asking = new Promise(resolve => {
        const d = document.getElementById("passDialog"), f = document.getElementById("passForm"), inp = document.getElementById("passInput"), msg = document.getElementById("passMsg");
        msg.textContent = wrong ? "口令不对，再试一次" : "";
        f.onsubmit = async ev => {
          ev.preventDefault();
          const v = inp.value.trim(); if (!v) { msg.textContent = "先输入口令"; return; }
          msg.textContent = "验证中…";
          setPass(v);
          const [, h] = await call("GET", "/api/health").catch(() => [0, {}]);
          if (h?.passOk) { d.close(); asking = null; resolve(h); }
          else msg.textContent = h?.ok ? "口令不对，再试一次" : "连不上站点，稍后再试";
        };
        d.addEventListener("cancel", ev => ev.preventDefault());
        if (!d.open) d.showModal();
        setTimeout(() => inp.focus(), 50);
      });
      return asking;
    }
    async function hostedHealth() {
      let [s, h] = await call("GET", "/api/health").catch(() => [0, null]);
      if (!h?.ok) return [200, { ok: false, web: true, hosted: true, connected: false, connectedProviders: [], capabilities: {}, offline: true }];
      if (h.passRequired && !h.passOk) h = await askPass(Boolean(getPass()));
      WEB.hostedHealth = h;
      return [200, { ...h, web: true, hosted: true }];
    }
    const fwd = pth => async (b, sig) => {
      const [s, d] = await call("POST", pth, b, sig);
      if (s === 401) { await askPass(true); return call("POST", pth, b, sig); }
      return [s, d];
    };
    routes["GET /api/health"] = hostedHealth;
    routes["POST /api/config"] = hostedHealth;
    routes["GET /api/models"] = async () => call("GET", "/api/models");
    routes["GET /api/routes"] = async () => call("GET", "/api/routes");
    ["/api/generate", "/api/director", "/api/image", "/api/cover-image", "/api/video-submit", "/api/video-status", "/api/audio-submit", "/api/audio-status"].forEach(p => { routes[`POST ${p}`] = fwd(p); });
  }
  window.fetch = async function (input, init = {}) {
    const raw = typeof input === "string" ? input : input?.url || String(input);
    let u; try { u = new URL(raw, location.href); } catch (_) { return origFetch(input, init); }
    if (u.origin !== location.origin || !u.pathname.startsWith("/api/")) return origFetch(input, init);
    const method = String(init.method || (typeof input === "object" && input.method) || "GET").toUpperCase();
    const signal = init.signal;
    if (signal?.aborted) throw new DOMException("已取消", "AbortError");
    await WEB.ready;
    let status = 200, body;
    try {
      let handler = routes[`${method} ${u.pathname}`];
      if (!handler && method === "GET" && u.pathname.startsWith("/api/backups/")) {
        const name = decodeURIComponent(u.pathname.slice("/api/backups/".length));
        handler = async () => { const rec = WEB.idbOk ? await kvGet(`bk:${name}`) : null; if (!rec) return [404, { error: "没有找到这个自动备份" }]; return [200, WEB.remap.size ? JSON.parse(remapText(JSON.stringify(rec))) : rec]; };
      }
      if (!handler) [status, body] = [404, { error: "网页版没有这个功能" }];
      else {
        let payload = {};
        if (init.body != null) { const t = typeof init.body === "string" ? init.body : await new Response(init.body).text(); try { payload = t ? JSON.parse(t) : {}; } catch (_) { payload = {}; } }
        const work = handler(payload, signal);
        const res = signal ? await Promise.race([work, new Promise((_, rej) => signal.addEventListener("abort", () => rej(new DOMException("已取消", "AbortError")), { once: true }))]) : await work;
        [status, body] = res;
      }
    } catch (e) {
      if (e?.name === "AbortError") throw e;
      console.warn("[帧比特网页版]", e);
      status = e?.status || 500; body = { error: e?.message || "出错了", code: e?.code || "", revision: e?.revision };
    }
    return new Response(JSON.stringify(body ?? {}), { status, headers: JSONH });
  };

  // 关页面前的最后一次保存（原来用 sendBeacon 发给本机服务）
  const origBeacon = navigator.sendBeacon?.bind(navigator);
  try {
    navigator.sendBeacon = function (url, data) {
      if (String(url).includes("/api/state")) {
        Promise.resolve(data instanceof Blob ? data.text() : String(data)).then(t => writeState(JSON.parse(t))).catch(() => {});
        return true;
      }
      return origBeacon ? origBeacon(url, data) : false;
    };
  } catch (_) {}

  WEB.ready = (async () => {
    try { WEB.idb = await idbOpen(); WEB.idbOk = true; } catch (e) { WEB.idbOk = false; console.warn("[帧比特网页版] 不能使用 IndexedDB：", e); }
    try { await loadAssets(); } catch (e) { console.warn("[帧比特网页版] 素材载入失败：", e); }
    // Claude 能力在后台解析，不挡住首屏（web.js 会在结果出来后刷新连接状态）
    if (!HOSTED && !STATIC) getSample();
  })();
})();
