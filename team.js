"use strict";
// 帧比特 3.5 · TeamWork 协作室（演示版）
// 交付页的子选项：群组语音讨论创意、素材和成片。这一版是可演示的样态：队友和语音都是模拟的，
// 不会调用麦克风，也不会联网；评论、标注、修改请求和纪要会真实保存在项目里。

const TW = { open: false, tab: "idea", timers: [], step: 0, mic: false, speaking: "", micT: 0, voice: false, pinMode: false, sel: "" };
const TW_MEMBERS = [
  { id: "me", name: "我", role: "编导", c: "#FFD23F" },
  { id: "lin", name: "小林", role: "摄影", c: "#7BA4FF" },
  { id: "jie", name: "阿杰", role: "剪辑", c: "#3DD68C" },
  { id: "mia", name: "Mia", role: "运营", c: "#FF7EB0" }
];
const twMember = id => TW_MEMBERS.find(m => m.id === id) || TW_MEMBERS[0];
function twData(p) { p.team = { comments: [], requests: [], feed: [], notes: null, ...(p.team || {}) }; return p.team; }
function twMedia(p) {
  const out = [];
  p.script.forEach((r, i) => { if (r.imageUrl) out.push({ ref: `shot:${r.id}`, url: r.imageUrl, kind: "image", label: `分镜 ${String(i + 1).padStart(2, "0")}` }); });
  p.canvas.nodes.forEach(n => { const im = n.type !== "shot" ? nodeImage(p, n) : ""; const v = nodeVideo(n); if (im && !out.some(o => o.url === im)) out.push({ ref: `node:${n.id}`, url: im, kind: "image", label: nodeTitle(p, n) }); if (v && !out.some(o => o.url === v)) out.push({ ref: `node:${n.id}`, url: v, kind: "video", label: nodeTitle(p, n) }); });
  if (p.coverDesign?.backgroundImage && !out.some(o => o.url === p.coverDesign.backgroundImage)) out.push({ ref: "cover", url: p.coverDesign.backgroundImage, kind: "image", label: "封面背景" });
  return out;
}
const twFilm = p => { const clips = nodeByType(p, "cut")?.data.clips || []; return clips[0]?.url || twMedia(p).find(m => m.kind === "video")?.url || ""; };
const twTime = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// ---------- 演示对话：根据项目内容生成 ----------
function twScript(p) {
  const n = p.script.length; const k = Math.min(2, Math.max(1, n)); const media = twMedia(p);
  const cw = p.coverWords?.[0] || p.coverMainText || p.title || "这个封面字";
  const lines = [
    { who: "mia", text: `大家都进来了吗？今天过一下「${(p.title || "这条片子").slice(0, 18)}」，争取今天定稿。` },
    { who: "lin", text: n ? `我先说画面：第 ${k} 镜我想再推近一点，主体现在有点小，手机上看不清。` : "脚本还没写完？我先看看素材这边。", req: n ? `第 ${k} 镜改成近景，主体放大` : "" },
    { who: "jie", text: "开头三秒的节奏可以再快，字幕我按四个字一组切，第一句话之前不要留空。", req: "开头 3 秒提速，第一句前不留空" },
    { who: "me", text: "同意，钩子那句我再改短一点。" },
    { who: "mia", text: `封面字「${cw.slice(0, 12)}」我觉得可以，标题要不要再口语一点？评论区会更愿意接话。`, req: "标题再口语化一版" },
    { who: "lin", text: media.length ? `我在素材里标了一处，「${media[0].label}」右边背景有点乱，能不能换一张？` : "素材这边还没东西，我晚点把实拍的传上来。", pin: media.length ? { ref: media[0].ref, x: .72, y: .38, text: "背景有点乱，建议换一张" } : null },
    { who: "jie", text: twFilm(p) ? "成片我也看了，00:03 这里转场有点硬，我加一个闪白试试。" : "成片还没排，视频出来我就按分镜顺序粗剪一版。", stamp: twFilm(p) ? { t: 3, text: "转场有点硬，试一下闪白" } : null },
    { who: "mia", text: "那今天的分工：小林补拍，阿杰出两版剪辑，编导改钩子和标题。我让 Bit 把纪要整理一下。" }
  ];
  return lines;
}
function twSpeak(p, line) {
  const d = twData(p); const now0 = now();
  d.feed.push({ id: uid("tf"), who: line.who, text: line.text, time: now0, kind: "voice" });
  if (line.req) d.requests.push({ id: uid("tr"), who: line.who, text: line.req, done: false, time: now0 });
  if (line.pin) d.comments.push({ id: uid("tc"), who: line.who, text: line.pin.text, target: { tab: "media", ref: line.pin.ref, x: line.pin.x, y: line.pin.y }, time: now0, resolved: false });
  if (line.stamp) d.comments.push({ id: uid("tc"), who: line.who, text: line.stamp.text, target: { tab: "film", t: line.stamp.t }, time: now0, resolved: false });
  if (d.feed.length > 200) d.feed.splice(0, d.feed.length - 200);
  TW.speaking = line.who; touch(p); twRender();
  if (TW.voice && window.speechSynthesis && line.who !== "me") { try { const u = new SpeechSynthesisUtterance(line.text); u.lang = "zh-CN"; u.rate = 1.08; u.pitch = { lin: .9, jie: 1, mia: 1.25 }[line.who] || 1; speechSynthesis.speak(u); } catch (_) {} }
  const dur = clamp(line.text.length * 140, 1800, 5200);
  TW.timers.push(setTimeout(() => { if (TW.speaking === line.who) { TW.speaking = ""; twRenderMembers(); } }, dur));
}
function twPlayDemo(p, from = 0) {
  twStopDemo(); const lines = twScript(p); TW.step = from;
  const next = () => {
    if (!TW.open) return;
    if (TW.step >= lines.length) { const d = twData(p); d.feed.push({ id: uid("tf"), who: "sys", text: "演示对话结束。你可以继续评论、标注，或者让 Bit 整理纪要。", time: now(), kind: "sys" }); touch(p); twRender(); return; }
    twSpeak(p, lines[TW.step++]);
    TW.timers.push(setTimeout(next, 3800 + Math.random() * 2600));
  };
  TW.timers.push(setTimeout(next, 900));
}
function twStopDemo() { TW.timers.forEach(clearTimeout); TW.timers = []; TW.speaking = ""; try { window.speechSynthesis?.cancel(); } catch (_) {} }

// ---------- 渲染 ----------
const twAva = (m, size = "") => `<span class="tw-ava ${size}" style="--c:${m.c}" aria-hidden="true">${esc(m.name.slice(0, 1))}</span>`;
function twMembersHTML() {
  return TW_MEMBERS.map(m => { const me = m.id === "me"; const talk = TW.speaking === m.id || (me && TW.mic && TW.meLevel > .25); return `<div class="tw-m ${talk ? "talk" : ""}">${twAva(m)}<div><b>${esc(m.name)}${me ? "（你）" : ""}</b><span class="px faint">${esc(m.role)}${me ? (TW.mic ? " · 麦克风开" : " · 已静音") : " · 演示队友"}</span></div><span class="tw-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div>`; }).join("");
}
function twRenderMembers() { const el = $(".tw-members"); if (el) el.innerHTML = twMembersHTML(); }
function twTabHTML(p) {
  const d = twData(p);
  const cmts = tab => d.comments.filter(c => c.target?.tab === tab);
  if (TW.tab === "idea") {
    return `<div class="tw-idea"><div class="tw-card"><span class="px faint">选题</span><b>${esc(p.topic || p.title || "还没写选题")}</b>${p.style.positioning ? `<span class="dim">${esc(p.style.positioning)} · ${esc(p.style.contentType || "")}</span>` : ""}</div>
      ${p.script.length ? `<ol class="tw-lines">${p.script.map((r, i) => { const cs = d.comments.filter(c => c.target?.tab === "idea" && c.target.ref === r.id); return `<li class="${TW.sel === r.id ? "on" : ""}"><button class="tw-line" data-act="tw-sel" data-id="${attr(r.id)}"><span class="px faint">${String(i + 1).padStart(2, "0")}　${esc(r.time)}</span><span>${esc(r.voice || r.shot || "（空镜头）")}</span>${cs.length ? `<em class="px">${cs.length} 条</em>` : ""}</button>${cs.map(c => twCommentHTML(c)).join("")}${TW.sel === r.id ? `<form class="tw-cform" data-tw-form="idea:${attr(r.id)}"><input placeholder="对这一镜说点什么…" maxlength="200"><button class="btn primary sm">评论</button></form>` : ""}</li>`; }).join("")}</ol>` : `<p class="empty-line">还没有脚本。脚本写好后，大家可以逐镜评论。</p>`}</div>`;
  }
  if (TW.tab === "media") {
    const media = twMedia(p);
    return media.length ? `<p class="tw-tip px faint">${TW.pinMode ? "点图片上的任意位置放一个标注" : "点「标注」后在图片上点一下，就能把意见钉在那个位置"}</p><div class="tw-media">${media.map(m => { const pins = cmts("media").filter(c => c.target.ref === m.ref); return `<figure class="tw-fig ${TW.pinMode ? "pin" : ""}" data-tw-fig="${attr(m.ref)}">${m.kind === "video" ? `<video src="${attr(m.url)}" muted preload="metadata"></video>` : `<img src="${attr(m.url)}" alt="">`}${pins.map((c, i) => `<button class="tw-pin ${c.resolved ? "done" : ""}" style="left:${c.target.x * 100}%;top:${c.target.y * 100}%;--c:${twMember(c.who).c}" data-act="tw-focus" data-id="${attr(c.id)}" title="${attr(c.text)}">${i + 1}</button>`).join("")}<figcaption class="px">${esc(m.label)}${pins.length ? `　· ${pins.length} 处标注` : ""}</figcaption></figure>`; }).join("")}</div>` : `<p class="empty-line">项目里还没有画面和视频。生成或上传后，这里可以逐张标注。</p>`;
  }
  const film = twFilm(p);
  const stamps = cmts("film").sort((a, b) => a.target.t - b.target.t);
  return film ? `<div class="tw-film"><video data-tw-video src="${attr(film)}" controls preload="metadata"></video><div class="tw-marks" data-tw-marks>${stamps.map(c => `<button class="tw-mark" data-act="tw-seek" data-t="${c.target.t}" style="--c:${twMember(c.who).c}" data-pct="${c.target.t}" title="${attr(`${twTime(c.target.t)} ${c.text}`)}"></button>`).join("")}</div>
    <form class="tw-cform" data-tw-form="film"><span class="px faint" data-tw-now>在 00:00</span><input placeholder="在当前时间点留一条意见…" maxlength="200"><button class="btn primary sm">加到时间线</button></form>
    <div class="tw-stamps">${stamps.map(c => `<div class="tw-stamp"><button class="px" data-act="tw-seek" data-t="${c.target.t}">${twTime(c.target.t)}</button>${twCommentHTML(c)}</div>`).join("") || `<p class="dim" style="font-size:13px">播放到需要改的地方，暂停，写一条意见，它会钉在时间线上。</p>`}</div></div>` : `<p class="empty-line">还没有成片。在「成片」里把视频排进时间线后，这里可以按时间点讨论。</p>`;
}
function twCommentHTML(c) { const m = twMember(c.who); return `<div class="tw-c ${c.resolved ? "done" : ""}" data-tw-c="${attr(c.id)}">${twAva(m, "s")}<span><b>${esc(m.name)}</b>${esc(c.text)}</span><button class="tw-ok" data-act="tw-resolve" data-id="${attr(c.id)}" title="${c.resolved ? "重新打开" : "标记已解决"}">${c.resolved ? "已解决" : "解决"}</button></div>`; }
function twSideHTML(p) {
  const d = twData(p); const open = d.requests.filter(r => !r.done).length;
  const n = d.notes;
  return `<div class="tw-sec"><div class="tw-sec-h"><b class="px">修改请求</b><span class="px faint">${open} 项待办</span></div><div class="tw-reqs">${d.requests.map(r => `<label class="tw-req ${r.done ? "done" : ""}"><input type="checkbox" data-in="tw-req" data-id="${attr(r.id)}" ${r.done ? "checked" : ""}>${twAva(twMember(r.who), "s")}<span>${esc(r.text)}</span></label>`).join("") || `<p class="dim" style="font-size:13px">讨论里提到的修改会自动记到这里。</p>`}</div>
    <form class="tw-cform" data-tw-form="req"><input placeholder="加一条修改请求…" maxlength="120"><button class="btn line sm">添加</button></form></div>
    <div class="tw-sec"><div class="tw-sec-h"><b class="px">会议纪要</b><button class="btn line sm" data-act="tw-notes">${icon("spark")}Bit 整理纪要</button></div>${n ? `<div class="tw-notes"><p>${esc(n.summary)}</p>${(n.decisions || []).length ? `<span class="px faint">决定</span><ul>${n.decisions.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${(n.todos || []).length ? `<span class="px faint">分工</span><ul>${n.todos.map(x => `<li><b>${esc(x.owner)}</b>　${esc(x.task)}</li>`).join("")}</ul>` : ""}${(n.risks || []).length ? `<span class="px faint">风险</span><ul>${n.risks.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}<div class="tw-row"><span class="px faint">${esc(n.model || "")}　${when(n.time)}</span><button class="btn quiet sm" data-act="tw-notes-copy">复制纪要</button></div></div>` : `<p class="dim" style="font-size:13px">让 Bit 把语音讨论、评论和修改请求整理成一份纪要。</p>`}</div>`;
}
function twFeedHTML(p) {
  const d = twData(p);
  return d.feed.slice(-60).map(f => f.who === "sys" ? `<div class="tw-f sys px faint">${esc(f.text)}</div>` : `<div class="tw-f ${f.who === "me" ? "me" : ""}">${twAva(twMember(f.who), "s")}<div><span class="px faint">${esc(twMember(f.who).name)}　${f.kind === "voice" ? "语音转文字" : "消息"}</span><p>${esc(f.text)}</p></div></div>`).join("") || `<p class="dim" style="font-size:13px;padding:8px">通话开始后，大家说的话会实时转成文字出现在这里。</p>`;
}
function twRender() {
  if (!TW.open) return; const p = project(); if (!p) return closeTeam();
  const main = $(".tw-tabbody"); const side = $(".tw-side"); const feed = $(".tw-feed");
  if (main) { const sc = main.scrollTop; main.innerHTML = twTabHTML(p); main.scrollTop = sc; twBindTab(p); }
  if (side) side.innerHTML = twSideHTML(p);
  if (feed) { feed.innerHTML = twFeedHTML(p); feed.scrollTop = feed.scrollHeight; }
  twRenderMembers();
  $$(".tw-tabs [data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === TW.tab));
  const pinBtn = $("[data-act='tw-pin-mode']"); if (pinBtn) { pinBtn.classList.toggle("on", TW.pinMode); pinBtn.hidden = TW.tab !== "media"; }
  const micBtn = $("[data-act='tw-mic']"); if (micBtn) { micBtn.classList.toggle("on", TW.mic); micBtn.querySelector("span").textContent = TW.mic ? "静音" : "开麦"; }
}
function twBindTab(p) {
  const v = $("[data-tw-video]");
  if (v) {
    const marks = $("[data-tw-marks]");
    const place = () => { const dur = v.duration || 0; if (!dur) return; $$(".tw-mark", marks).forEach(b => { b.style.left = `${clamp(Number(b.dataset.pct) / dur, 0, 1) * 100}%`; }); };
    v.addEventListener("loadedmetadata", place); place();
    v.addEventListener("timeupdate", () => { const n = $("[data-tw-now]"); if (n) n.textContent = `在 ${twTime(v.currentTime)}`; });
  }
  $$("[data-tw-fig]").forEach(fig => fig.addEventListener("click", ev => {
    if (!TW.pinMode || ev.target.closest(".tw-pin")) return;
    const r = fig.getBoundingClientRect(); const x = clamp((ev.clientX - r.left) / r.width, .03, .97), y = clamp((ev.clientY - r.top) / r.height, .03, .97);
    $$(".tw-pinform").forEach(f => f.remove());
    const f = document.createElement("form"); f.className = "tw-cform tw-pinform"; f.style.left = `${x * 100}%`; f.style.top = `${y * 100}%`;
    f.innerHTML = `<input placeholder="这里要改什么？" maxlength="160"><button class="btn primary sm">钉上</button>`;
    fig.appendChild(f); const inp = $("input", f); inp.focus();
    inp.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Escape") f.remove(); });
    f.addEventListener("click", e => e.stopPropagation());
    f.addEventListener("submit", e => { e.preventDefault(); const t = inp.value.trim(); if (!t) return; twData(p).comments.push({ id: uid("tc"), who: "me", text: t, target: { tab: "media", ref: fig.dataset.twFig, x, y }, time: now(), resolved: false }); twData(p).feed.push({ id: uid("tf"), who: "me", text: `在素材上标注：${t}`, time: now(), kind: "msg" }); TW.pinMode = false; touch(p); twRender(); });
  }));
}
function openTeam() {
  const p = project(); if (!p || TW.open) return;
  twData(p); TW.open = true; TW.tab = "idea"; TW.mic = false; TW.pinMode = false; TW.sel = "";
  const el = document.createElement("div"); el.className = "tw"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "TeamWork 协作室");
  el.innerHTML = `<header class="tw-top"><span class="tw-logo">${icon("team")}</span><div class="tw-ttl"><b class="px">TeamWork 协作室</b><span class="px faint">${esc(p.title || "未命名项目")}</span></div><span class="tw-demo px">演示版 · 队友与语音为模拟</span><span class="grow"></span><span class="tw-live px"><i></i>通话中 <em data-tw-clock>00:00</em></span><button class="btn line sm" data-act="tw-invite">邀请成员</button><button class="btn quiet sm" data-act="tw-close">${icon("x")}离开</button></header>
    <div class="tw-main">
      <aside class="tw-left"><span class="px faint">在线 ${TW_MEMBERS.length}</span><div class="tw-members"></div>
        <div class="tw-ctrl"><button class="tw-btn" data-act="tw-mic">${icon("mic")}<span>开麦</span></button><button class="tw-btn ${TW.voice ? "on" : ""}" data-act="tw-voice" title="用系统语音朗读演示队友说的话">${icon("audio")}<span>朗读</span></button><button class="tw-btn" data-act="tw-replay">${icon("play")}<span>重新演示</span></button></div>
        <p class="tw-note px faint">演示版不会打开麦克风。开麦后，在下方打字，就当是你说的话。</p></aside>
      <section class="tw-center"><nav class="seg tw-tabs">${[["idea", "创意"], ["media", "素材"], ["film", "成片"]].map(([k, l]) => `<button data-act="tw-tab" data-tab="${k}">${l}</button>`).join("")}<button class="tw-pinbtn" data-act="tw-pin-mode" hidden>${icon("plus")}标注</button></nav><div class="tw-tabbody"></div>
        <div class="tw-feedwrap"><div class="tw-feed" role="log" aria-live="polite"></div><form class="tw-say" data-tw-form="say"><input placeholder="说点什么（演示：打字代替语音）…" maxlength="300"><button class="btn primary sm">发送</button></form></div></section>
      <aside class="tw-side"></aside></div>`;
  document.body.appendChild(el);
  el.addEventListener("pointerdown", ev => ev.stopPropagation());
  el.addEventListener("submit", ev => {
    const f = ev.target.closest("[data-tw-form]"); if (!f) return; ev.preventDefault();
    const inp = $("input", f); const t = inp?.value.trim(); if (!t) return; inp.value = "";
    const d = twData(p); const kind = f.dataset.twForm;
    if (kind === "say") { d.feed.push({ id: uid("tf"), who: "me", text: t, time: now(), kind: TW.mic ? "voice" : "msg" }); if (/改|换|调整|删|加/.test(t) && t.length < 60) d.requests.push({ id: uid("tr"), who: "me", text: t, done: false, time: now() }); TW.speaking = TW.mic ? "me" : ""; setTimeout(() => { if (TW.speaking === "me") { TW.speaking = ""; twRenderMembers(); } }, 1800); }
    else if (kind === "req") d.requests.push({ id: uid("tr"), who: "me", text: t, done: false, time: now() });
    else if (kind === "film") { const v = $("[data-tw-video]"); d.comments.push({ id: uid("tc"), who: "me", text: t, target: { tab: "film", t: +(v?.currentTime || 0).toFixed(1) }, time: now(), resolved: false }); }
    else if (kind.startsWith("idea:")) d.comments.push({ id: uid("tc"), who: "me", text: t, target: { tab: "idea", ref: kind.slice(5) }, time: now(), resolved: false });
    touch(p); twRender();
  });
  el.addEventListener("keydown", ev => { if (ev.target.matches("input,textarea")) ev.stopPropagation(); });
  EXT_ESC.push(twEscape);
  twRender(); requestAnimationFrame(() => el.classList.add("in"));
  const t0 = Date.now(); TW.clock = setInterval(() => { const c = $("[data-tw-clock]"); if (c) c.textContent = twTime((Date.now() - t0) / 1000); if (TW.mic) { TW.meLevel = Math.random(); const me = $(".tw-m"); me?.classList.toggle("talk", TW.meLevel > .45); } }, 500);
  if (!twData(p).feed.length) twPlayDemo(p); else { twData(p).feed.push({ id: uid("tf"), who: "sys", text: "回到了协作室。点「重新演示」可以再看一遍语音讨论。", time: now(), kind: "sys" }); twRender(); }
}
function twEscape() { if ($(".tw-pinform")) { $$(".tw-pinform").forEach(f => f.remove()); return; } if (TW.pinMode) { TW.pinMode = false; twRender(); return; } closeTeam(); }
function closeTeam() {
  if (!TW.open) return; TW.open = false; twStopDemo(); clearInterval(TW.clock);
  const i = EXT_ESC.indexOf(twEscape); if (i >= 0) EXT_ESC.splice(i, 1);
  const el = $(".tw"); if (el) { if (reduceMotion()) el.remove(); else { el.classList.remove("in"); el.classList.add("out"); setTimeout(() => el.remove(), 200); } }
  if (route.view === "project") renderProject();
}
async function twNotes(btn) {
  const p = project(); const d = twData(p);
  const log = [...d.feed.filter(f => f.who !== "sys").map(f => `${twMember(f.who).name}（${twMember(f.who).role}）：${f.text}`), ...d.comments.map(c => `${twMember(c.who).name}的${c.target.tab === "film" ? `时间点 ${twTime(c.target.t)} ` : c.target.tab === "media" ? "素材" : "脚本"}评论：${c.text}${c.resolved ? "（已解决）" : ""}`), ...d.requests.map(r => `修改请求${r.done ? "（已完成）" : ""}：${r.text}（${twMember(r.who).name}）`)].join("\n");
  if (!log.trim()) return toast("还没有讨论内容", 2400, "err");
  if (!apiState.connected) {
    const todo = d.requests.filter(r => !r.done);
    d.notes = { summary: `这次讨论了「${p.title || "这条片子"}」的画面、节奏和包装，共 ${d.feed.filter(f => f.who !== "sys").length} 条发言、${d.comments.length} 条评论。`, decisions: d.requests.filter(r => r.done).map(r => r.text), todos: todo.map(r => ({ owner: twMember(r.who).name === "我" ? "编导" : twMember(r.who).name, task: r.text })), risks: d.comments.filter(c => !c.resolved).slice(0, 3).map(c => c.text), model: "本机整理（连接模型后由 AI 整理）", time: now() };
    touch(p); twRender(); return;
  }
  busy(btn, true, "整理中"); TW.notesBusy = true;
  try { const r = await postJson("/api/generate", { action: "team_notes", area: "text.writing", project: slimProject(p), account: {}, selectedText: log.slice(0, 12000), instruction: "" }); d.notes = { ...r.result, model: r.model || "", time: now() }; touch(p); petEvent("text"); twRender(); toast("纪要整理好了"); }
  catch (e) { toast(e.message, 5000, "err"); }
  finally { TW.notesBusy = false; busy(btn, false); }
}
function teamCardHTML(p) {
  const d = p.team || {}; const open = (d.requests || []).filter(r => !r.done).length; const cm = (d.comments || []).length;
  return `<div class="blk"><span class="px faint">协作</span><button class="team-card" data-act="team-open"><span class="tc-ico">${icon("team")}</span><span class="tc-t"><b>TeamWork 协作室</b><span class="dim">拉上摄影、剪辑和运营，一起语音过创意、素材和成片，边聊边标注、记修改</span></span><span class="tc-avas">${TW_MEMBERS.map(m => twAva(m, "s")).join("")}</span><span class="tc-st px faint">${cm || open ? `${cm} 条评论 · ${open} 项待改` : "演示版"}</span><span class="arrow">→</span></button></div>`;
}
Object.assign(EXT_ACTS, {
  "team-open": () => openTeam(),
  "tw-close": () => closeTeam(),
  "tw-tab": el => { TW.tab = el.dataset.tab; TW.pinMode = false; twRender(); },
  "tw-sel": el => { TW.sel = TW.sel === el.dataset.id ? "" : el.dataset.id; twRender(); setTimeout(() => $(".tw-lines li.on input")?.focus(), 30); },
  "tw-pin-mode": () => { TW.pinMode = !TW.pinMode; twRender(); },
  "tw-resolve": el => { const p = project(); const c = twData(p).comments.find(x => x.id === el.dataset.id); if (!c) return; c.resolved = !c.resolved; touch(p); twRender(); },
  "tw-focus": el => { const c = $(`[data-tw-c="${CSS.escape(el.dataset.id)}"]`); if (c) { c.scrollIntoView({ block: "center" }); c.classList.add("flash"); setTimeout(() => c.classList.remove("flash"), 900); } else { const p = project(); const cm = twData(p).comments.find(x => x.id === el.dataset.id); if (cm) toast(`${twMember(cm.who).name}：${cm.text}`, 3200); } },
  "tw-seek": el => { const v = $("[data-tw-video]"); if (v) { v.currentTime = Number(el.dataset.t) || 0; v.play().catch(() => {}); } },
  "tw-mic": () => { TW.mic = !TW.mic; twRender(); toast(TW.mic ? "演示：麦克风已「打开」，在下方打字就当是你说的话" : "已静音", 2600); $(".tw-say input")?.focus(); },
  "tw-voice": el => { if (!window.speechSynthesis) return toast("这个浏览器不支持朗读", 2400, "err"); TW.voice = !TW.voice; el.classList.toggle("on", TW.voice); if (!TW.voice) speechSynthesis.cancel(); toast(TW.voice ? "会用系统语音朗读队友的话" : "已关闭朗读", 1800); },
  "tw-replay": () => { const p = project(); const d = twData(p); d.feed.push({ id: uid("tf"), who: "sys", text: "重新开始演示……", time: now(), kind: "sys" }); touch(p); twRender(); twPlayDemo(p); },
  "tw-invite": async () => { const p = project(); const link = `framebit://teamwork/${p.id}?demo=1`; try { await navigator.clipboard.writeText(link); } catch (_) {} toast("演示版：邀请链接已复制（真实多人协作会在后续版本加入）", 3600); },
  "tw-notes": el => twNotes(el),
  "tw-notes-copy": async () => { const p = project(); const n = twData(p).notes; if (!n) return; const txt = [`TeamWork 纪要 · ${p.title}`, n.summary, "", "决定：", ...(n.decisions || []).map(x => `- ${x}`), "", "分工：", ...(n.todos || []).map(x => `- ${x.owner}：${x.task}`), "", "风险：", ...(n.risks || []).map(x => `- ${x}`)].join("\n"); try { await navigator.clipboard.writeText(txt); toast("纪要已复制"); } catch (_) { download(`${p.title}-协作纪要.txt`, txt); } }
});
Object.assign(EXT_INS, {
  "tw-req": (el, t) => { if (t !== "change") return; const p = project(); const r = twData(p).requests.find(x => x.id === el.dataset.id); if (!r) return; r.done = el.checked; touch(p); twRender(); }
});
