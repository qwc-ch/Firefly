/**
 * 构建期问候卡壁纸抓取脚本
 *
 * 背景：侧边栏「时间问候」卡片原先在运行时直接请求 random-api.czl.net 随机图，
 * 单张 3.4MB+（Cloudflare 托管，大陆访问慢，且不支持 URL 压缩参数，实测见
 * 2026-11 PageSpeed 分析）。
 *
 * 本脚本在每次构建时请求一次随机图 API，把图片下载到 src/assets/greeting-wallpapers/，
 * 交给 Astro 内置图片管线（sharp）在构建时压缩/转格式（TimeGreeting.astro 里
 * 通过 getImage 处理），运行时改为同源小图直出。每次构建换一张，保留随机性。
 *
 * - 该随机 API 对无 UA 请求直接 403，必须携带浏览器 User-Agent
 * - 拉取成功才覆盖旧图；失败时保留上一次构建的产物，不阻塞构建
 * - 生成文件名固定为 greeting-api.*（gitignore，不入库）；
 *   目录里用户手动放置的图片不受影响，同样会被优化并参与随机
 *
 * 手动触发：pnpm greeting
 */
import fs from "node:fs/promises";
import path from "node:path";

const TARGET_DIR = "src/assets/greeting-wallpapers";
const GENERATED_BASENAME = "greeting-api";
const API_URL = "https://random-api.czl.net/pic/fj";
// 该 API 校验 User-Agent，缺失时返回 403
const USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const MAX_RETRIES = 3;
const MIN_BYTES = 10 * 1024; // 小于 10KB 视为无效响应
const TIMEOUT_MS = 30_000;

function extFromContentType(contentType: string): string {
	const lower = contentType.toLowerCase();
	if (lower.includes("png")) return "png";
	if (lower.includes("webp")) return "webp";
	if (lower.includes("avif")) return "avif";
	if (lower.includes("gif")) return "gif";
	return "jpg";
}

async function listGeneratedFiles(): Promise<string[]> {
	try {
		const files = await fs.readdir(TARGET_DIR);
		return files.filter((f) => f.startsWith(`${GENERATED_BASENAME}.`));
	} catch {
		return [];
	}
}

async function main() {
	await fs.mkdir(TARGET_DIR, { recursive: true });

	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		try {
			const response = await fetch(API_URL, {
				headers: { "User-Agent": USER_AGENT, Accept: "image/*" },
				redirect: "follow",
				signal: AbortSignal.timeout(TIMEOUT_MS),
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const contentType = response.headers.get("content-type") ?? "";
			if (!contentType.startsWith("image/")) {
				throw new Error(`unexpected content-type: ${contentType}`);
			}
			const buffer = Buffer.from(await response.arrayBuffer());
			if (buffer.length < MIN_BYTES) {
				throw new Error(`image too small: ${buffer.length} bytes`);
			}

			// 拉取成功才替换：先删旧文件再写新文件
			for (const file of await listGeneratedFiles()) {
				await fs.rm(path.join(TARGET_DIR, file), { force: true });
			}
			const ext = extFromContentType(contentType);
			const outputPath = path.join(TARGET_DIR, `${GENERATED_BASENAME}.${ext}`);
			await fs.writeFile(outputPath, buffer);
			console.log(
				`[greeting-wallpaper] saved ${outputPath} (${(buffer.length / 1024).toFixed(0)} KiB, ${contentType})`,
			);
			return;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (attempt === MAX_RETRIES) {
				const kept = await listGeneratedFiles();
				console.warn(
					`[greeting-wallpaper] fetch failed after ${MAX_RETRIES} attempts: ${message}` +
						(kept.length
							? `; keeping previous ${kept.join(", ")}`
							: "; no previous file, runtime falls back to remote API"),
				);
				return;
			}
		}
	}
}

main();
