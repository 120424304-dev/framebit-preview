"use strict";
// 帧比特 3.5 · 复古像素鼠标指针：运行时画出各类指针，注入成 CSS 变量；可点击处有像素光圈和点击碎屑
// K 黑描边  W 白  Y 光标块黄  G 灰
const CURSOR_ART = {
  default: { hot: [0, 0], rows: [
    "K..........", "KK.........", "KWK........", "KWWK.......", "KWWWK......", "KWWWWK.....", "KWWWWWK....", "KWWWWWWK...", "KWWWWWWWK..", "KWWWWWWWWK.",
    "KWWWWWKKKKK", "KWWKWWK....", "KWK.KWWK.YY", "KK..KWWK.YY", "K....KWWK..", ".....KWWK..", "......KK..."] },
  pointer: { hot: [5, 0], rows: [
    "....KK........", "...KWWK.......", "...KWWK.......", "...KWWK.......", "...KWWKKK.....", "...KWWKWWKKK..", ".KKKWWKWWKWWK.", "KWWKWWWWWKWWKK", "KWWWWWWWWWWWWK", ".KWWWWWWWWWWWK",
    ".KWWWWWWWWWWWK", "..KWWWWWWWWWK.", "..KWWWWWWWWWK.", "...KYYYYYYYK..", "...KYYYYYYYK..", "...KKKKKKKKK.."] },
  press: { hot: [5, 2], rows: [
    "..............", "..............", "....KK........", "...KWWKKK.....", "...KWWKWWKKK..", ".KKKWWKWWKWWK.", "KWWKWWWWWKWWKK", "KWWWWWWWWWWWWK", ".KWWWWWWWWWWWK", ".KWWWWWWWWWWWK",
    "..KWWWWWWWWWK.", "..KWWWWWWWWWK.", "...KWWWWWWWK..", "...KYYYYYYYK..", "...KYYYYYYYK..", "...KKKKKKKKK.."] },
  text: { hot: [3, 9], rows: [
    "KKK.KKK", "KWWKWWK", "KKKWKKK", "..KWK..", "..KWK..", "..KWK..", "..KWK..", "..KWK..", "..KWK..", "..KWK..", "..KWK..", "..KWK..", "..KWK..", "..KWK..", "..KWK..", "KKKWKKK", "KWWKWWK", "KKK.KKK"] },
  grab: { hot: [7, 7], rows: [
    "......KK.......", "..KK.KWWKKK....", ".KWWKKWWKWWK...", ".KWWKKWWKWWKKK.", "..KWWKWWKWWKWWK", "..KWWKWWKWWKWWK", "KK.KWWWWWWWWWWK", "KWKKWWWWWWWWWWK", "KWWKWWWWWWWWWK.", ".KWWWWWWWWWWWK.",
    "..KWWWWWWWWWK..", "...KWWWWWWWWK..", "....KWWWWWWK...", "....KKKKKKKK..."] },
  grabbing: { hot: [7, 7], rows: [
    "...............", "...............", "...............", "....KKKKKK.....", "...KWWKWWKKK...", "..KKWWKWWKWWK..", ".KWKWWWWWWWWKK.", ".KWWWWWWWWWWWK.", ".KWWWWWWWWWWWK.", "..KWWWWWWWWWWK.",
    "...KWWWWWWWWK..", "....KWWWWWWWK..", "....KWWWWWWK...", "....KKKKKKKK..."] },
  crosshair: { hot: [7, 7], rows: [
    "......KKK......", "......KWK......", "......KWK......", "......KWK......", "......KWK......", "......KKK......", "KKKKKK...KKKKKK", "KWWWWK.Y.KWWWWK", "KKKKKK...KKKKKK", "......KKK......",
    "......KWK......", "......KWK......", "......KWK......", "......KWK......", "......KKK......"] },
  move: { hot: [7, 7], rows: [
    "......KKK......", ".....KWWWK.....", "....KWWWWWK....", "......KWK......", "..K...KWK...K..", ".KK...KWK...KK.", "KWKKKKKWKKKKKWK", "KWWWWWWYWWWWWWK", "KWKKKKKWKKKKKWK", ".KK...KWK...KK.",
    "..K...KWK...K..", "......KWK......", "....KWWWWWK....", ".....KWWWK.....", "......KKK......"] },
  "nwse-resize": { hot: [6, 6], rows: [
    "KKKKKK.......", "KWWWWK.......", "KWWWK........", "KWWWWK.......", "KWKKWWK......", "KK..KWWK.....", ".....KWK.....", ".....KWWK..KK", "......KWWKKWK", ".......KWWWWK",
    "........KWWWK", ".......KWWWWK", ".......KKKKKK"] },
  "not-allowed": { hot: [7, 7], rows: [
    "....KKKKKK.....", "..KKWWWWWWKK...", ".KWWKKKKKKWWK..", ".KWKK....KWWWK.", "KWKK....KWWKWK.", "KWK....KWWK.KWK", "KWK...KWWK..KWK", "KWK..KWWK...KWK", "KWK.KWWK....KWK", ".KWKWWK....KKWK",
    ".KWWWK....KKWK.", "..KWWKKKKKKWWK.", "...KKWWWWWWKK..", ".....KKKKKK...."] },
  wait: { hot: [5, 7], rows: [
    "KKKKKKKKKKK", "KWWWWWWWWWK", ".KWYYYYYWK.", "..KWYYYWK..", "...KWYWK...", "....KWK....", "....KWK....", "...KWWWK...", "..KWWYWWK..", ".KWWYYYWWK.", "KWYYYYYYYWK", "KKKKKKKKKKK"] }
};
const CURSOR_COL = { K: "#0A0A0A", W: "#F4F4F2", Y: "#FFD23F", G: "#8A8A8A" };
function cursorPng(rows, scale) {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  const c = document.createElement("canvas"); c.width = w * scale; c.height = h * scale; const x = c.getContext("2d");
  rows.forEach((r, y) => [...r].forEach((ch, i) => { const col = CURSOR_COL[ch]; if (!col) return; x.fillStyle = col; x.fillRect(i * scale, y * scale, scale, scale); }));
  return c.toDataURL("image/png");
}
// 每个像素在屏幕上占 2pt；用 image-set 给 Retina 一张 2 倍图，指针边缘保持锐利
function installCursors() {
  const root = document.documentElement.style;
  const sets = (() => { try { return CSS.supports("cursor", "-webkit-image-set(url(data:image/png;base64,iVBORw0KGgo=) 1x) 0 0, auto"); } catch (_) { return false; } })();
  const fallback = { default: "default", pointer: "pointer", press: "pointer", text: "text", grab: "grab", grabbing: "grabbing", crosshair: "crosshair", move: "move", "nwse-resize": "nwse-resize", "not-allowed": "not-allowed", wait: "progress" };
  Object.entries(CURSOR_ART).forEach(([k, a]) => {
    const one = cursorPng(a.rows, 2), two = cursorPng(a.rows, 4); const hx = a.hot[0] * 2, hy = a.hot[1] * 2;
    const img = sets ? `-webkit-image-set(url("${one}") 1x, url("${two}") 2x)` : `url("${one}")`;
    root.setProperty(`--cur-${k}`, `${img} ${hx} ${hy}, ${fallback[k]}`);
  });
  document.documentElement.classList.add("px-cursor");
}

// ---------- 可点击处的像素光圈 + 点击碎屑 ----------
const CFX = { el: null, on: false, x: 0, y: 0, raf: 0, target: null };
const CLICKABLE = "button:not(:disabled), a[href], [data-act], label.btn, .dd, [role=button], [role=menuitem], [role=option], summary, input[type=checkbox], input[type=radio], .pet-cube";
function cfxPlace() { CFX.raf = 0; if (CFX.el) CFX.el.style.transform = `translate(${CFX.x}px, ${CFX.y}px)`; }
function installCursorFx() {
  if (reduceMotion()) return;
  const el = document.createElement("div"); el.className = "cursor-fx"; el.setAttribute("aria-hidden", "true");
  el.innerHTML = `<i class="c1"></i><i class="c2"></i><i class="c3"></i><i class="c4"></i><b></b>`;
  document.body.appendChild(el); CFX.el = el;
  document.addEventListener("pointermove", ev => {
    if (ev.pointerType && ev.pointerType !== "mouse") return;
    CFX.x = ev.clientX; CFX.y = ev.clientY;
    const t = ev.target.closest?.(CLICKABLE); const on = Boolean(t) && !document.body.classList.contains("gesture");
    if (on !== CFX.on || t !== CFX.target) { CFX.on = on; CFX.target = t; el.classList.toggle("on", on); if (on) { el.classList.remove("hop"); void el.offsetWidth; el.classList.add("hop"); } }
    if (on && !CFX.raf) CFX.raf = requestAnimationFrame(cfxPlace);
  }, { passive: true });
  document.addEventListener("pointerdown", ev => { if (ev.target.closest?.(CLICKABLE)) el.classList.add("down"); }, true);
  document.addEventListener("pointerup", ev => {
    const was = el.classList.contains("down"); el.classList.remove("down");
    if (was && ev.target.closest?.(CLICKABLE) && typeof burst === "function") burst(ev.clientX, ev.clientY, 6);
    // 点击后界面常常重绘，按鼠标下面现在是什么重新判断一次
    setTimeout(() => { const t = document.elementFromPoint(CFX.x, CFX.y)?.closest?.(CLICKABLE); const on = Boolean(t); if (on !== CFX.on) { CFX.on = on; CFX.target = t; el.classList.toggle("on", on); } }, 120);
  }, true);
  document.addEventListener("pointerleave", () => { el.classList.remove("on"); CFX.on = false; });
}
