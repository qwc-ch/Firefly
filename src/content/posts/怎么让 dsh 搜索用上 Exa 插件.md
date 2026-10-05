---
title: 怎么让 dsh 搜索用上 Exa 插件
published: 2026-10-02
updated: 2026-10-05
description: dsh 基础包把 web 行的 searchProvider 钉死为 deepseek-official，导致搜索插件的"零配置自动接管"不会生效；本文记录排查过程与 profile 补丁层的修复方法。2026-10-05 勘误：profile 补丁层是整值替换而非合并，web 行必须把 fetchProvider 一并写上。
image: 'api'
tags: [dsh, AI, 搜索]
category: '运维'
draft: false
lang: 'zh-CN'
slug: zen-me-rang-dsh-sou-suo-yong-shang-exa-cha-jian
---

## 背景

dsh（[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)，本机版本 `@deepseek-ai/dsh@0.1.5-rc.3`）内置了 `web_search` 工具，官方搜索 provider（`dsh-web-search-deepseek`）需要 `DEEPSEEK_API_KEY`，而我没配这个 key，所以搜索一直是坏的。

于是我装了社区的搜索插件 [@tonydua/dsh-web-search-exa](https://github.com/TonyDua/dsh-web-search-exa)（npm 包 `@tonydua/dsh-web-search-exa@0.1.5`）：它为 `ctx.web` seam 提供一个 [Exa](https://exa.ai) 的 `WebSearchProvider`，**零配置、无需 API key**——无 key 时走匿名 MCP 兜底（`mcp.exa.ai/mcp`），有 key 时走 REST。

插件 README 里说得很清楚：

> Selection: with no API key the official deepseek provider is unavailable, so the seam auto-selects this provider (zero-config).

意思是没有 key 时官方 provider 不可用，seam 会自动选中它。然而装好之后，搜索还是报错。

## 问题现象

插件安装成功（market 日志显示 `@tonydua/dsh-web-search-exa@0.1.5 exit=0`），但 `web_search` 依然报：

```text
DeepSeek search has no API key for "DEEPSEEK_API_KEY";
store it through the credentials service ..., export it in the
launching environment, or set a literal "apiKey" in the
web-search-deepseek config
```

报错来自官方的 DeepSeek provider——也就是说搜索**根本没走 Exa 插件**。

## 排查过程

按排除法一步步来：

### 1. 插件安装正确吗？✓

profile（`~/.dsh/profiles/web/`）的 `package.json` 里 `dsh.profile.bundles` 包含 `@tonydua/dsh-web-search-exa`，它自带的 `cordis.patch.yml` 会向加载器插入 `web-search-exa` 行，`apply()` 是无条件注册的，不依赖任何设置项。

### 2. 模块能加载吗？✓

```bash
$ node -e "import('@tonydua/dsh-web-search-exa').then(m => console.log(Object.keys(m)))"
Config, DEFAULT_MCP_URL, ExaSearchProvider, apply, inject, ...
```

### 3. 网络可达吗？✓

```bash
$ curl -o /dev/null -w "%{http_code}\n" https://mcp.exa.ai/mcp      # → 405（GET 的预期响应）
$ curl -o /dev/null -w "%{http_code}\n" https://api.exa.ai/search   # → 404（同上）
```

### 4. 用插件同款请求直连实测

模仿插件的匿名 MCP 请求（POST + `tools/call`）：

```bash
$ node -e "fetch('https://mcp.exa.ai/mcp', { method: 'POST', headers: {...}, body })"
→ HTTP 200，text/event-stream，直接返回了真实搜索结果（J.K. 罗琳）
```

**结论：网络没问题、插件没问题，问题出在 provider 的选择上。**

## 根因：`web` 行把 `searchProvider` 钉死在 `deepseek-official`

翻 dsh-base 基础包的 `cordis.patch.yml`，`web` 行长这样：

```yaml
- id: web
  name: '@deepseek-ai/dsh-web'
  config:
    searchProvider: deepseek-official   # ← 钉死了
    fetchProvider: http
```

`WebRuntime` 构造时读 `config.searchProvider ?? process.env.DSH_WEB_SEARCH_PROVIDER`，于是 `searchProviderId = "deepseek-official"`。再看搜索时 seam 的选择规则（`dsh-web` 源码，`0.1.5-rc.3`）：

```js
function resolveProvider(selection) {
	const { configuredId, providers } = selection;
	if (configuredId !== void 0) {
		// 配置了 id：直接返回这个 provider，没注册/不可用才报错
		const provider = providers.get(configuredId);
		...
		return provider;
	}
	// 没配置 id：过滤出"可用"的 provider
	// 恰好 1 个 → 用它；>1 个 → 报 AMBIGUOUS；0 个 → 报 UNAVAILABLE
}
```

关键就在这里：

- 插件宣称的"零配置自动接管"依赖**第二条路**——没配置 id 时，官方 provider 因无 key 不可用，过滤后只剩 Exa，自动选中。
- 但 dsh-base 把 `searchProvider` 钉死为 `deepseek-official`，选择器拿到配置的 id 就**直接返回**，永远走不到第二条路。
- 更微妙的是，DeepSeek provider 的 `available()` 检查的是 `options.resolveApiKey !== void 0`——这个 thunk 恒为定义，所以它**永远"可用"**，只在真正 `search()` 解析 key 时才抛凭据错误。

于是完整的链路是：每次搜索 → 配置 id `deepseek-official` → 命中 DeepSeek provider → 无 `DEEPSEEK_API_KEY` → 报错。Exa 插件从头到尾没被咨询过。

## 修复：profile 补丁层按 id 覆盖

用户自己的 `~/.dsh/profiles/web/cordis.patch.yml` 应用在所有 bundle 层**之后**，可以按 id 覆盖行：

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- id: web
  config:
    searchProvider: exa
    fetchProvider: http
```

注意 `fetchProvider: http` **必须一并写上**。这是本文初版的一个勘误：初版写的是"加载器用 `Object.assign` 合并 config override，没写的字段保留原值"，这是错的。实际查 `cordis-plugin-include` 的 `applyEntryPatches` 源码，覆盖语义是：

```js
for (const [key, value] of Object.entries(overrides)) {
  if (key === "id") continue;
  target[key] = value;   // ← 整值替换，没有深合并
}
```

`config` 作为一个整体被替换掉，只写 `searchProvider` 会把 `fetchProvider` 丢掉。而 `WebRuntime.Config` 的 zod schema 里 `searchProvider` / `fetchProvider` 都是必填（`z.string()`），构造时 `config.fetchProvider ?? process.env.DSH_WEB_FETCH_PROVIDER` 会回退到环境变量——没配就是 `undefined`，`web_fetch` 会直接报"未配置 provider"。dsh-base 自家注释也写明了："A patch replaces the targeted row's whole `config` rather than merging into it"。按 id 覆盖行时，正确姿势是**把整行 config 完整重述一遍**，只改你想改的字段。

另外 profile 配了 `patchReload: "live"`，这个改动**保存即热重载生效，无需重启**。

之后 `web_search` 就走 Exa 插件了——搜"哈利波特作者是谁"直接返回真实结果（J.K. 罗琳），已在 2026-10-05 用上述两字段写法实测验证通过。

## 注意事项

- **熔断器**：Exa provider 连续 3 次瞬时失败（5xx、429、网络错误）会跳闸，5 分钟内 `available()` 为 false；冷却结束后下一次搜索会重新探测，成功一次即重置。因为现在配置了显式 id，跳闸期间 seam 会报 `configured web provider "exa" is registered but unavailable`——至少是个清晰的错误，而不是误导人的 DeepSeek 凭据错误。
- **为什么没提 PR**：这个修复本质是用户本地的 profile 配置（`cordis.patch.yml` 是用户的补丁层，不属于任何仓库），插件代码本身没有 bug——端点通、模块能加载、注册也无条件。问题只是 dsh-base 钉死了 `searchProvider`，而插件按约定不能（也不应）在自己的 bundle patch 里覆盖官方的行。所以写成博客记录，算是给插件作者一个"文档该补充一句"的素材。

## 小结

- **装插件 ≠ 会生效**：dsh 基础包把 `web` 行的 `searchProvider` 钉死为 `deepseek-official`，无 key 时插件的零配置自动接管不会发生，搜索只会撞上凭据错误。
- **覆盖是整值替换**：profile 补丁层按 id 覆盖 `web` 行时，`config` 整体被替换，必须把 `fetchProvider: http` 一并写上，只写 `searchProvider` 会丢抓取配置。
- **热生效**：`patchReload: "live"` 下保存即生效，无需重启 dsh。
- **仓库地址**：
  - 搜索插件：[TonyDua/dsh-web-search-exa](https://github.com/TonyDua/dsh-web-search-exa)（`@tonydua/dsh-web-search-exa@0.1.5`）
  - DeepSeek Harness：[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)（`@deepseek-ai/dsh@0.1.5-rc.3`）

排查这类问题的关键思路：先证明"网络通、模块能加载、端点可用"，把怀疑范围收敛到 provider 选择，再去翻 seam 的源码。祝玩得开心！
