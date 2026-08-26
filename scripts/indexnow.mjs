// IndexNow 提交脚本：构建完成后把 sitemap 里的全部 URL 推送给搜索引擎
// 已接入 pnpm build 最后一步；也可单独运行：node scripts/indexnow.mjs
//
// 历史踩坑（参考 posts/seo-indexing-fix-journey）：
// 1. key 文件必须无多余换行（已用 printf 写入，无 \n）
// 2. POST 批量接口被 Bing 稳定 403，GET 单个提交接口返回 202 ——
//    因此 api.indexnow.org / bing.com 用 GET 逐条提交，其余端点用 POST 批量
// 3. Bing 对"未授权主机"状态会缓存约 24h，提交前确保 key 文件已部署上线

import { readFileSync } from "node:fs";

const KEY = "72672fa4181d9d6f3bd5b29751f94bcd";
// 这些端点 POST 稳定 403，改走 GET 单个提交
const GET_ENDPOINTS = [
	"https://api.indexnow.org/indexnow",
	"https://www.bing.com/indexnow",
];
// 这些端点 POST 批量提交可正常接受
// 注：Naver（韩国）/ Seznam（捷克）已对境外站稳定 403，且中文站受众不涉及，已移除
const POST_ENDPOINTS = [
	"https://yandex.com/indexnow",
];

let xml;
try {
	xml = readFileSync("dist/sitemap-0.xml", "utf-8");
} catch {
	console.log("⏭ sitemap 不存在，跳过 IndexNow 提交");
	process.exit(0);
}

const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
	m[1].replace(/&amp;/g, "&"),
);
if (urlList.length === 0) {
	console.log("⏭ sitemap 中没有 URL，跳过 IndexNow 提交");
	process.exit(0);
}

const host = new URL(urlList[0]).host;

// POST 批量提交（Yandex / Naver / Seznam）
const payload = JSON.stringify({ host, key: KEY, keyLocation: `https://${host}/${KEY}.txt`, urlList });
for (const endpoint of POST_ENDPOINTS) {
	try {
		const res = await fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json; charset=utf-8" },
			body: payload,
		});
		console.log(res.ok || res.status === 202 ? `⚡ OK   ${endpoint} -> ${res.status}` : `⚠ FAIL ${endpoint} -> ${res.status}`);
	} catch (err) {
		console.warn(`⚠ ERR  ${endpoint} -> ${err.message}`);
	}
}

// GET 逐条提交（Bing 系：POST 被拒时的可用路径）
let submitted = 0;
for (const url of urlList) {
	for (const endpoint of GET_ENDPOINTS) {
		try {
			const res = await fetch(`${endpoint}?url=${encodeURIComponent(url)}&key=${KEY}`);
			if (res.ok || res.status === 202) submitted++;
		} catch { /* 单条失败忽略 */ }
	}
}

console.log(`✔ IndexNow 提交完成：${urlList.length} 个 URL，Bing 系端点成功 ${submitted} 条 (${host})`);
process.exit(0);
