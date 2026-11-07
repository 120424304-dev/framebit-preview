"use strict";
// 帧比特 3.5 · 纸篓：删掉的节点、镜头、项目先进纸篓，可以还原，也可以永久清理。
// 纸篓是一只网格铁丝篓：文本是纸团，音频是磁带，视频是光盘，图片是胶片；拖动篓子或点「摇一摇」，里面的东西会跟着晃。

const TR = { open: false, sel: "", filter: "all", bodies: [], raf: 0, bin: null, grab: null, confirm: 0, confirmT: 0, sprites: new Map(), lastT: 0 };
const TRASH_KIND = { text: "文本", image: "图片", video: "视频", audio: "音频", project: "项目" };
const TRASH_SHAPE = { text: "纸团", image: "胶片", video: "光盘", audio: "磁带", project: "纸团" };

// ---------- 放进纸篓 ----------
function trashPush(item) {
  state.trash ||= [];
  state.trash.unshift({ id: uid("tr"), deletedAt: now(), ...item });
  if (state.trash.length > TRASH_MAX) state.trash.length = TRASH_MAX;
  trashBadge();
}
const trashKindOfNode = (p, n) => n.type === "image" ? "image" : n.type === "video" || n.type === "cut" ? "video" : n.type === "audio" ? "audio" : n.type === "shot" ? (shotOf(p, n)?.imageUrl ? "image" : "text") : n.type === "remake" ? (n.data.videoUrl ? "video" : "text") : "text";
function trashNode(p, n) {
  const kind = trashKindOfNode(p, n);
  const row = n.type === "shot" ? shotOf(p, n) : null;
  const preview = kind === "image" ? nodeImage(p, n) || row?.imageUrl || "" : kind === "video" ? (nodeVideo(n) || n.data.videoUrl || n.data.clips?.[0]?.url || "") : kind === "audio" ? nodeAudio(n) : String(n.data.text || n.data.prompt || row?.voice || row?.shot || n.data.request || "").slice(0, 160);
  trashPush({
    kind, name: nodeTitle(p, n) || FREE_LABEL[n.type] || "节点", preview, from: { pid: p.id, title: p.title || "未命名项目" },
    payload: { type: "node", node: copy(n), edges: copy(p.canvas.edges.filter(e => e.from === n.id || e.to === n.id)), row: row ? copy(row) : null, index: row ? p.script.indexOf(row) : -1, videos: row ? p.canvas.nodes.filter(x => x.type === "video" && x.data.shotId === row.id).map(x => x.id) : [] }
  });
}
function trashShot(p, r) {
  trashPush({ kind: r.imageUrl ? "image" : "text", name: `分镜 ${String(p.script.indexOf(r) + 1).padStart(2, "0")}`, preview: r.imageUrl || String(r.voice || r.shot || "").slice(0, 160), from: { pid: p.id, title: p.title || "未命名项目" }, payload: { type: "shot", row: copy(r), index: p.script.indexOf(r) } });
}
function trashProject(p) {
  const { versions, ...rest } = p;
  trashPush({ kind: "project", name: p.title || "未命名项目", preview: [p.topic, p.script.length ? `${p.script.length} 镜` : "", p.platform].filter(Boolean).join(" · "), from: { pid: p.id, title: p.title }, payload: { type: "project", project: copy(rest) } });
}
function trashBadge() { $$("[data-trash-n]").forEach(b => { const n = (state.trash || []).length; b.textContent = n > 99 ? "99+" : String(n); b.hidden = !n; }); }
const trashBtn = () => `<button class="btn quiet sm icon trash-btn" data-act="trash-open" title="纸篓 · 删掉的东西都在这里" aria-label="纸篓">${icon("trash")}<i class="trash-n px" data-trash-n ${(state.trash || []).length ? "" : "hidden"}>${Math.min(99, (state.trash || []).length)}</i></button>`;

// ---------- 还原 ----------
function trashRestore(id) {
  const it = state.trash.find(x => x.id === id); if (!it) return;
  const pl = it.payload || {};
  if (pl.type === "ip") {
    const ip = normalizeIp({ ...copy(pl.ip), updatedAt: now() });
    if ((state.ips || []).some(x => x.id === ip.id)) ip.id = uid("ip");
    state.ips = [ip, ...(state.ips || [])];
    trashDrop(id); save(); toast(`「${ip.name || "IP"}」已还原到 IP 工作台`); if (route.view === "ip") renderIp();
    return true;
  }
  if (pl.type === "project") {
    const p = normalizeProject({ ...copy(pl.project), versions: [], updatedAt: now() });
    if (state.projects.some(x => x.id === p.id)) p.id = uid("p");
    state.projects.unshift(p);
    trashDrop(id); save(); toast(`「${p.title || "未命名项目"}」已还原到首页`); if (route.view === "home") renderHome();
    return true;
  }
  const p = state.projects.find(x => x.id === it.from?.pid);
  if (!p) { toast("原来的项目已经不在了，没法放回去", 3600, "err"); return false; }
  snapshot(p, "从纸篓还原前");
  if (pl.type === "shot" || (pl.type === "node" && pl.row)) {
    const row = shotRow(pl.row);
    if (!p.script.some(r => r.id === row.id)) p.script.splice(clamp(pl.index, 0, p.script.length), 0, row);
  }
  if (pl.type === "node") {
    const n = copy(pl.node);
    if (p.canvas.nodes.some(x => x.id === n.id)) n.id = uid("node");
    if (n.type !== "cut" || !nodeByType(p, "cut")) p.canvas.nodes.push(n);
    const ids = new Set(p.canvas.nodes.map(x => x.id));
    (pl.edges || []).forEach(e => { if (ids.has(e.from) && ids.has(e.to) && !p.canvas.edges.some(x => x.id === e.id)) p.canvas.edges.push(e); });
    if (pl.row) (pl.videos || []).forEach(vid => { const v = nodeOf(p, vid); if (v && !v.data.shotId) v.data.shotId = pl.row.id; });
  }
  ensureStructure(p); touch(p); trashDrop(id);
  toast(`已放回「${p.title || "未命名项目"}」`);
  if (route.view === "project" && route.projectId === p.id) renderProject();
  return true;
}
function trashDrop(id) { state.trash = state.trash.filter(x => x.id !== id); TR.bodies = TR.bodies.filter(b => b.id !== id); if (TR.queue) TR.queue = TR.queue.filter(x => x.id !== id); if (TR.sel === id) TR.sel = ""; trashBadge(); if (TR.open) trashRenderSide(); }

// ---------- 永久删除：顺带清掉没有任何地方再引用的本机素材文件 ----------
const assetUrls = v => [...new Set((JSON.stringify(v || "").match(/\/generated\/[^"'\s)\\?#]+/g) || []))];
async function trashPurge(ids) {
  const kill = state.trash.filter(x => ids.includes(x.id)); if (!kill.length) return;
  const keepTrash = state.trash.filter(x => !ids.includes(x.id));
  const used = new Set(assetUrls({ p: state.projects, a: state.accounts, s: state.styles, t: keepTrash, pet: state.pet, ip: state.ips }));
  const files = assetUrls(kill).filter(u => !used.has(u));
  state.trash = keepTrash; TR.bodies = TR.bodies.filter(b => !ids.includes(b.id)); if (TR.queue) TR.queue = TR.queue.filter(x => !ids.includes(x.id)); if (ids.includes(TR.sel)) TR.sel = "";
  save(); trashBadge(); if (TR.open) trashRenderSide();
  let removed = 0;
  if (files.length) { try { removed = (await postJson("/api/trash/purge", { files })).removed || 0; } catch (e) { toast(`记录已删除，但素材文件没有清理掉：${e.message}`, 4200, "err"); return; } }
  toast(`已永久删除 ${kill.length} 件${removed ? `，清理了 ${removed} 个浏览器里的素材` : ""}`, 3200);
}

// ---------- 像素精灵：纸团 / 磁带 / 光盘 / 胶片 ----------
function trashSprite(kind, seed = 0) {
  const shape = TRASH_SHAPE[kind] || "纸团"; const key = `${shape}:${seed % 4}`;
  if (TR.sprites.has(key)) return TR.sprites.get(key);
  const N = 16; const c = document.createElement("canvas"); c.width = N; c.height = N; const g = c.getContext("2d");
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  let h = 2166136261 ^ (seed * 16777619); const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  if (shape === "纸团") {
    const bumps = Array.from({ length: 8 }, () => 5.6 + rnd() * 1.6);
    const inside = (x, y) => { const dx = x - 7.5, dy = y - 7.5; const a = (Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2) * 8; const i = Math.floor(a) % 8, j = (i + 1) % 8, t = a - Math.floor(a); return Math.hypot(dx, dy) <= bumps[i] * (1 - t) + bumps[j] * t; };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      const shade = x + y > 18 ? "#D6D0C2" : "#F4F0E6";
      px(x, y, edge ? "#1A1A1A" : shade);
    }
    for (let k = 0; k < 5; k++) { let x = 4 + Math.floor(rnd() * 8), y = 4 + Math.floor(rnd() * 8); const dx = rnd() < .5 ? 1 : -1, dy = rnd() < .5 ? 1 : 0; for (let s = 0; s < 3; s++) { if (inside(x, y) && inside(x + 1, y) && inside(x - 1, y)) px(x, y, "#B3AC9C"); x += dx; y += dy || (rnd() < .5 ? 1 : -1); } }
    px(5, 4, "#FFFFFF"); px(6, 4, "#FFFFFF"); px(4, 5, "#FFFFFF");
    if (kind === "project") { px(9, 9, "#FFD23F"); px(10, 9, "#FFD23F"); px(9, 10, "#FFD23F"); px(10, 10, "#FFD23F"); }
  } else if (shape === "磁带") {
    for (let y = 2; y <= 13; y++) for (let x = 0; x < N; x++) px(x, y, y === 2 || y === 13 || x === 0 || x === 15 ? "#1A1A1A" : "#2C2C30");
    for (let x = 2; x <= 13; x++) for (let y = 3; y <= 6; y++) px(x, y, y === 3 || y === 6 || x === 2 || x === 13 ? "#C9567E" : "#FF7EB0");
    for (let x = 4; x <= 11; x++) px(x, 4, "#FFE4EE");
    [[4, 9], [11, 9]].forEach(([cx, cy]) => { for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) { const d = Math.abs(x) + Math.abs(y); if (d <= 3) px(cx + x, cy + y, d <= 1 ? "#F4F4F2" : "#6A6A70"); } px(cx, cy, "#1A1A1A"); });
    for (let x = 6; x <= 9; x++) px(x, 9, "#3D2A1E");
    for (let x = 4; x <= 11; x++) px(x, 12, "#55555C");
  } else if (shape === "光盘") {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x - 7.5, dy = y - 7.5, d = Math.hypot(dx, dy); if (d > 7.6) continue;
      if (d < 1.4) continue;
      const a = Math.atan2(dy, dx);
      let col = d > 6.9 ? "#1A1A1A" : d < 2.6 ? (d < 2 ? "#1A1A1A" : "#E8E8EA") : "#C7CCD6";
      if (d >= 2.6 && d <= 6.9) { const s = Math.sin(a * 2 + 1); col = s > .78 ? "#9FD2FF" : s < -.82 ? "#FF9CC2" : Math.sin(a * 2 - .5) > .9 ? "#FFE57A" : d > 5.8 ? "#9FE8C2" : col; }
      px(x, y, col);
    }
    px(4, 4, "#FFFFFF"); px(5, 3, "#FFFFFF");
  } else {
    for (let y = 3; y <= 12; y++) for (let x = 0; x < N; x++) {
      let col = y === 3 || y === 12 ? "#1A1A1A" : "#2A2018";
      if ((y === 4 || y === 11) && x % 3 === 1) col = "#F4F0E6";
      if (y >= 6 && y <= 9 && x >= 1 && x <= 14) col = x === 5 || x === 10 ? "#2A2018" : x < 5 ? "#FF9F43" : x < 10 ? "#FFC88A" : "#FF9F43";
      if (y === 6 && x >= 1 && x <= 14 && x !== 5 && x !== 10 && rnd() < .3) col = "#FFE8C8";
      px(x, y, col);
    }
  }
  TR.sprites.set(key, c); return c;
}
const trashIcon = (kind, seed) => `<img class="tr-ico" src="${trashSprite(kind, seed).toDataURL()}" alt="">`;
const seedOf = id => { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

// ---------- 物理 ----------
function trashBinGeom() {
  const cv = $(".tr-cv"); if (!cv) return null;
  const W = cv.width / TR.dpr, H = cv.height / TR.dpr;
  const bw = Math.min(360, W * .7), bh = Math.min(380, H * .74);
  const top = H - bh - 40, cx = W / 2;
  return { W, H, cx, top, bottom: top + bh, half: bw / 2, taper: bw * .09, rimH: 14 };
}
function wallX(g, y, side) { const t = clamp((y - g.top) / (g.bottom - g.top), 0, 1); const hw = g.half - g.taper * t; return side < 0 ? g.cx - hw + 10 : g.cx + hw - 10; }
// 打开纸篓时，东西一件件从上面掉进篓子里
function trashSpawn(items) { TR.queue = items.slice(); TR.total = items.length; TR.qT = 0; }
function trashSpawnOne(it) {
  const g = trashBinGeom(); if (!g || TR.bodies.some(b => b.id === it.id)) return;
  const n = Math.max(TR.total || 1, TR.bodies.length + 1); const r = clamp(31 * Math.sqrt(Math.min(1, 24 / n)), 12, 31);
  TR.bodies.push({ id: it.id, kind: it.kind, seed: seedOf(it.id), x: g.cx + (Math.random() - .5) * g.half * 1.2, y: g.top - 80 - Math.random() * 60, vx: (Math.random() - .5) * 120, vy: 200 + Math.random() * 200, a: Math.random() * 6.28, va: (Math.random() - .5) * 8, r: r * (TRASH_SHAPE[it.kind] === "纸团" ? .92 : 1) });
}
function trashStep(dt) {
  const g = trashBinGeom(); if (!g) return;
  const bin = TR.bin; const S = 3; const h = dt / S;
  // 篓子的加速度：篓子往右猛动，里面的东西相对往左甩
  const ax = (bin.vx - bin.pvx) / Math.max(1e-3, dt), ay = (bin.vy - bin.pvy) / Math.max(1e-3, dt); bin.pvx = bin.vx; bin.pvy = bin.vy;
  for (let s = 0; s < S; s++) {
    for (const b of TR.bodies) {
      if (TR.grab?.id === b.id) continue;
      b.vy += (1700 - clamp(ay, -9000, 9000) * .9) * h; b.vx += -clamp(ax, -9000, 9000) * .9 * h;
      b.vx *= .999; b.x += b.vx * h; b.y += b.vy * h; b.a += b.va * h; b.va *= .995;
      const L = wallX(g, b.y, -1), Rr = wallX(g, b.y, 1);
      if (b.x - b.r < L) { b.x = L + b.r; b.vx = Math.abs(b.vx) * .42; b.va += b.vy * .004; }
      if (b.x + b.r > Rr) { b.x = Rr - b.r; b.vx = -Math.abs(b.vx) * .42; b.va -= b.vy * .004; }
      const floor = g.bottom - 14;
      if (b.y + b.r > floor) { b.y = floor - b.r; if (b.vy > 0) b.vy = -b.vy * .3; b.vx *= .9; b.va = b.va * .6 + (b.vx / b.r) * .4; }
      const ceil = g.top - 220; if (b.y - b.r < ceil) { b.y = ceil + b.r; b.vy = Math.abs(b.vy) * .3; }
    }
    const n = TR.bodies.length;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const A = TR.bodies[i], B = TR.bodies[j]; const dx = B.x - A.x, dy = B.y - A.y; const rr = A.r + B.r; const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = (rr - d) / 2;
      const ga = TR.grab?.id === A.id, gb = TR.grab?.id === B.id;
      if (!ga) { A.x -= nx * ov * (gb ? 2 : 1); A.y -= ny * ov * (gb ? 2 : 1); }
      if (!gb) { B.x += nx * ov * (ga ? 2 : 1); B.y += ny * ov * (ga ? 2 : 1); }
      const rv = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
      if (rv < 0) { const imp = -(1.25) * rv / 2; if (!ga) { A.vx -= imp * nx; A.vy -= imp * ny; } if (!gb) { B.vx += imp * nx; B.vy += imp * ny; } const tv = (B.vx - A.vx) * -ny + (B.vy - A.vy) * nx; A.va += tv * .006; B.va -= tv * .006; }
    }
  }
}
function trashFrame(t) {
  if (!TR.open) return;
  TR.raf = requestAnimationFrame(trashFrame);
  const cv = $(".tr-cv"); if (!cv) return;
  const dt = Math.min(.034, (t - (TR.lastT || t)) / 1000 || .016); TR.lastT = t;
  const bin = TR.bin;
  if (TR.queue?.length && t - (TR.qT || 0) > (TR.total > 40 ? 22 : 55)) { TR.qT = t; trashSpawnOne(TR.queue.shift()); if (TR.queue.length && TR.total > 60) trashSpawnOne(TR.queue.shift()); }
  // 摇一摇 / 松手后弹回原位
  if (bin.shake > 0) { bin.shake -= dt; const k = bin.shake / bin.shakeDur; const ox = Math.sin((1 - k) * 34) * 30 * k, oy = Math.abs(Math.cos((1 - k) * 34)) * -12 * k; bin.vx = (ox - bin.ox) / dt; bin.vy = (oy - bin.oy) / dt; bin.ox = ox; bin.oy = oy; bin.rot = Math.sin((1 - k) * 34) * .05 * k; }
  else if (!bin.drag) { const fx = -bin.ox * 120 - bin.vx * 14, fy = -bin.oy * 120 - bin.vy * 14; bin.vx += fx * dt; bin.vy += fy * dt; bin.ox += bin.vx * dt; bin.oy += bin.vy * dt; bin.rot *= .9; if (Math.abs(bin.ox) + Math.abs(bin.oy) < .2 && Math.abs(bin.vx) + Math.abs(bin.vy) < 2) { bin.ox = bin.oy = bin.vx = bin.vy = 0; } }
  trashStep(dt);
  const g = trashBinGeom(); const ctx = cv.getContext("2d"); const d = TR.dpr;
  ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, g.W, g.H); ctx.imageSmoothingEnabled = false;
  ctx.save(); ctx.translate(bin.ox + g.cx, bin.oy + g.bottom); ctx.rotate(bin.rot); ctx.translate(-g.cx, -g.bottom);
  // 地上的影子
  ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.fillRect(g.cx - g.half + g.taper - 6, g.bottom + 2, (g.half - g.taper) * 2 + 12, 8);
  // 后壁
  const poly = (y0, y1, inset) => { ctx.beginPath(); ctx.moveTo(wallX(g, y0, -1) - 10 + inset, y0); ctx.lineTo(wallX(g, y0, 1) + 10 - inset, y0); ctx.lineTo(wallX(g, y1, 1) + 10 - inset, y1); ctx.lineTo(wallX(g, y1, -1) - 10 + inset, y1); ctx.closePath(); };
  poly(g.top, g.bottom, 0); ctx.fillStyle = "#17181B"; ctx.fill();
  ctx.fillStyle = "#24262B"; for (let y = g.top + 10; y < g.bottom - 8; y += 14) { ctx.fillRect(wallX(g, y, -1) - 4, y, wallX(g, y, 1) - wallX(g, y, -1) + 8, 2); }
  // 里面的东西
  for (const b of TR.bodies) {
    const spr = trashSprite(b.kind, b.seed); const s = b.r * 2 / 16 * (TRASH_SHAPE[b.kind] === "胶片" || TRASH_SHAPE[b.kind] === "磁带" ? 1.2 : 1.1);
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.scale(s, s);
    if (b.id === TR.sel) { ctx.fillStyle = "#FFD23F"; ctx.fillRect(-9.5, -9.5, 19, 19); ctx.fillStyle = "#17181B"; ctx.fillRect(-8.5, -8.5, 17, 17); }
    ctx.drawImage(spr, -8, -8); ctx.restore();
  }
  // 前面的铁丝网（看得见里面）
  ctx.fillStyle = "rgba(200,206,214,.55)";
  for (let y = g.top + 18; y < g.bottom - 8; y += 16) { const l = wallX(g, y, -1) - 10, r = wallX(g, y, 1) + 10; ctx.fillRect(l, y, r - l, 2); }
  for (let k = 0; k <= 12; k++) { const t0 = k / 12; for (let y = g.top + 14; y < g.bottom - 8; y += 2) { const l = wallX(g, y, -1) - 10, r = wallX(g, y, 1) + 10; ctx.fillRect(Math.round(l + (r - l) * t0), y, 2, 2); } }
  // 两侧外壁、篓口、底座
  ctx.fillStyle = "#AEB4BC"; for (let y = g.top; y < g.bottom; y += 2) { ctx.fillRect(wallX(g, y, -1) - 12, y, 4, 2); ctx.fillRect(wallX(g, y, 1) + 8, y, 4, 2); }
  ctx.fillStyle = "#DADFE5"; ctx.fillRect(g.cx - g.half - 6, g.top - 6, g.half * 2 + 12, g.rimH); ctx.fillStyle = "#8C939C"; ctx.fillRect(g.cx - g.half - 6, g.top - 6 + g.rimH - 3, g.half * 2 + 12, 3); ctx.fillStyle = "#FFFFFF"; ctx.fillRect(g.cx - g.half, g.top - 4, 40, 2);
  ctx.fillStyle = "#8C939C"; const bl = wallX(g, g.bottom, -1) - 12, br = wallX(g, g.bottom, 1) + 12; ctx.fillRect(bl, g.bottom - 10, br - bl, 10); ctx.fillStyle = "#AEB4BC"; ctx.fillRect(bl, g.bottom - 10, br - bl, 3);
  ctx.restore();
  if (!TR.bodies.length) { ctx.fillStyle = "rgba(237,237,237,.5)"; ctx.font = `14px "Fusion Pixel", monospace`; ctx.textAlign = "center"; ctx.fillText("纸篓是空的", g.cx + bin.ox, g.top + (g.bottom - g.top) / 2); }
}
function trashLocal(ev) { const cv = $(".tr-cv"); const r = cv.getBoundingClientRect(); return { x: ev.clientX - r.left - TR.bin.ox, y: ev.clientY - r.top - TR.bin.oy }; }
function trashBodyAt(x, y) { for (let i = TR.bodies.length - 1; i >= 0; i--) { const b = TR.bodies[i]; if (Math.hypot(b.x - x, b.y - y) <= b.r + 3) return b; } return null; }
function trashPointerDown(ev) {
  if (ev.button !== 0) return;
  const cv = $(".tr-cv"); const p = trashLocal(ev); const g = trashBinGeom();
  const b = trashBodyAt(p.x, p.y);
  if (b) {
    const st = { x: ev.clientX, y: ev.clientY, moved: false, lx: p.x, ly: p.y, lt: performance.now() };
    const move = e => { const q = trashLocal(e); if (!st.moved && Math.abs(e.clientX - st.x) + Math.abs(e.clientY - st.y) < 5) return; st.moved = true; TR.grab = { id: b.id }; const t = performance.now(); const dt = Math.max(8, t - st.lt) / 1000; b.vx = (q.x - st.lx) / dt; b.vy = (q.y - st.ly) / dt; b.x = q.x; b.y = q.y; st.lx = q.x; st.ly = q.y; st.lt = t; cv.classList.add("grabbing"); };
    const up = () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); cv.classList.remove("grabbing"); if (st.moved) { b.vx = clamp(b.vx, -2400, 2400); b.vy = clamp(b.vy, -2400, 2400); b.va = b.vx / 60; TR.grab = null; } else trashSelect(b.id, true); };
    document.addEventListener("pointermove", move); document.addEventListener("pointerup", up);
    return;
  }
  const inBin = p.y > g.top - 30 && p.y < g.bottom + 10 && p.x > g.cx - g.half - 20 && p.x < g.cx + g.half + 20;
  if (!inBin) return;
  // 拖着篓子晃
  const bin = TR.bin; bin.drag = true; bin.shake = 0; const st = { x: ev.clientX, y: ev.clientY, ox: bin.ox, oy: bin.oy, t: performance.now() }; cv.classList.add("grabbing");
  const move = e => { const t = performance.now(); const dt = Math.max(8, t - st.t) / 1000; const nx = clamp(st.ox + e.clientX - st.x, -g.W / 2 + g.half, g.W / 2 - g.half), ny = clamp(st.oy + e.clientY - st.y, -g.top + 30, 40); bin.vx = (nx - bin.ox) / dt; bin.vy = (ny - bin.oy) / dt; bin.ox = nx; bin.oy = ny; bin.rot = clamp(bin.vx / 6000, -.08, .08); st.t = t; };
  const up = () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); bin.drag = false; cv.classList.remove("grabbing"); };
  document.addEventListener("pointermove", move); document.addEventListener("pointerup", up);
}
function trashShake() { const bin = TR.bin; bin.shake = bin.shakeDur = .95; TR.bodies.forEach(b => { b.vy -= 300 + Math.random() * 500; b.vx += (Math.random() - .5) * 500; b.va += (Math.random() - .5) * 14; }); }

// ---------- 面板 ----------
function trashList() { return (state.trash || []).filter(x => TR.filter === "all" || x.kind === TR.filter || (TR.filter === "text" && x.kind === "project")); }
function trashCard(it) {
  if (!it) return `<div class="tr-card empty"><span class="px faint">点篓子里的东西，或者下面的列表，看看它是什么。按住篓子拖动，或者点「摇一摇」。</span></div>`;
  const media = it.kind === "image" && it.preview ? `<img src="${attr(it.preview)}" alt="">` : it.kind === "video" && it.preview ? `<video src="${attr(it.preview)}" muted playsinline preload="metadata" controls></video>` : it.kind === "audio" && it.preview ? `<audio src="${attr(it.preview)}" controls preload="metadata"></audio>` : `<p class="tr-text">${esc(it.preview || "（没有内容）")}</p>`;
  return `<div class="tr-card"><div class="tr-card-h">${trashIcon(it.kind, seedOf(it.id))}<div><b>${esc(it.name)}</b><span class="px faint">${TRASH_KIND[it.kind] || "素材"} · ${TRASH_SHAPE[it.kind]}　${it.kind === "project" ? "" : `来自「${esc(it.from?.title || "")}」`}　${when(it.deletedAt)}删除</span></div></div>
    <div class="tr-prev">${media}</div>
    <div class="tr-acts"><button class="btn primary sm" data-act="trash-restore" data-id="${attr(it.id)}">还原</button><button class="btn line sm danger" data-act="trash-kill" data-id="${attr(it.id)}">永久删除</button></div></div>`;
}
function trashRenderSide() {
  const side = $(".tr-side"); if (!side) return;
  const list = trashList(); const all = state.trash || [];
  const it = all.find(x => x.id === TR.sel);
  const counts = k => all.filter(x => x.kind === k || (k === "text" && x.kind === "project")).length;
  side.innerHTML = `${trashCard(it)}
    <nav class="seg tr-filter">${[["all", "全部"], ["text", "纸团"], ["image", "胶片"], ["video", "光盘"], ["audio", "磁带"]].map(([k, l]) => `<button class="${TR.filter === k ? "on" : ""}" data-act="trash-filter" data-k="${k}">${l}<span class="px faint">${k === "all" ? all.length : counts(k)}</span></button>`).join("")}</nav>
    <div class="tr-list">${list.length ? list.map(x => `<button class="tr-row ${x.id === TR.sel ? "on" : ""}" data-act="trash-pick" data-id="${attr(x.id)}">${trashIcon(x.kind, seedOf(x.id))}<span class="t">${esc(x.name)}</span><span class="px faint">${esc(x.kind === "project" ? "项目" : x.from?.title || "")}</span><span class="px faint">${when(x.deletedAt)}</span></button>`).join("") : `<p class="empty-line">${all.length ? "这一类里没有东西" : "纸篓是空的。删掉的节点、镜头和项目会先来这里，随时可以还原。"}</p>`}</div>
    <div class="tr-foot"><span class="px faint">最多保留 ${TRASH_MAX} 件，更早的会自动丢掉</span><button class="btn line sm danger" data-act="trash-purge" ${all.length ? "" : "disabled"}>${TR.confirm ? `再点一次，永久清理 ${all.length} 件` : "永久清理"}</button></div>`;
}
function trashSelect(id, fromBin = false) {
  TR.sel = TR.sel === id && fromBin ? "" : id; trashRenderSide();
  const b = TR.bodies.find(x => x.id === id); if (b && !fromBin) { b.vy -= 520; b.va += 6; }
  $(".tr-row.on")?.scrollIntoView({ block: "nearest" });
}
function openTrash() {
  if (TR.open) return; petCloseWheel?.();
  TR.open = true; TR.sel = ""; TR.bodies = []; TR.confirm = 0; TR.bin = { ox: 0, oy: 0, vx: 0, vy: 0, pvx: 0, pvy: 0, rot: 0, shake: 0, shakeDur: 1, drag: false };
  const el = document.createElement("div"); el.className = "tr"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "纸篓");
  el.innerHTML = `<header class="tr-top"><span class="px">纸篓</span><span class="px faint">删除的东西先放这里　·　纸团是文本，胶片是图片，光盘是视频，磁带是音频</span><span class="grow"></span><button class="btn line sm" data-act="trash-shake">${icon("spark")}摇一摇</button><button class="btn quiet sm" data-act="trash-close">${icon("x")}关闭</button></header>
    <div class="tr-main"><div class="tr-stage"><canvas class="tr-cv" aria-label="纸篓，按住拖动可以摇晃"></canvas></div><aside class="tr-side"></aside></div>`;
  document.body.appendChild(el);
  el.addEventListener("pointerdown", ev => ev.stopPropagation());
  const cv = $(".tr-cv", el); cv.addEventListener("pointerdown", trashPointerDown);
  cv.addEventListener("pointermove", ev => { if (TR.grab || TR.bin.drag) return; const p = trashLocal(ev); cv.classList.toggle("can", Boolean(trashBodyAt(p.x, p.y))); });
  trashResize(); window.addEventListener("resize", trashResize);
  trashRenderSide();
  trashSpawn((state.trash || []).slice(0, TRASH_MAX).reverse());
  EXT_ESC.push(trashEscape);
  requestAnimationFrame(() => el.classList.add("in"));
  TR.lastT = 0; TR.raf = requestAnimationFrame(trashFrame);
}
function trashResize() {
  const cv = $(".tr-cv"); const st = $(".tr-stage"); if (!cv || !st) return;
  const r = st.getBoundingClientRect(); TR.dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(r.width * TR.dpr); cv.height = Math.round(r.height * TR.dpr); cv.style.width = `${r.width}px`; cv.style.height = `${r.height}px`;
}
function trashEscape() { if (TR.sel) { TR.sel = ""; trashRenderSide(); return; } closeTrash(); }
function closeTrash() {
  if (!TR.open) return; TR.open = false; cancelAnimationFrame(TR.raf); window.removeEventListener("resize", trashResize);
  const i = EXT_ESC.indexOf(trashEscape); if (i >= 0) EXT_ESC.splice(i, 1);
  const el = $(".tr"); if (el) { if (reduceMotion()) el.remove(); else { el.classList.remove("in"); el.classList.add("out"); setTimeout(() => el.remove(), 200); } }
  trashBadge();
}
Object.assign(EXT_ACTS, {
  "trash-open": () => openTrash(),
  "trash-close": () => closeTrash(),
  "trash-shake": () => trashShake(),
  "trash-filter": el => { TR.filter = el.dataset.k; trashRenderSide(); },
  "trash-pick": el => trashSelect(el.dataset.id),
  "trash-restore": el => { const id = el.dataset.id; const b = TR.bodies.find(x => x.id === id); if (b) { b.vy = -1600; b.vx = (Math.random() - .5) * 200; } setTimeout(() => trashRestore(id), b ? 260 : 0); },
  "trash-kill": el => trashPurge([el.dataset.id]),
  "trash-purge": () => {
    if (!TR.confirm) { TR.confirm = 1; trashRenderSide(); clearTimeout(TR.confirmT); TR.confirmT = setTimeout(() => { TR.confirm = 0; if (TR.open) trashRenderSide(); }, 3500); return; }
    TR.confirm = 0; clearTimeout(TR.confirmT); trashShake(); setTimeout(() => trashPurge((state.trash || []).map(x => x.id)), 500);
  }
});
