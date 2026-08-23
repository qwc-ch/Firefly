---
title: "开源推荐：把 QQ 机器人搬到 Hugging Face 免费跑（AstrBot + NapCat）"
description: "开源推荐：把 QQ 机器人搬到 Hugging Face 免费跑（AstrBot + NapCat）"
published: 2026-08-19
updated: 2026-08-19
draft: false
tags: ['AstrBot', 'QQ机器人', 'HuggingFace', '部署', '开源']
category: 'AI'
author: 'Admin'
---

## 先说痛点

想跑一个 QQ 机器人，通常得面对三座大山：

- **服务器**：便宜的国内鸡性能拉胯，性能好的一个月小几十块；
- **备案**：想用国内云搭建需要备案域名，流程漫长；
- **数据**：配置、会话、QQ 登录态随便丢一个，都得重新折腾半天。

如果你只是想让机器人「活着」，不想伺候服务器 —— 下面这个项目就是为这个场景设计的。

## 项目是干什么的

把 **AstrBot**（开源 AI 聊天机器人框架，可视化面板配置 OpenAI / Claude / Gemini / 本地 Ollama 等模型）+ **NapCat**（QQ / OneBot 协议桥接，扫码登录）打包进一个 Docker 镜像，`git push` 到 Hugging Face Space 就能跑。

HF 的 **CPU Basic 免费档**就够了，不需要服务器，不需要备案。

## 亮点在哪

**1. 数据全量备份，重启不丢**

这是我觉得最值钱的部分。Space 每次重建容器都会被清空，所以项目内置了一个 sync 守护进程：

- 启动时从远端恢复数据（配置、会话、QQ 登录态）；
- 运行期间每 3 分钟自动 `commit + push` 一次；
- 大于 60MB 的文件自动走 LFS（git-lfs 协议），不会把仓库撑爆。

备份目标可以选 **GitHub 仓库**或 **Hugging Face 仓库**，`GIT_BACKEND` 一行切换。想把所有数据都放 HF 也行。

**2. 三个开关，改一行配置就生效**

```bash
# config.env
ENABLE_NAPCAT=true    # 是否启动 NapCat
ENABLE_GIT_PUSH=true  # 是否推送备份到远端
ENABLE_HF_PUSH=true   # 是否上传大文件到 LFS
```

改完推上去自动重新构建，不用改代码。

**3. 单端口网关，路由可视化**

所有服务（AstrBot 面板、NapCat WebUI、文件管理）都挂在同一个 7860 端口下，路由规则在 `/admin/ui/` 页面里可视化编辑，不用懂 nginx。

## 部署就三步

1. Hugging Face 上建一个 Space（SDK 选 Docker，建议 Private），再建一个空的 model 仓库当备份仓库；
2. Secrets 里填 `HF_REPO` 和 `HF_TOKEN`（写权限 token）；
3. `git push` 上去，等构建完成，打开 Space 地址。

初始账号是 `astrbot`，密码在启动日志里打印一次，记得去 `/admin/ui/` 改掉默认路由密码 `admin`。

## 项目地址

- GitHub：[qwc-ch/Astrbot-Napcat-huggingface](https://github.com/qwc-ch/Astrbot-Napcat-huggingface)（MIT 协议）

我自己的部署就跑在 HF 免费档上，目前体验：构建一次约 10 分钟，日常占用很低，Bot 常驻不掉线。如果你正好在找地方安家你的 AstrBot，可以试试。