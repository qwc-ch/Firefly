// IndexNow 提交脚本：构建完成后把 sitemap 里的 URL 提交给 IndexNow
// （Bing、Yandex 等搜索引擎会据此立即抓取，加速新页面收录）
// 用法：npx tsx scripts/indexnow.ts （已接入 pnpm build 最后一步）

import fs from "node:fs/promises";

const SITEMAP = "dist/sitemap-0.xml";
// 与 public/<key>.txt 保持一致，该文件必须能通过 https://<host>/<key>.txt 访问
const KEY = "e6950b10-2a82-497f-b285-dcabe051be53";
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
	const payload = {
		host,
		key: KEY,
		keyLocation: `https://${host}/${KEY}.txt`,
		urlList,
	};

	const res = await fetch(INDEXNOW_API, {
		method: "POST",
		headers: { "Content-Type": "application/json; charset=utf-8" },
		body: JSON.stringify(payload),
	});

	if (!res.ok) {
		// 提交失败只告警不阻断构建
		console.warn(`⚠ IndexNow 提交失败: ${res.status} ${await res.text()}`);
		return;
	}
	console.log(`⚡ IndexNow 已提交 ${urlList.length} 个 URL (${host})`);
}

main().catch((err) => {
	console.warn("⚠ IndexNow 提交异常:", err);
});
