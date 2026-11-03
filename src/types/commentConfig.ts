export type CommentConfig = {
	/**
	 * 当前启用的评论系统类型
	 * "none" | "twikoo" | "waline" | "giscus" | "disqus" | 'artalk'
	 */
	type: "none" | "twikoo" | "waline" | "giscus" | "disqus" | "artalk";
	twikoo?: {
		envId: string;
		region?: string;
		lang?: string;
		visitorCount?: boolean;
		/**
		 * Twikoo JS 文件地址，支持 CDN 链接
		 * 国内推荐: https://registry.npmmirror.com/twikoo/1.7.9/files/dist/twikoo.min.js
		 * 国际推荐: https://cdn.jsdelivr.net/npm/twikoo@1.7.9/dist/twikoo.min.js
		 */
		jsUrl?: string;
		/**
		 * Twikoo 自定义 CSS 文件地址，为空则不加载
		 */
		cssUrl?: string;
	};
	waline?: {
		serverURL: string;
		lang?: string;
		emoji: string[];
		login?: "enable" | "force" | "disable";
		visitorCount?: boolean; // 是否统计访问量，true 启用访问量，false 关闭
		/**
		 * Waline 自定义 CSS 文件地址，为空则不加载
		 */
		cssUrl?: string;
		/**
		 * 评论图片直传图床；未启用时回退 Waline 默认行为（图片转 base64 内嵌，单张上限 128KB）
		 */
		imageUpload?: {
			/** 是否启用直传 */
			enable?: boolean;
			/** 图床上传接口，CloudFlare ImgBed 为 https://<域名>/upload */
			endpoint?: string;
			/** 上传鉴权码，图床开启 AUTH_CODE 时填写 */
			authCode?: string;
			/** 上传目录（图床内的相对路径，如 "waline"），留空上传到根目录 */
			uploadFolder?: string;
			/** 存储渠道：telegram / cfr2 / s3 / discord / huggingface / webdav，留空使用图床默认 */
			uploadChannel?: string;
		};
	};
	artalk?: {
		// 后端程序 API 地址
		server: string;
		/**
		 * 语言，支持语言如下：
		 * - "en" (English)
		 * - "zh-CN" (简体中文)
		 * - "zh-TW" (繁体中文)
		 * - "ja" (日本語)
		 * - "ko" (한국어)
		 * - "fr" (Français)
		 * - "ru" (Русский)
		 * */
		locale: string | "auto";
		// 是否统计访问量，true 启用访问量，false 关闭
		visitorCount?: boolean;
	};
	giscus?: {
		repo: string;
		repoId: string;
		category: string;
		categoryId: string;
		mapping: string;
		strict: string;
		reactionsEnabled: string;
		emitMetadata: string;
		inputPosition: string;
		lang: string;
		loading: string;
	};
	disqus?: {
		shortname: string;
	};
};
