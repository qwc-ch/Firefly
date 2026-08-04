import type { SiteConfig } from "@/types/siteConfig";

// 定义站点语言
// 语言代码，例如：'zh_CN', 'zh_TW', 'en', 'ja', 'ru', 'ko'。
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
		hue: 10,
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
	// 如果启用了OpenGraph图片功能，数组中需要包含png格式的favicon图标
	favicon: [
		{
		src: "/favicon/favicon2.png",
		},
	],

	// 导航栏配置
	navbar: {
		logo: {
			type: "image",
			value: "assets/images/logo/firefly-light.png",
			valueDark: "assets/images/logo/firefly-dark.png",
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
		friends: true,
		sponsor: true,
		guestbook: true,
		bangumi: {
			userId: "1186385",
			mode: "static",
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
		chat: false,
		dynamic: true,
		circle: true,
	},

	// 分类导航栏开关，在首页和归档页顶部显示分类快捷导航
	categoryBar: true,

	// 归档页是否折叠非最新年份文章，禁用后默认展开全部年份
	foldArticle: true,

	// 文章列表布局配置
	postListLayout: {
		defaultMode: "list",
		mobileDefaultMode: "grid",
		descriptionLines: 2,
		showStatsIcons: true,
		tagsPosition: "bottom",
		meta: {
			showPublished: true,
			showCategory: true,
			showTags: true,
			tagCount: 5,
			showWords: false,
			showReadingTime: false,
		},
		stats: {
			showPublished: true,
			showWords: true,
			showReadingTime: true,
		},
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
		mode: "static",
		// Bangumi API 地址
		apiUrl: "https://bgmapi.anibt.net",
		// 详情页地址
		subjectBaseUrl: "https://bgmmi.anibt.net/subject/",
		// 条目类型排序，数组中的类型将按顺序优先展示
		// 可选值: "anime" | "book" | "music" | "game" | "real" (暂不支持"real"类型)
		// 未列出的类型将按默认顺序排在后面
		categoryOrder: ["anime", "book", "music", "game"],
		// 控制各分类的启用状态（true/false），未指定的分类默认启用
		// categories: {
		// 	game: false, // 禁用游戏分类显示
		// },
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
		formats: "avif",
		quality: 85,
		noReferrerDomains: [
			"*.hdslb.com",
			"*.bilibili.com",
		],
	},

	// 站点语言，在本配置文件顶部SITE_LANG定义
	lang: SITE_LANG,
};
