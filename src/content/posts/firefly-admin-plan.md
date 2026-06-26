---
title: Firefly Admin 后台方案
published: 2026-06-24
description: Firefly博客后台管理系统技术方案，基于SvelteKit + Cloudflare Workers
image: ''
tags: ['开发', '方案']
category: '技术'
draft: true
lang: 'zh_CN'
---

## 架构概览

```
┌─────────────────────────────────────┐
│  Cloudflare Access (Zero Trust)     │  ← 访问 admin.xxx.workers.dev 时验证
│  保护整个后台域名                    │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│  Firefly Admin (SvelteKit)          │
│                                     │
│  认证：admin.json 明文              │
│  存储：D1 + GitHub + R2            │
└─────────────────────────────────────┘
```

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | SvelteKit 2 | 与Firefly一致 |
| UI组件 | Skeleton UI / TailwindCSS | 快速开发 |
| API框架 | Hono | 轻量，Cloudflare原生 |
| 数据库 | Cloudflare D1 | 配置存储 |
| 文章存储 | GitHub API | Markdown文件 |
| 图片存储 | Cloudflare R2 | 图片资源 |
| 认证 | Cloudflare Access + admin.json | 简单认证 |
| 部署 | Cloudflare Workers | 与Firefly一致 |

## 与现有服务的类比

| 服务 | 部署位置 | 集成方式 | 存储 |
|------|----------|----------|------|
| **Twikoo评论** | `twikoo.520781.xyz` | JS加载 + envId配置 | 自有数据库 |
| **Firefly Admin** | `admin.520781.xyz` | API调用 + 环境变量 | D1 + GitHub + R2 |

## 目录结构

```
firefly-admin/
├── src/
│   ├── routes/                    # SvelteKit路由
│   │   ├── +layout.svelte         # 根布局
│   │   ├── +page.svelte           # 仪表盘
│   │   ├── posts/
│   │   │   ├── +page.svelte       # 文章列表
│   │   │   ├── new/
│   │   │   │   └── +page.svelte   # 新建文章
│   │   │   └── [slug]/
│   │   │       └── +page.svelte   # 编辑文章
│   │   ├── config/
│   │   │   └── +page.svelte       # 配置管理
│   │   └── api/                   # API路由 (Hono)
│   │       ├── posts/
│   │       │   ├── +server.ts     # 文章列表/新建
│   │       │   └── [slug]/
│   │       │       └── +server.ts # 单篇文章操作
│   │       ├── config/
│   │       │   └── +server.ts     # 配置读写
│   │       └── images/
│   │           ├── +server.ts     # 图片管理
│   │           └── [key]/
│   │               └── +server.ts # 图片代理
│   ├── lib/
│   │   ├── server/
│   │   │   ├── github.ts          # GitHub API封装
│   │   │   ├── d1.ts              # D1数据库操作
│   │   │   └── r2.ts              # R2存储操作
│   │   ├── components/            # Svelte组件
│   │   │   ├── PostEditor.svelte  # Markdown编辑器
│   │   │   ├── PostList.svelte    # 文章列表
│   │   │   ├── ConfigEditor.svelte# 配置编辑器
│   │   │   └── ImageManager.svelte# 图片管理
│   │   └── stores/                # Svelte stores
│   │       └── posts.ts           # 文章状态
│   └── app.html                   # HTML模板
├── admin.json                     # 认证配置
├── wrangler.toml                  # Cloudflare配置
├── svelte.config.js               # SvelteKit配置
└── package.json
```

## admin.json

```json
{
  "username": "admin",
  "password": "your-password-here"
}
```

## 数据库设计 (D1)

### site_config 表

```sql
CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 示例数据
INSERT INTO site_config (key, value) VALUES
('friends', '[{"title":"友链1","url":"...","avatar":"...","desc":"..."}]'),
('announcement', '{"content":"公告内容","enabled":true}'),
('site_meta', '{"title":"年华","subtitle":"欢迎来到我的小破站","description":"..."}');
```

## API 设计

### 文章接口

| 路由 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/posts` | GET | 文章列表 | 是 |
| `/api/posts` | POST | 新建文章 | 是 |
| `/api/posts/:slug` | GET | 获取文章 | 是 |
| `/api/posts/:slug` | PUT | 更新文章 | 是 |
| `/api/posts/:slug` | DELETE | 删除文章 | 是 |

### 配置接口

| 路由 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/config` | GET | 获取配置 | 是 |
| `/api/config` | POST | 保存配置 | 是 |

### 图片接口

| 路由 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/api/images` | GET | 图片列表 | 是 |
| `/api/images/upload` | POST | 上传图片 | 是 |
| `/api/images/:key` | DELETE | 删除图片 | 是 |
| `/img/:key` | GET | 图片代理（公开） | 否 |

## Firefly 博客集成

### 1. 动态配置读取

```typescript
// src/config/dynamicConfig.ts
const ADMIN_API = import.meta.env.PUBLIC_ADMIN_API || '';

export async function getDynamicConfig() {
  if (!ADMIN_API) return {};
  
  try {
    const res = await fetch(`${ADMIN_API}/api/config/public`);
    return await res.json();
  } catch {
    return {};
  }
}
```

### 2. 友链集成

```typescript
// src/config/friendsConfig.ts
import { friendsConfig as staticFriends } from './friendsConfig.static';

export async function getFriends() {
  try {
    const res = await fetch('https://admin.520781.xyz/api/config/friends');
    const dynamic = await res.json();
    if (dynamic.friends?.length) return dynamic.friends;
  } catch {}
  return staticFriends;
}
```

## wrangler.toml

```toml
name = "firefly-admin"
main = ".svelte-kit/output/server/index.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

routes = [
  { pattern = "admin.520781.xyz", zone_name = "520781.xyz" }
]

[[d1_databases]]
binding = "DB"
database_name = "firefly-admin"
database_id = "xxx"

[[r2_buckets]]
binding = "R2"
bucket_name = "firefly-images"

[vars]
GITHUB_OWNER = "qwc"
GITHUB_REPO = "Firefly"
GITHUB_BRANCH = "master"
POSTS_PATH = "src/content/posts"
BLOG_URL = "https://blog.520781.xyz"

# Secrets: wrangler secret put GITHUB_TOKEN
```

## 实现步骤

| 步骤 | 内容 | 工作量 |
|------|------|--------|
| 1 | 项目初始化（SvelteKit + Hono） | 0.5天 |
| 2 | 基础架构（D1 + 认证） | 1天 |
| 3 | 文章管理（GitHub API + 编辑器） | 2天 |
| 4 | 配置管理（D1读写 + 界面） | 1天 |
| 5 | 图片管理（R2 + 代理） | 1天 |
| 6 | 测试部署 | 0.5天 |
| **总计** | | **6天** |

## 优势

1. **与Firefly解耦**：独立部署，互不影响
2. **复用现有模式**：与Twikoo评论系统集成方式一致
3. **Cloudflare原生**：D1 + R2 + Workers，无需外部服务
4. **数据自主**：文章在GitHub，配置在D1，图片在R2
5. **简化认证**：Cloudflare Access做网关，内部用admin.json
