---
title: "一次移动端可用性排查：从点不动的底栏到 Swup 静默失败"
published: 2026-11-26
image: 'api'
description: "记录 Firefly 主题移动端底部侧栏整块不可点击、Swup 导航偶发静默失败的排查与修复，顺带总结上一次提交里的性能优化。"
tags: ['Firefly', 'Astro', '移动端', 'Swup', '排错', '性能优化']
category: '博客搭建'
draft: false
lang: 'zh-CN'
slug: firefly-mobile-sidebar-swup-fixes
author: 'Admin'
---

最近收到反馈：手机上点「更多动态」没反应，电脑上偶尔也点不动。顺着这条线往下挖，最后牵扯出两个独立的问题：一个是结构性 Bug，一个是请求层兜底缺失。这篇文章把排查过程、修复方式和验证结果完整记下来，顺带复盘上一次提交 `1f8588449` 做的性能优化。

## 一、点不动的「更多动态」：一个负 `z-index` 引发的血案

### 现象与定位

「最新动态」组件底部有个「更多动态」按钮，手机和电脑上都出现过点击没反应的情况。先说移动端：按钮存在、可见、位置和尺寸都正常，但点击就像打在了空气上。

用 Playwright 把视口设成 390×844，滚到按钮附近后在按钮中心做 `elementFromPoint()`，命中的是 `div#content-column`，而不是 `<a>` 或它的子元素。`locator.click()` 也一直报 `waiting for element to receive events`。结论很明确：**按钮被上层内容截获，事件根本没到它手里**。

查到 `src/styles/layout-base.css` 里有这么一段：

```css
#mobile-bottom-sidebar {
  position: relative;
  z-index: -1;
}
```

负层级把整个移动端底部侧栏压到了内容层之下。受影响的远不止「更多动态」一个按钮——`sidebarConfig.mobileBottomComponents` 里配置的全部组件都失去了交互：资料卡、公告、时段问候、分类、标签、最新动态、站点统计、天气、站点信息。

### 为什么当初要加它

注释写得很清楚：这是为了修 Waline 表情弹层被底部资料卡盖住的问题。

底部组件带 `.onload-animation`，原来的样式是：

```css
.onload-animation {
  opacity: 0;
  animation: fade-in-up 120ms ease-out forwards;
}
```

`forwards` 会在动画结束后永久保留 `transform: translateY(0)`。哪怕位移量是 0，`transform` 依然存在，于是每个组件都变成了层叠上下文。底部组件又因为 DOM 顺序排在评论区之后，就从视觉上盖住了从评论卡底部溢出的 Waline 表情弹层——表情看得见却点不到，壁纸模式下两侧都是半透明底，尤其明显。

当时的修法是用负 `z-index` 把整块沉底。确实解决了遮挡，但代价是整块不可点击，属于用一个新 Bug 修旧 Bug。

### 修复

思路是「谁造成的问题就修谁」，而不是动整个侧栏的绘制顺序：

1. 删除 `#mobile-bottom-sidebar { z-index: -1 }`，并在原处留下警告注释，防止后续再被加回来。
2. `.onload-animation` 从 `forwards` 改成 `backwards`：

```css
.onload-animation {
  animation: fade-in-up 120ms ease-out backwards;
}
```

`backwards` 表示延迟期间保持首帧状态，动画结束后回到元素默认样式。这样既保留了入场淡入上移的观感，又不会残留 `transform`，自然也就不再产生长期层叠上下文。
3. 再给 Waline 弹层显式抬一层，兜住溢出场景：

```css
.wl-emoji-popup,
.wl-gif-popup {
  z-index: 50;
}
```

三层改动合起来，底部侧栏恢复可点，评论弹层也不再被遮挡。

## 二、电脑上也点不动：Swup 的静默回退

移动端修好后，桌面端偶发的「点了没反应」就凸显出来了。桌面端按钮命中测试是正常的，问题出在 Swup 切页。

Swup 会拦截链接点击，用 `fetch()` 拉取目标页再替换 DOM。拉取失败时，它默认的失败处理是执行 `window.history.back()`。如果用户是直接打开首页，history 里没有可回退的 SPA 记录，`history.back()` 什么也做不了——URL 不变、内容不变，看起来就是「点了完全没反应」。

实测 4 次点击里有 1 次失败，伴随 `Failed to fetch`；请求日志显示目标页本身返回 200，路径、容器、服务端都正常，纯粹是请求层面的偶发失败。

在 `src/utils/swup-transitions.ts` 里加了请求层兜底：

- 运行时把 `swup.options.timeout` 设为 15 秒。`@swup/astro` 1.8 不会把 `astro.config.mjs` 里的 `timeout` 透传给 Swup 构造函数，所以必须在运行时直接改。默认的 0 是无限等待，极端情况下用户会一直卡着。
- 在 `fetch:request` 钩子里包裹默认 handler：网络失败或 5xx 时短暂等待后重试一次；仍失败则用 `window.location.assign(target)` 走原生整页跳转。这样「点了必有反应」。

这里踩了一个坑，值得单独说：**`@swup/preload-plugin` 的预加载请求也会走 `fetch:request`，但它有自己独立的 visit**。如果兜底不区分是不是当前导航，失败的预加载请求就会触发原生跳转，把用户莫名其妙带到预加载目标——我们实测中就被带到了 `/archive/`。所以兜底必须加活动判断：

```ts
const isActiveVisit = () => swup.visit === visit;
if (!isActiveVisit()) {
  return defaultHandler(requestUrl, options);
}
```

预加载失败只安静丢弃，绝不导航。这个判断加上后，`pnpm check` 通过，连续点击测试也稳定了。

## 验证结果

用 Playwright 在 390×844 移动视口下逐项回归：

- `#content-wrapper` 计算后 `transform: none`、`animation-fill-mode: backwards`；`#mobile-bottom-sidebar` 的 `z-index` 为 `auto`。
- 按钮中心命中测试落在链接自身（`contains: true`），点击后成功跳转到 `/dynamic/`。
- `pnpm check`：0 errors、0 warnings、0 hints。

## 上一笔提交：把首屏的活儿往后挪

这次修复之外，上一次提交 `1f8588449 优化性能` 也做了不少工作，一并记在这里，免得时间久了说不清。核心思路都是：**慢的第三方请求和重初始化，能懒就懒、能缓存就缓存、能放到浏览器空闲时就别阻塞首屏。**

- **歌词按需加载**（`MusicManager.astro`）：以前切歌就拉一遍 lrc，PageSpeed 实测这个 meting 请求串行要 5～10 秒。现在歌词 UI 没开时切歌只重置状态，等开始播放（悬浮歌词需要）或用户打开歌词面板时才 `ensureLyrics()`，并用 `lyricsLoadingFor` 防止同一曲目重复请求。
- **Spine 模型**（`SpineModel.astro`）：CSS 和运行时都改成「本地优先、CDN 兜底」，不再先打 unpkg（大陆访问慢且不稳定）；播放器初始化改到 `requestIdleCallback`（超时 4 秒，降级 `setTimeout` 2500ms），避免每帧读布局的长任务拖慢首屏。
- **动态侧栏**（`DynamicSidebar.svelte`）：Memos 接口此前默认 `pageSize=10000` 全量拉取，实测 7 秒以上。现在只取侧栏需要的那一页（`pageSize: limit, maxPages: 1`），数量达到上限时徽标显示 `N+`。
- **天气组件**（`Weather.astro`）：补上了此前「只写不读」的 localStorage 缓存；同页多个天气组件共用一份 in-flight Promise，避免同一 URL 并发请求三次；首次加载改到 `requestIdleCallback`，有新鲜缓存时直接渲染。
- **时段问候卡**（`TimeGreeting.astro`）：从运行时请求第三方随机图 API，改为构建期用 Astro 图片管线压缩本地壁纸池，随机选一张同源小图，浏览器可缓存、Swup 换页可复用；目录为空时才回退到运行时 API。
- **欢迎提示**（`WelcomeToast.astro`）：IP 归属接口结果缓存 6 小时，请求延迟到浏览器空闲；Toast 展示时间从 5 秒调到 8 秒，给异步文案留出填充时间。
- **随机封面与图片工具**：`random-covers.json` 变成 gitignore 的构建产物，单篇拉取失败时沿用上一次构建的封面，不再让封面消失；`image-utils.ts` 改用 `import.meta.glob` 读取，全新克隆还没生成文件时也不会报错。

## 写给上游

上面这些改动都在我自己的 fork 里。底栏负 `z-index` 的问题属于主题代码，根因清晰、影响面也不小，后续可以考虑向 `CuteLeaf/Firefly` 反馈。Swup 兜底是我自己代码里的改动，不需要提到上游。

## 一点感受

这次排查最值得记住的是三条：

1. **不要用负 `z-index` 修遮挡**。它会把整块交互一起沉下去，问题从「弹层点不到」变成「整块都点不到」。
2. **动画的 `fill-mode` 会改变层叠结构**。`forwards` 留下的 `transform`，哪怕位移是 0，也是一个层叠上下文；视觉上看不出来，交互上却会出问题。
3. **兜底逻辑要分清「当前导航」和「预加载」**。带预加载插件的 Swup 里，这条区分不做，兜底本身就会变成新的 Bug。

代码改完了，测试也过了。希望这篇记录能帮到遇到类似问题的朋友。
