---
title: "Vercel 部署后全站 404 排查记"
published: 2026-08-07
description: "博客部署到 Vercel 后所有 HTML 页面都返回 404，静态资源却正常。本文记录了从现象、链路分析到定位根因（Vercel CLI cleanUrls 冲突与 l2s 上传 bug）的全过程，以及最终通过固定 CLI 版本解决的方案。"
image: ''
tags: ['Vercel', '排错', '部署']
category: 'Vercel,部署'
draft: false
lang: 'zh-CN'
author: 'Admin'
slug: vercel-deploy-404
---

## 引言

本博客同时部署在 Vercel、Cloudflare Workers、EdgeOne Pages 等多个平台。某天发现：

- 本地开发、Cloudflare、EdgeOne 访问全部正常；
- 唯独 **Vercel 上的域名（blog.amamo.top）所有 HTML 页面都返回 404**，而非 HTML 资源（`_astro/*`、图片、pagefind、rss.xml 等）全部正常。

CI 构建日志显示构建、部署、Alias 全部成功。这是一个"部署成功但内容缺失"的诡异问题，折腾了很久，记录下完整的排查思路和根因。

## 观察现象

对线上逐路径探测，得到如下行为矩阵：

| 路径 | 状态码 |
| --- | --- |
| `/`、`/about/`、`/posts/xxx/` | 404（响应体是站点自定义 404 页） |
| `/_astro/*.css`、`*.js`、图片 | 200 |
| `robots.txt`、`rss.xml`、`pagefind/*` | 200 |
| `/index.html`、`/about.html` | 308 重定向到去扩展名路径 |

关键信息：

1. 非 HTML 静态资源 200，说明部署确实上传了文件；
2. 所有 HTML 页面 404，说明 HTML 部分出了问题；
3. `*.html` 请求被 308 重定向，说明存在 **cleanUrls 风格的路由规则**。

## 排查过程

### 第一步：确认是部署产物问题而非缓存

本地 `pnpm dev` 正常，`dist/` 里 37 个 `index.html` 都在。为了排除中间层 CDN 缓存，带随机 query 重新请求，仍然是 404。查看响应头：

```
server: Vercel
x-vercel-cache: HIT
```

404 是**源站（Vercel 边缘）自己返回的**，不是 CDN 缓存了旧响应。

### 第二步：对比「部署文件列表」与「本地产物」

通过 Vercel API 拉取最新部署的文件列表：

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.vercel.com/v13/deployments/<id>/files"
```

结果出乎意料：**37 个 HTML 文件全部在部署里**，路径也都正确（`posts/astbot/index.html`、`about/index.html` 等）。文件在、路径对，线上却 404 —— 说明**文件内容在服务端无效**。

### 第三步：找到 cleanUrls 冲突

本地执行 `vercel build --prod` 后检查生成的 `.vercel/output/config.json`，发现 CLI 生成了大量 `overrides` 和 308 重定向规则：

```jsonc
{
  "overrides": {
    "index.html": { "path": "index" },
    "about/index.html": { "path": "about/index" }
  },
  "routes": [
    { "src": "^/(?:(.+)/)?index(?:\\.html)?/?$", "headers": { "Location": "/$1" }, "status": 308 }
  ]
}
```

**这就是问题一**：`vercel.json` 里的 `"cleanUrls": true` 会让 CLI 把所有 HTML 文件"改名为无扩展名"（`about/index.html` → `about/index`）。于是：

- 请求 `/about/` 走目录解析，找 `about/index.html` —— 不存在（已被改名）；
- 请求 `/about/index` —— 被 308 重定向规则切到 `/about`；
- `/about` 又找不到文件 —— 404。

而 `/404` 之所以能 200，是因为它不在重定向规则里、能直接命中改名后的 `404` 文件。

修复后，404 页面本身回归正确 404，`/`、`/about/` 等一级页面全部 200。**但 `/posts/`、`/gallery/`、`/dynamic/` 依旧 404** —— 还有第二个问题。

### 第四步：定位真正的元凶 —— l2s 上传 bug

继续对比，发现一个奇怪规律：**有一级子目录的「父目录」全部 404，纯叶子目录全部 200**：

```
/about 200    /archive 200    /search 200
/posts 404    /gallery 404    /dynamic 404     （这三个目录里还有子目录）
```

此时检查本地 `.vercel/output/static/` 里的文件类型，真相大白：

```
output/static/about/index.html      # 普通文件 529060 字节（正常）
output/static/posts/astbot/index.html -> /home/qwc/Firefly/dist/posts/astbot/.l2s..l2s.index.html0001.00010001   （符号链接！）
```

**Vercel CLI 58.7.1 的 l2s 上传优化在处理大文件时，把 `index.html` 替换成了指向失效路径的符号链接（symlink），真实数据被写进了 `.l2s.index.html0001.0002` 分片文件**。上传时 Vercel 把这些符号链接原样记录（目标路径在服务器上不存在），于是:

- HTML 在文件列表里"存在"，但服务端读取时解析不到 → 404；
- `about/index.html` 是硬链接（保留真实文件）→ 正常；
- `wrangler`（Cloudflare）上传时会跟随符号链接读到真实内容 → CF 完全正常。

这也解释了为什么 CI 部署时上传只有 19.8MB（大量符号链接被跳过/去重），而实际产物有 52MB。

## 为什么新版本 CLI 有问题，旧版本没问题

这次问题的核心在 Vercel CLI 58.x 引入的 **l2s（large-file storage）上传优化**。它的本意是把大文件切分成约 1MB 的小块（`.l2s.<文件名>0001`、`0002`…），以便内容寻址去重、并发上传、断点续传，服务器端再重组。**57 和 58 都用了分片，但实现方式截然不同**：

| | 分片后的原文件 | 上传结果 |
| --- | --- | --- |
| **vercel@57** | 保留为**真实文件**（与分片文件互为硬链接，link count = 2），`readFile` 随时能读到完整内容 | 正常 |
| **vercel@58.7.1** | 被替换成**符号链接**，指向本地绝对路径（`/home/qwc/.../.l2s...`），且出现嵌套分片（`.l2s..l2s.` 双层前缀） | 服务端解析不到 → 404 |

58.7.1 的具体问题有两个：

1. **symlink 目标写死成本机绝对路径**：`posts/astbot/index.html -> /home/qwc/Firefly/dist/posts/astbot/.l2s..l2s.index.html0001.00010001`。这个路径只在本机存在，上传到 Vercel 后无法解析，文件"在列表里、读不出内容"。
2. **对已分片的文件再次分片**：正常的 l2s 分片命名是 `.l2s.index.html0001.0001`，而 58.7.1 在部分文件上生成了**嵌套前缀** `.l2s..l2s.index.html0001.00010001`，说明分片逻辑对"分片产物"又跑了一遍，symlink 指向了错误的目标。

而 57 的处理方式是**硬链接**：`index.html` 和 `.l2s.index.html0001.0002` 是同一个 inode 的两个目录项，`index.html` 始终是真实文件、内容完整。上传时 CLI 读到的就是完整数据，服务器端重组无需依赖符号链接。

**为什么"以前正常、某一天突然全站 404"**：CI 里用的是 `npx vercel`（不带版本号），npx 每次拉取的都是**最新版**。以前最新版还是 57.x（实现正确），某次升级到 58.7.1（实现有 bug）后，CI 的每一次部署都带着坏掉的符号链接上传——所以在 GitHub Actions 部署日志全部成功的情况下，线上依旧全站 404。

### 为什么 Cloudflare / EdgeOne 不受影响

同一份 dist，三家平台的部署工具走的是完全不同的上传模型：

| 部署工具 | 上传模型 | 遇到 symlink | 结果 |
| --- | --- | --- | --- |
| `wrangler`（Cloudflare） | 逐文件 `readFile` 读取内容上传 | 自动跟随链接，读到真实字节 | 正常 |
| `edgeone pages deploy` | 逐文件读取内容上传 | 自动跟随链接 | 正常 |
| `vercel deploy`（CLI 58） | 本地预处理 + 内容寻址分片上传 | 把 symlink 当路径记录，不上传内容 | 404 |

wrangler / edgeone 是朴素的"文件内容上传"模型，没有本地预处理这一层，符号链接在读文件时就被解析掉了，自然不受影响。Vercel CLI 因为多了 l2s 预处理层，才把 bug 带进了部署产物。**多平台部署（CF / EdgeOne / Vercel）在这种场景下相当于交叉验证：同一份 dist，别人正常、只有 Vercel 异常，问题几乎可以锁定在 Vercel 的部署链路上。**

## 根因总结

两个问题叠加：

1. **`cleanUrls: true` 与 Astro 的 `trailingSlash: "always"` 冲突** —— HTML 被改名导致带尾斜杠的路由全部 404；
2. **Vercel CLI 58.x 的 l2s 上传 bug** —— 更大的问题，大文件被替换成失效符号链接，导致部分目录的 HTML 无法读取。

两个问题都只在 Vercel 这边出现，Cloudflare / EdgeOne 的部署链路不受影响。

## 解决方案

### 直接修复

1. **从 `vercel.json` 删除 `cleanUrls: true`**，HTML 文件保持原名，目录路由恢复正常；
2. **固定 Vercel CLI 版本到 57**：

   ```bash
   npx -y vercel@57 build --prod
   npx -y vercel@57 deploy --prebuilt --prod
   ```

   `vercel@57` 同样会生成 l2s 分片，但采用**硬链接**（`index.html` 保持真实文件），上传到 Vercel 后数据完整。58.7.1 则会被坏符号链接“阉割”掉大文件。

3. CI workflow 中同步把 `npx vercel` 改为 `npx vercel@57`，防止自动升级到带 bug 的版本。

## 经验总结

- 部署"成功"不等于内容完整，排查时**对比线上返回值与本地产物**而不是只看状态码；
- 对于知名 PaaS 的 CLI，**锁定版本**是避免"莫名其妙" bug 的最有效手段（`npx vercel` → `npx vercel@57`）；
- 多平台部署（CF / EdgeOne / Vercel）有交叉验证的作用：同一份 dist，wrangler 正常、vercel CLI 异常，直接指向 CLI 本身的问题。