import type { CoverImageConfig } from "../types/coverImageConfig";

/**
 * 文章封面图配置
 *
 * enableInPost - 是否在文章详情页显示封面图
 * enableInPostOverlay - 是否使用标题和元数据叠加在封面上的布局
 * showLoading - 是否显示封面图加载动画
 *
 * 随机封面图使用说明：
 * 1. 在文章的 Frontmatter 中添加 image: "api" 即可使用随机图功能
 * 2. 随机图 API 不支持按种子稳定返回，因此构建时由 scripts/generate-random-covers.ts
 *    为每篇文章固定一张封面写入 src/constants/random-covers.json（pnpm covers 可单独执行），
 *    保证列表页与文章页显示同一张图；映射提交到 git 后长期保持不变
 * 3. 想给某篇文章换封面：删除映射表中对应条目再执行 pnpm covers；也可直接填入图片URL
 * 4. 尚未固定的文章（如 pnpm dev 新增文章）会依次尝试所有配置的 API，全部失败后保留 LQIP 并显示错误提示
 *
 * // 文章 Frontmatter 示例：
 * ---
 * title: 文章标题
 * image: "api"
 * ---
 */
export const coverImageConfig: CoverImageConfig = {
	// 是否在文章详情页显示封面图
	enableInPost: true,

	// 是否使用标题和元数据叠加在封面上的布局
	enableInPostOverlay: false,

	// 是否显示转圈圈加载动画，会替代掉LQIP
	showLoading: false,

	randomCoverImage: {
		// 随机封面图功能开关
		enable: true,
		// 封面图API列表
		apis: ["https://tu.520781.xyz/random?type=img&dir=cover"],
		// API失败时的回退图片路径（相对于src目录或以/开头的public目录路径）
		fallback: "assets/images/cover.avif",
		// 是否显示加载动画
		showLoading: false,
	},
};
