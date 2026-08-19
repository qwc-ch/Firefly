// IndexNow 提交脚本：构建完成后把 sitemap 里的 URL 提交给 IndexNow
// （Bing、Yandex、Naver、Seznam 等搜索引擎会据此立即抓取，加速新页面收录）
// 用法：npx tsx scripts/indexnow.ts （已接入 pnpm build 最后一步）
//
// 背景：api.indexnow.org / www.bing.com 对本主机稳定返回 403
// (UserForbiddedToAccessSite)，但同一 key + 同一批 URL 在
// Yandex / Naver / Seznam 端点均被正常接受，说明 key 文件本身没问题，
// 问题在 Bing 侧的主机验证状态。因此这里对多个端点逐一提交。

import fs from "node:fs/promises";

const SITEMAP = "dist/sitemap-0.xml";
// 与 public/<key>.txt 保持一致，该文件必须能通过 https://<host>/<key>.txt 访问
const KEY = "964bdf1f-3f89-4680-bc50-af4392f896d9";
const ENDPOINTS = [
	"https://api.indexnow.org/indexnow",
	"https://www.bing.com/indexnow",
	"https://yandex.com/indexnow",
	"https://searchadvisor.naver.com/indexnow",
	"https://search.seznam.cz/indexnow",
];

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

	let anySuccess = false;
	for (const endpoint of ENDPOINTS) {
		try {
			const res = await fetch(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json; charset=utf-8" },
				body: JSON.stringify(payload),
			});
			const body = await res.text();
			const ok = res.ok || res.status === 202;
			if (ok) {
				anySuccess = true;
				console.log(`⚡ OK   ${endpoint} -> ${res.status}`);
			} else {
				console.warn(
					`⚠ FAIL ${endpoint} -> ${res.status} ${body.slice(0, 120)}`,
				);
			}
		} catch (err) {
			console.warn(`⚠ ERR  ${endpoint} -> ${String(err)}`);
		}
	}

	if (anySuccess) {
		console.log(`✔ IndexNow 提交完成，共 ${urlList.length} 个 URL (${host})`);
	} else {
		console.warn("⚠ 所有 IndexNow 端点均提交失败（不阻断构建）");
	}
}

main().catch((err) => {
	console.warn("⚠ IndexNow 提交异常:", err);
});
