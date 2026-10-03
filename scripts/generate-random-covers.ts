/**
 * 构建期随机封面固定脚本
 *
 * 背景：随机图 API（CloudFlare ImgBed /random）不支持按 seed 参数稳定返回，
 * 同一篇文章在列表页和详情页会各自请求到两张不同的随机图。
 *
 * 本脚本在构建时对每篇 image: "api" 的文章调用一次随机 API（type=url&form=text），
 * 拿到确定的图片 URL 写入 src/constants/random-covers.json。
 * 生产渲染直接使用该映射，列表页和文章页必然显示同一张图。
 *
 * - 已存在于映射表中的文章不会重复请求 API（封面保持稳定，不随每次构建漂移）
 * - 文章不再使用 image: "api" 或文章被删除时，对应条目会被清理
 * - 单篇请求失败自动重试 3 次；仍失败则跳过（运行时回退随机 API 行为）
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
			return text;
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
	// 读取已有的映射表
	let existing: CoverMap = {};
	try {
		const content = await fs.readFile(OUTPUT_FILE, "utf-8");
		existing = JSON.parse(content);
		console.log(
			`[random-covers] Loaded ${Object.keys(existing).length} existing entries from ${OUTPUT_FILE}`,
		);
	} catch {
		console.log(`[random-covers] No existing ${OUTPUT_FILE}, will create new.`);
	}

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

	// 清理不再使用随机封面的文章条目
	const staleKeys = Object.keys(existing).filter((key) => !apiPosts.has(key));
	for (const key of staleKeys) {
		delete existing[key];
	}
	if (staleKeys.length > 0) {
		console.log(
			`[random-covers] Removed ${staleKeys.length} stale entries: ${staleKeys.join(", ")}`,
		);
	}

	// 只对尚未固定的文章请求 API
	const newIds = [...apiPosts.keys()].filter((id) => !(id in existing));
	console.log(
		`[random-covers] Found ${apiPosts.size} posts with image: "api", ${newIds.length} new to fix.`,
	);

	const covers: CoverMap = { ...existing };

	if (newIds.length > 0) {
		const api = randomCoverImage.apis[0];
		const usedUrls = new Set(Object.values(covers));
		for (const id of newIds) {
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
				console.warn(
					`[random-covers] Skipping ${id}: could not fetch an image.`,
				);
			}
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
