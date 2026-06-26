---
title: GitHub Actions 自动构建并部署 Cloudflare Workers 实现思路
published: 2026-06-04
description: 讲解如何用 GitHub Actions 实现推送代码后自动构建 Astro 项目，将产物推送到 build 分支，并部署到 Cloudflare Workers
tags: [GitHub Actions, Cloudflare Workers, Astro, CI/CD]
category: 'blog'
draft: false
lang: 'zh-CN'
---

> [!WARNING]
> 这个项目在 Cloudflare Workers 上构建时可能会翻车。Astro 构建过程依赖 `sharp`（图片处理）和一些 Node.js 原生模块，Cloudflare Workers 的构建环境对这些支持有限。如果你在 Workers 上构建失败，别慌，这是正常操作。解决方案是：在 GitHub Actions 里构建好，只把产物丢过去，让 Workers 只管托管静态文件，别让它干重活。

## 为什么要搞这个

每次手动构建、再部署，累不累啊？反正我累了。目标是：推送代码到 `main` 分支后，GitHub Actions 自动帮你搞定三件事：

1. 构建 Astro 项目（让它在 CI 里卷）
2. 把构建产物推送到 `build` 分支（留个备份）
3. 部署到 Cloudflare Workers（上线，收工）

一条龙服务，你只需要 `git push`，剩下的交给机器人。

## 整体流程

```
push main → checkout → 安装依赖 → pnpm build → 推送 dist 到 build 分支 → wrangler deploy
```

## 实现思路

### 1. 触发条件

监听 `main` 分支的 push 事件，同时支持手动触发（`workflow_dispatch`）。手动触发的好处是：万一自动部署翻车了，你可以点一下重试，不用再 push 一个空提交。

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
```

### 2. 环境准备

GitHub Actions 的 Ubuntu 镜像里没有 pnpm，得自己装。顺序有讲究：先装 pnpm，再装 Node.js，这样 Node.js 的缓存机制才能识别 pnpm。搞反了缓存就废了。

```yaml
- name: Setup pnpm
  uses: pnpm/action-setup@v4
  with:
    version: 9.14.4

- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '24'
    cache: 'pnpm'  # 必须在 pnpm 安装之后
```

### 3. 构建项目

`pnpm run build` 其实是个三连：先生成图标，再用 Astro 构建，最后用 Pagefind 做全文搜索索引。这三步缺一不可，少了哪个搜索功能都会出问题。

```yaml
- name: Install Dependencies
  run: pnpm install --frozen-lockfile

- name: Build
  run: pnpm run build
```

### 4. 推送到 build 分支

用 `peaceiris/actions-gh-pages` 这个 action，把 `dist/` 目录的内容推到 `build` 分支。它每次都会暴力覆盖，不会保留历史。不过也没关系，反正构建产物每次都一样。

```yaml
- name: Push to build branch
  uses: peaceiris/actions-gh-pages@v4
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_dir: ./dist
    publish_branch: build
```

### 5. 部署到 Cloudflare Workers

最后一步，用 `wrangler deploy` 把构建好的静态文件丢到 Workers 上。这一步需要两个 secrets：API Token 和 Account ID，没这俩东西.wrangler 连不上 Cloudflare。

```yaml
- name: Deploy to Cloudflare Workers
  run: npx wrangler deploy
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

## 完整源码

```yaml
# 构建项目并将产物推送到 build 分支，然后部署到 Cloudflare Workers
name: Build to Branch

# 当推送到 main 分支时触发，也支持手动触发
on:
  push:
    branches: [main]
  workflow_dispatch:

# 需要写入权限来推送 build 分支
permissions:
  contents: write

# 同一时间只运行一个构建任务，取消正在运行的旧任务
concurrency:
  group: build
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      # 检出代码
      - name: Checkout
        uses: actions/checkout@v4

      # 安装 pnpm 包管理器
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9.14.4

      # 安装 Node.js 并配置 pnpm 缓存
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'

      # 安装项目依赖
      - name: Install Dependencies
        run: pnpm install --frozen-lockfile

      # 构建项目：生成图标 → Astro 构建 → Pagefind 索引
      - name: Build
        run: pnpm run build

      # 推送 dist 目录到 build 分支
      - name: Push to build branch
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
          publish_branch: build

      # 使用 wrangler CLI 部署到 Cloudflare Workers
      - name: Deploy to Cloudflare Workers
        run: npx wrangler deploy
        env:
          # Cloudflare API Token，需要 Edit Cloudflare Workers 权限
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          # Cloudflare 账户 ID，在 Dashboard 右侧栏可见
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

## 需要配置的 Secrets

在 GitHub 仓库 Settings → Secrets and variables → Actions 里加两个 secret，不加的话 workflow 会直接报错退出。

| Secret | 说明 | 获取方式 |
|--------|------|----------|
| `CLOUDFLARE_API_TOKEN` | API 令牌 | Cloudflare Dashboard → My Profile → API Tokens → Create Token |
| `CLOUDFLARE_ACCOUNT_ID` | 账户 ID | Cloudflare Dashboard 右侧栏 |

API Token 要选 **"Edit Cloudflare Workers"** 模板，这个模板包含 Workers 脚本编辑权限，部署够用了。

## 注意事项

- `--frozen-lockfile` 是个好东西，确保 CI 里不会偷偷给你更新依赖版本，避免"我本地能跑线上挂了"的经典剧情
- `concurrency` 配置能避免同时跑多个构建任务，省点 CI 分钟数
- `wrangler deploy` 会老老实实读取仓库根目录的 `wrangler.toml`，所以记得把这个文件提交上去
- `build` 分支只包含 `dist/` 的内容，源码不会泄露，放心用
