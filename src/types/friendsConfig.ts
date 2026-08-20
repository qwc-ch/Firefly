// 友链配置
export type FriendLink = {
	title: string; // 友链标题
	imgurl: string; // 头像图片URL
	cover?: string; // 卡片封面图片URL（可选，显示在卡片顶部横幅）
	desc: string; // 友链描述
	siteurl: string; // 友链地址
	rss?: string; // RSS订阅地址（用于朋友圈）
	linkpage?: string; // 友链页面URL（用于 check-flink 反链检测，留空则检测首页）
	tags?: string[]; // 标签数组
	weight: number; // 权重，数字越大排序越靠前
	enabled: boolean; // 是否启用
};

export type FriendsPageConfig = {
	title?: string; // 页面标题，留空则使用 i18n 中的翻译
	description?: string; // 页面描述，留空则使用 i18n 中的翻译
	showCustomContent?: boolean; // 是否显示自定义内容（friends.mdx）
	showComment?: boolean; // 是否显示评论区，默认 true
	randomizeSort?: boolean; // 是否打乱排序，如果为 true，将忽略 weight，随机排序
};
