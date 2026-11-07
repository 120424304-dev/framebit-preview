"use strict";
// 自动生成：来自 server.mjs（帧比特 Mac 版本地服务）的 Schema 和提示词。不要手改，重新运行 gen-prompts.mjs。
(() => {
const item = (properties, required = Object.keys(properties)) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required
});

const scriptRow = item({
  time: { type: "string" },
  shot: { type: "string" },
  voice: { type: "string" },
  subtitle: { type: "string" },
  note: { type: "string" }
});

const reviewRow = item({
  level: { type: "string", enum: ["通过", "需注意", "必须修改"] },
  issue: { type: "string" },
  fix: { type: "string" }
});

const directorAction = item({
  type: { type: "string", enum: ["navigate", "set_stage", "select_project", "update_project", "update_style", "update_script", "update_packaging", "update_account", "create_project", "add_node", "update_node", "connect_nodes", "delete_node", "run_ai", "run_canvas", "sync_timeline", "fullscreen_canvas", "export"] },
  target: { type: "string" },
  field: { type: "string" },
  value: { type: "string" },
  instruction: { type: "string" }
});

const SCHEMAS = {
  full: item({
    script: { type: "array", items: scriptRow },
    titles: { type: "array", items: { type: "string" } },
    coverWords: { type: "array", items: { type: "string" } },
    publishCopy: { type: "string" },
    review: { type: "array", items: reviewRow },
    coverPlan: { type: "string" },
    rationale: { type: "array", items: { type: "string" } }
  }),
  script: item({
    script: { type: "array", items: scriptRow },
    rationale: { type: "array", items: { type: "string" } }
  }),
  packaging: item({
    titles: { type: "array", items: { type: "string" } },
    coverWords: { type: "array", items: { type: "string" } },
    publishCopy: { type: "string" },
    coverPlan: { type: "string" },
    rationale: { type: "array", items: { type: "string" } }
  }),
  review: item({
    review: { type: "array", items: reviewRow },
    summary: { type: "string" },
    rationale: { type: "array", items: { type: "string" } }
  }),
  rewrite: item({
    rewritten: { type: "string" },
    rationale: { type: "array", items: { type: "string" } }
  }),
  style_map: item({
    positioning: { type: "string" },
    contentType: { type: "string" },
    platformTone: { type: "string" },
    audience: { type: "string" },
    voice: { type: "string" },
    duration: { type: "string" },
    pace: { type: "string" },
    structure: { type: "string" },
    hook: { type: "string" },
    visual: { type: "string" },
    cover: { type: "string" },
    cta: { type: "string" },
    risk: { type: "string" },
    discovery: { type: "string" },
    rationale: { type: "array", items: { type: "string" } }
  }),
  canvas_polish: item({
    text: { type: "string" }
  }),
  canvas_prompt: item({
    prompt: { type: "string" }
  }),
  canvas_split: item({
    title: { type: "string" },
    script: { type: "string" },
    shots: { type: "array", items: item({
      name: { type: "string" },
      size: { type: "string" },
      camera: { type: "string" },
      duration: { type: "string" },
      prompt: { type: "string" }
    }) }
  }),
  remake_breakdown: item({
    title: { type: "string" },
    summary: { type: "string" },
    hook: { type: "string" },
    structure: { type: "array", items: item({ part: { type: "string" }, time: { type: "string" }, purpose: { type: "string" } }) },
    rhythm: { type: "string" },
    visual: { type: "string" },
    audio: { type: "string" },
    shots: { type: "array", items: item({ time: { type: "string" }, shot: { type: "string" }, camera: { type: "string" }, voice: { type: "string" }, subtitle: { type: "string" }, purpose: { type: "string" } }) },
    techniques: { type: "array", items: { type: "string" } },
    cautions: { type: "array", items: { type: "string" } }
  }),
  remake_script: item({
    title: { type: "string" },
    script: { type: "array", items: scriptRow },
    shots: { type: "array", items: item({ name: { type: "string" }, size: { type: "string" }, camera: { type: "string" }, duration: { type: "string" }, prompt: { type: "string" } }) },
    rationale: { type: "array", items: { type: "string" } }
  }),
  team_notes: item({
    summary: { type: "string" },
    decisions: { type: "array", items: { type: "string" } },
    todos: { type: "array", items: item({ owner: { type: "string" }, task: { type: "string" } }) },
    risks: { type: "array", items: { type: "string" } }
  }),
  ip_profile: item({
    name: { type: "string" },
    tagline: { type: "string" },
    personality: { type: "string" },
    backstory: { type: "string" },
    voice: { type: "string" },
    catchphrases: { type: "array", items: { type: "string" } },
    look: { type: "string" },
    palette: { type: "array", items: { type: "string" } },
    outfits: { type: "array", items: { type: "string" } },
    rules: { type: "array", items: { type: "string" } },
    relations: { type: "string" },
    prompt: { type: "string" },
    negative: { type: "string" },
    expressions: { type: "array", items: { type: "string" } },
    ideas: { type: "array", items: { type: "string" } }
  }),
  ip_topics: item({
    topics: { type: "array", items: item({ title: { type: "string" }, hook: { type: "string" }, format: { type: "string" } }) }
  }),
  ip_check: item({
    score: { type: "integer" },
    verdict: { type: "string" },
    issues: { type: "array", items: { type: "string" } }
  }),
  director: item({
    reply: { type: "string" },
    actions: { type: "array", items: directorAction },
    suggestions: { type: "array", items: { type: "string" } }
  })
};

const IP_KIND = { virtual: "虚拟角色", creator: "真人博主人设", brand: "品牌 / 产品吉祥物" };
const IP_PERSONA = "你是资深 IP 角色设计师和内容策划，为短视频账号设计能长期运营的原创角色。设定要具体、一致、能落到画面和台词上；不模仿已有的知名角色、明星或品牌形象；不编造真人的经历和数据。";
function castBlock(cast) {
  const list = (Array.isArray(cast) ? cast : []).filter(c => c && c.name).slice(0, 3);
  if (!list.length) return "";
  const one = (c, i) => [`${i === 0 ? "主角" : "配角"}「${String(c.name).slice(0, 20)}」（${IP_KIND[c.kind] || "虚拟角色"}）`, c.tagline && `一句话：${c.tagline}`, c.personality && `性格：${c.personality}`, c.voice && `说话方式：${c.voice}`, c.catchphrases?.length && `口头禅：${c.catchphrases.slice(0, 5).join(" / ")}`, c.look && `固定外观：${c.look}`, c.rules?.length && `禁忌：${c.rules.slice(0, 6).join("；")}`].filter(Boolean).map(x => String(x).slice(0, 400)).join("\n  ");
  return `出镜 IP（台词要用 IP 的口吻和口头禅，不能违反禁忌；IP 出镜的镜头，画面描述里必须写出 IP 的名字，方便生成画面时套用它的固定形象）：\n  ${list.map(one).join("\n  ")}`;
}

function promptFor(action, project = {}, account = {}, instruction = "", selectedText = "") {
  const dna = `账号名称：${account.name || "未命名账号"}\n账号定位：${account.position || "未设置"}\n目标用户：${account.audience || "未设置"}\n人设语气：${account.tone || "自然、专业"}\n常用结构：${account.structure || "钩子—观点—论证—收尾"}\n禁用表达：${account.forbidden || "无"}\n封面规范：${account.cover || "清晰醒目"}\n审稿规则：${account.review || "避免绝对化与未经证实信息"}`;
  const style = project.styleProfile || {};
  const styleMap = `风格签名：${style.signature || `${project.platform || "抖音"} · ${project.positioningLabel || "默认定位"} · ${project.type || "默认类型"}`}\n平台原生调性：${style.platformTone || "遵循平台原生表达"}\n分发逻辑：${style.discovery || "清晰表达并承接用户预期"}\n目标受众：${style.audience || "未设置"}\n表达语气：${style.voice || "自然、专业"}\n时长与节奏：${style.duration || "匹配内容类型"} · ${style.pace || "自然"}\n内容结构：${style.structure || "钩子—展开—结论"}\n开场钩子：${style.hook || "快速说明主题"}\n画面语言：${style.visual || "主体清楚"}\n封面规范：${style.cover || "主题明确"}\n互动方式：${style.cta || "自然互动"}\n风险边界：${style.risk || "避免虚假、误导和绝对化"}`;
  const cast = castBlock(project.cast);
  const context = `项目标题：${project.title || "未命名项目"}\n平台：${project.platform || "抖音"}\n账号定位：${project.positioningLabel || style.positioningLabel || "未设置"}\n内容类型：${project.type || style.contentTypeLabel || "未设置"}\n补充要求：${project.brief || "无"}\n${cast ? `${cast}\n` : ""}项目风格画像（脚本、标题、画面、封面、互动和审稿都必须继承）：\n${styleMap}\n账号 DNA：\n${dna}\n执行优先级：合规与事实边界最高；其次遵循用户本轮明确要求；再严格继承项目风格画像与账号 DNA。不得把不同平台的固定套路混用。\n当前项目 JSON：\n${JSON.stringify(project)}`;
  const tasks = {
    full: "完成整套短视频编导工作流。脚本应可直接拍摄，时间段连续且总时长匹配内容类型；生成 4 个标题、4 个封面字、发布文案、封面方案，并按账号规则审稿。",
    script: "生成或重写可直接拍摄的分镜脚本。画面描述必须具体，口播自然，字幕精炼，时间段连续。保留项目已有的有效观点。",
    packaging: "基于当前脚本生成 4 个差异化标题、4 个 6-10 字封面字、发布文案和可执行封面方案，避免同义重复。",
    review: "运行内容审稿。分别检查事实可信度、平台风险、品牌调性、逻辑结构和表达质量。不要虚构事实；无法确认的内容要提示人工核验。",
    rewrite: `只重写用户选中的文本。原文：${selectedText || "无"}\n修改要求：${instruction || "更自然、更精炼、更符合账号语气"}`,
    style_map: `根据用户的大致思路，发散一份可以直接作为项目长期记忆的完整短视频风格画像。不要给多个候选，不要照抄平台通用模板；要结合选题、平台、账号 DNA 和用户思路做出明确判断。账号定位和内容类型必须是具体、可执行的自由文本。其余字段分别写清平台调性、目标受众、语气、时长、节奏、结构、钩子、画面、封面、互动、风险和分发逻辑。每个字段控制在 20-100 个中文字，字段之间不要重复。`,
    canvas_polish: `润色画布文本节点里的这段文字。保持原意、语言和大致篇幅，让它更具体、更有画面感、更适合作为短视频创作素材；不要加标题、引号或解释，只把润色后的正文放进 text。\n原文：${selectedText || "（空）"}\n要求：${instruction || "更具体、更有画面感"}`,
    canvas_prompt: `把用户的想法扩写成一条用于 AI ${/视频/.test(instruction) ? "视频" : /音乐|配乐|音频/.test(instruction) ? "音乐" : "图片"}生成的中文提示词，放进 prompt。不超过 80 个汉字，依次写清主体、动作、场景、光线、镜头和画面风格；音乐则写清情绪、风格、乐器和速度。不要解释。\n想法：${selectedText || "（空，根据上游素材判断）"}\n上游素材与要求：${instruction || "无"}`,
    canvas_split: `把下面的创意或脚本拆成可拍摄的分镜。title 是一句话标题；script 是整理后的完整脚本正文；shots 4-8 个，每个 name 4-8 个字，size 是景别（远景/全景/中景/近景/特写），camera 是运镜，duration 是秒数（如 "3"），prompt 是可直接用于生图的中文画面提示词（60 字以内，所有镜头统一主角外观、场景和画面风格，不要出现文字）。\n内容：${selectedText || "（空）"}${instruction ? `\n要求：${instruction}` : ""}`,
    remake_breakdown: `拆解一支已经发布的短视频成片，为“复刻它的结构与节奏、但做成我们自己的内容”做准备。${(selectedText || "").trim() ? "" : "没有提供关键帧时，只根据文字描述拆解，拿不准的地方写“需人工确认”。"}
你会收到按时间顺序抽取的关键帧（如果有）和下面的信息。请输出：title 给这支片子起一个概括性的名字；summary 两三句话说清它讲了什么、为什么能留住人；hook 前三秒用了什么钩子；structure 按段落拆（part 段落名、time 时间段、purpose 这一段的作用）；rhythm 剪辑节奏与时长分配；visual 画面语言（景别、色调、字幕样式、转场）；audio 声音设计（口播语气、配乐、音效，看不出来就写推测并注明）；shots 逐镜拆解（time、shot 画面内容、camera 景别与运镜、voice 推测口播或旁白、subtitle 屏幕字、purpose 作用），不超过 16 镜；techniques 可以借鉴的手法 3-6 条；cautions 复刻时要避开的地方（版权素材、人物肖像、原创台词、平台搬运风险）2-4 条。不要编造画面里看不到的具体数据和人名。
片子信息：${selectedText || "（无）"}
用户补充：${instruction || "无"}`,
    remake_script: `基于下面这份成片拆解，按用户的新需求复刻一支新的短视频：借用原片的结构、节奏、钩子类型和镜头语言，但内容、台词、人物和素材全部替换成新的，不照搬原片的原创台词和画面。script 是可直接拍摄的分镜脚本（time 连续、shot 画面、voice 口播、subtitle 字幕、note 写这一镜对应原片哪一段的手法）；shots 与 script 一一对应，每个 name 4-8 个字、size 景别、camera 运镜、duration 秒数、prompt 60 字以内可直接生图的中文画面提示词（统一主角外观与画面风格，不出现文字）；rationale 3-5 条说明哪里借鉴了原片、哪里做了替换。
原片拆解：${selectedText || "（无）"}
新需求：${instruction || "保持原片结构，换成当前项目的选题"}`,
    ip_profile: `为短视频账号设计一个原创 IP 角色的完整设定，后面会用它定妆、出三视图、做表情包，并在很多条视频里反复出镜，所以设定必须具体、稳定、可执行。
IP 类型：${IP_KIND[project.ipKind] || "虚拟角色"}。${project.ipKind === "creator" ? "这是真人博主本人的人设：不要虚构他的真实经历、身份和资历，只提炼说话方式、标志性形象和内容人格；外观以用户提供的素材和描述为准。" : "必须是原创形象，不要模仿任何已有的知名角色、明星、品牌吉祥物或受版权保护的形象。"}
字段要求：name 名字（2-6 字，好记、能当账号名）；tagline 一句话介绍（20 字以内）；personality 性格（3-5 个具体特质，用分号隔开）；backstory 背景故事（80-160 字）；voice 说话方式（语速、句式、用词习惯）；catchphrases 3-5 句口头禅；look 固定外观（体型、脸、发型、服装、标志性配饰，越具体越好，这段会被反复用来保证形象一致）；palette 3-5 个主色，写成 #RRGGBB；outfits 2-4 套常用服装；rules 3-6 条禁忌（这个 IP 绝不做、绝不说的事）；relations 和其他角色或观众的关系（没有就写“无”）；prompt 一段用于 AI 生图的外观锚点描述（中文，80-160 字，只写外观、画风和固定特征，不写动作和场景）；negative 生图时要避免的特征（如“不要眼镜、不要写实人脸”）；expressions 8 个适合做表情包的情绪或动作（每个 2-4 字）；ideas 3 个适合这个 IP 的内容方向。
${selectedText ? `已有信息 / 素材说明：${selectedText}` : ""}
用户的想法：${instruction || "（没写，按账号和类型设计）"}`,
    ip_topics: `为这个 IP 想 6 个短视频选题，要发挥它的人设和口头禅，适合在${project.platform || "抖音"}发布。每个 title 是一句话选题（20 字以内），hook 是开场第一句怎么抓人（用 IP 的口吻），format 是形式（如“口播”“情景短剧”“表情包合集”“Vlog”）。不要编造热点和数据。
IP 设定：${selectedText || "（无）"}
补充要求：${instruction || "无"}`,
    ip_check: `你会收到两张图：第一张是 IP 的定妆照（标准形象），第二张是新生成的图。对照 IP 设定，判断第二张里的角色是不是同一个形象。score 0-100（90 以上基本一致，70-89 有小偏差，70 以下明显不是同一个角色）；verdict 一句话结论；issues 列出具体偏差（发型、脸型、服装、配色、配饰、比例），没有就给空数组。只根据画面判断，看不清的地方写“无法确认”。
IP 设定：${selectedText || "（无）"}`,
    team_notes: `把下面这段团队协作室里的讨论整理成会议纪要。summary 两三句话；decisions 已经达成一致的决定；todos 每条写 owner（负责人，没提到就写“待定”）和 task；risks 还没解决的分歧或风险。只根据记录整理，不要补充记录里没有的内容。
讨论记录：${selectedText || "（空）"}`,
    director: `你是常驻帧比特（FRAMEBIT）中的“AI 编导”，是用户随时可唤起的项目工作助理。先理解对话，再给出简洁、可执行的中文回复。你可以读取当前项目、账号 DNA、脚本、包装、审稿结果、画布节点和粗剪状态，并通过 actions 请求帧比特执行动作。

帧比特的结构：一个项目就是一张画布。画布上的结构节点依次是 选题(topic) → 风格画像(style) → 脚本(script) → 分镜(shot，每句脚本一个) → 画面素材(图片 image / 视频 video) → 成片(cut，粗剪时间线) → 发布物料(publish：标题、封面字、发布文案、封面方案、审稿)。另有创作节点：文本 text、图片 image、视频 video、音频 audio；上游文本节点是下游的提示词，上游图片节点是下游的参考图 / 首帧。

可用动作：
- navigate：target 为 home/library/settings/project。
- set_stage：打开编导流程中的某一步页面，target 为 topic（选题立项）/style（风格画像）/script（分镜脚本）/visual（画面）/cut（成片）/package（标题包装）/review（审稿）/cover（封面）/deliver（交付）。
- select_project：target 为项目 id 或完整标题。
- update_project：field 只能是 title/topic/platform/brief/coverMainText/coverSubText/coverBackgroundPrompt/coverPlan/publishCopy；value 为新值。
- update_style：field 为风格画像字段 positioning/contentType/platformTone/audience/voice/duration/pace/structure/hook/visual/cover/cta/risk/discovery；value 为新值。
- update_script：value 是完整分镜数组的 JSON 字符串，每项包含 time、shot、voice、subtitle、note。
- update_packaging：value 是 JSON 字符串，可包含 titles、coverWords、publishCopy、coverPlan。
- update_account：field 为 name/platform/position/audience/tone/structure/forbidden/cover/review；value 为新值。只修改当前项目指定的账号。
- create_project：value 是 JSON 字符串，包含 topic（选题一句话）和 platform。会直接新建项目并打开它的画布。
- add_node：target 为 text/image/video/audio/cut。
- update_node：target 为节点 id 或节点类型；field 为 title/text/prompt/model/ratio/duration/negativePrompt，value 为新值。
- connect_nodes：value 是 JSON 字符串，包含 from 和 to，可使用节点 id 或节点类型。
- delete_node：target 为节点 id。只能删除自由节点或分镜，只有用户明确要求删除时使用。
- run_ai：target 为 style/full/script/packaging/review；instruction 写本次要求。
- run_canvas：target 为 image/video/audio；value 为分镜序号（如 "3"）时为该分镜生成画面或视频，留空时运行当前选中的或第一个对应节点。
- sync_timeline：把已生成的视频按分镜顺序排进成片时间线。
- fullscreen_canvas：收起两侧面板，只看画布。
- export：target 为 pack/shoot/edit/audit/publish/cover/workflow/edl。

只有用户明确要求修改、生成、创建、导出或跳转时才返回 actions；咨询、分析和讨论只回复，不执行动作。run_ai、run_canvas 会实际调用模型并产生费用，只有用户明确要求生成时才可使用。不要声称拥有电脑系统、文件系统、支付、账号或其他应用权限；你的权限仅限当前帧比特项目中由上述动作开放的能力。所有 action 的 target、field、value、instruction 字段都必须填写，不适用时填空字符串。

${project.petMode ? `这次用户是通过桌面上的像素宠物「Bit」和你说话：你就是 Bit，一个白色方块脑袋、两只竖条眼睛、头顶飘着一枚黄色光标方块的小编导。语气轻快、亲切、偶尔俏皮，但判断仍然专业；回复控制在 120 字以内。${project.noProject ? "用户现在没有打开任何项目（在首页、资料库或设置页），你只能执行 navigate、select_project、create_project 三种动作，其他动作不要返回。" : ""}\n` : ""}最近对话：${JSON.stringify(project.directorConversation || [])}
用户本轮要求：${instruction || "请根据当前项目主动给出下一步建议。"}`
  };
  if (action.startsWith("ip_")) {
    const who = account?.name ? `账号：${account.name}｜定位：${account.position || "未设置"}｜受众：${account.audience || "未设置"}｜语气：${account.tone || "未设置"}` : "";
    return `${who ? `${who}\n\n` : ""}任务：${tasks[action]}`;
  }
  if (action.startsWith("canvas_") || action.startsWith("remake_") || action === "team_notes") {
    const brief = `项目：${project.title || "未命名"}｜选题：${project.topic || "未设置"}｜平台：${project.platform || "抖音"}｜画面语言：${style.visual || "未设置"}｜语气：${style.voice || account.tone || "自然"}`;
    return `${brief}${cast ? `\n${cast}` : ""}\n\n任务：${tasks[action]}`;
  }
  return `${context}\n\n任务：${tasks[action]}${instruction && action !== "rewrite" ? `\n额外指令：${instruction}` : ""}`;
}

// 拆解复刻：浏览器抽出的关键帧（JPEG data URL），最多 12 张
function visionImages(payload = {}) {
  if (payload._noVision) return [];
  return (Array.isArray(payload.images) ? payload.images : []).filter(u => typeof u === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(u) && u.length < 1_200_000).slice(0, 12);
}

function extractText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  for (const output of data.output || []) {
    for (const content of output.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return "";
}

function extractJson(text) {
  const clean = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(clean); } catch (_) {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
    throw new Error("模型返回的内容不是有效 JSON，请重试");
  }
}

function validateResult(action, result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("模型返回的数据结构不正确");
  const missing = Object.keys(SCHEMAS[action].properties).filter(key => !(key in result));
  if (missing.length) throw new Error(`模型结果缺少字段：${missing.join("、")}`);
  return result;
}

function structuredPrompt(action) {
  return `必须只输出一个 JSON 对象，不要输出 Markdown、解释或代码围栏。JSON 必须符合以下 Schema，所有顶层字段都必须出现：\n${JSON.stringify(SCHEMAS[action])}`;
}

function developerFor(action) {
  return action === "director"
    ? "你是帧比特的常驻 AI 编导与项目助理。你专业、主动、简洁，能在帧比特项目权限范围内规划并执行工作。不要编造事实，不要越过系统提供的动作权限。"
    : action === "style_map"
      ? "你是资深短视频品牌策略师与创意总监。把模糊需求发散成一份明确、具体、内部一致、可以长期复用的项目风格画像。不要给模板化空话，不要给多个备选。"
      : action.startsWith("canvas_")
        ? "你是帧比特画布里的 AI 创作助手，擅长短视频画面、提示词和分镜。输出精炼、具体、可直接用于生成。"
        : action.startsWith("remake_")
          ? "你是资深短视频拆片导演，擅长从成片里读出结构、节奏、钩子和镜头语言，并把它迁移到新的选题上。只借鉴手法，不照搬原创台词和画面。"
          : action.startsWith("ip_")
            ? IP_PERSONA
            : "你是资深中文短视频总编导。输出必须具体、可拍、克制，严格继承账号 DNA。不要编造数据、来源或事实。结构化字段必须完整。";
}

window.FB_PROMPTS = { SCHEMAS, promptFor, structuredPrompt, visionImages, developerFor, extractJson };
})();
