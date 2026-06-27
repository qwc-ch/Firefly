---
title: 给博客写了个后台管理
published: 2026-06-27
description: 一个简单顺手的博客后台，从零到一的实践记录
tags: [Firefly, admin, 开源]
category: 开发
draft: false
lang: zh_CN
pinned: true
---

一边写博客一边觉得，要是能有个顺手的管理界面就好了。于是趁周末动手写了一个，前后端都搭在自己能掌控的基础设施上。

前端是 Firefly 主题的一部分，嵌在博客项目里，用 Svelte 5 的 runes 语法写的几个组件；后端单独部署在 Cloudflare Workers 上，框架是 Hono。

文章存在 GitHub 仓库里，通过 Contents API 读写，所以每次保存都会自动产生一次 Git 提交，版本历史天然就跟着走了。站点配置存在 Cloudflare D1 里，查询和保存都很快。图片走的是自建的 CloudFlare-ImgBed，上传时通过后端代理转发到图床，返回的 URL 直接插入 Markdown 正文。

后台主要分三块：文章编辑器带 Markdown 工具栏和实时预览，站点配置页管理社交链接和友链，还有一个图片管理器可以浏览和删除已上传的图片。编辑器支持拖拽和剪贴板上传图片，前端用 XHR 做了进度条。

前后端都已开源：

::github{repo="qwc-ch/Firefly"}

::github{repo="qwc-ch/firefly-admin-cfworkers"}