// IndexNow 提交脚本：构建完成后把 sitemap 里的 URL 提交给 IndexNow
// （Bing、Yandex 等搜索引擎会据此立即抓取，加速新页面收录）
// 用法：npx tsx scripts/indexnow.ts （已接入 pnpm build 最后一步）
//
// 注意：本站用 POST 接口会稳定返回 403 (UserForbiddedToAccessSite)，
// 即使 key 文件验证正常；改用 GET 接口（每 URL 一次请求）则正常返回 202。

import fs from "node:fs/promises";

const SITEMAP = "dist/sitemap-0.xml";
// 与 public/<key>.txt 保持一致，该文件必须能通过 https://<host>/<key>.txt 访问
const KEY = "964bdf1f-3f89-4680-bc50-af4392f896d9";
const INDEXNOW_API = "https://api.indexnow.org/indexnow";

async function main() {
	let xml: string;
	try {
		xml = await fs.readFile(SITEMAP, "utf8");
	} catch {
		console.log("⏭ sitemap 不存在，跳过 IndexNow 提交");
		return;
	}

	const urlList = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) =>
		m[1].replace(/&amp;/g, "&"),
	);
	if (urlList.length === 0) {
		console.log("⏭ sitemap 中没有 URL，跳过 IndexNow 提交");
		return;
	}

	const host = new URL(urlList[0]).host;
	let submitted = 0;
	const failed: string[] = [];

	for (const url of urlList) {
		const res = await fetch(
			`${INDEXNOW_API}?url=${encodeURIComponent(url)}&key=${KEY}`,
		);
		if (res.ok || res.status === 202) {
			submitted++;
		} else {
			failed.push(`${url} (${res.status})`);
		}
	}

	if (failed.length > 0) {
		// 提交失败只告警不阻断构建
		console.warn(
			`⚠ IndexNow 提交完成，${submitted} 成功 / ${failed.length} 失败:`,
		);
		for (const f of failed.slice(0, 5)) {
			console.warn(`   ${f}`);
		}
		return;
	}
	console.log(`⚡ IndexNow 已提交 ${submitted} 个 URL (${host})`);
}

main().catch((err) => {
	console.warn("⚠ IndexNow 提交异常:", err);
});
