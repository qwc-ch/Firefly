/**
 * 构建期随机封面分配脚本
 *
 * 背景：随机图 API（CloudFlare ImgBed /random）不支持按 seed 参数稳定返回，
 * 同一篇文章在列表页和详情页会各自请求到两张不同的随机图。
 *
 * 本脚本在每次构建时对每篇 image: "api" 的文章调用一次随机 API（type=url&form=text），
 * 全量重新随机分配封面，写入 src/constants/random-covers.json。
 * 渲染端直接使用该映射，列表页和文章页必然显示同一张图（每次构建整体换一批新封面）。
 *
 * - 图片池足够大，撞车的概率很小；重复时最多重取 MAX_UNIQUE_ATTEMPTS 次
 * - 单篇请求失败自动重试 3 次；仍失败则跳过该篇（运行时回退随机 API 行为）
 * - 每次构建都会产生新的封面组合，git diff 记录每一次变化
 *
 * 手动触发：pnpm covers
 */
import fs from "node:fs/promises";
import path from "node:path";
import { slug as githubSlug } from "github-slugger";
import { glob } from "glob";
import { coverImageConfig } from "../src/config/coverImageConfig";

const POSTS_DIR = "src/content/posts";
const OUTPUT_FILE = "src/constants/random-covers.json";

type CoverMap = Record<string, string>;

const MAX_RETRIES = 3;
// 同一页面上两张卡片撞同一张封面很像 bug，取到重复图时重取的次数上限（超出则接受重复）
const MAX_UNIQUE_ATTEMPTS = 5;

/** 仅在 frontmatter 块内提取字段值（支持单双引号或无引号） */
function extractFrontmatterField(
	content: string,
	field: string,
): string | undefined {
	const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!fm) return undefined;
	const match = fm[1].match(
		new RegExp(`^${field}:\\s*(['"]?)(.*?)\\1\\s*$`, "m"),
	);
	if (!match) return undefined;
	return match[2] || undefined;
}

/**
 * 复现 Astro glob loader 的 entry.id 规则：
 * frontmatter 的 slug 字段优先，否则是文件相对路径去扩展名后
 * 每段做 github-slugger 转换、拼接、去掉尾部 /index。
 */
function computeEntryId(fileRelPath: string, frontmatter: string): string {
	const explicitSlug = extractFrontmatterField(frontmatter, "slug");
	if (explicitSlug) return explicitSlug;
	const withoutExt = fileRelPath.replace(/\.(md|mdx|markdown)$/i, "");
	return withoutExt
		.split("/")
		.map((segment) => githubSlug(segment))
		.join("/")
		.replace(/\/index$/, "");
}

/**
 * 把图片链接的域名归一化为配置中 API 使用的域名。
 * 图床 type=url 返回的链接固定写死它的主域（如 a.520781.xyz），
 * 但同一文件在绑定的别名域（如 tu.520781.xyz）上路径相同且实测更快，
 * 因此统一替换为配置的 API 域；今后换域名只需改 coverImageConfig。
 */
function normalizeCoverHost(rawUrl: string, api: string): string {
	try {
		const wantedHost = new URL(api).host;
		const url = new URL(rawUrl);
		if (url.host !== wantedHost) url.host = wantedHost;
		return url.toString();
	} catch {
		return rawUrl;
	}
}

/** 调用随机 API，返回完整图片 URL（失败返回 null） */
async function fetchRandomImageUrl(api: string): Promise<string | null> {
	// 保留配置里 API 的查询参数（如 dir=cover 目录过滤），只改写返回形态
	const [base, query = ""] = api.split("?");
	const params = new URLSearchParams(query);
	// type=url&form=text 直接返回完整图片链接（见 CloudFlare ImgBed 随机图 API 文档）
	params.set("type", "url");
	params.set("form", "text");
	const requestUrl = `${base}?${params.toString()}`;
	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		try {
			const response = await fetch(requestUrl, {
				signal: AbortSignal.timeout(15000),
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const text = (await response.text()).trim();
			if (!text.startsWith("http")) {
				throw new Error(`Unexpected response: ${text.slice(0, 100)}`);
			}
			return normalizeCoverHost(text, api);
		} catch (error) {
			if (attempt === MAX_RETRIES) {
				console.warn(
					`[random-covers] Failed to fetch from ${base} after ${MAX_RETRIES} attempts: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
		}
	}
	return null;
}

async function main() {
	const { randomCoverImage } = coverImageConfig;
	if (!randomCoverImage.enable || randomCoverImage.apis.length === 0) {
		console.log(
			"[random-covers] randomCoverImage is disabled or has no APIs, skipping.",
		);
		return;
	}

	// 扫描所有博文，找出 frontmatter 中 image 为 "api" 的文章，
	// key 使用与渲染端一致的 entry.id
	const files = await glob("**/*.{md,mdx}", { cwd: POSTS_DIR, nodir: true });
	const apiPosts = new Map<string, string>(); // entry.id -> 相对文件路径
	for (const file of files) {
		const normalized = file.replace(/\\/g, "/");
		const content = await fs.readFile(
			path.join(POSTS_DIR, normalized),
			"utf-8",
		);
		if (extractFrontmatterField(content, "image") === "api") {
			const id = computeEntryId(normalized, content);
			if (apiPosts.has(id)) {
				console.warn(
					`[random-covers] Duplicate entry id "${id}" (${apiPosts.get(id)} and ${normalized}); keeping the first.`,
				);
				continue;
			}
			apiPosts.set(id, normalized);
		}
	}

	// 每次构建全量重新随机分配：不保留旧映射，所有 image: "api" 的文章重新获取
	console.log(
		`[random-covers] Found ${apiPosts.size} posts with image: "api", refetching all covers.`,
	);
	const covers: CoverMap = {};
	const api = randomCoverImage.apis[0];
	const usedUrls = new Set<string>();
	for (const id of apiPosts.keys()) {
		let imageUrl: string | null = null;
		// 尽量让每篇文章拿到不同的封面；连续重复时接受最后一次结果
		for (let attempt = 0; attempt < MAX_UNIQUE_ATTEMPTS; attempt++) {
			const candidate = await fetchRandomImageUrl(api);
			if (!candidate) break;
			if (!usedUrls.has(candidate)) {
				imageUrl = candidate;
				break;
			}
			imageUrl ??= candidate;
		}
		if (imageUrl) {
			covers[id] = imageUrl;
			usedUrls.add(imageUrl);
			console.log(`[random-covers] ${id} -> ${imageUrl}`);
		} else {
			console.warn(`[random-covers] Skipping ${id}: could not fetch an image.`);
		}
	}

	// 写入（key 排序保证 git diff 稳定）
	const sorted: CoverMap = {};
	for (const key of Object.keys(covers).sort()) {
		sorted[key] = covers[key];
	}
	await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
	await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(sorted, null, 2)}\n`);
	console.log(
		`[random-covers] Done. Total ${Object.keys(sorted).length} covers fixed. Output: ${OUTPUT_FILE}`,
	);
}

main();
