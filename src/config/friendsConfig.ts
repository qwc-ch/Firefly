import type { FriendLink, FriendsPageConfig } from "../types/friendsConfig";

// 可以在src/content/spec/friends.md中编写友链页面下方的自定义内容

// 友链页面配置
export const friendsPageConfig: FriendsPageConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "",

	// 是否显示底部自定义内容（friends.mdx 中的内容）
	showCustomContent: true,

	// 是否显示评论区，需要先在commentConfig.ts启用评论系统
	showComment: true,

	// 是否开启随机排序配置，如果开启，就会忽略权重，构建时进行一次随机排序
	randomizeSort: false,
};

// 友链配置
export const friendsConfig: FriendLink[] = [
	{
		title: "夏夜流萤",
		imgurl:
			"https://weavatar.com/avatar/d252655d40d6874417a720bad0a6c5f77f8f6a1fd2f882f8f338402dc37e4190?s=640",
		desc: "飞萤之火自无梦的长夜亮起，绽放在终竟的明天。",
		siteurl: "https://blog.cuteleaf.cn",
		rss: "https://blog.cuteleaf.cn/rss.xml",
		tags: ["Blog"],
		weight: 10, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "fqzlr",
		imgurl: "https://q1.qlogo.cn/g?b=qq&nk=20447289&s=640",
		desc: "坐姿不如起而行。",
		siteurl: "https://fqzlr.com/",
		rss: "https://fqzlr.com/rss.xml",
		tags: ["Blog"],
		weight: 19, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "年华",
		imgurl: "https://q1.qlogo.cn/g?b=qq&nk=1323860289&s=640",
		desc: "分享生活和技术。",
		siteurl: "https://blog.amamo.top/",
		rss: "https://blog.amamo.top/rss.xml",
		tags: ["Blog"],
		weight: 100, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "团子和蛋糕",
		imgurl: "https://re.tsh520.cn/zl/tx.webp",
		desc: "如果你喜欢那么欢迎来到我的世界！",
		siteurl: "https://blog.tsh520.cn",
		rss: "https://blog.tsh520.cn/rss.xml",
		tags: ["Blog"],
		weight: 10, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "UpXuu",
		imgurl: "https://upxuu.com/images/20260214145619.jpg",
		desc: "逐光而上",
		siteurl: "https://upxuu.com/",
		rss: "https://upxuu.com/rss.xml",
		tags: ["Blog"],
		weight: 10, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "Dogxi 的狗窝",
		imgurl: "https://blog.dogxi.me/avatar.png",
		desc: "Dogxi 的个人博客，因为热爱所以热爱",
		siteurl: "https://blog.dogxi.me",
		rss: "https://blog.dogxi.me/rss.xml",
		tags: ["Blog"],
		weight: 1, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "versus0",
		imgurl:
			"https://img.542000.xyz/file/friend_avatar/1778931720838_f167cb95af9d881f4378b92b3e181d89_4647054993754934443.jpg",
		desc: "I may be still unripened.But I'm not afraid.",
		siteurl: "https://blog.542000.xyz",
		rss: "https://blog.542000.xyz/rss.xml",
		tags: ["Blog"],
		weight: 18, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "Hyde Blog",
		imgurl: "https://seasir.top/assets/avatar.avif",
		desc: "人心中的成见是一座大山",
		siteurl: "https://seasir.top/",
		rss: "https://seasir.top/rss.xml",
		tags: ["Blog"],
		weight: 19, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "二叉树树",
		imgurl: "https://q2.qlogo.cn/headimg_dl?dst_uin=2726730791&spec=0",
		desc: "Protect What You Love.",
		siteurl: "https://2x.nz",
		rss: "https://2x.nz/posts/rss.xml",
		tags: ["Blog"],
		weight: 20, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "十三",
		imgurl: "https://img.nw177.cn/blog/100.assets/avatar.webp",
		desc: "欲买桂花同载酒，终不似，少年游。",
		siteurl: "https://blog.nw177.cn/",
		rss: "https://blog.nw177.cn/rss.xml",
		tags: ["Blog"],
		weight: 11, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "ZhiJing's Blog",
		imgurl: "https://iwexe.top/avatar.svg",
		desc: " Go with the flow.",
		siteurl: "https://iwexe.top/",
		rss: "https://iwexe.top/rss.xml",
		tags: ["Blog"],
		weight: 1, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "星遐蝶梦",
		imgurl: "https://blog.casto.top/assets/images/avatar.png",
		desc: "星穹漫遐，蝶携清梦。",
		siteurl: "https://blog.casto.top",
		rss: "https://blog.casto.top/rss.xml",
		tags: ["Blog"],
		weight: 10, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "L!!!!ght",
		imgurl: "https://easyimg.kejk.cn/i/4484873c-c2cc-4b3d-bc35-5c72ed01cfd9.webp",
		desc: "阳光正好，慢慢前行。",
		siteurl: "https://sunlight.kejk.cn",
		rss: "https://sunlight.kejk.cn/rss.xml",
		tags: ["Blog"],
		weight: 11, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "Saimen Blog",
		imgurl: "https://com.z2m.store/img/butterfly-icon.png",
		desc: "读史可以明智,知古方能鉴今。",
		siteurl: "https://blog.z2m.store",
		rss: "https://blog.z2m.store/rss.xml",
		tags: ["Blog"],
		weight: 9, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "沈幼楚の小窝",
		imgurl: "https://q1.qlogo.cn/g?b=qq&nk=1050925710&s=640",
		desc: "天真永不消逝，浪漫至死不渝.",
		siteurl: "https://blog.shenyouchu.cn/",
		rss: "https://blog.shenyouchu.cn/rss.xml",
		tags: ["Blog"],
		weight: 9, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "莱姆Lime",
		imgurl: "https://sudachi.top/logo.jpeg",
		desc: "聚是火簇，散作繁星",
		siteurl: "https://sudachi.top/",
		rss: "https://sudachi.top/rss2.xml",
		tags: ["技术"],
		weight: 17, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "THW's Blog",
		imgurl: "https://image.tianhw.top/avatar.webp",
		desc: "前途似海，来日方长",
		siteurl: "https://blog.tianhw.top",
		rss: "https://blog.tianhw.top/rss.xml",
		tags: ["Blog"],
		weight: 14, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "Sigrika-善良耙耙柑🍊",
		imgurl: "https://qwq.sigrika.cc/assets/images/avatar.gif",
		desc: "记录我的二次元之旅",
		siteurl: "https://qwq.sigrika.cc/",
		rss: "https://qwq.sigrika.cc/rss.xml",
		tags: ["Blog"],
		weight: 18, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "董健颖",
		imgurl:
			"https://weavatar.com/api/avatar/e3e6c5e34c0111ab1a16acb37cec03f01907406e60b49477c089001f5ed083b8?s=50&t=1781771969751?s=640",
		desc: "这是我的个人博客，记录我的学习和生活点滴，分享我的学习经验和见解。希望在这里能与志同道合的朋友们交流和成长！",
		siteurl: "https://dongjianying.xyz",
		rss: "https://dongjianying.xyz/rss.xml",
		tags: ["Blog"],
		weight: 20, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "萧小晓",
		imgurl: "https://www.lxlovo.top/png.png",
		desc: "萧小晓",
		siteurl: "https://blog.lxlovo.top",
		rss: "https://blog.lxlovo.top/rss.xml",
		tags: ["Blog"],
		weight: 13, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "JustPureH2O 的博客",
		imgurl: "https://justpureh2o.cn/avatar.jpg",
		desc: "穷方圆平直之情，尽规矩准绳之用",
		siteurl: "https://justpureh2o.cn",
		rss: "https://justpureh2o.cn/rss.xml",
		tags: ["Blog"],
		weight: 10, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "bug_zhang",
		imgurl: "https://bugzhang.online/_astro/avatar.Da2_m5jG_2uF8Oi.webp",
		desc: "我到底还要写多少bug。",
		siteurl: "https://bugzhang.online",
		rss: "https://bugzhang.online/rss.xml",
		tags: ["Blog"],
		weight: 12, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "SengokuCola'sBlog",
		imgurl: "https://lsky.nibutupaopao.top/i/2026/07/09/6a4fc40211f69.png",
		desc: "随着风的轨迹 在那耀眼的午后",
		siteurl: "https://home.nibutupaopao.top",
		rss: "https://home.nibutupaopao.top/rss.xml",
		tags: ["Blog"],
		weight: 12, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "Flygeonの小站",
		imgurl: "https://flygeon.top/_astro/avatar.CCT2o-B8_13KVJb.webp",
		desc: "音无结弦之时，悦动天使之心； 立于浮华之世，奏响天籁之音。",
		siteurl: "https://flygeon.top",
		rss: "https://flygeon.top/rss.xml",
		tags: ["Blog"],
		weight: 11, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "JerryLife",
		imgurl: "https://free.picui.cn/free/2026/07/16/6a58eb63ecbd1.png",
		desc: "Enjoy life",
		siteurl: "https://wee.jerry-nis.top/",
		rss: "https://www.jerry-nis.top/rss.xml",
		tags: ["Blog"],
		weight: 10, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "Zero - 浮生",
		imgurl: "https://vtdd.vip/_astro/avatar.ryzKiMN3_19g6Gw.webp",
		desc: "浮生一刹万般皆舍.",
		siteurl: "https://vtdd.vip",
		rss: "https://vtdd.vip/rss.xml",
		tags: ["Blog"],
		weight: 13, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "Olinl Blog",
		imgurl: "https://blog.olinl.com/assets/images/avatar.webp",
		desc: "分享、实践、学习",
		siteurl: "https://blog.olinl.com",
		rss: "https://blog.olinl.com/rss.xml",
		tags: ["Blog"],
		weight: 9, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "极客指北",
		imgurl: "https://www.90svip.cn/logo.png",
		desc: "极客指北",
		siteurl: "https://www.90svip.cn",
		rss: "",
		tags: ["Blog"],
		weight: 10, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "Refrain",
		imgurl: "https://s41.ax1x.com/2026/07/20/pm6aZIx.jpg",
		desc: "记录生活并分享经历的赛博小窝。",
		siteurl: "https://blog.50982026.xyz",
		rss: "https://blog.50982026.xyz/rss.xml",
		tags: ["Blog"],
		weight: 15, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "他说",
		imgurl: "https://090909.top/assets/images/logo.ico",
		desc: "梁栋烨的博客网站。",
		siteurl: "https://090909.top/",
		rss: "https://090909.top/atom.xml",
		tags: ["Blog"],
		weight: 9, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "xane",
		imgurl: "https://cloudflare-imgbed-d88.pages.dev/file/1784102742642_头像.jpg",
		desc: "Keep going.",
		siteurl: "https://xane.eu.cc",
		rss: "https://xane.eu.cc/rss.xml",
		tags: ["Blog"],
		weight: 2, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "Xixmu",
		imgurl: "https://xixmu.top/_astro/head_ima.rsW3s28l_1KtIxl.avif",
		desc: "记忆干枯前描绘。",
		siteurl: "https://xixmu.top/",
		rss: "https://xixmu.top/rss.xml",
		tags: ["Blog"],
		weight: 14, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "星诺的博客",
		imgurl: "https://blog.astrvow.com/_astro/logo.DuHgmi9I_1k5uPc.webp",
		desc: "只要热爱，太阳就会升起！",
		siteurl: "https://blog.astrvow.com/",
		rss: "https://blog.astrvow.com/rss.xml",
		tags: ["Blog"],
		weight: 13, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "倾听风雨",
		imgurl: "https://q1.qlogo.cn/g?b=qq&nk=3931968261&s=640",
		desc: "huh！",
		siteurl: "https://blog.qtfyu.top/",
		rss: "https://blog.qtfyu.top/rss.xml",
		tags: ["Blog"],
		weight: 12, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "拾玖的博客",
		imgurl: "https://shijiucode.cn/avatar.jpg",
		desc: "喜欢折腾，尝试创作。",
		siteurl: "https://shijiucode.cn",
		rss: "https://shijiucode.cn/shijiu-blog/api/rss.xml",
		tags: ["Blog"],
		weight: 10, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "StackMeow",
		imgurl: "https://www.stackmeow.tech/assets/profile/avatar.jpeg",
		desc: "人生是层层堆叠的经历，而内心永远保有一只自在小猫。",
		siteurl: "https://www.stackmeow.tech",
		rss: "https://www.stackmeow.tech/rss.xml",
		tags: ["Blog"],
		weight: 12, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "潇绪空のBlog",
		imgurl: "https://reknal.com/assets/images/avatar.avif",
		desc: "共同见证奇迹诞生！",
		siteurl: "https://reknal.com",
		rss: "https://reknal.com/rss.xml",
		tags: ["Blog"],
		weight: 9, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "SkyのXnok",
		imgurl: "https://201562.xyz/avatar.png",
		desc: "记录学习、生活与思考",
		siteurl: "https://201562.xyz",
		rss: "https://201562.xyz/rss.xml",
		tags: ["Blog"],
		weight: 10, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "Serendipity",
		imgurl: "https://blog.liuhangyv.top/upload/head-1785924834877.png",
		desc: "AI技术分享 × 行业动态 × 创新实践",
		siteurl: "https://blog.liuhangyv.top",
		rss: "https://blog.liuhangyv.top/rss.xml",
		tags: ["Blog"],
		weight: 8, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "伊linxiyy-微博客",
		imgurl: "https://lxya.net/api/images/a7630eac-ec4b-4729-ae67-461d7a48c0d9",
		desc: "记录生活，分享技术，留住美好瞬间",
		siteurl: "https://lxya.net",
		rss: "",
		tags: ["Blog"],
		weight: 12, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "MmzMing的知识库",
		imgurl: "https://i.stardots.io/784774835/StarDots-2026052116374135506.jpg",
		desc: "哈基米，南北绿豆",
		siteurl: "https://tblog.mmzhiku.xyz/",
		rss: "https://tblog.mmzhiku.xyz/rss.xml",
		tags: ["Blog"],
		weight: 18, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "锦木祈杰のblog",
		imgurl: "https://oss.qijieya.cn/1/hutao_hai.gif",
		desc: "敬....不完美的明天。",
		siteurl: "https://qijieya.cn/",
		rss: "https://qijieya.cn/rss.xml",
		tags: ["Blog"],
		weight: 12, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "Silvaire",
		imgurl:
			"https://wsrv.nl/?url=avatars.githubusercontent.com/u/184231508?s=400&u=0a370792ba6bbb95a04d309171b562bcd7283a0f&v=4&mask=circle",
		desc: "Per Aspera Ad Astra Blog",
		siteurl: "https://silvaire.top/",
		rss: "",
		tags: ["Blog"],
		weight: 10, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "临渊羡鱼",
		imgurl: "https://imgbed.yufish.cn/file/1786706585612_avatar.png",
		desc: "久有羡鱼意，不甘空望川. 躬身耕岁月，步步赴清澜",
		siteurl: "https://x1anyu.cn",
		rss: "https://x1anyu.cn/rss.xml",
		tags: ["Blog"],
		weight: 13, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
	{
		title: "EGS-blog",
		imgurl: "https://blog.egs.cc.cd/hero/avatar.png",
		desc: "heron_i的小站",
		siteurl: "https://blog.egs.cc.cd/",
		rss: "https://blog.egs.cc.cd/index.xml",
		tags: ["Blog"],
		weight: 10, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
];

// 获取启用的友链并进行排序
export const getEnabledFriends = (): FriendLink[] => {
	const friends = friendsConfig.filter((friend) => friend.enabled);

	if (friendsPageConfig.randomizeSort) {
		return friends.sort(() => Math.random() - 0.5);
	}

	return friends.sort((a, b) => b.weight - a.weight);
};
