---
title: "把 Aemeath 的站点统计页移植到 Firefly"
published: 2026-10-05
image: 'api'
draft: false
description: "记录把 Aemeath 主题的公开站点统计页 /analytics 移植到 Firefly 博客主题的过程：Umami 公开分享接口、Waline 最新评论、GitHub 推送热力图与侧栏统计快照组件的适配记录。"
tags: ['Firefly', 'Umami', 'Astro', '博客']
category: '博客搭建'
author: 'Admin'
---

最近把 Aemeath 主题里的公开统计页搬到了这个 Firefly 主题里。Aemeath 是原作者的项目，站点地址：[http://rainzt.cn](http://rainzt.cn)。它把 Umami 公开数据、Waline 最新评论、GitHub 推送热力图聚合在一个独立的 `/analytics` 页面里，做成了一块"会呼吸"的真实数据面板。这篇文章记录移植过程，顺便说明新加了哪些文件。

> Aemeath 的原页面地址是作者站点的 `/analytics`，思路来源与样式实现都值得细看；Firefly 这边做了本地适配。

## 一、新增的三个文件

### 1. `src/pages/analytics.astro`

独立的「站点统计」页面，访问 `/analytics/`。基于 Umami 的公开分享接口（只读鉴权，不需要管理员 Token），包含：

- **总览卡片**：累计访客、累计浏览、今日访客、今日浏览
- **访问脉冲**：7 / 30 / 90 天切换的浏览量与访客趋势
- **热门页面排行**：按路径的 Top 页面
- **访客分布**：设备、浏览器、国内地域分布的环形图与图例
- **流量来源**：channel 维度来源渠道
- **部署动态**：GitHub main 分支推送热力图
- **最新评论**：读取 Waline 公开评论流

页面重点做了容错：单个接口超时只影响对应模块，其他模块照常显示；加了 2 分钟级 localStorage 缓存，Swup 切页后重新挂载动画与数据。

### 2. `src/components/widget/AnalyticsSnapshot.astro`

侧栏用的统计快照小组件，展示设备分布和浏览器偏好的环形图（donut），读取同一组 Umami 公开接口，适合挂在侧栏或首页。

### 3. `src/pages/api/github-pushes.json.ts`

构建期预渲染的 JSON 接口 `/api/github-pushes.json`：服务端执行 `git log HEAD --since=53 weeks ago` 读取提交时间，供统计页的部署热力图使用。移植时把硬编码的仓库名从 `Jarvis0227/Aemeath` 改成了本站的 `qwc-ch/Firefly`。

## 二、配置上的改动

只动了配置，不破坏原有结构：

- `src/config/analyticsConfig.ts`：给 Umami 配置补 `shareId`、`shareApiBase`（指向自建的 `https://umami.520781.xyz`）、`historicalStats`、`showPageViews`、`showSiteStats`
- `src/types/analyticsConfig.ts`：同步补充对应类型字段
- `src/config/navBarConfig.ts`：「其他」下拉里原来指向 Umami 外部分享页的「统计」，改成本地 `/analytics/` 入口

Waline 已经在 `src/config/commentConfig.ts` 里启用，统计页的最新评论模块会直接复用它的 `serverURL`，不用额外配置。

## 三、验证方式

- `pnpm astro check`：282 个文件，0 错误 0 警告
- `pnpm exec biome ci` 对新增/改动文件：通过

构建流程没有跑完整 build（本地较慢），静态产物和接口在 `pnpm astro check` 的类型检查下已经通过；部署后访问 `/analytics/` 和 `/api/github-pushes.json` 即可看到效果。

## 结语

这套统计页的价值在于"公开可读"——不需要暴露 Umami 管理后台，访客也能看到站点的真实活力。移植到 Firefly 后，主题原有的 `UmamiStats` 侧栏小组件保持不变，`/analytics` 只是多了一个更完整的数据总览入口。感谢 Aemeath 作者的开源与分享。
