"use strict";
// 帧比特 FRAMEBIT · 静态配置：工作流模式、模型平台与各平台内容画像
const MODES = {
  trend: { name: "热点追踪", icon: "热", desc: "从热点信号快速形成账号适配的观点内容。", path: ["热点判断", "账号匹配", "观点脚本", "风险检查", "发布包装"] },
  manual: { name: "自主选题", icon: "创", desc: "从你的观点或需求出发，完成完整编导流程。", path: ["需求拆解", "观点确认", "分镜脚本", "内容审稿", "交付"] },
  series: { name: "栏目续写", icon: "栏", desc: "继承栏目结构与账号 DNA，批量保持稳定风格。", path: ["栏目继承", "选题差异化", "脚本续写", "一致性检查", "交付"] },
  product: { name: "产品种草", icon: "品", desc: "把产品卖点翻译成用户场景和可信内容。", path: ["卖点拆解", "场景匹配", "证据检查", "种草脚本", "转化包装"] },
  remake: { name: "参考改编", icon: "改", desc: "提取参考结构，而不是简单洗稿。", path: ["结构拆解", "原创角度", "账号重写", "相似度自查", "交付"] },
  longcut: { name: "长视频切片", icon: "切", desc: "为后续素材转写与高光切片预留的工作流。", path: ["素材转写", "高光识别", "片段重构", "包装审稿", "剪辑包"] }
};

const PROVIDER_CONFIG = {
  toapis: {
    label: "ToAPIs",
    keyLabel: "ToAPIs API Key",
    hint: "聚合模型广场：一个 Key 同时接入语言、生图、生视频和音乐模型。连接后可以在「设置 · 模型分配」里给每个功能区指定模型。",
    link: "https://toapis.com/dashboard/tokens",
    linkLabel: "打开 ToAPIs 控制台创建 Key",
    regions: { global: ["国际站", "https://toapis.com"], cn: ["中国大陆", "https://toapis.cn"] },
    capabilities: { text: true, image: true, video: true, audio: true }
  },
  openai: {
    label: "OpenAI",
    keyLabel: "OpenAI API Key",
    hint: "原版 GPT，使用 OpenAI 账户的 API 余额；支持文本与封面生图。",
    link: "https://platform.openai.com/api-keys",
    linkLabel: "创建 OpenAI Key",
    capabilities: { text: true, image: true, video: false }
  },
  simplaj: {
    label: "Simplaj API",
    keyLabel: "Simplaj API Key",
    hint: "OpenAI Responses 兼容接口，按当前套餐自动尝试 gpt-5.5 / gpt-5.4；当前接入文本编导能力。",
    link: "https://simplaj-docs.pages.dev/",
    linkLabel: "查看 Simplaj 教程",
    capabilities: { text: true, image: false, video: false }
  },
  kimi: {
    label: "Kimi API",
    keyLabel: "Kimi API Key",
    hint: "Kimi 国内官方接口，优先使用 Kimi K3；适合长上下文、知识工作与编导推理。",
    link: "https://platform.kimi.com/console/api-keys",
    linkLabel: "管理 Kimi Key",
    capabilities: { text: true, image: false, video: false }
  },
  deepseek: {
    label: "DeepSeek",
    keyLabel: "DeepSeek API Key",
    hint: "国内官方文本接口，可使用人民币余额；不能直接生成封面图片。",
    link: "https://platform.deepseek.com/api_keys",
    linkLabel: "创建 DeepSeek Key",
    capabilities: { text: true, image: false, video: false }
  },
  siliconflow: {
    label: "SiliconFlow",
    keyLabel: "SiliconFlow API Key",
    hint: "国内模型聚合平台，可使用文本、图片和视频生成模型。",
    link: "https://cloud.siliconflow.cn/account/ak",
    linkLabel: "创建 SiliconFlow Key",
    capabilities: { text: true, image: true, video: true }
  }
};

const positioning = (key, label, audience, tone, visual) => ({ key, label, audience, tone, visual });
const contentFormat = (key, label, duration, pace, structure, hook, cta) => ({ key, label, duration, pace, structure, hook, cta });
const PLATFORM_PROFILES = {
  "抖音": {
    nativeTone: "强钩子、单一核心观点、情绪与信息密度并重，优先竖屏移动端观看",
    discovery: "推荐流冷启动，前三秒必须让陌生用户立即理解冲突或收益",
    cover: "大主体、大关键词、高对比，封面字控制在 6-10 字",
    risk: "避免绝对化、虚假功效、过度制造对立和与内容无关的诱导互动",
    positionings: [
      positioning("work_opinion", "职场观点 IP", "25-40 岁职场人", "直接、有判断、克制反鸡汤", "人物近景＋办公场景＋关键词字幕"),
      positioning("knowledge", "知识科普 IP", "对实用知识有即时需求的人群", "结论先行、通俗准确、避免卖弄", "实物演示、图解、步骤字幕"),
      positioning("lifestyle", "生活方式 IP", "追求效率、品质与情绪价值的人群", "真实轻松、可模仿、有生活细节", "第一视角、生活切片、氛围特写"),
      positioning("beauty_fashion", "美妆穿搭 IP", "关注外形管理与消费决策的人群", "审美明确、体验真实、避免夸大", "前后对比、局部特写、上身展示"),
      positioning("product", "产品种草 / 测评", "有明确购买场景和决策需求的人群", "场景化、证据化、优缺点透明", "痛点演示、功能实测、细节特写"),
      positioning("local", "本地生活 / 探店", "同城消费与到店决策人群", "直接、有烟火气、价格信息清楚", "门头定位、环境、产品、价格连续展示"),
      positioning("story", "剧情 / 情感账号", "偏好冲突、反转和共鸣的人群", "人物关系清晰、情绪集中、不狗血", "多机位表演、反应镜头、节奏剪辑"),
      positioning("business_ip", "老板 / 企业 IP", "潜在客户、同行与求职者", "专业可信、有人格、不端着", "真人口播、业务现场、案例证据")
    ],
    contentTypes: [
      contentFormat("burst_15", "15 秒爆点短片", "12-18 秒", "极快", "冲突钩子 → 单一结论 → 记忆点", "第一句即给反差或结果", "一句问题引导评论"),
      contentFormat("talk_30", "30 秒快节奏口播", "25-35 秒", "快", "痛点 → 观点 → 两点证明 → 收尾", "3 秒内点名用户与问题", "评论选择或收藏"),
      contentFormat("opinion_60", "60 秒观点口播", "50-70 秒", "中快", "反常识观点 → 三段论证 → 金句", "先否定常见理解再给判断", "邀请表达立场"),
      contentFormat("knowledge_list", "知识清单 / 教程", "35-75 秒", "中快", "结果预告 → 分步讲解 → 避坑提醒", "先展示完成效果或收益", "收藏并按步骤执行"),
      contentFormat("scene_product", "场景种草 / 测评", "30-60 秒", "中快", "使用场景 → 痛点 → 实测 → 适用边界", "真实问题或对比结果", "理性购买或查看详情"),
      contentFormat("local_review", "探店 / 团购", "25-60 秒", "快", "定位价格 → 必点体验 → 优缺点 → 建议", "地点＋价格或稀缺卖点", "同城收藏或到店"),
      contentFormat("short_drama", "剧情短片", "45-120 秒", "张弛明显", "人物目标 → 冲突升级 → 反转 → 余味", "冲突动作直接发生", "追更或讨论人物选择"),
      contentFormat("live_highlight", "直播高光切片", "20-90 秒", "删除停顿、保留爆点", "上下文一句交代 → 高价值片段 → 结论", "直接使用最高信息密度句", "回看直播或评论提问")
    ]
  },
  "小红书": {
    nativeTone: "真实经验、审美表达与可收藏信息并重，弱说教、强个人体验",
    discovery: "搜索与推荐共同分发，标题、口播关键词和具体使用场景需要一致",
    cover: "干净审美、主题明确、关键词可搜索，避免廉价感和信息堆叠",
    risk: "避免虚假体验、过度滤镜式承诺、医疗功效暗示和未标注的商业推广",
    positionings: [
      positioning("lifestyle_host", "生活方式主理人", "关注品质生活和自我成长的人群", "真诚、松弛、有个人审美", "自然光、生活空间、细节镜头"),
      positioning("beauty", "美妆护肤博主", "关注护肤、妆容和成分的人群", "体验具体、审美在线、功效克制", "肤质细节、步骤、前后对比"),
      positioning("fashion", "穿搭时尚博主", "寻找风格灵感与购买建议的人群", "有风格判断、具体可借鉴", "全身展示、细节、场景搭配"),
      positioning("career_growth", "职场成长博主", "年轻职场人与求职者", "朋友式分享、方法具体、不制造焦虑", "桌面口播、工作流、清单卡片"),
      positioning("home", "家居收纳博主", "装修、租房和家庭管理人群", "实用、整洁、预算透明", "空间前后对比、动线、尺寸标注"),
      positioning("parenting", "母婴家庭博主", "备孕、育儿和家庭用户", "温和、基于真实经验、明确个体差异", "家庭场景、过程记录、产品细节"),
      positioning("travel_food", "旅行探店博主", "计划出行或本地消费的人群", "体验感强、路线清楚、不过度拔高", "路线、环境、食物与价格"),
      positioning("expert_brand", "专业知识 / 品牌主理人", "对专业方案或品牌价值感兴趣的人群", "专业但不端着、解释充分", "真人、产品过程、幕后与案例")
    ],
    contentTypes: [
      contentFormat("experience", "经验分享口播", "45-120 秒", "舒适中速", "个人场景 → 经验 → 方法 → 适用人群", "先说我为什么需要它", "收藏或交流个人经验"),
      contentFormat("list_guide", "清单攻略", "30-90 秒", "清晰分段", "目标 → 清单 → 重点解释 → 总结", "明确人群和使用场景", "收藏备用"),
      contentFormat("tutorial", "教程跟练", "45-180 秒", "步骤稳定", "成品预览 → 材料 → 步骤 → 易错点", "先展示最终效果", "跟练、收藏"),
      contentFormat("comparison", "测评对比", "45-120 秒", "信息密集但不过快", "标准 → 实测 → 差异 → 推荐边界", "直接展示最关键差异", "按需求选择"),
      contentFormat("unboxing", "开箱种草", "30-90 秒", "自然", "期待 → 开箱 → 细节 → 使用感受 → 缺点", "真实第一反应或核心卖点", "理性讨论是否值得"),
      contentFormat("scene_vlog", "场景 Vlog", "30-120 秒", "有呼吸感", "时间 / 路线推进 → 关键节点 → 感受", "具体的一天或一次体验", "分享同类生活方式"),
      contentFormat("avoid_pit", "避坑复盘", "45-120 秒", "先结论后复盘", "踩坑结果 → 原因 → 正确做法 → 检查清单", "明确损失或错误", "收藏避坑"),
      contentFormat("graphic_video", "图文转视频", "20-60 秒", "卡点清楚", "一页一重点 → 关键说明 → 总结页", "封面式首帧直给主题", "收藏与搜索")
    ]
  },
  "视频号": {
    nativeTone: "信任关系、完整表达和社会化转发价值优先，语气稳健可信",
    discovery: "社交关系链与推荐共同分发，内容需要让用户愿意转给朋友或客户",
    cover: "人物可信、主题端正、字号清楚，避免过度娱乐化包装",
    risk: "避免健康财经等领域的未经证实建议、夸大收益、诱导转发和身份背书滥用",
    positionings: [
      positioning("industry_expert", "行业专家 IP", "行业客户、从业者和决策者", "专业、耐心、结论有依据", "稳定真人口播、案例资料、行业现场"),
      positioning("founder", "老板 / 创始人 IP", "客户、合作伙伴与团队", "有格局但具体、坦诚、有经营细节", "办公室、工厂、门店与团队现场"),
      positioning("business_finance", "商业财经账号", "经营者、管理者和投资关注者", "理性克制、证据优先", "数据图表、案例、沉稳口播"),
      positioning("health", "健康养生账号", "家庭与中年用户", "温和易懂、强调个体差异和就医边界", "真人讲解、动作演示、生活场景"),
      positioning("family_emotion", "家庭情感账号", "家庭用户与中年人群", "共情、包容、不煽动关系对立", "生活场景、人物故事、温暖光线"),
      positioning("culture_edu", "文化教育账号", "家长、学生与人文兴趣人群", "沉静、准确、有启发", "书桌、讲堂、文献与文化场景"),
      positioning("institution", "政企机构账号", "公众、客户与组织成员", "规范、清楚、有服务意识", "纪实现场、信息图、正式采访"),
      positioning("local_business", "本地商家账号", "同城熟客和潜在客户", "可信、有人情味、信息透明", "门店、服务过程、顾客场景")
    ],
    contentTypes: [
      contentFormat("deep_talk", "1-3 分钟深度口播", "60-180 秒", "稳健中速", "问题背景 → 判断 → 三点解释 → 建议", "用真实问题建立信任", "转发给需要的人"),
      contentFormat("case_review", "案例复盘", "60-180 秒", "叙述清楚", "背景 → 决策 → 结果 → 经验", "先交代结果与代价", "交流类似案例"),
      contentFormat("interview", "访谈 / 对谈", "90-300 秒", "自然对话", "人物引入 → 核心问题 → 追问 → 总结", "一句有价值的回答前置", "关注系列访谈"),
      contentFormat("explainer", "知识讲解", "60-180 秒", "清晰稳定", "定义 → 误区 → 方法 → 边界", "点出常见误解", "收藏或转发"),
      contentFormat("emotion_story", "情感故事", "60-180 秒", "有停顿和情绪", "人物 → 困境 → 变化 → 体会", "有代入感的生活细节", "表达自己的经历"),
      contentFormat("brand_doc", "品牌纪录短片", "60-240 秒", "纪实", "起点 → 过程 → 人物 → 价值", "真实现场或关键瞬间", "了解品牌 / 联系合作"),
      contentFormat("event", "活动 / 会议纪实", "45-150 秒", "信息清楚", "活动主题 → 关键现场 → 嘉宾观点 → 结果", "重要人物或现场规模", "关注后续活动"),
      contentFormat("live_edit", "直播精剪", "30-150 秒", "保留完整语义", "问题 → 高价值回答 → 结论", "金句或关键回答", "预约 / 回看直播")
    ]
  },
  "B站": {
    nativeTone: "内容深度、创作者个性与社区交流并重，尊重观众理解能力",
    discovery: "标题封面吸引点击后仍需以信息量、叙事完成度和原创表达承接",
    cover: "主体和主题清楚，可有梗但不能误导；适合横版构图与系列识别",
    risk: "避免搬运拼接冒充自制、标题误导、低信息量灌水和无依据的攻击性观点",
    positionings: [
      positioning("knowledge_up", "泛知识 UP 主", "希望系统理解一个问题的用户", "有逻辑、有资料、有个人解释", "图表、资料、案例与出镜结合"),
      positioning("tech", "数码科技 UP 主", "科技爱好者和购买决策者", "参数准确、体验具体、优缺点明确", "产品实拍、实验、屏幕与对比"),
      positioning("business", "商业财经 UP 主", "学生、职场人与行业观察者", "有研究、观点克制、证据链完整", "数据图、新闻资料、案例动画"),
      positioning("learning", "学习成长 UP 主", "学生、自学者和职业转型者", "陪伴式、方法具体、反焦虑", "桌面、流程、屏幕录制与清单"),
      positioning("film_anime", "影视动漫 UP 主", "影视动漫爱好者", "有审美、有解读、尊重原作", "合法素材、分析图、旁白与包装"),
      positioning("gaming", "游戏 UP 主", "玩家和游戏文化用户", "懂游戏、有梗、信息与娱乐平衡", "实机、解说、反应与高光"),
      positioning("vlog", "生活记录 UP 主", "关注人物成长与真实生活的用户", "真诚、有观察、有叙事", "长期记录、环境声、生活细节"),
      positioning("auto_review", "汽车 / 硬核测评", "爱好者与购买决策者", "专业、实测、标准透明", "多机位、测试、参数与路况")
    ],
    contentTypes: [
      contentFormat("deep_analysis", "深度解读", "4-15 分钟", "信息密集但有章节", "问题 → 背景 → 分析 → 反方 → 结论", "先提出值得看完的核心问题", "弹幕讨论和三连"),
      contentFormat("hands_on", "教程实操", "3-12 分钟", "步骤完整", "目标 → 准备 → 操作 → 排错 → 总结", "展示最终成果", "收藏、章节回看"),
      contentFormat("review", "横评 / 测评", "5-20 分钟", "标准化", "测试标准 → 分项 → 横向比较 → 结论", "最反常识的测试结果", "按需求选择"),
      contentFormat("storytelling", "故事叙事", "5-20 分钟", "铺垫与高潮", "人物 / 世界 → 事件 → 转折 → 余韵", "悬念或关键场面", "评论解读"),
      contentFormat("challenge", "实验 / 挑战", "3-12 分钟", "过程推进", "假设 → 规则 → 实验 → 意外 → 结论", "规则和赌注清楚", "提出下一次实验"),
      contentFormat("long_vlog", "Vlog 纪实", "4-15 分钟", "自然有叙事", "目标 → 过程 → 插曲 → 感受", "一天的目标或变化", "关注后续"),
      contentFormat("series", "系列栏目", "4-20 分钟", "结构稳定", "固定开场 → 本期主题 → 栏目环节 → 下期预告", "栏目承诺＋本期差异", "追更与投票"),
      contentFormat("stream_clip", "直播切片", "2-10 分钟", "保留上下文", "问题背景 → 完整高光 → 补充说明", "高价值原话前置", "回看直播 / 关注主播")
    ]
  },
  "快手": {
    nativeTone: "真实人物、生活现场和长期信任优先，表达直接、有烟火气",
    discovery: "推荐与关注关系共同作用，人物可信度和持续更新比过度包装更重要",
    cover: "人物、场景和核心利益点直接清楚，避免与实际内容不一致",
    risk: "避免夸大宣传、低价值诱导、虚假剧情营销以及作品与商品或落地内容不相关",
    positionings: [
      positioning("real_life", "真实生活记录", "关注普通人生活与成长的人群", "真诚朴实、有细节、不表演精致", "生活现场、自然光、同期声"),
      positioning("rural", "三农乡村账号", "乡村生活、农业与返乡人群", "接地气、实用、尊重劳动", "田间、家庭、生产过程与季节变化"),
      positioning("local_service", "本地生活账号", "同城居民和熟客", "热情直接、价格透明、有人情味", "门店、服务过程、顾客真实反馈"),
      positioning("craft", "技能手艺账号", "对技能、制作和传统手艺感兴趣的人群", "少空话、重过程、专业朴实", "手部特写、完整流程、成品对比"),
      positioning("family", "家庭情感账号", "家庭用户和下沉市场人群", "有共情、有分寸、不挑动对立", "家庭场景、人物关系与生活细节"),
      positioning("comedy", "搞笑剧情账号", "寻求轻松娱乐与熟人感的用户", "自然有梗、人物鲜明、不低俗", "固定人物、生活冲突、反应镜头"),
      positioning("commerce", "电商带货账号", "有明确实用需求和性价比诉求的人群", "直接演示、真实价格、承诺克制", "产品使用、细节、对比与现场答疑"),
      positioning("entrepreneur", "创业经营账号", "小生意经营者和创业者", "务实、有经验、敢讲问题", "门店、工厂、账目逻辑与团队现场")
    ],
    contentTypes: [
      contentFormat("life_record", "真实记录", "30-120 秒", "自然", "人物 / 场景 → 事件 → 结果 → 感受", "真实变化或现场问题", "分享类似经历"),
      contentFormat("plain_talk", "老铁口播", "30-90 秒", "直接中速", "称呼用户 → 观点 → 例子 → 实用建议", "一句大白话说清问题", "评论交流"),
      contentFormat("skill_demo", "技能展示", "30-120 秒", "过程清楚", "成品 → 步骤 → 关键手法 → 结果", "先展示手艺成果", "收藏 / 咨询"),
      contentFormat("product_demo", "产品演示", "25-90 秒", "直接", "需求 → 演示 → 对比 → 适用人群", "直接展示解决什么问题", "按需要购买"),
      contentFormat("local_deal", "探店 / 团购", "30-90 秒", "热情清楚", "位置价格 → 现场体验 → 推荐项 → 注意事项", "价格、分量或本地稀缺性", "同城到店"),
      contentFormat("skit", "生活短剧情", "45-150 秒", "冲突明确", "人物关系 → 生活冲突 → 反转 → 回味", "角色动作直接带出矛盾", "追更人物"),
      contentFormat("before_after", "前后对比", "20-60 秒", "快", "改造前 → 过程关键点 → 改造后 → 成本", "效果差异前置", "收藏或咨询"),
      contentFormat("live_highlight", "直播高光", "20-120 秒", "保留真实互动", "用户问题 → 现场回答 / 演示 → 结论", "最真实的问答或成交点", "进入直播 / 关注")
    ]
  }
};
