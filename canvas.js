"use strict";
// 帧比特 3.4 · 画布
// 创作逻辑来自 FrameBit 0.1.2：文本 / 图片 / 视频 / 音频四种创作节点，上游文本做提示词、上游图片做参考图，
// 拖出连线落空处弹出推荐节点；界面参考 TapNow：媒体优先的卡片、标题在卡片上方、选中节点下方浮出生成面板、
// 两侧 + 号、左侧工具条、左下角缩放与小地图、框选。编导结构节点（选题、风格、脚本、分镜、成片、发布）继续由内容自动生成。

const NODE_W = { topic: 280, style: 280, script: 300, shot: 150, publish: 300, cut: 560, text: 300, image: 260, video: 300, audio: 300 };
const FREE_TYPES = ["text", "image", "video", "audio"];
const STRUCT_TYPES = ["topic", "style", "script", "shot", "publish", "cut"];
const LOCKED_TYPES = ["topic", "style", "script", "publish"];
const FREE_LABEL = { text: "文本", note: "文本", image: "图片", video: "视频", audio: "音频", upload: "素材", cut: "成片", shot: "分镜", topic: "选题", style: "风格画像", script: "分镜脚本", publish: "发布物料" };
const TYPE_TAG = { text: "TEXT", image: "IMAGE", video: "VIDEO", audio: "AUDIO", topic: "01 TOPIC", style: "02 STYLE", script: "03 SCRIPT", shot: "04 SHOT", cut: "05 CUT", publish: "06 PUBLISH" };
const TYPE_HINT = { text: "想法、脚本、台词", image: "文生图 / 参考图生图", video: "文生视频 / 首尾帧", audio: "配乐、音效" };
const RUN = ["InQueue", "InProgress", "submitting"];
const IMAGE_RATIOS = [["9:16", "竖 9:16"], ["16:9", "横 16:9"], ["1:1", "方 1:1"], ["3:4", "3:4"], ["4:3", "4:3"], ["2.35:1", "宽银幕"]];
const VIDEO_RATIOS = [["9:16", "竖 9:16"], ["16:9", "横 16:9"], ["1:1", "方 1:1"]];
const IMAGE_COUNTS = [1, 2, 4];
const VIDEO_DURATIONS = [4, 5, 8, 10];
// 从某类节点拖出连线时，推荐的下游节点（第一个标「推荐」）
const MENU_ORDER = { text: ["image", "video", "audio", "text"], image: ["video", "image"], shot: ["video", "image"], topic: ["text", "image", "video", "audio"], style: ["text", "image", "video", "audio"], script: ["text", "image", "video", "audio"] };
// 允许的连线方向
const OUT_OK = { text: ["text", "image", "video", "audio"], image: ["image", "video"], video: ["cut"], shot: ["video", "image"], topic: ["text", "image", "video", "audio"], style: ["text", "image", "video", "audio"], script: ["text", "image", "video", "audio"] };
const IN_TYPES = ["text", "image", "video", "audio", "cut"];
const BASES = {
  text: () => ({ text: "" }),
  image: () => ({ prompt: "", ratio: "9:16", count: 1, resolution: "", images: [], pick: 0, imageUrl: "", model: "auto", status: "", error: "" }),
  video: () => ({ prompt: "", ratio: "9:16", duration: 5, resolution: "", frameMode: "auto", audio: true, model: "auto", imageSize: "720x1280", negativePrompt: "文字，水印，画面闪烁，肢体畸变", status: "", videoUrl: "", requestId: "", error: "" }),
  audio: () => ({ prompt: "", instrumental: true, version: "v6", model: "auto", audioUrl: "", tracks: [], track: 0, requestId: "", status: "", error: "" })
};
const ui = { sel: "", multi: new Set(), edgeSel: "", tool: "select", tab: "ai", menu: null, draft: null, panels: { left: true, right: true }, exportOpen: false, space: false };
const polls = new Map();
const POLL_TOK = new Map(); // 3.7：每轮查询一个令牌，停止查询后迟到的回包不会再续上
const runPhase = st => st === "InProgress" ? "平台生成中" : st === "submitting" ? "提交中" : st === "InQueue" ? "平台排队中" : "生成中";
const jobs = new Set();
const freshNodes = new Set();
const freshEdges = new Set();

const nodeOf = (p, id) => p?.canvas.nodes.find(n => n.id === id);
const nodeByType = (p, type) => p.canvas.nodes.find(n => n.type === type);
const shotNode = (p, shotId) => p.canvas.nodes.find(n => n.type === "shot" && n.data.shotId === shotId);
const shotOf = (p, node) => node?.data?.shotId ? p.script.find(r => r.id === node.data.shotId) : null;
const selIds = () => { const s = new Set(ui.multi); if (ui.sel) s.add(ui.sel); return [...s]; };
const isSel = id => ui.sel === id || ui.multi.has(id);
function setSel(ids, primary) { ui.multi = new Set(ids); ui.sel = primary ?? ids[ids.length - 1] ?? ""; ui.edgeSel = ""; }

// ---------- 像素图标（8×8） ----------
const ICONS = {
  text: '<rect x="1" y="1" width="6" height="1"/><rect x="1" y="3" width="6" height="1"/><rect x="1" y="5" width="4" height="1"/>',
  image: '<rect x="0" y="1" width="8" height="1"/><rect x="0" y="6" width="8" height="1"/><rect x="0" y="1" width="1" height="6"/><rect x="7" y="1" width="1" height="6"/><rect x="5" y="2" width="1" height="1"/><rect x="2" y="4" width="1" height="1"/><rect x="1" y="5" width="3" height="1"/><rect x="4" y="4" width="1" height="2"/><rect x="5" y="5" width="2" height="1"/>',
  video: '<rect x="0" y="1" width="8" height="1"/><rect x="0" y="6" width="8" height="1"/><rect x="0" y="1" width="1" height="6"/><rect x="7" y="1" width="1" height="6"/><rect x="3" y="2" width="1" height="4"/><rect x="4" y="3" width="1" height="2"/>',
  audio: '<rect x="4" y="1" width="1" height="5"/><rect x="5" y="1" width="2" height="1"/><rect x="6" y="2" width="1" height="1"/><rect x="2" y="5" width="3" height="2"/>',
  fit: '<rect x="0" y="0" width="3" height="1"/><rect x="0" y="0" width="1" height="3"/><rect x="5" y="0" width="3" height="1"/><rect x="7" y="0" width="1" height="3"/><rect x="0" y="7" width="3" height="1"/><rect x="0" y="5" width="1" height="3"/><rect x="5" y="7" width="3" height="1"/><rect x="7" y="5" width="1" height="3"/>',
  trash: '<rect x="1" y="1" width="6" height="1"/><rect x="3" y="0" width="2" height="1"/><rect x="2" y="2" width="1" height="6"/><rect x="5" y="2" width="1" height="6"/><rect x="2" y="7" width="4" height="1"/>',
  x: '<rect x="1" y="1" width="1" height="1"/><rect x="2" y="2" width="1" height="1"/><rect x="3" y="3" width="2" height="2"/><rect x="5" y="5" width="1" height="1"/><rect x="6" y="6" width="1" height="1"/><rect x="6" y="1" width="1" height="1"/><rect x="5" y="2" width="1" height="1"/><rect x="2" y="5" width="1" height="1"/><rect x="1" y="6" width="1" height="1"/>',
  dup: '<rect x="0" y="0" width="5" height="1"/><rect x="0" y="0" width="1" height="5"/><rect x="2" y="2" width="6" height="1"/><rect x="2" y="7" width="6" height="1"/><rect x="2" y="2" width="1" height="6"/><rect x="7" y="2" width="1" height="6"/>',
  select: '<rect x="1" y="0" width="1" height="7"/><rect x="2" y="1" width="1" height="5"/><rect x="3" y="2" width="1" height="4"/><rect x="4" y="3" width="1" height="2"/><rect x="5" y="4" width="1" height="1"/><rect x="4" y="5" width="1" height="2"/><rect x="5" y="6" width="1" height="2"/>',
  hand: '<rect x="1" y="2" width="1" height="3"/><rect x="2" y="1" width="1" height="4"/><rect x="3" y="0" width="1" height="5"/><rect x="4" y="1" width="1" height="4"/><rect x="5" y="2" width="1" height="3"/><rect x="6" y="3" width="1" height="3"/><rect x="1" y="5" width="6" height="1"/><rect x="2" y="6" width="4" height="2"/>',
  upload: '<rect x="3" y="1" width="2" height="5"/><rect x="2" y="2" width="1" height="1"/><rect x="5" y="2" width="1" height="1"/><rect x="1" y="3" width="1" height="1"/><rect x="6" y="3" width="1" height="1"/><rect x="0" y="7" width="8" height="1"/><rect x="0" y="5" width="1" height="2"/><rect x="7" y="5" width="1" height="2"/>',
  plus: '<rect x="3" y="0" width="2" height="8"/><rect x="0" y="3" width="8" height="2"/>',
  spark: '<rect x="3" y="0" width="1" height="8"/><rect x="0" y="3" width="8" height="1"/><rect x="2" y="2" width="3" height="3"/><rect x="6" y="0" width="1" height="1"/><rect x="0" y="6" width="1" height="1"/>',
  play: '<rect x="2" y="1" width="1" height="6"/><rect x="3" y="2" width="1" height="4"/><rect x="4" y="2" width="1" height="4"/><rect x="5" y="3" width="1" height="2"/>',
  pause: '<rect x="2" y="1" width="1" height="6"/><rect x="5" y="1" width="1" height="6"/>',
  focus: '<rect x="0" y="0" width="8" height="1"/><rect x="0" y="7" width="8" height="1"/><rect x="0" y="0" width="1" height="8"/><rect x="7" y="0" width="1" height="8"/><rect x="2" y="2" width="4" height="4"/>',
  split: '<rect x="0" y="0" width="3" height="3"/><rect x="5" y="0" width="3" height="3"/><rect x="0" y="5" width="3" height="3"/><rect x="5" y="5" width="3" height="3"/>',
  go: '<rect x="1" y="3" width="5" height="2"/><rect x="4" y="1" width="1" height="1"/><rect x="5" y="2" width="1" height="1"/><rect x="6" y="3" width="1" height="2"/><rect x="5" y="5" width="1" height="1"/><rect x="4" y="6" width="1" height="1"/>',
  minus: '<rect x="0" y="3" width="8" height="2"/>',
  edit: '<rect x="5" y="0" width="2" height="1"/><rect x="4" y="1" width="1" height="1"/><rect x="7" y="1" width="1" height="1"/><rect x="3" y="2" width="1" height="1"/><rect x="6" y="2" width="1" height="1"/><rect x="2" y="3" width="1" height="1"/><rect x="5" y="3" width="1" height="1"/><rect x="1" y="4" width="1" height="1"/><rect x="4" y="4" width="1" height="1"/><rect x="0" y="5" width="1" height="3"/><rect x="1" y="7" width="3" height="1"/><rect x="3" y="5" width="1" height="1"/><rect x="2" y="6" width="1" height="1"/>',
  topic: '<rect x="0" y="0" width="8" height="2"/><rect x="3" y="2" width="2" height="6"/>',
  style: '<rect x="1" y="0" width="6" height="1"/><rect x="0" y="1" width="1" height="6"/><rect x="7" y="1" width="1" height="6"/><rect x="1" y="7" width="6" height="1"/><rect x="2" y="2" width="1" height="1"/><rect x="5" y="2" width="1" height="1"/><rect x="2" y="5" width="4" height="1"/>',
  script: '<rect x="1" y="0" width="6" height="1"/><rect x="1" y="7" width="6" height="1"/><rect x="1" y="0" width="1" height="8"/><rect x="6" y="0" width="1" height="8"/><rect x="3" y="2" width="2" height="1"/><rect x="3" y="4" width="2" height="1"/>',
  shot: '<rect x="0" y="2" width="5" height="1"/><rect x="0" y="7" width="5" height="1"/><rect x="0" y="2" width="1" height="6"/><rect x="4" y="2" width="1" height="6"/><rect x="5" y="3" width="1" height="4"/><rect x="6" y="2" width="1" height="1"/><rect x="6" y="6" width="1" height="1"/><rect x="7" y="1" width="1" height="1"/><rect x="7" y="7" width="1" height="1"/><rect x="1" y="0" width="1" height="1"/><rect x="3" y="0" width="1" height="1"/>',
  cut: '<rect x="0" y="2" width="8" height="1"/><rect x="0" y="5" width="8" height="1"/><rect x="2" y="3" width="1" height="2"/><rect x="5" y="3" width="1" height="2"/>',
  publish: '<rect x="3" y="0" width="2" height="1"/><rect x="2" y="1" width="4" height="1"/><rect x="1" y="2" width="6" height="1"/><rect x="3" y="3" width="2" height="5"/>'
};
const icon = (name, cls = "") => `<svg class="pxi ${cls}" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">${ICONS[name] || ""}</svg>`;

// ---------- 数据：节点结构与迁移 ----------
function nodeTitle(p, n) {
  if (n.title) return n.title;
  if (n.type === "shot") { const r = shotOf(p, n); return `分镜 ${String(p.script.indexOf(r) + 1).padStart(2, "0")}`; }
  if (n.type === "video" && n.data.shotId) { const r = shotOf(p, n); if (r) return `视频 · 分镜 ${String(p.script.indexOf(r) + 1).padStart(2, "0")}`; }
  return FREE_LABEL[n.type] || "节点";
}
function nextTitle(p, type) {
  const label = FREE_LABEL[type];
  const used = new Set(p.canvas.nodes.filter(n => n.type === type).map(n => n.title));
  let k = p.canvas.nodes.filter(n => n.type === type).length + 1;
  while (used.has(`${label} ${k}`)) k++;
  return `${label} ${k}`;
}
const ratioOf = n => n.data.ratio || "9:16";
const RATIO_SIZE = { "9:16": "720x1280", "16:9": "1280x720", "1:1": "960x960" };
function nodeWidth(n) {
  if (["image", "video"].includes(n.type)) { const [a, b] = ratioOf(n).split(":").map(Number); const r = a / (b || 1); return r < .9 ? (n.type === "video" ? 240 : 220) : r > 1.2 ? (n.type === "video" ? 360 : 340) : 280; }
  return NODE_W[n.type] || n.w || 260;
}
// 3.3 及以前的节点：note → 文本，upload → 按素材类型变成图片 / 视频 / 音频节点
function canvasMigrate(n) {
  const d = n.data || {};
  if (n.type === "note") { n.type = "text"; n.data = { text: String(d.text || "") }; }
  else if (n.type === "upload") {
    const kind = d.mediaType === "video" ? "video" : d.mediaType === "audio" ? "audio" : "image";
    n.type = kind; if (!n.title && d.name) n.title = String(d.name).replace(/\.[^.]+$/, "").slice(0, 24);
    n.data = kind === "image" ? { images: d.assetUrl ? [d.assetUrl] : [], source: "upload" } : kind === "video" ? { videoUrl: d.assetUrl || "", status: d.assetUrl ? "Succeed" : "", source: "upload" } : { audioUrl: d.assetUrl || "", source: "upload" };
  }
  if (BASES[n.type]) {
    if (n.type === "video" && !n.data.ratio && n.data.imageSize) n.data.ratio = { "1280x720": "16:9", "960x960": "1:1" }[n.data.imageSize] || "9:16";
    n.data = { ...BASES[n.type](), ...n.data };
    const x = n.data;
    if (n.type === "image") {
      x.images = (Array.isArray(x.images) ? x.images : []).map(String).filter(Boolean);
      if (!x.images.length && x.imageUrl) x.images = [String(x.imageUrl)];
      x.pick = clamp(Number(x.pick) || 0, 0, Math.max(0, x.images.length - 1));
      x.imageUrl = x.images[x.pick] || "";
      if (x.status === "generating") x.status = "";
    }
    if (n.type === "video" && !RATIO_SIZE[x.ratio]) x.ratio = { "1280x720": "16:9", "960x960": "1:1" }[x.imageSize] || "9:16";
    if (n.type === "audio") { x.tracks = Array.isArray(x.tracks) ? x.tracks.filter(t => t && t.url) : []; if (x.status === "generating") x.status = ""; }
    n.w = nodeWidth(n);
  }
  if (n.type === "text" && n.data.status === "generating") n.data.status = "";
  n.title = String(n.title || "").slice(0, 40);
  return n;
}

// 3.3 的分镜是 16:9 小卡，3.4 改成竖版媒体卡；旧项目第一次打开时把分镜和成片重新排一次
function canvasRelayout(p) {
  if (Number(p.canvas.layout) >= 2) return;
  p.canvas.layout = 2;
  // 自由节点变大了：按从上到下的顺序，把互相压住的往下挪
  const free = p.canvas.nodes.filter(n => FREE_TYPES.includes(n.type) && !n.data.shotId).sort((a, b) => a.y - b.y || a.x - b.x);
  const placed = [];
  free.forEach(n => {
    const w = nodeWidth(n), h = estimateH(n, w);
    let moved = true;
    while (moved) { moved = false; for (const o of placed) { if (n.x < o.x + o.w + 24 && n.x + w + 24 > o.x && n.y < o.y + o.h + 24 && n.y + h + 24 > o.y) { n.y = o.y + o.h + 40; moved = true; } } }
    placed.push({ x: n.x, y: n.y, w, h });
  });
  const shots = p.script.map(r => shotNode(p, r.id)).filter(Boolean);
  if (!shots.length) return;
  const sc = nodeByType(p, "script"); const ox = sc ? sc.x + (sc.w || NODE_W.script) + 80 : 740, oy = sc ? sc.y : 0;
  shots.forEach((n, i) => { n.w = NODE_W.shot; n.x = ox + (i % 3) * 180; n.y = oy + Math.floor(i / 3) * 340; });
  const vx = ox + 3 * 180 + 60;
  p.canvas.nodes.filter(n => n.type === "video" && n.data.shotId).forEach(v => { const s = shotNode(p, v.data.shotId); const i = p.script.findIndex(r => r.id === v.data.shotId); if (s) { v.x = vx + (i % 3) * 270; v.y = s.y; } });
  const cut = nodeByType(p, "cut"); if (cut) { cut.x = ox; cut.y = oy + Math.ceil(shots.length / 3) * 340 + 40; }
}
function defaultPos(p, type, extra = {}) {
  const n = p.script.length;
  if (type === "topic") return { x: 0, y: 0 };
  if (type === "style") return { x: 0, y: 250 };
  if (type === "script") return { x: 360, y: 0 };
  if (type === "publish") return { x: 360, y: Math.max(440, 160 + Math.min(n, 8) * 22 + 80) };
  if (type === "shot") { const i = extra.index ?? 0; return { x: 740 + (i % 3) * 180, y: Math.floor(i / 3) * 340 }; }
  if (type === "cut") return { x: 740, y: Math.ceil(Math.max(n, 1) / 3) * 340 + 40 };
  return { x: 0, y: 0 };
}

function addNode(p, type, pos, data = {}, title = "") {
  const node = { id: uid("node"), type, x: Math.round(pos.x), y: Math.round(pos.y), w: NODE_W[type] || 240, title, data: BASES[type] ? { ...BASES[type](), ...data } : data };
  if (FREE_TYPES.includes(type)) { if (!data.shotId) node.title ||= nextTitle(p, type); node.w = nodeWidth(node); }
  p.canvas.nodes.push(node); freshNodes.add(node.id);
  return node;
}

// 让结构节点与真实内容保持一致；reveal 用于用户主动打开某一步
function ensureStructure(p, reveal = "") {
  const want = {
    topic: true,
    style: styleFilledCount(p.style) > 0 || reveal === "style",
    script: p.script.length > 0 || reveal === "script",
    publish: p.titles.length > 0 || Boolean(p.publishCopy) || p.review.length > 0 || Boolean(p.coverPlan) || Boolean(p.coverDesign) || reveal === "publish",
    cut: p.canvas.nodes.some(n => n.type === "video" && n.data.shotId) || reveal === "cut"
  };
  const free = p.canvas.nodes.some(n => FREE_TYPES.includes(n.type) && !n.data.shotId);
  Object.entries(want).forEach(([type, need]) => {
    if (!need || nodeByType(p, type)) return;
    const pos = free && type !== "topic" ? freeSpot(p, defaultPos(p, type), NODE_W[type], 200) : defaultPos(p, type);
    addNode(p, type, pos, type === "cut" ? { clips: [] } : {});
  });
  const ids = new Set(p.script.map(r => r.id));
  p.canvas.nodes = p.canvas.nodes.filter(n => n.type !== "shot" || ids.has(n.data.shotId));
  p.script.forEach((r, i) => { if (!shotNode(p, r.id)) addNode(p, "shot", defaultPos(p, "shot", { index: i }), { shotId: r.id }); });
  canvasRelayout(p);
  const nodeIds = new Set(p.canvas.nodes.map(n => n.id));
  p.canvas.edges = p.canvas.edges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to));
  ui.multi.forEach(id => { if (!nodeIds.has(id)) ui.multi.delete(id); });
}

function autoEdges(p) {
  const e = [];
  const t = nodeByType(p, "topic"), st = nodeByType(p, "style"), sc = nodeByType(p, "script"), pub = nodeByType(p, "publish"), cut = nodeByType(p, "cut");
  if (t && st) e.push([t.id, st.id]);
  if (sc) e.push([(st || t)?.id, sc.id]);
  if (sc && pub) e.push([sc.id, pub.id]);
  p.canvas.nodes.forEach(n => {
    if (n.type === "shot" && sc) e.push([sc.id, n.id]);
    if (n.type === "video" && n.data.shotId) { const s = shotNode(p, n.data.shotId); if (s) e.push([s.id, n.id]); }
    if (n.type === "video" && cut && n.data.videoUrl && (cut.data.clips || []).some(c => c.url === n.data.videoUrl)) e.push([n.id, cut.id]);
  });
  return e.filter(([a, b]) => a && b).map(([from, to]) => ({ from, to, auto: true, id: `auto:${from}:${to}` }));
}

const upstream = (p, id) => { const out = [], seen = new Set(), q = p.canvas.edges.filter(e => e.to === id).map(e => e.from); while (q.length) { const x = q.shift(); if (seen.has(x)) continue; seen.add(x); const n = nodeOf(p, x); if (n) { out.push(n); p.canvas.edges.filter(e => e.to === x).forEach(e => q.push(e.from)); } } return out; };
const createsCycle = (p, from, to) => from === to || upstream(p, from).some(n => n.id === to);
function nodeImage(p, n) {
  if (!n) return "";
  if (n.type === "image") return n.data.images?.[n.data.pick || 0] || n.data.imageUrl || "";
  if (n.type === "upload" && n.data.mediaType === "image") return n.data.assetUrl || "";
  if (n.type === "shot") return shotOf(p, n)?.imageUrl || "";
  return "";
}
function nodeVideo(n) { return n?.type === "video" ? n.data.videoUrl || "" : n?.type === "upload" && n.data.mediaType === "video" ? n.data.assetUrl || "" : ""; }
function nodeAudio(n) { return n?.type === "audio" ? n.data.tracks?.[n.data.track || 0]?.url || n.data.audioUrl || "" : ""; }
const styleBrief = p => ["visual", "voice", "pace"].map(k => p.style[k]).filter(Boolean).join("；");

// 直接上游的文字和图片：文本节点给提示词，图片节点给参考图（还没出图的图片节点给它的提示词）
function contextOf(p, n) {
  const texts = [], refs = [], from = [], ipRefList = [];
  const shot = shotOf(p, n);
  if (shot) { if (shot.shot) texts.push(shot.shot); if (shot.imageUrl) refs.push(shot.imageUrl); }
  p.canvas.edges.filter(e => e.to === n.id).forEach(e => {
    const u = nodeOf(p, e.from); if (!u) return;
    from.push(u);
    if (u.type === "text" && u.data.text?.trim()) texts.push(u.data.text.trim());
    if (u.type === "image") { const img = nodeImage(p, u); if (img) refs.push(img); else if (u.data.prompt?.trim()) texts.push(u.data.prompt.trim()); }
    if (u.type === "shot") { const r = shotOf(p, u); if (r?.shot) texts.push(r.shot); if (r?.imageUrl) refs.push(r.imageUrl); }
    if (u.type === "topic" && p.topic) texts.push(p.topic);
    if (u.type === "style" && styleBrief(p)) texts.push(styleBrief(p));
    if (u.type === "script" && p.script.length) texts.push(p.script.map((r, i) => `${i + 1}. ${r.shot}${r.voice ? `｜${r.voice}` : ""}`).join("\n"));
    if (u.type === "ip") { const ip = ipById(u.data.ipId); if (ip) {
      if (n.type === "text") texts.push(`用「${ip.name}」的口吻：${ip.profile.voice || ip.profile.personality}${ip.profile.catchphrases.length ? `；口头禅：${ip.profile.catchphrases.join(" / ")}` : ""}${ip.profile.rules.length ? `；禁忌：${ip.profile.rules.join("；")}` : ""}`);
      else { const inj = ipInject({ cast: [] }, "", [ip.id]); texts.push(inj.prompt); ipRefList.push(...inj.refs); if (n.type === "image") refs.push(...inj.refs); }
    } }
  });
  return { texts, refs: [...new Set(refs)], from, ipRefs: [...new Set(ipRefList)] };
}
function promptFor(p, n) {
  const c = contextOf(p, n);
  const parts = [(n.data.prompt || "").trim(), ...c.texts].filter(Boolean);
  return parts.length ? [...new Set(parts)].join("\n") : [p.topic, p.style.visual].filter(Boolean).join("，");
}
function refImage(p, n) { return contextOf(p, n).refs[0] || ""; }

// ---------- 渲染 ----------
// 流程页「画面」等处仍在用 frame()
const holes = k => `<div class="holes" aria-hidden="true">${"<i></i>".repeat(k)}</div>`;
// 3.7：生成中不再画估算的进度，只写平台给的真实状态和已经等了多久
function frameRun(status, t0) { return `<div class="bar"></div><div class="frame-st px"><b>${esc(status || "生成中")}</b><em data-el0="${Number(t0) || Date.now()}">${jqElapsed(t0)}</em></div>`; }
function frame(img, video, { running = false, error = "", vertical = false, empty = "还没有画面", status = "", t0 = 0 } = {}) {
  if (video) return `<div class="frame ${vertical ? "v" : ""}"><video src="${attr(video)}" muted preload="metadata"></video></div>`;
  if (img) return `<div class="frame ${vertical ? "v" : ""} ${running ? "running" : ""}"><img src="${attr(img)}" alt="" ${running ? 'style="opacity:.35"' : ""}>${running ? frameRun(status, t0) : ""}${error && !running ? `<div class="err">${esc(error)}</div>` : ""}</div>`;
  return `<div class="frame none ${vertical ? "v" : ""} ${running ? "running" : ""}">${running ? frameRun(status, t0) : `<span class="px faint">${esc(empty)}</span>`}${error && !running ? `<div class="err">${esc(error)}</div>` : ""}</div>`;
}

const isRunning = (p, n) => n.data?.status === "generating" || RUN.includes(n.data?.status) || (n.type === "shot" && shotOf(p, n)?.imageStatus === "generating");
const runLabel = n => n.data.status === "InQueue" ? "排队中" : n.data.status === "submitting" ? "提交中" : "生成中";
const TAU = { image: 22, video: 110, audio: 70, text: 9, shot: 22 }; // 3.7 起不再用来画进度，只留着给其他模块登记节点类型
// 节点上的状态：排队 / 生成由平台的查询结果决定；图片和文字是一次请求，只能如实写「等模型返回」
const runStatus = n => { const st = n.type === "shot" ? "" : n.data.status; if (st === "InQueue") return "平台排队中"; if (st === "InProgress") return "平台生成中"; if (st === "submitting") return "提交中"; return n.type === "text" ? "等模型返回" : "等模型出图"; };
function progBar(n, started) {
  return `<div class="cn-run"><div class="cn-prog ind" aria-hidden="true"><i></i></div><span class="cn-run-t px"><b>${esc(runStatus(n))}</b><em data-el0="${Number(started) || Date.now()}">${jqElapsed(started)}</em></span></div>`;
}
function emptyState(type, text) { return `<div class="cn-empty">${icon(type, "big")}<span class="px">${esc(text)}</span></div>`; }
function waveBars(seed, n = 36) { let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0; const out = []; for (let i = 0; i < n; i++) { h = (h * 1103515245 + 12345) >>> 0; out.push(2 + (h >> 16) % 9 + Math.round(4 * Math.sin(i / 3) + 4)); } return out; }

function nodeMeta(p, n) {
  const d = n.data;
  if (n.type === "image") return `${ratioOf(n)}${d.resolution ? ` · ${d.resolution.toUpperCase()}` : ""}${d.images?.length > 1 ? ` · ${d.pick + 1}/${d.images.length}` : ""}`;
  if (n.type === "video") return `${ratioOf(n) === "adaptive" ? "自适应" : ratioOf(n)} · ${d.duration || 5}s${d.resolution ? ` · ${d.resolution}` : ""}`;
  if (n.type === "audio") return d.instrumental === false ? "带人声" : "纯音乐";
  if (n.type === "text") return d.text ? `${[...d.text].length} 字` : "";
  if (n.type === "remake") return d.breakdown ? `${(d.breakdown.shots || []).length} 镜拆解` : d.duration ? `${Math.round(d.duration)}s` : "";
  if (n.type === "ip") return ipNodeMeta(p, n);
  if (n.type === "shot") return (shotOf(p, n)?.time || "").split(/[-–~至]/)[0].trim();
  if (n.type === "script") return p.script.length ? `${p.script.length} 镜` : "";
  if (n.type === "cut") return (d.clips || []).length ? `${d.clips.length} 段` : "";
  if (n.type === "style") return p.styleSavedAt ? "已记住" : "";
  if (n.type === "topic") return p.platform || "";
  return "";
}

function nodeBody(p, n) {
  const d = n.data; const s = p.style; const running = isRunning(p, n);
  const err = d.error ? `<div class="cn-err">${esc(d.error)}</div>` : "";
  if (n.type === "remake") return rmNodeBody(p, n);
  if (n.type === "ip") return ipNodeBody(p, n);
  if (n.type === "text") return `<div class="cn-text ${d.text ? "" : "ph"}">${esc(d.text || "双击写下想法、脚本或台词。连到图片 / 视频 / 音频节点，它就是提示词。")}</div>${running ? progBar(n, d.startedAt) : ""}${err}`;
  if (n.type === "image") {
    const img = nodeImage(p, n);
    const media = img ? `<img class="cn-media" src="${attr(img)}" alt="" draggable="false">` : emptyState("image", running ? "" : "描述画面，生成图片");
    const thumbs = d.images?.length > 1 ? `<div class="cn-thumbs">${d.images.slice(0, 8).map((u, i) => `<button class="${i === d.pick ? "on" : ""}" data-act="cn-pick" data-id="${attr(n.id)}" data-i="${i}" aria-label="第 ${i + 1} 张"><img src="${attr(u)}" alt="" draggable="false"></button>`).join("")}</div>` : "";
    return `<div class="cn-media-box" style="aspect-ratio:${ratioOf(n).replace(":", " / ")}">${media}${running ? progBar(n, d.startedAt) : ""}</div>${thumbs}${err}`;
  }
  if (n.type === "video") {
    const ref = d.videoUrl ? "" : refImage(p, n);
    const media = d.videoUrl ? `<video class="cn-media" src="${attr(d.videoUrl)}" muted loop playsinline preload="metadata"></video><span class="cn-badge px">${icon("play")}悬停播放</span>`
      : ref ? `<img class="cn-media dimmed" src="${attr(ref)}" alt="" draggable="false"><span class="cn-badge px">首帧来自上游</span>` : emptyState("video", running ? "" : "描述镜头，生成视频");
    return `<div class="cn-media-box" style="aspect-ratio:${ratioOf(n).replace(":", " / ")}">${media}${running ? progBar(n, d.pollStartedAt || d.startedAt) : ""}</div>${err}`;
  }
  if (n.type === "audio") {
    const url = nodeAudio(n);
    const bars = waveBars(n.id).map(h => `<i style="height:${h * 2}px"></i>`).join("");
    const tracks = d.tracks?.length > 1 ? `<div class="cn-tracks">${d.tracks.map((t, i) => `<button class="px ${i === (d.track || 0) ? "on" : ""}" data-act="cn-track" data-id="${attr(n.id)}" data-i="${i}">${"AB"[i] || i + 1}</button>`).join("")}</div>` : "";
    return `<div class="cn-audio ${url ? "has" : ""}">${url ? `<button class="cn-play" data-act="cn-play" data-id="${attr(n.id)}" aria-label="播放">${icon("play")}</button><audio src="${attr(url)}" preload="metadata"></audio>` : `<span class="cn-play ghost">${icon("audio")}</span>`}<div class="cn-wave" aria-hidden="true">${bars}</div><span class="cn-dur px" data-dur>${url ? "--:--" : running ? "" : "写一句配乐描述"}</span></div>${tracks}${running ? progBar(n, d.pollStartedAt || d.startedAt) : ""}${err}`;
  }
  if (n.type === "topic") return `<div class="cn-paper"><p class="big">${esc(p.topic || "还没写选题")}</p><span class="meta">${esc(p.platform)}${p.accountId && account(p.accountId) ? `　${esc(account(p.accountId).name)}` : ""}</span></div>`;
  if (n.type === "style") {
    const lines = ["positioning", "audience", "voice", "duration"].map(k => s[k]).filter(Boolean);
    return `<div class="cn-paper">${lines.length ? `<p class="txt">${lines.map(esc).join("<br>")}</p>` : `<p class="txt ph">还没填。给谁看、什么语气、多长、怎么开场。</p>`}</div>`;
  }
  if (n.type === "script") {
    const selShot = shotOf(p, nodeOf(p, ui.sel));
    return `<div class="cn-paper">${p.script.length ? `<ol class="txt">${p.script.slice(0, 10).map(r => `<li>${r.id === selShot?.id ? `<span class="mark">${esc((r.voice || r.shot || "（空）").slice(0, 22))}</span>` : esc((r.voice || r.shot || "（空）").slice(0, 22))}</li>`).join("")}</ol>${p.script.length > 10 ? `<span class="meta">还有 ${p.script.length - 10} 镜</span>` : ""}` : `<p class="txt ph">还没有脚本。</p>`}</div>`;
  }
  if (n.type === "shot") {
    const r = shotOf(p, n);
    return `<div class="cn-media-box" style="aspect-ratio:9 / 16">${r?.imageUrl ? `<img class="cn-media" src="${attr(r.imageUrl)}" alt="" draggable="false">` : emptyState("shot", running ? "" : "生成或上传画面")}${running ? progBar(n, r?.imageStartedAt) : ""}${r?.subtitle || r?.voice ? `<span class="cn-cap">${esc(r.subtitle || r.voice)}</span>` : ""}</div>${r?.imageError ? `<div class="cn-err">${esc(r.imageError)}</div>` : ""}`;
  }
  if (n.type === "publish") {
    const must = p.review.filter(x => x.level === "必须修改").length;
    const rows = [`标题　${p.titles.length ? `${p.titles.length} 个` : "未生成"}`, `发布文案　${p.publishCopy ? "已写" : "未写"}`, `封面　${p.coverDesign?.elements?.length ? "已设计" : "未设计"}`, `审稿　${p.review.length ? (must ? `${must} 处必须改` : "已通过") : "未审"}`];
    return `<div class="cn-paper">${p.titles[0] ? `<p class="txt" style="color:var(--text)">${esc(p.titles[0])}</p>` : ""}<p class="txt ph">${rows.map(esc).join("<br>")}</p></div>`;
  }
  if (n.type === "cut") {
    const clips = d.clips || [];
    const total = clips.reduce((a, c) => a + Math.max(0, Number(c.out) - Number(c.in)), 0);
    return `<div class="cn-cut">${clips.length ? `<div class="clips">${clips.map(c => `<div style="flex:${Math.max(.6, Number(c.out) - Number(c.in))}"><video src="${attr(c.url)}" muted preload="metadata"></video></div>`).join("")}</div><span class="meta px">约 ${total.toFixed(0)} 秒</span>` : `<span class="px faint">视频生成后，按分镜顺序排进这里；也可以把视频节点连到这里</span>`}</div>`;
  }
  return "";
}

function renderNode(p, n) {
  const w = FREE_TYPES.includes(n.type) ? nodeWidth(n) : (n.w || NODE_W[n.type]);
  const fi = [...freshNodes].indexOf(n.id);
  const cls = ["cnode", `t-${n.type}`, isSel(n.id) ? "sel" : "", ui.sel === n.id ? "primary" : "", fi >= 0 ? "fresh" : "", isRunning(p, n) ? "running" : "", STRUCT_TYPES.includes(n.type) ? "struct" : ""].filter(Boolean).join(" ");
  const style = `left:${n.x}px;top:${n.y}px;width:${w}px${fi >= 0 ? `;--i:${Math.min(fi, 12)}` : ""}`;
  const canIn = IN_TYPES.includes(n.type), canOut = (OUT_OK[n.type] || []).length > 0;
  const meta = nodeMeta(p, n);
  return `<article class="${cls}" data-node="${attr(n.id)}" style="${style}">
    <header class="cn-head"><i class="cn-ico">${icon(n.type)}</i><span class="cn-name" ${FREE_TYPES.includes(n.type) ? `data-rename="${attr(n.id)}" title="双击改名"` : ""}>${esc(nodeTitle(p, n))}</span><span class="cn-meta px">${esc([n.type === "shot" ? "" : TYPE_TAG[n.type], meta].filter(Boolean).join(" · "))}</span></header>
    <div class="cn-frame"><i class="cn-ring" aria-hidden="true"></i><div class="cn-card"><div class="cn-in">${nodeBody(p, n)}</div></div>
      ${canIn ? `<button class="cn-plus in" data-plus="in" data-id="${attr(n.id)}" tabindex="-1" aria-label="添加上游节点">${icon("plus")}</button>` : ""}
      ${canOut ? `<button class="cn-plus out" data-plus="out" data-id="${attr(n.id)}" tabindex="-1" aria-label="拖出连线，或点击添加下游节点">${icon("plus")}</button>` : ""}
    </div>
  </article>`;
}

function ghostCard(p) {
  const cur = outline(p).find(s => s.current);
  const type = { style: "style", script: "script", package: "publish" }[cur?.key];
  if (!type || nodeByType(p, type)) return "";
  const pos = defaultPos(p, type);
  const hint = { style: "给谁看、什么语气、多长、怎么开场。让 AI 编导起草，或者自己填。", script: "按风格画像写出逐句口播和画面说明。", publish: "标题、封面字、发布文案、封面和审稿。" }[type];
  return `<button class="ghost-card cn-ghost" data-act="open-step" data-step="${cur.key}" style="left:${pos.x}px;top:${pos.y + 26}px;width:${NODE_W[type]}px"><span class="px">${cur.no} ${cur.name}</span><span style="font-size:13px;line-height:1.6">${hint}</span></button>`;
}

const toolBtn = (act, ic, label, extra = "", on = false) => `<button class="${on ? "on" : ""}" data-act="${act}" ${extra} title="${attr(label)}" aria-label="${attr(label)}">${icon(ic)}</button>`;
function renderStage(p) {
  const v = p.canvas.viewport;
  const empty = !p.canvas.nodes.some(n => FREE_TYPES.includes(n.type));
  return `<section class="stage cv tool-${ui.tool}" data-stage aria-label="画布">
    <div class="world" data-world style="transform:translate(${v.x}px,${v.y}px) scale(${v.zoom})">
      <svg class="edges" data-edges width="1" height="1" aria-hidden="true"></svg>
      ${p.canvas.nodes.map(n => renderNode(p, n)).join("")}
      ${ghostCard(p)}
      <div class="edge-x-layer" data-edgex></div>
    </div>
    <div class="cv-layer" data-layer></div>
    <nav class="cv-tools" role="toolbar" aria-label="画布工具">
      ${toolBtn("cv-tool", "select", "选择 · V（拖空白处框选）", 'data-tool="select"', ui.tool === "select")}
      ${toolBtn("cv-tool", "hand", "抓手 · H（或按住空格拖动）", 'data-tool="hand"', ui.tool === "hand")}
      <span class="sep"></span>
      ${FREE_TYPES.map(t => toolBtn("add-node", t, `添加${FREE_LABEL[t]}节点`, `data-type="${t}"`)).join("")}
      <label class="cv-up" title="上传图片 / 视频 / 音频" aria-label="上传素材">${icon("upload")}<input type="file" hidden multiple data-in="cv-upload" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a"></label>
      <span class="sep"></span>
      ${toolBtn("toggle-focus", "focus", ui.panels.left || ui.panels.right ? "专注 · F（收起两侧面板）" : "展开面板 · F")}
    </nav>
    <div class="cv-nav">
      <canvas class="cv-map" data-minimap width="176" height="112" aria-label="小地图，点击跳转"></canvas>
      <div class="cv-zoom"><button data-act="cv-zoom" data-d="-1" aria-label="缩小">${icon("minus")}</button><button class="px" data-act="cv-zoom" data-d="0" data-zoom title="重置为 100%">${Math.round(v.zoom * 100)}%</button><button data-act="cv-zoom" data-d="1" aria-label="放大">${icon("plus")}</button><span class="sep"></span><button data-act="fit" title="适应画布 · ⌘0" aria-label="适应画布">${icon("fit")}</button></div>
    </div>
    ${empty ? `<div class="cv-hint px" data-hint><span>双击空白处添加节点</span><span>拖动节点右侧 ${icon("plus")} 连线</span><span>⌘ 滚轮缩放</span></div>` : ""}
  </section>`;
}

// ---------- 连线 ----------
function estimateH(n, w) {
  if (["image", "video"].includes(n.type)) { const [a, b] = ratioOf(n).split(":").map(Number); return 28 + Math.round(w * (b || 1) / (a || 1)) + (n.data.images?.length > 1 ? 46 : 0); }
  if (n.type === "shot") return 28 + Math.round(w * 16 / 9);
  return { text: 170, audio: 120, topic: 150, style: 150, script: 260, publish: 170, cut: 120 }[n.type] || 140;
}
function boxOf(n) {
  const el = $(`[data-node="${CSS.escape(n.id)}"]`);
  const fr = el?.querySelector(".cn-frame");
  const w = el?.offsetWidth || (FREE_TYPES.includes(n.type) ? nodeWidth(n) : n.w || NODE_W[n.type] || 240), h = el?.offsetHeight || estimateH(n, w);
  const top = fr ? fr.offsetTop : 26, fh = fr ? fr.offsetHeight : h - 26;
  return { x: n.x, y: n.y, w, h, cy: n.y + top + Math.min(fh / 2, 90) };
}
function edgePath(A, B) {
  const sx = A.x + A.w + 12, sy = A.cy, tx = B.x - 12, ty = B.cy;
  if (tx - sx >= 32) { const mx = Math.round((sx + tx) / 2); return `M${sx - 12} ${sy}H${mx}V${ty}H${tx + 12}`; }
  const midY = Math.round(B.y > A.y + A.h ? (A.y + A.h + B.y) / 2 : A.y > B.y + B.h ? (B.y + B.h + A.y) / 2 : Math.max(A.y + A.h, B.y + B.h) + 40);
  return `M${sx - 12} ${sy}H${sx + 12}V${midY}H${tx - 12}V${ty}H${tx + 12}`;
}
function edgeMid(A, B) {
  const sx = A.x + A.w, tx = B.x;
  if (tx - sx >= 56) return { x: Math.round((sx + tx) / 2), y: Math.round((A.cy + B.cy) / 2) };
  return { x: Math.round((sx + tx) / 2), y: Math.round(B.y > A.y + A.h ? (A.y + A.h + B.y) / 2 : Math.max(A.y + A.h, B.y + B.h) + 40) };
}
function drawEdges() {
  const p = project(); const svg = $("[data-edges]"); if (!p || !svg) return;
  let mx = 0, my = 0;
  const all = [...autoEdges(p), ...p.canvas.edges];
  let xBtn = "";
  const paths = all.map(e => {
    const a = nodeOf(p, e.from), b = nodeOf(p, e.to); if (!a || !b) return "";
    const A = boxOf(a), B = boxOf(b);
    mx = Math.max(mx, A.x + A.w, B.x + B.w); my = Math.max(my, A.y + A.h, B.y + B.h);
    const hot = isSel(e.from) || isSel(e.to);
    const live = isRunning(p, b);
    const draw = freshNodes.has(a.id) || freshNodes.has(b.id) || freshEdges.has(e.id);
    const on = ui.edgeSel === e.id;
    const d = edgePath(A, B);
    if (on) { const m = edgeMid(A, B); xBtn = `<button class="edge-x" data-act="edge-del" data-id="${attr(e.id)}" style="left:${m.x}px;top:${m.y}px" aria-label="删除连线">${icon("x")}</button>`; }
    const tip = `<rect class="tip" x="${B.x - 15}" y="${B.cy - 3}" width="6" height="6"/>`;
    return `<g class="${e.auto ? "auto" : "man"} ${hot ? "hot" : ""} ${live ? "live" : ""} ${draw ? "draw" : ""} ${on ? "on" : ""}">${e.auto ? "" : `<path class="hit" data-edge="${attr(e.id)}" d="${d}"/>`}<path class="ln" d="${d}"/>${tip}</g>`;
  }).join("");
  const dr = ui.draft ? `<g class="draft"><path class="ln" d="M${ui.draft.sx} ${ui.draft.sy}H${Math.round((ui.draft.sx + ui.draft.tx) / 2)}V${ui.draft.ty}H${ui.draft.tx}"/><rect class="tip" x="${ui.draft.tx - 3}" y="${ui.draft.ty - 3}" width="6" height="6"/></g>` : "";
  svg.setAttribute("width", mx + 600); svg.setAttribute("height", my + 600);
  svg.innerHTML = paths + dr;
  const xl = $("[data-edgex]"); if (xl) xl.innerHTML = xBtn;
  freshEdges.clear();
}

// ---------- 视口 ----------
let mapRaf = 0;
function applyViewport() {
  const p = project(); const world = $("[data-world]"); const stage = $("[data-stage]"); if (!p || !world) return;
  const v = p.canvas.viewport;
  world.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.zoom})`;
  world.style.setProperty("--iz", String(1 / v.zoom));
  const g = Math.max(8, Math.round(24 * v.zoom)); stage.style.backgroundSize = `${g}px ${g}px`; stage.style.backgroundPosition = `${Math.round(v.x)}px ${Math.round(v.y)}px`;
  stage.style.setProperty("--dot-a", String(clamp((v.zoom - .25) / .6, .25, 1)));
  const z = $("[data-zoom]"); if (z) z.textContent = `${Math.round(v.zoom * 100)}%`;
  drawEdges(); placeComposer();
  cancelAnimationFrame(mapRaf); mapRaf = requestAnimationFrame(drawMinimap);
}
function zoomAt(p, z, mx, my) { const v = p.canvas.viewport; const nz = clamp(z, .15, 2.5); const wx = (mx - v.x) / v.zoom, wy = (my - v.y) / v.zoom; v.x = mx - wx * nz; v.y = my - wy * nz; v.zoom = nz; applyViewport(); }
function boundsOf(p, nodes = p.canvas.nodes) {
  const boxes = nodes.map(boxOf);
  return { minX: Math.min(...boxes.map(b => b.x)), minY: Math.min(...boxes.map(b => b.y)), maxX: Math.max(...boxes.map(b => b.x + b.w)), maxY: Math.max(...boxes.map(b => b.y + b.h)) };
}
function fitCanvas(p, silent = false, animate = true, nodes = null) {
  const stage = $("[data-stage]"); const list = nodes || p?.canvas.nodes; if (!p || !stage || !list?.length) return;
  const { minX, minY, maxX, maxY } = boundsOf(p, list);
  const r = stage.getBoundingClientRect();
  const z = clamp(Math.min((r.width - 160) / Math.max(300, maxX - minX), (r.height - 200) / Math.max(300, maxY - minY)), .2, 1.1);
  const to = { zoom: z, x: Math.round((r.width - (maxX - minX) * z) / 2 - minX * z + 20), y: Math.round(Math.max(50, (r.height - 70 - (maxY - minY) * z) / 2) - minY * z) };
  if (animate) tweenViewport(p, to); else { Object.assign(p.canvas.viewport, to); applyViewport(); }
  if (!silent) save();
}
function centerOn(p, n) {
  const stage = $("[data-stage]"); if (!stage || !n) return;
  const r = stage.getBoundingClientRect(); const b = boxOf(n); const v = p.canvas.viewport;
  tweenViewport(p, { zoom: v.zoom, x: Math.round(r.width / 2 - (b.x + b.w / 2) * v.zoom), y: Math.round(r.height / 2.6 - (b.y + b.h / 2) * v.zoom) }, 420);
}

const MAP_COLOR = { text: "#7BA4FF", image: "#FF9F43", video: "#3DD68C", audio: "#FF7EB0" };
function drawMinimap() {
  const p = project(); const cv = $("[data-minimap]"); const stage = $("[data-stage]"); if (!p || !cv || !stage) return;
  const ctx = cv.getContext("2d"); const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  if (!p.canvas.nodes.length) return;
  const v = p.canvas.viewport; const r = stage.getBoundingClientRect();
  const view = { x: -v.x / v.zoom, y: -v.y / v.zoom, w: r.width / v.zoom, h: r.height / v.zoom };
  const b = boundsOf(p);
  const minX = Math.min(b.minX, view.x), minY = Math.min(b.minY, view.y), maxX = Math.max(b.maxX, view.x + view.w), maxY = Math.max(b.maxY, view.y + view.h);
  const s = Math.min((W - 12) / (maxX - minX || 1), (H - 12) / (maxY - minY || 1));
  const ox = (W - (maxX - minX) * s) / 2 - minX * s, oy = (H - (maxY - minY) * s) / 2 - minY * s;
  drawMinimap.map = { s, ox, oy };
  const light = document.documentElement.dataset.theme === "light";
  p.canvas.nodes.forEach(n => {
    const bx = boxOf(n);
    ctx.fillStyle = MAP_COLOR[n.type] || (light ? "#8A8A8A" : "#5A5A5A");
    ctx.globalAlpha = isSel(n.id) ? 1 : .7;
    ctx.fillRect(Math.round(ox + bx.x * s), Math.round(oy + bx.y * s), Math.max(2, Math.round(bx.w * s)), Math.max(2, Math.round(bx.h * s)));
  });
  ctx.globalAlpha = 1; ctx.strokeStyle = light ? "#111" : "#EDEDED"; ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(ox + view.x * s) + .5, Math.round(oy + view.y * s) + .5, Math.round(view.w * s), Math.round(view.h * s));
}

// ---------- 浮动生成面板（选中节点下方） ----------
const sel2 = (field, list, val, label) => `<select data-in="node" data-field="${field}" data-dd-class="cfdd" aria-label="${attr(label)}">${list.map(([v, l]) => `<option value="${attr(v)}" ${String(v) === String(val) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
// ---------- 模型参数：ToAPIs 每个模型能选的画幅 / 分辨率 / 时长不同，面板跟着模型变 ----------
const areaOf = (kind, n) => kind === "video" && n?.data?.shotId ? "video.shot" : `${kind}.canvas`;
const effOf = (kind, n) => modelCache.byArea?.[areaOf(kind, n)] || modelCache.effective?.[kind];
const modelLabel = (kind, id) => modelCache.routes?.specs?.[kind]?.[id]?.label || modelCache.routes?.specs?.text?.[id] || id;
function specFor(kind, n) {
  const eff = effOf(kind, n); const specs = modelCache.routes?.specs?.[kind];
  if (!specs || eff?.provider !== "toapis") return null;
  const id = n?.data?.model && n.data.model !== "auto" ? n.data.model : (eff.auto || eff.model);
  return specs[id] ? { id, ...specs[id] } : null;
}
const RATIO_NAME = { "9:16": "竖 9:16", "16:9": "横 16:9", "1:1": "方 1:1", "adaptive": "自适应", "21:9": "宽银幕 21:9" };
const ratioOpts = list => list.map(r => [r, RATIO_NAME[r] || r]);
// 换模型后，把画幅、时长、分辨率收进新模型允许的范围
function normalizeNodeForModel(n) {
  const kind = n.type; const spec = specFor(kind, n); if (!spec) return;
  const d = n.data;
  const near = (list, v) => { if (!list?.length || list.includes(v)) return v; const val = r => { const [a, b] = String(r).split(":").map(Number); return a / b; }; const w = val(v); return list.filter(r => r.includes(":")).sort((x, y) => Math.abs(Math.log(val(x) / w)) - Math.abs(Math.log(val(y) / w)))[0] || list[0]; };
  if (kind === "image") { d.ratio = near(spec.ratios, ratioOf(n)); if (!spec.res.values.includes(d.resolution)) d.resolution = spec.res.def; }
  if (kind === "video") {
    if (spec.ratios.length) d.ratio = near(spec.ratios, ratioOf(n));
    if (!spec.durations.includes(Number(d.duration))) d.duration = spec.durations.reduce((a, b) => Math.abs(b - Number(d.duration || spec.def)) < Math.abs(a - Number(d.duration || spec.def)) ? b : a, spec.durations[0]);
    if (spec.res.length && !spec.res.includes(d.resolution)) d.resolution = spec.defRes;
    if (d.frameMode && d.frameMode !== "auto" && !spec.frames.includes(d.frameMode)) d.frameMode = "auto";
    d.imageSize = RATIO_SIZE[d.ratio] || d.imageSize;
  }
  if (kind === "audio" && !spec.versions.includes(d.version)) d.version = spec.versions[0];
  n.w = nodeWidth(n);
}
function modelOptions(kind, val, n = null) {
  const opts = modelCache.options?.[kind] || [];
  const eff = effOf(kind, n);
  const group = opts.find(o => o.provider === eff?.provider) || opts[0];
  const list = group ? group.models : (modelCache[kind] || []);
  const autoId = eff?.auto || (eff?.model !== "auto" ? eff?.model : "");
  const def = autoId ? `默认 · ${modelLabel(kind, autoId)}` : "默认（自动选择）";
  const all = [...new Set([...list, ...(val && val !== "auto" ? [val] : [])])];
  return `<select data-in="node" data-field="model" data-dd-class="cfdd model" aria-label="模型"><option value="auto">${esc(def)}</option>${all.map(m => `<option value="${attr(m)}" ${m === val ? "selected" : ""}>${esc(modelLabel(kind, m))}${modelLabel(kind, m) !== m ? `　${esc(m)}` : ""}</option>`).join("")}</select>`;
}
function imageParams(n) {
  const d = n.data; const spec = specFor("image", n);
  const ratios = spec ? ratioOpts(spec.ratios) : IMAGE_RATIOS;
  return `${sel2("ratio", ratios, ratioOf(n), "画幅")}${spec ? sel2("resolution", spec.res.values.map(v => [v, v.toUpperCase()]), spec.res.values.includes(d.resolution) ? d.resolution : spec.res.def, "分辨率") : ""}${sel2("count", IMAGE_COUNTS.map(c => [c, `${c} 张`]), d.count || 1, "张数")}`;
}
function videoParams(p, n) {
  const d = n.data; const spec = specFor("video", n); const c = contextOf(p, n);
  if (!spec) return `${sel2("ratio", VIDEO_RATIOS, ratioOf(n), "画幅")}${sel2("duration", VIDEO_DURATIONS.map(s => [s, `${s} 秒`]), d.duration || 5, "时长")}`;
  const FR = { first: "首帧", firstlast: "首尾帧", refs: "多图参考" };
  const frames = c.refs.length && spec.frames.length > 1 ? sel2("frameMode", [["auto", "图片：自动"], ...spec.frames.map(f => [f, `图片：${FR[f]}`])], d.frameMode || "auto", "上游图片用作") : "";
  return `${spec.ratios.length ? sel2("ratio", ratioOpts(spec.ratios), spec.ratios.includes(ratioOf(n)) ? ratioOf(n) : spec.ratios[0], "画幅") : ""}${spec.durations.length > 1 ? sel2("duration", spec.durations.map(s => [s, `${s} 秒`]), spec.durations.includes(Number(d.duration)) ? Number(d.duration) : spec.def, "时长") : `<span class="cf-fixed px">${spec.durations[0]} 秒</span>`}${spec.res.length ? sel2("resolution", spec.res.map(v => [v, v]), spec.res.includes(d.resolution) ? d.resolution : spec.defRes, "分辨率") : ""}${frames}${spec.audio ? sel2("audio", [["1", "有声"], ["0", "无声"]], d.audio === false ? "0" : "1", "声音") : ""}`;
}
function specNote(kind, p, n) {
  const spec = specFor(kind, n); if (!spec) return "";
  const c = contextOf(p, n);
  let extra = "";
  if (kind === "image" && c.refs.length) extra = c.refs.length > spec.refs.max ? `　参考图只用前 ${spec.refs.max} 张` : `　${c.refs.length} 张参考图`;
  if (kind === "video" && c.refs.length) {
    const m = n.data.frameMode && n.data.frameMode !== "auto" ? n.data.frameMode : c.refs.length >= 3 && spec.frames.includes("refs") ? "refs" : c.refs.length === 2 && spec.frames.includes("firstlast") ? "firstlast" : spec.frames.includes("first") ? "first" : "refs";
    extra = `　上游图片 → ${{ first: "首帧", firstlast: "首帧 + 尾帧", refs: `参考图（最多 ${spec.maxRefs} 张）` }[m]}`;
  }
  return `<span class="px faint" title="${attr(spec.note)}">${esc(spec.label)} · ${esc(spec.note)}${esc(extra)}</span>`;
}
function ctxRow(p, n) {
  const c = contextOf(p, n);
  if (!c.from.length && !c.refs.length) return `<div class="cf-ctx empty px">没有上游输入 · 从其他节点拖线连进来，文字做提示词、图片做参考</div>`;
  return `<div class="cf-ctx"><span class="px faint">输入</span>${c.from.map(u => `<button class="cf-chip t-${u.type}" data-act="cn-focus" data-id="${attr(u.id)}">${icon(u.type)}<span>${esc(nodeTitle(p, u))}</span></button>`).join("")}${c.refs.slice(0, 4).map(u => `<img src="${attr(u)}" alt="参考图" class="cf-ref">`).join("")}</div>`;
}
function composerHTML(p) {
  const ids = selIds();
  if (ids.length > 1) {
    const gen = ids.map(id => nodeOf(p, id)).filter(n => n && ["image", "video", "audio"].includes(n.type));
    return `<div class="cf multi"><span class="px">已选 ${ids.length} 个节点</span><span class="grow"></span>${gen.length ? `<button class="cf-go" data-act="cn-run-many">${icon("go")}生成 ${gen.length} 个</button>` : ""}<button class="cf-btn" data-act="cn-dup" title="⌘D">${icon("dup")}复制</button><button class="cf-btn danger" data-act="cn-del-sel" title="Delete">${icon("trash")}删除</button></div>`;
  }
  const n = nodeOf(p, ui.sel); if (!n) return "";
  const d = n.data; const id = attr(n.id); const running = isRunning(p, n);
  const goBtn = (label, act = "cn-run") => `<button class="cf-go" data-act="${act}" data-id="${id}" ${running ? "disabled" : ""} title="⌘ Enter">${running ? `<span class="spin"></span>${esc(runLabel(n))}` : `${icon("go")}${label}`}</button>`;
  const tools = `<span class="cf-tools"><button class="cf-ic" data-act="dup-node" data-id="${id}" title="复制 · ⌘D" aria-label="复制节点">${icon("dup")}</button>${!LOCKED_TYPES.includes(n.type) ? `<button class="cf-ic" data-act="delete-node" data-id="${id}" title="删除 · Delete" aria-label="删除节点">${icon("trash")}</button>` : ""}</span>`;
  const upload = kind => `<label class="cf-btn" title="上传替换">${icon("upload")}<input type="file" hidden data-in="cn-upload" data-id="${id}" accept="${{ image: "image/png,image/jpeg,image/webp", video: "video/mp4,video/webm,video/quicktime", audio: "audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a" }[kind]}"></label>`;
  const prompt = (ph) => `<textarea class="cf-ta" data-in="node" data-field="prompt" data-cf rows="3" placeholder="${attr(ph)}">${esc(d.prompt || "")}</textarea>`;
  if (n.type === "image") return `<div class="cf t-image">${ctxRow(p, n)}${prompt("描述你想要的画面：主体、动作、场景、光线、镜头…")}
    <div class="cf-row"><button class="cf-ai" data-act="cn-enhance" data-id="${id}" ${running ? "disabled" : ""}>${icon("spark")}AI 写</button>${modelOptions("image", d.model, n)}<span class="grow"></span>${goBtn(d.images?.length ? "再生成" : "生成")}</div>
    <div class="cf-row params">${imageParams(n)}${upload("image")}</div>
    <div class="cf-foot">${specNote("image", p, n) || `<span class="px faint">${d.modelUsed ? esc(d.modelUsed) : "⌘ Enter 生成"}</span>`}${d.images?.length ? `<button class="cf-link" data-act="as-cover-bg" data-id="${id}">设为封面</button><button class="cf-link" data-act="cn-out-menu" data-id="${id}">继续 →</button>` : ""}${tools}</div></div>`;
  if (n.type === "video") {
    const c = contextOf(p, n);
    const frames = specNote("video", p, n) || (c.refs.length ? `<span class="px faint">${c.refs.length > 1 ? "首帧 + 尾帧" : "首帧"}来自上游图片</span>` : `<span class="px faint">连一张图片进来，就是图生视频</span>`);
    return `<div class="cf t-video">${ctxRow(p, n)}${prompt("描述镜头：运镜、动作、节奏、氛围…")}
    <div class="cf-row"><button class="cf-ai" data-act="cn-enhance" data-id="${id}" ${running ? "disabled" : ""}>${icon("spark")}AI 写</button>${modelOptions("video", d.model, n)}<span class="grow"></span>${goBtn(d.videoUrl ? "再生成" : "生成")}</div>
    <div class="cf-row params">${videoParams(p, n)}${upload("video")}</div>
    <div class="cf-foot">${frames}${d.status === "poll_error" ? `<button class="cf-link" data-act="resume-video" data-id="${id}">继续查询</button>` : ""}${d.videoUrl && d.shotId ? `<button class="cf-link" data-act="sync-cut">加入成片</button>` : ""}${tools}</div></div>`;
  }
  if (n.type === "audio") return `<div class="cf t-audio">${ctxRow(p, n)}${prompt("描述配乐：情绪、风格、乐器、速度…")}
    <div class="cf-row"><button class="cf-ai" data-act="cn-enhance" data-id="${id}" ${running ? "disabled" : ""}>${icon("spark")}AI 写</button>${modelOptions("audio", d.model, n)}<span class="grow"></span>${goBtn(nodeAudio(n) ? "再生成" : "生成")}</div>
    <div class="cf-row params">${sel2("instrumental", [["1", "纯音乐"], ["0", "带人声"]], d.instrumental === false || d.instrumental === "0" ? "0" : "1", "人声")}${(specFor("audio", n)?.versions || []).length ? sel2("version", specFor("audio", n).versions.map(v => [v, { v6: "Suno v6", "v6-wild": "v6 Wild · 更大胆", "v6-mini": "v6 Mini · 更快" }[v] || v]), d.version || "v6", "版本") : ""}${upload("audio")}</div>
    <div class="cf-foot"><span class="px faint">${d.modelUsed ? esc(d.modelUsed) : "Suno · 约 1–3 分钟"}</span>${d.status === "poll_error" ? `<button class="cf-link" data-act="resume-audio" data-id="${id}">继续查询</button>` : ""}${tools}</div></div>`;
  if (n.type === "text") return `<div class="cf t-text">${ctxRow(p, n)}<textarea class="cf-ta tall" data-in="node" data-field="text" data-cf rows="5" placeholder="写下想法、脚本或台词…">${esc(d.text || "")}</textarea>
    <div class="cf-row"><button class="cf-ai" data-act="cn-polish" data-id="${id}" ${running ? "disabled" : ""}>${icon("spark")}AI 润色</button><button class="cf-btn" data-act="cn-split" data-id="${id}" ${running ? "disabled" : ""}>${icon("split")}拆分镜头</button>${d.prevText ? `<button class="cf-btn" data-act="cn-undo-text" data-id="${id}">撤销润色</button>` : ""}<span class="grow"></span><button class="cf-go" data-act="cn-out-menu" data-id="${id}">${icon("go")}接下一个节点</button></div>
    <div class="cf-foot"><span class="px faint">${running ? "AI 正在处理…" : "拆分镜头：AI 把这段文字拆成 4–8 个画面节点"}</span>${tools}</div></div>`;
  if (n.type === "remake") return rmComposer(p, n);
  if (n.type === "ip") return ipComposer(p, n);
  if (n.type === "shot") {
    const r = shotOf(p, n); if (!r) return "";
    return `<div class="cf t-shot"><textarea class="cf-ta" data-in="shot" data-id="${attr(r.id)}" data-key="shot" data-cf rows="3" placeholder="景别、主体、动作、光线">${esc(r.shot || "")}</textarea>
      <div class="cf-row"><button class="cf-go" data-act="shot-image" data-id="${attr(r.id)}" ${running ? "disabled" : ""}>${running ? `<span class="spin"></span>生成中` : `${icon("go")}${r.imageUrl ? "重新生成画面" : "生成画面"}`}</button><button class="cf-btn" data-act="shot-video" data-id="${attr(r.id)}">${icon("video")}做成视频</button><label class="cf-btn">${icon("upload")}上传<input type="file" hidden accept="image/png,image/jpeg,image/webp" data-in="shot-upload" data-id="${attr(r.id)}"></label><span class="grow"></span><button class="cf-link" data-act="open-step" data-flow="1" data-step="visual">在流程中编辑 →</button></div></div>`;
  }
  const acts = {
    topic: `<button class="cf-btn" data-act="tab" data-tab="props">${icon("edit")}编辑选题</button><button class="cf-btn" data-act="ai-style">${icon("spark")}AI 起草风格画像</button>`,
    style: `<button class="cf-btn" data-act="ai-style">${icon("spark")}AI 起草画像</button><button class="cf-btn" data-act="tab" data-tab="props">${icon("edit")}编辑画像</button>`,
    script: `<button class="cf-go" data-act="ai-run" data-kind="script">${icon("go")}${p.script.length ? "重写脚本" : "生成脚本"}</button><button class="cf-btn" data-act="ai-run" data-kind="full">脚本 + 包装 + 审稿</button><button class="cf-btn" data-act="batch-images">${icon("image")}补齐分镜画面</button>`,
    publish: `<button class="cf-btn" data-act="ai-run" data-kind="packaging">${icon("spark")}生成包装</button><button class="cf-btn" data-act="ai-run" data-kind="review">运行审稿</button><button class="cf-btn" data-act="open-cover">设计封面</button>`,
    cut: `<button class="cf-go" data-act="sync-cut">${icon("go")}按分镜同步</button><button class="cf-btn" data-act="play-cut" ${(d.clips || []).length ? "" : "disabled"}>${icon("play")}播放</button><button class="cf-btn" data-act="export" data-kind="edl">粗剪单</button>`
  }[n.type];
  if (!acts) return "";
  return `<div class="cf compact t-${n.type}"><div class="cf-row">${acts}<span class="grow"></span>${NODE_STEP[n.type] ? `<button class="cf-link" data-act="open-step" data-flow="1" data-step="${NODE_STEP[n.type]}">在流程中编辑 →</button>` : ""}</div></div>`;
}
function renderComposer() {
  const p = project(); const layer = $("[data-layer]"); if (!p || !layer) return;
  const old = $(".cf", layer);
  const keep = document.activeElement?.closest?.(".cf") ? { field: document.activeElement.dataset.field || document.activeElement.dataset.key, s: document.activeElement.selectionStart, e: document.activeElement.selectionEnd } : null;
  const html = composerHTML(p);
  const key = `${selIds().join(",")}|${ui.sel}`;
  if (!html) { if (old) old.remove(); layer.dataset.k = ""; return; }
  const sameNode = layer.dataset.k === key;
  layer.querySelectorAll(".cf").forEach(x => x.remove());
  layer.insertAdjacentHTML("beforeend", html);
  const cf = $(".cf", layer); if (sameNode) cf.classList.add("stay");
  layer.dataset.k = key;
  ddEnhance(cf);
  if (keep) { const t = $(`[data-field="${keep.field}"], [data-key="${keep.field}"]`, cf); if (t) { t.focus({ preventScroll: true }); try { t.setSelectionRange(keep.s, keep.e); } catch (_) {} } }
  placeComposer();
  if (!sameNode) ensureComposerVisible();
}
// 新选中节点时，如果生成面板会被挡住，轻推画布让节点和面板都露出来
function ensureComposerVisible() {
  const p = project(); const cf = $(".cv-layer .cf"); const stage = $("[data-stage]"); if (!p || !cf || !stage || ui.draft) return;
  const nodes = selIds().map(id => nodeOf(p, id)).filter(Boolean); if (!nodes.length || nodes.length > 1) return;
  const v = p.canvas.viewport; const r = stage.getBoundingClientRect(); const b = boundsOf(p, nodes);
  const sy = b.minY * v.zoom + v.y, ey = b.maxY * v.zoom + v.y, sx = b.minX * v.zoom + v.x, ex = b.maxX * v.zoom + v.x;
  let dy = 0, dx = 0;
  const need = ey + 14 + cf.offsetHeight - (r.height - 16);
  if (need > 0) dy = -Math.min(need, Math.max(0, sy - 56));
  if (ex > r.width - 24) dx = -Math.min(ex - (r.width - 24), Math.max(0, sx - 70));
  else if (sx < 64) dx = 64 - sx;
  if (Math.abs(dx) + Math.abs(dy) > 4) tweenViewport(p, { zoom: v.zoom, x: v.x + dx, y: v.y + dy }, 320);
}
function placeComposer() {
  const p = project(); const cf = $(".cv-layer .cf"); const stage = $("[data-stage]"); if (!p || !cf || !stage) return;
  const ids = selIds(); const nodes = ids.map(id => nodeOf(p, id)).filter(Boolean); if (!nodes.length) return;
  const v = p.canvas.viewport; const r = stage.getBoundingClientRect();
  const b = boundsOf(p, nodes);
  const sx = b.minX * v.zoom + v.x, ex = b.maxX * v.zoom + v.x, sy = b.minY * v.zoom + v.y, ey = b.maxY * v.zoom + v.y;
  const w = cf.offsetWidth, h = cf.offsetHeight;
  let left = Math.round((sx + ex) / 2 - w / 2); let top = Math.round(ey + 14);
  const below = top + h < r.height - 12 || sy - h - 40 < 12;
  if (!below) top = Math.round(sy - h - 40);
  cf.style.left = `${clamp(left, 64, Math.max(64, r.width - w - 12))}px`;
  cf.style.top = `${clamp(top, 12, Math.max(12, r.height - h - 12))}px`;
  cf.classList.toggle("above", !below);
  const vis = ex > 0 && sx < r.width && ey > -40 && sy < r.height;
  cf.classList.toggle("off", !vis);
}

// ---------- 选择与局部刷新（不重绘整页，交互更顺） ----------
function syncSelection() {
  const p = project(); if (!p) return;
  $$("[data-node]").forEach(el => { const id = el.dataset.node; el.classList.toggle("sel", isSel(id)); el.classList.toggle("primary", ui.sel === id); });
  drawEdges(); renderComposer(); drawMinimap();
  const n = nodeOf(p, ui.sel);
  if (p.view.mode === "canvas" && ui.tab === "props") { const body = $(".panel-body"); if (body) { body.innerHTML = renderProps(p, n); ddEnhance(body); } }
  const railOn = n ? NODE_STEP[n.type] || "" : "";
  $$(".outline li").forEach(li => { const k = li.querySelector("[data-step]")?.dataset.step; li.classList.toggle("on", k === railOn); });
  indicators?.($("#view"));
}
function canvasRefresh(p, id) {
  if (route.view !== "project" || route.projectId !== p.id || p.view.mode !== "canvas") return false;
  const n = nodeOf(p, id); const el = n && $(`[data-node="${CSS.escape(n.id)}"]`);
  if (!el) { renderProject(); return true; }
  const tmp = document.createElement("div"); tmp.innerHTML = renderNode(p, n); const fresh = tmp.firstElementChild;
  el.replaceWith(fresh);
  drawEdges(); if (isSel(id) || selIds().some(s => p.canvas.edges.some(e => e.from === id && e.to === s))) renderComposer();
  cancelAnimationFrame(mapRaf); mapRaf = requestAnimationFrame(drawMinimap);
  tickProgress();
  return true;
}
function selectNode(id, { center = false, tab = "props" } = {}) {
  setSel(id ? [id] : [], id || "");
  if (tab) ui.tab = tab;
  renderProject();
  if (center) centerOn(project(), nodeOf(project(), id));
}
function pickSel(id, additive = false) {
  if (additive) { if (isSel(id)) { ui.multi.delete(id); if (ui.sel === id) ui.sel = [...ui.multi].pop() || ""; } else { if (ui.sel) ui.multi.add(ui.sel); ui.multi.add(id); ui.sel = id; } ui.edgeSel = ""; }
  else setSel(id ? [id] : [], id);
  syncSelection();
}

// ---------- 等待计时（3.7 起不再按经验估进度，统一由任务中心每秒刷新「已等多久」） ----------
function tickProgress() { jqTick(); }

// ---------- 像素粒子 ----------
const BITS = ["#FFC83D", "#7BA4FF", "#FF9F43", "#3DD68C", "#FF7EB0"];
function burst(x, y, count = 10, color = "") {
  if (reduceMotion() || !Element.prototype.animate) return;
  for (let i = 0; i < count; i++) {
    const d = document.createElement("div"); d.className = "pxbit";
    const sz = 4 + Math.floor(Math.random() * 3) * 2; d.style.width = d.style.height = `${sz}px`;
    d.style.background = color || BITS[i % BITS.length];
    document.body.appendChild(d);
    const ang = (i / count) * Math.PI * 2 + Math.random() * .5, dist = 26 + Math.random() * 34;
    const dx = Math.round(Math.cos(ang) * dist / 4) * 4, dy = Math.round(Math.sin(ang) * dist / 4) * 4;
    d.animate([{ transform: `translate(${x - sz / 2}px,${y - sz / 2}px)`, opacity: 1 }, { transform: `translate(${x + dx - sz / 2}px,${y + dy - sz / 2 + 10}px)`, opacity: 0 }], { duration: 420 + Math.random() * 160, easing: "steps(6)" }).onfinish = () => d.remove();
  }
}
function burstNode(id, count = 14) {
  const el = $(`[data-node="${CSS.escape(id)}"] .cn-frame`); if (!el) return;
  const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + Math.min(r.height / 2, 120), count);
}

// ---------- 交互 ----------
function bindStage() {
  const p = project(); const stage = $("[data-stage]"); if (!p || !stage) return;
  applyViewport(); tickProgress();
  if (stage._bound) return; stage._bound = true;
  // 画布本身不滚动（focus 或自动滚动会把它推偏），一律复位
  stage.addEventListener("scroll", () => { if (stage.scrollTop || stage.scrollLeft) { stage.scrollTop = 0; stage.scrollLeft = 0; } });
  requestAnimationFrame(() => { applyViewport(); renderComposer(); });
  const toWorld = (cx, cy) => { const r = stage.getBoundingClientRect(); const v = p.canvas.viewport; return { x: (cx - r.left - v.x) / v.zoom, y: (cy - r.top - v.y) / v.zoom }; };
  const panMode = ev => ui.tool === "hand" || ui.space || ev.button === 1;

  stage.addEventListener("pointerdown", ev => {
    if (ev.button !== 0 && ev.button !== 1) return;
    if (ev.target.closest(".cv-tools,.cv-nav,.cf,.node-menu,.edge-x,.cv-hint")) return;
    closeMenu();
    const plus = ev.target.closest("[data-plus]");
    if (plus) { ev.preventDefault(); ev.stopPropagation(); return portDrag(ev, plus); }
    const hit = ev.target.closest("[data-edge]");
    if (hit && !panMode(ev)) { ev.stopPropagation(); ui.edgeSel = hit.dataset.edge; ui.sel = ""; ui.multi.clear(); syncSelection(); return; }
    const nodeEl = ev.target.closest("[data-node]");
    if (nodeEl && !panMode(ev)) {
      if (ev.target.closest("input,button,label,select,textarea,video[controls],[contenteditable=true]")) return;
      return nodeDrag(ev, nodeEl);
    }
    if (ev.target.closest(".ghost-card")) return;
    if (panMode(ev)) return pan(ev);
    marquee(ev);
  });

  function pan(ev) {
    ev.preventDefault();
    const st = { x: ev.clientX, y: ev.clientY, vx: p.canvas.viewport.x, vy: p.canvas.viewport.y }; let moved = false;
    stopViewportTween(); stage.classList.add("panning");
    const move = e => { moved = true; p.canvas.viewport.x = st.vx + e.clientX - st.x; p.canvas.viewport.y = st.vy + e.clientY - st.y; applyViewport(); };
    const up = () => { stage.classList.remove("panning"); document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); if (moved) save(); else if (selIds().length || ui.edgeSel) { setSel([]); syncSelection(); } };
    document.addEventListener("pointermove", move); document.addEventListener("pointerup", up);
  }

  function marquee(ev) {
    const r = stage.getBoundingClientRect();
    const st = { x: ev.clientX - r.left, y: ev.clientY - r.top }; let box = null;
    const base = ev.shiftKey ? new Set(selIds()) : new Set();
    const move = e => {
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (!box) { if (Math.abs(x - st.x) + Math.abs(y - st.y) < 5) return; box = document.createElement("div"); box.className = "cv-marquee"; stage.appendChild(box); }
      const L = Math.min(x, st.x), T = Math.min(y, st.y), W = Math.abs(x - st.x), H = Math.abs(y - st.y);
      Object.assign(box.style, { left: `${L}px`, top: `${T}px`, width: `${W}px`, height: `${H}px` });
      const v = p.canvas.viewport; const wl = (L - v.x) / v.zoom, wt = (T - v.y) / v.zoom, wr = wl + W / v.zoom, wb = wt + H / v.zoom;
      const hitIds = p.canvas.nodes.filter(n => { const b = boxOf(n); return b.x < wr && b.x + b.w > wl && b.y < wb && b.y + b.h > wt; }).map(n => n.id);
      const ids = [...new Set([...base, ...hitIds])];
      ui.multi = new Set(ids); ui.sel = hitIds[hitIds.length - 1] || [...base].pop() || ""; ui.edgeSel = "";
      $$("[data-node]", stage).forEach(el => el.classList.toggle("sel", ui.multi.has(el.dataset.node)));
    };
    const up = () => {
      document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up);
      if (box) { box.remove(); syncSelection(); return; }
      if (selIds().length || ui.edgeSel) { setSel([]); syncSelection(); }
    };
    document.addEventListener("pointermove", move); document.addEventListener("pointerup", up);
  }

  function nodeDrag(ev, el) {
    ev.stopPropagation();
    const n = nodeOf(p, el.dataset.node); if (!n) return;
    if (ev.shiftKey || ev.metaKey) { pickSel(n.id, true); return; }
    const wasSel = isSel(n.id);
    if (!wasSel) { setSel([n.id], n.id); syncSelection(); }
    const group = selIds().map(id => nodeOf(p, id)).filter(Boolean);
    const starts = group.map(g => ({ g, x: g.x, y: g.y, el: $(`[data-node="${CSS.escape(g.id)}"]`, stage) }));
    const st = { x: ev.clientX, y: ev.clientY }; let moved = false;
    const move = e => {
      if (!moved && Math.abs(e.clientX - st.x) + Math.abs(e.clientY - st.y) < 4) return;
      if (!moved) { starts.forEach(s => s.el?.classList.add("dragging")); stopViewportTween(); $(".cv-layer .cf")?.classList.add("hide"); }
      moved = true;
      const dx = (e.clientX - st.x) / p.canvas.viewport.zoom, dy = (e.clientY - st.y) / p.canvas.viewport.zoom;
      starts.forEach(s => { s.g.x = Math.round((s.x + dx) / 4) * 4; s.g.y = Math.round((s.y + dy) / 4) * 4; if (s.el) { s.el.style.left = `${s.g.x}px`; s.el.style.top = `${s.g.y}px`; } });
      drawEdges();
    };
    const up = () => {
      document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up);
      starts.forEach(s => s.el?.classList.remove("dragging"));
      $(".cv-layer .cf")?.classList.remove("hide");
      if (moved) { save(); placeComposer(); drawMinimap(); }
      else if (wasSel && ui.sel !== n.id) { ui.sel = n.id; syncSelection(); }
      else if (wasSel && selIds().length > 1) { setSel([n.id], n.id); syncSelection(); }
    };
    document.addEventListener("pointermove", move); document.addEventListener("pointerup", up);
  }

  // 从两侧 + 号拖出连线；松手在节点上就连接，落在空白处弹出推荐节点；直接点击则在旁边新建
  function portDrag(ev, plus) {
    const n = nodeOf(p, plus.dataset.id); if (!n) return;
    const dir = plus.dataset.plus;
    let src = n, reverse = false;
    if (dir === "in") {
      const inc = [...p.canvas.edges].reverse().find(e => e.to === n.id);
      if (inc) { src = nodeOf(p, inc.from); p.canvas.edges = p.canvas.edges.filter(e => e.id !== inc.id); touch(p); }
      else reverse = true;
    }
    const A = boxOf(src);
    const origin = reverse ? { x: A.x - 12, y: A.cy } : { x: A.x + A.w + 12, y: A.cy };
    const st = { x: ev.clientX, y: ev.clientY }; let moved = false;
    stage.classList.add("linking"); stage.dataset.from = src.type;
    const move = e => {
      if (!moved && Math.abs(e.clientX - st.x) + Math.abs(e.clientY - st.y) < 5) return;
      moved = true;
      const w = toWorld(e.clientX, e.clientY);
      ui.draft = reverse ? { sx: w.x, sy: w.y, tx: origin.x, ty: origin.y } : { sx: origin.x, sy: origin.y, tx: w.x, ty: w.y };
      const t = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-node]");
      $$("[data-node].drop-ok, [data-node].drop-no", stage).forEach(x => x.classList.remove("drop-ok", "drop-no"));
      if (t && t.dataset.node !== src.id) { const b = nodeOf(p, t.dataset.node); const ok = reverse ? (OUT_OK[b.type] || []).includes(src.type) : (OUT_OK[src.type] || []).includes(b.type); t.classList.add(ok ? "drop-ok" : "drop-no"); }
      drawEdges();
    };
    const up = e => {
      document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up);
      stage.classList.remove("linking"); $$("[data-node].drop-ok, [data-node].drop-no", stage).forEach(x => x.classList.remove("drop-ok", "drop-no"));
      ui.draft = null;
      if (!moved) {
        if (src !== n) { drawEdges(); renderComposer(); return; }
        return openAddMenu(p, n, dir === "in" ? "up" : "down", null);
      }
      const t = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-node]");
      const b = t && nodeOf(p, t.dataset.node);
      if (b && b.id !== src.id) { reverse ? connect(p, b, src) : connect(p, src, b); return; }
      const w = toWorld(e.clientX, e.clientY);
      openAddMenu(p, src, reverse ? "up" : "down", { wx: w.x, wy: w.y, cx: e.clientX, cy: e.clientY });
      drawEdges();
    };
    document.addEventListener("pointermove", move); document.addEventListener("pointerup", up);
  }

  stage.addEventListener("dblclick", ev => {
    const rn = ev.target.closest("[data-rename]");
    if (rn) return renameNode(p, rn);
    const nodeEl = ev.target.closest("[data-node]");
    if (nodeEl) { const n = nodeOf(p, nodeEl.dataset.node); if (!n) return; if (!isSel(n.id) || selIds().length > 1) pickSel(n.id); setTimeout(() => { const t = $(".cv-layer .cf [data-cf]"); if (t) { t.focus(); t.setSelectionRange?.(t.value.length, t.value.length); } else if (STRUCT_TYPES.includes(n.type) && n.type !== "shot") { ui.tab = "props"; renderProject(); } }, 30); return; }
    if (ev.target.closest(".cv-tools,.cv-nav,.cf,.node-menu,.ghost-card")) return;
    const w = toWorld(ev.clientX, ev.clientY);
    openAddMenu(p, null, "free", { wx: w.x, wy: w.y, cx: ev.clientX, cy: ev.clientY });
  });
  stage.addEventListener("contextmenu", ev => {
    ev.preventDefault();
    const nodeEl = ev.target.closest("[data-node]");
    const n = nodeEl && nodeOf(p, nodeEl.dataset.node);
    const w = toWorld(ev.clientX, ev.clientY);
    if (n && !isSel(n.id)) pickSel(n.id);
    const items = n ? [
      NODE_STEP[n.type] ? `<button role="menuitem" data-act="open-step" data-flow="1" data-step="${NODE_STEP[n.type]}">${icon("edit")}在流程中编辑</button>` : "",
      FREE_TYPES.includes(n.type) ? `<button role="menuitem" data-act="cn-rename" data-id="${attr(n.id)}">${icon("text")}重命名</button><button role="menuitem" data-act="cn-dup">${icon("dup")}复制<kbd>⌘D</kbd></button>` : "",
      ["image", "shot"].includes(n.type) && nodeImage(p, n) ? `<button role="menuitem" data-act="as-cover-bg" data-id="${attr(n.id)}">${icon("publish")}设为封面背景</button>` : "",
      nodeImage(p, n) || nodeVideo(n) || nodeAudio(n) ? `<a role="menuitem" href="${attr(nodeImage(p, n) || nodeVideo(n) || nodeAudio(n))}" download>${icon("upload")}下载</a>` : "",
      !LOCKED_TYPES.includes(n.type) ? `<hr><button role="menuitem" class="danger" data-act="cn-del-sel">${icon("trash")}删除<kbd>⌫</kbd></button>` : ""
    ].join("") : `${FREE_TYPES.map(t => `<button role="menuitem" data-act="menu-add" data-type="${t}">${icon(t)}添加${FREE_LABEL[t]}</button>`).join("")}<hr><button role="menuitem" data-act="cn-select-all">${icon("select")}全选<kbd>⌘A</kbd></button><button role="menuitem" data-act="fit">${icon("fit")}适应画布<kbd>⌘0</kbd></button>`;
    showMenu(stage, ev.clientX, ev.clientY, items, { wx: w.x, wy: w.y });
  });
  stage.addEventListener("wheel", ev => {
    if (ev.target.closest(".cf textarea,.cf .cf-ctx,.node-menu,.cn-text")) { if (!ev.ctrlKey && !ev.metaKey) return; }
    ev.preventDefault(); stopViewportTween();
    const r = stage.getBoundingClientRect();
    if (ev.ctrlKey || ev.metaKey) zoomAt(p, p.canvas.viewport.zoom * Math.exp(-ev.deltaY * (ev.ctrlKey && !ev.metaKey ? .012 : .006)), ev.clientX - r.left, ev.clientY - r.top);
    else { p.canvas.viewport.x -= ev.deltaX; p.canvas.viewport.y -= ev.deltaY; applyViewport(); }
    clearTimeout(bindStage.t); bindStage.t = setTimeout(save, 400);
  }, { passive: false });
  // 视频节点悬停播放
  stage.addEventListener("pointerover", ev => { const v = ev.target.closest(".cnode.t-video video.cn-media, .cnode.t-remake video.cn-media"); if (v && v.paused) v.play().catch(() => {}); });
  stage.addEventListener("pointerout", ev => { const v = ev.target.closest(".cnode.t-video video.cn-media, .cnode.t-remake video.cn-media"); if (v && !v.contains(ev.relatedTarget)) { v.pause(); } });
  // 拖文件进画布
  stage.addEventListener("dragover", ev => { if ([...(ev.dataTransfer?.types || [])].includes("Files")) { ev.preventDefault(); stage.classList.add("drop"); } });
  stage.addEventListener("dragleave", ev => { if (ev.target === stage) stage.classList.remove("drop"); });
  stage.addEventListener("drop", ev => { ev.preventDefault(); stage.classList.remove("drop"); const files = [...(ev.dataTransfer?.files || [])]; if (files.length) uploadToCanvas(files, toWorld(ev.clientX, ev.clientY)); });
  // 小地图
  const map = $("[data-minimap]", stage);
  map?.addEventListener("pointerdown", ev => {
    ev.stopPropagation(); ev.preventDefault();
    const go = e => { const m = drawMinimap.map; if (!m) return; const r = map.getBoundingClientRect(); const sr = stage.getBoundingClientRect(); const v = p.canvas.viewport; const wx = (e.clientX - r.left - m.ox) / m.s, wy = (e.clientY - r.top - m.oy) / m.s; v.x = sr.width / 2 - wx * v.zoom; v.y = sr.height / 2 - wy * v.zoom; applyViewport(); };
    go(ev); stopViewportTween();
    const up = () => { document.removeEventListener("pointermove", go); document.removeEventListener("pointerup", up); save(); };
    document.addEventListener("pointermove", go); document.addEventListener("pointerup", up);
  });
  p.canvas.nodes.filter(n => n.type === "video" && n.data.requestId && RUN.includes(n.data.status)).forEach(n => pollVideo(p.id, n.id));
  p.canvas.nodes.filter(n => n.type === "audio" && n.data.requestId && RUN.includes(n.data.status)).forEach(n => pollAudio(p.id, n.id));
}

function renameNode(p, el) {
  const n = nodeOf(p, el.dataset.rename); if (!n) return;
  el.contentEditable = "true"; el.classList.add("editing"); el.focus();
  const range = document.createRange(); range.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(range);
  const done = keep => { el.contentEditable = "false"; el.classList.remove("editing"); const v = el.textContent.trim().slice(0, 40); if (keep && v) { n.title = v; touch(p); } el.textContent = nodeTitle(p, n); renderComposer(); };
  el.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); el.onblur = null; done(true); } if (e.key === "Escape") { e.preventDefault(); el.onblur = null; done(false); } e.stopPropagation(); };
  el.onblur = () => done(true);
}

// ---------- 菜单 ----------
function closeMenu() { if (ui.menu) { ui.menu = null; $$(".node-menu").forEach(m => m.remove()); } }
function showMenu(stage, cx, cy, html, extra = {}) {
  closeMenu();
  const r = stage.getBoundingClientRect();
  ui.menu = { sx: cx - r.left, sy: cy - r.top, at: Date.now(), ...extra };
  stage.insertAdjacentHTML("beforeend", `<div class="node-menu cv-menu" role="menu">${html}</div>`);
  const m = $(".node-menu", stage);
  m.style.left = `${Math.min(cx - r.left, r.width - m.offsetWidth - 10)}px`;
  m.style.top = `${Math.min(cy - r.top, r.height - m.offsetHeight - 10)}px`;
  m.querySelector("button")?.focus({ preventScroll: true });
}
// mode: down（从节点向下游）/ up（为节点添加上游）/ free（空白处）
function openAddMenu(p, from, mode, at) {
  const stage = $("[data-stage]"); if (!stage) return;
  let types = FREE_TYPES, title = "添加节点";
  if (from && mode === "down") { types = (MENU_ORDER[from.type] || OUT_OK[from.type] || []).filter(t => FREE_TYPES.includes(t)); title = `从「${nodeTitle(p, from)}」接着做`; }
  if (from && mode === "up") { types = FREE_TYPES.filter(t => (OUT_OK[t] || []).includes(from.type)); title = `给「${nodeTitle(p, from)}」添加输入`; }
  if (!types.length) return toast("这个节点不能再往后接创作节点", 2600, "err");
  let cx = at?.cx, cy = at?.cy, wx = at?.wx, wy = at?.wy;
  if (!at && from) {
    const b = boxOf(from); const v = p.canvas.viewport; const r = stage.getBoundingClientRect();
    const side = mode === "up" ? b.x - 40 : b.x + b.w + 40;
    cx = r.left + side * v.zoom + v.x + (mode === "up" ? -200 : 0); cy = r.top + b.cy * v.zoom + v.y - 20;
    wx = mode === "up" ? b.x - 100 - 300 : b.x + b.w + 100; wy = b.y;
  }
  const items = types.map((t, i) => `<button role="menuitem" class="add-item t-${t}" data-act="menu-add" data-type="${t}"><i class="ai-ico">${icon(t)}</i><span class="ai-txt"><b>${FREE_LABEL[t]}</b><em>${TYPE_HINT[t]}</em></span>${i === 0 && from ? '<span class="rec px">推荐</span>' : `<kbd>${i + 1}</kbd>`}</button>`).join("");
  showMenu(stage, cx, cy, `<span class="menu-title px">${esc(title)}</span>${items}${mode === "free" && !nodeByType(p, "cut") ? `<button role="menuitem" class="add-item" data-act="menu-add" data-type="cut"><i class="ai-ico">${icon("cut")}</i><span class="ai-txt"><b>成片时间线</b><em>把视频节点连进来排成粗剪</em></span></button>` : ""}${mode === "free" ? `<hr><label class="add-item up">${icon("upload")}<span class="ai-txt"><b>上传素材</b><em>图片 / 视频 / 音频</em></span><input type="file" hidden multiple data-in="cv-upload" accept="image/*,video/*,audio/*"></label>` : ""}`, { wx, wy, from: from?.id || "", mode, auto: !at && from });
}
function menuAdd(type) {
  const p = project(); const m = ui.menu; closeMenu(); if (!p) return;
  const from = m?.from ? nodeOf(p, m.from) : null;
  let pos = m && m.wx != null ? { x: m.wx, y: m.wy } : null;
  if (pos && from && !m.auto) { pos = { x: m.mode === "up" ? pos.x - nodeWidth({ type, data: BASES[type]() }) : pos.x + 6, y: pos.y - 60 }; }
  if (pos && m.auto) pos = freeSpot(p, pos, nodeWidth({ type, data: BASES[type]() }), 260, true);
  if (type === "cut") { ensureStructure(p, "cut"); const c = nodeByType(p, "cut"); if (pos) { c.x = Math.round(pos.x); c.y = Math.round(pos.y); } setSel([c.id], c.id); touch(p); renderProject(); return; }
  const n = addFreeNode(type, pos, { silent: true });
  if (from && n) {
    const [a, b] = m.mode === "up" ? [n, from] : [from, n];
    if (!createsCycle(p, a.id, b.id)) { const e = { id: uid("edge"), from: a.id, to: b.id }; p.canvas.edges.push(e); freshEdges.add(e.id); }
    touch(p);
  }
  renderProject();
  requestAnimationFrame(() => { burstNode(n.id, 8); const t = $(".cv-layer .cf [data-cf]"); t?.focus({ preventScroll: true }); });
}

function connect(p, a, b) {
  if (b.type === "cut") {
    const url = nodeVideo(a);
    if (a.type !== "video") { toast("只有视频节点可以连到成片", 3000, "err"); drawEdges(); return; }
    if (!url) { toast("这个视频还没生成", 2600, "err"); drawEdges(); return; }
    addClip(p, b, url); touch(p); renderProject(); toast("已排进成片"); return;
  }
  if (!(OUT_OK[a.type] || []).includes(b.type)) { toast(`${FREE_LABEL[a.type] || "这个节点"}不能连到${FREE_LABEL[b.type] || "这个节点"}`, 3000, "err"); drawEdges(); renderComposer(); return; }
  if (createsCycle(p, a.id, b.id)) { toast("不能连成环", 2600, "err"); drawEdges(); return; }
  if (!p.canvas.edges.some(e => e.from === a.id && e.to === b.id)) { const e = { id: uid("edge"), from: a.id, to: b.id }; p.canvas.edges.push(e); freshEdges.add(e.id); }
  touch(p); drawEdges(); renderComposer();
  const el = $(`[data-node="${CSS.escape(b.id)}"]`); if (el) { el.classList.remove("linked"); void el.offsetWidth; el.classList.add("linked"); }
  canvasRefresh(p, b.id);
}

// 找一块不和已有节点重叠的位置；side=true 时只沿纵向找（用于「接下一个节点」）
function freeSpot(p, c, w, h, side = false) {
  const boxes = p.canvas.nodes.map(boxOf); const pad = 28;
  const hit = (x, y) => boxes.some(b => x < b.x + b.w + pad && x + w + pad > b.x && y < b.y + b.h + pad && y + h + pad > b.y);
  if (side) { for (let k = 0; k < 30; k++) for (const s of k ? [1, -1] : [1]) { const y = c.y + s * k * 60; if (!hit(c.x, y)) return { x: c.x, y }; } return c; }
  for (let ring = 0; ring < 14; ring++) for (let i = -ring; i <= ring; i++) for (const [dx, dy] of [[i, -ring], [i, ring], [-ring, i], [ring, i]]) {
    const x = c.x + dx * 60, y = c.y + dy * 60; if (!hit(x, y)) return { x, y };
  }
  return c;
}
// 给一整块（比如拆出来的一组镜头）找空地：先往下找，再往右找
function freeRect(p, x, y, w, h) {
  const boxes = p.canvas.nodes.map(boxOf); const pad = 40;
  const hit = (X, Y) => boxes.some(b => X < b.x + b.w + pad && X + w + pad > b.x && Y < b.y + b.h + pad && Y + h + pad > b.y);
  for (let col = 0; col < 12; col++) for (let row = 0; row < 12; row++) {
    const X = x + col * 160, Y = y + row * 120;
    if (!hit(X, Y)) return { x: X, y: Y };
  }
  const all = boundsOf(p); return { x: all.maxX + 160, y };
}
function addFreeNode(type, at = null, { silent = false, data = {}, title = "" } = {}) {
  const p = project(); if (!p) return;
  if (type === "note") type = "text";
  if (type === "upload") { $(".cv-up input")?.click(); return; }
  if (type === "cut") { ensureStructure(p, "cut"); touch(p); const c = nodeByType(p, "cut"); if (!silent) selectNode(c.id, { center: true }); return c; }
  if (!FREE_TYPES.includes(type)) return;
  const stage = $("[data-stage]"); const r = stage?.getBoundingClientRect() || { width: 900, height: 600 }; const v = p.canvas.viewport;
  const w = nodeWidth({ type, data: { ...BASES[type](), ...data } });
  const pos = at || freeSpot(p, { x: (r.width / 2 - v.x) / v.zoom - w / 2, y: (r.height / 2.4 - v.y) / v.zoom - 120 }, w, type === "text" ? 160 : 300);
  const n = addNode(p, type, pos, data, title);
  setSel([n.id], n.id); ui.menu = null; ensureStructure(p); touch(p);
  if (!silent) { renderProject(); requestAnimationFrame(() => { burstNode(n.id, 8); $(".cv-layer .cf [data-cf]")?.focus({ preventScroll: true }); }); }
  return n;
}
async function uploadToCanvas(files, at = null) {
  const p = project(); if (!p) return;
  toast(`正在保存 ${files.length} 个文件…`, 2000);
  let k = 0; const made = [];
  for (const f of files.slice(0, 12)) {
    try {
      const d = await uploadAsset(f);
      const type = d.mediaType === "video" ? "video" : d.mediaType === "audio" ? "audio" : "image";
      const data = type === "image" ? { images: [d.assetUrl], imageUrl: d.assetUrl, source: "upload" } : type === "video" ? { videoUrl: d.assetUrl, status: "Succeed", source: "upload" } : { audioUrl: d.assetUrl, source: "upload" };
      const pos = at ? { x: at.x + k * 40, y: at.y + k * 40 } : null;
      const n = addFreeNode(type, pos, { silent: true, data, title: f.name.replace(/\.[^.]+$/, "").slice(0, 24) });
      if (n) { made.push(n.id); k++; }
    } catch (e) { toast(e.message, 5000, "err"); }
  }
  if (!made.length) return;
  setSel(made, made[made.length - 1]); touch(p); renderProject();
  toast(`已加入 ${made.length} 个素材`);
}

function deleteNodes(p, ids) {
  const list = ids.map(id => nodeOf(p, id)).filter(Boolean);
  const locked = list.filter(n => LOCKED_TYPES.includes(n.type));
  const kill = list.filter(n => !LOCKED_TYPES.includes(n.type));
  if (!kill.length) { if (locked.length) toast("结构节点不能删除；可以清空它的内容", 3200, "err"); return; }
  snapshot(p, kill.length > 1 ? `删除 ${kill.length} 个节点前` : "删除节点前");
  kill.forEach(n => { try { trashNode(p, n); } catch (_) {} });
  kill.forEach(n => {
    if (n.type === "shot") { p.script = p.script.filter(r => r.id !== n.data.shotId); p.canvas.nodes.filter(x => x.type === "video" && x.data.shotId === n.data.shotId).forEach(x => { x.data.shotId = ""; }); }
    p.canvas.nodes = p.canvas.nodes.filter(x => x.id !== n.id);
    p.canvas.edges = p.canvas.edges.filter(e => e.from !== n.id && e.to !== n.id);
  });
  setSel([]);
  ensureStructure(p); touch(p); renderProject();
  toast(`已移到纸篓${kill.length > 1 ? ` ${kill.length} 个节点` : ""}，右上角纸篓里可以还原${locked.length ? "（结构节点已保留）" : ""}`);
}
function deleteNode(p, id) { deleteNodes(p, [id]); }
function deleteEdge(p, id) { const before = p.canvas.edges.length; p.canvas.edges = p.canvas.edges.filter(e => e.id !== id); ui.edgeSel = ""; if (p.canvas.edges.length !== before) { touch(p); drawEdges(); renderComposer(); toast("连线已删除", 1600); } }
// 复制选中的节点，以及它们之间的连线
function duplicateNodes(p, ids) {
  const list = ids.map(id => nodeOf(p, id)).filter(n => n && FREE_TYPES.includes(n.type));
  if (!list.length) return toast("结构节点不能复制", 2600, "err");
  const map = new Map();
  list.forEach(n => { const c = addNode(p, n.type, { x: n.x + 40, y: n.y + 40 }, copy({ ...n.data, status: RUN.includes(n.data.status) || n.data.status === "generating" ? "" : n.data.status, requestId: "" }), `${nodeTitle(p, n)} 副本`.slice(0, 40)); map.set(n.id, c.id); });
  p.canvas.edges.filter(e => map.has(e.from) && map.has(e.to)).forEach(e => p.canvas.edges.push({ id: uid("edge"), from: map.get(e.from), to: map.get(e.to) }));
  setSel([...map.values()]); touch(p); renderProject();
}

function addClip(p, cut, url) {
  if (!url) return false;
  cut.data.clips ||= [];
  if (cut.data.clips.some(c => c.url === url)) return false;
  cut.data.clips.push({ id: uid("clip"), title: `片段 ${cut.data.clips.length + 1}`, url, in: 0, out: 5 });
  return true;
}
function syncCut(p) {
  ensureStructure(p, "cut");
  const cut = nodeByType(p, "cut");
  const order = p.script.map(r => r.id);
  const vids = p.canvas.nodes.filter(n => n.type === "video" && n.data.videoUrl && n.data.source !== "upload").sort((a, b) => { const ia = order.indexOf(a.data.shotId), ib = order.indexOf(b.data.shotId); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib); });
  let added = 0; vids.forEach(v => { if (addClip(p, cut, v.data.videoUrl)) added++; });
  touch(p); return { cut, added, total: vids.length };
}
