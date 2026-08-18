import {
	type NavBarConfig,
	type NavBarLink,
	type NavBarSearchConfig,
	NavBarSearchMethod,
} from "../types/navBarConfig";

// ============================================================================
// 导航栏配置 - 根据顺序动态生成导航栏链接
// NavBar Configuration - Dynamically generate navigation bar links based on order
// ============================================================================
const getDynamicNavBarConfig = (): NavBarConfig => {
	// 基础导航栏链接
	const links: NavBarLink[] = [];

	// 主页
	links.push(LinkPresets.Home);

	// 文章及其子菜单
	links.push({
		name: "文章",
		url: "#",
		icon: "material-symbols:article",
		children: [
			// 归档
			LinkPresets.Archive,

			// 分类
			LinkPresets.Categories,

			// 标签
			LinkPresets.Tags,
		],
	});

	//社交及其子菜单
	links.push({
		name: "社交",
		url: "#",
		icon: "material-symbols:group",
		children: [
			// 友链
			LinkPresets.Friends,

			// 留言
			LinkPresets.Guestbook,

			// 朋友圈
			LinkPresets.Circle,
		],
	});

	// 我的及其子菜单
	links.push({
		name: "我的",
		url: "#",
		icon: "material-symbols:person",
		children: [
			// 动态
			LinkPresets.Dynamic,

			// 相册
			LinkPresets.Gallery,

			// 追番
			LinkPresets.Anime,

			// VNDB
			LinkPresets.VNDB,

			// 番组计划
			LinkPresets.Bangumi,

			// 书签导航
			LinkPresets.Booknav,

			// 关于页面
			LinkPresets.About,
		],
	});

	// 关于及其子菜单
	links.push({
		name: "关于",
		url: "#",
		icon: "material-symbols:info",
		children: [
			// 打赏
			LinkPresets.Sponsor,
		],
	});

	// 音乐与自定义链接移入其他菜单
	links.push({
		name: "其他",
		url: "/others/",
		icon: "material-symbols:more-horiz",

		children: [
			{
				name: "统计",
				url: "https://umami.520781.xyz/share/uVEXU0CJbC0XUe0n",
				external: true,
				icon: "fa7-solid:chart-simple",
			},
			// 音乐（外部链接）
			LinkPresets.Music,
			{
				name: "主页",
				url: "https://www.amamo.top/",
				external: true,
				icon: "material-symbols:home",
			},
			{
				name: "GitHub",
				url: "https://github.com/qwc-ch/",
				external: true,
				icon: "fa7-brands:github",
			},
			{
				name: "E-mail",
				url: "mailto:zzzzzzxx2022@163.com",
				external: true,
				icon: "fa7-regular:envelope",
			},
		],
	});

	// 文档链接
	// links.push({
	// 	name: "文档",
	// 	url: "https://docs-firefly.cuteleaf.cn",
	// 	external: true,
	// 	icon: "material-symbols:docs",
	// });

	return { links } as NavBarConfig;
};

// 导航搜索配置
export const navBarSearchConfig: NavBarSearchConfig = {
	method: NavBarSearchMethod.PageFind,
};

// ============================================================================
// 链接预设 - 可自由自定义导航栏链接的名称、图标和URL
// Link Presets - Allows free customization of the name, icon, and URL of navigation bar links
// ============================================================================
export const LinkPresets: Record<string, NavBarLink> = {
	Home: {
		name: "主页",
		url: "/",
		icon: "material-symbols:home",
	},
	Dynamic: {
		name: "动态",
		url: "/dynamic/",
		icon: "material-symbols:forum-rounded",
		pageKey: "dynamic",
	},
	Archive: {
		name: "归档",
		url: "/archive/",
		icon: "material-symbols:archive",
	},
	Categories: {
		name: "分类",
		url: "/categories/",
		icon: "material-symbols:folder-open-rounded",
	},
	Tags: {
		name: "标签",
		url: "/tags/",
		icon: "material-symbols:tag-rounded",
	},
	Friends: {
		name: "友链",
		url: "/friends/",
		icon: "material-symbols:link-2-rounded",
		pageKey: "friends",
	},
	Sponsor: {
		name: "打赏",
		url: "/sponsor/",
		icon: "material-symbols:favorite",
		pageKey: "sponsor",
	},
	Guestbook: {
		name: "留言",
		url: "/guestbook/",
		icon: "material-symbols:chat",
		pageKey: "guestbook",
	},
	About: {
		name: "关于我",
		url: "/about/",
		icon: "material-symbols:person",
	},
	Bangumi: {
		name: "番组计划",
		url: "/bangumi/",
		icon: "material-symbols:movie",
		pageKey: "bangumi",
	},
	VNDB: {
		name: "VNDB",
		url: "/vndb/",
		icon: "material-symbols:movie",
		pageKey: "vndb",
	},
	Gallery: {
		name: "相册",
		url: "/gallery/",
		icon: "material-symbols:photo-library",
		pageKey: "gallery",
	},
	Anime: {
		name: "追番",
		url: "/anime/",
		icon: "material-symbols:live-tv",
		pageKey: "anime",
	},
	Chat: {
		name: "AI聊天",
		url: "/chat/",
		icon: "material-symbols:smart-toy",
		pageKey: "chat",
	},
	Circle: {
		name: "朋友圈",
		url: "/circle/",
		icon: "material-symbols:group",
		pageKey: "circle",
	},
	Music: {
		name: "音乐",
		url: "https://music.amamo.top/",
		external: true,
		icon: "material-symbols:music-note",
	},
	Booknav: {
		name: "书签导航",
		url: "/booknav/",
		icon: "material-symbols:bookmarks",
		pageKey: "booknav",
	},
};

export const navBarConfig: NavBarConfig = getDynamicNavBarConfig();
