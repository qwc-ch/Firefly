---
title: 记一次博客收录优化：从 1 个页面到全部可收录
published: 2026-08-19
description: 分享为博客排查 Google/Bing 收录问题的全过程：canonical 缺失、重复页面判定、meta description 雷同，以及 IndexNow 接入时踩过的各种坑。
tags: [SEO, 收录, IndexNow, Astro, Bing]
category: 'blog'
draft: false
lang: 'zh-CN'
---

## 起因

在 Google Search Console 里看了一眼站点的收录情况，发现数据不太乐观：

- 已索引页面：**1 个**（只有首页）
- 未编入索引：**23 个**

未索引的原因分三类：

| 原因 | 数量 | 说明 |
| --- | --- | --- |
| Crawled - currently not indexed | 21 | 已抓取但未收录，新站常见 |
| Duplicate without user-selected canonical | 1 | 没有指定规范网页的重复内容 |
| Not found (404) | 1 | `/posts/` 返回 404 |

「Duplicate without user-selected canonical」这条最扎眼——**全站没有任何 `<link rel="canonical">` 标签**。没有 canonical，Google 无法区分 `https://blog.amamo.top/posts/xxx/` 与不带斜杠的版本、分页页、搜索参数变体，于是只收录一个代表页（首页），其余全部被当作重复内容。

## 修复一：补上 canonical

在布局组件的 `<head>` 里加一行：

```html
<link rel="canonical" href={Astro.url} />
```

配合 Astro 的 `trailingSlash: "always"`，输出的就是带斜杠的完整 URL，与 sitemap 保持一致。这是一个纯声明式的修复，不影响页面显示，只影响搜索引擎对 URL 的判断。

修复后无斜杠版本（如 `/posts/astbot`）虽然在 Vercel 上同样返回 200，但页面内的 canonical 指向带斜杠版本，Google 会自动剔除重复 URL。

## 修复二：robots.txt 屏蔽参数页

`/archive/?tag=xxx` 这类带查询参数的过滤页会被反复抓取，但永远不会被收录，纯浪费抓取配额。在 robots.txt 里加上：

```txt
Disallow: /*?tag=
```

## 修复三：消除雷同的 meta description

Bing 后台提示「太多页面使用相同的 meta description」。原因是我之前用的兜底逻辑：

```
description || siteConfig.description || pageTitle
```

所有没写 description 的页面（归档、搜索、标签、分类页）全部退回到同一个站点描述。修复方案：

1. **文章页**：没有手写 description 时，兜底用正文第一段作为摘要（项目里本来就有 remark-excerpt 插件在生成 excerpt，只是没人用）
2. **归档/搜索/标签/分类页**：各自补充独立的 description（走 i18n，六种语言都加了翻译）

## 修复四：接入 IndexNow

IndexNow 是一个开放协议，Bing、Yandex、Naver、Seznam 都支持：网站根目录放一个 `<key>.txt` 文件作为"地盘证明"，发布内容后主动向搜索引擎提交 URL，通常几小时到一两天内就会被抓取，不需要等爬虫慢慢来。

我做了三件事：

1. 生成一个 UUID 作为 key，写入 `public/<key>.txt`（注意：**文件内容不能有多余的换行符**，Bing 校验非常严格，这是第一个坑）
2. 写了一个构建后脚本 `scripts/indexnow.ts`：读 sitemap 里的 URL，逐个端点提交
3. 接入 `pnpm build` 最后一步，以后每次部署自动提交

### 踩坑记录

**坑一：key 文件不能有换行符。** `printf` 写入文件时默认带 `\n`，Bing 验证 key 文件内容时严格比对，多余的换行符会导致验证失败（403）。

**坑二：POST 接口 403，GET 接口正常。** 相同的 key、相同的 URL，`POST https://api.indexnow.org/indexnow` 稳定返回 403，改用 GET 请求则返回 202。最终脚本改成对多个端点逐一提交：

- `api.indexnow.org`（Bing 聚合）
- `www.bing.com`
- `yandex.com`
- `searchadvisor.naver.com`
- `search.seznam.cz`

实测同一 key：Yandex/Naver/Seznam 全部接受，只有 Bing 拒绝。

**坑三：Bing 会把主机标记为"未授权"并缓存。** Bing 的验证器会异步验证 key 文件，一旦判定主机"未授权"（比如 key 文件还没上线就去提交），这个状态会被缓存，**换新 key 也绕不过去**，只能等缓存过期（最长 24 小时）或等待域名验证方式修正。

**坑四：用"从 Google Search Console 导入"验证的域名，Bing 的 IndexNow 会拒绝。** 我在 Bing Webmaster Tools 里重新添加了站点，改用 XML 文件方式验证，之后 Bing 的 IndexNow 面板就能看到提交记录了（353 条）。

**坑五：搜索引擎不解析 sitemap 索引文件。** 先是在 Bing 上发现提交 `sitemap-index.xml` 只发现 1 个 URL；后来发现 Google Search Console 也一样——8/1 读过一次索引后 "Sitemaps read" 一直为 0。两个搜索引擎都改成**直接提交 `sitemap-0.xml`** 后，Bing 和 Google 均成功发现 39 个 URL。

## 现状与总结

- Google 侧：canonical、meta description、robots.txt 均已修复；sitemap-0.xml 已成功处理（39 个 URL）。剩下的交给时间（新站收录慢是正常的）
- Bing 侧：网站地图 ✅（39 个 URL）、IndexNow ✅（353 条提交记录），Yandex/Naver/Seznam 也已收到提交
- 后续发新文章，部署时自动提交 IndexNow，无需手动操作

这次排查最大的感悟：**SEO 里 90% 的问题都是"少了一行标签"**。canonical、description、robots.txt 这些基础项做好，剩下的就是内容质量和耐心。
