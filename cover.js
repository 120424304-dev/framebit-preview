"use strict";
// 帧比特 3.5 · 封面设计器
// 舞台、缩略图、多版预览和导出用的是同一个画布渲染器，看到的就是导出的。
// 平台尺寸（9:16 / 3:4 / 16:9 / 1:1）、十套版式、一键出 4 版、描边 / 阴影 / 高亮条 / 【重点色】文字、
// 背景平移缩放暗化模糊、吸附对齐、平台安全区提醒、锁定图层、PNG / JPG / 全部尺寸 / 复制到剪贴板。

const cd = { open: false, tool: "templates", sel: "", zoom: .34, hist: new Map(), guides: [], editing: "", variants: null, varSeed: 0, exportOpen: false, raf: 0, enter: false };
const CD_PRESETS = [
  { k: "9:16", w: 1080, h: 1920, label: "竖版 9:16", sub: "抖音 · 快手 · 视频号" },
  { k: "3:4", w: 1080, h: 1440, label: "3:4", sub: "小红书" },
  { k: "16:9", w: 1920, h: 1080, label: "横版 16:9", sub: "B站" },
  { k: "1:1", w: 1080, h: 1080, label: "方形 1:1", sub: "通用" }
];
const PLATFORM_PRESET = { 抖音: "9:16", 快手: "9:16", 视频号: "9:16", 小红书: "3:4", B站: "16:9" };
const CD_FONTS = { sans: ["黑体", '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif'], serif: ["宋体", '"Songti SC","STSong","Noto Serif SC","Source Han Serif SC",serif'], round: ["圆体", '"Yuanti SC","PingFang SC","Hiragino Maru Gothic ProN",sans-serif'], pixel: ["像素", '"Fusion Pixel",monospace'] };
const CD_SAFE = {
  "9:16": { zones: [{ x: 0, y: 0, w: 1, h: .06, label: "状态栏" }, { x: 0, y: .79, w: 1, h: .21, label: "标题和文案会盖住这里" }, { x: .85, y: .44, w: .15, h: .34, label: "点赞 / 评论" }], crop: { y: .125, h: .75, label: "主页网格只显示中间 3:4" } },
  "3:4": { zones: [], tip: "小红书信息流里封面会缩得很小，主标题要占到画面宽度的七成以上" },
  "16:9": { zones: [{ x: 0, y: .87, w: .4, h: .13, label: "播放量" }, { x: .8, y: .87, w: .2, h: .13, label: "时长" }] },
  "1:1": { zones: [] }
};
const FILTER_OK = (() => { try { const c = document.createElement("canvas").getContext("2d"); c.filter = "blur(2px)"; return c.filter === "blur(2px)"; } catch (_) { return false; } })();
const presetOf = k => CD_PRESETS.find(x => x.k === k) || CD_PRESETS[0];

// ---------- 图片缓存 ----------
const cdImgs = new Map();
function cdImg(url) {
  if (!url) return null;
  let r = cdImgs.get(url);
  if (!r) { const im = new Image(); r = { im, ok: false, err: false }; cdImgs.set(url, r); im.onload = () => { r.ok = true; cdRepaintAll(); }; im.onerror = () => { r.err = true; }; im.src = url; }
  return r.ok ? r.im : null;
}
function cdLoadAll(d) {
  const urls = [d.backgroundImage, ...d.elements.filter(e => e.type === "image").map(e => e.url)].filter(Boolean);
  return Promise.all(urls.map(u => new Promise(res => { const r = cdImgs.get(u); if (r?.ok) return res(); cdImg(u); const t = setInterval(() => { const x = cdImgs.get(u); if (x?.ok || x?.err) { clearInterval(t); res(); } }, 40); setTimeout(() => { clearInterval(t); res(); }, 8000); })));
}
let cdRepaintT = 0;
function cdRepaintAll() { cancelAnimationFrame(cdRepaintT); cdRepaintT = requestAnimationFrame(() => { if (cd.open) cdPaint(); paintCoverMinis(); }); }

// ---------- 文字素材与版式 ----------
function coverValue(p, key) {
  const fb = { coverMainText: p.coverWords?.[0] || p.title || "输入封面标题", coverEyebrow: account(p.accountId)?.name || "", coverSubText: p.style.contentType || "", coverBackgroundPrompt: p.coverPlan || `${p.style.visual || ""} 围绕“${p.topic}”的短视频封面背景，主体明确，为标题留出安全区，无文字` };
  return p[key] || fb[key] || "";
}
function cdTexts(p) {
  const main = coverValue(p, "coverMainText"); const sub = coverValue(p, "coverSubText") || p.titles?.[0] || "";
  const items = p.script.map(r => r.subtitle).filter(Boolean).slice(0, 3);
  return { main, sub, eye: coverValue(p, "coverEyebrow") || p.platform || "", tag: p.coverWords?.[1] || "必看", items: items.length ? items : ["第一点", "第二点", "第三点"], num: String(items.length || 3) };
}
const TX = (v = {}) => ({ id: uid("layer"), type: "text", x: 80, y: 120, w: 880, h: 120, rotation: 0, z: 1, opacity: 1, visible: true, text: "文字", fontSize: 72, fontWeight: 800, color: "#FFFFFF", align: "left", valign: "top", lineHeight: 1.12, letterSpacing: 0, fontFamily: "sans", strokeWidth: 0, strokeColor: "#000000", shadowBlur: 0, shadowColor: "rgba(0,0,0,.6)", shadowY: 0, bgColor: "", bgPad: .18, accent: "#FFD23F", autoFit: true, ...v });
const SH = (v = {}) => ({ id: uid("layer"), type: "shape", shape: "rect", x: 80, y: 120, w: 180, h: 20, rotation: 0, z: 1, opacity: 1, visible: true, fill: "#EDEDED", fill2: "", gradAngle: 90, strokeWidth: 0, strokeColor: "#000000", borderRadius: 0, ...v });
// 每套版式按画布比例排版：竖版、横版、方形各自不同
const CD_TEMPLATES = [
  { k: "minimal", name: "暗底标题", bg: "#111111", build(t, W, H, L) { const m = Math.min(W, H); return { bgGrad: "bottom", bgGradK: .85, els: [TX({ x: W * .07, y: H * .06, w: W * .8, h: m * .06, text: t.eye, fontSize: m * .032, fontWeight: 600, color: "#FFFFFF", opacity: .8 }), TX({ x: W * .07, y: L.land ? H * .44 : H * .44, w: W * (L.land ? .7 : .8), h: H * (L.land ? .34 : .26), text: t.main, fontSize: m * (L.land ? .13 : .12), fontWeight: 900, valign: "bottom", shadowBlur: m * .02, shadowY: m * .006 }), TX({ x: W * .07, y: L.land ? H * .8 : H * .715, w: W * .78, h: m * .08, text: t.sub, fontSize: m * .04, fontWeight: 600, opacity: .78 })] }; } },
  { k: "paper", name: "纸面", bg: "#EDEDED", build(t, W, H, L) { const m = Math.min(W, H); return { bgDim: 0, els: [TX({ x: W * .07, y: H * .06, w: W * .8, h: m * .05, text: t.eye, fontSize: m * .03, fontWeight: 700, color: "#111111" }), SH({ x: W * .07, y: H * .06 + m * .07, w: W * .86, h: Math.max(2, m * .003), fill: "#111111" }), TX({ x: W * .066, y: L.land ? H * .3 : H * .42, w: W * (L.land ? .87 : .8), h: H * (L.land ? .4 : .28), text: t.main, fontSize: m * (L.land ? .12 : .118), fontWeight: 900, color: "#111111", valign: "bottom" }), TX({ x: W * .07, y: L.land ? H * .76 : H * .72, w: W * .78, h: m * .06, text: t.sub, fontSize: m * .034, fontWeight: 600, color: "#111111", bgColor: "#C7DEC4", bgPad: .3 })] }; } },
  { k: "impact", name: "大字压图", bg: "#000000", build(t, W, H, L) { const m = Math.min(W, H); return { bgDim: .45, els: [TX({ x: W * .06, y: H * .07, w: W * .8, h: m * .06, text: t.eye, fontSize: m * .034, fontWeight: 700 }), TX({ x: W * .05, y: H * (L.land ? .22 : .26), w: W * (L.land ? .9 : .8), h: H * (L.land ? .56 : .4), text: t.main, fontSize: m * (L.land ? .17 : .15), fontWeight: 900, align: "center", valign: "middle", strokeWidth: m * .006, strokeColor: "#000000" }), TX({ x: W * .08, y: H * (L.land ? .82 : .69), w: W * .76, h: m * .08, text: t.sub, fontSize: m * .042, align: "center", opacity: .85 })] }; } },
  { k: "variety", name: "综艺描边", bg: "#1B1B1B", build(t, W, H, L) { const m = Math.min(W, H); return { bgDim: .15, els: [SH({ x: W * .06, y: H * .07, w: m * .26, h: m * .085, fill: "#FF4F5E", borderRadius: m * .015, rotation: -4 }), TX({ x: W * .06, y: H * .07, w: m * .26, h: m * .085, text: t.tag, fontSize: m * .048, fontWeight: 900, align: "center", valign: "middle", rotation: -4 }), TX({ x: W * .05, y: H * (L.land ? .3 : .34), w: W * (L.land ? .9 : .82), h: H * (L.land ? .48 : .32), text: t.main, fontSize: m * (L.land ? .15 : .14), fontWeight: 900, color: "#FFD23F", align: "center", valign: "middle", strokeWidth: m * .014, strokeColor: "#111111", shadowBlur: 0, shadowY: m * .012, shadowColor: "#111111", rotation: -3 }), TX({ x: W * .08, y: H * (L.land ? .82 : .69), w: W * .76, h: m * .08, text: t.sub, fontSize: m * .044, fontWeight: 800, align: "center", strokeWidth: m * .007, strokeColor: "#111111" })] }; } },
  { k: "highlight", name: "高亮条", bg: "#222222", build(t, W, H, L) { const m = Math.min(W, H); return { bgDim: .2, bgGrad: "bottom", bgGradK: .6, els: [TX({ x: W * .07, y: H * (L.land ? .3 : .42), w: W * (L.land ? .84 : .76), h: H * (L.land ? .44 : .29), text: t.main, fontSize: m * .1, fontWeight: 900, valign: "bottom", bgColor: "#FF4F7B", bgPad: .16, lineHeight: 1.3 }), TX({ x: W * .07, y: H * (L.land ? .8 : .725), w: W * .76, h: m * .07, text: t.sub, fontSize: m * .04, fontWeight: 700 })] }; } },
  { k: "magazine", name: "杂志", bg: "#F3EFE6", build(t, W, H, L) { const m = Math.min(W, H); return { bgDim: 0, els: [TX({ x: W * .07, y: H * .05, w: W * .5, h: m * .05, text: "FRAMEBIT", fontSize: m * .03, fontWeight: 700, color: "#111111", letterSpacing: .3, fontFamily: "serif" }), TX({ x: W * .63, y: H * .05, w: W * .3, h: m * .05, text: "NO.01", fontSize: m * .03, fontWeight: 700, color: "#111111", align: "right", fontFamily: "serif" }), TX({ x: W * .07, y: H * .1, w: W * .86, h: H * (L.land ? .5 : .3), text: t.main, fontSize: m * (L.land ? .12 : .13), fontWeight: 900, color: "#111111", fontFamily: "serif", lineHeight: 1.05 }), SH({ x: W * .07, y: H * (L.land ? .66 : .44), w: W * .86, h: Math.max(2, m * .003), fill: "#111111" }), TX({ x: W * .07, y: H * (L.land ? .7 : .46), w: W * .7, h: m * .1, text: t.sub, fontSize: m * .036, fontWeight: 500, color: "#333333", fontFamily: "serif" })] }; } },
  { k: "versus", name: "左右对比", bg: "#111111", build(t, W, H, L) { const m = Math.min(W, H); const parts = String(t.main).split(/\s*(?:vs|VS|还是|对比|＆|&)\s*/); const a = parts[0] || "过去", b = parts[1] || t.sub || "现在"; const port = !L.land; const mid = port && L.port ? .46 : .5; return { bgDim: 0, els: [SH({ x: 0, y: 0, w: port ? W : W / 2, h: port ? H * mid : H, fill: "#7BA4FF", opacity: .9 }), SH({ x: port ? 0 : W / 2, y: port ? H * mid : 0, w: port ? W : W / 2, h: port ? H * (1 - mid) : H, fill: "#FF9F43", opacity: .9 }), TX({ x: W * .06, y: port ? H * .1 : H * .3, w: port ? W * .78 : W * .38, h: port ? H * .28 : H * .4, text: a, fontSize: m * .1, fontWeight: 900, align: "center", valign: "middle", color: "#111111" }), TX({ x: port ? W * .06 : W * .56, y: port ? H * (mid + .07) : H * .3, w: port ? W * .78 : W * .38, h: port ? H * (.76 - mid - .07) : H * .4, text: b, fontSize: m * .1, fontWeight: 900, align: "center", valign: "middle", color: "#111111" }), SH({ shape: "ellipse", x: W / 2 - m * .1, y: H * mid - m * .1, w: m * .2, h: m * .2, fill: "#111111", strokeWidth: m * .008, strokeColor: "#FFFFFF" }), TX({ x: W / 2 - m * .1, y: H * mid - m * .1, w: m * .2, h: m * .2, text: "VS", fontSize: m * .07, fontWeight: 900, align: "center", valign: "middle", color: "#FFD23F", autoFit: false })] }; } },
  { k: "list", name: "清单", bg: "#0F1A14", build(t, W, H, L) { const m = Math.min(W, H); const top = L.land ? H * .14 : H * .1; return { bgDim: .55, els: [TX({ x: W * .07, y: top, w: m * .34, h: m * .3, text: t.num, fontSize: m * .3, fontWeight: 900, color: "#3DD68C", lineHeight: 1, autoFit: false }), TX({ x: W * .07 + m * .2, y: top + m * .04, w: W * .86 - m * .2, h: m * .26, text: t.main, fontSize: m * .085, fontWeight: 900, valign: "middle" }), ...t.items.map((it, i) => TX({ x: W * .09, y: top + m * .36 + i * m * .12, w: W * .82, h: m * .09, text: `${i + 1}  ${it}`, fontSize: m * .05, fontWeight: 700, bgColor: "rgba(255,255,255,.12)", bgPad: .3 }))] }; } },
  { k: "side", name: "人物留白", bg: "#1E2430", build(t, W, H, L) { const m = Math.min(W, H); const R = L.land; return { bgDim: 0, bgGrad: R ? "none" : "bottom", bgGradK: .7, els: [SH({ x: R ? W * .48 : 0, y: R ? 0 : H * .55, w: R ? W * .52 : W, h: R ? H : H * .45, fill: "#0B0B0B", fill2: "rgba(11,11,11,0)", gradAngle: R ? 270 : 0, opacity: .9 }), TX({ x: R ? W * .52 : W * .07, y: R ? H * .22 : H * .5, w: R ? W * .42 : W * .78, h: R ? H * .4 : H * .2, text: t.main, fontSize: m * (R ? .12 : .11), fontWeight: 900, align: R ? "right" : "left", valign: R ? "bottom" : "top" }), TX({ x: R ? W * .52 : W * .07, y: R ? H * .66 : H * .715, w: R ? W * .42 : W * .78, h: m * .08, text: t.sub, fontSize: m * .04, fontWeight: 600, align: R ? "right" : "left", color: "#C7DEC4" })] }; } },
  { k: "pixel", name: "像素", bg: "#000000", build(t, W, H, L) { const m = Math.min(W, H); const u = m * .012; return { bgDim: .35, els: [SH({ x: u * 3, y: u * 3, w: W - u * 6, h: H - u * 6, fill: "rgba(0,0,0,0)", strokeWidth: u * 1.4, strokeColor: "#EDEDED" }), SH({ x: W - u * 12, y: u * 7, w: u * 4, h: u * 4, fill: "#FFD23F" }), TX({ x: W * .08, y: H * .08, w: W * .6, h: m * .05, text: `> ${t.eye || "FRAMEBIT"}`, fontSize: m * .034, fontWeight: 400, fontFamily: "pixel", color: "#C7DEC4" }), TX({ x: W * .08, y: L.land ? H * .3 : H * .4, w: W * (L.land ? .84 : .76), h: H * (L.land ? .42 : .3), text: t.main, fontSize: m * .12, fontWeight: 400, fontFamily: "pixel", lineHeight: 1.2, valign: "middle" }), TX({ x: W * .08, y: L.land ? H * .78 : H * .725, w: W * .76, h: m * .07, text: t.sub, fontSize: m * .042, fontWeight: 400, fontFamily: "pixel", color: "#FFD23F" })] }; } }
];
function cdLayout(W, H) { return { land: W / H > 1.2, port: H / W > 1.2 }; }
function cdBuild(p, k, W, H) {
  const tpl = CD_TEMPLATES.find(x => x.k === k) || CD_TEMPLATES[0];
  const r = tpl.build(cdTexts(p), W, H, cdLayout(W, H));
  const els = r.els.filter(e => e.type !== "text" || String(e.text || "").trim()).map((e, i) => ({ ...e, z: i + 1, x: Math.round(e.x), y: Math.round(e.y), w: Math.round(e.w), h: Math.round(e.h), fontSize: e.fontSize ? Math.round(e.fontSize) : e.fontSize }));
  return { background: tpl.bg, bgDim: r.bgDim ?? 0, bgGrad: r.bgGrad || "none", bgGradK: r.bgGradK ?? .7, elements: els, template: tpl.k };
}
function templateEls(p, k = "minimal") { const d = ensureDesign(p); return cdBuild(p, k, d.width, d.height).elements; }
function cdApplyTemplate(p, k) {
  const d = ensureDesign(p); const b = cdBuild(p, k, d.width, d.height);
  Object.assign(d, { background: b.background, bgDim: b.bgDim, bgGrad: b.bgGrad, bgGradK: b.bgGradK, elements: b.elements, template: k });
}
function ensureDesign(p) {
  if (!p.coverDesign?.elements) {
    const pr = presetOf(PLATFORM_PRESET[p.platform] || "9:16");
    p.coverDesign = { width: pr.w, height: pr.h, preset: pr.k, background: "#111111", backgroundImage: p.coverImageUrl || "", showGrid: false, showSafe: true, bgX: 0, bgY: 0, bgScale: 1, bgDim: 0, bgBlur: 0, bgGrad: "bottom", bgGradK: .8, elements: [] };
    const b = cdBuild(p, "minimal", pr.w, pr.h); Object.assign(p.coverDesign, { background: b.background, bgGrad: b.bgGrad, bgGradK: b.bgGradK, elements: b.elements, template: "minimal" });
  }
  const d = p.coverDesign; d.width ||= 1080; d.height ||= 1920; d.background ||= "#111111";
  d.preset ||= (CD_PRESETS.find(x => x.w === d.width && x.h === d.height)?.k || "9:16");
  ["bgX", "bgY", "bgDim", "bgBlur"].forEach(k => { if (!Number.isFinite(+d[k])) d[k] = 0; });
  if (!Number.isFinite(+d.bgScale) || d.bgScale < 1) d.bgScale = 1; d.bgGrad ||= "none"; if (!Number.isFinite(+d.bgGradK)) d.bgGradK = .7; if (d.showSafe === undefined) d.showSafe = true;
  d.elements.forEach((e, i) => { e.id ||= uid("layer"); if (!Number.isFinite(+e.z)) e.z = i + 1; if (e.opacity === undefined) e.opacity = 1; if (e.visible === undefined) e.visible = true; if (e.type === "text") { e.lineHeight ||= 1.08; e.valign ||= "middle"; e.fontFamily ||= "sans"; } });
  return d;
}
// 换尺寸：位置按两个方向分别缩放，字号按较小的比例缩放
function cdScaleDesign(d, k) {
  const pr = presetOf(k); const sx = pr.w / d.width, sy = pr.h / d.height, sm = Math.min(sx, sy);
  d.elements.forEach(e => {
    const cx = (+e.x + +e.w / 2) * sx, cy = (+e.y + +e.h / 2) * sy;
    const full = +e.w >= d.width * .96;
    e.w = Math.round(full ? +e.w * sx : e.type === "text" ? +e.w * sx : +e.w * (e.type === "image" ? sm : sx)); e.h = Math.round(e.type === "text" ? Math.max(+e.h * sm, +e.h * sy) : +e.h * (e.type === "image" ? sm : sy));
    if (e.type === "shape" && (e.shape === "ellipse" || Math.abs(+e.w / sx - +e.h / sy) < 2)) { const s = Math.min(+e.w, +e.h); if (e.shape === "ellipse") { e.w = e.h = Math.round(s); } }
    e.x = Math.round(cx - e.w / 2); e.y = Math.round(cy - e.h / 2);
    if (e.fontSize) e.fontSize = Math.round(+e.fontSize * sm); if (e.strokeWidth) e.strokeWidth = +(+e.strokeWidth * sm).toFixed(1); if (e.shadowBlur) e.shadowBlur = Math.round(+e.shadowBlur * sm); if (e.shadowY) e.shadowY = Math.round(+e.shadowY * sm); if (e.borderRadius) e.borderRadius = Math.round(+e.borderRadius * sm);
  });
  d.width = pr.w; d.height = pr.h; d.preset = pr.k;
}
const cdEl = (p, id = cd.sel) => ensureDesign(p).elements.find(e => e.id === id);
const cdHist = p => { if (!cd.hist.has(p.id)) cd.hist.set(p.id, { undo: [], redo: [] }); return cd.hist.get(p.id); };
const cdPush = (p, v = "") => { const h = cdHist(p); h.undo.push(v || JSON.stringify(ensureDesign(p))); if (h.undo.length > 60) h.undo.shift(); h.redo = []; };
function cdRestore(dir) { const p = project(); const h = cdHist(p); const src = dir === "undo" ? h.undo : h.redo, dst = dir === "undo" ? h.redo : h.undo; if (!src.length) return; dst.push(JSON.stringify(ensureDesign(p))); p.coverDesign = JSON.parse(src.pop()); if (!cdEl(p)) cd.sel = ""; touch(p); renderCover(); }

// ---------- 渲染器 ----------
const fontOf = e => (CD_FONTS[e.fontFamily] || CD_FONTS.sans)[1];
function cdTokens(text) {
  // 【】里的字用重点色，括号本身不画
  const out = []; let accent = false;
  for (const ch of Array.from(String(text || ""))) { if (ch === "【") { accent = true; continue; } if (ch === "】") { accent = false; continue; } out.push({ ch, accent }); }
  return out;
}
function layoutText(ctx, e, fs) {
  const ls = (+e.letterSpacing || 0) * fs; const maxW = Math.max(10, +e.w);
  ctx.font = `${+e.fontWeight || 700} ${fs}px ${fontOf(e)}`;
  const paras = []; let cur = [];
  cdTokens(e.text).forEach(t => { if (t.ch === "\n") { paras.push(cur); cur = []; } else cur.push(t); }); paras.push(cur);
  const lines = [];
  paras.forEach(par => {
    // 英文单词和数字连在一起不拆，中文逐字断行
    const words = []; let w = [];
    par.forEach(t => { if (/[A-Za-z0-9'’\-.%]/.test(t.ch)) w.push(t); else { if (w.length) { words.push(w); w = []; } words.push([t]); } }); if (w.length) words.push(w);
    let line = [], lw = 0;
    words.forEach(word => {
      const ww = word.reduce((a, t) => a + (t.w = ctx.measureText(t.ch).width) + ls, 0);
      if (line.length && lw + ww - ls > maxW && !(word.length === 1 && /[，。、！？；：,.!?」』）)]/.test(word[0].ch))) { lines.push({ toks: line, w: lw - ls }); line = []; lw = 0; if (word[0].ch === " ") return; }
      line.push(...word); lw += ww;
    });
    lines.push({ toks: line, w: Math.max(0, lw - ls) });
  });
  return { lines, lh: fs * (+e.lineHeight || 1.1), ls };
}
function fitText(ctx, e) {
  let fs = Math.max(4, +e.fontSize || 48); let L = layoutText(ctx, e, fs);
  if (e.autoFit !== false) { let guard = 0; while (guard++ < 40 && fs > (+e.fontSize || 48) * .35 && (L.lines.length * L.lh > +e.h * 1.02 || L.lines.some(l => l.w > +e.w * 1.01))) { fs *= .94; L = layoutText(ctx, e, fs); } }
  return { ...L, fs };
}
function drawTextEl(ctx, e) {
  const w = +e.w, h = +e.h; const { lines, lh, ls, fs } = fitText(ctx, e);
  const total = lines.length * lh; const va = e.valign || "middle";
  const y0 = -h / 2 + (va === "top" ? 0 : va === "bottom" ? h - total : (h - total) / 2);
  ctx.textBaseline = "middle"; ctx.font = `${+e.fontWeight || 700} ${fs}px ${fontOf(e)}`;
  const lineX = l => e.align === "center" ? -l.w / 2 : e.align === "right" ? w / 2 - l.w : -w / 2;
  // 高亮条
  if (e.bgColor) { const pad = (+e.bgPad || .18) * fs; ctx.fillStyle = e.bgColor; lines.forEach((l, i) => { if (!l.toks.length) return; const x = lineX(l); const y = y0 + i * lh + (lh - fs) / 2; ctx.fillRect(x - pad, y - pad * .5, l.w + pad * 2, fs + pad); }); }
  const each = fn => lines.forEach((l, i) => { let x = lineX(l); const y = y0 + i * lh + lh / 2; l.toks.forEach(t => { fn(t, x, y); x += t.w + ls; }); });
  if (+e.shadowBlur || +e.shadowY) { ctx.save(); ctx.shadowColor = e.shadowColor || "rgba(0,0,0,.6)"; ctx.shadowBlur = +e.shadowBlur || 0; ctx.shadowOffsetY = +e.shadowY || 0; ctx.fillStyle = e.shadowColor || "rgba(0,0,0,.6)"; if (+e.strokeWidth) { ctx.lineWidth = +e.strokeWidth * 2; ctx.lineJoin = "round"; ctx.strokeStyle = e.strokeColor || "#000"; each((t, x, y) => ctx.strokeText(t.ch, x, y)); } else each((t, x, y) => ctx.fillText(t.ch, x, y)); ctx.restore(); }
  if (+e.strokeWidth) { ctx.lineWidth = +e.strokeWidth * 2; ctx.lineJoin = "round"; ctx.miterLimit = 2; ctx.strokeStyle = e.strokeColor || "#000"; each((t, x, y) => ctx.strokeText(t.ch, x, y)); }
  each((t, x, y) => { ctx.fillStyle = t.accent ? (e.accent || "#FFD23F") : (e.color || "#fff"); ctx.fillText(t.ch, x, y); });
}
function cdFill(ctx, e, w, h) {
  if (!e.fill2) return e.fill || "#EDEDED";
  const a = (+e.gradAngle || 0) * Math.PI / 180; const dx = Math.sin(a) * w / 2, dy = -Math.cos(a) * h / 2;
  const g = ctx.createLinearGradient(-dx, -dy, dx, dy); g.addColorStop(0, e.fill || "#000"); g.addColorStop(1, e.fill2); return g;
}
function drawShapeEl(ctx, e) {
  const w = +e.w, h = +e.h; ctx.fillStyle = cdFill(ctx, e, w, h); ctx.beginPath();
  if (e.shape === "ellipse") ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (e.shape === "arrow") { const t = h * .38; ctx.moveTo(-w / 2, -t / 2); ctx.lineTo(w / 2 - h / 2, -t / 2); ctx.lineTo(w / 2 - h / 2, -h / 2); ctx.lineTo(w / 2, 0); ctx.lineTo(w / 2 - h / 2, h / 2); ctx.lineTo(w / 2 - h / 2, t / 2); ctx.lineTo(-w / 2, t / 2); ctx.closePath(); }
  else ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(+e.borderRadius || 0, w / 2, h / 2));
  ctx.fill();
  if (+e.strokeWidth) { ctx.lineWidth = +e.strokeWidth; ctx.strokeStyle = e.strokeColor || "#000"; ctx.stroke(); }
}
function drawImageEl(ctx, e) {
  const w = +e.w, h = +e.h; const im = cdImg(e.url);
  ctx.save(); ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(+e.borderRadius || 0, w / 2, h / 2)); ctx.clip();
  if (!im) { ctx.fillStyle = "rgba(128,128,128,.25)"; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore(); return; }
  const ir = im.naturalWidth / im.naturalHeight, br = w / h; let dw = w, dh = h;
  if (e.fit === "contain" ? ir > br : ir < br) dh = w / ir; else dw = h * ir;
  const f = []; if (+e.bright && +e.bright !== 100) f.push(`brightness(${+e.bright}%)`); if (+e.contrast && +e.contrast !== 100) f.push(`contrast(${+e.contrast}%)`); if (e.sat !== undefined && +e.sat !== 100) f.push(`saturate(${+e.sat}%)`); if (+e.gray) f.push(`grayscale(${+e.gray}%)`);
  if (FILTER_OK && f.length) ctx.filter = f.join(" ");
  ctx.drawImage(im, -dw / 2, -dh / 2, dw, dh); ctx.filter = "none"; ctx.restore();
  if (+e.strokeWidth) { ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(+e.borderRadius || 0, w / 2, h / 2)); ctx.lineWidth = +e.strokeWidth; ctx.strokeStyle = e.strokeColor || "#fff"; ctx.stroke(); }
}
const blurCache = new Map();
function cdBlurred(im, px) {
  const key = `${im.src}|${px}`; if (blurCache.has(key)) return blurCache.get(key);
  const k = clamp(1 / (1 + px / 6), .04, 1); const s = document.createElement("canvas"); s.width = Math.max(2, Math.round(im.naturalWidth * k)); s.height = Math.max(2, Math.round(im.naturalHeight * k));
  const g = s.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(im, 0, 0, s.width, s.height);
  if (blurCache.size > 12) blurCache.clear(); blurCache.set(key, s); return s;
}
function drawBg(ctx, d) {
  const W = d.width, H = d.height;
  ctx.fillStyle = d.background || "#111"; ctx.fillRect(0, 0, W, H);
  const im = cdImg(d.backgroundImage);
  if (im) {
    const s = Math.max(W / im.naturalWidth, H / im.naturalHeight) * (+d.bgScale || 1); const dw = im.naturalWidth * s, dh = im.naturalHeight * s;
    const x = (W - dw) / 2 + (+d.bgX || 0) * (dw - W) / 2, y = (H - dh) / 2 + (+d.bgY || 0) * (dh - H) / 2;
    const blur = +d.bgBlur || 0;
    if (blur && FILTER_OK) { ctx.save(); ctx.filter = `blur(${blur}px)`; ctx.drawImage(im, x - blur, y - blur, dw + blur * 2, dh + blur * 2); ctx.restore(); }
    else if (blur) { ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.drawImage(cdBlurred(im, blur), x, y, dw, dh); ctx.restore(); }
    else ctx.drawImage(im, x, y, dw, dh);
  }
  if (+d.bgDim) { ctx.fillStyle = `rgba(0,0,0,${clamp(+d.bgDim, 0, .9)})`; ctx.fillRect(0, 0, W, H); }
  const gk = clamp(+d.bgGradK || 0, 0, 1);
  if (d.bgGrad && d.bgGrad !== "none" && gk) {
    const band = (y0, y1, from) => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(from ? 0 : 1, `rgba(0,0,0,${gk})`); g.addColorStop(from ? 1 : 0, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0)); };
    if (d.bgGrad === "bottom" || d.bgGrad === "both") band(H, H * .42, true);
    if (d.bgGrad === "top" || d.bgGrad === "both") band(0, H * .38, true);
  }
}
function drawCover(ctx, d, { scale = 1, skip = "" } = {}) {
  ctx.save(); ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  drawBg(ctx, d);
  d.elements.filter(e => e.visible !== false && e.id !== skip).sort((a, b) => a.z - b.z).forEach(e => {
    const w = Math.max(1, +e.w), h = Math.max(1, +e.h);
    ctx.save(); ctx.globalAlpha = clamp(+(e.opacity ?? 1), 0, 1); ctx.translate(+e.x + w / 2, +e.y + h / 2); ctx.rotate((+e.rotation || 0) * Math.PI / 180);
    if (e.type === "image") drawImageEl(ctx, e); else if (e.type === "shape") drawShapeEl(ctx, e); else if (e.type === "text") drawTextEl(ctx, e);
    ctx.restore();
  });
  ctx.restore();
}
function renderToCanvas(cv, d, cssW, opts = {}) {
  const dpr = window.devicePixelRatio || 1; const k = cssW / d.width;
  cv.width = Math.round(d.width * k * dpr); cv.height = Math.round(d.height * k * dpr); cv.style.width = `${Math.round(d.width * k)}px`; cv.style.height = `${Math.round(d.height * k)}px`;
  drawCover(cv.getContext("2d"), d, { scale: k * dpr, ...opts });
}

// ---------- 缩略图（流程页、发布物料） ----------
function coverMini(p, w = 216) {
  const d = p.coverDesign; if (!d?.elements?.length) return "";
  const h = Math.round(w * (d.height || 1920) / (d.width || 1080));
  return `<button class="cover-mini" data-act="open-cover" aria-label="打开封面设计器" style="width:${w}px;height:${h}px"><canvas data-cover-mini="${attr(p.id)}" data-w="${w}"></canvas><span class="cm-size px">${esc(d.preset || "9:16")}</span></button>`;
}
function paintCoverMinis(root = document) {
  $$("[data-cover-mini]", root).forEach(cv => { const p = state.projects.find(x => x.id === cv.dataset.coverMini); const d = p?.coverDesign; if (!d?.elements) return; renderToCanvas(cv, ensureDesign(p), Number(cv.dataset.w) || 216); });
}

// ---------- 设计器 UI ----------
function openCover() { const p = project(); if (!p) return; ensureDesign(p); ensureStructure(p, "publish"); touch(p); petOverride(() => ({ x: innerWidth - 260 - 92 - 20, y: innerHeight - 104 - 12 })); cd.open = true; cd.sel = ""; cd.enter = true; cd.variants = null; cd.exportOpen = false; renderCover(); requestAnimationFrame(() => cdFit()); }
function closeCover() {
  cdCommitEdit(); cd.open = false; cd.variants = null; petOverride(null); const box = $("#cover"); const ov = $(".cover-overlay", box);
  const done = () => { if (cd.open) return; box.hidden = true; box.innerHTML = ""; };
  if (ov && !reduceMotion()) { ov.classList.add("leave"); setTimeout(done, 180); } else done();
  if (route.view === "project") renderProject();
}
function gallery(p) { return [...new Set([...p.script.map(r => r.imageUrl), ...p.canvas.nodes.map(n => nodeImage(p, n)), ...p.canvas.nodes.flatMap(n => n.type === "remake" ? (n.data.frames || []).map(f => f.url) : [])].filter(Boolean))]; }
const cdNum = (label, prop, v, min = "", max = "", step = "1", scope = "cdp") => `<label class="cdf"><span>${label}</span><input type="number" data-in="${scope}" data-prop="${prop}" data-t="num" value="${Number(v || 0)}" ${min !== "" ? `min="${min}"` : ""} ${max !== "" ? `max="${max}"` : ""} step="${step}"></label>`;
const cdRange = (label, prop, v, min, max, step, scope = "cdp", fmt = x => Math.round(x * 10) / 10) => `<label class="cdf range"><span>${label}<em class="px" data-v>${fmt(Number(v || 0))}</em></span><input type="range" data-in="${scope}" data-prop="${prop}" data-t="num" min="${min}" max="${max}" step="${step}" value="${Number(v || 0)}"></label>`;
const cdColor = (label, prop, v, scope = "cdp") => `<label class="cdf color"><span>${label}</span><input type="color" data-in="${scope}" data-prop="${prop}" data-t="str" value="${attr(/^#[0-9a-f]{6}$/i.test(v || "") ? v : "#ffffff")}"></label>`;
const cdSelect = (label, prop, v, opts, scope = "cdp") => `<label class="cdf"><span>${label}</span><select data-in="${scope}" data-prop="${prop}" data-t="str">${opts.map(([k, l]) => `<option value="${attr(k)}" ${String(v) === String(k) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
const cdSeg = (prop, v, opts, scope = "cdp") => `<div class="seg cd-seg">${opts.map(([k, l, t]) => `<button class="${String(v) === String(k) ? "on" : ""}" data-act="cd-set" data-scope="${scope}" data-prop="${prop}" data-v="${attr(k)}" title="${attr(t || l)}">${l}</button>`).join("")}</div>`;
function tplThumb(p, d, k) { return `<canvas data-tpl="${k}" data-w="72"></canvas>`; }
function cdLibrary(p, d) {
  const t = cd.tool;
  if (t === "templates") return `<div class="cd-sec"><div class="cd-row"><span class="px faint">版式</span><button class="btn line sm" data-act="cd-variants">${icon("spark")}一键 4 版</button></div><div class="tpl-grid">${CD_TEMPLATES.map(x => `<button class="tpl ${d.template === x.k ? "on" : ""}" data-act="cd-template" data-t="${x.k}">${tplThumb(p, d, x.k)}<span>${x.name}</span></button>`).join("")}</div><p class="cd-tip">版式会用到封面字、副标题和账号名。字里用【】括起来的部分会变成重点色。</p></div>`;
  if (t === "text") return `<div class="cd-sec"><span class="px faint">加文字</span><div class="cd-adds">${[["title", "主标题", "粗黑大字"], ["sub", "副标题", "一行说明"], ["tag", "标签", "带底色的小字"], ["num", "大数字", "清单、排行"], ["stroke", "描边综艺字", "黄字黑描边"], ["bar", "高亮条", "每行一条底色"], ["quote", "金句", "宋体加引号"], ["pixel", "像素字", "帧比特风格"]].map(([k, l, s]) => `<button class="cd-add" data-act="cd-add" data-type="text" data-preset="${k}"><b>${l}</b><span class="px faint">${s}</span></button>`).join("")}</div></div>`;
  if (t === "shape") return `<div class="cd-sec"><span class="px faint">形状</span><div class="cd-adds">${[["rect", "矩形"], ["round", "圆角块"], ["ellipse", "圆形"], ["line", "线条"], ["arrow", "箭头"], ["fade", "渐变遮罩"], ["frame", "边框"]].map(([k, l]) => `<button class="cd-add" data-act="cd-add" data-type="shape" data-preset="${k}"><b>${l}</b></button>`).join("")}</div></div>
    <div class="cd-sec"><span class="px faint">图片</span><label class="btn line sm">${icon("upload")}上传图片<input type="file" hidden accept="image/png,image/jpeg,image/webp" data-in="cd-upload"></label>${gallery(p).length ? `<div class="pic-grid">${gallery(p).slice(0, 12).map(u => `<button data-act="cd-add" data-type="image" data-preset="${attr(u)}" title="放进封面"><img src="${attr(u)}" alt=""></button>`).join("")}</div>` : `<p class="cd-tip">项目里生成的画面会出现在这里。</p>`}</div>`;
  if (t === "bg") return `<div class="cd-sec"><span class="px faint">背景</span>${cdColor("底色", "background", d.background, "cdd")}
    <label class="field"><span>无字背景提示词</span><textarea data-in="cd-prompt" rows="3">${esc(coverValue(p, "coverBackgroundPrompt"))}</textarea></label>
    <div class="cd-row"><button class="btn primary sm" data-act="cd-gen-bg">${d.backgroundImage ? "重新生成背景" : "AI 生成背景"}</button><label class="btn line sm">上传<input type="file" hidden accept="image/png,image/jpeg,image/webp" data-in="cd-bg-upload"></label>${d.backgroundImage ? `<button class="btn quiet sm" data-act="cd-clear-bg">移除</button>` : ""}</div>
    ${p.coverLastError ? `<div class="err-box">${esc(p.coverLastError)}</div>` : ""}
    ${gallery(p).length ? `<span class="px faint">用项目里的画面</span><div class="pic-grid">${gallery(p).slice(0, 12).map(u => `<button class="${d.backgroundImage === u ? "on" : ""}" data-act="cd-set-bg" data-url="${attr(u)}"><img src="${attr(u)}" alt=""></button>`).join("")}</div>` : ""}</div>
    <div class="cd-sec"><span class="px faint">调整${d.backgroundImage ? "　·　在封面空白处拖动可以移动背景" : ""}</span>
    ${cdRange("缩放", "bgScale", d.bgScale, 1, 3, .01, "cdd", x => `${Math.round(x * 100)}%`)}${cdRange("左右", "bgX", d.bgX, -1, 1, .01, "cdd", x => x.toFixed(2))}${cdRange("上下", "bgY", d.bgY, -1, 1, .01, "cdd", x => x.toFixed(2))}
    ${cdRange("压暗", "bgDim", d.bgDim, 0, .85, .01, "cdd", x => `${Math.round(x * 100)}%`)}${cdRange("模糊", "bgBlur", d.bgBlur, 0, 40, 1, "cdd", x => `${x}px`)}
    ${cdSelect("渐变压暗", "bgGrad", d.bgGrad, [["none", "不加"], ["bottom", "底部"], ["top", "顶部"], ["both", "上下"]], "cdd")}${cdRange("渐变强度", "bgGradK", d.bgGradK, 0, 1, .01, "cdd", x => `${Math.round(x * 100)}%`)}</div>`;
  return "";
}
// 文字真正占到的范围（不是文本框），用来判断有没有压到平台界面
let cdMeasure = null;
function cdInk(e) {
  cdMeasure ||= document.createElement("canvas").getContext("2d");
  const { lines, lh, fs } = fitText(cdMeasure, e); const total = lines.length * lh; const va = e.valign || "middle";
  const top = +e.y + (va === "top" ? 0 : va === "bottom" ? +e.h - total : (+e.h - total) / 2) + (lh - fs) / 2;
  const wMax = Math.max(0, ...lines.map(l => l.w)); const left = +e.x + (e.align === "center" ? (+e.w - wMax) / 2 : e.align === "right" ? +e.w - wMax : 0);
  return { x: left, y: top, w: wMax, h: Math.max(fs, total - (lh - fs)) };
}
function cdWarnings(d) {
  const safe = CD_SAFE[d.preset] || { zones: [] }; const out = [];
  d.elements.filter(e => e.type === "text" && e.visible !== false && String(e.text || "").trim()).forEach(e => {
    const k = cdInk(e);
    safe.zones.forEach(z => { const zx = z.x * d.width, zy = z.y * d.height, zw = z.w * d.width, zh = z.h * d.height; const ix = Math.max(0, Math.min(k.x + k.w, zx + zw) - Math.max(k.x, zx)), iy = Math.max(0, Math.min(k.y + k.h, zy + zh) - Math.max(k.y, zy)); if (ix * iy > k.w * k.h * .06) out.push({ id: e.id, text: String(e.text).replace(/[【】]/g, "").slice(0, 10), zone: z.label }); });
  });
  return out;
}
function cdInspector(p, d) {
  const e = cdEl(p);
  const layers = `<div class="cd-sec"><span class="px faint">图层 ${d.elements.length}</span><div class="layer-list">${d.elements.slice().sort((a, b) => b.z - a.z).map(x => `<div class="lr ${x.id === cd.sel ? "on" : ""}"><button class="lr-n" data-act="cd-select" data-id="${attr(x.id)}"><i class="lr-t px">${x.type === "text" ? "T" : x.type === "image" ? "▣" : "■"}</i><span>${esc(x.type === "text" ? String(x.text || "文字").replace(/\n/g, " ").slice(0, 16) : x.type === "image" ? "图片" : { ellipse: "圆形", line: "线条", arrow: "箭头" }[x.shape] || "形状")}</span></button><button class="lr-b ${x.visible === false ? "off" : ""}" data-act="cd-vis" data-id="${attr(x.id)}" title="${x.visible === false ? "显示" : "隐藏"}">${x.visible === false ? "隐" : "显"}</button><button class="lr-b ${x.locked ? "on" : ""}" data-act="cd-lock" data-id="${attr(x.id)}" title="${x.locked ? "解锁" : "锁定，防止误拖"}">${x.locked ? "锁" : "松"}</button></div>`).join("")}</div></div>`;
  const warn = cdWarnings(d);
  const warnBox = warn.length ? `<div class="cd-warn"><b class="px">安全区提醒</b>${warn.slice(0, 4).map(w => `<button data-act="cd-select" data-id="${attr(w.id)}">「${esc(w.text)}」压到了${esc(w.zone)}</button>`).join("")}</div>` : "";
  if (!e) return `<div class="cd-sec"><span class="px faint">画布　${d.width} × ${d.height}</span><p class="cd-tip">点封面上的元素编辑；双击文字直接改字。拖动时会自动吸附到中线和其他元素，按住 Alt 不吸附。方向键微调，Shift 加速。</p>${CD_SAFE[d.preset]?.tip ? `<p class="cd-tip">${esc(CD_SAFE[d.preset].tip)}</p>` : ""}</div>${warnBox}${layers}`;
  const align = `<div class="cd-sec"><span class="px faint">对齐到画布</span><div class="cd-align">${[["l", "左"], ["ch", "水平居中"], ["r", "右"], ["t", "上"], ["cv", "垂直居中"], ["b", "下"]].map(([k, l]) => `<button data-act="cd-align" data-k="${k}" title="${l}">${l}</button>`).join("")}</div></div>`;
  let spec = "";
  if (e.type === "text") spec = `<div class="cd-sec"><span class="px faint">文字</span><textarea class="input" data-in="cdp" data-prop="text" data-t="str" rows="3">${esc(e.text || "")}</textarea><p class="cd-tip">用【】括起来的字会变成重点色</p>
    ${cdSeg("fontFamily", e.fontFamily || "sans", Object.entries(CD_FONTS).map(([k, [l]]) => [k, l]))}
    <div class="cd-grid2">${cdNum("字号", "fontSize", Math.round(e.fontSize), 8, 600)}${cdSelect("字重", "fontWeight", e.fontWeight || 700, [400, 500, 600, 700, 800, 900].map(w => [w, w]))}${cdColor("颜色", "color", e.color)}${cdColor("重点色", "accent", e.accent || "#FFD23F")}</div>
    ${cdSeg("align", e.align || "left", [["left", "左"], ["center", "中"], ["right", "右"]])}${cdSeg("valign", e.valign || "middle", [["top", "顶", "靠上"], ["middle", "中", "垂直居中"], ["bottom", "底", "靠下"]])}
    <div class="cd-grid2">${cdRange("行距", "lineHeight", e.lineHeight || 1.1, .8, 2, .01, "cdp", x => x.toFixed(2))}${cdRange("字距", "letterSpacing", e.letterSpacing || 0, -.1, .6, .01, "cdp", x => x.toFixed(2))}</div>
    <label class="check"><input type="checkbox" data-in="cdp" data-prop="autoFit" data-t="bool" ${e.autoFit !== false ? "checked" : ""}><span>字太多时自动缩小，保证放得下</span></label></div>
    <div class="cd-sec"><span class="px faint">特效</span><div class="cd-fx">${[["none", "无"], ["stroke", "描边"], ["shadow", "投影"], ["bar", "高亮条"], ["glow", "发光"]].map(([k, l]) => `<button data-act="cd-fx" data-k="${k}">${l}</button>`).join("")}</div>
    <div class="cd-grid2">${cdRange("描边", "strokeWidth", e.strokeWidth || 0, 0, 30, .5)}${cdColor("描边色", "strokeColor", e.strokeColor || "#000000")}${cdRange("投影", "shadowBlur", e.shadowBlur || 0, 0, 60, 1)}${cdRange("投影下移", "shadowY", e.shadowY || 0, -30, 40, 1)}</div>
    <div class="cd-grid2">${cdColor("高亮条", "bgColor", e.bgColor || "#FF4F7B")}<label class="check"><input type="checkbox" data-in="cdp" data-prop="bgOn" data-t="bool" ${e.bgColor ? "checked" : ""}><span>显示高亮条</span></label></div></div>`;
  if (e.type === "shape") spec = `<div class="cd-sec"><span class="px faint">形状</span>${cdSeg("shape", e.shape || "rect", [["rect", "矩形"], ["ellipse", "圆形"], ["arrow", "箭头"]])}<div class="cd-grid2">${cdColor("填充", "fill", e.fill || "#EDEDED")}${cdColor("渐变到", "fill2", e.fill2 || "#000000")}<label class="check"><input type="checkbox" data-in="cdp" data-prop="gradOn" data-t="bool" ${e.fill2 ? "checked" : ""}><span>渐变</span></label>${cdNum("渐变角度", "gradAngle", e.gradAngle ?? 90, 0, 360)}${cdNum("圆角", "borderRadius", e.borderRadius, 0, 999)}${cdRange("描边", "strokeWidth", e.strokeWidth || 0, 0, 40, .5)}${cdColor("描边色", "strokeColor", e.strokeColor || "#000000")}</div></div>`;
  if (e.type === "image") spec = `<div class="cd-sec"><span class="px faint">图片</span>${cdSeg("fit", e.fit || "cover", [["cover", "铺满裁切"], ["contain", "完整显示"]])}<div class="cd-grid2">${cdNum("圆角", "borderRadius", e.borderRadius, 0, 999)}${cdRange("描边", "strokeWidth", e.strokeWidth || 0, 0, 40, .5)}${cdColor("描边色", "strokeColor", e.strokeColor || "#FFFFFF")}</div>
    ${FILTER_OK ? `<div class="cd-grid2">${cdRange("亮度", "bright", e.bright ?? 100, 40, 160, 1, "cdp", x => `${x}%`)}${cdRange("对比", "contrast", e.contrast ?? 100, 40, 180, 1, "cdp", x => `${x}%`)}${cdRange("饱和", "sat", e.sat ?? 100, 0, 200, 1, "cdp", x => `${x}%`)}${cdRange("黑白", "gray", e.gray || 0, 0, 100, 1, "cdp", x => `${x}%`)}</div>` : `<p class="cd-tip">这台 Mac 的系统版本不支持图片滤镜。</p>`}<button class="btn line sm" data-act="cd-as-bg">设为整张背景</button></div>`;
  return `${spec}${align}<div class="cd-sec"><span class="px faint">位置与尺寸</span><div class="cd-grid2">${cdNum("X", "x", Math.round(e.x))}${cdNum("Y", "y", Math.round(e.y))}${cdNum("宽", "w", Math.round(e.w), 4)}${cdNum("高", "h", Math.round(e.h), 4)}${cdNum("旋转", "rotation", Math.round(e.rotation || 0), -360, 360)}${cdRange("透明度", "opacity", e.opacity ?? 1, 0, 1, .01, "cdp", x => `${Math.round(x * 100)}%`)}</div><div class="cd-row"><button class="btn line sm" data-act="cd-layer" data-dir="back">下移一层</button><button class="btn line sm" data-act="cd-layer" data-dir="fwd">上移一层</button><button class="btn line sm" data-act="cd-dup">复制</button><button class="btn quiet sm" data-act="cd-del">删除</button></div></div>${warnBox}${layers}`;
}
function renderCover() {
  const p = project(); const box = $("#cover"); if (!p || !cd.open) return;
  const d = ensureDesign(p); const h = cdHist(p);
  const libScroll = $(".cd-lib")?.scrollTop || 0, inspScroll = $(".cd-insp")?.scrollTop || 0;
  box.hidden = false;
  box.innerHTML = `<div class="cover-overlay ${cd.enter ? "enter" : ""}" role="dialog" aria-label="封面设计">
    <div class="cd-top"><button class="btn quiet sm" data-act="cd-close">完成</button><span class="px faint cd-ttl">封面　${esc(p.title)}</span>
      <div class="seg cd-presets" role="tablist" aria-label="尺寸">${CD_PRESETS.map(x => `<button class="${d.preset === x.k ? "on" : ""}" data-act="cd-preset" data-k="${x.k}" title="${attr(`${x.sub} · ${x.w}×${x.h}`)}">${x.label}<em class="px">${x.sub}</em></button>`).join("")}</div>
      <span class="grow"></span>
      <button class="btn quiet sm" data-act="cd-undo" ${h.undo.length ? "" : "disabled"} title="⌘Z">撤销</button><button class="btn quiet sm" data-act="cd-redo" ${h.redo.length ? "" : "disabled"} title="⇧⌘Z">重做</button><span class="sep"></span>
      <button class="btn quiet sm ${d.showSafe ? "on" : ""}" data-act="cd-safe" title="平台界面会盖住的区域">安全区</button><button class="btn quiet sm ${d.showGrid ? "on" : ""}" data-act="cd-grid">网格</button>
      <button class="btn quiet sm icon" data-act="cd-zoom" data-d="-1" aria-label="缩小">−</button><button class="btn quiet sm px" data-act="cd-fit" title="适应窗口">${Math.round(cd.zoom * 100)}%</button><button class="btn quiet sm icon" data-act="cd-zoom" data-d="1" aria-label="放大">+</button><span class="sep"></span>
      <div class="menu-wrap"><button class="btn primary sm" data-act="cd-export-menu" aria-expanded="${cd.exportOpen}">导出 ▾</button>${cd.exportOpen ? `<div class="menu" role="menu"><button data-act="cd-export" data-f="png">PNG　${d.width}×${d.height}</button><button data-act="cd-export" data-f="jpg">JPG（体积更小）</button><button data-act="cd-export" data-f="all">四种尺寸各一张</button><hr><button data-act="cd-export" data-f="copy">复制到剪贴板</button></div>` : ""}</div></div>
    <div class="cd-work"><aside class="cd-lib"><nav class="seg cd-tabs">${[["templates", "版式"], ["text", "文字"], ["shape", "元素"], ["bg", "背景"]].map(([k, l]) => `<button class="${cd.tool === k ? "on" : ""}" data-act="cd-tool" data-tool="${k}">${l}</button>`).join("")}</nav>${cdLibrary(p, d)}</aside>
      <main class="cd-stage" data-cd-stage><div class="cd-board ${d.showGrid ? "grid" : ""}" data-cd-board><canvas class="cd-cv" data-cd-cv></canvas><div class="cd-ovl" data-cd-ovl></div></div>${cd.variants ? cdVariantsHTML(p, d) : ""}</main>
      <aside class="cd-insp">${cdInspector(p, d)}</aside></div></div>`;
  cd.enter = false;
  $(".cd-lib").scrollTop = libScroll; $(".cd-insp").scrollTop = inspScroll;
  bindCover(); cdPaint(); cdPaintThumbs(p, d); indicators($("#cover"));
}
function cdPaintThumbs(p, d) {
  $$("[data-tpl]").forEach(cv => { const k = cv.dataset.tpl; const b = cdBuild(p, k, d.width, d.height); const tmp = { ...d, ...b, bgX: d.bgX, bgY: d.bgY, bgScale: d.bgScale, bgBlur: d.bgBlur }; renderToCanvas(cv, tmp, 72); });
  $$("[data-var]").forEach(cv => { const v = cd.variants?.[+cv.dataset.var]; if (v) renderToCanvas(cv, v, Number(cv.dataset.w) || 150); });
}
// 舞台：画布 + 覆盖层（选框、参考线、安全区、行内编辑）
function cdPaint() {
  const p = project(); if (!p || !cd.open) return; const d = ensureDesign(p);
  const cv = $("[data-cd-cv]"); const board = $("[data-cd-board]"); if (!cv || !board) return;
  const z = cd.zoom; board.style.width = `${Math.round(d.width * z)}px`; board.style.height = `${Math.round(d.height * z)}px`;
  renderToCanvas(cv, d, d.width * z, { skip: cd.editing });
  cdOverlay(p, d);
}
function cdOverlay(p, d) {
  const ov = $("[data-cd-ovl]"); if (!ov) return; const z = cd.zoom;
  const keepEditor = $(".cd-editor", ov);
  let html = "";
  if (d.showSafe) {
    const s = CD_SAFE[d.preset] || { zones: [] };
    html += s.zones.map(zn => `<div class="cd-zone" style="left:${zn.x * d.width * z}px;top:${zn.y * d.height * z}px;width:${zn.w * d.width * z}px;height:${zn.h * d.height * z}px"><span class="px">${esc(zn.label)}</span></div>`).join("");
    if (s.crop) html += `<div class="cd-crop" style="top:${s.crop.y * d.height * z}px;height:${s.crop.h * d.height * z}px"><span class="px">${esc(s.crop.label)}</span></div>`;
  }
  html += cd.guides.map(g => g.x != null ? `<i class="cd-guide v" style="left:${g.x * z}px"></i>` : `<i class="cd-guide h" style="top:${g.y * z}px"></i>`).join("");
  const e = cdEl(p);
  if (e && e.visible !== false && cd.editing !== e.id) {
    html += `<div class="cd-sel ${e.locked ? "locked" : ""}" style="left:${e.x * z}px;top:${e.y * z}px;width:${e.w * z}px;height:${e.h * z}px;transform:rotate(${+e.rotation || 0}deg)">${e.locked ? `<span class="cd-lockt px">已锁定</span>` : `${["nw", "ne", "sw", "se"].map(k => `<span class="cd-h ${k}" data-h="${k}"></span>`).join("")}<span class="cd-h rot" data-h="rot" title="旋转（Shift 每次 15°）"></span><span class="cd-dim px">${Math.round(e.w)} × ${Math.round(e.h)}</span>`}</div>`;
  }
  ov.innerHTML = html;
  if (keepEditor) ov.appendChild(keepEditor);
}
function cdToDesign(ev) { const r = $("[data-cd-cv]").getBoundingClientRect(); return { x: (ev.clientX - r.left) / cd.zoom, y: (ev.clientY - r.top) / cd.zoom }; }
function cdHitAt(d, pt) {
  return d.elements.filter(e => e.visible !== false && !e.locked).sort((a, b) => b.z - a.z).find(e => { const cx = +e.x + +e.w / 2, cy = +e.y + +e.h / 2; const a = -(+e.rotation || 0) * Math.PI / 180; const dx = pt.x - cx, dy = pt.y - cy; const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a); const pad = 6 / cd.zoom; return Math.abs(lx) <= +e.w / 2 + pad && Math.abs(ly) <= +e.h / 2 + pad; });
}
function cdSnap(d, e, nx, ny, off) {
  cd.guides = []; if (off) return { x: nx, y: ny };
  const thr = 7 / cd.zoom; const others = d.elements.filter(o => o.id !== e.id && o.visible !== false);
  const vx = [0, d.width / 2, d.width, ...others.flatMap(o => [+o.x, +o.x + +o.w / 2, +o.x + +o.w])];
  const hy = [0, d.height / 2, d.height, ...others.flatMap(o => [+o.y, +o.y + +o.h / 2, +o.y + +o.h])];
  const pick = (pos, size, lines) => { let best = null; [0, size / 2, size].forEach(k => lines.forEach(l => { const diff = l - (pos + k); if (Math.abs(diff) < thr && (!best || Math.abs(diff) < Math.abs(best.diff))) best = { diff, line: l }; })); return best; };
  const bx = pick(nx, +e.w, vx), by = pick(ny, +e.h, hy);
  if (bx) { nx += bx.diff; cd.guides.push({ x: bx.line }); } if (by) { ny += by.diff; cd.guides.push({ y: by.line }); }
  return { x: nx, y: ny };
}
let cdPaintRaf = 0;
const cdPaintSoon = () => { cancelAnimationFrame(cdPaintRaf); cdPaintRaf = requestAnimationFrame(cdPaint); };
function cdPointerDown(ev) {
  if (ev.button !== 0 || ev.target.closest(".cd-editor")) return;
  const p = project(); const d = ensureDesign(p); const pt = cdToDesign(ev);
  const handle = ev.target.closest("[data-h]")?.dataset.h;
  const e0 = cdEl(p);
  ev.preventDefault(); cdCommitEdit();
  const before = JSON.stringify(d); let moved = false;
  const finish = () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); document.body.classList.remove("gesture"); cd.guides = []; if (moved) { cdPush(p, before); touch(p); } renderCover(); };
  let move, up = finish;
  document.body.classList.add("gesture");
  if (handle && e0) {
    const st = { ...e0, px: pt.x, py: pt.y, fs: +e0.fontSize || 0 }; const a = (+st.rotation || 0) * Math.PI / 180; const cos = Math.cos(a), sin = Math.sin(a);
    const c0 = { x: +st.x + +st.w / 2, y: +st.y + +st.h / 2 };
    move = m => {
      moved = true; const q = cdToDesign(m);
      if (handle === "rot") { let deg = Math.atan2(q.y - c0.y, q.x - c0.x) * 180 / Math.PI + 90; if (m.shiftKey) deg = Math.round(deg / 15) * 15; else if (Math.abs(((deg % 90) + 90) % 90) < 3 || Math.abs(((deg % 90) + 90) % 90) > 87) deg = Math.round(deg / 90) * 90; e0.rotation = Math.round(((deg + 540) % 360) - 180); }
      else {
        const sx = handle.includes("e") ? 1 : -1, sy = handle.includes("s") ? 1 : -1;
        const dx = q.x - st.px, dy = q.y - st.py; const lx = dx * cos + dy * sin, ly = -dx * sin + dy * cos;
        let w = Math.max(8, +st.w + sx * lx), h = Math.max(8, +st.h + sy * ly);
        if ((e0.type === "image" && !m.shiftKey) || (e0.type !== "image" && m.shiftKey) || e0.shape === "ellipse" && m.shiftKey) { const k = Math.max(w / st.w, h / st.h); w = st.w * k; h = st.h * k; }
        const fx = c0.x + (-sx * st.w / 2) * cos - (-sy * st.h / 2) * sin, fy = c0.y + (-sx * st.w / 2) * sin + (-sy * st.h / 2) * cos;
        const cx = fx + (sx * w / 2) * cos - (sy * h / 2) * sin, cy = fy + (sx * w / 2) * sin + (sy * h / 2) * cos;
        Object.assign(e0, { w: Math.round(w), h: Math.round(h), x: Math.round(cx - w / 2), y: Math.round(cy - h / 2) });
        if (e0.type === "text" && m.shiftKey && st.fs) e0.fontSize = Math.round(st.fs * w / st.w);
      }
      cdPaintSoon();
    };
  } else {
    const hit = cdHitAt(d, pt);
    if (hit) {
      const dbl = hit.type === "text" && cd.lastDown?.id === hit.id && Date.now() - cd.lastDown.t < 380;
      cd.lastDown = { id: hit.id, t: Date.now() };
      if (dbl) { document.body.classList.remove("gesture"); cd.lastDown = null; cdStartEdit(hit.id); return; }
      if (cd.sel !== hit.id) { cd.sel = hit.id; }
      const st = { x: +hit.x, y: +hit.y, px: pt.x, py: pt.y };
      move = m => { const q = cdToDesign(m); if (!moved && Math.abs(q.x - st.px) + Math.abs(q.y - st.py) < 2 / cd.zoom) return; moved = true; const s = cdSnap(d, hit, st.x + q.x - st.px, st.y + q.y - st.py, m.altKey); hit.x = Math.round(s.x); hit.y = Math.round(s.y); cdPaintSoon(); };
      up = () => { if (moved) cd.lastDown = null; finish(); };
      if (cd.sel === hit.id) cdPaint();
    } else if (d.backgroundImage && (cd.tool === "bg" || ev.altKey || ev.shiftKey)) {
      const im = cdImg(d.backgroundImage); const st = { x: +d.bgX || 0, y: +d.bgY || 0, px: pt.x, py: pt.y };
      move = m => { if (!im) return; moved = true; const q = cdToDesign(m); const s = Math.max(d.width / im.naturalWidth, d.height / im.naturalHeight) * (+d.bgScale || 1); const ex = Math.max(1, im.naturalWidth * s - d.width) / 2, ey = Math.max(1, im.naturalHeight * s - d.height) / 2; d.bgX = clamp(st.x + (q.x - st.px) / ex, -1, 1); d.bgY = clamp(st.y + (q.y - st.py) / ey, -1, 1); cdPaintSoon(); };
      $("[data-cd-board]")?.classList.add("bg-drag");
      up = () => { $("[data-cd-board]")?.classList.remove("bg-drag"); finish(); };
    } else {
      const had = cd.sel; cd.sel = ""; document.body.classList.remove("gesture"); if (had) renderCover(); return;
    }
  }
  document.addEventListener("pointermove", move); document.addEventListener("pointerup", up);
}
// 双击文字，直接在封面上改
function cdStartEdit(id) {
  const p = project(); const e = cdEl(p, id); const ov = $("[data-cd-ovl]"); if (!e || !ov || e.type !== "text") return;
  cd.editing = id; cd.sel = id; const z = cd.zoom; const before = JSON.stringify(ensureDesign(p));
  const ta = document.createElement("textarea"); ta.className = "cd-editor"; ta.value = e.text || ""; ta.dataset.id = id; ta.dataset.before = before;
  Object.assign(ta.style, { left: `${e.x * z}px`, top: `${e.y * z}px`, width: `${Math.max(80, e.w * z)}px`, height: `${Math.max(40, e.h * z)}px`, fontSize: `${Math.max(12, (+e.fontSize || 48) * z)}px`, fontWeight: e.fontWeight || 700, textAlign: e.align || "left", lineHeight: e.lineHeight || 1.1, color: e.color || "#fff", fontFamily: fontOf(e), transform: `rotate(${+e.rotation || 0}deg)` });
  ta.addEventListener("input", () => { e.text = ta.value; touch(p); });
  ta.addEventListener("keydown", ev => { ev.stopPropagation(); if (ev.key === "Escape") { ev.preventDefault(); e.text = JSON.parse(before).elements.find(x => x.id === id)?.text ?? e.text; ta.dataset.before = ""; cdCommitEdit(); renderCover(); } if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); cdCommitEdit(); renderCover(); } });
  ta.addEventListener("blur", () => setTimeout(() => { if (cd.editing === id) { cdCommitEdit(); renderCover(); } }, 0));
  cdPaint(); ov.appendChild(ta); ta.focus(); ta.select();
}
function cdCommitEdit() {
  const ta = $(".cd-editor"); if (!cd.editing) { ta?.remove(); return; }
  const p = project(); const id = cd.editing; cd.editing = "";
  if (ta && p) { const before = ta.dataset.before; if (before && before !== JSON.stringify(ensureDesign(p))) cdPush(p, before); ta.remove(); }
}
function bindCover() {
  const st = $("[data-cd-stage]"); if (!st) return;
  st.addEventListener("pointerdown", ev => { if (ev.target.closest("[data-cd-board]")) cdPointerDown(ev); else if (!ev.target.closest(".cd-vars") && cd.sel) { cdCommitEdit(); cd.sel = ""; renderCover(); } });
  st.addEventListener("wheel", ev => { if (!(ev.metaKey || ev.ctrlKey)) return; ev.preventDefault(); cd.zoom = clamp(cd.zoom * Math.exp(-ev.deltaY * .004), .12, 1.2); cdPaint(); const z = $(".cd-top [data-act='cd-fit']"); if (z) z.textContent = `${Math.round(cd.zoom * 100)}%`; }, { passive: false });
  $("[data-cd-cv]")?.addEventListener("pointermove", ev => { if (document.body.classList.contains("gesture")) return; const hit = cdHitAt(ensureDesign(project()), cdToDesign(ev)); $("[data-cd-board]")?.classList.toggle("over", Boolean(hit)); });
}
function cdSync() { cdPaintSoon(); }
function cdFit() { const p = project(); const s = $("[data-cd-stage]")?.getBoundingClientRect(); const d = ensureDesign(p); if (s) cd.zoom = clamp(Math.min((s.width - 64) / d.width, (s.height - 64) / d.height), .12, 1); renderCover(); }
function cdAdd(type, preset) {
  const p = project(); const d = ensureDesign(p); cdPush(p);
  const z = Math.max(0, ...d.elements.map(e => +e.z || 0)) + 1; const W = d.width, H = d.height, m = Math.min(W, H);
  const mid = (w, h) => ({ x: Math.round((W - w) / 2), y: Math.round((H - h) / 2) });
  let e;
  if (type === "text") {
    const t = cdTexts(p);
    const P = {
      title: { text: t.main, fontSize: m * .12, fontWeight: 900, w: W * .86, h: m * .32 },
      sub: { text: t.sub || "副标题", fontSize: m * .045, fontWeight: 600, w: W * .8, h: m * .08 },
      tag: { text: t.tag, fontSize: m * .04, fontWeight: 800, w: m * .3, h: m * .075, align: "center", bgColor: "#FF4F5E", bgPad: .35 },
      num: { text: t.num, fontSize: m * .3, fontWeight: 900, w: m * .3, h: m * .3, color: "#3DD68C", lineHeight: 1, autoFit: false },
      stroke: { text: t.main, fontSize: m * .13, fontWeight: 900, w: W * .9, h: m * .32, align: "center", color: "#FFD23F", strokeWidth: m * .012, strokeColor: "#111111", shadowY: m * .01, shadowColor: "#111111" },
      bar: { text: t.main, fontSize: m * .09, fontWeight: 900, w: W * .84, h: m * .26, bgColor: "#FF4F7B", bgPad: .16, lineHeight: 1.3 },
      quote: { text: `“${t.sub || t.main}”`, fontSize: m * .06, fontWeight: 600, w: W * .8, h: m * .2, fontFamily: "serif", align: "center", lineHeight: 1.4 },
      pixel: { text: t.main, fontSize: m * .09, fontWeight: 400, w: W * .84, h: m * .22, fontFamily: "pixel", lineHeight: 1.25 }
    }[preset] || {};
    e = TX({ ...P, ...mid(P.w || W * .8, P.h || m * .2), z });
  } else if (type === "image") { const w = W * .7, h = Math.min(H * .6, w * 1.2); e = { id: uid("layer"), type: "image", ...mid(w, h), w, h, rotation: 0, z, opacity: 1, visible: true, url: preset, fit: "cover", borderRadius: 0, strokeWidth: 0, strokeColor: "#FFFFFF" }; }
  else {
    const P = { rect: { w: m * .4, h: m * .22 }, round: { w: m * .4, h: m * .14, borderRadius: m * .05, fill: "#FFD23F" }, ellipse: { shape: "ellipse", w: m * .3, h: m * .3, fill: "#FF4F7B" }, line: { w: W * .6, h: Math.max(3, m * .006) }, arrow: { shape: "arrow", w: m * .32, h: m * .12, fill: "#FFD23F" }, fade: { x: 0, y: H * .5, w: W, h: H * .5, fill: "#000000", fill2: "rgba(0,0,0,0)", gradAngle: 0, opacity: .9 }, frame: { x: m * .04, y: m * .04, w: W - m * .08, h: H - m * .08, fill: "rgba(0,0,0,0)", strokeWidth: m * .01, strokeColor: "#FFFFFF" } }[preset] || {};
    e = SH({ ...mid(P.w || 200, P.h || 100), ...P, z });
  }
  ["x", "y", "w", "h", "fontSize"].forEach(k => { if (e[k] != null) e[k] = Math.round(e[k]); });
  d.elements.push(e); cd.sel = e.id; touch(p); renderCover();
}
async function cdGenBg(btn) {
  if (!needImage()) return;
  const p = project(); busy(btn, true, "出图中");
  const d = ensureDesign(p);
  const j = jqStart({ key: `cover:${p.id}`, kind: "cover", label: "封面背景", pid: p.id, phase: "等模型出图", retry: () => { if (!cd.open) openCover(); cdGenBg($("[data-act='cd-gen-bg']")); },
    where: () => cd.open && route.view === "project" && route.projectId === p.id, go: () => { if (route.view !== "project" || route.projectId !== p.id) go("project", p.id); if (!cd.open) openCover(); } });
  try { const r = await imageCall(p, coverValue(p, "coverBackgroundPrompt"), "auto", { area: "image.cover", ratio: d.preset, signal: j.signal }); cdPush(p); Object.assign(ensureDesign(p), { backgroundImage: r.imageUrl, bgX: 0, bgY: 0, bgScale: 1 }); p.coverImageUrl = r.imageUrl; p.coverLastError = ""; touch(p); jqEnd(j, `背景已生成：${r.model}`); petEvent("image"); }
  catch (e) { p.coverLastError = jqFail(j, e) ? "" : e.message; touch(p); }
  finally { busy(btn, false); if (cd.open && route.projectId === p.id) renderCover(); }
}
// 一键 4 版：同一份文字，换四种不同版式
function cdVariantsHTML(p, d) {
  return `<div class="cd-vars" role="dialog" aria-label="多版预览"><div class="cd-vars-h"><b class="px">选一版</b><span class="px faint">同样的文字，四种排法；选中后还能继续改</span><span class="grow"></span><button class="btn line sm" data-act="cd-variants">再换 4 版</button><button class="btn quiet sm" data-act="cd-variants-close">${icon("x")}</button></div><div class="cd-vars-row">${cd.variants.map((v, i) => `<button class="cd-var" data-act="cd-variant-use" data-i="${i}"><canvas data-var="${i}" data-w="${d.width > d.height ? 220 : 150}"></canvas><span>${esc(CD_TEMPLATES.find(t => t.k === v.template)?.name || "")}</span></button>`).join("")}</div></div>`;
}
function cdMakeVariants(p) {
  const d = ensureDesign(p); const ks = CD_TEMPLATES.map(t => t.k).filter(k => k !== d.template);
  const start = (cd.varSeed++ * 4) % ks.length; const pick = Array.from({ length: 4 }, (_, i) => ks[(start + i) % ks.length]);
  cd.variants = pick.map(k => { const b = cdBuild(p, k, d.width, d.height); return { ...copy(d), ...b }; });
}

// ---------- 导出 ----------
async function coverBlob(d, type = "image/png", q = .92) {
  await cdLoadAll(d); try { await document.fonts?.load?.('48px "Fusion Pixel"'); } catch (_) {}
  const cv = document.createElement("canvas"); cv.width = d.width; cv.height = d.height; drawCover(cv.getContext("2d"), d, { scale: 1 });
  return new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error("导出失败")), type, q));
}
async function downloadCover(p, format = "png") {
  const d = ensureDesign(p);
  try {
    if (format === "all") {
      for (const pr of CD_PRESETS) { const c = copy(d); if (c.preset !== pr.k) cdScaleDesign(c, pr.k); download(`${p.title}-封面-${pr.k.replace(":", "x")}.png`, await coverBlob(c)); await new Promise(r => setTimeout(r, 250)); }
      toast("已导出四种尺寸的封面"); return true;
    }
    if (format === "copy") {
      const blob = await coverBlob(d);
      try { await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); toast("封面已复制，可以直接粘贴"); }
      catch (_) { download(`${p.title}-封面.png`, blob); toast("这个窗口不能复制图片，已改为下载 PNG", 3600); }
      return true;
    }
    const jpg = format === "jpg";
    download(`${p.title}-封面.${jpg ? "jpg" : "png"}`, await coverBlob(d, jpg ? "image/jpeg" : "image/png")); toast(`封面 ${jpg ? "JPG" : "PNG"} 已导出`);
    return true;
  } catch (e) { toast(e.message, 4200, "err"); return false; }
}

// ---------- 动作 ----------
let cdSnapBefore = "";
function cdApplyProp(target, el) {
  const f = el.dataset.prop; const t = el.dataset.t;
  let v = t === "num" ? Number(el.value) : t === "bool" ? el.checked : el.value;
  if (f === "bgOn") { if (!v) target._bg = target.bgColor || target._bg; target.bgColor = v ? (target._bg || "#FF4F7B") : ""; return "bgColor"; }
  if (f === "gradOn") { if (!v) target._f2 = target.fill2 || target._f2; target.fill2 = v ? (target._f2 || "rgba(0,0,0,0)") : ""; return "fill2"; }
  if (f === "bgColor" && !target.bgColor) { target._bg = v; return f; }
  if (f === "fill2" && !target.fill2) { target._f2 = v; target.fill2 = v; return f; }
  target[f] = v; return f;
}
Object.assign(EXT_ACTS, {
  "cd-close": () => closeCover(),
  "cd-tool": el => { cd.tool = el.dataset.tool; renderCover(); },
  "cd-template": el => { const p = project(); cdPush(p); cdApplyTemplate(p, el.dataset.t); cd.sel = ""; touch(p); renderCover(); },
  "cd-variants": () => { const p = project(); cdMakeVariants(p); renderCover(); },
  "cd-variants-close": () => { cd.variants = null; renderCover(); },
  "cd-variant-use": el => { const p = project(); const v = cd.variants?.[+el.dataset.i]; if (!v) return; cdPush(p); p.coverDesign = copy(v); cd.variants = null; cd.sel = ""; touch(p); renderCover(); toast("已换成这一版，原来的可以撤销回去", 2400); },
  "cd-preset": el => { const p = project(); const d = ensureDesign(p); if (d.preset === el.dataset.k) return; cdPush(p); cdScaleDesign(d, el.dataset.k); touch(p); cd.sel = ""; renderCover(); requestAnimationFrame(() => cdFit()); toast(`已换成 ${presetOf(el.dataset.k).label}，元素按比例重排了；不满意可以再点一次版式`, 3600); },
  "cd-add": el => cdAdd(el.dataset.type, el.dataset.preset),
  "cd-select": el => { cd.sel = el.dataset.id; renderCover(); },
  "cd-undo": () => cdRestore("undo"), "cd-redo": () => cdRestore("redo"),
  "cd-dup": () => { const p = project(); const d = ensureDesign(p); const s = cdEl(p); if (!s) return; cdPush(p); const c = { ...copy(s), id: uid("layer"), x: +s.x + 28, y: +s.y + 28, z: Math.max(...d.elements.map(e => +e.z)) + 1, locked: false }; d.elements.push(c); cd.sel = c.id; touch(p); renderCover(); },
  "cd-del": () => { const p = project(); const d = ensureDesign(p); if (!cd.sel) return; cdPush(p); d.elements = d.elements.filter(e => e.id !== cd.sel); cd.sel = ""; touch(p); renderCover(); },
  "cd-grid": () => { const p = project(); const d = ensureDesign(p); d.showGrid = !d.showGrid; touch(p); renderCover(); },
  "cd-safe": () => { const p = project(); const d = ensureDesign(p); d.showSafe = !d.showSafe; touch(p); renderCover(); },
  "cd-zoom": el => { cd.zoom = clamp(cd.zoom * (Number(el.dataset.d) > 0 ? 1.15 : 1 / 1.15), .12, 1.2); renderCover(); },
  "cd-fit": () => cdFit(),
  "cd-layer": el => { const p = project(); const d = ensureDesign(p); const e = cdEl(p); if (!e) return; const o = d.elements.slice().sort((a, b) => a.z - b.z); const i = o.indexOf(e); const j = el.dataset.dir === "fwd" ? i + 1 : i - 1; if (j < 0 || j >= o.length) return; cdPush(p); [e.z, o[j].z] = [o[j].z, e.z]; touch(p); renderCover(); },
  "cd-vis": el => { const p = project(); const e = cdEl(p, el.dataset.id); if (!e) return; cdPush(p); e.visible = e.visible === false; touch(p); renderCover(); },
  "cd-lock": el => { const p = project(); const e = cdEl(p, el.dataset.id); if (!e) return; e.locked = !e.locked; touch(p); renderCover(); },
  "cd-visible": () => { const p = project(); const e = cdEl(p); if (!e) return; cdPush(p); e.visible = e.visible === false; touch(p); renderCover(); },
  "cd-align": el => { const p = project(); const d = ensureDesign(p); const e = cdEl(p); if (!e) return; cdPush(p); const k = el.dataset.k; if (k === "l") e.x = 0; if (k === "r") e.x = d.width - e.w; if (k === "ch") e.x = Math.round((d.width - e.w) / 2); if (k === "t") e.y = 0; if (k === "b") e.y = d.height - e.h; if (k === "cv") e.y = Math.round((d.height - e.h) / 2); touch(p); renderCover(); },
  "cd-set": el => { const p = project(); const d = ensureDesign(p); const target = el.dataset.scope === "cdd" ? d : cdEl(p); if (!target) return; cdPush(p); target[el.dataset.prop] = el.dataset.v; touch(p); renderCover(); },
  "cd-fx": el => { const p = project(); const e = cdEl(p); if (!e) return; cdPush(p); const m = Math.min(ensureDesign(p).width, ensureDesign(p).height); const k = el.dataset.k; if (k === "none") Object.assign(e, { strokeWidth: 0, shadowBlur: 0, shadowY: 0, bgColor: "" }); if (k === "stroke") Object.assign(e, { strokeWidth: Math.round(m * .01), strokeColor: e.color === "#111111" ? "#FFFFFF" : "#111111" }); if (k === "shadow") Object.assign(e, { shadowBlur: Math.round(m * .025), shadowY: Math.round(m * .008), shadowColor: "rgba(0,0,0,.7)" }); if (k === "bar") Object.assign(e, { bgColor: "#FF4F7B", bgPad: .16, lineHeight: Math.max(1.25, e.lineHeight || 1) }); if (k === "glow") Object.assign(e, { shadowBlur: Math.round(m * .04), shadowY: 0, shadowColor: e.accent || "#FFD23F" }); touch(p); renderCover(); },
  "cd-as-bg": () => { const p = project(); const d = ensureDesign(p); const e = cdEl(p); if (!e?.url) return; cdPush(p); Object.assign(d, { backgroundImage: e.url, bgX: 0, bgY: 0, bgScale: 1 }); d.elements = d.elements.filter(x => x.id !== e.id); cd.sel = ""; touch(p); renderCover(); },
  "cd-gen-bg": el => cdGenBg(el),
  "cd-clear-bg": () => { const p = project(); cdPush(p); ensureDesign(p).backgroundImage = ""; touch(p); renderCover(); },
  "cd-set-bg": el => { const p = project(); cdPush(p); Object.assign(ensureDesign(p), { backgroundImage: el.dataset.url, bgX: 0, bgY: 0, bgScale: 1 }); p.coverImageUrl = el.dataset.url; touch(p); renderCover(); },
  "cd-export-menu": () => { cd.exportOpen = !cd.exportOpen; renderCover(); },
  "cd-export": async el => { cd.exportOpen = false; renderCover(); const p = project(); const f = el.dataset.f; const ok = await downloadCover(p, f); if (ok && f !== "copy") { p.exports = { ...(p.exports || {}), cover: now() }; touch(p); petOnExport(p, "cover"); } }
});
Object.assign(EXT_INS, {
  "cdp": (el, t) => {
    const p = project(); const e = cdEl(p); if (!e) return;
    if (t === "input" && !cdSnapBefore) cdSnapBefore = JSON.stringify(ensureDesign(p));
    if (el.type === "checkbox" || el.tagName === "SELECT" ? t !== "change" : false) return;
    const f = cdApplyProp(e, el); touch(p); cdPaintSoon();
    const v = el.closest(".cdf")?.querySelector("[data-v]"); if (v) v.textContent = el.type === "range" ? (f === "opacity" ? `${Math.round(el.value * 100)}%` : ["bright", "contrast", "sat", "gray"].includes(f) ? `${el.value}%` : ["lineHeight", "letterSpacing"].includes(f) ? Number(el.value).toFixed(2) : Math.round(el.value * 10) / 10) : "";
    if (t === "change") { if (cdSnapBefore) cdPush(p, cdSnapBefore); cdSnapBefore = ""; if (["text", "fontFamily", "fontWeight", "fill2", "bgColor"].includes(f) || el.type === "checkbox" || el.tagName === "SELECT") renderCover(); }
  },
  "cdd": (el, t) => {
    const p = project(); const d = ensureDesign(p);
    if (t === "input" && !cdSnapBefore) cdSnapBefore = JSON.stringify(d);
    if (el.tagName === "SELECT" && t !== "change") return;
    cdApplyProp(d, el); touch(p); cdPaintSoon();
    const v = el.closest(".cdf")?.querySelector("[data-v]"); if (v) { const f = el.dataset.prop; v.textContent = f === "bgBlur" ? `${el.value}px` : ["bgDim", "bgGradK", "bgScale"].includes(f) ? `${Math.round(el.value * 100)}%` : Number(el.value).toFixed(2); }
    if (t === "change") { if (cdSnapBefore) cdPush(p, cdSnapBefore); cdSnapBefore = ""; }
  },
  "cd-upload": async (el, t) => { if (t !== "change" || !el.files?.[0]) return; try { const d = await uploadAsset(el.files[0], 20_000_000); if (d.mediaType !== "image") throw new Error("这里只能放图片"); cdAdd("image", d.assetUrl); } catch (e) { toast(e.message, 4000, "err"); } },
  "cd-bg-upload": async (el, t) => { if (t !== "change" || !el.files?.[0]) return; try { const d = await uploadAsset(el.files[0], 20_000_000); if (d.mediaType !== "image") throw new Error("这里只能放图片"); const p = project(); cdPush(p); Object.assign(ensureDesign(p), { backgroundImage: d.assetUrl, bgX: 0, bgY: 0, bgScale: 1 }); touch(p); renderCover(); } catch (e) { toast(e.message, 4000, "err"); } },
  "cd-prompt": (el, t) => { if (t !== "input") return; const p = project(); p.coverBackgroundPrompt = el.value; touch(p); },
  "cd-bg": () => {}, "cd-prop": () => {}
});
