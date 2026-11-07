"use strict";
// 帧比特 3.3 · 启动动画 + 首页大屏循环背景
// 启动画面和首页大屏共用同一套“像素格”状态，所以动画能从启动无缝延续到首页。

const FX = {
  cells: new Map(),       // "c,r" -> { born, life, pat: 25 位, green: 下标 | -1 }
  cursor: null,           // 光标块：{ c, r, pc, pr, t0 } 在网格交点间跳
  trail: [],              // 光标轨迹 { c0, r0, c1, r1, t }
  t0: performance.now(),
  nextSpawn: 0, nextHop: 0, hover: null,
  G: 120, SUB: 24         // 与首页 CSS 网格一致：120px 大格，5×5 像素
};
const fxNow = () => (performance.now() - FX.t0) / 1000;
const fxRand = (a, b) => a + Math.random() * (b - a);
const fxColor = () => {
  const cs = getComputedStyle(document.documentElement);
  const light = document.documentElement.dataset.theme === "light";
  return { ink: cs.getPropertyValue("--text").trim() || "#EDEDED", mark: (light ? cs.getPropertyValue("--mark-strong").trim() : "") || cs.getPropertyValue("--mark").trim() || "#C7DEC4", grid: cs.getPropertyValue("--grid").trim() || "#121212", bg: cs.getPropertyValue("--bg").trim() || "#000", light: document.documentElement.dataset.theme === "light" };
};

// 5×5 图案：对称的小像素图（像素精灵）、取景框、抖动、扫描条
function fxPattern() {
  const k = Math.random(); const p = new Array(25).fill(0);
  if (k < .5) { for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) { const on = Math.random() < .5 ? 1 : 0; p[r * 5 + c] = on; p[r * 5 + 4 - c] = on; } }
  else if (k < .68) { for (let i = 0; i < 25; i++) { const r = Math.floor(i / 5), c = i % 5; p[i] = (r === 0 || r === 4 || c === 0 || c === 4) && !((r === 0 || r === 4) && (c === 2)) ? 1 : 0; } }
  else if (k < .86) { const d = fxRand(.25, .6); for (let i = 0; i < 25; i++) p[i] = ((Math.floor(i / 5) + i % 5) % 2 === 0 && Math.random() < d + .3) ? 1 : 0; }
  else { const row = Math.floor(fxRand(0, 5)); for (let c = 0; c < 5; c++) { p[row * 5 + c] = 1; if (row + 2 < 5) p[(row + 2) * 5 + c] = Math.random() < .6 ? 1 : 0; } }
  if (!p.some(Boolean)) p[12] = 1;
  return p;
}
function fxSpawn(t, b, near = null) {
  let c, r;
  if (near) { c = near.c; r = near.r; }
  else { // 偏向右侧，避开左边的标题和输入框
    const bias = Math.random() < .72; c = Math.floor(bias ? fxRand(Math.max(b.c0, b.c0 + (b.c1 - b.c0) * .55), b.c1) : fxRand(b.c0, b.c1)); r = Math.floor(fxRand(b.r0, b.r1));
  }
  const key = `${c},${r}`; if (FX.cells.has(key) && !near) return;
  const old = FX.cells.get(key);
  if (old && near) { old.born = Math.min(old.born, t - .6); old.life = Math.max(old.life, t - old.born + 1.2); return; }
  const pat = fxPattern(); const on = pat.map((v, i) => v ? i : -1).filter(i => i >= 0);
  FX.cells.set(key, { c, r, born: t, life: near ? 1.6 : fxRand(2.4, 5), pat, green: Math.random() < .35 ? on[Math.floor(Math.random() * on.length)] : -1, order: [...Array(25).keys()].sort(() => Math.random() - .5), faint: !!near });
}
function fxStep(t, b) {
  if (t > FX.nextSpawn) { fxSpawn(t, b); FX.nextSpawn = t + fxRand(.55, 1.15); }
  for (const [k, c] of FX.cells) if (t - c.born > c.life + .8) FX.cells.delete(k);
  // 光标在交点间跳
  if (!FX.cursor) FX.cursor = { c: Math.floor((b.c0 + b.c1) * .7), r: Math.floor((b.r0 + b.r1) / 2), pc: 0, pr: 0, t0: t };
  if (t > FX.nextHop) {
    const cu = FX.cursor; const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dc, dr]) => cu.c + dc >= b.c0 + 1 && cu.c + dc <= b.c1 && cu.r + dr >= b.r0 + 1 && cu.r + dr <= b.r1 - 1);
    const [dc, dr] = dirs[Math.floor(Math.random() * dirs.length)] || [0, 0];
    FX.trail.push({ c0: cu.c, r0: cu.r, c1: cu.c + dc, r1: cu.r + dr, t });
    Object.assign(cu, { pc: cu.c, pr: cu.r, c: cu.c + dc, r: cu.r + dr, t0: t });
    // 落点旁边的一格轻轻亮起
    if (Math.random() < .55) fxSpawn(t, b, { c: cu.c - (Math.random() < .5 ? 1 : 0), r: cu.r - (Math.random() < .5 ? 1 : 0) });
    FX.nextHop = t + fxRand(.75, 1.25);
  }
  FX.trail = FX.trail.filter(s => t - s.t < 2.4);
}
const easeIO = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

// 画一层：ox/oy 是网格原点在这块画布里的坐标
function fxDraw(ctx, t, ox, oy, w, h, col, { alpha = 1, tc = true } = {}) {
  const G = FX.G, S = FX.SUB, A = col.light ? .09 : .11;
  for (const c of FX.cells.values()) {
    const x = ox + c.c * G, y = oy + c.r * G; if (x > w || y > h || x + G < 0 || y + G < 0) continue;
    const age = t - c.born; const out = age - c.life;
    const shown = out > 0 ? Math.max(0, 25 - Math.floor(out / .7 * 25)) : 25;
    const vis = new Set(c.order.slice(0, shown));
    for (let i = 0; i < 25; i++) {
      if (!c.pat[i] || !vis.has(i)) continue;
      const row = Math.floor(i / 5); if (age < row * .08) continue; // 逐行扫出来
      const green = i === c.green;
      ctx.globalAlpha = alpha * (green ? (col.light ? .55 : .42) : A * (c.faint ? .6 : 1));
      ctx.fillStyle = green ? col.mark : col.ink;
      ctx.fillRect(x + (i % 5) * S + 1, y + row * S + 1, S - 2, S - 2);
    }
  }
  // 悬停的格子
  if (FX.hover) { const x = ox + FX.hover.c * G, y = oy + FX.hover.r * G; ctx.globalAlpha = alpha * (col.light ? .05 : .045); ctx.fillStyle = col.ink; ctx.fillRect(x + 1, y + 1, G - 1, G - 1); }
  // 光标轨迹与光标
  ctx.lineWidth = 1;
  for (const s of FX.trail) { const k = (t - s.t) / 2.4; ctx.globalAlpha = alpha * (1 - k) * .5; ctx.strokeStyle = col.mark; ctx.beginPath(); ctx.moveTo(ox + s.c0 * G + .5, oy + s.r0 * G + .5); ctx.lineTo(ox + s.c1 * G + .5, oy + s.r1 * G + .5); ctx.stroke(); }
  if (FX.cursor) {
    const cu = FX.cursor; const k = easeIO(Math.min(1, (t - cu.t0) / .42)); const hop = Math.sin(Math.PI * k) * 10;
    const cx = ox + (cu.pc + (cu.c - cu.pc) * k) * G, cy = oy + (cu.pr + (cu.r - cu.pr) * k) * G - hop;
    const sq = k < 1 ? 12 : 12 + Math.max(0, 1 - (t - cu.t0 - .42) / .2) * 2;
    ctx.globalAlpha = alpha; ctx.fillStyle = col.mark; ctx.fillRect(Math.round(cx - sq / 2), Math.round(cy - sq / 2), sq, sq);
  }
  // 扫描线：每 9 秒扫一次
  const sp = (t % 9) / 2.2; if (sp < 1) { const y = sp * h; const g = ctx.createLinearGradient(0, y - 80, 0, y); g.addColorStop(0, col.light ? "rgba(79,122,74,0)" : "rgba(199,222,196,0)"); g.addColorStop(1, col.light ? "rgba(79,122,74,.05)" : "rgba(199,222,196,.035)"); ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.fillRect(0, y - 80, w, 80); ctx.fillStyle = col.light ? "rgba(79,122,74,.18)" : "rgba(199,222,196,.12)"; ctx.fillRect(0, Math.round(y), w, 1); }
  // 帧计数
  if (tc) {
    const f = Math.floor(t * 24); const hh = n => String(n).padStart(2, "0");
    const txt = `FRAME ${String(f).padStart(6, "0")}  ·  ${hh(Math.floor(t / 3600))}:${hh(Math.floor(t / 60) % 60)}:${hh(Math.floor(t) % 60)}:${hh(f % 24)}`;
    ctx.globalAlpha = alpha * (col.light ? .55 : .45); ctx.fillStyle = col.ink; ctx.font = '12px "Fusion Pixel", monospace'; ctx.textBaseline = "alphabetic"; ctx.textAlign = "right";
    ctx.fillText(txt, w - 24, h - 20); ctx.textAlign = "left";
  }
  ctx.globalAlpha = 1;
}

// ---------- 首页大屏：挂到 .home 上，绘制在标题区背后 ----------
function heroFx(home) {
  const hero = home?.querySelector(".home-hero"); if (!hero) return;
  home.querySelector(".hero-fx")?.remove();
  const cv = document.createElement("canvas"); cv.className = "hero-fx"; cv.setAttribute("aria-hidden", "true"); home.prepend(cv);
  const ctx = cv.getContext("2d"); let last = 0, col = fxColor(), raf = 0;
  const fit = () => { const dpr = devicePixelRatio || 1; const r = hero.getBoundingClientRect(); cv.style.height = `${hero.offsetHeight}px`; cv.width = Math.round(home.clientWidth * dpr); cv.height = Math.round(hero.offsetHeight * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); col = fxColor(); return r; };
  fit();
  const bounds = () => ({ c0: 0, c1: Math.ceil(home.clientWidth / FX.G), r0: 0, r1: Math.ceil(hero.offsetHeight / FX.G) });
  hero.addEventListener("pointermove", e => { const r = home.getBoundingClientRect(); const c = Math.floor((e.clientX - r.left) / FX.G), rr = Math.floor((e.clientY - r.top + 1) / FX.G); if (!FX.hover || FX.hover.c !== c || FX.hover.r !== rr) { FX.hover = { c, r: rr }; if (Math.random() < .3 && !e.target.closest(".composer")) fxSpawn(fxNow(), bounds(), { c, r: rr }); } });
  hero.addEventListener("pointerleave", () => { FX.hover = null; });
  const ro = new ResizeObserver(fit); ro.observe(hero);
  const still = reduceMotion();
  const frame = now => {
    if (!cv.isConnected) { ro.disconnect(); cancelAnimationFrame(raf); return; }
    raf = requestAnimationFrame(frame);
    if (document.visibilityState === "hidden" || now - last < 33) return; last = now; // 约 30fps 足够
    const t = fxNow(); if (!still) fxStep(t, bounds());
    ctx.clearRect(0, 0, cv.width, cv.height);
    // 网格原点：.home 的边框盒左上角（CSS 背景从 -1px 开始）
    fxDraw(ctx, t, -1, -1, home.clientWidth, hero.offsetHeight, col);
    if (still) cancelAnimationFrame(raf);
  };
  if (still) { for (let i = 0; i < 6; i++) fxSpawn(fxNow() - 1, bounds()); }
  raf = requestAnimationFrame(frame);
  window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", () => { col = fxColor(); });
}

// ---------- 启动动画 ----------
const Splash = {
  el: null, cv: null, ctx: null, t0: 0, skip: false, raf: 0, blocks: [], done: null,
  start() {
    if (this.el) return this;
    const el = document.createElement("div"); el.className = "splash"; el.setAttribute("aria-hidden", "true");
    el.innerHTML = `<canvas></canvas><div class="sp-center"><div class="sp-logo"><i class="sp-mark"></i><i class="sp-cur"></i></div><div class="sp-words"><span class="sp-name">帧比特</span><span class="sp-en">FRAMEBIT</span></div></div><div class="sp-tc"></div><div class="sp-skip">点击跳过</div>`;
    document.body.appendChild(el); this.el = el; this.cv = el.querySelector("canvas"); this.ctx = this.cv.getContext("2d");
    this.t0 = performance.now(); FX.t0 = this.t0;
    const fit = () => { const dpr = devicePixelRatio || 1; this.cv.width = innerWidth * dpr; this.cv.height = innerHeight * dpr; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    fit(); addEventListener("resize", fit);
    // 拼出方块的 16 个像素块
    this.blocks = [...Array(16).keys()].map(i => ({ i, sx: fxRand(-.5, 1.5) * innerWidth, sy: fxRand(-.4, 1.4) * innerHeight, d: .14 + Math.random() * .38, rot: fxRand(-2, 2) }));
    const onSkip = () => { this.skip = true; };
    el.addEventListener("pointerdown", onSkip); addEventListener("keydown", onSkip, { once: true });
    if (reduceMotion()) this.skip = true;
    const loop = () => { if (!this.el) return; this.raf = requestAnimationFrame(loop); this.draw(); };
    this.raf = requestAnimationFrame(loop);
    return this;
  },
  t() { return (performance.now() - this.t0) / 1000; },
  origin() { // 与首页网格对齐的原点
    const home = document.querySelector(".home"); if (home) { const r = home.getBoundingClientRect(); return { x: r.left, y: r.top - 1 }; }
    return { x: 28, y: 59 };
  },
  draw() {
    const t = this.t(), c = this.ctx, w = innerWidth, h = innerHeight, col = fxColor();
    c.clearRect(0, 0, w, h);
    const o = this.origin(); const G = FX.G;
    // 1. 网格从中心铺开（0–0.7s），交接时淡成首页的网格色
    const R = easeIO(Math.min(1, t / .75)) * Math.hypot(w, h) * .62;
    c.strokeStyle = col.light ? "rgba(0,0,0,.09)" : "rgba(255,255,255,.075)"; c.lineWidth = 1;
    const cx = w / 2, cy = h / 2;
    for (let x = o.x % G; x <= w; x += G) { const span = Math.sqrt(Math.max(0, R * R - (x - cx) ** 2)); if (span > 0) { c.beginPath(); c.moveTo(Math.round(x) + .5, cy - span); c.lineTo(Math.round(x) + .5, cy + span); c.stroke(); } }
    for (let y = o.y % G; y <= h; y += G) { const span = Math.sqrt(Math.max(0, R * R - (y - cy) ** 2)); if (span > 0) { c.beginPath(); c.moveTo(cx - span, Math.round(y) + .5); c.lineTo(cx + span, Math.round(y) + .5); c.stroke(); } }
    // 2. 像素格：和首页共用状态
    const b = { c0: Math.floor(-o.x / G), c1: Math.ceil((w - o.x) / G), r0: Math.floor(-o.y / G), r1: Math.ceil((h - o.y) / G) };
    if (t > .35) fxStep(fxNow(), b);
    fxDraw(c, fxNow(), o.x, o.y, w, h, col, { alpha: Math.min(1, (t - .3) / .5), tc: false });
    // 3. 16 个像素块飞来拼成方块（.15–1.05s）
    const logo = this.el.querySelector(".sp-mark").getBoundingClientRect();
    if (!this.assembled) {
      let all = true;
      for (const bk of this.blocks) {
        const k = Math.min(1, Math.max(0, (t - .15 - bk.d) / .55)); if (k < 1) all = false;
        const e = 1 - Math.pow(1 - k, 4); const s = logo.width / 4;
        const tx = logo.left + (bk.i % 4) * s, ty = logo.top + Math.floor(bk.i / 4) * s;
        const x = bk.sx + (tx - bk.sx) * e, y = bk.sy + (ty - bk.sy) * e;
        c.save(); c.globalAlpha = Math.min(1, k * 3); c.translate(x + s / 2, y + s / 2); c.rotate(bk.rot * (1 - e)); c.fillStyle = col.ink; c.fillRect(-s / 2, -s / 2, s + .5, s + .5); c.restore();
      }
      if (all || this.skip) { this.assembled = true; this.el.classList.add("built"); }
    }
    // 4. 帧计数
    const f = Math.floor(t * 24); this.el.querySelector(".sp-tc").textContent = `FRAME ${String(f).padStart(6, "0")}  ·  00:00:${String(Math.floor(t)).padStart(2, "0")}:${String(f % 24).padStart(2, "0")}`;
    if (t > 1.1) this.el.classList.add("words");
  },
  // 等到动画至少播到 minT 秒，然后把方块和字标飞到顶栏，露出首页
  async handoff(minT = 2.05) {
    if (!this.el) return;
    while (!this.skip && this.t() < minT) await new Promise(r => setTimeout(r, 30));
    if (this.skip && !this.assembled) { this.assembled = true; this.el.classList.add("built", "words"); }
    const el = this.el; const fast = reduceMotion();
    const mark = el.querySelector(".sp-mark"), name = el.querySelector(".sp-name"), cur = el.querySelector(".sp-cur");
    const tMark = document.querySelector(".brand i"), tName = document.querySelector(".brand span");
    const fly = (src, dst, extra = "") => {
      if (!src || !dst) return; const a = src.getBoundingClientRect(), b = dst.getBoundingClientRect();
      const sx = b.width / a.width, sy = b.height / a.height;
      src.style.transformOrigin = "0 0"; src.style.transition = fast ? "none" : `transform .62s cubic-bezier(.7,0,.2,1)${extra}`;
      src.style.transform = `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${sx}, ${sy})`;
    };
    el.classList.add("leaving");
    fly(mark, tMark);
    if (name && tName) { // 文字按宽度等比缩放，竖直居中对齐
      const a = name.getBoundingClientRect(), b = tName.getBoundingClientRect(); const k = b.width / a.width;
      name.style.transformOrigin = "0 0"; name.style.transition = fast ? "none" : "transform .62s cubic-bezier(.7,0,.2,1)";
      name.style.transform = `translate(${b.left - a.left}px, ${b.top + b.height / 2 - (a.top + a.height * k / 2)}px) scale(${k})`;
    }
    if (cur && tMark) { const a = cur.getBoundingClientRect(), b = tMark.getBoundingClientRect(); cur.style.transition = fast ? "none" : "transform .62s cubic-bezier(.7,0,.2,1), opacity .3s .3s"; cur.style.transform = `translate(${b.right + 3 - a.left}px, ${b.bottom - 4 - a.top}px) scale(.33)`; cur.style.opacity = "0"; }
    // 首页内容在这里才开始入场（标题逐格打出、输入框浮起）
    window.SPLASHING = false; forceEnter($("#view"));
    await new Promise(r => setTimeout(r, fast ? 0 : 640));
    document.body.classList.remove("splashing"); el.classList.add("gone");
    await new Promise(r => setTimeout(r, fast ? 0 : 360));
    cancelAnimationFrame(this.raf); el.remove(); this.el = null;
  }
};
// 跳过 motion() 的“同一页面不重复播放”，强制再播一次入场
function forceEnter(root) {
  if (!root || reduceMotion()) return;
  $$("[data-stagger]", root).forEach(c => { [...c.children].forEach((el, i) => el.style.setProperty("--i", Math.min(i, 14))); c.classList.remove("enter"); c.getBoundingClientRect(); c.classList.add("enter"); });
}
