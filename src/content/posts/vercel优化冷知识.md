---
title: "vercel优化冷知识"
description: "vercel优化冷知识"
published: 2026-08-14
updated: 2026-08-14
draft: false
tags: ['优选，vercel']
category: 'vercel'
author: '年华'
---

## 引言

本文基于博主 **Upxuu** [什么？你的vercel还没深绿？一文研究透vercel优选|缓存配置](https://upxuu.com/posts/vercel-youxuan-cache/)这期文章写成。

## ip优选

Vercel官方支持ip优选，并维维护了一条中国优化的 CNAME

```
cname-china.vercel-dns.com
```
只需替换为此cname，既可完成优选。

## 地区优选

Vercel默认的函数的运行区域是美国东部，更改很简单只需 **进入已部署的项目 → Settings → Functions → Functions Region** 然后取消勾选美国东部，勾选香港，日本，新加坡等亚太地区，这里有一个坑免费计划只能选一个地区。

## CDN缓存配置

Vercel 默认情况下，你的主 HTML 根本命中不了缓存。vercel.json中可以配置。

### 我的vercel.json

```json
{
  "buildCommand": "pnpm run build",
  "outputDirectory": "dist",
  "installCommand": "pnpm install",
  "framework": "astro",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "SAMEORIGIN"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, s-maxage=31536000, must-revalidate"
        }
      ]
    },
    {
      "source": "/_astro/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```