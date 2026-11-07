"use strict";
// 帧比特 3.5.1 · Bit 家园的 2.5D 体素渲染器
// 软件光栅：每个体素按 2:1 等距投成 4×4 的像素块，写入颜色 / 深度 / 分组 / 拾取四张缓冲。
// 静态世界只在变化时重画一次；Bit、动物、鱼和粒子每帧叠上去；最后统一描黑边、加水波、云影和夜间灯光。
// 和桌宠 Bit、产品里的像素方块是同一种语言：白色体素、黑色描边、少量明亮点缀色。

const VX_SHADE = [1, .8, .62]; // 顶面 / 左面 / 右面
const vxShadeCache = new Map();
function vxShades(c) {
  let s = vxShadeCache.get(c);
  if (!s) { const r = c >> 16 & 255, g = c >> 8 & 255, b = c & 255; const f = k => (Math.min(255, r * k | 0) << 16) | (Math.min(255, g * k | 0) << 8) | Math.min(255, b * k | 0); s = [c, f(VX_SHADE[1]), f(VX_SHADE[2])]; vxShadeCache.set(c, s); }
  return s;
}
const vxMix = (a, b, k) => { const r = (a >> 16 & 255) + ((b >> 16 & 255) - (a >> 16 & 255)) * k, g = (a >> 8 & 255) + ((b >> 8 & 255) - (a >> 8 & 255)) * k, bl = (a & 255) + ((b & 255) - (a & 255)) * k; return (r << 16) | (g << 8) | bl; };
const vxHash = (x, y, z = 0) => { let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// 材质写在颜色高 8 位：1 普通 2 水面 3 自发光 6 窗玻璃（夜里亮） 7 透明感（鱼）
const MAT = (m, c) => ((m & 255) << 24 | (c & 0xFFFFFF)) >>> 0;

class VXEngine {
  constructor(W, H) {
    this.W = W; this.H = H; const N = W * H; this.N = N;
    const mk = () => ({ col: new Uint32Array(N), dep: new Int16Array(N), grp: new Uint16Array(N), pid: new Uint16Array(N), mat: new Uint8Array(N), boxes: new Map() });
    this.S = mk(); this.F = mk();
    this.lit = new Uint8Array(N);
    this.img = new ImageData(W, H); this.out = new Uint32Array(this.img.data.buffer);
    this.rot = 0; this.WX = 1; this.WY = 1; this.ox = 0; this.oy = 0; this.ZO = 32;
    this.noise = VXEngine.makeNoise();
  }
  static makeNoise() {
    const n = 64, a = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let v = 0, amp = 1, f = 1 / 16, tot = 0; for (let o = 0; o < 3; o++) { const gx = x * f, gy = y * f; const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0; const s = (i, j) => vxHash(((x0 + i) % (n * f) + n) | 0, ((y0 + j) % (n * f) + n) | 0, o); const u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy); v += amp * ((s(0, 0) * (1 - u) + s(1, 0) * u) * (1 - w) + (s(0, 1) * (1 - u) + s(1, 1) * u) * w); tot += amp; amp *= .5; f *= 2; } a[y * n + x] = v / tot; }
    return a;
  }
  setWorld(WX, WY, rot, oy) {
    this.WX = WX; this.WY = WY; this.rot = ((rot % 4) + 4) % 4;
    this.RX = this.rot % 2 ? WY : WX; this.RY = this.rot % 2 ? WX : WY;
    this.ox = Math.round((this.W - 2 * (this.RX + this.RY)) / 2 + 2 * this.RY); this.oy = oy;
  }
  // 整数体素坐标 → 旋转后的坐标
  tr(x, y) { const r = this.rot, WX = this.WX, WY = this.WY; return r === 0 ? [x, y] : r === 1 ? [WY - 1 - y, x] : r === 2 ? [WX - 1 - x, WY - 1 - y] : [y, WX - 1 - x]; }
  // 连续坐标（用于屏幕定位）
  trf(x, y) { const r = this.rot, WX = this.WX, WY = this.WY; return r === 0 ? [x, y] : r === 1 ? [WY - y, x] : r === 2 ? [WX - x, WY - y] : [y, WX - x]; }
  untrf(rx, ry) { const r = this.rot, WX = this.WX, WY = this.WY; return r === 0 ? [rx, ry] : r === 1 ? [ry, WY - rx] : r === 2 ? [WX - rx, WY - ry] : [WX - ry, rx]; }
  // 世界方向 → 旋转后的方向
  trDir(dx, dy) { const r = this.rot; return r === 0 ? [dx, dy] : r === 1 ? [-dy, dx] : r === 2 ? [-dx, -dy] : [dy, -dx]; }
  project(x, y, z) { const [rx, ry] = this.trf(x, y); return [this.ox + 2 * (rx - ry), this.oy + rx + ry - 2 * z]; }
  unproject(sx, sy, z) { const a = (sx - this.ox) / 2, b = sy - this.oy + 2 * z; const rx = (a + b) / 2, ry = (b - a) / 2; return this.untrf(rx, ry); }
  // 写一个体素（旋转后坐标），faces: 1 顶 2 左（+y）4 右（+x）
  splat(B, rx, ry, z, c, g, p, m, faces) {
    const W = this.W; const sx = this.ox + 2 * (rx - ry), sy = this.oy + rx + ry - 2 * z, d = rx + ry + z;
    if (sx < 2 || sx >= W - 2 || sy < 0 || sy >= this.H - 4) return;
    const col = B.col, dep = B.dep, grp = B.grp, pid = B.pid, mat = B.mat; const sh = vxShades(c);
    const w = (i, cc) => { if (d >= dep[i]) { dep[i] = d; col[i] = cc; grp[i] = g; pid[i] = p; mat[i] = m; } };
    let i;
    if (faces & 1) { i = sy * W + sx - 1; w(i, sh[0]); w(i + 1, sh[0]); i += W - 1; w(i, sh[0]); w(i + 1, sh[0]); w(i + 2, sh[0]); w(i + 3, sh[0]); }
    if (faces & 2) { i = (sy + 2) * W + sx - 2; w(i, sh[1]); w(i + 1, sh[1]); i += W; w(i, sh[1]); w(i + 1, sh[1]); }
    if (faces & 4) { i = (sy + 2) * W + sx; w(i, sh[2]); w(i + 1, sh[2]); i += W; w(i, sh[2]); w(i + 1, sh[2]); }
    if (p) { let b = B.boxes.get(p); if (!b) { b = [sx - 2, sy, sx + 2, sy + 4]; B.boxes.set(p, b); } else { if (sx - 2 < b[0]) b[0] = sx - 2; if (sy < b[1]) b[1] = sy; if (sx + 2 > b[2]) b[2] = sx + 2; if (sy + 4 > b[3]) b[3] = sy + 4; } }
  }
  // 静态世界：列表里每 7 个数一组 x,y,z,color(含材质),group,pick,_
  buildStatic(L) {
    const S = this.S; S.col.fill(0); S.dep.fill(-32768); S.grp.fill(0); S.pid.fill(0); S.mat.fill(0); S.boxes.clear();
    const RX = this.RX, RY = this.RY, ZN = 96, ZO = this.ZO; const size = (RX + 3) * (RY + 3) * ZN;
    if (!this.occ || this.occ.length !== size) this.occ = new Uint8Array(size); else this.occ.fill(0);
    const occ = this.occ;
    const at = (rx, ry, z) => ((z + ZO) * (RY + 3) + ry + 1) * (RX + 3) + rx + 1;
    const inside = (rx, ry, z) => rx >= -1 && ry >= -1 && rx <= RX && ry <= RY && z + ZO >= 0 && z + ZO < ZN - 1;
    const n = L.length / 7; const R = new Int32Array(n * 2);
    for (let k = 0; k < n; k++) { const o = k * 7; const [rx, ry] = this.tr(L[o], L[o + 1]); R[k * 2] = rx; R[k * 2 + 1] = ry; const z = L[o + 2]; if (inside(rx, ry, z)) occ[at(rx, ry, z)] = (L[o + 3] >>> 24) === 2 ? 2 : 1; }
    for (let k = 0; k < n; k++) {
      const o = k * 7; const rx = R[k * 2], ry = R[k * 2 + 1], z = L[o + 2]; const c = L[o + 3]; const m = c >>> 24 || 1;
      const ok = inside(rx, ry, z);
      const o1 = ok ? occ[at(rx, ry, z + 1)] : 0, o2 = ok ? occ[at(rx, ry + 1, z)] : 0, o4 = ok ? occ[at(rx + 1, ry, z)] : 0;
      // 水面下面的体素露出来要画；水本身只画顶面
      const faces = (o1 === 0 || (o1 === 2 && m !== 2) ? 1 : 0) | (o2 === 0 || (o2 === 2 && m !== 2) ? 2 : 0) | (o4 === 0 || (o4 === 2 && m !== 2) ? 4 : 0);
      if (faces) this.splat(S, rx, ry, z, c & 0xFFFFFF, L[o + 4], L[o + 5], m, m === 2 ? faces & 1 || 1 : faces);
    }
  }
  beginFrame() { const S = this.S, F = this.F; F.col.set(S.col); F.dep.set(S.dep); F.grp.set(S.grp); F.pid.set(S.pid); F.mat.set(S.mat); F.boxes.clear(); this.ghosts = []; this.parts = []; this.shadows = []; }
  // 动态体素（世界整数坐标）
  put(x, y, z, c, g, p, m = 0, faces = 7) { const [rx, ry] = this.tr(x, y); this.splat(this.F, rx, ry, z, c & 0xFFFFFF, g, p, m || (c >>> 24) || 1, faces); }
  // 把整个模型放进动态层：rot 0–3 绕模型中心旋转（只转 90° 的倍数）
  model(m, x, y, z, g, p, rot = 0, cx = 0, cy = 0) {
    const v = m.v; const r = ((rot % 4) + 4) % 4;
    for (let k = 0; k < v.length; k += 4) {
      let dx = v[k] - cx, dy = v[k + 1] - cy; if (r === 1) [dx, dy] = [-dy, dx]; else if (r === 2) { dx = -dx; dy = -dy; } else if (r === 3) [dx, dy] = [dy, -dx];
      this.put(Math.round(x + cx + dx), Math.round(y + cy + dy), z + v[k + 2], v[k + 3], g, p);
    }
  }
  // 地面上的影子：把可见的地面顶面压暗
  shadow(x0, y0, w, d, zTop, k = .72) {
    const F = this.F, W = this.W;
    for (let y = y0; y < y0 + d; y++) for (let x = x0; x < x0 + w; x++) {
      const [rx, ry] = this.tr(x, y); const sx = this.ox + 2 * (rx - ry), sy = this.oy + rx + ry - 2 * zTop, dd = rx + ry + zTop;
      if (sx < 2 || sx >= W - 2 || sy < 0 || sy >= this.H - 2) continue;
      for (const [ox, oy] of [[-1, 0], [0, 0], [-2, 1], [-1, 1], [0, 1], [1, 1]]) { const i = (sy + oy) * W + sx + ox; if (F.dep[i] === dd && !(F.mat[i] & 128)) { F.col[i] = vxMix(F.col[i], 0x1A1E28, 1 - k); F.mat[i] |= 128; } }
    }
  }
  ghost(x, y, z, c) { const [rx, ry] = this.tr(x, y); this.ghosts.push(rx, ry, z, c); }
  part(sx, sy, c, size = 1) { this.parts.push(sx | 0, sy | 0, c, size); }
  boxOf(p) { return this.F.boxes.get(p) || this.S.boxes.get(p) || null; }
  pick(bx, by) { if (bx < 0 || by < 0 || bx >= this.W || by >= this.H) return 0; return this.F.pid[(by | 0) * this.W + (bx | 0)]; }
  // 合成：描边、水波、云影、昼夜色调、灯光、悬停高亮、幽灵预览、粒子
  compose(o) {
    const F = this.F, W = this.W, H = this.H, out = this.out, col = F.col, dep = F.dep, grp = F.grp, mat = F.mat, lit = this.lit;
    const tr = o.tint[0], tg = o.tint[1], tb = o.tint[2]; const t = o.t || 0; const OUT = 0xFF0B0B0B; const night = o.night;
    // 灯光：像素级的分层光圈
    const lights = o.lights || [];
    if (lights.length) { lit.fill(0); for (const L of lights) { const r = L.r, r2 = r * r; const x0 = Math.max(0, L.x - r | 0), x1 = Math.min(W - 1, L.x + r | 0), y0 = Math.max(0, L.y - r * .7 | 0), y1 = Math.min(H - 1, L.y + r * .7 | 0); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const dx = x - L.x, dy = (y - L.y) / .62; const q = (dx * dx + dy * dy) / r2; if (q >= 1) continue; const lv = q < .16 ? 3 : q < .45 ? 2 : 1; const i = y * W + x; if (lv > lit[i]) lit[i] = lv; } } }
    const LW = o.lightColor || [255, 214, 150]; const LK = [0, .16, .3, .46];
    const cloud = o.cloud || 0; const nz = this.noise; const cx = t * 3.2, cy = t * 1.1;
    for (let y = 0; y < H; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) {
        const i = row + x; const g = grp[i];
        if (!g) { out[i] = (x > 0 && grp[i - 1]) || (x < W - 1 && grp[i + 1]) || (y > 0 && grp[i - W]) || (y < H - 1 && grp[i + W]) ? OUT : 0; continue; }
        const d = dep[i]; let edge = false;
        if (x > 0) { const j = i - 1, gj = grp[j]; if (gj && ((gj !== g && dep[j] > d + 1) || (gj === g && dep[j] > d + 7))) edge = true; }
        if (!edge && x < W - 1) { const j = i + 1, gj = grp[j]; if (gj && ((gj !== g && dep[j] > d + 1) || (gj === g && dep[j] > d + 7))) edge = true; }
        if (!edge && y > 0) { const j = i - W, gj = grp[j]; if (gj && ((gj !== g && dep[j] > d + 1) || (gj === g && dep[j] > d + 7))) edge = true; }
        if (!edge && y < H - 1) { const j = i + W, gj = grp[j]; if (gj && ((gj !== g && dep[j] > d + 1) || (gj === g && dep[j] > d + 7))) edge = true; }
        if (edge) { out[i] = OUT; continue; }
        const c = col[i]; const m = mat[i] & 127; let r = c >> 16 & 255, gg = c >> 8 & 255, b = c & 255;
        if (m === 2) { // 水：随时间流动的三层色 + 偶尔的高光
          const w = Math.sin(x * .55 + y * 1.1 - t * 2.2) + Math.sin(x * .23 - y * .7 + t * 1.3);
          if (w > 1.3) { r += 26; gg += 26; b += 18; } else if (w < -1.2) { r -= 14; gg -= 12; b -= 6; }
          if (vxHash(x, y, (t * 2.5) | 0) < .006) { r = 236; gg = 244; b = 255; }
        }
        let emis = m === 3;
        if (m === 6) { if (night) { r = 255; gg = 222; b = 150; emis = true; } }
        if (!emis) {
          if (cloud) { const n = nz[(((y * .5 + cy) | 0) & 63) * 64 + (((x * .5 + cx) | 0) & 63)]; if (n > .6) { const k = n > .68 ? .9 : .95; r *= k; gg *= k; b *= k * 1.03; } }
          r *= tr; gg *= tg; b *= tb;
          const lv = lit[i]; if (lv && lights.length) { const k = LK[lv]; r += LW[0] * k; gg += LW[1] * k; b += LW[2] * k; }
        }
        r = r > 255 ? 255 : r < 0 ? 0 : r; gg = gg > 255 ? 255 : gg < 0 ? 0 : gg; b = b > 255 ? 255 : b < 0 ? 0 : b;
        out[i] = 0xFF000000 | (b << 16) | (gg << 8) | r;
      }
    }
    // 悬停 / 选中：黄色像素外轮廓
    const ring = (pidv, color) => {
      const bx = this.boxOf(pidv); if (!pidv || !bx) return; const P = F.pid; const C = 0xFF000000 | ((color & 255) << 16) | (color & 0xFF00) | (color >> 16 & 255);
      for (let y = Math.max(1, bx[1] - 1); y <= Math.min(H - 2, bx[3] + 1); y++) for (let x = Math.max(1, bx[0] - 1); x <= Math.min(W - 2, bx[2] + 1); x++) { const i = y * W + x; if (P[i] === pidv) continue; if (P[i - 1] === pidv || P[i + 1] === pidv || P[i - W] === pidv || P[i + W] === pidv) out[i] = C; }
    };
    if (o.sel) ring(o.sel, 0xFFFFFF);
    if (o.hover && o.hover !== o.sel) ring(o.hover, o.hoverColor || 0xFFD23F);
    // 幽灵预览：棋盘格半透明
    const gh = this.ghosts;
    if (gh.length) {
      const idx = []; for (let k = 0; k < gh.length; k += 4) idx.push(k); idx.sort((a, b) => (gh[a] + gh[a + 1] + gh[a + 2]) - (gh[b] + gh[b + 1] + gh[b + 2]));
      for (const k of idx) { const rx = gh[k], ry = gh[k + 1], z = gh[k + 2], c = gh[k + 3]; const sx = this.ox + 2 * (rx - ry), sy = this.oy + rx + ry - 2 * z; const sh = vxShades(c & 0xFFFFFF); const cells = [[-1, 0, 0], [0, 0, 0], [-2, 1, 0], [-1, 1, 0], [0, 1, 0], [1, 1, 0], [-2, 2, 1], [-1, 2, 1], [0, 2, 2], [1, 2, 2], [-2, 3, 1], [-1, 3, 1], [0, 3, 2], [1, 3, 2]]; for (const [dx, dy, f] of cells) { const X = sx + dx, Y = sy + dy; if (X < 0 || Y < 0 || X >= W || Y >= H || ((X + Y) & 1)) continue; const cc = sh[f]; out[Y * W + X] = 0xFF000000 | ((cc & 255) << 16) | (cc & 0xFF00) | (cc >> 16 & 255); } }
    }
    // 屏幕空间粒子
    const P = this.parts;
    for (let k = 0; k < P.length; k += 4) { const x = P[k], y = P[k + 1], c = P[k + 2], s = P[k + 3]; const C = 0xFF000000 | ((c & 255) << 16) | (c & 0xFF00) | (c >> 16 & 255); for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) { const X = x + xx, Y = y + yy; if (X >= 0 && Y >= 0 && X < W && Y < H) out[Y * W + X] = C; } }
  }
}

// ---------- 体素模型 ----------
class VM {
  constructor() { this.v = []; }
  add(x, y, z, c) { this.v.push(x, y, z, c); return this; }
  box(x, y, z, w, d, h, c) { for (let k = 0; k < h; k++) for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) { const cc = typeof c === "function" ? c(i, j, k) : c; if (cc != null) this.add(x + i, y + j, z + k, cc); } return this; }
  blob(cx, cy, cz, rx, ry, rz, c, seed = 1, rough = .18) { for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) { const q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2; if (q <= 1 + (vxHash(x, y, z + seed) - .5) * rough * 2) this.add(x, y, z, typeof c === "function" ? c(x - cx, y - cy, z - cz) : c); } return this; }
  // 替换已有位置的颜色（用于眼睛、花纹）
  set(x, y, z, c) { for (let k = 0; k < this.v.length; k += 4) if (this.v[k] === x && this.v[k + 1] === y && this.v[k + 2] === z) { this.v[k + 3] = c; return this; } return this.add(x, y, z, c); }
}
// 在占地 fw×fd 里旋转模型（r 为 0–3）
const vmRot = (x, y, fw, fd, r) => r === 0 ? [x, y] : r === 1 ? [fd - 1 - y, x] : r === 2 ? [fw - 1 - x, fd - 1 - y] : [y, fw - 1 - x];

// 调色：白 / 灰为主，草地用品牌的浅薄荷绿，点缀色和画布节点颜色一致
const VPAL = {
  grass: [0xBBD6B4, 0xB4D1AD, 0xC2DBBC, 0xAFCCA8], grassD: 0x9DC096, grassL: 0xD3E6CE, grassEdge: 0x96B98F,
  dirt: [0x8C7B6A, 0x81705F], rock: [0x5E5A57, 0x534F4C, 0x48453F], path: [0xE8E5DC, 0xDCD8CC, 0xD0CBBD], sand: [0xEBDFB6, 0xE1D3A5],
  water: 0x7BA4FF, soil: [0x8F735F, 0x82685455], soilWet: [0x5E4B3F, 0x544237], wood: [0xC9A57A, 0xBA955F, 0xA47E51], floor: [0xE4D0AA, 0xD9C39A, 0xCDB58A],
  wall: 0xF4F2EC, wallB: 0xD6D1C6, fence: 0xF1EEE6, hay: [0xE6D28F, 0xDAC47C], leaf: [0x86C893, 0x74B982, 0x9DD7A8, 0x62A672], trunk: [0x8A6A4E, 0x7A5C43],
  white: 0xF4F4F2, black: 0x0E0E0E, dark: 0x2E3136, gray: 0x8C9098, YEL: 0xFFD23F, ORA: 0xFF9F43, PNK: 0xFF7EB0, BLU: 0x7BA4FF, GRN: 0x3DD68C, RED: 0xFF5A5F, MINT: 0xC7DEC4
};
const pickc = (arr, x, y, z = 0) => arr[(vxHash(x, y, z) * arr.length) | 0];

const VXM = {
  cache: new Map(),
  get(key, fn) { let m = this.cache.get(key); if (!m) { m = fn(); this.cache.set(key, m); } return m; },
  // Bit：6×6×6 的白色方块，两只竖条眼睛
  bit(face = 0, expr = "normal") {
    return this.get(`bit:${face}:${expr}`, () => {
      const m = new VM(); m.box(0, 0, 0, 6, 6, 6, (i, j, k) => k === 5 ? 0xFFFFFF : VPAL.white);
      // face 0: +x 1: +y 2: -x 3: -y
      const eye = (a, z) => face === 0 ? m.set(5, a, z, VPAL.black) : face === 1 ? m.set(5 - a, 5, z, VPAL.black) : face === 2 ? m.set(0, 5 - a, z, VPAL.black) : m.set(a, 0, z, VPAL.black);
      const blush = (a, z) => face === 0 ? m.set(5, a, z, 0xFFA8C8) : face === 1 ? m.set(5 - a, 5, z, 0xFFA8C8) : face === 2 ? m.set(0, 5 - a, z, 0xFFA8C8) : m.set(a, 0, z, 0xFFA8C8);
      if (expr === "sleep" || expr === "blink") { eye(1, 2); eye(4, 2); }
      else if (expr === "happy") { eye(1, 3); eye(4, 3); blush(0, 1); blush(5, 1); }
      else { eye(1, 2); eye(1, 3); eye(4, 2); eye(4, 3); }
      return m;
    });
  },
  cursor() { return this.get("cursor", () => new VM().box(0, 0, 0, 2, 2, 2, (i, j, k) => k === 1 ? 0xFFE57A : VPAL.YEL)); },
  chick(f) { return this.get(`chick:${f}`, () => { const m = new VM(); m.box(0, 0, 1, 3, 3, 2, VPAL.YEL).add(1, 1, 3, VPAL.YEL).add(2, 1, 3, VPAL.YEL); m.set(0, 0, 1, 0xF2C12E).set(0, 2, 1, 0xF2C12E); m.add(3, 1, 2, VPAL.ORA); m.set(2, 0, 2, VPAL.black).set(2, 2, 2, VPAL.black); m.add(1, 0, 0, VPAL.ORA).add(1, 2, 0, VPAL.ORA); return m; }); },
  duck(f) { return this.get(`duck:${f}`, () => { const m = new VM(); m.box(0, 0, 1, 4, 3, 2, VPAL.white).add(0, 1, 3, VPAL.white); m.box(3, 1, 3, 1, 1, 2, VPAL.white); m.add(4, 1, 4, 0xFFB52E); m.set(3, 1, 4, VPAL.white).add(3, 0, 4, VPAL.black); m.add(1, 0, 0, VPAL.ORA).add(1, 2, 0, VPAL.ORA); m.set(1, 0, 2, 0xDCDCD6).set(1, 2, 2, 0xDCDCD6); return m; }); },
  bunny(f) { return this.get(`bunny:${f}`, () => { const m = new VM(); m.box(0, 0, 0, 3, 3, 3, 0xE8E8E6); m.box(1, 0, 3, 1, 1, 2, 0xE8E8E6).box(1, 2, 3, 1, 1, 2, 0xE8E8E6); m.set(1, 0, 4, 0xFFB8CF).set(1, 2, 4, 0xFFB8CF); m.set(2, 0, 2, VPAL.black).set(2, 2, 2, VPAL.black); m.add(3, 1, 1, 0xFFB8CF); m.add(-1, 1, 1, 0xFFFFFF); return m; }); },
  sheep(f) { return this.get(`sheep:${f}`, () => { const m = new VM(); m.box(0, 0, 1, 5, 4, 3, (i, j, k) => vxHash(i, j, k) < .25 ? 0xE9E9E2 : 0xF8F8F3); [[1, 1], [3, 2], [2, 0], [0, 3]].forEach(([i, j]) => m.add(i, j, 4, 0xF8F8F3)); m.box(5, 1, 2, 2, 2, 2, 0x3A3A3A); m.set(6, 1, 3, 0xF4F4F2).set(6, 2, 3, 0xF4F4F2); [[0, 0], [4, 0], [0, 3], [4, 3]].forEach(([i, j]) => m.add(i, j, 0, 0x3A3A3A)); return m; }); },
  egg() { return this.get("egg", () => new VM().box(0, 0, 0, 2, 2, 2, 0xFFF6E0).add(0, 0, 2, 0xFFF6E0)); },
  duckegg() { return this.get("duckegg", () => new VM().box(0, 0, 0, 2, 2, 2, 0xE3F2DC).add(1, 1, 2, 0xE3F2DC)); },
  fur() { return this.get("fur", () => new VM().box(0, 0, 0, 2, 2, 1, 0xEDEDED).add(0, 1, 1, 0xEDEDED).add(1, 0, 1, 0xDADADA)); },
  wool() { return this.get("wool", () => new VM().box(0, 0, 0, 3, 3, 2, (i, j, k) => (i + j + k) % 2 ? 0xF7F7F3 : 0xE6E6DE)); },
  // 作物：0 种子 1 发芽 2 生长 3 成熟
  crop(kind, st) {
    return this.get(`crop:${kind}:${st}`, () => {
      const m = new VM(); const G1 = 0x8FD48F, G2 = 0x6FBF6F, G3 = 0x5AA85F;
      if (st === 0) return m.add(2, 3, 0, 0x6E5644).add(4, 4, 0, 0x6E5644).add(3, 5, 0, 0x7DBE86);
      if (st === 1) return m.add(3, 3, 0, G2).add(3, 3, 1, G1).add(2, 3, 1, G1).add(4, 3, 2, G1);
      if (kind === "carrot") { m.box(3, 3, 0, 1, 1, st === 3 ? 4 : 3, G2); [[2, 3], [4, 3], [3, 2], [3, 4]].forEach(([x, y]) => m.add(x, y, st === 3 ? 3 : 2, G1)); m.add(2, 2, st === 3 ? 4 : 3, G1).add(4, 4, st === 3 ? 4 : 3, G1); if (st === 3) m.box(3, 3, 0, 2, 2, 1, VPAL.ORA).set(3, 3, 0, VPAL.ORA); return m; }
      if (kind === "tomato") { m.box(5, 5, 0, 1, 1, 7, VPAL.wood[1]); m.blob(3.5, 3.5, 3.5, 2, 2, 2.6, G2, 3, .4); if (st === 3) { [[2, 2, 2], [4, 3, 4], [2, 4, 5], [4, 1, 3]].forEach(([x, y, z]) => { m.set(x, y, z, VPAL.RED).set(x + 1, y, z, VPAL.RED).set(x, y + 1, z, 0xE84A4F).set(x, y, z + 1, 0xFF8A8C); }); } return m; }
      if (kind === "strawberry") { m.box(1, 1, 0, 6, 6, st === 3 ? 2 : 1, (i, j, k) => (i + j) % 3 === 0 && k ? null : (i + j + k) % 2 ? G2 : G3); if (st === 3) [[1, 3, 1], [4, 1, 1], [6, 4, 1], [3, 6, 1], [2, 1, 2], [5, 5, 2]].forEach(([x, y, z]) => m.set(x, y, z, 0xFF5C7A)); else m.add(3, 3, 1, 0xFFFFFF); return m; }
      if (kind === "pumpkin") { m.add(1, 1, 0, G2).add(6, 2, 0, G2).add(2, 6, 0, G2); if (st === 2) return m.box(3, 3, 0, 2, 2, 2, 0x9ACB63).add(3, 3, 2, G3); m.box(1, 1, 0, 6, 6, 4, (i, j, k) => ((i === 0 || i === 5) && (j === 0 || j === 5)) || ((k === 3 || k === 0) && (i === 0 || i === 5 || j === 0 || j === 5)) ? null : i % 2 ? 0xF0962F : 0xFFAA45); m.box(3, 3, 4, 2, 2, 1, 0x6A8A3A).add(4, 3, 5, 0x6A8A3A); return m; }
      if (kind === "sunflower") { const h = st === 3 ? 10 : 7; m.box(3, 3, 0, 1, 1, h, G3); m.add(2, 3, 3, G2).add(4, 3, 5, G2).add(3, 4, 4, G2); if (st === 3) { m.box(1, 1, h, 5, 5, 1, (i, j) => (i === 0 || i === 4) && (j === 0 || j === 4) ? null : VPAL.YEL); m.box(2, 2, h + 1, 3, 3, 1, 0x7A4A2E); m.set(3, 3, h + 1, 0x5E3820); } else m.box(2, 2, h, 3, 3, 1, 0x9ACB63); return m; }
      return m;
    });
  },
  tree(seed = 1, big = false, pink = false) {
    return this.get(`tree:${seed}:${big}:${pink}`, () => {
      const m = new VM(); const h = big ? 8 : 6; m.box(3, 3, 0, 2, 2, h, (i, j, k) => k === 0 ? VPAL.trunk[1] : VPAL.trunk[(i + k) % 2]);
      const L = pink ? [0xFFC2DA, 0xFFB0CF, 0xFFD6E6, 0xF59CC0] : VPAL.leaf; const r = big ? 4.6 : 3.6;
      m.blob(4, 4, h + (big ? 3.5 : 2.6), r, r, big ? 3.6 : 3, (dx, dy, dz) => dz > 1.5 && vxHash(dx | 0, dy | 0, seed) < .5 ? L[2] : dz < -1 ? L[3] : vxHash(dx | 0, dy | 0, dz | 0) < .3 ? L[1] : L[0], seed, .3);
      if (!pink && seed % 3 === 0) [[2, 6, h + 2], [6, 3, h + 3]].forEach(([x, y, z]) => m.set(x, y, z, VPAL.RED));
      return m;
    });
  },
  bush(seed = 1) { return this.get(`bush:${seed}`, () => new VM().blob(4, 4, 1.6, 3.2, 3, 2.2, (dx, dy, dz) => dz > .8 ? VPAL.leaf[2] : vxHash(dx | 0, dy | 0, dz | 0) < .4 ? VPAL.leaf[1] : VPAL.leaf[0], seed, .35)); },
  rock(seed = 1) { return this.get(`rock:${seed}`, () => new VM().blob(4, 4, .8, 2.6, 2.2, 1.8, (dx, dy, dz) => dz > .4 ? 0xC9C6BF : 0xAEAAA2, seed, .4)); },
  flowers(seed = 1) {
    return this.get(`flowers:${seed}`, () => {
      const m = new VM(); const cs = [VPAL.PNK, VPAL.YEL, VPAL.BLU, 0xFFFFFF, 0xFF9F43];
      for (let k = 0; k < 7; k++) { const x = 1 + ((vxHash(k, seed) * 6) | 0), y = 1 + ((vxHash(seed, k) * 6) | 0), h = 1 + ((vxHash(k, k, seed) * 3) | 0); m.box(x, y, 0, 1, 1, h, 0x6FBF6F); m.add(x, y, h, cs[(k + seed) % cs.length]); if (h > 1) m.add(x + 1, y, 0, 0x8FD48F); }
      return m;
    });
  },
  lamp() { return this.get("lamp", () => { const m = new VM(); m.box(2, 2, 0, 3, 3, 1, 0x6E7278); m.box(3, 3, 1, 1, 1, 10, 0x8C9098); m.box(2, 2, 11, 3, 3, 3, (i, j, k) => k === 2 ? 0x55585E : (i === 1 || j === 1) ? MAT(3, 0xFFE9A8) : 0x6E7278); m.add(3, 3, 14, 0x55585E); return m; }); },
  bench() { return this.get("bench", () => { const m = new VM(); m.box(1, 2, 3, 14, 4, 1, (i) => i % 3 === 2 ? VPAL.wood[2] : VPAL.wood[0]); m.box(1, 2, 4, 14, 1, 3, (i, j, k) => k === 1 ? VPAL.wood[2] : VPAL.wood[1]); [[1, 2], [14, 2], [1, 5], [14, 5]].forEach(([x, y]) => m.box(x, y, 0, 1, 1, 3, 0x4A4A4A)); return m; }); },
  mailbox(flag = false) { return this.get(`mailbox:${flag}`, () => { const m = new VM(); m.box(3, 3, 0, 1, 1, 6, VPAL.wood[2]); m.box(2, 1, 6, 3, 5, 3, (i, j, k) => k === 2 ? 0xFF7A7E : VPAL.RED); m.add(3, 0, 7, VPAL.dark); if (flag) m.box(5, 2, 8, 1, 1, 3, VPAL.dark).add(5, 3, 10, VPAL.YEL).add(5, 3, 9, VPAL.YEL); else m.box(5, 2, 7, 1, 3, 1, VPAL.dark); return m; }); },
  lightstand() { return this.get("lightstand", () => { const m = new VM(); [[1, 1], [6, 2], [3, 6]].forEach(([x, y]) => m.add(x, y, 0, VPAL.dark).add((x + 3.5) / 2 | 0, (y + 3.5) / 2 | 0, 1, VPAL.dark)); m.box(3, 3, 1, 1, 1, 10, 0x3A3D42); m.box(1, 2, 11, 6, 3, 4, (i, j, k) => j === 2 ? MAT(3, 0xFFF6D8) : 0xE8E8E6); return m; }); },
  fountain() { return this.get("fountain", () => { const m = new VM(); m.box(0, 0, 0, 8, 8, 2, (i, j) => i === 0 || j === 0 || i === 7 || j === 7 ? 0xDAD6CC : null); m.box(1, 1, 0, 6, 6, 1, MAT(2, VPAL.water)); m.box(3, 3, 1, 2, 2, 4, 0xDAD6CC); m.box(2, 2, 5, 4, 4, 1, (i, j) => i === 0 || j === 0 || i === 3 || j === 3 ? 0xE8E5DC : MAT(2, VPAL.water)); return m; }); },
  scarecrow() { return this.get("scarecrow", () => { const m = new VM(); m.box(3, 3, 0, 1, 1, 9, VPAL.wood[2]); m.box(1, 3, 6, 6, 1, 1, VPAL.wood[1]); m.box(2, 2, 3, 4, 3, 4, (i, j, k) => k > 2 ? 0xE6D28F : VPAL.BLU); m.box(2, 2, 9, 4, 3, 3, 0xEAD9A0); m.set(5, 2, 10, VPAL.black).set(5, 4, 10, VPAL.black); m.box(1, 1, 12, 6, 5, 1, 0x4A3B2E).box(2, 2, 13, 4, 3, 2, 0x4A3B2E); return m; }); },
  windmillTower() {
    return this.get("windmill", () => {
      const m = new VM();
      m.box(0, 0, 0, 16, 16, 2, (i, j, k) => k === 1 ? ((i + j) % 2 ? 0xDAD6CC : 0xE3DFD6) : 0xC9C4B8);
      for (let k = 0; k < 20; k++) { const r = 5.6 - k * .1; const band = k === 6 || k === 13; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const q = (x - 7.5) ** 2 + (y - 7.5) ** 2; if (q <= r * r) m.add(x, y, 2 + k, band ? 0xDAD5CA : VPAL.wall); } }
      for (let k = 0; k < 7; k++) { const r = 6.6 - k * .95; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const q = (x - 7.5) ** 2 + (y - 7.5) ** 2; if (q <= r * r) m.add(x, y, 22 + k, (x + y + k) % 4 < 2 ? 0xE0765A : 0xCC5F48); } }
      m.box(7, 13, 2, 2, 1, 5, VPAL.wood[2]).add(7, 13, 7, VPAL.wood[1]).add(8, 13, 7, VPAL.wood[1]);
      m.box(7, 13, 11, 2, 1, 3, MAT(6, 0xBFD8FF)); m.box(13, 7, 11, 1, 2, 3, MAT(6, 0xBFD8FF)); m.box(2, 7, 11, 1, 2, 3, MAT(6, 0xBFD8FF));
      m.box(7, 13, 17, 2, 2, 2, 0x6E5A44);
      return m;
    });
  },
  hay() { return this.get("hay", () => new VM().box(1, 1, 0, 6, 5, 4, (i, j, k) => (k === 3 || i === 0 || i === 5) ? VPAL.hay[0] : (i + k) % 2 ? VPAL.hay[1] : VPAL.hay[0]).box(1, 2, 1, 6, 1, 1, 0xB89A5A).box(1, 2, 3, 6, 1, 1, 0xB89A5A)); },
  pinktree(seed = 2) { return this.tree(seed, false, true); },
  stakes() { return this.get("stakes", () => new VM().box(3, 3, 0, 1, 1, 4, VPAL.wood[2]).add(3, 3, 4, VPAL.YEL)); },
  trough() { return this.get("trough", () => new VM().box(0, 0, 0, 7, 3, 2, (i, j, k) => (i === 0 || i === 6 || j === 0 || j === 2 || k === 0) ? VPAL.wood[1] : VPAL.hay[0]).add(2, 1, 2, VPAL.hay[1]).add(4, 1, 2, VPAL.hay[0])); },
  sprinkler() { return this.get("sprinkler", () => new VM().box(3, 3, 0, 2, 2, 1, 0x8C9098).box(3, 3, 1, 1, 1, 5, 0xAEB2B8).box(2, 2, 6, 3, 3, 1, 0x6E7278).add(3, 3, 7, VPAL.BLU)); },
  sign() { return this.get("sign", () => new VM().box(3, 3, 0, 1, 1, 5, VPAL.wood[2]).box(1, 3, 4, 5, 1, 3, VPAL.wood[0]).add(2, 3, 5, VPAL.wood[2]).add(4, 3, 5, VPAL.wood[2])); },
  // 家具（占地按格子，模型在 8×格数 体素里）
  furni(kind) {
    return this.get(`f:${kind}`, () => {
      const m = new VM(); const W0 = VPAL.wood;
      if (kind === "bed") { m.box(1, 0, 0, 6, 1, 6, W0[2]); m.box(1, 1, 0, 6, 14, 2, W0[1]); m.box(1, 1, 2, 6, 14, 1, 0xFFFFFF); m.box(2, 2, 3, 4, 3, 1, 0xFFFFFF); m.box(1, 6, 3, 6, 9, 1, (i, j) => j % 3 === 0 ? 0x6A93F0 : VPAL.BLU); m.box(1, 15, 0, 6, 1, 3, W0[2]); }
      else if (kind === "desk") { m.box(1, 1, 5, 14, 6, 1, W0[0]); [[1, 1], [14, 1], [1, 6], [14, 6]].forEach(([x, y]) => m.box(x, y, 0, 1, 1, 5, W0[2])); m.box(4, 3, 6, 5, 3, 1, 0x3A3D42); m.box(4, 2, 6, 5, 1, 4, (i, j, k) => (i === 0 || i === 4 || k === 3 || k === 0) ? 0x2A2C30 : MAT(3, VPAL.MINT)); m.box(11, 3, 6, 2, 2, 2, VPAL.white).add(11, 3, 7, 0x7A4A2E); m.add(9, 4, 6, VPAL.YEL); }
      else if (kind === "lamp2") { m.box(2, 2, 0, 4, 4, 4, W0[1]); m.box(3, 3, 4, 1, 1, 4, 0x3A3D42); m.box(2, 2, 8, 3, 3, 2, MAT(3, 0xFFE7A3)); m.add(3, 3, 10, 0xFFE7A3); }
      else if (kind === "plant") { m.box(2, 2, 0, 4, 4, 3, (i, j, k) => k === 2 && i > 0 && i < 3 && j > 0 && j < 3 ? 0x5A4636 : 0xC9774E); m.blob(4, 4, 6.5, 2.6, 2.6, 3.4, (dx, dy, dz) => dz > 1 ? VPAL.leaf[2] : VPAL.leaf[(Math.abs(dx + dy) | 0) % 2], 7, .4); }
      else if (kind === "rug") { m.box(1, 1, 0, 14, 14, 1, (i, j) => (i === 0 || j === 0 || i === 13 || j === 13) ? VPAL.YEL : ((i + j) % 6 === 0 || Math.abs(i - j) % 6 === 0) ? 0xFFA9CC : VPAL.PNK); }
      else if (kind === "poster") { m.add(2, 5, 0, VPAL.dark).add(5, 5, 0, VPAL.dark).add(3, 2, 0, VPAL.dark); m.box(1, 4, 1, 6, 1, 10, (i, j, k) => (i === 0 || i === 5 || k === 0 || k === 9) ? VPAL.black : k > 6 ? VPAL.ORA : 0xFFB766); m.box(2, 4, 3, 4, 1, 3, VPAL.white); m.set(3, 4, 4, VPAL.black).set(4, 4, 4, VPAL.black); m.set(5, 4, 6, VPAL.YEL); }
      else if (kind === "shelf") { m.box(1, 2, 0, 6, 4, 15, (i, j, k) => (i === 0 || i === 5 || k % 5 === 0 || j === 0) ? 0x9C7A55 : null); const B = [VPAL.BLU, VPAL.PNK, VPAL.YEL, VPAL.GRN, 0xFFFFFF, VPAL.ORA]; for (let s = 0; s < 3; s++) for (let b = 1; b < 5; b++) m.box(1 + b, 3, s * 5 + 1, 1, 2, 3 - ((b + s) % 2), B[(b + s * 2) % B.length]); }
      else if (kind === "tv") { m.box(1, 2, 0, 14, 5, 4, (i, j, k) => k === 3 ? W0[0] : W0[1]); m.box(2, 4, 4, 12, 1, 8, (i, j, k) => (i === 0 || i === 11 || k === 0 || k === 7) ? 0x23262B : MAT(3, k > 4 && i < 5 ? 0x9FC0FF : 0x5E7FD0)); m.box(7, 3, 4, 2, 1, 1, 0x23262B); }
      else if (kind === "camera") { [[1, 1], [6, 2], [3, 6]].forEach(([x, y]) => m.add(x, y, 0, VPAL.dark).add((x + 3.5) / 2 | 0, (y + 3.5) / 2 | 0, 3, VPAL.dark)); m.box(3, 3, 1, 1, 1, 7, 0x3A3D42); m.box(2, 2, 8, 4, 3, 3, 0x2A2C30); m.box(6, 3, 8, 2, 1, 2, 0x55585E); m.add(7, 3, 9, 0x9FC0FF); m.add(2, 2, 11, MAT(3, VPAL.RED)); m.box(2, 3, 11, 2, 1, 2, 0x2A2C30); m.box(4, 3, 11, 2, 1, 2, 0x2A2C30); }
      else if (kind === "trophy") { m.box(2, 2, 0, 4, 4, 3, (i, j, k) => k === 2 ? 0x4A4D53 : 0x3A3D42); m.box(3, 3, 3, 2, 2, 2, 0xE8B820); m.box(2, 2, 5, 4, 4, 3, (i, j, k) => k === 0 || i === 0 || j === 0 || i === 3 || j === 3 ? VPAL.YEL : null); m.add(1, 3, 6, VPAL.YEL).add(6, 3, 6, VPAL.YEL).add(3, 2, 7, 0xFFF0A0); }
      return m;
    });
  },
  decor(kind, seed = 1) {
    if (kind === "tree") return this.tree(seed);
    if (kind === "flowers") return this.flowers(seed);
    if (kind === "rock") return this.rock(seed);
    if (kind === "bush") return this.bush(seed);
    if (kind === "pinktree") return this.tree(seed, false, true);
    return this[kind] ? this[kind]() : new VM();
  }
};

// 8×8 的像素图标（商店、仓库里用），直接从体素模型渲染一张小图
const vxIconCache = new Map();
function vxIcon(model, size = 40) {
  if (vxIconCache.has(model)) return vxIconCache.get(model);
  const v = model.v; let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
  for (let k = 0; k < v.length; k += 4) { x0 = Math.min(x0, v[k]); y0 = Math.min(y0, v[k + 1]); z0 = Math.min(z0, v[k + 2]); x1 = Math.max(x1, v[k]); y1 = Math.max(y1, v[k + 1]); z1 = Math.max(z1, v[k + 2]); }
  const wx = x1 - x0 + 1, wy = y1 - y0 + 1, wz = z1 - z0 + 1;
  const W = 2 * (wx + wy) + 6, H = wx + wy + 2 * wz + 6;
  const e = new VXEngine(W, H); e.setWorld(wx, wy, 0, 2 * wz + 2); e.ox = 2 * wy + 3;
  const L = []; for (let k = 0; k < v.length; k += 4) L.push(v[k] - x0, v[k + 1] - y0, v[k + 2] - z0, v[k + 3], 2, 1, 0);
  e.buildStatic(L); e.beginFrame(); e.compose({ tint: [1, 1, 1] });
  const c = document.createElement("canvas"); c.width = W; c.height = H; c.getContext("2d").putImageData(e.img, 0, 0);
  const url = c.toDataURL(); vxIconCache.set(model, url); return url;
}
