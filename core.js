"use strict";
// 帧比特 FRAMEBIT 3.6 · 核心：工具、数据结构、迁移、持久化

const APP_VERSION = "3.7.0";
const SCHEMA = 7;
const LOCAL_MIRROR_KEY = "framebit_state_v1";
const LEGACY_KEYS = ["vibe_beta_2_0_state"];

const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => Array.from(root.querySelectorAll(q));
const uid = (p = "id") => `${p}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
const now = () => new Date().toISOString();
const esc = (v = "") => String(v ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
const attr = v => esc(v).replace(/`/g, "&#96;");
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const copy = v => JSON.parse(JSON.stringify(v));
const when = iso => {
  try {
    const d = new Date(iso), diff = (Date.now() - d) / 1000;
    if (diff < 60) return "刚刚";
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    return d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
  } catch (_) { return ""; }
};
const fmtTime = iso => { try { return new Date(iso).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (_) { return ""; } };

// ---------- 风格画像字段 ----------
const STYLE_FIELDS = [
  ["positioning", "账号定位", "这条内容以什么身份说话，比如：面向创始人的 AI 行业观察者"],
  ["contentType", "内容类型", "比如：60 秒观点口播、90 秒案例拆解"],
  ["audience", "目标受众", "说给谁听，他们处在什么场景"],
  ["voice", "表达语气", "比如：直接、理性，不制造对立"],
  ["duration", "时长", "比如：50–70 秒"],
  ["pace", "节奏", "比如：中快，论证处留半拍停顿"],
  ["structure", "结构", "比如：反常识观点 → 三点论证 → 提问"],
  ["hook", "开场钩子", "前三秒怎样让人留下来"],
  ["visual", "画面语言", "人物、场景、镜头和字幕怎么呈现"],
  ["cover", "封面规范", "主体、字数、颜色、构图"],
  ["cta", "互动方式", "希望观众看完做什么"],
  ["risk", "风险边界", "事实、平台规则和不能承诺的内容"],
  ["platformTone", "平台调性", "这个平台上的原生表达方式"],
  ["discovery", "分发逻辑", "推荐、搜索或关系链怎么带来流量"]
];
const STYLE_KEYS = STYLE_FIELDS.map(([k]) => k);
const emptyStyle = () => Object.fromEntries(STYLE_KEYS.map(k => [k, ""]));
const styleFilledCount = s => STYLE_KEYS.filter(k => String(s?.[k] || "").trim()).length;

const ACCOUNT_FIELDS = [["name", "账号名称", "比如：职场口播号"], ["platform", "主平台", ""], ["position", "账号定位", "这个账号为谁、讲什么"], ["audience", "目标用户", "他们是谁，处在什么场景"], ["tone", "人设语气", "比如：直接、理性，不煽动对立"], ["structure", "常用结构", "比如：痛点开场、观点、三点论证、互动"], ["forbidden", "禁用表达", "绝对化词、夸大承诺等"], ["cover", "封面规范", "主体、字数、颜色"], ["review", "审稿规则", "事实核验和平台风险的底线"]];
const blankAccount = () => ({ id: uid("acc"), name: "", platform: "抖音", position: "", audience: "", tone: "", structure: "", forbidden: "", cover: "", review: "" });

// ---------- 项目 ----------
function blankProject(topic = "", platform = "抖音", accountId = "") {
  const t = now();
  return {
    id: uid("p"), title: topic.slice(0, 40), topic, platform, accountId, brief: "",
    style: emptyStyle(), styleMemoryId: "", styleSavedAt: "",
    script: [], titles: [], coverWords: [], publishCopy: "", coverPlan: "", review: [], reviewSummary: "", rationale: [],
    coverDesign: null, coverImageUrl: "", coverMainText: "", coverSubText: "", coverEyebrow: "", coverBackgroundPrompt: "",
    canvas: { layout: 2, viewport: { x: 80, y: 80, zoom: 1 }, nodes: [], edges: [] },
    cast: [], versions: [], chat: [], exports: {}, view: { mode: "flow", step: "" }, createdAt: t, updatedAt: t
  };
}
const shotRow = (v = {}) => ({ id: v.id || uid("shot"), time: String(v.time || ""), shot: String(v.shot || ""), voice: String(v.voice || ""), subtitle: String(v.subtitle || ""), note: String(v.note || ""), imageUrl: String(v.imageUrl || ""), imageStatus: v.imageStatus === "generating" ? "" : String(v.imageStatus || ""), imageError: String(v.imageError || ""), imageModel: String(v.imageModel || "") });

function normalizeProject(raw) {
  const p = { ...blankProject(), ...raw };
  p.id = String(p.id || uid("p"));
  p.style = { ...emptyStyle(), ...(raw.style || {}) };
  p.script = (Array.isArray(raw.script) ? raw.script : []).filter(r => r && typeof r === "object").map(shotRow);
  ["titles", "coverWords"].forEach(k => { p[k] = Array.isArray(raw[k]) ? raw[k].map(String) : []; });
  p.review = Array.isArray(raw.review) ? raw.review.filter(r => r && typeof r === "object") : [];
  p.rationale = Array.isArray(raw.rationale) ? raw.rationale.map(String) : [];
  p.versions = Array.isArray(raw.versions) ? raw.versions.filter(v => v && v.data) : [];
  p.chat = Array.isArray(raw.chat) ? raw.chat.filter(m => m && m.role) : [];
  p.exports = raw.exports && typeof raw.exports === "object" ? raw.exports : {};
  p.cast = [...new Set((Array.isArray(raw.cast) ? raw.cast : []).map(String).filter(Boolean))].slice(0, 3);
  p.view = { mode: raw.view?.mode === "canvas" ? "canvas" : "flow", step: raw.view?.step ? stepKey(raw.view.step) : "" };
  const c = raw.canvas && typeof raw.canvas === "object" ? raw.canvas : {};
  const allowed = new Set(["topic", "style", "script", "shot", "publish", "cut", "note", "text", "image", "video", "audio", "upload", "remake", "ip"]);
  const nodes = (Array.isArray(c.nodes) ? c.nodes : []).filter(n => n && allowed.has(n.type)).map(n => canvasMigrate({ id: String(n.id || uid("node")), type: n.type, x: Number(n.x) || 0, y: Number(n.y) || 0, w: Number(n.w) || 0, title: String(n.title || ""), data: n.data && typeof n.data === "object" ? { ...n.data } : {} }));
  const ids = new Set(nodes.map(n => n.id));
  p.canvas = { layout: Number(c.layout || 0), viewport: { x: Number(c.viewport?.x ?? 80), y: Number(c.viewport?.y ?? 80), zoom: clamp(Number(c.viewport?.zoom || 1), .15, 2.5) }, nodes, edges: (Array.isArray(c.edges) ? c.edges : []).filter(e => e && ids.has(e.from) && ids.has(e.to)).map(e => ({ id: String(e.id || uid("edge")), from: e.from, to: e.to })) };
  nodes.forEach(n => { if (["image", "video", "audio", "text", "remake"].includes(n.type) && ["generating", "submitting"].includes(n.data.status)) n.data.status = n.data.requestId ? "InQueue" : ""; });
  if (p.remake && typeof p.remake === "object" && p.remake.status) p.remake.status = "";
  return p;
}

// ---------- 迁移：2.0 / 3.0 → 3.1 ----------
const LEGACY_DEMO_TITLES = new Set(["年轻人为什么越来越不想升职了？", "AI 真能替代短视频编导吗？"]);
function isLegacyDemoProject(p) {
  return LEGACY_DEMO_TITLES.has(p.title) && !(p.versions || []).length && (p.script || []).some(r => /可能和你想的不一样|背后的成本和回报/.test(r.voice || ""));
}
function migrateLegacyProject(old) {
  const sp = old.styleProfile || {};
  const p = blankProject(String(old.title || ""), old.platform || "抖音", old.accountId || "");
  p.id = String(old.id || p.id);
  p.title = String(old.title || "未命名项目");
  p.topic = p.title;
  p.brief = String(old.brief || "");
  p.style = { ...emptyStyle(), ...Object.fromEntries(STYLE_KEYS.map(k => [k, String(sp[k] || "")])), positioning: String(sp.positioningLabel || old.positioningLabel || ""), contentType: String(sp.contentTypeLabel || old.type || "") };
  if (sp.version >= 2 || sp.memorySavedAt) p.styleSavedAt = sp.memorySavedAt || old.updatedAt || now();
  p.script = (old.script || []).filter(Boolean).map(shotRow);
  ["titles", "coverWords", "publishCopy", "coverPlan", "review", "rationale", "coverDesign", "coverImageUrl", "coverMainText", "coverSubText", "coverEyebrow", "coverBackgroundPrompt"].forEach(k => { if (old[k] !== undefined) p[k] = copy(old[k]); });
  p.chat = (old.directorChat || []).filter(m => m && m.role).map(m => ({ role: m.role, content: String(m.content || ""), time: m.time || now() }));
  p.createdAt = old.createdAt || now(); p.updatedAt = old.updatedAt || now();
  const cc = old.creativeCanvas;
  if (cc?.nodes?.length) {
    const map = new Map();
    let cutDone = false;
    cc.nodes.forEach(n => {
      let node = null; const d = n.data || {};
      const pos = { x: Number(n.x) || 0, y: (Number(n.y) || 0) + 900 };
      if (n.type === "prompt") node = { type: "note", data: { text: String(d.text || "") } };
      if (n.type === "image") node = { type: "image", data: { prompt: String(d.prompt || ""), model: d.model || "auto", imageUrl: String(d.imageUrl || ""), status: d.imageUrl ? "done" : "" } };
      if (n.type === "edit" && d.editedUrl) node = { type: "image", data: { prompt: "", model: "auto", imageUrl: d.editedUrl, status: "done" } };
      if (n.type === "media") node = { type: "upload", data: { assetUrl: String(d.assetUrl || ""), mediaType: d.mediaType || "", name: d.name || "" } };
      if (n.type === "video") node = { type: "video", data: { prompt: String(d.prompt || ""), model: d.model || "auto", imageSize: d.imageSize || "720x1280", negativePrompt: d.negativePrompt || "", status: d.videoUrl ? "Succeed" : (d.requestId ? "poll_error" : ""), requestId: d.requestId || "", videoUrl: d.videoUrl || "", error: "" } };
      if (n.type === "timeline" && !cutDone) { cutDone = true; node = { type: "cut", data: { clips: (d.clips || []).map(c => ({ id: c.id || uid("clip"), title: c.title || "", url: c.url, in: Number(c.in || 0), out: Number(c.out || 5) })) } }; }
      if (!node) return;
      const id = uid("node"); map.set(n.id, id);
      p.canvas.nodes.push({ id, ...pos, w: 0, ...node });
    });
    (cc.edges || []).forEach(e => { if (map.has(e.from) && map.has(e.to)) p.canvas.edges.push({ id: uid("edge"), from: map.get(e.from), to: map.get(e.to) }); });
  }
  return p;
}

function migrate(raw) {
  if (!raw || !Array.isArray(raw.projects)) throw new Error("备份里没有项目数据");
  if (Number(raw.schemaVersion) >= 6) return Number(raw.schemaVersion) < SCHEMA ? { ...raw, migratedFrom: Number(raw.schemaVersion) } : raw;
  let projects = raw.projects.filter(p => p && typeof p === "object");
  projects = projects.filter(p => !isLegacyDemoProject(p));
  const used = new Set(projects.map(p => p.accountId));
  const accounts = (raw.accounts || []).filter(a => a && typeof a === "object").filter(a => {
    const legacyDemo = ["acc-work", "acc-ai"].includes(a.id) && !used.has(a.id);
    const v3Default = a.name === "我的账号" && !a.position && !a.audience && !used.has(a.id);
    return !legacyDemo && !v3Default;
  });
  const styles = (raw.styleMemories || []).filter(m => m && m.styleProfile).map(m => {
    const sp = m.styleProfile;
    return { id: m.id || uid("style"), name: m.name || sp.signature || "风格画像", platform: m.platform || sp.platform || "", savedAt: m.updatedAt || now(), style: { ...emptyStyle(), ...Object.fromEntries(STYLE_KEYS.map(k => [k, String(sp[k] || "")])), positioning: String(sp.positioningLabel || ""), contentType: String(sp.contentTypeLabel || "") } };
  });
  return { schemaVersion: SCHEMA, revision: Number(raw.revision || 0), accounts, styles, projects: projects.map(migrateLegacyProject), migratedFrom: Number(raw.schemaVersion || 4) };
}

function normalizeState(raw) {
  const s = migrate(raw);
  const out = { schemaVersion: SCHEMA, revision: Number(s.revision || 0), accounts: [], styles: [], projects: [] };
  out.accounts = (s.accounts || []).filter(a => a && typeof a === "object").map(a => ({ ...blankAccount(), ...Object.fromEntries(Object.entries(a).map(([k, v]) => [k, typeof v === "string" ? v : v])), id: String(a.id || uid("acc")) }));
  out.styles = (s.styles || []).filter(x => x && x.style).map(x => ({ id: String(x.id || uid("style")), name: String(x.name || "风格画像"), platform: String(x.platform || ""), savedAt: x.savedAt || now(), style: { ...emptyStyle(), ...x.style } }));
  out.projects = (s.projects || []).filter(p => p && typeof p === "object").map(normalizeProject);
  const accIds = new Set(out.accounts.map(a => a.id));
  out.projects.forEach(p => { if (p.accountId && !accIds.has(p.accountId)) p.accountId = ""; });
  if (s.migratedFrom) out.migratedFrom = s.migratedFrom;
  if (s.theme === "light" || s.theme === "dark") out.theme = s.theme;
  if (s.last && typeof s.last === "object") out.last = { view: String(s.last.view || "home"), projectId: String(s.last.projectId || "") };
  out.ips = (Array.isArray(s.ips) ? s.ips : []).filter(x => x && typeof x === "object").map(normalizeIp).slice(0, 60);
  const ipIds = new Set(out.ips.map(x => x.id));
  out.projects.forEach(p => { p.cast = p.cast.filter(id => ipIds.has(id)); });
  out.pet = normalizePet(s.pet);
  out.trash = (Array.isArray(s.trash) ? s.trash : []).filter(t => t && t.id && t.kind).slice(0, TRASH_MAX);
  return out;
}

// ---------- 3.5 · 扩展模块挂载点：动作、输入、Esc 层 ----------
const EXT_ACTS = {}, EXT_INS = {}, EXT_ESC = [];

// ---------- 3.5 · 宠物 Bit 与家园、纸篓 ----------
const TRASH_MAX = 120;
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function petDefaults() {
  return {
    name: "Bit", pos: { x: .95, y: .7 }, hidden: false,
    xp: 0, coins: 30, streak: 0, lastLogin: "", seenLevel: 1,
    stats: { food: 80, mood: 80, energy: 90, at: now() },
    daily: { date: "", coins: 0, tasks: {}, claimed: {}, pets: 0 },
    keys: [], history: [], chat: [],
    home: {
      size: { farm: 6, pen: 3, pond: 3 },
      plots: [], animals: [], fish: [], decor: [], furniture: [],
      inv: { s_carrot: 3, carrot: 1 }, owned: {}, rating: 0, visits: 0, layout: 2, sound: true, mail: { date: "" }, fishing: { date: "", n: 0 }
    }
  };
}
function normalizePet(raw) {
  const d = petDefaults();
  if (!raw || typeof raw !== "object") return d;
  const num = (v, f) => Number.isFinite(Number(v)) ? Number(v) : f;
  const arr = (v, cap) => (Array.isArray(v) ? v : []).filter(x => x && typeof x === "object").slice(-cap);
  const h = raw.home && typeof raw.home === "object" ? raw.home : {};
  return {
    ...d, name: String(raw.name || "Bit").slice(0, 12),
    pos: { x: clamp(num(raw.pos?.x, d.pos.x), 0, 1), y: clamp(num(raw.pos?.y, d.pos.y), 0, 1) }, hidden: Boolean(raw.hidden),
    xp: Math.max(0, num(raw.xp, 0)), coins: Math.max(0, Math.round(num(raw.coins, d.coins))), streak: Math.max(0, num(raw.streak, 0)), lastLogin: String(raw.lastLogin || ""), seenLevel: Math.max(1, num(raw.seenLevel, 1)),
    stats: { food: clamp(num(raw.stats?.food, 80), 0, 100), mood: clamp(num(raw.stats?.mood, 80), 0, 100), energy: clamp(num(raw.stats?.energy, 90), 0, 100), at: raw.stats?.at || now() },
    daily: { date: String(raw.daily?.date || ""), coins: num(raw.daily?.coins, 0), tasks: { ...(raw.daily?.tasks || {}) }, claimed: { ...(raw.daily?.claimed || {}) }, pets: num(raw.daily?.pets, 0), pick: Array.isArray(raw.daily?.pick) ? raw.daily.pick.map(String).slice(0, 3) : [] },
    keys: (Array.isArray(raw.keys) ? raw.keys : []).map(String).slice(-240),
    history: arr(raw.history, 80), chat: arr(raw.chat, 40).filter(m => m.role),
    home: {
      size: { farm: clamp(num(h.size?.farm, 6), 6, 12), pen: clamp(num(h.size?.pen, 3), 3, 6), pond: clamp(num(h.size?.pond, 3), 3, 6) },
      plots: arr(h.plots, 12), animals: arr(h.animals, 6), fish: arr(h.fish, 6), decor: arr(h.decor, 40), furniture: arr(h.furniture, 20),
      inv: h.inv && typeof h.inv === "object" ? Object.fromEntries(Object.entries(h.inv).map(([k, v]) => [k, Math.max(0, Math.round(num(v, 0)))])) : { ...d.home.inv },
      owned: { ...(h.owned || {}) }, rating: num(h.rating, 0), visits: num(h.visits, 0),
      layout: num(h.layout, 0), sound: h.sound !== false,
      mail: h.mail && typeof h.mail === "object" ? { date: String(h.mail.date || "") } : { date: "" },
      fishing: h.fishing && typeof h.fishing === "object" ? { date: String(h.fishing.date || ""), n: num(h.fishing.n, 0) } : { date: "", n: 0 }
    }
  };
}

// ---------- 3.6 · IP 工作台：跨项目的长期角色资产 ----------
const IP_KINDS = [["virtual", "虚拟角色"], ["creator", "真人博主"], ["brand", "品牌吉祥物"]];
const IP_STAGES = [["profile", "设定"], ["portrait", "定妆"], ["sheet", "三视图"], ["expr", "表情"]];
const IP_EXPR_DEFAULT = ["开心", "惊讶", "思考", "生气", "害羞", "无语", "比心", "困了"];
function blankIp(kind = "virtual") {
  const t = now();
  return {
    id: uid("ip"), name: "", kind, consent: false,
    origin: { mode: "idea", idea: "", accountId: "", materials: [] },
    profile: { tagline: "", personality: "", backstory: "", voice: "", catchphrases: [], rules: [], relations: "", look: "", palette: [], outfits: [], ideas: [] },
    anchor: { prompt: "", negative: "", refs: [], useSheet: true },
    portraits: [], portrait: "", sheets: [], sheet: "", expressions: [], locks: {}, checks: {}, topics: [],
    createdAt: t, updatedAt: t
  };
}
function normalizeIp(raw) {
  const d = blankIp(IP_KINDS.some(([k]) => k === raw.kind) ? raw.kind : "virtual");
  const str = v => String(v ?? "");
  const list = (v, n = 12) => (Array.isArray(v) ? v : typeof v === "string" && v ? v.split(/[，,、\n]/) : []).map(x => String(x).trim()).filter(Boolean).slice(0, n);
  const pr = raw.profile && typeof raw.profile === "object" ? raw.profile : {};
  const an = raw.anchor && typeof raw.anchor === "object" ? raw.anchor : {};
  const og = raw.origin && typeof raw.origin === "object" ? raw.origin : {};
  return {
    ...d, id: str(raw.id || d.id), name: str(raw.name).slice(0, 20), consent: Boolean(raw.consent),
    origin: { mode: ["idea", "material", "dna"].includes(og.mode) ? og.mode : "idea", idea: str(og.idea), accountId: str(og.accountId), materials: list(og.materials, 6) },
    profile: { tagline: str(pr.tagline), personality: str(pr.personality), backstory: str(pr.backstory), voice: str(pr.voice), catchphrases: list(pr.catchphrases, 8), rules: list(pr.rules, 10), relations: str(pr.relations), look: str(pr.look), palette: list(pr.palette, 6).filter(c => /^#[0-9a-f]{6}$/i.test(c)), outfits: list(pr.outfits, 6), ideas: list(pr.ideas, 6) },
    anchor: { prompt: str(an.prompt), negative: str(an.negative), refs: list(an.refs, 4), useSheet: an.useSheet !== false },
    portraits: list(raw.portraits, 12), portrait: str(raw.portrait), sheets: list(raw.sheets, 8), sheet: str(raw.sheet),
    expressions: (Array.isArray(raw.expressions) ? raw.expressions : []).filter(e => e && e.name).slice(0, 16).map(e => ({ id: str(e.id || uid("ex")), name: str(e.name).slice(0, 8), url: str(e.url), status: e.status === "generating" ? "" : str(e.status), error: str(e.error) })),
    locks: Object.fromEntries(IP_STAGES.map(([k]) => [k, raw.locks?.[k] ? str(raw.locks[k]) : ""]).filter(([, v]) => v)),
    checks: raw.checks && typeof raw.checks === "object" ? raw.checks : {},
    topics: (Array.isArray(raw.topics) ? raw.topics : []).filter(x => x && x.title).slice(0, 12),
    createdAt: raw.createdAt || d.createdAt, updatedAt: raw.updatedAt || d.updatedAt
  };
}
const ipById = id => (state?.ips || []).find(x => x.id === id) || null;
// 发给服务端的出镜 IP 摘要（只带文字设定，不带图片）
const castPayload = p => (p.cast || []).map(ipById).filter(Boolean).map(ip => ({ name: ip.name, kind: ip.kind, tagline: ip.profile.tagline, personality: ip.profile.personality, voice: ip.profile.voice, catchphrases: ip.profile.catchphrases, look: ip.profile.look, rules: ip.profile.rules }));

// ---------- 运行时 ----------
let state = null;
let route = { view: "home", projectId: "" };
let apiState = { connected: false, provider: "openai", providerLabel: "", connectedProviders: [], capabilities: {} };
const project = (id = route.projectId) => state.projects.find(p => p.id === id) || null;
const account = id => state.accounts.find(a => a.id === id) || null;
const caps = () => apiState.capabilities || {};

// 发给服务端的项目上下文（沿用服务端提示词期望的字段）
function serverProject(p) {
  const s = p.style || {};
  return {
    id: p.id, title: p.title, platform: p.platform, positioningLabel: s.positioning, type: s.contentType, brief: [p.topic && p.topic !== p.title ? `选题：${p.topic}` : "", p.brief].filter(Boolean).join("\n"),
    styleProfile: { ...s, signature: `${p.platform} / ${s.positioning || "未定位"} / ${s.contentType || "未定类型"}`, positioningLabel: s.positioning, contentTypeLabel: s.contentType },
    script: p.script.map(({ time, shot, voice, subtitle, note }) => ({ time, shot, voice, subtitle, note })),
    titles: p.titles, coverWords: p.coverWords, publishCopy: p.publishCopy, review: p.review, coverPlan: p.coverPlan,
    coverMainText: p.coverMainText, coverSubText: p.coverSubText, coverBackgroundPrompt: p.coverBackgroundPrompt,
    cast: castPayload(p)
  };
}

// ---------- 编导流程：完全根据真实内容计算 ----------
const STEPS = [
  ["topic", "选题立项", "一句话选题、平台、账号和补充说明"],
  ["style", "风格画像", "给谁看、什么语气、多长、怎么开场"],
  ["script", "分镜脚本", "逐镜写出画面、口播、字幕和备注"],
  ["visual", "画面", "为每一镜生成或上传画面，再挑几镜做成视频"],
  ["cut", "成片", "把视频按分镜顺序排成粗剪"],
  ["package", "标题包装", "标题、封面字、发布文案和封面方案"],
  ["review", "审稿", "检查事实、平台风险、账号调性、结构和表达"],
  ["cover", "封面", "在设计器里排出封面并导出 PNG"],
  ["deliver", "交付", "导出拍摄、剪辑、审核和发布物料"]
];
const STEP_ALIAS = { shots: "visual", media: "visual", publish: "package" };
const stepKey = k => STEP_ALIAS[k] || (STEPS.some(([x]) => x === k) ? k : "topic");
function outline(p) {
  const videos = p.canvas.nodes.filter(n => n.type === "video");
  const doneVideos = videos.filter(n => n.data.videoUrl).length;
  const running = videos.filter(n => ["InQueue", "InProgress", "submitting"].includes(n.data.status)).length;
  const withImg = p.script.filter(r => r.imageUrl).length;
  const withMedia = p.script.filter(r => r.imageUrl || videos.some(v => v.data.shotId === r.id && v.data.videoUrl)).length;
  const cut = p.canvas.nodes.find(n => n.type === "cut");
  const clips = cut?.data.clips?.length || 0;
  const styleN = styleFilledCount(p.style);
  const must = p.review.filter(r => r.level === "必须修改").length;
  const exported = Object.keys(p.exports || {}).length;
  const info = {
    topic: { done: Boolean(p.topic.trim()), st: p.topic.trim() ? "完成" : "" },
    style: { done: Boolean(p.style.positioning && p.style.contentType && styleN >= 5), st: p.styleSavedAt ? "已记住" : styleN ? `${styleN}/${STYLE_KEYS.length}` : "" },
    script: { done: p.script.length > 0, st: p.script.length ? `${p.script.length} 镜` : "" },
    visual: { done: p.script.length > 0 && withMedia === p.script.length && running === 0, st: running ? `${running} 生成中` : p.script.length ? `${withImg}/${p.script.length}${doneVideos ? ` · ${doneVideos} 视频` : ""}` : "" },
    cut: { done: clips > 0, st: clips ? `${clips} 段` : "" },
    package: { done: p.titles.length > 0 && Boolean(p.publishCopy.trim()), st: p.titles.length ? `${p.titles.length} 标题` : p.publishCopy ? "有文案" : "" },
    review: { done: p.review.length > 0 && must === 0, st: p.review.length ? (must ? `${must} 处必改` : "通过") : "" },
    cover: { done: Boolean(p.coverDesign?.elements?.length), st: p.coverDesign?.elements?.length ? "已设计" : "" },
    deliver: { done: exported > 0, st: exported ? `导出 ${exported} 项` : "" }
  };
  const keys = STEPS.map(([k]) => k);
  const last = keys.reduce((m, k, i) => info[k].done ? i : m, -1);
  const current = keys.find((k, i) => i > last && !info[k].done) || keys.find(k => !info[k].done) || "";
  return STEPS.map(([key, name, desc], i) => ({ key, name, desc, no: String(i + 1).padStart(2, "0"), ...info[key], current: key === current }));
}
const nextStep = p => outline(p).find(s => s.current) || null;

// ---------- 持久化：写到本机服务（文件），浏览器存储留镜像 ----------
const WINDOW_ID = uid("win");
let knownRevision = 0, storageConflict = false, recoveryMode = false, recoveryRaw = "", serverOnline = true;
const saveQ = { timer: null, inFlight: false, again: false, dirty: false };

function setSave(kind, text) { const b = $("#saveState"); if (b) { b.className = `save-state ${kind === "err" ? "err" : ""}`; b.textContent = text; } }
function mirror() { try { localStorage.setItem(LOCAL_MIRROR_KEY, JSON.stringify(state)); } catch (_) {} }
function save() {
  if (recoveryMode || storageConflict) { setSave("err", "已暂停保存"); return false; }
  saveQ.dirty = true; setSave("", "保存中");
  clearTimeout(saveQ.timer); saveQ.timer = setTimeout(flushSave, 320);
  return true;
}
function touch(p, ...rest) { if (p) { p.updatedAt = now(); try { if (typeof undoNote === "function") undoNote(p); } catch (_) {} } return save(...rest); }
async function flushSave(force = false) {
  clearTimeout(saveQ.timer);
  if (!saveQ.dirty && !force) return true;
  if (saveQ.inFlight) { saveQ.again = true; return false; }
  saveQ.inFlight = true; saveQ.dirty = false;
  state.schemaVersion = SCHEMA; mirror();
  try {
    const r = await fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state, baseRevision: knownRevision, writer: WINDOW_ID, force }) });
    const d = await r.json().catch(() => ({}));
    if (r.status === 409) { showConflict("另一个窗口保存了更新的数据，这个窗口已暂停保存。"); return false; }
    if (!r.ok) throw new Error(d.error || "保存失败");
    knownRevision = d.revision; state.revision = d.revision; serverOnline = true; setSave("", "已保存");
    return true;
  } catch (_) {
    serverOnline = false; saveQ.dirty = true; setSave("err", "未写入磁盘，稍后重试");
    saveQ.timer = setTimeout(flushSave, 4000); return false;
  } finally {
    saveQ.inFlight = false;
    if (saveQ.again) { saveQ.again = false; flushSave(); }
  }
}
function flushOnExit() {
  if (!saveQ.dirty || storageConflict || recoveryMode) return;
  mirror();
  try { navigator.sendBeacon?.("/api/state", new Blob([JSON.stringify({ state, baseRevision: knownRevision, writer: WINDOW_ID })], { type: "application/json" })); saveQ.dirty = false; } catch (_) {}
}
function showConflict(text) { storageConflict = true; setSave("err", "已暂停保存"); $("#conflictText").textContent = text; $("#conflict").classList.add("show"); }

async function loadInitialState() {
  try {
    const d = await (await fetch("/api/state")).json();
    if (d?.state) {
      try { const s = normalizeState(d.state); knownRevision = Number(d.revision || 0); return { loaded: s, migrated: Boolean(s.migratedFrom) }; }
      catch (e) { recoveryMode = true; recoveryRaw = JSON.stringify(d.state, null, 2); return { loaded: normalizeState({ schemaVersion: SCHEMA, projects: [] }), migrated: false, error: e.message }; }
    }
  } catch (_) { serverOnline = false; }
  for (const key of [LOCAL_MIRROR_KEY, ...LEGACY_KEYS]) {
    let raw = ""; try { raw = localStorage.getItem(key) || ""; } catch (_) {}
    if (!raw) continue;
    try { return { loaded: normalizeState(JSON.parse(raw)), migrated: true }; }
    catch (e) { recoveryMode = true; recoveryRaw = raw; return { loaded: normalizeState({ schemaVersion: SCHEMA, projects: [] }), migrated: false, error: e.message }; }
  }
  return { loaded: normalizeState({ schemaVersion: SCHEMA, projects: [] }), migrated: true };
}

// ---------- 通用 ----------
// 3.7：提示排成一列，最多同时 3 条；报错（停留 ≥4.5 秒的）会一直留着，点 × 才消失；所有提示都记进任务中心的「消息」
const TOASTS = { list: [], seq: 0 };
function toast(msg, ms = 2600, kind = "", opt = {}) {
  if (kind && typeof kind === "object") { opt = kind; kind = opt.kind || ""; }
  msg = String(msg ?? "").trim(); if (!msg) return;
  try { if (opt.log !== false && typeof jqLog === "function") jqLog(msg, kind); } catch (_) {}
  const box = $("#toasts"); if (!box) return;
  const sticky = opt.sticky ?? (kind === "err" && ms >= 4500);
  let t = opt.key ? TOASTS.list.find(x => x.key === opt.key) : null;
  const last = TOASTS.list[TOASTS.list.length - 1];
  if (!t && last && last.msg === msg && last.kind === kind && !opt.action) { t = last; t.n++; }
  if (t) { Object.assign(t, { msg, kind, sticky, action: opt.action || null }); toastPaint(t); }
  else {
    t = { id: ++TOASTS.seq, key: opt.key || "", msg, kind, sticky, action: opt.action || null, n: 1 };
    t.el = document.createElement("div"); t.el.setAttribute("role", kind === "err" ? "alert" : "status");
    t.el.addEventListener("click", ev => {
      const b = ev.target.closest("button"); if (!b) return; ev.stopPropagation();
      if (b.dataset.t === "a") { const fn = t.action?.fn; toastDrop(t); try { fn?.(); } catch (e) { console.error(e); } }
      else toastDrop(t);
    });
    t.el.addEventListener("pointerdown", ev => ev.stopPropagation());
    box.appendChild(t.el); TOASTS.list.push(t); toastPaint(t);
    requestAnimationFrame(() => t.el.classList.add("show"));
    while (TOASTS.list.length > 3) toastDrop(TOASTS.list.find(x => !x.sticky) || TOASTS.list[0]);
  }
  clearTimeout(t.timer);
  if (!t.sticky) t.timer = setTimeout(() => toastDrop(t), Math.max(1400, ms) + (t.action ? 1800 : 0));
}
function toastPaint(t) {
  t.el.className = `tst ${t.kind === "err" ? "err" : ""} ${t.sticky ? "sticky" : ""} ${t.el.classList.contains("show") ? "show" : ""}`;
  t.el.innerHTML = `<span class="tst-m">${esc(t.msg)}</span>${t.n > 1 ? `<b class="tst-n px">×${t.n}</b>` : ""}${t.action ? `<button class="tst-a" data-t="a">${esc(t.action.label)}</button>` : ""}${t.sticky || t.action ? `<button class="tst-x" data-t="x" aria-label="关闭提示">×</button>` : ""}`;
}
function toastDrop(t) {
  if (!t) return; clearTimeout(t.timer);
  TOASTS.list = TOASTS.list.filter(x => x !== t);
  t.el.classList.remove("show"); setTimeout(() => t.el.remove(), 220);
}
function toastClear() { [...TOASTS.list].forEach(toastDrop); }
function busy(btn, on, label = "处理中") {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.innerHTML; btn.textContent = label; btn.classList.add("loading"); btn.disabled = true; }
  else { if (btn.dataset.label) btn.innerHTML = btn.dataset.label; btn.classList.remove("loading"); btn.disabled = false; }
}
// 3.7：可以带 signal，任务中心点「取消」时立刻停止等待
async function postJson(url, body, opt = {}) {
  let r;
  try { r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: opt.signal }); }
  catch (e) { if (e?.name === "AbortError" || opt.signal?.aborted) throw Object.assign(new Error("已取消"), { code: "ABORTED" }); throw e; }
  const d = await r.json().catch(e => { if (opt.signal?.aborted) throw Object.assign(new Error("已取消"), { code: "ABORTED" }); return {}; });
  if (!r.ok) throw Object.assign(new Error(d.error || `请求失败（${r.status}）`), { status: r.status, code: d.code });
  return d;
}
function download(name, content, type = "text/plain;charset=utf-8") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  a.download = String(name).replace(/[\\/:*?"<>|]/g, "-");
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function readAsDataUrl(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error("文件读取失败")); r.readAsDataURL(file); }); }
async function uploadAsset(file, max = 50_000_000) {
  if (!file) throw new Error("没有选择文件");
  if (file.size > max) throw new Error(`单个文件不能超过 ${Math.round(max / 1e6)}MB`);
  return postJson("/api/assets", { name: file.name, dataUrl: await readAsDataUrl(file) });
}
function snapshot(p, name) {
  const { versions, chat, ...rest } = p;
  p.versions.push({ id: uid("v"), name, time: now(), data: copy(rest) });
  if (p.versions.length > 20) p.versions.shift();
}
function restoreVersion(p, id) {
  const v = p.versions.find(x => x.id === id); if (!v) return false;
  snapshot(p, "恢复版本前");
  const keep = { id: p.id, versions: p.versions, chat: p.chat };
  Object.assign(p, normalizeProject({ ...copy(v.data), ...keep }));
  p.versions = keep.versions; p.chat = keep.chat;
  return true;
}
function scriptSeconds(rows) {
  let max = 0;
  rows.forEach(r => { const m = String(r.time || "").match(/(\d{1,2}):(\d{2})\s*[-–~至]\s*(\d{1,2}):(\d{2})/); if (m) max = Math.max(max, +m[3] * 60 + +m[4]); });
  return max;
}
const svgArrow = '<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M7 12V2M2.5 6.5 7 2l4.5 4.5"/></svg>';
