---
title: 随机封面修复记：同一篇文章，列表和详情页竟然两张图
published: 2026-10-03
image: 'api'
description: 博客列表页和文章详情页的随机封面每次都不一样，排查后发现是图床 /random 接口不支持种子参数。记录用"构建期固定封面"彻底解决这个问题的过程。
tags: ['博客', '图片', 'Astro', '排错']
category: 'blog'
draft: false
lang: 'zh-CN'
author: 'Admin'
slug: firefly-random-cover
---

## 起因

一直有个强迫症级别的问题困扰我：博文列表卡片上的封面图，点进文章页之后**变成了另一张图**。随机封面本来就是 `image: 'api'` 配的随机图，我一直以为是主题的正常行为，直到有天仔细一看——不对，这已经不是"好不好看"的问题了，列表页预览的图和文章实际的封面完全对不上。

更糟的是刷新一次列表页，所有封面又全变了。等于同一篇文章，每次访问、每个位置看到的都是随机结果。

## 排查：seed 参数是个摆设？

主题的封面处理逻辑其实考虑到了这个问题。`src/utils/image-utils.ts` 里对每篇文章按 id 生成一个哈希，拼成 `?v=123456` 这样的查询参数附加到随机图 API 后面，意图很明显：**让同一篇文章每次都拿到同一张图**。

列表卡片和文章页生成的 URL 完全一致。理论上浏览器该拿到同一张图才对。

那问题多半出在 API 端。直接用 curl 验证——用同一个 `v` 值连续请求三次：

```bash
for i in 1 2 3; do
  curl -s "https://tu.520781.xyz/random?type=img&dir=cover&v=12345" -o seed_$i
done
md5sum seed_*
```

三个文件的 md5 完全不同，甚至 `Content-Type` 都在 `image/jpeg`、`image/webp`、`image/avif` 之间横跳。**`v` 参数根本没有被处理**，每次请求都是纯随机。

再翻图床的 API 文档（图床是我自建的 [CloudFlare ImgBed](https://cfbed.sanyue.de/api/random.html)），`/random` 接口的参数只有 `content` / `type` / `form` / `dir` / `orientation` 五个——压根没有种子参数。主题代码和 API 能力之间，隔着一厢情愿。

也就是说：**只要封面 URL 指向 `/random` 接口，就不可能做到每篇文章固定一张图**。这是接口层面的能力缺失，不是主题代码的 bug。

## 转机：/random 的隐藏用法

文档里有个细节救了我：`/random` 默认直接返回图片，但加上 `type=url&form=text` 后，返回的是一张**确定图片的完整链接**：

```bash
curl "https://tu.520781.xyz/random?type=url&form=text&dir=cover"
# https://a.520781.xyz/file/cover/绘梨衣/1788687100738_xxx.webp
```

返回的是 `/file/...` 下的静态文件地址——随机性在返回链接这一刻就"结算"完了，之后这个链接永远指向同一张图，还能吃满 CDN 缓存。

思路立刻清晰：**构建时调一次接口，把每篇文章的封面链接钉死存下来，页面渲染时直接用存好的链接。**

## 实现

### 构建脚本 generate-random-covers.ts

新增 `scripts/generate-random-covers.ts`，插在构建流水线的 `astro build` 之前：

1. 扫描 `src/content/posts/`，找出 frontmatter 里 `image: 'api'` 的文章
2. 每篇调一次 `type=url&form=text`，拿到确定的图片链接
3. 以 `{ "entry.id": "图片URL" }` 写入 `src/constants/random-covers.json`（提交进 git，和 `lqips.json` 同一套模式）

几个设计要点：

- **只增不改**：已在映射表里的文章不再请求 API。没有这条，每次构建封面照样漂移，等于白做
- **自动清理**：文章删了或改回固定封面，映射条目同步移除
- **失败容忍**：单篇请求失败重试 3 次，仍失败就跳过，渲染端自动回退旧的随机行为，构建不会挂

最容易踩的坑是映射表的 key。最初我用文件名当 key，结果对不上——Astro Content Layer 的 `entry.id` 并不总是"文件名去扩展名"：它**优先取 frontmatter 的 `slug` 字段**，没有 slug 才回退到"路径去扩展名后每段过一遍 github-slugger"（中文和空格会被转换，大写字母会小写化）。脚本里照抄了这套规则才对齐：

```ts
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
```

### 渲染端改造

`image-utils.ts` 的改动很轻：模块顶层 import 映射表，`processCoverImageSync` 在走 API 拼接之前先查一次固定映射：

```ts
import randomCoversData from "@constants/random-covers.json";

// ...
const pinned = getPinnedCover(seed);
if (pinned) return pinned;
// 未固定的文章仍走原来的 API + 随机兜底
```

`getApiUrlList` 把固定链接排在重试列表首位，随机 API 殿后——万一哪天图床文件被删、固定链接 404，还能退回旧行为。

### 顺手加的防重复

第一版跑完发现 39 篇文章里有几张图撞车了——两张卡片显示同一张封面，看起来像个 bug。加了去重分配：每篇新文章最多重取 5 次直到不与其他文章重复，超过上限才接受重复。重跑一次后 39 篇全部唯一。

## 验证

脚本是幂等的（重复执行不产生 API 请求、文件字节级不变），但真正要回答的问题是：**产物里列表和详情到底是不是同一张图？**

跑完 `pnpm build` 后写了个小脚本扫 `dist/`，对每篇同时在列表卡片和文章页出现封面的文章，比对两处 `<img src>` 属性——27 篇全部一致，0 处不匹配。

## 效果与使用

- 列表页、文章页、分享海报引用的封面从此完全一致
- 封面变成静态文件链接，CDN 可缓存，刷新不再换图
- 日常无感知：新文章写 `image: 'api'`，下次构建自动分配

想给某篇文章换封面，把 `random-covers.json` 里对应条目删掉再 `pnpm covers` 即可；也可以直接手动填任意图片 URL。

## 小结

这次的问题链条挺典型：主题代码的"种子"设计看起来天衣无缝，但种子要生效得靠 API 端配合，而大多数随机图 API 并不支持。排查的关键一步是用 curl 剥掉所有中间层直接验证接口行为——**两次请求返回的字节一样吗？**一样才谈得上稳定。

解法也没有在渲染层纠缠（前端缓存、localStorage 同步都是歪路），而是把"随机"这件事挪到构建期一次性结算：随机只发生在构建时，发布出去的永远是确定结果。这和 SSG 的哲学意外地合拍。
