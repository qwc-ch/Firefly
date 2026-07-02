import type { SiteConfig } from "@/types/siteConfig";

// 定义站点语言
// 语言代码，例如：'zh_CN', 'zh_TW', 'en', 'ja', 'ru'。
const SITE_LANG = "zh_CN";

export const siteConfig: SiteConfig = {
	// 站点标题
	title: "年华",

	// 站点副标题
	subtitle: "欢迎来到我的小破站",

	// 站点 URL
	site_url: "https://blog.amamo.top/",

	// 站点描述
	description: "基于Firefly和Astro开发的个人博客，我会在这里分享生活和技术。",

	// 站点关键词
	keywords: [
		"年华",
		"年华的博客",
		"Firefly",
		"Fuwari",
		"Astro",
		"ACGN",
		"博客",
		"技术博客",
		"静态博客",
		"生活",
	],

	// 主题色
	themeColor: {
		hue: 330,
		fixed: false,
		defaultMode: "system",
	},

	// 页面整体宽度（单位：rem）
	// 数值越大可以让页面内容区域更宽
	// 在使用单侧栏边栏时，建议调低一些宽度以获得更好的视觉效果。
	pageWidth: 100,

	// 网站Card样式配置
	card: {
		border: true,
		followTheme: true,
	},

	// Favicon 配置
	favicon: [
		{
		src: "/favicon/favicon2.png",
		},
	],

	// 导航栏配置
	navbar: {
		logo: {
			type: "image",
			value: "assets/images/firefly.png",
			alt: "🍀",
		},
		title: "Firefly",
		widthFull: false,
		menuAlign: "center",
		followTheme: false,
		stickyNavbar: true,
	},

	// 站点开始日期，用于统计运行天数
	siteStartDate: "2026-01-01",

	// 站点时区（IANA 时区字符串），用于格式化bangumi、rss里的构建日期时间等等..
	// 示例："Asia/Shanghai", "UTC", 如果为空，则按照构建服务器的时区进行时区转换
	timezone: "Asia/Shanghai",

	// 页面开关配置 - 控制特定页面的访问权限，设为false会返回404并自动隐藏对应的导航栏菜单项
	pages: {
		friends: [
			{
			title: "夏夜流萤",
			imgurl: "https://weavatar.com/avatar/d252655d40d6874417a720bad0a6c5f77f8f6a1fd2f882f8f338402dc37e4190?s=640",
			desc: "飞萤之火自无梦的长夜亮起，绽放在终竟的明天。",
			siteurl: "https://blog.cuteleaf.cn",
			tags: [
				"Blog",
			],
			weight: 10,
			enabled: true,
			},
			{
			title: "fqzlr",
			imgurl: "https://q1.qlogo.cn/g?b=qq&nk=20447289&s=640",
			desc: "坐姿不如起而行。",
			siteurl: "https://fqzlr.com/",
			tags: [
				"Blog",
			],
			weight: 7,
			enabled: true,
			},
			{
			title: "年华",
			imgurl: "https://q1.qlogo.cn/g?b=qq&nk=1323860289&s=640",
			desc: "分享生活和技术。",
			siteurl: "https://blog.520781.xyz/",
			tags: [
				"Blog",
			],
			weight: 100,
			enabled: true,
			},
			{
			title: "团子和蛋糕",
			imgurl: "https://re.tsh520.cn/zl/tx.webp",
			desc: "如果你喜欢那么欢迎来到我的世界！",
			siteurl: "https://blog.tsh520.cn",
			tags: [
				"Blog",
			],
			weight: 10,
			enabled: true,
			},
			{
			title: "UpXuu",
			imgurl: "https://upxuu.com/images/20260214145619.jpg",
			desc: "逐光而上",
			siteurl: "https://upxuu.com/",
			tags: [
				"Blog",
			],
			weight: 10,
			enabled: true,
			},
			{
			title: "Dogxi 的狗窝",
			imgurl: "https://blog.dogxi.me/avatar.png",
			desc: "Dogxi 的个人博客，因为热爱所以热爱",
			siteurl: "https://blog.dogxi.me",
			tags: [
				"Blog",
			],
			weight: 1,
			enabled: true,
			},
			{
			title: "versus0",
			imgurl: "https://img.542000.xyz/file/friend_avatar/1778931720838_f167cb95af9d881f4378b92b3e181d89_4647054993754934443.jpg",
			desc: "I may be still unripened.But I'm not afraid.",
			siteurl: "https://blog.542000.xyz",
			tags: [
				"Blog",
			],
			weight: 18,
			enabled: true,
			},
			{
			title: "Hyde Blog",
			imgurl: "https://seasir.top/assets/avatar.avif",
			desc: "人心中的成见是一座大山",
			siteurl: "https://seasir.top/",
			tags: [
				"Blog",
			],
			weight: 19,
			enabled: true,
			},
			{
			title: "二叉树树",
			imgurl: "https://q2.qlogo.cn/headimg_dl?dst_uin=2726730791&spec=0",
			desc: "Protect What You Love.",
			siteurl: "https://2x.nz",
			tags: [
				"Blog",
			],
			weight: 20,
			enabled: true,
			},
			{
			title: "十三",
			imgurl: "https://img.nw177.cn/blog/100.assets/avatar.webp",
			desc: "欲买桂花同载酒，终不似，少年游。",
			siteurl: "https://blog.nw177.cn/",
			tags: [
				"Blog",
			],
			weight: 10,
			enabled: true,
			},
			{
			title: "ZhiJing’s Blog",
			imgurl: "https://iwexe.top/avatar.svg",
			desc: " Go with the flow.",
			siteurl: "https://iwexe.top/",
			tags: [
				"Blog",
			],
			weight: 100,
			enabled: true,
			},
			{
			title: "星遐蝶梦",
			imgurl: "https://blog.casto.top/assets/images/avatar.png",
			desc: "星穹漫遐，蝶携清梦。",
			siteurl: "https://blog.casto.top",
			tags: [
				"Blog",
			],
			weight: 10,
			enabled: true,
			},
			{
			title: "L!!!!ght",
			imgurl: "https://easyimg.kejk.cn/i/4484873c-c2cc-4b3d-bc35-5c72ed01cfd9.webp",
			desc: "阳光正好，慢慢前行。",
			siteurl: "https://sunlight.kejk.cn",
			tags: [
				"Blog",
			],
			weight: 11,
			enabled: true,
			},
			{
			title: "Saimen Blog",
			imgurl: "https://com.z2m.store/img/butterfly-icon.png",
			desc: "读史可以明智,知古方能鉴今。",
			siteurl: "https://com.z2m.store",
			tags: [
				"Blog",
			],
			weight: 9,
			enabled: true,
			},
			{
			title: "沈幼楚の小窝",
			imgurl: "https://q1.qlogo.cn/g?b=qq&nk=1050925710&s=640",
			desc: "天真永不消逝，浪漫至死不渝.",
			siteurl: "https://blog.shenyouchu.cn/",
			tags: [
				"Blog",
			],
			weight: 9,
			enabled: true,
			},
			{
			title: "莱姆Lime",
			imgurl: "https://sudachi.top/logo.jpeg",
			desc: "聚是火簇，散作繁星",
			siteurl: "https://sudachi.top/",
			tags: [
				"技术",
			],
			weight: 17,
			enabled: true,
			},
			{
			title: "THW’s Blog",
			imgurl: "https://image.tianhw.top/avatar.webp",
			desc: "前途似海，来日方长",
			siteurl: "https://blog.tianhw.top",
			tags: [
				"Blog",
			],
			weight: 14,
			enabled: true,
			},
			{
			title: "Sigrika-善良耙耙柑🍊",
			imgurl: "https://qwq.sigrika.cc/assets/images/avatar.gif",
			desc: "记录我的二次元之旅",
			siteurl: "https://qwq.sigrika.cc/",
			tags: [
				"Blog",
			],
			weight: 18,
			enabled: true,
			},
			{
			title: "董健颖",
			imgurl: "https://weavatar.com/api/avatar/e3e6c5e34c0111ab1a16acb37cec03f01907406e60b49477c089001f5ed083b8?s=50&t=1781771969751?s=640",
			desc: "这是我的个人博客，记录我的学习和生活点滴，分享我的学习经验和见解。希望在这里能与志同道合的朋友们交流和成长！",
			siteurl: "https://dongjianying.xyz",
			tags: [
				"Blog",
			],
			weight: 20,
			enabled: true,
			},
		],
		sponsor: true,
		guestbook: true,
		bangumi: {
			userId: "1186385",
			mode: "dynamic",
			apiUrl: "https://bgmapi.anibt.net",
			subjectBaseUrl: "https://bgmmi.anibt.net/subject/",
			categoryOrder: [
				"anime",
				"book",
				"music",
				"game",
			],
		},
		gallery: true,
		anime: {
			bilibili: {
				uid: "38932988",
			},
		},
		chat: true,
	},

	// 分类导航栏开关，在首页和归档页顶部显示分类快捷导航
	categoryBar: true,

	// 归档页是否折叠非最新年份文章，禁用后默认展开全部年份
	foldArticle: true,

	// 文章列表布局配置
	postListLayout: {
		defaultMode: "list",
		mobileDefaultMode: "list",
		showTags: true,
		descriptionLines: 2,
		allowSwitch: true,
		grid: {
			masonry: true,
			columnWidth: 320,
		},
	},

	// 文章内容页配置
	post: {
		rehypeCallouts: {
			theme: "github",
			enablePythonMarkdownAdmonitions: false,
		},
		showLastModified: true,
		outdatedThreshold: 180,
		sharePoster: true,
		generateOgImages: false,
	},

	// bangumi配置
	bangumi: {
		// Bangumi用户ID
		userId: "1186385",
		// 数据模式：static=构建时获取，dynamic=客户端实时获取
		// static 模式在构建时获取数据并静态渲染，部署后数据不更新
		// dynamic 模式在浏览器中实时请求 API，始终显示最新数据
		mode: "dynamic",
		// Bangumi API 地址
		apiUrl: "https://bgmapi.anibt.net",
		// 详情页地址
		subjectBaseUrl: "https://bgmmi.anibt.net/subject/",
		// 条目类型排序，数组中的类型将按顺序优先展示
		// 可选值: "anime" | "book" | "music" | "game" | "real" (暂不支持"real"类型)
		// 未列出的类型将按默认顺序排在后面
		categoryOrder: ["anime", "book", "music", "game"],
	},

	// 追番配置（Bilibili + TMDB）
	anime: {
		// Bilibili 配置
		bilibili: {
			// 你的 Bilibili 用户 UID
			uid: "38932988",
		},
		// TMDB 配置（可选，需要翻墙）
		// tmdb: {
		//   // TMDB API 密钥
		//   apiKey: "your_tmdb_api_key",
		//   // TMDB 列表 ID
		//   listId: "your_list_id",
		// },
	},

	// 分页配置
	pagination: {
		postsPerPage: 10,
	},

	// 图像优化及响应式配置
	// 图像优化压缩只保留avif或webp
	// 响应式图像是为在不同设备上提高性能而调整的图像。这些图像可以调整大小以适应其容器，并且可以根据访问者的屏幕尺寸和分辨率以不同的大小提供。
	// Astro 仅能对 src 目录下的图像进行优化，src 目录下的图像越多，构建时间会越长
	// Astro 图像文档 https://docs.astro.build/zh-cn/guides/images/
	imageOptimization: {
		formats: "webp",
		quality: 85,
		noReferrerDomains: [
			"*.hdslb.com",
			"*.bilibili.com",
		],
	},

	// 站点语言，在本配置文件顶部SITE_LANG定义
	lang: SITE_LANG,
};
